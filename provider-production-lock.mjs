/* A hard, non-overridable Vercel Production lock for optional metered
   provider calls. Vercel Preview/Development may still use the existing
   explicit feature switches, beta access and provider credentials.
   This is a spend-containment guard, NOT a distributed rate limiter.
   Production enablement requires a new reviewed code change after durable
   per-identity quotas, budget caps and an independent approval. */
export function meteredProviderLocked(env=process.env){
  return env?.VERCEL_ENV==='production' ||
    env?.VERCEL_TARGET_ENV==='production' ||
    env?.WAYFARER_DISABLE_METERED_PROVIDERS==='true';
}

export const PRODUCTION_PROVIDER_LOCK_NOTE =
  'Live provider lookups are disabled on this public release until durable spend and abuse controls are verified.';
