# Wayfarer

**Website:** https://wayfarer-world-travel.vercel.app/  
**GitHub repository:** https://github.com/teldigi5-wq/wayfarer-world-travel  
**Latest integration review:** https://github.com/teldigi5-wq/wayfarer-world-travel/pull/5

> Wayfarer brings **Discover → AI Journey Studio → Arrival Companion → My Journeys** into one premium, accessible travel-planning experience. The main domain points to Production; feature-branch changes are released only after Preview verification. Airline/hotel searches are indicative provider research, not guaranteed booking inventory.

### Worldwide search, flight times and service plans (draft beta)

**Public website:** https://wayfarer-world-travel.vercel.app/  
**Source and release review:** https://github.com/teldigi5-wq/wayfarer-world-travel/pull/8

- **Country atlas:** the Discover screen uses the existing searchable country/territory reference directory; selecting a country opens Journey Studio with its filter applied. The user still chooses a city and airports. All listed countries are discoverable; this **does not** imply every airport offers flights, that every city has complete attractions or that entry requirements have been verified.
- **Supplier flight schedules:** with Preview-only `SERPAPI_API_KEY`, `WAYFARER_AI_BETA_TOKEN` and `WAYFARER_TRAVEL_ENABLED=true`, the server may retrieve Google Flights search fares, airline and flight numbers, provider-reported departure and arrival times, total duration and stop count. The UI explicitly displays **ticket availability: not verified**; `bookableSeats=null` and `operationalFlightStatus=not_connected`. These are not live flight movement/real-time delay, guaranteed seats or final bookable prices. A return itinerary and booking options require a separate authorized provider interaction. Search results may be cached.
- **Hotel research:** where a provider returns an explicit total, the UI shows indicative total-rate search prices. Occupancy, room inventory, taxes, cancellation terms, payment and booking confirmation are not verified. Restaurant menu prices and worldwide transit fares are not connected.
- **Service price concepts:** Explorer is **$0/month** and represents presently accessible functionality. Journey Plus is **proposed $9/month** (not on sale), and Wayfarer Partners is a future custom-quote concept. **No checkout, subscriptions, payment processing, entitlements or paid accounts are activated.** Do not use them for advertising as launched paid services.
- **Motion system:** subtle editorial destination surfaces, refined card feedback, contrast-aware typography, accessible country-search controls, keyboard focus and reduced-motion support. It adds no WebGL or expensive motion libraries.

#### Optional flight selection and booking-seller research

A traveler can now explicitly select a Google Flights search result to investigate the next round-trip stage:

1. **Search flights:** `POST /api/travel-search` returns search schedules/prices. Each eligible outbound option includes a server-signed, short-lived `selection` token only when the provider supplies a `departure_token`.
2. **Select a return:** `POST /api/flight-selection` with the signed selection and private beta passcode performs a separate SerpApi Google Flights `departure_token` request. Returned return choices may include signed `booking` selections.
3. **Check booking sellers:** A **second explicit click** uses the signed `booking_token` to retrieve a supplier's `booking_options` seller and indicative price, with the response labeled `availability: seller_option_listed` and `seatInventoryVerified:false`. No booking forms or payments are submitted.

Each lookup may consume an additional search credit. The signed selection expires after **8 minutes** and binds stage, origin, destination, dates and traveler count. Signature tampering or expiration is rejected without a supplier request. The extra stage uses a **best-effort, in-memory per-IP throttle**, not a cross-region durable quota or abuse-proof authentication service. No additional API searches run automatically when the page loads. Browser UI uses safe text nodes for supplier content.

**Do not claim actual seats are confirmed:** A displayed booking seller is not an airline reservation, an issued ticket, or guaranteed inventory. The user must inspect actual fare rules and checkout on an authorized provider site. No seller-specific checkout deep links are constructed or submitted. Search results and provider information may be cached or change before purchase.

