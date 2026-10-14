import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import handler from '../api/intelligence.js';

const script=readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');
const headerStart=script.indexOf('let agentRunSerial=0,agentRequestController=null;');
const headerEnd=script.indexOf('function resetAgents(preserveContext=false){',headerStart);
const resetStart=headerEnd;
const cancelStart=script.indexOf('function cancelAgentResearch(){',resetStart);
const cancelEnd=script.indexOf('function build(){',cancelStart);
const runStart=script.indexOf('async function runAgents(){');
const runEnd=script.indexOf("$('#run-agents').onclick=runAgents;",runStart);
assert.ok(headerStart>=0&&headerEnd>headerStart&&resetStart>=0&&cancelStart>resetStart&&cancelEnd>cancelStart&&runStart>=0&&runEnd>runStart);

function fixture(payloadOverride={}){
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
    agentData:null,
    selected:'Kyoto',
    worldSelection:{name:'Kyoto',country:'Japan',countryCode:'JP',latitude:35.0116,longitude:135.7681},
    $:element,$$:()=>[{textContent:'Culture'}],
    fetch:()=>promise,
    URLSearchParams,AbortController,AbortSignal,
    applyData:()=>{applied++;},
    toast:()=>{},esc:value=>String(value),
    document:{createElement:()=>({className:'',textContent:'',append(){}}),querySelectorAll:()=>[{textContent:'Culture'}]}
  });
  vm.runInContext(script.slice(headerStart,headerEnd)+'\n'+script.slice(resetStart,cancelEnd)+'\n'+script.slice(runStart,runEnd),context,{timeout:1000});
  const run=()=>vm.runInContext('runAgents()',context,{timeout:1000});
  const finish=async()=>{
    resolveNetwork({ok:true,json:async()=>({
      ok:true,destination:'Kyoto',weather:{ok:false},place:{ok:false},
      country:{ok:false},ai:{ok:false,error:'Private beta access required'},...payloadOverride
    })});
    await Promise.resolve();
  };
  return {run,finish,context,element,cancel:()=>vm.runInContext('cancelAgentResearch()',context,{timeout:1000}),get applied(){return applied;}};
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
  assert.match(script,/function resetAgents\(preserveContext=false\)\{\s*agentRunSerial\+\+;/);
  assert.match(script,/agentRequestController\?\.abort\(\)/);
  assert.match(script,/if\(await runAgents\(\)\)view\('arrival'\)/);
});

test('the real Journey Studio labels name-only Wikipedia context as geographically unverified',async()=>{
  const f=fixture({place:{ok:true,extract:'Illustrative article with ambiguous geography.',
    sourceUrl:'https://en.wikipedia.org/wiki/Kyoto',geographyVerified:false}});
  const task=f.run();
  await f.finish();
  assert.equal(await task,true);
  assert.match(f.element('#agent-place p').textContent,/Name-only source/);
  assert.match(f.element('#agent-place p').textContent,/unverified/);
  assert.ok(f.element('#agent-log').children.some(x=>
    /Wikipedia article matched by name only/.test(x.textContent)),
    'The source caveat must appear beside the actual agent results');
  assert.equal(f.applied,1);
});

test('Arrival rejects a successful agent response that belongs to a different mapped country or city',async()=>{
  for(const location of [
    {latitude:48.8566,longitude:2.3522,countryCode:'FR'},
    {latitude:35.0116,longitude:135.7681,countryCode:'US'},
    {latitude:35.0116,longitude:135.7681,countryCode:'JP',basis:'selected-map-coordinates',
      extra:'ok',longitude:135.7683},
    {latitude:NaN,longitude:135.7681,countryCode:'JP'}
  ]){
    const f=fixture({location});
    const pending=f.run();await f.finish();
    assert.equal(await pending,false,'Reject conflicting source location '+JSON.stringify(location));
    assert.equal(f.applied,0,'Conflicting response must not apply sourced weather or country facts');
    assert.equal(vm.runInContext('agentData',f.context),null);
    assert.match(f.element('#agent-log').textContent,/current itinerary and saved journeys are unchanged/);
    assert.equal(f.element('#run-agents').disabled,false);
  }
});

test('Arrival accepts server provenance when map coordinates and country code match the selected destination',async()=>{
  const f=fixture({location:{latitude:35.0116,longitude:135.7681,
    countryCode:'JP',basis:'selected-map-coordinates'}});
  const pending=f.run();await f.finish();
  assert.equal(await pending,true);
  assert.equal(f.applied,1);
  assert.equal(vm.runInContext('agentData.location.countryCode',f.context),'JP');
});

test('matching journey brief accepts grounded research response',async()=>{
  const f=fixture();const pending=f.run();
  await f.finish();
  assert.equal(await pending,true);
  assert.equal(f.applied,1);
  assert.equal(f.element('#run-agents').disabled,false);
});

test('traveler can cancel an active agent run without overwriting or relabeling a previous AI draft',async()=>{
  const f=fixture();
  f.element('#plan-status').className='micro ok';
  f.element('#plan-status').textContent='Groq AI itinerary';
  f.element('#plan-source').textContent='Prior verified sources for Kyoto';
  const pending=f.run();
  assert.equal(f.element('#cancel-agents').hidden,false);
  assert.equal(f.element('#run-agents').disabled,true);
  assert.equal(f.cancel(),true);
  assert.equal(f.element('#cancel-agents').hidden,true);
  assert.equal(f.element('#run-agents').disabled,false);
  assert.equal(f.element('#plan-status').textContent,'Groq AI itinerary');
  assert.equal(f.element('#plan-source').textContent,'Prior verified sources for Kyoto');
  assert.match(f.element('#agent-log').textContent,/Research cancelled/);
  assert.match(f.element('#agent-log').textContent,/may not cancel any provider processing/);
  await f.finish();
  assert.equal(await pending,false,'Late response after cancel must never apply');
  assert.equal(f.applied,0);
  assert.equal(f.cancel(),false,'Cancel does nothing with no active run');
});

