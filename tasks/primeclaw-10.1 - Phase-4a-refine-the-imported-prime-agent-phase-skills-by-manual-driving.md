---
id: PRIMECLAW-10.1
title: Reconcile shipped phase skills with manual acceptance evidence
status: In Design
assignee: []
created_date: 2026-10-12 01:00
updated_date: '2026-11-26T18:14:00Z'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p1
type: feature
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The phase skills and handoff chain have shipped under current `.agents/skills/` and `.prime-claw/workflows/` layouts (10.38, 54801a96). Do not port or restore `.ralph/skills`. Current operator proof is tracked by 10.32; exact-session regression evidence is tracked separately by 10.1.3. Reconcile already-accepted manual skill evidence without duplicating UAT.

[Previous specification](https://github.com/SailorJoe6/prime-claw/blob/7837f31ed8c8f9716abfa185b6429931b98c14ff/tasks/primeclaw-10.1%20-%20Phase-4a-refine-the-imported-prime-agent-phase-skills-by-manual-driving.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Map shipped skills to existing evidence and the open 10.32 operator proof; record only a concrete uncovered outcome.
<!-- AC:END -->
