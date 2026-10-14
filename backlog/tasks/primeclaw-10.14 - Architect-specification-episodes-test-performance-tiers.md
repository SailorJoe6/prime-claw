---
id: PRIMECLAW-10.14
title: Architect specification-episodes test performance tiers
status: In Design
assignee: []
created_date: '2026-10-12 01:00'
updated_date: '2026-10-14 14:45'
labels:
  - episode-loop
  - performance
  - phase4
  - ralph
  - specification-episodes
  - testing
dependencies:
  - PRIMECLAW-10.7
parent_task_id: PRIMECLAW-10
priority: p2
type: task
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Post-Slice-2 follow-up for specification-episodes test-performance architecture. Preserve every safety and fault assertion while separating fast deterministic unit checks, normal integration/PR checks, and exhaustive fault/nightly checks. Eliminate duplicate nested suite execution. Replace real waits with injectable clocks or explicit barriers where behavior remains faithful. Parallelize only truly isolated disposable temp-repository cases. Retain one documented command that runs the complete exhaustive matrix. This issue is not an ASTRA-25 acceptance blocker and must not broaden the current Slice 2 candidate or start Slice 3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Record measured before/after timings. Prove exhaustive assertion coverage and protected-resource isolation are unchanged. Update CI and documentation for unit, PR/integration, and exhaustive/nightly tiers. Choose explicit runtime budgets from measured evidence. Baselines: focused ASTRA-25 9/9 about 531s before fresh-process expansion (fresh-process closure later 9/9 in 649.44s); combined Node 93/93 about 1,303s; prior plan-active Python about 2,199s and current exact Python 281 passed/2 skipped in 3,260.21s. Eliminate duplicate nested execution and retain a documented complete exhaustive command.
<!-- AC:END -->
