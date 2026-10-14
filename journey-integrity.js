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
    if (known && (!claimedCountry || claimedCountry === known.country)) return {...known};

    // Saved coordinates are useful context, never proof of a current route, inventory,
    // residence, visa validity or authoritative provider geocoding.
    const saved = trip.worldPlace;
    if (saved && typeof saved === 'object' && !Array.isArray(saved)
      && saved.name === name && validLabel(saved.country)
      && (!claimedCountry || saved.country === claimedCountry)
      && typeof saved.countryCode === 'string' && /^[A-Z]{2}$/.test(saved.countryCode)
      && validCoord(saved.latitude, 90) && validCoord(saved.longitude, 180)) {
      return {
        name, country:saved.country, countryCode:saved.countryCode,
        latitude:saved.latitude, longitude:saved.longitude
      };
    }

    // An older record can still display its destination and country. Never
    // substitute unrelated coordinates or guess a country/airport code.
    return claimedCountry ? {name, country:claimedCountry} : null;
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
  globalThis.WayfarerJourneyIntegrity=Object.freeze({
    resolveSavedWorldPlace,journeyIdentity,upsertJourney
  });
})();
