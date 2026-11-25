---
id: PRIMECLAW-75
title: Diagnose task Episode cleanup refusing a runtime reported idle
status: In Design
assignee: []
created_date: '2026-11-25 02:36'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/0980f61a1efdd50a62f95c2a172b46e411519c6f/tasks/primeclaw-72%20-%20Remove-the-Orca-terminal-classification-gate-from-Episode-cleanup.md
  - src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
priority: p1
type: bug
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PAPI-8 (Prime Agent Pi) was reported merged and verified, and its native Backlog Done state was published. Prime Claw `finalize_task_episode` then refused with `The Episode has not completed its work: cleanup requires the exact idle runtime and descendants`. The owning Conversation reported the exact live Episode idle with a ready worker, no streaming/tools/bash, no queued or unfinished actions and no reported children. The runtime and worktree were retained. This is distinct from PRIMECLAW-72's Orca terminal classification refusal. The exact failing predicate and whether it reflects genuine activity, missing daemon evidence, or a mismatch are unverified.

The task-native adapter checks the all-session roster and exact active-route state for the owned root and parent-linked descendants, including saved rows. It tests attachments, schedules, compaction, lifecycle/status label and the complete sessionActions shape, beyond the reported CLI fields. Diagnose the difference using bounded read-only evidence or a disposable fixture. Do not retry, attach to, or mutate the live PAPI-8 Episode as part of this report. Keep exact identity and genuine-busy protections.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Identify the failing quiescence condition (or the exact evidence gap) using read-only evidence or a disposable fixture, distinguishing actual activity from incomplete/misread state.
- [ ] #2 Make the refusal actionable without exposing transcripts or unrelated sessions. If a false refusal is confirmed, cover it with a focused regression without weakening protection for busy, attached, scheduled, foreign or uncertain runtimes.
<!-- AC:END -->
