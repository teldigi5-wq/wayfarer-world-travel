import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const script=read('nearby-results.js');
const backend=read('api/explore.js');
const html=read('index.html');
const app=read('premium-app.js');
const priceBridge=read('travel-research.js');
const css=read('premium-refinement.css');

function domFixture(fetchOverride=null) {
  function make(tag='div') {
    const node={
      tagName:tag.toUpperCase(),className:'',textContent:'',children:[],dataset:{},
      value:'',listeners:{},classList:{add(){},remove(){}},
      append(...items){this.children.push(...items);},
      replaceChildren(...items){this.children=[...items];},
      addEventListener(event,callback){this.listeners[event]=callback;},
      setAttribute(name,value){this[name]=value;},
      scrollIntoView(){},focus(){this.focused=true;},
      querySelector(selector){
        if(selector==='.wf-nearby-name'){
          const walk=entry=>entry.className==='wf-nearby-name'?entry:entry.children?.map(walk).find(Boolean);
          return walk(this);
        }
        return null;
      }
    };
    return node;
  }
  const ids=Object.fromEntries([
    'airport-list','hotel-list','nearby','check-in','check-out','stay-adults',
    'travel-origin','travel-arrival','travel-beta-code','wf-tab-prices','wayfarer-travel-research'
  ].map(id=>[id,make()]));
  ids['check-in'].value='2026-11-12';ids['check-out'].value='2026-11-15';
  ids['stay-adults'].value='2';
  ids['wf-tab-prices'].click=()=>{ids['wf-tab-prices'].clicked=true;};
  ids['nearby'].loading=new Set();
  ids['nearby'].classList={add(name){ids['nearby'].loading.add(name)},remove(name){ids['nearby'].loading.delete(name)}};
  const state={
    ok:true,mapAvailable:true,airports:[
      {name:'Sigiriya Airport',iata:'GIU',distanceKm:4.7,source:'OpenStreetMap contributors',url:'https://www.openstreetmap.org/way/12'},
      {name:'Bandaranaike International Colombo Airport',iata:'CMB',distanceKm:135.2,source:'OurAirports reference',url:'https://ourairports.com/airports/VCBI/'}
    ],hotels:[
      {name:'Hotel Sigiriya',distanceKm:2.1,source:'OpenStreetMap contributors',url:'https://www.openstreetmap.org/way/22'}
    ]
  };
  const environment={
    window:{},document:{getElementById:id=>ids[id],createElement:make},
    Intl,URL,URLSearchParams,AbortController,Date,Number,Event:class{},matchMedia:()=>({matches:false}),
    fetch:fetchOverride|| (async()=>({ok:true,json:async()=>state}))
  };
  vm.runInNewContext(script,environment,{timeout:1000});
  const textOf=el=>String(el.textContent||'')+' '+(el.children||[]).map(textOf).join(' ');
  return {ids,state,public:environment.window.WayfarerNearby,textOf};
}

