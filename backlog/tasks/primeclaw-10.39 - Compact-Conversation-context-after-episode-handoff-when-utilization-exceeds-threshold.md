---
id: PRIMECLAW-10.39
title: >-
  Compact Conversation context after episode handoff when utilization exceeds
  threshold
status: In Design
assignee: []
created_date: '2026-10-15 05:15'
updated_date: '2026-10-15 21:31'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
references:
  - PRIMECLAW-10.32
  - PRIMECLAW-10.37
documentation:
  - docs/user-stories/G-oversight-and-review.md
parent_task_id: PRIMECLAW-10
priority: p2
type: feature
ordinal: 124000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Dogfooding shows a supervising Conversation degrades — getting confused and losing track of episode state — once its context utilization climbs past roughly half the window while driving an Episode. Episodes already compact at their own handoff boundary; the Conversation has no managed compaction point of its own and otherwise drifts into native auto-compaction with a generic summary at an arbitrary, often bad, boundary.

The ideal moment is immediately after the Conversation dispatches an episode handoff: its working context has just shipped downstream, it enters heartbeat-driven waiting, compaction runs in dead time, and each supervision leg starts fresh.

## Intended outcome
When a Conversation dispatches an episode handoff (the canonical handoff tools: handoff_spec_episode today, handoff_task_episode in task-native mode), the plugin checks current context utilization. If utilization exceeds a configurable threshold (default 60%), the plugin injects a new managed workflow prompt instructing the model to compact its context via compact.run() with a focus hint the model composes using its current context and judgment about what it needs to drive the Episode to completion. Compaction runs at the turn boundary; the existing post-compaction handler then re-injects the Conversation guide with exact episode identity, and the next heartbeat tick resumes supervision already re-primed.

## Material constraints
- Uniform with existing compaction boundaries: the model executes compact.run(); the plugin only triggers by injecting the prompt. No programmatic plugin-side compaction.
- The prompt gives the compaction objective; the model decides what its current context requires the hint to preserve.
- The prompt is a managed markdown asset installed alongside the other Prime Claw workflow files.
- Threshold defaults to 60% and is configurable.

## Non-goals
- No changes to the existing post-compaction Conversation guide re-injection; it works.
- No changes to native auto-compaction; it remains the high-watermark backstop.
- No additional trigger points (heartbeat ticks, other terminal actions) until dogfooding justifies them.
- No change to episode-side handoff compaction.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When a Conversation dispatches an episode handoff with context utilization above the configured threshold, a compaction prompt is injected and a compaction is requested before the turn ends.
- [ ] #2 When utilization is at or below the threshold, or unknown, no compaction prompt is injected and the handoff flow is otherwise unchanged.
- [ ] #3 The utilization threshold is configurable and defaults to 60%.
- [ ] #4 The compaction prompt ships as a managed workflow markdown asset installed and updated with the other Prime Claw workflow assets.
- [ ] #5 The prompt instructs a single compact.run() call and lets the model compose the focus hint using its current context and judgment about what it needs to drive the Episode to completion.
- [ ] #6 After the triggered compaction completes, the Conversation resumes supervising the exact same owned episode without operator re-identification.
<!-- AC:END -->
