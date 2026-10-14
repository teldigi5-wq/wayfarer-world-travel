import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {rankReferenceAirports,destinationIntelligence} from '../destination-intelligence.mjs';
import handler from '../api/explore.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

async function call(query){
  const original=globalThis.fetch;
  let network=0;
  globalThis.fetch=async()=>{network++;throw Error('External provider unavailable in test');};
  const r={code:0,body:null,setHeader(){},status(n){this.code=n;return this;},
    json(body){this.body=body;return this;}};
  try{await handler({method:'GET',query},r);}finally{globalThis.fetch=original;}
  return {...r,network};
}
test('every global airport candidate comes from a sourced IATA reference, never a fake fare',()=>{
  const sample=[
    {name:'City small airport',iata:'AAA',code:'FR',lat:48.8566,lon:2.3522,type:'small_airport',scheduledService:false},
    {name:'Gateway major',iata:'BBB',code:'FR',lat:48.9,lon:2.6,type:'large_airport',scheduledService:true},
    {name:'Regional international',iata:'CCC',code:'BE',lat:49.5,lon:3.1,type:'medium_airport',scheduledService:true}
  ];
  const result=rankReferenceAirports(sample,48.8566,2.3522,{countryCode:'FR'});
  assert.equal(result.nearby[0].iata,'AAA');
  assert.equal(result.gateways[0].iata,'BBB');
  assert.equal(result.nearby[0].referenceTier,'local airfield reference');
  assert.equal(result.gateways[0].scheduledServiceReference,'yes');
  assert.ok(result.nearby.every(a=>a.price===null&&Number.isFinite(a.latitude)));
  const brief=destinationIntelligence({
    lat:48.8566,lon:2.3522,countryCode:'FR',airports:result.nearby,
    gateways:result.gateways,hotels:[],partial:true
  });
  assert.equal(brief.country.name,'France');
  assert.equal(brief.country.capital,'Paris');
  assert.equal(brief.closestAirport.iata,'AAA');
  assert.equal(brief.gatewayCandidates[0].iata,'BBB');
  assert.equal(brief.hotelSourceStatus,'pending');
  assert.ok(brief.guidance.some(x=>x.includes('not a verified scheduled airline gateway')));
  assert.ok(brief.guidance.some(x=>x.includes('pending')));
  assert.ok(!JSON.stringify(brief).includes('"fare":'));
});

test('seaplane proximity is clearly distinguished from airline gateways in both directory tiers',async()=>{
  const references=[
    {name:'Beira Lake Seaplane Base',iata:'BYV',code:'LK',lat:6.92944,lon:79.85417,
      type:'seaplane_base',scheduledService:false},
    {name:'Bandaranaike International Airport',iata:'CMB',code:'LK',lat:7.18076,lon:79.88410,
      type:'large_airport',scheduledService:true}
  ];
  const rank=rankReferenceAirports(references,6.9271,79.8612,{countryCode:'LK'});
  const i=destinationIntelligence({countryCode:'LK',airports:rank.nearby,gateways:rank.gateways});
  assert.equal(i.closestAirport.iata,'BYV');
  assert.ok(i.guidance.some(x=>x.includes('seaplane reference')));
  assert.ok(i.gatewayCandidates.some(x=>x.iata==='CMB'));
  assert.ok(rank.nearby.every(x=>x.price===null));
  const actual=await call({mode:'airports',lat:'6.9271',lon:'79.8612',countryCode:'LK'});
  assert.equal(actual.code,200);
  assert.equal(actual.network,0);
  assert.equal(actual.body.intelligence.country.code,'LK');
  assert.ok(actual.body.airports.every(x=>x.price===null));
});

