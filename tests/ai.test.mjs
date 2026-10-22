import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/ai-plan.mjs';

const original = { ...process.env };
const validTrip = {country:'Japan',city:'Tokyo',origin:'Colombo',startDate:'2026-12-01',endDate:'2026-12-04',travelers:2,budget:1200,style:'balanced'};
function response() {
  return {
    headers: {}, code: 200, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.code = value; return this; },
    json(value) { this.body = value; return this; }
  };
}
function configure() {
  process.env.WAYFARER_AI_ENABLED='true';
  process.env.WAYFARER_AI_BETA_TOKEN='a-private-beta-passcode';
  process.env.N8N_WEBHOOK_URL='https://automation.example.com/webhook/wayfarer-groq-plan';
  process.env.N8N_WEBHOOK_AUTH='a-long-secret-for-n8n-only';
}
async function call(body, token='a-private-beta-passcode', method='POST') {
  const res = response();
  await handler({method,headers:{'x-wayfarer-beta-token':token},body},res);
  return res;
}
test('AI route is closed unless explicitly enabled', async () => {
  delete process.env.WAYFARER_AI_ENABLED;
  const result=await call({trip:validTrip});
  assert.equal(result.code,503);
  assert.equal(result.headers['Cache-Control'],'no-store');
});
test('invalid passcode denies upstream access', async () => {
  configure();
  const result=await call({trip:validTrip},'wrong');
  assert.equal(result.code,401);
});
test('invalid dates and missing fields are rejected', async () => {
  configure();
  const result=await call({trip:{...validTrip,endDate:'not-a-date'}});
  assert.equal(result.code,400);
});
test('non-POST methods are not accepted', async () => {
  configure();
  const result=await call({trip:validTrip},'a-private-beta-passcode','GET');
  assert.equal(result.code,405);
});
test('valid response is normalized; credentials are not exposed', async () => {
  configure();
  const originalFetch=globalThis.fetch;
  let seen;
  try {
    globalThis.fetch=async (url, init) => {
      seen={url,init};
      return new Response(JSON.stringify({ok:true,agents:[
        {name:'Destination researcher',findings:'Visit parks with verified opening hours.'},
        {name:'Flight & hotel researcher',findings:'Search airline and hotel websites.'},
        {name:'Itinerary composer',findings:'Allow time to settle after arrival.'}
      ],sourceUrl:'https://en.wikipedia.org/wiki/Tokyo'}),{status:200});
    };
    const result=await call({trip:validTrip});
    assert.equal(result.code,200);
    assert.equal(result.body.agents.length,3);
    assert.equal(result.body.sourceUrl,'https://en.wikipedia.org/wiki/Tokyo');
    assert.equal(seen.init.headers['X-Wayfarer-Secret'],'a-long-secret-for-n8n-only');
    assert.equal(seen.url,'https://automation.example.com/webhook/wayfarer-groq-plan');
    assert.equal(JSON.stringify(result.body).includes('a-long-secret'),false);
  } finally { globalThis.fetch=originalFetch; }
});
test('untrusted upstream URLs are removed', async () => {
  configure();
  const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,agents:[1,2,3].map(i=>({name:'Agent'+i,findings:'Safe guidance'})),sourceUrl:'https://evil.example/'}),{status:200});
    const result=await call({trip:validTrip});
    assert.equal(result.code,200);
    assert.equal(result.body.sourceUrl,null);
  } finally {globalThis.fetch=originalFetch;}
});
test.after(() => {
  for(const key of ['WAYFARER_AI_ENABLED','WAYFARER_AI_BETA_TOKEN','N8N_WEBHOOK_URL','N8N_WEBHOOK_AUTH']) {
    if(original[key]===undefined) delete process.env[key];
    else process.env[key]=original[key];
  }
});

test('long itinerary remains intact instead of silently truncating at 1600 characters', async () => {
  configure();
  const originalFetch=globalThis.fetch;
  const longReport='Day 1: arrival and rest. '+'Day 2 onward: research alternatives. '.repeat(100)+'End of ground budget guidance.';
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,agents:[
      {name:'Destination researcher',findings:'Verify places from official sources.'},
      {name:'Flight & hotel researcher',findings:'Verify flight and hotel prices with providers.'},
      {name:'Journey composer',findings:longReport}
    ]}),{status:200});
    const response=await call({trip:validTrip});
    assert.equal(response.code,200);
    assert.equal(response.body.agents[2].findings,longReport);
    assert.ok(longReport.length>1600);
  } finally { globalThis.fetch=originalFetch; }
});
test('oversized AI reports are rejected instead of returning incomplete text',async()=>{
  configure();
  const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,agents:[
      {name:'Destination researcher',findings:'Known facts.'},
      {name:'Flight & hotel researcher',findings:'Check providers.'},
      {name:'Journey composer',findings:'X'.repeat(6501)}
    ]}),{status:200});
    const result=await call({trip:validTrip});
    assert.equal(result.code,502);
  } finally {globalThis.fetch=originalFetch;}
});

test('AI webhook refuses redirects before secret-bearing requests follow another origin', async () => {
  configure();
  const originalFetch=globalThis.fetch;
  let redirectPolicy;
  try {
    globalThis.fetch=async (_url, init)=>{
      redirectPolicy=init.redirect;
      return Response.redirect('https://other.example.org/collect',302);
    };
    const result=await call({trip:validTrip});
    assert.equal(redirectPolicy,'error');
    assert.equal(result.code,502);
    assert.equal(JSON.stringify(result.body).includes('a-long-secret-for-n8n-only'),false);
  } finally {globalThis.fetch=originalFetch;}
});

test('AI webhook rejects streamed response above 32KiB regardless of declared length', async () => {
  configure();
  const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response('x'.repeat(33000),{status:200,headers:{'content-length':'10'}});
    const result=await call({trip:validTrip});
    assert.equal(result.code,502);
    assert.match(result.body.error,/invalid response/);
  } finally {globalThis.fetch=originalFetch;}
});

test('AI webhook rejects oversized Content-Length without reading the body', async () => {
  configure();
  const originalFetch=globalThis.fetch;
  let readerAccessed=false;
  try {
    globalThis.fetch=async()=>({
      ok:true,
      headers:{get:(name)=>name==='content-length'?'32001':null},
      body:{getReader(){readerAccessed=true;throw Error('should not be read')}}
    });
    const result=await call({trip:validTrip});
    assert.equal(result.code,502);
    assert.equal(readerAccessed,false);
  } finally {globalThis.fetch=originalFetch;}
});
