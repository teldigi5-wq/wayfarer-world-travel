/* Worldwide public-source scheduling. Delays a secondary public lookup until it
   is useful, coalesces repeat requests, never touches authorized fares or AI. */
const memo=new Map(),MAX_ENTRIES=96;
const copy=value=>JSON.parse(JSON.stringify(value));
export async function cachedPublicNearby(key,loader,{now=()=>Date.now()}={}){
  const current=now(),old=memo.get(key);
  if(old&&old.expiresAt>current)return copy(await old.promise);
  if(old)memo.delete(key);
  const promise=Promise.resolve().then(loader);
  const record={expiresAt:current+120000,promise};
  if(memo.size>=MAX_ENTRIES)memo.delete(memo.keys().next().value);
  memo.set(key,record);
  try{
    const result=await promise;
    if(result?.status!==200||result?.body?.ok!==true){
      if(memo.get(key)===record)memo.delete(key);
      return copy(result);
    }
    const hasEvidence=Array.isArray(result.body.hotels)&&result.body.hotels.length>0;
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
  const [map,reference]=await Promise.all([osmtask,referenceTask]);
  return {...map,...reference};
}
