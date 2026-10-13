// Bounded, observable public-source requests used by Journey Studio.
// Retry idempotent GET requests only; never retry billable AI/travel searches.
export const scrub=(v,max=120)=>String(v??'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,max);
export function checkedDate(v){
  const s=scrub(v,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&
    !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
    new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
}
export function validHttpsSource(value,hosts){
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password&&
      hosts.some(host=>url.hostname===host||url.hostname.endsWith('.'+host))?
      url.href:null;
  }catch{return null}
}
export async function getJson(url,{timeoutMs=6500,maxBytes=100000,retries=1,headers={}}={}){
  const safe=new URL(url);
  if(safe.protocol!=='https:'||safe.username||safe.password)throw Error('Unsafe source URL');
  let last;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      const response=await fetch(safe.href,{method:'GET',headers,
        signal:AbortSignal.timeout(timeoutMs)});
      const recoverable=[502,503,504].includes(response.status);
      if(!response.ok){
        last=Error('Source HTTP '+response.status);
        if(recoverable&&attempt<retries)continue;
        throw last;
      }
      if(Number(response.headers.get('content-length')||0)>maxBytes)
        throw Error('Source response too large');
      const body=await response.text();
      if(Buffer.byteLength(body,'utf8')>maxBytes)throw Error('Source response too large');
      return JSON.parse(body);
    }catch(e){
      last=e;
      // Retry network failures, not malformed/oversized data or rate limiting.
      const transient=e?.name==='TypeError'||e?.name==='TimeoutError'||e?.name==='AbortError';
      if(!transient||attempt===retries)break;
    }
  }
  throw last||Error('Source unavailable');
}
export function verificationSummary({weather,place,country,ai,days,dailyBudget}){
  const sources=[weather,place,country].filter(x=>x?.ok===true);
  const flags=[];
  if(!weather?.ok)flags.push('Current weather could not be retrieved.');
  else flags.push('Weather describes current conditions, not the weather on future travel dates.');
  if(!place?.ok)flags.push('Destination encyclopedia context could not be verified.');
  if(!country?.ok)flags.push('Country currency, language and timezone reference is unavailable.');
  if(!ai?.ok)flags.push('The AI itinerary was unavailable; the local sample remains in place.');
  else flags.push('AI itinerary is a draft; venues, opening hours and routes are not verified.');
  flags.push('International flights and accommodation offers require separate explicit provider searches.');
  flags.push('No confirmed airline inventory, restaurant menu prices, visa clearance or local transit fares.');
  const proposed=Number.isFinite(days*dailyBudget)?
    Math.round(days*dailyBudget*100)/100:null;
  return {sourceCount:sources.length,sourceTotal:3,
    status:sources.length===3&&ai?.ok?'complete':sources.length||ai?.ok?'partial':'unavailable',
    plannedGroundTotalUsd:proposed,
    budgetBasis:'Working daily budget × days; not a supplier quote. Excludes international airfare.',
    flags};
}
