# Wayfarer — Premium Product Experience v2

## State, 13 October 2026

**Prepared and locally validated. NOT YET DEPLOYED.** The Vercel `wayfarer-journey-ai` project currently has a Ready Production deployment. This ZIP is not that deployment. Deploy only to **Preview** and validate before promoting or merging into production. Do not confuse `wayfarer-world-travel` with the premium `wayfarer-journey-ai` project.

## Product-first refinements

- Preserved cinematic, authentic travel imagery, sober evergreen + parchment system, editorial typography and purposeful motion.
- Navigation now uses simple familiar icons and easier 44–59px targets; improved current-page state and mobile bottom-bar ergonomics.
- Added live trip ledger: destination selection, trip length and *ground* budget summary, with clear calls to browse or compose; group airfare ceiling remains separate.
- Set Travel Research as an independent, legible planning stage after destination discovery rather than visually nesting an entire dark panel inside another dark panel.
- Improved labels, sources, search-result contrast, empty/error states, and the genuine loading state of the provider search button.
- Prevented search on incomplete destination, airport or stay dates **before** sending a request, conserving finite SerpApi credits.
- Kept all four Wayfarer journeys, public-source tools, Groq compose API and guarded SerpApi adapter intact.
- Respected `prefers-reduced-motion` and preserved the manual motion toggle, keyboard focus, and skip navigation.
- No tracking, paid dependencies, external 3D engine, fake testimonials, invented bookings or generated live prices.

## Verification

- `npm run check` passed (all JS syntax).
- `npm test` passed (original functional tests, design tests, existing SerpApi mock tests and new experience-layer tests).
- Headless Chromium checks at 360, 390, 650, 768, 1024, and 1440px: route controls, dynamic budget summary, mobile touch target, no horizontal overflow, no runtime JS errors.
- Browser test blocked invalid stay dates before network call (zero SerpApi credits).
- Mocked supplier responses were rendered with *indicative price* and *not connected* labels. **No actual live API search was performed**.
- Desktop and mobile screenshot artifacts accompany the package in this conversation.

## Preview deployment prerequisites

1. **Recover/update source control first**: keep this source in a private GitHub repository or deploy these exact source files using an authorized ChatGPT Work computer; do not replace with files from the older `wayfarer-world-travel` repository.
2. Select Vercel project **`wayfarer-journey-ai`** and **Preview** target. Keep production aliases untouched.
3. The premium project has `GROQ_API_KEY` already listed on Production+Preview. It does **not** yet have `SERPAPI_API_KEY`, `WAYFARER_AI_BETA_TOKEN`, `WAYFARER_TRAVEL_ENABLED` on Preview. Add them securely through the dashboard; do not paste values in chats or GitHub.
4. Begin with `WAYFARER_TRAVEL_ENABLED=false` until the preview is validated; turn on for **one controlled search** once access protections and quotas are checked.
5. Confirm the preview serves `/experience-layer.css`, `/experience-layer.js`, `/api/intelligence`, `/api/explore`, and `/api/travel-search` from the **correct** project.
6. Run browser/keyboard/mobile QA and provider quota check, monitor API failures and Vercel logs, and confirm no payment/billing change. Promote only with explicit user approval.

## Known boundaries

- Airline seat inventory and ticket bookings are not confirmed by Google Flights search snippets. Per-adult indicative price is not a guarantee of final group fare.
- Hotel availability, final room rates, food menus, local transit fares, live arrival services and visas are not provider-verified end-to-end.
- SerpApi free quota is finite and beta code alone does not implement per-user authentication/rate limiting suitable for public launch.
- Groq AI responses are advisory and **not yet grounded in SerpApi flight/hotel offers** for optimized priced itineraries.
