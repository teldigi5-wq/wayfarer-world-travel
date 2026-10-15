import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,stat} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {stagePublicAssets} from '../scripts/stage-public-assets.mjs';
import {PUBLIC_STATIC_FILES,PUBLIC_STATIC_SET} from '../public-static-assets.mjs';

const root=new URL('../',import.meta.url);
const staged=new URL('../public/',import.meta.url);
const publicRead=name=>readFile(new URL('../public/'+name,import.meta.url));
const rootRead=name=>readFile(new URL('../'+name,import.meta.url));
const listed=()=>readdir(staged);

before(async()=>{await stagePublicAssets()});

test('configured Vercel output is only the generated reviewed public folder; API functions stay at root',async()=>{
  const config=JSON.parse(await rootRead('vercel.json'));
  assert.equal(config.framework??null,null,'Existing Other framework stays unchanged');
  assert.equal(config.outputDirectory,'public');
  assert.equal(config.buildCommand,'npm run build');
  assert.equal(Object.keys(config.functions).length,8,
    'All existing Vercel API functions must remain registered');
  for(const fn of Object.keys(config.functions)){
    assert.match(fn,/^api\/[A-Za-z0-9-]+\.(?:mjs|js)$/);
    assert.ok((await stat(new URL('../'+fn,import.meta.url))).isFile());
  }
  const pkg=JSON.parse(await rootRead('package.json'));
  assert.equal(pkg.scripts.build,'node scripts/build-airports.mjs');
  assert.match(await rootRead('scripts/build-airports.mjs'),/await stagePublicAssets\(\)/);
  assert.match(await rootRead('.gitignore'),/^public\/$/m);
});

test('public output exactly matches the reviewed manifest with identical file bytes',async()=>{
  const files=await listed();
  assert.equal(new Set(files).size,PUBLIC_STATIC_FILES.length);
  assert.deepEqual([...files].sort(),[...PUBLIC_STATIC_FILES].sort());
  for(const name of PUBLIC_STATIC_FILES){
    assert.ok(PUBLIC_STATIC_SET.has(name));
    const source=await rootRead(name),out=await publicRead(name);
    assert.ok(out.length>0);
    assert.deepEqual(out,source,'Staged file must have identical bytes: '+name);
    assert.ok((await stat(new URL('../public/'+name,import.meta.url))).isFile());
  }
});

test('generated deployable static output contains neither private implementation nor secrets metadata',async()=>{
  const files=await listed();
  for(const forbidden of [
    'server.mjs','public-static-assets.mjs','provider-production-lock.mjs',
    'bounded-source-response.mjs','flight-selection-token.mjs',
    'airline-offer-token.mjs','app.mjs','planner.mjs','agent-runtime.mjs',
    'package.json','vercel.json','README.md','.git','.env',
    'test.mjs','scripts','docs','api','tests','node_modules',
    'scripts/audit-git-history.mjs','api/intelligence.js'
  ]){
    assert.equal(files.includes(forbidden),false,'Private code reached public directory: '+forbidden);
  }
  assert.equal(files.some(name=>name.endsWith('.mjs')),false,
    'Server-side ES modules cannot be published as static assets');
  assert.equal(files.some(name=>name.startsWith('.')),false,'No dotfiles');
  assert.equal(files.some(name=>!PUBLIC_STATIC_SET.has(name)),false,'No unlisted output files');
});

test('build removes stale unexpected public output before producing the next clean bundle',async()=>{
  await writeFile(new URL('../public/stale-private-data.txt',import.meta.url),
    'This stale private file must not survive the next build','utf8');
  assert.ok((await listed()).includes('stale-private-data.txt'));
  await stagePublicAssets();
  assert.equal((await listed()).includes('stale-private-data.txt'),false);
  assert.deepEqual((await listed()).sort(),[...PUBLIC_STATIC_FILES].sort());
});

test('local CSS, JS and image links from both customer pages remain in deployable public output',async()=>{
  for(const page of ['index.html','data-and-privacy.html']){
    const html=await publicRead(page);
    const urls=[...html.toString().matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/gi)];
    for(const match of urls){
      const src=match[1];
      if(/^(?:https?:|data:|\/\/|#)/i.test(src))continue;
      if(!/\.(?:css|js|json|svg|jpg|jpeg|png)(?:\?|$)/i.test(src))continue;
      const filename=src.split('?')[0];
      assert.ok(PUBLIC_STATIC_SET.has(filename),'Missing public source page dependency: '+filename);
      assert.ok((await publicRead(filename)).length>0);
    }
  }
  const atlas=(await publicRead('country-atlas.js')).toString();
  assert.match(atlas,/country-atlas\.json/);
  assert.ok((await publicRead('country-atlas.json')).length>0);
});

test('asset staging never includes external supplier calls or a way to publish arbitrary paths',async()=>{
  const src=(await rootRead('scripts/stage-public-assets.mjs')).toString();
  assert.doesNotMatch(src,/\bfetch\s*\(|\bexecFile\s*\(|https\.request\s*\(|child_process/);
  assert.doesNotMatch(src,/\.\.\/\.\.\/|glob\s*\(|\.env|process\.env\s*\[/);
  assert.match(src,/meta\.isSymbolicLink\(\)/);
  assert.match(src,/PUBLIC_STATIC_FILES/);
});
