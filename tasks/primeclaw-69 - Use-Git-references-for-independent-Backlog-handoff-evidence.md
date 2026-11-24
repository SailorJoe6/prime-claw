---
id: PRIMECLAW-69
title: Use Git references for independent Backlog handoff evidence
status: In Design
assignee: []
created_date: '2026-11-24 01:43'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/prime-claw/tasks/tasks/primeclaw-62%20-%20Bound-task-handoff-evidence-and-retain-truthful-delivery-outcomes.md
  - src/prime-agent-plugin/extension-support/spec-episode.ts
documentation:
  - docs/handoff-chain.md
priority: p0
type: bug
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Incident
Prime Claw blocked the pod-pricing TASK-2 offline pilot-readiness handoff before either Episode prompt. The Task-2 Manager reported exit 1 during independent Backlog evidence preparation. Native `backlog task view --json -- TASK-2` succeeded directly; a matching Node `spawnSync` diagnostic returned `ENOBUFS` on about 1,063,667 bytes with the default 1 MiB buffer. A larger buffer succeeded in the diagnostic only. No AWS work began. The original Episode and published bridge (76982788 / 65b0fed4) are preserved; published blocker: 377f49d.

Source inspection found `preparePublishedBacklogHandoffEvidence` still invokes a full native JSON read before delivery and carries previous/current task snapshots. [PRIMECLAW-62](https://github.com/SailorJoe6/prime-claw/blob/prime-claw/tasks/tasks/primeclaw-62%20-%20Bound-task-handoff-evidence-and-retain-truthful-delivery-outcomes.md) bounded prompt delivery but did not remove this prerequisite. This is a follow-up, not a reopening.

## Required outcome
For independent Git-backed Backlog handoff, use the task repository identity, exact prior and current published commit IDs, and the bound repository-relative ticket path as the task evidence. Read and diff the exact committed ticket via Git on demand, in bounded pieces when needed. Do not use a full native JSON read as a pre-delivery prerequisite. Keep only handoff-specific runtime facts and explicitly justified fields not available from Git outside Git. No larger buffers, ticket/history truncation, full snapshot duplicates in ownership, prompts, journals, or another store, or fallback to mutable working files. Keep existing historical records intact. Examine Beads separately; do not change its evidence behavior without provider-specific findings and approval.

Preserve the same Episode and existing first admission → factual callback → one canonical execute follow-up. If exact Git evidence cannot be resolved or read from the selected placement, report the blocker before delivery without guessing or retrying. Scope is Prime Claw only: no original TASK-2 Episode actions, resend, AWS, or live activation as part of this repair.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Independent Backlog handoff records the exact task repository, prior and current published commit IDs, and bound ticket path. The receiver can read and diff complete committed ticket content on demand via Git, regardless of later branch movement, without persisted duplicate snapshots.
- [ ] #2 An offline Docker regression uses a synthetic committed ticket whose native JSON exceeds 1 MiB and exercises independent Backlog handoff preparation through the production path without raising buffer limits, truncating content, or capturing full native JSON before delivery.
- [ ] #3 Missing, wrong, or inaccessible Git evidence stops truthfully before either prompt. Success preserves the exact Episode identity and the existing first admission, factual callback, and single canonical execute follow-up; no automatic resend.
- [ ] #4 Report Beads findings separately and verify its existing behavior is unchanged. Preserve existing historical evidence and expose only bounded runtime facts and justified non-Git fields outside Git.
<!-- AC:END -->
