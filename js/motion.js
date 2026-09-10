(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set();
  const latest = new WeakMap();
  const play = (el, frames, options) => {
    if (!el || reduced.matches || !el.animate) return;
    latest.get(el)?.cancel();
    const a = el.animate(frames, {
      duration: 480,
      easing: 'cubic-bezier(.22,1,.36,1)',
      fill: 'backwards',
      ...options,
    });
    active.add(a);
    latest.set(el, a);
    a.finished.catch(() => {}).finally(() => active.delete(a));
    return a;
  };
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      active.forEach((a) => a.cancel());
      active.clear();
      document
        .querySelectorAll('.motion-pending')
        .forEach((el) => el.classList.remove('motion-pending'));
    }
  });
  if ('IntersectionObserver' in window && !reduced.matches) {
    const targets = new Map();
    document.querySelectorAll('[data-reveal],[data-reveal-group],.about-photo').forEach((el) => {
      if (el.hasAttribute('data-reveal-group')) {
        [...el.children].forEach((item) => targets.set(item, el));
      } else if (!targets.has(el)) {
        targets.set(el, null);
      }
    });
    const io = new IntersectionObserver(
      (entries) => {
        const stagger = new Map();
        entries.forEach((entry) => {
          if (!entry.isIntersecting || !entry.target.classList.contains('motion-pending')) return;
          const el = entry.target;
          io.unobserve(el);
          const group = targets.get(el);
          const index = group ? stagger.get(group) || 0 : 0;
          if (group) stagger.set(group, index + 1);
          play(
            el,
            [
              { opacity: 0, translate: `0 ${innerWidth < 768 ? 18 : 26}px` },
              { opacity: 1, translate: '0 0' },
            ],
            { duration: 640, delay: Math.min(index, 3) * 75 },
          );
          // Backwards fill keeps delayed cards hidden until their own animation starts.
          el.classList.remove('motion-pending');
        });
      },
      { threshold: 0, rootMargin: '0px 0px -32px 0px' },
    );
    targets.forEach((group, el) => {
      // Animate a block or its children, never both at the same time.
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        if (targets.has(parent)) return;
      }
      // Never hide content that is already in view, including restored scroll positions.
      if (el.getBoundingClientRect().top < innerHeight) return;
      el.classList.add('motion-pending');
      io.observe(el);
    });
    document.addEventListener('focusin', (event) => {
      const pending = event.target.closest('.motion-pending');
      if (!pending) return;
      io.unobserve(pending);
      pending.classList.remove('motion-pending');
    });
  }
  document.querySelectorAll('.faq details, .mobile-links details').forEach((details) => {
    const summary = details.querySelector(':scope > summary');
    const content = summary?.nextElementSibling;
    if (!summary || !content) return;

    let animation = null;
    let expanded = details.open;

    const finish = () => {
      animation?.cancel();
      animation = null;
      details.open = expanded;
      content.inert = !expanded;
      details.style.removeProperty('height');
      details.style.removeProperty('overflow');
      summary.removeAttribute('aria-expanded');
      delete details.dataset.accordionState;
    };

    summary.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.target.closest('a, button, input')) return;
      event.preventDefault();

      const startHeight = details.getBoundingClientRect().height;
      expanded = animation ? !expanded : !details.open;
      animation?.cancel();
      animation = null;

      if (!expanded && content.contains(document.activeElement)) {
        summary.focus({ preventScroll: true });
      }
      content.inert = !expanded;

      if (reduced.matches || !details.animate) {
        finish();
        return;
      }

      // Keep the content rendered until the closing animation finishes.
      details.open = true;
      details.style.height = 'auto';
      const style = getComputedStyle(details);
      const closedHeight =
        summary.getBoundingClientRect().height +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.borderBottomWidth);
      const endHeight = expanded ? details.getBoundingClientRect().height : closedHeight;

      details.style.height = `${startHeight}px`;
      details.style.overflow = 'hidden';
      details.dataset.accordionState = expanded ? 'open' : 'closed';
      summary.setAttribute('aria-expanded', String(expanded));

      animation = details.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], {
        duration: Math.min(420, Math.max(280, Math.abs(endHeight - startHeight) * 1.2)),
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both',
      });
      animation.onfinish = finish;
    });

    // Release measured heights if the viewport or motion preference changes.
    window.addEventListener('resize', () => {
      if (animation) finish();
    });
    reduced.addEventListener('change', () => {
      if (reduced.matches && animation) finish();
    });
  });
  document.querySelectorAll('[data-explorer]').forEach((root) => {
    const buttons = [...root.querySelectorAll('[data-zone]')],
      panels = [...root.querySelectorAll('[data-zone-panel]')];
    const select = (key) => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zone === key)));
      panels.forEach((p) => {
        p.hidden = p.dataset.zonePanel !== key;
        if (!p.hidden) play(p, [{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
      });
      const input = document.querySelector('[name="locationDetail"]');
      if (input) input.value = key;
    };
    buttons.forEach((b) => {
      b.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse' && matchMedia('(hover: hover) and (pointer: fine)').matches)
          b.dataset.preview = 'true';
      });
      b.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse') b.dataset.preview = 'false';
      });
      b.addEventListener('click', (e) => {
        select(b.dataset.zone);
        if (
          !matchMedia('(hover: hover) and (pointer: fine)').matches ||
          e.pointerType === 'touch'
        ) {
          const open = b.dataset.preview !== 'true';
          buttons.forEach((other) => {
            other.dataset.preview = String(other === b && open);
          });
        }
      });
    }); // Hover previews do not change the form selection.
  });
  const signs = [...document.querySelectorAll('[data-sign-flip]')];
  signs.forEach((card) =>
    card.addEventListener('click', (e) => {
      if (e.pointerType === 'touch' || !matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const open = card.dataset.preview !== 'true';
        signs.forEach((other) => (other.dataset.preview = String(other === card && open)));
      }
    }),
  );
  if (document.documentElement.dataset.page === 'index') {
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    play(
      document.querySelector('.hero-copy h1'),
      [
        { opacity: 0, transform: 'translateY(34px)', clipPath: 'inset(0 0 12% 0)' },
        { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' },
      ],
      { duration: 850 },
    );
    play(
      document.querySelector('.hero-copy .lead'),
      [
        { opacity: 0, transform: 'translateY(20px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 700, delay: 100 },
    );
    const tiltItems = [...document.querySelectorAll('.service-card')].map((root) => ({
      root,
      target: root.querySelector('picture'),
      x: 0,
      y: 0,
      rx: 0,
      ry: 0,
    }));
    const about = document.querySelector('.about-photo');
    let frame = 0;
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      tiltItems.forEach((item) => {
        item.x = item.y = item.rx = item.ry = 0;
        item.target.style.transform = '';
        item.root.style.removeProperty('--light-x');
        item.root.style.removeProperty('--light-y');
      });
      if (about) about.querySelector('img').style.transform = '';
    };
    const tick = () => {
      frame = 0;
      if (reduced.matches || !fine.matches || document.hidden) return;
      let moving = false;
      tiltItems.forEach((item) => {
        const rect = item.root.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > innerHeight) return;
        item.rx += (item.x - item.rx) * 0.12;
        item.ry += (item.y - item.ry) * 0.12;
        moving ||= Math.abs(item.x - item.rx) + Math.abs(item.y - item.ry) > 0.005;
        const desktop = innerWidth >= 768;
        const shift = desktop
          ? clamp((innerHeight / 2 - (rect.top + rect.height / 2)) * 0.018, -12, 12)
          : 0;
        const amount = 2.2;
        item.target.style.transform = `perspective(1400px) translate3d(0,${shift.toFixed(2)}px,0) rotateX(${(-item.ry * amount).toFixed(3)}deg) rotateY(${(item.rx * amount).toFixed(3)}deg)`;
      });
      if (about) {
        const rect = about.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < innerHeight) {
          const shift =
            innerWidth >= 768
              ? clamp((innerHeight / 2 - (rect.top + rect.height / 2)) * 0.055, -30, 30)
              : 0;
          about.querySelector('img').style.transform =
            innerWidth >= 768 ? `translate3d(0,${shift.toFixed(2)}px,0) scale(1.12)` : '';
        }
      }
      if (moving) frame = requestAnimationFrame(tick);
    };
    const request = () => {
      if (!frame && !reduced.matches && fine.matches && !document.hidden)
        frame = requestAnimationFrame(tick);
    };
    tiltItems.forEach((item) => {
      item.root.addEventListener(
        'pointermove',
        (e) => {
          if (!fine.matches || reduced.matches) return;
          const rect = item.root.getBoundingClientRect();
          item.x = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
          item.y = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
          item.root.style.setProperty('--light-x', ((item.x + 1) * 50).toFixed(1) + '%');
          item.root.style.setProperty('--light-y', ((item.y + 1) * 50).toFixed(1) + '%');
          request();
        },
        { passive: true },
      );
      item.root.addEventListener(
        'pointerleave',
        () => {
          item.x = item.y = 0;
          request();
        },
        { passive: true },
      );
    });
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener(
      'resize',
      () => {
        reset();
        request();
      },
      { passive: true },
    );
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else request();
    });
    reduced.addEventListener('change', () => {
      reset();
      request();
    });
    fine.addEventListener('change', () => {
      reset();
      request();
    });
    request();
  }
  window.BelowlineMotion = {
    play,
    menu: (root) => {
      play(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
      root.querySelectorAll('[data-menu-item]').forEach((el, i) =>
        play(
          el,
          [
            { opacity: 0, transform: 'translateY(12px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 380, delay: i * 45 },
        ),
      );
    },
  };
})();
