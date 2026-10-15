# Wayfarer AI — Stage 50 Release Readiness Decision

**Assessment date:** 2026-10-15 (Sri Lanka local date)  
**Decision:** **NO-GO for full public/commercial launch and Production promotion.**  
**Development status:** Code-level release preparation and CI automation may be complete while release gates remain blocked. Reaching Stage 50 is **not** authorization to merge, deploy, charge customers, or claim independently certified security.

## What Stage 50 actually verified

- The stacked Stage 49 parent is [draft PR #49](https://github.com/teldigi5-wq/wayfarer-world-travel/pull/49), initially at `9d6671d831e8139f9812415e2e96faec80da5839`. Stage 50 is stacked **on this exact PR branch**.
- Stage 49 passed push and PR CI with 323 tests, but that does **not** validate a browser deployment or establish a penetration-test certificate.
- Stage 50 switches the Vercel build to **offline, reproducible validation of a checked-in OurAirports-based reference**. No airport CSV download or refresh is performed during builds. The [daily-airports workflow](../.github/workflows/daily-airports.yml) remains the separate review-only refresh mechanism.
- The Checks workflow runs the real production build command, proves that `airports-index.json` was not modified, performs syntax/test checks and prints `npm run release:report`. The release reporter intentionally returns **NO_GO** while manual evidence is missing, even when all version-controlled checks pass.
- A small Wayfarer W-compass SVG favicon, canonical URL and source-honest social-sharing metadata are included. Only static source code is tested here; real browser favicon/social crawler appearance is not independently confirmed.
- The exact Stage 50 GitHub PR commit, its push/PR workflow links and any Preview SHA must be recorded in PR #50 before release approval. **Never substitute CI results from a different SHA.**

## Release gates and ownership

| Gate | Current state | Minimum evidence before approval |
| --- | --- | --- |
| Dependency PR chain | **BLOCKED** | Review the full unmerged stack, identify the earliest main-based PR, check ancestry/conflicts; merge sequentially only with owner's explicit authorization |
| Exact-SHA Preview | **BLOCKED** | A free-tier-compatible Vercel Preview built from the exact candidate SHA, matching the passing CI and showing correct static assets, APIs, CSP and metadata |
| Real browser QA | **BLOCKED** | Chrome/Firefox/Safari and Android/iOS checks for navigation, destination search, keyboard/screen readers, 320–1440 px viewports, reduced motion, no overlapped text, no passive external imagery requests, and no runtime errors |
| Discover → Plan → Arrive | **BLOCKED** | User-gesture-triggered World Explorer/map/airport/hotel references, optional Earth fallback, honest source labels and same-country-name geospatial continuity; itinerary save/resume and Arrival source freshness on a real browser |
| Supplier credibility | **BLOCKED FOR PAID FEATURES** | Keep AI/SerpApi/Duffel billable toggles disabled until verified provider entitlements, actual supplier sandbox QA, identity-based quotas, provider spend ceilings and abuse monitoring are documented |
| Repository/history secrets | **BLOCKED** | Authorized secret scanning of full Git history and current artifact/public frontend bundle; review Vercel Production/Preview env access; rotate discovered exposed credentials |
| Operator and legal information | **BLOCKED** | Verified operator identity, real support contact channel, lawyer-reviewed privacy notice and terms for applicable launch regions, published and linked from site. **Do not publish made-up identities or blanket privacy promises** |
| Security/pentest | **BLOCKED** | Security-owner threat review, auth/authorization tests, real HTTP security-header check and scoped manual pentest, WAF/CDN and third-party embed checks, plus audit of issue remediation |
| Mobile/performance | **BLOCKED** | Measured low-end phone LCP/CLS/INP, memory, navigation and JS budget; real NASA imagery origin CORS/WebGL fallback; performance and accessibility acceptance thresholds agreed |
| Explicit Production go/no-go | **BLOCKED** | Owner signs off approved commit/tag, tested rollback strategy, change window and legitimate deployment authorization; only then consider deploy |
| Production rollback readiness | **BLOCKED** | Preserve current READY `main` deployment; document exact previous SHA and verify restore procedure before promotion |

### Required real-browser smoke matrix

1. **First visit:** welcome splash is correctly sized, navigation works at high zoom and phone widths, no automatic focus outline or broken overlay, no automatic supplier/paid request, no console exceptions.
2. **Worldwide destinations:** country and city disambiguation, exact selected coordinates, quick airports, separately sourced hotels, provider outage and cache attribution; never treat lack of search results as proof of no rooms or flights.
3. **NASA Earth / Map Studio:** NASA original and mirror image paths, offline fallback, no background rendering, keyboard and pointer interaction, polar and Date Line OSM bounds, proper attribution and third-party sandbox link behavior.
4. **Journey Studio:** sources returned vs unavailable, no untrusted HTML/redirect, stale response cancellation, authorized private-beta only, place-coordinate checks, no fabricated AI fares/venues/schedules.
5. **Arrival and My Journeys:** browser-local saved drafts/resume of text/day counts/moods, same-name different-country geography, corrupted localStorage fallback, shared-device privacy warning, source timestamps and independent official entry/transport guidance.
6. **Public trust:** accurate favicon/social preview and SEO metadata; real brand imagery, operational links, accessibility labels, privacy policy and terms reviewed by operator, usable help/contact flow.
7. **Release operations:** actual security headers, origin-based CSP, no secrets in browser network/body/HTML, no unrestricted billable endpoint, observability/rollback, and exact-SHA Preview/Production parity.

## Deployment and rollback principles

- **Do not deploy as part of this audit.** Current Vercel Production was last independently checked READY on branch `main` at SHA `2b2c27aae6a9044e538e9140c105920edd733b38`; re-check at launch time rather than assuming it stays unchanged.
- Any future owner-approved promotion must identify a single exact commit, passing checks, a Preview from **that exact commit**, changed deployment env scopes, provider access and fees (if any), authorized operator, and a known-good previous deployment to restore. Free Hobby deployment quota must be checked; earlier attempts received HTTP 402.
- No automatic domain/billing changes, production secret updates, force-pushes, history rewrite, merging, or provider activation.
- The app remains a research/planning beta. Public maps, source-matched hotels and airports **are not a live inventory/booking feed**. Saved itineraries are browser-local, unencrypted planning drafts; do not call them account-synced or confidential storage.

## Automated verification commands

```bash
npm run build
git diff --exit-code -- airports-index.json
npm run check
npm test
npm run release:report
# Intentionally exits nonzero until the actual manual release gates are cleared:
npm run release:require-go
```

`release:report` is an **offline** source-level report, not a remote deployment/PR introspection tool. The report and manual gates are kept distinct so the tests cannot falsely authorize launch.

## Decision

**NO-GO — keep Stage 50 and its ancestor PRs in draft/review.** Code improvements are ready for review, but the remaining manual blockers must be resolved with recorded external evidence and a separate explicit owner launch decision. A free private preview/restricted beta may be considered in a **future separately authorized release** after an exact-SHA build and relevant safety/visibility tests; public paid travel services remain disabled.
