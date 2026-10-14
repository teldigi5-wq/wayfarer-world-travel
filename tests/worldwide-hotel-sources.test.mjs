import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseWikidataHotels,wikidataHotelQuery,lookupWikidataHotels} from '../worldwide-hotel-sources.mjs';
import handler from '../api/explore.js';

const responseFor=(name,id,lon,lat)=>({
  place:{value:'https://www.wikidata.org/entity/'+id},
  placeLabel:{value:name},
  location:{value:'Point('+lon+' '+lat+')'}
});

test('hotel query uses bounded numeric coordinates and actual Wikidata hotel typing',()=>{
  const query=wikidataHotelQuery(48.8566,2.3522);
  assert.match(query,/Point\(2\.3522 48\.8566\)/);
  assert.match(query,/wdt:P31\/wdt:P279\* wd:Q27686/);
  assert.match(query,/wikibase:around/);
  assert.throws(()=>wikidataHotelQuery(Infinity,5),/Invalid location/);
});

test('only source-labelled named hotels with geographic coordinates are accepted',()=>{
  const data={results:{bindings:[
    responseFor('Verified Hotel Reference','Q100001',2.36,48.86),
    responseFor('Q100002','Q100002',2.35,48.85),
    responseFor('Hotel too far away','Q100003',4.8,48.8),
    {place:{value:'http://malicious.example/Q4'},placeLabel:{value:'Fake Hotel'},location:{value:'Point(2.36 48.85)'}},
    responseFor('Verified Hotel Reference','Q100005',2.36,48.86)
  ]}};
  const hotels=parseWikidataHotels(data,48.8566,2.3522);
  assert.equal(hotels.length,1);
  assert.equal(hotels[0].name,'Verified Hotel Reference');
  assert.equal(hotels[0].url,'https://www.wikidata.org/wiki/Q100001');
  assert.equal(hotels[0].price,null);
  assert.match(hotels[0].source,/Wikidata/);
});

test('worldwide CC0 source accepts results for multiple countries without hardcoded city names',async()=>{
  const locations=[
    ['Paris',48.8566,2.3522,2.353,48.856,'Paris Reference Hotel','Q9182731'],
    ['Tokyo',35.6762,139.6503,139.66,35.68,'Tokyo Reference Hotel','Q9182732'],
    ['Cape Town',-33.9249,18.4241,18.42,-33.92,'Cape Town Reference Hotel','Q9182733'],
    ['Sydney',-33.8688,151.2093,151.21,-33.87,'Sydney Reference Hotel','Q9182734']
  ];
  for(const [city,lat,lon,hotelLon,hotelLat,name,id] of locations){
    let requested=0;
    const results=await lookupWikidataHotels(lat,lon,{fetchFn:async (url,opts)=>{
      requested++;
      assert.match(url,/query\.wikidata\.org\/sparql/);
      assert.ok(opts.headers.Accept.includes('sparql'));
      return {ok:true,json:async()=>({results:{bindings:[responseFor(name,id,hotelLon,hotelLat)]}})};
    }});
    assert.equal(requested,1,'No source lookup for '+city);
    assert.equal(results[0].name,name);
    assert.ok(results[0].distanceKm<5);
  }
});

test('provider failure does not create fictional worldwide hotels or prices',async()=>{
  await assert.rejects(()=>lookupWikidataHotels(1.111,2.222,{
    fetchFn:async()=>{throw Error('Offline');}
  }),/Offline/);
  assert.deepEqual(parseWikidataHotels({},1.111,2.222),[]);
});

test('worldwide nearby API chooses source-backed hotels and preserves airport references',async()=>{
  const original=globalThis.fetch;
  const lat=37.7749,lon=-122.4194;
  globalThis.fetch=async (url)=>{
    if(String(url).includes('wikidata.org/sparql'))return {ok:true,json:async()=>({results:{bindings:[
      responseFor('San Francisco Source Hotel','Q9182735',-122.4195,37.775)
    ]}})};
    throw Error('Map temporarily unavailable');
  };
  const res={
    code:0,body:null,
    setHeader(){},
    status(code){this.code=code;return this},
    json(body){this.body=body;return this}
  };
  try{await handler({method:'GET',query:{mode:'nearby',lat:String(lat),lon:String(lon)}},res);}
  finally{globalThis.fetch=original;}
  assert.equal(res.code,200);
  assert.equal(res.body.ok,true);
  assert.equal(res.body.wikidataAvailable,true);
  assert.ok(res.body.hotels.some(x=>x.name==='San Francisco Source Hotel'));
  assert.ok(Array.isArray(res.body.airports));
  assert.ok(res.body.airports.every(a=>a.type==='airport'&&a.price===null));
  assert.ok(res.body.hotels.every(x=>x.price===null));
});

test('all 250 directory countries stay available without inventing universal coverage',()=>{
  const data=JSON.parse(readFileSync(new URL('../data.json',import.meta.url),'utf8'));
  assert.ok(data.countries.length>=245);
  assert.ok(new Set(data.airports.map(a=>a.code)).size>=225);
  assert.ok(data.countries.some(x=>x.code==='LK'));
  assert.ok(data.countries.some(x=>x.code==='FR'));
  assert.ok(data.countries.some(x=>x.code==='JP'));
});
