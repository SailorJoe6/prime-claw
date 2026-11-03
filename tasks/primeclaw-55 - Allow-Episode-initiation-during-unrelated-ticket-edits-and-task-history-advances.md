---
id: PRIMECLAW-55
title: >-
  Allow Episode initiation during unrelated ticket edits and task-history
  advances
status: In Design
assignee: []
created_date: '2026-11-03 18:21'
updated_date: '2026-11-03 18:34'
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
Remove repo-wide cleanliness gates from Episode initiation and its supporting task-read and status-publication preparation. Unrelated ticket edits, unrelated repository changes, and unrelated published task-history advances MUST NOT block initiation. Preserve other Conversations' files, staging, and history.

Each Episode worktree has its own Backlog checkout. The selected ticket must therefore be committed and published before implementation starts so that checkout can obtain it. Make this a responsibility of the invoking Agent through the implement-task skill and its canonical workflow, not a requirement that the entire primary code or task checkout be clean and not a new deterministic revision/content approval protocol.

## Operator clarification
The required code change is removal of the repository-cleanliness checks that block initiation. Better agent instructions do not substitute for removing those checks. The complete skills/workflows audit below is a secondary addition because this task already touches that area of responsibility; it is not the main fix or a policy-only workaround.

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
### Required code change: remove repo-wide cleanliness gates
Remove whole-repository and whole-task-store cleanliness prerequisites from Episode initiation, including the supporting selected-task resolution, In Progress publication, post-allocation/pre-session preparation, and failure-status publication paths. Unrelated staged, unstaged, or untracked changes in the primary code or independent Backlog checkout must not prevent the selected Episode from starting. Do not merely move or rename the same whole-checkout gate, require users to quiesce unrelated work, or retain it behind a new preparation or approval check.

Unrelated published descendants must also remain compatible throughout initiation, including between status publication and session start. Previously observed whole-branch heads are factual history evidence, not frozen approval revisions. Retain concrete selected-provider/root/task/path/lifecycle, code-ancestry, selected host, resource-identity, and transport/publication checks. Semantic reconciliation and compatible task refinements remain LLM judgment, not a classifier or revision/content approval lock. Removing cleanliness gates does not authorize overwriting unpublished work, treating an unpublished selected ticket as available to the Episode, or weakening unrelated destructive-cleanup safeguards.

### Agent responsibility: commit the selected ticket before implementation
Update the implement-task entry skill and affected canonical workflow so the invoking Agent checks whether the exact selected ticket is committed. If it is not, the Agent must commit that ticket first and publish it to the selected task history before admission so the Episode's checkout can obtain it. Use the supported native task interface and ordinary exact-task Git publication. Preserve unrelated task and code bytes, staging, and history; never include another Conversation's changes merely to make a checkout clean. Resolve uncertain ownership or semantic conflicts with LLM judgment rather than silently absorbing them.

### Secondary addition: complete ticket-editing guidance audit
Audit all prime-claw skills and workflows, including shipped global skills, canonical project templates and lifecycle workflows, and their managed project copies. Ensure agents are consistently told to commit ticket edits as soon as each coherent update is ready and publish promptly when a remote exists. Cover task creation, specification, planning, execution content, review findings, blocker/status changes, and terminal updates. Do not defer ticket commits until handoff, compaction, session end, or implementation admission. Correct conflicting instructions and preserve the rule to commit only authorized task changes, not unrelated work. Keep this audit proportionate; it does not authorize unrelated workflow redesign or replace the required code fix.

### Bounded recovery of the recorded partial operation
Include a supported, narrowly bounded recovery for the already allocated PRIMECLAW-45 pre-session failure shape, retaining the same operation, owner, task, code base, host, worktree, and branch. Establish exact session/assignment evidence before continuation; absence of a recorded session alone is not permission to replay execution. Do not duplicate resources or execution, hand-edit ownership.json, retry as fresh creation, or build a general recovery framework.

## Constraints and validation
Do not stash, revert, stage, commit, delete, or otherwise absorb unrelated work. Do not add a parallel task store, approval/checkpoint receipt, custom allocator, reconciliation engine, or retry coordinator. Never force Git or bypass concrete task/ownership integrity. Prime Agent and Backlog.md are dependencies, not development targets.

Validate candidate plugin changes and focused regressions in Docker. No user-global activation, restart, live recovery mutation, destructive cleanup, or PRIMECLAW-45 upgrade implementation is authorized by this specification. Any later live recovery/activation follows the operator-authorized lifecycle. This specification revision authorizes neither planning nor implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Repo-wide cleanliness checks are removed from Episode initiation and its supporting task-read, status-publication, and pre-session preparation paths; unrelated staged, unstaged, or untracked changes in the primary code or independent Backlog checkout do not block initiation and are not required to be quiesced.
- [ ] #2 The implement-task skill and affected canonical workflow require the invoking Agent to commit and publish the exact selected ticket before admission if it is not already committed/published, so the Episode checkout can obtain it; this is not a whole-checkout cleanliness requirement or a new revision/content approval protocol.
- [ ] #3 Unrelated published task-history descendants arriving during admission, including after In Progress publication and before session start, are accepted without stale whole-branch head equality or a new approval gate; selected native task and publication evidence remain correctly bound.
- [ ] #4 Admission and publication preserve unrelated code/task bytes, staging, and published history and change only authorized selected-task content; no stash/revert, unrelated commit, force, or duplicate task store is used. Concrete provider/root/task/path/lifecycle, host, code-ancestry, resource-identity, and publication safety remain enforced, with semantic reconciliation LLM-owned.
- [ ] #5 A complete audit of prime-claw skills and workflows, including shipped global skills, canonical templates/workflows, and managed project copies, removes conflicting guidance and consistently directs agents to commit each coherent ticket edit ASAP and publish promptly, across all ticket-editing phases without absorbing unrelated work.
- [ ] #6 Supported bounded recovery for the recorded PRIMECLAW-45 allocated-worktree/pre-session failure preserves its exact owner, operation, task, base, host, worktree, and branch and proves session/assignment state before continuation; it requires neither hand-editing ownership.json nor duplicate resources or execution.
- [ ] #7 Focused regressions cover unrelated dirty code/task paths, concurrent published descendants, and the failed Blocked-publication interleaving; they prove successful initiation, preserved unrelated bytes/staging/history, safe partial-operation handling, and continued concrete identity/publication refusals without reintroducing a repo-cleanliness gate.
- [ ] #8 Required Docker-only plugin validation and focused lifecycle tests pass with recorded evidence; managed instructions match the corrected scope. No candidate host/global activation, live PRIMECLAW-45 recovery mutation, destructive cleanup, or dependency-upgrade implementation is performed.
<!-- AC:END -->
