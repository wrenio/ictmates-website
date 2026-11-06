type HCaptcha = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
};

/** Shared email delivery; WhatsApp preparation does not depend on this service. */
export function setupEnquiryEmail(form: HTMLFormElement, button: HTMLButtonElement, status: HTMLElement) {
  const accessKey = form.dataset.emailKey || '';
  // Web3Forms' public site key for its free hCaptcha integration.
  const sitekey = '50b2fe65-b00b-4b9e-ad62-3ba471098be2';
  const container = form.querySelector<HTMLElement>('[data-captcha]');
  const captchaStatus = form.querySelector<HTMLElement>('[data-captcha-status]');
  let token = '';
  let widget: string | undefined;
  let sending = false;
  const captchaWindow = window as Window & { hcaptcha?: HCaptcha; webstoreCaptchaReady?: () => void };
  const ready = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(accessKey);
  button.disabled = !ready;

  if (ready && container && captchaStatus) {
    captchaStatus.textContent = 'Loading spam protection…';
    const unavailable = () => {
      token = '';
      captchaStatus.textContent = 'Spam protection is unavailable. Reload to retry, or use WhatsApp.';
    };
    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js?onload=webstoreCaptchaReady&render=explicit&recaptchacompat=off';
    script.async = true;
    script.onerror = unavailable;
    captchaWindow.webstoreCaptchaReady = () => {
      try {
        widget = captchaWindow.hcaptcha?.render(container, {
          sitekey,
          theme: 'light',
          size: container.clientWidth < 304 ? 'compact' : 'normal',
          callback: (value: string) => {
            token = value;
            captchaStatus.textContent = 'Spam protection verified.';
          },
          'expired-callback': () => {
            token = '';
            captchaStatus.textContent = 'Verification expired. Please complete the check again.';
          },
          'chalexpired-callback': () => {
            token = '';
            captchaStatus.textContent = 'Verification timed out. Please complete the check again.';
          },
          'error-callback': () => { unavailable(); return true; },
        });
        if (widget === undefined) unavailable();
        else captchaStatus.textContent = 'Complete the spam-protection check to send by email.';
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
      if (widget !== undefined) captchaWindow.hcaptcha?.reset(widget);
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
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'error',
        body: JSON.stringify({
          access_key: accessKey,
          subject: enquiry,
          from_name: 'Webstore.pk',
          name: String(values.get('name') || '').trim(),
          ...(email ? { email } : {}),
          message,
          botcheck: false,
          'h-captcha-response': token,
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
      if (captchaStatus) captchaStatus.textContent = 'Complete the spam-protection check to send another enquiry.';
      sending = false;
      button.disabled = false;
      button.textContent = 'Send enquiry by email ↗︎';
      if (widget !== undefined) captchaWindow.hcaptcha?.reset(widget);
    }
  };
}
