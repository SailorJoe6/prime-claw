---
id: PRIMECLAW-7.5.1
title: Fix macOS candidate-progress watchdog timeout flake
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-7.5
priority: p2
type: bug
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The macOS Tier-0 test tests/test_embedding_candidate_build.py::test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero intermittently exceeds its 15-second subprocess timeout after correctly printing the stall diagnostic. It passed independently and passed in repeated complete runs against untouched rollback generation 44d83db, but failed intermittently in complete current-tree runs during official-lean-session-protocol Slice 1 (including .test-results/20261002-130040-99779/tier0.log). The failure is outside that slice and is not hidden or deselected; a subsequent complete current-tree run passed 275 tests with 151 skips. Investigate Darwin setsid/process-group termination and make the test deterministic without weakening production cleanup semantics.

## Legacy notes

Fixed and pushed on main in 3bf905976a1a489d93e81619a838b34fc7ed8a31. Root cause for both macOS signatures: stall timing and signals began before delayed `setsid` attested `$SYNC_PID` as its process-group leader; negative-PGID signals could miss the later group and pre-readiness updates could be consumed before observation. Fix: same-PID ready marker + group probe, bounded pre-ready cleanup/status propagation, post-readiness progress baseline, and post-poll completion check. Deterministic red reproduced TimeoutExpired and rc124. Evidence: focused watchdog 31 passed; clean tier0 283 passed / 147 skipped; clean `scripts/test-all.sh` tier0 PASS 52s and tier1 PASS 111s; two independent read-only audits PASS.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed in pushed main commit 3bf9059; clean test-all tier0+tier1 PASS.
<!-- SECTION:FINAL_SUMMARY:END -->
