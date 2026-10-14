import airportData from '../data.json' with {type:'json'};
const timedFetch=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(12000)});
const clean=(value,max=120)=>String(value??'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,max);
const number=(value,min,max)=>{const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null};
const distance=(a,b,c,d)=>{const r=6371,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p;const h=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return Math.round(6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))*10)/10};

async function search(req){
  const q=clean(req.query.q,80),countryCode=clean(req.query.countryCode,2).toUpperCase(),countryName=clean(req.query.countryName,80);
  if(q.length<2)return {status:400,body:{ok:false,error:'Enter at least two characters'}};
  const r=await timedFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/\s+/g,'_'))}`,{headers:{'User-Agent':'Wayfarer/1.0'}});
  if(!r.ok)throw Error('Destination search unavailable');
  const d=await r.json(),coord=d.coordinates,results=Number.isFinite(coord?.lat)&&Number.isFinite(coord?.lon)?[{id:d.pageid||d.title,name:clean(d.title||q),admin:clean(d.description),country:countryCode?countryName:'',countryCode,latitude:coord.lat,longitude:coord.lon,timezone:''}]:[];
  return {status:200,body:{ok:true,provider:'Wikipedia place index',sourceUrl:'https://www.mediawiki.org/wiki/API:Search',results}};
}

async function nearby(req){
  const lat=number(req.query.lat,-90,90),lon=number(req.query.lon,-180,180);
  if(lat===null||lon===null)return {status:400,body:{ok:false,error:'Invalid coordinates'}};

  // Always provide sourced airport reference names, even if Overpass is rate limited.
  // The bundled OurAirports-based file is an airport index, not flight availability.
  const indexed=(Array.isArray(airportData.airports)?airportData.airports:[])
    .filter(a=>Number.isFinite(a.lat)&&Number.isFinite(a.lon)&&/^[A-Z]{3}$/.test(a.iata||''))
    .map(a=>({
      type:'airport',name:clean(a.name),iata:a.iata,
      distanceKm:distance(lat,lon,a.lat,a.lon),source:'OurAirports reference',
      url:/^https:\/\/ourairports\.com\/airports\//.test(a.source||'')?a.source:'https://ourairports.com',
      price:null
    })).filter(a=>a.name&&a.distanceKm<=280).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,10);

  const query=`[out:json][timeout:12];(nwr(around:35000,${lat},${lon})["tourism"="hotel"]["name"];nwr(around:140000,${lat},${lon})["aeroway"="aerodrome"]["iata"];);out center tags 160;`;
  let mapped=[],mapAvailable=false;
  for(const host of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){
    try{
      const r=await fetch(host,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Wayfarer/1.0'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(8500)});
      if(!r.ok)continue;
      const d=await r.json();
      if(!Array.isArray(d.elements))continue;
      mapped=d.elements.map(x=>{
        const plat=x.lat??x.center?.lat,plon=x.lon??x.center?.lon;
        if(!Number.isFinite(plat)||!Number.isFinite(plon))return null;
        const type=x.tags?.tourism==='hotel'?'hotel':'airport';
        const name=clean(x.tags?.name||x.tags?.['name:en']);
        if(!name)return null;
        const iata=clean(x.tags?.iata,3).toUpperCase();
        if(type==='airport'&&!/^[A-Z]{3}$/.test(iata))return null;
        return {
          type,name,iata:type==='airport'?iata:'',
          distanceKm:distance(lat,lon,plat,plon),
          source:'OpenStreetMap contributors',
          url:`https://www.openstreetmap.org/${x.type}/${x.id}`,
          price:null
        };
      }).filter(Boolean);
      mapAvailable=true;break;
    }catch{/* A public map endpoint is unavailable; retain the local airport reference. */}
  }
  const uniq=(entries,limit)=>{
    const names=new Set(),codes=new Set();
    return entries.filter(a=>{
      const key=a.name.toLocaleLowerCase('en').replace(/\s+/g,' ').trim();
      if(names.has(key)||(a.iata&&codes.has(a.iata)))return false;
      names.add(key);if(a.iata)codes.add(a.iata);return true;
    }).slice(0,limit);
  };
  const airports=uniq([...mapped.filter(a=>a.type==='airport'),...indexed]
    .sort((a,b)=>a.distanceKm-b.distanceKm),8);
  const hotels=uniq(mapped.filter(a=>a.type==='hotel')
    .sort((a,b)=>a.distanceKm-b.distanceKm),10);
  return {status:200,body:{
    ok:true,provider:'OpenStreetMap and bundled OurAirports reference data',
    sourceUrl:'https://www.openstreetmap.org/copyright',
    mapAvailable,airports,hotels,
    note:mapAvailable?'Locations and straight-line distances only; no fare or room prices supplied.':
      'OpenStreetMap nearby service unavailable. Airport reference names may still be shown; hotels and prices are not inferred.'
  }};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=3600');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
  try{const result=req.query.mode==='nearby'?await nearby(req):await search(req);return res.status(result.status).json(result.body)}catch(e){return res.status(502).json({ok:false,error:e.message||'Discovery provider unavailable'})}
}
