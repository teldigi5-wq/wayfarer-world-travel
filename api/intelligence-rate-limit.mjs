// Best-effort per-serverless-instance admission control, not a distributed quota.
// External information providers should also be protected by upstream edge quotas
// before scaling to many instances. A finite map prevents unbounded key growth.
export function createIntelligenceLimiter({
  now = Date.now, windowMs = 60_000, maxRequests = 30, maxKeys = 500,
} = {}) {
  if (windowMs <= 0 || maxRequests < 1 || maxKeys < 1) throw new RangeError('Invalid limit');
  const clients = new Map();
  return function overLimit(req) {
    const forwarded = process.env.VERCEL === '1' ? req.headers?.['x-vercel-forwarded-for'] : null;
    const verifiedHeader = typeof forwarded === 'string' &&
      /^[a-f0-9:.]{3,45}$/i.test(forwarded) ? forwarded : null;
    const key = String(verifiedHeader || req.socket?.remoteAddress ||
      req.connection?.remoteAddress || 'shared-edge').slice(0, 90);
    const time = now();
    const old = clients.get(key);
    const active = old && time - old.start < windowMs;
    const entry = {start: active ? old.start : time, count: active ? old.count + 1 : 1};
    clients.delete(key);
    clients.set(key, entry);
    if (clients.size > maxKeys) clients.delete(clients.keys().next().value);
    return entry.count > maxRequests;
  };
}
export const tooManyIntelligenceRequests = createIntelligenceLimiter();
