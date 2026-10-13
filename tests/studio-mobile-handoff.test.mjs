import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const css=read('premium-refinement.css');
const motion=read('premium-motion.js');
const editorial=read('editorial-pages.js');
const atlas=read('country-atlas.js');
const world=read('wayfarer-product.js');
const app=read('premium-app.js');

test('all country and editorial planning shortcuts reveal the World Explorer tab',()=>{
  assert.match(atlas,/nav\('studio'\);\s*\/\/[^\n]*\n\s*\$\('wf-tab-explore'\)\?\.click\(\)/);
  assert.match(editorial,/changeTab\('studio'\);[\s\S]{0,200}\$\('wf-tab-explore'\)\?\.click\(\)/);
  assert.equal((world.match(/\$\('wf-tab-explore'\)\?\.click\(\)/g)||[]).length,2);
  assert.match(editorial,/select the correct result to connect it to your itinerary/);
  assert.match(atlas,/choose the matching result to add it to your journey/);
  // Curated places with already-known local coordinates still keep their direct
  // Overview flow; the new tab opening applies to search-first paths only.
  assert.match(editorial,/if\(shortcut\)\{shortcut\.click\(\);return\}/);
  assert.match(app,/function choose\(n\)/);
});

test('the Studio enforces its selected panel visibility despite older display CSS',()=>{
  for(const selector of [
    '#studio .workspace[hidden]',
    '#studio .wf-provider-cards[hidden]',
    '#studio #world-explorer[hidden]',
    '#studio #wayfarer-travel-research[hidden]'
  ])assert.ok(css.includes(selector),'Missing hidden panel rule '+selector);
  assert.match(css,/display:none!important/);
  const source=read('art-direction.js');
  assert.match(source,/world\.hidden=name!=='explore'/);
  assert.match(source,/workspace\.hidden=name!=='overview'/);
});

test('mobile navigation uses two balanced rows for six reachable routes',()=>{
  assert.match(css,/@media\(max-width:650px\)/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/grid-template-rows:repeat\(2,minmax\(44px,1fr\)\)/);
  assert.match(css,/\.nav \.nav-links button\{[\s\S]*?min-height:44px!important/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/\.view \.app\{padding-bottom:calc\(158px/);
  const html=read('index.html');
  const header=html.match(/<nav class="nav-links"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
  for(const view of ['discover','destinations-page','guides-page','studio','arrival','trips']) {
    assert.ok(header.includes('data-view="'+view+'"'),'Missing mobile destination '+view);
  }
});

test('route observer preserves input focus given to a destination handoff',()=>{
  let current='discover', notify=()=>{}, focusedHeading=null;
  const worldInput={name:'World Explorer search'};
  const outside={name:'Header navigation'};
  const title={
    setAttribute(){},
    focus(){focusedHeading=current;}
  };
  const activeView=()=>({
    id:current,
    scrollHeight:1600,
    querySelector:()=>title,
    contains:element=>element===worldInput
  });
  const doc={
    documentElement:{classList:{toggle(){}}},
    body:{scrollHeight:1600},
    activeElement:outside,
    getElementById:()=>null,
    querySelector(sel){
      if(sel==='.view.active')return activeView();
      if(sel==='.nav')return {classList:{toggle(){}}};
      if(sel==='.hero')return null;
      return null;
    },
    querySelectorAll(sel){
      if(sel==='.view')return [activeView()];
      return [];
    },
    addEventListener(){}
  };
  vm.runInNewContext(motion,{
    document:doc,
    window:{matchMedia:()=>({matches:false,addEventListener(){}}),scrollY:0,innerHeight:900},
    requestAnimationFrame:()=>{},addEventListener:()=>{},
    MutationObserver:class{constructor(callback){notify=callback;}observe(){}},
    queueMicrotask:fn=>fn()
  },{timeout:1000});
  current='studio';
  doc.activeElement=worldInput;
  notify([]);
  assert.equal(focusedHeading,null,'Search focus must not be stolen by the Studio heading');
  current='arrival';
  doc.activeElement=outside;
  notify([]);
  assert.equal(focusedHeading,'arrival','Ordinary header navigation should focus its new heading');
});

test('this improvement makes no metered supplier search and introduces no extra JS vendor',()=>{
  for(const source of [editorial,atlas,world]){
    assert.doesNotMatch(source,/DUFFEL_ACCESS_TOKEN|SERPAPI_API_KEY|GROQ_API_KEY/);
  }
  assert.doesNotMatch(css,/https?:\/\//);
});
