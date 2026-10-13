import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const base=dirname(fileURLToPath(new URL('../index.html',import.meta.url)));
const html=readFileSync(resolve(base,'index.html'),'utf8');

function localAssets() {
  const results=[];
  const pattern=/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/gi;
  for (const match of html.matchAll(pattern)) {
    const u=match[1];
    if(u.startsWith('http:')||u.startsWith('https:')||u.startsWith('//')||u.startsWith('data:')||u.startsWith('#')) continue;
    if(!/\.(?:css|js|jpg|jpeg|png|webp|svg|mjs)(?:\?|$)/i.test(u)) continue;
    results.push(u.split('?')[0]);
  }
  return [...new Set(results)];
}
test('all local stylesheets, scripts and images referenced by the homepage exist',()=>{
  const files=localAssets();
  assert.ok(files.includes('art-direction.css'),'missing cinematic design CSS link');
  assert.ok(files.includes('art-direction.js'),'missing cinematic behavior script link');
  assert.ok(files.includes('premium-base.css'),'premium base absent');
  assert.ok(files.includes('premium-app.js'),'existing journey interactions absent');
  for(const file of files){
    assert.ok(!file.includes('..'),'homepage references unsafe parent traversal');
    const full=resolve(base,file);
    assert.ok(existsSync(full),'missing deploy asset: '+file);
    assert.ok(statSync(full).size>0,'empty deploy asset: '+file);
  }
});
test('cinematic art-direction source is substantial and photo layering is full-bleed',()=>{
  const css=readFileSync(resolve(base,'art-direction.css'),'utf8');
  const js=readFileSync(resolve(base,'art-direction.js'),'utf8');
  assert.ok(css.length>12000,'missing complete design system stylesheet');
  assert.ok(js.length>3000,'missing complete product composition controller');
  assert.match(css,/#reel\s*>\s*\.destination\s*>\s*img\s*\{[^}]*position:absolute[^}]*inset:0/s);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(js,/wayfarer-travel-research/);
  assert.match(js,/run-agents/);
});
test('webpage has a single functional premium frontend and references no legacy visual CSS',()=>{
  assert.equal((html.match(/src="premium-app\.js"/g)||[]).length,1);
  assert.equal((html.match(/href="art-direction\.css"/g)||[]).length,1);
  assert.doesNotMatch(html,/href="styles\.css"|src="app\.mjs"|src="ai-panel\.mjs"/);
});
