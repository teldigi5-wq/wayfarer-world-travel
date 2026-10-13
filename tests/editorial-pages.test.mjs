import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=read('index.html'),js=read('editorial-pages.js'),css=read('editorial-pages.css');
test('Destinations and Guides are true accessible views wired into existing app navigation',()=>{
  assert.match(html,/<button data-view="destinations-page">Destinations<\/button>/);
  assert.match(html,/<button data-view="guides-page">Guides<\/button>/);
  assert.match(html,/<section class="view wf-editorial-page" id="destinations-page"/);
  assert.match(html,/<section class="view wf-editorial-page" id="guides-page"/);
  assert.match(html,/href="editorial-pages.css"/);
  assert.match(html,/src="editorial-pages.js" defer/);
  assert.ok(html.indexOf('href="editorial-pages.css"')>html.indexOf('href="travel-comparison.css"'));
  assert.match(js,/changeTab\('studio'\)/);
  assert.match(js,/changeTab\('arrival'\)/);
  assert.match(js,/changeTab\('discover'\)/);
});
test('curated destination discovery offers local text search, region and style filtering',()=>{
  for(const name of ['Kyoto','Amalfi Coast','Lofoten','Iceland','Bali','Swiss Alps'])assert.ok(js.includes(name));
  for(const id of ['wf-dest-query','wf-dest-region','wf-dest-style','wf-dest-reset','wf-destination-list'])assert.ok(js.includes(id));
  assert.match(js,/const filtered=destinations\.filter/);
  assert.match(js,/renderDestinations\(\)/);
  assert.match(js,/No matches\. Try another region/);
  assert.match(js,/query\.value=destination\.search/);
  assert.match(js,/country\.value=destination\.code/);
  assert.match(js,/select the correct result to connect it to your itinerary/);
});
test('guide detail reader, topic filters, keyboard focus and external sources work',()=>{
  assert.match(js,/role="group" aria-label="Guide categories"/);
  assert.match(js,/aria-pressed="true"/);
  assert.match(js,/\.setAttribute\('aria-pressed',String\(x===b\)\)/);
  assert.match(js,/reader\.focus\(\{preventScroll:true\}\)/);
  assert.match(js,/reader\.hidden=false/);
  assert.match(js,/No matching guides/);
  assert.match(js,/rel='noopener noreferrer'/);
  for(const source of ['https://www.japan.travel/en/','https://www.italia.it/en',
    'https://www.visitnorway.com/en/','https://www.visiticeland.com/',
    'https://www.myswitzerland.com/en/destinations/'])assert.ok(js.includes(source));
});
test('all editorial content is honestly labeled and does not fabricate live booking data',()=>{
  assert.match(js,/official tourism source/i);
  assert.match(js,/not live availability/i);
  assert.match(js,/not government advice/i);
  assert.match(js,/travel data coverage varies/i);
  assert.doesNotMatch(js,/Expert verified|Verified reviews|Tickets available now|Book now|Reserve seats/);
  assert.doesNotMatch(js,/fetch\(|\/api\/travel-search|\/api\/intelligence|navigator\.geolocation/);
});
test('premium interface retains legibility, responsive navigation, and reduced motion',()=>{
  assert.match(css,/\.wf-ed-hero h1/);
  assert.match(css,/\.wf-ed-dest-grid/);
  assert.match(css,/\.wf-ed-guides-grid/);
  assert.match(css,/\.wf-editorial-page button:focus-visible/);
  assert.match(css,/@media\(max-width:650px\)/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:375px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.wf-ed-reader\[hidden\]\{display:none!important;/);
});
