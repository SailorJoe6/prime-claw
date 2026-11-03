---
id: PRIMECLAW-56
title: >-
  Prevent premature Episode allocation and resume failed creation in existing
  resources
status: In Design
assignee: []
created_date: '2026-11-03 18:47'
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
PRIMECLAW-55 addresses the improper dependency on unrelated ticket edits and whole-task-branch revisions. This separate bug owns creation ordering and the general inability to resume a partially allocated creation after its cause is corrected. It must not depend on users deleting a branch or clearing ownership by hand.

Move validation/preparation that does not require allocated resources before branch/worktree allocation, including discoverable provider/task-history and placement prerequisites. Do not promise that external allocation/session/transport operations can never fail. For unavoidable late failures, retain truthful evidence and provide a supported, owner-bounded way to update/reconcile the existing ownership and continue the unfinished steps in the same resources.

Preserve the original owner, operation, task/provider binding, code base, selected host, worktree and branch. Inspect actual state before changing ownership; do not blindly relabel uncertain as active. Reuse any already established session and account for initial assignment delivery before deciding whether there is any unfinished delivery. Repeated continuation must not create duplicate worktrees, sessions, initial execute assignments or status publications. Ambiguous delivery or foreign/changed resources must produce concrete recovery guidance rather than guess or replay.

Keep this proportionate: existing ownership plus concrete resource/session/transport evidence, not a new persistent checkpoint store, receipt protocol, general orchestration engine, semantic classifier or automatic retry coordinator. LLMs retain semantic judgment. Keep the existing operator boundaries for scope, merge, abandonment, destructive cleanup and activation. This task does not authorize a Prime Agent or Backlog.md patch, a live plugin refresh/restart, a new PRIMECLAW-45 Episode, or destructive recovery.

## Relevant source
src/prime-agent-plugin/extension-support/spec-episode.ts: preparePublishedBacklogEpisodeWorkspace, allocateReservedTaskEpisode, createTaskEpisode, and active-only handoff checks. src/prime-agent-plugin/extension-support/task-history-workspace.ts: Episode workspace preparation and primary-workspace prerequisites. Review the creation failure/status-publication paths together; there must be one coherent supported continuation rather than a second admission.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Checks that can be completed without Episode resources run before allocation; an injected known prerequisite/preparation failure leaves no new branch, worktree, session or dangling ownership reservation and reports truthful native task status.
- [ ] #2 A failure after branch/worktree allocation retains exact ownership and resource evidence and exposes a supported owner-bounded recovery that can reconcile/update ownership and continue creation once the actual cause is cleared, without manual JSON edits or deletion/recreation.
- [ ] #3 Recovery of an allocated-worktree/pre-session failure reuses the same owner, operation, task/provider binding, base, host, branch and worktree, completes the missing preparation, and starts exactly one durable Episode with exactly one initial execute assignment.
- [ ] #4 If a session or assignment already exists, recovery verifies and reuses that evidence instead of duplicating it; repeated continuation does not duplicate resources, assignments or native status publication, and genuinely uncertain delivery is not blindly replayed.
- [ ] #5 Foreign ownership, changed resource identity, unsafe code ancestry and contradictory session/assignment evidence refuse only the unsafe continuation with actionable diagnostics; unrelated ticket edits or compatible task-history descendants are not recovery blockers.
- [ ] #6 Focused tests cover failure before allocation, failure after worktree allocation before session creation, and failure around session/assignment establishment, proving truthful ownership/status and same-resource continuation. Required Docker-only plugin validation passes.
- [ ] #7 Affected lifecycle guidance describes supported continuation and identifies branch/worktree deletion as a temporary operator-authorized workaround, not the normal recovery path; no general recovery framework or new persistent approval/checkpoint protocol is introduced.
<!-- AC:END -->
