# Local browser performance and accessibility baseline

The `Local browser performance baseline` workflow runs official Lighthouse 12.8.2 (benchmark-only, version pinned) on an isolated local static server in GitHub Actions. Its Node 24 script runs **mobile**, **768 px tablet** and **desktop** emulation, gathers first contentful paint, largest contentful paint, cumulative layout shift, total blocking time, speed index and Lighthouse performance/accessibility/best-practices/SEO scores.

## Run

```bash
npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund lighthouse@12.8.2
npm run benchmark:browser
```

The script starts the local `server.mjs` itself, writes `browser-benchmark-reports/mobile.json`, `tablet.json`, `desktop.json` and `summary.json`, and terminates the local server. GitHub Actions uploads the files as a 14-day artifact. The CI job uses read-only repository access and does not receive provider secrets.

## What this **does not** establish

This is a local synthetic **landing-page audit**, not authenticated end-to-end journey testing, production network latency, real-user Core Web Vitals, a mobile-device GPU profile, a booking/provider availability test or a concurrent load test. It does not access the public production hostname and blocks `https://*` third-party loads so font/image CDN variability does not contaminate comparisons. This may make font, image and SEO scores unrepresentative of the live site. The audit does **not** navigate through Journey Studio or verify all user interactions.

Lighthouse scores are sample estimates on variable shared GitHub runners, so absolute score thresholds are currently **advisory**, not gated. The job fails for an invalid page/audit run, but a low performance score alone does not fail CI. Compare several runs on comparable Chrome, Lighthouse, runner and source revisions before claiming improvement.

## Next release gates

For representative **real-user** data use CrUX or privacy-preserving RUM with appropriate consent, then authorized mobile/tablet/desktop browser interaction and layout tests on a secure preview. Do not use this local test to justify activating paid search providers or changing Vercel production aliases. Continue keeping historical synthetic API benchmark results separate from browser metrics.
