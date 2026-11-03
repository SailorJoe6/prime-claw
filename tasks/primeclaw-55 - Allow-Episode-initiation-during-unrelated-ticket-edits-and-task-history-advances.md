---
id: PRIMECLAW-55
title: >-
  Allow Episode initiation during unrelated ticket edits and task-history
  advances
status: In Design
assignee: []
created_date: '2026-11-03 18:21'
updated_date: '2026-11-03 19:04'
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
## Outcome and authority boundary
Remove hard-coded task-native lifecycle policy from prime-claw code and put the rules and decisions in editable Markdown skills and workflows. Apply the fix to the complete task-native lifecycle for both Backlog and Beads, not just Episode initiation. This is the required code change, not an instruction-only workaround.

Code manages lifecycle stages and execution mechanics: load the applicable Markdown, inject it at the appropriate lifecycle event, invoke supported native operations, and return their factual results. The LLM follows the editable skills to apply workflow rules and make specification/planning, admission, readiness, execution, continuation, oversight, reconciliation, and terminal/finalization decisions within operator authority. Do not independently implement the same policy as TypeScript checks, hidden guards, approval locks, or another rules engine.

In particular, remove repository-wide cleanliness gates throughout initiation and supporting task resolution, preparation, status publication, and pre-session paths. Unrelated task or code edits and unrelated published task-history advances MUST NOT block Episode initiation. Other Conversations' bytes, staging, history, ownership, and resources must remain intact.

## Operator clarification
Joe explicitly rejected hard-coded workflow rules as over-engineering. Moving or renaming the checks inside other code files does not satisfy this task. Checks and reasoning about cleanliness, selected-ticket commit/publication prerequisites, implementation readiness, task lifecycle eligibility, code-base suitability, and compatibility of changing task/history observations belong to LLMs following editable skills/workflows, not a second code-level admission policy. Code may read lifecycle facts to route the relevant Markdown stage; it must not use routing as a disguised policy gate. Native failures and resource-operation results must still be reported truthfully.

The confirmed Beads defect includes prime-claw's whole-code-repository cleanliness checks in proveBeadsAdmissionCodeHead and reservePublishedBeadsTaskEpisodeOwnership. This does not claim Beads has the exact independent-Backlog race recorded below. Fix the broken task-native behavior for both providers; neither Prime Agent nor Backlog.md nor Beads is a development target.

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
### Main fix: editable skills own the complete task-native lifecycle for both providers
Cover specification/planning where implemented by lifecycle code, Episode initiation, execution, handoff/continuation, oversight/review, block/resume, merge/abandonment, and terminal publication/finalization/cleanup. This full task-native scope is Joe’s explicit decision; do not stop at admission or defer equivalent later-stage code policy to a follow-up ticket. It does not expand into retained folder-based lifecycle redesign.

Remove hard-coded workflow rules from all of these Backlog and Beads task-native paths, including supporting selected-task reads, preparation, status-publication, reservation, pre-session, continuation, and terminal/cleanup paths that otherwise reintroduce the same rules. Put their necessary operational guidance in the applicable editable skills and canonical workflows. Policy text embedded in TypeScript tool descriptions, prompt guidelines, or other code files must likewise move to editable Markdown rather than remaining a second policy authority. Do not leave a policy enforced in code merely because it is labelled readiness, safety, provenance, publication, integrity, or a lower-level preparation invariant.

The LLM must receive current provider/task/history/code/resource observations and apply the Markdown rules at every task-native stage. Semantic compatibility, task refinements, lifecycle eligibility, readiness, continuation, review/terminal prerequisites, and how to respond to unrelated or conflicting changes remain LLM judgment. Operator control of product, scope, merge, abandonment, and destructive actions remains unchanged; moving policy out of code does not grant new authority. A previous whole-branch revision is factual history evidence, not a frozen approval revision. Do not implement deterministic semantic classifiers, revision/content approval gates, automatic reconciliation, or a general policy framework. Keep native execution, transport, lifecycle loading/injection, and exact requested resource-operation mechanics proportional to those operations.

Unrelated staged, unstaged, or untracked changes in the primary code or task checkout must not become an initiation prerequisite. Unrelated published task-history descendants must remain compatible, including after In Progress publication and before session start. Do not ask users to quiesce unrelated work or silently commit, stash, revert, delete, or otherwise absorb it. Preserve native selected-task identity and lossless task evidence as facts for the invoking Agent, while keeping the rules and decisions in Markdown rather than rebuilding native admission predicates.

### Selected ticket must be committed before implementation: skill responsibility
Each Episode obtains task context through its provider's workspace/history. Update implement-task and the affected canonical workflows so the invoking Agent ensures the exact selected ticket is committed and published before admission. If needed, commit and publish that ticket first through the supported provider-native workflow. Backlog uses its exact-task Git history; Beads uses native task-history commit/publication rather than a fabricated Markdown/Git task path. The Episode must be able to obtain the selected committed ticket.

This is agent responsibility, not a new code-level revision or cleanliness gate. Preserve unrelated task/code bytes, staging, fields, and history. Never include another Conversation's work merely to make a checkout clean; uncertain ownership, real conflicts, scope, and semantic decisions belong to the LLM and operator as appropriate.

