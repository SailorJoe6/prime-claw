---
id: PRIMECLAW-55
title: >-
  Allow Episode initiation during unrelated ticket edits and task-history
  advances
status: In Progress
assignee: []
created_date: '2026-11-03 18:21'
updated_date: '2026-11-03 21:14'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation approach
Make this a removal-and-relocation refactor, not a new policy framework. Editable Markdown and the invoking LLM own the complete Backlog and Beads task-native lifecycle. Code loads the relevant stage, supplies current native facts, performs explicitly requested supported operations, and reports their results. Keep operator authority unchanged. Existing tests and historical guard names do not create requirements. Deliver coherent slices of this one task, changing code, guidance and tests together; do not introduce another lifecycle protocol.

### 1. Map the current paths, then move policy before removing its duplicate
Trace task-native specification/planning, initiation, execution, handoff/continuation, oversight/review, block/resume, and terminal/finalization through `extensions/reviewed-plan.ts`, `extension-support/prep-chain.ts`, `workflow-chain.ts`, `spec-episode.ts`, `task-history-workspace.ts`, `task-providers.ts`, `task-episode-ownership.ts`, `task-episode-cleanup.ts`, and the existing oversight/handoff injection paths. Use the existing asset inventory and story traceability to avoid missing a stage; do not add a policy registry or second requirements document.

Put the actual rules in the existing entry skills, project skills, and canonical workflows. Move policy prose from tool descriptions/snippets/parameter descriptions/`promptGuidelines` and generated prompt suffixes into Markdown too; leave concise mechanical API descriptions and factual bindings. Reuse current workflow/guide loaders. Wire each affected operation to the right current guidance and native observations, including initial execute and later review/cleanup; no hard-coded fallback policy, new rules engine, or approval receipt.

### 2. Remove shared and Backlog code-policy gates end to end
Change the production task-resolution, preparation, publication, reservation, allocation, continuation and terminal paths, not only the two initially reported dirty checks. Make selected-task reads observational: `resolveSynchronizedProviderTask` must not implicitly bootstrap/synchronize/relocate another workspace, and Backlog configuration/status capability checks must not hide an otherwise readable native task. Separate factual reads from explicitly requested preparation. In `task-history-workspace.ts` and its callers, remove whole-primary/nested-clone cleanliness, whole-index changed-path counts, stale whole-branch equality and paired stable-head requirements as workflow prerequisites. An Episode can obtain the selected committed/published task through its existing native history workspace without first synchronizing another Conversation’s dirty primary checkout. Keep supported independent and grandfathered branch-local layouts; do not introduce another task authority/store. Remove the existing multi-round stable-read/push-retry/other-task-classifier/automatic-merge reconciliation in `publishTaskHistoryMutation` and its helpers, rather than extending it. Reuse direct native task edit and exact-path Git commit/non-force push; report before/after facts and actual conflicts for the LLM to interpret.

In `spec-episode.ts`, `prep-chain.ts`, tool entry callbacks and ownership helpers, remove duplicate lifecycle-status/design/readiness, selected-ticket-publication and primary-main/clean-upstream/code-base suitability decisions. Cover ordinary handoff and terminal paths as well as initial create. Return current task/code/history/resource facts and actual native failures for Markdown-led decisions; do not relocate predicates under transport, safety, integrity, reservation or cleanup labels. Retain only proportional native I/O/transport and exact requested resource-operation mechanics, including addressing the correct existing owner entry, session, worktree and ref without overwriting foreign resources. Do not add new lock/approval state.

### 3. Apply the same extraction to every Beads path
Remove the Beads-specific eligibility, clean-whole-working-set, exact local/remote/paired-revision, frozen task-content, status/design and code-head gates in provider reads/transport, creation/reservation, continuation/evidence advancement and terminal cleanup. Relevant seams include `checkBeadsCapabilities`, `prepareSelectedBeadsWorkspaceTransport`, `exactBeadsAdmissionTask`, `proveBeadsAdmissionCodeHead`, `reservePublishedBeadsTaskEpisodeOwnership`, `advancePublishedBeadsTaskEpisodeEvidence`, `mutateAndPublishBeadsTaskStatus` and terminal-task readers. Do not leave Beads behind after fixing Backlog.

Obtain only the native observations needed for the current stage through existing interfaces. Do not build a universal observation layer, cached snapshot schema, or repeated whole-store publication-proof pipeline. When reading a task, preserve its complete native long view, status and field absence, including unmapped/closed statuses; do not hide them behind a canonical-status refusal or fabricate a Backlog path/normalized mirror. Ensure fresh native context reaches initial execute and subsequent stage guidance without creating another store or assignment. Native CLI conditions may be executed when explicitly requested by the LLM; they are not hidden plugin transition rules.

### 4. Make lifecycle decisions and ticket durability explicit in Markdown
Move status-transition orchestration and failure disposition out of code. In particular, code must not choose automatic rollback to In Planning versus Blocked from an exception, decide semantic compatibility of observations, or decide terminal eligibility before exposing current facts. Existing owner guidance directs native provider/Git commands for status, blockers/resume, Ready/Request Changes, merge/abandonment and cleanup. Preserve Conversation status ownership, Episode content ownership and read-only Expert review. Explicit operator merge/abandonment authority and automatic exact cleanup after its published terminal outcome remain the same; moving the rules grants no new authority.

Update shipped `implement-task` and both canonical implementation workflows so the invoking Agent commits and, when a remote exists, publishes the selected coherent ticket before the Episode needs it. Use exact-task ordinary Git history for Backlog and native history for Beads. This remains an Agent duty, not a native approval-revision or cleanliness check. On real native conflicts or uncertain consequential results, preserve facts and use current evidence/LLM judgment; no automatic reconcile/retry/fresh allocation.

