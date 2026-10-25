import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_ASSETS} from '../static-asset-manifest.mjs';
import {INTERNAL_SOURCE_PATHS} from '../internal-source-denylist.mjs';
import {verifyStagedHttpSurface} from '../scripts/verify-staged-http.mjs';
import {verifyProductionSurface} from '../scripts/verify-production-http.mjs';

const host='wayfarer-world-travel-a1b2c3-teldigi5-wq.vercel.app';
const origin='https://'+host;
const bypass='synthetic-protection-bypass-not-a-secret-123';
const publicOrigin='https://wayfarer-world-travel.vercel.app';
const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const securityHeaders=Object.fromEntries(config.headers.find(x=>x.source==='/(.*)').headers
  .map(x=>[x.key.toLowerCase(),x.value]));
const types={html:'text/html',css:'text/css',js:'application/javascript',
  json:'application/json',webp:'image/webp',jpg:'image/jpeg',
  txt:'text/plain',xml:'application/xml'};
const apiStatus=new Map([
  ['/api/explore',400],['/api/intelligence',400],['/api/hotels',400],
  ['/api/ai-plan',405],['/api/travel-offers',405],['/api/travel-search',405]
]);

function mockedHttp({expectedOrigin=origin,bypassExpected=true,
  exposedSource=false,missingAsset=false,authWall=false,badSecurityHeaders=false}={}){
  const seen=[];
  const transport=async(raw,opts)=>{
    const u=new URL(raw);
    assert.equal(u.origin,expectedOrigin,'cross-origin request prohibited');
    assert.equal(opts.redirect,'error');
    assert.ok(opts.method==='HEAD'||opts.method==='GET');
    assert.ok(opts.signal,'request timeout required');
    if(opts.method==='GET')assert.equal(opts.headers.Range,'bytes=0-0');
    if(bypassExpected)assert.equal(opts.headers['x-vercel-protection-bypass'],bypass);
    else assert.equal(opts.headers['x-vercel-protection-bypass'],undefined);
    seen.push({method:opts.method,path:u.pathname});
    if(authWall)return new Response(null,{status:401});
    let status,contentType;
    if(INTERNAL_SOURCE_PATHS.includes(u.pathname)){
      status=exposedSource&&u.pathname==='/server.mjs'&&opts.method==='GET'?200:404;
      contentType='application/javascript';
    }else if(u.pathname==='/'||PUBLIC_ASSETS.includes(u.pathname.slice(1))){
      status=missingAsset&&u.pathname==='/premium-base.css'?404:200;
      const ext=(u.pathname==='/'?'index.html':u.pathname.slice(1)).split('.').at(-1);
      contentType=types[ext];
    }else if(apiStatus.has(u.pathname)){
      status=apiStatus.get(u.pathname);
      contentType='application/json';
    }else{
      throw Error('Unexpected URL in test: '+u.pathname);
    }
    const headers={'content-type':contentType};
    if(u.pathname==='/'){
      Object.assign(headers,securityHeaders);
      headers['strict-transport-security']='max-age=63072000; includeSubDomains';
      if(badSecurityHeaders)headers['content-security-policy']='default-src *';
    }
    if(apiStatus.has(u.pathname)){
      headers['cache-control']='no-store';
      if(status===405)headers.allow='POST';
    }
    return new Response(null,{status,headers});
  };
  return {transport,seen};
}

test('staged audit covers all internal HEAD/GET paths, browser assets and 6 nonbillable API guards',async()=>{
  const mock=mockedHttp();
  const r=await verifyStagedHttpSurface({deploymentUrl:origin,bypassSecret:bypass,transport:mock.transport});
  assert.equal(r.status,'STAGED_HTTP_SURFACE_PASS_ONLY');
  assert.equal(r.origin,origin);
  assert.equal(r.protectionBypassUsed,true);
  assert.equal(r.requests,2*(INTERNAL_SOURCE_PATHS.length+PUBLIC_ASSETS.length+1)+6);
  assert.equal(r.prohibitedInternalPaths,INTERNAL_SOURCE_PATHS.length);
  assert.equal(r.apiGuards,6);
  assert.equal(r.productionPromotionAuthorized,false);
  assert.equal(r.realBrowserJourneysVerified,false);
  assert.ok(mock.seen.some(x=>x.method==='GET'&&x.path==='/server.mjs'));
  assert.ok(mock.seen.some(x=>x.method==='HEAD'&&x.path==='/premium-app.js'));
  assert.ok(mock.seen.some(x=>x.method==='GET'&&x.path==='/api/ai-plan'));
});

