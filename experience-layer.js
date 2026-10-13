/* Wayfarer Experience Layer — editorial navigation, live planning ledger and stateful research. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const studio = $('studio');
  if (!studio || $('wayfarer-ledger')) return;
  const appHead = studio.querySelector('.app-head');
  if (!appHead) return;

  const ledger = document.createElement('aside');
  ledger.className = 'wayfarer-ledger';
  ledger.id = 'wayfarer-ledger';
  ledger.setAttribute('aria-label', 'Current journey planning summary');
  ledger.innerHTML = `
    <div class="ledger-leading"><span class="ledger-topline">YOUR JOURNEY, AT A GLANCE</span><strong>Make every detail count.</strong><span class="ledger-subline">Your choices stay yours. Provider prices need verification.</span></div>
    <dl class="ledger-facts">
      <div><dt>Destination</dt><dd id="ledger-destination">Not selected</dd></div>
      <div><dt>Stay</dt><dd id="ledger-duration">3 days</dd></div>
      <div><dt>Ground budget</dt><dd id="ledger-budget">USD 540</dd></div>
    </dl>
    <div class="ledger-actions"><button type="button" id="ledger-explore" class="ledger-action">Explore places <span aria-hidden="true">↗</span></button><button type="button" id="ledger-compose" class="ledger-action ledger-action-accent">Compose journey <span aria-hidden="true">↗</span></button></div>`;
  appHead.insertAdjacentElement('afterend', ledger);

  const safeMoney = number => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(number);
  const compute = () => {
    const dest = String($('destination')?.value || $('world-query')?.value || '').trim().slice(0,60);
    const duration = Math.max(1, Math.min(30, Number($('days')?.value)||3));
    const daily = Math.max(0, Math.min(100000, Number($('budget')?.value)||0));
    $('ledger-destination').textContent = dest || 'Choose a place';
    $('ledger-duration').textContent = duration + (duration === 1?' day':' days');
    $('ledger-budget').textContent = safeMoney(daily*duration);
    ledger.dataset.hasDestination = String(Boolean(dest));
    ledger.dataset.hasBudget = String(Boolean(daily));
  };
  compute();
  ['input','change','click'].forEach(type => document.addEventListener(type, event => {
    if (event.target.closest('#world-explorer, .brief, .workspace, #studio')) {
      requestAnimationFrame(compute);
    }
  }, {passive:true}));
  $('ledger-explore')?.addEventListener('click',()=> {
    $('world-explorer')?.scrollIntoView({behavior:document.documentElement.classList.contains('motion-off')?'instant':'smooth',block:'start'});
    $('world-query')?.focus({preventScroll:true});
  });
  $('ledger-compose')?.addEventListener('click',()=> {
    const compose = studio.querySelector('.workspace');
    compose?.scrollIntoView({behavior:document.documentElement.classList.contains('motion-off')?'instant':'smooth',block:'start'});
    $('destination')?.focus({preventScroll:true});
  });

  // Icons are decorative. Keep native buttons for robust focus, pointer and keyboard behavior.
  const icons = {
    discover:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',
    studio:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/>',
    arrival:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
    trips:'<path d="M6 4.5h12v16l-6-4-6 4z"/>'
  };
  document.querySelectorAll('.nav-links button[data-view]').forEach(button => {
    const type=button.dataset.view;
    if(!icons[type]||button.querySelector('svg')) return;
    button.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[type]+'</svg>');
  });

  // Align research panel with the rest of the journey workspace rather than nesting a second dark console.
  const research = $('wayfarer-travel-research');
  const world = $('world-explorer');
  if (world && research && research.parentElement === world) world.insertAdjacentElement('afterend', research);

  const search = $('travel-research-form');
  if (search) {
    const status = $('travel-search-status');
    const submit = $('travel-search-button');
    search.addEventListener('submit', event => {
      const destination = String($('destination')?.value||$('world-query')?.value||'').trim();
      const arrival = $('travel-arrival')?.value?.trim().toUpperCase()||'';
      const departure = $('travel-origin')?.value?.trim().toUpperCase()||'';
      const inDate=$('check-in')?.value || '';
      const outDate=$('check-out')?.value || '';
      if(!destination || !inDate || !outDate || inDate >= outDate || !/^[A-Z]{3}$/.test(arrival) || !/^[A-Z]{3}$/.test(departure)) {
        event.preventDefault();event.stopImmediatePropagation();
        if(status)status.textContent = !destination ? 'Choose a destination in the World Index first.' :
          (!inDate || !outDate || inDate>=outDate) ? 'Choose valid check-in and check-out dates above.' : 'Enter valid three-letter IATA codes for both airports.';
        const target = !destination ? $('world-query') : (!inDate||!outDate||inDate>=outDate)?$('check-in'):$('travel-origin');
        target?.focus();
        return;
      }
    }, true);
    // Mutation observer reflects the actual button state rather than a simulated agent animation.
    if(submit){
      const sync=()=>{submit.dataset.searching=String(submit.disabled);submit.setAttribute('aria-label',submit.disabled?'Comparing travel searches, please wait':'Compare travel searches');};
      new MutationObserver(sync).observe(submit,{attributes:true,attributeFilter:['disabled']});sync();
    }
  }

  // Stop the decorative narrative strip from being duplicated for screen-reader users.
  const marquee = document.querySelector('.marquee');
  if(marquee) marquee.setAttribute('aria-hidden','true');
  window.addEventListener('pageshow',compute);
})();
