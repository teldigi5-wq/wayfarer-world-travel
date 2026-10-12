import { timingSafeEqual } from 'node:crypto';
import { validateTrip } from '../planner.mjs';

// Credential-gated provider adapter. No AI-generated fares and no synthetic offer data.
const MAX_REQUEST_BYTES = 12000;
const REQUEST_TIMEOUT_MS = 9000;
const cut = (value, length = 160) => String(value ?? '').trim().slice(0, length);

function response(res, status, value) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(value);
}
function equalSecret(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}
function category(status, message, results = []) { return { status, message, results }; }
function finiteMoney(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number < 1e9 ? number.toFixed(2) : null;
}
function safeCurrency(value) { return /^[A-Z]{3}$/.test(value || '') ? value : null; }
function isoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null; }
async function fetchJson(url, init = {}) {
  const result = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!result.ok) {
    const e = new Error('Provider request failed');
    e.status = result.status;
    throw e;
  }
  const text = await result.text();
  if (text.length > 1000000) throw new Error('Provider response too large');
  return JSON.parse(text);
}
function checkPlace(input, results) {
  const target = cut(input, 120).toUpperCase();
  if (/^[A-Z]{3}$/.test(target)) return target;
  const candidates = (Array.isArray(results) ? results : [])
    .filter(item => item && /^[A-Z]{3}$/.test(item.iataCode || '') && (
      cut(item.name).toUpperCase() === target ||
      cut(item.address?.cityName).toUpperCase() === target))
    .filter(item => String(item.subType || '').toUpperCase() === 'CITY');
  const codes = [...new Set(candidates.map(item => item.iataCode))];
  return codes.length === 1 ? codes[0] : null;
}
async function locationCode(base, token, input) {
  if (/^[A-Z]{3}$/.test(cut(input))) return cut(input).toUpperCase();
  const qs = new URLSearchParams({ subType: 'CITY,AIRPORT', keyword: cut(input), view: 'LIGHT' });
  const json = await fetchJson(base + '/v1/reference-data/locations?' + qs, {
    headers: { Authorization: 'Bearer ' + token }
  });
  return checkPlace(input, json.data);
}
function normalizeFlight(offer, searchedAt) {
  const price = finiteMoney(offer?.price?.grandTotal ?? offer?.price?.total);
  const currency = safeCurrency(offer?.price?.currency);
  const itineraries = (offer?.itineraries || []).slice(0, 2).map(it => ({
    duration: cut(it?.duration, 35),
    segments: (it?.segments || []).slice(0, 6).map(seg => ({
      airline: cut(seg?.carrierCode, 3),
      flightNumber: cut(seg?.number, 8),
      from: cut(seg?.departure?.iataCode, 3),
      departureAt: cut(seg?.departure?.at, 28),
      to: cut(seg?.arrival?.iataCode, 3),
      arrivalAt: cut(seg?.arrival?.at, 28)
    }))
  })).filter(it => it.segments.length);
  if (!price || !currency || !itineraries.length) return null;
  return {
    price, currency, itineraries,
    lastCheckedAt: searchedAt,
    bookingStatus: 'Provider offer found at search time; not booked. Price and seat availability require recheck before checkout.',
    seatsReported: Number.isInteger(offer?.numberOfBookableSeats) && offer.numberOfBookableSeats > 0 ? offer.numberOfBookableSeats : null
  };
}
function normalizeHotel(entry, searchedAt) {
  const offer = Array.isArray(entry?.offers) ? entry.offers[0] : null;
  const price = finiteMoney(offer?.price?.total);
  const currency = safeCurrency(offer?.price?.currency);
  const name = cut(entry?.hotel?.name);
  if (!price || !currency || !name) return null;
  return {
    name, price, currency, checkIn: isoDate(offer?.checkInDate),
    checkOut: isoDate(offer?.checkOutDate), roomType: cut(offer?.room?.typeEstimated?.category || '', 80) || null,
    lastCheckedAt: searchedAt, bookingStatus: 'Provider offer found for one shared room, not reserved. Confirm room type, taxes, cancellation and final price.'
  };
}
async function flightOffers(base, token, origin, destination, trip, searchedAt) {
  const qs = new URLSearchParams({
    originLocationCode: origin, destinationLocationCode: destination,
    departureDate: trip.startDate, returnDate: trip.endDate,
    adults: String(trip.travelers), max: '5'
  });
  const json = await fetchJson(base + '/v2/shopping/flight-offers?' + qs, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const offers = (json.data || []).map(entry => normalizeFlight(entry, searchedAt)).filter(Boolean);
  return category(offers.length ? 'offers_found' : 'no_offers',
    offers.length ? 'Provider returned priced flight offers. Ticket availability is NOT guaranteed until repricing and checkout.' :
    'This provider returned no flight offers for the search. This does not mean all tickets are sold out.', offers);
}
async function hotelOffers(base, token, city, trip, searchedAt) {
  if (trip.travelers > 2) return category('needs_details',
    'Hotel offer search currently supports one shared room for one or two adults. Multi-room occupancy has not been specified.');
  const headers = { Authorization: 'Bearer ' + token };
  const list = await fetchJson(base + '/v1/reference-data/locations/hotels/by-city?' + new URLSearchParams({
    cityCode: city, radius: '10', radiusUnit: 'KM'
  }), { headers });
  const ids = [...new Set((list.data || []).map(item => item?.hotelId).filter(v => /^[A-Z0-9]{8}$/.test(v || '')))].slice(0, 6);
  if (!ids.length) return category('no_offers', 'Provider returned no hotels for this city. This is not proof of no vacancies.');
  const qs = new URLSearchParams({
    hotelIds: ids.join(','), adults: String(trip.travelers),
    checkInDate: trip.startDate, checkOutDate: trip.endDate, roomQuantity: '1'
  });
  const offersJson = await fetchJson(base + '/v3/shopping/hotel-offers?' + qs, { headers });
  const offers = (offersJson.data || []).map(entry => normalizeHotel(entry, searchedAt)).filter(Boolean).slice(0, 6);
  return category(offers.length ? 'offers_found' : 'no_offers',
    offers.length ? 'Provider returned accommodation offers for one shared room. Verify final conditions before reserving.' :
    'Provider returned no priced hotel offers in this small sample; many other accommodations may exist.', offers);
}
function links(trip) {
  const destination = cut(trip.city, 120) + ', ' + cut(trip.country, 120);
  return {
    food: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('restaurants and menus ' + destination),
    transport: 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination) + '&travelmode=transit',
    flights: 'https://www.google.com/search?q=' + encodeURIComponent('Google Flights ' + trip.origin + ' to ' + destination + ' ' + trip.startDate + ' ' + trip.endDate),
    hotels: 'https://www.booking.com/searchresults.html?' + new URLSearchParams({
      ss: destination, checkin: trip.startDate, checkout: trip.endDate, group_adults: String(trip.travelers)
    })
  };
}
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return response(res, 405, { ok: false, error: 'Method not allowed.' });
  }
  const expected = process.env.WAYFARER_AI_BETA_TOKEN || '';
  if (!expected || !equalSecret(req.headers?.['x-wayfarer-beta-token'] || '', expected)) {
    return response(res, 401, { ok: false, error: 'Invalid private beta access code.' });
  }
  let trip;
  try {
    if (Number(req.headers?.['content-length'] || 0) > MAX_REQUEST_BYTES) throw Error();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (Buffer.byteLength(JSON.stringify(body || {})) > MAX_REQUEST_BYTES) throw Error();
    const raw = body?.trip || {};
    trip = { country: cut(raw.country, 120), city: cut(raw.city, 120), origin: cut(raw.origin, 120),
      startDate: cut(raw.startDate, 10), endDate: cut(raw.endDate, 10), travelers: Number(raw.travelers),
      budget: Number(raw.budget), style: raw.style === 'slow' ? 'slow' : 'balanced' };
  } catch { return response(res, 400, { ok: false, error: 'Invalid JSON trip payload.' }); }
  const valid = validateTrip(trip);
  if (!valid.valid) return response(res, 400, { ok: false, error: valid.errors.join(' ') });

  const refs = links(trip);
  const data = {
    ok: true, provider: 'Amadeus Self-Service', mode: 'not_configured', checkedAt: null,
    flights: category('not_connected', 'Live flight fares and seat availability need an authorized production provider.'),
    hotels: category('not_connected', 'Live hotel inventory and prices need an authorized production provider.'),
    food: { ...category('not_connected', 'No reliable worldwide live menu/food price provider is connected. Check the restaurant menu directly.'), researchUrl: refs.food },
    transport: { ...category('not_connected', 'Live transit fares, routes and operating status are not integrated. Verify with the local transport operator.'), researchUrl: refs.transport },
    researchLinks: { flights: refs.flights, hotels: refs.hotels },
    limitations: [
      'No flight tickets or hotel rooms have been booked.',
      'An offer found by a supplier is not a guarantee of seats or a final checkout price.',
      'Food and local transportation prices are unavailable until licensed live provider integrations exist.',
      'Flights are outside the group USD ground budget.'
    ]
  };
  const enabled = process.env.WAYFARER_TRAVEL_ENABLED === 'true';
  const client = process.env.AMADEUS_CLIENT_ID || '';
  const secret = process.env.AMADEUS_CLIENT_SECRET || '';
  if (!enabled || !client || !secret) return response(res, 200, data);

  const production = process.env.AMADEUS_ENV === 'production';
  const base = production ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
  data.mode = production ? 'production' : 'test';
  data.checkedAt = new Date().toISOString();
  const unavailable = label => category('unavailable', label + ' query could not be completed; no availability conclusion can be made.');
  try {
    const form = new URLSearchParams({ grant_type: 'client_credentials', client_id: client, client_secret: secret });
    const auth = await fetchJson(base + '/v1/security/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form
    });
    if (typeof auth.access_token !== 'string' || !auth.access_token) throw Error('OAuth returned no access token');
    const token = auth.access_token;
    const [origin, city] = await Promise.allSettled([
      locationCode(base, token, trip.origin), locationCode(base, token, trip.city)
    ]);
    const sourceCode = origin.status === 'fulfilled' ? origin.value : null;
    const destinationCode = city.status === 'fulfilled' ? city.value : null;
    if (!sourceCode || !destinationCode) {
      data.flights = category('needs_details', 'Could not uniquely resolve origin and destination to IATA city codes. Enter valid IATA codes or clearer city names.');
      data.hotels = category('needs_details', 'Could not uniquely resolve destination city code for hotel search.');
    } else {
      const [flights, hotels] = await Promise.allSettled([
        trip.travelers <= 9 ? flightOffers(base, token, sourceCode, destinationCode, trip, data.checkedAt) : Promise.resolve(category('needs_details', 'Flight API query supports at most 9 adults; split group searches.')),
        hotelOffers(base, token, destinationCode, trip, data.checkedAt)
      ]);
      data.flights = flights.status === 'fulfilled' ? flights.value : unavailable('Flight');
      data.hotels = hotels.status === 'fulfilled' ? hotels.value : unavailable('Hotel');
    }
  } catch {
    data.flights = unavailable('Flight provider');
    data.hotels = unavailable('Hotel provider');
  }
  if (!production) {
    for (const name of ['flights', 'hotels']) {
      if (data[name].status === 'offers_found') {
        data[name].status = 'test_data';
        data[name].message = 'TEST ENVIRONMENT / LIMITED CACHED DATA — not live availability, price or bookable inventory.';
      }
    }
  }
  return response(res, 200, data);
}
