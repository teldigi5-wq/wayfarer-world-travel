import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewSmoke,previewOrigin} from '../scripts/preview-http-smoke.mjs';

const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const headers=Object.fromEntries(config.headers.find(h=>h.source==='/(.*)').headers.map(h=>[h.key,h.value]));
const target='https://wayfarer-world-travel-6atilophd-teldigi5-wq.vercel.app';
const token='fake-local-test-token-that-is-not-real';

const response=(body,status,extra={})=>new Response(body,{
  status,headers:{...extra}
});
const fakeWebP=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),
  Buffer.from('WEBP'),Buffer.alloc(150000)]);
function mocked({deny=false}={}){
  const visited=[];
  async function fetcher(url,options){
    visited.push({url,options});
    if(deny)return response('Vercel Authentication',401);
    const path=new URL(url).pathname;
    if(path==='/')return response('<!doctype html><title>Wayfarer</title><img class="hero-media">',
      200,{'Content-Type':'text/html; charset=utf-8',...headers});
    if(path==='/wayfarer-hero-v3.webp')return response(fakeWebP,200,{'Content-Type':'image/webp'});
    if(path==='/api/explore')return response(JSON.stringify({ok:false,error:'Invalid coordinates'}),
      400,{'Content-Type':'application/json','Cache-Control':'no-store'});
    if(['/api/ai-plan','/api/travel-offers','/api/travel-search'].includes(path))
      return response(JSON.stringify({ok:false}),405,{'Content-Type':'application/json','Allow':'POST'});
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
test('authenticated preview smoke checks headers, hero, validation and safe method rejections only',async()=>{
  const mock=mocked();
  const report=await previewSmoke({url:target,oidcToken:token,transport:mock.fetcher});
  assert.equal(report.checks.length,9);
  assert.equal(mock.visited.length,6);
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
