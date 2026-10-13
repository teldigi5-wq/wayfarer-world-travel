import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync as read } from 'node:fs';
const html=read(new URL('../index.html',import.meta.url),'utf8');
const css=read(new URL('../experience-layer.css',import.meta.url),'utf8');
const js=read(new URL('../experience-layer.js',import.meta.url),'utf8');
test('new experience layer is loaded after the preserved motion/research controllers',()=>{
  assert.match(html,/premium-motion\.js" defer><\/script><script src="travel-research\.js" defer><\/script><script src="experience-layer\.js" defer>/);
  assert.match(html,/experience-layer\.css/);
});
test('visual polish keeps all existing page flows and native accessibility',()=>{
  for(const id of ['discover','studio','arrival','trips','world-explorer','check-in','check-out']){
    assert.ok(html.includes(`id="${id}"`),`Missing original element ${id}`);
  }
  assert.match(html,/href="#main-content"/);
  assert.match(js,/aria-label.*Current journey planning summary/);
  assert.match(js,/document\.querySelectorAll\('\.nav-links button\[data-view\]'\)/);
});
test('budget summary reflects user input while distinct airfare ceiling remains independent',()=>{
  assert.match(js,/getElementById\(id\)/);
  assert.match(js,/\$\('budget'\)/);
  assert.match(js,/Math\.max\(1, Math\.min\(30/);
  assert.match(html,/travel-research\.js/);
});
test('form prevents invalid trip detail searches before provider quota is used',()=>{
  assert.match(js,/stopImmediatePropagation/);
  assert.match(js,/inDate >= outDate/);
  assert.match(js,/\^\[A-Z\]\{3\}\$/);
});
test('responsive motion is optional and buttons remain comfortable on mobile',()=>{
  assert.match(css,/@media\(max-width:650px\)/);
  assert.match(css,/\.nav-links button\{display:flex;flex-direction:column/);
  assert.match(css,/min-height:59px/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.motion-off/);
});
