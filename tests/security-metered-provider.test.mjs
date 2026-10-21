import test from 'node:test';
import assert from 'node:assert/strict';
import { meteredProviderLocked } from '../provider-production-lock.mjs';
import aiPlan from '../api/ai-plan.mjs';
import travelSearch from '../api/travel-search.js';
import travelOffers from '../api/travel-offers.mjs';
import intelligence from '../api/intelligence.js';

const envNames=['VERCEL_ENV','VERCEL_TARGET_ENV','VERCEL','WAYFARER_DISABLE_METERED_PROVIDERS',
  'WAYFARER_AI_ENABLED','WAYFARER_INTELLIGENCE_AI_ENABLED','WAYFARER_AI_BETA_TOKEN',
  'WAYFARER_TRAVEL_ENABLED','SERPAPI_API_KEY','GROQ_API_KEY','N8N_WEBHOOK_URL'];
const originalEnv=Object.fromEntries(envNames.map(x=>[x,process.env[x]]));
const oldFetch=globalThis.fetch;
test.after(()=>{globalThis.fetch=oldFetch;for(const [key,value] of Object.entries(originalEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
function response(){return{statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(s){this.statusCode=s;return this;},json(b){this.body=b;return this;}}}
function configure(){process.env.VERCEL_ENV='production';process.env.VERCEL_TARGET_ENV='production';process.env.VERCEL='1';process.env.WAYFARER_AI_ENABLED='true';process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='true';process.env.WAYFARER_TRAVEL_ENABLED='true';process.env.WAYFARER_AI_BETA_TOKEN='private-test-only-beta-token-987654321';process.env.GROQ_API_KEY='fake-not-real-key';process.env.SERPAPI_API_KEY='fake-not-real-key';process.env.N8N_WEBHOOK_URL='https://example.com/webhook/test';}
const start=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
const end=new Date(Date.now()+34*86400000).toISOString().slice(0,10);
const headers={'x-wayfarer-beta-token':'private-test-only-beta-token-987654321'};
test('production is always locked regardless of keys or flags',()=>{
  for(const env of [{VERCEL_ENV:'production'},{VERCEL_TARGET_ENV:'production'},{VERCEL:'1'},{WAYFARER_DISABLE_METERED_PROVIDERS:'true'}])assert.equal(meteredProviderLocked(env),true);
  assert.equal(meteredProviderLocked({VERCEL:'1',VERCEL_ENV:'preview'}),false);
});
test('production never calls metered provider through travel or AI APIs',async()=>{
  configure(); let called=0;
  globalThis.fetch=async()=>{called++;throw Error('Unexpected paid provider network call');};
  const a=response();await aiPlan({method:'POST',headers,body:{}},a);
  assert.equal(a.statusCode,503);
  const s=response();await travelSearch({method:'POST',headers,body:{trip:{from:'CMB',to:'HND',checkIn:start,checkOut:end,destination:'Tokyo',adults:2,flightBudget:700,groundBudget:700}}},s);
  assert.equal(s.statusCode,200);assert.equal(s.body.mode,'production_locked');
  const o=response();await travelOffers({method:'POST',headers,body:{trip:{country:'Japan',city:'Tokyo',origin:'Colombo',originAirport:'CMB',destinationAirport:'HND',startDate:start,endDate:end,travelers:2,budget:800,flightBudget:1000,style:'balanced'}}},o);
  assert.equal(o.statusCode,200);assert.equal(o.body.mode,'production_locked');
  assert.equal(called,0);
});
test('destination research remains accessible with a disabled AI composer',async()=>{
  configure();
  const hosts=[];
  globalThis.fetch=async url=>{
    const host=new URL(url).hostname;hosts.push(host);
    if(host==='api.groq.com')throw Error('Billed AI call not allowed');
    if(host==='api.open-meteo.com')return new Response(JSON.stringify({timezone:'Asia/Tokyo',current:{temperature_2m:25,wind_speed_10m:2,time:'2026-10-21T08:00'}}),{status:200});
    if(host==='en.wikipedia.org')return new Response(JSON.stringify({extract:'Kyoto is a historic city.',content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Kyoto'}}}),{status:200});
    if(host==='restcountries.com')return new Response(JSON.stringify([{currencies:{JPY:{name:'Japanese yen'}},languages:{jpn:'Japanese'},timezones:['UTC+09:00']}]),{status:200});
    throw Error('Unexpected host');
  };
  const res=response();
  await intelligence({method:'GET',headers,query:{destination:'Kyoto',days:'3',budget:'200'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.ai.ok,false);
  assert.equal(hosts.includes('api.groq.com'),false);
  assert.ok(hosts.includes('api.open-meteo.com'));
});
