// Every public intelligence request can receive data from multiple outside providers.
// Limit *decoded* response bytes before JSON.parse to prevent oversized provider
// payloads from exhausting an individual serverless function's memory budget.
// This complements, but does not replace, distributed rate limits.
export const MAX_INTELLIGENCE_JSON_BYTES = 512 * 1024;

export async function fetchIntelligenceJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error('Intelligence provider unavailable');

  const announced = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(announced) && announced > MAX_INTELLIGENCE_JSON_BYTES) {
    throw new Error('Intelligence provider response too large');
  }

  const reader = response.body?.getReader?.();
  if (!reader) {
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_INTELLIGENCE_JSON_BYTES) {
      throw new Error('Intelligence provider response too large');
    }
    return JSON.parse(raw);
  }

  const parts = [];
  let total = 0;
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      total += value.byteLength;
      if (total > MAX_INTELLIGENCE_JSON_BYTES) {
        throw new Error('Intelligence provider response too large');
      }
      parts.push(value);
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
