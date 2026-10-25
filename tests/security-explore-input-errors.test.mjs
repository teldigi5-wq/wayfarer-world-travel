import test from 'node:test';
import assert from 'node:assert/strict';
import explore from '../api/explore.js';

function response() {
  return {code:200,body:null,headers:{},
    setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.code=n;return this;},
    json(v){this.body=v;return this;}};
}
function request(query,peer) {
  return {method:'GET',query:{mode:'nearby',...query},headers:{},socket:{remoteAddress:peer}};
}
test('missing, whitespace, nonscalar and nonfinite coordinates reject before the upstream call',async()=>{
  const original=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('Must not call upstream')};
  const samples=[
    {lat:'',lon:'0'}, {lat:' ',lon:'0'}, {lat:'0',lon:' '},
    {lat:null,lon:'0'}, {lat:['1','2'],lon:'0'}, {lat:'0',lon:[]},
    {lat:'Infinity',lon:'0'}, {lat:'0',lon:'NaN'}, {lat:'91',lon:'0'},
    {lat:'0',lon:'180.0001'}, {lat:'6oops',lon:'0'}
  ];
  try{
    for(let i=0;i<samples.length;i++){
      const res=response();
      await explore(request(samples[i],`192.0.2.${80+i}`),res);
      assert.equal(res.code,400,`invalid case ${i}`);
    }
    assert.equal(calls,0);
  }finally{globalThis.fetch=original}
});
test('legitimate zero coordinates still reach the nearby provider',async()=>{
  const original=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async (_url,init)=>{
    calls++;
    assert.equal(init.redirect,'error');
    return new Response(JSON.stringify({elements:[]}),{status:200});
  };
  try{
    const res=response();
    await explore(request({lat:'0',lon:'0'},'192.0.2.96'),res);
    assert.equal(res.code,200);
    assert.equal(res.body.ok,true);
    assert.equal(calls,1);
  }finally{globalThis.fetch=original}
});
test('third-party exceptions never become public API error messages',async()=>{
  const original=globalThis.fetch;
  const internal='private-provider-network-details-should-not-appear';
  globalThis.fetch=async()=>{throw Error(internal)};
  try{
    const res=response();
    await explore(request({lat:'6.9',lon:'79.9'},'192.0.2.97'),res);
    assert.equal(res.code,502);
    assert.equal(res.headers['X-Content-Type-Options'],'nosniff');
    assert.equal(res.body.error,'Discovery provider unavailable. Please retry later.');
    assert.ok(!JSON.stringify(res.body).includes(internal));
  }finally{globalThis.fetch=original}
});
