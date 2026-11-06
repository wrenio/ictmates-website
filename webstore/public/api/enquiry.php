<?php
declare(strict_types=1);
ini_set('display_errors', '0');

// The only public form endpoint. Credentials and quota state live outside public_html.
function enquiry_result(int $status, string $message): array
{
    return [$status, ['success' => $status === 200, 'message' => $message]];
}

function process_enquiry(array $server, string $raw, callable $verify, callable $quota, callable $send): array
{
    if (($server['REQUEST_METHOD'] ?? '') !== 'POST') {
        return enquiry_result(405, 'Use the enquiry form to send a message.');
    }
    if (!in_array($server['HTTP_ORIGIN'] ?? '', ['https://webstore.pk', 'https://www.webstore.pk'], true)) {
        return enquiry_result(403, 'Please send your enquiry from Webstore.pk.');
    }
    if (strlen($raw) > 16384 || !str_starts_with(strtolower($server['CONTENT_TYPE'] ?? ''), 'application/json')) {
        return enquiry_result(400, 'Invalid enquiry.');
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) return enquiry_result(400, 'Invalid enquiry.');
    $limits = ['name' => 100, 'business' => 120, 'city' => 80, 'phone' => 40,
        'email' => 254, 'message' => 2000, 'website' => 200, 'kind' => 10,
        'plan' => 12, 'partner_type' => 12, 'token' => 2048];
    $fields = [];
    foreach ($limits as $key => $limit) {
        $value = $data[$key] ?? '';
        if (!is_string($value) || !preg_match('//u', $value) || mb_strlen($value, 'UTF-8') > $limit ||
            preg_match($key === 'message' ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/' : '/[\x00-\x1F\x7F]/', $value)) {
            return enquiry_result(400, 'Please check your enquiry details.');
        }
        $fields[$key] = trim($value);
    }
    if ($fields['website'] !== '') return enquiry_result(400, 'Unable to accept this enquiry.');
    foreach (['name', 'business', 'city', 'phone'] as $key) {
        if ($fields[$key] === '') return enquiry_result(400, 'Please complete the required fields.');
    }
    if (!preg_match('/^[+0-9() .-]{7,40}$/', $fields['phone']) ||
        ($fields['email'] !== '' && !filter_var($fields['email'], FILTER_VALIDATE_EMAIL))) {
        return enquiry_result(400, 'Please check your phone number and email address.');
    }
    $kind = $fields['kind'];
    $plans = ['undecided' => 'Help me choose', 'monthly' => 'Monthly — Rs. 3,000/month', 'annual' => 'Annual — Rs. 30,000/year'];
    if (!in_array($kind, ['store', 'partner'], true) ||
        ($kind === 'store' && !isset($plans[$fields['plan']])) ||
        ($kind === 'partner' && !in_array($fields['partner_type'], ['reseller', 'affiliate'], true))) {
        return enquiry_result(400, 'Please choose a valid plan or partner role.');
    }
    if ($fields['token'] === '') return enquiry_result(400, 'Please complete spam protection.');
    // A direct Siteverify request consumes the token; failures never reach SMTP.
    $check = $verify($fields['token']);
    if (($check['success'] ?? false) !== true ||
        !in_array($check['hostname'] ?? '', ['webstore.pk', 'www.webstore.pk'], true) ||
        ($check['action'] ?? '') !== $kind) {
        return enquiry_result(400, 'Verification failed or expired. Please try again.');
    }
    $reservation = $quota($fields['token']);
    if ($reservation === 'duplicate') return enquiry_result(400, 'This verification has already been used. Please verify again.');
    if ($reservation !== 'ok') return enquiry_result(429, 'Please try again later or contact us on WhatsApp.');
    $subject = $kind === 'store' ? 'Webstore.pk webshop enquiry' : 'Webstore.pk partner enquiry — ' . ucfirst($fields['partner_type']);
    $body = $subject . "\n\nName: {$fields['name']}\nBusiness / creator: {$fields['business']}\nCity: {$fields['city']}\nPhone: {$fields['phone']}\n";
    if ($fields['email'] !== '') $body .= "Email: {$fields['email']}\n";
    $body .= $kind === 'store' ? 'Plan preference: ' . $plans[$fields['plan']] : 'Partner type: ' . ucfirst($fields['partner_type']);
    if ($fields['message'] !== '') $body .= "\n\n" . $fields['message'];
    $send($subject, $body, $fields['email'], $fields['name']);
    return enquiry_result(200, 'Your enquiry has been sent to ICT Mates.');
}

function verify_enquiry_token(string $token, string $secret): array
{
    $curl = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query([
        'secret' => $secret, 'response' => $token]), CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 10, CURLOPT_FOLLOWLOCATION => false]);
    $response = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($response === false || $status !== 200) throw new RuntimeException('Verification unavailable');
    $result = json_decode($response, true);
    return is_array($result) ? $result : [];
}

