<?php
declare(strict_types=1);
require __DIR__ . '/../webstore/public/api/enquiry.php';

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
$server = ['REQUEST_METHOD' => 'POST', 'HTTP_ORIGIN' => 'https://webstore.pk', 'CONTENT_TYPE' => 'application/json'];
$valid = ['name' => 'Test visitor', 'business' => 'Test business', 'city' => 'Lahore',
    'phone' => '+92 300 555 1575', 'email' => '', 'kind' => 'store', 'plan' => 'annual', 'token' => 'valid'];
$sent = []; $verified = 0;
$verify = function ($token) use (&$verified) { $verified++; return ['success' => $token === 'valid', 'hostname' => 'webstore.pk', 'action' => 'store']; };
$send = function (...$mail) use (&$sent) { $sent[] = $mail; };
$run = fn($data, $headers = null, $verification = null, $quota = null) => process_enquiry($headers ?? $server,
    is_array($data) ? json_encode($data) : $data, $verification ?? $verify, $quota ?? fn() => 'ok', $send);
check($run($valid)[0] === 200 && count($sent) === 1, 'Valid enquiry accepted');
check($sent[0][2] === '' && str_contains($sent[0][1], 'Rs. 30,000/year'), 'Optional email and selected plan preserved');
$sent = [];
foreach ([['token' => ''], ['token' => 'invalid'], ['website' => 'spam'], ['name' => ' '], ['phone' => 'bad'],
    ['email' => "a@example.com\r\nBcc: victim@example.com"], ['name' => ['array']], ['message' => str_repeat('x', 2001)],
    ['kind' => 'unknown'], ['plan' => 'arbitrary'], ['kind' => 'partner', 'partner_type' => 'unknown']] as $change) {
    check($run(array_replace($valid, $change))[0] === 400, 'Invalid enquiry rejected: ' . json_encode($change));
}
check($run($valid, array_replace($server, ['HTTP_ORIGIN' => 'https://attacker.example']))[0] === 403, 'Cross-site request blocked');
check($run($valid, array_replace($server, ['REQUEST_METHOD' => 'GET']))[0] === 405, 'GET blocked');
check($run('{invalid json')[0] === 400, 'Malformed JSON blocked');
check($run(str_repeat('x', 16385))[0] === 400, 'Oversized body blocked');
foreach ([['success' => false], ['success' => true, 'hostname' => 'attacker.example', 'action' => 'store'],
    ['success' => true, 'hostname' => 'webstore.pk', 'action' => 'partner']] as $result) {
    check($run($valid, null, fn() => $result)[0] === 400, 'Verification, hostname and action enforced');
}
check($run($valid, null, null, fn() => false)[0] === 429, 'Quota blocks SMTP');
check(count($sent) === 0, 'Rejected requests never reach SMTP');
$used = false;
$singleUse = function () use (&$used) {
    $result = ['success' => !$used, 'hostname' => 'webstore.pk', 'action' => 'store']; $used = true; return $result;
};
check($run($valid, null, $singleUse)[0] === 200, 'First validation accepted');
check($run($valid, null, $singleUse)[0] === 400 && count($sent) === 1, 'Provider rejection of reused token prevents second email');
$partner = array_replace($valid, ['kind' => 'partner', 'partner_type' => 'affiliate', 'email' => 'visitor@example.com']);
check($run($partner, null, fn() => ['success' => true, 'hostname' => 'www.webstore.pk', 'action' => 'partner'])[0] === 200, 'Partner route accepted');
check($sent[1][2] === 'visitor@example.com' && str_contains($sent[1][0], 'Affiliate'), 'Partner role and Reply-To preserved');
$quotaFile = tempnam(sys_get_temp_dir(), 'webstore-quota-');
try {
    check($run($valid, null, null, fn($token) => reserve_enquiry_quota($quotaFile, $token))[0] === 200, 'First server reservation accepted');
    $countBeforeReplay = count($sent);
    check($run($valid, null, null, fn($token) => reserve_enquiry_quota($quotaFile, $token))[0] === 400, 'Replay blocked even if provider accepts it again');
    check(count($sent) === $countBeforeReplay, 'Replay never reaches SMTP');
    for ($i = 1; $i < 100; $i++) check(reserve_enquiry_quota($quotaFile, 'token-' . $i) === 'ok', 'Quota allows normal traffic');
    check(reserve_enquiry_quota($quotaFile, 'extra') === 'limited', 'Quota rejects excess');
    file_put_contents($quotaFile, json_encode([time() - 3601]));
    check(reserve_enquiry_quota($quotaFile, 'fresh') === 'ok', 'Old quota entries expire');
} finally { unlink($quotaFile); }
echo "Enquiry handler: validation, provider rejection, replay rejection, fixed content and quota checks passed.\n";
