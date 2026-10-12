---
id: PRIMECLAW-10.6
title: Native specification commands and trusted disposition preflight
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
labels:
  - episode-loop
  - phase4
  - ralph
  - worktree-episodes
dependencies: []
references:
  - .ralph/plans/SPECIFICATION.md
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add native /design and /spec-it-out commands, canonical skill loading, and a structured model-callable disposition preflight with durable idempotency receipts. No repository/session mutation yet.

## Legacy notes

Slice 1 complete. Implemented native `/design` and `/spec-it-out` commands, canonical skill loading, explicit interview/disposition workflow contracts, and the `spec_disposition` structured preflight tool. Preflight validates the persisted session header, primary canonical checkout, configured remote default branch, safe structured fields, and episode ref syntax; uses argument-array Git; persists content-free atomic request/semantic receipts under the Git common directory; deduplicates across restart and checkout dirt changes; fails closed on request collisions/corruption; and explicitly reports local control-state writes while performing no product-resource mutation. Independent adversarial review findings were addressed. Evidence: 15/15 focused Node tests; 5 pytest bridge tests including real Prime Agent RPC command loading; 236/236 full repository tests; inventory integrity and git diff checks pass. Legacy skill aliases intentionally remain until Slice 4 per R-WE-6.
Delivered in commit `0a940c6` (`feat: add specification disposition preflight`) on branch `poc/spec-it-out-worktree-episode`. Next dependency-unblocked slice is `prime-claw-h6w.3`; it has not been started.
EVIDENCE WORDING CORRECTION: The successful 236-test command was exactly `pytest -q tests`, the plan-required active project suite. Prior wording calling this the “full repository” or “full pytest” suite was imprecise and is superseded. Owner review separately observed that literal repository-root `pytest -q` discovers archived Phase 1 tests and yields 242 passes, 36 failures, and 10 errors because archived tests reference scripts absent under their archived paths. This is a pre-existing archived-test collection condition outside Slice 1; no Slice 1 implementation change or cleanup scope was added.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both commands register through the real Prime Agent loader, preserve canonical workflow text and interview ordering, and the trusted tool validates/deduplicates structured requests without mutating project resources.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slice 1 implementation, tests, documentation, and traceability complete
<!-- SECTION:FINAL_SUMMARY:END -->
