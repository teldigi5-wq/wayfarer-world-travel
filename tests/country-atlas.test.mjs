import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const content=JSON.parse(read('country-atlas.json'));
const js=read('country-atlas.js');
const css=read('country-atlas.css');
const html=read('index.html');
const editorial=read('editorial-pages.js');
const codes=['LK','JP','IT','CH','FR','IS','TH','ID','NO','AE'];

test('ten countries have real distinct codes, descriptions and official travel references',()=>{
  assert.equal(content.countries.length,10);
  assert.deepEqual(content.countries.map(c=>c.code),codes);
  assert.equal(new Set(codes).size,10);
  for(const country of content.countries){
    assert.equal(country.id,codes.indexOf(country.code)+1);
    assert.ok(country.summary.length>=40);
    assert.ok(country.planning.length>=35);
    assert.ok(/^https:\/\//.test(country.source));
    assert.ok(/^https:\/\/images\.unsplash\.com\/photo-/.test(country.image));
    assert.ok(country.places.length>=5);
    assert.ok(new Set(country.places.map(p=>p.name)).size===country.places.length);
    for(const place of country.places){
      assert.ok(place.description.length>=20);
      assert.ok(place.name.length>2);
    }
  }
  assert.match(content.label,/not statistical tourism ranking/i);
});
test('Sri Lanka has multiple precise sites and linked cultural editorial guides',()=>{
  const sri=content.countries.find(c=>c.code==='LK');
  for(const place of ['Sigiriya','Ella','Galle Fort','Nuwara Eliya','Kandy','Yala National Park','Mirissa']){
    assert.ok(sri.places.some(p=>p.name===place),'Missing Sri Lanka place: '+place);
  }
  assert.equal(sri.source,'https://www.srilanka.travel/');
  assert.match(editorial,/id:'sri-lanka'/);
  assert.match(editorial,/id:'sri-lanka-first'/);
  assert.match(editorial,/id:'sri-lanka-heritage'/);
  assert.match(editorial,/dest:6/);
});
test('country atlas is visible in discover and detailed attractions open in destinations',()=>{
  assert.match(html,/src="country-atlas\.js" defer/);
  assert.match(html,/href="country-atlas\.css"/);
  assert.ok(html.indexOf('href="country-atlas.css"')>html.indexOf('href="editorial-pages.css"'));
  assert.match(js,/anchor\.insertAdjacentElement\('beforebegin',section\)/);
  assert.match(js,/root\.insertBefore\(panel,target\)/);
  assert.match(js,/nav\('destinations-page'\)/);
  assert.match(js,/nav\('studio'\)/);
  assert.match(js,/query|country-filter/);
  assert.match(js,/choose the matching result to add it to your journey/);
  assert.match(js,/nav\('discover'\)/);
});
test('search, handoff, no-result fallback, and reduced-motion/keyboard behaviors exist',()=>{
  assert.match(js,/\.addEventListener\('input',render\)/);
  assert.match(js,/filtered=countries\.filter/);
  assert.match(js,/wf-top10-no-results/);
  assert.match(js,/Country collection incomplete/);
  assert.match(js,/wf-top10-count/);
  assert.match(js,/role="status" aria-live="polite"/);
  assert.match(js,/aria-label/);
  assert.match(js,/rel='noopener noreferrer'/);
  assert.match(js,/prefers-reduced-motion: reduce/);
  assert.match(css,/focus-visible/);
  assert.match(css,/@media\(max-width:560px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\[hidden\]\{display:none!important;\}/);
});
test('curated content avoids invented sales, booking inventory, ratings and paid provider requests',()=>{
  assert.doesNotMatch(JSON.stringify(content),/(?:\$[0-9]+|guaranteed seats|verified expert|5-star review|top selling|ranked #1)/i);
  assert.doesNotMatch(js,/\/api\/travel-search|\/api\/airline-offers|\/api\/intelligence|Groq|Stripe|bookingConfirmed/);
  assert.match(js,/Editorial travel ideas only/);
  assert.match(js,/official tourism source/i);
});
