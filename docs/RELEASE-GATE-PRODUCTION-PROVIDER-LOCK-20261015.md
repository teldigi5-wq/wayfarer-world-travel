# Wayfarer — Release Gate Follow-up 02: Public Production Provider Lock

**Date:** 2026-10-15 · **Status:** Source-level protection implemented and in draft review; **NO-GO** commercial release.

This control addresses one concrete billing/security risk identified in Stage 49: optional supplier endpoints formerly allowed a private beta token, provider API key and feature toggle to enable provider calls directly on a Vercel Production runtime. Their instance-local counters are **not** a durable per-user quota and cannot be relied upon to limit billable usage across serverless replicas.

## What changed

A shared `provider-production-lock.mjs` guard now checks Vercel's server-side target and fails **closed** for `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production`, or Vercel runtime environments without a recognized private `preview`/`development` target. An optional `WAYFARER_DISABLE_METERED_PROVIDERS=true` flag also disables the integrations on private previews or local test environments.

The lock covers **all six known metered provider entry points**:

| Server endpoint | Outbound provider operation blocked on Vercel Production | Safe fallback |
| --- | --- | --- |
| `api/travel-offers.mjs` | SerpApi Google Flights and Google Hotels search | Results explicitly marked `not_connected` and `mode:production_locked` |
| `api/travel-search.js` | SerpApi search for flight quotes and hotel totals | Non-bookable, disconnected search cards |
| `api/flight-selection.mjs` | SerpApi provider token follow-up / booking seller lookups | Safe 503; no provider call |
| `api/airline-offers.mjs` | Duffel test/live offer requests and refreshes | Disconnected offers, never a booking |
| `api/ai-plan.mjs` | Private n8n workflow with potentially metered AI agents | Safe 503; local planning remains |
| `api/intelligence.js` | Groq API itinerary composition | **Public** Open-Meteo/Wikipedia/REST Countries source research still functions; AI reports private beta unavailable |

Even if someone configures `SERPAPI_API_KEY`, `DUFFEL_ACCESS_TOKEN`, `GROQ_API_KEY`, `N8N_WEBHOOK_AUTH`, turns on all existing feature flags and provides a valid beta code, this version of the application **does not** make these optional metered provider requests from Vercel Production.

## Evidence and scope

- Integration tests in `tests/production-metered-provider-lock.test.mjs` instantiate the real handler modules, set fake private credentials and all feature flags, and intercept all outbound requests. They assert that SerpApi, Duffel, n8n and Groq use **zero** metered provider calls under Production conditions and that public-source research still responds.
- The same tests check preview/development behavior and unknown Vercel target fail-closed rules without weakening the existing explicit beta flag + credential checks.
- This is a **code-level spend-containment gate, not a distributed rate limiter** or blanket guarantee of zero financial costs. A future provider enablement requires a separate, explicit code review **plus** durable identity-based quotas, spend caps in provider consoles, authenticated access, billing alarms and an independent owner approval.
- This guard depends on authentic **server-side Vercel runtime environment variables**. It does not attest to custom/non-Vercel hosts, tampered deployments or external systems.
- It does not disable external **free** research such as Open-Meteo, Wikipedia or REST Countries, but third-party acceptable-use rules and their operational costs/quotas remain separate.
- It does not change keys, account billing, Vercel settings, API permissions, repository history or any Production deployment.
- The release checker includes the guard as an additional **source-level** check and retains NO_GO while legal/privacy, Preview/mobile/browser QA, full history secret review, independent security testing and owner/merge gates remain unsatisfied.

## Owner verification steps before any supplier activation

1. Inspect the deployed exact SHA and verify that it includes the shared lock and all six guarded endpoints. Do **not** assume GitHub `main` is the currently deployed SHA.
2. Check public Production responses for the truthful disabled modes and monitor request/egress metrics for **zero** paid-provider calls. This requires real browser/network QA and an exact-commit Preview; neither is established by unit tests alone.
3. To later enable chargeable APIs in Production, design a durable per-identity limit backed by an atomic quota service, hard provider-account spending caps and alerts, and least-privilege per-environment secrets. Review the implementation and test under concurrency/multi-instance conditions.
4. Obtain explicit new approval for unlocking a reviewed target commit. Changes must be tested on a Preview before any main merge/Production promotion. Keep the PR draft until the separate release gates close.

**Conclusion:** a specific accidental Production spending path is code-closed, while the broader public/commercial release status remains **NO-GO**.
