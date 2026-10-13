/* Premium country discovery + transparent roadmap pricing. No checkout or paid API use. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const gallery=$('destinations'), method=$('method'), select=$('country-filter');
  if(!gallery || $('wf-world-atlas'))return;
  const atlas=document.createElement('section');
  atlas.id='wf-world-atlas';atlas.className='wf-world-atlas';
  atlas.setAttribute('aria-labelledby','wf-world-heading');
  atlas.innerHTML='<div class="wf-atlas-intro"><span class="wf-kicker">WORLDWIDE DISCOVERY</span><h2 id="wf-world-heading">A world of places. <em>Your journey.</em></h2><p>Explore the country directory, choose a destination city, and compare available airport references. Live fares, entry rules, and regional coverage depend on verified suppliers.</p><p class="wf-coverage" id="wf-coverage">Loading worldwide directory…</p></div>'+
    '<div class="wf-atlas-browse"><label for="wf-country-search">SEARCH COUNTRIES & TERRITORIES</label><input id="wf-country-search" type="search" placeholder="Search Japan, Sri Lanka, Norway…" autocomplete="off"><div id="wf-country-list" class="wf-country-list" aria-live="polite"></div><button type="button" id="wf-show-countries" class="wf-more-countries">Show more countries ↓</button><p>Choosing a country opens Journey Studio. Select a city before researching flights or hotels.</p></div>';
  gallery.insertAdjacentElement('afterend',atlas);
  const plans=document.createElement('section');plans.id='wf-service-plans';
  plans.className='wf-service-plans';plans.setAttribute('aria-labelledby','wf-plans-heading');
  plans.innerHTML='<div class="wf-plans-intro"><span class="wf-kicker">SERVICE PLANS / TRANSPARENT PRICING</span><h2 id="wf-plans-heading">The freedom to explore.<br><em>A plan for what comes next.</em></h2><p>Explorer is available now. Paid plans are proposed future offerings, not purchasable subscriptions. No payments are taken on this website.</p></div>'+
    '<div class="wf-plan-grid">'+
    '<article class="wf-price-plan"><span class="wf-plan-status">AVAILABLE NOW</span><h3>Explorer</h3><p>Discover places and shape a thoughtful itinerary.</p><div class="wf-plan-price"><strong>$0</strong><span>/ month</span></div><ul><li>Worldwide country and city discovery</li><li>Travel-planning drafts and destination research</li><li>Saved journeys on this device</li><li>Arrival preparation checklist</li></ul><button type="button" data-wf-plan="start">Start exploring ↗</button><small>Some AI and provider searches require private beta access.</small></article>'+
    '<article class="wf-price-plan wf-plan-emphasis"><span class="wf-plan-status">PROPOSED · NOT ON SALE</span><h3>Journey Plus</h3><p>A future membership for deeper research workflows.</p><div class="wf-plan-price"><strong>$9</strong><span>/ month · proposed</span></div><ul><li>Planned AI itinerary comparisons</li><li>Planned advanced budgets and revisions</li><li>Planned cross-device journey syncing</li><li>Provider integrations subject to available quotas</li></ul><button type="button" data-wf-plan="learn">View roadmap ↗</button><small>Concept pricing only. Checkout and subscriptions are disabled.</small></article>'+
    '<article class="wf-price-plan"><span class="wf-plan-status">FUTURE SERVICE</span><h3>Wayfarer Partners</h3><p>A possible travel creator and agency workspace.</p><div class="wf-plan-price"><strong>Custom</strong><span>/ future quote</span></div><ul><li>Planned collaborative itineraries</li><li>Planned team approval workflows</li><li>Planned travel service integrations</li><li>Planned business reporting</li></ul><button type="button" data-wf-plan="learn">View roadmap ↗</button><small>Not currently offered or available for purchase.</small></article>'+
    '</div><p class="wf-plan-legal">Wayfarer does not book tickets, reserve rooms, or charge subscription fees. Provider search results are indicative and must be verified before purchasing.</p>';
  (method||atlas).insertAdjacentElement('afterend',plans);
  const input=$('wf-country-search'),results=$('wf-country-list'),more=$('wf-show-countries');
  let countries=[], expanded=false;
  function update(){
    const q=input.value.normalize('NFKD').toLowerCase().trim();
    const filtered=countries.filter(c=>c.name.normalize('NFKD').toLowerCase().includes(q)||c.code.toLowerCase()===q);
    results.replaceChildren();
    for(const c of (expanded?filtered:filtered.slice(0,12))){
      const b=document.createElement('button');b.type='button';b.className='wf-country';
      const label=document.createElement('span');label.textContent=c.name;
      const code=document.createElement('small');code.textContent=c.code;
      b.append(label,code);
      b.addEventListener('click',()=>{
        select.value=c.code;select.dispatchEvent(new Event('change',{bubbles:true}));
        document.querySelector('.nav-links [data-view="studio"]')?.click();
        requestAnimationFrame(()=>{
          $('world-explorer')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
          $('world-query')?.focus({preventScroll:true});
        });
      });
      results.append(b);
    }
    if(!filtered.length){const p=document.createElement('p');p.textContent='No matching country in this directory.';results.append(p);}
    more.hidden=filtered.length<=12;
    more.textContent=expanded?'Show fewer countries ↑':'Browse '+(filtered.length-12)+' more countries ↓';
  }
  function init(){
    const seen=new Set();
    countries=[...select.options].filter(o=>/^[A-Z]{2}$/.test(o.value) && !seen.has(o.value) && seen.add(o.value))
      .map(o=>({code:o.value,name:o.textContent.trim()})).sort((a,b)=>a.name.localeCompare(b.name));
    $('wf-coverage').textContent=countries.length+' countries & territories in the reference directory · not a guarantee of flights or visa access';
    update();
  }
  if(select?.options.length>12)init();
  else if(select){const watcher=new MutationObserver(()=>{
    if(select.options.length>12){watcher.disconnect();init();}
  });watcher.observe(select,{childList:true});}
  else $('wf-coverage').textContent='Country directory is temporarily unavailable.';
  input.addEventListener('input',()=>{expanded=false;update();});
  more.addEventListener('click',()=>{expanded=!expanded;update();});
  atlas.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';expanded=false;update();input.focus();}});
  plans.querySelectorAll('[data-wf-plan]').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.wfPlan==='start'){
      document.querySelector('.nav-links [data-view="studio"]')?.click();
      requestAnimationFrame(()=>$('world-query')?.focus());return;
    }
    let detail=plans.querySelector('.wf-roadmap-note');
    if(detail){detail.remove();return;}
    detail=document.createElement('p');detail.className='wf-roadmap-note';detail.tabIndex=-1;
    detail.textContent='Future-service concepts only. Current access includes worldwide discovery, local journey drafts, and arrival preparation. Shared accounts, payments, provider booking inventory, and expanded AI usage are not currently on sale.';
    plans.append(detail);detail.focus();
  }));
  document.documentElement.classList.add('wf-premium-animated');
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      for(const e of entries)if(e.isIntersecting){e.target.classList.add('wf-visible');observer.unobserve(e.target);}
    },{threshold:.1});
    [atlas,plans,...plans.querySelectorAll('.wf-price-plan')].forEach(el=>observer.observe(el));
  }else [atlas,plans].forEach(el=>el.classList.add('wf-visible'));
})();
