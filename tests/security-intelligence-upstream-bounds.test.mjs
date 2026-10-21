import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchIntelligenceJson, MAX_INTELLIGENCE_JSON_BYTES } from '../api/intelligence-provider-json.mjs';
import intelligence from '../api/intelligence.js';

const withFetch = async (mock, run) => {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await run(); } finally { globalThis.fetch = original; }
};

test('intelligence rejects announced response lengths over the limit before parsing', async () => {
  let redirects;
  await withFetch(async (_url, options) => {
    redirects = options.redirect;
    return new Response('{"small":true}', {
      status: 200,
      headers: { 'content-length': String(MAX_INTELLIGENCE_JSON_BYTES + 1) },
    });
  }, async () => {
    await assert.rejects(() => fetchIntelligenceJson('https://example.org/fixture'), /too large/);
  });
  assert.equal(redirects, 'error');
});

test('intelligence rejects oversized streamed data even when no length was advertised', async () => {
  await withFetch(async () => new Response('A'.repeat(MAX_INTELLIGENCE_JSON_BYTES + 1), { status: 200 }), async () => {
    await assert.rejects(() => fetchIntelligenceJson('https://example.org/fixture'), /too large/);
  });
});

test('intelligence accepts valid bounded JSON and fails closed on non-OK provider responses', async () => {
  await withFetch(async () => new Response('{"ok":true}', { status: 200 }), async () => {
    assert.deepEqual(await fetchIntelligenceJson('https://example.org/fixture'), { ok:true });
  });
  await withFetch(async () => new Response('unavailable', { status: 503 }), async () => {
    await assert.rejects(() => fetchIntelligenceJson('https://example.org/fixture'), /unavailable/);
  });
});

test('oversized Wikipedia context fails softly without leaking response content', async () => {
  let requests = 0;
  const address = '192.0.2.211';
  const result = await withFetch(async url => {
    requests++;
    if (String(url).includes('wikipedia.org')) return new Response('W'.repeat(MAX_INTELLIGENCE_JSON_BYTES + 1), {status: 200});
    if (String(url).includes('open-meteo.com')) return new Response(JSON.stringify({
      current: {temperature_2m:24, wind_speed_10m:4, time:'2026-10-21T10:00'},
      timezone:'Asia/Tokyo',
    }), {status:200});
    return new Response(JSON.stringify([{
      currencies:{JPY:{name:'Japanese yen'}}, languages:{jpn:'Japanese'}, timezones:['UTC+09:00'],
    }]), {status:200});
  }, async () => {
    const res = {
      headers:{}, statusCode:200,
      setHeader(key,value){ this.headers[key] = value; return this; },
      status(status){ this.statusCode = status; return this; },
      json(body){ this.body = body; return this; },
    };
    await intelligence({method:'GET',headers:{},socket:{remoteAddress:address},query:{destination:'Kyoto'}},res);
    return res;
  });
  assert.equal(result.statusCode,200);
  assert.equal(result.body.weather.ok,true);
  assert.equal(result.body.place.ok,false);
  assert.equal(result.body.country.ok,true);
  assert.equal(result.body.ai.ok,false);
  assert.equal(requests,3);
  assert.equal(JSON.stringify(result.body).includes('W'.repeat(100)),false);
});
