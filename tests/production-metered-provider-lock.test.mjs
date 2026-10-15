import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {meteredProviderLocked,PRODUCTION_PROVIDER_LOCK_NOTE} from '../provider-production-lock.mjs';
import travelOffers from '../api/travel-offers.mjs';
import travelSearch from '../api/travel-search.js';
import flightSelection from '../api/flight-selection.mjs';
import airlineOffers from '../api/airline-offers.mjs';
import aiPlan from '../api/ai-plan.mjs';
import intelligence from '../api/intelligence.js';
import {signSelection} from '../flight-selection-token.mjs';

const envKeys=['VERCEL_ENV','VERCEL_TARGET_ENV','VERCEL','WAYFARER_DISABLE_METERED_PROVIDERS',
  'WAYFARER_TRAVEL_ENABLED','WAYFARER_AI_ENABLED','WAYFARER_AI_BETA_TOKEN',
  'SERPAPI_API_KEY','WAYFARER_DUFFEL_ENABLED','DUFFEL_ACCESS_TOKEN',
  'DUFFEL_MODE','WAYFARER_DUFFEL_LIVE_APPROVED','N8N_WEBHOOK_URL',
  'N8N_WEBHOOK_AUTH','GROQ_API_KEY','WAYFARER_INTELLIGENCE_AI_ENABLED'];
