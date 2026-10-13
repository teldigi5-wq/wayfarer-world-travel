// Legacy Amadeus Self-Service was retired in July 2026.
// This safe status endpoint remains until a licensed, authenticated price supplier is integrated.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => typeof value === 'string' && ISO_DATE.test(value) &&
  !Number.isNaN(Date.parse(value + 'T00:00:00Z'));
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ok:false,error:'Method not allowed'});
  }
  const query = req.query || {};
  const lat = Number(query.lat), lon = Number(query.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lon) || lon < -180 || lon > 180 ||
      !validDate(query.checkIn) || !validDate(query.checkOut) ||
      Date.parse(query.checkOut) <= Date.parse(query.checkIn)) {
    return res.status(400).json({ok:false,error:'Choose a destination and valid check-in/check-out dates.'});
  }
  return res.status(503).json({
    ok:false,connected:false,provider:'No live hotel-price supplier connected',
    error:'Live room rates are not available in this preview. Nearby hotel listings are for discovery, not prices or confirmed inventory.',
    offers:[]
  });
}
