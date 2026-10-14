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
        <div class="travel-research-action"><button type="submit" class="light" id="travel-search-button">Compare travel searches ↗</button><button type="button" id="travel-cancel-button" class="light wf-travel-cancel" hidden>Cancel search</button>
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
  // Known airline-owned booking websites. Exact aliases only; never synthesize
  // arbitrary booking URLs from untrusted supplier text or imply a confirmed fare.
  const officialAirlines=Object.freeze({
    'srilankan airlines':{name:'SriLankan Airlines',url:'https://www.srilankan.com/'},
    'srilankan':{name:'SriLankan Airlines',url:'https://www.srilankan.com/'},
    'qatar airways':{name:'Qatar Airways',url:'https://www.qatarairways.com/en-lk/homepage.html'},
    'singapore airlines':{name:'Singapore Airlines',url:'https://www.singaporeair.com/en_UK/se/home/'}
  });
  function addOfficialAirlineHandoff(card,segments){
    const seen=new Set(),matched=[];
    for(const segment of Array.isArray(segments)?segments:[]){
      const name=String(segment.airline||'').trim().toLocaleLowerCase('en');
      const airline=Object.hasOwn(officialAirlines,name)?officialAirlines[name]:null;
      if(airline&&!seen.has(airline.name)){seen.add(airline.name);matched.push(airline);}
    }
    if(!matched.length)return;
    const row=word('div','','wf-airline-direct');
    row.append(word('strong','Prefer to book with the airline?','wf-airline-direct-title'));
    for(const airline of matched){
      const link=document.createElement('a');link.href=airline.url;
      link.target='_blank';link.rel='noopener noreferrer';
      link.className='wf-airline-direct-link';
      link.textContent='Visit '+airline.name+' (official site) ↗';
      row.append(link);
    }
    row.append(word('p','The airline opens in a separate tab. Enter your dates and route again and verify final fares, connections and baggage. Wayfarer does not send a booking or reserve seats.','wf-airline-direct-note'));
    card.append(row);
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

  const detail=(label,value,kind='')=>{
    const block=word('div','','wf-detail '+kind);
    block.append(word('span',label,'wf-detail-label'),word('strong',value,'wf-detail-value'));
    return block;
  };
  const minuteLabel=minutes=>Number.isFinite(minutes)&&minutes>=0?
    Math.floor(minutes/60)+'h '+String(minutes%60).padStart(2,'0')+'m':'Duration not supplied';
  function flightOfferCard(offer,index){
    const card=word('article','','travel-search-item wf-flight-result');
    const first=offer.segments?.[0]||{},last=offer.segments?.at(-1)||first;
    const header=word('div','','wf-result-head');
    const heading=word('div','','wf-result-heading');
    heading.append(word('span','FLIGHT OPTION '+String(index+1).padStart(2,'0'),'wf-result-eyebrow'),
      word('h5',first.airline||'Airline not supplied'));
    const quote=word('div','','wf-result-quote');
    quote.append(word('strong',money(offer.perAdult,offer.currency),'wf-quote-amount'),
      word('span','Per adult · indicative search fare','wf-quote-caption'));
    header.append(heading,quote);card.append(header);
    const summary=word('div','','wf-flight-summary');
    summary.append(detail('DEPARTURE',first.from||'—'),
      detail('ARRIVAL',last.to||'—'),
      detail('JOURNEY DURATION',minuteLabel(offer.totalDurationMinutes)),
      detail('CONNECTIONS',Number.isInteger(offer.stopCount)?
        (offer.stopCount===0?'Nonstop':offer.stopCount+' stop'+(offer.stopCount===1?'':'s')):'Not supplied'));
    card.append(summary);
    const timeline=word('div','','wf-flight-timeline');
    for(let i=0;i<(offer.segments||[]).length;i++){
      const segment=offer.segments[i];
      const row=word('div','','wf-flight-segment');
      const departure=detail('DEPART · '+(segment.from||'—'),segment.departureAt||'Time not supplied');
      const route=word('div','','wf-route-line');
      route.append(word('span',(segment.airline||'Airline')+' '+(segment.number||''),'wf-route-airline'),
        word('span','→','wf-route-arrow'));
      const arrival=detail('ARRIVE · '+(segment.to||'—'),segment.arrivalAt||'Time not supplied');
      row.append(departure,route,arrival);timeline.append(row);
      if(i<(offer.segments.length-1)){
        timeline.append(word('p','Connection via '+(segment.to||'unknown airport')+
          ' · transfer requirements and layover time not verified','wf-connection-note'));
      }
    }
    card.append(timeline);
    const total=word('div','','wf-flight-financial');
    total.append(detail('ESTIMATED GROUP FLIGHT COST',money(offer.estimatedGroup,offer.currency)),
      word('span',offer.budgetFit==='over_budget'?'Above your selected flight budget':
        offer.budgetFit==='within_budget'?'Within your selected flight budget':
        'No flight budget selected','wf-fare-budget '+(offer.budgetFit||'')));
    card.append(total);
    card.append(word('p','Ticket availability: NOT VERIFIED · No seats reserved · Provider-reported clock times; time zones and live operating status not independently verified. Outbound search fare only; return and checkout totals may change.',
      'wf-flight-disclaimer'));
    addSelection(card,offer.selection);
    addOfficialAirlineHandoff(card,offer.segments);
    const times=(offer.segments||[]).map(segment=>
      [segment.airline,segment.number,segment.from+' → '+segment.to,
        'depart '+(segment.departureAt||'unknown'),
        'arrive '+(segment.arrivalAt||'unknown')].filter(Boolean).join(' · ')).join(' / ');
    addExternalHandoff(card,'Outbound: '+times+' | '+money(offer.perAdult,offer.currency)+
      ' per adult (indicative) | origin '+get('travel-origin')+' | arrival '+
      get('travel-arrival')+' | outbound '+get('check-in')+' | return '+get('check-out')+
      ' | group: '+get('stay-adults')+' travelers | NOT a confirmed booking');
    return card;
  }
  function hotelOfferCard(offer,index){
    const card=word('article','','travel-search-item wf-hotel-result');
    const header=word('div','','wf-result-head');
    const heading=word('div','','wf-result-heading');
    heading.append(word('span','STAY OPTION '+String(index+1).padStart(2,'0'),'wf-result-eyebrow'),
      word('h5',offer.name||'Hotel name not supplied'));
    const quote=word('div','','wf-result-quote');
    quote.append(word('strong',money(offer.displayedTotal,offer.currency),'wf-quote-amount'),
      word('span','Lowest displayed search total · NOT a nightly rate','wf-quote-caption'));
    header.append(heading,quote);card.append(header);
    const nights=(Date.parse((offer.checkOut||'')+'T00:00:00Z')-
      Date.parse((offer.checkIn||'')+'T00:00:00Z'))/86400000;
    const row=word('div','','wf-hotel-meta');
    row.append(detail('CHECK-IN',offer.checkIn||'Not supplied'),
      detail('CHECK-OUT',offer.checkOut||'Not supplied'),
      detail('LENGTH OF STAY',Number.isInteger(nights)&&nights>0?nights+' nights':'Not supplied'));
    card.append(row);
    const budgetState=offer.budgetFit==='over_budget'?'Above allocated stay budget':
      offer.budgetFit==='within_budget'?'Within allocated stay budget':'No comparable stay budget';
    card.append(word('p',budgetState,'wf-fare-budget '+(offer.budgetFit||'')));
    card.append(word('p','Indicative supplier search result. Room occupancy, taxes, cancellation policy, current room availability and the final checkout total have NOT been verified. Confirm with the hotel before purchase.','wf-hotel-disclaimer'));
    const handoff=word('div','','wf-external-flight-handoff');
    const hotelLink=word('a','Compare this stay on Google Hotels ↗','wf-flight-compare-link');
    hotelLink.href='https://www.google.com/travel/hotels';
    hotelLink.target='_blank';hotelLink.rel='noopener noreferrer';
    const note=word('p','Opens Google Hotels in a separate tab. Search the same hotel, dates and occupancy; a matching room or price is not guaranteed.','wf-flight-handoff-note');
    handoff.append(hotelLink,note);card.append(handoff);
    return card;
  }
  function resultPanel(title,obj,kind){
    const article=word('section','','travel-search-card wf-compare-panel');
    const head=word('div','','wf-compare-panel-head');
    const headings=word('div','','wf-panel-titles');
    headings.append(word('h4',title),word('span',statusLabel(obj.status),'travel-search-state'),
      word('p',obj.message));
    head.append(headings);
    const records=(obj.offers||[]).slice();
    const list=word('div','','wf-comparison-list');
    if(records.length){
      const sortBox=word('label','','wf-sort-field');
      const text=word('span',kind==='flight'?'SORT FLIGHTS':'SORT STAYS');
      const select=document.createElement('select');
      select.className='wf-sort-select';
      select.setAttribute('aria-label',kind==='flight'?'Sort flight results':'Sort hotel results');
      for(const [v,label] of (kind==='flight'?
        [['price','Lowest group estimate'],['duration','Shortest listed duration'],['stops','Fewest stops']]:
        [['price','Lowest displayed total'],['name','Hotel name A–Z']])){
        const o=document.createElement('option');o.value=v;o.textContent=label;select.append(o);
      }
      sortBox.append(text,select);head.append(sortBox);
      const render=()=>{
        const sorted=[...records].sort((a,b)=>{
          if(select.value==='name')return (a.name||'').localeCompare(b.name||'');
          if(select.value==='duration')return (a.totalDurationMinutes??Infinity)-(b.totalDurationMinutes??Infinity)||
            Number(a.estimatedGroup)-Number(b.estimatedGroup);
          if(select.value==='stops')return (a.stopCount??Infinity)-(b.stopCount??Infinity)||
            Number(a.estimatedGroup)-Number(b.estimatedGroup);
          return Number(kind==='flight'?a.estimatedGroup:a.displayedTotal)-
            Number(kind==='flight'?b.estimatedGroup:b.displayedTotal);
        });
        list.replaceChildren(...sorted.map((offer,i)=>kind==='flight'?
          flightOfferCard(offer,i):hotelOfferCard(offer,i)));
      };
      select.addEventListener('change',render);
      render();
    }else list.append(word('p',obj.message||'No usable provider offers were returned. This does not mean sold out.','wf-compare-empty'));
    article.append(head,word('p',records.length+' search result'+(records.length===1?'':'s')+
      ' · no guaranteed inventory','wf-results-count'),list);
    return article;
  }
  function show(res){
    output.replaceChildren();
    const grid=word('div','','wf-comparison-grid');
    grid.append(resultPanel('Flight comparison',res.flights,'flight'),
      resultPanel('Hotel comparison',res.hotels,'hotel'));
    output.append(grid);
    const extras=word('div','','wf-other-research');
    extras.append(panel('Restaurants & meals',res.food,()=>itemCard('No price feed',
      'Consult restaurant menus directly','No AI-generated menu prices')),
      panel('Local transport',res.transport,()=>itemCard('No fare feed',
      'Check the local operator','No invented transit fares')));
    output.append(extras);
    output.append(word('p','Search timestamp: '+localeTime(res.checkedAt)+
      ' · '+res.note,'travel-search-foot'));
  }
  let showingSupplierResults=false,supplierRequestSerial=0,activeSupplierRequest=null;
  const resetSupplierControls=()=>{
    const button=$('travel-search-button');
    button.disabled=false;button.removeAttribute('aria-busy');
    $('travel-cancel-button').hidden=true;
  };
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    // A repeated click while an authorized paid-capable search runs must
    // never start another request or consume an additional provider credit.
    if(activeSupplierRequest||!form.reportValidity())return;
    const serial=++supplierRequestSerial;
    const button=$('travel-search-button');
    button.disabled=true;button.setAttribute('aria-busy','true');
    $('travel-cancel-button').hidden=false;
    status.textContent='Searching connected travel providers…';output.replaceChildren();
    showingSupplierResults=false;
    window.WayfarerNearby?.clearQuotes?.();
    const days=Number(get('days'))||3,daily=Number(get('budget'))||0;
    // Snapshotted reference coordinates come from the selected mapped location.
    // They scope an explicit search; they do not independently verify room addresses.
    const locationAtSearch=window.WayfarerNearby?.currentLocation()??null;
    const trip={
      from:get('travel-origin').toUpperCase().trim(),to:get('travel-arrival').toUpperCase().trim(),
      destination:get('destination').trim()||get('world-query').trim(),
      ...(locationAtSearch?{
        countryCode:locationAtSearch.countryCode,
        latitude:locationAtSearch.latitude,longitude:locationAtSearch.longitude
      }:{}),
      checkIn:get('check-in'),checkOut:get('check-out'),
      adults:Number(get('stay-adults')),
      groundBudget:Math.round(days*daily*100)/100,
      flightBudget:get('travel-airfare')===''?0:Number(get('travel-airfare'))
    };
    // Bind the authorized search to exact trip details AND source location.
    const requestStillCurrent=()=>{
      if(get('travel-origin').toUpperCase().trim()!==trip.from||
         get('travel-arrival').toUpperCase().trim()!==trip.to||
         (get('destination').trim()||get('world-query').trim())!==trip.destination||
         get('check-in')!==trip.checkIn||get('check-out')!==trip.checkOut||
         Number(get('stay-adults'))!==trip.adults||
         (get('travel-airfare')===''?0:Number(get('travel-airfare')))!==trip.flightBudget||
         Math.round(((Number(get('days'))||3)*(Number(get('budget'))||0))*100)/100!==trip.groundBudget)
        return false;
      if(locationAtSearch&&window.WayfarerNearby?.isCurrentLocation)
        return window.WayfarerNearby.isCurrentLocation(locationAtSearch);
      return !window.WayfarerNearby?.currentLocation?.();
    };
    try{
      const ctrl=new AbortController();activeSupplierRequest=ctrl;
      const timer=setTimeout(()=>ctrl.abort(),25000);
      let response,payload;
      try{
        response=await fetch('/api/travel-search',{
          method:'POST',
          headers:{'Content-Type':'application/json','X-Wayfarer-Beta-Token':get('travel-beta-code')},
          body:JSON.stringify({trip}),signal:ctrl.signal
        });
        payload=await response.json();
      }finally{clearTimeout(timer)}
      // A request is obsolete even if the user restores the SAME values.
      // Ignore late responses and don't disturb any newer search.
      if(serial!==supplierRequestSerial)return;
      if(!response.ok||!payload.ok)throw Error(payload.error||'Provider search unavailable');
      if(!requestStillCurrent()){
        status.textContent='Your travel details changed during research. Previous results were discarded. Search again for the current trip.';
        output.replaceChildren();
        return;
      }
      status.textContent=payload.mode==='search_only'?
        'Google Travel search results · not confirmed inventory':
        'Search currently disabled · no real prices connected';
      show(payload);
      showingSupplierResults=true;
      // Only actual explicit provider results may appear on nearby cards.
      window.WayfarerNearby?.applyQuotes(payload,trip,locationAtSearch);
    }catch(err){
      if(serial!==supplierRequestSerial)return;
      status.textContent=err.name==='AbortError'?
        'Search timed out. No availability conclusion is possible.':
        err.message||'Search unavailable.';
    }finally{
      if(serial===supplierRequestSerial){
        activeSupplierRequest=null;resetSupplierControls();
      }
    }
  });
  // Editing ANY material field or changing the mapped destination invalidates
  // even an in-flight response. Abort client delivery; provider-side processing
  // may already have started and cannot be guaranteed cancelled.
  const invalidateSupplierView=()=>{
    if(!showingSupplierResults&&!activeSupplierRequest)return false;
    const interrupted=!!activeSupplierRequest;
    supplierRequestSerial++;
    activeSupplierRequest?.abort();activeSupplierRequest=null;
    showingSupplierResults=false;output.replaceChildren();
    window.WayfarerNearby?.clearQuotes?.();
    resetSupplierControls();
    status.textContent=interrupted?
      'Trip details changed. The browser request was stopped, but the provider may already be processing it. Search again for the current trip.':
      'Trip details changed. Previous search prices were cleared. Run a new explicit search to compare current options.';
    return true;
  };
  $('travel-cancel-button').addEventListener('click',()=>{
    if(invalidateSupplierView())
      status.textContent='Travel search cancelled in this browser. The provider may already be processing the request; no booking was created.';
  });
  for(const id of ['travel-origin','travel-arrival','travel-airfare','check-in',
    'check-out','stay-adults','days','budget','destination','world-query']){
    $(id)?.addEventListener('input',invalidateSupplierView);
    $(id)?.addEventListener('change',invalidateSupplierView);
  }
  window.addEventListener?.('wayfarer:location-changed',invalidateSupplierView);
  // Read explicit IATA attributes from source-backed nearby cards. Parsing
  // visible prices/text for three-letter codes could mistake USD for an airport.
  const nearby=$('airport-list');
  if(nearby){const refresh=()=>{
    const list=$('travel-airport-options');
    if(!list)return;
    const known=new Set([...list.children].map(o=>o.value));
    for(const item of nearby.querySelectorAll('[data-airport-iata]')){
      const code=item.dataset.airportIata;
      if(!/^[A-Z]{3}$/.test(code||'')||known.has(code))continue;
      const opt=document.createElement('option');opt.value=code;
      opt.label=item.querySelector('.wf-nearby-name')?.textContent||'Nearby airport';
      list.append(opt);known.add(code);
    }
  };new MutationObserver(refresh).observe(nearby,{childList:true,subtree:true});refresh();}

})();
