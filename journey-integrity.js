/* Saved journey geography: preserve user data without inventing coordinates.
   Pure, zero-network utility; deliberately separate from provider verification. */
(() => {
  'use strict';
  const curated = Object.freeze({
    Kyoto: Object.freeze({name:'Kyoto',country:'Japan',countryCode:'JP',latitude:35.0116,longitude:135.7681}),
    Bali: Object.freeze({name:'Bali',country:'Indonesia',countryCode:'ID',latitude:-8.5069,longitude:115.2625}),
    Switzerland: Object.freeze({name:'Switzerland',country:'Switzerland',countryCode:'CH',latitude:46.6863,longitude:7.8632})
  });
  const validLabel = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 120;
  const validCoord = (value, limit) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

  function resolveSavedWorldPlace(trip) {
    if (!trip || typeof trip !== 'object' || !validLabel(trip.destination)) return null;
    const name = trip.destination.trim();
    const claimedCountry = validLabel(trip.country) ? trip.country.trim() : '';
    const known = Object.hasOwn(curated, name) ? curated[name] : null;
    // A saved World Explorer selection always outranks similarly named curated
    // examples. A real coordinate pair may point to a different place even
    // within the same country (e.g., another "Kyoto" in Japan).
    const saved = trip.worldPlace;
    if(saved !== undefined && saved !== null){
      if(saved && typeof saved==='object' && !Array.isArray(saved)
        && saved.name===name && validLabel(saved.country)
        && (!claimedCountry || saved.country===claimedCountry)
        && typeof saved.countryCode==='string' && /^[A-Z]{2}$/.test(saved.countryCode)
        && !(known && claimedCountry===known.country && saved.countryCode!==known.countryCode)
        && validCoord(saved.latitude,90) && validCoord(saved.longitude,180)){
        return {name,country:saved.country,countryCode:saved.countryCode,
          latitude:saved.latitude,longitude:saved.longitude};
      }
      // A malformed explicit saved place is not permission to silently swap
      // in a curated point just because the city name is recognizable.
      return claimedCountry?{name,country:claimedCountry}:null;
    }
    // Only genuine legacy records with *no saved location* may use the three
    // curated reference locations. No verification or live availability implied.
    if(known && (!claimedCountry || claimedCountry===known.country))return {...known};
    return claimedCountry?{name,country:claimedCountry}:null;
  }
  const token=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('en')
    .trim().replace(/\s+/g,' ');
  function journeyIdentity(trip) {
    if (!trip || !validLabel(trip.destination)) return null;
    // Match the same geographic place, never only the visible city label.
    const place=resolveSavedWorldPlace(trip);
    const region=place?.countryCode||token(trip.country||place?.country);
    const coordinates=place&&validCoord(place.latitude,90)&&validCoord(place.longitude,180)
      ? place.latitude.toFixed(5)+','+place.longitude.toFixed(5) : 'no-coordinates';
    return JSON.stringify([token(trip.destination),region,coordinates]);
  }
  function upsertJourney(existing,next) {
    const identity=journeyIdentity(next);
    if(!identity) return Array.isArray(existing)?[...existing]:[];
    return [...(Array.isArray(existing)?existing:[]).filter(x=>journeyIdentity(x)!==identity),next];
  }
  // Itinerary snapshots are browser-local drafts, never authoritative
  // booking, pricing, geocoding, weather or immigration evidence. Validate
  // bounds both when saving and when reading tamperable localStorage.
  function normalizeItineraryDraft(draft,days){
    if(!draft || typeof draft!=='object' || Array.isArray(draft))return null;
    if(!Number.isInteger(days)||days<1||days>7||!Array.isArray(draft.days)||
      draft.days.length!==days)return null;
    const label=(value,max)=>typeof value==='string'&&value.trim().length>0&&
      value.length<=max?value.trim():null;
    const title=label(draft.title,160);
    if(!title)return null;
    const normalized=[];
    for(const day of draft.days){
      const heading=label(day?.title,140),summary=label(day?.summary,800);
      if(!heading||!summary)return null;
      normalized.push({title:heading,summary});
    }
    return {basis:draft.basis==='ai-draft'?'ai-draft':'sample',
      title,days:normalized};
  }
  function checklistKey(trip,item) {
    if(typeof item!=='string'||!['connect','transport','stay','money'].includes(item))return null;
    const id=journeyIdentity(trip);
    return id?'arrival-v3:'+id+':'+item:null;
  }
  function checklistChecked(values,trip,item) {
    if(!values||typeof values!=='object'||Array.isArray(values))return false;
    const key=checklistKey(trip,item);
    if(!key)return false;
    if(Object.hasOwn(values,key))return values[key]===true;
    // Migrate older city-name-only progress ONLY for the three original,
    // unambiguous curated examples. Never import legacy "Paris:stay" for
    // Paris in France, Texas, or any other internationally duplicated name.
    const name=String(trip.destination||'').trim();
    const known=Object.hasOwn(curated,name)?curated[name]:null;
    const place=resolveSavedWorldPlace(trip);
    if(known&&place?.countryCode===known.countryCode&&
      place.latitude===known.latitude&&place.longitude===known.longitude)
      return values[name+':'+item]===true;
    return false;
  }
  globalThis.WayfarerJourneyIntegrity=Object.freeze({
    resolveSavedWorldPlace,journeyIdentity,upsertJourney,normalizeItineraryDraft,
    checklistKey,checklistChecked
  });
})();
