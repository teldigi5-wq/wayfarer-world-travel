import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/explore.js';

const fakeRes=()=>({
  statusCode:200,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(s){this.statusCode=s;return this;},
  json(x){this.body=x;return this;}
});
const geo=(peer)=>({method:'GET',query:{mode:'nearby',lat:'6.9271',lon:'79.8612'},socket:{remoteAddress:peer},headers:{}});
const fixture={elements:[{type:'node',id:555,lat:6.9,lon:79.8,tags:{tourism:'hotel',name:'Fixture Hotel'}}]};

test('anonymous map search has a per-instance cap and sends no upstream request on 429',async()=>{
  const prev=globalThis.fetch;
  const calls=[];
  try {
    globalThis.fetch=async(url,opts)=>{calls.push(opts);return new Response(JSON.stringify(fixture),{status:200})};
    const user=geo('192.0.2.41');
    for(let i=0;i<20;i++){
      const res=fakeRes();await handler(user,res);
      assert.equal(res.statusCode,200);
    }
    const res=fakeRes();await handler(user,res);
    assert.equal(res.statusCode,429);
    assert.equal(res.headers['Retry-After'],'60');
    assert.equal(res.headers['Cache-Control'],'no-store');
    assert.equal(calls.length,20);
  }finally{globalThis.fetch=prev;}
});

test('anonymous source request rejects announced and streamed over-size provider responses',async()=>{
  const prev=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response('',{status:200,headers:{'content-length':'1500001'}});
    const big=fakeRes();await handler(geo('192.0.2.42'),big);
    assert.equal(big.statusCode,502);
    globalThis.fetch=async()=>new Response('A'.repeat(1_500_001),{status:200});
    const streamed=fakeRes();await handler(geo('192.0.2.43'),streamed);
    assert.equal(streamed.statusCode,502);
  }finally{globalThis.fetch=prev;}
});

test('discovery forbids upstream HTTP redirects',async()=>{
  const prev=globalThis.fetch;
  let seen;
  try {
    globalThis.fetch=async(_url,options)=>{seen=options.redirect;return new Response(JSON.stringify(fixture),{status:200})};
    const res=fakeRes();await handler(geo('192.0.2.44'),res);
    assert.equal(res.statusCode,200);
    assert.equal(seen,'error');
  }finally{globalThis.fetch=prev;}
});

test('non-GET requests never call the map provider',async()=>{
  const prev=globalThis.fetch;
  try{
    globalThis.fetch=async()=>{throw Error('Unexpected provider call')};
    const request={...geo('192.0.2.45'),method:'POST'};
    const res=fakeRes();await handler(request,res);
    assert.equal(res.statusCode,405);
  }finally{globalThis.fetch=prev;}
});
