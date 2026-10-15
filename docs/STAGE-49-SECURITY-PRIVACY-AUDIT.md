# Stage 49 — Targeted security, privacy and performance audit

**Scope:** Wayfarer AI repository `teldigi5-wq/wayfarer-world-travel`, stacked draft development branch based on Stage 48. This is a code/configuration hardening pass, **not** a penetration-test certificate or guarantee against data breaches.

## Remediations implemented

| Priority | Affected surface | Finding and remediation | Evidence |
| --- | --- | --- | --- |
| High | Private n8n webhook / Groq AI | Credential-bearing `fetch` calls could follow HTTP redirects by default. Set `redirect: 'error'` on the n8n and Groq calls; no automatic redirect to an unrelated destination. | `api/ai-plan.mjs`, `api/intelligence.js`, `tests/security-response-bounds.test.mjs` |
| High | Optional paid fare/hotel/airline providers | Requests to key-bearing SerpApi endpoints and authenticated Duffel endpoints now fail closed on redirects. Provider credentials remain server-side and optional. | `api/travel-offers.mjs`, `api/travel-search.js`, `api/flight-selection.mjs`, `api/airline-offers.mjs` |
| Medium | Upstream HTTP responses | Calling `response.text()` before checking actual body length allowed chunked responses with missing or untrusted `Content-Length` to be accumulated into memory. New streaming bounded reader checks byte count per chunk, cancels on overflow and handles malformed UTF-8. Applied to private provider responses and public `getJson` source research. | `bounded-source-response.mjs`, `agent-runtime.mjs`, corresponding protected API routes |
| Medium | Public source links in Journey Studio / Arrival | HTML-escaped URLs were not sufficient against unsafe URL schemes or lookalike hostnames. Links now require exact HTTPS origin-host allowlists and credential-free URLs; external links use `noopener noreferrer`. Bad links render as plain non-clickable status. | `premium-app.js`, `tests/security-response-bounds.test.mjs` |
| Medium | Browser security response headers | Added HSTS (one year, **no includeSubDomains**), `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `X-Permitted-Cross-Domain-Policies: none` and CSP `upgrade-insecure-requests` while retaining explicit image/frame/font/CSP host allowlists. **Do not enable COEP** without verifying third-party OSM frame/image compatibility. | `vercel.json`, regression tests |

The existing `script-src 'self'`, no inline-script policy, `frame-ancestors 'none'`, `connect-src 'self'`, input validation, server-side token-gated private AI and supplier adapters, source provenance, and anonymous public reference limitation remain.

## Security and operational limitations — unresolved release blockers

1. **Durable distributed rate limits**: private supplier endpoints currently use best-effort instance-local memory counters. Serverless instances and forged or shared forwarded-address data make these insufficient as a contractual per-user/per-account quota. **Do not enable billable providers in public launch** until durable identity-bound quotas, spend caps, abuse monitoring and provider-account hard limits are proven. In-memory cooldown is not a replacement.
2. **Browser-local trip confidentiality**: saved itineraries and checklist progress live in unencrypted localStorage, readable by scripts under the same origin and other users of a shared browser profile. This is disclosed in UI; do not claim encrypted cloud persistence or multi-device sync. Avoid storing passport numbers, private contact details or payment credentials.
3. **Git repository full-history secret review**: scope of this pass is the current code and selected deployment configuration. A full private Git history scan, provider console audit, and detection of previously committed secret keys **were not performed or certified**. Enable repository secret scanning / push protection where available, inspect history with an approved security tool, and rotate any exposed key; rewriting history requires separate approval.
4. **Live supplier and map QA**: optional Groq, SerpApi, Duffel, n8n and real OSM/NASA responses were not verified against an exact-head Vercel Preview or real browser/network due to prior free-tier deployment restrictions. Mocked tests do not prove actual provider uptime, correct authentication, operational flight inventory, verified rates or completed reservations.
5. **True external penetration test**: no public internet fuzz testing, authenticated app pentest, WAF/CDN configuration audit, supply-chain attestation, independent browser security inspection or production load test has been performed here. A zero-vulnerability guarantee would be unjustified.
6. **External integrations**: linked hosts (NASA, GitHub raw, OpenStreetMap, Open-Meteo, Wikipedia, Wikidata) have their own changing uptime, terms and rate controls. No paid integration or automatic price lookup was added in this stage.

## Required Stage 50 go/no-go checks

- Verify each stacked PR has been reviewed, is mergeable and has passing GitHub checks at the **current** SHA. Review and merge in dependency order only after owner authorization.
- Test the exact merged commit on an exact-SHA Preview if within the free Hobby allowance. Verify response headers on actual Vercel HTTPS, including HSTS and CSP. Inspect COOP/window.open behaviors and OSM iframe compatibility.
- Run full build, syntax checks, tests, keyboard/mobile QA, realistic image/proxy failure tests, network tab inspection for credentials and third-party requests, and authorized security scans.
- Independently check GitHub full-history secret scanning, least-privilege env scopes, Vercel access settings, supplier billing ceilings and webhook signing/access policies.
- Keep optional paid capabilities **disabled** pending documented, approved distributed abuse controls. Flight/hotel display must never claim verified inventory, schedules or completed bookings without direct supplier evidence.
- Leave Production on its current SHA and keep this PR a draft until the above is explicitly reviewed and approved.

**Engineering interpretation:** Passing tests confirms the tested code paths only. These controls reduce specific classes of risk; they do not eliminate data leakage, provider abuse, browser compromises or unsafe configurations elsewhere.
