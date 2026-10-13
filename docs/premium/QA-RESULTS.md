# Wayfarer Premium Motion — QA Snapshot

Date: 13 October 2026.

**Local checks passed:**

- `npm run check`: syntax checks for motion controller and three backend endpoints.
- `npm test`: worldwide search, public-source APIs, Groq test fixture, disconnected-price endpoint and 4 additional design-system assertions.
- Headless Chromium + Playwright at 360, 390, 650, 768, 1024, 1440 CSS px: no document horizontal overflow, no browser page errors, and successful transitions from Discover to Journey Studio to Arrival.
- Focus moves to active section heading during route change, `aria-current` reflects active route, chips have accessible pressed state, and reduced-motion mode disables decorative animation.
- Rendered screenshots manually inspected at desktop (1440x900) and mobile (390x844), including Journey Studio.

**Not yet verified:**

- Vercel Preview deployment of **`wayfarer-journey-ai`** (not performed); production remains untouched.
- Real external API calls and provider limits. The browser QA uses blocked external network requests and the API tests use mocks.
- External Google Fonts/Unsplash rendering under real network conditions; local screenshots use fallback fonts.
- Formal WCAG 2.2 AA conformance, real device GPU performance, or Lighthouse scoring.
- Live flight/hotel inventory or SerpApi integration. The recovered premium project contains public-source discovery and Groq, not authenticated SerpApi search.
