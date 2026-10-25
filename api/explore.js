// Best-effort defense in depth for free public discovery. Serverless instances do
// NOT share this counter: enforce distributed quotas at the edge before scaling.
const WINDOW_MS=60_000, MAX_REQUESTS=20, MAX_KEYS=500;
const requests=new Map();
function tooMany(req){
  // Vercel overwrites x-forwarded-for and provides x-vercel-forwarded-for as
  // the client address. Accept that header only within the Vercel runtime;
  // direct/local requests use their transport peer instead.
  const platformIp=process.env.VERCEL==='1'?req.headers?.['x-vercel-forwarded-for']:null;
  const safeIp=typeof platformIp==='string'&&/^[a-f\d:.]{3,45}$/i.test(platformIp)?platformIp:null;
  const peer=String(safeIp||req.socket?.remoteAddress||req.connection?.remoteAddress||'shared-edge').slice(0,90);
  const now=Date.now();
  const entry=requests.get(peer);
  const fresh=entry&&now-entry.start<WINDOW_MS;
  const count=fresh?entry.count+1:1;
  requests.delete(peer);
  requests.set(peer,{start:fresh?entry.start:now,count});
  if(requests.size>MAX_KEYS)requests.delete(requests.keys().next().value);
  return count>MAX_REQUESTS;
}
const MAX_JSON_BYTES=1_500_000;
async function timedJson(url,options={}){
  // Reject redirects and oversized responses before parsing third-party JSON.
  const res=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error('Discovery provider unavailable');
  const announced=Number(res.headers?.get('content-length'));
  if(Number.isFinite(announced)&&announced>MAX_JSON_BYTES)throw Error('Discovery response exceeded size limit');
  const reader=res.body?.getReader?.();
  if(!reader){const raw=await res.text();if(Buffer.byteLength(raw)>MAX_JSON_BYTES)throw Error('Discovery response exceeded size limit');return JSON.parse(raw);}
  let total=0;const chunks=[];
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;
      if(total>MAX_JSON_BYTES)throw Error('Discovery response exceeded size limit');
      chunks.push(value);
    }
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const clean=(value,max=120)=>String(value??'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,max);
// OSM website tags are community-provided and must not become script/data URLs.
const safePublicUrl=(raw,fallback)=>{
  if(typeof raw!=='string'||raw.length>500)return fallback;
  try{
    const url=new URL(raw.trim());
    return (url.protocol==='https:'||url.protocol==='http:')&&!url.username&&!url.password?url.href:fallback;
  }catch{return fallback;}
};
const number=(value,min,max)=>{if(typeof value!=='number'&&typeof value!=='string')return null;const text=String(value).trim();if(!text||text.length>30||!/^[-+]?(?:[0-9]+(?:[.][0-9]*)?|[.][0-9]+)(?:[eE][-+]?[0-9]+)?$/.test(text))return null;const n=Number(text);return Number.isFinite(n)&&n>=min&&n<=max?n:null};
const distance=(a,b,c,d)=>{const r=6371,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p;const h=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return Math.round(6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))*10)/10};

async function search(req){
  const q=clean(req.query.q,80),countryCode=clean(req.query.countryCode,2).toUpperCase(),countryName=clean(req.query.countryName,80);
  if(q.length<2)return {status:400,body:{ok:false,error:'Enter at least two characters'}};
  const d=await timedJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/\s+/g,'_'))}`,{headers:{'User-Agent':'Wayfarer/1.0'}}),coord=d.coordinates,results=Number.isFinite(coord?.lat)&&Number.isFinite(coord?.lon)?[{id:d.pageid||d.title,name:clean(d.title||q),admin:clean(d.description),country:countryCode?countryName:'',countryCode,latitude:coord.lat,longitude:coord.lon,timezone:''}]:[];
  return {status:200,body:{ok:true,provider:'Wikipedia place index',sourceUrl:'https://www.mediawiki.org/wiki/API:Search',results}};
}

async function nearby(req){
  const lat=number(req.query.lat,-90,90),lon=number(req.query.lon,-180,180);
  if(lat===null||lon===null)return {status:400,body:{ok:false,error:'Invalid coordinates'}};
  const query=`[out:json][timeout:18];(nwr(around:35000,${lat},${lon})["tourism"="hotel"];nwr(around:120000,${lat},${lon})["aeroway"="aerodrome"]["iata"];);out center tags 100;`;
  const d=await timedJson('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Wayfarer/1.0'},body:new URLSearchParams({data:query})}),items=(d.elements||[]).map(x=>{const p={lat:x.lat??x.center?.lat,lon:x.lon??x.center?.lon};if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return null;const type=x.tags?.tourism==='hotel'?'hotel':'airport',name=clean(x.tags?.name||x.tags?.['name:en']||(type==='hotel'?'Mapped hotel':'Mapped airport'));return {type,name,iata:clean(x.tags?.iata,4),distanceKm:distance(lat,lon,p.lat,p.lon),url:safePublicUrl(x.tags?.website,`https://www.openstreetmap.org/${x.type}/${x.id}`)}}).filter(Boolean);
  const uniq=(type,limit)=>{const seen=new Set();return items.filter(x=>x.type===type).sort((a,b)=>a.distanceKm-b.distanceKm).filter(x=>{const k=x.name.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,limit)};
  return {status:200,body:{ok:true,provider:'OpenStreetMap contributors via Overpass',sourceUrl:'https://www.openstreetmap.org/copyright',airports:uniq('airport',10),hotels:uniq('hotel',14)}};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=3600');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(tooMany(req)){res.setHeader('Retry-After','60');res.setHeader('Cache-Control','no-store');return res.status(429).json({ok:false,error:'Discovery request limit reached. Please retry shortly.'});}
  try{const result=req.query.mode==='nearby'?await nearby(req):await search(req);return res.status(result.status).json(result.body)}catch{return res.status(502).json({ok:false,error:'Discovery provider unavailable. Please retry later.'})}
}