test('a duplicate invocation does not start a second paid-capable request',async()=>{
  const f=fixture();
  const pending=f.run();
  assert.equal(await f.run(),false);
  assert.equal(f.element('#cancel-agents').hidden,false);
  await f.finish();
  assert.equal(await pending,true);
  assert.equal(f.applied,1);
  assert.equal(f.element('#cancel-agents').hidden,true);
});

test('editing any material trip preference invalidates the current research',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../premium-refinement.css',import.meta.url),'utf8');
  assert.match(html,/id="cancel-agents"[^>]*hidden/);
  assert.match(script,/\$\('#cancel-agents'\)\.onclick=cancelAgentResearch/);
  assert.match(script,/b\.classList\.toggle\('on'\);resetAgents\(\);build\(\)/);
  assert.match(script,/\['days','pace'\]\.forEach\(x=>\$\('#'\+x\)\.onchange=\(\)=>\{resetAgents\(\);build\(\)\}\)/);
  assert.match(script,/\$\('#budget'\)\.oninput=\(\)=>\{resetAgents\(\);if\(\$\('#budget'\)\.checkValidity\(\)\)build\(\)/);
  assert.match(css,/#studio #cancel-agents\[hidden\]\{display:none!important;\}/);
  assert.match(css,/min-height:44px/);
});

test('trip preference changes clear obsolete Arrival agent context, but user cancellation preserves prior context',async()=>{
  const f=fixture();
  vm.runInContext("agentData={destination:'Kyoto',weather:{ok:true}}",f.context);
  vm.runInContext("resetAgents()",f.context);
  assert.equal(vm.runInContext("agentData",f.context),null);

  vm.runInContext("agentData={destination:'Kyoto',weather:{ok:true}}",f.context);
  const pending=f.run();
  assert.equal(f.cancel(),true);
  assert.equal(vm.runInContext("agentData?.destination",f.context),'Kyoto');
  await f.finish();
  assert.equal(await pending,false);
  assert.equal(f.applied,0);
});

test('legacy saved journeys use allowed day/budget/pace UI values and accurate offline export labels',()=>{
  assert.match(script,/const days=lengths\.reduce\(/);
  assert.match(script,/lengths=\[3,5,7\]/);
  assert.match(script,/Math\.min\(2500,savedBudget\)/);
  assert.match(script,/Full & energetic/);
  assert.match(script,/ILLUSTRATIVE SAMPLE · NOT LIVE BOOKINGS/);
  assert.match(script,/AI-GENERATED DRAFT · VERIFY BEFORE TRAVEL/);
  assert.match(script,/SOURCE & LIMITATIONS/);
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


test('the real Studio pace labels reach the AI composer as Slow or Active, with no paid request',async()=>{
  const originalFetch=globalThis.fetch;
  const variables=['WAYFARER_AI_BETA_TOKEN','WAYFARER_INTELLIGENCE_AI_ENABLED','GROQ_API_KEY'];
  const originals=Object.fromEntries(variables.map(k=>[k,process.env[k]]));
  process.env.WAYFARER_AI_BETA_TOKEN='test-token-validated-over-24-characters';
  process.env.WAYFARER_INTELLIGENCE_AI_ENABLED='true';
  process.env.GROQ_API_KEY='fake-test-only-not-a-credential';
  const prompts=[];
  globalThis.fetch=async (url,options={})=>{
    const host=new URL(url).hostname;
    if(host==='api.open-meteo.com')return Response.json({
      current:{temperature_2m:21,wind_speed_10m:4,time:'2026-10-14T10:00'},timezone:'Asia/Tokyo'});
    if(host==='en.wikipedia.org')return Response.json({
      extract:'Kyoto is a city in Japan.',content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Kyoto'}}});
    if(host==='restcountries.com')return Response.json({
      currencies:{JPY:{name:'Japanese yen'}},languages:{jpn:'Japanese'},timezones:['UTC+09:00']});
    if(host==='api.groq.com'){
      const request=JSON.parse(options.body);
      prompts.push(request.messages[1].content);
      const draft={title:'Mocked travel plan',days:Array.from({length:3},(_,i)=>({
        title:'Day '+(i+1),summary:'Mocked itinerary content only, no supplier inventory.'}))};
      return Response.json({choices:[{message:{content:JSON.stringify(draft)}}]});
    }
    throw Error('Unexpected external hostname: '+host);
  };
  try{
    for(const [display,expected] of [
      ['Slow & considered','Slow'],['Full & energetic','Active'],['Balanced','Balanced']
    ]){
      const res={code:0,body:null,setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}};
      await handler({method:'GET',headers:{'x-wayfarer-beta-token':process.env.WAYFARER_AI_BETA_TOKEN},
        query:{destination:'Kyoto',countryCode:'JP',days:'3',budget:'180',
          lat:'35.0116',lon:'135.7681',pace:display,moods:'Culture'}},res);
      assert.equal(res.code,200);
      assert.equal(res.body.ai.ok,true);
      assert.match(prompts.at(-1),new RegExp('pace: '+expected+';'));
      assert.equal(res.body.ai.days.length,3);
    }
    assert.equal(prompts.length,3,'Each mock composition requires an explicit valid request');
  }finally{
    globalThis.fetch=originalFetch;
    for(const key of variables){
      if(originals[key]===undefined)delete process.env[key];
      else process.env[key]=originals[key];
    }
  }
});
