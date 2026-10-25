import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_ASSETS} from '../static-asset-manifest.mjs';
import {INTERNAL_SOURCE_PATHS} from '../internal-source-denylist.mjs';
import {verifyProductionSurface} from '../scripts/verify-production-http.mjs';

const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const security=Object.fromEntries(config.headers.find(x=>x.source==='/(.*)')
  .headers.map(x=>[x.key,x.value]));
const sourcePaths=new Set(INTERNAL_SOURCE_PATHS);
const apiPaths=new Set(['/api/explore','/api/intelligence','/api/hotels',
  '/api/ai-plan','/api/travel-offers','/api/travel-search']);
const publicPaths=new Set(['/',...PUBLIC_ASSETS.map(name=>'/'+name)]);
const types={html:'text/html',css:'text/css',js:'application/javascript',
  json:'application/json',webp:'image/webp',jpg:'image/jpeg',
  txt:'text/plain',xml:'application/xml'};
const response=(status,type,headers={})=>new Response('placeholder',{
  status,headers:{'Content-Type':type,...headers}
});
function simulated({exposed=null,missing=null,wrongMime=null,brokenApi=null,
  wrongCache=null,badCsp=false,redirect=null}={}){
  const calls=[];
  async function transport(url,opts){
    const parsed=new URL(url),path=parsed.pathname;
    calls.push({url,opts});
    assert.equal(parsed.origin,'https://wayfarer-world-travel.vercel.app');
    assert.ok(['HEAD','GET'].includes(opts.method));
    assert.equal(opts.redirect,'error');
    assert.ok(!('Authorization' in opts.headers));
    assert.ok(!('Cookie' in opts.headers));
    if(opts.method==='GET')assert.equal(opts.headers.Range,'bytes=0-0');
    if(path===redirect)throw Error('Redirect refused');
    if(path===exposed&&opts.method==='GET')
      return response(200,'application/javascript');
    if(path===missing)return response(404,'text/plain');
    if(sourcePaths.has(path))return response(404,'text/plain');
    if(publicPaths.has(path)){
      const ext=path==='/'?'html':path.split('.').at(-1);
      const mime=path===wrongMime?'text/plain':types[ext];
      assert.ok(mime,'unexpected browser asset '+path);
      const headers=path==='/'?{
        ...security,'Strict-Transport-Security':'max-age=63072000; includeSubDomains',
      }:{};
      if(badCsp&&path==='/')headers['Content-Security-Policy']="default-src *";
      return response(200,mime,headers);
    }
    if(apiPaths.has(path)){
      const status=path===brokenApi?404:
        ['/api/ai-plan','/api/travel-offers','/api/travel-search'].includes(path)?405:400;
      return response(status,'application/json',{
        'Cache-Control':path===wrongCache?'public':'no-store',
        ...(['allow'].includes('unused')?{}:status===405?{Allow:'POST'}:{})
      });
    }
    throw Error('Unreviewed network request');
  }
  return {transport,calls};
}
test('canonical production source denylist checks legacy paths without providers',async()=>{
  const mock=simulated(),result=await verifyProductionSurface({transport:mock.transport});
  assert.equal(result.status,'PRODUCTION_HTTP_SURFACE_PASS_ONLY');
  assert.equal(result.requests,2*(18+INTERNAL_SOURCE_PATHS.length)+6);
  assert.equal(result.publicResources,18);
  assert.equal(result.prohibitedInternalPaths,INTERNAL_SOURCE_PATHS.length);
  assert.equal(result.apiGuards,6);
  assert.equal(mock.calls.length,2*(18+INTERNAL_SOURCE_PATHS.length)+6);
  assert.ok(mock.calls.every(x=>new URL(x.url).origin===
    'https://wayfarer-world-travel.vercel.app'),
  'All audit requests must remain on the fixed production origin');
  assert.equal(result.deploymentCommitVerified,false);
  assert.equal(result.productionReleaseAuthorized,false);
});
test('GET exposure is rejected even when HEAD hides the source',async()=>{
  const mock=simulated({exposed:'/server.mjs'});
  await assert.rejects(verifyProductionSurface({transport:mock.transport}),
    /Internal file exposed: GET \/server.mjs/);
});
test('missing static asset or incorrect content type blocks release',async()=>{
  for(const settings of [
    {missing:'/premium-base.css'},{wrongMime:'/premium-app.js'}
  ]){
    const mock=simulated(settings);
    await assert.rejects(verifyProductionSurface({transport:mock.transport}),
      /Missing public asset|Unexpected Content-Type/);
  }
});
test('a missing serverless API function blocks release',async()=>{
  const mock=simulated({brokenApi:'/api/intelligence'});
  await assert.rejects(verifyProductionSurface({transport:mock.transport}),
    /API handler not safely responding/);
});
test('rejected API requests may never be edge cacheable',async()=>{
  const mock=simulated({wrongCache:'/api/travel-search'});
  await assert.rejects(verifyProductionSurface({transport:mock.transport}),
    /Rejected API request cacheable/);
});
test('mismatched production Content Security Policy blocks release',async()=>{
  const mock=simulated({badCsp:true});
  await assert.rejects(verifyProductionSurface({transport:mock.transport}),
    /missing\/changed content-security-policy/);
});
test('no redirects are followed and network errors block rather than pass',async()=>{
  const mock=simulated({redirect:'/server.mjs'});
  await assert.rejects(verifyProductionSurface({transport:mock.transport}),
    /Request failed or redirected/);
});

test('legacy documentation and n8n workflow disclosure fails production release gate',async()=>{
  for(const exposed of ['/n8n/wayfarer-groq-agents.json',
    '/docs/premium/QA-RESULTS.md','/tests/ai.test.mjs',
    '/.github/workflows/daily-airports.yml']){
    const mock=simulated({exposed});
    await assert.rejects(verifyProductionSurface({transport:mock.transport}),
      /Internal file exposed: GET/);
  }
});
test('historical denylist is distinct from public asset manifest and API routes',()=>{
  assert.ok(INTERNAL_SOURCE_PATHS.length>=60);
  assert.equal(new Set(INTERNAL_SOURCE_PATHS).size,INTERNAL_SOURCE_PATHS.length);
  for(const path of INTERNAL_SOURCE_PATHS){
    assert.ok(!PUBLIC_ASSETS.includes(path.slice(1)));
    assert.ok(!path.startsWith('/api/'));
  }
});
