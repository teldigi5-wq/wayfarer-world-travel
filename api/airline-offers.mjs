import {timingSafeEqual} from 'node:crypto';
import {readBoundedText} from '../bounded-source-response.mjs';
import {meteredProviderLocked,PRODUCTION_PROVIDER_LOCK_NOTE} from '../provider-production-lock.mjs';
import {sealAirlineOffer,openAirlineOffer} from '../airline-offer-token.mjs';
import {verifiedSegmentRoute} from '../flight-route-integrity.mjs';

// Optional airline offer adapter. Completely disabled without opt-in credentials.
// Uses Duffel's developer sandbox by default; never creates orders or payments.
const ROOT='https://api.duffel.com/air/';
const SEARCH_TIMEOUT=14500;
const RESPONSE_LIMIT=1600000;
const BODY_LIMIT=3500;
const counters=new Map();
const today=()=>new Date().toISOString().slice(0,10);
const clean=(s,n=150)=>String(s??'').replace(/[\x00-\x1f<>]/g,' ').trim().slice(0,n);
const iata=x=>/^[A-Z]{3}$/.test(x||'');
const dateRx=/^\d{4}-\d{2}-\d{2}$/;
const money=x=>(typeof x==='string'||typeof x==='number')&&
  Number.isFinite(Number(x))&&Number(x)>0&&Number(x)<10000000;
