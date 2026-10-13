import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/travel-offers.mjs';

const original={...process.env};
const trip={
  country:'Japan',city:'Tokyo',origin:'Colombo',originAirport:'CMB',destinationAirport:'HND',
  startDate:'2026-12-01',endDate:'2026-12-05',travelers:2,budget:1200,flightBudget:1000,
  style:'balanced'
};
const TEST_BETA='private-beta-test-token';
function setup(enabled=true){
  process.env.WAYFARER_AI_BETA_TOKEN=TEST_BETA;
  process.env.WAYFARER_TRAVEL_ENABLED=enabled?'true':'false';
  process.env.SERPAPI_API_KEY='mocked-serpapi-key-test-only';
}
function response(){
  return {
    code:200,headers:{},data:null,
    setHeader(name,value){this.headers[name]=value;},
    status(code){this.code=code;return this;},
    json(data){this.data=data;return this;}
  };
}
async function request(changes={},auth=TEST_BETA,method='POST'){
  const res=response();
  await handler({
    method,headers:{'x-wayfarer-beta-token':auth},
    body:{trip:{...trip,...changes}}
  },res);
  return res;
}
const flightsFixture={
  search_metadata:{status:'Success'},
  best_flights:[{
    price:440,type:'Round trip',total_duration:770,
    flights:[{airline:'Fixture Air',flight_number:'FA123',
      departure_airport:{id:'CMB',time:'2026-12-01 07:00'},
      arrival_airport:{id:'HND',time:'2026-12-01 19:00'}}]
  }]
};
const hotelsFixture={
  search_metadata:{status:'Success'},
  properties:[
    {name:'Fixture Hotel',total_rate:{extracted_lowest:470},
      rate_per_night:{extracted_lowest:125},prices:[{source:'Fixture Hotel site'}]},
    {name:'Unverified nightly-only',rate_per_night:{extracted_lowest:100}}
  ]
};
function provider(fetchLog,options={}){
  return async url=>{
    const value=new URL(url);fetchLog.push(value);
    assert.equal(value.origin,'https://serpapi.com');
    assert.equal(value.pathname,'/search.json');
    assert.equal(value.searchParams.get('api_key'),'mocked-serpapi-key-test-only');
    const kind=value.searchParams.get('engine');
    if(options.error)return new Response(JSON.stringify({error:options.error}),{status:200});
    if(options.status)return new Response('unavailable',{status:options.status});
    if(kind==='google_flights'){
      assert.equal(value.searchParams.get('departure_id'),'CMB');
      assert.equal(value.searchParams.get('arrival_id'),'HND');
      assert.equal(value.searchParams.get('outbound_date'),'2026-12-01');
      assert.equal(value.searchParams.get('return_date'),'2026-12-05');
      assert.equal(value.searchParams.get('adults'),'2');
      return new Response(JSON.stringify(options.noResults?{}:flightsFixture),{status:200});
    }
    assert.equal(kind,'google_hotels');
    assert.equal(value.searchParams.get('check_in_date'),'2026-12-01');
    assert.equal(value.searchParams.get('check_out_date'),'2026-12-05');
    assert.equal(value.searchParams.get('currency'),'USD');
    assert.equal(value.searchParams.get('adults'),'2');
    return new Response(JSON.stringify(options.noResults?{}:hotelsFixture),{status:200});
  };
}
test('rejects unauthenticated requests and wrong methods without calling provider',async()=>{
  setup();
  assert.equal((await request({},'wrong')).code,401);
  assert.equal((await request({},TEST_BETA,'GET')).code,405);
});
test('key not configured and integration disabled never call external API',async()=>{
  setup();
  delete process.env.SERPAPI_API_KEY;
  const orig=globalThis.fetch;
  try{
    globalThis.fetch=async()=>{throw Error('Unexpected network call');};
    const missing=await request();
    assert.equal(missing.data.mode,'not_configured');
    assert.equal(missing.data.flights.status,'not_connected');
    setup(false);
    const off=await request();
    assert.equal(off.data.hotels.status,'not_connected');
  }finally{globalThis.fetch=orig;}
});
test('searches exactly two endpoints and separates per-adult airfare from group ceiling',async()=>{
  setup();
  const orig=globalThis.fetch,urls=[];
  try{
    globalThis.fetch=provider(urls);
    const resp=await request();
    assert.equal(resp.code,200);
    assert.equal(resp.headers['Cache-Control'],'no-store');
    assert.equal(resp.data.mode,'serpapi_search');
    assert.equal(urls.length,2);
    assert.equal(resp.data.flights.status,'search_results');
    const flight=resp.data.flights.results[0];
    assert.equal(flight.price,'440.00');
    assert.equal(flight.groupTotal,'880.00');
    assert.equal(flight.budgetFit,'within_budget');
    assert.equal(flight.seatsReported,null);
    assert.match(flight.bookingStatus,/return flight.*not verified/i);
    const hotel=resp.data.hotels.results[0];
    assert.equal(hotel.price,'470.00');
    assert.equal(hotel.budgetFit,'within_budget');
    assert.equal(resp.data.hotels.results.length,1);
    assert.equal(resp.data.food.status,'not_connected');
    assert.equal(resp.data.transport.status,'not_connected');
    assert.equal(JSON.stringify(resp.data).includes('mocked-serpapi-key'),false);
  }finally{globalThis.fetch=orig;}
});
test('budget overages are not misrepresented as affordable',async()=>{
  setup();
  const orig=globalThis.fetch,urls=[];
  try{
    globalThis.fetch=provider(urls);
    const result=await request({flightBudget:800,budget:1000});
    assert.equal(result.data.flights.results[0].budgetFit,'over_budget');
    assert.equal(result.data.hotels.results[0].budgetFit,'over_budget');
  }finally{globalThis.fetch=orig;}
});
test('no selected airports stops flight search but allows hotel results',async()=>{
  setup();
  const orig=globalThis.fetch,urls=[];
  try{
    globalThis.fetch=provider(urls);
    const result=await request({originAirport:'',destinationAirport:''});
    assert.equal(result.data.flights.status,'needs_details');
    assert.equal(result.data.hotels.status,'search_results');
    assert.equal(urls.length,1);
  }finally{globalThis.fetch=orig;}
});
test('three adults do not get a fabricated one-room hotel quote',async()=>{
  setup();
  const orig=globalThis.fetch,urls=[];
  try{
    globalThis.fetch=provider(urls);
    const result=await request({travelers:3});
    assert.equal(result.data.hotels.status,'needs_details');
    assert.equal(urls.length,1);
  }finally{globalThis.fetch=orig;}
});
test('empty provider results are NOT called sold out',async()=>{
  setup();
  const orig=globalThis.fetch,urls=[];
  try{
    globalThis.fetch=provider(urls,{noResults:true});
    const data=(await request()).data;
    assert.equal(data.flights.status,'no_results');
    assert.match(data.flights.message,/not mean all tickets are sold out/i);
    assert.equal(data.hotels.status,'no_results');
  }finally{globalThis.fetch=orig;}
});
test('quota errors and failed provider calls distinguish outages from availability',async()=>{
  setup();
  const orig=globalThis.fetch,urls=[];
  try{
    globalThis.fetch=provider(urls,{status:429});
    const data=(await request()).data;
    assert.equal(data.flights.status,'quota_exceeded');
    assert.equal(data.hotels.status,'quota_exceeded');
    globalThis.fetch=provider([], {status:503});
    const unavailable=(await request()).data;
    assert.equal(unavailable.flights.status,'unavailable');
    assert.equal(unavailable.hotels.status,'unavailable');
  }finally{globalThis.fetch=orig;}
});
test('invalid airports, budget and trip dates rejected before external calls',async()=>{
  setup();
  assert.equal((await request({originAirport:'123'})).code,400);
  assert.equal((await request({flightBudget:-1})).code,400);
  assert.equal((await request({startDate:'not-date'})).code,400);
});
test.after(()=>{
  for(const key of ['WAYFARER_AI_BETA_TOKEN','WAYFARER_TRAVEL_ENABLED','SERPAPI_API_KEY']){
    if(original[key]===undefined)delete process.env[key];
    else process.env[key]=original[key];
  }
});
