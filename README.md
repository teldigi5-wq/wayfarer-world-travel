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

### Stage 25 — elegant keyless Map Studio, official-airline exits and instant ground context (draft)

**No mandatory Google Cloud billing.** Wayfarer now has a premium, explicitly user-initiated **Map Studio** inside Journey Studio. After the traveler selects a mapped destination, the UI lists the destination and real sourced airport/hotel reference points. The map loads only when the traveler chooses **Open interactive map** or **View on map**. It uses OpenStreetMap's standard embeddable slippy map inside a tightly scoped `frame-src https://www.openstreetmap.org` policy. Zooming and moving the map in its embedded frame are possible; **no tiles are silently preloaded** and no large mapping library/API key is downloaded. The user can pause/remove the iframe. Attributions remain visible on the embedded map and immediately below it. Public OpenStreetMap map services are best-effort and rate-limited; for any high-volume commercial release, review a licensed or self-hosted tile alternative and usage obligations.

The three nearby intelligence cards summarize only **already sourced** airport straight-line distances, available mapped hotel-record counts, and the status of required live fare verification. They perform **zero extra network requests**. All map pins come from source-backed coordinates already present in the bundled OurAirports records, verified local OSM records, or Wikidata hotel entities. Provider-only hotels without geocoordinates remain unmapped; no invented positions, ground-travel times, walking paths, transit schedules or room quotes. Keyless **Google Maps URLs** support external map opening and navigation directions with an explicit traveler click and **without a Google Maps API key**, but do not integrate the billable Maps JavaScript/Places API.

Existing `/api/travel-search` continues to show source-returned **flight segment airlines, departure and arrival times, stops and indicative prices** only after an explicitly authorized protected search. No general-use free Google Flights fare/schedule API has been activated. Flight cards now show direct official-site handoff buttons for exactly matched, verified **SriLankan Airlines, Qatar Airways and Singapore Airlines** names; other carriers retain a Google Flights comparison link. These official website links **do not pre-fill or reserve the itinerary**. Travelers must enter routes and dates again and buy tickets independently on the airline's own checkout. No checkout, commission, payment or booking capability was added to Wayfarer.

Integration: `map-studio.js` (no dependencies), `nearby-results.js`, `api/explore.js`, `worldwide-hotel-sources.mjs`, `premium-app.js`, `travel-research.js`, `index.html`, `premium-refinement.css`, scoped CSP in `vercel.json`. Regression coverage: `tests/map-studio.test.mjs`. Production remains unchanged until the stacked PR release gates pass.

**Provider caveats:** Google Maps Platform requires billing even though per-SKU monthly free-call tiers exist. Google Flights Search's partner integration is not an unrestricted public consumer-flight API. The zero mandatory-cost version deliberately uses no Maps Platform API key, no automatic paid flight calls, and no implied right to scrape Google Flights or community maps at scale.

### Stage 26 — destination intelligence for every selectable country and mapped place (draft)

Wayfarer continues to use its existing 250-country directory, sourced global Open-Meteo destination geocoding, 8,951 build-refreshed OurAirports airport references across 236 country/territory codes in the last verified Preview (with a 1,000-airport offline fallback), and optional on-demand OSM/Wikidata hotels. **No hardcoded Sigiriya-only itinerary or price data is applied to other destinations.**

New `destination-intelligence.mjs` is an explainable **deterministic agent** (not LLM inference or a promise of real-time inventory). It runs inside the existing `/api/explore?mode=airports` and `mode=nearby` flows **without another API request**. It compares public airport coordinates, type and historical scheduled-service flags; retains the nearest local references, independently identifies up to three larger regional/major **gateway candidates**, prefers same-country references when possible, and reports when a likely gateway crosses a national border. It attaches country name, capital and region from the static directory; country metadata and airport types are **reference records, not current government facts or active airline timetables**. Actual airline route operation, transfers, visa/entry rules, hotel inventory, traffic, ground-travel duration and prices are deliberately not inferred.

Every mapped destination can now render the **Destination Intelligence** panel in Journey Studio with selected place, country facts, closest airport, hotel-source status, potentially relevant gateway choices and specific verifiable "before you book" suggestions. The first brief arrives with the fast local airport response. When OpenStreetMap/Wikidata records return (or fail), the panel refreshes with evidence availability without erasing the genuine references. Selecting **Compare flights** fills the requested arrival IATA and reveals the existing protected Travel Research form; it **does not automatically run a billable supplier search or LLM call**. No key, new paid endpoint, subscription, booking or Production setting was added. Maps, hotel names, coordinates and price provenance retain Stage 25 safeguards.

