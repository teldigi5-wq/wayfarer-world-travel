/* Wayfarer motion: one small controller, no tracking, no graphics dependencies. */
(() => {
  'use strict';
  const root = document.documentElement;
  const progress = document.getElementById('reading-progress-fill');
  const nav = document.querySelector('.nav');
  const hero = document.querySelector('.hero');
  const heroImage = hero?.querySelector('.hero-media');
  const osReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let requested = false;
  let lastScroll = 0;

  // Deliberately no manual Motion On/Off UI or persisted override.
  // Follow accessibility settings from the user's operating system.
  function synchronizeReducedMotion() {
    root.classList.toggle('motion-off',osReduce.matches);
    if (osReduce.matches && heroImage) {
      heroImage.style.setProperty('--hero-offset','0px');
      lastScroll = 0;
    }
    tick();
  }
  osReduce.addEventListener?.('change',synchronizeReducedMotion);
  synchronizeReducedMotion();
  function drawScroll() {
    requested = false;
    const y = Math.max(0,window.scrollY || 0);
    nav?.classList.toggle('is-scrolled',y > 45);
    const page = document.querySelector('.view.active');
    const scrollHeight = Math.max(1, (page?.scrollHeight || document.body.scrollHeight) - window.innerHeight);
    if (progress) progress.style.transform = 'scaleX(' + Math.min(1, y / scrollHeight).toFixed(4) + ')';
    if (heroImage && !osReduce.matches && page?.id === 'discover' && y <= window.innerHeight * 1.2) {
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

  // Reconcile BOTH visual and semantic navigation state from the real active view.
  // Old view switches and browser restoration must not leave multiple highlighted tabs.
  function syncNavSelection(activeId) {
    let selected = false;
    document.querySelectorAll('.nav-links button[data-view]').forEach(item => {
      const current = !selected && item.dataset.view === activeId;
      if (current) selected = true;
      item.classList.toggle('active', current);
      if (current) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }
  // Observe the established router's view classes, not an unrelated hover state.
  function syncRouteAccessibility() {
    const active = document.querySelector('.view.active');
    if (!active) return;
    syncNavSelection(active.id);
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
  if (initial) syncNavSelection(initial.id);
  // Original preference chips already handle state; expose that state to assistive tech.
  document.querySelectorAll('.prefs .pref').forEach(chip => {
    const sync = () => chip.setAttribute('aria-pressed',String(chip.classList.contains('on')));
    sync();
    chip.addEventListener('click', () => queueMicrotask(sync));
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) tick()});
})();
