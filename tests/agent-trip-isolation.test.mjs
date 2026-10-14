import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import handler from '../api/intelligence.js';

const script=readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');
const headerStart=script.indexOf('let agentRunSerial=0,agentRequestController=null;');
const headerEnd=script.indexOf('function resetAgents(){',headerStart);
const runStart=script.indexOf('async function runAgents(){');
const runEnd=script.indexOf("$('#run-agents').onclick=runAgents;",runStart);
assert.ok(headerStart>=0&&headerEnd>headerStart&&runStart>=0&&runEnd>runStart);

function fixture(){
  const elements=new Map();
  const element=selector=>{
    if(!elements.has(selector))elements.set(selector,{
      className:'',textContent:'',innerHTML:'',disabled:false,
      value:'',children:[],append(item){this.children.push(item);},
      classList:{add(){},remove(){}}
    });
    return elements.get(selector);
  };
  element('#days').value='3';element('#budget').value='180';
  element('#pace').value='Balanced';
  let resolveNetwork;
  const promise=new Promise(resolve=>{resolveNetwork=resolve;});
  let applied=0;
  const context=vm.createContext({
    selected:'Kyoto',
    worldSelection:{name:'Kyoto',country:'Japan',countryCode:'JP',latitude:35.0116,longitude:135.7681},
    $:element,$$:()=>[{textContent:'Culture'}],
    fetch:()=>promise,
    URLSearchParams,AbortController,AbortSignal,
    applyData:()=>{applied++;},
    toast:()=>{},esc:value=>String(value),
    document:{createElement:()=>({className:'',textContent:'',append(){}})}
  });
  vm.runInContext(script.slice(headerStart,headerEnd)+'\n'+script.slice(runStart,runEnd),context,{timeout:1000});
  const run=()=>vm.runInContext('runAgents()',context,{timeout:1000});
  const finish=async()=>{
    resolveNetwork({ok:true,json:async()=>({
      ok:true,destination:'Kyoto',weather:{ok:false},place:{ok:false},
      country:{ok:false},ai:{ok:false,error:'Private beta access required'}
    })});
    await Promise.resolve();
  };
  return {run,finish,context,element,get applied(){return applied;}};
}

test('changing trip duration mid-flight prevents a stale agent response from rendering',async()=>{
  const f=fixture();const pending=f.run();
  assert.equal(f.element('#run-agents').disabled,true);
  f.element('#days').value='7';
  await f.finish();
  assert.equal(await pending,false);
  assert.equal(f.applied,0);
  assert.match(f.element('#agent-log').textContent,/earlier result was discarded/i);
  assert.equal(f.element('#run-agents').disabled,false);
});

test('switching destinations invalidates the old research request',async()=>{
  const f=fixture();const pending=f.run();
  vm.runInContext("selected='Paris';agentRunSerial++;agentRequestController.abort()",f.context);
  await f.finish();
  assert.equal(await pending,false);
  assert.equal(f.applied,0);
  assert.match(script,/function resetAgents\(\)\{\s*agentRunSerial\+\+;/);
  assert.match(script,/agentRequestController\?\.abort\(\)/);
  assert.match(script,/if\(await runAgents\(\)\)view\('arrival'\)/);
});

test('matching journey brief accepts grounded research response',async()=>{
  const f=fixture();const pending=f.run();
  await f.finish();
  assert.equal(await pending,true);
  assert.equal(f.applied,1);
  assert.equal(f.element('#run-agents').disabled,false);
});

test('country provider outage leaves sourced national facts visible but not live currency/rules',async()=>{
  const prior=globalThis.fetch;
  const priorEnabled=process.env.WAYFARER_INTELLIGENCE_AI_ENABLED;
  process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='false';
  globalThis.fetch=async url=>{
    const host=new URL(url).hostname;
    if(host==='api.open-meteo.com')
      return Response.json({current:{temperature_2m:23,wind_speed_10m:6,time:'2026-10-14T09:00'},timezone:'Pacific/Auckland'});
    if(host==='en.wikipedia.org')
      return Response.json({extract:'Auckland is a city in New Zealand.',content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Auckland'}}});
    if(host==='restcountries.com')throw Error('Country source timeout');
    throw Error('Unexpected external call '+host);
  };
  const res={code:0,body:null,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
  try{
    await handler({method:'GET',headers:{},query:{
      destination:'Auckland',countryCode:'NZ',lat:'-36.8485',lon:'174.7633',days:'3',budget:'180'
    }},res);
    assert.equal(res.code,200);
    assert.equal(res.body.country.ok,false);
    assert.equal(res.body.country.reference.name,'New Zealand');
    assert.equal(res.body.country.reference.capital,'Wellington');
    assert.equal(res.body.country.reference.region,'Oceania');
    assert.equal(res.body.country.currencyCode,undefined);
    assert.equal(res.body.country.language,undefined);
    assert.equal(res.body.country.primaryTimezone,undefined);
    assert.equal(res.body.verification.status,'partial');
    assert.equal(res.body.ai.ok,false);
    assert.match(script,/c\.reference/);
    assert.match(script,/Live currency, language and timezone details not verified/);
  }finally{
    globalThis.fetch=prior;
    if(priorEnabled===undefined)delete process.env.WAYFARER_INTELLIGENCE_AI_ENABLED;
    else process.env.WAYFARER_INTELLIGENCE_AI_ENABLED=priorEnabled;
  }
});
