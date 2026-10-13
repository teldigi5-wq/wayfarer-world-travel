// Wayfarer private research workspace — returns grounded SerpApi search labels only.
// No provider secrets, confirmed inventory or booking controls appear in the browser.
(() => {
  'use strict';
  const root = document.getElementById('world-explorer');
  if (!root || document.getElementById('wayfarer-travel-research')) return;
  const html = `
    <section class="travel-research" id="wayfarer-travel-research" aria-labelledby="travel-research-title">
      <div class="travel-research-head">
        <div><span class="eyebrow">FLIGHTS / HOTELS · SOURCE-LED</span>
          <h3 id="travel-research-title">See the routes. <em>Know what is verified.</em></h3>
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
      <p class="travel-search-status" id="travel-search-status" role="status" aria-live="polite">Select your destination, departure and arrival airports, and private beta code. Flight times appear only when the connected provider returns them.</p>
      <div id="travel-search-output" class="travel-search-output" aria-live="polite"></div>
      <p class="travel-search-disclaimer">Flight departure and arrival times are provider-reported search schedules, not live flight status. Ticket inventory and final bookability are unknown. Hotel rooms, restaurant menu prices and transport fares require independent verification.</p>
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
  // Search handoff only: never suggest Google Flights will preselect this
  // exact itinerary, guarantee a price, or preserve a seller quote.
  function addExternalHandoff(card,details) {
    const panel=word('div','', 'wf-external-flight-handoff');
    const link=document.createElement('a');
    link.href='https://www.google.com/travel/flights';
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.className='wf-flight-compare-link';
    link.textContent='Compare tickets on Google Flights ↗';
    const info=word('p',
      'Opens a separate tab. Re-select the same dates and flights there; verify seats, baggage, and the final payable fare before purchasing.',
      'wf-flight-handoff-note');
    panel.append(link);
    if(details) {
      const copy=word('button','Copy flight details','wf-flight-copy');
      copy.type='button';
      copy.addEventListener('click',async()=>{
        try {
          if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
          await navigator.clipboard.writeText(details);
          copy.textContent='Flight details copied ✓';
        }catch{
          copy.textContent='Copy unavailable — refer to the details above';
        }
      });
      panel.append(copy);
    }
    panel.append(info);
    card.append(panel);
  }
  function addSelection(card,selection){
    if(!selection || !['return','booking'].includes(selection.stage)||!selection.token)return;
    const button=word('button',selection.stage==='return'?
      'Choose this departure · See return flights ↗':'Check available booking sellers ↗','wf-supplier-select');
    button.type='button';
    button.setAttribute('aria-label',selection.stage==='return'?
      'Request supplier return flight choices; uses a provider search credit':
      'Request seller booking options; uses a provider search credit');
    const area=word('div','','wf-supplier-options');
    card.append(button,area);
    let completed=false;
    button.addEventListener('click',async()=>{
      if(completed)return;
      button.disabled=true;button.setAttribute('aria-busy','true');
      area.replaceChildren(word('p','Checking the selected itinerary with the supplier…'));
      const aborter=new AbortController();
      const timeout=setTimeout(()=>aborter.abort(),22000);
      try{
        const resp=await fetch('/api/flight-selection',{
          method:'POST',headers:{'Content-Type':'application/json',
            'X-Wayfarer-Beta-Token':get('travel-beta-code')},
          body:JSON.stringify({selectionToken:selection.token}),
          signal:aborter.signal
        });
        const data=await resp.json();
        if(!resp.ok||!data.ok)throw Error(data.error||'Provider unavailable');
        area.replaceChildren(word('p',data.message,'wf-provider-message'));
        if(data.stage==='return_flights'){
          for(const choice of (data.options||[])){
            const segments=(choice.segments||[]).map(x=>
              [x.airline,x.flightNumber,x.from+' → '+x.to,
               'depart '+(x.departureAt||'time unknown'),
               'arrive '+(x.arrivalAt||'time unknown')].filter(Boolean).join(' · ')).join(' / ');
            const result=itemCard(
              'Return flight · '+money(choice.pricePerAdult,choice.currency)+' / adult',
              segments+' · estimated group '+money(choice.estimatedGroup,choice.currency),
              'Search itinerary only · Seats NOT VERIFIED');
            addSelection(result,choice.selection);
            addExternalHandoff(result,
              'Return option: '+segments+' | '+money(choice.pricePerAdult,choice.currency)+
              ' per adult | '+get('travel-origin')+' to '+get('travel-arrival')+
              ' | dates: '+get('check-in')+' to '+get('check-out')+
              ' | indicative only; verify directly with the seller');
            area.append(result);
          }
        }else if(data.stage==='booking_options'){
          for(const opt of (data.options||[])){
            const sellerCard=itemCard(
              opt.seller+' · '+money(opt.price,opt.currency),
              opt.separateTickets?'Separate-ticket arrangement · confirm connection risks':
                'Seller option listed by supplier at '+localeTime(data.checkedAt),
              (opt.priceBasis||'Supplier search quote; final fare not confirmed')+' · SELLER LISTED · Seat inventory NOT VERIFIED · No ticket reserved'
            );
            addExternalHandoff(sellerCard,
              'Seller: '+opt.seller+' | quoted price: '+money(opt.price,opt.currency)+
              ' | origin: '+get('travel-origin')+' | destination: '+get('travel-arrival')+
              ' | dates: '+get('check-in')+' to '+get('check-out')+
              ' | quote not guaranteed; re-select and verify on the provider website');
            area.append(sellerCard);
          }
          // Each seller card already includes its own external booking-research link.
        }
        if(data.limitations?.length)area.append(word('p',data.limitations.join(' '),'wf-provider-caveat'));
        completed=true;
        button.textContent='Supplier lookup completed · choose a different itinerary to compare';
      }catch(error){
        area.replaceChildren(word('p',error?.name==='AbortError'?
          'Supplier request timed out. This is not evidence of sold-out tickets.':
          'Supplier lookup unavailable: '+(error?.message||'Try another time.'),'wf-provider-caveat'));
      }finally{
        clearTimeout(timeout);button.disabled=completed;button.removeAttribute('aria-busy');
      }
    });
  }
  function show(res){
    output.replaceChildren();
    output.append(
      panel('Flights · schedule & ticket research',res.flights,offer=>{
        const times=(offer.segments||[]).map(s=>
          [s.airline,s.number,'·',s.from,'→',s.to,'· depart',s.departureAt||'Time not supplied',
           '· arrive',s.arrivalAt||'Time not supplied'].filter(Boolean).join(' ')
        ).join(' / ');
        const duration=Number.isFinite(offer.totalDurationMinutes)?' · '+Math.floor(offer.totalDurationMinutes/60)+'h '+(offer.totalDurationMinutes%60)+'m':'';
        const stops=Number.isInteger(offer.stopCount)?' · '+(offer.stopCount===0?'Nonstop':offer.stopCount+' stop(s)'):'';
        const card=itemCard(
          money(offer.perAdult,offer.currency)+' per adult · '+money(offer.estimatedGroup,offer.currency)+' estimated group',
          times+duration+stops,
          budget(offer.budgetFit)+' · Ticket availability: NOT VERIFIED · Seats: unknown · Return selection: unconfirmed · Schedule/price indicative at search, not live operational status'
        );
        addSelection(card,offer.selection);
        addExternalHandoff(card,
          'Outbound: '+times+
          ' | '+money(offer.perAdult,offer.currency)+' per adult (indicative)'+
          ' | origin '+get('travel-origin')+' | arrival '+get('travel-arrival')+
          ' | outbound '+get('check-in')+' | return '+get('check-out')+
          ' | group: '+get('stay-adults')+' travelers | NOT a confirmed booking');
        return card;
      }),
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
