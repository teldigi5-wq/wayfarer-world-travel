// Free, deterministic planning helpers. No paid inference or booking integration.
const DAY = 86400000;
function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? +date : NaN;
}
export function validateTrip(trip = {}) {
  const errors = [];
  const start = dateValue(trip.startDate), end = dateValue(trip.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end)) errors.push('Choose valid start and end dates.');
  const days = Math.round((end - start) / DAY) + 1;
  if (Number.isFinite(days) && (days < 1 || days > 30)) errors.push('Trips must be between 1 and 30 days, with the end on or after the start.');
  if (!Number.isInteger(Number(trip.travelers)) || Number(trip.travelers) < 1 || Number(trip.travelers) > 20) errors.push('Choose 1–20 travelers.');
  if (!Number.isFinite(Number(trip.budget)) || Number(trip.budget) < 1 || Number(trip.budget) > 1000000) errors.push('Enter a total trip budget between $1 and $1,000,000 USD.');
  if (!String(trip.country || '').trim()) errors.push('Choose a destination country.');
  for (const field of ['country','city','origin']) if(typeof trip[field] !== 'string' || !trip[field].trim() || trip[field].length > 120) errors.push(`Enter a ${field} between 1 and 120 characters.`);
  return {valid: errors.length === 0, errors, days: Number.isFinite(days) ? days : 0};
}
export function estimateBudget(trip) {
  const checked = validateTrip(trip);
  if (!checked.valid) throw new RangeError(checked.errors.join(' '));
  const total = Number(trip.budget), people = Number(trip.travelers);
  const categories = [ ['Accommodation', .40], ['Food', .25], ['Local transport', .15], ['Activities', .10], ['Contingency', .10] ];
  let allocated = 0;
  const breakdown = categories.map(([name, share], index) => {
    const amount = index === categories.length - 1 ? total - allocated : Math.round(total * share * 100) / 100;
    allocated += amount;
    return {name, amount: Math.round(amount * 100) / 100, share};
  });
  return {currency: 'USD', total, days: checked.days, perPersonPerDay: total / people / checked.days, breakdown,
    disclaimer: 'Planning allocation only, not local market prices. Total covers the group and excludes flights, visas, insurance and international transfers. No live rates or availability.',
    assumptions: ['40% lodging, 25% food, 15% local transport, 10% activities, 10% contingency.', 'Travelers share the total budget; accommodation needs depend on room occupancy.']};
}
export function haversine(a, b) {
  const raw = [a?.lat,a?.lon,b?.lat,b?.lon];
  if (raw.some(value => value === null || value === undefined || value === '')) return null;
  const values = raw.map(Number);
  if (values.some(v => !Number.isFinite(v)) || [values[0],values[2]].some(v => Math.abs(v)>90) || [values[1],values[3]].some(v=>Math.abs(v)>180)) return null;
  const [lat1,lon1,lat2,lon2] = values.map(v => v*Math.PI/180);
  const h = Math.sin((lat2-lat1)/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin((lon2-lon1)/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1,h)));
}
export function rankHotels(hotels = [], anchor) {
  return hotels.map(hotel=>({...hotel,distanceKm:haversine(hotel,anchor),distanceLabel:'Straight-line distance; road distance and travel time may differ.'}))
    .filter(hotel=>hotel.distanceKm !== null).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,12);
}
export function buildItinerary(trip, places = []) {
  const checked = validateTrip(trip);
  if (!checked.valid) throw new RangeError(checked.errors.join(' '));
  const available = places.filter(place=>place && typeof place.name === 'string' && place.name.trim());
  const pace = trip.style === 'slow' ? 1 : 2;
  return Array.from({length: checked.days}, (_,index)=> {
    const assigned = index === 0 ? [] : available.slice((index-1)*pace,(index-1)*pace+pace);
    return {day:index+1,date:new Date(dateValue(trip.startDate)+index*DAY).toISOString().slice(0,10),
      title:index===0?'Arrive and settle in':assigned.length?'Explore at your pace':'Flexible discovery day',
      activities:assigned.length?assigned.map(place=>({name:place.name,lat:place.lat,lon:place.lon,source:place.source || 'OpenStreetMap',note:'Verify opening hours, admission, accessibility and travel time.'})):[{name:index===0?'Check arrival transport and your accommodation':'Choose a local walk, museum or rest day',note:'No verified attraction data available for this slot.'}],
      transport:index===0?'Compare airport public transport, licensed taxis and accommodation transfer options on official airport pages.':'Check official local transit routes; this plan does not calculate routes or journey times.'};
  });
}
export function bookingLinks(trip) {
  const destination = [trip.city,trip.country].filter(Boolean).join(', ');
  const query = (base, params) => `${base}?${new URLSearchParams(params)}`;
  return {
    flights:query('https://www.google.com/search',{q:`Google Flights from ${trip.origin || 'your origin'} to ${destination} on ${trip.startDate || ''} returning ${trip.endDate || ''} for ${trip.travelers || 1} travelers`}),
    hotels:query('https://www.booking.com/searchresults.html',{ss:destination,checkin:trip.startDate || '',checkout:trip.endDate || '',group_adults:String(trip.travelers || 1),no_rooms:String(Math.ceil(Number(trip.travelers || 1)/2))}),
    map:query('https://www.openstreetmap.org/search',{query:destination}),
    airportHotels:query('https://www.booking.com/searchresults.html',{ss:`${destination} airport`}),
    requirements:query('https://www.google.com/search',{q:`${trip.country || ''} official government entry visa requirements nationality`})
  };
}
export function verificationChecklist(trip) {
  return ['Check your nationality-specific visa and passport rules on the destination government or embassy website.',
    'Check official travel advisories and public health requirements before booking and departure.',
    'Confirm flight schedules, baggage and total fares with the airline or booking provider.',
    'Verify hotel location, availability, cancellation terms and total price before paying.',
    'Check official airport transport hours and licensed transfer options, especially for late arrivals.',
    `Verify attraction hours and local conditions in ${trip.city || trip.country || 'your destination'}; map listings may be incomplete or outdated.`,
    'Check accessibility, insurance coverage, emergency contacts and local currency.'];
}
export function runAgents(trip, places = [], hotels = [], anchor = places[0]) {
  const checked = validateTrip(trip);
  if (!checked.valid) return {...checked,agents:[]};
  return {valid:true,errors:[],agents:[
    {name:'Destination researcher',status:places.length?'Map listings found':'Choose a city and load map listings'},
    {name:'Flight navigator',status:'Official search handoff; no live fares'},
    {name:'Hotel proximity analyst',status:anchor?'Straight-line ranking':'Choose an airport or attraction anchor'},
    {name:'Itinerary planner',status:'Flexible deterministic schedule'},
    {name:'Budget allocator',status:'Transparent allocation; flights excluded'},
    {name:'Safety verifier',status:'Verification checklist; requirements are not independently verified'}
  ],budget:estimateBudget(trip),itinerary:buildItinerary(trip,places),hotels:anchor?rankHotels(hotels,anchor):[],links:bookingLinks(trip),checklist:verificationChecklist(trip)};
}
