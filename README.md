# Wayfarer

> **Premium Wayfarer integration (review branch; not production).** This branch adopts the recovered cinematic `wayfarer-journey-ai` homepage, Journey Studio and optional SerpApi travel research as the default frontend. All previous backend files, `n8n/` workflows and tests remain. The old static homepage is archived at `legacy/world-travel-original-home.html`, and the original live site remains unchanged. Please see [PREMIUM_INTEGRATION.md](PREMIUM_INTEGRATION.md) for compatibility checks, security/CSP decisions, and provider-key requirements. **Do not claim live confirmed seats, bookable hotels, or live menu/transit fares.**


> **Flight + hotel search in draft PR only (October 2026).** The retired Amadeus Self-Service implementation has been removed from the travel offers endpoint. The replacement uses **SerpApi Google Flights and Google Hotels searches**, gated by separate server-side credentials and a private beta passcode. The currently published site has **no live pricing service**; this PR must pass credentialed preview tests before deployment. Search prices are indicative, may be cached and **do not verify seats, room availability, bookings or final checkout prices**. Food and transport pricing are not connected.

> **Optional Groq/n8n AI beta (disabled by default).** Three model-backed n8n agents can propose destination guidance, flights/stays research and itineraries. They do not generate authoritative provider prices. See [n8n/README.md](n8n/README.md) for connection instructions.

A static, worldwide travel planner built to operate with a strict $0 development, hosting and API budget. Six local deterministic assistants coordinate destination data, flight handoff, nearby hotel discovery, itinerary scheduling, budget allocation and safety checklists. These are rule-based planning agents, not LLM inference. No checkout or booking integration is claimed.

## MVP scope

250 countries and territories; country selection and city/area input; 16 sourced city points; 13 sourced landmarks; a 1,000-airport sample across 233 country codes; date and group validation; customizable ground budget allocation; airport/landmark hotel searches; outbound maps and transit directions; itinerary and text export; local bookmarks; official entry/advisory research links. Slow style spaces landmarks across days. Arrival day is reserved for settling in.

Detailed local data is limited. Unknown cities receive flexible research slots and external map discovery. Hotel inventory, hotel ranking against real properties, live fares, visas, schedules, route optimization and market-price estimates are **not integrated**. Nearby airport is nearest in the bundled sample for a verified city point, not necessarily the best arrival airport. Straight-line distance is not travel distance. Country-center points are never used as capital or hotel coordinates.

## Worldwide search and freshness model

**Country autocomplete:** the planner retains 250 countries and territories from its bundled sourced country directory. Matching country names appear as keyboard-selectable suggestions while typing; the full country menu remains available. Detailed city landmarks are still curated rather than claiming every town in every country has verified attractions.

**Airport selection:** a departure-airport search and a destination-country-specific arrival-airport selector expose IATA-coded airports from the best available local reference catalog. Until `airports-index.json` is generated and published, the site falls back to its bundled **1,000-airport sample**. An airport record is an informational reference, **not** proof of commercial passenger service, routes, immigration facilities or seats.

