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
  ids['nearby'].classList={add(){},remove(){}};
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
  assert.match(priceBridge,/WayfarerNearby\?\.applyQuotes\(payload,trip\)/);
  assert.match(priceBridge,/\[data-airport-iata\]/);
  assert.match(backend,/import airportData from '\.\.\/data\.json' with \{type:'json'\}/);
  assert.match(backend,/mapAvailable,wikidataAvailable,airports,hotels/);
  assert.match(css,/\.wf-nearby-card/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.doesNotMatch(script,/fetch\('\/api\/travel-search/);
  assert.doesNotMatch(script,/SERPAPI_API_KEY|GOOGLE_API_KEY/);
});
