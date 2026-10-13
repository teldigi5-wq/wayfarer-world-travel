import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

// Encrypted, authenticated selection envelopes. Browser cannot inspect or edit
// raw SerpApi provider tokens, traveler counts or itinerary details.
const MAX_TOKEN=7000;
const TTL_MS=8*60*1000;
const VERSION='wf2';
const AAD=Buffer.from('wayfarer-serpapi-selection-v2');
const rounds=['return','booking'];
const iata=value=>/^[A-Z]{3}$/.test(value||'');
const dateRx=/^\d{4}-\d{2}-\d{2}$/;
function key(secret) {
  if(typeof secret!=='string'||secret.length<24)return null;
  return createHash('sha256').update('wayfarer-flight-encryption-v2:').update(secret).digest();
}
function valid(o){
  return o && typeof o==='object' && rounds.includes(o.stage) &&
    typeof o.providerToken==='string' && o.providerToken.length>0 &&
    o.providerToken.length<=MAX_TOKEN && !/[\x00-\x1f]/.test(o.providerToken) &&
    iata(o.from)&&iata(o.to)&&dateRx.test(o.outbound)&&dateRx.test(o.returnDate) &&
    Number.isInteger(o.adults)&&o.adults>=1&&o.adults<=9;
}
export function signSelection(stage,providerToken,trip,secret,now=Date.now()){
  const encryptionKey=key(secret);
  if(!encryptionKey)return null;
  const payload={stage,providerToken,from:trip.from,to:trip.to,
    outbound:trip.checkIn,returnDate:trip.checkOut,adults:trip.adults,
    expiresAt:now+TTL_MS};
  if(!valid(payload))return null;
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',encryptionKey,iv);
  cipher.setAAD(AAD);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  return [VERSION,iv.toString('base64url'),ciphertext.toString('base64url'),
    cipher.getAuthTag().toString('base64url')].join('.');
}
export function verifySelection(envelope,secret,now=Date.now()){
  const encryptionKey=key(secret);
  if(!encryptionKey||typeof envelope!=='string'||envelope.length>13000)return null;
  const parts=envelope.split('.');
  if(parts.length!==4||parts[0]!==VERSION||
    !parts.slice(1).every(x=>/^[A-Za-z0-9_-]+$/.test(x)))return null;
  let payload;
  try {
    const iv=Buffer.from(parts[1],'base64url');
    const encrypted=Buffer.from(parts[2],'base64url');
    const tag=Buffer.from(parts[3],'base64url');
    if(iv.length!==12||tag.length!==16||encrypted.length>10000)return null;
    const decipher=createDecipheriv('aes-256-gcm',encryptionKey,iv);
    decipher.setAAD(AAD);decipher.setAuthTag(tag);
    payload=JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8'));
  }catch{return null}
  if(!valid(payload)||!Number.isFinite(payload.expiresAt)||
     payload.expiresAt<now||payload.expiresAt>now+TTL_MS)return null;
  return payload;
}
