import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=relative=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const js=read('splash-screen.js'),css=read('splash-screen.css'),html=read('index.html');
const clarity=read('clarity-polish.css'),atlas=read('country-atlas.js'),app=read('premium-app.js');
function simulate({reduced=false}={}){
  const callbacks={},timers=[],actions=[];
  let removed=false;
  const classes=new Set();
  const splash={
    hidden:false,
    classList:{add:name=>classes.add(name)},
    remove:()=>{removed=true;actions.push('removed');}
  };
  const skip={addEventListener:(name,fn)=>callbacks['skip:'+name]=fn,
    focus:()=>actions.push('skip focused')};
  const main={focus:()=>actions.push('main focused')};
  const doc={visibilityState:'visible',getElementById:id=>({
      'wf-splash':splash,'wf-splash-skip':skip,'main-content':main
    }[id]||null),
    addEventListener:(name,fn)=>callbacks[name]=fn,
    removeEventListener:name=>{delete callbacks[name];}};
  const environment={window:{matchMedia:()=>({matches:reduced})},document:doc,
    setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},
    clearTimeout:id=>{if(timers[id-1])timers[id-1].cancelled=true;}};
  vm.runInNewContext(js,environment,{timeout:800});
  return {doc,splash,skip,timers,actions,classes,callbacks,get removed(){return removed;}};
}
test('splash renders first, before homepage, even before JavaScript executes',()=>{
  const body=html.indexOf('<body>');
  const splash=html.indexOf('<div id="wf-splash"');
  const nav=html.indexOf('<header class="nav">');
  const hero=html.indexOf('<section class="view active" id="discover">');
  assert.ok(body>=0&&splash>body&&nav>splash&&hero>nav);
  assert.match(html,/<div id="wf-splash" role="dialog" aria-modal="true"/);
  assert.doesNotMatch(html,/<div id="wf-splash"[^>]*\bhidden\b/);
  assert.match(html,/content="dark"/);
  assert.match(css,/#wf-splash\{\s*position:fixed;inset:0;z-index:99999/);
  assert.match(css,/#wf-splash:not\(\[hidden\]\)\{animation:wf-splash-safety-hide \.01s linear 3s forwards;\}/);
  assert.match(html,/id="wf-splash-skip"/);
  assert.match(html,/src="splash-screen\.js" defer/);
  assert.match(html,/href="splash-screen\.css"/);
  assert.ok(html.indexOf('src="splash-screen.js"')<html.indexOf('src="premium-motion.js"'));
  assert.ok(html.indexOf('href="splash-screen.css"')>html.indexOf('href="country-atlas.css"'));
  assert.match(css,/focus-visible/);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|\/api\/travel-search|\/api\/intelligence|new Image/);
});
test('every full navigation starts with visible splash then closes after 850ms',()=>{
  for(let run=0;run<2;run++){
    const state=simulate();
    assert.equal(state.splash.hidden,false,'visible in original HTML');
    assert.deepEqual(state.actions,['skip focused']);
    const automatic=state.timers.find(t=>t.delay===850);
    assert.ok(automatic);
    automatic.fn();
    assert.ok(state.classes.has('wf-splash-closing'));
    assert.ok(state.actions.includes('main focused'));
    const removal=state.timers.find(t=>t.delay===380);
    assert.ok(removal);removal.fn();
    assert.equal(state.removed,true);
  }
  assert.doesNotMatch(js,/sessionStorage/);
});
test('skip and Escape close immediately and transfer keyboard focus to main content',()=>{
  const clicked=simulate();clicked.callbacks['skip:click']();
  assert.ok(clicked.classes.has('wf-splash-closing'));
  assert.ok(clicked.actions.includes('main focused'));
  const escaped=simulate();escaped.callbacks.keydown({key:'Escape'});
  assert.ok(escaped.classes.has('wf-splash-closing'));
  assert.ok(escaped.actions.includes('main focused'));
  const tabbed=simulate();let trapped=false;
  tabbed.callbacks.keydown({key:'Tab',preventDefault:()=>{trapped=true;}});
  assert.equal(trapped,true);
  assert.ok(tabbed.actions.filter(x=>x==='skip focused').length>=2);
  const hiddenTab=simulate();
  hiddenTab.doc.visibilityState='hidden';
  hiddenTab.callbacks.visibilitychange();
  assert.ok(hiddenTab.classes.has('wf-splash-closing'));
});
test('operating-system reduced-motion users bypass the splash instantly',()=>{
  const state=simulate({reduced:true});
  assert.equal(state.removed,true);
  assert.equal(state.timers.length,0);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/#wf-splash\{opacity:0!important;visibility:hidden!important;pointer-events:none!important/);
  assert.match(css,/@media print\{#wf-splash\{display:none!important\}\}/);
});
test('home screen accurately explains the actual customer workflow',()=>{
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
test('country pages offer a real accessible Back action',()=>{
  assert.match(atlas,/← Back to country collection/);
  assert.match(atlas,/panel\.hidden=true/);
  assert.match(atlas,/nav\('discover'\)/);
  assert.match(atlas,/heading\.focus\(\{preventScroll:true\}\)/);
  assert.match(clarity,/\.wf-top10-return:focus-visible/);
});