**Coverage honesty:** users can select 250 countries/territories, but some country centers, isolated locations and small islands have few or no airport records within the current 550 km radius; country centers are not guaranteed suitable visitor bases. Many destinations also have no named hotels when public OSM/Wikidata services are blocked or sparse. Wayfarer shows why data is missing and preserves a manual search path rather than inventing records. If mapped hotel results are unavailable, a **clearly user-clicked Google Maps hotel-research link** opens a search for hotels near the verified destination coordinates, with no Maps API key, automatic traffic or price claim. The traveler must verify the names and rates externally. The reference agent should not be presented as a live flight or immigration adviser.

Tests in `tests/worldwide-intelligence.test.mjs` exercise country-context and local-airport behavior across France, Japan, Australia, Kenya, Sri Lanka and Thailand, public-source failures, authentic cross-border caution, and explicit only-on-click supplier handoff. Interactive real-device review and an authorized supplier test remain release gates.

### Stage 27 — worldwide source orchestration and truthful speed (draft)

The destination research service now coordinates only **public, source-backed** map and hotel-reference lookups. It never treats an LLM answer as a verified hotel, fare, timetable, booking or visa fact.

- **Fast gateway first:** `/api/explore?mode=airports` remains an offline-backed response. The global OurAirports index already provides airport coordinates, so the OSM query is now **hotels only**, restricted to named mapped entries within 25 km (bounded response size) rather than repeatedly scanning airports over 140 km.
- **Hedged, not indefinitely sequential:** a bounded OpenStreetMap lookup starts first. If it is still slow after 850 ms, a Wikidata CC0 reference lookup may begin in parallel; if OSM returns mapped hotels promptly, there is no second query. Each provider retains a strict timeout. Source absence is shown as unavailable, never replaced by invented names. On shared public services, repeated searches remain subject to upstream rate limits and availability.
- **Per-instance, public-only deduplication:** identical full nearby requests from the same source-backed coordinates and country code coalesce. Returned results are copied before use so one caller cannot mutate another. Positive results remain cached for ten minutes; no-hotel results expire after 45 seconds; failures and malformed inputs are not cached. Cache scope is limited to anonymous public geographic references, **not** flight/hotel supplier quotes, protected tokens, guest dates, AI outputs, saved trips or account data. Cache is memory-only and disappears with a new server instance.
- **Customer experience:** immediate airport references and Destination Intelligence still render before the slower hotel check. On revisiting the same source-backed coordinates and country code, a bounded **in-browser public-place cache** can immediately restore known airport/hotel reference cards for three minutes (or 45 seconds if no hotel was found), avoiding repeat local API requests. The cache never stores supplier prices, authorization, trip dates, or private information; switching between same-name cities in different countries cannot mix locations. Map Studio remains opt-in, with no Google Maps Platform billing or background tile calls, and the explicit airline/supplier handoff remains unchanged.

Regression tests `tests/worldwide-source-coordinator.test.mjs` cover public query coalescing, cache isolation and expiry, bounded source overlap, fast OSM success, provider outages and no metered API interaction. Automated tests do **not** establish real browser Web Vitals. Before Production release verify multiple regions, provider/source policy, mobile UI and authorized supplier search separately.

### Stage 28 — route reliability and geographically safe supplier results (draft)

**Why this stage:** the established `premium-app.js` router incorrectly called `.forEach()` on a single element returned by `$()` rather than on a collection from `$()`. As a result, route changes could raise a browser `TypeError` even though isolated navigation simulations appeared to pass. The real router now uses the actual six-button collection. A new VM-based regression test executes the real handler and checks one active/accessible route across Discover, Destinations, Guides, Journey Studio, Arrival and Journeys.