function reserve_enquiry_quota(string $path, string $token): string
{
    // Global SMTP cap: at most 100 verified enquiries per rolling hour, across both forms.
    // Reserve each token hash before SMTP, under a lock. This prevents duplicate
    // delivery independently of the verification provider, including concurrent requests.
    $file = fopen($path, 'c+');
    if ($file === false || !flock($file, LOCK_EX)) throw new RuntimeException('Quota unavailable');
    try {
        $text = stream_get_contents($file);
        $previous = $text === '' ? [] : json_decode($text, true);
        if (!is_array($previous)) throw new RuntimeException('Invalid quota state');
        $now = time();
        // Preserve counts from the timestamp-only state written by the first release.
        $records = array_map(fn($entry) => is_int($entry) ? ['time' => $entry, 'hash' => ''] : $entry, $previous);
        $times = array_values(array_filter($records, fn($entry) => is_array($entry) &&
            is_int($entry['time'] ?? null) && $entry['time'] > $now - 3600));
        $hash = hash('sha256', $token);
        foreach ($times as $entry) {
            if (($entry['hash'] ?? '') === $hash) return 'duplicate';
        }
        if (count($times) >= 100) return 'limited';
        $times[] = ['time' => $now, 'hash' => $hash];
        rewind($file);
        if (!ftruncate($file, 0) || fwrite($file, json_encode($times)) === false || !fflush($file)) {
            throw new RuntimeException('Quota write failed');
        }
        return 'ok';
    } finally {
        flock($file, LOCK_UN);
        fclose($file);
    }
}

// CLI imports expose the real validation pipeline for tests without sending mail.
if (PHP_SAPI === 'cli') return;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Allow: POST');
try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        [$status, $result] = enquiry_result(405, 'Use the enquiry form to send a message.');
    } else {
        $private = '/home/customer/.webstore-forms';
        $config = json_decode((string) file_get_contents($private . '/config.json'), true, 16, JSON_THROW_ON_ERROR);
        foreach (['turnstile_secret', 'smtp_host', 'smtp_username', 'smtp_password'] as $key) {
            if (!is_string($config[$key] ?? null) || $config[$key] === '') throw new RuntimeException('Email configuration missing');
        }
        require_once __DIR__ . '/mail/Exception.php';
        require_once __DIR__ . '/mail/PHPMailer.php';
        require_once __DIR__ . '/mail/SMTP.php';
        [$status, $result] = process_enquiry($_SERVER, file_get_contents('php://input', false, null, 0, 16385),
            fn($token) => verify_enquiry_token($token, $config['turnstile_secret']),
            fn($token) => reserve_enquiry_quota($private . '/quota.json', $token),
            function ($subject, $body, $replyEmail, $replyName) use ($config) {
                $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                $mail->isSMTP();
                $mail->Host = $config['smtp_host'];
                $mail->Port = 465;
                $mail->SMTPAuth = true;
                $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
                $mail->Username = $config['smtp_username'];
                $mail->Password = $config['smtp_password'];
                $mail->Timeout = 10;
                $mail->CharSet = 'UTF-8';
                $mail->setFrom('website@webstore.pk', 'Webstore.pk');
                $mail->addAddress('azeem@ictmates.com', 'ICT Mates');
                if ($replyEmail !== '') $mail->addReplyTo($replyEmail, $replyName);
                $mail->Subject = $subject;
                $mail->Body = $body;
                $mail->send();
            });
    }
} catch (Throwable $error) {
    // Never expose SMTP diagnostics, credentials or visitor details in responses/logs.
    error_log('Webstore enquiry delivery failed (' . get_class($error) . ')');
    [$status, $result] = enquiry_result(503, 'Email is temporarily unavailable. Please try again or use WhatsApp.');
}
http_response_code($status);
echo json_encode($result);
