(() => {
  'use strict';
  const c = window.SITE_CONFIG;
  if (!c) return;
  const get = (path) => path.split('.').reduce((v, k) => v?.[k], c);
  const localAsset = (value) => {
    try {
      const u = new URL(value, document.baseURI);
      return u.origin === location.origin && ['http:', 'https:', 'file:'].includes(u.protocol)
        ? u.href
        : null;
    } catch {
      return null;
    }
  };
  document.querySelectorAll('[data-config]').forEach((el) => {
    const value = get(el.dataset.config);
    if (typeof value === 'string') {
      el.textContent = value;
      if (el.tagName === 'TIME') el.dateTime = value;
    }
  });
  document.querySelectorAll('[data-contact-email]').forEach((el) => {
    const v = c.contact.email;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      el.textContent = v;
      el.href = 'mailto:' + v;
    }
  });
  document.querySelectorAll('[data-logo]').forEach((el) => {
    const fallback = () => {
      el.hidden = true;
    };
    el.addEventListener('error', fallback, { once: true });
    const p = localAsset(c.brand.logo);
    if (p) el.src = p;
    el.alt = '';
    if (el.complete && !el.naturalWidth) fallback();
  });
  document.querySelectorAll('[data-brand-name]').forEach((el) => {
    el.textContent = c.brand.name;
  });
  const icon = document.querySelector('link[rel="icon"]');
  const p = localAsset(c.brand.favicon);
  if (icon && p) icon.href = p;
  const key = document.documentElement.dataset.page;
  const title = c.pageTitles[key];
  if (title) document.title = title.replaceAll('{brand}', c.brand.name);
  document
    .querySelectorAll('[data-year]')
    .forEach((el) => (el.textContent = String(new Date().getFullYear())));
})();
