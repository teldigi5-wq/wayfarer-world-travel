import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/explore.js';

function response(){
  return {
    statusCode:200, headers:{}, body:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(code){this.statusCode=code;return this;},
    json(body){this.body=body;return this;}
  };
}

test('nearby search rejects unsafe OSM website protocols and credential URLs', async()=>{
  const oldFetch=globalThis.fetch;
  const fixtures=[
    {type:'node',id:101,lat:6.93,lon:79.86,tags:{tourism:'hotel',name:'Unsafe Script',website:'javascript:alert(document.domain)'}},
    {type:'node',id:102,lat:6.94,lon:79.87,tags:{tourism:'hotel',name:'Unsafe Data',website:'data:text/html,attack'}},
    {type:'node',id:103,lat:6.95,lon:79.88,tags:{tourism:'hotel',name:'Legitimate Site',website:'https://hotel.example.org/rooms'}},
    {type:'node',id:104,lat:6.96,lon:79.89,tags:{tourism:'hotel',name:'Credential URL',website:'https://user:secret@hotel.example.org/'}},
    {type:'node',id:105,lat:6.97,lon:79.90,tags:{tourism:'hotel',name:'Relative Link',website:'//example.org/unsafe'}}
  ];
  try{
    globalThis.fetch=async(url)=>{
      assert.equal(new URL(url).hostname,'overpass-api.de');
      return new Response(JSON.stringify({elements:fixtures}),{status:200});
    };
    const res=response();
    await handler({method:'GET',query:{mode:'nearby',lat:'6.9271',lon:'79.8612'}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.ok,true);
    const byName=new Map(res.body.hotels.map(x=>[x.name,x]));
    assert.equal(byName.get('Unsafe Script').url,'https://www.openstreetmap.org/node/101');
    assert.equal(byName.get('Unsafe Data').url,'https://www.openstreetmap.org/node/102');
    assert.equal(byName.get('Credential URL').url,'https://www.openstreetmap.org/node/104');
    assert.equal(byName.get('Relative Link').url,'https://www.openstreetmap.org/node/105');
    assert.equal(byName.get('Legitimate Site').url,'https://hotel.example.org/rooms');
    assert.ok(res.body.hotels.every(x=>/^https?:\/\//.test(x.url)));
  }finally{globalThis.fetch=oldFetch;}
});

test('invalid coordinates are rejected before calling upstream map provider', async()=>{
  const oldFetch=globalThis.fetch;
  try{
    globalThis.fetch=async()=>{throw Error('Unexpected upstream request');};
    const res=response();
    await handler({method:'GET',query:{mode:'nearby',lat:'100',lon:'79'}},res);
    assert.equal(res.statusCode,400);
  }finally{globalThis.fetch=oldFetch;}
});

test('browser applies a second URL protocol guard before inserting links',()=>{
  const src=fs.readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');
  assert.match(src,/const safePlaceLink=value=>/);
  assert.match(src,/esc\(safePlaceLink\(x\.url\)\)/);
  assert.match(src,/url\.protocol==='https:'\|\|url\.protocol==='http:'/);
});