**Protecting worldwide flight/hotel results:** different countries and coordinates can have destinations with the same name (e.g., Paris, France vs Paris, Texas). The public discovery cache already separates those places. Now the paid-capable supplier handoff also captures the **exact geographic identity** (name, ISO country code, latitude, longitude) when a traveler explicitly searches. It will not show a late hotel/fare response if they change locations, airports, check-in/out dates, occupancy, or destination while the search is in flight. This avoids presenting an authorized source price under the wrong destination; no new supplier API calls, fake prices, or auto-booking links are added. The location identity remains browser-only and is **not sent to the supplier API**. Historic unit callers can still pass no explicit context; the real app always passes the captured source context.

**Quality gates:** tests in `tests/real-navigation-and-quote-handoff.test.mjs` execute real router transitions and verify the actual protected form identity guard, and `tests/nearby-results.test.mjs` guards country/coordinate collisions for provider quotes. Run `npm run check && npm test`; then Vercel Preview and manual browser/mobile review are required before merging. PR remains draft stacked on Stage 27, Production remains unchanged, and no billing/secret changes are permitted.

### Stage 29 — accurate saved-world journeys and quote lifecycle (draft)

**One name is not one destination.** A previous save operation removed all journeys sharing the currently selected *name*, which could erase Paris, Texas when saving Paris, France. The existing on-device `wf-trips-v2` storage now uses `WayfarerJourneyIntegrity.upsertJourney()`, a deterministic identity based on destination name, ISO country code (or country label for legacy saves), and source-backed coordinates rounded to five decimals. Only an exact same-location resave replaces its earlier entry; distinct same-name cities and old country-only records are preserved. The local storage schema is unchanged; nothing is sent to a server. Curated city geography is still resolved exclusively through existing trusted static references. Resume now refreshes nearby airport/hotel cards for the restored place, or clears the previous geography when the saved entry has no valid coordinates.

**No stale prices after edits.** Authorized supplier quotes are indicative snapshots of one selected place and travel form. The Travel Research panel now removes prior displayed results and the nearby cards' cached quote overlay as soon as a traveler edits the origin, arrival, airfare budget, dates, guests, trip length or ground budget after a search. Re-selecting a destination also invalidates old supplier results. This refresh is entirely client-side: no automatic paid searches, no booking, and no silent supplier credit use. Earlier Stage 28 safeguards still reject in-flight responses if the originally submitted destination, airports, dates or guests have changed. The visitor can run another explicitly authorized price search when ready.

**QA:** `tests/journey-integrity.test.mjs` checks preserving distinct worldwide journeys and replacing the exact same place. `tests/nearby-results.test.mjs` checks removal of stale indicative flight/hotel prices and destination-change invalidation. Release requires green GitHub checks, an exact-commit Vercel Preview, and manual 390/768/1440px navigation, saved-trip resume and quote-change QA before any Production promotion.

### Stage 30 — geographically isolated Arrival readiness and truthful completion (draft)

The Arrival Companion's original private checklist was stored using only `destination + ':' + checklistItem`. This could mistakenly show personal preparation as complete when the traveler moved from **Paris, France to Paris, Texas**, or between two cities with the same name in one country. Source-backed global travel must never reuse such completion across different places.

`journey-integrity.js` now owns `checklistKey()` and `checklistChecked()`. Readiness state is namespaced by the same canonical **name + country + verified coordinates** identity used for saved trips, with a `arrival-v3:` prefix inside existing local-only `wf-checks-v2` storage. Local progress is not uploaded. Legacy city-name-only values are accepted **only for the original curated Kyoto, Bali and Switzerland references** when their country and static geocoordinates match; ambiguous worldwide cities are deliberately not migrated. Values must be boolean `true`, and unrecognized checklist item names cannot generate arbitrary keys.

The 100% status explicitly describes **four personal preparation reminders marked**, not that visas, entry clearance, reservations, transfers or payments have been verified. Underlying checklist items and their user-controlled semantics are unchanged.

`tests/arrival-checklist-geography.test.mjs` runs real Arrival UI logic in a browser-style VM with 0→25→100% checks and switching between same-name destinations; it also covers legacy migration, invalid keys and source-truthful copy. CI, real-browser focus/responsive checks and an exact-head Vercel Preview remain required before any Production release. This is a draft stacked on Stage 29; no paid APIs, secrets or Production deployment.

### Stage 31 — actual app bootstrap and worldwide Studio heading hardening (draft)

