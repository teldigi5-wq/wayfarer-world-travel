import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createStaticServer} from '../server.mjs';
import {PUBLIC_STATIC_FILES,PUBLIC_STATIC_SET} from '../public-static-assets.mjs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
let server,base;
before(async()=>{
  server=createStaticServer();
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{
  if(server?.listening)await new Promise((resolve,reject)=>
    server.close(error=>error?reject(error):resolve())
  );
});
const request=(route,opts)=>fetch(base+route,opts);

test('static preview makes only the explicit public asset manifest accessible',()=>{
  assert.equal(PUBLIC_STATIC_FILES.length,PUBLIC_STATIC_SET.size,'No manifest duplicates');
  for(const file of PUBLIC_STATIC_FILES){
    assert.match(file,/^[A-Za-z0-9_.-]+$/);
    assert.ok(!file.startsWith('.'));
    assert.ok(statSync(new URL('../'+file,import.meta.url)).size>0,
      'Missing public browser artifact: '+file);
  }
  for(const name of ['server.mjs','provider-production-lock.mjs','vercel.json',
    'package.json','test.mjs','.env','README.md','app.mjs',
    'flight-selection-token.mjs','scripts/audit-git-history.mjs']){
    assert.equal(PUBLIC_STATIC_SET.has(name),false,'Cannot list server implementation or metadata: '+name);
  }
});

test('homepage and privacy page references resolve through the local static preview',async()=>{
  for(const file of ['index.html','data-and-privacy.html']){
    const root=await request('/'+file);
    assert.equal(root.status,200,file);
    assert.match(root.headers.get('content-type'),/text\/html/);
    const html=await root.text();
    assert.match(html,/<main|<body/i);
    for(const match of html.matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/gi)){
      const url=match[1];
      if(/^(?:https?:|data:|\/\/|#)/i.test(url))continue;
      if(!/\.(?:css|js|json|svg|jpg|jpeg|png|xml)(?:\?|$)/i.test(url))continue;
      const asset='/'+url.split('?')[0];
      const response=await request(asset);
      assert.equal(response.status,200,file+' uses missing static asset '+asset);
      assert.ok(Number(response.headers.get('content-length'))>0);
      await response.arrayBuffer();
    }
  }
  const root=await request('/');
  assert.equal(root.status,200);
  assert.equal((await root.text()).slice(0,15),read('index.html').slice(0,15));
});

test('public geographic data and metadata have expected MIME types and never assert live booking inventory',async()=>{
  for(const path of ['/data.json','/airports-index.json','/country-atlas.json']){
    const response=await request(path);
    assert.equal(response.status,200,path);
    assert.match(response.headers.get('content-type'),/application\/json/);
    const object=await response.json();
    assert.ok(typeof object==='object'&&object!==null);
  }
  const air=await request('/airports-index.json');
  assert.equal(air.headers.get('cache-control'),'public, max-age=86400');
  const sitemap=await request('/sitemap.xml');
  assert.equal(sitemap.status,200);
  assert.match(sitemap.headers.get('content-type'),/application\/xml/);
  const robots=await request('/robots.txt');
  assert.equal(robots.status,200);
  assert.match(robots.headers.get('content-type'),/text\/plain/);
  const image=await request('/wayfarer-hero-v3.jpg');
  assert.equal(image.status,200);
  assert.match(image.headers.get('content-type'),/image\/jpeg/);
});

test('local static responses carry the committed Vercel security-header baseline',async()=>{
  const conf=JSON.parse(read('vercel.json'));
  const headers=conf.headers.find(h=>h.source==='/(.*)')?.headers??[];
  for(const path of ['/','/data-and-privacy.html','/premium-app.js','/favicon.svg']){
    const response=await request(path);
    assert.equal(response.status,200);
    for(const {key,value} of headers){
      assert.equal(response.headers.get(key),value,
        path+' should share committed '+key+' response policy');
    }
  }
  const html=await request('/index.html');
  assert.equal(html.headers.get('cache-control'),'no-store');
  assert.match(html.headers.get('content-security-policy'),/script-src 'self'/);
  assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});

test('repository implementation files, config and raw API source cannot be fetched',async()=>{
  const forbidden=[
    '/server.mjs','/public-static-assets.mjs','/provider-production-lock.mjs',
    '/bounded-source-response.mjs','/package.json','/vercel.json',
    '/README.md','/test.mjs','/.env','/.git/config','/%2eenv',
    '/docs/STAGE-50-RELEASE-DECISION.md','/tests/security-response-bounds.test.mjs',
    '/scripts/audit-git-history.mjs','/api/ai-plan.mjs','/api/intelligence.js',
    '/api/explore','/api/airline-offers.mjs','/%2e%2e/server.mjs',
    '/%2fserver.mjs','/server.mjs%00.jpg','/browser-data.js/../server.mjs',
    '/old-file-that-does-not-exist.js'
  ];
  for(const url of forbidden){
    const response=await request(url);
    assert.equal(response.status,404,'Unexpected public file exposure: '+url);
    assert.equal(await response.text(),'Not found');
    assert.equal(response.headers.get('cache-control'),'no-store');
  }
});
test('HEAD returns metadata with zero body and unsupported methods never write data',async()=>{
  const head=await request('/data-and-privacy.html',{method:'HEAD'});
  const get=await request('/data-and-privacy.html');
  assert.equal(head.status,200);
  assert.equal(head.headers.get('content-type'),get.headers.get('content-type'));
  assert.equal(head.headers.get('content-length'),get.headers.get('content-length'));
  assert.equal((await head.arrayBuffer()).byteLength,0);
  const denied=await request('/',{method:'POST',body:'please-do-not-save'});
  assert.equal(denied.status,405);
  assert.equal(denied.headers.get('allow'),'GET, HEAD');
  assert.equal(denied.headers.get('cache-control'),'no-store');
  assert.equal(await denied.text(),'Method not allowed');
  const afterDenied=await request('/');
  assert.equal(afterDenied.status,200);
});
test('malformed URL escapes and oversized request targets fail safely without filesystem reads',async()=>{
  const invalid=await request('/%GG');
  assert.equal(invalid.status,400);
  assert.equal(await invalid.text(),'Malformed request URL');
  const long=await request('/a'.repeat(1100));
  assert.equal(long.status,414);
  assert.equal((await long.text()),'Request target too long');
});
test('local static preview does not impersonate real Vercel serverless APIs',async()=>{
  for(const path of ['/api/intelligence','/api/travel-search',
    '/api/ai-plan','/api/flight-selection','/api/airline-offers']){
    const response=await request(path);
    assert.equal(response.status,404);
    assert.doesNotMatch(await response.text(),/example|mock|invented|flight/);
  }
  const status=await request('/data-and-privacy.html');
  assert.equal(status.status,200);
  assert.match(await status.text(),/Beta information, not finalized legal terms/);
});
