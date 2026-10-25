import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/travel-offers.mjs';

const variables=['VERCEL_ENV','VERCEL_TARGET_ENV','WAYFARER_DISABLE_METERED_PROVIDERS','WAYFARER_AI_BETA_TOKEN','WAYFARER_TRAVEL_ENABLED','SERPAPI_API_KEY'];
const previous=Object.fromEntries(variables.map(key=>[key,process.env[key]]));
const beta='private-beta-test-token-for-requests';
const key='not-a-real-serp-api-key';
const start=new Date(Date.now()+34*86400000).toISOString().slice(0,10);
const end=new Date(Date.now()+39*86400000).toISOString().slice(0,10);
const trip={country:'Japan',city:'Tokyo',origin:'Colombo',originAirport:'CMB',destinationAirport:'HND',startDate:start,endDate:end,travelers:2,budget:1200,flightBudget:900,style:'balanced'};

function prepare() {
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_TARGET_ENV='preview';
  delete process.env.WAYFARER_DISABLE_METERED_PROVIDERS;
  process.env.WAYFARER_AI_BETA_TOKEN=beta;
  process.env.WAYFARER_TRAVEL_ENABLED='true';
  process.env.SERPAPI_API_KEY=key;
}
function fakeResponse() {
  return {code:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this;},status(s){this.code=s;return this;},json(b){this.body=b;return this;}};
}
async function request(mock) {
  const originalFetch=globalThis.fetch, res=fakeResponse();
  globalThis.fetch=mock;
  try { await handler({method:'POST',headers:{'x-wayfarer-beta-token':beta},body:{trip}},res);return res; }
  finally {globalThis.fetch=originalFetch;}
}

test('authenticated SerpApi requests reject redirects, preserving private key',async()=>{
  prepare();
  const seen=[];
  const res=await request(async (url,init)=>{
    seen.push({url:String(url),policy:init.redirect});
    return Response.redirect('https://example.invalid/receiver',302);
  });
  assert.equal(res.code,200);
  assert.equal(res.body.mode,'serpapi_search');
  assert.equal(res.body.flights.status,'unavailable');
  assert.equal(res.body.hotels.status,'unavailable');
  assert.equal(seen.length,2);
  assert.ok(seen.every(x=>x.policy==='error' && new URL(x.url).hostname==='serpapi.com'));
  assert.ok(!JSON.stringify(res.body).includes(key));
});

test('advertised oversized response rejects without opening stream',async()=>{
  prepare();
  let opened=0;
  const res=await request(async()=>({
    ok:true,status:200,
    headers:{get(name){return name==='content-length'?'2000001':null;}},
    body:{getReader(){opened++;throw Error('should never read');}}
  }));
  assert.equal(res.code,200);
  assert.equal(opened,0);
  assert.equal(res.body.flights.status,'unavailable');
  assert.equal(res.body.hotels.status,'unavailable');
});

test('streamed response exceeds byte cap even with misleading Content-Length',async()=>{
  prepare();
  const res=await request(async()=>new Response('Q'.repeat(2000001),{status:200,headers:{'content-length':'12'}}));
  assert.equal(res.code,200);
  assert.equal(res.body.flights.status,'unavailable');
  assert.equal(res.body.hotels.status,'unavailable');
  assert.ok(!JSON.stringify(res.body).includes('Q'.repeat(500)));
});

test.after(()=>{
  for(const [name,value] of Object.entries(previous)){
    if(value===undefined)delete process.env[name];
    else process.env[name]=value;
  }
});