During end-to-end review, two real startup-time JavaScript exceptions were found in `premium-app.js`: the preference button listener and final destination-image observer incorrectly called `.forEach()` on `$()` (`document.querySelector`, a single element) instead of `$()` (`querySelectorAll`, an array). These errors can prevent further app initialization, including Journey Studio, Arrival Companion and My Journeys functionality, despite passing syntax-only tests. Both now use the correct collection helper; the Stage 28 primary navigation fix remains in effect.

Journey Studio also had a static hero label `Your journey to Kyoto` for every worldwide location. `build()` now updates `#studio-target` to the actual selected destination every time the local plan is composed, including mapped worldwide places and resumed saved journeys. It remains a **sample itinerary** unless explicitly verified AI output is available; the change does not claim new live inventory.

New `tests/studio-actual-bootstrap.test.mjs` evaluates the actual preference wiring and last-stage reveal observer bootstrap in Node VM, checks the heading changes Paris→Sydney→Nairobi without Kyoto text, and guards every `$()` reference against illegal array-like methods. These are source-level runtime harness tests, not an actual browser screenshot or guarantee of mobile visual quality. Full CI plus a matching Vercel Preview and interactive keyboard/mobile walkthrough are still release gates. No paid API access, user data migration, secrets or Production changes.

### Stage 32 — explicit supplier-search cancellation and stale-price protection (draft)

The protected flight/hotel comparison previously guarded a response **after** it arrived, but did not invalidate or abort its *in-flight* browser request when travelers changed their dates, country, airports, guest count or budgets. Switching values away and back could allow an older reply into the active trip if the final field values looked identical. That is unacceptable when searches may consume limited authorized supplier credits.

The Travel Research panel now exposes a keyboard-accessible **Cancel search** control (only while a request is active), blocks repeated simultaneous submit events, snapshots an incrementing request identity, and invalidates/aborts browser delivery immediately on any material form edit or location change. Responses and `finally` handlers from superseded requests cannot overwrite or unlock a newer active search. Already displayed indicative source prices are cleared on changes. Date, occupancy, route, airline budget, daily ground budget, destination and geographic identity are all verified before accepting a reply. **Cancelling the browser request cannot guarantee cancellation of an upstream supplier lookup or a charged provider credit already started.** Wayfarer does not issue a refund, reserve a flight or retry the request automatically.

The implementation changes only the first-party browser script `travel-research.js` and premium responsive/focus styling; it adds no API credits, keys, automatic provider calls, data collection or payments. `tests/travel-supplier-request-lifecycle.test.mjs` executes the actual submit handlers in a DOM-style VM against deferred mock network responses and covers double clicks, deliberate cancellation, country switching, edits followed by restoring the original values, and old/new request interleaving. The real protected supplier endpoint is never invoked in those tests.

Release gating: full GitHub CI must pass, a Vercel Preview must be built from the exact passing SHA, then the controls and disclosures need mobile/desktop keyboard and screen-reader QA. No Production merge or supplier search without explicit approval.

### Stage 33 — local travel dates and source-fresh Arrival Companion (draft)

World travelers must not see the wrong checkout date or expired source readings. The planner previously formatted hotel check-in/out defaults with `Date.toISOString().slice(0,10)`, which formats in **UTC**, not the visitor's local calendar. Near midnight, this can place a traveler on the wrong day depending on timezone. Stage 33 uses native local year/month/day fields, a local-noon checkout increment for daylight-saving safety, and updates the minimum checkout date when the traveler changes check-in. If the earlier checkout is no longer valid it is clamped to the next local day. Client-side controls remain subject to the existing server-side strict ISO date validation and explicit, beta-protected supplier search.

Arrival's public weather and country facts now carry a **destination/source-freshness identity**, including city, ISO country/label and map coordinates. The existing destination switch already reset research, but if a tab remained open for a long period it could continue to display increasingly aged weather. Accepted source research is now attributed to the current geographic identity and shown in Arrival only for up to **30 minutes** from this browser's accepted response. After that it shows an explicit **refresh needed** state rather than old conditions as current. It never refreshes automatically (no extra LLM/paid/provider calls), does not assert visas, flight operations, booking availability, or taxes are verified, and does not persist source readings to local storage. Intentional cancellation of a repeat research run keeps still-fresh previous context; changing the journey invalidates readings immediately.

