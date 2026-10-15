import { timingSafeEqual } from 'node:crypto';
import { validateTrip } from '../planner.mjs';
import {readBoundedText} from '../bounded-source-response.mjs';

const MAX_BODY_BYTES = 12000;
const MAX_RESPONSE_BYTES = 32000;
const cleanText = (value, max = 120) => String(value ?? '').trim().slice(0, max);

function reply(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}
function safeEqual(a, b) {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}
function normalizeTrip(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  return {
    country: cleanText(input.country),
    city: cleanText(input.city),
    origin: cleanText(input.origin),
    startDate: cleanText(input.startDate, 10),
    endDate: cleanText(input.endDate, 10),
    travelers: Number(input.travelers),
    budget: Number(input.budget),
    style: input.style === 'slow' ? 'slow' : 'balanced'
  };
}
function cleanResult(value) {
  const agents = Array.isArray(value?.agents) ? value.agents : [];
  if (value?.ok !== true || agents.length !== 3) return null;
  const normalized = agents.map(a => ({
    name: cleanText(a?.name, 60),
    findings: typeof a?.findings === 'string' ? a.findings.trim() : ''
  }));
  if (normalized.some(a => !a.name || !a.findings || a.findings.length > 6500)) return null;
  const candidate = cleanText(value.sourceUrl, 600);
  let sourceUrl = null;
  try {
    const url = new URL(candidate);
    if (url.protocol === 'https:' && (url.hostname === 'wikipedia.org' || url.hostname.endsWith('.wikipedia.org'))) sourceUrl = url.href;
  } catch { /* no verified destination source available */ }
  return {
    ok: true, provider: 'Groq via n8n', agents: normalized, sourceUrl,
    limitations: [
      'AI planning guidance is not independently verified travel advice.',
      'No live flight fares, accommodation inventory, booking guarantees, visa determinations, or route times.'
    ]
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(res, 405, { ok: false, error: 'Method not allowed.' });
  }
  if (process.env.WAYFARER_AI_ENABLED !== 'true') {
    return reply(res, 503, { ok: false, error: 'AI beta is not configured. The free local planner is still available.' });
  }
  const betaToken = process.env.WAYFARER_AI_BETA_TOKEN || '';
  const presentedToken = cleanText(req.headers?.['x-wayfarer-beta-token'], 512);
  if (!betaToken || !safeEqual(presentedToken, betaToken)) {
    return reply(res, 401, { ok: false, error: 'Invalid AI beta access code.' });
  }
  const webhook = process.env.N8N_WEBHOOK_URL || '';
  const webhookAuth = process.env.N8N_WEBHOOK_AUTH || '';
  let url;
  try {
    url = new URL(webhook);
    if (url.protocol !== 'https:' || url.username || url.password || !url.pathname.includes('/webhook/')) throw Error();
  } catch {
    return reply(res, 503, { ok: false, error: 'AI workflow endpoint is not configured.' });
  }
  if (webhookAuth.length < 16) {
    return reply(res, 503, { ok: false, error: 'AI workflow authentication is not configured.' });
  }
  let input;
  try {
    if (Number(req.headers?.['content-length'] || 0) > MAX_BODY_BYTES) throw Error('oversize');
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (Buffer.byteLength(JSON.stringify(body ?? {})) > MAX_BODY_BYTES) throw Error('oversize');
    input = normalizeTrip(body?.trip);
  } catch {
    return reply(res, 400, { ok: false, error: 'Invalid trip request.' });
  }
  const check = validateTrip(input || {});
  if (!check.valid) return reply(res, 400, { ok: false, error: check.errors.join(' ') });
  try {
    const upstream = await fetch(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Wayfarer-Secret': webhookAuth },
      body: JSON.stringify({ trip: input }),
      signal: AbortSignal.timeout(25000),redirect:'error'
    });
    if (!upstream.ok) {
      return reply(res, upstream.status === 429 ? 429 : 502, {
        ok: false, error: upstream.status === 429 ? 'AI limit reached. Try again later.' : 'AI agents are temporarily unavailable.'
      });
    }
    if (Number(upstream.headers.get('content-length') || 0) > MAX_RESPONSE_BYTES) throw Error('oversize');
    const responseText = await readBoundedText(upstream,MAX_RESPONSE_BYTES);
    const result = cleanResult(JSON.parse(responseText));
    if (!result) throw Error('malformed');
    return reply(res, 200, result);
  } catch {
    return reply(res, 502, { ok: false, error: 'The AI workflow timed out or returned an invalid response. Your local trip plan is unchanged.' });
  }
}
