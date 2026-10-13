import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const js = read('premium-motion.js');
const app = read('premium-app.js');
const css = read('premium-refinement.css');
const html = read('index.html');
const views=['discover','destinations-page','guides-page','studio','arrival','trips'];

function createDom() {
  let current='discover', notify=()=>{};
  const buttons = views.map(id=>{
    const classes=new Set(id==='discover'?['active']:[]);
    const attrs=new Map(id==='discover'?[['aria-current','page']]:[]);
    return {
      dataset:{view:id},
      classList:{
        toggle(name,on) { if(on) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      setAttribute(name,val){attrs.set(name,val);},
      removeAttribute(name){attrs.delete(name);},
      getAttribute(name){return attrs.get(name)||null;}
    };
  });
  const rootClasses=new Set();
  const root={classList:{toggle(name,on){on?rootClasses.add(name):rootClasses.delete(name);}}};
  const view = id => ({id,scrollHeight:1500,querySelector:()=>null});
  const nav={classList:{toggle(){}}};
  const document={
    documentElement:root,body:{scrollHeight:1500},
    getElementById:()=>null,
    querySelector(selector){
      if(selector==='.view.active')return view(current);
      if(selector==='.nav')return nav;
      if(selector==='.hero')return null;
      return null;
    },
    querySelectorAll(selector){
      if(selector==='.nav-links button[data-view]')return buttons;
      if(selector==='.view')return views.map(view);
      return [];
    },
    addEventListener(){}
  };
  const context={
    document, window:{matchMedia:()=>({matches:false,addEventListener(){}}),scrollY:0,innerHeight:900},
    requestAnimationFrame:()=>{}, addEventListener:()=>{},
    MutationObserver:class{constructor(callback){notify=callback} observe(){}},
    queueMicrotask:fn=>fn()
  };
  vm.runInNewContext(js,context,{timeout:1000});
  return {
    buttons,
    goTo(id){current=id;notify([]);},
    state(){
      return buttons.filter(b=>b.classList.contains('active')||b.getAttribute('aria-current')==='page')
        .map(b=>({name:b.dataset.view,active:b.classList.contains('active'),current:b.getAttribute('aria-current')}));
    }
  };
}

test('exactly one active route survives navigation across all six pages',()=>{
  const ui=createDom();
  for(const id of [...views,...views.toReversed()]){
    ui.goTo(id);
    const state=ui.state();
    assert.equal(state.length,1,'Exactly one selected link on '+id+': '+JSON.stringify(state));
    assert.equal(state[0].name,id);
    assert.equal(state[0].active,true);
    assert.equal(state[0].current,'page');
  }
});

test('visual class and aria-current recover when previously out of sync',()=>{
  const ui=createDom();
  ui.buttons.find(b=>b.dataset.view==='discover').classList.toggle('active',true);
  ui.buttons.find(b=>b.dataset.view==='trips').setAttribute('aria-current','page');
  ui.goTo('arrival');
  assert.deepEqual(ui.state(),[{name:'arrival',active:true,current:'page'}]);
});

test('hover and touch feedback cannot mimic the unique selected state',()=>{
  assert.match(css,/\.nav \.nav-links button\[aria-current="page"\]\{/);
  assert.match(css,/\.nav \.nav-links button\[aria-current="page"\]::after/);
  assert.match(css,/@media\(hover:hover\) and \(pointer:fine\)/);
  assert.match(css,/@media\(hover:none\)/);
  assert.match(css,/button:hover:not\(\[aria-current="page"\]\)/);
});

test('empty journeys state is meaningful before and after hydration',()=>{
  assert.match(html,/<div class="saved wf-journey-grid" id="saved" aria-live="polite"><div class="empty wf-journey-preload">/);
  assert.match(html,/No journeys have been saved in this browser yet/);
  assert.match(app,/renderDest\(\);.*build\(\);arrival\(\);renderTrips\(\);/);
  assert.match(app,/root\.replaceChildren\(\)/);
  assert.match(app,/empty\.append\(label,heading,p,button\)/);
});
