import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const helpers=read('journey-integrity.js'),app=read('premium-app.js');
const newContext=()=>{const ctx=vm.createContext({});vm.runInContext(helpers,ctx);return ctx;};
const make=(name,country,code,latitude,longitude)=>({
  destination:name,country,worldPlace:{name,country,countryCode:code,latitude,longitude}
});
const parisFR=make('Paris','France','FR',48.8566,2.3522);
const parisTX=make('Paris','United States','US',33.6609,-95.5555);
const springIL=make('Springfield','United States','US',39.8017,-89.6437);
const springMA=make('Springfield','United States','US',42.1015,-72.5898);

test('arrival readiness has distinct geo-scoped keys for same-named cities',()=>{
  const h=newContext().WayfarerJourneyIntegrity;
  for(const [a,b] of [[parisFR,parisTX],[springIL,springMA]]){
    const x=h.checklistKey(a,'transport'),y=h.checklistKey(b,'transport');
    assert.notEqual(x,y);
    const store={[x]:true};
    assert.equal(h.checklistChecked(store,a,'transport'),true);
    assert.equal(h.checklistChecked(store,b,'transport'),false);
    assert.equal(h.checklistChecked(store,b,'money'),false);
  }
});

test('legacy city-name-only checklist progress never transfers to arbitrary overseas cities',()=>{
  const h=newContext().WayfarerJourneyIntegrity;
  const stored={'Paris:transport':true,'Springfield:money':true,
    'Kyoto:connect':true,'Bali:stay':true};
  assert.equal(h.checklistChecked(stored,parisFR,'transport'),false);
  assert.equal(h.checklistChecked(stored,parisTX,'transport'),false);
  assert.equal(h.checklistChecked(stored,springMA,'money'),false);
  assert.equal(h.checklistChecked(stored,{destination:'Kyoto',country:'Japan'},'connect'),true);
  assert.equal(h.checklistChecked(stored,{destination:'Bali',country:'Indonesia'},'stay'),true);
  assert.equal(h.checklistChecked(stored,{destination:'Kyoto',country:'Portugal'},'connect'),false);
  assert.equal(h.checklistChecked(stored,{destination:'Kyoto',country:'Japan'},'stay'),false);
});

test('tampered, empty and unsupported checklist inputs cannot create arbitrary storage keys',()=>{
  const h=newContext().WayfarerJourneyIntegrity;
  assert.equal(h.checklistKey({destination:''},'money'),null);
  assert.equal(h.checklistKey(parisFR,'visa-approved'),null);
  assert.equal(h.checklistChecked({},parisFR,'visa-approved'),false);
  assert.equal(h.checklistChecked([],parisFR,'money'),false);
  assert.equal(h.checklistChecked(null,parisFR,'money'),false);
  assert.equal(h.checklistChecked({[h.checklistKey(parisFR,'money')]:'true'},parisFR,'money'),false);
});

function arrivalFixture(){
  const ctx=newContext();
  const ids=new Map(),checkboxes=['connect','transport','stay','money'].map(check=>({
    dataset:{check},checked:false,onchange:null
  }));
  function el(sel){
    if(!ids.has(sel)){
      const n={textContent:'',value:'',alt:'',src:'',setAttribute(){},
        style:{setProperty(){}},replaceChildren(){}};
      ids.set(sel,n);
    }
    return ids.get(sel);
  }
  el('#days').value='3';el('#budget').value='180';
  const sliceStart=app.indexOf('const arrivalChecklistTrip=');
  const sliceEnd=app.indexOf('function applyData(d)',sliceStart);
  assert.ok(sliceStart>=0&&sliceEnd>sliceStart);
  const stored=[];
  Object.assign(ctx,{
    selected:'Paris',worldSelection:parisFR.worldPlace,
    destinations:[{name:'Kyoto',country:'Japan',tip:'Verify official source'}],
    agentData:null,checks:{},$ :el,$$:selector=>selector==='[data-check]'?checkboxes:[],
    store:(key,value)=>stored.push({key,value:JSON.parse(JSON.stringify(value))})
  });
  const sourceStart=app.indexOf('const ARRIVAL_SOURCE_MAX_AGE_MS=');
  const sourceEnd=app.indexOf('function resetAgents(preserveContext=false){',sourceStart);
  assert.ok(sourceStart>0&&sourceEnd>sourceStart);
  vm.runInContext(app.slice(sourceStart,sourceEnd)+'\n'+app.slice(sliceStart,sliceEnd),ctx,{timeout:1000});
  return {ctx,checkboxes,stored,el};
}
test('the REAL Arrival UI toggles saved checkboxes per place without cross-country leakage',()=>{
  const f=arrivalFixture();
  f.ctx.arrival();
  f.checkboxes[0].checked=true;f.checkboxes[0].onchange();
  assert.equal(f.el('#ready-value').textContent,'25%');
  assert.equal(f.stored.at(-1).key,'wf-checks-v2');
  const frenchKey=f.ctx.WayfarerJourneyIntegrity.checklistKey(parisFR,'connect');
  assert.equal(f.ctx.checks[frenchKey],true);

  f.ctx.selected='Paris';f.ctx.worldSelection=parisTX.worldPlace;
  f.ctx.arrival();
  assert.equal(f.checkboxes[0].checked,false);
  assert.equal(f.el('#ready-value').textContent,'0%');
  f.checkboxes[1].checked=true;f.checkboxes[1].onchange();

  f.ctx.worldSelection=parisFR.worldPlace;f.ctx.arrival();
  assert.equal(f.checkboxes[0].checked,true);
  assert.equal(f.checkboxes[1].checked,false);
  assert.equal(f.el('#ready-value').textContent,'25%');
});
test('100% means personal reminders checked, never verified travel clearance',()=>{
  const f=arrivalFixture();f.ctx.arrival();
  for(const c of f.checkboxes){c.checked=true;c.onchange();}
  assert.equal(f.el('#ready-value').textContent,'100%');
  assert.match(f.el('#ready-label').textContent,/personal preparation reminders marked/i);
  assert.doesNotMatch(f.el('#ready-label').textContent,/cleared|confirmed|verified/i);
  const html=read('index.html');
  assert.match(html,/Track preparations, not verified entry clearance/);
  assert.match(html,/not evidence that a service, visa, or reservation is confirmed/);
});
