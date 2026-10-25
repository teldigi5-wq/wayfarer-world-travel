import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');

test('country sorting obtains one translated name per code, then sorts cached strings',()=>{
  assert.ok(source.includes('function orderedCountries(codes,names)'));
  assert.ok(source.includes('codes.map(code=>({code,name:names.of(code)}))'));
  assert.ok(source.includes('.sort((a,b)=>a.name.localeCompare(b.name))'));
  assert.ok(!source.includes('countryNames.of(a).localeCompare(countryNames.of(b))'));
});

test('dropdown uses cached display names with HTML-escaped labels',()=>{
  assert.ok(source.includes('sortedCountries=orderedCountries(countryCodes,countryNames)'));
  assert.ok(source.includes('sortedCountries.map(({code,name})=>'));
  assert.ok(source.includes('esc(name)'));
  assert.ok(source.includes('countryCodes='));
});
