import { timingSafeEqual } from 'node:crypto';
import {signSelection} from '../flight-selection-token.mjs';
import countryDirectory from '../data.json' with {type:'json'};

// Source-grounded, opt-in Google Travel searches via SerpApi.
// Search results are not real-time airline/hotel inventory or purchase confirmations.
const BODY_MAX = 5_000;
const PROVIDER_TIMEOUT = 10_000;
const MAX_PROVIDER_RESPONSE = 1_500_000;
const clean = (v, n=120) => String(v ?? '').replace(/[\x00-\x1f<>]/g, ' ').trim().slice(0,n);
const state = (status, message, offers=[]) => ({status,message,offers});
const dateRx = /^\d{4}-\d{2}-\d{2}$/;
const numMoney = n => (typeof n==='number'||typeof n==='string') && Number.isFinite(Number(n)) && Number(n)>0 && Number(n)<1e9;
const money = n => (Math.round(Number(n)*100)/100).toFixed(2);
const airport = code => /^[A-Z]{3}$/.test(code ?? '');
const countriesByCode=new Map((countryDirectory.countries||[]).map(c=>[c.code,c.name]));
const finiteLocation=(lat,lon)=>Number.isFinite(lat)&&Math.abs(lat)<=90&&
  Number.isFinite(lon)&&Math.abs(lon)<=180;
