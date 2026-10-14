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


test('same-name destinations in different countries are saved as distinct journeys',()=>{
  const helper=sandbox.WayfarerJourneyIntegrity;
  const make=(name,country,code,latitude,longitude,pace='Balanced')=>({
    destination:name,country,worldPlace:{name,country,countryCode:code,latitude,longitude},
    days:3,budget:180,pace
  });
  const france=make('Paris','France','FR',48.8566,2.3522);
  const texas=make('Paris','United States','US',33.6609,-95.5555);
  const springfieldIllinois=make('Springfield','United States','US',39.8017,-89.6437);
  const springfieldMass=make('Springfield','United States','US',42.1015,-72.5898);
  let saved=[];
  for(const item of [france,texas,springfieldIllinois,springfieldMass])
    saved=helper.upsertJourney(saved,item);
  assert.equal(saved.length,4);
  const newFrance={...france,pace:'Full & energetic'};
  saved=helper.upsertJourney(saved,newFrance);
  assert.equal(saved.length,4,'resaving the SAME geographic city should update just that card');
  assert.equal(saved.find(x=>x.country==='France').pace,'Full & energetic');
  assert.equal(saved.find(x=>x.country==='United States'&&x.destination==='Paris').worldPlace.longitude,-95.5555);
  assert.notEqual(helper.journeyIdentity(france),helper.journeyIdentity(texas));
  assert.notEqual(helper.journeyIdentity(springfieldIllinois),helper.journeyIdentity(springfieldMass));
});

test('legacy saves without coordinates are never incorrectly assigned another country',()=>{
  const helper=sandbox.WayfarerJourneyIntegrity;
  const a={destination:'Paris',country:'France',worldPlace:null,days:3};
  const b={destination:'Paris',country:'United States',worldPlace:null,days:7};
  const saved=helper.upsertJourney(helper.upsertJourney([],a),b);
  assert.equal(saved.length,2);
  assert.equal(helper.upsertJourney(saved,{...a,days:5}).length,2);
  assert.equal(helper.journeyIdentity({destination:'',country:'France'}),null);
});

test('save and resume use geographic identity and reload worldwide sourced references',()=>{
  assert.match(app,/WayfarerJourneyIntegrity\.upsertJourney\(trips,\{destination:selected/);
  const chooser=app.slice(app.indexOf('function choose(n)'),app.indexOf('let agentRunSerial='));
  assert.match(chooser,/nearbyPlaces\(worldSelection\)/);
  const saved=app.slice(app.indexOf('const resumeTrip='),app.indexOf('resume.onclick=',app.indexOf('const resumeTrip=')));
  assert.match(saved,/WayfarerJourneyIntegrity\?\.resolveSavedWorldPlace\(t\)/);
  assert.match(saved,/nearbyPlaces\(worldSelection\)/);
  assert.doesNotMatch(app,/trips=trips\.filter\(x=>x\.destination!==selected\)/);
});

test('explicit curated-name world selection survives saving even when coordinates differ within the same country',()=>{
  const helper=sandbox.WayfarerJourneyIntegrity;
  const alternate={
    destination:'Kyoto',country:'Japan',
    worldPlace:{name:'Kyoto',country:'Japan',countryCode:'JP',
      latitude:35.73,longitude:136.18}
  };
  const restored=helper.resolveSavedWorldPlace(alternate);
  assert.equal(restored.latitude,35.73);
  assert.equal(restored.longitude,136.18);
  assert.notEqual(helper.journeyIdentity(alternate),
    helper.journeyIdentity({destination:'Kyoto',country:'Japan',worldPlace:null}));
  assert.equal(helper.upsertJourney(helper.upsertJourney([],
    {...alternate,days:3,budget:180}),
    {destination:'Kyoto',country:'Japan',worldPlace:null,days:5,budget:190}).length,2,
    'Distinct mapped and curated geography cannot overwrite the other journey');
});

test('explicit malformed curated-name geometry never silently changes into a curated location',()=>{
  const helper=sandbox.WayfarerJourneyIntegrity;
  const bad=[
    {latitude:95,longitude:120,countryCode:'JP'},
    {latitude:'35.5',longitude:120,countryCode:'JP'},
    {latitude:35.5,longitude:120,countryCode:'US'},
    {latitude:35.5,longitude:-181,countryCode:'JP'}
  ];
  for(const value of bad){
    const trip={destination:'Kyoto',country:'Japan',worldPlace:{
      name:'Kyoto',country:'Japan',...value}};
    const restored=helper.resolveSavedWorldPlace(trip);
    assert.deepEqual(JSON.parse(JSON.stringify(restored)),{name:'Kyoto',country:'Japan'});
  }
  assert.equal(helper.resolveSavedWorldPlace({
    destination:'Kyoto',country:'Portugal',worldPlace:null
  }).latitude,undefined);
  assert.equal(helper.resolveSavedWorldPlace({
    destination:'Kyoto',country:'Japan',worldPlace:null
  }).latitude,35.0116,'Genuine curated legacy save still works');
});

test('itinerary snapshot validates strictly bounded per-day safe textual draft content',()=>{
  const normalize=sandbox.WayfarerJourneyIntegrity.normalizeItineraryDraft;
  const sample={basis:'ai-draft',title:'A three-day Kyoto exploration',
    days:Array.from({length:3},(_,i)=>({
      title:'Day '+(i+1),summary:'A draft itinerary; verify opening hours.'
    }))};
  const result=JSON.parse(JSON.stringify(normalize(sample,3)));
  assert.equal(result.basis,'ai-draft');
  assert.equal(result.days.length,3);
  assert.equal(result.title,sample.title);
  assert.equal(normalize(sample,5),null);
  assert.equal(normalize({...sample,days:[...sample.days,{title:'Day4',summary:'More'}]},3),null);
  assert.equal(normalize({...sample,days:[{title:'<img src=x onerror=alert(1)>',
    summary:'X'.repeat(801)},...sample.days.slice(1)]},3),null);
  assert.equal(normalize({...sample,title:''},3),null);
  assert.equal(normalize({...sample,title:'Y'.repeat(161)},3),null);
  assert.equal(normalize({...sample,days:'malicious'},3),null);
  assert.equal(normalize(null,3),null);
  const copied=JSON.parse(JSON.stringify(normalize({...sample,basis:'unknown'},3)));
  assert.equal(copied.basis,'sample','Unsupported provenance cannot escalate to an AI claim');
  assert.equal(normalize(sample,31),null);
});
