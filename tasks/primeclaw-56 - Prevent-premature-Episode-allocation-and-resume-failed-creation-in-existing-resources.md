---
id: PRIMECLAW-56
title: >-
  Prevent premature Episode allocation and resume failed creation in existing
  resources
status: In Progress
assignee: []
created_date: '2026-11-03 18:47'
updated_date: '2026-11-05 16:12'
labels: []
dependencies:
  - PRIMECLAW-55
references:
  - >-
    .backlog/tasks/primeclaw-55 -
    Allow-Episode-initiation-during-unrelated-ticket-edits-and-task-history-advances.md
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - src/prime-agent-plugin/extension-support/task-history-workspace.ts
documentation:
  - docs/backlog.md
  - docs/conversation-driven-episode-oversight.md
  - docs/user-stories/E-episode-promotion.md
  - docs/user-stories/traceability.md
modified_files:
  - .prime-claw/workflows/implement-task.md
  - docs/backlog.md
  - docs/conversation-driven-episode-oversight.md
  - docs/user-stories/E-episode-promotion.md
  - docs/user-stories/traceability.md
  - src/prime-agent-plugin/skills/implement-task/SKILL.md
  - src/prime-agent-plugin/workflows/implement-task.md
  - tests/test_future_plan_skills.py
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement this as a Markdown-led task-native creation/recovery workflow, not a new recovery service. Preserve the reviewed Description and all seven AC. PRIMECLAW-55 owns the broader Backlog/Beads policy extraction and unrelated-ticket/history checks; reuse its changes where present, do not rebuild those rules or broaden this ticket into another lifecycle rewrite. The recorded PRIMECLAW-45 resources were removed by the operator-authorized workaround and are historical fixture evidence only.

1. Make preflight and recovery ordinary editable instructions.
   Update src/prime-agent-plugin/workflows/implement-task.md and .prime-claw/workflows/implement-task.md as the canonical procedure; keep src/prime-agent-plugin/skills/implement-task/SKILL.md thin and point it there. Extend the affected implement-task-prep source/project copies only to preserve existing operation/resource and delivery-uncertainty context. In src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md and src/prime-agent-plugin/skills/project-templates/blocked.md (plus .agents/skills/blocked/SKILL.md), route version-2 provisioning/uncertain creation failures to that procedure before active-session/Episode-report checks. An unstarted Episode cannot supply an Episode completion/blocker report. Qualify blanket no-direct-ownership-edit wording only for this documented, justified creation-recovery edit; leave ordinary active/retained lifecycle policy intact. Instructions first distinguish fresh admission from finishing an already owned creation. Before allocation, the Conversation checks the selected task's published native content, code base/execute assets, selected host/runtime availability, and provider transport/configuration prerequisites that can be checked without a worktree. Use existing native reads; do not add a preflight API, approval receipt or a second code-level policy. Target-only workspace materialization remains after allocation. A known prerequisite failure stops before reserving/allocating resources; report the actual native task state and promptly publish any justified selected-task-only lifecycle correction. Unrelated work remains untouched.

2. Remove only the concrete barriers to carrying out those instructions.
   Current obstacles are reviewed-plan.ts create_task_episode's requireLiveImplementationTask fresh-only gate, spec-episode.ts createTaskEpisode/createBeadsTaskEpisode's fresh In Planning/nonterminal-ownership path, and allocateReservedTaskEpisode's refusal of uncertain/already allocated provisioning followed by unconditional worktree creation. Narrowly adapt the existing creation/allocation seam to operate on the exact LLM-reconciled existing binding without a fresh status admission, reservation or worktree allocation. Do not implement a recovery-step planner or automatic continuation loop. The Conversation decides what remains unfinished. Prefer existing native operations; do not introduce a dedicated recovery tool/API. Continue to return factual native results and enforce exact requested owner/resource/transport identity. Keep phase eligibility, status decisions, compatibility and recovery reasoning in Markdown, not equivalent relocated TypeScript guards. Markdown alone cannot bypass today's fresh-only entry and hard-coded allocate-again path; that is the reason for these limited code changes. Reuse PRIMECLAW-55's extraction if these barriers are already gone. Keep the existing ownership schema and lifecycle values. Report reuse versus newly completed creation truthfully; returning an existing assignment must not claim that another execute assignment was sent.
   Run existing native primary-store checks earlier through Markdown instructions, using the selected-store/remote/config reads and the selected code base's task-store/execute configuration. Refactor the Backlog workspace helpers (preparePublishedBacklogEpisodeWorkspace / prepareEpisodeTaskHistoryWorkspace) only if a named obstacle prevents this ordering through existing native interfaces; helper refactoring or a new preflight layer is not a required deliverable. Actual target clone preparation still follows allocation. Do not build another inventory/capability framework or reintroduce PRIMECLAW-55's whole-store checks. Keep foreign-store/path/resource containment checks concrete, and report external late failures truthfully rather than deleting resources.

