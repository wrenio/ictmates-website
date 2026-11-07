import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnquiryEmail } from '../src/scripts/enquiry-email.ts';

// Exercise delivery decisions independently of third-party services and real inboxes.
test('email requires verification, handles API rejection, and consumes tokens once', async () => {
  const originals = Object.fromEntries(['window', 'document', 'FormData', 'fetch', 'ResizeObserver'].map(key => [key, globalThis[key]]));
  let callbacks, script, resize, resetCount = 0, removeCount = 0, renderCount = 0, requests = [];
  const values = new Map([['name', ' Test enquiry '], ['email', ''], ['website', ''], ['partner_type', 'affiliate']]);
  const captchaStatus = { textContent: '' };
  const button = { disabled: true, textContent: '' };
  const status = { textContent: '' };
  const container = { clientWidth: 240 };
  const form = {
    dataset: { captchaKey: 'public-site-key', enquiryAction: 'partner' },
    querySelector: selector => selector === '[data-captcha]' ? container : captchaStatus,
  };
  globalThis.window = { setTimeout, clearTimeout, turnstile: {
    render: (_container, options) => { callbacks = options; renderCount++; return 'widget'; },
    reset: () => { resetCount++; },
    remove: () => { removeCount++; },
  } };
  globalThis.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe(target) { assert.equal(target, container); }
  };
  globalThis.document = { createElement: () => ({}), head: { append: value => { script = value; window.ictmatesCaptchaReady(); } } };
  globalThis.FormData = class { get(key) { return values.get(key); } };
  globalThis.fetch = async (_url, options) => {
    assert.equal(_url, '/api/enquiry.php');
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ success: true }) };
  };
  try {
    const send = setupEnquiryEmail(form, button, status);
    assert.equal(callbacks.size, 'compact');
    assert.equal(callbacks.action, 'partner');
    resize();
    assert.equal(renderCount, 1, 'Same size must preserve the widget');
    container.clientWidth = 400;
    resize();
    assert.equal(callbacks.size, 'flexible');
    callbacks.callback('desktop-token');
    container.clientWidth = 210;
    resize();
    assert.equal(callbacks.size, 'compact', 'Shrinking the form replaces the wide widget');
    assert.equal(removeCount, 2);
    await send();
    assert.equal(requests.length, 0, 'Resizing invalidates the removed widget’s token');
    container.clientWidth = 240;
    resize();
    assert.equal(renderCount, 3, 'Resizing within compact mode does not restart verification');
    await send();
    assert.equal(requests.length, 0, 'No token must never reach email provider');
    callbacks.callback('verified-token');
    values.set('website', 'bot-filled');
    await send();
    assert.equal(requests.length, 0, 'Honeypot prevents a request');
    values.set('website', '');
    await send();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].token, 'verified-token');
    assert.equal(requests[0].name, 'Test enquiry');
    assert.equal(requests[0].partner_type, 'affiliate');
    assert.equal(requests[0].action, 'partner');
    assert.equal(requests[0].website, '');
    assert.equal(requests[0].email, '', 'Optional email remains optional');
    assert.match(status.textContent, /Thank you/);
    assert.ok(resetCount > 0);
    await send();
    assert.equal(requests.length, 1, 'Consumed token is not reused');

    globalThis.fetch = async () => ({ ok: true, json: async () => ({ success: false, result: 'invalid-recaptcha-response' }) });
    callbacks.callback('another-token');
    await send();
    assert.match(status.textContent, /couldn’t confirm/, 'HTTP 200 alone is not success');
    assert.equal(values.get('name'), ' Test enquiry ', 'Failure preserves input');
    assert.equal(button.disabled, false);

    let finish;
    globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
    callbacks.callback('third-token');
    const pending = send();
    assert.equal(button.disabled, true);
    await send();
    finish({ ok: false, json: async () => ({ success: true }) });
    await pending;
    assert.match(status.textContent, /couldn’t confirm/);
    callbacks.callback('expired-token');
    callbacks['expired-callback']();
    await send();
    assert.match(status.textContent, /complete the spam-protection check/);
    const sendContact = setupEnquiryEmail({ ...form, dataset: { ...form.dataset, enquiryAction: 'contact' } }, button, status);
    assert.equal(callbacks.action, 'contact');
    values.set('message', 'A contact enquiry');
    globalThis.fetch = async (_url, options) => {
      assert.equal(_url, '/api/enquiry.php');
      const request = JSON.parse(options.body);
      assert.equal(request.action, 'contact');
      assert.equal(request.message, 'A contact enquiry');
      return { ok: true, json: async () => ({ success: true }) };
    };
    callbacks.callback('contact-token');
    await sendContact();
    assert.match(status.textContent, /Thank you/);
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
