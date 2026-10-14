import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedPublicNearby,gatherPublicHotels} from '../worldwide-source-coordinator.mjs';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const healthy=(hotelName='Source Hotel')=>({
 status:200,body:{ok:true,hotels:[{name:hotelName,price:null}],airports:[],mapAvailable:true}
});
test('warm cache coalesces equivalent public place lookups without sharing mutable results',async()=>{
 const key='cache-world-41.90,12.50|IT';
 let starts=0;
 const loader=async()=>{
   starts++;await new Promise(resolve=>setTimeout(resolve,12));
   return healthy();
 };
 const [a,b]=await Promise.all([
   cachedPublicNearby(key,loader),cachedPublicNearby(key,loader)
 ]);
 assert.equal(starts,1);
 a.body.hotels[0].name='mutated';
 assert.equal(b.body.hotels[0].name,'Source Hotel');
 const c=await cachedPublicNearby(key,loader);
 assert.equal(c.body.hotels[0].name,'Source Hotel');
 assert.equal(starts,1);
});
test('different coordinates and ISO codes never share the public data result',async()=>{
 const keys=['cache-global-2.35220,48.85660|FR','cache-global-2.35220,48.85660|US',
   'cache-global-2.35221,48.85660|FR'];
 let calls=0;
 for(const key of keys){
   const result=await cachedPublicNearby(key,async()=>healthy(String(++calls)));
   assert.equal(result.body.hotels[0].name,String(calls));
 }
 assert.equal(calls,3);
});
test('source errors do not persist in the cache',async()=>{
 const key='cache-global-FAIL-99';let count=0;
 await assert.rejects(cachedPublicNearby(key,async()=>{count++;throw Error('offline');}),/offline/);
 const recovered=await cachedPublicNearby(key,async()=>{count++;return healthy('Recovered');});
 assert.equal(recovered.body.hotels[0].name,'Recovered');
 assert.equal(count,2);
});
test('negative mapped hotel searches have shorter TTL than covered searches',async()=>{
 const key='cache-global-TTL-99';
 let current=1700000000000,count=0;
 const now=()=>current;
 const loader=async()=>{count++;return {status:200,body:{ok:true,hotels:[],airports:[]}};};
 await cachedPublicNearby(key,loader,{now});
 current+=40000;await cachedPublicNearby(key,loader,{now});
 assert.equal(count,1);
 current+=6000;await cachedPublicNearby(key,loader,{now});
 assert.equal(count,2);
});
test('fast credible OpenStreetMap hotel result avoids a second public provider request',async()=>{
 let wikiCalls=0;
 const result=await gatherPublicHotels(
   async()=>({mapped:[{name:'Actual Hotel',type:'hotel'}],mapAvailable:true}),
   async()=>{wikiCalls++;return [{name:'should not be requested'}]},
   {hedgeMs:1000}
 );
 assert.equal(wikiCalls,0);
 assert.equal(result.mapAvailable,true);
 assert.equal(result.mapped[0].name,'Actual Hotel');
 assert.equal(result.wikidataAvailable,false);
});
test('slow map source activates an independent Wikidata lookup without waiting serially',async()=>{
 let finishMap;
 const held=new Promise(resolve=>{finishMap=resolve;});
 let fallbackStarted=false;
 const task=gatherPublicHotels(
   ()=>held,
   async()=>{fallbackStarted=true;return [{type:'hotel',name:'Source hotel'}]},
   {hedgeMs:15}
 );
 await new Promise(resolve=>setTimeout(resolve,35));
 assert.equal(fallbackStarted,true);
 finishMap({mapAvailable:false,mapped:[]});
 const result=await task;
 assert.equal(result.wikidataAvailable,true);
 assert.equal(result.wikidataHotels[0].name,'Source hotel');
});
test('unavailable sources degrade gracefully without implying hotel inventory',async()=>{
 const result=await gatherPublicHotels(
   async()=>{throw Error('OSM rate limited')},
   async()=>{throw Error('Wiki blocked')},
   {hedgeMs:1}
 );
 assert.equal(result.mapAvailable,false);
 assert.equal(result.wikidataAvailable,false);
 assert.equal(result.wikidataHotels.length,0);
});
test('only mapped hotel results suppress secondary lookup, not airport-only records',async()=>{
 let called=0;
 const result=await gatherPublicHotels(
   async()=>({mapAvailable:true,mapped:[{type:'airport',iata:'HND'}]}),
   async()=>{called++;return []},
   {hedgeMs:1000}
 );
 assert.equal(called,1);
 assert.equal(result.mapAvailable,true);
 assert.equal(result.wikidataAvailable,true);
});
test('integration remains limited to public-source discovery, never live paid search',()=>{
 const backend=read('api/explore.js'),module=read('worldwide-source-coordinator.mjs');
 assert.match(backend,/gatherPublicHotels\(queryMap/);
 assert.match(backend,/cachedPublicNearby\(key,\(\)=>nearby\(req\)\)/);
 assert.doesNotMatch(module,/GROQ_API_KEY|SERPAPI_API_KEY|WAYFARER_AI_BETA_TOKEN|travel-search/);
 assert.match(backend,/hedgeMs:850/);
});
