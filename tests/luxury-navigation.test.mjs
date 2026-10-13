import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('index.html');
const motion=read('premium-motion.js'),heroCss=read('premium-refinement.css');
const baseCss=read('premium-motion.css'),editorialCss=read('art-direction.css');
const splash=read('splash-screen.js');
const app=read('premium-app.js');
test('site header removes the old Motion on control and fake glowing status',()=>{
  assert.doesNotMatch(html,/motion-toggle|motion-toggle-text|Motion on|Motion off|Source-led tools/);
  assert.match(html,/class="nav-plan" data-view="studio"/);
  assert.match(html,/aria-label="Start planning your journey"/);
  assert.match(app,/querySelectorAll\(s\)/);
  assert.ok(app.includes("$('[data-view]')"));
  assert.match(heroCss,/\.nav \.nav-plan\{/);
  assert.doesNotMatch(baseCss,/\.motion-toggle\{|\.motion-toggle-dot/);
  assert.doesNotMatch(editorialCss,/\.nav \.motion-toggle/);
});
test('decorative motion no longer uses persistent manual preferences',()=>{
  assert.doesNotMatch(motion,/motion-toggle|localStorage|sessionStorage|STORAGE_KEY|aria-label.*motion/);
  assert.doesNotMatch(splash,/wf-visual-motion-v1|localStorage/);
  assert.match(motion,/prefers-reduced-motion: reduce/);
  assert.match(motion,/osReduce\.addEventListener\?\.\('change',synchronizeReducedMotion\)/);
  assert.match(heroCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(heroCss,/#discover \.hero-media\{animation:none!important/);
});
test('OS preference changes live and disables animated parallax',()=>{
  let reduce=false;let update;
  const classes=new Set();const events={};const raf=[];
  const heroImage={style:{setProperty(k,v){events[k]=v;}}};
  const view={id:'discover',scrollHeight:1600,querySelector:()=>null};
  const nav={classList:{toggle(){}}};
  const root={classList:{toggle(key,state){if(state)classes.add(key);else classes.delete(key);}}};
  const doc={documentElement:root,
    body:{scrollHeight:1600},
    querySelector(selector){
      if(selector==='.reading-progress')return null;
      if(selector==='#reading-progress-fill')return null;
      if(selector==='.nav')return nav;
      if(selector==='.hero')return {querySelector:()=>heroImage};
      if(selector==='.view.active')return view;
      if(selector.includes('.nav-links button'))return null;
      return null;
    },
    querySelectorAll:()=>[],
    addEventListener:()=>{}};
  const env={
    document:doc,window:{matchMedia:()=>({get matches(){return reduce;},addEventListener(_name,fn){update=fn;}}),scrollY:50,innerHeight:900},
    addEventListener:()=>{},requestAnimationFrame:fn=>raf.push(fn),MutationObserver:class{observe(){}},
    queueMicrotask:fn=>fn()
  };
  vm.runInNewContext(motion,env,{timeout:1000});
  assert.ok(!classes.has('motion-off'));
  assert.equal(typeof update,'function');
  reduce=true;update();
  assert.ok(classes.has('motion-off'));
  assert.equal(events['--hero-offset'],'0px');
  reduce=false;update();
  assert.ok(!classes.has('motion-off'));
});
test('typography, CTA, and touch targets meet the premium clarity standard',()=>{
  assert.match(heroCss,/font-size:clamp\(\.96rem,1\.09vw,1\.13rem\)/);
  assert.match(heroCss,/min-height:46px/);
  assert.match(heroCss,/min-height:48px/);
  assert.match(heroCss,/@media\(max-width:650px\)/);
  assert.match(heroCss,/\.nav \.nav-plan:focus-visible/);
  assert.match(heroCss,/\.wf-ed-guide-body p/);
  assert.match(heroCss,/\.wf-top10-card-copy p/);
  assert.match(html,/href="premium-refinement.css"/);
  assert.ok(html.indexOf('href="premium-refinement.css"')>html.indexOf('href="clarity-polish.css"'));
});