test('unmapped, out-of-range and malformed worldwide locations never trigger public API calls',async()=>{
  const requests=[];
  const f=domFixture(async url=>{requests.push(String(url));throw Error('No invalid lookup should occur');});
  const invalid=[
    null,{}, {name:'',latitude:12,longitude:60},
    {name:'Invalid latitude',latitude:91,longitude:30},
    {name:'Invalid longitude',latitude:20,longitude:181},
    {name:'Negative latitude',latitude:-91,longitude:30},
    {name:'Negative longitude',latitude:20,longitude:-181},
    {name:'String coordinates',latitude:'48.8',longitude:'2.3'},
    {name:'Infinite',latitude:Infinity,longitude:2.3},
    {name:'Missing longitude',latitude:48.8},
    {name:'Too long '+('A'.repeat(130)),latitude:48.8,longitude:2.3}
  ];
  for(const item of invalid){
    await f.public.load(item);
    assert.equal(requests.length,0,'Invalid place must never request an airport or hotel endpoint');
    assert.equal(f.public.currentLocation(),null);
    assert.match(f.textOf(f.ids['airport-list']),/valid coordinates/);
    assert.match(f.textOf(f.ids['hotel-list']),/valid coordinates/);
    assert.equal(f.ids['nearby'].loading.has('world-loading'),false);
  }
  assert.equal(f.public.applyQuotes({
    mode:'search_only',checkedAt:'2030-11-12T08:00:00Z',hotels:{offers:[]}
  },{destination:'Invalid latitude'},{name:'Invalid latitude',latitude:91,longitude:30}),false);
});
test('switching from slow mapped search to no valid map location cancels and clears spinner',async()=>{
  const pending=[];
  const f=domFixture((url,opts)=>new Promise(resolve=>{
    pending.push({url:String(url),signal:opts?.signal,resolve});
  }));
  const searching=f.public.load({
    name:'Valid place',country:'France',countryCode:'FR',latitude:48.8566,longitude:2.3522
  });
  assert.equal(pending.length,2);
  assert.equal(f.ids['nearby'].loading.has('world-loading'),true);
  await f.public.load({name:'Unmapped',latitude:120,longitude:2.3522});
  assert.equal(f.ids['nearby'].loading.has('world-loading'),false);
  assert.equal(f.public.currentLocation(),null);
  assert.equal(pending[0].signal.aborted,true);
  assert.equal(pending[1].signal.aborted,true);
  for(const request of pending)
    request.resolve({ok:true,json:async()=>({
      ok:true,mapAvailable:true,
      airports:[{name:'OLD AIRPORT',iata:'OLD',distanceKm:1}],
      hotels:[{name:'OLD HOTEL',distanceKm:1}]
    })});
  await searching;
  assert.doesNotMatch(f.textOf(f.ids['airport-list']),/OLD AIRPORT/);
  assert.doesNotMatch(f.textOf(f.ids['hotel-list']),/OLD HOTEL/);
  assert.equal(f.ids['nearby'].loading.has('world-loading'),false);
});
test('a valid equatorial destination at the zero meridian still supports free source discovery',async()=>{
  const calls=[];
  const f=domFixture(async (url)=>{
    calls.push(String(url));
    return {ok:true,json:async()=>({ok:true,mapAvailable:true,
      airports:[{name:'Source airport',iata:'ABC',distanceKm:2}],
      hotels:[{name:'Source stay',distanceKm:0.5}]})};
  });
  await f.public.load({name:'Null Island reference',latitude:0,longitude:0});
  assert.equal(calls.length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(f.public.currentLocation())),
    {name:'Null Island reference',countryCode:'',latitude:0,longitude:0});
  assert.match(f.textOf(f.ids['hotel-list']),/Source stay/);
  assert.equal(f.ids['nearby'].loading.has('world-loading'),false);
});

test('a repeated destination instantly restores public references without another network lookup',async()=>{
  let calls=0;
  const f=domFixture(async url=>{
    calls++;
    if(String(url).includes('mode=airports'))return {ok:true,json:async()=>({
      ok:true,airports:[{name:'Paris-Orly Airport',iata:'ORY',distanceKm:14.1}]
    })};
    return {ok:true,json:async()=>({ok:true,mapAvailable:true,
      airports:[{name:'Paris-Orly Airport',iata:'ORY',distanceKm:14.1}],
      hotels:[{name:'Paris Source Hotel',distanceKm:1.7}],
      intelligence:{mode:'deterministic-reference-agent',guidance:[]}
    })};
  });
  const paris={name:'Paris',country:'France',countryCode:'FR',latitude:48.8566,longitude:2.3522};
  await f.public.load(paris);
  assert.equal(calls,2);
  assert.match(f.textOf(f.ids['hotel-list']),/Paris Source Hotel/);
  await f.public.load(paris);
  assert.equal(calls,2,'Warm browser source cache should avoid two repeat API calls');
  assert.match(f.textOf(f.ids['hotel-list']),/Paris Source Hotel/);
  assert.match(f.textOf(f.ids['hotel-list']),/Price unavailable/);
});

