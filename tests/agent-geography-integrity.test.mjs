import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/intelligence.js';

const previousEnv=Object.fromEntries(
  ['WAYFARER_INTELLIGENCE_AI_ENABLED','WAYFARER_AI_BETA_TOKEN','GROQ_API_KEY']
    .map(key=>[key,process.env[key]])
);
const originalFetch=globalThis.fetch;
const ACCESS='stage46-test-beta-access-code-at-least-24';
const reply=()=>({statusCode:0,headers:{},body:null,
  setHeader(name,value){this.headers[name]=value;},
  status(value){this.statusCode=value;return this;},
  json(body){this.body=body;return this;}
});
async function invoke(query,access){
  const res=reply();
  await handler({method:'GET',query,headers:access?{'x-wayfarer-beta-token':access}:{}},res);
  return res;
}
function mockSources({summaryCoordinates,extract='A source-only destination reference.',authorizeAI=false}={}){
  const observations={weatherUrls:[],wikipediaUrls:[],countryUrls:[],aiCalls:0,prompts:[]};
  globalThis.fetch=async(url,options={})=>{
    const u=new URL(url);
    if(u.hostname==='api.open-meteo.com'){
      observations.weatherUrls.push(u);
      return Response.json({timezone:'America/Chicago',current:{
        temperature_2m:20,wind_speed_10m:6,time:'2026-10-14T13:00'
      }});
    }
    if(u.hostname==='en.wikipedia.org'){
      observations.wikipediaUrls.push(u);
      return Response.json({extract,coordinates:summaryCoordinates,
        content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/'+
          u.pathname.split('/').at(-1)}}});
    }
    if(u.hostname==='restcountries.com'){
      observations.countryUrls.push(u);
      return Response.json({currencies:{USD:{name:'US Dollar'}},
        languages:{eng:'English'},timezones:['UTC-06:00']});
    }
    if(u.hostname==='api.groq.com'){
      observations.aiCalls++;
      assert.equal(authorizeAI,true,'No metered call without explicit test authorization');
      const payload=JSON.parse(options.body);
      const prompt=payload.messages[1].content;
      observations.prompts.push(prompt);
      return Response.json({choices:[{message:{content:JSON.stringify({
        title:'A guarded three-day planning draft',
        days:Array.from({length:3},(_,i)=>({
          title:'Day '+(i+1),
          summary:'Suggested exploration; independently verify attractions and transport.'
        }))
      })}}]});
    }
    throw Error('Unexpected external service: '+u.hostname);
  };
  return observations;
}
test('same-name worldwide location takes chosen US coordinates, not curated Kyoto Japan coordinates',async()=>{
  delete process.env.WAYFARER_INTELLIGENCE_AI_ENABLED;
  const calls=mockSources();
  try{
    const r=await invoke({destination:'Kyoto',countryCode:'US',lat:'40.4319',lon:'-86.9150',
      days:'3',budget:'180',pace:'Balanced'});
    assert.equal(r.statusCode,200);
    assert.equal(r.body.ok,true);
    assert.equal(r.body.location.latitude,40.4319);
    assert.equal(r.body.location.longitude,-86.915);
    assert.equal(r.body.location.countryCode,'US');
    assert.equal(r.body.location.basis,'selected-map-coordinates');
    assert.equal(calls.weatherUrls.length,1);
    assert.equal(calls.weatherUrls[0].searchParams.get('latitude'),'40.4319');
    assert.equal(calls.weatherUrls[0].searchParams.get('longitude'),'-86.915');
    assert.match(calls.countryUrls[0].pathname,/\/US$/);
    assert.equal(calls.wikipediaUrls.length,0,
      'Legacy Wikipedia/Kyoto page must not be attributed to a different place');
    assert.equal(r.body.place.ok,false);
    assert.equal(r.body.ai.ok,false);
    assert.equal(calls.aiCalls,0);
    assert.equal(r.headers['Cache-Control'],'no-store');
  }finally{globalThis.fetch=originalFetch;}
});
test('canonical bundled Kyoto fallback works only for its correct country when coordinates are absent',async()=>{
  delete process.env.WAYFARER_INTELLIGENCE_AI_ENABLED;
  const calls=mockSources({summaryCoordinates:{lat:35.0116,lon:135.7681}});
  try{
    const good=await invoke({destination:'Kyoto',countryCode:'JP',days:'3',budget:'180'});
    assert.equal(good.statusCode,200);
    assert.equal(good.body.location.basis,'bundled-curated-reference');
    assert.equal(good.body.location.latitude,35.0116);
    assert.equal(good.body.location.longitude,135.7681);
    assert.equal(good.body.place.ok,true);
    assert.equal(good.body.place.geographyVerified,true);
    assert.equal(calls.weatherUrls.length,1);
    assert.equal(calls.wikipediaUrls.length,1);
    const mismatch=await invoke({destination:'Kyoto',countryCode:'US',days:'3',budget:'180'});
    assert.equal(mismatch.statusCode,400,
      'Name-only fallback cannot choose an unrelated national geography');
    const partial=await invoke({destination:'Kyoto',countryCode:'JP',lat:'35.1',days:'3',budget:'180'});
    assert.equal(partial.statusCode,400,'Incomplete coordinate pairs are not map identity');
    assert.equal(calls.weatherUrls.length,1);
  }finally{globalThis.fetch=originalFetch;}
});
test('contradictory Wikipedia coordinates are rejected and cannot contaminate the paid AI prompt',async()=>{
  process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='true';
  process.env.WAYFARER_AI_BETA_TOKEN=ACCESS;
  process.env.GROQ_API_KEY='fake-test-key-not-a-real-provider-credential';
  const contamination='UNSUPPORTED ENGLAND HOTEL OFFER $5';
  const calls=mockSources({
    summaryCoordinates:{lat:51.5074,lon:-0.1278},extract:contamination,
    authorizeAI:true
  });
  try{
    const r=await invoke({destination:'Bali',countryCode:'ID',lat:'-8.5069',lon:'115.2625',
      days:'3',budget:'180',pace:'Balanced'},ACCESS);
    assert.equal(r.statusCode,200);
    assert.equal(r.body.place.ok,false);
    assert.match(r.body.place.error,/coordinates do not match/i);
    assert.equal(r.body.ai.ok,true);
    assert.equal(calls.aiCalls,1,'Authorized composer remains a single explicit call');
    assert.equal(calls.prompts.some(x=>x.includes(contamination)),false,
      'Conflicting source content must not enter AI source context');
    assert.ok(r.body.verification.flags.some(x=>/encyclopedia context could not be verified/i.test(x)));
    assert.equal(r.body.location.countryCode,'ID');
  }finally{globalThis.fetch=originalFetch;}
});
test('name-only Wikipedia pages remain labeled as geographically unverified, including in the AI prompt',async()=>{
  process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='true';
  process.env.WAYFARER_AI_BETA_TOKEN=ACCESS;
  process.env.GROQ_API_KEY='fake-test-key-not-a-real-provider-credential';
  const unverified='AMBIGUOUS CITY HOTEL HAS CONFIRMED BOOKING';
  const calls=mockSources({extract:unverified,authorizeAI:true});
  try{
    const r=await invoke({destination:'Osaka',countryCode:'JP',lat:'34.6937',lon:'135.5023',
      days:'3',budget:'180'},ACCESS);
    assert.equal(r.statusCode,200);
    assert.equal(r.body.place.ok,true);
    assert.equal(r.body.place.geographyVerified,false);
    assert.equal(r.body.place.geographyBasis,'article-name-only');
    assert.ok(r.body.verification.flags.some(x=>/name-only reference/.test(x)));
    assert.equal(calls.aiCalls,1);
    assert.ok(calls.prompts[0].includes('article name matched')||calls.prompts[0].includes('Article name matched'));
    assert.doesNotMatch(calls.prompts[0],/AMBIGUOUS CITY HOTEL HAS CONFIRMED BOOKING/);
  }finally{globalThis.fetch=originalFetch;}
});
test.after(()=>{
  globalThis.fetch=originalFetch;
  for(const [key,value] of Object.entries(previousEnv)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