function hotelGeoQuery(trip){
  const country=trip.countryCode?countriesByCode.get(trip.countryCode):null;
  const location=country?trip.destination+', '+country:trip.destination;
  if(country&&finiteLocation(trip.latitude,trip.longitude)){
    return 'hotels in '+location+' near '+trip.latitude.toFixed(5)+', '+trip.longitude.toFixed(5);
  }
  return 'hotels in '+location;
}
function secureEqual(a,b){const l=Buffer.from(String(a||''),'utf8'),r=Buffer.from(String(b||''),'utf8');return l.length>=24&&l.length===r.length&&timingSafeEqual(l,r)}
function json(res,code,payload){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(code).json(payload)}
function parseTrip(req){
  const body = typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>BODY_MAX)throw Error('Invalid request body');
  const t=body.trip||{};
  const route={
    from:clean(t.from,12).toUpperCase(),to:clean(t.to,12).toUpperCase(),
    checkIn:clean(t.checkIn,16),checkOut:clean(t.checkOut,16),
    destination:clean(t.destination,90),adults:Number(t.adults),
    // Public mapped reference context; source location is selected by visitor.
    // Never assert these values are independently validated by our backend.
    countryCode:clean(t.countryCode,2).toUpperCase(),
    latitude:t.latitude==null?null:Number(t.latitude),
    longitude:t.longitude==null?null:Number(t.longitude),
    flightBudget:t.flightBudget==null||t.flightBudget===''?0:Number(t.flightBudget),
    groundBudget:t.groundBudget==null||t.groundBudget===''?0:Number(t.groundBudget)
  };
  const a=Date.parse(route.checkIn+'T00:00:00Z'), b=Date.parse(route.checkOut+'T00:00:00Z');
  const iso = (value,ms)=>dateRx.test(value)&&Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value;
  const now = Date.parse(new Date().toISOString().slice(0,10)+'T00:00:00Z');
  if(!iso(route.checkIn,a)||!iso(route.checkOut,b)||a<now||b<=a||b-a>31*86400000||
    !Number.isInteger(route.adults)||route.adults<1||route.adults>9||
    !Number.isFinite(route.flightBudget)||route.flightBudget<0||route.flightBudget>1e6||
    !Number.isFinite(route.groundBudget)||route.groundBudget<0||route.groundBudget>1e6||
    !route.destination||route.destination.length<2||
    (route.countryCode&&!countriesByCode.has(route.countryCode))||
    ((route.latitude===null)!==(route.longitude===null))||
    (route.latitude!==null&&!finiteLocation(route.latitude,route.longitude))||
    (route.latitude!==null&&!route.countryCode)||
    (route.from&&!airport(route.from))||(route.to&&!airport(route.to))||
    (route.from&&route.to&&route.from===route.to)){throw Error('Invalid route, date, group or budget');}
  return route;
}
async function search(provider,key,parameters){
  const url=new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine',provider);
  for(const [name,value] of Object.entries(parameters))url.searchParams.set(name,String(value));
  url.searchParams.set('api_key',key);
  const resp=await fetch(url,{signal:AbortSignal.timeout(PROVIDER_TIMEOUT)});
  if(resp.status===429){const e=Error('Search quota reached');e.quota=true;throw e}
  if(!resp.ok)throw Error('Travel search provider unavailable');
  const raw=await resp.text();
  if(raw.length>MAX_PROVIDER_RESPONSE)throw Error('Provider response too large');
  let parsed;try{parsed=JSON.parse(raw)}catch{throw Error('Invalid travel search response')}
  if(parsed.error||parsed.search_metadata?.status==='Error'){
    const e=Error('Travel search was rejected');
    e.quota=/quota|limit|credit|searches/i.test(String(parsed.error||''));throw e;
  }
  return parsed;
}
function fit(total,budget){return !budget?'budget_not_set':total<=budget?'within_budget':'over_budget'}
function flightsFrom(data,t,checkedAt,secret){
  const entries=[...(Array.isArray(data.best_flights)?data.best_flights:[]),...(Array.isArray(data.other_flights)?data.other_flights:[])];
  const offers=entries.slice(0,12).map(item=>{
    if(!numMoney(item.price)||!Array.isArray(item.flights))return null;
    const segments=item.flights.slice(0,6).map(f=>({
      airline:clean(f.airline,70),number:clean(f.flight_number,20),
      from:clean(f.departure_airport?.id,3),to:clean(f.arrival_airport?.id,3),
      departureAt:clean(f.departure_airport?.time,40),arrivalAt:clean(f.arrival_airport?.time,40)
    })).filter(f=>airport(f.from)&&airport(f.to));
    if(!segments.length)return null;
    const perAdult=Number(money(item.price)),estimatedGroup=Number(money(perAdult*t.adults));
    return {currency:'USD',perAdult:money(perAdult),estimatedGroup:money(estimatedGroup),
      priceBasis:'Indicative search price per adult; full round trip not repriced',
      budgetFit:fit(estimatedGroup,t.flightBudget),flightBudgetUsd:t.flightBudget||null,
      segments,
      totalDurationMinutes:Number.isFinite(item.total_duration)?item.total_duration:null,
      stopCount:Math.max(0,segments.length-1),
      ticketAvailability:'not_verified',
      bookableSeats:null,
      bookingLink:null,
      operationalFlightStatus:'not_connected',
      selection: item.departure_token ?
        {stage:'return',token:signSelection('return',item.departure_token,t,secret)} :
        item.booking_token ?
        {stage:'booking',token:signSelection('booking',item.booking_token,t,secret)} : null,
      checkedAt};
  }).filter(Boolean).sort((a,b)=>Number(a.estimatedGroup)-Number(b.estimatedGroup)).slice(0,6);
  return state(offers.length?'search_results':'no_results',offers.length?
    'Flight times are provider-reported search schedule indications. Ticket availability, operating status, return-flight selection and final booking totals are not verified.':
    'No price found in this search; that does not mean flights are sold out.',offers);
}
function hotelsFrom(data,t,checkedAt){
  const allocation=Number(money(t.groundBudget*.40));
  const offers=(Array.isArray(data.properties)?data.properties:[]).slice(0,30).map(p=>{
    const amount=p?.total_rate?.extracted_lowest;
    if(!numMoney(amount)||!clean(p.name))return null;
    const total=Number(money(amount));
    return {name:clean(p.name,150),currency:'USD',displayedTotal:money(total),
      priceBasis:'Lowest total displayed in Google Hotels search; not confirmed payable rate',
      checkIn:t.checkIn,checkOut:t.checkOut,allocationUsd:allocation||null,
      budgetFit:fit(total,allocation),checkedAt};
  }).filter(Boolean).sort((a,b)=>Number(a.displayedTotal)-Number(b.displayedTotal)).slice(0,8);
  return state(offers.length?'search_results':'no_results',offers.length?
    'Indicative hotel search prices for these dates. Taxes, occupancy and actual room availability are unverified.':
    'No total-price results returned; other rooms may still be available.',offers);
}
// In-memory counter is defense in depth, not a cross-instance quota guarantee.
const activity=new Map();
function throttled(req){
  const ip=clean(req.headers?.['x-forwarded-for']?.split(',')[0]||'private-preview',100);
  const now=Date.now();const previous=(activity.get(ip)||[]).filter(x=>now-x<3600_000);
  if(previous.length>=12)return true;
  previous.push(now);activity.set(ip,previous);
  if(activity.size>500){for(const [k,v] of activity){if(now-v[v.length-1]>3600_000)activity.delete(k)}}
  return false;
}
export default async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{ok:false,error:'Method not allowed'})}
  if(!secureEqual(req.headers?.['x-wayfarer-beta-token'],process.env.WAYFARER_AI_BETA_TOKEN))return json(res,401,{ok:false,error:'Private beta code required'});
  let t;try{t=parseTrip(req)}catch{return json(res,400,{ok:false,error:'Please check route, dates, group and budget.'})}
  const payload={ok:true,source:'SerpApi Google Travel Search',mode:'disabled',checkedAt:null,
    hotelSearchContext:{destination:t.destination,countryCode:t.countryCode||null,
      countryName:countriesByCode.get(t.countryCode)||null,
      coordinateScoped:finiteLocation(t.latitude,t.longitude)&&!!t.countryCode,
      caveat:'Location context is traveler-selected; provider results may not match this exact area. Verify hotel addresses before booking.'},
    flights:state('not_connected','Search provider not enabled.'),
    hotels:state('not_connected','Search provider not enabled.'),
    food:state('not_connected','Restaurant menu prices are not yet connected.'),
    transport:state('not_connected','Transit fare schedules are not yet connected.'),
    note:'Search prices may be cached and do not verify bookability. No flights or rooms are booked.'};
  const key=process.env.SERPAPI_API_KEY;
  if(process.env.WAYFARER_TRAVEL_ENABLED!=='true'||!key)return json(res,200,payload);
  if(throttled(req))return json(res,429,{ok:false,error:'Too many searches from this browser. Try later. Free search quota is limited.'});
  payload.mode='search_only';payload.checkedAt=new Date().toISOString();
  const jobs=[
    airport(t.from)&&airport(t.to)?search('google_flights',key,{departure_id:t.from,arrival_id:t.to,outbound_date:t.checkIn,return_date:t.checkOut,adults:t.adults,type:1,travel_class:1,hl:'en',currency:'USD'}):Promise.resolve(null),
    t.adults<=2?search('google_hotels',key,{q:hotelGeoQuery(t),check_in_date:t.checkIn,check_out_date:t.checkOut,adults:t.adults,hl:'en',currency:'USD'}):Promise.resolve(null)
  ];
  const [f,h]=await Promise.allSettled(jobs);
  const failed=e=>state(e?.quota?'quota_exceeded':'unavailable',e?.quota?'Provider monthly quota or rate limit reached.':'Provider search failed. This is not proof of sold-out inventory.');
  payload.flights=f.status==='rejected'?failed(f.reason):f.value?flightsFrom(f.value,t,payload.checkedAt,process.env.WAYFARER_AI_BETA_TOKEN):state('needs_details','Select both origin and destination IATA airports.');
  payload.hotels=h.status==='rejected'?failed(h.reason):h.value?hotelsFrom(h.value,t,payload.checkedAt):state('needs_details','Hotel quote supports one shared room for 1–2 adults; room selection is required for larger parties.');
  return json(res,200,payload);
}
