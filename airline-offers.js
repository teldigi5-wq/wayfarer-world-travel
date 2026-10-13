// Optional airline-authorized offer research: sandbox and live are NEVER blended.
// No orders, payments, or direct ticket booking actions.
(() => {
  'use strict';
  const parent=document.getElementById('wayfarer-travel-research');
  if(!parent||document.getElementById('wf-airline-offers'))return;
  const $=id=>document.getElementById(id);
  const section=document.createElement('section');
  section.id='wf-airline-offers';section.className='wf-airline-offers';
  section.setAttribute('aria-labelledby','wf-airline-title');
  section.innerHTML='<div class="wf-airline-heading"><span class="wf-kicker">AIRLINE OFFER VERIFICATION / OPTIONAL BETA</span>'+
    '<h3 id="wf-airline-title">A better signal than a search price.</h3>'+
    '<p>Airline supplier offers can be rechecked before booking. An offer is not a reservation, and sandbox offers are never real tickets.</p>'+
    '<div class="wf-airline-status" id="wf-airline-label">Not connected or not searched</div></div>'+
    '<div class="wf-airline-toolbar"><button type="button" class="wf-airline-btn" id="wf-airline-search">Check airline supplier offers ↗</button>'+
    '<p>Separate user-requested provider lookup. Uses the same airport, dates and beta access code entered above. No purchase will be made.</p></div>'+
    '<p id="wf-airline-status" role="status" aria-live="polite">Select both airports and valid travel dates before searching.</p>'+
    '<div id="wf-airline-results" class="wf-airline-results" aria-live="polite"></div>';
  parent.append(section);
  const status=$('wf-airline-status'),results=$('wf-airline-results');
  const button=$('wf-airline-search'),badge=$('wf-airline-label');
  const word=(tag,value,cls)=>{
    const el=document.createElement(tag);
    el.textContent=String(value??'');
    if(cls)el.className=cls;
    return el;
  };
  const time=value=>{
    if(!value)return 'Not supplied';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?String(value).slice(0,36):
      d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
  };
  const amount=o=>/^[A-Z]{3}$/.test(o?.currency||'')&&/^\d+\.\d{2}$/.test(String(o?.totalAmount))?
    o.currency+' '+o.totalAmount:'Price unavailable';
  async function request(body) {
    const code=$('travel-beta-code')?.value?.trim();
    if(!code||code.length<24)throw Error('Enter your private beta access code above.');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),21000);
    try{
      const response=await fetch('/api/airline-offers',{
        method:'POST',headers:{'Content-Type':'application/json','X-Wayfarer-Beta-Token':code},
        body:JSON.stringify(body),signal:controller.signal
      });
      const json=await response.json();
      if(!response.ok||!json.ok)throw Error(json.error||'Supplier unavailable');
      return json;
    }finally{clearTimeout(timer)}
  }
  function show(payload){
    results.replaceChildren();
    badge.textContent=payload.mode==='test'?'Sandbox only · no real tickets':
      payload.mode==='live'?'Airline supplier · not reserved':'Not connected';
    status.textContent=payload.message;
    if(!payload.offers?.length){
      results.append(word('p',
        'No airline offer to show. This does not mean the route is sold out.','wf-airline-empty'));
      return;
    }
    for(const offer of payload.offers){
      const card=word('article','','wf-airline-offer');
      const pill=word('span',offer.label||'OFFER STATUS UNKNOWN',
        offer.mode==='test'?'wf-airline-pill sandbox':'wf-airline-pill');
      const h=word('h4',(offer.operatingCarrier||'Operating airline not supplied')+
        ' · '+amount(offer));
      const info=word('p',(offer.priceBasis||'Supplier price indication')+
        ' · Offer expires '+time(offer.expiresAt)+' · Last checked '+time(offer.checkedAt));
      card.append(pill,h,info);
      for(let index=0;index<(offer.slices||[]).length;index++){
        const slice=offer.slices[index];
        const group=word('div','','wf-airline-route');
        group.append(word('strong',index===0?'Outbound itinerary':'Return itinerary'));
        for(const segment of (slice.segments||[])){
          group.append(word('p',
            [segment.operatingCarrier,
             segment.flightNumber?'Flight '+segment.flightNumber:'',
             segment.from+' → '+segment.to,
             'Depart '+time(segment.departingAt),
             'Arrive '+time(segment.arrivingAt)].filter(Boolean).join(' · ')));
        }
        card.append(group);
      }
      card.append(word('p',
        offer.mode==='test'?
          'TEST OFFER · Not real airfare, not real seat availability, and no booking created.':
          'SUPPLIER OFFER · May expire or reprice. No ticket reserved; actual booking remains unconfirmed.',
        'wf-airline-trust'));
      if(offer.refreshToken){
        const refresh=word('button','Recheck this airline offer ↗','wf-airline-refresh');
        refresh.type='button';
        refresh.setAttribute('aria-label','Recheck airline offer; this makes another supplier request');
        refresh.addEventListener('click',async()=>{
          refresh.disabled=true;refresh.setAttribute('aria-busy','true');
          status.textContent='Refreshing the supplier offer…';
          try{
            const data=await request({action:'refresh',refreshToken:offer.refreshToken});
            show(data);
          }catch(error){
            status.textContent=error?.name==='AbortError'?'Supplier timed out. No availability conclusion possible.':
              error?.message||'Could not refresh airline offer.';
            refresh.disabled=false;
          }finally{refresh.removeAttribute('aria-busy');}
        });
        card.append(refresh);
      }
      results.append(card);
    }
  }
  button.addEventListener('click',async()=>{
    const from=($('travel-origin')?.value||'').toUpperCase().trim();
    const to=($('travel-arrival')?.value||'').toUpperCase().trim();
    const checkIn=$('check-in')?.value||'',checkOut=$('check-out')?.value||'';
    const adults=Number($('stay-adults')?.value||'0');
    if(!/^[A-Z]{3}$/.test(from)||!/^[A-Z]{3}$/.test(to)||!checkIn||!checkOut||
       !Number.isInteger(adults)||adults<1||adults>9){
      status.textContent='Select a departure airport, arrival airport, dates and passenger count first.';
      return;
    }
    button.disabled=true;button.setAttribute('aria-busy','true');
    status.textContent='Asking the configured airline offer supplier…';
    results.replaceChildren();
    try{
      show(await request({action:'search',trip:{from,to,checkIn,checkOut,adults}}));
    }catch(error){
      status.textContent=error?.name==='AbortError'?
        'Airline supplier timed out. No availability conclusion possible.':
        error?.message||'Airline supplier unavailable.';
    }finally{button.disabled=false;button.removeAttribute('aria-busy')}
  });
})();