3. Document and enable bounded same-resource continuation.
   The owning Conversation rereads its exact existing ownership entry and native task/history, Git/Orca worktree, terminals, daemon/saved-session and initial-assignment evidence. A missing recorded session is not proof that none was created. Once the recorded cause is cleared and evidence supports continuation, make only the justified targeted update to this owner's existing entry using the current registry format/write safeguards, a fresh compare-before-edit and a verification reread; preserve all other owners and the original operation, task/provider, base, host, branch and worktree. Preserve known resource/session/automation identities rather than clearing fields to force fresh allocation. Once the cause and uncertainty are resolved, an incomplete creation may return to the existing provisioning value; mark active only after the exact session and initial assignment are established. Do not clear identity fields or declare a partial session active just to pass a guard.
   - Allocated worktree, no session/assignment established: prepare only the missing target workspace, then start the durable session in that existing worktree and admit the single fixed execute assignment. No initial handoff, new operation or second resource allocation.
   - Durable session or Orca launch already exists: reconcile its factual identity into the same entry, reuse/reopen that session or finish only the proven-unfinished native launch step. Send an initial assignment only when inspection establishes that it was not admitted; an existing assignment is not resent.
   - Complete existing session/assignment: reconcile the existing active binding and return/reuse it without another status publication or execute assignment. Resume normal handoff only later, under its existing lifecycle authority.
   - Foreign identities, unsafe ancestry, conflicting sessions or uncertain delivery: stop with the exact unresolved fact and next operator/inspection action. Do not guess, retry transport, delete/recreate resources, change task status to In Planning merely to pass admission, or invoke terminal cleanup as recovery.
   The Conversation reads current native status first, retains truthful Blocked while the cause is unresolved, and restores In Progress only after accepted clearance and before initial execution. Publish a transition only if needed and verify native/publication evidence; do not replay the original admission/status edit or an already completed rollback. Current provider observations are interpreted through supported provider CLI/history, not a coded semantic reconciler. Publish coherent task and ownership edits promptly without including others' work; preserve original base/operation while updating only justified current observations. Operator hand-repair is not required. No deterministic task reconciliation, iterative plan revision, semantic recovery code, new ownership states/schemas, checkpoints, approval records, receipt protocol, automatic retry/recovery engine or exactly-once transaction machinery.

4. Validate the small mechanics and the documented procedure.
   Change only tests affected by actual implementation changes. Use the existing tests/reviewed_plan_extension.test.mjs, tests/spec_episode_extension.test.mjs or task_episode_admission suites where relevant; naming them does not require expanding every suite. Cover the shared allocator's Beads route if affected, without recreating PRIMECLAW-55's complete lifecycle matrix. Replace the old 'partial provisioning cannot replay allocation' dead end with a test that unreconciled/foreign identity still cannot allocate again, while an explicitly inspected same-binding continuation reuses its resources. Keep the existing no-second-assignment active replay/uncertain-transport checks.
   Exercise the Markdown instructions against three representative isolated fixtures: known failure before allocation (no resources/reservation); the historical Backlog allocated-worktree/pre-session shape (same identities, one eventual session/assignment); and existing session/assignment evidence (reuse with zero extra allocation/delivery, stop on ambiguity). Include a failed native status publication in one fixture and show the Conversation reports/reconciles actual state rather than concealing it. Prove other owners and unrelated bytes/staging/history are unchanged. No exhaustive failure matrix, new recovery harness or live PRIMECLAW-45 recovery.
   Run only the relevant existing bridges (tests/test_reviewed_plan_extension.py, tests/test_task_providers.py or tests/test_task_history_workspace.py) with their Docker tier-1 fixture for affected mechanics. Keep the three representative exercises above and the required scripts/test-tier1.sh --probe validation after plugin-source changes; do not infer a requirement to expand every named suite. Keep native Prime Agent probes behind scripts/run-prime-agent-probe.sh in the isolated container. No host/user-global apply/check, dependency patch or candidate activation.

