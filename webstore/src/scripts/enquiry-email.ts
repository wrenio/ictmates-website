type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
};

/** Shared email delivery; WhatsApp preparation does not depend on this service. */
export function setupEnquiryEmail(form: HTMLFormElement, button: HTMLButtonElement, status: HTMLElement) {
  const endpoint = form.dataset.emailEndpoint || '';
  const sitekey = form.dataset.turnstileKey || '';
  const container = form.querySelector<HTMLElement>('[data-captcha]');
  const captchaStatus = form.querySelector<HTMLElement>('[data-captcha-status]');
  let token = '';
  let widget: string | undefined;
  let sending = false;
  const turnstile = () => (window as Window & { turnstile?: Turnstile }).turnstile;
  const ready = /^https:\/\/forms\.un-static\.com\/forms\/[a-f0-9]{40}\/ajax$/.test(endpoint) && !!sitekey;
  button.disabled = !ready;

  if (ready && container && captchaStatus) {
    captchaStatus.textContent = 'Loading spam protection…';
    const unavailable = () => {
      token = '';
      captchaStatus.textContent = 'Spam protection is unavailable. Reload to retry, or use WhatsApp.';
    };
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onerror = unavailable;
    script.onload = () => {
      try {
        widget = turnstile()?.render(container, {
          sitekey,
          theme: 'light',
          size: container.clientWidth < 300 ? 'compact' : 'flexible',
          'response-field': false,
          callback: (value: string) => {
            token = value;
            captchaStatus.textContent = 'Spam protection verified.';
          },
          'expired-callback': () => {
            token = '';
            captchaStatus.textContent = 'Verification expired. Please wait for a fresh check or retry sending.';
          },
          'timeout-callback': () => {
            token = '';
            captchaStatus.textContent = 'Verification timed out. Please complete the check again.';
          },
          'error-callback': () => { unavailable(); return true; },
        });
        if (widget === undefined) unavailable();
      } catch { unavailable(); }
    };
    document.head.append(script);
  }

  return async (message: string, enquiry: string) => {
    if (!ready || sending) return;
    const values = new FormData(form);
    if (String(values.get('website') || '').trim()) return;
    if (!token) {
      status.textContent = 'Please complete the spam-protection check before sending by email. WhatsApp is also available.';
      if (widget !== undefined) turnstile()?.reset(widget);
      return;
    }
    sending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    status.textContent = 'Sending your enquiry by email…';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const email = String(values.get('email') || '').trim();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'error',
        body: JSON.stringify({
          enquiry,
          name: String(values.get('name') || '').trim(),
          ...(email ? { email } : {}),
          message,
          website: '',
          'cf-turnstile-response': token,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error('Submission not confirmed');
      status.textContent = 'Thank you. Your enquiry has been sent by email to ICT Mates. We’ll contact you using the details you provided.';
    } catch {
      status.textContent = 'We couldn’t confirm email delivery. Your details are still here. Please try again later or use WhatsApp instead.';
    } finally {
      window.clearTimeout(timeout);
      token = '';
      sending = false;
      button.disabled = false;
      button.textContent = 'Send enquiry by email ↗︎';
      if (widget !== undefined) turnstile()?.reset(widget);
    }
  };
}
