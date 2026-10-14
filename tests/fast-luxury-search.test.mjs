import test from 'node:test';
import assert from 'node:assert/strict';
import {getJson} from '../agent-runtime.mjs';
import handler from '../api/explore.js';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

function response(json,status=200){
  return {ok:status<400,status,headers:{get:()=>null},text:async()=>JSON.stringify(json),json:async()=>json};
}
async function invoke(query){
  const res={statusCode:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(payload){this.body=payload;return this;}};
  await handler({method:'GET',query},res);return res;
}
test('public agent lookups coalesce concurrent requests and reuse a short TTL safely',async()=>{
  const original=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async()=>{requests++;await new Promise(r=>setTimeout(r,8));return response({source:'ok'});};
  const url='https://example.com/public/'+Date.now();
  try{
    const [a,b]=await Promise.all([
      getJson(url,{retries:0,cacheTtlMs:60000}),
      getJson(url,{retries:0,cacheTtlMs:60000})
    ]);
    assert.deepEqual(a,{source:'ok'});assert.deepEqual(b,a);
    await getJson(url,{retries:0,cacheTtlMs:60000});
    assert.equal(requests,1);
    await getJson(url,{retries:0});
    assert.equal(requests,2,'an explicit noncacheable read must not reuse cached data');
  }finally{globalThis.fetch=original;}
});
test('failed public source fetches are not cached and private requests are never cached',async()=>{
  const original=globalThis.fetch;
  let requests=0;globalThis.fetch=async()=>{requests++;return requests===1?response({error:true},503):response({ok:true});};
  const url='https://example.com/failure/'+Date.now();
  try{
    await assert.rejects(getJson(url,{cacheTtlMs:60000,retries:0}));
    assert.deepEqual(await getJson(url,{cacheTtlMs:60000,retries:0}),{ok:true});
    assert.equal(requests,2);
    await getJson(url,{headers:{Authorization:'Bearer private'},cacheTtlMs:60000,retries:0});
    await getJson(url,{headers:{Authorization:'Bearer private'},cacheTtlMs:60000,retries:0});
    assert.equal(requests,4);
  }finally{globalThis.fetch=original;}
});
test('fast airport mode does not invoke remote map/AI/supplier services',async()=>{
  const old=globalThis.fetch;let requests=0;
  globalThis.fetch=async()=>{requests++;throw Error('Network must not be requested');};
  try{
    const r=await invoke({mode:'airports',lat:'7.957',lon:'80.760'});
    assert.equal(r.statusCode,200);
    assert.equal(r.body.ok,true);
    assert.equal(r.body.partial,true);
    assert.equal(r.body.airports[0].iata,'GIU');
    assert.ok(r.body.airports.every(x=>x.price===null));
    assert.equal(requests,0);
    const other=await invoke({mode:'airports',lat:'48.8566',lon:'2.3522'});
    assert.equal(other.statusCode,200);
    assert.ok(other.body.airports.some(x=>x.iata==='ORY'));
  }finally{globalThis.fetch=old;}
});
test('destination geocoding stays server-side and respects the country filter',async()=>{
  const old=globalThis.fetch;
  let called='';
  globalThis.fetch=async (url)=>{
    called=String(url);
    return {ok:true,json:async()=>({results:[
      {id:1,name:'Paris',country:'France',country_code:'FR',latitude:48.8566,longitude:2.3522,admin1:'Île-de-France'},
      {id:2,name:'Paris',country:'United States',country_code:'US',latitude:33.66,longitude:-95.55}
    ]})};
  };
  try{
    const r=await invoke({mode:'search',q:'Paris',countryCode:'FR'});
    assert.equal(r.statusCode,200);
    assert.equal(r.body.provider,'Open-Meteo Geocoding');
    assert.equal(r.body.results.length,1);
    assert.equal(r.body.results[0].countryCode,'FR');
    assert.match(called,/countryCode=FR/);
  }finally{globalThis.fetch=old;}
});
test('web interface avoids direct CSP-blocked geocoding and misleading instant agent results',()=>{
  const app=read('premium-app.js'),html=read('index.html'),css=read('premium-refinement.css'),agent=read('api/intelligence.js');
  assert.doesNotMatch(app,/fetch\('https:\/\/geocoding-api\.open-meteo\.com/);
  assert.match(app,/activeWorldSearch\?\.abort\(\)/);
  assert.match(app,/worldSearchSeq/);
  assert.match(app,/mode:'search'/);
  assert.match(html,/id="world-search-feedback" role="status"/);
  assert.match(css,/wf-world-search-feedback/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(agent,/Promise\.all\(\[/);
  assert.match(agent,/cacheTtlMs:/);
  assert.match(agent,/publicSourcesMs:/);
});

test('untrusted geocoder records outside valid world coordinates cannot displace a valid city',async()=>{
 const old=globalThis.fetch;
 const invalid=Array.from({length:8},(_,id)=>({
   id,name:'Invalid '+id,country_code:'FR',latitude:95+id,longitude:2.35
 }));
 invalid[1].latitude=48.8;invalid[1].longitude=181;
 invalid[2].latitude='48.8';invalid[2].longitude=2.35;
 invalid[3].latitude=48.8;invalid[3].country_code='US';
 invalid[4].latitude=48.8;invalid[4].name=' ';
 invalid[5].latitude=Infinity;
 invalid[6].latitude=48.8;invalid[6].country_code=null;
 globalThis.fetch=async()=>response({results:[
   ...invalid,
   {id:91,name:'Lyon',country:'France',country_code:'FR',
     latitude:45.764,longitude:4.8357}
 ]});
 try{
   const result=await invoke({mode:'search',q:'Ly',countryCode:'FR'});
   assert.equal(result.statusCode,200);
   assert.deepEqual(result.body.results.map(x=>x.name),['Lyon']);
   assert.equal(result.body.results[0].latitude,45.764);
   assert.equal(result.headers['Cache-Control'],'no-store',
     'Arbitrary traveler geocoding queries must not enter shared CDN cache');
 }finally{globalThis.fetch=old;}
});

test('server rejects missing, coerced and malformed location coordinates before public source lookup',async()=>{
 const old=globalThis.fetch;
 let requests=0;
 globalThis.fetch=async()=>{requests++;throw Error('Invalid geography must never query sources');};
 const invalid=[null,undefined,'','   ','0x3',{},[],true,'Infinity','NaN','1e309','91','-91'];
 try{
   for(const lat of invalid){
     const r=await invoke({mode:'nearby',lat,lon:'80'});
     assert.equal(r.statusCode,400,'Invalid latitude '+String(lat));
     assert.equal(r.body.ok,false);
     assert.equal(r.headers['Cache-Control'],'no-store');
   }
   const invalidLon=await invoke({mode:'nearby',lat:'1.2',lon:'181'});
   assert.equal(invalidLon.statusCode,400);
   assert.equal(requests,0);
   const valid=await invoke({mode:'airports',lat:'0',lon:'0'});
   assert.equal(valid.statusCode,200,'The equator and prime meridian are valid geography');
   assert.match(valid.headers['Cache-Control'],/s-maxage=900/);
   assert.equal(requests,0);
 }finally{globalThis.fetch=old;}
});

test('Overpass provider data cannot create out-of-region hotels or unsafe element links',async()=>{
 const old=globalThis.fetch;
 let queried=0;
 const lat=19.4326,lon=-99.1332;
 const tags={tourism:'hotel',name:'Locally sourced stay'};
 const elements=[
   {type:'node',id:192001,lat:19.4327,lon:-99.1331,tags},
   {type:'node',id:192002,lat:95,lon:-99.13,tags:{...tags,name:'Invalid latitude stay'}},
   {type:'node',id:192003,lat:19.43,lon:181,tags:{...tags,name:'Invalid longitude stay'}},
   {type:'node',id:192004,lat:35.7,lon:139.7,tags:{...tags,name:'Faraway stay'}},
   {type:'way',id:'../bad',center:{lat:19.43,lon:-99.13},tags:{...tags,name:'Unsafe source ID'}},
   {type:'injected',id:192005,lat:19.43,lon:-99.13,tags:{...tags,name:'Wrong element kind'}},
   {type:'node',id:192006,lat:19.43,lon:-99.13,tags:{tourism:'restaurant',name:'Not a hotel'}},
   {type:'relation',id:192007,center:{lat:19.4328,lon:-99.1333},
     tags:{tourism:'hotel',name:'Valid mapped area hotel'}}
 ];
 globalThis.fetch=async url=>{
   if(!String(url).includes('overpass-api.de'))throw Error('No provider fallback needed');
   queried++;
   return response({elements});
 };
 try{
   const r=await invoke({mode:'nearby',lat:String(lat),lon:String(lon),countryCode:'MX'});
   assert.equal(r.statusCode,200);
   assert.equal(r.body.mapAvailable,true);
   assert.equal(r.body.wikidataAvailable,false);
   assert.deepEqual(r.body.hotels.map(x=>x.name),[
     'Locally sourced stay','Valid mapped area hotel'
   ]);
   assert.ok(r.body.hotels.every(x=>x.price===null&&x.distanceKm<=35&&x.distanceKm>=0));
   assert.ok(r.body.hotels.every(x=>/^https:\/\/www\.openstreetmap\.org\/(?:node|way|relation)\/\d+$/.test(x.url)));
   assert.match(r.headers['Cache-Control'],/s-maxage=600/);
   assert.equal(queried,1);
 }finally{globalThis.fetch=old;}
});

test('external failures and empty worldwide results receive short or no shared-cache lifetime',async()=>{
 const old=globalThis.fetch;
 try{
   globalThis.fetch=async()=>{throw Error('PRIVATE INTERNAL PROVIDER DETAIL');};
   const failed=await invoke({mode:'search',q:'London'});
   assert.equal(failed.statusCode,502);
   assert.equal(failed.headers['Cache-Control'],'no-store');
   assert.doesNotMatch(failed.body.error,/PRIVATE|INTERNAL/);
   const degraded=await invoke({mode:'nearby',lat:'-12.13579',lon:'45.24681'});
   assert.equal(degraded.statusCode,200);
   assert.equal(degraded.body.mapAvailable,false);
   assert.equal(degraded.body.wikidataAvailable,false);
   assert.match(degraded.headers['Cache-Control'],/s-maxage=45/);
   assert.doesNotMatch(degraded.headers['Cache-Control'],/s-maxage=900/);
 }finally{globalThis.fetch=old;}
});
