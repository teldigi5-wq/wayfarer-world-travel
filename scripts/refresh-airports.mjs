import { readFile, writeFile } from 'node:fs/promises';
const SOURCE='https://davidmegginson.github.io/ourairports-data/airports.csv';
const TARGET=new URL('../airports-index.json', import.meta.url);
const allowed=new Set(['large_airport','medium_airport','small_airport','seaplane_base']);
function* csvRows(value){
  let row=[],field='',inside=false;
  for(let i=0;i<value.length;i++){
    const char=value[i];
    if(char==='"') {
      if(inside && value[i+1]==='"') {field+='"';i++;}
      else inside=!inside;
    } else if(!inside && char===','){row.push(field);field='';}
    else if(!inside && (char==='\n'||char==='\r')){
      if(char==='\r'&&value[i+1]==='\n')i++;
      row.push(field);field='';
      if(row.some(x=>x))yield row;
      row=[];
    } else field+=char;
  }
  if(inside)throw Error('Incomplete quoted CSV');
  if(row.length||field){row.push(field);yield row;}
}
export function buildAirportCatalog(csv,now='2026-01-01'){
  const rows=csvRows(csv);
  const header=rows.next();
  if(header.done)throw Error('Empty CSV');
  const names=header.value.map(x=>x.replace(/^\uFEFF/,'').trim());
  const position=Object.fromEntries(names.map((n,i)=>[n,i]));
  for(const needed of ['name','type','iata_code','iso_country','municipality','scheduled_service']) {
    if(!(needed in position))throw Error('Missing CSV column '+needed);
  }
  const get=(row,name)=>String(row[position[name]]||'').trim();
  const entries=new Map();
  for(const row of rows){
    const type=get(row,'type'),code=get(row,'iata_code').toUpperCase(),country=get(row,'iso_country').toUpperCase();
    if(!allowed.has(type)||!/^[A-Z]{3}$/.test(code)||!/^[A-Z]{2}$/.test(country))continue;
    const name=get(row,'name').slice(0,150),municipality=get(row,'municipality').slice(0,90);
    if(!name)continue;
    const a={name,code:country,iata:code,municipality,scheduledService:get(row,'scheduled_service')==='yes',type};
    const lat=Number(get(row,'latitude_deg')),lon=Number(get(row,'longitude_deg'));
    if(Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lon)&&Math.abs(lon)<=180){a.lat=lat;a.lon=lon;}
    const key=country+'-'+code;
    const prev=entries.get(key);
    const priority=x=>(x.scheduledService?4:0)+(x.type==='large_airport'?3:x.type==='medium_airport'?2:0);
    if(!prev || priority(a)>priority(prev))entries.set(key,a);
  }
  const airports=[...entries.values()].sort((a,b)=>a.code.localeCompare(b.code)||a.iata.localeCompare(b.iata));
  if(airports.length<1000)throw Error('Airport catalog unexpectedly small: '+airports.length);
  return {
    source:SOURCE,
    usage:'Airport directory reference; not proof of active commercial flights or seats',
    retrievedAt:now,airports
  };
}
async function main(){
  const result=await fetch(SOURCE,{headers:{'User-Agent':'WayfarerReferenceRefresh/1.0 (open data; GitHub Actions)'}});
  if(!result.ok)throw Error('OurAirports source failed '+result.status);
  const csv=await result.text();
  if(csv.length<200000)throw Error('Incomplete airport source');
  const latest=buildAirportCatalog(csv,new Date().toISOString().slice(0,10));
  try {
    const old=JSON.parse(await readFile(TARGET,'utf8'));
    if(JSON.stringify(old.airports)===JSON.stringify(latest.airports)){
      process.stdout.write('No directory changes; leaving previous retrieval date unchanged.\n');
      return;
    }
  }catch(error){if(error.code!=='ENOENT')throw error;}
  await writeFile(TARGET,JSON.stringify(latest)+'\n');
  process.stdout.write('Refreshed '+latest.airports.length+' airports from '+SOURCE+'\n');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
