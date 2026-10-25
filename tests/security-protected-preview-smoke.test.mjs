import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewSmoke,previewOrigin} from '../scripts/preview-http-smoke.mjs';
import {PUBLIC_ASSETS} from '../static-asset-manifest.mjs';
import {INTERNAL_SOURCE_PATHS} from '../internal-source-denylist.mjs';

const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const headers=Object.fromEntries(config.headers.find(h=>h.source==='/(.*)').headers.map(h=>[h.key,h.value]));
const target='https://wayfarer-world-travel-6atilophd-teldigi5-wq.vercel.app';
const token='fake-local-test-token-that-is-not-real';

const response=(body,status,extra={})=>new Response(body,{
  status,headers:{...extra}
});
const fakeWebP=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),
  Buffer.from('WEBP'),Buffer.alloc(150000)]);
function mocked({deny=false,missingPath=null,exposedPath=null,cacheOverridePath=null}={}){
  const visited=[];
  async function fetcher(url,options){
    visited.push({url,options});
    if(deny)return response('Vercel Authentication',401);
    const path=new URL(url).pathname;
    if(path===missingPath)return response('Not Found',404,{'Content-Type':'text/plain'});
    if(path===exposedPath)return response('INTERNAL_SOURCE',200,{'Content-Type':'text/plain'});
    if(path==='/')return response('<!doctype html><title>Wayfarer</title><img class="hero-media">',
      200,{'Content-Type':'text/html; charset=utf-8',...headers});
    if(path==='/wayfarer-hero-v3.webp')return response(fakeWebP,200,{'Content-Type':'image/webp'});
    if(PUBLIC_ASSETS.includes(path.slice(1))){
      const extension=path.split('.').at(-1);
      const types={html:'text/html',css:'text/css',js:'application/javascript',
        json:'application/json',jpg:'image/jpeg',txt:'text/plain',xml:'application/xml'};
      return response('example browser asset',200,{'Content-Type':types[extension]});
    }
    if(path==='/api/explore')return response(JSON.stringify({ok:false,error:'Invalid coordinates'}),
      400,{'Content-Type':'application/json','Cache-Control':
        path===cacheOverridePath?'public':'no-store'});
    if(['/api/intelligence','/api/hotels'].includes(path))
      return response(JSON.stringify({ok:false,error:'Invalid input'}),400,
        {'Content-Type':'application/json','Cache-Control':
          path===cacheOverridePath?'public':'no-store'});
    if(['/api/ai-plan','/api/travel-offers','/api/travel-search'].includes(path))
      return response(JSON.stringify({ok:false}),405,{'Content-Type':'application/json',
        'Allow':'POST','Cache-Control':path===cacheOverridePath?'public':'no-store'});
    if(INTERNAL_SOURCE_PATHS.includes(path))
      return response('Not Found',404,{'Content-Type':'text/plain'});
    throw Error('Unexpected outbound request');
  }
  return {visited,fetcher};
}
test('short-lived authorization is never sent to untrusted origins or redirects',()=>{
  const rejected=[
    'http://wayfarer-world-travel-6atilophd-teldigi5-wq.vercel.app',
    'https://wayfarer-world-travel.vercel.app',
    'https://evil.example/',
    'https://wayfarer-world-travel-6atilophd-teldigi5-wq.vercel.app.evil.example/',
    'https://someone@wayfarer-world-travel-6atilophd-teldigi5-wq.vercel.app/',
    target+'/api/path',
    target+'/?redirect=https://evil.example',
  ];
  for(const url of rejected)assert.throws(()=>previewOrigin(url));
  assert.equal(previewOrigin(target),target);
});
test('authenticated preview checks the full manifest, six API guards and internal paths',async()=>{
  const mock=mocked();
  const report=await previewSmoke({url:target,oidcToken:token,transport:mock.fetcher});
  assert.equal(report.checks.length,27+INTERNAL_SOURCE_PATHS.length);
  assert.equal(mock.visited.length,24+INTERNAL_SOURCE_PATHS.length);
  assert.ok(mock.visited.every(v=>v.options.method==='GET'&&v.options.redirect==='error'));
  assert.ok(mock.visited.every(v=>v.url.startsWith(target+'/')));
  assert.ok(mock.visited.every(v=>v.options.headers['x-vercel-trusted-oidc-idp-token']===token));
  assert.ok(!JSON.stringify(report).includes(token),'Reports must never log credentials');
  assert.ok(!mock.visited.some(v=>v.url.includes('serpapi.com')||v.url.includes('groq.com')));
});
test('missing OIDC or an authentication wall fails rather than reporting success',async()=>{
  const mock=mocked();
  await assert.rejects(previewSmoke({url:target,oidcToken:'',transport:mock.fetcher}),/token/);
  assert.equal(mock.visited.length,0);
  await assert.rejects(previewSmoke({url:target,oidcToken:token,transport:mocked({deny:true}).fetcher}),
    /unexpected HTTP status/);
});
test('unexpected security headers fail the release gate',async()=>{
  const mock=mocked();
  const transport=async(url,options)=>{
    const res=await mock.fetcher(url,options);
    if(new URL(url).pathname==='/'){
      const changed=new Headers(res.headers);
      changed.delete('Content-Security-Policy');
      return response(await res.text(),200,Object.fromEntries(changed));
    }
    return res;
  };
  await assert.rejects(previewSmoke({url:target,oidcToken:token,transport}),/security header/);
});

test('a missing browser asset or missing function prevents release approval',async()=>{
  for(const missingPath of ['/premium-base.css','/api/intelligence']){
    const mock=mocked({missingPath});
    await assert.rejects(
      previewSmoke({url:target,oidcToken:token,transport:mock.fetcher}),
      /unexpected HTTP status/
    );
  }
});
test('a published internal module fails the protected-preview gate',async()=>{
  const mock=mocked({exposedPath:'/server.mjs'});
  await assert.rejects(previewSmoke({url:target,oidcToken:token,transport:mock.fetcher}),
    /internal static file not published/);
});
test('rejected methods and invalid API inputs must not be cacheable',async()=>{
  for(const cacheOverridePath of ['/api/intelligence','/api/ai-plan']){
    const mock=mocked({cacheOverridePath});
    await assert.rejects(
      previewSmoke({url:target,oidcToken:token,transport:mock.fetcher}),
      /must not be edge cached/
    );
  }
});

test('a legacy n8n workflow or historical private document blocks promotion',async()=>{
  for(const exposedPath of ['/n8n/wayfarer-groq-agents.json',
    '/docs/premium/QA-RESULTS.md','/tests/n8n.test.mjs']){
    const mock=mocked({exposedPath});
    await assert.rejects(
      previewSmoke({url:target,oidcToken:token,transport:mock.fetcher}),
      /internal static file not published/
    );
  }
});
