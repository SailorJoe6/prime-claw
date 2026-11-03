---
id: PRIMECLAW-55
title: >-
  Allow Episode initiation during unrelated ticket edits and task-history
  advances
status: In Design
assignee: []
created_date: '2026-11-03 18:21'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/task-history-workspace.ts
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - .backlog/tasks/primeclaw-45 - Migrate-prime-claw-to-Backlog.md-v1.55.3.md
priority: p1
type: bug
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome
Unrelated ticket edits or commits MUST NOT block Episode initiation. Scope admission and status publication to the selected task, while preserving other Conversations' files, staging, and published history. A disconnected task-history branch must not act as a whole-project cleanliness or revision-approval gate.

## Observed incident
On 2026-11-03, the owning Conversation for PRIMECLAW-45 had explicit implementation authority and a complete approved In Planning task. create_task_episode published that task as In Progress at d9c42d9d91949996aa06a9902daaadc306853e4c and allocated the selected Orca worktree. Before session start, an unrelated PRIMECLAW-48 edit in the primary independent .backlog clone caused preparation to fail with uncommitted-task-content. The automatic Blocked publication then failed because the task-history head had advanced to 57243318215e0d843385a9dd7c06ec253e0eadc4. PRIMECLAW-45's own native task content was unchanged; the published descendant concerned PRIMECLAW-48.

This is an over-broad admission check, not a valid conflict with PRIMECLAW-45. Asking users to quiesce unrelated ticket work is not an acceptable workaround.

The Conversation subsequently published PRIMECLAW-45 as Blocked, with full failure evidence, at 9912b601f8a09bc1610e68225e1ad14b18335245. The partial operation remains preserved:
- Owner: 01a197be-7eeb-773f-98ef-7544560ced45
- Operation: f63a69a7-3e66-4b20-b258-2a599c4160e1; ownership status uncertain
- Engine/setup: Orca / afb6537c-e643-4a5f-b284-f0f627ddcbdf
- Worktree: /Users/jlanders/worktrees/prime-claw/prime-claw-primeclaw-45-episode-f63a69a7
- Branch: JLanders/prime-claw-primeclaw-45-episode-f63a69a7
- Code base/head: fe61016a5eab4a41f7d10fe3ca3996d3bb0d3fc8
Read-only inspection found the worktree clean at that base, no nested task clone, no Episode session identity in ownership, and only a shell terminal in Orca. No new creation, second assignment, manual ownership edit, or cleanup was attempted.

## Relevant implementation
In src/prime-agent-plugin/extension-support/task-history-workspace.ts, prepareTaskHistoryWorkspace rejects any dirty nested task-store path and requires equality with a previously observed whole-branch head. prepareEpisodeTaskHistoryWorkspace re-enters that primary-workspace preparation before preparing the Episode clone. In extension-support/spec-episode.ts, preparePublishedBacklogEpisodeWorkspace turns this into uncertain allocation; allocation/handoff subsequently reject uncertain ownership. Compatible descendant handling already exists at some higher-level seams but cannot overcome these lower-level checks.

## Required behavior and scope
Fix prime-claw's independent Backlog admission and task-publication preparation so that unrelated edits and concurrent published descendants are compatible throughout initiation, including between status publication and session start. Retain concrete selected-provider/task/path/lifecycle, code-ancestry, placement, resource-identity, and transport checks. Semantic reconciliation and compatible task refinements remain LLM judgment, not a classifier or revision/content approval lock.

Include a supported, narrowly bounded recovery for this already allocated pre-session failure shape, retaining the same operation, owner, task, code base, host, worktree, and branch. Establish exact session/assignment evidence before continuation; do not duplicate resources or execution. This does not request a general recovery framework.

Do not stash, revert, stage, commit, delete, or otherwise absorb unrelated work. Do not add a parallel task store, approval/checkpoint receipt, custom allocator, reconciliation engine, or retry coordinator. Never force Git or bypass concrete task/ownership integrity. Do not patch Prime Agent or Backlog.md. Align affected managed instructions with task-scoped behavior. Validate candidate plugin changes in Docker; no user-global activation, restart, live recovery mutation, destructive cleanup, or PRIMECLAW-45 upgrade implementation is authorized by creating this bug. Any later live recovery/activation follows the operator-authorized lifecycle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Initiating one authorized, implementation-ready task succeeds while another ticket in the primary independent Backlog checkout has unstaged, staged, or untracked task changes; unrelated work does not become an admission prerequisite.
- [ ] #2 Unrelated published task-history descendants arriving during admission, including after In Progress publication and before session start, are accepted without stale whole-branch head equality or a new approval gate; the selected native task and publication remain correctly bound.
- [ ] #3 Admission/publication preserves unrelated task bytes, staging, and history and changes only the selected task as authorized; no quiescence request, stash/revert, unrelated commit, force, or duplicate destination is used.
- [ ] #4 Concrete provider/root/task/path/lifecycle, selected host, code ancestry, owned-resource identity, and publication safety remain enforced; semantic task reconciliation and compatible refinements stay LLM-owned rather than deterministic classifiers.
- [ ] #5 A supported bounded recovery for the recorded PRIMECLAW-45 allocated-worktree/pre-session failure preserves its exact owner, operation, task, base, host, worktree, and branch and proves session/assignment state before continuation; it neither requires hand-editing ownership.json nor duplicates a session or initial execute assignment.
- [ ] #6 Focused regressions reproduce unrelated dirty-task and concurrent-descendant interleavings, including the failed Blocked-publication shape, and prove task-scoped success, preserved unrelated work, and safe partial-operation handling.
- [ ] #7 Relevant managed instructions match the corrected policy; required Docker-only plugin validation and focused lifecycle tests pass with recorded evidence. No candidate host/global activation or live destructive recovery is performed.
<!-- AC:END -->
