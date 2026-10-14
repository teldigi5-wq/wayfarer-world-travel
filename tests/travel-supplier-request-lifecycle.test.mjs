import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('travel-research.js');
const start=source.indexOf('  let showingSupplierResults=false,supplierRequestSerial=0,activeSupplierRequest=null;');
const end=source.indexOf('  // Read explicit IATA attributes',start);
assert.ok(start>0&&end>start,'The actual protected supplier lifecycle block must be available');

function fixture(){
  const nodes=new Map(),events=new Map(),requests=[];
  const defaults={
    'travel-origin':'CMB','travel-arrival':'ORY','travel-airfare':'',
    'destination':'Paris','world-query':'Paris','check-in':'2026-11-12',
    'check-out':'2026-11-15','stay-adults':'2','days':'3','budget':'180',
    'travel-beta-code':'beta-code-synthetic-very-long'
  };
  const $=id=>{
    if(!nodes.has(id)){
      const handlers={};
      nodes.set(id,{
        value:defaults[id]??'',hidden:id==='travel-cancel-button',
        disabled:false,attrs:{},handlers,
        addEventListener(type,handler){(handlers[type]??=[]).push(handler);},
        setAttribute(name,value){this.attrs[name]=value;},
        removeAttribute(name){delete this.attrs[name];},
        async dispatch(type){return Promise.all((handlers[type]||[]).map(h=>h({preventDefault(){}})));},
        reportValidity(){return true;},replaceChildren(){this.children=[];},
        children:[],textContent:''
      });
    }
    return nodes.get(id);
  };
  for(const id of Object.keys(defaults))$(id);
  const window={
    WayfarerNearby:{
      clearQuotes(){window.clears++;},
      currentLocation(){return window.location;},
      isCurrentLocation(old){return old.countryCode===window.location.countryCode&&
        old.latitude===window.location.latitude&&old.longitude===window.location.longitude;}
    },
    location:{name:'Paris',countryCode:'FR',latitude:48.8566,longitude:2.3522},
    clears:0,
    addEventListener(type,fn){(events.get(type)||events.set(type,[]).get(type)).push(fn)},
    emit(type){for(const fn of events.get(type)||[])fn()}
  };
  const showCalls=[];
  const fakeFetch=(url,opts)=>{
    let resolve;
    const promise=new Promise(r=>{resolve=r});
    requests.push({url,opts,resolve});
    return promise;
  };
  const env=vm.createContext({
    $,get:id=>$(id).value,form:$('travel-research-form'),status:$('travel-search-status'),
    output:$('travel-search-output'),window,show:payload=>showCalls.push(payload),
    fetch:fakeFetch,AbortController,setTimeout,clearTimeout,Math,Number,JSON,Error
  });
  vm.runInContext(source.slice(start,end),env,{timeout:1000});
  const submit=()=>env.form.dispatch('submit');
  const change=(id,value)=>{
    $(id).value=value;
    for(const listener of $(id).handlers.input||[])listener();
  };
  const finish=async(index,mode='search_only')=>{
    requests[index].resolve({ok:true,json:async()=>({
      ok:true,mode,hotels:{offers:[]},flights:{offers:[]}
    })});
    await Promise.resolve();
  };
  return {$,window,requests,showCalls,submit,change,finish,env};
}

test('only one explicit protected supplier request can run at once',async()=>{
  const f=fixture();
  const first=f.submit();
  assert.equal(f.requests.length,1);
  assert.equal(f.$('travel-cancel-button').hidden,false);
  assert.equal(f.$('travel-search-button').disabled,true);
  assert.equal(f.$('travel-search-button').attrs['aria-busy'],'true');
  await f.submit();
  assert.equal(f.requests.length,1,'Second submit must not spend a second provider credit');
  assert.equal(f.requests[0].url,'/api/travel-search');
  assert.ok(f.requests[0].opts.headers['X-Wayfarer-Beta-Token']);
  await f.finish(0);
  await first;
  assert.equal(f.showCalls.length,1);
  assert.equal(f.$('travel-search-button').disabled,false);
  assert.equal(f.$('travel-cancel-button').hidden,true);
});

test('editing the form aborts the browser request and rejects its late response even after restoring values',async()=>{
  const f=fixture(),first=f.submit();
  f.change('check-out','2026-11-18');
  assert.equal(f.requests[0].opts.signal.aborted,true);
  assert.equal(f.$('travel-search-button').disabled,false);
  assert.match(f.$('travel-search-status').textContent,/provider may already be processing/);
  f.change('check-out','2026-11-15');
  await f.finish(0);await first;
  assert.equal(f.showCalls.length,0,'Obsolete response must not render even if fields are restored');
  assert.equal(f.window.clears>=2,true);
});

test('Cancel search explicitly stops active delivery and never claims to cancel upstream processing',async()=>{
  const f=fixture(),pending=f.submit();
  await f.$('travel-cancel-button').dispatch('click');
  assert.equal(f.requests[0].opts.signal.aborted,true);
  assert.match(f.$('travel-search-status').textContent,/provider may already be processing/);
  assert.equal(f.$('travel-cancel-button').hidden,true);
  await f.finish(0);await pending;
  assert.equal(f.showCalls.length,0);
  assert.equal(f.$('travel-search-button').disabled,false);
});

test('a late old response cannot release or overwrite a newer active supplier request',async()=>{
  const f=fixture(),old=f.submit();
  f.change('travel-arrival','CDG');
  const latest=f.submit();
  assert.equal(f.requests.length,2);
  assert.equal(f.requests[0].opts.signal.aborted,true);
  assert.equal(f.requests[1].opts.signal.aborted,false);
  await f.finish(0);await old;
  assert.equal(f.showCalls.length,0);
  assert.equal(f.$('travel-search-button').disabled,true,'Old finally must not unlock the new request');
  await f.finish(1);await latest;
  assert.equal(f.showCalls.length,1,'Only new matching response is shown');
  assert.equal(f.$('travel-search-button').disabled,false);
});

test('switching mapped same-name cities aborts in-flight request independently of form inputs',async()=>{
  const f=fixture(),old=f.submit();
  f.window.location={name:'Paris',countryCode:'US',latitude:33.6609,longitude:-95.5555};
  f.window.emit('wayfarer:location-changed');
  assert.equal(f.requests[0].opts.signal.aborted,true);
  await f.finish(0);await old;
  assert.equal(f.showCalls.length,0);
  assert.match(f.$('travel-search-status').textContent,/Trip details changed/);
});

test('changing budgets or destination text also invalidates an in-flight search',()=>{
  const s=source.slice(start,end);
  for(const id of ['travel-airfare','budget','days','destination','world-query','travel-beta-code']){
    if(id==='travel-beta-code')continue; // Secrets should not enter a cache.
    assert.ok(s.includes("'"+id+"'"),id+' must be watched');
  }
  assert.match(s,/serial!==supplierRequestSerial/);
  assert.match(s,/activeSupplierRequest\?\.abort\(\)/);
  assert.match(s,/if\(activeSupplierRequest\|\|!form.reportValidity\(\)\)return/);
  assert.match(source,/id="travel-cancel-button"[^>]*hidden/);
  const css=read('premium-refinement.css');
  assert.match(css,/#studio #travel-cancel-button\[hidden\]/);
  assert.match(css,/\.wf-travel-cancel:focus-visible/);
});
