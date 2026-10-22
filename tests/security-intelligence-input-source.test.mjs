import test from 'node:test';
import assert from 'node:assert/strict';
import intelligence from '../api/intelligence.js';

function createResponse() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function withMock(mock, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await callback(); } finally { globalThis.fetch = original; }
}

function request(query, peer) {
  return { method: 'GET', headers: {}, socket: { remoteAddress: peer }, query };
}

test('malformed or out-of-range coordinates fail before any upstream provider call', async () => {
  let calls = 0;
  await withMock(async () => { calls++; throw Error('Network must not be used'); }, async () => {
    const invalid = [
      {lat:'91',lon:'30'}, {lat:'-90.0001',lon:'30'}, {lat:'0',lon:'181'},
      {lat:'-5',lon:'-180.01'}, {lat:'',lon:'0'}, {lat:'0',lon:' '},
      {lat:['1','2'],lon:'3'}, {lat:'Infinity',lon:'1'},
      {lat:'1abc',lon:'2'}, {lat:'0',lon:'NaN'},
    ];
    for (let i=0;i<invalid.length;i++) {
      const response = createResponse();
      await intelligence(request({destination:'Example',...invalid[i]}, `192.0.2.${100+i}`),response);
      assert.equal(response.statusCode,400,`case ${i}`);
    }
  });
  assert.equal(calls,0);
});

test('valid worldwide coordinates are accepted and country codes are normalized', async () => {
  const urls = [];
  await withMock(async url => {
    urls.push(String(url));
    if (String(url).includes('open-meteo.com')) {
      return new Response(JSON.stringify({current:{temperature_2m:25, wind_speed_10m:5,time:'2026-10-22T01:00'},timezone:'Asia/Colombo'}),{status:200});
    }
    if (String(url).includes('wikipedia.org')) {
      return new Response(JSON.stringify({extract:'Sri Lanka information',content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Sri_Lanka'}}}),{status:200});
    }
    return new Response(JSON.stringify([{currencies:{LKR:{name:'Sri Lankan rupee'}},languages:{sin:'Sinhala'},timezones:['UTC+05:30']}]),{status:200});
  }, async () => {
    const response = createResponse();
    await intelligence(request({destination:'Colombo',lat:'6.9271',lon:'79.8612',countryCode:'lk'},'198.51.100.201'),response);
    assert.equal(response.statusCode,200);
    assert.equal(response.body.weather.ok,true);
    assert.equal(response.body.place.ok,true);
    assert.equal(response.body.country.ok,true);
  });
  assert.ok(urls.some(x=>x.includes('latitude=6.9271&longitude=79.8612')));
  assert.ok(urls.some(x=>x.endsWith('/alpha/LK')));
});

test('untrusted encyclopedia links never escape the official HTTPS Wikipedia domain', async () => {
  const badPages = ['javascript:alert(1)','https://attacker.example/phishing','https://en.wikipedia.org.evil.example/wiki/Test'];
  for(let i=0;i<badPages.length;i++) {
    await withMock(async url => {
      if(String(url).includes('wikipedia.org')) {
        return new Response(JSON.stringify({extract:'Fixture',content_urls:{desktop:{page:badPages[i]}}}),{status:200});
      }
      return new Response(JSON.stringify({current:{temperature_2m:20,time:'2026-10-22T01:00'},timezone:'UTC'}),{status:200});
    },async()=>{
      const response=createResponse();
      await intelligence(request({destination:'TestLocation',lat:'0',lon:'0'},`203.0.113.${20+i}`),response);
      assert.equal(response.statusCode,200);
      assert.equal(response.body.place.ok,true);
      assert.equal(response.body.place.sourceUrl,'https://en.wikipedia.org/wiki/TestLocation');
    });
  }
});

test('malformed country identifiers do not alter the outbound provider URL', async () => {
  const urls=[];
  await withMock(async url=>{
    urls.push(String(url));
    if(String(url).includes('wikipedia.org'))return new Response(JSON.stringify({extract:'Fixture'}),{status:200});
    return new Response(JSON.stringify({current:{temperature_2m:20,time:'2026-10-22T01:00'}}),{status:200});
  },async()=>{
    const res=createResponse();
    await intelligence(request({destination:'Example',lat:'0',lon:'0',countryCode:'JP/../../../wrong'},'198.51.100.205'),res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.country.ok,false);
  });
  assert.equal(urls.length,2);
  assert.ok(urls.every(url=>!url.includes('restcountries.com')));
});