Provider reference: [SerpApi Google Flights Booking Options API](https://serpapi.com/google-flights-booking-options). A public commercial release still requires a suitable authorized booking/inventory provider, durable usage controls, explicit account/billing rules, monitoring and supplier terms review.

#### Flight comparison and external booking — the no-checkout model

Wayfarer is a **travel-research and referral website**, not an airline ticket seller. Customers can compare provider-returned schedules, indicative prices and booking-seller names, then choose **Compare tickets on Google Flights**. That link opens `https://www.google.com/travel/flights` in a **new browser tab** (`target="_blank" rel="noopener noreferrer"`); the Wayfarer tab stays open. Travelers may copy the itinerary reference and manually re-select it on Google Flights. **The link does not preselect or reserve the exact flight**, and no claim is made that a fare will be identical at checkout. Genuine airline or travel-agent specific deep links may be added only when a trusted provider returns an authorized, validated HTTPS checkout link.

For accuracy, Wayfarer uses these terms:
- `search_results`: provider-returned search schedule/price; **not guaranteed bookable**.
- `seller_option_listed`: seller shown in a Google Flights research result; **not confirmed seat inventory**.
- `no_results`: search found no usable offers; **not proof of sold-out tickets**.
- `sandbox_offer`: illustrative Duffel test mode; **never display as a real live ticket**.
- `supplier_offer_unbooked`: supplier live offer, where authorized; **may expire or reprice and is not reserved**.
- `confirmed_booking`: **not implemented**—requires an actual completed supplier booking transaction.

**Cost discipline:** SerpApi's current free tier offers a limited monthly search allowance; each fresh search and optional flight-selection call may count toward it. Duffel's test mode is free but has simulated prices. Live Duffel charges may apply for low booking conversion/excess searches and **is not necessary for our link-out-only MVP**. Do not enable Duffel live mode purely for outbound referral links. Provider limits, pricing and terms can change, so recheck supplier documents before launch.

#### Optional airline-authorized offers — Duffel test mode (new)

Wayfarer now includes an isolated `POST /api/airline-offers` supplier adapter and a Journey Studio airline-offer panel. **It is disabled by default** and is not connected to any actual airline account yet. The existing SerpApi Google Travel research remains separate.

To test with **zero actual ticket purchases**, create a Duffel Developer **test** account/token through [Duffel's test mode documentation](https://duffel.com/docs/api/overview/test-mode), then configure the following as **Sensitive, Preview-only Vercel environment variables** in `wayfarer-world-travel`:

```env
DUFFEL_ACCESS_TOKEN=<private Duffel developer TEST token>
DUFFEL_MODE=test
WAYFARER_DUFFEL_ENABLED=true
# WAYFARER_AI_BETA_TOKEN=<existing private beta code>
```

Do **not** put any Duffel or SerpApi keys in the website, GitHub, README, frontend code, or client-side storage. The existing private Wayfarer beta code authorizes requests from the browser; provider tokens stay server-side. Vercel env updates require a fresh Preview deployment. This adapter makes **one authorized offer search on explicit user request** and optionally **one refresh per user click**.

- **Sandbox offers**: marked `SANDBOX — NOT REAL TICKETS`; `availabilityStatus=sandbox_offer`, `seatCountVerified=false` and `bookingConfirmed=false`. Duffel warns that sandbox prices and schedules are not realistic.
- **Live mode**: the adapter can only be activated with a live Duffel credential, `DUFFEL_MODE=live`, and an additional explicit `WAYFARER_DUFFEL_LIVE_APPROVED=true` gate. **Do not enable this without account approval, supplier commercial terms, global cost controls and compliance review.** Live offers show `supplier_offer_unbooked`, never `confirmed_ticket`.
- **Recheck**: a selected supplier offer is fetched again by its server-encrypted, 12-minute token. Quotes can expire, change or disappear before checkout; recheck remains informational and **cannot reserve seats**. No order, payment, passenger identity or ticket issuance endpoints exist.
- **Safety**: short-lived AES-256-GCM encrypted provider selections; strict IATA/date/group validation; bounded supplier responses and timeouts; no raw supplier tokens or API secrets in the browser response. Current in-memory per-IP limiting is best-effort and **not sufficient for a public live release**.
- **Pricing**: Duffel supplier offers display their original quoted currency and a total for all searched adult travelers; there is no invented FX conversion into USD. The independent ground budget and SerpApi estimates remain separate.

**Truthful ticket states:** `no_results` does not mean sold out; `sandbox_results` does not mean real inventory; `supplier_offers` and `offer_refreshed` mean a supplier returned an expiring offer, **not a booked ticket or guaranteed seat**. Genuine confirmed ticket status needs an authorized provider's successful order/ticket confirmation, which this zero-cost beta intentionally does not perform.

Relevant official references: [Duffel Offer Requests](https://duffel.com/docs/api/v2/offer-requests), [Duffel Offers](https://duffel.com/docs/api/v2/offers), [Duffel test mode](https://duffel.com/docs/api/overview/test-mode).

#### Production readiness

This feature is in a draft PR. Do **not** enable supplier credentials publicly by copying Preview secrets into Production without cost/quota protection, consent and booked-inventory verification. Automated tests use fixture data and consume **no** real SerpApi credits. Launch gates: Preview browser testing, security and accessibility checks, durable server-side per-user rate limiting, explicit provider quotas, privacy policy and source/provider terms. See the [SerpApi Google Flights API](https://serpapi.com/google-flights-api) and [Booking Options documentation](https://serpapi.com/google-flights-booking-options).

### Resilient, source-grounded travel agents (October 2026, review branch)

One click on **Run AI journey** now coordinates four genuinely connected roles:

1. **Climate Context Agent** retrieves *current conditions* from Open-Meteo and marks them as **not a forecast for travel dates**.
2. **Destination Research Agent** retrieves Wikipedia destination context with an HTTPS source link, when available.
3. **Country Reference Agent** retrieves currency code, language and timezone from REST Countries without converting exchange rates or inventing country-entry rules.
4. **Journey Composer** uses the available public-source context to create a day-by-day AI draft through Groq **only when beta authorization and the AI opt-in flag are configured**. A verification step reports which tools actually succeeded, source limitations, a working ground-budget allocation and next actions.

Each independent, read-only public-source fetch has a bounded timeout and **at most one transient retry**. Groq is **not automatically retried**, as it is a metered service. The entire workflow has a bounded response budget. Partial failures return `verification.status=partial` with reasons; the original local sample is preserved if AI is unavailable. Weather, venues, local routes, visas and ticket availability are not fabricated. The frontend no longer marks failed sources as successful and provides a scannable verification summary.

To enable **optional Groq generation in Preview** (never expose secrets client-side), configure:
```env
WAYFARER_INTELLIGENCE_AI_ENABLED=true
GROQ_API_KEY=<private Groq API key>
WAYFARER_AI_BETA_TOKEN=<existing private beta access code>
```
The visitor enters the Wayfarer beta access code in Journey Studio. It is sent to the server in a request header, not in the URL or website source. If unauthorized or unconfigured, the public research still works and the local draft remains accessible. Do not enable metered AI to unauthenticated public traffic. Before production release, add durable per-user quotas, circuit breaking/monitoring and provider-budget alerts; in-memory/serverless safeguards alone cannot guarantee zero outages or costs.

**Agent responsibilities and limits:** agents can independently research and compose planning suggestions, validate their sources, check the group ground-budget *allocations*, and hand verified country/weather context into Arrival Companion. Airline fare searches, hotel research, seller checks and external ticket-booking links are explicit user-triggered actions to avoid silently spending quota or implying transactions. Wayfarer cannot independently buy tickets, book hotels, issue visas or verify seats without the appropriate authorized provider and user consent.

### Professional travel comparisons — UI release candidate (October 2026)

Journey Studio now displays legible flight and hotel comparison cards rather than long compact paragraphs. The changes are designed for real travel decisions, not visual spectacle:

- Flights show the supplier-reported departure and arrival airport/time of each leg, connection airports where known, stops, supplier-reported total duration, indicative fare per adult, and an **estimated group flight budget** distinctly labeled. No timezone, seat count, confirmed booking or full return-itinerary price is invented.
- Hotels show the **lowest displayed total search rate** (not nightly room price), check-in/check-out and night count, plus explicit occupancy/tax/availability caveats. The nightly rate, room inventory and exact seller checkout price remain unverified.
- Flight comparison sorts by *lowest group estimate*, *listed duration* or *number of stops*. Hotel comparison sorts by *lowest displayed total* or *hotel name*. Sorting is entirely client-side and **does not spend another provider query credit**.
- Search cards include clear price hierarchy, dark evergreen surfaces with warm ivory text, accessible keyboard sorting and practical mobile single-column layouts. They honor reduced-motion settings.
- Every flight offers a new-tab Google Flights comparison link plus itinerary copy. Hotel cards link to Google Hotels in a separate tab. These **do not** transfer an exact bookable flight/room or reserve inventory.
- Search timestamps and the limitations of live operational schedules, final checkout fares and unavailable provider details remain visible. Supplier content is rendered as text nodes rather than executable HTML.

This feature is currently a stacked **draft Preview PR** on top of the resilient-agent branch. Verify the actual hosted browser rendering at mobile/desktop widths and complete integration tests before releasing it to Production. No payment system or new supplier integration has been activated.

### Cinematic Destinations + Travel Guides (Preview branch, October 2026)

The customer-focused Destinations and Guides product views have been added to the existing navigation while keeping Discover, Journey Studio, Arrival and Journeys intact. Unlike inspirational design mockups, these are functioning pages:

- **Destinations**: photographic introduction, featured Kyoto, six curated starter destinations, free-text search, region/travel-style filters, reset and a useful empty state. Destination actions either reuse the existing Kyoto/Bali/Switzerland planning controller or prefill the worldwide Studio search, requiring the customer to choose the actual city result before a plan is changed. The broader ISO country directory remains available from the Discover view; a listing does not guarantee destination-data or flight coverage.
- **Guides**: searchable starter collection with Planning, Culture, Arrival and Nature topic controls, keyboard-focusable detailed reading views, source links, and access to Arrival Companion. Content is carefully labeled editorial planning advice and links to national tourism sources rather than pretending to be updated expert-certified guidance or official visa clearance.
- **Navigation**: six working product views. At small widths, the tab bar uses a legible two-row layout rather than six tiny buttons on one row. Focus rings, alt text, empty-state messaging and reduced-motion support are retained.
- **Professional art direction**: full-bleed scenic visuals with dark evergreen and warm ivory contrast, disciplined editorial headings and quiet hover movement. Missing external images fall back to readable gradient surfaces with destination text, not misleading replacement images.
- **No new paid API calls**: Browsing, filters and guide reading all run in the client with local curated data. Flight, stay, agents and any metered API integrations remain separately authorized and manually triggered.
- **Accuracy**: the screenshots generated during design exploration are not the live interface and may have shown fictional ratings, fares, expert endorsements or paid plans. Those illustrative claims are **not included** in this implementation. All official sources open in a separate browser tab. Supplier bookings and payments remain unavailable.

Development review: `feat/cinematic-destinations-guides-20261013`, stacked on the active comparison/agent work. Full GitHub CI and visual Preview acceptance are required before merging any of these changes to Production.

### Ten curated destinations + Sri Lanka attraction guide (Preview candidate)

The Discover homepage now includes an **editorial collection of 10 countries** in a 2×5 photographic grid with a Sri Lanka spotlight. This is **not a statistically ranked global top-ten list**. Each country has an accessible detail view, a set of **specific real places to visit**, contextual planning guidance, official tourism references, and `Plan [place]` actions that prefill the World Index in Journey Studio. Customers must select the matching search result before their trip selection is changed.

The collection includes Sri Lanka, Japan, Italy, Switzerland, France, Iceland, Thailand, Indonesia, Norway and the United Arab Emirates. **Sri Lanka's highlighted places:** Sigiriya, Ella, Galle Fort, Nuwara Eliya, Kandy, Yala National Park and Mirissa. These are editorial starting points, not guaranteed opening hours, entrance prices, travel times or available tickets. The data lives in `country-atlas.json` (10 countries, 52 attraction summaries) to keep country content independently maintainable.

- **Accuracy and sources:** Tourism links are per-country HTTPS resources. For Sri Lankan cultural heritage, consult [Sri Lanka Tourism](https://www.srilanka.travel/) and the official [Cultural Heritage reference](https://www.srilanka.travel/cultural_heritage). All fares, room inventory and border clearance require separate verification.
- **Progressive enhancement:** The atlas loads a local static JSON file; if it cannot load, a readable fallback message appears and the original Discover and Journey Studio still work. Browsing/filters do not spend SerpApi or Groq credits.
- **Accessibility and responsiveness:** Properly labeled buttons, aria-live search-result count, empty states, readable country and place cards, keyboard-visible focus, mobile single-column guides and a reduced-motion treatment.
- **Licensing and imagery:** The Sri Lanka Sigiriya image comes from a free-to-use Unsplash photograph; other curated destination images are requested from Unsplash. The site remains readable if any image fails. Do not mistake concept mockups for actual available rooms, ticket fares or endorsed travel plans.
- **Deployment:** These changes are on `feat/top10-country-atlas-srilanka-20261013`, stacked on draft PR #13 (which builds on earlier flight-comparison and agent work). CI + protected Vercel Preview visual QA are mandatory before Production.

### Branded loading screen and customer-clarity hardening (Preview candidate, October 2026)

Wayfarer now has a short, cinematic first-visit entrance with the existing mountain-lake photo, evergreen overlay and ivory/gold wordmark. The intro is **decorative**, not a pretend progress indicator: it does **not** await Groq, SerpApi, images or other provider APIs.

- **First paint shows the splash, not the homepage.** It is the first visible element of the document, before the header and main content. Render-blocking first-party CSS makes the overlay visible even before deferred JavaScript executes, preventing homepage flashing. This is a branded *welcome*, not a simulated API progress indicator.
- It dismisses automatically after **1,350 ms** from controller startup, can be skipped immediately by clicking **Skip introduction**, closes with Escape, and is bypassed when the operating system requests **reduced motion**. It appears on each **full reload/navigation**, not when visitors switch internal application tabs.
- With JavaScript blocked, CSS automatically clears the overlay after **3 seconds**, so it cannot permanently obscure the website. For reduced-motion users CSS hides it from first paint. Note that no-JavaScript visitors may briefly see the static branded welcome before the fallback.
- The implementation has visible keyboard focus and transfers focus to the real page on dismissal. It has **no vendor libraries, paid API calls, external audio or autoplay video**.
- The homepage now explains the customer workflow in three readable steps: Discover → Plan → Verify. It clarifies that checkout remains on external providers. The former “Watch the story” button is now honestly labeled “How Wayfarer works”.
- Country detail views include a functional **Back to country collection** control with keyboard focus restoration, preventing visitors from becoming stranded on an expanded destination guide.
- Regression tests cover first-paint ordering, automatic dismissal on reloads, immediate skip, Escape, reduced motion, safe no-JS fallback, honest homepage copy and navigation.

This is a **draft stacked Preview release**, not an assertion that all browser issues have been eliminated. Run the full CI suite, visually review desktop/mobile in the protected Vercel Preview, then merge the dependent PR chain only after release approval. Production stays unchanged during review.

### Premium product refinement — no decorative motion switch (October 2026)

Wayfarer's six-view navigation now has one clear **Plan a journey** action in the desktop header instead of a public `Motion on/off` switch or a glowing `Source-led tools` status that could be mistaken for real-time provider health. The action uses the **existing Journey Studio router** and never initiates paid searches by itself.

- **Automatic accessibility:** `premium-motion.js` now follows the operating system's `prefers-reduced-motion` state and reacts to changes without local-storage preferences or a client switch. It disables hero parallax in reduced-motion mode, while all CSS fallback motion controls continue to work. Removed the old toggle markup, styles, and persisted-setting code. The first-paint splash now checks the OS setting only.
- **Calm cinematic composition:** Photographic hero remains rich, but its perpetual scale animation is disabled. Small, purposeful scroll response remains on desktop; transitions use lightweight CSS and avoid external animation libraries.
- **Premium but practical visual system:** High-contrast evergreen/ivory/gold palette, clearer editorial typography, more legible flight/hotel caveats, larger control targets, consistent nav focus states, and refined mobile navigation. The site still labels sample estimates, verification steps and external-provider checkout accurately.
- **Accessible modal splash:** While the short first-paint welcome is visible, Tab remains on **Skip introduction** rather than moving behind its `aria-modal` dialog. Skip/Escape or automatic dismissal transfers focus into the page.
- **Security and product truthfulness:** This polish does not switch on paid AI, alter provider keys, add checkout payments or guarantee supplier inventory. Browser visual QA and performance profiling remain release gates before merging to `main`.

This work is intentionally delivered as a stacked **draft review PR**, preserving the current Production site until the tested branch is reviewed.

### Design system and accessibility

- **Legibility before decoration:** dark evergreen interactive cards (`#12362D`, `#194237`), warm ivory text (`#FAF6EB`), calm green secondary text (`#C4D5CA`), and restrained brass accents (`#E8C992`). The functional panel pairs pass WCAG AA contrast checks.
- Serif typography is reserved for major editorial headings. Real itinerary, fares, checklists, search controls and verification caveats use comfortably sized sans-serif text.
- The Arrival and My Journeys screens load `legibility-system.css` last. It replaces the earlier low-contrast white panels without changing application behavior, offers or stored trips.
- Responsive cards, visible focus indicators, minimum-height interactive targets and reduced-motion preferences remain part of the release checklist.
- **Data transparency:** local checklists and saved journeys are browser-only; real-time flight tickets, hotel availability, visa clearance, menus and transit schedules are never invented.


> **Premium Wayfarer is deployed to Production.** The current main website uses the recovered cinematic design, Journey Studio, Arrival Companion and My Journeys as its default frontend. The earlier static homepage is archived at `legacy/world-travel-original-home.html`; preserved APIs, `n8n/` workflows and tests remain in this consolidated repository. See [PREMIUM_INTEGRATION.md](PREMIUM_INTEGRATION.md) for historical integration notes and CSP decisions. **Production does not currently have Groq/SerpApi credentials configured**, so credential-gated AI and live fare searches remain unavailable to visitors; never claim confirmed tickets, hotel rooms or live transport prices.


> **Optional flight + hotel research is implemented but gated.** The retired Amadeus Self-Service adapter was replaced by server-only **SerpApi Google Flights and Google Hotels searches**, requiring private credentials, beta protection and cost/rate limiting before public activation. No Production SerpApi credential is currently configured. Search indications may be cached and **do not guarantee ticket seats, hotel rooms, bookings or final checkout prices**. Food and transport price feeds are not connected.

> **Optional Groq/n8n AI beta (disabled by default).** Three model-backed n8n agents can propose destination guidance, flights/stays research and itineraries. They do not generate authoritative provider prices. See [n8n/README.md](n8n/README.md) for connection instructions.

A worldwide travel-planning experience with a free static research baseline and optional credential-gated provider integrations; the public site must not require paid API usage. Six local deterministic assistants coordinate destination data, flight handoff, nearby hotel discovery, itinerary scheduling, budget allocation and safety checklists. These are rule-based planning agents, not LLM inference. No checkout or booking integration is claimed.

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

### Saved journey geography and handoff integrity — release candidate

The My Journeys screen restores destination, duration, pace and budget without reusing coordinates from another trip. Three curated destinations (Kyoto, Bali and Switzerland) use their matching bundled reference coordinates and country codes. Other saved locations retain geographic coordinates only when the stored destination name/country agree and latitude, longitude and two-letter country code are valid. Older or incomplete records keep their destination/country label **without assigning an airport, location or country code**: travelers are prompted to select a matching World Explorer result before location-based research. These coordinates are saved planning inputs, not guarantees of external verification, current supplier offers or booking availability.

Browser-stored journeys are validated as an array before use, so corrupted local storage will not crash the saved-trip view. Primary navigation now updates `aria-current="page"` for the active view. Regression coverage lives in `tests/journey-integrity.test.mjs`; `npm run check` syntax-checks the pure, no-network `journey-integrity.js` helper. These changes do not activate paid AI/supplier APIs, alter provider secrets or release automatically to Production.

### Single-active navigation and Journeys empty state — October 2026

A visual review showed **Discover** and **Journeys** both receiving similar highlighted treatments while the Journeys screen was visible. Navigation now has one authoritative state: the displayed `.view.active` determines both the highlighted `.active` button and its `aria-current="page"` marker. Hover is intentionally subtler than the selected route, with separate touch behavior and a restrained brass underline for the genuine selection. This avoids confusing desktop hover and sticky touch states.

The My Journeys section now includes an immediate, non-interactive first-paint empty-state explanation. Client initialization replaces it with the existing fully interactive collection view, including the plan-first-journey action and valid saved cards. It does not sync local journeys to an account or imply any booking inventory. Regression checks cover all six routes, stale route classes, hover/touch styling and the empty collection.

Release behind the stacked draft PR chain only after CI and real mobile/desktop keyboard and visual review. Do not enable metered APIs or promote automatically.

### Stage 20 — Discover-to-Studio handoff and mobile navigation

The ten-country detail pages, editorial destination cards, worldwide country directory and Explorer plan now **open the Journey Studio's Destinations tab before focusing World Explorer search**. Previously, those links changed the top-level screen but could leave the search field inside the hidden tab. Travelers must still choose a matching city from the search results; typing a country or place does not silently geocode it, reserve rooms, launch AI queries or imply booking inventory. Curated destinations with trusted bundled reference points retain the direct existing itinerary flow.

The six mobile navigation destinations are shown in a balanced **3 × 2 bottom navigation grid** below 650px, with accessible touch sizes, safe-area support and additional bottom content clearance. The selected route's brass indicator remains exclusive to the active page. The Studio's Overview, Destinations and Flights & Stays panels enforce the `hidden` attribute even if legacy styles declare `display:grid`. Route focus management does not steal focus from a destination search that was intentionally focused during the handoff.

See `tests/studio-mobile-handoff.test.mjs` for source integration, mobile layout, and a simulated route-focus regression. Automated checks and static Preview availability are release gates, not substitutes for human keyboard and device testing. The change adds no library, subscription, payment endpoint, background supplier request or mandatory cost.

### Stage 21 — named airport/stay cards with price provenance (draft)

The **Journey Studio → Destinations → Nearby airports / Nearby hotels** panels render readable, responsive cards rather than generic off-site links. Airport names, IATA codes and straight-line distance come from the bundled OurAirports-based reference (`data.json`) and, when reachable, OpenStreetMap Overpass. Named mapped hotels, straight-line distances and map links come only from OpenStreetMap contributors. No listing implies a reservation, hotel certification, operating flight service or a route distance.

Hotel/airline prices **are never generated from maps, fixed sample rates, or the AI**. They are shown as **Price unavailable** until the traveler deliberately runs the existing beta-gated `POST /api/travel-search` workflow. Successful results pass to `nearby-results.js` **locally in the browser**; displayed hotel totals require an exact normalized hotel-name match, the same selected destination, dates and guest count, and a valid provider-provided USD total. Per-night averages are derived mathematically from that total and the date range and explicitly labeled indicative. Airport airfare samples require matching destination IATA codes, dates, travelers and an actual provider-supplied per-adult price. These fares are not prices for airport access, confirmed bookable inventory or guaranteed round-trip totals. Changes to dates, party size or destination invalidate attached prices without charging for further searches.

**Fallbacks:** a failed OSM query does not erase the bundled airport references. For coordinates within 25 km of Sigiriya, a small **2026-10-14 public OpenStreetMap hotel reference snapshot** provides names and mapped coordinates for Hotel Sigiriya, Sigiriya Village, Jetwing Vil Uyana, Aliya Resort & Spa, Water Garden Sigiriya and Sigiriya Water Cottages. Each card is explicitly labeled as a dated reference and contains a link to the specific OpenStreetMap feature; it is **not a current operational, accreditation, room, rate or booking feed**. The snapshot is geographically constrained and never used for unrelated destinations. The same regional fallback includes **Sigiriya Airport (GIU/VCCS)** from its mapped aerodrome reference, without claiming that scheduled commercial services or bookable fares exist; other airports use the bundled OurAirports reference list. Elsewhere, missing map hotels yield an unavailable message rather than invented names. Missing provider prices always stay unavailable. `/api/explore?mode=nearby` caches public place data for 15 minutes and makes at most two attempts across public Overpass hosts. Dynamic pricing remains protected by existing beta authorization and explicit search action. Map links are restricted to HTTPS OpenStreetMap/OurAirports origins; UI text is rendered using DOM text nodes.

Code: `nearby-results.js`, `api/explore.js`, `premium-app.js`, `travel-research.js`, `premium-refinement.css`. Regression cases: `tests/nearby-results.test.mjs`. **Provider search quota and private-beta gates are unchanged; zero mandatory-cost MVP, no automatic supplier calls, no deployment to Production without approval.**

### Stage 22 — Worldwide named destination, airport and stay references (draft)

The existing directory contains **250 country/territory records** and **1,000 bundled airport references representing 233 country/territory codes**. This update preserves searchable worldwide countries, real selected-destination coordinates and source labels. Nearby airports use actual geographic distance from public OurAirports references and OpenStreetMap where available; the Vercel build runs `npm run build` to refresh the public-domain, IATA-coded airport index from the full OurAirports CSV. If upstream retrieval fails, the checked-in 1,000-airport fallback remains intact. A current complete index can include thousands of additional airports, including cities absent from the fallback; there is no implication of scheduled flights, ground transfer times, or IATA validation beyond the contributed reference.

The worldwide hotel discovery pipeline now has three **independent and source-transparent** paths:

1. **OpenStreetMap Overpass** public map geometry and named hotel records (best effort; can be rate limited).
2. **Wikidata CC0 hotel entities** within a 25 km geographic search when public Overpass does not return named hotels. Only geographically located items explicitly typed as a hotel are accepted. Place labels, approximate straight-line distances and Wikidata source links are shown, not invented reviews or inventory. Lookups time out and are cached in memory for up to 24 hours to avoid repeated public-endpoint demand.
3. Narrow dated **Sigiriya OpenStreetMap snapshot** already approved for user-visible fallback. Never displayed outside the Sigiriya region.

These sources do **not** guarantee a hotel listing in every city. In areas without source records, the UI states that data is unavailable rather than fabricating hotel names. Public provider usage is best-effort and not an operational SLA. A production-scale, high-throughput commercial service should use a licensed supplier or self-hosted map extract rather than rely on open community query endpoints.

Airport cards now label available municipality and ISO country code, while the discovery header shows the user's selected destination and country. Wikidata details open HTTPS WikiData URLs using the existing safe-link allowlist. After a traveler **explicitly authorizes** a protected hotel-price search, returned valid provider hotel names can appear as separate named cards even if no OpenStreetMap hotel record is available. Those supplier-only cards show **Distance unavailable** (not fabricated map coordinates), supplier source and checked price totals, and automatically disappear or lose their quotes if the destination, dates, or guest count changes. No automatic billing/booking calls are introduced. The existing supplier search remains beta-authenticated and explicit, and only valid matched fares/totals appear after a real provider response. `tests/worldwide-hotel-sources.test.mjs` covers Paris, Tokyo, Cape Town, Sydney and San Francisco plus bad data, geometry validation and cross-source fallback.

**Limitations:** all countries can be *searched*, but complete hotel names, price quotes, live routes, local services, photos, restaurant menus and availability worldwide cannot be guaranteed at zero operating cost. Do not present source-backed reference records as confirmed rates or real-time inventory.

### Stage 23 — responsive discovery, public-source agent caching and quiet luxury (draft)

**Performance model:** 
- Selecting a mapped destination immediately requests a **local airport reference** from `GET /api/explore?mode=airports` (no provider/network lookup on the server) while the independent `nearby` hotel/mapping request runs concurrently. Airport cards can appear even when hotel research is slow, rate-limited, or unavailable. Client request cancellation and selection-sequence checks prevent stale results from replacing a newer destination.
- Country-aware world search uses **server-side Open-Meteo geocoding** with an explicit country filter, a bounded timeout, a five-minute small browser-session cache for repeated identical queries, and cancellation on new searches/country changes. The previous browser-side geocoder fallback was incompatible with the restrictive Content Security Policy; fallback bundled hubs remain openly labeled as reference data when the public source fails.
- The source-backed Journey Studio already runs **weather, destination and country agents in parallel** before the optional Groq composer. Weather facts now reuse **three-minute**, Wikipedia destination text **twelve-hour**, and country-reference data **24-hour** per-warm-instance public-source caches. Simultaneous identical public GETs coalesce. Errors never cache; HTTP auth headers and token/key URLs prohibit caching. AI outputs and beta-gated searches are **never cached or silently retried**. Optional AI remains a separate explicit user action and its latency is still dependent on Groq and network conditions. Visible timings report actual server source/AI stages, not invented agent animations.
- Reduced serial public-map waits by using one bounded Overpass attempt before Wikidata reference fallback. Repeated worldwide hotel searches still depend on the availability, coverage and permitted use of public query endpoints; **faster rendering is not a promise of instant complete inventory**.

**Design/perceived speed:** First-paint splash remains user-visible but clears sooner; the important hero image has high priority, offscreen editorial sections use progressive content visibility, the destination search shows truthful status, and the evergreen/champagne design has more consistent typography, contrast, touch sizing and motion-reduced styling. Does not add large UI libraries or heavy continuous 3D effects.

**QA:** `tests/fast-luxury-search.test.mjs` covers source deduplication, private-token bypass, fast-airports (zero upstream calls), country-aware geocoding, and UI safeguards; `tests/nearby-results.test.mjs` verifies airports populate before the slower hotel result. CI, device/browser focus and layout checks, quota controls, and actual end-to-end timings are required before publishing to Production. No Production deployment or secrets changes in this draft.

### Stage 24 — agent research is tied to the current trip (draft)

Travel plans must never receive an agent itinerary generated for a different destination or set of preferences. `premium-app.js` now maintains a bounded in-flight research identity and a snapshot of **destination, selected geographic coordinates, country, travel days, budget, pace and interests**. Selecting another destination invalidates the earlier request and aborts its browser-side fetch; changing the brief mid-request causes the response to be **discarded**, not saved, applied to Arrival Companion or displayed as current. A superseded request cannot unlock the button belonging to a newer request. Arrival's refresh action navigates only after research is actually applied. The agent panel now includes a dedicated **Cancel research** control (44px minimum touch target and visible keyboard focus). It stops the active browser request, leaves the prior itinerary and its truthful AI/sample attribution intact, and prevents its late response from applying. Concurrent duplicate invocations are rejected. Choosing different travel moods/days/pace or changing the budget proactively invalidates obsolete research rather than waiting for its timeout. **Cancelling the browser request does not promise cancellation of an upstream metered AI call that has already started**; beta authorization and server quotas still apply. Note: aborting the browser's request does not guarantee a billable upstream Groq call has been canceled; manual authorization and quota gates are still required.

Live REST Countries currency, language and timezone references occasionally fail. When this happens, Wayfarer shows a **clearly labeled bundled country reference** (name, capital and region from the existing country directory) without inventing prices, entry rules, languages, currency or timezones. Its verification state remains **partial** or **unavailable**, not falsely successful. The bundled material adds no new paid API, package dependency or external lookup. Visual evidence blocks retain the premium emerald/champagne contrast.

**Journey handoff consistency:** Changing planner preferences discards stale agent context before Arrival can reuse it. Cancelling a new run can retain valid prior context and its existing source attribution. The offline notes export now labels an actual AI draft as **AI-GENERATED DRAFT · VERIFY BEFORE TRAVEL**, or labels a local plan **ILLUSTRATIVE SAMPLE · NOT LIVE BOOKINGS**, and includes its provenance and limitations. Older saved journeys are normalized to the UI's real 3/5/7-day durations, USD 25–2,500 daily ground-budget limits, and named pace options. The backend converts `Slow & considered` to `Slow` and `Full & energetic` to `Active`, rather than silently defaulting them to Balanced.

Regression coverage: `tests/agent-trip-isolation.test.mjs` simulates slow responses across modified briefs, switched destinations and a public country-provider outage. It now also tests cancellation/provenance, legacy saved-trip settings, stale Arrival context, and all three actual pace labels using a **fully mocked** AI composer (no real Groq/provider request). The existing source-grounding, authorization and no-paid-call checks continue to apply.

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
