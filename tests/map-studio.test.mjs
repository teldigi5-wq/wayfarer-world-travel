import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import handler from '../api/explore.js';
import {parseWikidataHotels} from '../worldwide-hotel-sources.mjs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

function setup(){
  class Node{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.textContent='';
      this.dataset={};this.attributes={};this.listeners={};this.hidden=false;this.value='';}
    replaceChildren(...children){this.children=children;}
    append(...children){this.children.push(...children);}
    addEventListener(name,fn){this.listeners[name]=fn;}
    setAttribute(name,val){this.attributes[name]=val;}
    getAttribute(name){return this.attributes[name]||null;}
    querySelectorAll(tag){return tag==='button'?this.children.filter(x=>x.tagName==='BUTTON'):[];}
    click(){this.listeners.click?.();}
  }
  const ids=Object.fromEntries(['wf-map-studio','wf-map-viewport','wf-map-pins',
    'wf-map-title','wf-map-status','wf-map-osm-link','wf-map-google-link',
    'wf-map-directions-link','wf-map-launch','wf-map-hide','wf-map-scope',
    'wf-map-insights'].map(x=>[x,new Node()]));
  ids['wf-map-scope'].value='near';
  const window={};
  const sandbox={window,document:{getElementById:id=>ids[id]||null,createElement:tag=>new Node(tag)},
    URL,Math,Number,String};
  vm.runInNewContext(read('map-studio.js'),sandbox,{timeout:1000});
  return {ids,map:window.WayfarerMap};
}

test('no embedded maps or third-party calls happen before explicit traveler map interaction',()=>{
  const {ids,map}=setup();
  assert.ok(map);
  assert.equal(ids['wf-map-studio'].hidden,true);
  assert.equal(ids['wf-map-viewport'].children.some(x=>x.tagName==='IFRAME'),false);
  map.selectDestination({name:'Sigiriya',country:'Sri Lanka',latitude:7.957,longitude:80.760});
  assert.equal(ids['wf-map-studio'].hidden,false);
  assert.equal(ids['wf-map-viewport'].children.some(x=>x.tagName==='IFRAME'),false);
  assert.match(ids['wf-map-status'].textContent,/Map ready for Sigiriya/);
  assert.match(ids['wf-map-google-link'].href,/^https:\/\/www\.google\.com\/maps\/search\/\?/);
  const google=new URL(ids['wf-map-google-link'].href);
  assert.equal(google.searchParams.get('api'),'1');
  assert.equal(google.searchParams.get('query'),'7.95700,80.76000');
  assert.ok(!google.searchParams.has('key'));
  ids['wf-map-launch'].click();
  const frame=ids['wf-map-viewport'].children[0];
  assert.equal(frame.tagName,'IFRAME');
  const url=new URL(frame.src);
  assert.equal(url.hostname,'www.openstreetmap.org');
  assert.equal(url.pathname,'/export/embed.html');
  assert.equal(url.searchParams.get('marker'),'7.957000,80.760000');
  assert.ok(url.searchParams.get('bbox'));
  assert.equal(frame.loading,'lazy');
  assert.equal(ids['wf-map-launch'].hidden,true);
  ids['wf-map-hide'].click();
  assert.equal(ids['wf-map-viewport'].children.some(x=>x.tagName==='IFRAME'),false);
});

test('focusing a mapped hotel displays its true supplied coordinates and never invents travel time',()=>{
  const {ids,map}=setup();map.selectDestination({
    name:'Sigiriya',latitude:7.957,longitude:80.760
  });
  map.setNearby({airports:[{name:'Sigiriya Airport',iata:'GIU',latitude:7.95732,
    longitude:80.72915,distanceKm:3.4}],
    hotels:[{name:'Hotel Sigiriya',latitude:7.94991,longitude:80.76315,distanceKm:.9}]});
  assert.equal(ids['wf-map-pins'].children.length,3);
  assert.match(ids['wf-map-insights'].children[0].children[1].textContent,/Sigiriya Airport.*3\.4/);
  assert.match(ids['wf-map-insights'].children[2].children[1].textContent,/provider search/);
  map.focusOn({type:'hotel',name:'Hotel Sigiriya',latitude:7.94991,longitude:80.76315},true);
  const frame=ids['wf-map-viewport'].children[0];
  assert.match(frame.src,/marker=7\.949910%2C80\.763150/);
  assert.equal(new URL(ids['wf-map-directions-link'].href).hostname,'www.google.com');
  assert.equal(new URL(ids['wf-map-directions-link'].href).searchParams.get('api'),'1');
});

