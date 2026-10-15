# Wayfarer — Release Gate: Vercel Static Output Allowlist

**Date:** 2026-10-15  
**Scope:** Draft release-hardening branch stacked on PR #55  
**Release decision:** **NO-GO until exact-commit Vercel Preview, API routing, and externally observed artifact exposure are verified**.

## Why this change matters

The repository uses Vercel's "Other" (no framework preset), with static HTML/CSS/JS at the project root and eight root-level `api/*` Vercel Functions. Vercel's documented build configuration says that for "Other", the static Output Directory defaults to `public` **if it exists**, or `.` (the repository root) otherwise. The previous project only hardened `server.mjs`, a Node **localhost** server, and did **not** change which files were eligible for Vercel static deployment.

Authoritative references, reviewed before this implementation:

- Vercel **Configure a Build / Output Directory**: https://vercel.com/docs/builds/configure-a-build
- Vercel **vercel.json / outputDirectory and functions**: https://vercel.com/docs/project-configuration/vercel-json

The change controls the **source-level static output**, but cannot independently certify Vercel's deployment artifacts without a real Preview.

## Implemented fix

1. Explicitly set `vercel.json` **`"outputDirectory": "public"`**. All existing eight `functions` definitions and `"buildCommand": "npm run build"` are retained. The project's framework preset is not changed.
2. After validating checked-in OurAirports references (the existing offline build), `scripts/build-airports.mjs` invokes the new `scripts/stage-public-assets.mjs`. It builds `public/` from the single explicit `PUBLIC_STATIC_FILES` manifest in `public-static-assets.mjs`, currently **40** reviewed browser-facing files.
3. Staging rejects duplicate/invalid filenames, symlinks, directories, empty inputs and oversized files; it deletes any old generated `public/` tree **only after** validating and reading the inputs, then writes fresh bytes with create-only file flags. Any unexpected output causes the build to fail. There are **no paid providers, network calls, npm external build dependencies or credential reads**.
4. `.gitignore` excludes generated `public/` so local staging artifacts cannot be committed by mistake. Root-level API implementations, server modules, token helpers, build/test scripts, docs and project configuration are **not copied into `public/`**.
5. The Vercel Build Command still runs `npm run build`; the daily-airports source refresh remains separate, explicitly reviewed and **never** runs as part of normal deployment.
6. `tests/vercel-static-artifact-build.test.mjs` independently checks file-by-file byte equality, exactly the manifest's filenames, correct landing/privacy asset references, absence of internal server/test/config paths, no network/build subprocess operations, and stale-file removal on rebuild. The release reporter includes a `vercel-allowlisted-static-output` source check.

## Critical operational difference: static output vs API functions

Root `api/*.js` and `api/*.mjs` remain in the repository and `vercel.json` `functions` section, **outside** `public/`. Vercel documentation says that root `api` functions are supported without special build adapters. However, no Vercel deployment has been created to verify how this project's specific `outputDirectory=public`, package scripts and API routing interact.

**Do not merge or deploy solely based on passing static tests.** The exact candidate SHA needs a Vercel Preview whose routing is verified in a real HTTP session. Test all existing API routes, their method/auth/error responses, server-side environment scopes, source-data provenance and costs. If API routes are missing or return static 404, the release is blocked and this output change must be reworked before any Production promotion.

## Required exact-commit live checks (blocked until approved Preview)

- **Public static:** `/`, `/index.html` (clean URL behavior), `/data-and-privacy.html`, CSS/JS, image assets, `/data.json`, `/airports-index.json`, `/country-atlas.json`, favicon, robots and sitemap should load with correct MIME and headers. Verify that real CORS/CSP/COOP/HSTS headers match expectations and no regressions affect the UI.
- **Internal source exposure:** URL requests to `/server.mjs`, `/package.json`, `/vercel.json`, `/provider-production-lock.mjs`, `/bounded-source-response.mjs`, `/test.mjs`, `/tests/*`, `/scripts/*`, `/docs/*` and sensitive dotfiles should be unavailable. Examine the **actual Vercel deployment output**, not merely the local `server.mjs` allowlist.
- **Serverless APIs:** Verify the eight `/api/*` routes are discovered and still execute; public research remains source-grounded, and Production metered-provider locks have not been bypassed. Do not enter real paid provider credentials or submit metered searches simply to test routing.
- **User experience:** Chrome/Firefox/Safari, mobile zoom and small screens, actual NASA texture fallback and OSM iframe, keyboard navigation, saved-trip continuity and arrival trust labels.
- **Operational:** preserve the current Production-ready deployment until explicit owner approval; verify rollback and free-tier Preview quota. Previously requested Hobby Previews were unavailable and no upgrade/payment is authorized.

## CI commands

```bash
npm run build                       # validates airport catalog and builds clean public/
git diff --exit-code -- airports-index.json
npm run check
npm run smoke:local                 # tests localhost server, a separate model
npm test                            # includes actual staged-public artifact tests
npm run release:report              # reports automated checks, remains NO_GO
```

**Caution:** `npm run smoke:local` tests `server.mjs`, not Vercel's deployed routing model. `npm test` verifies byte-perfect local output; it does **not** replace real Vercel Preview/API smoke checks.

**Result:** source-level public output is constrained by an explicit reviewed manifest. The independent `deployed-static-artifact-isolation` and `exact-sha-preview-browser-qa` manual release gates remain **BLOCKED**. No merge, Preview, Production deployment, provider activation, billing adjustment or secret mutation was performed.