test('similar destination names in distinct coordinates never share public location records',async()=>{
  let calls=0;
  const f=domFixture(async url=>{
    calls++;
    const params=new URL('https://example.com'+url).searchParams;
    const closeToFrance=Number(params.get('lat'))>40;
    return {ok:true,json:async()=>({ok:true,mapAvailable:true,
      airports:[],hotels:[{name:closeToFrance?'Paris France Hotel':'Paris Texas Hotel',distanceKm:3}]})};
  });
  await f.public.load({name:'Paris',countryCode:'FR',latitude:48.8566,longitude:2.3522});
  await f.public.load({name:'Paris',countryCode:'US',latitude:33.6609,longitude:-95.5555});
  assert.equal(calls,4,'Distinct country and coordinates must not share a source cache');
  assert.match(f.textOf(f.ids['hotel-list']),/Paris Texas Hotel/);
  assert.doesNotMatch(f.textOf(f.ids['hotel-list']),/Paris France Hotel/);
});

test('airports render while slower hotel discovery is still pending',async()=>{
  let finishHotel;
  const unresolved=new Promise(resolve=>{finishHotel=resolve;});
  const f=domFixture(async url=>{
    if(String(url).includes('mode=airports'))return {ok:true,json:async()=>({ok:true,
      airports:[{name:'Paris Orly Airport',iata:'ORY',distanceKm:14.1,source:'OurAirports reference'}]})};
    return unresolved;
  });
  const pending=f.public.load({name:'Paris',latitude:48.8566,longitude:2.3522});
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.textOf(f.ids['airport-list']),/Paris Orly Airport/);
  assert.match(f.textOf(f.ids['hotel-list']),/Researching sourced hotel locations/);
  finishHotel({ok:true,json:async()=>({ok:true,mapAvailable:false,airports:[],hotels:[]})});
  await pending;
  assert.match(f.textOf(f.ids['hotel-list']),/Public hotel records are unavailable/);
});

test('nearby cards show source-backed names and honest distances without invented prices',async()=>{
  const f=domFixture();
  await f.public.load({name:'Sigiriya',country:'Sri Lanka',latitude:7.95,longitude:80.75});
  assert.equal(f.ids['airport-list'].children.length,2);
  assert.equal(f.ids['hotel-list'].children.length,1);
  assert.match(f.textOf(f.ids['airport-list']),/Sigiriya Airport/);
  assert.match(f.textOf(f.ids['airport-list']),/Bandaranaike International Colombo Airport/);
  assert.match(f.textOf(f.ids['hotel-list']),/Hotel Sigiriya/);
  assert.match(f.textOf(f.ids['hotel-list']),/2\.1 km straight-line/);
  assert.match(f.textOf(f.ids['hotel-list']),/Price unavailable/);
  assert.match(f.textOf(f.ids['airport-list']),/Price unavailable/);
  assert.equal(f.ids['airport-list'].children[0].dataset.airportIata,'GIU');
});

test('uncovered destinations show free external hotel research without inventing rooms or prices',async()=>{
  const f=domFixture();
  f.state.hotels=[];f.state.mapAvailable=false;
  await f.public.load({name:'Paris',country:'France',countryCode:'FR',latitude:48.8566,longitude:2.3522});
  const hotelView=f.ids['hotel-list'];
  assert.match(f.textOf(hotelView),/Research hotels near this location/);
  const link=hotelView.children.find(x=>x.tagName==='A');
  assert.ok(link);
  const url=new URL(link.href);
  assert.equal(url.hostname,'www.google.com');
  assert.equal(url.pathname,'/maps/search/');
  assert.equal(url.searchParams.get('api'),'1');
  assert.equal(url.searchParams.get('query'),'hotels near 48.85660,2.35220');
  assert.equal(link.target,'_blank');
  assert.match(link.rel,/noopener/);
  assert.doesNotMatch(f.textOf(hotelView),/\$[0-9]+/);
});

