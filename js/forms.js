(() => {
  'use strict';
  const allowed = [
    'interior-waterproofing',
    'exterior-waterproofing',
    'sump-pump-systems',
    'foundation-crack-sealing',
    'unsure',
  ];
  const form = document.querySelector('[data-request-form]');
  if (!form) return;
  const select = form.elements.service;
  const service = new URLSearchParams(location.search).get('service');
  if (allowed.includes(service)) select.value = service;
  document.querySelectorAll('[data-select-service]').forEach((a) =>
    a.addEventListener('click', () => {
      if (allowed.includes(a.dataset.selectService)) select.value = a.dataset.selectService;
    }),
  );
  const submit = form.querySelector('[type="submit"]'),
    receipt = document.querySelector('[data-form-receipt]');
  let submitted = false;
  const id = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) =>
          x.toString(16).padStart(2, '0'),
        ).join('');
  const fetchJSON = async (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const r = await fetch(url, {
        ...options,
        signal: controller.signal,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', ...options.headers },
      });
      let data;
      try {
        data = await r.json();
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new Error('invalid-response');
      }
      if (!data || typeof data !== 'object') throw new Error('invalid-response');
      return { response: r, data };
    } finally {
      clearTimeout(timer);
    }
  };
  const sendInBackground = async (payload) => {
    if (location.protocol === 'file:') return;
    try {
      payload.set('requestId', id());
      const token = await fetchJSON(form.action);
      if (!token.response.ok || typeof token.data.csrf !== 'string' || !token.data.csrf) return;
      payload.set('csrf', token.data.csrf);
      await fetchJSON(form.action, { method: 'POST', body: payload, keepalive: true });
    } catch {
      // The confirmation is intentionally independent of server availability.
    }
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submitted) return;
    ['zip', 'name', 'email', 'details'].forEach((key) => {
      form.elements[key].value = form.elements[key].value.trim();
    });
    form.elements.name.setCustomValidity(
      [...form.elements.name.value].length < 2 ? 'Please enter at least 2 characters.' : '',
    );
    form.elements.details.setCustomValidity(
      [...form.elements.details.value].length < 10 ? 'Please enter at least 10 characters.' : '',
    );
    if (!form.reportValidity()) return;
    const payload = new FormData(form);
    submitted = true;
    submit.disabled = true;
    form.hidden = true;
    receipt.hidden = false;
    receipt.focus();
    window.BelowlineMotion?.play(receipt, [{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
    void sendInBackground(payload);
  });
  form.elements.details.addEventListener('input', () =>
    form.elements.details.setCustomValidity(''),
  );
  form.elements.name.addEventListener('input', () => form.elements.name.setCustomValidity(''));
})();
