# Wayfarer

> **Optional n8n + Groq AI beta (disabled by default).** A gated, server-side Groq agent integration has been proposed on a feature branch. Three distinct model-backed research agents and an encyclopedia source call are orchestrated in n8n, but the feature requires owner-provided n8n hosting and Groq credentials. It is **not live** or part of the $0 no-key deterministic baseline. Setup, tests, licensing and limitations: [n8n/README.md](n8n/README.md).

A static, worldwide travel planner built to operate with a strict $0 development, hosting and API budget. Six local deterministic assistants coordinate destination data, flight handoff, nearby hotel discovery, itinerary scheduling, budget allocation and safety checklists. These are rule-based planning agents, not LLM inference. No checkout or booking integration is claimed.

## MVP scope

250 countries and territories; country selection and city/area input; 16 sourced city points; 13 sourced landmarks; a 1,000-airport sample across 233 country codes; date and group validation; customizable ground budget allocation; airport/landmark hotel searches; outbound maps and transit directions; itinerary and text export; local bookmarks; official entry/advisory research links. Slow style spaces landmarks across days. Arrival day is reserved for settling in.

Detailed local data is limited. Unknown cities receive flexible research slots and external map discovery. Hotel inventory, hotel ranking against real properties, live fares, visas, schedules, route optimization and market-price estimates are **not integrated**. Nearby airport is nearest in the bundled sample for a verified city point, not necessarily the best arrival airport. Straight-line distance is not travel distance. Country-center points are never used as capital or hotel coordinates.

## Run and test

Install Node.js 20+ from its official distribution. No package install, API key, environment variable, card or build dependency is needed.

```sh
npm start
# http://127.0.0.1:4173
npm run check
npm test
```

Serve the static files over HTTP; direct file opening does not support the data request. `server.mjs` is a local preview helper, not a production server. Tests cover dates, limits, budget math, encoding, proximity calculations, agent orchestration, sourced dataset integrity and security policy. Browser verification records should accompany each release; automated tests do not prove complete accessibility.

## Deployment and PR workflow

Create a **separate** GitHub repository, initialize main with this README, commit implementation on `feat/travel-mvp`, open a PR, and run Checks. Require `functionality-data-security` before merging, block force pushes and deletion, and require PRs with resolved conversations. Set required approving reviews to zero for a solo owner or one if a reviewer is available. Public GitHub repositories support free Actions and branch protection; private repository feature availability varies. No paid upgrade is authorized.

Import only this repository into a new Vercel project. Framework: Other; build and install commands empty; output directory `.`. `vercel.json` adds CSP and security headers. Production may also be deployed from tested static files through the authorized connector. Avoid production auto-deploy on untested branches. Never add secrets to this client-only repository.

## $0 guardrails and limits

- No paid AI, functions, storage, geocoding, tiles, analytics, premium fonts, images, domains or affiliate integrations. CSS illustration and system fonts load locally. Runtime data requests go only to the site's own bundled JSON.
- Vercel Hobby is free for **personal, non-commercial** projects. Official docs checked October 11, 2026 list 100 GB fast transfer/month, 10 GB origin transfer/month, 1 million CDN requests/month and 100 deployments/day. Usage limits are shared with other projects in the account; don't assume unused allowance. Exhausted free resources generally pause. Never upgrade, start Pro trials or add a payment card to run this MVP. See https://vercel.com/docs/plans/hobby and https://vercel.com/docs/limits . Commercial use requires a separately verified free host that permits it.
- No third-party runtime API quotas. The static dataset is cached for one day. Country/city searches and six assistants run on demand in the browser. No public Nominatim, Overpass or OSM tile service is queried.
- Public GitHub standard Actions runners are free for public repositories; this workflow has no third-party dependencies, a five-minute timeout, and minimal read permissions. Private repository minutes/storage can be chargeable; keep within verified account limits or use local checks.
- External travel providers may charge for travel bookings. The development budget is separate from the traveler's budget. Booking prices are checked on their sites, never fabricated here.

## Sources and licenses

- Country database: https://github.com/mledoze/countries , ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/ . `data.json` country database adaptations remain under ODbL; preserve source attribution and share-alike licensing when redistributing that database. Names/boundaries follow source conventions; they are not a geopolitical position.
- City/landmark coordinate facts: Wikimedia REST page summaries; individual source URLs and Wikidata IDs are retained in `data.json`. Wikidata structured facts are CC0: https://www.wikidata.org/wiki/Wikidata:Licensing . No Wikipedia prose, photos or descriptions were copied. Coordinates are approximate and downloaded October 11, 2026. Source entries identify coverage gaps.
- Airports: https://ourairports.com/data/ and official mirror https://github.com/davidmegginson/ourairports-data . OurAirports data is public domain, community-maintained, and has no accuracy warranty. The source's scheduled-service flag is historical data, not verified operating status.
- Maps: outbound https://www.openstreetmap.org/ with https://www.openstreetmap.org/copyright attribution and official Google Maps URLs: https://developers.google.com/maps/documentation/urls/get-started . Map-provider terms apply externally. No geocoding API or tiles are hosted.
- Flights: Google Flights external handoff and search query; dates/party are not guaranteed to prepopulate. Confirm all fields on the provider. No scrape or partner API. Hotels: Booking.com search and Google Maps proximity queries, no hotel inventory/availability API.
- Practical requirements: https://www.iata.org/en/travel-centre/ , destination immigration/embassy research, and https://www.gov.uk/foreign-travel-advice (UK-oriented). Passport nationality, transit, residency and purpose matter. Checklist outputs are not legal/medical advice or independently verified eligibility decisions.

## Privacy and security

No account, analytics, server database or trackers. Saved trips live in this browser's local storage (up to 20), with clear and remove controls; shared-device users can read them. No passport data is requested. External searches transmit the destination/origin/dates/party in outbound links when clicked; these providers use their own policies. All user-visible values are assigned with textContent and fixed HTTPS provider URLs use encoded queries. CSP limits code, styles and requests to self, disables frames/objects, and sends a restrictive referrer policy. Local storage failures fall back to export.

## Maintenance

Refresh data manually only when needed; preserve licenses, provenance and retrieval dates. Respect Wikimedia throttling and stop on 429. Do not silently introduce a geocoder or paid inference. Add destination sources and meaningful tests, create a PR, check the exact commit and browser behavior, then release. Real-time requirements, schedules, weather and availability always need external confirmation.