test('source-bound supplier quotes cannot cross between same-name cities in different countries',async()=>{
  const f=domFixture();
  f.state.hotels=[];
  const france={name:'Paris',country:'France',countryCode:'FR',latitude:48.8566,longitude:2.3522};
  const texas={name:'Paris',country:'United States',countryCode:'US',latitude:33.6609,longitude:-95.5555};
  await f.public.load(france);
  const original=f.public.currentLocation();
  const trip={destination:'Paris',checkIn:'2026-11-12',checkOut:'2026-11-15',adults:2};
  const payload={mode:'search_only',checkedAt:'2026-10-14T06:00:00Z',hotels:{
    offers:[{name:'Paris Provider Hotel',currency:'USD',displayedTotal:'490.00'}]}};
  assert.equal(f.public.isCurrentLocation(original),true);
  await f.public.load(texas);
  assert.equal(f.public.isCurrentLocation(original),false);
  assert.equal(f.public.applyQuotes(payload,trip,original),false);
  assert.doesNotMatch(f.textOf(f.ids['hotel-list']),/Paris Provider Hotel|\\$490/);
  assert.equal(f.public.currentLocation().countryCode,'US');
  const texasOriginal=f.public.currentLocation();
  assert.equal(f.public.applyQuotes(payload,trip,texasOriginal),true);
  assert.match(f.textOf(f.ids['hotel-list']),/Paris Provider Hotel/);
  assert.match(f.textOf(f.ids['hotel-list']),/\$490\.00 total/);
});

test('same-name hotels must not reuse provider results after geographic coordinates change',async()=>{
  const f=domFixture();f.state.hotels=[];
  const first={name:'Springfield',countryCode:'US',latitude:39.8017,longitude:-89.6437};
  const second={name:'Springfield',countryCode:'US',latitude:42.1015,longitude:-72.5898};
  await f.public.load(first);
  const origin=f.public.currentLocation();
  const trip={destination:'Springfield',checkIn:'2026-11-12',checkOut:'2026-11-15',adults:2};
  const data={mode:'search_only',checkedAt:'2026-10-14T06:00:00Z',hotels:{
    offers:[{name:'Known Springfield Hotel',currency:'USD',displayedTotal:'300'}]}};
  await f.public.load(second);
  assert.equal(f.public.applyQuotes(data,trip,origin),false);
  assert.doesNotMatch(f.textOf(f.ids['hotel-list']),/Known Springfield Hotel|\\$300/);
});

test('mapped hotel and same-name provider quote are separate, never name-joined property identities',async()=>{
  const f=domFixture();
  await f.public.load({name:'Sigiriya',country:'Sri Lanka',latitude:7.95,longitude:80.75});
  const trip={destination:'Sigiriya',checkIn:'2026-11-12',checkOut:'2026-11-15',adults:2};
  const payload={mode:'search_only',checkedAt:'2026-10-14T06:00:00Z',hotels:{
    offers:[{name:'Hotel Sigiriya',currency:'USD',displayedTotal:'360.00'}]}};
  f.public.applyQuotes(payload,trip);
  const cards=f.ids['hotel-list'].children;
  assert.equal(cards.length,2,'Same name must appear as independent mapped and unlinked supplier references');
  const [mapped,supplier]=cards;
  assert.match(f.textOf(mapped),/2\.1 km straight-line/);
  assert.match(f.textOf(mapped),/OpenStreetMap contributors/);
  assert.match(f.textOf(mapped),/Price unavailable/);
  assert.doesNotMatch(f.textOf(mapped),/\$360\.00/,'Name-only matching is not verified property identity');
  assert.match(f.textOf(supplier),/Distance unavailable/);
  assert.match(f.textOf(supplier),/unlinked supplier result/);
  assert.match(f.textOf(supplier),/address not map-verified/);
  assert.match(f.textOf(supplier),/\$360\.00 total/);
  assert.match(f.textOf(supplier),/\$120\.00 \/ night average/);
  assert.equal(supplier.children[2].children.some(x=>x.className==='wf-nearby-map'),false,
    'Provider-only result must not be presented as an actual mapped hotel');
  assert.equal(mapped.children[2].children.some(x=>x.className==='wf-nearby-map'),true,
    'Verified geographic reference retains its ordinary map action');
});
test('provider-only quote remains visible when public map supplies ten unrelated named hotels',async()=>{
  const f=domFixture();
  f.state.hotels=Array.from({length:10},(_,i)=>({
    name:'Mapped Stay '+(i+1),distanceKm:i+1,source:'OpenStreetMap contributors',
    latitude:48.85+i/1000,longitude:2.35+i/1000,
    url:'https://www.openstreetmap.org/node/'+(i+1)
  }));
  await f.public.load({name:'Paris',country:'France',countryCode:'FR',
    latitude:48.8566,longitude:2.3522});
  const trip={destination:'Paris',checkIn:'2026-11-12',checkOut:'2026-11-15',adults:2};
  const quote={mode:'search_only',checkedAt:'2026-10-14T06:00:00Z',hotels:{
    offers:[{name:'Supplier-Only Stay',currency:'USD',displayedTotal:'420.00'}]}};
  f.public.applyQuotes(quote,trip);
  const names=f.ids['hotel-list'].children.map(x=>f.textOf(x));
  assert.ok(names.length<=10);
  assert.equal(names.filter(x=>x.includes('Mapped Stay')).length,7);
  assert.equal(names.filter(x=>x.includes('Supplier-Only Stay')).length,1);
  assert.match(names.at(-1),/address not map-verified/);
  assert.match(names.at(-1),/\$420\.00 total/);
});
test('unlinked supplier price is removed when trip dates change but public mapped reference persists',async()=>{
  const f=domFixture();
  await f.public.load({name:'Sigiriya',latitude:7.95,longitude:80.75});
  const trip={destination:'Sigiriya',checkIn:'2026-11-12',checkOut:'2026-11-15',adults:2};
  f.public.applyQuotes({mode:'search_only',checkedAt:'2026-10-14T06:00:00Z',hotels:{
    offers:[{name:'Hotel Sigiriya',currency:'USD',displayedTotal:'360.00'}]}},trip);
  f.ids['check-out'].value='2026-11-16';
  f.ids['check-out'].listeners.change();
  assert.equal(f.ids['hotel-list'].children.length,1);
  assert.match(f.textOf(f.ids['hotel-list']),/OpenStreetMap contributors/);
  assert.match(f.textOf(f.ids['hotel-list']),/Price unavailable/);
  assert.doesNotMatch(f.textOf(f.ids['hotel-list']),/\$360\.00/);
});