const orig=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
const restore=()=>{for(const [k,v] of Object.entries(orig)){
  if(v===undefined)delete process.env[k];else process.env[k]=v;
}};
function setBeta(){
  process.env.WAYFARER_AI_BETA_TOKEN='test-private-production-lock-beta-2026';
  process.env.WAYFARER_TRAVEL_ENABLED='true';
  process.env.SERPAPI_API_KEY='not-a-real-provider-key-for-test';
  process.env.WAYFARER_DUFFEL_ENABLED='true';
  process.env.DUFFEL_MODE='test';
  process.env.DUFFEL_ACCESS_TOKEN='duffel_test_only-fake-token';
  process.env.WAYFARER_AI_ENABLED='true';
  process.env.N8N_WEBHOOK_URL='https://automation.example.org/webhook/beta';
  process.env.N8N_WEBHOOK_AUTH='test-webhook-secret-please-never-deploy';
  process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='true';
  process.env.GROQ_API_KEY='fake-groq-provider-key';
}
const todayOffset=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const dateFrom=todayOffset(40),dateTo=todayOffset(44);
const secret='test-private-production-lock-beta-2026';
function result(){
 return {code:0,data:null,headers:{},
   setHeader(k,v){this.headers[k]=v;return this;},
   status(v){this.code=v;return this;},
   json(v){this.data=v;return this;}
 };
}
async function invoke(handler,{method='POST',body=null,query=null,headers={}}={}){
 const out=result();
 await handler({method,body,query,headers:{'x-wayfarer-beta-token':secret,...headers}},out);
 return out;
}
function setProduction(){
 setBeta();
 process.env.VERCEL='1';
 process.env.VERCEL_ENV='production';
 process.env.VERCEL_TARGET_ENV='production';
 delete process.env.WAYFARER_DISABLE_METERED_PROVIDERS;
}
test('production lock cannot be bypassed by provider keys, beta tokens or provider enable switches',()=>{
 assert.equal(meteredProviderLocked({VERCEL_ENV:'production'}),true);
 assert.equal(meteredProviderLocked({VERCEL_TARGET_ENV:'production'}),true);
 assert.equal(meteredProviderLocked({VERCEL:'1'}),true,'Unknown Vercel target must be closed');
 assert.equal(meteredProviderLocked({VERCEL:'1',VERCEL_ENV:'staging'}),true);
 assert.equal(meteredProviderLocked({VERCEL:'1',VERCEL_ENV:'preview'}),false);
 assert.equal(meteredProviderLocked({VERCEL:'1',VERCEL_ENV:'development'}),false);
 assert.equal(meteredProviderLocked({WAYFARER_DISABLE_METERED_PROVIDERS:'true'}),true);
 assert.equal(meteredProviderLocked({VERCEL:'1',VERCEL_ENV:'preview',WAYFARER_DISABLE_METERED_PROVIDERS:'true'}),true);
 assert.equal(meteredProviderLocked({}),false,'Tests and non-Vercel environments keep existing explicit feature gates');
 assert.match(PRODUCTION_PROVIDER_LOCK_NOTE,/disabled.*spend and abuse controls/);
});
test('all optional travel supplier endpoints return safe disconnected results with zero paid fetches in Production',async()=>{
 setProduction();
 const originalFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('Metered provider must not be called');};
 const extra={from:'CMB',to:'HND',checkIn:dateFrom,checkOut:dateTo,adults:2,
   destination:'Tokyo, Japan',flightBudget:500,groundBudget:600};
 try{
   const offer=await invoke(travelOffers,{body:{trip:{country:'Japan',city:'Tokyo',
     origin:'Colombo',originAirport:'CMB',destinationAirport:'HND',startDate:dateFrom,
     endDate:dateTo,travelers:2,budget:850,flightBudget:1000,style:'balanced'}}});
   assert.equal(offer.code,200);
   assert.equal(offer.data.mode,'production_locked');
   assert.equal(offer.data.flights.status,'not_connected');
   assert.equal(offer.data.hotels.status,'not_connected');
   assert.equal(offer.headers['Cache-Control'],'no-store');
   const search=await invoke(travelSearch,{body:{trip:extra}});
   assert.equal(search.code,200);
   assert.equal(search.data.mode,'production_locked');
   assert.equal(search.data.flights.status,'not_connected');
   assert.equal(search.data.hotels.status,'not_connected');
   const token=signSelection('return','fake-return-token-for-lock',{
     from:'CMB',to:'HND',checkIn:dateFrom,checkOut:dateTo,adults:2
   },secret);
   assert.ok(token,'Valid signed selection precondition');
   const selection=await invoke(flightSelection,{body:{selectionToken:token}});
   assert.equal(selection.code,503);
   assert.match(selection.data.error,/public release/);
   const airline=await invoke(airlineOffers,{body:{action:'search',trip:{
     from:'CMB',to:'HND',checkIn:dateFrom,checkOut:dateTo,adults:2
   }}});
   assert.equal(airline.code,200);
   assert.equal(airline.data.mode,'production_locked');
   assert.equal(airline.data.offers.length,0);
   assert.equal(airline.data.status,'not_connected');
   assert.equal(calls,0);
   for(const item of [offer,search,selection,airline])
     assert.doesNotMatch(JSON.stringify(item.data),/fake-groq-provider-key|duffel_test_only-fake-token|not-a-real-provider-key-for-test/);
 }finally{globalThis.fetch=originalFetch;restore();}
});
test('production opt-in AI webhook is blocked before any secret-bearing outbound network call',async()=>{
 setProduction();
 let called=0;const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>{called++;throw Error('No metered AI calls in production');};
 try{
   const ai=await invoke(aiPlan,{body:{trip:{
     country:'Japan',city:'Tokyo',origin:'Colombo',startDate:dateFrom,endDate:dateTo,
     travelers:2,budget:1100,style:'balanced'
   }}});
   assert.equal(ai.code,503);
   assert.match(ai.data.error,/public release/);
   assert.equal(called,0);
 }finally{globalThis.fetch=originalFetch;restore();}
});
test('public-source destination research continues but Groq never runs on production',async()=>{
 setProduction();
 const originalFetch=globalThis.fetch,urls=[];
 globalThis.fetch=async url=>{
   const parsed=new URL(url);urls.push(parsed.hostname);
   if(parsed.hostname==='api.groq.com')throw Error('Unwanted billed composer');
   if(parsed.hostname==='api.open-meteo.com'){
     return new Response(JSON.stringify({
       timezone:'Asia/Tokyo',current:{temperature_2m:22,wind_speed_10m:3,time:'2026-10-15T08:00'}
     }));
   }
   if(parsed.hostname==='en.wikipedia.org'){
     return new Response(JSON.stringify({extract:'Tokyo is a city in Japan.',
       content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Tokyo'}}}));
   }
   if(parsed.hostname==='restcountries.com'){
     return new Response(JSON.stringify({currencies:{JPY:{name:'Yen'}},
       languages:{jpn:'Japanese'},timezones:['UTC+09:00']}));
   }
   throw Error('Unexpected host '+parsed.hostname);
 };
 try{
   const reply=await invoke(intelligence,{method:'GET',query:{
     destination:'Tokyo',lat:'35.6762',lon:'139.6503',countryCode:'JP',
     days:'4',budget:'150',pace:'Balanced',moods:'Culture'
   }});
   assert.equal(reply.code,200);
   assert.equal(reply.data.ok,true);
   assert.equal(reply.data.ai.ok,false);
   assert.equal(urls.includes('api.groq.com'),false,'Groq must not be reached');
   assert.equal(reply.data.location.countryCode,'JP');
 }finally{globalThis.fetch=originalFetch;restore();}
});
test('existing preview beta remains available only with previously required keys, flags and authentication',()=>{
 for(const mode of ['preview','development']){
   assert.equal(meteredProviderLocked({VERCEL:'1',VERCEL_ENV:mode}),false);
   assert.equal(meteredProviderLocked({VERCEL_ENV:'production',WAYFARER_DISABLE_METERED_PROVIDERS:'false'}),true);
 }
 const config=readFileSync(new URL('../vercel.json',import.meta.url),'utf8');
 assert.doesNotMatch(config,/api_key=|SERPAPI_API_KEY=.*[A-Za-z0-9]/);
 const source=readFileSync(new URL('../provider-production-lock.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/WAYFARER_PAID_PRODUCTION_APPROVED|unlockProduction|ENABLE_PROD/);
 assert.match(source,/This is a spend-containment guard, NOT a distributed rate limiter/);
});
test.after(()=>{restore();});
