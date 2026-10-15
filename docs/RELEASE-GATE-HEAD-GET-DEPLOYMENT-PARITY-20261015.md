# Wayfarer — Release Gate Follow-up: HTTPS HEAD/GET Parity and Deployment Identity

**Date:** 2026-10-15 · **Parent:** draft PR #57 · **Launch status:** **NO-GO**

## Confirmed verification gaps

The original read-only HTTPS deployment inspector used only `HEAD` requests. Many web servers and edge runtimes implement `HEAD` differently from `GET`. A 404 on `HEAD /package.json` cannot establish that `GET /package.json` is equally denied, and a successful public static `HEAD` cannot prove a browser's `GET` will load. The inspector also accepted *any* `wayfarer-world-travel-*.vercel.app` hostname based solely on its name. Neither pattern is strong evidence that a deployment belongs to the expected project.

## Changes implemented

- The **public assets and private source probes** now use **both HEAD and GET**. All GET requests include `Range: bytes=0-0`, `redirect: 'error'`, no credentials, no referrer and an eight-second per-request timeout; no response body is decoded, logged, saved or compared. If the server ignores Range, the body is still explicitly cancelled rather than consumed.
- Public asset status and MIME must be valid on **both methods**. A bounded GET may return `206 Partial Content` (or `200 OK`) and still be valid. Homepage CSP and the other required security headers must appear on both HEAD and GET.
- An internal repository path is considered unavailable only if **both methods return 404 or 410**. A HEAD 404 + GET 200/206 leak or a HEAD 200 + GET 404 mismatch is a **FAIL** and is reported by path and method; file contents are never shown.
- Network errors, redirects, and partial authentication barriers return **INCONCLUSIVE**, not an accidental PASS. A fully protected 401/403 deployment returns `INCONCLUSIVE_PROTECTED`, not proof of absent private files.
- The canonical Wayfarer Production hostname is allowed directly, but **Preview hostnames must exactly match a reviewer-supplied `--expected-hostname`**, derived from the connected **authenticated Vercel deployment metadata for this specific project**, rather than relying solely on a prefix. This is still a *manual comparison*, not independent cryptographic project ownership verification: the report explicitly keeps `deploymentOwnershipVerified: false` and `exactCommitVerified: false`. A user-supplied matching string alone must not be mistaken for authorization.
- The reporter retains `serverlessApiVerified:false`, `browserBehaviorVerified:false` and `productionApproval:false` after any result. No AI, travel supplier, paid provider or `/api/*` endpoint is probed.

## Authorized future execution

First obtain the **exact deployment URL and Git SHA** from the authenticated Vercel project, and independently verify it belongs to the approved Wayfarer GitHub commit. If a Preview is not available, do **not** substitute a simulated test or older Production:

```bash
npm run verify:deployment -- \
  --url https://wayfarer-world-travel-VERIFIED-PREVIEW.vercel.app/ \
  --expected-hostname wayfarer-world-travel-VERIFIED-PREVIEW.vercel.app
```

The inspector makes 38 fixed static HTTP requests (8 public + 11 protected paths, each with HEAD and GET), no paid calls. A `STATIC_HTTP_PASS_ONLY` result proves only the specified methods, paths and response headers on the supplied hostname at that moment, not all file exposure, serverless route behavior, exact SHA or browser functionality. The explicit hostname must be validated outside the script against Vercel metadata. Do not pass protected Preview credentials to the tool.

## Automated regression evidence

`tests/deployed-http-verification.test.mjs` now includes checks for:
- HEAD 404 but GET 200 on sensitive source;
- HEAD 200 but GET 404 discrepancy;
- ordinary public HEAD 200 while GET 404;
- bounded GET 206 with correct MIME;
- CSP present on HEAD but missing on GET;
- Preview host mismatches and impostor URLs;
- private path leakage with no response body collection;
- remaining authentication wall, network failure, MIME, and provider-isolation cases.

`npm run test:deployment-verifier` and the full Node 24 regression suite run in GitHub CI with **synthetic HTTP responses only**. This stage does **not** make Vercel deployment requests. The source-level inspector gate remains a code-check; **live artifact security and API/browser launch gates remain BLOCKED**.

## Remaining launch blockers

No exact-commit Vercel Preview for this branch, no live static exposure results, no test of all eight serverless APIs, no Chrome/Safari/Firefox/mobile keyboard/WebGL/OSM QA, no provider-dashboard review of five historical candidate secrets, no complete approved privacy/terms/operator contact, no production distributed paid-provider quotas, no approved PR-stack integration/rollback and **no owner Production authorization**.

**Decision: NO-GO.** No merge, Preview/Production deployment, credentials change, billing alteration or paid provider activation performed.
