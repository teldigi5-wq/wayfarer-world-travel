# Wayfarer release preflight and rollback

## Verified protected-preview runtime checks — October 25, 2026

**Source commit:** `e0f20cbbb4c158015c2ed8b7e6ca27e1d8029068` (Wayfarer PR #87 merged).  
**Protected preview:** `https://wayfarer-world-travel-iispd8w7y-teldigi5-wq.vercel.app`  
**Vercel deployment ID:** `dpl_9jqhVjD9H5eTvJ8AbD7Yi86hrkWf` — READY, target `null` (preview).  
**Production rollback candidate:** `dpl_2oiz1XqGtWSTzswD5DzqEhrvLVuT`, commit `2b2c27aae6a9044e538e9140c105920edd733b38`, still attached to `wayfarer-world-travel.vercel.app` at verification time.

An authenticated first-party Vercel account fetch of the protected URL confirmed **actual deployed GET responses** (not mocked or source-only tests):

| Runtime route | Expected | Observed |
| --- | --- | --- |
| `/` | Public app HTML | HTTP 200, real Wayfarer HTML |
| `/wayfarer-hero-v3.webp` | Optimized media | HTTP 200, `image/webp` and valid RIFF/WEBP |
| `/api/explore?mode=nearby&lat=%20&lon=0` | Validation rejection | HTTP 400, `Cache-Control: no-store`, `x-vercel-cache: MISS` |
| `/api/explore?mode=search&q=A` | Minimum text length | HTTP 400, `Cache-Control: no-store` |
| `/api/explore?mode=search&q=Kyoto` | Successful, sourced result | HTTP 200, Kyoto from Wikipedia place index, `x-vercel-cache: HIT` on repeat |
| `/api/ai-plan` GET | No AI POST side effects | HTTP 405, `Allow: POST`, `no-store` |
| `/api/travel-offers` GET | No travel POST side effects | HTTP 405, `Allow: POST`, `no-store` |
| `/api/travel-search` GET | No travel POST side effects | HTTP 405, `Allow: POST`, `no-store` |
| `/data.json` | Public country dataset | HTTP 200, 1-day cache |
| Unknown asset | Proper static 404 | HTTP 404 |

Landing page, WebP, geo-response, AI endpoint and country dataset were checked against all four shared `vercel.json` security headers (CSP, nosniff, Referrer-Policy, Permissions-Policy), with **no mismatches**. The actual successful-result browser-visible cache header was `public`; Vercel reported a cache HIT with an `Age` header, as expected for public CDN caching.

**Important limits:** These tests use an authenticated Vercel fetch capability that can create a short-lived preview share link; no link secret or authentication value is recorded in this document. Requests were GET-only, and no paid travel provider, webhook, student data, trading system, or real booking was invoked. Protected-preview **interactive browser**, authenticated POST beta modes and staged production-target runtime tests are **not certified**. Keep Deployment Protection enabled and obtain explicit release approval before attaching the new candidate to the public production domain. The previous production deployment ID is preserved above for controlled rollback.

## Automated, credential-free gates

1. `npm run check && npm test`: source/security contracts, Vercel-configured CSP and security headers mirrored into the localhost-only static server; secure HTTP methods; accurate `image/webp` media type; static caching contract.
2. `npm run test:browser:offline` (CI with pinned playwright-core): real Chrome at 320, 390, 768 and 1440 CSS pixels. Uses synthetic browser-local journeys and aborts external requests. Fails for executable script/style CSP violations, JS exceptions, horizontal overflow and broken route/save/search/motion interactions.
3. `npm run benchmark:offline`: mocked public APIs and mandatory production provider locks.
4. `npm run benchmark:browser`: synthetic Lighthouse paint/JS/accessibility metrics, **advisory** only.

The local server obtains the security-header values from `vercel.json` instead of maintaining a divergent copy. This is more faithful to production CSP, but cannot prove what headers Vercel actually serves at the edge.

## Authenticated protected-preview verification (manual authorized environment)

Use the **same project** in Vercel and the exact preview hostname. Do not disable Deployment Protection. With a logged-in Vercel CLI, use `vercel curl https://<exact-preview-host>/` or an approved short-lived Trusted Sources development OIDC header. Do not print or commit the token.

Check:
- HTML resolves (not a Vercel authentication page) and the hero WebP returns `Content-Type: image/webp`.
- `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` match reviewed release configuration.
- Unknown API routes do not expose private data.
- In a protected preview browser, verify navigation, visual fidelity, 320/390/768/1440 responsiveness, reduced-motion control and use of demo-only saved journeys.
- Probe malformed geo inputs and metered-provider-lock behaviors only with synthetic payloads, never secrets or real paid searches.
- Verify the exact Git commit SHA, production environment variable *names* and disabled-provider posture without showing secret values.

## Executable protected-preview HTTP preflight

After confirming the target deployment is the reviewed commit in Vercel and linking the *same project* with the Vercel CLI, execute from the repository in an authorized environment:

```bash
WAYFARER_PREVIEW_URL="https://wayfarer-world-travel-6atilophd-teldigi5-wq.vercel.app" \
  vercel env run -- npm run test:preview:authorized
```

Refresh the preview URL to the exact current immutable deployment before executing. The script fails closed if `VERCEL_OIDC_TOKEN` is unavailable, the hostname is not an immutable same-team Wayfarer preview, the identity token cannot pass Vercel protection, HTTP redirects occur, or the CSP/media/API boundaries differ from the reviewed configuration. It prints only validated status metadata—not the OIDC token or any request headers. It uses GET requests only, rejects malformed coordinates *before* provider calls and probes paid-provider routes with wrong HTTP methods to avoid billable requests. The script does **not** test actual supplier availability or authenticated browser state.

The script's mock-based security checks run in regular `npm test`; **that mock pass is not a protected-preview pass**. Run the authenticated command in a trusted workspace with access to Vercel. Do not commit `.env.local` or save tokens as workflow artifacts.

## Release decision

Do **not** promote a preview solely because it built successfully; promotion changes production environment variables and can require a new build. For an approved launch, create a production-target staged build **without assigning public domains**, perform authorized smoke tests against that exact artifact, and then promote the verified production build with your team's release approvals. Preserve the last good deployment ID and its live alias before switching. Monitor response error rate and check critical navigation immediately afterward. Roll back to the recorded previous production deployment if a verified regression occurs; note that Vercel rollback can pause automatic alias assignment until promotion re-enables it.

No production alias change, real-user mutation or paid provider activation is part of this PR.
