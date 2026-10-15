import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readBoundedText} from '../bounded-source-response.mjs';
import {getJson} from '../agent-runtime.mjs';
import handler from '../api/ai-plan.mjs';

function chunked(chunks){
 let index=0,cancelled=false;
 const stream=new ReadableStream({
   pull(controller){
     if(index>=chunks.length){controller.close();return;}
     controller.enqueue(new TextEncoder().encode(chunks[index++]));
   },
   cancel(){cancelled=true;}
 });
 const response=new Response(stream,{status:200});
 return {response,get cancelled(){return cancelled}};
}
const originFetch=globalThis.fetch,originEnv={
 WAYFARER_AI_ENABLED:process.env.WAYFARER_AI_ENABLED,
 WAYFARER_AI_BETA_TOKEN:process.env.WAYFARER_AI_BETA_TOKEN,
 N8N_WEBHOOK_URL:process.env.N8N_WEBHOOK_URL,
 N8N_WEBHOOK_AUTH:process.env.N8N_WEBHOOK_AUTH
};
const validTrip={country:'Japan',city:'Tokyo',origin:'Colombo',
 startDate:'2026-12-01',endDate:'2026-12-04',travelers:2,budget:1200,style:'balanced'};
function reply(){
 return {code:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v;},
 status(c){this.code=c;return this;},json(b){this.body=b;return this;}};
}
async function call(){
 const result=reply();
 await handler({method:'POST',headers:{'x-wayfarer-beta-token':'test-private-beta-code-123456'},
   body:{trip:validTrip}},result);
 return result;
}
function configure(){
 process.env.WAYFARER_AI_ENABLED='true';
 process.env.WAYFARER_AI_BETA_TOKEN='test-private-beta-code-123456';
 process.env.N8N_WEBHOOK_URL='https://automation.example.com/webhook/travel';
 process.env.N8N_WEBHOOK_AUTH='test-n8n-upstream-private-secret';
}
test('streaming text reader enforces the cap before accumulating untrusted chunks',async()=>{
 const data=chunked(['{"safe":','"value"',',"extra":"','x'.repeat(1500),'"}']);
 await assert.rejects(readBoundedText(data.response,1000),/exceeds size limit/);
 assert.equal(data.cancelled,true,'Rejected streaming content must cancel the reader');
});
test('bounded reader supports valid multi-chunk JSON, unicode and missing length headers',async()=>{
 const data=chunked(['{"city":"T','","value":',String(0),'}']);
 const text=await readBoundedText(data.response,100);
 assert.deepEqual(JSON.parse(text),{city:'T',value:0});
});
test('advertised oversized response is refused before any body read',async()=>{
 let reads=0;
 const response={
   headers:{get:()=>String(5000)},
   body:{getReader(){reads++;throw Error('Must not read stream');}},
   text(){reads++;throw Error('Must not read text');}
 };
 await assert.rejects(readBoundedText(response,10),/exceeds size limit/);
 assert.equal(reads,0);
});
test('failing a streaming public JSON response does not populate its in-memory cache',async()=>{
 let attempts=0;
 globalThis.fetch=async()=>{attempts++;
   return attempts===1?chunked(['{"x":"','q'.repeat(230),'"}']).response:
     new Response('{"ok":true}');
 };
 try{
   const url='https://example.com/large-public-response/'+Date.now();
   await assert.rejects(getJson(url,{maxBytes:100,retries:0,cacheTtlMs:60000}),/size limit/);
   assert.deepEqual(await getJson(url,{maxBytes:100,retries:0,cacheTtlMs:60000}),{ok:true});
   assert.equal(attempts,2);
 }finally{globalThis.fetch=originFetch;}
});
test('secret-bearing n8n requests refuse redirects; return sanitized 502 without leaking secrets',async()=>{
 configure();
 const requests=[];
 globalThis.fetch=async(url,opts)=>{requests.push({url,opts});
   return new Response(null,{status:302,headers:{location:'https://attacker.example/collect'}});
 };
 try{
   const result=await call();
   assert.equal(result.code,502);
   assert.equal(requests.length,1);
   assert.equal(requests[0].opts.redirect,'error');
   assert.equal(requests[0].opts.headers['X-Wayfarer-Secret'],process.env.N8N_WEBHOOK_AUTH);
   assert.doesNotMatch(JSON.stringify(result.body),/test-n8n-upstream-private-secret|attacker.example/);
   assert.equal(result.headers['Cache-Control'],'no-store');
 }finally{globalThis.fetch=originFetch;}
});
test('unannounced oversized n8n response is denied before its full AI findings enter memory',async()=>{
 configure();
 globalThis.fetch=async()=>chunked(['{"ok":true,"agents":[','"a".repeat(15000),
   '"b".repeat(15000),'end']).response;
 try{
   const result=await call();
   assert.equal(result.code,502);
   assert.equal(result.body.ok,false);
   assert.match(result.body.error,/timed out or returned an invalid response/);
 }finally{globalThis.fetch=originFetch;}
});
test('configured paid and secret-bearing upstream calls always disable auto-follow redirects',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 for(const path of ['api/ai-plan.mjs','api/intelligence.js','api/travel-offers.mjs',
   'api/travel-search.js','api/flight-selection.mjs','api/airline-offers.mjs']){
   const code=read(path);
   assert.match(code,/redirect:'error'/,path+' lacks fail-closed redirect protection');
   assert.match(code,/readBoundedText\(/,path+' lacks bounded source reading');
 }
});
test('Vercel global response policy enforces secure transport, frame denial and fixed origin isolation',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 const global=config.headers.find(item=>item.source==='/(.*)');
 assert.ok(global);
 const value=key=>global.headers.find(x=>x.key===key)?.value;
 assert.equal(value('Strict-Transport-Security'),'max-age=31536000');
 assert.equal(value('X-Frame-Options'),'DENY');
 assert.equal(value('Cross-Origin-Opener-Policy'),'same-origin');
 assert.equal(value('X-Permitted-Cross-Domain-Policies'),'none');
 const csp=value('Content-Security-Policy');
 assert.match(csp,/script-src 'self';/);
 assert.match(csp,/connect-src 'self';/);
 assert.match(csp,/frame-ancestors 'none'/);
 assert.match(csp,/upgrade-insecure-requests/);
 assert.doesNotMatch(csp,/unsafe-inline|unsafe-eval/);
});
test.after(()=>{
 globalThis.fetch=originFetch;
 for(const [k,v] of Object.entries(originEnv)){
  if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
