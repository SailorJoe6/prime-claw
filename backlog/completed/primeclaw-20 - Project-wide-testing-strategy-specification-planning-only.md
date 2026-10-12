---
id: PRIMECLAW-20
title: Project-wide testing strategy specification (planning only)
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels: []
dependencies: []
references:
  - PRIMECLAW-22.1
priority: p2
type: feature
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design deliverable per operator charter 2026-10-02: reviewable testing-strategy spec + execution plan via design/plan workflow. Core invariant: test bodies isolated from running Prime Agent harness, gbrain, Postgres, Docker/OpenShell runtime, credentials, source; disposable Docker environments by default. Decisions locked with operator: no GitHub Actions workflow (CI interface only); tier-0 static tests stay host-executed. Lifecycle risk is control-plane scope (sandbox names, providers, policy, remotes), not binary/DB clobbering. Planning only: no implementation, no episode. Conversation 01a0fe09-9641-73af-9889-b44e302490d1.

## Legacy notes

2026-10-02 READY: operator approved the bundle via `/implement-spec`; episode creation was correctly blocked while prerequisites were open. `prime-claw-blw.5` and `prime-claw-zwg.5.1` are fixed in pushed main commit 3bf905976a1a489d93e81619a838b34fc7ed8a31, closed in 927b3941ebab281c18ceacfc3c922f82e75db9fc, and the approved bundle is reconciled as implementation-ready in eca48f8b284c990a8e030062ef70192313781b7f. Clean acceptance: `scripts/test-all.sh` tier0 PASS 52s (283 passed / 147 skipped), tier1 PASS 111s (40 passed / 390 deselected); standalone pinned 0.9.8 probe PASS; pinned fixture 20 passed / 1 deselected; watchdog 31 passed; plan/inventory 10 passed; no dependency cycles; `bd ready` exposes 5v7.2. No implementation episode exists yet. Replay `/implement-spec .ralph/plans/future/project-wide-testing-strategy` to create it.
IMPLEMENTATION COMPLETE — 2026-10-07. All eight ordered slices are owner-accepted and closed: Slice1 4cca0989475d7bd670620f31b67260342b3aac5d; Slice2 56afd99d3a4b5411eb37fb42210ffb36c8bf2b84; reduced Slice3 5d3db2f961d843a11289c38f5d60f646a8f65c9e; Slice4 854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a; Slice5 d7980cf051be8e459434ebc2a5d74753b0832e3b; Slice6 fda41dcadbac15b2c957c866d9e22eafb5f6afca; Slice7 e4cbc59e19fe823d598456dbf2185facf0621dee; final Slice8 5bace57e63e51bbfc034fc2e665863b74649a218, tree 44ea6a640fe1ca03dc961149f0d13e5b3af3d5ac. Final branch local/tracking/live remote equality and clean worktree were independently verified. Final owner review: /Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-a056b967/slice8-5bace57-practical-owner-review.md SHA256 2b4a49548eeaf1e503f770ec4b37b58f1752e5289f29d8aff6242ea18aa80ffc PASS. Phase3a remains proposal-only and unexecuted. No merge, main-branch integration, user-global plugin refresh, deploy, or Phase3a handoff is authorized by this closure. P0 process issue 5v7.9 and deferred safety incident 5v7.10 remain open follow-up work and do not invalidate the completed eight-slice candidate. Episode is ready for operator merge/disposition review.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All eight testing-strategy implementation slices owner-accepted through 5bace57; open incidents retained separately
<!-- SECTION:FINAL_SUMMARY:END -->