test('global nearby airport and country facts work across widely separated countries without provider calls',async()=>{
  const destinations=[
    ['Paris','FR',48.8566,2.3522],
    ['Tokyo','JP',35.6762,139.6503],
    ['Sydney','AU',-33.8688,151.2093],
    ['Nairobi','KE',-1.2921,36.8219],
    ['Colombo','LK',6.9271,79.8612],
    ['Bangkok','TH',13.7563,100.5018]
  ];
  for(const [name,countryCode,lat,lon] of destinations){
    const {code,body,network}=await call({mode:'airports',lat:String(lat),lon:String(lon),countryCode});
    assert.equal(code,200,name);
    assert.equal(network,0,name+' must use locally indexed reference data');
    assert.equal(body.ok,true);
    assert.equal(body.partial,true);
    assert.equal(body.intelligence.country.code,countryCode);
    assert.ok(body.intelligence.country.name.length>2);
    assert.ok(Array.isArray(body.intelligence.gatewayCandidates));
    assert.ok(body.airports.every(x=>x.price===null&&
      Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)));
    assert.doesNotMatch(JSON.stringify(body),/Hotel Sigiriya/);
  }
});

test('worldwide hotel reference coverage is explicit, never fabricated, even with public outage',async()=>{
  const results=await Promise.all([
    call({mode:'nearby',lat:'48.8566',lon:'2.3522',countryCode:'FR'}),
    call({mode:'nearby',lat:'-33.8688',lon:'151.2093',countryCode:'AU'})
  ]);
  for(const result of results){
    assert.equal(result.code,200);
    assert.equal(result.body.intelligence.hotelSourceStatus,'provider-unavailable');
    assert.equal(result.body.hotels.length,0);
    assert.ok(result.body.intelligence.guidance.some(x=>x.includes('No named hotels were confirmed')));
    assert.doesNotMatch(JSON.stringify(result.body),/Hotel Sigiriya|fake rate|verified visa/);
  }
});

test('cross-border gateway caution appears only for real source-backed international candidates',()=>{
  const airports=[
    {iata:'AAA',name:'Local Airfield',distanceKm:6,countryCode:'FR',referenceTier:'local airfield reference'},
    {iata:'BBB',name:'Neighbor Gateway',distanceKm:45,countryCode:'BE',referenceTier:'major gateway reference'}
  ];
  const b=destinationIntelligence({
    countryCode:'FR',airports,gateways:[airports[1]],hotels:[{name:'Mapped Hotel'}]
  });
  assert.ok(b.guidance.some(x=>x.includes('across a national border')));
  assert.equal(b.hotelReferenceCount,1);
  assert.equal(b.hotelSourceStatus,'reference-records');
});

