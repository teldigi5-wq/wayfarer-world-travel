import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');

function planningFixture(){
  const elems=new Map();
  const get=id=>{
    if(!elems.has(id))elems.set(id,{
      textContent:'',innerHTML:'',value:'',checked:false,onchange:null,oninput:null,
      onclick:null,classList:{toggle(){}},checkValidity:()=>true,reportValidity:()=>false,
      replaceChildren(){this.innerHTML='';}
    });
    return elems.get(id);
  };
  get('#days').value='3';get('#budget').value='180';get('#pace').value='Balanced';
  const prefs=[{textContent:'Nature',onclick:null,classList:{toggle(){} }},
    {textContent:'Culture',onclick:null,classList:{toggle(){} }}];
  const env={
    $:get,$$:selector=>selector==='.pref'?prefs:selector==='.pref.on'?prefs:[],
    selected:'Paris',destinations:[],
    resetAgents:()=>{env.resets++},toast:()=>{},resets:0
  };
  const begin=app.indexOf('function build(){'),end=app.indexOf('const esc=',begin);
  assert.ok(begin>0&&end>begin);
  vm.runInNewContext(app.slice(begin,end),env,{timeout:1000});
  return {env,get,prefs};
}
test('actual planner preference controls initialize as a collection without TypeError',()=>{
  const f=planningFixture();
  assert.equal(typeof f.prefs[0].onclick,'function');
  assert.equal(typeof f.prefs[1].onclick,'function');
  f.env.build();
  assert.equal(f.get('#studio-target').textContent,'Paris');
  assert.match(f.get('#itinerary-title').textContent,/3 days in Paris/);
  assert.match(f.get('#itinerary').innerHTML,/DAY 01 · SAMPLE/);
  f.prefs[0].onclick();
  assert.equal(f.env.resets,1);
  assert.equal(f.get('#studio-target').textContent,'Paris');
});
test('worldwide destination changes update the planner heading and itinerary without stale Kyoto text',()=>{
  const f=planningFixture();
  f.env.selected='Sydney';f.env.build();
  assert.equal(f.get('#studio-target').textContent,'Sydney');
  assert.match(f.get('#itinerary-title').textContent,/Sydney/);
  f.env.selected='Nairobi';f.env.build();
  assert.equal(f.get('#studio-target').textContent,'Nairobi');
  assert.match(f.get('#itinerary-title').textContent,/Nairobi/);
  assert.doesNotMatch(f.get('#itinerary-title').textContent,/Kyoto/);
});
test('actual last-stage image reveal observer binds all cards during first paint',()=>{
  const end=app.lastIndexOf('renderDest();');
  assert.ok(end>0);
  const seen=[],cards=[{id:'a'},{id:'b'},{id:'c'}],calls=[];
  const env={
    $:()=>cards[0],
    $$:selector=>selector==='.reveal'?cards:[],
    ob:{observe:x=>seen.push(x.id)},
    renderDest:()=>calls.push('destinations'),
    build:()=>calls.push('plan'),
    arrival:()=>calls.push('arrival'),
    renderTrips:()=>calls.push('journeys')
  };
  vm.runInNewContext(app.slice(end),env,{timeout:1000});
  assert.deepEqual(seen,['a','b','c']);
  assert.deepEqual(calls,['destinations','plan','arrival','journeys']);
});
test('no DOM querySelector one-element result is ever treated like a collection',()=>{
  const offenders=[...app.matchAll(/(?<!\$)\$\([^)]*\)\.(?:forEach|map|filter|reduce|some|every|find)\s*\(/g)]
    .map(x=>x[0]);
  assert.deepEqual(offenders,[],'Use $$ (querySelectorAll) for node-list methods');
  assert.match(app,/\$\$\('\.nav-links button'\)\.forEach/);
  assert.match(app,/\$\$\('\.pref'\)\.forEach/);
  assert.match(app,/\$\$\('\.reveal'\)\.forEach/);
});