`tests/arrival-source-and-local-dates.test.mjs` executes actual Arrival functions in VM and tests different-country same-name cities, expiry, invalidation and preservation on cancel; separate subprocesses under **Pacific/Kiritimati** and **America/Los_Angeles** validate date defaults near UTC midnight and checkout day constraints. All normal GitHub checks plus a matching Vercel Preview and manual mobile/desktop browser review are mandatory before any Production promotion. This is a stacked draft, no subscriptions, billing or new provider keys.

### Stage 34 — geographic scope for every authorized worldwide hotel-price search (draft)

Wayfarer's optional protected hotel supplier search formerly submitted a free-text `hotels in {destination}` request. This is **ambiguous across the world**: Paris (France vs Texas) and Springfield (Illinois vs Massachusetts) can produce materially different hotel results even when the UI knows the selected country's true map reference. The earlier browser-side result guard prevents old prices carrying across selections, but it could not fix an ambiguous query *sent to the upstream search provider*.

The explicitly authorized Travel Research form now snapshots the **selected mapped source location** alongside the ordinary destination/route/dates/budget: ISO country code plus latitude and longitude. The existing server-side `/api/travel-search` route validates the country against Wayfarer's bundled 250-country public directory, requires valid paired numeric coordinates when provided, and constructs the search context using the full country name and precise selected coordinates. For example, Paris, France and Paris, Texas produce distinct Google Hotels queries; two Springfields in the US remain distinct. When country/coordinates are genuinely unavailable, the previous city-only lookup remains possible but is explicitly labeled **not geographically verified**. Malformed codes or coordinates fail *before* any paid-capable supplier call. No extra API call is made to geocode the destination, and no Google Cloud Maps billing is activated.

The provider's results are still **indicative**: a more precise text query does not independently verify a hotel's physical address, room inventory, final rate or bookability. The response returns `hotelSearchContext` and the comparison UI shows the searched destination/country and whether public mapped coordinates were included. Users must verify the actual hotel address and booking before paying externally. The browser retains the existing trip-change cancellation, explicit beta token gate, no-store responses, allowance checks, safe airline-site handoff and no automatic supplier searches.

`tests/worldwide-hotel-provider-scope.test.mjs` mocks the SerpApi network boundary (zero real credits spent) and verifies cross-country same-name query differences, same-country coordinate distinctions, missing-geometry fallback, input rejection before provider calls, source-attribution copy and no token leakage. The usual GitHub checks, exact-HEAD free Vercel Preview and real desktop/mobile visual checks remain required before merging the stacked draft into Production.

### Stage 35 — trustworthy flight route continuity, worldwide (draft)

The existing private, **user-initiated** SerpApi flight research previously normalized provider `flights[]` by keeping segments with valid-looking IATA strings, then displayed an indicative fare without verifying whether the entire result actually connected the airports the traveler requested. That can produce misleading flight options, particularly for international connecting routes or malformed supplier data. Optional return-flight selection had the same weakness.

`flight-route-integrity.mjs` now provides a pure **zero-network** route validator. Both the main protected `/api/travel-search` and `/api/flight-selection` adapters require a complete 1–6-leg itinerary, valid source-provided airport codes for **every** leg, continuous arrival-to-next-departure connections, no malformed/zero-length leg, and actual first departure and final arrival matching the submitted outbound airports. For optional return selection, the expected direction is reversed from the original destination back to the original airport. Partial, inconsistent and unrelated provider results are **excluded before any indicative price, token or return-selection action reaches the UI**. No additional provider search, AI token, payment, or Google Cloud billing is involved.

This intentionally conservative check may omit some unusual valid **self-transfer or surface-transfer itineraries**, because Wayfarer cannot verify those transfers from the supplier response. It never claims airline operations, available seats, final payable round-trip fares or booking confirmation. Empty filtered results explicitly mean **no route-consistent itinerary from that search**, not that flights are sold out. Flight bookability and prices must still be verified on an original airline/supplier site.

`tests/supplier-flight-route-integrity.test.mjs` mocks the initial and optional return SerpApi network boundary; it covers valid two-leg routes, wrong starting/ending airports, mismatched connection airports, empty/malformed/oversized legs, no booking tokens from invalid offers, correct return direction and source-policy wording. Existing Stage 34 worldwide hotel geo-scope and source provenance remain unchanged. Test locally with `npm run check && npm test` and require an exact-head free Vercel Preview plus mobile/desktop review before any Production promotion. Keep this PR draft and stacked; no hidden live supplier calls.

