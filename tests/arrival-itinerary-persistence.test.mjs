import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');
const helper=readFileSync(new URL('../journey-integrity.js',import.meta.url),'utf8');
const capStart=source.indexOf('function captureItineraryDraft(){');
const saveStart=source.indexOf("$('#save-trip').onclick=",capStart);
const saveEnd=source.indexOf(';const arrivalChecklistTrip=',saveStart);
const renderStart=source.indexOf('function renderTrips(){',saveEnd);
const renderEnd=source.indexOf("$('#journey-search').addEventListener('input',renderTrips)",renderStart);
assert.ok(capStart>0&&saveStart>capStart&&saveEnd>saveStart&&renderStart>saveEnd&&renderEnd>renderStart);
const snippet=source.slice(capStart,saveEnd+1)+'\n'+source.slice(renderStart,renderEnd);
class Element{
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.textContent='';this.innerHTML='';
    this.value='';this.children=[];this.dataset={};this.style={};this.className='';
    this.listeners={};this.hidden=false;this.connected=true;this.src='';this.alt='';
  }
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  querySelectorAll(selector){if(selector==='article.day')return this.children.filter(x=>
    x.tagName==='ARTICLE'&&x.className==='day');return [];}
  querySelector(selector){const wanted={h3:'H3',p:'P'}[selector];return this.children.find(x=>x.tagName===wanted)||null;}
  addEventListener(name,cb){this.listeners[name]=cb;}
  focus(){this.focused=true;}
  get isConnected(){return this.connected;}
}
function fixture(){
  const nodes=new Map();
  const $=key=>{if(!nodes.has(key))nodes.set(key,new Element());return nodes.get(key);};
  const day=(title,summary)=>{
    const article=new Element('article');article.className='day';
    const h=new Element('h3');h.textContent=title;
    const p=new Element('p');p.textContent=summary;
    article.append(h,p);return article;
  };
  $('#itinerary').replaceChildren(day('Arrive from airport','Choose real transportation independently.'),
    day('Architecture and history','Confirm official museum opening hours.'),
    day('Nature and gardens','Recheck routes and travel-time assumptions.'));
  $('#itinerary-title').textContent='My private Tokyo journey';
  $('#plan-status').textContent='Groq AI itinerary';
  $('#days').value='3';$('#budget').value='190';$('#pace').value='Balanced';
  const preferences=['Culture','Architecture','Nature'].map((label,i)=>({
    textContent:label,on:i!==2,
    classList:{toggle(name,value){if(name==='on')this.owner.on=value;},
      contains(name){return name==='on'&&this.owner.on;}}
  }));
  preferences.forEach(p=>{p.classList.owner=p;});
  const $$=selector=>selector==='.pref.on'?preferences.filter(p=>p.on):
    selector==='.pref'?preferences:[];
  const storeCalls=[],mapCalls=[],nearbyCalls=[],viewCalls=[];
  const c=vm.createContext({
    $,$$,trips:[],selected:'Tokyo',
    worldSelection:{name:'Tokyo',country:'Japan',countryCode:'JP',latitude:35.6762,longitude:139.6503},
    destinations:[],agentData:{ok:true},Number,String,Array,Date,Math,
    document:{createElement:tag=>new Element(tag)},
    window:{WayfarerMap:{selectDestination:x=>mapCalls.push(x)}},
    nearbyPlaces:place=>nearbyCalls.push(place),
    store:(key,val)=>storeCalls.push({key,val:JSON.parse(JSON.stringify(val))}),
    toast:()=>{},resetAgents:()=>{
      $('#plan-status').textContent='Sample itinerary';
    },
    build:()=>{
      $('#itinerary-title').textContent='Replacement local sample';
      $('#itinerary').replaceChildren(day('Sample reset','Temporary regenerated sample.'));
    },
    arrival:()=>{},view:x=>viewCalls.push(x),
    esc:x=>String(x)
  });
  vm.runInContext(helper,c,{timeout:1000});
  vm.runInContext(snippet,c,{timeout:1000});
  return {c,$,day,preferences,storeCalls,mapCalls,nearbyCalls,viewCalls,
    save:()=>vm.runInContext("$('#save-trip').onclick()",c),
    render:()=>vm.runInContext('renderTrips()',c)};
}
function findButtons(card){
  const found=[];
  const walk=node=>{if(node.tagName==='BUTTON')found.push(node);for(const child of node.children)walk(child);};
  walk(card);return found;
}
test('real Save Journey flow persists complete bounded AI draft and explicit world coordinate identity',()=>{
  const f=fixture();f.save();
  assert.equal(f.storeCalls.length,1);
  assert.equal(f.storeCalls[0].key,'wf-trips-v2');
  const [saved]=f.storeCalls[0].val;
  assert.equal(saved.country,'Japan');
  assert.equal(saved.worldPlace.latitude,35.6762);
  assert.equal(saved.worldPlace.longitude,139.6503);
  assert.equal(saved.itineraryDraft.basis,'ai-draft');
  assert.equal(saved.itineraryDraft.days.length,3);
  assert.equal(saved.itineraryDraft.title,'My private Tokyo journey');
  assert.match(saved.itineraryDraft.days[2].summary,/routes and travel-time/);
  assert.ok(!JSON.stringify(saved).includes('api-key'),'Snapshot cannot introduce keys');
});
test('resume restores text-only saved AI days after sample reset and preserves source uncertainty',()=>{
  const f=fixture();f.save();f.render();
  const cards=f.$('#saved').children;
  assert.equal(cards.length,1);
  const buttons=findButtons(cards[0]);
  assert.deepEqual(buttons.map(x=>x.textContent),['Continue planning ↗','Arrival plan →','Remove']);
  buttons[0].onclick();
  assert.equal(f.$('#itinerary-title').textContent,'My private Tokyo journey');
  assert.equal(f.$('#itinerary').children.length,3);
  assert.equal(f.$('#itinerary').children[1].children[1].textContent,'Architecture and history');
  assert.match(f.$('#plan-status').textContent,/Saved AI draft/);
  assert.match(f.$('#plan-source').textContent,/Historical draft only/);
  assert.match(f.$('#plan-source').textContent,/not been rechecked/);
  assert.equal(f.viewCalls.at(-1),'studio');
  assert.equal(f.mapCalls.at(-1).longitude,139.6503);
  assert.equal(f.nearbyCalls.at(-1).latitude,35.6762);
  f.render();findButtons(f.$('#saved').children[0])[1].onclick();
  assert.equal(f.viewCalls.at(-1),'arrival');
  assert.equal(f.$('#itinerary').children.length,3);
});
test('saving and reopening a draft restores interests as well as pace, daily budget and itinerary',()=>{
  const f=fixture();f.save();f.render();
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('trips[0].moods',f.c))),['Culture','Architecture']);
  f.preferences[0].on=false;f.preferences[1].on=false;f.preferences[2].on=true;
  f.$('#pace').value='Full & energetic';
  f.$('#budget').value='500';
  findButtons(f.$('#saved').children[0])[0].onclick();
  assert.equal(f.$('#pace').value,'Balanced');
  assert.equal(f.$('#budget').value,'190');
  assert.deepEqual(f.preferences.map(p=>p.on),[true,true,false]);
  assert.equal(f.$('#itinerary-title').textContent,'My private Tokyo journey');
});

