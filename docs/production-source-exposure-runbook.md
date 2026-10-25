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

## Manually gated staging workflow (never promotes)

After a qualified reviewer has approved the exact protected-main commit, an operator may configure GitHub **Settings → Environments → wayfarer-production-stage** with: required reviewers, restricted deployment branches (**main**), an environment-scoped secret named `VERCEL_TOKEN`, and an environment-scoped variable `WAYFARER_PRODUCTION_STAGING_ENABLED=true`. Never place the token in a PR, commit, repository file, chat transcript, build artifact or public log. A missing variable or secret intentionally blocks the workflow.

Open GitHub Actions → **Stage Wayfarer production without domain changes** → **Run workflow** on `main`. Enter the exact current **full 40-character main SHA** and the literal `STAGE_WITHOUT_PROMOTION`. This is a **manual workflow_dispatch only**. It first checks branch/SHA confirmation, then runs local check/build/tests, installs pinned Vercel CLI, validates both public production aliases still point to recorded deployment `dpl_2oiz1XqGtWSTzswD5DzqEhrvLVuT`, pulls the production-scoped build environment, builds with `vercel build --prod`, and runs `vercel deploy --prebuilt --prod --skip-domain`. It checks both aliases again after staging and records the staged immutable deployment URL in its job summary.

**Important:** The workflow is a staging mechanism, not an automated production release, browser test or permission to enable providers. Even a green workflow and a READY staged deployment leave promotion prohibited until the exact staged production build is independently audited with the protected-deployment credentials supplied only to the verified deployment origin, and until rollback and release approvals are documented. A failed/missing alias lookup, SHA mismatch or missing protected environment blocks the run. If either alias has changed from the recorded baseline, update this runbook only after independently reviewing the live production mapping and reauthorizing a new baseline; do not silently change the expected ID.

CLI compatibility and Vercel token availability are verified only when a deliberately authorized manual staging workflow actually runs. No hidden/background staging job is started by merging this workflow.

## Expanded source-disclosure evidence (25 October 2026)

Additional authenticated Vercel URL inspections of the unchanged public Production alias confirmed **38 distinct non-public paths returned HTTP 200**, including old application modules, unit tests, maintenance scripts, design/release documentation, two GitHub workflow YAML files, and the n8n agent workflow JSON. The inspected endpoints did not include real outbound provider calls. No source-body contents or credential values are reproduced in this report. This is an observed sample, not an exhaustive scan. The presence of publicly readable workflow configuration does **not** prove live environment secrets are embedded or exposed.

A central, reviewed `internal-source-denylist.mjs` now enumerates **64** forbidden historical/current paths. The authorized exact-commit Preview verifier sends read-only GET requests for this list; the opt-in public Production audit performs HEAD and Range GET for each. Neither script treats a Vercel authentication wall as successful source isolation. These protections augment — but do not replace — the stricter positive `public/` asset allowlist of only 17 browser resources.

**Production remains NO-GO:** the old production alias still resolves to the source-disclosing deployment until an independently staged and fully tested secure build is explicitly promoted. The existing old production deployment is **not a clean security rollback**; reassigning it after remediation would re-expose the implementation.


## Failed staging run #40171742223 — CLI identity-scope blocker

On 25 October 2026, the first deliberately approved, manually dispatched stage-only workflow for reviewed main SHA 4fe26fc8aeecd7687547d1e39cc8c1b5dfe1470f stopped during the production-config pull. The immutable SHA gate, configured staging flag, local syntax/build/Node tests, pinned Vercel CLI 65.1.0 install, and preflight REST API verification that **both public aliases were unchanged** had all passed. The next command (vercel pull --yes --environment=production --scope teldigi5-wq) failed with "Not able to load user because of unexpected error: User not found. (404)". No staged deployment, public domain reassignment, provider activation or production promotion occurred in that run.

This is **not** evidence of a GitHub minutes quota failure, test failure, secret leak, or invalid project ID. Team slug and project ID were independently checked. A project-scoped token can successfully retrieve project/alias information while Vercel CLI fails when requesting user/team identity, as described in upstream Vercel issue https://github.com/vercel/vercel/issues/17506. The protected token's actual scope was not disclosed, so **the exact underlying cause remains unproven**.

The manual workflow now includes a read-only CLI identity preflight immediately before vercel pull. It checks exactly these authenticated GET endpoints under https://api.vercel.com, without following redirects or logging token values, headers, response bodies, personal identities or production environment variables:

- GET /v9/projects/{reviewed-project-id}?teamId={reviewed-team-id}
- GET /v2/user
- GET /v2/teams/{reviewed-team-id} (Vercel's documented Get a Team endpoint)

Only three HTTP 200 results permit proceeding to vercel pull. A project-access success paired with user/team failure produces an actionable, non-secret diagnostic and deliberately blocks staging. The preflight **does not make a scoped token broader, fix the upstream Vercel CLI, verify deployment rights, or bypass later security checks**. A wider team token may work, but broadens the attack surface across projects. The owner must explicitly approve any credential-scope change in the existing protected GitHub environment; never paste tokens into chat, code, run logs, or PR comments.

Alternatives to review separately if limited-scope Vercel CLI remains unavailable: (1) request an upstream CLI resolution, (2) use a short-lived, least-privilege team-scoped credential with bounded rotation and strict environment approval if accepted, or (3) design and fully test a project-scoped Build Output API pipeline without automatic domain assignment. Do **not** substitute an unreviewed direct production API deployment, unprotected token or generic target=production call for the --skip-domain safety boundary.

After reviewing a compatible credential configuration, manually dispatch a **new** exact-SHA staging workflow. A passing preflight is only an authorization compatibility observation, not production release authorization. Verify immutable staged deployment, static paths, API routes, CSP, mobile/desktop journeys, provider controls, aliases, and rollback before seeking a separate owner-approved promotion. Until then the public alias remains on the older source-disclosing build and the release is still **NO-GO**.


**25 October preflight erratum:** The initial PR #95 preflight used the unversioned `/teams/{teamId}` URL and its unit mocks reproduced that mistake. The correct Vercel endpoint is `/v2/teams/{teamId}`; this correction uses an independent regression assertion against the published API path. The API-path correction does not prove that the existing protected token has the required scope or that `vercel pull` will succeed. The original CLI 404 remains unresolved until an approved staging run verifies a compatible token and completes safely.
