import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {API_METHOD_PROBES} from '../api-method-probes.mjs';
import intelligence from '../api/intelligence.js';
import explore from '../api/explore.js';
import hotels from '../api/hotels.js';
import travelSearch from '../api/travel-search.js';
import aiPlan from '../api/ai-plan.mjs';
import travelOffers from '../api/travel-offers.mjs';
import flightSelection from '../api/flight-selection.mjs';
import airlineOffers from '../api/airline-offers.mjs';

const handlers={
 '/api/intelligence':intelligence,
 '/api/explore':explore,
 '/api/hotels':hotels,
 '/api/travel-search':travelSearch,
 '/api/ai-plan':aiPlan,
 '/api/travel-offers':travelOffers,
 '/api/flight-selection':flightSelection,
 '/api/airline-offers':airlineOffers
};
const privatePaths=API_METHOD_PROBES.filter(x=>x.accepted==='POST').map(x=>x.path);
const sourcePaths=API_METHOD_PROBES.filter(x=>x.accepted==='GET').map(x=>x.path);
const savedFetch=globalThis.fetch;
const envKeys=['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV',
 'WAYFARER_AI_BETA_TOKEN','WAYFARER_AI_ENABLED','WAYFARER_INTELLIGENCE_AI_ENABLED',
 'WAYFARER_TRAVEL_ENABLED','WAYFARER_DUFFEL_ENABLED','GROQ_API_KEY',
 'SERPAPI_API_KEY','DUFFEL_ACCESS_TOKEN','N8N_WEBHOOK_URL','N8N_WEBHOOK_AUTH'];
const savedEnv=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
const fixtureSecret=['unit','test','synthetic','invalid','private','access','token'].join('-');
const fakeSupplier=['synthetic','provider','key','never','used'].join('-');
const fakeWebhook=['synthetic','workflow','secret','never','used'].join('-');
let outbound=0;
const installGuard=()=>{
 process.env.VERCEL='1';
 process.env.VERCEL_ENV='preview';
 process.env.VERCEL_TARGET_ENV='preview';
 process.env.WAYFARER_AI_ENABLED='true';
 process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='true';
 process.env.WAYFARER_TRAVEL_ENABLED='true';
 process.env.WAYFARER_DUFFEL_ENABLED='true';
 process.env.WAYFARER_AI_BETA_TOKEN=fixtureSecret;
 process.env.SERPAPI_API_KEY=fakeSupplier;
 process.env.GROQ_API_KEY=fakeSupplier;
 process.env.DUFFEL_ACCESS_TOKEN='duffel_test_'+fakeSupplier;
 process.env.N8N_WEBHOOK_URL='https://example.invalid/webhook/synthetic';
 process.env.N8N_WEBHOOK_AUTH=fakeWebhook;
 outbound=0;
 globalThis.fetch=async()=>{outbound++;throw Error('Provider call prohibited during safe input validation');};
};
const response=()=>({
 code:undefined,data:undefined,headers:{},
 setHeader(key,value){this.headers[key.toLowerCase()]=value;return this;},
 status(code){this.code=code;return this;},
 json(body){this.data=body;return this;}
});
async function invoke(route,{method,body,query,token}={}){
 const res=response();
 await handlers[route]({
   method:method??(privatePaths.includes(route)?'POST':'GET'),
   body,query:query??{},
   headers:token?{'x-wayfarer-beta-token':token}:{}
 },res);
 return res;
}
const checkResponse=(path,res,expected)=>{
 assert.equal(res.code,expected,path);
 assert.equal(res.data?.ok,false,path);
 assert.equal(res.headers['cache-control'],'no-store',path);
 assert.equal(res.headers['x-content-type-options'],'nosniff',path);
 const printed=JSON.stringify(res.data);
 for(const item of [fixtureSecret,fakeSupplier,fakeWebhook]){
   assert.ok(!printed.includes(item),'Private test credentials must never be reflected from '+path);
 }
 assert.equal(outbound,0,'Invalid input or unauthorized access must never run provider for '+path);
};
after(()=>{
 globalThis.fetch=savedFetch;
 for(const [key,v] of Object.entries(savedEnv)){
   if(v===undefined)delete process.env[key];else process.env[key]=v;
 }
});

test('all eight source routes exist with exact method declarations before probing',()=>{
 const c=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(API_METHOD_PROBES.length,8);
 assert.equal(sourcePaths.length,3);
 assert.equal(privatePaths.length,5);
 for(const entry of API_METHOD_PROBES){
  assert.equal(typeof handlers[entry.path],'function',entry.path);
  assert.ok(Object.hasOwn(c.functions,entry.source),entry.source);
 }
});
test('all five private accepted POST routes reject missing beta auth before provider access',async()=>{
 installGuard();
 for(const path of privatePaths){
  const res=await invoke(path,{body:{trip:{destination:'Kyoto'}}});
  checkResponse(path,res,401);
 }
});
test('all five private POST routes reject malformed JSON with valid synthetic beta auth',async()=>{
 installGuard();
 for(const path of privatePaths){
  const res=await invoke(path,{token:fixtureSecret,body:'{"trip":'});
  checkResponse(path,res,400);
 }
});
test('all five private POST routes reject empty structured payloads with valid beta auth',async()=>{
 installGuard();
 for(const path of privatePaths){
  const res=await invoke(path,{token:fixtureSecret,body:{}});
  checkResponse(path,res,400);
 }
});
test('all five private POST routes reject oversized structured payloads without provider calls',async()=>{
 installGuard();
 const huge={trip:{destination:'Kyoto'},padding:'x'.repeat(50_000)};
 for(const path of privatePaths){
  const res=await invoke(path,{token:fixtureSecret,body:huge});
  checkResponse(path,res,400);
 }
});
test('public accepted GET endpoints reject obviously malformed user inputs without fetching geography',async()=>{
 installGuard();
 const cases=[
  ['/api/intelligence',{destination:'Tokyo',lat:'invalid',lon:'139.69'}],
  ['/api/intelligence',{destination:'Kyoto',lat:'',lon:'135.7'}],
  ['/api/explore',{q:''}],
  ['/api/explore',{q:'A'}],
  ['/api/hotels',{lat:'abc',lon:'139.7',checkIn:'2026-10-28',checkOut:'2026-10-30'}],
  ['/api/hotels',{lat:'91',lon:'181',checkIn:'2026-10-28',checkOut:'2026-10-30'}]
 ];
 for(const [path,query] of cases){
  const res=await invoke(path,{query});
  checkResponse(path,res,400);
 }
});
test('no accepted-input verification fixture calls suppliers or makes live booking claims',()=>{
 const src=readFileSync(new URL('../tests/api-safe-input-gates.test.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/\.fetch\s*\(\s*['"]https?:/);
 assert.doesNotMatch(src,/\b(book|charge|purchase|createOrder)\s*\(/i);
 assert.equal(sourcePaths.length+privatePaths.length,8);
});
