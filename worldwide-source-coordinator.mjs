/* Worldwide public-source scheduling. Delays a secondary public lookup until it
   is useful, coalesces repeat requests, never touches authorized fares or AI. */
const memo=new Map(),MAX_ENTRIES=96;
const copy=value=>JSON.parse(JSON.stringify(value));
export async function cachedPublicNearby(key,loader,{now=()=>Date.now()}={}){
  const current=now(),old=memo.get(key);
  if(old&&(old.pending||old.expiresAt>current))return copy(await old.promise);
  if(old)memo.delete(key);
  const promise=Promise.resolve().then(loader);
  // Never start duplicate public lookups just because a slow in-flight request
  // exceeds a provisional TTL; freshness begins at successful completion.
  const record={pending:true,expiresAt:0,promise};
  if(memo.size>=MAX_ENTRIES)memo.delete(memo.keys().next().value);
  memo.set(key,record);
  try{
    const result=await promise;
    if(result?.status!==200||result?.body?.ok!==true){
      if(memo.get(key)===record)memo.delete(key);
      return copy(result);
    }
    const hasEvidence=Array.isArray(result.body.hotels)&&result.body.hotels.length>0;
    record.pending=false;
    record.expiresAt=now()+(hasEvidence?600000:45000);
    return copy(result);
  }catch(e){
    if(memo.get(key)===record)memo.delete(key);
    throw e;
  }
}
export async function gatherPublicHotels(mapLoader,referenceLoader,{hedgeMs=850}={}){
  // A quick successful OSM hotel result avoids querying Wikidata altogether.
  // When OSM is slow or lacks named hotels, start Wikidata without waiting for
  // OSM's entire timeout. The initial OSM call still has its own hard deadline.
  const osmtask=Promise.resolve().then(mapLoader).catch(()=>({mapped:[],mapAvailable:false}));
  let timerId;
  const delay=new Promise(resolve=>{timerId=setTimeout(()=>resolve('hedge'),hedgeMs);});
  const first=await Promise.race([osmtask.then(()=> 'map'),delay]);
  clearTimeout(timerId);
  if(first==='map'){
    const map=await osmtask;
    if(map.mapAvailable&&map.mapped.some(x=>x.type==='hotel'))
      return {...map,wikidataHotels:[],wikidataAvailable:false};
  }
  const referenceTask=Promise.resolve().then(referenceLoader)
    .then(hotels=>({wikidataHotels:Array.isArray(hotels)?hotels:[],wikidataAvailable:true}))
    .catch(()=>({wikidataHotels:[],wikidataAvailable:false}));
  // If OSM yields credible local hotels after the hedge began, do not make
  // the customer wait for a slower independent reference service to time out.
  // referenceTask handles its own rejection and cannot update this response.
  const map=await osmtask;
  if(map.mapAvailable&&map.mapped.some(x=>x.type==='hotel'))
    return {...map,wikidataHotels:[],wikidataAvailable:false};
  const reference=await referenceTask;
  return {...map,...reference};
}
