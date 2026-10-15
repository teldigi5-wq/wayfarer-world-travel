# Wayfarer — Release Gate Follow-up 01: PR integration and browser data transparency

Assessment date: **15 October 2026** · Repository: `teldigi5-wq/wayfarer-world-travel`

## Scope and verified observations

This is a release-blocker reduction pass **after** the Stage 50 milestone. It is not Stage 50 launch approval, production certification, an external penetration test, or a change to any paid-service setting.

### Verified development state

- **Protected `main` HEAD:** `833f08252a6aad8abf69cdbb87fe02d752719cb1`, as inspected during this review.
- **Last verified READY Production deployment:** `main` commit `2b2c27aae6a9044e538e9140c105920edd733b38`. GitHub `main` contains **two newer README/documentation commits** relative to that deployment, so the branch name alone is not proof of deployed code.
- **Parent draft PR #50:** `9825511311df54ac5a2a2d047866ebff879698a5`, based on draft PR #49.
- **Observed main → Stage 50 comparison:** 427 commits ahead, zero behind as of this inspection. This is an ancestry observation, not evidence of reviewer approval.
- **The entire inspected chain** is 41 open draft PRs: **#8, then #11 through #50**. There are no PRs #9 or #10 in this chain. Each newer draft targets the preceding draft's head branch. All 41 were inspected for their open/draft state and base/head metadata. They are not individually certified as having current passing CI, human review or Production-compatible migrations.
- A new follow-up PR adds a beta browser-data explanation and local deletion control and must remain stacked on #50.

### The actual reviewed merge order

**#8 → #11 → #12 → … → #34 → #35 → … → #49 → #50 → follow-up.**

Only PR **#8** directly targets `main`; #11 targets #8, #12 targets #11, and so forth. GitHub displays a relatively small diff for each stacked PR **because its base is another feature branch**. Merging #50 directly to `main` without an intentional integration review would bypass the intended staged review process. Never bulk-retarget, force-push, or merge the chain automatically.

Before an authorized merge:

1. Re-fetch `main` and all PR heads; recheck `mergeable` and required status checks on the **current** exact SHA, not the historical SHA recorded here.
2. Review #8 first against the current protected `main`, particularly the two README changes since the Production deployment. Run the full build, security, provider-truth and accessibility regression suite on the resulting integration candidate.
3. Obtain code-owner and security review. Advance *only* the reviewed parent PR after explicit owner approval. Recheck downstream PR bases/diffs and exact commits after each merge; GitHub may automatically retarget or alter stacked comparisons.
4. Verify no secrets in frontend artifacts and audit full repository history with an authorized scanner. Obtain a Vercel Preview at an exact integration-candidate SHA **only after confirming free-tier quota and authorization**.
5. Test full Discover → Plan → Arrive, real NASA/OSM browser behavior, cached source truth, opt-in Groq/SerpApi/Duffel safeguards, smartphone performance, keyboard navigation and rollback.
6. Request a distinct, explicit **Production promotion authorization** only when public legal/privacy/operator information, performance, security and provider gates are resolved.

### This PR's specific privacy improvement

- Adds `data-and-privacy.html`, `browser-data.css` and `browser-data.js`.
- The beta transparency page explains browser-local saved itinerary drafts (`wf-trips-v2`) and arrival-checklist state (`wf-checks-v2`), external request boundaries, shared-device/localStorage risks and the limits of hotel/flight/entry information.
- A two-step confirmation is required before the page removes either storage key. It never calls `localStorage.clear()`, touches other keys, automatically sends requests or claims that downloaded copies, another tab's in-memory data or third-party records were erased. Storage failures are reported without a false success message.
- Adds disclosure links to the Discover footer and the **My Journeys** screen, replacing the inaccurate shorthand “Private, on-device storage” with “Browser-local drafts · not encrypted or account-synced”.
- The Stage 50 static release checker has gained a seventh **beta browser-data transparency** check. The separate manual **legal privacy/terms and verified operator identity** blocker remains **BLOCKED**. Passing seven code-level checks is not legal sign-off.
- Tests exercise cancel, no read/delete on initial load, unarmed confirmation, exact-key deletion, unrelated-key survival, simulated storage failure, accessible status messaging and source-level CSP integration.

### Outstanding blockers and limitations

**NO-GO** for full commercial launch. Unverified external evidence includes:

- Authoritative, operator-approved privacy policy, terms, customer support contact and regional applicability.
- A Vercel Preview of the exact approved SHA and real desktop/mobile Safari, Firefox and Chrome QA.
- Full Git-history secret scan, Vercel access/env review, scoped API penetration testing and real security response-header verification.
- Third-party WebGL/image/OSM interaction and network constraints, low-end phone performance, WCAG-level accessibility tests.
- Production rollback rehearsal, provider rate/spend caps, final source/airline/hotel provider authorization, and **explicit approval** for each merge and deployment.

If a source page is shown in the beta, **do not label it a lawyer-reviewed Privacy Policy**. It intentionally states that full legal terms and verified operator contact are outstanding.

### Validation

Run locally or in the repository workflow:

```bash
npm run build
git diff --exit-code -- airports-index.json
npm run check
npm test
npm run release:report       # remains NO_GO, intentionally
npm run release:require-go   # intentionally returns exit code 2
```

The earlier Stage 50 release decision remains available at `docs/STAGE-50-RELEASE-DECISION.md`; this follow-up provides additional evidence **without changing its NO-GO decision**.
