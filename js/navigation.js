(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  if (header) {
    const syncHeaderHeight = () =>
      document.documentElement.style.setProperty(
        '--header-height',
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
    syncHeaderHeight();
    if ('ResizeObserver' in window) new ResizeObserver(syncHeaderHeight).observe(header);
    else window.addEventListener('resize', syncHeaderHeight);
  }
  const box = document.querySelector('[data-services-dropdown]'),
    trigger = box?.querySelector('button'),
    panel = box?.querySelector('[data-dropdown-panel]');
  const closeDropdown = (focus) => {
    if (!panel) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  };
  trigger?.addEventListener('click', () => {
    const open = trigger.getAttribute('aria-expanded') === 'true';
    panel.hidden = open;
    trigger.setAttribute('aria-expanded', String(!open));
    if (!open)
      window.BelowlineMotion?.play(
        panel,
        [
          { opacity: 0, transform: 'translateY(-6px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 160 },
      );
  });
  box?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown(true);
    }
    if (e.target === trigger && e.key === 'ArrowDown') {
      e.preventDefault();
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      panel.querySelector('a')?.focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (box && !box.contains(e.target)) closeDropdown(false);
  });
  document.addEventListener('focusin', (e) => {
    if (box && !box.contains(e.target)) closeDropdown(false);
  });
  const dialog = document.querySelector('[data-mobile-menu]'),
    opener = document.querySelector('[data-menu-open]');
  let scrollY = 0;
  if (dialog && opener) {
    const close = () => {
      if (dialog.open) dialog.close();
    };
    opener.addEventListener('click', () => {
      closeDropdown(false);
      scrollY = window.scrollY;
      dialog.showModal();
      document.body.style.top = `-${scrollY}px`;
      document.body.classList.add('menu-open');
      opener.setAttribute('aria-expanded', 'true');
      dialog.querySelector('[data-menu-close]')?.focus();
      window.BelowlineMotion?.menu(dialog);
    });
    dialog.querySelector('[data-menu-close]')?.addEventListener('click', close);
    dialog.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll('a[href],button,summary,[tabindex="0"]')].filter(
        (el) => el.getClientRects().length && !el.disabled,
      );
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('menu-open');
      document.body.style.top = '';
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      opener.setAttribute('aria-expanded', 'false');
      opener.focus();
    });
    dialog.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', (e) => {
        const u = new URL(a.href, location.href);
        if (u.origin === location.origin && u.pathname === location.pathname && u.hash) {
          e.preventDefault();
          close();
          requestAnimationFrame(() => {
            const target = document.getElementById(decodeURIComponent(u.hash.slice(1)));
            if (target) {
              history.pushState(null, '', u.hash);
              target.scrollIntoView({
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                  ? 'instant'
                  : 'smooth',
              });
              target.focus({ preventScroll: true });
            }
          });
        } else close();
      }),
    );
    matchMedia('(min-width: 1200px)').addEventListener('change', (e) => {
      if (e.matches) {
        close();
        closeDropdown(false);
      }
    });
  }
})();