### Secondary addition: complete ticket-editing guidance audit
Audit all prime-claw skills and workflows, including shipped global skills, canonical project templates and lifecycle workflows, and their managed project copies. Ensure agents are consistently told to commit ticket edits ASAP when each coherent update is ready and publish promptly when a remote exists, using the selected provider's supported native history workflow. Cover task creation, specification, planning, execution content, review findings, blockers/status transitions, and terminal updates. Do not defer ticket commits until handoff, compaction, session end, or implementation admission.

Correct conflicting instructions and make the code-versus-editable-policy boundary clear across the affected assets. Keep the complete audit secondary and proportionate; it does not substitute for removing code-level policy or authorize unrelated workflow redesign. Candidate assets are not live user-global activation.

### Bounded recovery of the recorded partial operation
Provide a supported, narrowly bounded, owner-guided continuation for the recorded PRIMECLAW-45 allocated-worktree/pre-session failure. Retain the exact operation, owner, task, code base, host, worktree, and branch. Establish factual session/assignment evidence before continuation; absence of a recorded session alone is not permission to replay execution. Recovery decisions and procedure belong in editable guidance, with only the narrow native execution mechanics needed to act on the exact existing operation. Do not hand-edit ownership.json, retry as fresh creation, duplicate resources or execution, or build a general recovery framework.

## Constraints and validation
Preserve unrelated files, staging, published history, ownership, and resources. No force Git, duplicate task store, approval/checkpoint receipt, custom allocator, reconciliation engine, retry coordinator, or new policy interpreter. Do not patch dependencies. Retained folder-based lifecycle redesign and unrelated product changes remain outside scope. Task-native finalization/cleanup policy extraction is in scope, but no live destructive action or new cleanup authority is granted. Preserve exact existing ownership/resource identities; the same operation must not become a fresh Episode during this refactor.

Use focused regressions for both providers and required Docker-only candidate plugin validation. Demonstrate across initiation, ordinary execution/continuation, oversight/block/resume, and terminal/finalization paths that code delivers editable policy and factual observations rather than independently rejecting work under duplicate policy. Unrelated dirt and history advances must no longer cause code-level workflow-policy refusals. Verify preserved unrelated work, operator outcome boundaries, exact existing resources, and no duplicate execution in the recorded partial-operation shape.

No user-global activation, restart, live recovery mutation, destructive cleanup, or PRIMECLAW-45 dependency-upgrade implementation is authorized by this specification. Any later live recovery/activation follows the operator-authorized lifecycle. This revision authorizes neither planning nor implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 For both Backlog and Beads, the complete task-native lifecycle moves workflow rules and decisions out of code into editable skills/workflows applied by the LLM: specification/planning where code-backed, initiation, execution, continuation/handoff, oversight/review, block/resume, merge/abandonment, and terminal publication/finalization/cleanup. Code manages stage loading/injection and native execution mechanics, without duplicated/relocated policy guards or policy text left in TypeScript prompt guidelines.
- [ ] #2 Repo-wide cleanliness gates are removed throughout both providers’ task-native initiation and supporting task-read, preparation, status-publication, reservation, and pre-session paths. Unrelated staged, unstaged, or untracked task/code changes do not block initiation or require quiescence.
- [ ] #3 The implement-task skill and applicable canonical workflows make the invoking Agent responsible for committing and publishing the exact selected ticket before admission if needed, using Backlog exact-task Git publication or Beads native history. No new code-level commit/revision approval or whole-checkout cleanliness gate is added.
- [ ] #4 At every task-native lifecycle stage, current task, lifecycle, history, code-base, publication, and resource observations reach the LLM for editable-policy decisions. Unrelated published descendants are not rejected by frozen whole-branch equality, deterministic compatibility classifiers, or another policy engine. Operator authority over product, scope, merge, abandonment, and destructive actions remains unchanged.
- [ ] #5 Only authorized selected-task changes are committed/published. Unrelated bytes, staging, native fields, history, ownership, and resources are preserved; no stash/revert, unrelated commit, force, duplicate task store, automatic reconciliation, or hidden policy gate is used.
- [ ] #6 The secondary complete audit covers all prime-claw skills/workflows, shipped global skills, canonical templates/lifecycle workflows, and managed project copies. Guidance consistently requires coherent ticket edits to be committed ASAP and published promptly through the native provider, and clearly assigns workflow rules/logic to editable Markdown and LLM judgment rather than code.
- [ ] #7 Supported bounded owner-guided recovery for the recorded PRIMECLAW-45 allocated-worktree/pre-session failure preserves the exact owner, operation, task, base, host, worktree, and branch and establishes factual session/assignment evidence before continuation, without hand-editing ownership.json, fresh admission, duplicate execution/resources, or a general recovery framework.
- [ ] #8 Focused Backlog and Beads regressions cover initiation, ordinary execution/continuation, oversight/block/resume, and terminal/finalization paths, including unrelated dirty task/code state and relevant published-history interleavings plus the failed Backlog Blocked-publication shape. They prove code routes/injects editable policy instead of enforcing duplicate rules, preserves unrelated work and exact existing ownership/resources, reports native failures truthfully, retains operator outcome boundaries, and avoids duplicate execution.
- [ ] #9 Required Docker-only plugin validation and focused lifecycle tests pass with recorded evidence. No dependency patch, user-global activation, restart, live PRIMECLAW-45 recovery mutation, destructive cleanup, retained-folder lifecycle redesign, or dependency-upgrade implementation is performed.
<!-- AC:END -->
