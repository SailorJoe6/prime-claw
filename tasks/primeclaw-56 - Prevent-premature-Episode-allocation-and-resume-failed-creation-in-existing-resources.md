---
id: PRIMECLAW-56
title: >-
  Prevent premature Episode allocation and resume failed creation in existing
  resources
status: In Design
assignee: []
created_date: '2026-11-03 18:47'
updated_date: '2026-11-03 19:01'
labels: []
dependencies: []
references:
  - >-
    .backlog/tasks/primeclaw-55 -
    Allow-Episode-initiation-during-unrelated-ticket-edits-and-task-history-advances.md
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - src/prime-agent-plugin/extension-support/task-history-workspace.ts
priority: p1
type: bug
ordinal: 141000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Required outcome
Episode creation must not allocate a branch or worktree before checks that can be completed in advance have passed. If a later failure still leaves resources behind, the owning Conversation must be able to reconcile/update ownership from current evidence and continue creation in that same branch and worktree. Deleting resources and starting over is a temporary workaround, not the recovery design.

## Incident and current limitation
On 2026-11-03, PRIMECLAW-45 admission published In Progress and allocated Orca worktree prime-claw-primeclaw-45-episode-f63a69a7 on branch JLanders/prime-claw-primeclaw-45-episode-f63a69a7 at base fe61016a5eab4a41f7d10fe3ca3996d3bb0d3fc8. Only afterward did task-history workspace preparation fail. No Episode session identity was recorded, no Episode task clone was prepared, and the worktree remained clean at its original base.

The operation f63a69a7-3e66-4b20-b258-2a599c4160e1, owned by Conversation 01a197be-7eeb-773f-98ef-7544560ced45, became uncertain. The allocation path rejects uncertain ownership and also rejects provisioning that already contains resource identity; ordinary handoff requires active ownership and a durable session. Thus correcting the original transient condition does not let the owner simply finish the existing creation. The failed creation strands resources behind a non-resumable ownership state.

The operator explicitly authorized a manual rollback as a workaround. The unused worktree and local branch were removed and only this Conversation's ownership entry was deleted; other owners were preserved. The ownership cleanup was committed/pushed on main at 10e8f69871f770cd5956963eb49acddddb5657dd. That operation no longer has live resources to recover; use its recorded evidence and isolated fixtures to reproduce the failure. PRIMECLAW-45 remains Blocked on PRIMECLAW-55.

## Scope and boundary with PRIMECLAW-55
PRIMECLAW-55 addresses the improper dependency on unrelated ticket edits and whole-task-branch revisions. This separate bug owns creation ordering and the inability to resume a partially allocated creation after its cause is corrected. The operator must not need to delete branches or hand-repair ownership JSON to resume.

Skills and workflow Markdown must direct the owning Conversation to run available native checks before branch/worktree allocation, including discoverable provider/task-history and placement prerequisites that do not need allocated resources. Do not promise that external allocation/session/transport operations can never fail. For unavoidable late failures, the documented workflow directs the Conversation to inspect current native/resource/session state, make a justified targeted update to its existing ownership record, and continue the unfinished creation steps in the same resources. Prefer existing Git, Orca, provider and session interfaces; a new recovery API is not a required outcome.

Preserve the original owner, operation, task/provider binding, code base, selected host, worktree and branch. Inspect actual state before changing ownership; do not blindly relabel uncertain as active. Reuse any already established session and account for initial assignment delivery before deciding whether there is any unfinished delivery. Repeated continuation must not create duplicate worktrees, sessions, initial execute assignments or status publications. Ambiguous delivery or foreign/changed resources must produce concrete recovery guidance rather than guess or replay.

## Markdown-first implementation boundary
Put preflight ordering, recovery decisions, ownership reconciliation, and continuation instructions primarily in skill files and workflow Markdown. The owning Conversation LLM interprets the evidence, decides which existing creation steps remain, and follows those instructions. The operator need not repair JSON manually; the Conversation may make a justified targeted update to its existing ownership record under the documented recovery instructions. Do not require a new API merely to avoid that bounded agent edit.

Change TypeScript only where an existing hard-coded restriction prevents the documented workflow, or for necessary narrow deterministic identity, integrity, resource or transport operations. Identify each such restriction/operation and explain why Markdown instructions plus existing native interfaces cannot satisfy it. Those code changes must enable the workflow, not implement its reasoning.

Do not implement deterministic task reconciliation, iterative plan revision, semantic recovery decisions, or other reasoning an Episode or Conversation can perform via the LLM. Do not introduce new ownership states or schemas, persistent checkpoints, approval records, receipt protocols, automated recovery/retry orchestration, semantic classifiers, or a general recovery framework. Retain the no-duplicate requirement through native inspection and explicit LLM-directed action, not new exactly-once transaction machinery. Stop on genuinely ambiguous delivery rather than invent a replay protocol.

Keep the existing operator boundaries for scope, merge, abandonment, destructive cleanup and activation. This task does not authorize a Prime Agent or Backlog.md patch, a live plugin refresh/restart, a new PRIMECLAW-45 Episode, or destructive recovery.

## Relevant source
src/prime-agent-plugin/extension-support/spec-episode.ts: preparePublishedBacklogEpisodeWorkspace, allocateReservedTaskEpisode, createTaskEpisode, and active-only handoff checks. src/prime-agent-plugin/extension-support/task-history-workspace.ts: Episode workspace preparation and primary-workspace prerequisites. Review the creation failure/status-publication paths together; there must be one coherent supported continuation rather than a second admission.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Skill/workflow instructions direct native checks that do not require Episode resources before allocation; a representative known prerequisite failure creates no branch, worktree, session or dangling ownership reservation and reports truthful native task status.
- [ ] #2 After a partial allocation, the owning Conversation follows documented recovery instructions, interprets current evidence and makes a justified targeted update to the existing ownership record before continuing in the same resources. The operator need not repair JSON manually; deletion/recreation or a new recovery API is not required.
- [ ] #3 In a representative allocated-worktree/pre-session recovery, the Conversation preserves the same owner, operation, task/provider binding, base, host, branch and worktree, completes only the missing preparation and starts one durable Episode with one initial execute assignment.
- [ ] #4 When a session or assignment already exists, the Conversation inspects native evidence and reuses it rather than duplicating it; repeated continuation does not duplicate resources, assignments or native status publication. Genuinely uncertain delivery stops for clarification rather than coded replay or exactly-once transaction machinery.
- [ ] #5 Concrete identity, ownership, code-ancestry and transport safeguards remain intact. Markdown directs the Conversation to stop on foreign resources or contradictory session/assignment evidence and explain the needed resolution; semantic recovery judgment remains LLM-owned, and unrelated ticket edits or compatible task-history descendants do not block recovery.
- [ ] #6 Use narrow regression tests for unavoidable TypeScript changes and representative isolated Markdown-led recovery exercises covering pre-allocation failure, allocated-worktree/pre-session failure and existing session/assignment evidence. Do not build an exhaustive failure matrix or automated recovery harness. Required Docker-only plugin validation passes for plugin-source changes.
- [ ] #7 Preflight ordering, recovery judgment, ownership reconciliation and continuation live primarily in skills/workflow Markdown. Every TypeScript change names the existing hard-coded obstacle or necessary concrete integrity/transport operation and why instructions/native interfaces alone cannot suffice. No new ownership states/schemas, checkpoint/approval/receipt protocol, semantic reconciliation/plan-revision code or recovery/retry engine is introduced; deletion remains a temporary operator-authorized workaround.
<!-- AC:END -->
