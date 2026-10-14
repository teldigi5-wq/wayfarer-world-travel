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

function domFixture() {
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
    fetch:async()=>({ok:true,json:async()=>state})
  };
  vm.runInNewContext(script,environment,{timeout:1000});
  const textOf=el=>String(el.textContent||'')+' '+(el.children||[]).map(textOf).join(' ');
  return {ids,state,public:environment.window.WayfarerNearby,textOf};
}

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
  assert.match(backend,/mapAvailable,airports,hotels/);
  assert.match(css,/\.wf-nearby-card/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.doesNotMatch(script,/fetch\('\/api\/travel-search/);
  assert.doesNotMatch(script,/SERPAPI_API_KEY|GOOGLE_API_KEY/);
});
