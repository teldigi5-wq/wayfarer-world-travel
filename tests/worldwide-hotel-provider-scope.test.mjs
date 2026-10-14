import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/travel-search.js';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('travel-research.js');
const server=read('api/travel-search.js');
const ACCESS='synthetic-beta-code-very-long-12345';
const fixtureTrip={
  from:'',to:'',destination:'Paris',checkIn:'2030-11-12',checkOut:'2030-11-15',
  adults:2,flightBudget:0,groundBudget:540
};
async function withStubbedProvider(fn){
  const oldFetch=globalThis.fetch;
  const keys=['WAYFARER_AI_BETA_TOKEN','SERPAPI_API_KEY','WAYFARER_TRAVEL_ENABLED'];
  const before=Object.fromEntries(keys.map(x=>[x,process.env[x]]));
  const calls=[];
  process.env.WAYFARER_AI_BETA_TOKEN=ACCESS;
  process.env.SERPAPI_API_KEY='fake-no-network-api-key';
  process.env.WAYFARER_TRAVEL_ENABLED='true';
  globalThis.fetch=async url=>{
    const u=new URL(url);calls.push(u);
    assert.equal(u.hostname,'serpapi.com','All provider calls must remain mocked');
    return {status:200,ok:true,text:async()=>JSON.stringify({properties:[{
      name:'Provider sample: not bookable',total_rate:{extracted_lowest:200}
    }]})};
  };
  const call=async(trip,number=1)=>{
    const out={code:0,body:null,headers:{},
      setHeader(k,v){this.headers[k]=v;return this;},
      status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
    await handler({method:'POST',
      headers:{'x-wayfarer-beta-token':ACCESS,'x-forwarded-for':'synthetic-geo-'+number},
      body:{trip}},out);
    return out;
  };
  try{await fn({calls,call});}
  finally{
    globalThis.fetch=oldFetch;
    for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}
  }
}
test('Paris France and Paris Texas produce distinct country-and-coordinate-scoped hotel provider queries',async()=>{
  await withStubbedProvider(async({calls,call})=>{
    const f=await call({...fixtureTrip,countryCode:'FR',latitude:48.8566,longitude:2.3522},1);
    const u=await call({...fixtureTrip,countryCode:'US',latitude:33.6609,longitude:-95.5555},2);
    assert.equal(f.code,200);assert.equal(u.code,200);
    assert.equal(calls.length,2,'No automatic flight calls with absent IATA route');
    assert.equal(calls[0].searchParams.get('engine'),'google_hotels');
    assert.equal(calls[0].searchParams.get('q'),'hotels in Paris, France near 48.85660, 2.35220');
    assert.equal(calls[1].searchParams.get('q'),'hotels in Paris, United States near 33.66090, -95.55550');
    assert.notEqual(calls[0].searchParams.get('q'),calls[1].searchParams.get('q'));
    assert.equal(f.body.hotelSearchContext.countryCode,'FR');
    assert.equal(u.body.hotelSearchContext.countryCode,'US');
    assert.equal(f.body.hotelSearchContext.coordinateScoped,true);
    assert.match(f.body.hotelSearchContext.caveat,/traveler-selected/);
    assert.equal(f.body.hotels.offers[0].priceBasis.includes('not confirmed'),true);
  });
});
test('same-name Springfield within one country uses distinct selected map coordinates',async()=>{
  await withStubbedProvider(async({calls,call})=>{
    await call({...fixtureTrip,destination:'Springfield',countryCode:'US',
      latitude:39.8017,longitude:-89.6437},3);
    await call({...fixtureTrip,destination:'Springfield',countryCode:'US',
      latitude:42.1015,longitude:-72.5898},4);
    assert.match(calls[0].searchParams.get('q'),/39\.80170, -89\.64370/);
    assert.match(calls[1].searchParams.get('q'),/42\.10150, -72\.58980/);
  });
});
test('country without mapped coordinates improves ambiguity without inventing a point',async()=>{
  await withStubbedProvider(async({calls,call})=>{
    const answer=await call({...fixtureTrip,countryCode:'FR'},5);
    assert.equal(answer.code,200);
    assert.equal(calls[0].searchParams.get('q'),'hotels in Paris, France');
    assert.equal(answer.body.hotelSearchContext.coordinateScoped,false);
  });
});
test('legacy city-only searches retain explicit unscoped and unverified attribution',async()=>{
  await withStubbedProvider(async({calls,call})=>{
    const answer=await call(fixtureTrip,6);
    assert.equal(answer.code,200);
    assert.equal(calls[0].searchParams.get('q'),'hotels in Paris');
    assert.equal(answer.body.hotelSearchContext.countryCode,null);
    assert.equal(answer.body.hotelSearchContext.coordinateScoped,false);
  });
});
test('unsupported ISO codes and invalid or incomplete coordinates fail before any paid provider call',async()=>{
  await withStubbedProvider(async({calls,call})=>{
    const bad=[
      {countryCode:'ZZ',latitude:48.8,longitude:2.3},
      {countryCode:'FRA',latitude:48.8,longitude:2.3},
      {countryCode:'FR',latitude:999,longitude:2.3},
      {countryCode:'FR',latitude:'NaN',longitude:2.3},
      {countryCode:'FR',latitude:48.8},
      {countryCode:'FR',longitude:2.3},
      {latitude:48.8,longitude:2.3}
    ];
    for(let i=0;i<bad.length;i++){
      const result=await call({...fixtureTrip,...bad[i]},100+i);
      assert.equal(result.code,400,JSON.stringify(bad[i]));
      assert.equal(result.body.ok,false);
    }
    assert.equal(calls.length,0);
  });
});
test('sensitive access tokens do not enter the public geographic query or response',async()=>{
  await withStubbedProvider(async({calls,call})=>{
    const result=await call({...fixtureTrip,countryCode:'JP',
      latitude:35.6762,longitude:139.6503},7);
    assert.equal(result.code,200);
    assert.doesNotMatch(calls[0].searchParams.get('q'),/beta|token|api_key/i);
    assert.doesNotMatch(JSON.stringify(result.body),/synthetic-beta-code-very-long/);
    assert.equal(result.headers['Cache-Control'],'no-store');
  });
});
test('travel browser snapshots selected location into the same explicit protected search',()=>{
  assert.match(app,/const locationAtSearch=window\.WayfarerNearby\?\.currentLocation\(\)\?\?null/);
  assert.match(app,/countryCode:locationAtSearch\.countryCode/);
  assert.match(app,/latitude:locationAtSearch\.latitude,longitude:locationAtSearch\.longitude/);
  assert.match(app,/body:JSON\.stringify\(\{trip\}\)/);
  assert.match(app,/WayfarerNearby\?\.isCurrentLocation/);
  assert.match(app,/HOTEL SEARCH AREA/);
  assert.match(app,/not independent verification of hotel addresses/);
  assert.match(server,/countryDirectory from '\.\.\/data\.json'/);
  assert.doesNotMatch(server,/GOOGLE_MAPS_API_KEY|GOOGLE_CLOUD_BILLING/);
});