5. Update the existing creation/oversight docs and acceptance evidence.
   Update the relevant sections of docs/conversation-driven-episode-oversight.md, docs/backlog.md and docs/user-stories/E-episode-promotion.md (US-13/14/16) for prerequisite ordering, targeted owner-led reconciliation and same-resource continuation; label branch/worktree deletion as an exceptional operator-authorized workaround. Update the affected assertions in tests/test_future_plan_skills.py, tests/test_oversee_episode_skill.py and tests/test_blocked_skill.py and existing story traceability rather than adding a new protocol document. Preserve DD-004 no-blind-replay policy; completing a proven-missing step is not replaying ambiguous mutation. Keep managed project guidance aligned without overwriting unrelated customizations. Record focused Docker results and representative workflow evidence in the native task. Request review of the candidate; merge, global refresh/restart, destructive actions and live recovery remain separate operator decisions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Blocked on PRIMECLAW-55: task-native implementation admission still rejects unrelated task-history activity under the loaded runtime's over-broad workspace checks.

The operator explicitly authorized implementation of PRIMECLAW-56 after approving its revised Markdown-first plan. The single implement_task(PRIMECLAW-56) attempt failed before readiness admission with:
reviewed-plan: Backlog task-read workspace is blocked (remote-advanced): the nested clone (dd9296695b3b) is not a clean fast-forward ancestor of the remote task branch (119b56eb7f9c); inspect and reconcile the nested clone with the remote task branch through ordinary Git; never force

The observed advance was unrelated PRIMECLAW-53 admission commit dd9296695b3bf2de79487fa63f12f12fb5a345c5 following PRIMECLAW-56's published plan revision 119b56eb7f9cd4120eb64e450b2bf63539d55bd1. Subsequent inspection found local and direct remote task heads already matching at dd9296695b3bf2de79487fa63f12f12fb5a345c5. PRIMECLAW-56's own task path was clean, its approved plan unchanged, and status remained In Planning. An unrelated PRIMECLAW-55 edit was also present and was preserved. No PRIMECLAW-56 Episode ownership/resources were allocated, and no admission retry was made.

This is an existing admission-tool defect tracked by PRIMECLAW-55, not a legitimate requirement to quiesce unrelated work and not a defect introduced by PRIMECLAW-55. The task-history advance does not establish any specification/readiness conflict in PRIMECLAW-56. The full semantic readiness review did not run.

Unblock when the PRIMECLAW-55 fix is available in the running plugin generation and exact-task admission can proceed despite unrelated edits/compatible history advances. Activation/restart, if needed, require their separate operator-authorized lifecycle; task status or source merge alone is not proof of loaded-runtime behavior. After the owning Conversation accepts that clearance, re-read current native task/ownership/resource evidence, restore and publish In Planning for this not-yet-started task, and run the canonical implementation-readiness workflow for this same task within the operator's existing approved scope. Do not create a second Episode, force Git, remove another Conversation's work, or treat resource deletion as recovery. Preserve the approved specification, seven AC and Implementation Plan.

## Admission blocker cleared; resume implementation readiness
Joe confirmed that PRIMECLAW-55, PRIMECLAW-57 and PRIMECLAW-58 are finished, merged and installed. Fresh native task views confirm all three are Done; PRIMECLAW-56 has no remaining blocking dependency. Accept this clearance of the recorded PRIMECLAW-55 admission blocker and restore In Planning before the canonical implementation-readiness workflow.

The approved Markdown-first specification, seven acceptance criteria, Implementation Plan and PRIMECLAW-55 dependency are preserved. Joe's explicit implementation approval remains in effect; the full current semantic readiness review is still required, including the effect of the now-landed work on this plan. Current code base is main at f5287c3647245a6a5e6d3baad64d9cecf1dab81b, matching direct origin/main. There is no existing Episode ownership entry for this Conversation and no PRIMECLAW-56 Episode was created by the earlier failed admission. Resume through implement_task for this exact task; do not implement in the owner Conversation or replay an initial execute assignment. No merge, activation, restart or cleanup action is performed or newly authorized by this note.

## Execute slice 1: native preflight before fresh allocation

Current implementation audit at code base f5287c3647245a6a5e6d3baad64d9cecf1dab81b: PRIMECLAW-55 removed the fresh-only reviewed-plan gate, and PRIMECLAW-58 already provides narrow independent-Backlog/Orca allocated-pre-session continuation and existing-session binding. Reuse those mechanics. This pass takes only the smallest remaining pre-allocation slice: editable implement-task instructions for discoverable provider/store/transport, selected code assets and placement/runtime prerequisites before reservation/allocation; aligned creation docs; and a representative isolated known-failure exercise with truthful native-status reporting. No new TypeScript preflight API or policy gate is needed for these native reads.

