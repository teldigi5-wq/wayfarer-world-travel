import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntelligenceLimiter } from '../api/intelligence-rate-limit.mjs';
import intelligence from '../api/intelligence.js';

test('per-peer allowance is bounded, isolated and resets after a minute', () => {
  let t = 1000;
  const blocked = createIntelligenceLimiter({now:()=>t, maxRequests:2, windowMs:60000, maxKeys:2});
  const peer = addr => ({headers:{},socket:{remoteAddress:addr}});
  assert.equal(blocked(peer('127.0.0.1')), false);
  assert.equal(blocked(peer('127.0.0.1')), false);
  assert.equal(blocked(peer('127.0.0.1')), true);
  assert.equal(blocked(peer('127.0.0.2')), false);
  t += 60001;
  assert.equal(blocked(peer('127.0.0.1')), false);
});

test('only platform-overwritten proxy address is accepted when in Vercel', () => {
  const previous = process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    const blocked = createIntelligenceLimiter({maxRequests:1});
    const peer = ip => ({headers:{'x-vercel-forwarded-for':ip},socket:{remoteAddress:'198.51.100.1'}});
    assert.equal(blocked(peer('192.0.2.1')), false);
    assert.equal(blocked(peer('192.0.2.2')), true);
    process.env.VERCEL = '1';
    const trusted = createIntelligenceLimiter({maxRequests:1});
    assert.equal(trusted(peer('192.0.2.1')), false);
    assert.equal(trusted(peer('192.0.2.2')), false);
  } finally {
    if(previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test('route returns 429 before a third-party request after 30 calls', async t => {
  const realFetch = globalThis.fetch;
  let outbound = 0;
  globalThis.fetch = async () => {outbound++;return {ok:false};};
  t.after(() => { globalThis.fetch = realFetch; });
  const call = async () => {
    const headers = {};
    const res = {
      setHeader(name,value){headers[name.toLowerCase()] = value;},
      status(code){this.statusCode = code;return this;},
      json(payload){return {status:this.statusCode,body:payload,headers};},
    };
    return intelligence({
      method:'GET',
      headers:{},
      socket:{remoteAddress:'203.0.113.254'},
      query:{destination:'Kyoto'},
    },res);
  };
  for(let i=0;i<30;i++)assert.equal((await call()).status,200);
  const previous = outbound;
  const blocked = await call();
  assert.equal(blocked.status,429);
  assert.equal(blocked.headers['retry-after'],'60');
  assert.equal(outbound,previous);
});