test('only a matching explicit protected hotel quote can display total and nightly average',async()=>{
  const f=domFixture();
  await f.public.load({name:'Sigiriya',latitude:7.95,longitude:80.75});
  const payload={
    mode:'search_only',checkedAt:'2026-10-14T01:00:00Z',
    hotels:{offers:[{name:'Hotel Sigiriya',currency:'USD',displayedTotal:'360.00'}]},
    flights:{offers:[{currency:'USD',perAdult:'290.00',segments:[{from:'CMB',to:'GIU'}]}]}
  };
  const trip={destination:'Sigiriya',checkIn:'2026-11-12',checkOut:'2026-11-15',adults:2,to:'GIU'};
  f.public.applyQuotes(payload,trip);
  assert.match(f.textOf(f.ids['hotel-list']),/\$360\.00 total/);
  assert.match(f.textOf(f.ids['hotel-list']),/\$120\.00 \/ night average/);
  assert.match(f.textOf(f.ids['hotel-list']),/Google Travel search/);
  assert.match(f.textOf(f.ids['airport-list']),/\$290\.00 \/ adult/);

  // Quotes are no longer comparable after occupancy, dates or location change.
  f.ids['stay-adults'].value='3';f.ids['stay-adults'].listeners.change();
  assert.match(f.textOf(f.ids['hotel-list']),/Price unavailable/);
  assert.doesNotMatch(f.textOf(f.ids['hotel-list']),/\$360\.00/);
  f.ids['stay-adults'].value='2';f.ids['stay-adults'].listeners.change();
  f.public.applyQuotes(payload,{...trip,destination:'Colombo'});
  assert.match(f.textOf(f.ids['hotel-list']),/Price unavailable/);
});

test('real protected hotel offers show names/prices worldwide when public maps have no hotels',async()=>{
  const f=domFixture();
  f.state.hotels=[];
  await f.public.load({name:'Paris',country:'France',latitude:48.8566,longitude:2.3522});
  assert.match(f.textOf(f.ids['hotel-list']),/No named hotels returned/);
  const trip={destination:'Paris',checkIn:'2026-11-12',checkOut:'2026-11-15',adults:2};
  const payload={mode:'search_only',checkedAt:'2026-10-14T06:00:00Z',hotels:{
    offers:[{name:'A Provider-Supplied Paris Hotel',currency:'USD',displayedTotal:'450.00'}]}};
  f.public.applyQuotes(payload,trip);
  assert.match(f.textOf(f.ids['hotel-list']),/A Provider-Supplied Paris Hotel/);
  assert.match(f.textOf(f.ids['hotel-list']),/\$450\.00 total/);
  assert.match(f.textOf(f.ids['hotel-list']),/Distance unavailable/);
  assert.match(f.textOf(f.ids['hotel-list']),/Google Travel hotel search/);
  // Provider names, too, must vanish when the selected dates change.
  f.ids['check-out'].value='2026-11-16';f.ids['check-out'].listeners.change();
  assert.doesNotMatch(f.textOf(f.ids['hotel-list']),/A Provider-Supplied Paris Hotel/);
  assert.doesNotMatch(f.textOf(f.ids['hotel-list']),/\$450\.00/);
});

