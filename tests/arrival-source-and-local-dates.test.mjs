import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');
const start=source.indexOf('const ARRIVAL_SOURCE_MAX_AGE_MS=');
const resetStart=source.indexOf('function resetAgents(preserveContext=false){',start);
const cancelStart=source.indexOf('function cancelAgentResearch(){',resetStart);
const arrivalStart=source.indexOf('const arrivalChecklistTrip=');
const arrivalEnd=source.indexOf('function applyData(d)',arrivalStart);
const applyEnd=source.indexOf("$('#refresh').onclick",arrivalEnd);
const dateStart=source.indexOf('function localCalendarDate(date){');
const dateEnd=source.indexOf('function stayMessage(',dateStart);
assert.ok(start>0&&resetStart>start&&cancelStart>resetStart);
assert.ok(arrivalStart>0&&arrivalEnd>arrivalStart&&applyEnd>arrivalEnd);
assert.ok(dateStart>0&&dateEnd>dateStart);

function fixture(){
  const nodes=new Map(),checks=['connect','transport','stay','money'].map(check=>({
    dataset:{check},checked:false,onchange:null
  }));
  const $=id=>{
    if(!nodes.has(id))nodes.set(id,{
      textContent:'',className:'',innerHTML:'',alt:'',src:'',children:[],
      value:'',hidden:true,disabled:false,style:{setProperty(){}},
      setAttribute(){},append(...xs){this.children.push(...xs)},
      replaceChildren(...xs){this.children=xs},
      classList:{add(){},remove(){}}
    });
    return nodes.get(id);
  };
  $('#days').value='3';$('#budget').value='180';
  const context=vm.createContext({
    selected:'Paris',
    worldSelection:{name:'Paris',country:'France',countryCode:'FR',latitude:48.8566,longitude:2.3522},
    destinations:[],agentData:null,checks:{},agentRunSerial:0,
    agentRequestController:null,Date,URL,
    $,$$:selector=>selector==='[data-check]'?checks:[],
    globalThis:{WayfarerJourneyIntegrity:{checklistChecked:()=>false,checklistKey:()=>null}},
    document:{
      createTextNode:text=>({textContent:text}),
      createElement:tag=>({tagName:tag,textContent:'',href:'',rel:'',
        target:'',append(){}})
    }
  });
  vm.runInContext(source.slice(start,cancelStart)+'\n'+
    source.slice(arrivalStart,arrivalEnd)+'\n'+
    source.slice(arrivalEnd,applyEnd),context,{timeout:1000});
  return {context,$};
}
const response={
 retrieved:'2026-10-14T08:00:00Z',
 weather:{ok:true,temperature:26,sourceUrl:'https://api.open-meteo.com/v1/forecast'},
 country:{ok:true,currencyCode:'EUR',primaryTimezone:'Europe/Paris',
   primaryLanguage:'French',sourceUrl:'https://restcountries.com/v3.1/alpha/FR'}
};

