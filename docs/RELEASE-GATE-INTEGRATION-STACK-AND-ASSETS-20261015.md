# Wayfarer — Release Integration Readiness, Client Asset Closure, and Draft PR Train

**Assessment date:** 2026-10-15  
**Branch parent:** PR #60 `security/api-accepted-input-gates-20261015`  
**Release decision:** **NO-GO**. Integration structure is *not* security review, merge approval or successful live deployment.

## What the connected GitHub API establishes at the inspected baseline

- The repository has **51 open draft pull requests**, numbered **#8** and **#11 through #60**. All 51 are drafts. Each PR's `base.ref` equals the immediately earlier draft's `head.ref`, and PR #8 is based on `main`. There were **zero detected broken parent links**.
- The inspected protected `main` SHA is `833f08252a6aad8abf69cdbb87fe02d752719cb1`. Draft PR #60's head was `15c5613946204adfbb5eef4891f7cf3934da8d78`. GitHub compare shows **511 commits ahead**, zero behind, spanning **119 changed files** against that main revision.
- The existing Vercel **READY Production** deployment remains at an *older* `main` SHA `2b2c27aae6a9044e538e9140c105920edd733b38`. The two newer README/docs commits on GitHub main are not proof that Production contains the draft changes.
- No exact-head branch Preview is available. No new Vercel deployment, pull request merge or branch retargeting occurred.

These observations are from a point in time. They do **not** mean 51 PRs can be merged blindly, nor that each PR has adequate code-owner review, correct diff/routing, security clearance or a compatible schema/data migration.

## Delivered code-level integration safeguards

### 1. Browser asset dependency closure

`scripts/audit-public-asset-graph.mjs` scans all reviewed browser HTML/CSS/JavaScript files from `PUBLIC_STATIC_FILES` for **direct literal local references**, including HTML `src`/`href`, CSS `url(...)`, JavaScript imports, fetch URLs, `new URL(...)`, and simple asset-string literals. It verifies that each referenced local file is included in the 40-file public manifest, including disallowed `.mjs` client imports.

It ignores remote URLs, images hosted elsewhere, inline data URIs and serverless `/api` routes. A missing local client file returns a nonzero status, and CI fails. The test suite injects intentionally missing images and browser-side `.mjs` references to verify the failure path.

**At this revision, no missing direct local dependencies were found**. This is **not** proof that computed URLs, runtime fetches, CORS, authenticated resources, third-party images or map/Globe integrations work.

### 2. Read-only PR graph analysis

`scripts/audit-pr-stack.mjs` provides an **opt-in** read-only GitHub PR ancestry view. It checks one main-root draft, one child per parent head branch, no disconnected draft, cycle, duplicate head, unexpected head revision or missing ancestry metadata. It reports the ordered PR numbers and a structural verdict `CHAIN_STRUCTURALLY_CONSISTENT_REVIEW_REQUIRED` only.

**The tool never merges, retargets, reviews, approves, publishes or deploys.** Its optional live mode makes only GitHub public PR-list GET requests. Credentials, if available in the local runner environment, are used for read authorization and are not logged. Normal CI uses entirely synthetic PR graphs, so it does **not** consume GitHub API rate limits or depend on the availability of live connected accounts.

## CI and operator commands

```bash
npm run build
npm run check
npm run audit:public-assets
npm run test:release-integration
npm test
npm run release:report
```

To **voluntarily inspect the live draft ancestry** (read-only, never a merge command):

```bash
npm run audit:pr-stack -- --read-only-live \
  --expected-head security/api-accepted-input-gates-20261015
```

Before running this against future PRs, replace the expected branch name with the actual most recent draft head. If PR metadata is unavailable or inconsistent, the audit fails closed instead of saying the chain is empty or approved.

## Human integration review required before any merge

1. Verify every PR title, head/base and exact SHA has not changed since the snapshot. Review the first PR #8 *against current* protected `main`, especially pre-existing main-only documentation modifications; obtain code-owner/security approvals.
2. Integrate sequentially in the approved direction, checking diff scope, conflicts, test results, branch protection and downstream retargeting after each approved parent step. Do **not** automatically merge the whole stack or bulk retarget it to `main`.
3. Run source integrity, build output, security, accessibility and integration suite on a **real integration candidate**; unit tests on the latest branch are not proof of every intermediary PR after sequential merge.
4. Confirm free Preview capacity and obtain owner approval before creating an exact-commit Vercel Preview. Inspect real deployed static files, security headers, all eight `/api` functions, source truth and browser/mobile UX.
5. Resolve the five manually flagged historical credential candidates through independent provider-owner review, Preview environment access scoping, Vercel/GitHub permissions, actual operator identity and legal privacy/terms, billing protection for opt-in metered providers, and explicit owner Production release permission.

**Overall verdict: NO-GO.** Structural ancestry and direct browser asset references are now testable; missing approvals, live deployment, browser, legal, provider-spend and secrets evidence remain blocking.
