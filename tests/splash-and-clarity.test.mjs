import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=relative=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const js=read('splash-screen.js'),css=read('splash-screen.css'),html=read('index.html');
const clarity=read('clarity-polish.css'),atlas=read('country-atlas.js'),app=read('premium-app.js');
function simulate({seen=false,reduced=false,motionOff=false}={}){
  const callbacks={},timers=[],actions=[],memory={};
  let removed=false;
  if(seen)memory['wf-splash-seen-v1']='1';
  const classNames=new Set();
  const splash={
    hidden:true,classList:{add:name=>classNames.add(name)},
    remove:()=>{removed=true;actions.push('removed');}
  };
  const skip={addEventListener:(name,fn)=>callbacks['skip:'+name]=fn,
    focus:()=>actions.push('skip focused')};
  const main={focus:()=>actions.push('main focused')};
  const doc={visibilityState:'visible',getElementById:id=>
      id==='wf-splash'?splash:id==='wf-splash-skip'?skip:null,
    querySelector:id=>id==='#main-content'?main:null,
    addEventListener:(name,fn)=>callbacks[name]=fn,
    removeEventListener:name=>{delete callbacks[name];}};
  const env={window:{matchMedia:()=>({matches:reduced})},document:doc,
    sessionStorage:{getItem:key=>memory[key]||null,setItem:(key,value)=>{memory[key]=value;}},
    localStorage:{getItem:()=>motionOff?'off':null},
    setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},
    clearTimeout:id=>{if(timers[id-1])timers[id-1].cancelled=true;}};
  vm.runInNewContext(js,env,{timeout:600});
  return {doc,splash,skip,memory,timers,actions,classNames,callbacks,get removed(){return removed;}};
}
test('cinematic splash is first-party, initially hidden, and controls are keyboard usable',()=>{
  assert.match(html,/id="wf-splash" hidden/);
  assert.match(html,/id="wf-splash-skip"/);
  assert.match(html,/src="splash-screen\.js" defer/);
  assert.match(html,/href="splash-screen\.css"/);
  assert.ok(html.indexOf('src="splash-screen.js"')<html.indexOf('src="premium-motion.js"'));
  assert.ok(html.indexOf('href="splash-screen.css"')>html.indexOf('href="country-atlas.css"'));
  assert.match(css,/#wf-splash\[hidden\]\{display:none!important\}/);
  assert.match(css,/focus-visible/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/wf-splash-safety-hide/);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|\/api\/travel-search|\/api\/intelligence|new Image/);
});
test('first visit shows the splash then closes within 1250 ms, no backend dependency',()=>{
  const state=simulate();
  assert.equal(state.splash.hidden,false);
  assert.deepEqual(state.actions,['skip focused']);
  const automatic=state.timers.find(t=>t.delay===1250);
  assert.ok(automatic);
  automatic.fn();
  assert.equal(state.memory['wf-splash-seen-v1'],'1');
  assert.ok(state.classNames.has('wf-splash-closing'));
  const removal=state.timers.find(t=>t.delay===400);
  assert.ok(removal);removal.fn();assert.equal(state.removed,true);
});
test('skip and Escape close immediately, retain meaningful keyboard focus',()=>{
  const clicked=simulate();
  clicked.callbacks['skip:click']();
  assert.ok(clicked.classNames.has('wf-splash-closing'));
  assert.ok(clicked.actions.includes('main focused'));
  const escaped=simulate();
  escaped.callbacks.keydown({key:'Escape'});
  assert.ok(escaped.classNames.has('wf-splash-closing'));
});
test('return visits and reduced-motion users never see or wait for the splash',()=>{
  for(const pref of [{seen:true},{reduced:true},{motionOff:true}]){
    const state=simulate(pref);
    assert.equal(state.removed,true);
    assert.equal(state.timers.length,0);
    assert.equal(state.splash.hidden,true);
  }
});
test('home screen explains actual workflow without invented checkout or video',()=>{
  assert.match(html,/Travel planning, made simple\./);
  assert.match(html,/01 · Discover/);
  assert.match(html,/02 · Plan/);
  assert.match(html,/03 · Verify/);
  assert.match(html,/How Wayfarer works ↓/);
  assert.match(html,/Optional AI planning/);
  assert.match(html,/buy directly with providers/);
  assert.match(clarity,/@media\(max-width:690px\)/);
  assert.match(app,/story-btn'\)\.onclick=.*scrollIntoView\(\{behavior:/);
});
test('country pages offer a functional accessible Back action',()=>{
  assert.match(atlas,/← Back to country collection/);
  assert.match(atlas,/panel\.hidden=true/);
  assert.match(atlas,/nav\('discover'\)/);
  assert.match(atlas,/heading\.focus\(\{preventScroll:true\}\)/);
  assert.match(clarity,/\.wf-top10-return:focus-visible/);
});
