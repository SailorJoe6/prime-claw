---
id: PRIMECLAW-10.28.5
title: Prove lifecycle failure and recovery behavior
status: Done
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies:
  - PRIMECLAW-10.28.4
parent_task_id: PRIMECLAW-10.28
priority: p1
type: task
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Exercise heartbeat, cleanup, completion, and recovery failures without unsafe transport or stale monitoring.

## Legacy notes

Slice 5 of .ralph/plans/EXECUTION_PLAN.md. Evidence paths and exact commands are defined in that slice. Strict dependency chain; claim only when predecessor is accepted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AC24-26 plus failure clauses in AC15-23 have reproducible evidence and a pushed review commit.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Superseded by the operator-approved two-checkpoint plan; no completion claim. Remaining acceptance moved to prime-claw-h6w.24.1 and .24.2.
<!-- SECTION:FINAL_SUMMARY:END -->
