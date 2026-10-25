// Independent, opt-in, read-only audit of Wayfarer's PUBLIC production alias.
// Never use a Preview URL here: a protected Preview could hide source exposure.
// No POST, provider searches, cookies, credentials, redirects, or response-body reads.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PUBLIC_ASSETS} from '../static-asset-manifest.mjs';
import {INTERNAL_SOURCE_PATHS} from '../internal-source-denylist.mjs';

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
const invalidApiPaths=Object.freeze([
  {path:'/api/explore?mode=nearby&lat=%20&lon=0',status:400},
  {path:'/api/intelligence?destination=Unlisted&lat=invalid',status:400},
  {path:'/api/hotels',status:400},
  {path:'/api/ai-plan',status:405,allow:'POST'},
  {path:'/api/travel-offers',status:405,allow:'POST'},
  {path:'/api/travel-search',status:405,allow:'POST'}
]);

async function probe(transport,origin,path,method){
  const options={
    method,redirect:'error',signal:AbortSignal.timeout(10000),
    headers:method==='GET'?{'Range':'bytes=0-0','Accept':'*/*'}:{'Accept':'*/*'}
  };
  try{
    return await transport(origin+path,options);
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
  // Fail closed, with status-only diagnostics. Never log the upstream response
  // body, header values, secrets or a raw network error. 403/429 are NOT 404.
  const observed=Number.isInteger(response?.status)&&
    response.status>=100&&response.status<=599?response.status:'invalid';
  if(observed===status||(allowPartial&&observed===206))return;
  const category=observed===401||observed===403?' (possible access protection)':
    observed===429?' (possible throttling)':observed===206&&status===404?
      ' (partial source response; treat as exposure)':'';
  throw Error(label+' expected HTTP '+status+
    (allowPartial?' or 206':'')+'; received HTTP '+observed+category);
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

export async function verifyHttpSurface({transport=fetch,origin=PRODUCTION_ORIGIN}={}){
  let parsedOrigin;
  try{parsedOrigin=new URL(origin)}catch{throw Error('Invalid HTTP audit origin')}
  assert.equal(parsedOrigin.protocol,'https:','HTTP audit requires HTTPS');
  assert.equal(parsedOrigin.origin,origin,'HTTP audit must use an exact origin');
  assert.equal(typeof transport,'function','A fetch-compatible transport is required');
  assert.equal(new Set(PUBLIC_ASSETS).size,PUBLIC_ASSETS.length,
    'Public manifest contains duplicates');
  assert.ok(PUBLIC_ASSETS.length>=12,'Public manifest unexpectedly small');
  assert.equal(new Set(INTERNAL_SOURCE_PATHS).size,INTERNAL_SOURCE_PATHS.length,
    'Internal denylist contains duplicate paths');
  assert.ok(INTERNAL_SOURCE_PATHS.length>=50,'Internal source-denylist unexpectedly small');
  for(const path of INTERNAL_SOURCE_PATHS){
    assert.ok(path.startsWith('/')&&!path.startsWith('/api/')&&
      !path.includes('?')&&!path.includes('#'),'Invalid internal path: '+path);
    assert.ok(!PUBLIC_ASSETS.includes(path.slice(1)),
      'Internal file must never be a public asset: '+path);
  }
  // Check internal source paths first: a single successful source response is a NO-GO.
  for(const path of INTERNAL_SOURCE_PATHS){
    for(const method of ['HEAD','GET']){
      const response=await probe(transport,origin,path,method);
      try{expectStatus(response,404,'Internal file exposed: '+method+' '+path);}
      finally{await discard(response);}
    }
  }
  for(const path of ['/',...PUBLIC_ASSETS.map(name=>'/'+name)]){
    for(const method of ['HEAD','GET']){
      const response=await probe(transport,origin,path,method);
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
    const response=await probe(transport,origin,path,'GET');
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
    origin,
    publicResources:1+PUBLIC_ASSETS.length,
    prohibitedInternalPaths:INTERNAL_SOURCE_PATHS.length,
    apiGuards:invalidApiPaths.length,
    methods:['HEAD','GET'],
    requests:2*(1+PUBLIC_ASSETS.length+INTERNAL_SOURCE_PATHS.length)+invalidApiPaths.length,
    checksPassed:true,
    deploymentCommitVerified:false,
    productionBrowserJourneyVerified:false,
    productionReleaseAuthorized:false,
    warning:'HTTP surface only. Independently verify live deployment identity, full journeys, performance and rollback.'
  };
}

// Public production entrypoint remains hard-pinned; callers cannot redirect the CLI audit.
export async function verifyProductionSurface({transport=fetch}={}){
  return verifyHttpSurface({transport,origin:PRODUCTION_ORIGIN});
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
