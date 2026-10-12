---
id: PRIMECLAW-33.9
title: Retire bridge migration and install a final-only role reconciler
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - installer
  - migration
  - prime-agent-plugin
  - simplification
  - user-stories
dependencies:
  - PRIMECLAW-33.6
  - PRIMECLAW-33.8
parent_task_id: PRIMECLAW-33
priority: p2
type: task
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
The completed private bridge/final migration left a database-like role transaction engine, legacy `APPEND_SYSTEM.md` support, cutover coordinator, receipt replay, metadata snapshots, and extensive tests as permanent architecture. There are no released external consumers requiring indefinite compatibility.

## Work
After the explicit UAT/rollback gate, archive durable evidence and remove bridge generation, legacy APPEND migration, the obsolete cutover coordinator, hostile receipt/uid/gid transaction replay, and corresponding fixtures/tests. Replace them with a final-only reconciler that selects the context, validates ordinary files and unique markers, atomically updates the managed block, records small ownership state, optionally keeps a simple preimage backup, and runs exact check.

## Legacy design

Retain path/symlink safety, unrelated-context preservation, atomic leaf replacement, a simple lock if concurrency requires it, final exact checking, and deliberate user-global targeting. Do not build a compatibility framework for installations that do not exist.

## Legacy notes

Primary code: `scripts/manage-prime-agent-role-protocol.py`, `scripts/coordinate-prime-agent-role-cutover.py`, legacy bridge fixtures/probes, apply/check receipt plumbing, and related cutover docs/tests. Preserve durable historical evidence under docs/evidence or archive; remove executable compatibility after the gate.
Completed final-only role reconciliation after Joe accepted tqm.8 UAT and authorized retirement. Removed executable bridge/APPEND/cutover/receipt transaction machinery, cutover coordinators, bridge fixtures/probe, and the temporary retired-EXPERT cleanup helper. Replaced the 1,518-line role transaction engine with a compact final apply/check reconciler that preserves unrelated bytes and full mode/owner metadata, validates exact markers and bounded old-final ownership, rejects unsafe/symlinked/hard-linked/drifted state, serializes concurrent apply, repairs interrupted final publication, rolls back state-write failure, and checks exact final state. Retained the bounded hash-checked schema-1 plugin predecessor retirement set; no roleProtocol source or bridge input remains. Source/test diff: 337 lines added, 5,286 removed, net 4,949 lines deleted. Validation: host static 604 passed/1 skipped before final focused repairs; Node 108 passed plus project-initialization 28 passed; affected Docker 43 passed; repaired schema/role focus 14 passed; final role matrix 10 passed; pinned Prime Agent 0.9.8 Tier 1 PASS at .test-results/20261011T210002Z-84330-58515f95/tier1; fresh independent rereview PASS. No retained sandbox, volume, checkpoint, receipt, preimage, or other runtime/rollback resource was mutated or deleted. User-global refresh and full Prime Agent restart remain separate post-merge operator actions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The human gate authorizes retirement.
- [ ] #2 No current controlled installation requires bridge input.
- [ ] #3 Final apply/check preserve unrelated global content and detect incomplete generation.
- [ ] #4 Bridge/APPEND/cutover/receipt transaction code and obsolete tests are removed or archived as evidence, not left executable.
- [ ] #5 Fresh isolated and accepted user-global/sandbox paths have proportionate validation.
- [ ] #6 Net source/test deletion is reported.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Final-only role reconciler implemented and validated; executable migration machinery retired; pinned Tier 1 and independent rereview pass.
<!-- SECTION:FINAL_SUMMARY:END -->