test('malformed, unverified, and supplier-only coordinates never generate a mapped location',()=>{
  const {ids,map}=setup();
  map.selectDestination({name:'Paris',latitude:48.8566,longitude:2.3522});
  const bad=[{name:'No coordinates',latitude:null,longitude:null},
    {name:'Wrong range',latitude:181,longitude:2},
    {name:'String coords',latitude:'48',longitude:'2'}];
  for(const p of bad)assert.equal(map.focusOn(p,true),false);
  map.setNearby({airports:bad,hotels:[...bad,{name:'Hotel source',latitude:48.86,longitude:2.36}]});
  assert.equal(ids['wf-map-pins'].children.length,2);
  map.selectDestination({name:'Unknown',latitude:undefined,longitude:undefined});
  assert.equal(ids['wf-map-studio'].hidden,true);
});

test('flight provider handoff includes only known fixed official airline links',()=>{
  const source=read('travel-research.js');
  assert.match(source,/https:\/\/www\.srilankan\.com\//);
  assert.match(source,/https:\/\/www\.qatarairways\.com\/en-lk\/homepage\.html/);
  assert.match(source,/https:\/\/www\.singaporeair\.com\/en_UK\/se\/home\//);
  assert.match(source,/Object\.hasOwn\(officialAirlines,name\)/);
  assert.match(source,/addOfficialAirlineHandoff\(card,offer\.segments\)/);
  assert.doesNotMatch(source,/window\.location\s*=|checkout\(/);
});

test('map integration explicitly delegates coordinate-focused actions without paid Google Maps APIs',()=>{
  const index=read('index.html'),nearby=read('nearby-results.js');
  const app=read('premium-app.js'),config=JSON.parse(read('vercel.json'));
  assert.ok(index.indexOf('src="map-studio.js"')<index.indexOf('src="nearby-results.js"'));
  assert.match(index,/id="wf-map-insights"/);
  assert.match(nearby,/WayfarerMap\?\.selectDestination\(chosen\)/);
  assert.match(nearby,/WayfarerMap\?\.setNearby\(items\)/);
  assert.match(app,/WayfarerMap\?\.focusOn\(/);
  assert.match(config.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value,
    /frame-src https:\/\/www\.openstreetmap\.org/);
  assert.doesNotMatch(read('map-studio.js'),/maps\.googleapis\.com|GOOGLE_MAPS_API_KEY|tile\.openstreetmap\.org/);
});

async function callNearby(query){
  const prev=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Simulated public provider outage');};
  const res={code:0,data:null,setHeader(){},status(n){this.code=n;return this;},
    json(data){this.data=data;return this;}};
  try{await handler({method:'GET',query},res);}finally{globalThis.fetch=prev;}
  return res;
}
test('both fast and fallback worldwide map records have source coordinates, not inferred prices',async()=>{
  const immediate=await callNearby({mode:'airports',lat:'7.957',lon:'80.760'});
  assert.equal(immediate.code,200);
  const giu=immediate.data.airports.find(x=>x.iata==='GIU');
  assert.equal(giu.latitude,7.95732);
  assert.equal(giu.longitude,80.72915);
  assert.equal(giu.price,null);

  const detailed=await callNearby({mode:'nearby',lat:'7.957',lon:'80.760'});
  assert.equal(detailed.code,200);
  const hotel=detailed.data.hotels.find(x=>x.name==='Hotel Sigiriya');
  assert.equal(hotel.latitude,7.94991);
  assert.equal(hotel.longitude,80.76315);
  assert.equal(hotel.price,null);

  const wd=parseWikidataHotels({results:{bindings:[{
    place:{value:'https://www.wikidata.org/entity/Q195378'},
    placeLabel:{value:'Mapped Hotel Example'},
    location:{value:'Point(2.35 48.86)'}
  }]}},48.8566,2.3522);
  assert.equal(wd[0].latitude,48.86);
  assert.equal(wd[0].longitude,2.35);
});


test('two source-mapped stays sharing a name stay individually clickable and accessible',()=>{
  const {ids,map}=setup();
  map.selectDestination({name:'Paris',country:'France',latitude:48.8566,longitude:2.3522});
  const stay1={name:'Same Name Hotel',source:'Synthetic source fixture',
    latitude:48.858,longitude:2.351,distanceKm:0.3};
  const stay2={name:'Same Name Hotel',source:'Synthetic source fixture',
    latitude:48.868,longitude:2.361,distanceKm:1.8};
  map.setNearby({airports:[],hotels:[stay1,stay2]});
  const buttons=ids['wf-map-pins'].children;
  assert.equal(buttons.length,3,'The selected city plus two distinct-coordinate stays are shown');
  assert.notEqual(buttons[1].dataset.place,buttons[2].dataset.place,
    'Different coordinates with identical names must not collapse');
  assert.equal(buttons.filter(x=>x.getAttribute('aria-pressed')==='true').length,1);
  assert.equal(buttons[0].getAttribute('aria-pressed'),'true');
  assert.match(buttons[1].children[1].children[1].textContent,/48\.85800, 2\.35100/);
  assert.match(buttons[2].children[1].children[1].textContent,/48\.86800, 2\.36100/);
  assert.match(buttons[2].getAttribute('aria-label'),/48\.86800, 2\.36100/);
  assert.equal(ids['wf-map-viewport'].children.some(x=>x.tagName==='IFRAME'),false,
    'No third-party map imagery before an explicit pin click or map-open action');
  buttons[1].click();
  assert.equal(ids['wf-map-viewport'].children[0].tagName,'IFRAME');
  assert.equal(new URL(ids['wf-map-viewport'].children[0].src).searchParams.get('marker'),
    '48.858000,2.351000');
  assert.equal(buttons[1].getAttribute('aria-pressed'),'true');
  assert.equal(buttons[2].getAttribute('aria-pressed'),'false');
  buttons[2].click();
  assert.equal(new URL(ids['wf-map-viewport'].children[0].src).searchParams.get('marker'),
    '48.868000,2.361000');
  assert.equal(buttons[1].getAttribute('aria-pressed'),'false');
  assert.equal(buttons[2].getAttribute('aria-pressed'),'true');
  assert.equal(new URL(ids['wf-map-directions-link'].href).searchParams.get('destination'),
    '48.86800,2.36100');
});
test('map pin identity distinguishes type even at identical coordinates and deduplicates identical references',()=>{
  const {ids,map}=setup();
  map.selectDestination({name:'Transit Point',latitude:1.35,longitude:103.82});
  const point={name:'Same Place',latitude:1.36,longitude:103.83,distanceKm:1};
  map.setNearby({airports:[point],hotels:[point,point]});
  const buttons=ids['wf-map-pins'].children;
  assert.equal(buttons.length,3,'Airport and hotel retain distinct category; exact duplicate stay is deduplicated');
  assert.notEqual(buttons[1].dataset.place,buttons[2].dataset.place);
  assert.equal(buttons.filter(x=>x.getAttribute('aria-pressed')==='true').length,1);
  buttons[2].click();
  assert.equal(buttons[2].getAttribute('aria-pressed'),'true');
  assert.equal(buttons[1].getAttribute('aria-pressed'),'false');
  ids['wf-map-hide'].click();
  assert.equal(ids['wf-map-viewport'].children.some(x=>x.tagName==='IFRAME'),false);
  map.selectDestination({name:'New City',latitude:40.7128,longitude:-74.006});
  assert.equal(ids['wf-map-pins'].children.length,1);
  assert.equal(ids['wf-map-pins'].children[0].getAttribute('aria-pressed'),'true');
  assert.equal(ids['wf-map-viewport'].children.some(x=>x.tagName==='IFRAME'),false);
});
test('map selection never relies on label-only identity or paid Google Maps SDK',()=>{
  const source=read('map-studio.js');
  assert.match(source,/const pinKey=item=>/);
  assert.match(source,/item\.latitude\.toFixed\(5\),item\.longitude\.toFixed\(5\)/);
  assert.match(source,/b\.dataset\.place===focus\.key/);
  assert.match(source,/button\.setAttribute\('aria-label'/);
  assert.doesNotMatch(source,/const key=entry\.type\+':'\+entry\.name/);
  assert.doesNotMatch(source,/maps\.googleapis\.com|GOOGLE_MAPS_API_KEY|mapboxgl|new google\.maps/);
});
