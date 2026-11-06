import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnquiryEmail } from '../webstore/src/scripts/enquiry-email.ts';

// Exercise delivery decisions independently of third-party services and real inboxes.
test('email requires verification, handles API rejection, and consumes tokens once', async () => {
  const originals = Object.fromEntries(['window', 'document', 'FormData', 'fetch'].map(key => [key, globalThis[key]]));
  let callbacks, script, resetCount = 0, requests = [];
  const values = new Map([['name', ' Test enquiry '], ['email', ''], ['website', '']]);
  const captchaStatus = { textContent: '' };
  const button = { disabled: true, textContent: '' };
  const status = { textContent: '' };
  const container = { clientWidth: 240 };
  const form = {
    dataset: { emailKey: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    querySelector: selector => selector === '[data-captcha]' ? container : captchaStatus,
  };
  globalThis.window = { setTimeout, clearTimeout, hcaptcha: {
    render: (_container, options) => { callbacks = options; return 'widget'; },
    reset: () => { resetCount++; },
  } };
  globalThis.document = { createElement: () => ({}), head: { append: value => { script = value; window.webstoreCaptchaReady(); } } };
  globalThis.FormData = class { get(key) { return values.get(key); } };
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ success: true }) };
  };
  try {
    const send = setupEnquiryEmail(form, button, status);
    assert.equal(callbacks.size, 'compact');
    await send('message', 'Store');
    assert.equal(requests.length, 0, 'No token must never reach email provider');
    callbacks.callback('verified-token');
    values.set('website', 'bot-filled');
    await send('message', 'Store');
    assert.equal(requests.length, 0, 'Honeypot prevents a request');
    values.set('website', '');
    await send('message', 'Store');
    assert.equal(requests.length, 1);
    assert.equal(requests[0]['h-captcha-response'], 'verified-token');
    assert.equal(requests[0].name, 'Test enquiry');
    assert.equal(requests[0].subject, 'Store');
    assert.equal(requests[0].access_key, form.dataset.emailKey);
    assert.equal(requests[0].botcheck, false);
    assert.equal('email' in requests[0], false, 'Optional email remains optional');
    assert.match(status.textContent, /Thank you/);
    assert.ok(resetCount > 0);
    await send('message', 'Store');
    assert.equal(requests.length, 1, 'Consumed token is not reused');

    globalThis.fetch = async () => ({ ok: true, json: async () => ({ success: false, result: 'invalid-recaptcha-response' }) });
    callbacks.callback('another-token');
    await send('message', 'Partner');
    assert.match(status.textContent, /couldn’t confirm/, 'HTTP 200 alone is not success');
    assert.equal(values.get('name'), ' Test enquiry ', 'Failure preserves input');
    assert.equal(button.disabled, false);

    let finish;
    globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
    callbacks.callback('third-token');
    const pending = send('message', 'Partner');
    assert.equal(button.disabled, true);
    await send('duplicate', 'Partner');
    finish({ ok: false, json: async () => ({ success: true }) });
    await pending;
    assert.match(status.textContent, /couldn’t confirm/);
    callbacks.callback('expired-token');
    callbacks['expired-callback']();
    await send('message', 'Store');
    assert.match(status.textContent, /complete the spam-protection check/);
    script.onerror();
    assert.match(captchaStatus.textContent, /unavailable/);
    assert.equal(setupEnquiryEmail({ ...form, dataset: {} }, button, status) instanceof Function, true);
    assert.equal(button.disabled, true, 'Missing configuration disables email');
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
