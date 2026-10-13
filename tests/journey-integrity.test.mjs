import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../'+file, import.meta.url),'utf8');
const script = read('journey-integrity.js');
const html = read('index.html');
const app = read('premium-app.js');
const sandbox = {};
vm.runInNewContext(script,sandbox,{timeout:1000});
const resolve = trip => JSON.parse(JSON.stringify(sandbox.WayfarerJourneyIntegrity.resolveSavedWorldPlace(trip)));

test('restores the exact known curated destination with a correct country code',()=>{
  for(const [destination,country,code,lat] of [
    ['Kyoto','Japan','JP',35.0116],
    ['Bali','Indonesia','ID',-8.5069],
    ['Switzerland','Switzerland','CH',46.6863]
  ]){
    const point=resolve({destination,country,worldPlace:null});
    assert.equal(point.name,destination);
    assert.equal(point.country,country);
    assert.equal(point.countryCode,code);
    assert.equal(point.latitude,lat);
  }
});

test('restores only matching, finite stored coordinates for worldwide destinations',()=>{
  const worldPlace={id:987,name:'Paris',country:'France',countryCode:'FR',latitude:48.8566,longitude:2.3522,untrustedExtra:'ignore'};
  const result=resolve({destination:'Paris',country:'France',worldPlace});
  assert.deepEqual(result,{name:'Paris',country:'France',countryCode:'FR',latitude:48.8566,longitude:2.3522});
});

test('never retains unrelated coordinates or guessed country codes from older saves',()=>{
  const old={destination:'Lisbon',country:'Portugal',worldPlace:{name:'Kyoto',country:'Japan',countryCode:'JP',latitude:35.0116,longitude:135.7681}};
  assert.deepEqual(resolve(old),{name:'Lisbon',country:'Portugal'});
  assert.deepEqual(resolve({destination:'Lisbon',country:'Portugal',worldPlace:null}),{name:'Lisbon',country:'Portugal'});
  assert.deepEqual(resolve({destination:'Kyoto',country:'Portugal',worldPlace:null}),{name:'Kyoto',country:'Portugal'});
  assert.equal(resolve({destination:'Unknown',worldPlace:null}),null);
});

test('rejects tampered coordinates, invalid codes and conflicting country labels',()=>{
  const place={name:'Paris',country:'France',countryCode:'FR',latitude:48.8,longitude:2.3};
  for(const invalid of [
    {...place,latitude:90.1},
    {...place,longitude:-181},
    {...place,latitude:Infinity},
    {...place,latitude:'48.8'},
    {...place,countryCode:'USA'},
    {...place,countryCode:'fr'},
    {...place,country:'Germany'}
  ]){
    assert.deepEqual(resolve({destination:'Paris',country:'France',worldPlace:invalid}),{name:'Paris',country:'France'});
  }
});

test('restoration integrates with page loading and prevents stale browser-state reuse',()=>{
  assert.ok(html.indexOf('src="journey-integrity.js"')>=0);
  assert.ok(html.indexOf('src="journey-integrity.js"')<html.indexOf('src="premium-app.js"'));
  assert.match(app,/WayfarerJourneyIntegrity\?\.resolveSavedWorldPlace\(t\)/);
  assert.match(app,/worldSelection=globalThis\.WayfarerJourneyIntegrity/);
  assert.match(app,/Saved destination restored without map coordinates/);
  assert.match(app,/Array\.isArray\(saved\)\?saved\.filter/);
  assert.doesNotMatch(app,/if\(t\.worldPlace\?\.name===t\.destination/);
});

test('navigation labels the active view for assistive technology',()=>{
  assert.match(html,/data-view="discover" aria-current="page"/);
  assert.match(app,/setAttribute\('aria-current','page'\)/);
  assert.match(app,/removeAttribute\('aria-current'\)/);
});
