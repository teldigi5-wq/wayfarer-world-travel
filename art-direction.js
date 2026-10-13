/* Wayfarer cinematic product composition. Existing AI/API handlers remain authoritative. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const studio=$('studio'),workspace=studio?.querySelector('.workspace'),ledger=$('wayfarer-ledger');
 const world=$('world-explorer'),research=$('wayfarer-travel-research');
 const itinerary=$('itinerary'),stack=workspace?.querySelector(':scope > .stack'),consolePanel=stack?.querySelector('.console');
 if(!studio||!workspace||!ledger||!world||!research||!itinerary||!stack||!consolePanel)return;
 // The established controllers create these elements. Move nodes, never replace them or their listeners.
 world.parentElement.insertBefore(workspace,world);
 const side=document.createElement('aside');
 side.className='wf-studio-side';side.setAttribute('aria-label','AI research and ground-budget guidance');
 workspace.append(side);
 const aiIntro=document.createElement('section');aiIntro.className='panel wf-ai-intro';
 aiIntro.innerHTML='<div class="wf-side-kicker">✦ PERSONALIZED INTELLIGENCE</div>'+
 '<h2 class="wf-side-title">AI Travel Assistant</h2>'+
 '<p id="wf-ai-message" class="wf-ai-copy" role="status">Ready to research. Run the real agents for sourced suggestions and an AI itinerary.</p>'+
 '<button type="button" id="wf-ai-run" class="wf-ai-cta">Run live AI research ↗</button>';
 side.append(aiIntro);
 consolePanel.classList.add('wf-agents-panel');side.append(consolePanel);
 const budgetPanel=document.createElement('section');budgetPanel.className='panel wf-budget-panel';
 budgetPanel.setAttribute('aria-labelledby','wf-budget-heading');
 budgetPanel.innerHTML='<div class="wf-side-kicker">GROUND SPENDING PLAN</div>'+
 '<h2 class="wf-side-title" id="wf-budget-heading">Budget overview</h2>'+
 '<div class="wf-budget-value"><strong id="wf-total">—</strong><small id="wf-per-person">Group total · excluding flights</small></div>'+
 '<div class="wf-budget-bar" role="img" aria-label="Sample allocations: 40 percent stays, 25 percent meals, 15 percent local transport, 10 percent activities and 10 percent contingency"><span></span><span></span><span></span><span></span><span></span></div>'+
 '<div class="wf-budget-splits"><div><b id="wf-stays">—</b><span>Accommodation · 40%</span></div>'+
 '<div><b id="wf-meals">—</b><span>Meals · 25%</span></div>'+
 '<div><b id="wf-transit">—</b><span>Local transport · 15%</span></div>'+
 '<div><b id="wf-activities">—</b><span>Activities · 10%</span></div></div>'+
 '<p class="wf-budget-disclaimer">Illustrative allocation, not verified local prices. The remaining 10% is contingency; flights, visas and insurance are excluded.</p>';
 side.append(budgetPanel);
 const navigation=document.createElement('div');navigation.className='wf-studio-tabs';
 navigation.innerHTML='<div class="wf-tab-list" role="tablist" aria-label="Journey Studio sections">'+
 '<button type="button" class="wf-tab" role="tab" id="wf-tab-overview" aria-selected="true" tabindex="0" data-tab="overview">Overview</button>'+
 '<button type="button" class="wf-tab" role="tab" id="wf-tab-explore" aria-selected="false" tabindex="-1" data-tab="explore">Destinations</button>'+
 '<button type="button" class="wf-tab" role="tab" id="wf-tab-prices" aria-selected="false" tabindex="-1" data-tab="prices">Flights & stays</button></div>'+
 '<p class="wf-studio-caption">Discover → Plan → Arrive. Research is source-labeled and never guarantees booking availability.</p>';
 ledger.insertAdjacentElement('afterend',navigation);
 const featureCards=document.createElement('section');featureCards.className='wf-provider-cards';
 featureCards.setAttribute('aria-label','Additional journey research');
 featureCards.innerHTML='<article class="wf-provider-card"><span class="wf-side-kicker">✈ AIR TRAVEL</span><strong>Flight search</strong>'+
 '<p>Compare route search fares using chosen airport codes and dates. No seat guarantee until checkout.</p>'+
 '<button type="button" data-wf-open="prices">Compare flight searches ↗</button></article>'+
 '<article class="wf-provider-card"><span class="wf-side-kicker">⌂ ACCOMMODATION</span><strong>Stay research</strong>'+
 '<p>Review nearby hotels and indicative search totals. Room availability requires provider verification.</p>'+
 '<button type="button" data-wf-open="prices">Explore stay searches ↗</button></article>'+
 '<article class="wf-provider-card"><span class="wf-side-kicker">⌖ PLACES & CULTURE</span><strong>Explore with intent</strong>'+
 '<p>Discover destinations worldwide, browse airport references and build a journey from places you choose.</p>'+
 '<button type="button" data-wf-open="explore">Explore destinations ↗</button></article>';
 workspace.insertAdjacentElement('afterend',featureCards);
 const tabs=[...navigation.querySelectorAll('[role="tab"]')];
 const openTab=(name,options={})=>{
  if(!['overview','explore','prices'].includes(name))return;
  workspace.hidden=name!=='overview';featureCards.hidden=name!=='overview';
  world.hidden=name!=='explore';research.hidden=name!=='prices';
  tabs.forEach(tab=>{const selected=tab.dataset.tab===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  if(options.focusTab)$('wf-tab-'+name)?.focus({preventScroll:true});
  if(options.scroll)navigation.scrollIntoView({behavior:document.documentElement.classList.contains('motion-off')?'instant':'smooth',block:'start'});
 };
 tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>openTab(tab.dataset.tab));
  tab.addEventListener('keydown',event=>{
   if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
   event.preventDefault();
   const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   openTab(tabs[next].dataset.tab,{focusTab:true});
  });
 });
 featureCards.addEventListener('click',event=>{
  const button=event.target.closest('[data-wf-open]');
  if(button)openTab(button.dataset.wfOpen,{scroll:true});
 });
 $('ledger-explore')?.addEventListener('click',()=>openTab('explore'),true);
 $('search-stays')?.addEventListener('click',()=>openTab('prices'),true);
 $('wf-ai-run')?.addEventListener('click',()=>{openTab('overview');$('run-agents')?.click();});
 openTab('overview');
 // Currency and splits are computed from inputs: allocation guidance, never invented supplier offers.
 const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
 const sync=()=>{
  const destination=String($('destination')?.value||'your destination').slice(0,65);
  if($('studio-target'))$('studio-target').textContent=destination;
  const days=Math.max(1,Math.min(30,Number($('days')?.value)||3));
  const perDay=Math.max(0,Math.min(2500,Number($('budget')?.value)||0));
  const total=Math.round(days*perDay*100)/100;
  $('wf-total').textContent=usd.format(total);
  $('wf-per-person').textContent=days+' days · group ground budget';
  $('wf-stays').textContent=usd.format(total*.4);
  $('wf-meals').textContent=usd.format(total*.25);
  $('wf-transit').textContent=usd.format(total*.15);
  $('wf-activities').textContent=usd.format(total*.10);
  const state=String($('plan-status')?.textContent||'Sample itinerary');
  $('wf-ai-message').textContent=state.includes('Groq')?
   'Groq has generated an AI draft using live public-source context. Verify venues, availability, schedules and prices before travelling.':
   'Ready to research. Run the real agents for sourced suggestions and an AI itinerary.';
 };
 for(const type of ['input','change','click'])studio.addEventListener(type,()=>requestAnimationFrame(sync),{passive:true});
 new MutationObserver(sync).observe($('plan-status'),{childList:true,characterData:true,subtree:true});
 // Illustration thumbnails enrich each REAL draft/sample day; no mock flight price or hotel inventory injected.
 const imagery=[
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=400&q=75',
  'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=400&q=75',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=75'
 ];
 const enhanceDays=()=>{
  for(const [index,day] of [...itinerary.querySelectorAll(':scope > article.day')].entries()){
   if(day.dataset.enhanced)continue;
   day.dataset.enhanced='true';
   const marker=document.createElement('i');marker.className='wf-day-point';marker.setAttribute('aria-hidden','true');
   const img=document.createElement('img');img.className='wf-day-photo';img.src=imagery[index%imagery.length];img.alt='';img.loading='lazy';
   const details=document.createElement('div');details.className='wf-day-info';
   while(day.firstChild)details.append(day.firstChild);
   day.append(marker,img,details);
  }
 };
 new MutationObserver(enhanceDays).observe(itinerary,{childList:true});
 enhanceDays();
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-place],#world-results,.nav-links'))requestAnimationFrame(sync);
 },{passive:true});
 sync();
})();
