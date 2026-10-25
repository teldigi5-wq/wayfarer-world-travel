// Reproducible IN-PROCESS, no-network microbenchmark: not a deployed latency/load test.
// No HTTP listener, authenticated account, paid provider, real backend, or write action.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { cpus, platform, arch, availableParallelism } from 'node:os';
import { writeFileSync } from 'node:fs';
import explore from '../api/explore.js';
import intelligence from '../api/intelligence.js';
import travelSearch from '../api/travel-search.js';
import travelOffers from '../api/travel-offers.mjs';

const oldFetch = globalThis.fetch;
const environment = ['VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV',
  'WAYFARER_DISABLE_METERED_PROVIDERS', 'WAYFARER_AI_BETA_TOKEN',
  'WAYFARER_TRAVEL_ENABLED', 'SERPAPI_API_KEY', 'GROQ_API_KEY'];
const saved = Object.fromEntries(environment.map(key => [key, process.env[key]]));
const beta = 'offline-benchmark-only-no-real-credential';
process.env.VERCEL = '1';
process.env.VERCEL_ENV = 'production';
process.env.VERCEL_TARGET_ENV = 'production';
process.env.WAYFARER_DISABLE_METERED_PROVIDERS = 'true';
process.env.WAYFARER_AI_BETA_TOKEN = beta;
process.env.WAYFARER_TRAVEL_ENABLED = 'true';
process.env.SERPAPI_API_KEY = 'offline-benchmark-placeholder';
delete process.env.GROQ_API_KEY;

const hotelRows = Array.from({length: 350}, (_,i) => ({
  type:'node', id: i + 1000,
  lat: 6.93 + (i % 40) / 1000,
  lon: 79.87 + (i % 50) / 1000,
  tags:{tourism:'hotel',name:'Mock Hotel ' + i,website:'https://hotel.example.org/' + i}
}));
const airportRows = Array.from({length: 30}, (_,i) => ({
  type:'node',id: i + 3000,
  lat:6.9 + i/100,lon:79.8 + i/100,
  tags:{aeroway:'aerodrome',iata:'CMB',name:'Mock Aerodrome '+i}
}));
const nearbyFixture = JSON.stringify({elements:[...hotelRows,...airportRows]});
const wikipediaFixture = JSON.stringify({
  pageid:303,title:'Kyoto',description:'Japanese city',
  coordinates:{lat:35.0116,lon:135.7681},extract:'Cultural city in Japan',
  content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Kyoto'}}
});
const weatherFixture = JSON.stringify({timezone:'Asia/Tokyo',
  current:{temperature_2m:24,wind_speed_10m:3,time:'2026-10-25T07:00'}});
const countryFixture = JSON.stringify([{currencies:{JPY:{name:'Japanese yen'}},
  languages:{jpn:'Japanese'},timezones:['UTC+09:00']}]);
let mockCalls = 0, forbiddenCalls = 0;
globalThis.fetch = async (url) => {
  const name = new URL(String(url)).hostname;
  let fixture;
  if (name === 'overpass-api.de') fixture = nearbyFixture;
  else if (name === 'en.wikipedia.org') fixture = wikipediaFixture;
  else if (name === 'api.open-meteo.com') fixture = weatherFixture;
  else if (name === 'restcountries.com') fixture = countryFixture;
  else {
    forbiddenCalls++;
    throw new Error('Benchmark attempted forbidden network/provider access: ' + name);
  }
  mockCalls++;
  return new Response(fixture, {status:200,headers:{'Content-Type':'application/json'}});
};

