// Independent, opt-in, read-only audit of Wayfarer's PUBLIC production alias.
// Never use a Preview URL here: a protected Preview could hide source exposure.
// No POST, provider searches, cookies, credentials, redirects, or response-body reads.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PUBLIC_ASSETS} from '../static-asset-manifest.mjs';

const PRODUCTION_ORIGIN='https://wayfarer-world-travel.vercel.app';
const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const securityHeaders=Object.fromEntries(
  config.headers.find(rule=>rule.source==='/(.*)').headers
    .map(header=>[header.key.toLowerCase(),header.value])
);
const contentTypes=Object.freeze({
  html:/^text\/html(?:;|$)/, css:/^text\/css(?:;|$)/,
  js:/^(?:application|text)\/javascript(?:;|$)/,
  json:/^application\/json(?:;|$)/,
  webp:/^image\/webp(?:;|$)/, jpg:/^image\/jpeg(?:;|$)/,
  txt:/^text\/plain(?:;|$)/, xml:/^(?:application|text)\/xml(?:;|$)/
});
const privatePaths=Object.freeze([
  '/server.mjs','/tests/security-static-output.test.mjs',
  '/tests/security-explore-cache-policy.test.mjs',
  '/scripts/preview-http-smoke.mjs','/scripts/stage-public-assets.mjs',
  '/.github/workflows/checks.yml','/docs/release-security-preflight.md',
  '/docs/static-output-release-gate.md','/package.json','/vercel.json',
  '/.env','/.git/config','/static-asset-manifest.mjs',
  '/provider-production-lock.mjs'
]);
const invalidApiPaths=Object.freeze([
  {path:'/api/explore?mode=nearby&lat=%20&lon=0',status:400},
  {path:'/api/intelligence?destination=Unlisted&lat=invalid',status:400},
  {path:'/api/hotels',status:400},
  {path:'/api/ai-plan',status:405,allow:'POST'},
  {path:'/api/travel-offers',status:405,allow:'POST'},
  {path:'/api/travel-search',status:405,allow:'POST'}
]);

async function probe(transport,path,method){
  const options={
    method,redirect:'error',signal:AbortSignal.timeout(10000),
    headers:method==='GET'?{'Range':'bytes=0-0','Accept':'*/*'}:{'Accept':'*/*'}
  };
  try{
    return await transport(PRODUCTION_ORIGIN+path,options);
  }catch{
    throw Error('Request failed or redirected: '+method+' '+path);
  }
}
async function discard(response){
  if(response.body&&typeof response.body.cancel==='function'){
    await response.body.cancel().catch(()=>{});
  }
}
function expectStatus(response,status,label,allowPartial=false){
  if(allowPartial){
    assert.ok(response.status===status||response.status===206,
      label+' expected HTTP '+status+' or 206, received '+response.status);
  }else{
    assert.equal(response.status,status,label+' wrong HTTP status');
  }
}
function expectSecurityHeaders(response,label){
  for(const [key,value] of Object.entries(securityHeaders)){
    assert.equal(response.headers.get(key),value,label+' missing/changed '+key);
  }
  const hsts=response.headers.get('strict-transport-security')||'';
  const age=/\bmax-age=(\d+)/i.exec(hsts);
  assert.ok(age&&Number(age[1])>=31536000,label+' HSTS missing or too short');
}
function expectType(response,name){
  const extension=name.split('.').at(-1);
  const expected=contentTypes[extension];
  assert.ok(expected,'Unreviewed file extension in static manifest: '+name);
  assert.match(response.headers.get('content-type')||'',expected,
    'Unexpected Content-Type for '+name);
}

export async function verifyProductionSurface({transport=fetch}={}){
  assert.equal(typeof transport,'function','A fetch-compatible transport is required');
  assert.equal(new Set(PUBLIC_ASSETS).size,PUBLIC_ASSETS.length,
    'Public manifest contains duplicates');
  assert.ok(PUBLIC_ASSETS.length>=12,'Public manifest unexpectedly small');
  // Check internal source paths first: a single successful source response is a NO-GO.
  for(const path of privatePaths){
    for(const method of ['HEAD','GET']){
      const response=await probe(transport,path,method);
      try{expectStatus(response,404,'Internal file exposed: '+method+' '+path);}
      finally{await discard(response);}
    }
  }
  for(const path of ['/',...PUBLIC_ASSETS.map(name=>'/'+name)]){
    for(const method of ['HEAD','GET']){
      const response=await probe(transport,path,method);
      try{
        expectStatus(response,200,'Missing public asset: '+method+' '+path,method==='GET');
        expectType(response,path==='/'?'index.html':path.slice(1));
        if(path==='/')expectSecurityHeaders(response,'Homepage '+method);
      }finally{await discard(response);}
    }
  }
  // These deliberately invalid inputs must be rejected before provider calls.
  // Never send a valid search, paid provider request, POST or beta credentials.
  for(const {path,status,allow} of invalidApiPaths){
    const response=await probe(transport,path,'GET');
    try{
      expectStatus(response,status,'API handler not safely responding: '+path);
      assert.match(response.headers.get('content-type')||'',contentTypes.json,
        'API did not return JSON: '+path);
      assert.equal(response.headers.get('cache-control'),'no-store',
        'Rejected API request cacheable: '+path);
      if(allow)assert.equal(response.headers.get('allow'),allow,
        'Incorrect allowed method on '+path);
    }finally{await discard(response);}
  }
  return {
    status:'PRODUCTION_HTTP_SURFACE_PASS_ONLY',
    origin:PRODUCTION_ORIGIN,
    publicResources:1+PUBLIC_ASSETS.length,
    prohibitedInternalPaths:privatePaths.length,
    apiGuards:invalidApiPaths.length,
    methods:['HEAD','GET'],
    requests:2*(1+PUBLIC_ASSETS.length+privatePaths.length)+invalidApiPaths.length,
    checksPassed:true,
    deploymentCommitVerified:false,
    productionBrowserJourneyVerified:false,
    productionReleaseAuthorized:false,
    warning:'HTTP surface only. Independently verify live deployment identity, full journeys, performance and rollback.'
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.env.WAYFARER_PRODUCTION_AUDIT!=='I_ACKNOWLEDGE_READ_ONLY'){
    console.error('PRODUCTION_AUDIT_BLOCKED: explicit read-only opt-in required');
    process.exitCode=2;
  }else{
    try{
      const report=await verifyProductionSurface();
      console.log('WAYFARER_PRODUCTION_HTTP_AUDIT '+JSON.stringify(report));
    }catch(error){
      // Do not print response bodies, authorization values or provider results.
      console.error('PRODUCTION_AUDIT_FAILED '+String(error?.message||'Unknown verification error'));
      process.exitCode=1;
    }
  }
}