test('Arrival only shows sources for exactly the current mapped country and city',()=>{
  const f=fixture(),c=f.context;
  c.agentData=response;vm.runInContext('arrivalResearchIdentity=currentArrivalIdentity()',c);
  vm.runInContext('arrivalResearchAt=Date.now()',c);c.arrival();
  assert.equal(f.$('#arr-weather').textContent,'26 °C');
  assert.equal(f.$('#arr-currency').textContent,'EUR');
  c.worldSelection={name:'Paris',country:'United States',countryCode:'US',
    latitude:33.6609,longitude:-95.5555};
  c.arrival();
  assert.equal(f.$('#arrival-context-destination').textContent,'Paris, United States');
  assert.equal(f.$('#arr-weather').textContent,'Run tools');
  assert.equal(f.$('#arr-zone').textContent,'—');
  assert.match(f.$('#arr-source').textContent,/belong to another destination/);
});
test('Arrival does not treat old weather as current after thirty minutes',()=>{
  const f=fixture(),c=f.context;
  c.agentData=response;vm.runInContext('arrivalResearchIdentity=currentArrivalIdentity()',c);
  vm.runInContext('arrivalResearchAt=Date.now()-31*60*1000',c);
  c.arrival();
  assert.equal(f.$('#arr-weather').textContent,'Run tools');
  assert.equal(f.$('#arr-language').textContent,'—');
  assert.match(f.$('#arr-source').textContent,/expired/);
});
test('changing trip details resets all arrival sources immediately',()=>{
  const f=fixture(),c=f.context;
  c.agentData=response;vm.runInContext('arrivalResearchIdentity=currentArrivalIdentity()',c);
  vm.runInContext('arrivalResearchAt=Date.now()',c);c.arrival();c.resetAgents();
  assert.equal(c.agentData,null);
  assert.equal(vm.runInContext('arrivalResearchIdentity',c),null);
  assert.equal(vm.runInContext('arrivalResearchAt',c),0);
  assert.equal(f.$('#arr-weather').textContent,'Run tools');
  assert.match(f.$('#arr-source').textContent,/Tap Refresh/);
});
test('cancelled rerun retains prior still-valid source context',()=>{
  const f=fixture(),c=f.context;
  c.agentData=response;vm.runInContext('arrivalResearchIdentity=currentArrivalIdentity()',c);
  vm.runInContext('arrivalResearchAt=Date.now()',c);c.arrival();
  c.resetAgents(true);c.arrival();
  assert.equal(f.$('#arr-weather').textContent,'26 °C');
  assert.equal(f.$('#arr-currency').textContent,'EUR');
});
test('local hotel calendar does not convert to UTC or lose a date across DST',()=>{
  const snippet=source.slice(dateStart,dateEnd);
  assert.match(snippet,/getFullYear\(\)/);
  assert.match(snippet,/getMonth\(\)\+1/);
  assert.match(snippet,/getDate\(\)/);
  assert.doesNotMatch(snippet,/toISOString\(\)/);
  assert.match(snippet,/new Date\(checkIn.value\+'T12:00:00'\)/);
  assert.match(snippet,/checkOut.min=localCalendarDate\(next\)/);
});
test('defaults and checkout bounds use the local day on both sides of UTC',()=>{
  const child=[
    "const fs=require('node:fs'),vm=require('node:vm');",
    "const text=fs.readFileSync('premium-app.js','utf8');",
    "const a=text.indexOf('function localCalendarDate(date){'),b=text.indexOf('function stayMessage(',a);",
    "const nodes={};const get=x=>nodes[x]??(nodes[x]={value:'',min:'',events:{},addEventListener(k,fn){this.events[k]=fn}});",
    "class FixedDate extends Date{constructor(...a){super(...(a.length?a:['2026-10-14T23:30:00.000Z']))}}",
    "vm.runInNewContext(text.slice(a,b)+'\\nsetStayDates();',{Date:FixedDate,$:get,Number,String});",
    "const initial={min:get('#check-in').min,start:get('#check-in').value,end:get('#check-out').value};",
    "get('#check-in').value='2026-12-26';get('#check-out').value='2026-12-25';",
    "get('#check-in').events.change();",
    "console.log(JSON.stringify({initial,updated:{min:get('#check-out').min,value:get('#check-out').value}}));"
  ].join('\n');
  for(const [zone,expectedToday] of [
    ['Pacific/Kiritimati','2026-10-15'],
    ['America/Los_Angeles','2026-10-14']
  ]){
    const out=spawnSync(process.execPath,['-e',child],{
      encoding:'utf8',env:{...process.env,TZ:zone}
    });
    assert.equal(out.status,0,zone+': '+out.stderr);
    const r=JSON.parse(out.stdout);
    assert.equal(r.initial.min,expectedToday,zone);
    assert.ok(r.initial.start>expectedToday);
    assert.ok(r.initial.end>r.initial.start);
    assert.equal(r.updated.min,'2026-12-27');
    assert.equal(r.updated.value,'2026-12-27');
  }
});
