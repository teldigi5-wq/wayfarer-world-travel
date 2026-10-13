# Wayfarer Premium Motion — Preview Candidate

Updated from the recovered 13 October 2026 source of the existing premium `wayfarer-journey-ai` Vercel website.

## Scope

- Maintains the premium hero photograph, existing Discover / Journey Studio / Arrival / Journeys workflow, source-led worldwide discovery and existing Groq server-side research.
- Adds a purposeful visual design system in `premium-motion.css` and `premium-motion.js`: cinematic entrance, progressive reading rail, capped image parallax, motion toggle, animated real agent states, responsive typography, and accessible focus-state handling.
- Refines desktop/mobile spacing, source-status legibility, imagery treatment and working surfaces.
- Renames unsupported "verified stay" copy and fails closed for legacy Amadeus Self-Service hotel pricing in `api/hotels.js`.

## Run and validate

```bash
npm run check
npm test
```

The frontend can be served as static files for visual inspection, while the `api/*` files require a Vercel-compatible runtime for actual destination and Groq API requests. Existing production `GROQ_API_KEY` remains server-side. No `.env` or credentials are included in this ZIP.

## Recommended deployment workflow

1. Use a **new private feature branch**, keep original production preserved as a snapshot. The recovered archive used to create this preview is separate and unchanged.
2. Upload this site's **root** files to the source branch connected to **`wayfarer-journey-ai`**, not the older `wayfarer-world-travel` website.
3. Create a **Vercel Preview deployment only**. Never deploy it as Production without approval.
4. Check homepage, Discover cards, Journey Studio, Country Search, nearby map tools, Groq AI response, Arrival Companion, saving/resuming journeys, and browser console.
5. Verify source-key isolation, network/API error states, motion off and mobile interactions before release.
6. If integrating SerpApi flight/hotel search later, store `SERPAPI_API_KEY`, beta token, and feature enablement in **this project's** Preview environment, not the older project. Implement authenticated server calls and quota limits before enabling; this ZIP has **no live SerpApi offer integration**.

## Release safeguards

- No live deployment has been performed as part of this local design update.
- No project main branches were changed.
- Do not imply actual bookability from map listings, Groq prose, hotel directory records or sample itinerary cards.
- Fonts and some destination imagery reference the same external resources as the recovered site; check their availability/license and evaluate CDN behavior in staging.
