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
  // Keep the native field as the source of truth for form submission and autofill.
  const picker = document.createElement('div');
  picker.className = 'service-select';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'request-service-control';
  trigger.className = 'service-select__trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'request-service-options');
  trigger.setAttribute('aria-labelledby', 'request-service-label');
  trigger.setAttribute('aria-describedby', 'request-service-error');
  const list = document.createElement('ul');
  list.id = 'request-service-options';
  list.className = 'service-select__options';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-labelledby', 'request-service-label');
  list.hidden = true;
  const options = [...select.options].map((option, index) => {
    const item = document.createElement('li');
    item.id = `request-service-option-${index}`;
    item.className = 'service-select__option';
    item.setAttribute('role', 'option');
    item.textContent = option.text;
    list.append(item);
    return item;
  });
  picker.append(trigger, list);
  select.after(picker);
  select.hidden = true;
  document.getElementById('request-service-label').htmlFor = trigger.id;
  let activeIndex = select.selectedIndex;
  let search = '';
  let lastTyped = 0;
  let expanded = false;
  let menuAnimation;
  const currentFrame = () => {
    const style = getComputedStyle(list);
    return { opacity: style.opacity, transform: style.transform };
  };
  const tuckedFrame = () => ({
    opacity: 0,
    transform: `translateY(${picker.dataset.side === 'top' ? 8 : -8}px)`,
  });
  const sync = () => {
    trigger.textContent = select.selectedOptions[0].text;
    options.forEach((item, index) =>
      item.setAttribute('aria-selected', String(index === select.selectedIndex)),
    );
  };
  const activate = (index) => {
    activeIndex = Math.max(0, Math.min(options.length - 1, index));
    options.forEach((item, i) => item.classList.toggle('is-active', i === activeIndex));
    trigger.setAttribute('aria-activedescendant', options[activeIndex].id);
    options[activeIndex].scrollIntoView({ block: 'nearest' });
  };
  const close = (commit = false) => {
    if (!expanded) return;
    if (commit && select.selectedIndex !== activeIndex) {
      select.selectedIndex = activeIndex;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    expanded = false;
    list.inert = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    search = '';
    const animation = window.BelowlineMotion?.play(list, [currentFrame(), tuckedFrame()], {
      duration: 160,
    });
    menuAnimation = animation;
    const finish = () => {
      if (!expanded && menuAnimation === animation) list.hidden = true;
    };
    if (animation) animation.finished.then(finish, finish);
    else finish();
  };
  const open = () => {
    const rect = trigger.getBoundingClientRect();
    const below = innerHeight - rect.bottom - 16;
    const header = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
    const above = rect.top - header - 16;
    const upwards = below < 280 && above > below;
    picker.dataset.side = upwards ? 'top' : 'bottom';
    list.style.maxHeight = `${Math.max(96, Math.min(320, upwards ? above : below))}px`;
    const start = list.hidden ? tuckedFrame() : currentFrame();
    expanded = true;
    list.hidden = false;
    list.inert = false;
    trigger.setAttribute('aria-expanded', 'true');
    activate(select.selectedIndex);
    menuAnimation = window.BelowlineMotion?.play(
      list,
      [start, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 240 },
    );
  };
  trigger.addEventListener('click', () => (expanded ? close() : open()));
  trigger.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { key } = event;
    if (key === 'Tab') {
      close(true);
      return;
    }
    if (key === 'Escape') {
      if (expanded) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (!expanded) open();
      else close(true);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      const wasClosed = !expanded;
      if (wasClosed) open();
      if (key === 'Home') activate(0);
      else if (key === 'End') activate(options.length - 1);
      else if (!wasClosed) activate(activeIndex + (key === 'ArrowDown' ? 1 : -1));
    } else if (key.length === 1) {
      event.preventDefault();
      if (!expanded) open();
      const now = Date.now();
      search = now - lastTyped > 700 ? key.toLowerCase() : search + key.toLowerCase();
      lastTyped = now;
      const prefix = [...search].every((char) => char === search[0]) ? search[0] : search;
      const start = prefix.length === 1 ? activeIndex + 1 : activeIndex;
      const match = options.findIndex((_, offset) =>
        options[(start + offset) % options.length].textContent.toLowerCase().startsWith(prefix),
      );
      if (match !== -1) activate((start + match) % options.length);
    }
  });
  list.addEventListener('pointerdown', (event) => event.preventDefault());
  list.addEventListener('click', (event) => {
    const index = options.indexOf(event.target.closest('[role="option"]'));
    if (index === -1) return;
    activate(index);
    close(true);
    trigger.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', (event) => {
    if (!picker.contains(event.target)) close();
  });
  picker.addEventListener('focusout', (event) => {
    if (!picker.contains(event.relatedTarget)) close();
  });
  window.addEventListener('resize', () => close());
  select.addEventListener('change', sync);
  form.addEventListener('reset', () => {
    close();
    setTimeout(sync, 0);
  });
  sync();
  document.querySelectorAll('[data-select-service]').forEach((a) =>
    a.addEventListener('click', () => {
      if (allowed.includes(a.dataset.selectService)) {
        select.value = a.dataset.selectService;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
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