test('browser-side intelligence panel opens price comparison only on a real traveler click',()=>{
  const source=read('destination-intelligence.js');
  assert.doesNotMatch(source,/fetch\(|api\.groq|SERPAPI_API_KEY|maps\.googleapis/);
  const targetNames=['wf-destination-intelligence','wf-intelligence-facts',
    'wf-intelligence-gateways','wf-intelligence-guidance','wf-intelligence-foot'];
  class Element {
    constructor(){this.children=[];this.textContent='';this.hidden=true;
      this.listeners={};this.attributes={};this.value='';}
    replaceChildren(...v){this.children=[...v];}
    append(...x){this.children.push(...x);}
    addEventListener(key,fn){this.listeners[key]=fn;}
    scrollIntoView(){}
    focus(){}
    dispatchEvent(){}
  }
  const els=Object.fromEntries([...targetNames,'travel-arrival','wf-tab-prices',
    'wayfarer-travel-research','travel-origin'].map(x=>[x,new Element()]));
  let clicks=0;
  els['wf-tab-prices'].click=()=>{clicks++;};
  const context={window:{},document:{getElementById:id=>els[id]||null,
    createElement:()=>new Element()},Number,String,Array,Event:class{}};
  vm.runInNewContext(source,context,{timeout:1000});
  context.window.WayfarerDestinationIntelligence.choose({
    name:'Paris',countryCode:'FR',latitude:48.8566,longitude:2.3522
  });
  const brief=destinationIntelligence({countryCode:'FR',
    airports:[{name:'Paris Regional',iata:'ORY',distanceKm:12,referenceTier:'regional gateway reference'}],
    gateways:[{name:'Paris Regional',iata:'ORY',distanceKm:12,
      referenceTier:'regional gateway reference'}],hotels:[],partial:true});
  context.window.WayfarerDestinationIntelligence.show({intelligence:brief});
  assert.equal(clicks,0,'planning guidance must not execute supplier lookup');
  const btn=els['wf-intelligence-gateways'].children[0].children[1];
  btn.listeners.click();
  assert.equal(clicks,1);
  assert.equal(els['travel-arrival'].value,'ORY');
});

test('no extra billing keys, map requests or model calls introduced by deterministic intelligence',()=>{
  const html=read('index.html'),client=read('nearby-results.js'),backend=read('api/explore.js');
  assert.match(html,/id="wf-destination-intelligence"/);
  assert.ok(html.indexOf('src="destination-intelligence.js"')<
    html.indexOf('src="nearby-results.js"'));
  assert.match(client,/WayfarerDestinationIntelligence\?\.show\(d\)/);
  assert.match(client,/countryCode:chosen.countryCode/);
  assert.match(backend,/rankReferenceAirports/);
  assert.match(backend,/destinationIntelligence/);
  assert.doesNotMatch(read('destination-intelligence.mjs'),/openai|groq|serpapi/i);
});

test('actual destination-intelligence module converts a partial hotel-pending brief to unavailable without erasing verified airport gateways',()=>{
  const content=read('destination-intelligence.js');
  const ids=['wf-destination-intelligence','wf-intelligence-facts',
    'wf-intelligence-gateways','wf-intelligence-guidance','wf-intelligence-foot',
    'travel-arrival','wf-tab-prices','wayfarer-travel-research','travel-origin'];
  class Element {
    constructor(){this.children=[];this.textContent='';this.hidden=true;this.listeners={};this.value='';}
    replaceChildren(...v){this.children=[...v];}
    append(...v){this.children.push(...v);}
    addEventListener(name,fn){this.listeners[name]=fn;}
    scrollIntoView(){}
    focus(){}
    dispatchEvent(){}
  }
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
  const context={window:{},document:{getElementById:id=>elements[id]||null,
    createElement:()=>new Element()},Number,String,Array,Event:class{}};
  vm.runInNewContext(content,context,{timeout:1000});
  const ui=context.window.WayfarerDestinationIntelligence;
  ui.choose({name:'Rome',countryCode:'IT',country:'Italy',latitude:41.9028,longitude:12.4964});
  const brief=destinationIntelligence({
    lat:41.9028,lon:12.4964,countryCode:'IT',
    airports:[{name:'Rome Fiumicino',iata:'FCO',distanceKm:21,
      referenceTier:'major gateway reference'}],
    gateways:[{name:'Rome Fiumicino',iata:'FCO',distanceKm:21,
      referenceTier:'major gateway reference'}],hotels:[],partial:true
  });
  ui.show({intelligence:brief});
  const facts=elements['wf-intelligence-facts'];
  const gateways=elements['wf-intelligence-gateways'];
  assert.match(facts.children[3].children[1].textContent,/pending/i);
  assert.equal(gateways.children.length,1);
  ui.finishPartial();
  assert.match(facts.children[3].children[1].textContent,/providers unavailable/i);
  assert.equal(gateways.children.length,1);
  assert.match(gateways.children[0].children[0].children[0].textContent,/FCO/);
  assert.match(elements['wf-intelligence-foot'].textContent,/Public hotel reference lookup unavailable/);
  ui.choose({name:'Unknown',countryCode:'XX',latitude:0,longitude:0});
  ui.finishPartial();
  assert.match(facts.children[0].textContent,/temporarily unavailable/);
  assert.equal(gateways.children.length,0);
  assert.doesNotMatch(elements['wf-intelligence-foot'].textContent,/pending/i);
});
