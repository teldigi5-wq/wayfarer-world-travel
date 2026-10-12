# Wayfarer

> **Optional n8n + Groq AI beta (disabled by default).** A gated, server-side Groq agent integration has been proposed on a feature branch. Three distinct model-backed research agents and an encyclopedia source call are orchestrated in n8n, but the feature requires owner-provided n8n hosting and Groq credentials. It is **not live** or part of the $0 no-key deterministic baseline. Setup, tests, licensing and limitations: [n8n/README.md](n8n/README.md).

> **Provider-backed flight and hotel offers (new draft beta).** The protected `/api/travel-offers` endpoint can request supplier-returned round-trip flights and hotel offers from Amadeus when the owner configures credentials. **No provider account is connected by this repository; live prices and bookability are not activated on the published website.** Amadeus TEST data are limited/cached, and the UI marks them **NOT LIVE**. Restaurant menu prices and realtime local transit fares require independent official/licensed providers and remain **Not connected**. A returned fare is not a booked or guaranteed ticket.


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

## Supplier-backed travel prices & availability — gated beta

The dedicated **Travel prices & availability** section, present on the feature branch only, makes a separate secure request to `POST /api/travel-offers`. Flight/hotel prices **do not come from Groq**. The browser never receives supplier API credentials.

| Category | Beta source | Truth boundary |
|---|---|---|
| Flights | Amadeus Flight Offers Search: return flights, departure/arrival segments, total supplier currency/price, and any provider-reported bookable seats | A quote is **not** a booking, sold-out determination, or confirmed seat; reprice through provider before checkout. |
| Hotels | Amadeus Hotel List by city → Hotel Offers V3: named properties, total supplier price and quoted dates | Limited sample; one shared room for 1–2 adults; check taxes, bed setup, accessibility, cancellation and final availability. |
| Food | Restaurant/menu research link | No licensed global live food price feed; **no food price estimates** or fabricated menus. |
| Transport | Transit-route research link | No worldwide live timetable/fare feed; **no invented prices, schedules or service availability**. |

**Configuration is server-side only** (Vercel Preview first):

```env
WAYFARER_AI_BETA_TOKEN=<owner-generated private test passcode>
WAYFARER_TRAVEL_ENABLED=true
# Optional group airfare ceiling is set by the user, not by server env.
AMADEUS_CLIENT_ID=<owner Amadeus client ID>
AMADEUS_CLIENT_SECRET=<owner Amadeus client secret>
AMADEUS_ENV=test
```

Use `AMADEUS_ENV=test` only for developing and validating UI; responses are **not live**. Live supplier data requires the authorized `production` Amadeus environment, agreement/billing eligibility, and explicit owner approval. Production can incur charges after free quotas: **do not switch to production, add a payment method, or allow public traffic without cost controls and the user's approval**. This beta has only a shared private passcode, not robust individual authentication or persistent abuse controls.

The endpoint handles missing credentials by returning `not_connected`, upstream outages with `unavailable`, unsupported traveler room layouts with `needs_details`, no returned offers with `no_offers`, and dev quotes with `test_data`. **None** means tickets or rooms are definitively sold out. Data includes source/mode and a search timestamp. Food and local transport categories always remain explicitly unconnected until appropriate providers are implemented.

Travel dates are currently used both for outbound/return flights and accommodation check-in/check-out. A full booking UX would ask independently for dates, airport choice, cabin, passenger ages, bed/room layout, baggage, cancellation preferences, currency and traveller eligibility. The site does not process ticket payments, bookings or passport/identity information. No booking transaction should be attempted based solely on returned search results.

**Before enabling a public production integration:** establish provider commercial rights, per-user authentication, quotas/rate limiting, consent and privacy notice, destination/currency validation, fare refresh, full hotel occupancy support, accessibility checks, an operation budget, abuse prevention and legal/commercial hosting terms. Keep the deterministic planner working without any provider.

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
- The deployed baseline uses Google Flights handoff and Booking.com search links; dates/party may not prepopulate correctly. The unmerged beta uses documented Amadeus server APIs only after owner configuration. Amadeus test responses are **not live**; production usage may be chargeable. Restaurant menus and transit fares are not integrated.
- Practical requirements: https://www.iata.org/en/travel-centre/ , destination immigration/embassy research, and https://www.gov.uk/foreign-travel-advice (UK-oriented). Passport nationality, transit, residency and purpose matter. Checklist outputs are not legal/medical advice or independently verified eligibility decisions.

## Privacy and security

No account, analytics, server database or trackers. Saved trips live in this browser's local storage (up to 20), with clear and remove controls; shared-device users can read them. No passport data is requested. External searches transmit the destination/origin/dates/party in outbound links when clicked; these providers use their own policies. All user-visible values are assigned with textContent and fixed HTTPS provider URLs use encoded queries. CSP limits code, styles and requests to self, disables frames/objects, and sends a restrictive referrer policy. Local storage failures fall back to export.

## Maintenance

Refresh data manually only when needed; preserve licenses, provenance and retrieval dates. Respect Wikimedia throttling and stop on 429. Do not silently introduce a geocoder or paid inference. Add destination sources and meaningful tests, create a PR, check the exact commit and browser behavior, then release. Real-time requirements, schedules, weather and availability always need external confirmation.
