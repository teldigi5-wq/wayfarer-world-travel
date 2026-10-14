/* Wayfarer global deterministic destination brief; sourced only from existing
   /api/explore responses. Does not fetch API data or invent a flight route. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const root=$('wf-destination-intelligence'),facts=$('wf-intelligence-facts'),
   gateways=$('wf-intelligence-gateways'),guidance=$('wf-intelligence-guidance'),
   foot=$('wf-intelligence-foot');
 if(!root||!facts||!gateways||!guidance)return;
 const node=(tag,text,cls)=>{
   const n=document.createElement(tag);n.textContent=String(text??'');
   if(cls)n.className=cls;return n;
 };
 let current=null,lastBrief=null;
 function choose(place){
   lastBrief=null;
   current=Number.isFinite(place?.latitude)&&Number.isFinite(place?.longitude)?
     {name:place.name,countryCode:place.countryCode||'',country:place.country||''}:null;
   root.hidden=!current;
   facts.replaceChildren();guidance.replaceChildren();gateways.replaceChildren();
   if(!current)return;
   foot.textContent='Gathering public airport and country references near '+current.name+
     '. Flight schedules, room prices and driving times are not inferred.';
   facts.append(node('p','Retrieving local reference data…','wf-intelligence-pending'));
 }
 function compare(code){
   if(!/^[A-Z]{3}$/.test(code))return;
   const input=$('travel-arrival');
   if(input){input.value=code;input.dispatchEvent(new Event('input',{bubbles:true}));}
   $('wf-tab-prices')?.click();
   const panel=$('wayfarer-travel-research');
   panel?.scrollIntoView({behavior:'instant',block:'start'});
   $('travel-origin')?.focus({preventScroll:true});
 }
 function show(payload){
   if(!current)return;
   const brief=payload?.intelligence;
   if(!brief||brief.mode!=='deterministic-reference-agent')return;
   lastBrief=brief;
   facts.replaceChildren();guidance.replaceChildren();gateways.replaceChildren();
   const country=brief.country;
   const rows=[
     ['DESTINATION',current.name+(country?', '+country.name:current.country?', '+current.country:'')],
     ['COUNTRY REFERENCE',country?
       [country.capital?'Capital: '+country.capital:'',country.region||''].filter(Boolean).join(' · '):
       'Country metadata not available in the bundled directory'],
     ['CLOSEST AIRPORT',brief.closestAirport?
       brief.closestAirport.name+' ('+brief.closestAirport.iata+') · '+
       brief.closestAirport.distanceKm.toFixed(1)+' km straight-line':
       'No nearby coded airport in this reference radius'],
     ['STAY DATA',brief.hotelSourceStatus==='pending'?'Public hotel source research pending':
       brief.hotelSourceStatus==='reference-records'?
       brief.hotelReferenceCount+' mapped hotel references · rates unverified':
       brief.hotelSourceStatus==='provider-unavailable'?
       'Public hotel providers unavailable · no live pricing':'No mapped hotel matches returned']
   ];
   for(const [k,v] of rows){
     const card=node('div','','wf-intelligence-fact');
     card.append(node('span',k),node('strong',v));facts.append(card);
   }
   const major=Array.isArray(brief.gatewayCandidates)?brief.gatewayCandidates.slice(0,3):[];
   if(major.length){
     for(const g of major){
       if(!/^[A-Z]{3}$/.test(g.iata||'')||!Number.isFinite(g.distanceKm))continue;
       const card=node('article','','wf-intelligence-gateway');
       const detail=node('div');
       detail.append(node('strong',g.name+' · '+g.iata),
         node('small',(g.referenceTier||'Airport reference')+' · '+
           g.distanceKm.toFixed(1)+' km straight-line'));
       const button=node('button','Compare flights ↗');
       button.type='button';button.className='wf-intelligence-compare';
       button.addEventListener('click',()=>compare(g.iata));
       card.append(detail,button);gateways.append(card);
     }
   }
   if(!gateways.children.length)
     gateways.append(node('p','No major/regional airport candidate in the reference radius. Explore local airports or a wider region.'));
   for(const note of (Array.isArray(brief.guidance)?brief.guidance:[]).slice(0,5)){
     guidance.append(node('p',note));
   }
   if(!guidance.children.length)guidance.append(node('p','Check current official airline and accommodation sources before booking.'));
   foot.textContent='Deterministic reference intelligence · '+(brief.sourceStatus?.airports||'Local airport directory')+
     ' · '+(brief.sourceStatus?.hotels||'Hotel source not checked')+
     '. NOT verified live schedules, entry rules, road travel times or bookable prices.';
 }
 // The quick airport index can finish while the independent hotel endpoint
 // fails. Resolve its pending stay claim without erasing verified gateways.
 function finishPartial(){
   if(!current)return;
   if(lastBrief?.hotelSourceStatus==='pending'){
     show({intelligence:{...lastBrief,hotelSourceStatus:'provider-unavailable',
       sourceStatus:{...lastBrief.sourceStatus,hotels:'Public hotel reference lookup unavailable'}}});
     return;
   }
   if(!lastBrief){
     facts.replaceChildren(node('p',
       'Public airport and hotel references are temporarily unavailable. No routes, rates or nearby stays are verified.',
       'wf-intelligence-pending'));
     gateways.replaceChildren();guidance.replaceChildren();
     guidance.append(node('p','Search again later or check official sources independently.'));
     foot.textContent='Public source request unavailable · no live schedules, rates, travel durations or room inventory inferred.';
   }
 }
 window.WayfarerDestinationIntelligence=Object.freeze({choose,show,finishPartial});
})();
