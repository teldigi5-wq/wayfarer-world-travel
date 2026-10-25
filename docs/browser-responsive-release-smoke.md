# Responsive browser release smoke tests

Run `npm run test:browser:offline` after installing the pinned **benchmark-only** Chrome controller:

```bash
npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund playwright-core@1.56.1
npm run test:browser:offline
```

The test starts the existing static `server.mjs` on localhost. It drives real Chrome at four viewports: 320×720, 390×844, 768×1024 and 1440×900. Each test uses an isolated browser context and synthetic client-side trip.

**Checks:** correct initial Discover view and WebP hero; no horizontal page overflow on Discover, Journey Studio, Arrival or Journeys; real navigation clicks; creating a local sample itinerary; saving a sample journey to browser storage; Arrival destination continuity; journey search (match and no-match); working motion-accessibility toggle; absence of unhandled JavaScript exceptions.

All **non-local network requests are aborted**, including fonts and stock images. No Vercel production, external booking providers, paid requests, authentication, student records or Firebase services are accessed. This test deliberately does not validate live travel data or prove that protected Vercel preview flows work.

CI saves JSON results and synthetic screenshots for 14 days. Test failures block merging when the workflow is configured as a required check. Performance timing in this workflow is diagnostic only; use separate Lighthouse runs for synthetic paint and blocking metrics.

Before a public production release, also test the authenticated Vercel preview with an authorized browser, verify CSP/security headers and API behavior, and preserve a tested rollback target.
