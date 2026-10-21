const timedFetch=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(12000)});
const clean=(value,max=120)=>String(value??'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,max);
// OSM website tags are community-provided and must not become script/data URLs.
const safePublicUrl=(raw,fallback)=>{
  if(typeof raw!=='string'||raw.length>500)return fallback;
  try{
    const url=new URL(raw.trim());
    return (url.protocol==='https:'||url.protocol==='http:')&&!url.username&&!url.password?url.href:fallback;
  }catch{return fallback;}
};
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
  const query=`[out:json][timeout:18];(nwr(around:35000,${lat},${lon})["tourism"="hotel"];nwr(around:120000,${lat},${lon})["aeroway"="aerodrome"]["iata"];);out center tags 100;`;
  const r=await timedFetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Wayfarer/1.0'},body:new URLSearchParams({data:query})});
  if(!r.ok)throw Error('Nearby discovery unavailable');
  const d=await r.json(),items=(d.elements||[]).map(x=>{const p={lat:x.lat??x.center?.lat,lon:x.lon??x.center?.lon};if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return null;const type=x.tags?.tourism==='hotel'?'hotel':'airport',name=clean(x.tags?.name||x.tags?.['name:en']||(type==='hotel'?'Mapped hotel':'Mapped airport'));return {type,name,iata:clean(x.tags?.iata,4),distanceKm:distance(lat,lon,p.lat,p.lon),url:safePublicUrl(x.tags?.website,`https://www.openstreetmap.org/${x.type}/${x.id}`)}}).filter(Boolean);
  const uniq=(type,limit)=>{const seen=new Set();return items.filter(x=>x.type===type).sort((a,b)=>a.distanceKm-b.distanceKm).filter(x=>{const k=x.name.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,limit)};
  return {status:200,body:{ok:true,provider:'OpenStreetMap contributors via Overpass',sourceUrl:'https://www.openstreetmap.org/copyright',airports:uniq('airport',10),hotels:uniq('hotel',14)}};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=3600');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
  try{const result=req.query.mode==='nearby'?await nearby(req):await search(req);return res.status(result.status).json(result.body)}catch(e){return res.status(502).json({ok:false,error:e.message||'Discovery provider unavailable'})}
}
