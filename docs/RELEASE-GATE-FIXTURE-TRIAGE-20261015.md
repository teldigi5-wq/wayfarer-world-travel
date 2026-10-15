# Release Gate Follow-up 04 — Historical Fixture Candidate Review and Scanner Tightening

**Date:** 2026-10-15 · **Decision:** **NO-GO public launch**, despite automated tests and signature scanning passing. This document records *redacted* evidence only. It does not disclose credential-like values or certify account secrets as safe.

## Why another audit was necessary

Stage 53's history scan examined 554 commits / 30,738 added lines and found five `high_entropy_provider_literal` assignments in test files. The scanner initially downgraded **any** such finding in a test path to `manual_review` automatically. That heuristic was too permissive: an actual key can leak in tests, and the first harmless variable assignment on a minified line could mask a later suspicious assignment.

### Targeted historical evidence review (redacted)

These **five immutable Git commit/file pairs** appeared in the report. Each was inspected through its GitHub commit diff without reproducing its potential credential values. Four include text consistent with intentionally synthetic test/fake values in the variable assignments; the older `test.mjs` entry lacks an explicit synthetic marker in the matched value but appears with mocked network behavior and assertions. **All remain unverified manual-review candidates**, not certified safe credentials.

| Abbreviated historical commit | Exact changed file | Assessment / follow-up |
| --- | --- | --- |
| `0e32a9c75f32` | `tests/production-metered-provider-lock.test.mjs` | Production-lock test values appear intentionally synthetic; independent security-owner review pending |
| `3dabe99f6372` | `tests/security-response-bounds.test.mjs` | Response-bound test values contain test labeling; security-owner review pending |
| `949bdf282ad0` | `tests/agent-trip-isolation.test.mjs` | Agent isolation uses test/fake values; security-owner review pending |
| `ec769b69626e` | `test.mjs` | **Needs closer manual verification**: opaque-looking matched value in mock integration/test code lacks an explicit test marker; provider owner must check whether the value ever existed as an active credential |
| `05b831a947ea` | `tests/worldwide-pricing-flight-times.test.mjs` | Flight-pricing regression test value appears synthetic; independent review pending |

No credential text, leading/trailing fragments or hashes are written to this report. A provider-dashboard audit is required to determine whether any item was once live. **Do not rotate, revoke or rewrite Git history automatically** without owner approval; if a real exposed secret is confirmed, rotate it promptly through the provider and assess compromise.

## Security controls delivered

1. Replaced the broad `tests/**` pass-through rule with an explicit registry keyed by **full immutable 40-character commit SHA plus exact file path**. Only the five known historical high-entropy provider assignments are labeled `manual_review` so the existing report remains usable.
2. **Any new high-entropy provider assignment** in a test, fixture or application source now fails the CI scan, even when added to one of these file paths at a new commit. Recognizable GitHub, Groq, AWS and other high-confidence token formats and PEM private-key headers remain **blocking even in the five old locations**.
3. The scanner now checks **all** provider-variable assignments on a diff line, instead of only the first, so a harmless first assignment cannot mask a second credential.
4. Regression tests prove the five exact historical matches remain reportable, changed commits and files block, recognizable credential formats block everywhere, synthetic new test-file assignments block, multi-assignment bypass attempts block, raw candidate bytes are redacted and shallow clones cannot claim clearance.

These protections apply to the reachable, locally fetched textual Git history scanned in CI. They do not cover deleted unreachable objects, binaries, encrypted/encoded secrets, outside repositories, Vercel shared environments, previously built assets or vendor dashboards.

## CI and deployment requirements

- GitHub PR event must run **both** `functionality-data-security` and the independent `credential-history-pattern-audit` at the same final commit.
- Expected result: **zero blocking signatures** while all five historical candidate locations remain in the redacted manual-review queue. CI success does not clear the combined `history-secrets-and-environment` manual release gate.
- Review Vercel Preview variable scope: the earlier metadata inspection showed five sensitive Preview variables without a branch-specific assignment and no visible project Production variables. Do not change or decrypt them without the owner's authorization.
- Full independent history/secret scanning, provider dashboard validation, protected branch/ruleset review, exact-commit Preview/browser security QA, legal terms and owner-authorized integration/deployment remain outstanding.

**Release decision:** NO-GO. This draft PR tightens the scanner without weakening existing security exceptions or claiming comprehensive secret clearance.
