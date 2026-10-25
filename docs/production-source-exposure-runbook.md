# Wayfarer — Public Production Source-Exposure Release Gate

**25 October 2026 · Release decision: NO-GO until verified remediation.**

## Confirmed infrastructure state

The connected Vercel project is **wayfarer-world-travel** (project ID prj_7wNYs34jlDD6s4IrI1kWSDpbyn7b, team ID team_l9Hkxp0VvUgcGjJmTaCdRW1a). The currently aliased production deployment at this checkpoint is **dpl_2oiz1XqGtWSTzswD5DzqEhrvLVuT** (Git SHA 2b2c27aae6a9044e538e9140c105920edd733b38). At the public production alias, **GET /server.mjs returns HTTP 200 with server-source content**. This is a confirmed unnecessary source disclosure; it is **not** proof that API keys or credentials were exposed.

PRs #89 and #91 are merged on main. The exact-commit protected Preview at SHA 1e1c68eb8de65702e381f13922f63c177d2ce75d successfully served the 17 reviewed browser assets, kept tested internal files at 404, and returned safe rejection statuses for six Vercel Function routes. A Preview is not a production deployment and cannot prove production settings or browser behavior.

The repository's main differs from the currently deployed Production SHA by more than the static-output isolation fix. Do not promote it automatically.

## New independent read-only public alias audit

From a clean checkout of this PR/its reviewed merge commit:

    npm run check
    npm run build
    npm test

To intentionally check the **public production alias**, with **no authentication or other credentials**:

    WAYFARER_PRODUCTION_AUDIT=I_ACKNOWLEDGE_READ_ONLY npm run audit:production:http

This opt-in command is restricted in code to https://wayfarer-world-travel.vercel.app. It sends HEAD and bounded GET requests to the home page, all 17 reviewed public static assets, and 14 prohibited internal paths; six deliberately invalid/method-rejected GET requests check that Vercel functions execute safely and set no-store. GETs ask for only one byte via Range, discard the response body, and never print source contents. Redirects are denied. It never sends valid public-source searches, token-bearing headers, POST requests, paid-provider calls, or cookies.

**Expected today: FAIL**, because the current Production deployment still exposes internal source. PRODUCTION_HTTP_SURFACE_PASS_ONLY means *only* the 70 specified HTTP probes passed; the tool does not certify deployment SHA, cross-browser experience, secrets history, producer integration or production readiness.

## Separate reviewed production rollout — not authorized by this PR

1. **Owner approval and scope:** identify the exact approved source SHA and whether a minimal security-only hotfix is safer than shipping all changes in main. Freeze unexpected changes; check pending draft PR relationships, CI results, access controls, and reviewed environment scopes. Keep metered provider flags locked. Confirm Vercel Hobby/plan quotas before any new production build.
2. **Record rollback point:** obtain the actual Production-alias-to-deployment mapping from authenticated Vercel metadata, including all public aliases, the current deployment ID and Git SHA. Confirm the operator can revert the alias if the release fails. Do not call a Preview a production rollback candidate.
3. **Build without alias assignment:** for an authorized, clean, reviewed checkout, use the official Vercel CLI staged-production mechanism, **vercel deploy --prod --skip-domain**, with a reviewed pinned CLI version, production-scoped credentials in a protected environment, and verified team/project IDs. This creates a new production-targeted build **without assigning the public domains**. Do not pass tokens on the command line or persist a fetched env file as a build artifact. The API's generic target: production setting does *not* substitute for --skip-domain, because it could assign aliases immediately.
4. **Test the exact staged build:** authenticate against its immutable deployment hostname using appropriately scoped Vercel test access, without making it public. Verify the final static source denylist, all public assets, six API route guards, valid free public-source requests, headers, mobile/desktop browser journey, visual/keyboard/accessibility regressions, and runtime errors. Verify that no unexpectedly configured metered provider calls execute. An unauthorized 401/403 is **inconclusive**, never proof that a source URL is denied.
5. **Explicit owner approval for promotion:** only after gates pass, promote the verified production-targeted deployment ID; do not promote the old Preview build (it can rebuild against different environment variables). Check that public aliases now point to the approved deployment and run the public-production audit again. Verify actual runtime errors and representative user journeys.
6. **Rollback conditions:** if any source path exposes code, functions disappear, headers degrade, metered providers activate, or browsing fails, invoke the previously approved rollback procedure and independently revalidate aliases. Vercel rollback can change future automatic domain assignment; verify its actual state afterward.

If **any** stage cannot be independently verified, keep Production unchanged and report the blocker rather than substituting a green local unit test, a Preview READY badge or an unauthenticated protection-wall response.

## Risk ledger

- **Current risk:** repository implementation files are publicly retrievable from the old production build.
- **Unproven:** full historical secret review, operating privacy/terms approval, complete cross-browser and real-device verification, production Web Vitals and load resilience.
- **Current mitigation progress:** checked-in static build allowlist, protected-preview HTTP checks, production alias read-only gate, and CI tests. A production promotion has not happened.
- **No authorization given here:** billing/plan upgrades, modifying secrets, disabling deployment protection, changing the Production alias, or turning on paid API providers.
