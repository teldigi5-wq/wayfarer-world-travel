import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=root('index.html'),css=root('art-direction.css'),js=root('art-direction.js');
test('cinematic homepage is implemented with real HTML and accessible destination cards',()=>{
 for(const phrase of ['art-direction.css','art-direction.js','wf-featured-layout','wf-hero-trust','wf-dest-cta','studio-target'])
   assert.ok(html.includes(phrase),'missing '+phrase);
 assert.match(css,/#reel>\.destination>img\{position:absolute;inset:0/);
 assert.match(css, /object-fit:cover/);
 assert.match(css, /#reel>\.destination:focus-visible/);
 assert.match(css, /--wf-serif:/);
});
test('journey studio uses user-selected input and truthfully labeled ground budget',()=>{
 for(const field of ['destination','days','budget','run-agents','itinerary','plan-status','world-explorer','wayfarer-travel-research']){
   assert.ok(html.includes('id="'+field+'"')||js.includes("'"+field+"'"),field);
 }
 assert.match(js,/new Intl\.NumberFormat\('en-US'/);
 assert.match(js,/Number\(\$\('budget'\)/);
 assert.match(js,/Illustrative allocation, not verified local prices/);
 assert.match(js,/flights, visas and insurance are excluded/);
 assert.doesNotMatch(js,/seatsReported|flightNumber.*\$|hotel.*\$620/);
});
test('real AI agent and provider controls remain in the existing flow',()=>{
 assert.match(js, /\$\('run-agents'\)\?\.click\(\)/);
 assert.match(js, /research\.hidden=name!=='prices'/);
 assert.match(js, /world\.hidden=name!=='explore'/);
 assert.match(js, /new MutationObserver\(enhanceDays\)/);
 assert.match(js, /aria-selected/);
 assert.match(js, /ArrowRight/);
});
test('mobile and reduced-motion layouts are explicitly supported',()=>{
 for(const rule of [ '@media(max-width:1180px)','@media(max-width:900px)','@media(max-width:650px)','@media(max-width:370px)','@media(prefers-reduced-motion:reduce)'])
   assert.ok(css.includes(rule),'missing '+rule);
 assert.match(css, /\[hidden\]\{display:none!important\}/);
 assert.match(css, /#reel\.reel\{display:flex/);
 assert.match(css, /#studio \.workspace #itinerary\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
});
