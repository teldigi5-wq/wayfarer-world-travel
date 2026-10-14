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
  const res={statusCode:0,body:null,setHeader(){},status(n){this.statusCode=n;return this;},json(payload){this.body=payload;return this;}};
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
