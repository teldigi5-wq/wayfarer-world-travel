# Wayfarer — Arrival Companion & My Journeys

## UX principles

The tabs form the `Plan → Arrive → Remember` segment of Wayfarer's connected travel experience. They share the site's semantic palette: forest/deep teal as the navigation/background base; warm ivory for clear functional cards; restrained brass for editorial emphasis. Display headings use the existing serif. Practical controls use readable sans-serif text and minimum 44px primary hit targets.

- Arrival context inherits selected destination, working number of days and **ground budget** (not a hotel/flight quote).
- Four checklist items are stored per destination in the browser, never interpreted as completed reservations or visa approval.
- Country and weather facts are shown only when the actual existing backend tools return valid values. HTTP(S) source attribution is exposed for verification.
- Travel costs, schedules, room/seat availability, visa eligibility, and safety conditions are explicitly unverified when not integrated.
- Offline notes are generated in the browser. No server booking, payment, passport capture, or identity collection is added.
- My Journeys reuses existing `wf-trips-v2` local storage, adds searchable cards, restores user inputs (including saved custom/world destinations), and links directly to Arrival.
- Remove requires a second deliberate click. Local-storage clearing still removes records, and there is no account-level synchronization.

## Motion and accessibility

Editorial hierarchy and meaningful feedback take priority over constant movement. Hover image zoom is small and disabled for `prefers-reduced-motion` or the site's manual motion-off mode. Pages have semantic headings, checkbox labels, button controls, visible focus outlines, clear empty/search states, and responsive 360–1440px layouts.

## Release checklist

- `npm run check` and `npm test` must pass.
- Browser QA: 360px / 390px / 650px / 768px / 1024px / 1440px for no overflow or page errors, plus primary navigation, checklist persistence, search, resume, Arrival handoff, and deletion confirmation.
- Check destination photography and local-image fallback on the deployed Preview.
- Real API behavior and actual Vercel Preview settings require separate credentialed verification. No production deployment or merge without review.
