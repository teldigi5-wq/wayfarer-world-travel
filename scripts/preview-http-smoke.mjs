// Explicit, read-only release smoke for an AUTHORIZED protected Wayfarer preview.
// Run only with a short-lived same-project Vercel development OIDC token.
// No secrets are recorded, and redirects cannot forward authentication headers.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PUBLIC_ASSETS} from '../static-asset-manifest.mjs';

const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const expectedAssetTypes=Object.freeze({
  html:/^text\/html(?:;|$)/, css:/^text\/css(?:;|$)/,
  js:/^(?:application|text)\/javascript(?:;|$)/,
  json:/^application\/json(?:;|$)/, webp:/^image\/webp(?:;|$)/,
  jpg:/^image\/jpeg(?:;|$)/, txt:/^text\/plain(?:;|$)/,
  xml:/^(?:application|text)\/xml(?:;|$)/
});
const internalFiles=Object.freeze([
  '/server.mjs','/tests/security-static-output.test.mjs',
  '/tests/security-explore-cache-policy.test.mjs',
  '/scripts/preview-http-smoke.mjs','/scripts/stage-public-assets.mjs',
  '/.github/workflows/checks.yml','/docs/release-security-preflight.md',
  '/docs/static-output-release-gate.md','/package.json','/vercel.json',
  '/.env','/.git/config','/static-asset-manifest.mjs',
  '/provider-production-lock.mjs'
]);
const sharedHeaders=Object.fromEntries(config.headers
  .find(rule=>rule.source==='/(.*)').headers
  .map(entry=>[entry.key.toLowerCase(),entry.value]));

export function previewOrigin(input){
  if(typeof input!=='string')throw Error('A specific preview URL is required');
  let url;
  try{url=new URL(input)}catch{throw Error('Invalid preview URL')}
  // The token must not be forwarded to another project, domain or public alias.
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||
    url.search||url.hash||
    !/^wayfarer-world-travel-[a-z0-9]+-teldigi5-wq\.vercel\.app$/.test(url.hostname)){
    throw Error('Expected an immutable, same-team Wayfarer preview hostname');
  }
  return url.origin;
}

export async function previewSmoke({url,oidcToken,transport=fetch}){
  const origin=previewOrigin(url);
  if(typeof oidcToken!=='string'||oidcToken.trim().length<16)
    throw Error('A short-lived Vercel development OIDC token is required');
  const checks=[];
  const get=async (path,{method='GET'}={})=>{
    const response=await transport(origin+path,{
      method,redirect:'error',
      signal:AbortSignal.timeout(12000),
      headers:{'x-vercel-trusted-oidc-idp-token':oidcToken,'Accept':'*/*'}
    });
    return response;
  };
  const assertCode=(response,code,label)=>{
    assert.equal(response.status,code,label+' unexpected HTTP status');
    checks.push({check:label,status:response.status,result:'pass'});
  };

  const home=await get('/');
  assertCode(home,200,'landing page');
  assert.match(home.headers.get('content-type')||'',/^text\/html/,'HTML content type');
  const html=await home.text();
  assert.ok(html.includes('class="hero-media"')&&html.includes('<title>Wayfarer'),
    'Unexpected HTML response (possibly a protection/login page)');
  for(const [key,value] of Object.entries(sharedHeaders)){
    assert.equal(home.headers.get(key),value,'Missing/changed security header: '+key);
  }
  checks.push({check:'configured edge security headers',result:'pass'});

  // Check the ENTIRE reviewed browser manifest against the real Vercel output,
  // rather than treating the homepage and optimized hero as proof of coverage.
  for(const name of PUBLIC_ASSETS){
    if(name==='wayfarer-hero-v3.webp')continue; // checked including magic below
    const asset=await get('/'+name);
    assertCode(asset,200,'browser asset '+name);
    const extension=name.split('.').at(-1);
    const expectedType=expectedAssetTypes[extension];
    assert.ok(expectedType,'Unknown browser asset type: '+name);
    assert.match(asset.headers.get('content-type')||'',expectedType,
      'Wrong Content-Type for '+name);
    await asset.body?.cancel();
  }

  const webp=await get('/wayfarer-hero-v3.webp');
  assertCode(webp,200,'real optimized hero');
  assert.match(webp.headers.get('content-type')||'',/^image\/webp(?:;|$)/);
  const image=Buffer.from(await webp.arrayBuffer());
  assert.equal(image.toString('ascii',0,4),'RIFF');
  assert.equal(image.toString('ascii',8,12),'WEBP');
  assert.ok(image.length>=100000&&image.length<300000,'Unexpected hero size');
  checks.push({check:'real WebP format',bytes:image.length,result:'pass'});

  const invalidGeo=await get('/api/explore?mode=nearby&lat=%20&lon=0');
  assertCode(invalidGeo,400,'invalid geographic input rejected before provider use');
  assert.equal(invalidGeo.headers.get('cache-control'),'no-store','Invalid geo must never be cached by the edge');
  checks.push({check:'invalid geographic input is not cached',result:'pass'});
  assert.equal((await invalidGeo.json()).ok,false);

  // Do not confuse a missing Vercel Function (404) with safe validation (400).
  for(const route of ['/api/intelligence?destination=Unlisted&lat=invalid',
    '/api/hotels']){
    const response=await get(route);
    assertCode(response,400,'serverless validation '+route);
    assert.match(response.headers.get('content-type')||'',/^application\/json(?:;|$)/);
    assert.equal(response.headers.get('cache-control'),'no-store',
      'Invalid API input must not be edge cached: '+route);
    await response.body?.cancel();
  }

  // Wrong HTTP method cannot initiate billing, webhook calls, or authenticated search.
  for(const route of ['/api/ai-plan','/api/travel-offers','/api/travel-search']){
    const response=await get(route);
    assertCode(response,405,'safe method rejection '+route);
    assert.equal(response.headers.get('allow'),'POST');
    assert.equal(response.headers.get('cache-control'),'no-store',
      'Rejected method must not be edge cached: '+route);
    await response.body?.cancel();
  }

  // Build output is a browser-asset allowlist. Internal implementation,
  // workflow configuration, docs and test scripts must not be static URLs.
  for(const file of internalFiles){
    const result=await get(file);
    assertCode(result,404,'internal static file not published '+file);
  }

  return {environment:'protected_preview',origin,checks,
    warning:'This does not check a signed-in browser journey, real paid providers, or production configuration.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const result=await previewSmoke({
      url:process.env.WAYFARER_PREVIEW_URL,
      oidcToken:process.env.VERCEL_OIDC_TOKEN
    });
    // Never serialize the token or HTTP request headers.
    console.log('WAYFARER_PREVIEW_SMOKE '+JSON.stringify(result));
  }catch(error){
    console.error('WAYFARER_PREVIEW_SMOKE_FAILED '+String(error?.message||error));
    process.exitCode=1;
  }
}
