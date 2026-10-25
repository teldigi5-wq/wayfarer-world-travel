import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INCIDENT_BROWSER_ORIGIN,PROFILES,
  validateIncidentBrowserOrigin,classifyIncidentBrowserRequest
} from '../scripts/incident-browser-policy.mjs';

const origin='https://wayfarer-world-travel-m4ce3pzyx-teldigi5-wq.vercel.app';
test('only exact hard-pinned immutable incident origin may be browsed',()=>{
  assert.equal(validateIncidentBrowserOrigin(origin).origin,origin);
  for(const u of [
    undefined,'',origin+'/',origin+'/api/hotels',origin+'/?x=1',
    'http://wayfarer-world-travel-m4ce3pzyx-teldigi5-wq.vercel.app',
    'https://wayfarer-world-travel.vercel.app',
    'https://wayfarer-world-travel-teldigi5-wq.vercel.app',
    origin+'.evil.example',origin+'#x'
  ])assert.throws(()=>validateIncidentBrowserOrigin(u),/BLOCKED/);
});

test('only safe static GET and HEAD to exact immutable origin can leave browser',()=>{
  assert.equal(classifyIncidentBrowserRequest(origin+'/premium-app.js','GET'),'allow-static');
  assert.equal(classifyIncidentBrowserRequest(origin+'/','GET'),'allow-static');
  assert.equal(classifyIncidentBrowserRequest(origin+'/index.html','HEAD'),'allow-static');
  assert.equal(classifyIncidentBrowserRequest(origin+'/','POST'),'block-mutation');
  assert.equal(classifyIncidentBrowserRequest(origin+'/index.html','DELETE'),'block-mutation');
});

test('all real APIs are blocked even for safe-method GET',()=>{
  for(const path of ['/api','/api/','/api/hotels','/api/ai-plan?x=1',
    '/api/travel-offers','/api/travel-search','/api/explore','/api/intelligence',
    '/api%2Ftravel-offers','/%61pi/travel-offers']){
    assert.equal(classifyIncidentBrowserRequest(origin+path,'GET'),'block-api');
    assert.equal(classifyIncidentBrowserRequest(origin+path,'POST'),'block-api');
  }
});

test('external services, public aliases, lookalikes and malformed URLs are blocked',()=>{
  for(const u of [
    'https://geocoding-api.open-meteo.com/v1/search?q=x',
    'https://en.wikipedia.org/w/api.php',
    'https://api.groq.com/openai/v1/chat/completions',
    'https://www.google-analytics.com/g/collect',
    'https://wayfarer-world-travel.vercel.app/',
    'https://wayfarer-world-travel-m4ce3pzyx-teldigi5-wq.vercel.app.evil.com/',
    'javascript:alert(1)','about:blank','not a URL'
  ])assert.notEqual(classifyIncidentBrowserRequest(u),'allow-static');
});

test('all four viewport profiles are unique and include small phone through desktop',()=>{
  assert.equal(PROFILES.length,4);
  assert.equal(new Set(PROFILES.map(x=>x.name)).size,4);
  assert.deepEqual(PROFILES.map(x=>x.width),[320,390,768,1440]);
});

test('browser code installs network interception before navigation and asserts UI state',()=>{
  const source=readFileSync(new URL('../scripts/browser-incident-remote-e2e.mjs',import.meta.url),'utf8');
  const route=source.indexOf("await page.route('**/*'");
  const goto=source.indexOf("await page.goto(origin+'/'");
  assert.ok(route>=0&&goto>route);
  assert.match(source,/classifyIncidentBrowserRequest/);
  assert.match(source,/route\.abort\('blockedbyclient'\)/);
  assert.match(source,/serverlessRequestsSent:0,providerRequestsSent:0/);
  assert.match(source,/jsErrors/);
  assert.match(source,/horizontal overflow/);
  assert.match(source,/nav\.nav-links button\[data-view/);
  assert.doesNotMatch(source,/page\.route\([^)]*continue\(\)/);
});

test('manual browser audit cannot deploy, reassign aliases, rotate secrets or override hold',()=>{
  const w=readFileSync(new URL('../.github/workflows/audit-existing-wayfarer-browser.yml',import.meta.url),'utf8');
  assert.match(w,/workflow_dispatch:/);
  assert.match(w,/github.ref == 'refs\/heads\/main'/);
  assert.match(w,/BROWSER_INCIDENT_ONLY/);
  assert.match(w,/environment: wayfarer-production-stage/);
  assert.match(w,/persist-credentials: false/);
  assert.match(w,/playwright-core@1\.55\.1/);
  assert.match(w,/node scripts\/browser-incident-remote-e2e\.mjs/);
  assert.doesNotMatch(w,/^\s+(push|pull_request|schedule):/m);
  assert.doesNotMatch(w,/\bvercel\s+(deploy|pull|build|alias|promote|rollback)\b/);
  assert.doesNotMatch(w,/secrets\.VERCEL_TOKEN|secrets\.VERCEL_AUTOMATION_BYPASS_SECRET/);
});

test('separate incident staging is still forcibly blocked before checkout',()=>{
  const w=readFileSync(new URL('../.github/workflows/stage-production-no-domain.yml',import.meta.url),'utf8');
  const hold=w.indexOf('name: BLOCKED - protect production aliases after unexpected assignment');
  const checkout=w.indexOf('name: Check out only the immutable reviewed main SHA');
  assert.ok(hold>=0&&checkout>hold);
  assert.match(w.slice(hold,checkout),/exit 1/);
  assert.equal(INCIDENT_BROWSER_ORIGIN,origin);
});
