import {timingSafeEqual} from 'node:crypto';
import {readBoundedText} from '../bounded-source-response.mjs';
import {meteredProviderLocked,PRODUCTION_PROVIDER_LOCK_NOTE} from '../provider-production-lock.mjs';
import {signSelection,verifySelection} from '../flight-selection-token.mjs';
import {verifiedSegmentRoute} from '../flight-route-integrity.mjs';

// Controlled extra supplier searches, never hidden/automatic. No booking or payment.
const BASE='https://serpapi.com/search.json';
const BODY_LIMIT=10500;
const MAX_PROVIDER_BODY=1800000;
const TIMEOUT_MS=11000;
const MAX_CHOICES=6;
const counts=new Map();
const text=(x,n=160)=>String(x??'').replace(/[\x00-\x1f<>]/g,' ').trim().slice(0,n);
const iata=x=>/^[A-Z]{3}$/.test(x||'');
const price=x=>(typeof x==='string'||typeof x==='number')&&Number.isFinite(Number(x))&&Number(x)>0&&Number(x)<1e8;
const money=x=>(Math.round(Number(x)*100)/100).toFixed(2);
const failure=(res,code,message)=>send(res,code,{ok:false,error:message});
function send(res,status,payload){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(payload);
}
function equal(a,b){
  const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
  return y.length>=24&&x.length===y.length&&timingSafeEqual(x,y);
}
function limited(req){
  const raw=String(req.headers?.['x-forwarded-for']||'').split(',')[0];
  const ip=raw.replace(/[^A-Za-z0-9.:_-]/g,'').slice(0,65)||'shared-preview';
  const now=Date.now();
  const history=(counts.get(ip)||[]).filter(x=>now-x<3600000);
  if(history.length>=6)return true;
  history.push(now);counts.set(ip,history);
  if(counts.size>300){for(const [key,val] of counts)if(now-val.at(-1)>3600000)counts.delete(key);}
  return false;
}
async function provider(state,key){
  const url=new URL(BASE);
  const fields={engine:'google_flights',departure_id:state.from,arrival_id:state.to,
    outbound_date:state.outbound,return_date:state.returnDate,adults:state.adults,
    travel_class:1,type:1,hl:'en',currency:'USD'};
  for(const [k,v] of Object.entries(fields))url.searchParams.set(k,String(v));
  url.searchParams.set(state.stage==='return'?'departure_token':'booking_token',state.providerToken);
  url.searchParams.set('api_key',key);
  const response=await fetch(url,{signal:AbortSignal.timeout(TIMEOUT_MS),redirect:'error'});
  if(response.status===429){const e=Error('Provider quota reached');e.quota=true;throw e;}
  if(!response.ok)throw Error('Supplier unavailable');
  const raw=await readBoundedText(response,MAX_PROVIDER_BODY);
  let data;
  try{data=JSON.parse(raw)}catch{throw Error('Provider response malformed');}
  if(data?.error||data?.search_metadata?.status==='Error'){
    const e=Error('Supplier search rejected');
    e.quota=/quota|credits|limit|searches/i.test(String(data.error||''));throw e;
  }
  return data;
}
function normalizeReturn(data,state,secret,checkedAt){
  const entries=[...(Array.isArray(data.best_flights)?data.best_flights:[]),
    ...(Array.isArray(data.other_flights)?data.other_flights:[])];
  const options=entries.slice(0,15).map(f=>{
    if(!price(f.price)||!Array.isArray(f.flights)||f.flights.length<1||f.flights.length>6||f.flights.some(x=>!x||typeof x!=='object'))return null;
    const segments=f.flights.slice(0,6).map(seg=>({
      airline:text(seg.airline,80),flightNumber:text(seg.flight_number,24),
      from:text(seg.departure_airport?.id,3),to:text(seg.arrival_airport?.id,3),
      departureAt:text(seg.departure_airport?.time,48),
      arrivalAt:text(seg.arrival_airport?.time,48)
    }));
    // Return segment must run from the originally requested destination
    // back to its origin, with no dropped or disconnected flight legs.
    if(!verifiedSegmentRoute(segments,state.to,state.from))return null;
    const token=signSelection('booking',f.booking_token,{from:state.from,to:state.to,checkIn:state.outbound,checkOut:state.returnDate,adults:state.adults},secret);
    return {segments,pricePerAdult:money(f.price),
      estimatedGroup:money(Number(f.price)*state.adults),currency:'USD',
      durationMinutes:Number.isFinite(f.total_duration)?f.total_duration:null,
      stopCount:Math.max(0,segments.length-1),
      selection:token?{stage:'booking',token}:null,
      ticketAvailability:'not_verified',seatsAvailable:null,
      checkedAt};
  }).filter(Boolean).sort((a,b)=>Number(a.estimatedGroup)-Number(b.estimatedGroup));
  return {ok:true,stage:'return_flights',checkedAt,
    message:options.length?
      'Return-flight search options found. Prices, selected outbound, booking sellers and seats must still be checked.' :
      'No route-consistent return choices returned by this search. This does not mean the route is sold out.',
    options:options.slice(0,MAX_CHOICES),
    limitations:['These are supplier search options, not confirmed tickets.',
      'Booking sellers require another explicit lookup and may use another search credit.']};
}
function normalizeBooking(data,checkedAt){
  const options=(Array.isArray(data.booking_options)?data.booking_options:[])
    .slice(0,14).flatMap(item=>{
      const separate=item?.separate_tickets===true;
      const departure=separate?item?.departing:null;
      const returning=separate?item?.returning:null;
      // Separate tickets need two actual seller prices before any combined
      // estimate may be shown; a departing-only quote is not a round-trip fare.
      const choice=separate?departure:item?.together;
      if(!choice || !text(choice.book_with)||!price(choice.price))return [];
      if(separate && (!returning||!text(returning.book_with)||!price(returning.price)))return [];
      const seller=separate?
        text(choice.book_with,65)+' (departing) / '+text(returning.book_with,65)+' (returning)':
        text(choice.book_with,100);
      const quote=separate?Number(choice.price)+Number(returning.price):Number(choice.price);
      if(!price(quote))return [];
      return [{seller,price:money(quote),
        currency:'USD',separateTickets:separate,
        sellerIsAirline:choice.airline===true&&(!separate||returning.airline===true),
        priceBasis:separate?'Sum of departing and returning seller quotes; two separate purchases may be required':
          'Seller-reported quote for selected itinerary; final payable amount not verified',
        offerType:separate?'separate_tickets':'together',
        checkedAt,availability:'seller_option_listed',
        seatInventoryVerified:false,bookingConfirmed:false}];
    }).sort((a,b)=>Number(a.price)-Number(b.price)).slice(0,MAX_CHOICES);
  return {ok:true,stage:'booking_options',checkedAt,
    message:options.length?
      'Supplier-reported booking sellers were listed at the checked time. Final pricing and seat inventory must be verified with the seller before payment.' :
      'No booking sellers returned for this selection. This is not proof all tickets are sold out.',
    options,limitations:['Booking seller listed does not guarantee seats are available.',
      'Separate tickets may involve separate bookings and additional risks.',
      'Wayfarer does not reserve seats, process payment, or submit booking forms.']};
}
export default async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return failure(res,405,'POST required');}
  const secret=process.env.WAYFARER_AI_BETA_TOKEN;
  if(!equal(req.headers?.['x-wayfarer-beta-token'],secret))
    return failure(res,401,'Private beta access required');
  let body;
  try{
    body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||
      Buffer.byteLength(JSON.stringify(body))>BODY_LIMIT)throw Error('invalid');
  }catch{return failure(res,400,'Invalid selection request');}
  const state=verifySelection(body.selectionToken,secret);
  if(!state)return failure(res,400,'Selection expired or invalid. Search flights again.');
  if(meteredProviderLocked())return failure(res,503,PRODUCTION_PROVIDER_LOCK_NOTE);
  const key=process.env.SERPAPI_API_KEY;
  if(process.env.WAYFARER_TRAVEL_ENABLED!=='true'||!key)
    return failure(res,503,'Flight booking research is not connected.');
  if(limited(req))return failure(res,429,'Search budget limit reached. Try again later.');
  try{
    const checkedAt=new Date().toISOString();
    const data=await provider(state,key);
    return send(res,200,state.stage==='return'?
      normalizeReturn(data,state,secret,checkedAt):normalizeBooking(data,checkedAt));
  }catch(error){
    return failure(res,error?.quota?429:502,
      error?.quota?'Provider search quota exhausted. No inventory conclusion is possible.':
      'Supplier search unavailable. No seat availability conclusion is possible.');
  }
}