test('staged audit never sends a bypass secret unless configured',async()=>{
  const mock=mockedHttp({bypassExpected:false});
  const r=await verifyStagedHttpSurface({deploymentUrl:origin,transport:mock.transport});
  assert.equal(r.protectionBypassUsed,false);
});

test('rejects public alias, wrong scheme, query and lookalike host before any request',async()=>{
  for(const deploymentUrl of [
    publicOrigin,'http://'+host,origin+'/?x=1',
    'https://wayfarer-world-travel-a1b2c3-teldigi5-wq.vercel.app.evil.test/',
    origin+'#bad'
  ]){
    let calls=0;
    await assert.rejects(verifyStagedHttpSurface({deploymentUrl,bypassSecret:bypass,
      transport:async()=>{calls++;throw Error('network must not run')}}),/BLOCKED/);
    assert.equal(calls,0);
  }
});

test('detects leaked internal source, missing browser asset and deployment protection wall',async()=>{
  for(const key of ['exposedSource','missingAsset','authWall']){
    const mock=mockedHttp({[key]:true});
    await assert.rejects(verifyStagedHttpSurface({
      deploymentUrl:origin,bypassSecret:bypass,transport:mock.transport
    }),/expected HTTP|wrong HTTP/);
  }
});

test('missing or modified security headers block stage even when asset responses are HTTP 200',async()=>{
  const mock=mockedHttp({badSecurityHeaders:true});
  await assert.rejects(verifyStagedHttpSurface({
    deploymentUrl:origin,bypassSecret:bypass,transport:mock.transport
  }),/missing\/changed content-security-policy/);
});

test('network failures cannot expose bypass secret and do not pass',async()=>{
  await assert.rejects(verifyStagedHttpSurface({
    deploymentUrl:origin,bypassSecret:bypass,transport:async()=>{throw Error('secret: '+bypass)}
  }),e=>{assert.doesNotMatch(String(e),/synthetic-protection-bypass/);
    assert.match(String(e),/Request failed or redirected/);return true});
});

test('short bypass credential fails before issuing requests',async()=>{
  let calls=0;
  await assert.rejects(verifyStagedHttpSurface({
    deploymentUrl:origin,bypassSecret:'short',
    transport:async()=>{calls++;throw Error('should not run')}
  }),/BLOCKED/);
  assert.equal(calls,0);
});

test('existing public production entrypoint remains hard-pinned after HTTP verifier refactor',async()=>{
  const mock=mockedHttp({expectedOrigin:publicOrigin,bypassExpected:false});
  const r=await verifyProductionSurface({transport:mock.transport});
  assert.equal(r.origin,publicOrigin);
  assert.equal(r.productionReleaseAuthorized,false);
});

test('manual stage audits exact staged URL after identity gate and before success summary',()=>{
  const w=readFileSync(new URL('../.github/workflows/stage-production-no-domain.yml',import.meta.url),'utf8');
  const identity=w.indexOf('run: node scripts/check-staged-deployment.mjs');
  const http=w.indexOf('run: node scripts/verify-staged-http.mjs');
  const alias=w.indexOf('name: Prove public alias assignments did not change after staging attempt');
  const summary=w.indexOf('name: Record only the staged URL and remaining release gate');
  assert.ok(identity>=0&&http>identity&&alias>http&&summary>alias);
  assert.ok(w.includes('VERCEL_AUTOMATION_BYPASS_SECRET: '+String.fromCharCode(36)+'{{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}'));
  assert.ok(w.includes("always() && steps.deploy.outcome != 'skipped'"));
  assert.match(w,/vercel deploy --prebuilt --prod --skip-domain/);
  assert.match(w,/workflow_dispatch:/);
  assert.doesNotMatch(w,/^\s+push:\s*$/m);
});


