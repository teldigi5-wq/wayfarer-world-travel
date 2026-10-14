import airportData from '../data.json' with {type:'json'};
import airportCatalog from '../airports-index.json' with {type:'json'};
import {lookupWikidataHotels} from '../worldwide-hotel-sources.mjs';
import {rankReferenceAirports,destinationIntelligence} from '../destination-intelligence.mjs';
import {gatherPublicHotels,cachedPublicNearby} from '../worldwide-source-coordinator.mjs';
const timedFetch=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(12000)});
const clean=(value,max=120)=>String(value??'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,max);
const number=(value,min,max)=>{const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null};
const distance=(a,b,c,d)=>{const r=6371,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p;const h=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return Math.round(6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))*10)/10};

async function search(req){
  const q=clean(req.query.q,80),code=clean(req.query.countryCode,2).toUpperCase();
  if(q.length<2)return {status:400,body:{ok:false,error:'Enter at least two characters'}};
  if(code&&!/^[A-Z]{2}$/.test(code))return {status:400,body:{ok:false,error:'Invalid country filter'}};
  // Geocoding is a source lookup, not an AI guess; it returns explicit coordinates
  // and disambiguated regional names. No keys, billing or user history.
  const url=new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search=new URLSearchParams({name:q,count:'8',language:'en',format:'json',...(code?{countryCode:code}:{})}).toString();
  const r=await fetch(url,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(4200)});
  if(!r.ok)throw Error('Destination index temporarily unavailable');
  const d=await r.json();
  const results=(Array.isArray(d.results)?d.results:[]).filter(p=>
    Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&
    (!code||p.country_code===code)).slice(0,8).map(p=>({
      id:p.id,name:clean(p.name),admin:clean([p.admin1,p.admin2].filter(Boolean).join(', ')),
      country:clean(p.country),countryCode:clean(p.country_code,2),
      latitude:p.latitude,longitude:p.longitude,timezone:clean(p.timezone,70)
    })).filter(p=>p.name.length>0);
  return {status:200,body:{ok:true,provider:'Open-Meteo Geocoding',sourceUrl:'https://open-meteo.com/en/docs/geocoding-api',results}};
}

// Limited, auditable 2026-10-14 OpenStreetMap reference snapshot for the
// Sigiriya region. It is NOT a hotel availability/rate inventory; entries can go
// stale. Coordinates and OSM element IDs were cross-checked against public maps.
const sigiriyaHotelReferences=Object.freeze([
  {name:'Hotel Sigiriya',lat:7.94991,lon:80.76315,url:'https://www.openstreetmap.org/way/732409914'},
  {name:'Sigiriya Village',lat:7.94959,lon:80.76132,url:'https://www.openstreetmap.org/way/1308624588'},
  {name:'Jetwing Vil Uyana',lat:7.95096,lon:80.74434,url:'https://www.openstreetmap.org/node/2051260971'},
  {name:'Aliya Resort & Spa',lat:7.99946,lon:80.73537,url:'https://www.openstreetmap.org/node/4516650287'},
  {name:'Water Garden Sigiriya',lat:7.99227,lon:80.74532,url:'https://www.openstreetmap.org/node/4516651490'},
  {name:'Sigiriya Water Cottages',lat:7.94452,lon:80.73179,url:'https://www.openstreetmap.org/node/9624421417'}
]);

