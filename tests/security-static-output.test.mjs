import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,stat} from 'node:fs/promises';
import {stagePublicAssets} from '../scripts/stage-public-assets.mjs';
import {PUBLIC_ASSETS} from '../static-asset-manifest.mjs';

const base=new URL('../',import.meta.url);
const staged=new URL('../public/',import.meta.url);
const source=name=>readFile(new URL('../'+name,import.meta.url));
const output=name=>readFile(new URL('../public/'+name,import.meta.url));
const list=()=>readdir(staged);

test('only explicit, byte-identical browser assets are staged offline',async()=>{
  const built=await stagePublicAssets();
  assert.equal(built.directory,'public');
  assert.deepEqual([...await list()].sort(),[...PUBLIC_ASSETS].sort());
  for(const filename of PUBLIC_ASSETS){
    assert.deepEqual(await output(filename),await source(filename),
      'Published file content changed: '+filename);
    assert.ok((await stat(new URL('../public/'+filename,import.meta.url))).isFile());
  }
});

test('server modules, internal QA, docs and project files never enter static output',async()=>{
  const names=await list();
  assert.equal(new Set(names).size,PUBLIC_ASSETS.length);
  assert.ok(!names.some(n=>n.includes('/')||n.endsWith('.mjs')||n.startsWith('.')));
  for(const forbidden of ['server.mjs','package.json','vercel.json','.env',
    'tests','scripts','.github','docs','README.md','test.mjs',
    'static-asset-manifest.mjs','provider-production-lock.mjs',
    'api','api/explore.js','api/travel-search.js']){
    assert.ok(!names.includes(forbidden),forbidden+' was exposed');
  }
  assert.deepEqual(names.sort(),[...PUBLIC_ASSETS].sort());
});

test('Vercel publishes only public/ while keeping every declared server function',async()=>{
  const config=JSON.parse(await source('vercel.json'));
  assert.equal(config.outputDirectory,'public');
  assert.equal(config.buildCommand,'npm run build');
  assert.ok(Object.keys(config.functions).length>=6);
  for(const filename of Object.keys(config.functions)){
    assert.match(filename,/^api\/[\w-]+\.(?:js|mjs)$/);
    assert.ok((await stat(new URL('../'+filename,import.meta.url))).isFile());
    assert.ok(!PUBLIC_ASSETS.includes(filename));
  }
  const pkg=JSON.parse(await source('package.json'));
  assert.equal(pkg.scripts.build,'node scripts/stage-public-assets.mjs');
  assert.match((await source('.gitignore')).toString(),/^public\/$/m);
});

test('document-linked assets remain available with the reviewed hero WebP fallback',async()=>{
  const html=(await output('index.html')).toString();
  assert.ok(html.includes('class="hero-media"'));
  const attrs=[...html.matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href|srcset)="([^"]+)"/gi)];
  for(const [,raw] of attrs){
    const url=raw.split('?')[0];
    if(/^(?:https?:|\/\/|#|data:)/i.test(url))continue;
    if(!/\.(?:js|css|json|webp|jpg|png|svg)(?:$)/i.test(url))continue;
    assert.ok(PUBLIC_ASSETS.includes(url),'Missing browser dependency: '+url);
    assert.ok((await output(url)).byteLength>0);
  }
  assert.ok(PUBLIC_ASSETS.includes('wayfarer-hero-v3.webp'));
  assert.ok(PUBLIC_ASSETS.includes('wayfarer-hero-v3.jpg'));
  assert.ok(PUBLIC_ASSETS.includes('data.json'));
});

test('rebuild discards stale output before creating the reviewed manifest',async()=>{
  await writeFile(new URL('../public/forbidden-stale.txt',import.meta.url),
    'Must not remain after rebuild');
  assert.ok((await list()).includes('forbidden-stale.txt'));
  await stagePublicAssets();
  assert.ok(!(await list()).includes('forbidden-stale.txt'));
  assert.deepEqual([...await list()].sort(),[...PUBLIC_ASSETS].sort());
});
