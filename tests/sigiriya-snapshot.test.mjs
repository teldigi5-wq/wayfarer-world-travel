import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/explore.js';

// A public Overpass failure must not turn an actual destination into a page of
// anonymous links, fake hotels or invented supplier prices.
async function invoke(query) {
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Map provider unavailable in test');};
  const response={
    headers:{},code:200,body:null,
    setHeader(k,v){this.headers[k]=v;},
    status(n){this.code=n;return this;},
    json(data){this.body=data;return this;}
  };
  try{await handler({method:'GET',query},response);return response;}
  finally{globalThis.fetch=original;}
}

test('Sigiriya fallback returns real mapped hotel names and calculated straight-line distances',async()=>{
  const res=await invoke({mode:'nearby',lat:'7.957',lon:'80.760'});
  assert.equal(res.code,200);
  assert.equal(res.body.ok,true);
  assert.equal(res.body.mapAvailable,false);
  assert.ok(res.body.hotels.length>=5);
  for(const name of ['Hotel Sigiriya','Sigiriya Village','Jetwing Vil Uyana','Aliya Resort & Spa']){
    const hotel=res.body.hotels.find(h=>h.name===name);
    assert.ok(hotel,'No verified fallback name '+name);
    assert.equal(hotel.type,'hotel');
    assert.ok(hotel.distanceKm>=0&&hotel.distanceKm<35);
    assert.match(hotel.source,/OpenStreetMap reference snapshot/);
    assert.match(hotel.url,/^https:\/\/www\.openstreetmap\.org\/(way|node)\//);
    assert.equal(hotel.price,null);
  }
  assert.ok(res.body.airports.some(a=>a.name.includes('Bandaranaike')&&a.iata==='CMB'));
  const sigiriyaAirport=res.body.airports.find(a=>a.iata==='GIU');
  assert.ok(sigiriyaAirport,'Nearby local GIU aerodrome was omitted');
  assert.equal(sigiriyaAirport.name,'Sigiriya Airport');
  assert.ok(sigiriyaAirport.distanceKm<10);
  assert.match(sigiriyaAirport.url,/^https:\/\/www\.openstreetmap\.org\/way\/297310393$/);
  assert.ok(res.body.airports.every(a=>a.price===null));
});

test('Sigiriya reference hotels are never assigned to unrelated destinations',async()=>{
  for(const [lat,lon] of [['48.8566','2.3522'],['6.9271','79.8612'],['35.68','139.69']]){
    const res=await invoke({mode:'nearby',lat,lon});
    assert.equal(res.code,200);
    assert.equal(res.body.mapAvailable,false);
    assert.equal(res.body.hotels.length,0);
    assert.doesNotMatch(JSON.stringify(res.body),/Hotel Sigiriya|Jetwing Vil Uyana/);
  }
});

test('invalid map coordinates fail closed without exposing a fallback',async()=>{
  const res=await invoke({mode:'nearby',lat:'999',lon:'80.76'});
  assert.equal(res.code,400);
  assert.equal(res.body.ok,false);
  assert.equal(res.body.airports,undefined);
});
