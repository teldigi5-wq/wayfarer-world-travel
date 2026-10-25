import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';

const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const productionSecurity=Object.fromEntries(
  config.headers.find(rule=>rule.source==='/(.*)').headers.map(x=>[x.key.toLowerCase(),x.value])
);
const root='http://127.0.0.1:44817';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('local preview mirrors declared Vercel security headers and safe static semantics',async()=>{
  const server=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{
    env:{...process.env,WAYFARER_LOCAL_PORT:'44817'},stdio:['ignore','ignore','pipe']
  });
  let errors='';
  server.stderr.on('data',chunk=>errors+=String(chunk).slice(-900));
  try{
    let ready=false;
    for(let attempt=0;attempt<75;attempt++){
      if(server.exitCode!==null)break;
      try{const response=await fetch(root+'/',{signal:AbortSignal.timeout(500)});
        if(response.ok){ready=true;break}
      }catch{}
      await wait(100);
    }
    assert.ok(ready,'Local server did not start: '+errors);

    const home=await fetch(root+'/');
    assert.equal(home.status,200);
    assert.match(home.headers.get('content-type'),/^text\/html/);
    for(const [key,value] of Object.entries(productionSecurity)){
      assert.equal(home.headers.get(key),value,'Mismatched Vercel header: '+key);
    }
    assert.match(await home.text(),/class="hero-media"/);

    const image=await fetch(root+'/wayfarer-hero-v3.webp');
    assert.equal(image.status,200);
    assert.equal(image.headers.get('content-type'),'image/webp');
    const bytes=Buffer.from(await image.arrayBuffer());
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(bytes.length>100000);

    const head=await fetch(root+'/wayfarer-hero-v3.webp',{method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(head.headers.get('content-length'),String(bytes.length));
    assert.equal((await head.arrayBuffer()).byteLength,0);
    const disallowed=await fetch(root+'/',{method:'POST',body:'nope'});
    assert.equal(disallowed.status,405);
    assert.equal(disallowed.headers.get('allow'),'GET, HEAD');
    assert.equal(disallowed.headers.get('cache-control'),'no-store');
    assert.equal(await disallowed.text(),'');

    for(const invalid of ['/file/not-found.txt','/.env.local','/not-found-file-123.mp3']){
      const response=await fetch(root+invalid);
      assert.equal(response.status,404,invalid);
      assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    }
    const data=await fetch(root+'/data.json');
    assert.equal(data.status,200);
    assert.equal(data.headers.get('cache-control'),'public, max-age=86400');
  }finally{
    server.kill('SIGTERM');
    await new Promise(resolve=>{
      if(server.exitCode!==null)return resolve();
      server.once('exit',resolve);
      setTimeout(resolve,3000).unref?.();
    });
  }
});
