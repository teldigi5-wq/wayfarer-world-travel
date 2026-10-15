# Wayfarer — Serverless Accepted-Method Input and Authorization Gates

**Review:** 2026-10-15 · **Parent:** draft PR #59 · **Release decision:** **NO-GO**

## Verified gap

PR #59 established that all eight serverless handlers reject the wrong HTTP method with 405 before reaching third-party providers. Those checks did not prove what happens after using each route's **accepted** method with unauthenticated or malformed user input. A safe release needs to reject these requests before either public geocoding research or private metered supplier/AI access is invoked.

## Implemented tests

`tests/api-safe-input-gates.test.mjs` imports the **real eight handler modules**, installs a `globalThis.fetch` interceptor that counts and rejects all outbound requests, and configures synthetic (non-operational) beta/provider values in the isolated Node test process. It tests:

- The **five private POST routes** `/api/travel-search`, `/api/ai-plan`, `/api/travel-offers`, `/api/flight-selection` and `/api/airline-offers`: valid HTTP method **without a private beta token** must return 401.
- The same five private routes **with a matching synthetic beta token** but malformed JSON, an empty structured body or an oversized structured payload must return 400 before provider calls.
- Three public GET routes — `/api/intelligence`, `/api/explore`, and `/api/hotels` — reject clearly invalid destination, missing/partial geographic coordinates or invalid hotel location fields with 400.
- Every checked response includes `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, a safe `ok:false` JSON error and **zero external network requests**, even while optional private-provider flags are switched on in the synthetic process.
- Error messages must not reflect synthetic keys or beta codes. The test explicitly restores the original process environment and fetch function.

These are **code-level tests on real handlers**, not simulated implementations of accepted request validation. They run independently using `npm run test:api-safe-inputs`, and within the full `npm test` suite. GitHub's Checks workflow now executes the independent test target.

## Why this is not deployed evidence

This test does **not** verify positive accepted-method behavior, live airline/hotel suppliers, real AI orchestration, source service availability or actual Vercel Function discovery after `outputDirectory: public`. It cannot replace a real exact-SHA Preview and actual HTTPS request verification. The route checker introduced in PR #59 still limits optional remote probes to rejected methods, with no body or credentials. It must **not** be upgraded to authorized functional provider calls without a separate review, durable quotas and budget approvals.

The release source checker includes `serverless-api-accepted-input-guards`; the independent `deployed-api-function-routing` blocker remains **BLOCKED**, as do deployed static output, mobile/browser QA, full secret/provider-owner review, legally approved privacy/terms, protected merge process and explicit owner Production approval.

## Commands

```bash
npm run build
npm run check
npm run test:api-safe-inputs
npm test
npm run release:report  # source checks pass, release remains NO_GO
```

**No Vercel Preview or Production deployment, PR merge, paid provider activation, credential read, settings change or billing activity occurred.**
