/* Worldwide name-only hotel discovery fallback.
   Wikidata CC0 hotel entities (P31/subclass hotel), never inventory, prices,
   rooms, reviews or booking promises. No credentials or paid provider calls. */
const matchCoord=point=>{
  const match=/^Point\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/.exec(String(point||''));
  if(!match)return null;
  const lon=Number(match[1]),lat=Number(match[2]);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon}:null;
};
const round=value=>Math.round(value*1e5)/1e5;
const degrees=Math.PI/180;
const km=(a,b,c,d)=>{
  const deltaLat=(c-a)*degrees,deltaLon=(d-b)*degrees;
  const x=Math.sin(deltaLat/2)**2+Math.cos(a*degrees)*Math.cos(c*degrees)*Math.sin(deltaLon/2)**2;
  return Math.round(6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))*10)/10;
};
const cache=new Map(),TTL_MS=24*60*60*1000,MAX_CACHE=100;
export function wikidataHotelQuery(lat,lon){
  // Numeric bounds and WKT generated server-side, not interpolated from raw text.
  if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)
    throw Error('Invalid location');
  return `SELECT DISTINCT ?place ?placeLabel ?location WHERE {
    SERVICE wikibase:around {
      ?place wdt:P625 ?location .
      bd:serviceParam wikibase:center "Point(${round(lon)} ${round(lat)})"^^geo:wktLiteral .
      bd:serviceParam wikibase:radius "25" .
    }
    ?place wdt:P31/wdt:P279* wd:Q27686 .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
  } LIMIT 35`;
}
export function parseWikidataHotels(payload,lat,lon){
  if(!Array.isArray(payload?.results?.bindings))return [];
  const seen=new Set(),entries=[];
  for(const row of payload.results.bindings.slice(0,50)){
    const id=/^https:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/.exec(row.place?.value||'')?.[1];
    const name=String(row.placeLabel?.value||'').trim().slice(0,120);
    const at=matchCoord(row.location?.value);
    if(!id||!name||/^Q\d+$/.test(name)||!at)continue;
    const distanceKm=km(lat,lon,at.lat,at.lon);
    if(distanceKm>35)continue;
    const key=name.toLocaleLowerCase('en').normalize('NFKD');
    if(seen.has(key))continue;
    seen.add(key);
    entries.push({type:'hotel',name,iata:'',distanceKm,
      source:'Wikidata hotel reference · CC0',
      url:'https://www.wikidata.org/wiki/'+id,price:null});
  }
  return entries.sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,12);
}
export async function lookupWikidataHotels(lat,lon,{fetchFn=fetch,now=Date.now()}={}){
  const key=round(lat)+','+round(lon),old=cache.get(key);
  if(old&&old.until>now)return old.hotels.map(x=>({...x}));
  const query=wikidataHotelQuery(lat,lon);
  const url='https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(query);
  const response=await fetchFn(url,{
    headers:{'Accept':'application/sparql-results+json','User-Agent':'WayfarerTravelResearch/1.0 (public CC0 hotel reference, best-effort)'},
    signal:AbortSignal.timeout(5500)
  });
  if(!response.ok)throw Error('Wikidata lookup unavailable');
  const hotels=parseWikidataHotels(await response.json(),lat,lon);
  if(cache.size>=MAX_CACHE)cache.delete(cache.keys().next().value);
  // Empty results are cached too: avoid repeatedly querying a public service.
  cache.set(key,{until:now+TTL_MS,hotels});
  return hotels.map(x=>({...x}));
}