### Stage 36 — source-verified round-trip airline offers, worldwide (draft)

Following Stage 35's strict Google Flights research validation, Wayfarer's **separate opt-in Duffel airline-offers adapter** now applies exactly the same zero-network route-integrity checks. A provider-supplied two-slice round-trip offer previously filtered invalid segment IATA codes and accepted any remaining non-empty segments. That could wrongly present a total-price offer for a disconnected, incomplete or entirely different departure/return city pair.

In `api/airline-offers.mjs`, both provider slices must now be complete with 1–6 well-formed segments. Outbound must depart the requested origin and reach the requested destination, and the return must reverse that direction. Each connection must depart the previous segment's arrival airport. Malformed, truncated, disconnected or off-route offers are **excluded before indicative total prices, offer tokens or refresh actions are exposed**. Refresh applies the same validation and returns `expired_or_changed` if the supplier's latest data no longer matches. There are no additional provider/API calls; this validation runs locally on the supplier's existing response.

These checks are conservative: legitimate surface/self-transfer itineraries without complete air segments may be omitted. They do not independently verify operating flights, actual inventory, usable layovers, visa/transit rules, taxes or final payable totals. The Duffel sandbox is **not real bookable airline inventory**, and production supplier mode remains gated behind separate explicit live approval plus credentials. No orders, payments, bookings or new paid integrations are enabled.

`tests/airline-offer-route-validation.test.mjs` exercises the actual airline-offer API with a fully mocked Duffel sandbox boundary. It checks correct international two-leg routes, wrong outbound or return airports, broken connections, malformed/oversized legs, no encrypted offer token for rejected results, and fail-closed refresh after the supplier route changes. Require `npm run check && npm test`, an exact passing-head Preview, and a real desktop/mobile walkthrough before any Production release. This PR remains draft and stacked on Stage 35.

### Stage 37 — luxury, source-grounded travel comparison at a glance (draft)

Flight and hotel supplier comparison already has detailed per-offer sorting, but customers must scroll through separate lists to understand the available figures. This stage adds a deliberately restrained premium **Research Snapshot** directly above the existing flight and hotel cards, only after an explicit source-backed protected search result is returned. It reuses the current provider payload **entirely client-side** and makes **no additional API, AI, map, hotel or flight request**.

Two independent summary facts are displayed: the **lowest returned outbound-only estimated group flight amount** and the **lowest returned displayed hotel stay total**. Each includes the number of corresponding provider search options. Missing results and disconnected sources show **Not available**, never a made-up estimate, zero-dollar fare or placeholder hotel quote. Malformed, non-USD or non-positive values are excluded from the displayed numeric minimum. These are not availability guarantees and might not include required taxes/fees.

**Critically, Wayfarer never adds these two figures together or calls them a trip budget.** The outgoing-flight source figure does not verify a return ticket, baggage, seats, operation or the final charge. The hotel source figure is a search-total indication without confirmed room occupancy, payable price, cancellation policy or availability. Taxes, transfers and other expenses remain unverified. The visible copy says so directly.

The new two-column forest/champagne editorial panel is responsive to narrow phones, respects reduced-motion preferences and uses plain-text headings plus an accessible summary region. Existing source and country-scope labels, explicit cancellation, sorting, provider authorizations and external-airline handoffs stay intact.

`tests/travel-comparison-snapshot.test.mjs` runs the **actual summary and UI show() functions** in a DOM-style VM against valid, mixed-currency, unavailable and replaced response fixtures. It checks no imaginary combined fare and no additional fetch/paid API usage. Full GitHub CI, exact-HEAD free Preview, and hands-on visual/keyboard mobile and desktop review remain release gates before any Production merge. This PR is draft stacked on #36.

### Stage 38 — reconciled source quotes and deterministic worldwide comparison (draft)

A source-integrity issue surfaced during the Stage 37 integration review: the new Research Snapshot displayed `6 usable source options` even if only two provider records had valid comparable USD amounts, because the count used **all** supplier items while the lowest quote used a subset. Detailed flight and stay sorting also passed raw `Number(...)` conversions to Array.sort, so missing or malformed totals could yield `NaN` and unstable order.

