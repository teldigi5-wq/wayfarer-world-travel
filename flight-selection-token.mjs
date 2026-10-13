import {createHmac,timingSafeEqual} from 'node:crypto';

// Provider tokens never become request query parameters or trusted browser inputs.
// A short-lived HMAC envelope binds them to the searched route and click stage.
const MAX_TOKEN = 7000;
const TTL_MS = 8 * 60 * 1000;
const rx = /^[A-Za-z0-9_.+=:/-]{1,7000}$/;
const iata = x => /^[A-Z]{3}$/.test(x || '');
const dateRx = /^\d{4}-\d{2}-\d{2}$/;
const rounds = ['return','booking'];
function mac(body,secret){
  return createHmac('sha256',String(secret)).update('wayfarer-flight-v1:').update(body).digest('base64url');
}
function valid(o){
  return !!o && typeof o==='object' && rounds.includes(o.stage) &&
    typeof o.providerToken==='string' && o.providerToken.length<=MAX_TOKEN &&
    rx.test(o.providerToken) && iata(o.from) && iata(o.to) &&
    dateRx.test(o.outbound) && dateRx.test(o.returnDate) &&
    Number.isInteger(o.adults) && o.adults>=1 && o.adults<=9;
}
export function signSelection(stage,providerToken,trip,secret,now=Date.now()){
  if(typeof secret!=='string'||secret.length<24)return null;
  const payload={stage,providerToken,from:trip.from,to:trip.to,
    outbound:trip.checkIn,returnDate:trip.checkOut,adults:trip.adults,
    expiresAt:now+TTL_MS};
  if(!valid(payload))return null;
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body+'.'+mac(body,secret);
}
export function verifySelection(envelope,secret,now=Date.now()){
  if(typeof envelope!=='string'||envelope.length>10000||
     typeof secret!=='string'||secret.length<24)return null;
  const parts=envelope.split('.');
  if(parts.length!==2||!parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x)))return null;
  const provided=Buffer.from(parts[1],'utf8'),expected=Buffer.from(mac(parts[0],secret),'utf8');
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return null;
  let obj;
  try{obj=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'))}catch{return null}
  if(!valid(obj)||!Number.isFinite(obj.expiresAt)||obj.expiresAt<now||
     obj.expiresAt>now+TTL_MS)return null;
  return obj;
}
