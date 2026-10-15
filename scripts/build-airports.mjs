/* Reproducible, offline-by-default production/Preview build.
   Public airport data is updated only via the separately reviewed
   scripts/refresh-airports.mjs and daily-airports GitHub workflow.
   Deployments must never make hidden build-time supplier calls. */
import {readFile} from 'node:fs/promises';
import {stagePublicAssets} from './stage-public-assets.mjs';

const file=new URL('../airports-index.json',import.meta.url);
const catalog=JSON.parse(await readFile(file,'utf8'));
if(!catalog||!Array.isArray(catalog.airports)||catalog.airports.length<1000||
   typeof catalog.source!=='string'||!catalog.source.startsWith('https://')){
  throw Error('Bundled airport reference is absent or too small. Run the reviewed airport refresh workflow.');
}
const valid=entry=>entry&&typeof entry.name==='string'&&entry.name.trim()&&
  entry.name.length<=150&&/^[A-Z]{2}$/.test(entry.code||'')&&
  /^[A-Z]{3}$/.test(entry.iata||'')&&
  Number.isFinite(entry.lat)&&Math.abs(entry.lat)<=90&&
  Number.isFinite(entry.lon)&&Math.abs(entry.lon)<=180;
if(catalog.airports.some(a=>!valid(a)))
  throw Error('Bundled airport catalog has invalid geographic references.');
process.stdout.write(
  'Using checked-in airport references: '+catalog.airports.length+
  ' ('+(catalog.retrievedAt||'date unavailable')+
  '). Offline build only; no external provider refresh.\n'
);

await stagePublicAssets();