test('bad or unverified provider totals never become visible numeric hotel prices',async()=>{
  const f=domFixture();await f.public.load({name:'Sigiriya',latitude:7.95,longitude:80.75});
  const trip={destination:'Sigiriya',checkIn:'2026-11-12',checkOut:'2026-11-15',adults:2};
  for(const bad of [-1,'NaN',0,'no rate']){
    f.public.applyQuotes({mode:'search_only',checkedAt:'2026-10-14T01:00:00Z',
      hotels:{offers:[{name:'Hotel Sigiriya',currency:'USD',displayedTotal:bad}]}},trip);
    assert.match(f.textOf(f.ids['hotel-list']),/Price unavailable/);
  }
});

test('existing project routes and supplier bridge remain intentional and protected',()=>{
  assert.match(html,/<script src="nearby-results\.js"><\/script><script src="premium-app\.js">/);
  assert.match(app,/window\.WayfarerNearby\?\.load\(place\)/);
  assert.match(priceBridge,/WayfarerNearby\?\.applyQuotes\(payload,trip,locationAtSearch\)/);
  assert.match(priceBridge,/\[data-airport-iata\]/);
  assert.match(backend,/import airportData from '\.\.\/data\.json' with \{type:'json'\}/);
  assert.match(backend,/mapAvailable,wikidataAvailable,airports,hotels/);
  assert.match(css,/\.wf-nearby-card/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.doesNotMatch(script,/fetch\('\/api\/travel-search/);
  assert.doesNotMatch(script,/SERPAPI_API_KEY|GOOGLE_API_KEY/);
});


test('changing a booked-search brief immediately removes stale indicative hotel and flight quotes',async()=>{
  const f=domFixture();
  await f.public.load({name:'Sigiriya',country:'Sri Lanka',latitude:7.95,longitude:80.75});
  const trip={destination:'Sigiriya',to:'GIU',checkIn:'2026-11-12',checkOut:'2026-11-15',adults:2};
  const data={mode:'search_only',checkedAt:'2026-10-14T06:00:00Z',
    hotels:{offers:[{name:'Hotel Sigiriya',currency:'USD',displayedTotal:'360.00'}]},
    flights:{offers:[{currency:'USD',perAdult:'290.00',segments:[{from:'CMB',to:'GIU'}]}]}};
  f.public.applyQuotes(data,trip);
  assert.match(f.textOf(f.ids['hotel-list']),/\$360\.00 total/);
  assert.match(f.textOf(f.ids['airport-list']),/\$290\.00/);
  assert.equal(f.public.clearQuotes(),true);
  assert.equal(f.public.clearQuotes(),false);
  assert.doesNotMatch(f.textOf(f.ids['hotel-list']),/\$360\.00/);
  assert.doesNotMatch(f.textOf(f.ids['airport-list']),/\$290\.00/);
  assert.match(f.textOf(f.ids['hotel-list']),/Price unavailable/);
});

test('live quote widget clears old prices when source location is reselected',()=>{
  assert.match(script,/window\.dispatchEvent\?\.\(new Event\('wayfarer:location-changed'\)\)/);
  assert.match(priceBridge,/window\.addEventListener\?\.\('wayfarer:location-changed',invalidateSupplierView\)/);
  assert.match(priceBridge,/window\.WayfarerNearby\?\.clearQuotes\?\.\(\)/);
  assert.match(priceBridge,/showingSupplierResults=false;output\.replaceChildren\(\)/);
  assert.match(priceBridge,/Trip details changed\. Previous search prices were cleared/);
});