test('saved HTML-like text is never executed or inserted as trusted markup',()=>{
  const f=fixture();
  const attack='<img src=x onerror=alert(1)>';
  f.$('#itinerary').children[0].children[2-1].textContent=attack;
  f.save();f.render();
  findButtons(f.$('#saved').children[0])[0].onclick();
  assert.equal(f.$('#itinerary').innerHTML,'','Itinerary renderer never assigns innerHTML');
  assert.equal(f.$('#itinerary').children[0].children[2].textContent,attack);
  assert.equal(f.$('#itinerary').children[0].children[2].children.length,0);
});
test('corrupt stored snapshot cannot replace safe illustrative reconstruction',()=>{
  const f=fixture();f.save();
  vm.runInContext("trips[0].itineraryDraft.days[0].summary='x'.repeat(1000)",f.c);
  f.render();findButtons(f.$('#saved').children[0])[0].onclick();
  assert.equal(f.$('#itinerary-title').textContent,'Replacement local sample');
  assert.equal(f.$('#plan-status').textContent,'Sample itinerary');
  assert.match(f.$('#saved').children[0].children[1].children[2].textContent,/No saved itinerary content/);
});
test('saved snapshot does not pretend refreshed live weather, tickets, transfers, visas or rooms',()=>{
  const f=fixture();f.save();f.render();
  findButtons(f.$('#saved').children[0])[1].onclick();
  assert.match(f.$('#plan-source').textContent,/provider sources, availability, pricing, routes and opening hours have not been rechecked/);
  assert.equal(f.$('#plan-status').textContent,'Saved AI draft');
  assert.equal(vm.runInContext('agentData',f.c),null);
  assert.equal(f.viewCalls.at(-1),'arrival');
  assert.doesNotMatch(source.slice(capStart,saveEnd),/fetch\(|https?:\/\//);
});
