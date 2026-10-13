// Wayfarer private research workspace — returns grounded SerpApi search labels only.
// No provider secrets, confirmed inventory or booking controls appear in the browser.
(() => {
  'use strict';
  const root = document.getElementById('world-explorer');
  if (!root || document.getElementById('wayfarer-travel-research')) return;
  const html = `
    <section class="travel-research" id="wayfarer-travel-research" aria-labelledby="travel-research-title">
      <div class="travel-research-head">
        <div><span class="eyebrow">RESEARCH / PRIVATE PREVIEW</span>
          <h3 id="travel-research-title">The journey, grounded in <em>real searches.</em></h3>
          <p>Choose airports and your own spending limits. Wayfarer checks Google Travel search results through a protected server. Prices can change and do not confirm bookable seats or rooms.</p>
        </div><span class="travel-research-label">SEARCH DATA ≠ BOOKING</span>
      </div>
      <form id="travel-research-form" class="travel-research-form" autocomplete="off">
        <label><span>Departing airport · IATA</span><input class="field" id="travel-origin" name="from" maxlength="3" minlength="3" pattern="[A-Za-z]{3}" placeholder="CMB" list="travel-airport-options" required aria-describedby="travel-search-help"></label>
        <label><span>Arrival airport · IATA</span><input class="field" id="travel-arrival" name="to" maxlength="3" minlength="3" pattern="[A-Za-z]{3}" placeholder="HND" list="travel-airport-options" required></label>
        <label><span>Optional group flight budget · USD</span><input class="field" id="travel-airfare" name="flightBudget" type="number" min="0" max="1000000" step="1" placeholder="Excludes ground costs"></label>
        <label><span>Private beta access code</span><input class="field" id="travel-beta-code" type="password" required minlength="24" autocomplete="off" placeholder="Not your SerpApi key"></label>
        <datalist id="travel-airport-options"><option value="CMB" label="Colombo, Sri Lanka"></option><option value="HND" label="Tokyo Haneda"></option><option value="NRT" label="Tokyo Narita"></option><option value="LHR" label="London Heathrow"></option><option value="DXB" label="Dubai"></option><option value="SIN" label="Singapore Changi"></option><option value="BKK" label="Bangkok"></option><option value="CDG" label="Paris CDG"></option><option value="JFK" label="New York JFK"></option><option value="LAX" label="Los Angeles"></option><option value="SYD" label="Sydney"></option><option value="KUL" label="Kuala Lumpur"></option><option value="DPS" label="Bali"></option><option value="KIX" label="Osaka Kansai"></option></datalist>
        <div class="travel-research-action"><button type="submit" class="light" id="travel-search-button">Compare travel searches ↗</button>
          <small id="travel-search-help">Uses the destination and dates above. Up to two search credits per check. Never paste provider API keys here.</small></div>
      </form>
      <p class="travel-search-status" id="travel-search-status" role="status" aria-live="polite">Choose a destination from the World Index, then enter your airports and private beta code.</p>
      <div id="travel-search-output" class="travel-search-output" aria-live="polite"></div>
      <p class="travel-search-disclaimer">Search-based research only. Real-time seat inventory, airline booking, hotel reservations, restaurant menu prices and local transit fares are not connected. All final details must be confirmed with the provider.</p>
    </section>`;
  root.insertAdjacentHTML('beforeend', html);
  const $ = id => document.getElementById(id);
  const form = $('travel-research-form'), status = $('travel-search-status'), output = $('travel-search-output');
  const get = id => $(id)?.value ?? '';
  const word = (tag, value, className) => {
    const el=document.createElement(tag);el.textContent=String(value??'');if(className)el.className=className;return el;
  };
  const localeTime = x => x ? new Date(x).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : 'unavailable';
  const money = (a,b='USD') => /^[A-Z]{3}$/.test(b)&&/^\d+\.\d{2}$/.test(String(a)) ? b+' '+a : 'Not verified';
  const budget = state => state==='within_budget'?'Within chosen allowance':state==='over_budget'?'Above chosen allowance':'No comparable allowance';
  const statusLabel = s => ({search_results:'Provider search results',needs_details:'More details needed',quota_exceeded:'Search quota reached',unavailable:'Provider unavailable',no_results:'No usable prices returned',not_connected:'Not connected'})[s]||'Not verified';
  function itemCard(head,detail,foot) {
    const card=word('article','', 'travel-search-item');
    card.append(word('strong',head),word('p',detail),word('small',foot));return card;
  }
  function panel(title,obj,render){
    const article=word('article','','travel-search-card');
    article.append(word('h4',title),word('span',statusLabel(obj.status),'travel-search-state'),word('p',obj.message));
    for(const offer of (obj.offers||[])) article.append(render(offer));
    return article;
  }
  function show(res){
    output.replaceChildren();
    output.append(
      panel('Flights · search fares',res.flights,offer=>itemCard(
        money(offer.perAdult,offer.currency)+' per adult',
        'Indicative group estimate '+money(offer.estimatedGroup,offer.currency)+' · '+budget(offer.budgetFit),
        offer.segments?.map(s=>[s.from,'→',s.to,'·',s.airline,s.number,s.departureAt].filter(Boolean).join(' ')).join(' / ')+' · return flight and seat availability unverified'
      )),
      panel('Accommodation · hotel search',res.hotels,offer=>itemCard(
        offer.name+' · '+money(offer.displayedTotal,offer.currency),
        (offer.checkIn||'')+' → '+(offer.checkOut||'')+' · '+budget(offer.budgetFit),
        'Lowest displayed total search rate; final occupancy, taxes, fees and availability unverified'
      )),
      panel('Restaurants & meals',res.food,()=>itemCard('No price feed','Consult restaurant menus directly','No AI-generated menu prices')),
      panel('Local transport',res.transport,()=>itemCard('No fare feed','Check the local operator','No invented transit fares'))
    );
    const foot=word('p','Search timestamp: '+localeTime(res.checkedAt)+' · '+res.note,'travel-search-foot');
    output.append(foot);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const button=$('travel-search-button');button.disabled=true;button.setAttribute('aria-busy','true');
    status.textContent='Searching connected travel providers…';output.replaceChildren();
    const days=Number(get('days'))||3,daily=Number(get('budget'))||0;
    const trip={
      from:get('travel-origin').toUpperCase().trim(),to:get('travel-arrival').toUpperCase().trim(),
      destination:get('destination').trim()||get('world-query').trim(),
      checkIn:get('check-in'),checkOut:get('check-out'),
      adults:Number(get('stay-adults')),
      groundBudget:Math.round(days*daily*100)/100,
      flightBudget:get('travel-airfare')===''?0:Number(get('travel-airfare'))
    };
    try{
      const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),25000);
      let response;
      try{response=await fetch('/api/travel-search',{method:'POST',headers:{'Content-Type':'application/json','X-Wayfarer-Beta-Token':get('travel-beta-code')},body:JSON.stringify({trip}),signal:ctrl.signal});}
      finally{clearTimeout(timer)}
      const payload=await response.json();
      if(!response.ok||!payload.ok)throw Error(payload.error||'Provider search unavailable');
      status.textContent=payload.mode==='search_only'?'Google Travel search results · not confirmed inventory':'Search currently disabled · no real prices connected';
      show(payload);
    }catch(err){status.textContent=err.name==='AbortError'?'Search timed out. No availability conclusion is possible.':err.message||'Search unavailable.';}
    finally{button.disabled=false;button.removeAttribute('aria-busy');}
  });
  // Nearby airport *references* appear as suggestions; they are not airline routes.
  const nearby=$('airport-list');
  if(nearby){const refresh=()=>{
    const list=$('travel-airport-options');
    const known=new Set([...list.children].map(o=>o.value));
    for(const el of nearby.querySelectorAll('.place-card')){
      const match=el.textContent.match(/\b([A-Z]{3})\b/);if(!match||known.has(match[1]))continue;
      const opt=document.createElement('option');opt.value=match[1];opt.label=el.querySelector('b')?.textContent||'Nearby airport reference';list.append(opt);known.add(match[1]);
    }
  };new MutationObserver(refresh).observe(nearby,{childList:true,subtree:true});refresh();}
})();
