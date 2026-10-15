# Release Gate Follow-up 03 — Git History Credential Patterns and Vercel Environment Scope

**Review date:** 2026-10-15. **Status:** Development audit + redacted scan added; public/commercial **NO-GO** remains unchanged. No secret values or decryption operations were requested, and no Vercel configuration or Production deployment was changed.

## Evidence: read-only configuration metadata

The connected Vercel project `wayfarer-world-travel` currently exposes **five project variables** to metadata listing, each of type **sensitive** and targeted **Preview** only:

| Key name (never the value) | Target | Specific Git branch |
| --- | --- | --- |
| `WAYFARER_INTELLIGENCE_AI_ENABLED` | Preview | None specified |
| `GROQ_API_KEY` | Preview | None specified |
| `WAYFARER_AI_BETA_TOKEN` | Preview | None specified |
| `WAYFARER_TRAVEL_ENABLED` | Preview | None specified |
| `SERPAPI_API_KEY` | Preview | None specified |

Vercel's listing reported `hiddenProductionEnvCount: 0`. That is evidence about this **project-variable metadata response**, **not** a universal claim that no secrets exist in shared connectors, external provider dashboards, historical deployments or external services.

The Vercel project metadata indicated **Preview SSO protection enabled** and public password protection disabled; these are configuration metadata, **not** proof that every Preview URL is inaccessible or that its beta access is independently secure. Variables are not restricted to a named Preview branch in the listing. Recommend applying explicit branch/Preview scoping only after owner approval and verification that it will not break authorized test environments. Do not duplicate or read the private values for auditing.

Connected GitHub metadata confirmed the repository is **public**, has `main` as default, and the ruleset listing returned **no rulesets**. A branch-protection read returned **HTTP 403 Resource not accessible by integration**. This does **not** establish that `main` is unprotected; confirm the actual branch-protection status as an authorized repository administrator. Do not post vulnerabilities or leaked tokens in public issues.

## New technical gate: redacted reachable-history credential pattern scan

- `scripts/audit-git-history.mjs` consumes `git log --all -p -U0` as a bounded streaming text reader (not a giant accumulated history buffer). For each reachable commit and addition line, it checks **high-confidence patterns** for GitHub, AWS, Google, Groq, OpenAI, Stripe, Slack, GitLab and PEM private key headers, plus high-entropy literal assignments to known Wayfarer provider environment names.
- The scanner reports **only the finding class, short commit SHA and sanitized file path**—never actual key material or diff content. It refuses shallow clones, empty repositories and Git subprocess failures instead of falsely reporting a clean full scan. A positive result exits nonzero and is a **rotation / incident-triage blocker**.
- The `Checks` GitHub Actions workflow adds a separate `credential-history-pattern-audit` job for **pull requests only**. It checks out full Git history using `fetch-depth: 0`, with persisted GitHub credentials disabled, then runs `npm run security:history`. Normal push checks stay lightweight. The principal build/test workflow remains separate.
- Unit tests create isolated temporary Git repositories to ensure a deleted-from-HEAD synthetic token is found in an earlier commit, scans redact token bytes, clean history passes, incomplete or shallow history fails closed, and known placeholder assignments do not masquerade as verified incidents.

### First actual PR scan — redacted evidence

On reviewed commit `ff21086de01f75461f4c57c60ca1bedc51506ea9`, GitHub [PR workflow #38687626569](https://github.com/teldigi5-wq/wayfarer-world-travel/actions/runs/38687626569) completed **SUCCESS** with both CI jobs passing:

- **553 reachable commits** and **30,727 added textual diff lines** examined from the full-fetch GitHub Actions checkout;
- **zero blocking signature matches** in the supported high-confidence detectors;
- **five high-entropy provider-variable assignments found in historical test files**, preserved as `REVIEW_TEST_FIXTURE` entries without disclosing credential values. They occurred in `tests/production-metered-provider-lock.test.mjs`, `tests/security-response-bounds.test.mjs`, `tests/agent-trip-isolation.test.mjs`, `test.mjs`, and `tests/worldwide-pricing-flight-times.test.mjs`. **Their status as synthetic fixtures has not been independently attested**, so they remain manual-review candidates. Any recognizable credential-shaped literal or high-entropy provider assignment in non-test source continues to **fail CI**.
- Functional/build CI at the same SHA reported **345 passed, 0 failed**.

This is a historical point-in-time audit. Later branch changes require new exact-SHA checks. The test-file candidates and broader platform/provider credential audit **remain open**, even when this signature scan is green.

### Explicit limitations

**Not a comprehensive secret clearance.** The scan covers **reachable textual diff additions in refs fetched into the GitHub Actions checkout**, not orphan/unreachable objects, all deleted remote refs, binary archives, encoded/encrypted secrets, low-confidence unknown credential formats, external provider stores, Vercel runtime variables or GitHub Actions settings. Even a green pattern scan must **not** turn the Stage 50 combined `history-secrets-and-environment` manual gate green on its own.

A compromised credential can remain valid despite deletion from the current commit. If a genuine match is discovered: **do not copy the value to PR comments or build logs**, have the provider owner revoke/rotate it through its official dashboard, verify least privilege and downstream use, then evaluate any Git history rewrite **only with explicit owner approval** and a reviewed collaborator migration plan.

### Remaining launch requirements

- Manual security-owner review of GitHub and Vercel permissions, Preview target scope, repository branch protection and secrets/variables inaccessible to this connector.
- Provider-account audit for exposed tokens and verified revocations when needed.
- Exact-commit Preview, browser and deployed-asset review, keyboard/mobile/CSP/COOP tests, durable quotas/spend ceiling controls for any future metered API activation.
- Real legal policy, operator identity, contact method and separate owner approval for each stacked PR merge and Production deployment.

**Decision: NO-GO.** This PR introduces real, repeatable code evidence while deliberately preserving independent human approval and infrastructure security gates.