const today = Date.now();
const date = days => new Date(today + days*86_400_000).toISOString().slice(0,10);
const trips = {
  search:{from:'CMB',to:'HND',checkIn:date(40),checkOut:date(45),
    destination:'Tokyo, Japan',adults:2,flightBudget:1200,groundBudget:1200},
  offers:{country:'Japan',city:'Tokyo',origin:'Colombo',originAirport:'CMB',
    destinationAirport:'HND',startDate:date(40),endDate:date(45),
    travelers:2,budget:1200,flightBudget:1000,style:'balanced'}
};
function req(query, i) {
  return {method:'GET',query,headers:{},
    socket:{remoteAddress:'198.51.100.' + (1 + i%240)}};
}
function result() {
  return {statusCode:200,body:null,headers:{},
    setHeader(k,v){this.headers[k]=v;return this},
    status(n){this.statusCode=n;return this},
    json(obj){this.body=obj;return this}};
}
async function call(fn,request,verify) {
  const res=result();
  await fn(request,res);
  verify(res);
}
const scenarios=[
  {name:'discovery_invalid_geo',count:240,budgetMs:100,run:i=>
    call(explore,req({mode:'nearby',lat:' ',lon:'79.8612'},i),
      r=>assert.equal(r.statusCode,400))},
  {name:'discovery_nearby_380_mock_places',count:100,budgetMs:350,run:i=>
    call(explore,req({mode:'nearby',lat:'6.9271',lon:'79.8612'},i),
      r=>{assert.equal(r.statusCode,200);assert.equal(r.body.hotels.length,14);
        assert.ok(r.body.airports.length>0)})},
  {name:'discovery_wiki_lookup',count:120,budgetMs:250,run:i=>
    call(explore,req({mode:'search',q:'Kyoto'},i),
      r=>{assert.equal(r.statusCode,200);assert.equal(r.body.results.length,1)})},
  {name:'intelligence_three_mock_sources',count:100,budgetMs:350,run:i=>
    call(intelligence,req({destination:'Kyoto',days:'3'},i),
      r=>{assert.equal(r.statusCode,200);assert.equal(r.body.weather.ok,true);
        assert.equal(r.body.place.ok,true);assert.equal(r.body.country.ok,true);
        assert.equal(r.body.ai.ok,false)})},
  {name:'travel_search_production_lock',count:240,budgetMs:200,run:i=>
    call(travelSearch,{method:'POST',headers:{'x-wayfarer-beta-token':beta},
      body:{trip:trips.search},socket:{remoteAddress:'203.0.113.'+(1+i%240)}},
      r=>{assert.equal(r.statusCode,200);assert.equal(r.body.mode,'production_locked')})},
  {name:'travel_offers_production_lock',count:240,budgetMs:200,run:i=>
    call(travelOffers,{method:'POST',headers:{'x-wayfarer-beta-token':beta},
      body:{trip:trips.offers},socket:{remoteAddress:'203.0.113.'+(1+i%240)}},
      r=>{assert.equal(r.statusCode,200);assert.equal(r.body.mode,'production_locked')})}
];
const percentile = (sorted,q) => Number(sorted[Math.max(0,Math.ceil(sorted.length*q)-1)].toFixed(3));
const round = n => Number(n.toFixed(3));
async function measure(scenario) {
  for (let i=0;i<12;i++) await scenario.run(300 + i);
  if(globalThis.gc)globalThis.gc();
  const heapStart=process.memoryUsage().heapUsed;
  const startCpu=process.cpuUsage(),start=performance.now();
  const samples=[];
  let heapPeak=heapStart, callsBefore=mockCalls;
  for(let i=0;i<scenario.count;i++){
    const t=performance.now();
    await scenario.run(i);
    samples.push(performance.now()-t);
    if(i%10===0)heapPeak=Math.max(heapPeak,process.memoryUsage().heapUsed);
  }
  const duration=performance.now()-start, cpu=process.cpuUsage(startCpu);
  if(globalThis.gc)globalThis.gc();
  const heapEnd=process.memoryUsage().heapUsed;
  samples.sort((a,b)=>a-b);
  return {
    scenario:scenario.name,operations:scenario.count,success:scenario.count,
    medianMs:percentile(samples,0.5),p95Ms:percentile(samples,0.95),
    p99Ms:percentile(samples,0.99),maxMs:round(samples.at(-1)),
    elapsedMs:round(duration),inProcessOpsPerSecond:round(scenario.count*1000/duration),
    cpuMs:round((cpu.user+cpu.system)/1000),
    heapPeakMiB:round(heapPeak/1048576),
    heapGrowthAfterGcMiB:round((heapEnd-heapStart)/1048576),
    mockedFetchCalls:mockCalls-callsBefore,
    provisionalP95BudgetMs:scenario.budgetMs,
    budgetAdvisory:percentile(samples,0.95)>scenario.budgetMs?'REVIEW':'within budget'
  };
}
try {
  const data=[];
  for(const scenario of scenarios){
    const row=await measure(scenario);
    data.push(row);
    console.log('BENCH ' + JSON.stringify(row));
  }
  assert.equal(forbiddenCalls,0,'No billable/unknown provider requests permitted');
  const output={
    benchmark:'Wayfarer offline API in-process baseline',
    scope:'Mocked providers; serial handler calls; NO network/HTTP/TLS, mobile device, cloud backend, distributed load, or production SLA',
    gitSha:process.env.GITHUB_SHA||'local',
    node:process.version,platform:platform(),arch:arch(),
    cpuModel:cpus()[0]?.model||'unknown',availableCpus:availableParallelism(),
    results:data,forbiddenProviderCalls:forbiddenCalls,
    budgets:'advisory only: runner contention makes cross-run absolute timings unsuitable as blocking release gates'
  };
  writeFileSync('benchmark-results.json',JSON.stringify(output,null,2)+'\n');
  console.log('BENCH_SUMMARY '+JSON.stringify({
    rows:data.length,totalOperations:data.reduce((s,r)=>s+r.operations,0),
    allCorrect:true,forbiddenProviderCalls:forbiddenCalls,
    advisories:data.filter(r=>r.budgetAdvisory==='REVIEW').map(r=>r.scenario)
  }));
} finally {
  globalThis.fetch=oldFetch;
  for(const key of environment) {
    if(saved[key]===undefined)delete process.env[key];
    else process.env[key]=saved[key];
  }
}