Complete the secondary durability audit across every Markdown asset in `asset-inventory.json`, the repo’s managed `.agents/skills/` and `.prime-claw/workflows/` copies, additional `.agents/skills/backlog`/AGENTS guidance, and role/continuation fragments. Cover creation, specification, planning, content/plan/evidence edits, accepted review findings, blockers/status and terminal updates. Each coherent authorized ticket edit is committed ASAP and published promptly, not saved for handoff/compaction/session end. Remove conflicting whole-store/index/code cleanliness instructions and obsolete claims that a separate host gate still enforces policy. Preserve unrelated bytes/staging/history/fields and customize exact paths rather than blanket-copying/resetting project assets. Fix independent-history Expert guidance so the task is read from native task history, not assumed to be in the code candidate commit.

### 5. Support only the recorded same-operation recovery
Add the bounded owner procedure to existing implementation/blocked/oversight guidance for PRIMECLAW-45’s allocated-worktree/pre-session shape. Inspect current exact operation/resource and actual session/assignment-delivery facts first. Missing recorded session identity alone does not establish that execution never started. Continue only the owning Conversation’s same operation, task, code base, selected host, branch and worktree; reuse an existing session/assignment where present and report genuine ambiguity instead of replaying it.

Reuse the existing allocator’s post-worktree task-preparation, launch/session and identity-binding operations. Expose only the missing existing-operation continuation through the current task lifecycle surface, explicitly bound to the recorded operation identity; it must not re-enter reservation/worktree allocation or count as fresh admission. Keep the decision/procedure in Markdown and only the requested action/identity update in code. Do not add a general recovery API/state machine, hand-edit ownership or duplicate resources/assignments. Reproduce this with disposable fixtures. Do not mutate the live PRIMECLAW-45 resources, implement its dependency upgrade, or expand into the separate general allocation-recovery/direct-work/stacked-base features.

### 6. Replace obsolete policy tests with focused behavior coverage
Update tests alongside each coherent source/guidance slice. Exercise the production/default resolver and tool paths: the existing Backlog admission integration injects plain `resolveBacklogTask` and finishes its history advance before preparation, so it misses the recorded failure. Add representative dirty staged/unstaged/untracked unrelated primary task/code work and published descendants after In Progress, during pre-session preparation, after successful publication, and in handoff/blocker/terminal paths. Check preserved bytes, index entries, native fields/history and other owners/resources, not a globally clean result.

For both providers, prove edited project guidance is loaded at applicable stages and current raw facts reach the LLM without duplicate policy refusals. Cover truthful native command/transport failure, partial allocation/failure reporting and same-operation continuation without duplicate assignment. For Beads, include raw status/field absence and unrelated native-history descendants. For terminal operations, test exact requested resource targeting and preservation of foreign/shared resources; eligibility decisions belong in Markdown, not a new fake semantic classifier. Preserve retained version-1 behavior through regression coverage without redesigning it.

Use the existing Node suites and Python container bridges: `task_history_workspace`, `task_providers`, Backlog/Beads admission, ownership, `reviewed_plan`, `spec_episode`, and `episode_close`. Update static Markdown/metadata assertions that pin the obsolete host guards instead of preserving them; retain useful inventory/discovery/customization checks. Do not add an exhaustive matrix, new test framework or prose-only substitute for runtime tests.

### 7. Validate, align docs and publish the candidate
After every plugin-source change run the required Docker-only tier 1. Use `scripts/test-tier1.sh --probe` plus focused bridges via `python3 -m pytest tests/test_task_history_workspace.py tests/test_task_providers.py tests/test_reviewed_plan_extension.py -q -m container` and relevant existing stage/asset tests. Run host-safe tier-0 checks where relevant. All candidate plugin execution/probes stay isolated; no host/user-global candidate apply/check or live sandbox/provider calls.

Align task-native portions of `docs/backlog.md`, `prep-chain.md`, `handoff-chain.md`, `conversation-driven-episode-oversight.md`, relevant stories/traceability and `future-specification-bundles.md` with the new policy/mechanics boundary. Keep REQUIREMENTS G2/P6/P11 consistent without importing unrelated proposed features, and leave historical evidence historical. Follow inventory/delivery rules if assets move; preserve customized-project update semantics and foreign active snapshots. Do not activate global assets.

Commit/publish coherent code and native task updates promptly. Record the actual commands/results and limits on this task, with remaining accepted in-scope work in its living plan. Deliver a reviewable candidate only: no user-global activation/restart, live recovery, destructive cleanup, retained-folder redesign, dependency patch, merge or abandonment is included. This planning request does not authorize implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Slice 1 selected — observational task reads (2026-11-03)
Implement the smallest end-to-end read-path removal in plan steps 1–3: remove implicit Backlog workspace preparation/synchronization from the default resolver and provider-capability/status eligibility refusals from the native task read for both providers. Preserve complete native task views and truthful native failures. Move explicit read/preparation and eligibility responsibility into existing planning/implementation Markdown. Cover real independent Backlog workspaces with unrelated dirty code/task state and stale/published history, and Beads with absent custom status configuration/unmapped raw statuses. Do not change allocation, lifecycle mutation, continuation, terminal policy, or live resources in this slice; those remain accepted work on this same task. Validate only in Docker, publish one code slice and exact native task notes, then stop for owner review. No acceptance criterion is fully met yet.
<!-- SECTION:NOTES:END -->
