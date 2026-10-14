import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const index=JSON.parse(read('airports-index.json'));
const packageJson=JSON.parse(read('package.json'));
const config=JSON.parse(read('vercel.json'));
const backend=read('api/explore.js');
const updater=read('scripts/refresh-airports.mjs');
const safeBuild=read('scripts/build-airports.mjs');

test('global airport index contains named, coded, geographically grounded records',()=>{
  assert.ok(index.airports.length>=1000);
  assert.ok(new Set(index.airports.map(x=>x.code)).size>=225);
  for(const entry of index.airports){
    assert.match(entry.iata,/^[A-Z]{3}$/);
    assert.match(entry.code,/^[A-Z]{2}$/);
    assert.ok(Number.isFinite(entry.lat)&&Math.abs(entry.lat)<=90);
    assert.ok(Number.isFinite(entry.lon)&&Math.abs(entry.lon)<=180);
    assert.ok(entry.name.length>1);
  }
});

test('airport selection uses build-time public-domain index, not just a seven-code country sample',()=>{
  assert.match(backend,/import airportCatalog from '\.\.\/airports-index\.json' with \{type:'json'\}/);
  assert.match(backend,/airportCatalog\.airports\.length>=1000/);
  assert.match(backend,/airportReferences/);
  assert.match(updater,/ourairports-data\/airports\.csv/);
  assert.match(updater,/scheduledService/);
  assert.match(safeBuild,/preserving checked-in airport fallback/);
});

test('Vercel build refreshes and remains usable without an upstream provider',()=>{
  assert.equal(config.buildCommand,'npm run build');
  assert.equal(packageJson.scripts.build,'node scripts/build-airports.mjs');
  assert.match(safeBuild,/data\.airports\.length<1000/);
  assert.doesNotMatch(safeBuild,/SERPAPI_API_KEY|GROQ_API_KEY/);
});

test('reference airports never infer live flight availability or synthetic prices',()=>{
  assert.match(index.usage,/not verified|not proof/i);
  assert.doesNotMatch(backend,/\baverageFare\s*:/);
  assert.match(backend,/price:null/);
});
