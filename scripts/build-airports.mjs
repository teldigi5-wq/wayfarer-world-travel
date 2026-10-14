/* Vercel build-time public-domain reference refresh.
   An upstream outage must not prevent a no-cost Preview deployment. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
const run=promisify(execFile);
const file=new URL('../airports-index.json',import.meta.url);
try{
  const {stdout,stderr}=await run(process.execPath,
    [new URL('./refresh-airports.mjs',import.meta.url).pathname],
    {timeout:120000,maxBuffer:1024*1024});
  process.stdout.write(stdout);
  if(stderr)process.stderr.write(stderr);
}catch(e){
  process.stderr.write('Full airport update unavailable; preserving checked-in airport fallback. '+String(e.message).slice(0,200)+'\n');
}
const data=JSON.parse(await readFile(file,'utf8'));
if(!Array.isArray(data.airports)||data.airports.length<1000){
  throw Error('Bundled airport fallback is not usable');
}
process.stdout.write('Airport index available: '+data.airports.length+' references ('+(data.retrievedAt||'date unavailable')+')\n');
