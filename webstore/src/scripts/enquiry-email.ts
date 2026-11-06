type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

/** Shared email delivery; WhatsApp preparation does not depend on this service. */
export function setupEnquiryEmail(form: HTMLFormElement, button: HTMLButtonElement, status: HTMLElement) {
  const sitekey = form.dataset.captchaKey || '';
  const kind = form.dataset.enquiryKind || '';
  const container = form.querySelector<HTMLElement>('[data-captcha]');
  const captchaStatus = form.querySelector<HTMLElement>('[data-captcha-status]');
  let token = '';
  let widget: string | undefined;
  let sending = false;
  const captchaWindow = window as Window & { turnstile?: Turnstile; webstoreCaptchaReady?: () => void };
  const ready = !!sitekey && ['store', 'partner'].includes(kind);
  button.disabled = !ready;

  if (ready && container && captchaStatus) {
    captchaStatus.textContent = 'Loading spam protection…';
    const unavailable = () => {
      token = '';
      captchaStatus.textContent = 'Spam protection is unavailable. Reload to retry, or use WhatsApp.';
    };
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=webstoreCaptchaReady&render=explicit';
    script.async = true;
    script.onerror = unavailable;
    let widgetSize: 'compact' | 'flexible' | undefined;
    const renderWidget = () => {
      const size = container.clientWidth < 300 ? 'compact' : 'flexible';
      if (widget !== undefined && size === widgetSize) return;
      try {
        if (widget !== undefined) {
          captchaWindow.turnstile?.remove(widget);
          widget = undefined;
        }
        token = '';
        widgetSize = size;
        widget = captchaWindow.turnstile?.render(container, {
          sitekey,
          theme: 'light',
          size,
          action: kind,
          callback: (value: string) => {
            token = value;
            captchaStatus.textContent = 'Spam protection verified.';
          },
          'expired-callback': () => {
            token = '';
            captchaStatus.textContent = 'Verification expired. Please complete the check again.';
          },
          'timeout-callback': () => {
            token = '';
            captchaStatus.textContent = 'Verification timed out. Please complete the check again.';
          },
          'error-callback': () => { unavailable(); return true; },
        });
        if (widget === undefined) unavailable();
        else captchaStatus.textContent = 'Complete the spam-protection check to send by email.';
      } catch { unavailable(); }
    };
    captchaWindow.webstoreCaptchaReady = () => {
      renderWidget();
      new ResizeObserver(() => {
        if (widget !== undefined) renderWidget();
      }).observe(container);
    };
    document.head.append(script);
  }

  return async () => {
    if (!ready || sending) return;
    const values = new FormData(form);
    if (String(values.get('website') || '').trim()) return;
    if (!token) {
      status.textContent = 'Please complete the spam-protection check before sending by email. WhatsApp is also available.';
      if (widget !== undefined) captchaWindow.turnstile?.reset(widget);
      return;
    }
    sending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    status.textContent = 'Sending your enquiry by email…';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const fields = Object.fromEntries(['name', 'business', 'city', 'phone', 'email', 'message', 'website', 'plan', 'partner_type']
        .map(key => [key, String(values.get(key) || '').trim()]));
      const response = await fetch('/api/enquiry.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'error',
        body: JSON.stringify({
          ...fields, kind, token,
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
      if (widget !== undefined) captchaWindow.turnstile?.reset(widget);
    }
  };
}
