/* Wayfarer motion: one small controller, no tracking, no graphics dependencies. */
(() => {
  'use strict';
  const root = document.documentElement;
  const toggles = [...document.querySelectorAll('[data-motion-toggle]')];
  const progress = document.getElementById('reading-progress-fill');
  const nav = document.querySelector('.nav');
  const hero = document.querySelector('.hero');
  const heroImage = hero?.querySelector('.hero-media');
  const osReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const STORAGE_KEY = 'wf-visual-motion-v1';
  let stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch {}
  let enabled = stored === null ? !osReduce.matches : stored === 'on';
  let requested = false;
  let lastScroll = 0;

  function applyPreference() {
    root.classList.toggle('motion-off', !enabled);
    for (const toggle of toggles) {
      toggle.setAttribute('aria-pressed', String(enabled));
      toggle.setAttribute('aria-label', enabled ? 'Turn off decorative motion' : 'Turn on decorative motion');
      toggle.querySelector('.motion-toggle-text').textContent = enabled ? 'Motion on' : 'Motion off';
    }
    if (heroImage && !enabled) heroImage.style.setProperty('--hero-offset', '0px');
  }
  applyPreference();
  for (const toggle of toggles) toggle.addEventListener('click', () => {
    enabled = !enabled;
    stored = enabled ? 'on' : 'off';
    try { localStorage.setItem(STORAGE_KEY, stored); } catch {}
    applyPreference();
  });
  osReduce.addEventListener?.('change', event => {
    if (stored !== null) return; // User choice overrides OS only when saved explicitly.
    enabled = !event.matches;
    applyPreference();
  });
  function drawScroll() {
    requested = false;
    const y = Math.max(0,window.scrollY || 0);
    nav?.classList.toggle('is-scrolled',y > 45);
    const page = document.querySelector('.view.active');
    const scrollHeight = Math.max(1, (page?.scrollHeight || document.body.scrollHeight) - window.innerHeight);
    if (progress) progress.style.transform = 'scaleX(' + Math.min(1, y / scrollHeight).toFixed(4) + ')';
    if (heroImage && enabled && page?.id === 'discover' && y <= window.innerHeight * 1.2) {
      const target = Math.min(55, Math.round(y * .07));
      if (Math.abs(target - lastScroll) > 1) {
        heroImage.style.setProperty('--hero-offset',target + 'px');
        lastScroll = target;
      }
    }
  }
  function tick() {
    if (requested) return;
    requested = true;
    requestAnimationFrame(drawScroll);
  }
  addEventListener('scroll', tick,{passive:true});
  addEventListener('resize',tick,{passive:true});
  tick();

  // Observe the original router's existing class state rather than replacing its handlers.
  function syncRouteAccessibility() {
    const active = document.querySelector('.view.active');
    if (!active) return;
    document.querySelectorAll('.nav-links button[data-view]').forEach(item => {
      if (item.dataset.view === active.id) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    const title = active.querySelector('h1');
    if (title) {
      title.setAttribute('tabindex', '-1');
      title.focus({preventScroll:true});
    }
    tick();
  }
  let pendingRouteSync = false;
  const routerObserver = new MutationObserver(() => {
    if (pendingRouteSync) return;
    pendingRouteSync = true;
    queueMicrotask(() => {
      pendingRouteSync = false;
      syncRouteAccessibility();
    });
  });
  document.querySelectorAll('.view').forEach(view => {
    routerObserver.observe(view, {attributes:true,attributeFilter:['class']});
  });
  const initial = document.querySelector('.view.active');
  if (initial) document.querySelector('.nav-links button[data-view="' + initial.id + '"]')?.setAttribute('aria-current','page');
  // Original preference chips already handle state; expose that state to assistive tech.
  document.querySelectorAll('.prefs .pref').forEach(chip => {
    const sync = () => chip.setAttribute('aria-pressed',String(chip.classList.contains('on')));
    sync();
    chip.addEventListener('click', () => queueMicrotask(sync));
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) tick()});
})();
