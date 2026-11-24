---
id: PRIMECLAW-69
title: Use Git references for independent Backlog handoff evidence
status: In Design
assignee: []
created_date: '2026-11-24 01:43'
updated_date: '2026-11-24 01:54'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/prime-claw/tasks/tasks/primeclaw-62%20-%20Bound-task-handoff-evidence-and-retain-truthful-delivery-outcomes.md
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/510856f0e8ec7db152f7f34cb8730587234be5bf/tasks/primeclaw-70%20-%20Make-independent-Backlog-Episode-creation-work-for-large-tickets.md
documentation:
  - docs/handoff-chain.md
priority: p0
type: bug
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
The pod-pricing TASK-2 handoff stopped before either Episode prompt (published blocker `377f49d`); no AWS work began and the original Episode/bridge are preserved. Native `backlog task view --json -- TASK-2` succeeded directly, but the corresponding Node `spawnSync` diagnostic hit `ENOBUFS` at about 1,063,667 bytes with its default 1 MiB buffer. PRIMECLAW-62 bounded prompt delivery, not this full-JSON prerequisite. Independent Backlog creation has the same source-verified risk in pre-allocation checks and a separate pre-session read that also puts snapshots into the initial execute prompt; no creation incident is claimed. This task supersedes PRIMECLAW-70 and does not reopen PRIMECLAW-62.

## Outcome
Replace ticket snapshots throughout Prime Claw's Backlog lifecycle for both independent Git history and branch-local stores. Whenever a workflow needs evidence of ticket state at a checkpoint, retain the exact task repository identity, immutable commit ID and repository-relative ticket path at that checkpoint. Read or diff the complete committed content via Git on demand, in bounded pieces as needed. Use each store's existing history and publication rules; do not add another store or change those rules. Git references are factual evidence, not authority, approval, or a frozen revision gate.

Cover creation (pre-allocation and pre-session), initial execute, ordinary handoff, execute-only continuation, oversight, review, block/resume, terminal flows, and Backlog evidence written by ownership transitions or provider cutover. Continue to use native Backlog operations for task authoring and lifecycle changes. Preserve exact identity and publication checks and editable workflow/LLM judgment. Do not depend on capturing full native JSON through the fixed buffer for lifecycle evidence or to create a snapshot. Do not raise that buffer, truncate ticket content, copy full snapshots into ownership/prompts/journals/results/other stores, or substitute mutable working files. Retain handoff-specific runtime facts and explicitly justified non-Git facts separately. Preserve exact Episode resources, same-resource recovery, one initial execute assignment, and first admission → factual callback → one canonical execute follow-up. Report delivery outcomes separately; no automatic resend.

## Compatibility and boundaries
No bulk rewrite or rollout gate. Read existing records compatibly and leave historical records intact. At the next normal operation, use an exact historical commit where verifiable and write only Git references for new evidence. If required prior evidence cannot be resolved, or the exact evidence is wrong or inaccessible from the selected placement, report the gap at the relevant boundary (before prompt delivery where applicable); never guess from HEAD, replay, or allocate replacement resources. Leave Beads evidence behavior unchanged. No original TASK-2 Episode actions, resend, AWS work, upstream changes, or live activation as part of this repair.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Throughout the independent and branch-local Backlog lifecycle, new ticket-state evidence uses only exact Git repository/commit/path references. Complete committed content is readable and diffable in bounded pieces after a branch advances, without new duplicate snapshots or mutable-file fallback.
- [ ] #2 Offline Docker regressions exercise production independent Backlog creation at both checkpoints and continuation with a committed synthetic ticket whose native JSON exceeds 1 MiB. No larger buffer, truncation, or full JSON capture as a snapshot prerequisite. Representative branch-local evidence resolves from the exact code-repository commit.
- [ ] #3 Existing records remain readable without a bulk rewrite. Normal operations use verifiable old commits and write references for new evidence. Missing, wrong, or inaccessible required evidence is reported before the relevant delivery without guessing or retrying.
- [ ] #4 Preserve exact identity, publication and same-resource recovery, separate runtime and delivery facts, one initial assignment, and ordinary first admission → factual callback → one execute follow-up. Verify execute-only and Beads behavior remain unchanged apart from the Backlog evidence representation.
<!-- AC:END -->
