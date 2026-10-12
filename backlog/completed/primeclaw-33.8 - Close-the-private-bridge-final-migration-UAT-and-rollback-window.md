---
id: PRIMECLAW-33.8
title: Close the private bridge/final migration UAT and rollback window
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - human-gate
  - migration
  - prime-agent-plugin
  - simplification
  - user-stories
dependencies:
  - PRIMECLAW-33.2
parent_task_id: PRIMECLAW-33
priority: p1
type: decision
ordinal: 114000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Decision
Decide whether the completed private bridge/final migration UAT and rollback window may close, allowing all executable bridge compatibility to be removed.

## Rationale
The migration has completed and the code has never been released beyond Joe's controlled machines. The recent accepted activation intentionally retained rollback/UAT resources, so retirement must wait for explicit confirmation rather than inferring safety from a clean repository.

## Alternatives Considered
- Keep bridge/final compatibility indefinitely: rejected unless a controlled installation still needs it.
- Retire immediately from repository state alone: rejected because retained live rollback/UAT resources are outside Git.
- Close the window after supported inspection and Joe's explicit disposition: preferred.

## Work
Using only separately authorized supported checks, confirm the accepted final generation and manual UAT disposition, record whether retained original/checkpoint volumes and receipts may be removed, inventory any remaining live bridge manifests, and obtain Joe's explicit retirement decision. This issue grants no sandbox, plugin, volume, receipt, restart, or cleanup authority by itself.

## Legacy design

This is a human decision gate, not an implementation task. No compatibility window for unknown external users is required. If all controlled installations are final and accepted, downstream work may remove bridge support rather than maintain a general converter.

## Legacy notes

Authorized read-only inspection completed; no restart, apply, cleanup, volume removal, receipt removal, or tqm.9 work occurred. Active controlled installations: host user-global role state = final; prime-claw-v2r1013 = Ready with final role state, AGENTS.md selected, no managed legacy APPEND, four expected extensions, applied mode-0600 recovery receipt, and current provider attachment visible. Retained inactive sandboxes: prime-claw-v2 (Error) plus v2r1010/v2r1011/v2r1012 (Stopped); their role-state evidence is unavailable, so classify unknown rather than final. Retained resources confirmed: original state, pre-recovery checkpoint, accepted codex working volume, and three intermediate recovery volumes; accepted home also retains both image and fallback copies of .uv/.venv/.cache/.local. Repository-local mode-0600 preimage inventory and discovery probe remain present. Technical evidence supports the accepted final generation and no active bridge installation was found. Human gate remains open pending Joe's explicit manual-UAT acceptance and go/no-go for tqm.9; all resources remain preserved. Joe decision: manual UAT accepted; close the migration window; authorize tqm.9; preserve every runtime, rollback, receipt, volume, sandbox, and evidence resource until separately approved cleanup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Joe's UAT/rollback disposition is recorded explicitly.
- [ ] #2 Known controlled installations are inventoried as final, bridge, or unknown without credential exposure.
- [ ] #3 Retained resources are preserved or removed only under explicit authority.
- [ ] #4 The downstream migration-retirement task has an unambiguous go/no-go and exact retained evidence.
- [ ] #5 No inferred cleanup or cutover occurs.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Joe accepted manual UAT and authorized tqm.9; all retained resources remain preserved
<!-- SECTION:FINAL_SUMMARY:END -->
