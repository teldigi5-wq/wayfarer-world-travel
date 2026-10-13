import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/travel-search.js';
const before={...process.env};
const key='test-serp-key-never-real';
const beta='sample-beta-passcode-not-a-real-secret';
const start=new Date(Date.now()+35*86400000),end=new Date(Date.now()+39*86400000);
const date=d=>d.toISOString().slice(0,10);
const sample={from:'CMB',to:'HND',destination:'Tokyo, Japan',checkIn:date(start),checkOut:date(end),adults:2,flightBudget:1200,groundBudget:1200};
function env(active){process.env.SERPAPI_API_KEY=key;process.env.WAYFARER_AI_BETA_TOKEN=beta;process.env.WAYFARER_TRAVEL_ENABLED=active?'true':'false'}
function res(){return {statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(p){this.body=p;return this}}}
async function call({trip=sample,token=beta,method='POST',headers={}}={}){
 const out=res();await handler({method,headers:{'x-wayfarer-beta-token':token,'x-forwarded-for':'unit-test-unique-02',...headers},body:{trip}},out);return out;
}
const flightSample={search_metadata:{status:'Success'},best_flights:[{price:480,total_duration:600,flights:[{airline:'Fixture Air',flight_number:'QA-1',departure_airport:{id:'CMB',time:'Tomorrow'},arrival_airport:{id:'HND',time:'Later'}}]}]};
const hotelsSample={search_metadata:{status:'Success'},properties:[{name:'Fixture Hotel',total_rate:{extracted_lowest:430}},{name:'Nightly only',rate_per_night:{extracted_lowest:90}}]};
const provider = (requests, options={}) => async url =>{
 const u=new URL(url);requests.push(u);assert.equal(u.hostname,'serpapi.com');assert.equal(u.searchParams.get('api_key'),key);
 if(options.status)return new Response('{}',{status:options.status});
 const engine=u.searchParams.get('engine');
 if(engine==='google_flights'){
   assert.equal(u.searchParams.get('departure_id'),'CMB');assert.equal(u.searchParams.get('arrival_id'),'HND');
   assert.equal(u.searchParams.get('adults'),'2');return new Response(JSON.stringify(options.empty?{}:flightSample),{status:200});
 }
 assert.equal(engine,'google_hotels');assert.equal(u.searchParams.get('adults'),'2');
 return new Response(JSON.stringify(options.empty?{}:hotelsSample),{status:200});
};
test('returns 401 for missing beta secret, 405 for GET, 400 for invalid trip',async()=>{
 env(true);
 assert.equal((await call({token:''})).statusCode,401);
 assert.equal((await call({method:'GET'})).statusCode,405);
 assert.equal((await call({trip:{...sample,adults:0}})).statusCode,400);
 assert.equal((await call({trip:{...sample,checkIn:'2025-01-01'}})).statusCode,400);
 assert.equal((await call({trip:{...sample,from:'23Z'}})).statusCode,400);
});
test('disabled provider never makes requests and leaves pricing disconnected',async()=>{
 env(false);const old=globalThis.fetch;
 try{globalThis.fetch=async()=>{throw Error('Unexpected network')};const d=(await call()).body;assert.equal(d.mode,'disabled');assert.equal(d.flights.status,'not_connected');assert.equal(d.hotels.status,'not_connected')}
 finally{globalThis.fetch=old}
});
test('grounded searches distinguish per-adult estimate and hotel total without seat claim',async()=>{
 env(true);const old=globalThis.fetch,seen=[];
 try{globalThis.fetch=provider(seen);const x=await call();assert.equal(x.statusCode,200);assert.equal(seen.length,2);
  assert.equal(x.body.mode,'search_only');assert.equal(x.body.flights.status,'search_results');
  assert.equal(x.body.flights.offers[0].perAdult,'480.00');assert.equal(x.body.flights.offers[0].estimatedGroup,'960.00');
  assert.equal(x.body.flights.offers[0].budgetFit,'within_budget');assert.equal(x.body.flights.offers[0].bookableSeats,null);
  assert.equal(x.body.hotels.status,'search_results');assert.equal(x.body.hotels.offers.length,1);
  assert.equal(x.body.hotels.offers[0].displayedTotal,'430.00');assert.equal(x.body.hotels.offers[0].budgetFit,'within_budget');
  assert.equal(x.body.food.status,'not_connected');assert.equal(x.body.transport.status,'not_connected');
  assert.ok(!JSON.stringify(x.body).includes(key));
 } finally{globalThis.fetch=old}
});
test('over-budget conditions are explicitly marked',async()=>{
 env(true);const old=globalThis.fetch,seen=[];
 try{globalThis.fetch=provider(seen);const x=(await call({trip:{...sample,flightBudget:900,groundBudget:800}})).body;
  assert.equal(x.flights.offers[0].budgetFit,'over_budget');assert.equal(x.hotels.offers[0].budgetFit,'over_budget');
 }finally{globalThis.fetch=old}
});
test('missing flight airports avoids unnecessary flight search, larger groups require hotel details',async()=>{
 env(true);const old=globalThis.fetch,seen=[];
 try{globalThis.fetch=provider(seen);const p=(await call({trip:{...sample,from:'',to:'',adults:4}})).body;
  assert.equal(p.flights.status,'needs_details');assert.equal(p.hotels.status,'needs_details');assert.equal(seen.length,0);
 }finally{globalThis.fetch=old}
});
test('429 and empty results are never sold-out conclusions',async()=>{
 env(true);const old=globalThis.fetch;
 try{
  globalThis.fetch=provider([],{empty:true});const empty=(await call()).body;
  assert.equal(empty.flights.status,'no_results');assert.match(empty.flights.message,/not mean flights are sold out/i);
  globalThis.fetch=provider([],{status:429});const quota=(await call()).body;
  assert.equal(quota.flights.status,'quota_exceeded');assert.equal(quota.hotels.status,'quota_exceeded');
 }finally{globalThis.fetch=old}
});
test.after(()=>{for(const name of ['WAYFARER_AI_BETA_TOKEN','SERPAPI_API_KEY','WAYFARER_TRAVEL_ENABLED']){
 if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];
}});