**Daily public-data refresh:** `.github/workflows/daily-airports.yml` checks the public-domain [OurAirports airport CSV](https://ourairports.com/data/) each day. The script `scripts/refresh-airports.mjs` validates the data, compacts IATA-coded airports, checks for changes and opens a **human-reviewable PR** to update `airports-index.json` (requires GitHub Actions write/PR permissions and a working scheduled runner). It never bypasses protected `main`. Daily retrieval alone is not a guarantee that reference data has been merged/published or that airline schedules are current.

**Live travel search is on-demand, not a daily global cache.** After the traveler chooses origin/destination airports and dates, a server-only supplier call can return offers if an approved production supplier is connected. Each result carries a checked timestamp, supplier mode, real quoted currency and availability disclaimer. Even an offer searched seconds ago can change at checkout. The site cannot obtain daily fares, hotel rates, restaurant menus or transit prices for every worldwide combination without appropriate licensed coverage, quotas and funding.

**Budget separation:** group `budget` is the ground budget; optional `flightBudget` is a separate round-trip airfare ceiling. Provider-reported flight offers are assessed against `flightBudget`, and hotel offers against 40% of the ground budget. Comparisons are only made when supplier quote currency is USD; a non-USD quote is marked **currency not comparable** until a trustworthy FX source is integrated. An offer priced over a limit is displayed as over-budget, not represented as affordable or reserved. All allocations are planning targets and may not match actual market prices.

**Not yet complete:** destination-wide real-time food and public-transport pricing, guaranteed ticket inventory, verified daily flight timetable changes, multi-room hotel shopping and a unified AI plan recomputed from final repriced offers all require additional authenticated providers and tests. Never call the current beta a finished end-to-end booking product.

## SerpApi Google Travel search — private gated beta

The optional **Travel prices & availability** panel calls `POST /api/travel-offers`, secured by `WAYFARER_AI_BETA_TOKEN`. A backend-only `SERPAPI_API_KEY` queries the documented Google Flights and Google Hotels APIs through SerpApi. **Neither API key is sent to the browser, README, logs or Groq.** An AI-generated suggestion is never converted into a supplier quote.

| Category | Data retrieved | Important limitations |
|---|---|---|
| Flight search | Selected origin/arrival IATA codes; outbound/return dates; adult count; economy; indicative USD fare and outbound flight segments | Google Flights round-trip search prices are **indicative per adult**; a return itinerary normally requires an additional `departure_token` request. The UI multiplies by adult count only as a **group budget estimate**. No live seat count or guaranteed checkout price. |
| Hotel search | Google Hotels destination/date query, named properties with `total_rate.extracted_lowest` and search price in USD | Only results with explicit **total-rate** pricing are shown. One shared room with 1–2 adults is assumed; taxes, fees, bed configuration, cancellation and room availability require provider verification. |
| Food | External restaurant/menu research link | Real-time worldwide menu pricing unavailable; **not connected**. |
| Transportation | External transit research link | Real-time fares, schedules and operating status unavailable; **not connected**. |

### Set up on Vercel Preview only

```env
SERPAPI_API_KEY=<copy into Vercel Sensitive environment variable>
WAYFARER_AI_BETA_TOKEN=<unique random private beta access code>
WAYFARER_TRAVEL_ENABLED=true
```

Select **Preview** for each variable. The browser requests the private beta access code to call the route; **never** enter SerpApi or Groq provider keys in the browser. `WAYFARER_TRAVEL_ENABLED` defaults off, so merely saving `SERPAPI_API_KEY` does not activate API calls. Vercel env changes apply to new deployments, not old ones.

The route makes **up to two SerpApi API calls per user click** (one flights, one hotels); it does not query every worldwide route automatically. **SerpApi charges/counts searches against its plan allowance**. The free plan and its quota may change, so check your dashboard, avoid public exposure and rotate compromised keys. This beta has no durable multi-instance rate limiter, per-user accounts or monthly hard cap beyond provider enforcement; the shared beta code alone is not sufficient for an open public launch.

States are explicit: `not_connected`, `needs_details`, `search_results`, `no_results`, `quota_exceeded` and `unavailable`. `no_results` **does not imply sold out**. Search time is recorded; SerpApi itself may return cached results. No server booking, payments, tickets or reservations are made. Never call a search price verified available inventory. Google Flights will normally need another search to choose the return and booking options; this first beta avoids that extra quota use.

The group **ground budget** covers lodging, meals, local transit, attractions and contingency. **International flights are excluded**, and the optional **group flight budget** is separate. Flight quote prices are multiplied by adult count only as an **indicative group sum** before comparing with flight budget. Hotel total search prices compare to the provisional 40% accommodation allocation. Group travelers are currently treated as adults for search; child ages, accessibility, multi-room occupancy, seat classes, baggage, local currency and late checkout require a later product flow.

### Deployment and verification gates

Run `npm run check && npm test`. Before deploying the PR to preview, configure all three Preview-only variables, verify exact branch targeting, ensure the Vercel integration can access the owner's scope, confirm source permissions and test the selected IATA route with **one limited live test**. Test budget labels, empty results, 429/quota errors and stale supplier results. **Production is not enabled or approved; main remains protected.**

Official integration references: [SerpApi Google Flights API](https://serpapi.com/google-flights-api), [SerpApi Google Hotels API](https://serpapi.com/google-hotels-api), [SerpApi pricing](https://serpapi.com/pricing).

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

## $0 baseline guardrails and optional beta costs

- The **baseline static planner** requires no paid AI, functions, storage, geocoding, tiles, analytics, premium fonts, images, domains or affiliate integrations. The disabled optional serverless beta needs owner-provided credentials and hosting. CSS illustration and system fonts load locally. Runtime data requests go only to the site's own bundled JSON.
- Vercel Hobby is free for **personal, non-commercial** projects. Official docs checked October 11, 2026 list 100 GB fast transfer/month, 10 GB origin transfer/month, 1 million CDN requests/month and 100 deployments/day. Usage limits are shared with other projects in the account; don't assume unused allowance. Exhausted free resources generally pause. Never upgrade, start Pro trials or add a payment card to run this MVP. See https://vercel.com/docs/plans/hobby and https://vercel.com/docs/limits . Commercial use requires a separately verified free host that permits it.
- The baseline local planner has no third-party runtime API quotas. The optional provider beta does have provider and function quotas. The static dataset is cached for one day. Country/city searches and six assistants run on demand in the browser. No public Nominatim, Overpass or OSM tile service is queried.
- Public GitHub standard Actions runners are free for public repositories; this workflow has no third-party dependencies, a five-minute timeout, and minimal read permissions. Private repository minutes/storage can be chargeable; keep within verified account limits or use local checks.
- External travel providers may charge for travel bookings. The development budget is separate from the traveler's budget. Booking prices are checked on their sites, never fabricated here.

## Sources and licenses

- Country database: https://github.com/mledoze/countries , ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/ . `data.json` country database adaptations remain under ODbL; preserve source attribution and share-alike licensing when redistributing that database. Names/boundaries follow source conventions; they are not a geopolitical position.
- City/landmark coordinate facts: Wikimedia REST page summaries; individual source URLs and Wikidata IDs are retained in `data.json`. Wikidata structured facts are CC0: https://www.wikidata.org/wiki/Wikidata:Licensing . No Wikipedia prose, photos or descriptions were copied. Coordinates are approximate and downloaded October 11, 2026. Source entries identify coverage gaps.
- Airports: https://ourairports.com/data/ and official mirror https://github.com/davidmegginson/ourairports-data . OurAirports data is public domain, community-maintained, and has no accuracy warranty. The source's scheduled-service flag is historical data, not verified operating status.
- Maps: outbound https://www.openstreetmap.org/ with https://www.openstreetmap.org/copyright attribution and official Google Maps URLs: https://developers.google.com/maps/documentation/urls/get-started . Map-provider terms apply externally. No geocoding API or tiles are hosted.
- The deployed baseline uses Google Flights handoff and Booking.com links; dates/party may not prepopulate correctly. The unmerged SerpApi draft beta can query live Google Travel **search results** via a backend key, with possible cached results; it cannot establish actual seat/room availability. Restaurant menus and transit fares remain unconnected.
- Practical requirements: https://www.iata.org/en/travel-centre/ , destination immigration/embassy research, and https://www.gov.uk/foreign-travel-advice (UK-oriented). Passport nationality, transit, residency and purpose matter. Checklist outputs are not legal/medical advice or independently verified eligibility decisions.

## Privacy and security

No account, analytics, server database or trackers. Saved trips live in this browser's local storage (up to 20), with clear and remove controls; shared-device users can read them. No passport data is requested. External searches transmit the destination/origin/dates/party in outbound links when clicked; these providers use their own policies. All user-visible values are assigned with textContent and fixed HTTPS provider URLs use encoded queries. CSP limits code, styles and requests to self, disables frames/objects, and sends a restrictive referrer policy. Local storage failures fall back to export.

## Maintenance

Refresh data manually only when needed; preserve licenses, provenance and retrieval dates. Respect Wikimedia throttling and stop on 429. Do not silently introduce a geocoder or paid inference. Add destination sources and meaningful tests, create a PR, check the exact commit and browser behavior, then release. Real-time requirements, schedules, weather and availability always need external confirmation.
