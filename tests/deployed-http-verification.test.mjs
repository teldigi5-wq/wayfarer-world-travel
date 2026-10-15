import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectDeployment,validateDeploymentUrl,STATIC_POSITIVE_PATHS,
 STATIC_DENIED_PATHS} from '../scripts/verify-vercel-static.mjs';

const headers={
 'content-security-policy':"default-src 'self'; script-src 'self'; frame-ancestors 'none'; object-src 'none'",
 'x-content-type-options':'nosniff',
 'x-frame-options':'DENY',
 'referrer-policy':'strict-origin-when-cross-origin',
 'strict-transport-security':'max-age=31536000'
};
const url='https://wayfarer-world-travel-git-smoke-teldigi5-wq.vercel.app/';
const knownPaths=[...STATIC_POSITIVE_PATHS,...STATIC_DENIED_PATHS];
function makeFetch({exposed=null,protect=false,noHeader=null,badMime=null,offline=false}={}){
 const calls=[];
 const call=async(input,opts)=>{
   const target=new URL(input);
   calls.push({url:target.href,path:target.pathname,method:opts.method,
     redirects:opts.redirect,credentials:opts.credentials,cache:opts.cache,headers:opts.headers});
   if(offline)throw Error('Synthetic network outage');
   const isPublic=STATIC_POSITIVE_PATHS.includes(target.pathname);
   const status=protect?401:exposed===target.pathname?200:isPublic?200:404;
   const mime=badMime===target.pathname?'text/html':
     target.pathname.endsWith('.js')?'text/javascript':
     target.pathname.endsWith('.svg')?'image/svg+xml':
     target.pathname.endsWith('.json')?'application/json':'text/html';
   const values={
     ...headers,
     'content-type':status===200?mime:'text/plain',
   };
   if(noHeader)delete values[noHeader];
   return new Response(null,{status,headers:values});
 };
 return {call,calls};
}
test('accept only explicitly identified HTTPS Wayfarer Vercel origins; refuse query, passwords and untrusted domains',()=>{
 assert.equal(validateDeploymentUrl(url),url.slice(0,-1));
 assert.equal(validateDeploymentUrl('https://wayfarer-world-travel.vercel.app/'),
   'https://wayfarer-world-travel.vercel.app');
 for(const evil of [
  'http://wayfarer-world-travel.vercel.app/',
  'https://wayfarer-world-travel.vercel.app.evil.example/',
  'https://evil.example/',
  'https://wayfarer-world-travel.vercel.app@evil.example/',
  'https://user:pw@wayfarer-world-travel.vercel.app/',
  'https://wayfarer-world-travel.vercel.app/package.json',
  'https://wayfarer-world-travel.vercel.app/?token=abc',
  'https://wayfarer-world-travel.vercel.app/#fragment',
  'https://wayfarer-world-travel.vercel.app:8443/',
  'file:///etc/passwd',
  'http://127.0.0.1:4173/'
 ])assert.throws(()=>validateDeploymentUrl(evil),undefined,evil);
});
test('good simulated static deployment yields only limited static HTTP result, never commit or API certification',async()=>{
 const f=makeFetch();
 const data=await inspectDeployment({url,fetchFn:f.call});
 assert.equal(data.verdict,'STATIC_HTTP_PASS_ONLY');
 assert.equal(data.counts.staticPassed,data.counts.staticTotal);
 assert.equal(data.counts.privateDenied,data.counts.privateTotal);
 assert.equal(data.counts.requiredHeadersPassed,data.counts.requiredHeadersTotal);
 assert.equal(data.exactCommitVerified,false);
 assert.equal(data.serverlessApiVerified,false);
 assert.equal(data.browserBehaviorVerified,false);
 assert.equal(data.productionApproval,false);
 assert.equal(f.calls.length,knownPaths.length);
 assert.deepEqual(f.calls.map(x=>x.path),knownPaths);
 assert.ok(f.calls.every(x=>x.method==='HEAD'&&x.redirects==='error'&&
   x.credentials==='omit'&&x.cache==='no-store'&&!x.headers));
 assert.ok(f.calls.every(x=>!x.path.startsWith('/api/')),
   'No AI, SerpApi, Duffel, booking or public source API endpoint gets called');
});
test('a publicly accessible implementation file is always a release failure without reading its contents',async()=>{
 const f=makeFetch({exposed:'/package.json'});
 const data=await inspectDeployment({url,fetchFn:f.call});
 assert.equal(data.verdict,'FAIL');
 assert.equal(data.probes.find(x=>x.path==='/package.json').result,'FAIL');
 assert.equal(JSON.stringify(data).includes('private-provider-key'),false);
});
test('a deployment auth wall does not masquerade as proof of missing confidential source files',async()=>{
 const f=makeFetch({protect:true});
 const data=await inspectDeployment({url,fetchFn:f.call});
 assert.equal(data.verdict,'INCONCLUSIVE_PROTECTED');
 assert.ok(data.probes.every(x=>x.result==='INCONCLUSIVE'));
 assert.equal(data.counts.privateDenied,0);
});
test('missing security headers or incorrect content type fails while preserving no-secret report shape',async()=>{
 const f=makeFetch({noHeader:'content-security-policy'});
 const data=await inspectDeployment({url,fetchFn:f.call});
 assert.equal(data.verdict,'FAIL');
 assert.ok(data.headers.some(x=>!x.pass));
 const bad=await inspectDeployment({url,fetchFn:makeFetch({badMime:'/data.json'}).call});
 assert.equal(bad.verdict,'FAIL');
 assert.equal(bad.probes.find(x=>x.path==='/data.json').result,'FAIL');
});
test('outage or redirect rejection is reported inconclusively, never treated as a passed exposure check',async()=>{
 const data=await inspectDeployment({url,fetchFn:makeFetch({offline:true}).call});
 assert.equal(data.verdict,'FAIL');
 assert.ok(data.probes.every(x=>x.result==='INCONCLUSIVE_NETWORK'));
 assert.equal(data.counts.staticPassed,0);
 assert.equal(data.counts.privateDenied,0);
});
test('inspector never calls paid-provider paths or writes credentials into any HTTP request',()=>{
 const source=readFileSync(new URL('../scripts/verify-vercel-static.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\/api\/ai-plan|\/api\/travel-offers|\/api\/travel-search|\/api\/intelligence|\/api\/airline-offers|Authorization\s*:/);
 assert.match(source,/method:'HEAD',redirect:'error'/);
 assert.match(source,/exactCommitVerified:false,serverlessApiVerified:false/);
 assert.doesNotMatch(source,/fetch\(.*method:\s*'POST'|deploy\s*\(/);
});
