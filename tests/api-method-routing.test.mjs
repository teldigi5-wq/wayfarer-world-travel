import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {API_METHOD_PROBES} from '../api-method-probes.mjs';
import {validateApiPreview,inspectApiMethodRoutes} from '../scripts/verify-vercel-api-routes.mjs';
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
const base='https://wayfarer-world-travel-pr58-audit.vercel.app/';
const hostname=new URL(base).hostname;
const originalFetch=globalThis.fetch;
const envKeys=['WAYFARER_AI_BETA_TOKEN','SERPAPI_API_KEY','GROQ_API_KEY',
 'DUFFEL_ACCESS_TOKEN','N8N_WEBHOOK_AUTH','N8N_WEBHOOK_URL','WAYFARER_AI_ENABLED',
 'WAYFARER_INTELLIGENCE_AI_ENABLED','WAYFARER_TRAVEL_ENABLED','WAYFARER_DUFFEL_ENABLED',
 'VERCEL_ENV','VERCEL_TARGET_ENV'];
const originalEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
after(()=>{
 globalThis.fetch=originalFetch;
 for(const [key,value] of Object.entries(originalEnv)){
   if(value===undefined)delete process.env[key];
   else process.env[key]=value;
 }
});
const secureFixture=()=>{
  process.env.VERCEL_ENV='preview';
  process.env.WAYFARER_AI_ENABLED='true';
  process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='true';
  process.env.WAYFARER_TRAVEL_ENABLED='true';
  process.env.WAYFARER_DUFFEL_ENABLED='true';
  process.env.WAYFARER_AI_BETA_TOKEN='fake-beta-fixture-only-not-a-real-token';
  process.env.SERPAPI_API_KEY='fake-test-only-not-a-real-provider-key';
  process.env.GROQ_API_KEY='fake-test-only-not-a-real-groq-key';
  process.env.DUFFEL_ACCESS_TOKEN='fake-test-only-not-a-real-duffel-key';
  process.env.N8N_WEBHOOK_AUTH='fake-test-only-not-a-real-webhook-token';
  process.env.N8N_WEBHOOK_URL='https://automation.example.invalid/webhook/fixture';
};
function fakeResponse(){
 return {
  statusCode:null,body:null,headers:{},
  setHeader(key,value){this.headers[key.toLowerCase()]=value;return this;},
  status(code){this.statusCode=code;return this;},
  json(value){this.body=value;return this;}
 };
}
function syntheticNetwork({unauthorized=false,wrongMethod=false,missingMime=false}={}){
 const calls=[];
 const send=async(url,options)=>{
   calls.push({url:String(url),options});
   const pathname=new URL(url).pathname;
   const found=API_METHOD_PROBES.find(route=>route.path===pathname);
   const code=unauthorized?401:wrongMethod===pathname?200:found?405:404;
   const headers={
    'content-type':missingMime===pathname?'text/html':'application/json',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff'
   };
   if(found?.allow)headers.allow=found.allow;
   return new Response(null,{status:code,headers});
 };
 return {send,calls};
}
test('eight declared Vercel function routes have matching real handler modules and rejected opposite verbs',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(API_METHOD_PROBES.length,8);
 assert.equal(Object.keys(config.functions).length,8);
 assert.equal(new Set(API_METHOD_PROBES.map(x=>x.path)).size,8);
 for(const route of API_METHOD_PROBES){
   assert.equal(typeof handlers[route.path],'function');
   assert.ok(Object.hasOwn(config.functions,route.source),route.source);
   assert.notEqual(route.accepted,route.probe);
   assert.ok(['GET','POST'].includes(route.accepted));
   assert.ok(['GET','POST'].includes(route.probe));
   assert.equal(route.accepted==='GET'?'POST':'GET',route.probe);
 }
});
test('actual eight serverless handler method gates reject requests before any provider network calls',async()=>{
 secureFixture();
 let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('No paid or public provider may run');};
 for(const route of API_METHOD_PROBES){
   const res=fakeResponse();
   await handlers[route.path]({
      method:route.probe,headers:{'x-wayfarer-beta-token':process.env.WAYFARER_AI_BETA_TOKEN},
      body:{trip:{destination:'Kyoto',country:'Japan'}},query:{destination:'Kyoto'}
   },res);
   assert.equal(res.statusCode,405,route.path);
   assert.equal(res.body?.ok,false,route.path);
   assert.equal(res.headers['cache-control'],'no-store',route.path);
   assert.equal(res.headers['x-content-type-options'],'nosniff',route.path);
   if(route.allow)assert.equal(res.headers.allow,route.allow,route.path);
 }
 assert.equal(calls,0,'No supplier or third-party research can be invoked');
});
test('API method verifier observes all eight routes with no request bodies or accepted verbs',async()=>{
 const http=syntheticNetwork();
 const result=await inspectApiMethodRoutes({url:base,expectedHostname:hostname,fetchFn:http.send});
 assert.equal(result.verdict,'API_METHOD_GATE_EVIDENCE_ONLY');
 assert.deepEqual(result.counts,{passed:8,total:8});
 assert.equal(result.exactCommitVerified,false);
 assert.equal(result.acceptedApiMethodsVerified,false);
 assert.equal(result.providerCallsVerified,false);
 assert.equal(result.productionApproval,false);
 assert.equal(http.calls.length,8);
 for(const req of http.calls){
   const path=new URL(req.url).pathname;
   const route=API_METHOD_PROBES.find(x=>x.path===path);
   assert.ok(route);
   assert.equal(req.options.method,route.probe);
   assert.equal(req.options.body,undefined);
   assert.equal(req.options.headers,undefined);
   assert.equal(req.options.credentials,'omit');
   assert.equal(req.options.redirect,'error');
   assert.equal(req.options.referrerPolicy,'no-referrer');
 }
});
test('404/misconfigured route or unexpected 200 is never reported as verified',async()=>{
 for(const settings of [{wrongMethod:'/api/ai-plan'},{missingMime:'/api/travel-offers'}]){
   const http=syntheticNetwork(settings);
   const result=await inspectApiMethodRoutes({url:base,expectedHostname:hostname,fetchFn:http.send});
   assert.equal(result.verdict,'FAIL');
   assert.ok(result.counts.passed<8);
 }
});
test('protected Preview and total network outages stay inconclusive rather than passing',async()=>{
 const blocked=await inspectApiMethodRoutes({url:base,expectedHostname:hostname,
   fetchFn:syntheticNetwork({unauthorized:true}).send});
 assert.equal(blocked.verdict,'INCONCLUSIVE_PROTECTED');
 assert.equal(blocked.counts.passed,0);
 const outage=await inspectApiMethodRoutes({url:base,expectedHostname:hostname,
   fetchFn:async()=>{throw Error('synthetic offline');}});
 assert.equal(outage.verdict,'INCONCLUSIVE');
 assert.equal(outage.counts.passed,0);
 assert.ok(outage.probes.every(x=>x.result==='INCONCLUSIVE_NETWORK'));
});
test('production and arbitrary, mismatched or unauthenticated Preview origins are rejected',()=>{
 assert.throws(()=>validateApiPreview('https://wayfarer-world-travel.vercel.app/',
   'wayfarer-world-travel.vercel.app'),/Production/);
 assert.throws(()=>validateApiPreview(base,null),/hostname required/);
 assert.throws(()=>validateApiPreview(base,'wayfarer-world-travel-fake.vercel.app'),/match/i);
 assert.throws(()=>validateApiPreview('https://evil.example/',hostname));
 assert.throws(()=>validateApiPreview('https://'+hostname+'/foo',hostname));
 assert.equal(validateApiPreview(base,hostname),new URL(base).origin);
});
test('the routed smoke implementation cannot call accepted methods or inspect response bodies',()=>{
 const src=readFileSync(new URL('../scripts/verify-vercel-api-routes.mjs',import.meta.url),'utf8');
 assert.match(src,/method:target.probe/);
 assert.match(src,/redirect:'error'/);
 assert.doesNotMatch(src,/\.text\(\)|\.json\(\)|\.arrayBuffer\(\)|method:target.accepted|body:JSON/);
 assert.doesNotMatch(src,/\b(fetch|http)s?:\/\/serpapi|api\.duffel|api\.groq/);
});
