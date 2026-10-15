# Wayfarer — Release Gate: Serverless API Routing Without Provider Calls

**Date:** October 15, 2026 · **Parent:** draft PR #58  
**Decision:** **NO-GO** for release; this is an *opt-in API method-boundary check*, not deployed functional QA.

## Risk being addressed

PR #56 introduced `outputDirectory: "public"` for deterministic static Vercel builds, preserving eight root-level `api/*` functions. PRs #57–#58 added browser-static HTTPS exposure checks, but intentionally never touched the serverless APIs. A complete release still requires proof that Vercel discovers those functions with the changed output directory and that a protected call will not unexpectedly activate SerpApi, Duffel, n8n or Groq.

## Implementation and tested boundaries

`api-method-probes.mjs` declares the eight routes, their source files, **accepted HTTP methods**, and the single opposite-method probe:

| Vercel route | Accepted | Non-executing probe |
| --- | --- | --- |
| `/api/intelligence` | GET | POST with **no body** |
| `/api/explore` | GET | POST with **no body** |
| `/api/hotels` | GET | POST with **no body** |
| `/api/travel-search` | POST | GET |
| `/api/ai-plan` | POST | GET |
| `/api/travel-offers` | POST | GET |
| `/api/flight-selection` | POST | GET |
| `/api/airline-offers` | POST | GET |

The **local real-handler test** imports all eight actual API implementations, sets synthetic beta/provider flags and keys, and installs a `fetch` interceptor that fails on any third-party call. Every route must respond **405 Method Not Allowed**, with JSON error, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and `Allow` when that handler promises it. The tests prove these requests are rejected before any provider operation in the reviewed code at that exact SHA.

`scripts/verify-vercel-api-routes.mjs` provides an **optional remote Preview probe**, not automatically executed in CI. It uses only the eight rejected methods above, never an accepted method, and sends no body, beta code, cookies, auth headers or travel/AI prompts. Redirects are disallowed, and the script does not read or log any HTTP response body. It checks 405 + expected JSON/security headers, and returns only statuses, route names and booleans.

The tool rejects the public Production alias and requires a **hostname supplied separately from authenticated Vercel project deployment metadata**. This is manual host-string comparison, *not* independent project-ownership verification. Each request can still consume a Vercel serverless invocation; run **only on an owner-authorized exact-commit Preview**, not repeatedly on Production.

### Future authorized execution

1. In Vercel, identify the Wayfarer Preview deployment ID, verified project, exact branch commit and URL.
2. Confirm no paid-provider bypass or secrets exposure, and ensure the owner approves the eight rejected-method requests.
3. Execute once, with the **metadata-verified exact hostname**:

```bash
npm run verify:api-routing -- \
  --url https://wayfarer-world-travel-VERIFIED-PREVIEW.vercel.app/ \
  --expected-hostname wayfarer-world-travel-VERIFIED-PREVIEW.vercel.app
```

Possible outcomes: `API_METHOD_GATE_EVIDENCE_ONLY` (all eight route methods rejected with required response fingerprint), `FAIL` (a wrong route or response), `INCONCLUSIVE` (network/protected Preview), or `INCONCLUSIVE_PROTECTED` (all routes return authorization barriers). Passing is only **route/method evidence**, never accepted-method functionality, live supplier coverage, real ticket inventory, production deploy safety or a claim that the Preview matches the desired Git SHA.

## CI evidence

```bash
npm run check
npm run test:api-method-gates   # real eight handlers + mocked transport; no outbound calls
npm test                        # full regression suite includes API tests
npm run release:report          # source-level check, still NO_GO
```

The normal GitHub Checks job runs `npm run test:api-method-gates` independently from the full regression suite. It does **not** invoke the remote `verify:api-routing` command. The release source checker includes `serverless-api-rejected-method-gate` and keeps a separate manual `deployed-api-function-routing` gate **BLOCKED**.

## Remaining release blockers

An exact-SHA Preview still needs **real API routing plus carefully scoped accepted-method functional tests** (especially authenticated, opt-in provider cases), deployed static path and CSP tests, mobile/browser map/globe/performance/accessibility QA, security owner review of five historical credential fixtures, Vercel Preview secret scope and GitHub protections, verified operator/legal privacy/terms, independent provider quotas/spend limits and explicit owner permission before any merge or Production deployment.

**No Preview or Production deployment, merge, provider credential read, paid search, billing change, API activation or account configuration mutation occurred in this task.**
