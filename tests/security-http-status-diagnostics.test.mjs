import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyHttpSurface} from '../scripts/verify-production-http.mjs';

const origin='https://wayfarer-world-travel-m4ce3pzyx-teldigi5-wq.vercel.app';

function fixture(status,visits){
  return async (url,options)=>{
    const parsed=new URL(url);
    assert.equal(parsed.origin,origin);
    assert.equal(parsed.pathname,'/server.mjs');
    assert.equal(options.redirect,'error');
    assert.ok(['HEAD','GET'].includes(options.method));
    visits.push(options.method);
    if(options.method==='HEAD')return new Response(null,{status:404});
    assert.equal(options.headers.Range,'bytes=0-0');
    return new Response('SENSITIVE_MARKER_NEVER_LOGGED',{
      status,headers:{'content-type':'application/javascript',
        'x-test-private':'PRIVATE_RESPONSE_HEADER'}
    });
  };
}

for(const [status,category] of [
  [200,null],
  [206,'partial source response'],
  [403,'possible access protection'],
  [429,'possible throttling']
]){
  test('internal source GET status '+status+' fails closed with code and no response data',async()=>{
    const visits=[];
    await assert.rejects(verifyHttpSurface({
      origin,transport:fixture(status,visits)
    }),err=>{
      assert.match(err.message,/Internal file.*GET \/server\.mjs expected HTTP 404/);
      assert.ok(err.message.includes('received HTTP '+status));
      if(category)assert.ok(err.message.includes(category));
      assert.doesNotMatch(String(err),/SENSITIVE_MARKER_NEVER_LOGGED/);
      assert.doesNotMatch(String(err),/PRIVATE_RESPONSE_HEADER/);
      return true;
    });
    assert.deepEqual(visits,['HEAD','GET']);
  });
}

test('first unexpected internal HEAD status also fails without exposing response text',async()=>{
  const visited=[];
  const transport=async (url,opt)=>{
    visited.push(opt.method);
    assert.equal(new URL(url).pathname,'/server.mjs');
    return new Response(null,{status:401,headers:{'x-private':'NEVER_DISPLAY'}});
  };
  await assert.rejects(verifyHttpSurface({origin,transport}),e=>{
    assert.match(e.message,/HEAD \/server\.mjs expected HTTP 404; received HTTP 401/);
    assert.doesNotMatch(String(e),/NEVER_DISPLAY/);
    return true;
  });
  assert.deepEqual(visited,['HEAD']);
});

test('404 source responses remain accepted only on the specific source paths',async()=>{
  let n=0;
  const transport=async(url,opts)=>{
    n++;
    return new Response(null,{status:404});
  };
  await assert.rejects(verifyHttpSurface({origin,transport}),e=>{
    assert.match(e.message,/Missing public asset/);
    assert.match(e.message,/received HTTP 404/);
    return true;
  });
  assert.ok(n>100,'Verified all internal source paths before the required public assets');
});
