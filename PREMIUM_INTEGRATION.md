# Wayfarer premium integration — staged, never automatic production overwrite

This version promotes the recovered premium Journey Studio design as the root frontend **on this feature branch only**. The previous static frontend files and Node modules (`app.mjs`, `planner.mjs`, `styles.css`, `ai-panel.mjs`, `travel-discovery.mjs`, etc.) remain available, but are **not loaded** by the premium homepage, preventing duplicate navigation handlers and overlapping design CSS. The existing n8n workflow and backend endpoints are retained.

## Source
- Premium UI/UX v2 recovered ZIP from owner, 13 October 2026; original docs at `docs/premium/`.
- Hero assets are the original premium source JPEGs (no third-party image-generation placeholders).
- Inline CSS/JS extracted to `premium-base.css` and `premium-app.js` to comply with the strict CSP.
- All original premium runtime/API source files are included.

## Functional boundaries
- `/api/explore.js`, `/api/intelligence.js`, `/api/hotels.js`, `/api/travel-search.js` are used by the premium frontend.
- `/api/ai-plan.mjs`, `/api/travel-offers.mjs` and n8n remain as independent legacy/beta APIs; the premium page does not call them.
- AI composer requires a server-side `GROQ_API_KEY` in this **project's Preview**, which may not yet be configured.
- Travel price lookup requires `SERPAPI_API_KEY`, `WAYFARER_AI_BETA_TOKEN` and `WAYFARER_TRAVEL_ENABLED=true` on Vercel Preview, and a manual private beta code.
- Flight rates are indicative search results, *not* confirmed seats. Hotel prices require checkout verification. Food/transit rate feeds are not connected.
- Browser-local saved journeys are not automatically synchronized with the older app.

## Review gates
1. Confirm GitHub `Checks` workflow passes, including old planner/n8n and new premium UI tests.
2. Inspect Preview at 360, 390, 768, 1024 and 1440px and verify reduced-motion mode, keyboard focus, no overflow and photo load.
3. Check APIs return safe `not_connected` when secrets absent; test one credentialed Groq request only if allowed. SerpApi search clicks incur quota usage.
4. Verify new Vercel deployment is `Preview` and `main` production alias unchanged.
5. Keep PR unmerged until human visual QA and review; do not claim guaranteed zero errors.

## Maintenance
The legacy `index.html` is preserved on the source branch before this overlay and on the PR history. Restore using Git version control if needed. Do not simply union HTML or script references from two homepages.
