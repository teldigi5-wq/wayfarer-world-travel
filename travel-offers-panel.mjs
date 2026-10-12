// Optional beta research UI. Never converts AI prose into "live price" or booking claims.
const byId = id => document.getElementById(id);
const button = byId('travel-offers-check');
const status = byId('travel-offers-status');
const results = byId('travel-offers-results');

function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = String(value ?? '');
  if (className) node.className = className;
  return node;
}
function link(href, title) {
  const node = document.createElement('a');
  const url = new URL(href, location.href);
  if (url.protocol !== 'https:' || ![
    'www.google.com','www.booking.com'
  ].includes(url.hostname)) return text('span', 'Link unavailable');
  node.href = url.href;
  node.rel = 'noopener noreferrer';
  node.target = '_blank';
  node.textContent = title + ' ↗';
  return node;
}
function currency(price, code) {
  return /^[A-Z]{3}$/.test(code || '') && /^\d+(\.\d{2})?$/.test(String(price || ''))
    ? code + ' ' + price
    : 'Price unavailable';
}
function flightSummary(item) {
  const segments = (item.itineraries || []).map(it => (it.segments || []).map(seg =>
    [seg.airline, seg.flightNumber, seg.from, '→', seg.to, seg.departureAt, '→', seg.arrivalAt].filter(Boolean).join(' ')
  ).join(' / ')).join(' · ');
  return (segments || 'Flight details unavailable') + ' — total offer ' + currency(item.price, item.currency) +
    (item.seatsReported ? ' · Provider reported up to ' + item.seatsReported + ' bookable seats when checked' : '');
}
function hotelSummary(item) {
  return String(item.name || 'Hotel') + ' — total supplier offer ' + currency(item.price,item.currency) +
    ' · ' + [item.checkIn,item.checkOut].filter(Boolean).join(' to ');
}
function card(title, payload, render) {
  const section = text('article', '', 'travel-offer-card');
  section.append(text('h4',title),text('p',payload.message || 'No provider details.', 'travel-offer-status'));
  if (payload.status === 'test_data') section.append(text('p',
    'Sample/cached test data — NOT LIVE. Do not use for actual availability or purchasing.', 'travel-offer-warning'));
  if (payload.status === 'offers_found') section.append(text('p',
    'Live provider search result, not a reservation. Fares and rooms can change before checkout.', 'travel-offer-warning'));
  for (const entry of (payload.results || [])) {
    const row = text('div', '', 'travel-offer-item');
    row.append(text('p',render(entry)));
    row.append(text('small', entry.bookingStatus || 'Provider data requires independent verification.'));
    section.append(row);
  }
  if (payload.researchUrl) section.append(link(payload.researchUrl, 'Research official prices and services'));
  return section;
}
if (button && status && results) button.addEventListener('click', async () => {
  results.replaceChildren();
  const code = (byId('ai-beta-code')?.value || '').trim();
  if (!code) {
    status.textContent = 'Enter the private Wayfarer beta access code above. Never enter Groq or Amadeus API secrets.';
    byId('ai-beta-code')?.focus();
    return;
  }
  const trip = Object.fromEntries(new FormData(byId('trip-form')));
  trip.travelers = Number(trip.travelers);
  trip.budget = Number(trip.budget);
  button.disabled = true;
  button.setAttribute('aria-busy','true');
  status.textContent = 'Checking connected travel providers…';
  try {
    const resp = await fetch('/api/travel-offers', {
      method:'POST',
      headers:{'Content-Type':'application/json','X-Wayfarer-Beta-Token':code},
      body:JSON.stringify({trip}),
      signal:AbortSignal.timeout(29000)
    });
    const payload = await resp.json();
    if (!resp.ok || !payload.ok) throw Error(payload.error || 'Provider search unavailable');
    const label = payload.mode === 'production' ? 'Production provider search' :
      payload.mode === 'test' ? 'Amadeus test mode — NOT LIVE' : 'No live providers connected';
    status.textContent = label + (payload.checkedAt ? ' · Checked ' + new Date(payload.checkedAt).toLocaleString() : '');
    results.append(
      card('Flights · ticket offers',payload.flights,flightSummary),
      card('Hotels · room offers',payload.hotels,hotelSummary),
      card('Food · menus and restaurant prices',payload.food,()=> ''),
      card('Transport · fares and services',payload.transport,()=> '')
    );
    const search = text('p', '', 'travel-offers-handoffs');
    search.append(link(payload.researchLinks.flights,'Compare flights'),text('span',' · '),
      link(payload.researchLinks.hotels,'Compare hotels'));
    results.append(search);
    results.append(text('p',(payload.limitations || []).join(' '),'travel-offer-warning'));
  } catch (error) {
    status.textContent = error?.name === 'TimeoutError'
      ? 'Provider search timed out; no availability conclusion can be drawn.'
      : (error?.message || 'Travel provider unavailable.');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
});
