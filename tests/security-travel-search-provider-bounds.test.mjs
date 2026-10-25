import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/travel-search.js';

const before=Object.fromEntries([
  'VERCEL_ENV','VERCEL_TARGET_ENV','WAYFARER_DISABLE_METERED_PROVIDERS',
  'WAYFARER_AI_BETA_TOKEN','WAYFARER_TRAVEL_ENABLED','SERPAPI_API_KEY'
].map(name=>[name,process.env[name]]));
const token='test-secret-token-for-private-beta-only';
const secret='fixture-serpapi-key-not-real';
const start=new Date(Date.now()+40*86400000).toISOString().slice(0,10);
const end=new Date(Date.now()+44*86400000).toISOString().slice(0,10);
const trip={from:'CMB',to:'HND',destination:'Tokyo',checkIn:start,checkOut:end,adults:2,flightBudget:1000,groundBudget:1000};

function configure() {
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_TARGET_ENV='preview';
  delete process.env.WAYFARER_DISABLE_METERED_PROVIDERS;
  process.env.WAYFARER_AI_BETA_TOKEN=token;
  process.env.WAYFARER_TRAVEL_ENABLED='true';
  process.env.SERPAPI_API_KEY=secret;
}
async function run(fetchMock,peer) {
  const originalFetch=globalThis.fetch;
  const res={statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(p){this.body=p;return this}};
  globalThis.fetch=fetchMock;
  try {
    await handler({method:'POST',headers:{'x-wayfarer-beta-token':token,'x-forwarded-for':peer},body:{trip}},res);
    return res;
  } finally {globalThis.fetch=originalFetch}
}

test('private SerpApi requests explicitly forbid cross-origin redirects',async()=>{
  configure();
  const seen=[];
  const response=await run(async (url,init)=>{
    seen.push({url:String(url),policy:init.redirect});
    return Response.redirect('https://untrusted.invalid/collect',302);
  },'198.51.100.231');
  assert.equal(response.statusCode,200);
  assert.equal(response.body.mode,'search_only');
  assert.equal(response.body.flights.status,'unavailable');
  assert.equal(response.body.hotels.status,'unavailable');
  assert.equal(seen.length,2);
  assert.ok(seen.every(x=>x.policy==='error'));
  assert.ok(seen.every(x=>new URL(x.url).hostname==='serpapi.com'));
  assert.ok(!JSON.stringify(response.body).includes(secret));
});

test('announced oversized SerpApi response is refused before reading its body',async()=>{
  configure();
  let readCount=0;
  const response=await run(async()=>({
    ok:true,status:200,
    headers:{get:name=>name==='content-length'?'1500001':null},
    body:{getReader(){readCount++;throw Error('must not read oversized body')}}
  }),'198.51.100.232');
  assert.equal(response.statusCode,200);
  assert.equal(readCount,0);
  assert.equal(response.body.flights.status,'unavailable');
  assert.equal(response.body.hotels.status,'unavailable');
});

test('streamed data exceeding the byte cap is rejected despite a small declared size',async()=>{
  configure();
  const response=await run(async()=>new Response('X'.repeat(1500001),{
    status:200,headers:{'content-length':'12'}
  }),'198.51.100.233');
  assert.equal(response.statusCode,200);
  assert.equal(response.body.flights.status,'unavailable');
  assert.equal(response.body.hotels.status,'unavailable');
  assert.ok(!JSON.stringify(response.body).includes('X'.repeat(500)));
});

test.after(()=>{
  for(const [k,v] of Object.entries(before)){
    if(v===undefined)delete process.env[k];
    else process.env[k]=v;
  }
});
