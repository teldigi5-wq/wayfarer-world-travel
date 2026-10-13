# Wayfarer Premium Research QA — 13 October 2026

- [x] JavaScript syntax: premium motion, public-source APIs, legacy hotel status API, new private SerpApi adapter.
- [x] Original recovered `test.mjs`: destination search, nearby discovery, Groq fixture, retired hotel status.
- [x] Existing responsive/premium design tests.
- [x] New SerpApi contract tests with **mocked network only**: invalid/unauthenticated requests, disabled provider, two real-shape search payloads, separate group flight and ground allowance, 429, empty prices, unsupported hotel group size.
- [x] Browser test at 360/390/650/768/1024/1440px (headless Chromium) for no JS page errors, no overflow, working navigation, and travel research section.
- [x] Browser test with stubbed API response renders a sample Google Flight search price and hotel rate distinctly; does not imply confirmation.
- [x] Existing production left unchanged.
- [ ] GitHub publish of recovered premium source.
- [ ] Vercel **premium project** Preview deployment.
- [ ] Preview API environment variables configured for `wayfarer-journey-ai`.
- [ ] One controlled actual SerpApi flight/hotel search (may use up to two free search credits).
- [ ] Real-provider and cross-browser/device QA, Lighthouse, accessibility audit.
- [ ] Durable per-user authentication, quota limits, production billing controls.

**Do not conflate mocked-search screenshots with live airline or hotel prices.**
