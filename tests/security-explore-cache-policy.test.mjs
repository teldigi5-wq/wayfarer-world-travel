import test from 'node:test';
import assert from 'node:assert/strict';
import explore from '../api/explore.js';

const response=()=>({
  statusCode:200,headers:{},payload:null,
  setHeader(key,value){this.headers[key]=value;return this;},
  status(code){this.statusCode=code;return this;},
  json(body){this.payload=body;return this;}
});
const req=(ip,query={mode:'nearby',lat:'6.9',lon:'79.9'},method='GET')=>
  ({method,query,headers:{},socket:{remoteAddress:ip}});
const requireNoStore=(res,code)=>{
  assert.equal(res.statusCode,code);
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal(res.headers['X-Content-Type-Options'],'nosniff');
};

test('malformed coordinates and empty text search are never cached by edge',async()=>{
  const before=globalThis.fetch;let requests=0;
  globalThis.fetch=async()=>{requests++;throw Error('Should never request provider')};
  try{
    const invalid=response();
    await explore(req('198.51.100.151',{mode:'nearby',lat:' ',lon:'0'}),invalid);
    requireNoStore(invalid,400);
    const short=response();
    await explore(req('198.51.100.152',{mode:'search',q:'A'}),short);
    requireNoStore(short,400);
    assert.equal(requests,0);
  }finally{globalThis.fetch=before}
});
test('unsupported HTTP methods cannot be cached or call upstream providers',async()=>{
  const prev=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('Provider should not be called')};
  try{
    const res=response();
    await explore(req('198.51.100.153',undefined,'POST'),res);
    requireNoStore(res,405);
    assert.equal(calls,0);
  }finally{globalThis.fetch=prev}
});
test('upstream errors are no-store while successful results retain short-lived cache',async()=>{
  const prev=globalThis.fetch;
  try{
    globalThis.fetch=async()=>{throw Error('Synthetic provider outage')};
    const failed=response();
    await explore(req('198.51.100.154'),failed);
    requireNoStore(failed,502);
    assert.ok(!JSON.stringify(failed.payload).includes('Synthetic provider outage'));
    globalThis.fetch=async()=>new Response(JSON.stringify({elements:[]}),{status:200});
    const ok=response();
    await explore(req('198.51.100.155'),ok);
    assert.equal(ok.statusCode,200);
    assert.equal(ok.payload.ok,true);
    assert.equal(ok.headers['Cache-Control'],'public, s-maxage=900, stale-while-revalidate=3600');
  }finally{globalThis.fetch=prev}
});
test('request quota 429 stays uncacheable, with retry guidance',async()=>{
  const prev=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('{"elements":[]}',{status:200})};
  try{
    for(let i=0;i<20;i++){
      const ok=response();
      await explore(req('198.51.100.156'),ok);
      assert.equal(ok.statusCode,200);
    }
    const rejected=response();
    await explore(req('198.51.100.156'),rejected);
    requireNoStore(rejected,429);
    assert.equal(rejected.headers['Retry-After'],'60');
    assert.equal(calls,20);
  }finally{globalThis.fetch=prev}
});
