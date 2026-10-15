# Wayfarer Stage 63 — Browser Accessibility and Responsive Smoke

**Scope:** Draft PR stacked on #62. **Release decision:** NO-GO.

## What is tested in a real local Chromium browser

The existing offline browser smoke now checks actual keyboard **Enter** activation of navigation controls and verifies the active view's `aria-current="page"` marker. It also tests document-wide horizontal overflow and presence of main/navigation regions at **320, 390, 768, and 1024 CSS-pixel viewports** instead of only 390px.

The smoke listens for uncaught local JavaScript exceptions during the tested journey and privacy interactions. It verifies that the privacy page has a skip-to-main link with a valid target and actual button elements for opening, canceling and confirming deletion. Prior checks for homepage script execution, Discover/Studio/Arrival/My Journeys navigation, and selective localStorage deletion remain in place.

**CI execution:** `npm run build && npm run smoke:browser` in the PR-only `offline-real-chromium-journey-smoke` job. Node 24 CDP drives the already-installed Chromium browser using a temporary profile and locally served files. Third-party HTTPS resources are blocked; no supplier, payment, Vercel deployment or credentials are used. Browser test failures do not silently become skipped passes.

## Limits that remain

These checks are neither a full WCAG/screen-reader audit nor cross-browser visual approval. They cover four emulated viewport widths and selected interactions. They do not measure Core Web Vitals or validate actual production graphics/WebGL, maps, live flight/hotel inventory, backend AI agents, eight deployed Vercel Functions, or Vercel static output. The exact-SHA Preview, integration of stacked draft PRs, historical security-owner review, finalized operator privacy/terms and owner-authorized release stay BLOCKED.

**No merge or deployment authorized.** All results must be verified at the latest exact PR SHA before claiming Stage 63 complete.
