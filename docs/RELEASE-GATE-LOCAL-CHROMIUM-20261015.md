# Wayfarer — Real Offline Chromium Release Smoke

**Date:** 2026-10-15 · **Parent:** Draft PR #61 · **Release state:** **NO-GO**

## What was actually executed

Unlike earlier Node fixtures and text-only source checks, a PR-only GitHub Actions job named `offline-real-chromium-journey-smoke` now runs a **real browser**. It uses Chrome/Chromium already available on the hosted Ubuntu runner, Node 24's built-in WebSocket + Chrome DevTools Protocol (CDP) and the committed allowlisted local `server.mjs` at a random `127.0.0.1` port. **No Playwright, Puppeteer, npm browser download, paid provider calls or Vercel deployment are required.**

`scripts/smoke-local-chromium.mjs` uses a temporary isolated Chrome profile, blocks all external HTTPS resources in the browser, sets `prefers-reduced-motion: reduce`, performs actual DOM operations and closes the local browser/server after completion.

### User experiences tested in Chrome

1. **Discover loads:** the home page is parsed, JavaScript executes, the Wayfarer title and Discover active state are present.
2. **Interactive navigation works:** click the actual navigation controls and verify active views for **Journey Studio → Arrival → My Journeys → Discover**.
3. **Mobile responsiveness sanity check:** emulate a **390 × 844** device at DPR 2; confirm main content and primary navigation exist and there is **no document-wide horizontal overflow**. This is one simulated mobile viewport, not a real physical smartphone.
4. **Browser privacy controls:** on `data-and-privacy.html`, insert synthetic trip and checklist keys into an isolated browser, open confirmation without deleting, cancel without deleting, confirm and verify deletion of **only the two Wayfarer keys**, and retain a synthetic unrelated key.

The smoke test **fails** if Chrome is absent or any required interaction fails; it never silently skips. Only the short test outcomes are logged, not entire HTML documents, browser storage values, login data, secret credentials or screenshots.

The existing Node validation, static file/dependency checks, serverless method/auth tests, source-level 40-file Vercel output guard and PR redacted Git-history scan continue to run separately. The browser job runs on **pull requests** and not on every push, conserving Actions resources.

## Running the test locally

```bash
npm run build
npm run smoke:browser
```

A recent Chrome or Chromium must already be installed (optionally supply `CHROME_BIN`); no installer is built into this command. Browser automation binds to loopback only, launches a temporary profile, and cancels network access to external HTTPS assets.

## Actual evidence and explicit limits

The initial PR #62 GitHub Actions run [#38708028386](https://github.com/teldigi5-wq/wayfarer-world-travel/actions/runs/38708028386) completed successfully in all three jobs: functionality/data/security, independent redacted reachable-history credential audit, and **real offline Chromium desktop/mobile/browser-data smoke**. The full Node suite passed **398 tests**, and the browser runner reported **all four checks passed**. The audit inspected **618 reachable commits and 33,073 added lines**, with no blocking credential signatures and five unresolved historical test-file candidates.

**A local Chrome success must never be represented as:**
- A real Vercel deployment, verified static deployment security, compatible eight Vercel Functions or a tested live serverless API;
- A Safari/Firefox or real iOS/Android device result;
- Full WCAG or screen-reader accessibility certification, visual polish sign-off, keyboard testing across all interactions or measured production Core Web Vitals;
- Verified NASA/OSM globe/map rendering, external fonts/imagery, or live airline/hotel/provider data; browser HTTPS requests to external hosts were explicitly blocked;
- A signed-off operator Privacy Policy/Terms, provider billing/secret clearance, security pentest or permission to merge all draft PRs.

The code-level release checklist gains `offline-real-chromium-smoke`, but independent release gates for **exact-sha Vercel Preview, real device/browser/accessibility QA, verified legal/operator contact, manual historic-secret review, durable paid-provider limits and owner authorization remain BLOCKED**.

**Next real milestone:** inspect an authorized exact-commit Vercel Preview and verify deployed static asset exposure, all eight API routes, independent UI navigation, and real mobile/browser interactions. Do not activate billing or request Preview deploys just to turn an offline gate green without explicit permission.

**No PR merge, Vercel deployment, paid provider activation, credential rotation or billing change was performed here.**
