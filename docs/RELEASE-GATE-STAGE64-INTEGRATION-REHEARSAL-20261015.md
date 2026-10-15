# Wayfarer — Stage 64 Integration Rehearsal

**2026-10-15 | Status: NO-GO | Draft branch only.**

## Baseline verified with the connected GitHub API

At the beginning of Stage 64, **54 open PRs** (#8 and #11–#63) were all drafts, and all 54 parent-branch links formed one chain beginning at protected main. The previous passing PR #63 was at SHA c2b2f792371d1acb2a8b5e7c48b60b8d4d42c85d. Relative to current GitHub main (833f08252a6aad8abf69cdbb87fe02d752719cb1), it was **532 commits ahead, 0 behind**, across **126 changed files**. Vercel Production still served an older READY main deployment at 2b2c27aae6a9044e538e9140c105920edd733b38.

These point-in-time facts establish structural ancestry, not review clearance or production compatibility.

## Automated non-mutating integration check

The new scripts/rehearse-integration.mjs uses only local Git commands. It resolves immutable head/main SHAs, rejects unexpected SHA drift and unsafe ref arguments, checks shared history, measures commits/files, and tests whether main is an ancestor of the PR tip. For divergent histories it uses Git merge-tree to detect conflicts *without changing working files, branch refs or remote repositories*. Merge-tree can create temporary unreachable local Git tree objects; no source content from it is printed.

Reported states: FAST_FORWARD_POSSIBLE_REVIEW_REQUIRED; CLEAN_MERGE_REHEARSAL_REVIEW_REQUIRED; or BLOCKED with a generic reason. All outcomes set integrationApproved=false and productionAuthorized=false.

Tests use disposable local Git repositories and cover fast-forward, clean divergent merges, conflicting files, invalid revision arguments, missing history, unrelated history and SHA drift. The PR-only readonly-main-integration-rehearsal GitHub Action checks out the exact PR head with full history, runs those tests and rehearses against the fetched origin/main ref.

## Reproduction and review procedure

Run npm run test:integration-rehearsal, then npm run audit:integration-rehearsal -- --expected-head EXACT_SHA after fetching main with full history. Add --expected-main EXACT_MAIN_SHA to pin both revisions.

A clean result is **not an authorization**. Before any merge, independently review the entire draft chain, code security, GitHub protection and code-owner requirements, Preview quota and runtime, all eight API routes, deployed private-file exposure, browser accessibility, the five unresolved historical high-entropy test candidates, finalized privacy and terms, provider quotas and owner sign-off. Sequentially merge only with explicit authorization and rollback planning.

No PR merging, retargeting, Production or Preview deployment, paid-provider calls, secret changes or billing changes were performed. The manual integration and commercial-launch gates remain **BLOCKED**.
