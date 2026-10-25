import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const cfg=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const csp=cfg.headers.find(rule=>rule.source==='/(.*)')
  .headers.find(header=>header.key==='Content-Security-Policy').value;
const app=readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');

test('CSP minimally allowlists only the actual free geocoding host for cross-origin connect',()=>{
  const connection=csp.split(';').map(s=>s.trim()).find(s=>s.startsWith('connect-src '));
  assert.equal(connection,"connect-src 'self' https://geocoding-api.open-meteo.com");
  assert.ok(!connection.includes('*'),'No wildcard connection origin');
  assert.ok(!connection.includes('serpapi'),'No public paid search transport');
  assert.ok(!connection.includes('groq'),'No browser LLM key transport');
});
test('worldwide search attempts geocoding when Wikipedia is valid but yields no coordinates',()=>{
  assert.match(app,/if\(!r\.ok\|\|!d\.ok\|\|!Array\.isArray\(d\.results\)\|\|d\.results\.length===0\)throw Error\(\)/);
  assert.match(app,/fetch\('https:\/\/geocoding-api\.open-meteo\.com\/v1\/search\?'\+params\)/);
  assert.match(app,/Number\.isFinite\(x\.latitude\)&&Number\.isFinite\(x\.longitude\)/);
});
