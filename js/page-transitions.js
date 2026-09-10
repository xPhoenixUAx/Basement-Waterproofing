(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animateInitialEntry = performance.getEntriesByType('navigation')[0]?.type !== 'reload';
  const pages = new Set([
    'index.html',
    'interior-waterproofing.html',
    'exterior-waterproofing.html',
    'sump-pump-systems.html',
    'foundation-crack-sealing.html',
    'privacy.html',
    'terms.html',
    'cookies.html',
  ]);
  const surfaces = () => [...document.querySelectorAll('main, .site-footer')];
  const canAnimate = () => !reduced.matches && typeof Element.prototype.animate === 'function';
  let animations = [];
  let destination = null;
  let leaveTimer = 0;
  let recoveryTimer = 0;

  const cancelAnimations = () => {
    animations.forEach((animation) => animation.cancel());
    animations = [];
  };
  const reset = () => {
    clearTimeout(leaveTimer);
    clearTimeout(recoveryTimer);
    destination = null;
    cancelAnimations();
    root.classList.remove('page-entering', 'page-leaving');
  };
  const enter = (animate = true) => {
    reset();
    if (!animate || !canAnimate()) return;
    animations = surfaces().map((el) =>
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 360,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'backwards',
      }),
    );
  };

  // This small script runs in the head so a new page never flashes before fading in.
  if (animateInitialEntry && canAnimate()) root.classList.add('page-entering');
  if (document.readyState === 'loading') {
    let shownEarly = false;
    const loadingFallback = setTimeout(() => {
      shownEarly = true;
      enter(false);
    }, 1500);
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        clearTimeout(loadingFallback);
        enter(animateInitialEntry && !shownEarly);
      },
      { once: true },
    );
  } else enter(animateInitialEntry);

  const navigate = () => {
    clearTimeout(leaveTimer);
    if (!destination) return;
    const url = destination;
    destination = null;
    try {
      location.assign(url);
      // A cancelled or stalled navigation must not leave the current page invisible.
      recoveryTimer = setTimeout(() => enter(), 2500);
    } catch {
      enter();
    }
  };

  document.addEventListener('click', (event) => {
    if (
      document.readyState === 'loading' ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !canAnimate()
    )
      return;
    const link = event.target.closest('a[href]');
    if (
      !link ||
      link.hasAttribute('download') ||
      (link.target && link.target.toLowerCase() !== '_self') ||
      link.relList.contains('external')
    )
      return;
    const url = new URL(link.href, location.href);
    if (
      !['http:', 'https:', 'file:'].includes(url.protocol) ||
      new URL('.', url).href !== new URL('.', location.href).href ||
      !pages.has(url.pathname.split('/').pop()) ||
      (url.pathname === location.pathname && url.search === location.search)
    )
      return;

    event.preventDefault();
    if (root.classList.contains('page-leaving')) return;
    const elements = surfaces();
    const opacity = elements.map((el) => getComputedStyle(el).opacity);
    cancelAnimations();
    root.classList.remove('page-entering');
    root.classList.add('page-leaving');
    animations = elements.map((el, index) =>
      el.animate([{ opacity: opacity[index] }, { opacity: 0 }], {
        duration: 180,
        easing: 'ease-out',
        fill: 'forwards',
      }),
    );
    destination = url.href;
    leaveTimer = setTimeout(navigate, 190);
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) enter();
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(leaveTimer);
    clearTimeout(recoveryTimer);
  });
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    const url = destination;
    reset();
    if (url) location.assign(url);
  });
})();