The summary now uses one reusable `comparableQuote` predicate: positive finite, strictly `NN.NN`-formatted **USD** values for the corresponding outbound group estimate or hotel displayed stay total. It counts only records with such values, and displays `Not available` when no comparable source quote exists. A separate `returned` count remains available for diagnostics; the UI never describes a raw unpriced record as a usable quote or implies actual bookable inventory. It still never creates an imaginary combined trip fare.

Detailed flight and stay sorting uses the same source-amount validation, placing missing, cross-currency, nonpositive and malformed prices **after** comparable quotes instead of allowing NaN to corrupt ordering. For shortest-duration and fewest-stop flight sorts, missing timing/stops sort last. Hotel name sorting works even when prices are unavailable. The original supplier payload is never mutated. The UI keeps individual results visible, with their existing source and availability caveats.

`tests/travel-comparison-snapshot.test.mjs` now evaluates both the actual quote predicate/sort and first-party summary renderer with mixed currencies, invalid/zero figures, missing stop counts/durations, no-price states and old-result replacement. No API, AI, geocoder, subscription or paid provider calls were introduced. Full GitHub CI, a matching free Vercel Preview and real-browser visual/accessibility checks are required before merging this stacked draft into Production.

### Stage 39 — worldwide destination search results cannot cross queries (draft)

A customer-facing race was found in World Explorer: if a traveler submitted a public destination search and then **edited the input**, the in-flight response could still populate result buttons under the new text. Submitting an empty or one-character new query returned early without cancelling older research. A successful result could therefore point at the *wrong country or place*, despite the location coordinates being source-backed for the previous query.

The World Explorer form now uses one `invalidateWorldSearch` path for three cases: **typing a new query**, **changing the country filter**, and **submitting a query shorter than two characters**. It aborts the previous browser request, increments the research sequence so even a provider response that ignores browser cancellation cannot render old results, clears stale destination buttons and updates the existing `role=status`/live-region guidance. Pressing Explore with a valid new query starts a new lookup, or safely restores a short-lived cached public result for that exact query and country. No extra request is triggered on each keystroke; results are never fabricated, and the optional bundled reference fallback still applies only to the current valid search. All functionality remains keyless/free and none of the protected supplier/AI services is invoked by these UI changes.

`tests/world-search-race-integrity.test.mjs` executes the **actual World Explorer onsubmit and input/change handlers** under Node VM against deliberately delayed/cancel-ignoring network replies. It checks a late Paris result cannot appear under Tokyo, a one-letter new search suppresses old results without another API call, a changed country blocks the wrong country's results, late provider errors cannot insert stale bundled suggestions, and public cache reuse still works only under exact query/country identity.

Stage 39 remains a draft PR stacked on Stage 38. Release requires full GitHub CI, Vercel Preview built from the exact passing head within free quota, and browser keyboard/mobile checking before any merge or Production deployment. There are no billing, provider credential or paid API changes.

### Stage 40 — worldwide Map Studio pin identity and accessible map focus (draft)

Worldwide public map sources may return hotels or airports with **identical names at different real coordinates**, and some sources may list an airport and a hotel with the same label. Map Studio previously de-duplicated pins using only `type:name` and considered a pin selected using only its displayed name. Consequently, distinct location references could disappear and a selected-pin state could highlight the wrong place even while the iframe and external Google Maps directions opened a different coordinate.

Map Studio now builds pin identity from the **reference category, mapped name and source-provided latitude/longitude rounded to five decimal places**. Two same-name places at different coordinates remain separately clickable and keyboard-focusable, while a truly duplicated category/name/coordinate reference appears just once. Pressed state (`aria-pressed`) now follows that same full identity. When two displayed places share a name, their reference coordinates also appear beside their category and inside the button's accessible label so travelers can distinguish them. Clicking a specific place updates OpenStreetMap focus and the external Google Maps/Directions coordinates for that place. It does **not** infer drive times, real hotel inventory, hotel room rates or route availability.

The existing opt-in map privacy/performance flow is unchanged: no map tiles before explicit Open map or mapped-pin interaction; Pause removes the iframe and destination changes reset focus. Google Maps links use the free external URLs, not Google Cloud Maps API keys or billable SDKs. No additional network searches, providers, AI calls, subscriptions or browser tracking are added.

