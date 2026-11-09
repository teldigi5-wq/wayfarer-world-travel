# wayfarer-world-travel — AI continuity and milestone roadmap, 2026-11-09

> Owner handoff only; no deployment, merge or security acceptance. Always verify GitHub after this snapshot.

## Canonical state
- Source: https://github.com/teldigi5-wq/wayfarer-world-travel; protected/default `main` remains unchanged by this documentation PR.
- Latest relevant existing PR: https://github.com/teldigi5-wq/wayfarer-world-travel/pull/64
- Observed PR branch: `chore/stage64-readonly-integration-rehearsal-20261015`
- Observed PR SHA: `826d93d412426d0fe019c323ff68c669322a2481` (revalidate before coding).

## Status and existing work
**Status:** Stage 64 read-only integration rehearsal, not customer-bookable travel inventory. Stacked drafts require careful lineage integration.

**Preserved implementation:** Discover/Journey Studio/Arrival/Journeys UX and preview-only guarded provider exploration.

## Next distinct milestones and release gates
1. **M1:** Compare Stage 64 with main, Stage 63 and preceding stacked PRs; do not mass merge.
   - Acceptance: exact commit, reproducible evidence/test run, limitations and operator approval where required.
2. **M2:** Reproduce responsive Chromium, keyboard, privacy and reduced-motion tests.
   - Acceptance: exact commit, reproducible evidence/test run, limitations and operator approval where required.
3. **M3:** Verify claims about travel research versus real availability/booking.
   - Acceptance: exact commit, reproducible evidence/test run, limitations and operator approval where required.
4. **M4:** Keep $0 local fixtures and request paid/production approval separately.
   - Acceptance: exact commit, reproducible evidence/test run, limitations and operator approval where required.

## How the next AI should resume
1. Inspect README, roadmap, issue tracker and latest active/staged PR branches before touching code. Use `gh pr view 64 -R teldigi5-wq/wayfarer-world-travel --json state,isDraft,headRefName,headRefOid,baseRefName,statusCheckRollup` and `gh pr list -R teldigi5-wq/wayfarer-world-travel --state open --limit 100`.
2. Clone cleanly; `git fetch --all --prune` and review `git log --graph --oneline --all -30`. Keep historical branches and PRs, never blindly replay stages.
3. Explicitly label each checkpoint planned, coded, locally tested, exact-source CI verified, merged, deployed, and operator accepted. Never claim any level without direct evidence.
4. Protect secrets, production state, main branch and billing. No force push, account changes, silent merge, or paid service. Preserve zero-mandatory-cost path; use synthetic inputs unless owner authorizes more.
5. Change only the missing next milestone in a small draft PR, with results/risks appended to this doc; do not treat this handoff itself as test proof.

## Related material
- https://github.com/teldigi5-wq/wayfarer-world-travel/pull/64
- Other README and repo-local docs are authoritative for existing architecture and behavior; do not replace them with this abbreviated index.
