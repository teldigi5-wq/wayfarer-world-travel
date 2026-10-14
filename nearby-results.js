/* Wayfarer Stage 21: source-backed nearby cards and opt-in supplier quote handoff.
   The map endpoint never provides prices; only an explicit protected search can. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const airports=$('airport-list'),hotels=$('hotel-list'),nearby=$('nearby');
  if(!airports||!hotels||!nearby)return;
  const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
  const cleanName=value=>String(value||'').normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const safeUrl=value=>{
    try{const url=new URL(value);return url.protocol==='https:'&&
      ['www.openstreetmap.org','ourairports.com','www.ourairports.com','www.wikidata.org'].includes(url.hostname)?url.href:null;
    }catch{return null;}
  };
  const validMoney=value=>typeof value==='number'||typeof value==='string'
    ?Number.isFinite(Number(value))&&Number(value)>0&&Number(value)<1e8:false;
  function nights(a,b){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(a||'')||!/^\d{4}-\d{2}-\d{2}$/.test(b||''))return 0;
    const start=Date.parse(a+'T00:00:00Z'),end=Date.parse(b+'T00:00:00Z');
    return Number.isFinite(start)&&Number.isFinite(end)&&end>start?Math.round((end-start)/86400000):0;
  }
  const make=(tag,cls,content)=>{
    const el=document.createElement(tag);if(cls)el.className=cls;
    if(content!==undefined)el.textContent=String(content);return el;
  };
  const status=(root,message)=>{
    root.replaceChildren(make('p','wf-nearby-status world-empty',message));
  };
  let chosen=null,items={airports:[],hotels:[]},quotes=null,loadSeq=0,controller=null;
  const selectedDates=()=>({checkIn:$('check-in')?.value||'',checkOut:$('check-out')?.value||'',
    adults:Number($('stay-adults')?.value||0)});

  function quoteFor(item,type) {
    if(!chosen||!quotes?.payload||!quotes?.trip||quotes.payload.mode!=='search_only')return null;
    const t=quotes.trip,dates=selectedDates();
    if(cleanName(t.destination)!==cleanName(chosen.name)||t.checkIn!==dates.checkIn||
      t.checkOut!==dates.checkOut||Number(t.adults)!==dates.adults)return null;
    const response=quotes.payload,offers=type==='hotel'?response.hotels?.offers:response.flights?.offers;
    if(!Array.isArray(offers)||!response.checkedAt)return null;
    if(type==='hotel'){
      const hit=offers.find(o=>cleanName(o.name)===cleanName(item.name)&&o.currency==='USD'
        &&validMoney(o.displayedTotal));
      if(!hit||!nights(dates.checkIn,dates.checkOut))return null;
      return {total:Number(hit.displayedTotal),checkedAt:hit.checkedAt||response.checkedAt,
        perNight:Number(hit.displayedTotal)/nights(dates.checkIn,dates.checkOut),currency:'USD'};
    }
    if(!/^[A-Z]{3}$/.test(item.iata||'')||t.to!==item.iata)return null;
    const hit=offers.find(o=>o.currency==='USD'&&validMoney(o.perAdult)&&
      Array.isArray(o.segments)&&o.segments.length>0&&o.segments.at(-1).to===item.iata);
    return hit?{perAdult:Number(hit.perAdult),checkedAt:hit.checkedAt||response.checkedAt,currency:'USD'}:null;
  }

  function navResearch(airportCode){
    if(airportCode&&/^[A-Z]{3}$/.test(airportCode)){
      const to=$('travel-arrival');if(to){to.value=airportCode;to.dispatchEvent(new Event('input',{bubbles:true}));}
    }
    $('wf-tab-prices')?.click();
    const research=$('wayfarer-travel-research');
    research?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
    (airportCode?$('travel-origin'):$('travel-beta-code'))?.focus({preventScroll:true});
  }
  function renderCard(item,type){
    const card=make('article','wf-nearby-card');
    const top=make('div','wf-nearby-card-top'),content=make('div','wf-nearby-content');
    const heading=make('h4','wf-nearby-name',item.name),facts=make('p','wf-nearby-facts');
    const distance=typeof item.distanceKm==='number'?item.distanceKm:NaN;
    const source=String(item.source||'Map reference');
    const code=type==='airport'&&/^[A-Z]{3}$/.test(item.iata||'')?' · '+item.iata:'';
    const locality=[item.city,item.countryCode].filter(Boolean).join(', ');
    const airportTier=type==='airport'&&item.referenceTier?' · '+item.referenceTier:'';
    facts.textContent=(Number.isFinite(distance)&&distance>=0?distance.toFixed(1)+' km straight-line':'Distance unavailable')+
      code+(locality?' · '+locality:'')+airportTier+' · '+source;
    if(type==='airport'&&code)card.dataset.airportIata=item.iata;
    content.append(heading,facts);top.append(content);
    const price=make('div','wf-nearby-price'),quote=quoteFor(item,type);
    if(quote){
      price.append(make('strong','',type==='hotel'?money.format(quote.total)+' total':money.format(quote.perAdult)+' / adult'));
      price.append(make('small','',type==='hotel'?money.format(quote.perNight)+' / night average · indicative':
        'Indicative flight search · route not guaranteed'));
      price.append(make('small','', 'Google Travel search · indicative, not confirmed'));
      const time=new Date(quote.checkedAt);
      if(Number.isFinite(time.valueOf()))price.append(make('small','','Checked '+time.toLocaleString()));
    }else{
      price.append(make('strong','','Price unavailable'));
      price.append(make('small','',type==='hotel'?'Run an optional hotel price search':'Select an origin to compare flight fares'));
    }
    card.append(top,price);
    const actions=make('div','wf-nearby-actions');
    if(Number.isFinite(item.latitude)&&Math.abs(item.latitude)<=90&&
      Number.isFinite(item.longitude)&&Math.abs(item.longitude)<=180){
      const center=make('button','wf-nearby-map','View on map ↗');center.type='button';
      center.addEventListener('click',()=>{
        window.WayfarerMap?.focusOn({...item,type},true);
        $('wf-map-studio')?.scrollIntoView({behavior:'instant',block:'start'});
      });
      actions.append(center);
    }
    const details=safeUrl(item.url);
    if(details){const link=make('a','wf-nearby-map',details.includes('wikidata.org')?'View source ↗':'View location ↗');link.href=details;
      link.target='_blank';link.rel='noopener noreferrer';actions.append(link);}
    const button=make('button','wf-nearby-compare',type==='hotel'?'Compare stay prices ↗':'Compare flights ↗');
    button.type='button';button.addEventListener('click',()=>navResearch(type==='airport'?item.iata:null));
    actions.append(button);card.append(actions);
    return card;
  }
  function providerHotelCards(){
    // This uses an explicit user-authorized request, never a background lookup.
    // Supplier result names may have no map coordinates, so distance stays null.
    if(!chosen||quotes?.payload?.mode!=='search_only')return [];
    const t=quotes.trip,dates=selectedDates();
    if(!t||cleanName(t.destination)!==cleanName(chosen.name)||
      t.checkIn!==dates.checkIn||t.checkOut!==dates.checkOut||
      Number(t.adults)!==dates.adults||!quotes.payload.checkedAt)return [];
    const known=new Set(items.hotels.map(x=>cleanName(x.name)));
    const source=quotes.payload.hotels?.offers;
    if(!Array.isArray(source))return [];
    const extra=[];
    for(const offer of source){
      if(typeof offer?.name!=='string'||offer.name.trim().length<2||offer.name.length>150||
        offer.currency!=='USD'||!validMoney(offer.displayedTotal))continue;
      const key=cleanName(offer.name);
      if(known.has(key))continue;
      known.add(key);
      extra.push({type:'hotel',name:offer.name.trim(),distanceKm:null,
        source:'Google Travel hotel search · provider supplied',url:null,price:null});
      if(extra.length===8)break;
    }
    return extra;
  }
  function render(){
    for(const [type,root] of [['airport',airports],['hotel',hotels]]){
      const rows=type==='airport'?items.airports:[...items.hotels,...providerHotelCards()].slice(0,10);
      if(rows.length)root.replaceChildren(...rows.map(row=>renderCard(row,type)));
      else status(root,type==='airport'?'No named airport reference available nearby. Try a wider destination search.':
        'No named hotels returned by public map data. A map search is available, but prices and rooms are not confirmed.');
    }
  }
  async function load(place){
    const seq=++loadSeq;
    controller?.abort();controller=new AbortController();
    chosen=Number.isFinite(place?.latitude)&&Number.isFinite(place?.longitude)?{...place}:null;
    window.WayfarerMap?.selectDestination(chosen);
    window.WayfarerDestinationIntelligence?.choose(chosen);
    const label=$('nearby-context');
    if(label)label.textContent=chosen?
      'Showing location references near '+chosen.name+(chosen.country?', '+chosen.country:'')+'. Distances are straight-line estimates. Prices require a separate search.':
      'Select a mapped destination to see available regional references.';
    quotes=null;items={airports:[],hotels:[]};
    if(!chosen){status(airports,'Select a destination with verified map coordinates.');
      status(hotels,'Choose a mapped destination to discover nearby stays.');return;}
    nearby.classList.add('world-loading');
    status(airports,'Preparing nearby airport references…');
    status(hotels,'Researching sourced hotel locations…');
    const filter=(entries,max)=>Array.isArray(entries)?entries.filter(x=>x&&typeof x.name==='string'&&x.name.trim()
      &&Number.isFinite(x.distanceKm)&&x.distanceKm>=0).slice(0,max):[];
    const coords={lat:chosen.latitude,lon:chosen.longitude,
      ...( /^[A-Z]{2}$/.test(chosen.countryCode||'')?{countryCode:chosen.countryCode}:{} )};
    let fullApplied=false;
    const quick=(async()=>{
      try{
        const response=await fetch('/api/explore?'+new URLSearchParams({mode:'airports',...coords}),{signal:controller.signal});
        if(!response.ok)throw Error('Airport reference failed');
        const d=await response.json();
        if(seq!==loadSeq||fullApplied||!d.ok)return;
        items.airports=filter(d.airports,8);
        window.WayfarerDestinationIntelligence?.show(d);
        window.WayfarerMap?.setNearby(items);
        if(items.airports.length)airports.replaceChildren(...items.airports.map(x=>renderCard(x,'airport')));
        else status(airports,'No nearby coded airports found in the bundled reference.');
      }catch(e){
        if(seq===loadSeq&&!fullApplied&&e.name!=='AbortError')
          status(airports,'Checking regional airport references…');
      }
    })();
    const detailed=(async()=>{
      try{
        const response=await fetch('/api/explore?'+new URLSearchParams({mode:'nearby',...coords}),{signal:controller.signal});
        if(!response.ok)throw Error('Nearby discovery unavailable');
        const d=await response.json();
        if(seq!==loadSeq||!d.ok)return;
        fullApplied=true;
        items={airports:filter(d.airports,8),hotels:filter(d.hotels,10)};
        window.WayfarerDestinationIntelligence?.show(d);
        window.WayfarerMap?.setNearby(items);
        render();
        if(!d.mapAvailable&&!items.hotels.length){
          status(hotels,'Public hotel records are unavailable for this area. An optional protected supplier search may provide named stays.');
        }
      }catch(e){
        if(seq!==loadSeq||e.name==='AbortError')return;
        status(hotels,'Hotel discovery temporarily unavailable. No names, prices or room availability have been inferred.');
      }
    })();
    await Promise.allSettled([quick,detailed]);
    if(seq===loadSeq)nearby.classList.remove('world-loading');
  }

  function applyQuotes(payload,trip){
    quotes={payload,trip};
    if(chosen)render();
  }
  for(const id of ['check-in','check-out','stay-adults']){
    $(id)?.addEventListener('change',()=>{if(chosen)render();});
  }
  window.WayfarerNearby=Object.freeze({load,applyQuotes});
})();