`tests/map-studio.test.mjs` exercises the **actual Map Studio script** in a DOM-style runtime to verify same-name distinct-position hotels, coordinate-specific OSM markers and Google Directions links, selected-pin accessibility, exact duplicate de-duplication, category distinction, navigation to a new city and opt-in iframe loading. Require full GitHub CI, an exact passing-head free Vercel Preview, keyboard/mobile visual QA and owner approval before any Production promotion. Stage 40 remains stacked on the prior draft branch.

### Stage 41 — avoid false hotel-price identity matches (draft)

A significant trust issue was confirmed in the worldwide hotel handoff: `nearby-results.js` formerly linked a protected provider's hotel `displayedTotal` to an OpenStreetMap/Wikidata **mapped property using only the hotel name**. Different properties can share the same name, and supplier data currently lacks an independently verified common property ID or source-backed address/coordinates. Even with the correct city, dates and guest count, attaching a price to a mapped hotel was **not evidence that the price belonged to that exact building**.

Stage 41 deliberately separates two kinds of source evidence:
- **Mapped location reference:** its original name, source, straight-line distance and map/geographic actions remain, but **no hotel rate is attached by text matching**. The card continues to show `Price unavailable` unless a future authorized identifier-level property match can be verified.
- **Unlinked supplier-priced hotel:** the same explicit user-authorized Google Travel provider quote appears in a **separate card**, even if a local mapped hotel has the identical name. It is clearly styled and labeled `SUPPLIER SEARCH · ADDRESS NOT VERIFIED`, with no invented map location, distance, or clickable geographic pin. Price, date and guest snapshots retain existing protection, and the underlying Travel Research offer still carries supplier attribution and source caveats.

To keep the customer experience usable in large worldwide cities, the nearby card layout reserves enough space for mapped hotel references and unlinked supplier results within ten visible cards, rather than truncating provider records behind all ten mapped places. It does not initiate a second hotel lookup or book anything automatically.

New tests in `tests/nearby-results.test.mjs` check the same-name mapped/supplier card split, absence of incorrectly attached prices or geographic links on provider-only cards, price removal when trip dates change, correct coexistence with a full public map shortlist, and retention of source-backed mapped actions. No new paid API, Google Maps billing, secrets, map-tile background traffic or subscriptions. Release requires green CI, exact-head free Preview, manual browser mobile/desktop reviews and explicit owner sign-off before Production.

### Stage 42 — reliable worldwide nearby discovery and no stuck loading state (draft)

During integration review of source-backed Map Studio and nearby airport/hotel discovery, `nearby-results.js` accepted any numerically finite latitude and longitude, including geographically impossible coordinates such as **91° latitude** or **181° longitude**. A malformed third-party/location response could therefore trigger unnecessary public destination requests before the backend rejected the coordinates. When a traveler switched away from a valid place while the nearby search was still loading, selecting an unmapped place also returned early without removing the **world-loading** UI class, leaving an indefinite spinner even though no research was active.

Stage 42 consolidates a lightweight, pure **validMappedPlace** guard at the browser boundary. A place needs a nonempty bounded name, finite numeric latitude in −90..90 and longitude in −180..180. The same check gates current-place identity, new nearby research, and free external hotel-location links; zero-valued equatorial/prime-meridian coordinates are permitted. Invalid or missing geography immediately resets source cards to a clear instruction, aborts any earlier request, invalidates old result sequence, clears the spinner, resets Map Studio's selected location, and does **not** spend public API requests, let alone paid provider credits. It does not guess alternative coordinates or assert a supplier's actual hotel address.

Existing fastest-available airport-first parallel lookup, country-aware public reference cache, user-controlled Map Studio and provider-price separation are preserved. No dependency, new account, background search, Google Maps Platform SDK, paid API or billing setting is introduced.

`tests/nearby-results.test.mjs` executes the real nearby-browser module in VM for invalid/out-of-range/non-numeric/missing coordinates, zero network on invalid data, no stale supplier quote identity, pending network responses arriving after an invalid selection, immediate loader cleanup, and genuine 0°/0° coordinate lookup. Existing flights/hotels/map/AI/full-site tests remain required. The release gate is full green GitHub CI, a Preview of the exact passing revision within free Vercel quota, interactive mobile/desktop and keyboard QA, plus owner approval before any merge or Production promotion.

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