const fmt=n=>(Math.round(Number(n)*100)/100).toFixed(2);
function equal(a,b){
  const l=Buffer.from(String(a||'')),r=Buffer.from(String(b||''));
  return r.length>=24&&l.length===r.length&&timingSafeEqual(l,r);
}
function send(res,status,obj){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(obj);
}
function tripFrom(raw) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('trip');
  const t={from:clean(raw.from,12).toUpperCase(),to:clean(raw.to,12).toUpperCase(),
    checkIn:clean(raw.checkIn,16),checkOut:clean(raw.checkOut,16),
    adults:Number(raw.adults)};
  const isDate=x=>dateRx.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&
    new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
  if(!iata(t.from)||!iata(t.to)||t.from===t.to||!isDate(t.checkIn)||!isDate(t.checkOut)||
     t.checkIn<today()||t.checkOut<=t.checkIn||
     (Date.parse(t.checkOut+'T00:00:00Z')-Date.parse(t.checkIn+'T00:00:00Z'))>31*86400000||
     !Number.isInteger(t.adults)||t.adults<1||t.adults>9)throw Error('trip');
  return t;
}
function gated(req){
  // Instance-local safety only. A durable per-user quota remains required to launch publicly.
  const ip=clean(String(req.headers?.['x-forwarded-for']||'beta').split(',')[0],75);
  const now=Date.now();
  const prior=(counters.get(ip)||[]).filter(x=>now-x<3600000);
  if(prior.length>=4)return true;
  prior.push(now);counters.set(ip,prior);
  if(counters.size>500)for(const [k,v] of counters)if(now-v.at(-1)>3600000)counters.delete(k);
  return false;
}
function config(){
  const key=process.env.DUFFEL_ACCESS_TOKEN||'';
  const mode=process.env.DUFFEL_MODE==='live'?'live':'test';
  const enabled=process.env.WAYFARER_DUFFEL_ENABLED==='true';
  if(!enabled||!key)return null;
  if(mode==='test'&&!key.startsWith('duffel_test_'))return null;
  // Live cannot be switched on by accidentally adding the token alone.
  if(mode==='live'&&(!key.startsWith('duffel_live_')||
     process.env.WAYFARER_DUFFEL_LIVE_APPROVED!=='true'))return null;
  return {key,mode};
}
async function callDuffel(method,path,key,body){
  const url=new URL(path,ROOT);
  if(url.origin!=='https://api.duffel.com')throw Error('Invalid provider route');
  const opts={method,headers:{Authorization:'Bearer '+key,
    'Duffel-Version':'v2','Accept':'application/json',
    ...(body?{'Content-Type':'application/json'}:{})},
    signal:AbortSignal.timeout(SEARCH_TIMEOUT),redirect:'error'};
  if(body)opts.body=JSON.stringify({data:body});
  const response=await fetch(url,opts);
  if(response.status===429){const e=Error('quota');e.quota=true;throw e}
  const raw=await readBoundedText(response,RESPONSE_LIMIT);
  let json;try{json=JSON.parse(raw)}catch{throw Error('Malformed supplier response')}
  if(!response.ok){
    const str=JSON.stringify(json?.errors||[]);
    const e=Error('Supplier offer unavailable');
    e.expired=response.status===410||/offer_no_longer_available|expired/i.test(str);
    throw e;
  }
  return json?.data;
}
function normalizeOffer(raw,t,config,secret,checkedAt){
  if(!raw||raw.partial===true||!/^off_[A-Za-z0-9]{5,100}$/.test(raw.id||'')||
     !money(raw.total_amount)||!/^[A-Z]{3}$/.test(raw.total_currency||'')||
     !Array.isArray(raw.slices)||raw.slices.length!==2)return null;
  const expiry=Date.parse(raw.expires_at);
  if(!Number.isFinite(expiry)||expiry<=Date.now())return null;
  // Reject provider/test-mode mismatches to avoid labeling sandbox prices live.
  if(raw.live_mode!==(config.mode==='live'))return null;
  // A priced round trip must contain two COMPLETE, connected provider
  // slices. Dropping malformed legs before display would falsely imply a
  // viable journey; reject the whole supplier offer instead.
  if(raw.slices.some(slice=>!slice||!Array.isArray(slice.segments)||
    slice.segments.length<1||slice.segments.length>6||
    slice.segments.some(seg=>!seg||typeof seg!=='object')))return null;
  const slices=raw.slices.map(slice=>({
    segments:slice.segments.map(seg=>({
      operatingCarrier:clean(seg.operating_carrier?.name||'Not supplied',80),
      flightNumber:clean(seg.operating_carrier_flight_number,12),
      from:clean(seg.origin?.iata_code,3),to:clean(seg.destination?.iata_code,3),
      departingAt:clean(seg.departing_at,35),arrivingAt:clean(seg.arriving_at,35)
    }))
  }));
  if(!verifiedSegmentRoute(slices[0].segments,t.from,t.to)||
     !verifiedSegmentRoute(slices[1].segments,t.to,t.from))return null;
  const encrypted=sealAirlineOffer(raw.id,config.mode,t,secret);
  return {source:'Duffel airline offer',mode:config.mode,
    label:config.mode==='test'?'SANDBOX — NOT REAL TICKETS':'LIVE SUPPLIER OFFER — NOT RESERVED',
    operatingCarrier:clean(raw.owner?.name,100),
    totalAmount:fmt(raw.total_amount),currency:raw.total_currency,
    priceBasis:'Supplier offer total for all listed adult passengers, before unselected extras',
    expiresAt:raw.expires_at,checkedAt,
    slices,availabilityStatus:config.mode==='test'?'sandbox_offer':'supplier_offer_unbooked',
    seatCountVerified:false,bookingConfirmed:false,
    refreshToken:encrypted};
}
export default async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{ok:false,error:'POST required'});}
  const secret=process.env.WAYFARER_AI_BETA_TOKEN;
  if(!equal(req.headers?.['x-wayfarer-beta-token'],secret))
    return send(res,401,{ok:false,error:'Private beta access code required.'});
  let body;
  try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||Array.isArray(body)||typeof body!=='object'||
      Buffer.byteLength(JSON.stringify(body))>BODY_LIMIT)throw Error('Invalid body');
  }catch{return send(res,400,{ok:false,error:'Invalid airline offer request.'});}
  const action=body.action;
  if(action!=='search'&&action!=='refresh')
    return send(res,400,{ok:false,error:'Invalid offer action.'});
  let trip,reference;
  try{
    if(action==='search')trip=tripFrom(body.trip);
    else {
      reference=openAirlineOffer(body.refreshToken,secret);
      if(!reference)throw Error('invalid');
      trip={from:reference.from,to:reference.to,checkIn:reference.outbound,
        checkOut:reference.returnDate,adults:reference.adults};
    }
  }catch{return send(res,400,{ok:false,error:'Trip or offer reference is expired or invalid.'});}
  if(meteredProviderLocked())
    return send(res,200,{ok:true,status:'not_connected',mode:'production_locked',
      checkedAt:null,message:PRODUCTION_PROVIDER_LOCK_NOTE,offers:[]});
  const settings=config();
  if(!settings|| (reference&&reference.mode!==settings.mode)){
    return send(res,200,{ok:true,status:'not_connected',mode:'disabled',checkedAt:null,
      message:'Airline-authorized offers are not configured for this beta. Google Travel price research remains separate.',
      offers:[]});
  }
  if(gated(req))return send(res,429,{ok:false,error:'Airline offer check limit reached. Please try later.'});
  const checkedAt=new Date().toISOString();
  try{
    if(action==='search'){
      const passengers=Array.from({length:trip.adults},()=>({type:'adult'}));
      const slices=[{origin:trip.from,destination:trip.to,departure_date:trip.checkIn},
        {origin:trip.to,destination:trip.from,departure_date:trip.checkOut}];
      const request=await callDuffel('POST','offer_requests?return_offers=true&supplier_timeout=8000',
        settings.key,{slices,passengers,cabin_class:'economy'});
      const offered=(Array.isArray(request?.offers)?request.offers:[])
        .slice(0,16).map(o=>normalizeOffer(o,trip,settings,secret,checkedAt)).filter(Boolean)
        .sort((a,b)=>Number(a.totalAmount)-Number(b.totalAmount)).slice(0,5);
      return send(res,200,{ok:true,status:offered.length?
        (settings.mode==='test'?'sandbox_results':'supplier_offers'):'no_results',
        mode:settings.mode,checkedAt,offers:offered,
        message:settings.mode==='test'?
          'Duffel sandbox offers are for integration testing only—not real tickets or availability.' :
          offered.length?
            'Airline supplier offers were returned; recheck a specific offer before considering payment. No seat reserved.':
            'No supplier offers returned for this route. This is not proof flights are sold out.'});
    }
    const offer=await callDuffel('GET','offers/'+encodeURIComponent(reference.offerId),
      settings.key);
    const normalized=normalizeOffer(offer,trip,settings,secret,checkedAt);
    return send(res,200,{ok:true,status:normalized?
      (settings.mode==='test'?'sandbox_refreshed':'offer_refreshed'):'expired_or_changed',
      mode:settings.mode,checkedAt,offers:normalized?[normalized]:[],
      message:settings.mode==='test'?
        'Sandbox offer refreshed successfully. Not real bookable airline inventory.':
        normalized?'Supplier offer refreshed at this time; fare may still change or sell out before order creation. No booking made.':
          'Offer expired or changed. Start a new search; there is no availability confirmation.'});
  }catch(error){
    return send(res,error?.quota?429:502,{ok:false,
      status:error?.quota?'quota_exceeded':error?.expired?'expired':'unavailable',
      error:error?.quota?'Airline supplier rate limit reached.':
        error?.expired?'Offer is no longer available. Please search again.':
          'Airline supplier unavailable. No availability conclusion is possible.'});
  }
}
