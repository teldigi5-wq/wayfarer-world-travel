import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/travel-search.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const page=read('../index.html');
const css=read('../wayfarer-product.css');
const client=read('../wayfarer-product.js');
const flightsUI=read('../travel-research.js');
const backend=read('../api/travel-search.js');

test('worldwide discovery and pricing are real product components, not fake checkout',()=>{
  assert.match(page,/href="wayfarer-product.css"/);
  assert.match(page,/src="wayfarer-product.js" defer/);
  assert.match(client,/select\.options/);
  assert.match(client,/wf-country-list/);
  assert.match(client,/country-filter/);
  assert.match(client,/world-query/);
  assert.match(client,/countries & territories in the reference directory/);
  assert.match(client,/Explorer/);
  assert.match(client,/\$0/);
  assert.match(client,/\$9/);
  assert.match(client,/PROPOSED · NOT ON SALE/);
  assert.match(client,/No payments are taken/);
  assert.doesNotMatch(client,/checkout\.stripe\.com|stripe\.redirectToCheckout|paypal\.com\/checkout/);
});
test('premium motion is optional and the layout remains responsive and focusable',()=>{
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.motion-off/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/min-height:48px/);
  assert.match(css,/grid-template-columns:1fr/);
});
test('flight search includes both schedule times but never presents speculative seat availability as confirmed',()=>{
  assert.match(backend,/arrivalAt:clean\(f\.arrival_airport\?\.time/);
  assert.match(backend,/ticketAvailability:'not_verified'/);
  assert.match(backend,/bookableSeats:null/);
  assert.match(backend,/operationalFlightStatus:'not_connected'/);
  assert.match(flightsUI,/Ticket availability: NOT VERIFIED/);
  assert.match(flightsUI,/segment\.arrivalAt/);
  assert.match(flightsUI,/totalDurationMinutes/);
});
const before={...process.env};
const date=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const query={from:'CMB',to:'HND',destination:'Tokyo, Japan',checkIn:date(45),checkOut:date(50),
  adults:2,flightBudget:1400,groundBudget:1200};
function mockResponse(){
  return {statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this;},
    status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;}};
}
test('server passes through supplier-reported flight times without inventing availability',async()=>{
  const saved=globalThis.fetch;
  process.env.WAYFARER_TRAVEL_ENABLED='true';
  process.env.WAYFARER_AI_BETA_TOKEN='long-unit-test-token-not-production-456';
  process.env.SERPAPI_API_KEY='mocked-service-fixture-key';
  const calls=[];
  globalThis.fetch=async url=>{
    const u=new URL(url);calls.push(u);
    assert.equal(u.hostname,'serpapi.com');
    return new Response(JSON.stringify(u.searchParams.get('engine')==='google_flights'?
      {search_metadata:{status:'Success'},best_flights:[{price:420,total_duration:610,flights:[
        {airline:'Fixture Airline',flight_number:'FA88',
         departure_airport:{id:'CMB',time:'2027-01-01 08:25'},
         arrival_airport:{id:'HND',time:'2027-01-01 20:35'}}
      ]}]}:
      {search_metadata:{status:'Success'},properties:[{name:'Fixture stay',
        total_rate:{extracted_lowest:460}}]}),{status:200});
  };
  try{
    const res=mockResponse();
    await handler({method:'POST',headers:{'x-wayfarer-beta-token':process.env.WAYFARER_AI_BETA_TOKEN,
      'x-forwarded-for':'test-flight-times-new-20261013'},body:{trip:query}},res);
    assert.equal(res.statusCode,200);
    assert.equal(calls.length,2);
    const offer=res.body.flights.offers[0];
    assert.equal(offer.segments[0].departureAt,'2027-01-01 08:25');
    assert.equal(offer.segments[0].arrivalAt,'2027-01-01 20:35');
    assert.equal(offer.stopCount,0);
    assert.equal(offer.totalDurationMinutes,610);
    assert.equal(offer.ticketAvailability,'not_verified');
    assert.equal(offer.bookableSeats,null);
    assert.equal(offer.operationalFlightStatus,'not_connected');
    assert.equal(offer.estimatedGroup,'840.00');
    assert.equal(res.body.hotels.offers[0].displayedTotal,'460.00');
  }finally{
    globalThis.fetch=saved;
    for(const key of ['WAYFARER_TRAVEL_ENABLED','WAYFARER_AI_BETA_TOKEN','SERPAPI_API_KEY']){
      if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];
    }
  }
});