async function nearby(req,{airportsOnly=false}={}){
  const lat=number(req.query.lat,-90,90),lon=number(req.query.lon,-180,180);
  if(lat===null||lon===null)return {status:400,body:{ok:false,error:'Invalid coordinates'}};
  const countryCode=clean(req.query.countryCode||'',2).toUpperCase();
  if(countryCode&&!/^[A-Z]{2}$/.test(countryCode))return {status:400,body:{ok:false,error:'Invalid country filter'}};

  // Always provide sourced airport reference names, even if Overpass is rate limited.
  // The bundled OurAirports-based file is an airport index, not flight availability.
  const airportReferences=Array.isArray(airportCatalog.airports)&&airportCatalog.airports.length>=1000?
    airportCatalog.airports:airportData.airports;
  const ranked=rankReferenceAirports(airportReferences,lat,lon,{countryCode,limit:8,maxKm:550});
  const indexed=ranked.nearby;

  if(airportsOnly){
    // Immediate locally indexed result. Does not wait on map providers.
    const nearbySigiriya=distance(lat,lon,7.9498,80.7463)<=25;
    const giu=nearbySigiriya?[{type:'airport',name:'Sigiriya Airport',iata:'GIU',
      distanceKm:distance(lat,lon,7.95732,80.72915),
      latitude:7.95732,longitude:80.72915,
      source:'OpenStreetMap airport reference · 2026-10-14',
      url:'https://www.openstreetmap.org/way/297310393',price:null}]:[];
    const used=new Set();
    const airports=[...giu,...indexed].sort((a,b)=>a.distanceKm-b.distanceKm)
      .filter(x=>{if(used.has(x.iata))return false;used.add(x.iata);return true}).slice(0,8);
    return {status:200,body:{ok:true,provider:'Bundled OurAirports reference',
      sourceUrl:'https://ourairports.com/data/',partial:true,airports,hotels:[],
      intelligence:destinationIntelligence({lat,lon,countryCode,airports,gateways:ranked.gateways,
        hotels:[],partial:true}),
      note:'Airport names and straight-line distances only; no operating routes or fares are verified.'}};
  }

  // Airport geography is already indexed locally. Only ask the community map
  // for named hotel references within a practical geographic radius.
  const query=`[out:json][timeout:8];(nwr(around:25000,${lat},${lon})["tourism"="hotel"]["name"];);out center tags 90;`;
  const queryMap=async()=>{
    try{
      const response=await fetch('https://overpass-api.de/api/interpreter',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Wayfarer/1.0'},
        body:new URLSearchParams({data:query}),
        signal:AbortSignal.timeout(2800)
      });
      if(!response.ok)return {mapped:[],mapAvailable:false};
      const payload=await response.json();
      if(!Array.isArray(payload.elements))return {mapped:[],mapAvailable:false};
      const mapped=payload.elements.slice(0,220).map(x=>{
        const plat=x.lat??x.center?.lat,plon=x.lon??x.center?.lon;
        if(!Number.isFinite(plat)||!Number.isFinite(plon))return null;
        const type=x.tags?.tourism==='hotel'?'hotel':'airport';
        const name=clean(x.tags?.name||x.tags?.['name:en']);
        if(!name)return null;
        const iata=clean(x.tags?.iata,3).toUpperCase();
        if(type==='airport'&&!/^[A-Z]{3}$/.test(iata))return null;
        return {
          type,name,iata:type==='airport'?iata:'',latitude:plat,longitude:plon,
          distanceKm:distance(lat,lon,plat,plon),
          source:'OpenStreetMap contributors',
          url:`https://www.openstreetmap.org/${x.type}/${x.id}`,
          price:null
        };
      }).filter(Boolean);
      return {mapped,mapAvailable:true};
    }catch{return {mapped:[],mapAvailable:false};}
  };
  const sourceResult=await gatherPublicHotels(queryMap,
    ()=>lookupWikidataHotels(lat,lon),{hedgeMs:850});
  const {mapped,mapAvailable,wikidataHotels,wikidataAvailable}=sourceResult;
  const uniq=(entries,limit)=>{
    const names=new Set(),codes=new Set();
    return entries.filter(a=>{
      const key=a.name.toLocaleLowerCase('en').replace(/\s+/g,' ').trim();
      if(names.has(key)||(a.iata&&codes.has(a.iata)))return false;
      names.add(key);if(a.iata)codes.add(a.iata);return true;
    }).slice(0,limit);
  };
  const nearbySigiriya=distance(lat,lon,7.9498,80.7463)<=25;
  // GIU/VCCS is recorded as an aerodrome by Sri Lanka's aeronautical
  // information publication. Showing it does not imply scheduled flights.
  const regionalAerodromes=nearbySigiriya?[{
    type:'airport',name:'Sigiriya Airport',iata:'GIU',
    distanceKm:distance(lat,lon,7.95732,80.72915),
    latitude:7.95732,longitude:80.72915,
    source:'OpenStreetMap airport reference · 2026-10-14',
    url:'https://www.openstreetmap.org/way/297310393',price:null
  }]:[];
  const airports=uniq([...mapped.filter(a=>a.type==='airport'),...regionalAerodromes,...indexed]
    .sort((a,b)=>a.distanceKm-b.distanceKm),8);
  const referenceHotels=nearbySigiriya?sigiriyaHotelReferences.map(h=>({
    type:'hotel',name:h.name,iata:'',latitude:h.lat,longitude:h.lon,
    distanceKm:distance(lat,lon,h.lat,h.lon),
    source:'OpenStreetMap reference snapshot · 2026-10-14',url:h.url,price:null
  })).filter(h=>h.distanceKm<=35):[];
  const hotels=uniq([...mapped.filter(a=>a.type==='hotel'),...wikidataHotels,...referenceHotels]
    .sort((a,b)=>a.distanceKm-b.distanceKm),10);
  return {status:200,body:{
    ok:true,provider:'OpenStreetMap and bundled OurAirports reference data',
    sourceUrl:'https://www.openstreetmap.org/copyright',
    mapAvailable,wikidataAvailable,airports,hotels,
    intelligence:destinationIntelligence({lat,lon,countryCode,airports,gateways:ranked.gateways,
      hotels,mapAvailable,wikidataAvailable}),
    note:mapAvailable?'OpenStreetMap locations and approximate straight-line distances; no fare or room prices supplied.':
      wikidataAvailable?'Public OpenStreetMap lookup unavailable. Where covered, named hotels come from CC0 Wikidata references; no room rates or availability verified.':
      'Public nearby-place providers unavailable. Airport and geographically bounded reference records may still be shown; no room rates verified.'
  }};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=3600');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const mode=req.query.mode;
    let result;
    if(mode==='airports')result=await nearby(req,{airportsOnly:true});
    else if(mode==='nearby'){
      // Only public destination coordinates/ISO code enter this memory cache.
      // No itinerary, authorization header, booking search or guest dates.
      const lat=number(req.query.lat,-90,90),lon=number(req.query.lon,-180,180);
      const code=clean(req.query.countryCode||'',2).toUpperCase();
      const key=lat===null||lon===null?'invalid':lat.toFixed(5)+','+lon.toFixed(5)+'|'+code;
      result=key==='invalid'?await nearby(req):
        await cachedPublicNearby(key,()=>nearby(req));
    }else result=await search(req);
    return res.status(result.status).json(result.body);
  }catch(e){return res.status(502).json({ok:false,error:e.message||'Discovery provider unavailable'})}
}
