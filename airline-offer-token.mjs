import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

// Only a server-made encrypted envelope can select an airline offer for refresh.
// Never accept an arbitrary supplier offer ID or an API token from the browser.
const AAD=Buffer.from('wayfarer-airline-offer-v1');
const VERSION='wf-air1';
const TTL_MS=12*60*1000;
const key=secret=>typeof secret==='string'&&secret.length>=24?
  createHash('sha256').update('wayfarer-airline-offer-token:').update(secret).digest():null;
const valid=x=>x&&typeof x==='object'&&
  /^off_[A-Za-z0-9]{5,100}$/.test(x.offerId||'')&&
  /^(test|live)$/.test(x.mode||'')&&
  /^[A-Z]{3}$/.test(x.from||'')&&/^[A-Z]{3}$/.test(x.to||'')&&
  /^\d{4}-\d{2}-\d{2}$/.test(x.outbound||'')&&
  /^\d{4}-\d{2}-\d{2}$/.test(x.returnDate||'')&&
  Number.isInteger(x.adults)&&x.adults>=1&&x.adults<=9;
export function sealAirlineOffer(offerId,mode,trip,secret,now=Date.now()){
  const k=key(secret);if(!k)return null;
  const obj={offerId,mode,from:trip.from,to:trip.to,
    outbound:trip.checkIn,returnDate:trip.checkOut,adults:trip.adults,
    expiresAt:now+TTL_MS};
  if(!valid(obj))return null;
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',k,iv);
  cipher.setAAD(AAD);
  const enc=Buffer.concat([cipher.update(JSON.stringify(obj),'utf8'),cipher.final()]);
  return [VERSION,iv.toString('base64url'),enc.toString('base64url'),
    cipher.getAuthTag().toString('base64url')].join('.');
}
export function openAirlineOffer(token,secret,now=Date.now()){
  const k=key(secret);
  if(!k||typeof token!=='string'||token.length>2000)return null;
  const parts=token.split('.');
  if(parts.length!==4||parts[0]!==VERSION||
     parts.slice(1).some(x=>!/^[A-Za-z0-9_-]+$/.test(x)))return null;
  try{
    const iv=Buffer.from(parts[1],'base64url'),tag=Buffer.from(parts[3],'base64url');
    const cipherText=Buffer.from(parts[2],'base64url');
    if(iv.length!==12||tag.length!==16||cipherText.length>1024||
      iv.toString('base64url')!==parts[1]||cipherText.toString('base64url')!==parts[2]||
      tag.toString('base64url')!==parts[3])return null;
    const decipher=createDecipheriv('aes-256-gcm',k,iv);
    decipher.setAAD(AAD);decipher.setAuthTag(tag);
    const obj=JSON.parse(Buffer.concat([decipher.update(cipherText),decipher.final()]).toString('utf8'));
    return valid(obj)&&Number.isFinite(obj.expiresAt)&&obj.expiresAt>=now&&obj.expiresAt<=now+TTL_MS?obj:null;
  }catch{return null}
}