test('one transient 403 on a denied internal GET is retried, then strict 404 succeeds',async()=>{
  const mock=mockedHttp();
  let attempts=0;
  const transport=async(url,opts)=>{
    if(new URL(url).pathname==='/.gitignore'&&opts.method==='GET'){
      attempts++;
      if(attempts===1)return new Response(null,{status:403});
    }
    return mock.transport(url,opts);
  };
  const result=await verifyStagedHttpSurface({deploymentUrl:origin,
    bypassSecret:bypass,transport});
  assert.equal(attempts,2);
  assert.equal(result.transientAccessDenialsRetried,1);
  assert.equal(result.productionPromotionAuthorized,false);
  assert.match(result.warning,/transient edge denials/);
});

test('one transient 429 on an internal GET is retried then strict 404 succeeds',async()=>{
  const mock=mockedHttp();
  let attempts=0;
  const transport=async(url,opts)=>{
    if(new URL(url).pathname==='/vercel.json'&&opts.method==='GET'&&++attempts===1){
      return new Response(null,{status:429});
    }
    return mock.transport(url,opts);
  };
  const result=await verifyStagedHttpSurface({deploymentUrl:origin,
    bypassSecret:bypass,transport});
  assert.equal(attempts,2);
  assert.equal(result.transientAccessDenialsRetried,1);
});

test('persistent 403 on sensitive internal GET still fails after only one retry',async()=>{
  const mock=mockedHttp();
  let attempts=0;
  const transport=async(url,opts)=>{
    if(new URL(url).pathname==='/vercel.json'&&opts.method==='GET'){
      attempts++;
      return new Response(null,{status:403});
    }
    return mock.transport(url,opts);
  };
  await assert.rejects(verifyStagedHttpSurface({deploymentUrl:origin,
    bypassSecret:bypass,transport}),err=>{
      assert.match(String(err.message),/GET \/vercel\.json expected HTTP 404; received HTTP 403/);
      assert.doesNotMatch(String(err.message),/synthetic-protection-bypass/);
      return true;
    });
  assert.equal(attempts,2,'Retry must be strictly bounded');
});

test('HTTP 200 source exposure is never retried or converted into a pass',async()=>{
  const mock=mockedHttp();
  let attempts=0;
  const transport=async(url,opts)=>{
    if(new URL(url).pathname==='/server.mjs'&&opts.method==='GET'){
      attempts++;
      return new Response(null,{status:200});
    }
    return mock.transport(url,opts);
  };
  await assert.rejects(verifyStagedHttpSurface({deploymentUrl:origin,
    bypassSecret:bypass,transport}),/GET \/server\.mjs expected HTTP 404; received HTTP 200/);
  assert.equal(attempts,1);
});

test('HTTP rate-limit retry cannot turn a denied API or POST into a paid call',async()=>{
  const mock=mockedHttp();
  let calls=0;
  const transport=async(url,opts)=>{
    if(new URL(url).pathname==='/api/travel-offers'){
      calls++;
      return new Response(null,{status:403});
    }
    return mock.transport(url,opts);
  };
  await assert.rejects(verifyStagedHttpSurface({deploymentUrl:origin,
    bypassSecret:bypass,transport}),/API handler not safely responding.*received HTTP 403/);
  assert.equal(calls,1,'No retries for API endpoints');
});

test('live pacing is present only on the immutable-host staged HTTP adapter',()=>{
  const source=readFileSync(new URL('../scripts/verify-staged-http.mjs',import.meta.url),'utf8');
  assert.match(source,/const liveNetwork=transport===fetch/);
  assert.match(source,/await pause\(250\)/);
  assert.match(source,/await pause\(2000\)/);
  assert.match(source,/accessDeniedRetries\+\+/);
  assert.match(source,/request\.origin!==origin/);
  assert.match(source,/request\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(source,/redirect:'error'/);
  assert.doesNotMatch(source,/continue-on-error|vercel deploy/);
});
