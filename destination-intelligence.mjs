/* Deterministic worldwide travel intelligence from reference evidence only.
   This is a non-LLM planning agent; it never represents prices or flight inventory. */
import countryData from './data.json' with {type:'json'};

const radians=Math.PI/180;
export function straightLineKm(lat,lon,lat2,lon2){
  const dLat=(lat2-lat)*radians,dLon=(lon2-lon)*radians;
  const a=Math.sin(dLat/2)**2+Math.cos(lat*radians)*Math.cos(lat2*radians)*Math.sin(dLon/2)**2;
  return Math.round(6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))*10)/10;
}
export function airportTier(type){
  return type==='large_airport'?'major gateway reference':
    type==='medium_airport'?'regional gateway reference':
    type==='small_airport'?'local airfield reference':
    type==='seaplane_base'?'seaplane reference':'airport reference';
}
export function rankReferenceAirports(airportReferences,lat,lon,{countryCode='',limit=8,maxKm=550}={}){
  if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180) return {nearby:[],gateways:[]};
  const dedup=new Map();
  for(const a of airportReferences||[]){
    if(!Number.isFinite(a.lat)||Math.abs(a.lat)>90||!Number.isFinite(a.lon)||Math.abs(a.lon)>180||
      !/^[A-Z]{3}$/.test(a.iata||'')||!/^[A-Z]{2}$/.test(a.code||''))continue;
    const d=straightLineKm(lat,lon,a.lat,a.lon);
    if(d>maxKm)continue;
    const value={
      type:'airport',name:String(a.name||'Airport').slice(0,150),iata:a.iata,
      city:String(a.municipality||'').slice(0,90),countryCode:a.code,
      latitude:a.lat,longitude:a.lon,distanceKm:d,
      airportType:a.type||'',referenceTier:airportTier(a.type),
      scheduledServiceReference:a.scheduledService===true?'yes':'unknown',
      source:'OurAirports reference',url:'https://ourairports.com',price:null
    };
    // Prefer the closest location if the public reference has multiple IATA records.
    const old=dedup.get(a.iata);
    if(!old||value.distanceKm<old.distanceKm)dedup.set(a.iata,value);
  }
  const sorted=[...dedup.values()].sort((a,b)=>a.distanceKm-b.distanceKm);
  const gateway=x=>['large_airport','medium_airport'].includes(x.airportType);
  const prioritized=sorted.filter(gateway).sort((a,b)=>{
    const sameA=countryCode&&a.countryCode===countryCode?1:0;
    const sameB=countryCode&&b.countryCode===countryCode?1:0;
    if(sameA!==sameB)return sameB-sameA;
    const servicedA=a.scheduledServiceReference==='yes'?1:0;
    const servicedB=b.scheduledServiceReference==='yes'?1:0;
    if(servicedA!==servicedB)return servicedB-servicedA;
    if(a.airportType!==b.airportType)return a.airportType==='large_airport'?-1:1;
    return a.distanceKm-b.distanceKm;
  });
  const gateways=prioritized.slice(0,3);
  const selected=sorted.slice(0,Math.min(limit,5)),used=new Set(selected.map(a=>a.iata));
  for(const a of gateways)if(!used.has(a.iata)&&selected.length<limit){
    selected.push(a);used.add(a.iata);
  }
  for(const a of sorted)if(selected.length<limit&&!used.has(a.iata)){
    selected.push(a);used.add(a.iata);
  }
  return {nearby:selected.slice(0,limit),gateways,sourceCount:sorted.length};
}
const countryFor=code=>Array.isArray(countryData.countries)?
  countryData.countries.find(x=>x.code===code):null;

export function destinationIntelligence({
  lat,lon,countryCode='',airports=[],gateways=[],hotels=[],
  mapAvailable=false,wikidataAvailable=false,partial=false
}={}){
  const country=/^[A-Z]{2}$/.test(countryCode)?countryFor(countryCode):null;
  const valid=a=>a&&Number.isFinite(a.distanceKm)&&a.distanceKm>=0;
  const nearby=airports.filter(valid).slice().sort((a,b)=>a.distanceKm-b.distanceKm);
  const closest=nearby[0]||null;
  const primary=gateways.find(valid)||nearby.find(x=>
    ['major gateway reference','regional gateway reference'].includes(x.referenceTier))||null;
  const hotelCount=hotels.filter(x=>typeof x?.name==='string'&&x.name.trim()).length;
  const guidance=[];
  if(closest&&['local airfield reference','seaplane reference'].includes(closest.referenceTier)&&primary&&primary.iata!==closest.iata)
    guidance.push('The closest location ('+closest.iata+') is a local or seaplane reference, not a verified scheduled airline gateway. Compare routes to '+primary.iata+' and other major airports before planning transfers.');
  else if(closest)guidance.push('Compare operating routes to '+closest.iata+' before choosing an arrival airport; a directory listing is not a timetable.');
  else guidance.push('No coded airport was found in the current reference radius. Check a wider search or nearby countries.');
  if(primary&&countryCode&&primary.countryCode!==countryCode)
    guidance.push('One potential gateway is across a national border. Check applicable entry/transit rules before planning a transfer.');
  if(partial)guidance.push('Airport guidance is ready from local reference data; hotel source checks are still pending.');
  else if(hotelCount===0)guidance.push('No named hotels were confirmed in the available map references. Use an optional provider search for accommodation research.');
  else guidance.push(hotelCount+' mapped hotel references found. Room availability, rates and suitability still require confirmation.');
  guidance.push('Road journeys, traffic, flight schedules and actual fares are not calculated from straight-line distances.');
  return {
    mode:'deterministic-reference-agent',country:country?{
      code:country.code,name:country.name,capital:country.capital||null,region:country.region||null,
      source:'Bundled country directory · reference only',coordinateType:country.coordinateType||null
    }:null,
    closestAirport:closest?{iata:closest.iata,name:closest.name,distanceKm:closest.distanceKm,
      referenceTier:closest.referenceTier||'airport reference'}:null,
    gatewayCandidates:gateways.filter(valid).map(x=>({
      iata:x.iata,name:x.name,distanceKm:x.distanceKm,
      countryCode:x.countryCode,referenceTier:x.referenceTier
    })),
    hotelSourceStatus:partial?'pending':
      hotelCount?'reference-records':mapAvailable||wikidataAvailable?'no-verified-matches':'provider-unavailable',
    hotelReferenceCount:hotelCount,airportReferenceCount:nearby.length,guidance,
    sourceStatus:{airports:'OurAirports public reference',hotels:partial?'pending':mapAvailable?
      'OpenStreetMap contributor records':wikidataAvailable?'Wikidata CC0 records':'limited or unavailable'},
    caveat:'Reference guidance only. No live schedules, visa advice, booking inventory, room prices or driving times verified.'
  };
}
