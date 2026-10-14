import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('premium-app.js');
const research=read('travel-research.js');

function navFixture(){
  const ids=['discover','destinations-page','guides-page','studio','arrival','trips'];
  function node(id,active=false){
    const classes=new Set(active?['active']:[]);
    const attrs={...(active?{'aria-current':'page'}:{})};
    return {id,dataset:{view:id},tagName:'BUTTON',
      classList:{toggle(k,v){if(v===undefined)v=!classes.has(k);
        v?classes.add(k):classes.delete(k);return v;},contains:k=>classes.has(k)},
      setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];},
      getAttribute(k){return attrs[k]??null;}
    };
  }
  const views=ids.map((id,i)=>node(id,i===0)),primary=ids.map((id,i)=>node(id,i===0));
  let arrivals=0,journeys=0,scrolls=0;
  const env={
    $:()=>primary[0],
    $$:selector=>selector==='.view'?views:
      selector==='.nav-links button'?primary:
      selector==='[data-view]'?primary:[],
    arrival:()=>{arrivals++;},renderTrips:()=>{journeys++;},
    scrollTo:()=>{scrolls++;}
  };
  const a=app.indexOf('function view(id){'),b=app.indexOf('function renderDest()',a);
  assert.ok(a>=0&&b>a);
  vm.runInNewContext(app.slice(a,b),env,{timeout:1000});
  return {env,views,primary,ids,counts:()=>({arrivals,journeys,scrolls})};
}
test('the REAL Wayfarer router iterates the full navigation list across six routes',()=>{
  const f=navFixture();
  for(const page of [...f.ids,...f.ids.toReversed()]){
    assert.doesNotThrow(()=>f.env.view(page),'Navigation should never throw on '+page);
    assert.deepEqual(f.views.filter(x=>x.classList.contains('active')).map(x=>x.id),[page]);
    assert.deepEqual(f.primary.filter(x=>x.classList.contains('active')).map(x=>x.id),[page]);
    assert.deepEqual(f.primary.filter(x=>x.getAttribute('aria-current')==='page').map(x=>x.id),[page]);
  }
  assert.equal(f.counts().arrivals,2);
  assert.equal(f.counts().journeys,2);
  assert.equal(f.counts().scrolls,12);
});
test('clicking the actual router binding switches pages instead of throwing a Node TypeError',()=>{
  const f=navFixture();
  f.primary.find(x=>x.id==='studio').onclick({preventDefault(){}});
  assert.equal(f.primary.find(x=>x.id==='studio').getAttribute('aria-current'),'page');
  f.primary.find(x=>x.id==='trips').onclick({preventDefault(){}});
  assert.equal(f.primary.find(x=>x.id==='trips').getAttribute('aria-current'),'page');
  assert.match(app,/\$\$\('\.nav-links button'\)\.forEach/);
  assert.doesNotMatch(app,/(?<!\$)\$\('\.nav-links button'\)\.forEach/);
});
function guardFixture(){
  const a=research.indexOf('    const locationAtSearch='),
    b=research.indexOf('    try{\n      const ctrl=new AbortController()',a);
  assert.ok(a>0&&b>a);
  const values={
    'travel-origin':'CMB','travel-arrival':'ORY',
    'destination':'Paris','world-query':'Paris',
    'check-in':'2026-11-12','check-out':'2026-11-15',
    'stay-adults':'2','travel-airfare':'','days':'3','budget':'180'
  };
  let place={name:'Paris',latitude:48.8566,longitude:2.3522,countryCode:'FR'};
  const env={Number,window:{WayfarerNearby:{
    currentLocation:()=>place,
    isCurrentLocation:old=>old.name===place.name&&old.latitude===place.latitude&&
      old.longitude===place.longitude&&old.countryCode===place.countryCode
  }},get:id=>values[id],
  trip:{from:'CMB',to:'ORY',destination:'Paris',
    checkIn:'2026-11-12',checkOut:'2026-11-15',adults:2,
    flightBudget:0,groundBudget:540}};
  vm.runInNewContext(research.slice(a,b)+'\nthis.requestStillCurrent=requestStillCurrent;',env,
    {timeout:1000});
  return {env,values,changePlace:x=>{place=x}};
}
test('an actual protected price-search response must match the submitted form before rendering',()=>{
  const f=guardFixture();
  assert.equal(f.env.requestStillCurrent(),true);
  f.values['check-out']='2026-11-18';
  assert.equal(f.env.requestStillCurrent(),false);
  f.values['check-out']='2026-11-15';
  f.values['stay-adults']='3';
  assert.equal(f.env.requestStillCurrent(),false);
  f.values['stay-adults']='2';
  f.values['travel-arrival']='CDG';
  assert.equal(f.env.requestStillCurrent(),false);
});
test('a same-name destination in another country cannot receive an old provider response',()=>{
  const f=guardFixture();
  assert.equal(f.env.requestStillCurrent(),true);
  f.changePlace({name:'Paris',latitude:33.6609,longitude:-95.5555,countryCode:'US'});
  assert.equal(f.env.requestStillCurrent(),false);
  assert.match(research,/if\(!requestStillCurrent\(\)\)\{/);
  assert.ok(research.indexOf('if(!requestStillCurrent()){')<research.indexOf('show(payload);'));
  assert.match(research,/applyQuotes\(payload,trip,locationAtSearch\)/);
  assert.doesNotMatch(research,/localStorage\.setItem\(.+beta/i);
});