The broader targeted ownership-reconciliation workflow, other partial creation shapes and remaining recovery exercises remain follow-up work inside this approved task. This slice is not a full-task candidate. Preserve the specification, plan, all seven AC and In Progress status. No live recovery, global activation/restart, merge, lifecycle-status edit or ownership edit is performed by this Episode.

## Slice 1 published: native prerequisites before fresh allocation

Published code candidate: b2657d09df7dfb59af816ee0dd813b88c0cb258a on JLanders/prime-claw-primeclaw-56-episode-b31eee86, based on the original code base f5287c3647245a6a5e6d3baad64d9cecf1dab81b; integration target remains main. The code branch is clean and directly published. This is a bounded partial-task candidate for Conversation review, not a claim that PRIMECLAW-56 is finished.

The canonical/project implement-task workflow now directs available native checks before fresh In Progress admission, reservation or resource allocation: exact owner/existing-operation distinction; committed execute/code-store projection; selected native ticket/history/config and transport; selected placement/runtime availability. Supported Backlog folder-config layouts do not require a root configuration link; inspect that link only when root config is the selected authority. Only target-specific materialization/session/assignment work stays after allocation. Known failure reports actual native status and any local-versus-published status difference rather than inferring rollback. The global entry remains a thin pointer; creation docs and US-13/14/16 traceability are aligned. No TypeScript, ownership schema/state, recovery API, retry engine or new protocol was introduced.

Validation:
- `python3 -m pytest tests/test_future_plan_skills.py -q -k "task_native_implementation_policies or task_implementation_entry"`: 2 passed, 41 deselected.
- `scripts/test-tier1.sh --probe`: passed in isolated Docker, source mode using a clean read-only standalone clone of `cwd-fix-v0.9.8-r1` at a1faacd53ac4473a75de1d434afaf50945c2f647 selected through TIER1_ENV_FILE/PRIME_AGENT_SOURCE. Evidence: .test-results/20261105T160234Z-22822-18bc65e8/tier1/manifest.json (run.status passed, no failure codes; network isolation and teardown verified).
- `python3 -m pytest tests/test_future_plan_skills.py::test_documented_creation_preflight_native_failure tests/test_task_providers.py::test_backlog_task_episode_admission_node_suite -q -m container`: 2 passed, including clean fixture teardown. Evidence: .test-results/20261105T160706Z-32751-ce0ba2c6/tier1/manifest.json and preflight-native-read-exercise.json.

The isolated native-read exercise has a published independent Backlog task in In Planning and a working-tree-only execute file absent from the committed code base. `git show HEAD:.agents/skills/execute/SKILL.md` reports exit 128; the procedure stops without requesting creation, allocation, session/assignment or status mutation. The selected native task view/status, code/task heads, worktree/branch inventory, other-owner bytes and unrelated staged-work status remain unchanged. This is native-command smoke evidence plus editable-policy ordering assertions, not an automated LLM-compliance or full recovery test. The existing Backlog admission suite also covers a failed native In Progress commit: actual In Progress task bytes remain, code HEAD is unchanged, and no ownership/allocation occurs.

Validation setup/repair evidence: the first driver attempt rejected a temporary source selector through macOS's /var symlink during source inventory before building; a canonical resolved source path fixed the selector without changing upstream source. The first focused run's two test bodies passed, but sanitized-evidence teardown rejected raw temporary paths in the new JSON. Removed raw output/path values from the durable command/exit record and reran the same focused tests successfully. No production provider, live plugin refresh, restart or recovery was used.

Remaining within the approved plan: full owner-led targeted reconciliation/compare-before-edit instructions; prep/blocked/oversight routing for broader partial creation; any still-required narrow deterministic enabling changes beyond PRIMECLAW-58; allocated-pre-session and existing-session/assignment Markdown-led exercises with the remaining status-publication/ambiguity evidence. All seven AC remain unchecked pending that full review. Keep In Progress and the exact same Episode; no new Episode, status transition, merge, activation/restart, abandonment or cleanup is authorized by this slice report. Unrelated PRIMECLAW-45 task-history descendants afc29a2/55530cc were inspected and retained through ordinary fast-forward in this Episode task clone; the selected task view was unchanged before the content update.
<!-- SECTION:NOTES:END -->
