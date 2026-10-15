# Wayfarer — Local HTTP Preview Isolation (Post-Stage 50 Release Gate)

**Date:** 2026-10-15 · **Scope:** source-level and locally executed HTTP checks on stacked development code. **Release:** NO-GO.

## Confirmed gap addressed

The previous `server.mjs` was a catch-all static server. It accepted any root filename with a simple regular expression and served file bytes from the Git repository directory, including server implementation sources such as `server.mjs`, `provider-production-lock.mjs`, `vercel.json`, `package.json`, test files and other non-frontend artifacts. This is inappropriate even for a localhost development server; it could disclose internal source or metadata if a developer accidentally made that listener reachable.

The new `public-static-assets.mjs` provides a small explicit manifest of the Wayfarer homepage, beta browser-data page, their referenced CSS and client JavaScript, known public photographic assets, favicon, robots/sitemap, and **intentionally public reference JSON**. Other root files and all nested paths are denied. No directories or wildcard globs are allowed. The local server continues binding to `127.0.0.1:4173` when invoked with `npm start`.

The redesigned static server:

- Handles GET and HEAD only; returns 405 for all other methods.
- Blocks dotfiles, traversal, encoded-slash requests, nested paths, non-manifest resources, raw `/api/**` source, `*.mjs` server code, `package.json`, `vercel.json`, scripts and test files.
- Serves explicit content types, 404/405 without exposing OS file paths, and a bounded request target length.
- Applies the global security response headers from the committed `vercel.json` as a **local parity baseline**, with `no-store` on HTML and bounded public-data cache headers matching the committed config. This is not actual deployed HTTPS header validation.
- Exposes `createStaticServer()` for an in-process, ephemeral-port Node 24 HTTP integration test; importing it in tests does not automatically bind port 4173.

## CI evidence and commands

```bash
npm run build
npm run check
npm run smoke:local   # Node HTTP test against real locally bound server
npm test              # Full existing test suite, also includes HTTP smoke
npm run release:report
```

The `Checks` GitHub Action runs `npm run smoke:local` as a dedicated gate in addition to the complete regression suite. The HTTP smoke tests request public pages, script/style/image references, static geographic JSON, sitemap and favicon; compare HTTP security headers against `vercel.json`; assert HEAD semantics and 405 method refusal; and verify that internal code and metadata paths return 404.

A separate `local-http-asset-isolation` source-level release check is added, while the `deployed-static-artifact-isolation` manual gate remains **BLOCKED**.

## Explicit limitations / public release blockers

**This test server is not the Vercel deployment runtime.** Production uses Vercel's static/function packaging, routing, headers and serverless APIs. The local static server deliberately returns **404 on `/api/**`**, instead of emulating pricing, booking or AI behavior. It does not replace backend endpoint tests or a real browser.

A passing `npm run smoke:local` does **not** prove that the Vercel deployment excludes `server.mjs`, `provider-production-lock.mjs`, `vercel.json`, `package.json`, `tests/` or other repository files. A real deployed-artifact inspection is a launch gate. In the exact approved candidate Preview, verify that raw internal files cannot be downloaded, security headers are present on real HTTPS routes, no provider secrets are exposed, and public static files + `/api/**` work as designed.

No real Chrome/Safari/Firefox interactive, responsive/WebGL, network/CSP, low-end device, accessibility, paid-provider, or external penetration test is claimed here. An exact-commit Preview was not created, as previous Vercel Hobby quota limitations must be respected. No Production deploy, merge, provider/billing activation, credential read or account setting change occurred.

**Release decision: NO-GO until the independent deployment, legal, security, operator, quota, browser and owner-approval gates are completed.**
