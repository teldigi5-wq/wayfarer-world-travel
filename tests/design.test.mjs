import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
const motionCss = readFileSync(new URL('../premium-motion.css',import.meta.url),'utf8');
const motionJs = readFileSync(new URL('../premium-motion.js',import.meta.url),'utf8');
test('premium frontend retains all four functional journeys and external motion layers',()=>{
  for(const id of ['discover','studio','arrival','trips','world-form','run-agents','destination','search-stays'])
    assert.ok(html.includes('id="'+id+'"'), 'Missing '+id);
  assert.match(html,/href="premium-motion\.css"/);
  assert.match(html,/src="premium-motion\.js"/);
  assert.ok(existsSync(new URL('../wayfarer-hero-v3.jpg',import.meta.url)));
});
test('supports keyboard skip navigation, OS reduced-motion behavior without a UI toggle',()=>{
  assert.match(html,/class="skip-link" href="#main-content"/);
  assert.match(html,/id="main-content"/);
  assert.doesNotMatch(html,/id="motion-toggle"|Motion on|Motion off/);
  assert.match(html,/class="nav-plan" data-view="studio"/);
  assert.match(motionCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(motionCss,/\.motion-off \.reveal/);
  assert.match(motionJs,/aria-current/);
  assert.match(motionJs,/prefers-reduced-motion: reduce/);
  assert.doesNotMatch(motionJs,/localStorage|STORAGE_KEY|motion-toggle/);
});
test('avoids obsolete hotel availability claims in the upgraded interface',()=>{
  assert.match(html,/No confirmed inventory/);
  assert.match(html,/src="travel-research\.js"/);
  assert.doesNotMatch(html,/fetch\('\/api\/hotels/);
  assert.doesNotMatch(html,/Add Amadeus credentials/);
  assert.doesNotMatch(html,/Hotel offer adapter · ready for credentials/);
});
test('respects limited effects on small screens and avoids heavyweight animation dependencies',()=>{
  assert.match(motionCss,/@media\(max-width:650px\)/);
  assert.match(motionCss,/\.nav-links button\{font-size:11px;min-height:45px/);
  assert.doesNotMatch(html,/cdnjs\.cloudflare\.com\/ajax\/libs\/gsap/);
  assert.doesNotMatch(html,/unpkg\.com\/three/);
});
