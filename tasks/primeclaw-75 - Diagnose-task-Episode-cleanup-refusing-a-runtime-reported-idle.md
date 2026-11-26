---
id: PRIMECLAW-75
title: Explain why an attached client blocks idle Episode cleanup
status: In Design
assignee: []
created_date: '2026-11-25 02:36'
updated_date: '2026-11-26 18:12'
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

PAPI-8 later passed the runtime check after the operator authorized detaching the exact Orca attach pane and native counts reached zero. An idle but attached runtime is ineligible by design. Focus on actionable refusal evidence; remote policy failure is separately tracked in PRIMECLAW-76.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When an exact idle Episode is still attached, identify the attachment condition and safe next step without exposing transcripts or unrelated sessions.
- [ ] #2 Use a focused disposable regression and preserve protections for attached, busy, scheduled, foreign, or uncertain runtimes. Do not retry live PAPI-8 cleanup.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-11-25 02:37
---
Read-only follow-up from the PAPI-8 owner: `prime-agent sessions --all` showed `attachedClients=1` and `directAttachedClients=1` on the exact Episode, explicit false active/streaming/compacting flags, `sessionActions.queuedCount=0`, empty steering/followUps, no statusLabel, and no visible linked descendants. The checked-out `quiescentState` requires both attachment counts to be zero, so the observed attachment would block cleanup under that predicate. This is the leading explanation, not proof of the loaded adapter or either count at refusal time. Do not treat it as a false refusal or relax the attachment guard without evidence. No cleanup retry or live mutation.
---
<!-- COMMENTS:END -->
