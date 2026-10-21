import { meteredProviderLocked, PRODUCTION_PROVIDER_LOCK_NOTE } from '../provider-production-lock.mjs';
import { timingSafeEqual } from 'node:crypto';
import { validateTrip } from '../planner.mjs';

// Source-controlled adapter only. Provider keys remain on the server.
// SerpApi Google Travel search results are NOT a booking or seat/room inventory feed.
const MAX_BYTES = 12000;
const SEARCH_TIMEOUT_MS = 11000;
const SEARCH_MAX_RESPONSE = 2000000;
const cut = (value, max = 160) => String(value ?? '').trim().slice(0, max);
const category = (status, message, results = []) => ({ status, message, results });
const dollars = value => Math.round(value * 100) / 100;
const isIata = value => /^[A-Z]{3}$/.test(value || '');
const validPrice = value => (typeof value === 'string' || typeof value === 'number') &&
  Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) < 1e8;
function reply(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(payload);
}
function tokenMatches(provided, expected) {
  const a=Buffer.from(String(provided || '')), b=Buffer.from(String(expected || ''));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a,b);
}
function fit(price, budget) {
  if(!Number.isFinite(budget) || budget<=0)return 'budget_not_set';
  return price<=budget?'within_budget':'over_budget';
}
function ordered(offers) {
  const rank={within_budget:0,budget_not_set:1,over_budget:2};
  return offers.sort((a,b)=>(rank[a.budgetFit]??3)-(rank[b.budgetFit]??3) ||
    (Number(a.groupTotal || a.price)-Number(b.groupTotal || b.price)));
}
function researchLinks(trip) {
  const destination=[trip.city,trip.country].join(', ');
  const query = (root, query) => root + new URLSearchParams(query);
  return {
    flights: query('https://www.google.com/search?',{
      q:'Google Flights '+(trip.originAirport||trip.origin)+' to '+
        (trip.destinationAirport||destination)+' '+trip.startDate+' '+trip.endDate
    }),
    hotels: query('https://www.booking.com/searchresults.html?',{
      ss:destination, checkin:trip.startDate, checkout:trip.endDate,
      group_adults:String(trip.travelers)
    }),
    food:query('https://www.google.com/maps/search/?',{
      api:'1',query:'restaurants and menus in '+destination
    }),
    transport:query('https://www.google.com/maps/dir/?',{
      api:'1',destination,travelmode:'transit'
    })
  };
}
function parseTrip(req) {
  if(Number(req.headers?.['content-length'] || 0)>MAX_BYTES) throw new Error('Body too large');
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!body || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body))>MAX_BYTES) {
    throw new Error('Invalid body');
  }
  const raw=body.trip;
  if(!raw || typeof raw!=='object'||Array.isArray(raw))throw new Error('Trip missing');
  const trip={
    country:cut(raw.country,120),city:cut(raw.city,120),origin:cut(raw.origin,120),
    startDate:cut(raw.startDate,10),endDate:cut(raw.endDate,10),
    travelers:Number(raw.travelers),budget:Number(raw.budget),
    flightBudget:raw.flightBudget==null||raw.flightBudget===''?0:Number(raw.flightBudget),
    style:raw.style==='slow'?'slow':'balanced',
    originAirport:cut(raw.originAirport,3).toUpperCase(),
    destinationAirport:cut(raw.destinationAirport,3).toUpperCase()
  };
  const check=validateTrip(trip);
  if(!check.valid)throw new Error(check.errors.join(' '));
  if(!Number.isFinite(trip.flightBudget)||trip.flightBudget<0||trip.flightBudget>1000000||
    (trip.originAirport&&!isIata(trip.originAirport))||
    (trip.destinationAirport&&!isIata(trip.destinationAirport)))throw new Error('Invalid airfare budget or airport code');
  return trip;
}
async function serpSearch(params,key) {
  const url=new URL('https://serpapi.com/search.json');
  for(const [name,value] of Object.entries(params))url.searchParams.set(name,String(value));
  url.searchParams.set('api_key',key);
  let res;
  try { res=await fetch(url.href,{signal:AbortSignal.timeout(SEARCH_TIMEOUT_MS)}); }
  catch { throw new Error('Provider unavailable'); }
  if(!res.ok){
    const err=new Error(res.status===429?'Provider rate limit reached':'Provider request unavailable');
    err.quota=res.status===429;
    throw err;
  }
  const text=await res.text();
  if(text.length>SEARCH_MAX_RESPONSE)throw new Error('Provider response too large');
  let data;
  try { data=JSON.parse(text); } catch {throw new Error('Malformed provider response');}
  if(data?.error || data?.search_metadata?.status==='Error'){
    const err=new Error('Provider search reported an error');
    err.quota=/limit|quota|credits|searches left/i.test(String(data.error || ''));
    throw err;
  }
  return data;
}
function normalizeFlight(raw,people,airBudget,checkedAt) {
  if(!validPrice(raw?.price)||!Array.isArray(raw?.flights)||!raw.flights.length)return null;
  const segments=raw.flights.slice(0,6).map(seg=>({
    airline:cut(seg?.airline,70),flightNumber:cut(seg?.flight_number,20),
    from:cut(seg?.departure_airport?.id,3),to:cut(seg?.arrival_airport?.id,3),
    departureAt:cut(seg?.departure_airport?.time,40),
    arrivalAt:cut(seg?.arrival_airport?.time,40)
  })).filter(s=>isIata(s.from)&&isIata(s.to));
  if(!segments.length)return null;
  const perAdult=dollars(Number(raw.price));
  // Google Flights labels the first-stage search a round-trip, but returning
  // itinerary selection normally requires a *second* departure_token request.
  const groupTotal=dollars(perAdult*people);
  return {
    price:perAdult.toFixed(2),currency:'USD',groupTotal:groupTotal.toFixed(2),
    passengersAssumedAdults:people,priceBasis:'Google Flights indicative per-adult round-trip search price',
    budgetFit:fit(groupTotal,airBudget),budgetLimitUsd:airBudget||null,
    itineraries:[{duration:raw.total_duration?String(raw.total_duration)+' min':'',
      segments}],seatsReported:null,lastCheckedAt:checkedAt,
    bookingStatus:'Search-only indicative fare. Return flight, booking options, taxes/baggage and seats are NOT verified. No ticket reserved.'
  };
}
function normalizeHotel(raw,trip,checkedAt) {
  const amount=raw?.total_rate?.extracted_lowest;
  if(!validPrice(amount)||!cut(raw?.name))return null;
  const price=dollars(Number(amount));
  const cap=dollars(trip.budget*0.4);
  return {
    name:cut(raw.name),price:price.toFixed(2),currency:'USD',
    priceBasis:'Displayed lowest total rate from Google Hotels for searched dates',
    budgetFit:fit(price,cap),budgetLimitUsd:cap,
    checkIn:trip.startDate,checkOut:trip.endDate,
    source:cut(raw?.prices?.[0]?.source||'Google Hotels search',90),
    roomType:null,lastCheckedAt:checkedAt,
    bookingStatus:'Search price only; room occupancy, taxes, fees, cancellation terms, final rate and availability need provider confirmation. No booking made.'
  };
}
async function flights(trip,key,checkedAt){
  if(!trip.originAirport||!trip.destinationAirport) {
    return category('needs_details','Select both departure and arrival IATA airports before searching current flight prices.');
  }
  if(trip.travelers>9) return category('needs_details','Flights for groups over nine adults require a specialist quote.');
  const data=await serpSearch({
    engine:'google_flights',departure_id:trip.originAirport,arrival_id:trip.destinationAirport,
    outbound_date:trip.startDate,return_date:trip.endDate,adults:trip.travelers,
    type:1,travel_class:1,hl:'en',currency:'USD',deep_search:'false'
  },key);
  const found=[...(Array.isArray(data.best_flights)?data.best_flights:[]),
    ...(Array.isArray(data.other_flights)?data.other_flights:[])]
    .map(v=>normalizeFlight(v,trip.travelers,trip.flightBudget,checkedAt)).filter(Boolean);
  return category(found.length?'search_results':'no_results', found.length?
    'Google Flights results through SerpApi. First-stage round-trip fares are indicative: return flights/seat availability are NOT confirmed.' :
    'No usable priced flights returned by this search. This does not mean all tickets are sold out.',
    ordered(found).slice(0,6));
}
async function hotels(trip,key,checkedAt){
  if(trip.travelers>2) return category('needs_details',
    'Hotel search currently assumes one shared room for one or two adults. Provide a room layout before quoting larger groups.');
  if(trip.startDate===trip.endDate)return category('needs_details',
    'Check-out must be after check-in for hotel price searches.');
  const data=await serpSearch({
    engine:'google_hotels',q:'hotels in '+trip.city+', '+trip.country,
    check_in_date:trip.startDate,check_out_date:trip.endDate,
    adults:trip.travelers,currency:'USD',hl:'en'
  },key);
  const found=(Array.isArray(data.properties)?data.properties:[])
    .map(v=>normalizeHotel(v,trip,checkedAt)).filter(Boolean);
  return category(found.length?'search_results':'no_results',found.length?
    'Google Hotels search prices through SerpApi. The displayed total is not a confirmed payable rate or room reservation.' :
    'No complete total-rate hotel prices were returned; other accommodation may still be available.',
    ordered(found).slice(0,8));
}
export default async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return reply(res,405,{ok:false,error:'Method not allowed.'});
  }
  const betaCode=process.env.WAYFARER_AI_BETA_TOKEN||'';
  if(!betaCode||!tokenMatches(req.headers?.['x-wayfarer-beta-token'],betaCode))
    return reply(res,401,{ok:false,error:'Invalid private beta access code.'});
  let trip;
  try{trip=parseTrip(req);}
  catch{return reply(res,400,{ok:false,error:'Invalid trip. Check dates, airports and budgets.'});}
  const links=researchLinks(trip);
  const payload={
    ok:true,provider:'SerpApi Google Flights / Google Hotels',mode:'not_configured',
    checkedAt:null,
    flights:category('not_connected','Current flight prices require an enabled SerpApi server integration.'),
    hotels:category('not_connected','Hotel search prices require an enabled SerpApi server integration.'),
    food:{...category('not_connected','No licensed real-time restaurant menu pricing is connected.'),researchUrl:links.food},
    transport:{...category('not_connected','No worldwide live transport fare/timetable provider is connected.'),researchUrl:links.transport},
    researchLinks:{flights:links.flights,hotels:links.hotels},
    limitations:[
      'SerpApi retrieves Google Travel search results, not airline seat inventory or confirmed room availability.',
      'Search results may be cached and change before checkout.',
      'A round-trip flight search result is indicative until return flights and booking options are selected.',
      'Prices are USD search indications; baggage, taxes, fees, occupancy and provider terms require verification.',
      'Ground-budget allocation is separate from the optional group airfare budget.',
      'Each click may make up to two SerpApi searches and use monthly free search allowance.'
    ]
  };
  if(meteredProviderLocked()){payload.mode='production_locked';return reply(res,200,payload)}
  const key=process.env.SERPAPI_API_KEY||'';
  if(process.env.WAYFARER_TRAVEL_ENABLED!=='true'||!key) return reply(res,200,payload);
  payload.mode='serpapi_search';
  payload.checkedAt=new Date().toISOString();
  const unavailable = e => category(e?.quota?'quota_exceeded':'unavailable',
    e?.quota?'SerpApi quota/rate limit reached; no availability conclusion can be drawn.':
    'Travel search provider unavailable; no availability conclusion can be drawn.');
  // Two searches maximum; failures cannot be misreported as sold-out.
  const [flight,hotel]=await Promise.allSettled([
    flights(trip,key,payload.checkedAt),hotels(trip,key,payload.checkedAt)
  ]);
  payload.flights=flight.status==='fulfilled'?flight.value:unavailable(flight.reason);
  payload.hotels=hotel.status==='fulfilled'?hotel.value:unavailable(hotel.reason);
  return reply(res,200,payload);
}
