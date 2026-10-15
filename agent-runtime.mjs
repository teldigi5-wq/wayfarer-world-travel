import {readBoundedText} from './bounded-source-response.mjs';
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
// Best-effort per-instance public-source cache. Never store keys, beta codes,
// personalized trip inputs, generated AI output, or paid supplier responses.
const sourceCache=new Map(),MAX_PUBLIC_CACHE=96;
export async function getJson(url,{timeoutMs=6500,maxBytes=100000,retries=1,headers={},cacheTtlMs=0}={}){
  const safe=new URL(url);
  if(safe.protocol!=='https:'||safe.username||safe.password)throw Error('Unsafe source URL');
  const privateHeader=Object.keys(headers).some(k=>/authorization|cookie|token|api.?key/i.test(k));
  const cacheable=Number.isFinite(cacheTtlMs)&&cacheTtlMs>0&&!privateHeader&&
    ![...safe.searchParams.keys()].some(k=>/token|key|secret|auth/i.test(k));
  const ttl=cacheable?Math.min(86400000,Math.max(1000,cacheTtlMs)):0;
  const key=ttl?safe.href+'\n'+JSON.stringify(headers):null;
  const cached=key?sourceCache.get(key):null;
  if(cached&&cached.until>Date.now())return cached.promise;
  async function fetchFresh(){
    let last;
    for(let attempt=0;attempt<=retries;attempt++){
      try{
        const response=await fetch(safe.href,{method:'GET',headers,
          signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
        const recoverable=[502,503,504].includes(response.status);
        if(!response.ok){
          last=Error('Source HTTP '+response.status);
          if(recoverable&&attempt<retries)continue;
          throw last;
        }
        if(Number(response.headers.get('content-length')||0)>maxBytes)
          throw Error('Source response too large');
        const body=await readBoundedText(response,maxBytes);
        return JSON.parse(body);
      }catch(e){
        last=e;
        const transient=e?.name==='TypeError'||e?.name==='TimeoutError'||e?.name==='AbortError';
        if(!transient||attempt===retries)break;
      }
    }
    throw last||Error('Source unavailable');
  }
  if(!key)return fetchFresh();
  if(sourceCache.size>=MAX_PUBLIC_CACHE)sourceCache.delete(sourceCache.keys().next().value);
  const promise=fetchFresh().catch(e=>{if(sourceCache.get(key)?.promise===promise)sourceCache.delete(key);throw e});
  sourceCache.set(key,{until:Date.now()+ttl,promise});
  return promise;
}
export function verificationSummary({weather,place,country,ai,days,dailyBudget}){
  const sources=[weather,place,country].filter(x=>x?.ok===true);
  const flags=[];
  if(!weather?.ok)flags.push('Current weather could not be retrieved.');
  else flags.push('Weather describes current conditions, not the weather on future travel dates.');
  if(!place?.ok)flags.push('Destination encyclopedia context could not be verified.');
  else if(place.geographyVerified!==true)
    flags.push('Encyclopedia article is a name-only reference; its coordinates were not independently matched to the selected place. Do not infer specific nearby venues from it.');
  if(!country?.ok)flags.push('Country currency, language and timezone reference is unavailable.');
  if(!ai?.ok)flags.push('The AI itinerary was unavailable; the local sample remains in place.');
  else flags.push('AI itinerary is a draft; venues, opening hours and routes are not verified.');
  flags.push('International flights and accommodation offers require separate explicit provider searches.');
  flags.push('No confirmed airline inventory, restaurant menu prices, visa clearance or local transit fares.');
  const proposed=Number.isFinite(days*dailyBudget)?
    Math.round(days*dailyBudget*100)/100:null;
  const total=proposed??0;
  const allocation={
    accommodation:Math.round(total*.40*100)/100,
    food:Math.round(total*.25*100)/100,
    localTransport:Math.round(total*.15*100)/100,
    activities:Math.round(total*.10*100)/100
  };
  allocation.contingency=Math.round((total-allocation.accommodation-allocation.food-
    allocation.localTransport-allocation.activities)*100)/100;
  return {sourceCount:sources.length,sourceTotal:3,
    status:sources.length===3&&ai?.ok?'complete':sources.length||ai?.ok?'partial':'unavailable',
    plannedGroundTotalUsd:proposed,
    allocationUsd:allocation,
    budgetBasis:'Illustrative 40/25/15/10/10 ground budget allocation. Not destination prices; excludes international airfare.',
    nextSteps:[
      {id:'destinations',state:place?.ok?'reference_available':'needs_source',
        detail:'Review source-backed destination context and independently verify attractions and operating hours.'},
      {id:'flights',state:'needs_provider_check',
        detail:'Choose airports and dates, then explicitly request supplier flight searches. Verify offers on the airline or seller site.'},
      {id:'stays',state:'needs_provider_check',
        detail:'Compare hotel search prices, dates, room occupancy and cancellation terms; booking is not confirmed.'},
      {id:'arrival',state:country?.ok?'reference_available':'needs_source',
        detail:'Prepare arrival essentials; entry requirements and transfers require official verification.'},
      {id:'itinerary',state:ai?.ok?'draft_ready':'sample_only',
        detail:ai?.ok?'Review the AI itinerary against real opening hours and route times.':
          'Review the retained local sample until AI planning becomes available.'}
    ],
    flags};
}
