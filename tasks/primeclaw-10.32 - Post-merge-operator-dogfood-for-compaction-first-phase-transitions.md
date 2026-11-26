---
id: PRIMECLAW-10.32
title: Run operator dogfood for the current task-native Episode lifecycle
status: Blocked
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-11-26 18:12'
labels:
  - dogfood
  - episode-loop
  - phase4
  - post-merge
  - ralph
dependencies: []
references:
  - PRIMECLAW-10.31
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The prep/compaction implementation landed (e93240aa, 445ca79b); custom commands were removed (54801a96). Joe’s manual proof remains outstanding. Confirm the accepted installed generation from primary main; a restart by itself is not UAT. Use a disposable project to prove the current provider-native spec → plan → explicitly authorized isolated Episode → handoff/continue → operator disposition and exact cleanup. Cover retained v1 separately only if grandfathered compatibility needs this evidence. Do not activate, restart, or run live dogfood under a Backlog edit.

[Previous specification](https://github.com/SailorJoe6/prime-claw/blob/7837f31ed8c8f9716abfa185b6429931b98c14ff/tasks/primeclaw-10.32%20-%20Post-merge-operator-dogfood-for-compaction-first-phase-transitions.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Joe runs the current skill/tool flows with one prep and canonical follow-up per boundary, truthful compaction status, drained queue, and no duplicate execution.
- [ ] #2 Record exact native task, explicit placement/authority, durable Episode/session identity through continuation, and verified terminal outcome/cleanup or exact blockers. Automated evidence does not replace operator proof.
<!-- AC:END -->
