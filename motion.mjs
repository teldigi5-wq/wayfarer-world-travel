// Motion layer. No inline styles/scripts, so it works under the site's strict CSP.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

// Scroll reveal: sections only, once.
const items = document.querySelectorAll('[data-reveal]');
if (reduce || !('IntersectionObserver' in window)) items.forEach(n => n.classList.add('in'));
else {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  items.forEach(n => io.observe(n));
}

// Hero stats count up once.
if (!reduce) document.querySelectorAll('[data-count]').forEach(n => {
  const end = Number(n.dataset.count), t0 = performance.now(), dur = 1400;
  const fmt = new Intl.NumberFormat('en-US');
  const tick = t => {
    const p = Math.min((t - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 4);
    n.textContent = fmt.format(Math.round(end * eased));
    if (p < 1) requestAnimationFrame(tick);
  };
  n.textContent = '0'; requestAnimationFrame(tick);
});

// Pointer spotlight on destination cards (CSSOM custom properties are CSP-safe).
if (!reduce) document.querySelectorAll('.destination').forEach(c =>
  c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));


