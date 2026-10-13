import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/intelligence.js';
import {verificationSummary,checkedDate,validHttpsSource} from '../agent-runtime.mjs';
import {readFileSync} from 'node:fs';

const originalEnv={...process.env};
const realFetch=globalThis.fetch;
const SECRET='test-private-journey-access-code-12345';
const query={destination:'Tokyo',lat:'35.6762',lon:'139.6503',
  countryCode:'JP',days:'4',budget:'150',pace:'Balanced',moods:'Culture'};
const html=readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');
const res=()=>({code:200,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.code=n;return this;},
  json(v){this.body=v;return this;}});
async function call(params=query,header) {
  const reply=res();
  await handler({method:'GET',query:params,
    headers:header?{'x-wayfarer-beta-token':header}:{}
  },reply);
  return reply;
}
function suppliers({failWeather=false,failWiki=false,failAI=false}={}){
  const visits={weather:0,wiki:0,country:0,ai:0};
  globalThis.fetch=async (url,opts={})=>{
    const u=new URL(url);
    if(u.hostname==='api.open-meteo.com'){
      visits.weather++;
      if(failWeather)throw TypeError('Network unavailable');
      return new Response(JSON.stringify({timezone:'Asia/Tokyo',
        current:{temperature_2m:18.4,wind_speed_10m:4.2,time:'2026-10-13T08:45'}}));
    }
    if(u.hostname==='en.wikipedia.org'){
      visits.wiki++;
      if(failWiki)return new Response('Unavailable',{status:503});
      return new Response(JSON.stringify({extract:'Tokyo is Japan capital city.',
        content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Tokyo'}}}));
    }
    if(u.hostname==='restcountries.com'){
      visits.country++;
      return new Response(JSON.stringify({currencies:{JPY:{name:'Japanese yen'}},
        languages:{jpn:'Japanese'},timezones:['UTC+09:00']}));
    }
    if(u.hostname==='api.groq.com'){
      visits.ai++;
      if(failAI)return new Response('{}',{status:503});
      assert.equal(opts.method,'POST');
      const body=JSON.parse(opts.body);
      assert.ok(body.messages[1].content.includes('UNTRUSTED DATA'));
      return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({
        title:'Tokyo with cultural discoveries',days:Array.from({length:4},(_,i)=>({
          title:'Tokyo day '+(i+1),summary:'Explore museums and neighborhoods; verify opening hours.'
        }))
      })}}]}));
    }
    throw Error('Unexpected provider '+u.hostname);
  };
  return visits;
}
test('validate strict destination coordinates and prevent accidental 0,0 for empty values',async()=>{
  const invalid=await call({destination:'Unknown world location',lat:'',lon:'',countryCode:'JP'});
  assert.equal(invalid.code,400);
  const oversized=await call({...query,lat:'9999'});
  assert.equal(oversized.code,400);
  const wrongCountry=await call({...query,countryCode:'JPN'});
  assert.equal(wrongCountry.code,400);
  assert.equal(checkedDate('2026-02-29'),false);
  assert.equal(validHttpsSource('http://evil.example/',['wikipedia.org']),null);
});
test('source agents operate without metered AI access and preserve partial failures',async()=>{
  delete process.env.WAYFARER_INTELLIGENCE_AI_ENABLED;
  process.env.GROQ_API_KEY='fake-metered-key';
  const visits=suppliers({failWeather:true,failWiki:true});
  try{
    const response=await call();
    assert.equal(response.code,200);
    assert.equal(response.body.ok,true);
    assert.equal(response.body.weather.ok,false);
    assert.equal(response.body.place.ok,false);
    assert.equal(response.body.country.ok,true);
    assert.equal(response.body.ai.ok,false);
    assert.equal(response.body.verification.status,'partial');
    assert.equal(response.body.verification.sourceCount,1);
    assert.equal(response.body.verification.plannedGroundTotalUsd,600);
    assert.equal(visits.ai,0,'anonymous calls must never drain paid AI quota');
    assert.equal(visits.weather,2,'one bounded network retry');
    assert.equal(visits.wiki,2,'one bounded 503 retry');
    assert.equal(visits.country,1);
    assert.ok(response.body.verification.flags.some(s=>s.includes('weather could not be retrieved')));
  }finally{globalThis.fetch=realFetch}
});
test('authenticated orchestration gathers all sources then composes a grounded AI draft',async()=>{
  process.env.GROQ_API_KEY='test-groq-token';
  process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='true';
  process.env.WAYFARER_AI_BETA_TOKEN=SECRET;
  const visits=suppliers();
  try{
    const response=await call(query,SECRET);
    assert.equal(response.code,200);
    assert.equal(response.body.ai.ok,true);
    assert.equal(response.body.ai.days.length,4);
    assert.equal(response.body.verification.status,'complete');
    assert.equal(response.body.verification.sourceCount,3);
    assert.equal(response.body.country.currencyCode,'JPY');
    assert.equal(response.body.weather.forecastForTravelDates,false);
    assert.equal(response.body.place.sourceUrl,'https://en.wikipedia.org/wiki/Tokyo');
    assert.equal(visits.ai,1,'only one paid AI generation call');
    assert.equal(visits.weather,1);
    assert.equal(visits.wiki,1);
    assert.equal(visits.country,1);
    assert.equal(response.headers['Cache-Control'],'no-store');
  }finally{globalThis.fetch=realFetch}
});
test('Groq failures preserve public-source briefing and sample fallback',async()=>{
  process.env.GROQ_API_KEY='test-groq-token';
  process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='true';
  process.env.WAYFARER_AI_BETA_TOKEN=SECRET;
  const visits=suppliers({failAI:true});
  try{
    const response=await call(query,SECRET);
    assert.equal(response.code,200);
    assert.equal(response.body.weather.ok,true);
    assert.equal(response.body.place.ok,true);
    assert.equal(response.body.country.ok,true);
    assert.equal(response.body.ai.ok,false);
    assert.equal(response.body.verification.status,'partial');
    assert.equal(visits.ai,1,'no paid AI retries');
    assert.match(response.body.ai.error,/local sample/);
  }finally{globalThis.fetch=realFetch}
});
test('bad beta credentials never trigger Groq AI even when configured',async()=>{
  process.env.GROQ_API_KEY='test-groq-token';
  process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='true';
  process.env.WAYFARER_AI_BETA_TOKEN=SECRET;
  const visits=suppliers();
  try{
    const response=await call(query,'wrong-code');
    assert.equal(response.code,200);
    assert.equal(response.body.ai.ok,false);
    assert.equal(visits.ai,0);
    assert.equal(response.body.weather.ok,true);
  }finally{globalThis.fetch=realFetch}
});
test('UI handles missing sources honestly and keeps source/AI statuses distinct',()=>{
  assert.match(html,/Source unavailable · continuing with other agents/);
  assert.match(html,/AI draft created · verify before use/);
  assert.match(html,/Verification Agent/);
  assert.match(html,/signal:AbortSignal\.timeout\(26000\)/);
  assert.match(html,/local itinerary and saved journeys are unchanged/);
});
test('verification agent never equates source contexts or AI drafts with live fares',()=>{
  const result=verificationSummary({weather:{ok:true},place:{ok:false},
    country:{ok:true},ai:{ok:false},days:5,dailyBudget:100});
  assert.equal(result.status,'partial');
  assert.equal(result.plannedGroundTotalUsd,500);
  assert.ok(result.flags.some(s=>s.includes('No confirmed airline inventory')));
  assert.ok(result.flags.some(s=>s.includes('future travel dates')));
});
test.after(()=>{
  globalThis.fetch=realFetch;
  for(const k of ['WAYFARER_INTELLIGENCE_AI_ENABLED','WAYFARER_AI_BETA_TOKEN','GROQ_API_KEY']){
    if(originalEnv[k]===undefined)delete process.env[k];
    else process.env[k]=originalEnv[k];
  }
});
