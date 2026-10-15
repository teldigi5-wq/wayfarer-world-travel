# Wayfarer — Opt-in HTTPS Deployment Verification Gate

**Date:** 2026-10-15. **State:** Tooling prepared and tested, but **NO-GO** for public/commercial launch. No new Vercel Preview exists for this exact candidate.

## What was verified and why this stage matters

Draft PR #56 changed Wayfarer's Vercel static output to a generated `public/` containing only 40 reviewed browser assets, while preserving eight root Vercel Functions. Offline tests verified the output files and exclusions, but **never observed the actual Vercel HTTPS deployment output**. The independent release gate therefore remains blocked.

A read-only Vercel inspection queried the current Production deployment metadata, which was still READY on `main` at `2b2c27aae6a9044e538e9140c105920edd733b38`. Vercel's deployment source file-tree endpoint returned `404 file tree not found` for that Git-origin deployment. This response **does not** establish that source files are safe or exposed. The old Production build is **not** a substitute for inspecting a new exact candidate Preview.

## New isolated verification tool

Run only **after a real exact-candidate Preview has been approved and created**:

```bash
npm run verify:deployment -- --url https://wayfarer-world-travel-EXACT-DEPLOYMENT.vercel.app/
```

It requires an explicit HTTPS **Wayfarer Vercel-hosted root URL** (no username/password, path, query, fragment or nonstandard port). It does not discover arbitrary domains, follow redirects, read credentials, send cookies or authorization headers, or call **any `/api/*`**. It makes only HEAD requests to a fixed reviewed set of public static paths and non-public repository paths. All requests have an eight-second timeout, redirects are forbidden and no remote response bodies or potentially leaked files are printed.

It checks whether root and privacy pages, `premium-app.js`, `browser-data.js`, favicon and three public JSON datasets are reachable with expected MIME types. It also checks whether root server implementations, provider-lock helpers, root metadata, `.env`, Git metadata, test source and docs are inaccessible.

For the public homepage it validates the presence of CSP (script restrictions and frame-ancestor policy), `nosniff`, frame denial, referrer policy and HSTS. The report contains only response statuses and booleans — never response bodies, token text or headers that might contain credentials.

### Interpreting outcomes

- `STATIC_HTTP_PASS_ONLY`: All **specified read-only HEAD probes** returned expected statuses/types/headers. This does **not** prove the deployment corresponds to the PR SHA, that serverless APIs work, that GET and HEAD always behave identically, or that browsers have been tested.
- `FAIL`: A static asset was missing/mis-typed, a private path was publicly reachable, a required security header was missing, or there was an inconclusive network result. Investigate without deploying Production.
- `INCONCLUSIVE_PROTECTED`: The entire deployment returned access restrictions (401/403). This is **not** proof of file isolation — authentic Preview access may require a separately approved credentials-based verification mechanism. The script intentionally does not bypass protection or request a bypass token.

No path is marked safe merely because an authorization wall hides it. Redirects are not followed to login or external websites.

### Exact SHA and Vercel API verification must stay separate

Before running the script, manually verify the deployment URL/ID and **exact Git commit SHA** using the Vercel deployment metadata connector. The tool intentionally returns `exactCommitVerified:false`, `serverlessApiVerified:false`, `browserBehaviorVerified:false` and `productionApproval:false` regardless of its HTTP result.

A follow-up authenticated/sandboxed Preview validation must independently check all eight `/api/*` routes with safe malformed, unauthenticated or provider-disabled requests and verify the declared `outputDirectory=public` does not break function discovery. **Do not use paid SerpApi, Duffel, n8n or Groq requests for smoke checks**. Browser/mobile tests, maps, sources and accessibility remain unverified.

### CI and source evidence

```bash
npm run build
npm run check
npm run test:deployment-verifier   # mocked/fixture tests, no remote HTTP
npm test                         # full suite includes these tests
npm run release:report           # includes 11th source check, still NO_GO
```

CI runs isolated tests for the allowlisted target hostname, hostile URL and user-info rejection, auth-wall false-positive prevention, missing CSP/MIME failures, leaked static file detection, source-redacted reports, complete network failure and **zero API/proxy/provider queries**. It never supplies a real URL, therefore **never makes a Vercel request or costs a paid supplier credit**.

## No release approval yet

The full Git PR stack remains draft and unmerged. Vercel Preview quota must be evaluated before creating another Preview. The five historical test-file credential candidates still require manual review, as do Preview environment scoping, official legal/operator policy, durable quotas for paid features, protected GitHub branch checks and owner-approved integration/release. **Overall release verdict: NO-GO.**

No Preview or Production deployment, merged PR, credential modification, paid activation or billing adjustment occurred here.
