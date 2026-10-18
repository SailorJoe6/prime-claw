---
id: PRIMECLAW-10.38
title: Replace .ralph/plans with task-native Backlog/Ralph lifecycle
status: In Progress
assignee: []
created_date: '2026-10-12 21:02'
updated_date: '2026-10-18 15:57'
labels:
  - backlog-md
  - episode-loop
  - phase4
  - ralph
  - migration
dependencies: []
references:
  - PRIMECLAW-35
  - PRIMECLAW-10.37
  - .ralph/plans/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - PRIMECLAW-6
  - PRIMECLAW-10.15
  - PRIMECLAW-10.26
  - PRIMECLAW-10.28
  - PRIMECLAW-19
  - PRIMECLAW-20
  - PRIMECLAW-10.34
  - PRIMECLAW-7
  - PRIMECLAW-10.38
  - PRIMECLAW-36
  - PRIMECLAW-37
  - PRIMECLAW-38
  - PRIMECLAW-39
  - PRIMECLAW-40
  - PRIMECLAW-41
  - PRIMECLAW-42
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/EXECUTION_PLAN.md @ 6447b87da65274046af4388474426a6b68718706;
    git-blob=20d41abbed237a823f19551f8f6d433612b4f5e9;
    sha256=62df6aade82219986cd24fd0833c0718e6208d833d30169621c9eb11ab7f1ae8
  - >-
    .ralph/plans/SPECIFICATION.md @ 6447b87da65274046af4388474426a6b68718706;
    git-blob=45ddd044737f5370f72886a0823231aba3fb90b4;
    sha256=5e34f819078103828cfb970b2836c78f2249a673c6d7474f4816191450652999;
    superseded-by=PRIMECLAW-10.38
  - >-
    legacy-episode-source=.ralph/plans/future/replace-ralph-plans-with-backlog;
    superseded-by=PRIMECLAW-10.38
  - >-
    docs/evidence/task-native-backlog-cutover/2026-10-17-step-7-plan-tree-deletion.json
  - >-
    docs/evidence/task-native-backlog-cutover/2026-10-18-step-8-least-technology-simplification.md
documentation:
  - AGENTS.md
  - README.md
  - VISION.md
  - LONG_RANGE_PLAN.md
  - DEVELOPERS.md
  - docs/README.md
  - docs/backlog.md
  - docs/prep-chain.md
  - docs/handoff-chain.md
  - docs/project-initialization.md
  - docs/conversation-driven-episode-oversight.md
  - docs/future-specification-bundles.md
  - docs/user-stories/C-specification.md
  - docs/user-stories/D-planning.md
  - docs/user-stories/E-episode-promotion.md
  - docs/user-stories/F-episode-execution.md
  - docs/user-stories/G-oversight-and-review.md
  - docs/user-stories/H-handoff-and-continuation.md
  - docs/user-stories/I-episode-finalization.md
  - docs/user-stories/traceability.md
  - >-
    docs/evidence/task-native-backlog-cutover/2026-10-14-step-6-status-migration.json
  - >-
    docs/evidence/task-native-backlog-cutover/2026-10-17-step-7-plan-tree-deletion.json
  - docs/user-stories/README.md
  - >-
    docs/evidence/task-native-backlog-cutover/2026-10-18-step-8-least-technology-simplification.md
modified_files:
  - .ralph/.env.example
  - .ralph/README.md
  - .ralph/plans/EXECUTION_PLAN.md
  - .ralph/plans/SPECIFICATION.md
  - .ralph/plans/archive/README.md
  - .ralph/plans/archive/compaction-first-phase-transitions/EXECUTION_PLAN.md
  - .ralph/plans/archive/compaction-first-phase-transitions/SPECIFICATION.md
  - .ralph/plans/archive/conversation-driven-episode-oversight/EXECUTION_PLAN.md
  - .ralph/plans/archive/conversation-driven-episode-oversight/SPECIFICATION.md
  - .ralph/plans/archive/conversational-ralph-command-routing/EXECUTION_PLAN.md
  - .ralph/plans/archive/conversational-ralph-command-routing/SPECIFICATION.md
  - .ralph/plans/archive/goal-heartbeat-work-control/EXECUTION_PLAN.md
  - .ralph/plans/archive/goal-heartbeat-work-control/SPECIFICATION.md
  - .ralph/plans/archive/handoff-continuation-resilience/EXECUTION_PLAN.md
  - .ralph/plans/archive/handoff-continuation-resilience/SPECIFICATION.md
  - .ralph/plans/archive/official-lean-compatibility-cleanup/EXECUTION_PLAN.md
  - .ralph/plans/archive/official-lean-compatibility-cleanup/SPECIFICATION.md
  - .ralph/plans/archive/official-lean-session-protocol/EXECUTION_PLAN.md
  - .ralph/plans/archive/official-lean-session-protocol/SPECIFICATION.md
  - .ralph/plans/archive/phase1-derisk-gate/DECISIONS.md
  - .ralph/plans/archive/phase1-derisk-gate/EXECUTION_PLAN.md
  - .ralph/plans/archive/phase1-derisk-gate/REQUIREMENTS.md
  - .ralph/plans/archive/phase1-derisk-gate/SPECIFICATION.md
  - .ralph/plans/archive/phase2-runtime/DECISIONS.md
  - .ralph/plans/archive/phase2-runtime/EXECUTION_PLAN.md
  - .ralph/plans/archive/phase2-runtime/REQUIREMENTS.md
  - .ralph/plans/archive/phase2-runtime/SPECIFICATION.md
  - .ralph/plans/archive/phase3a-bufd-superseded-incomplete/DECISIONS.md
  - .ralph/plans/archive/phase3a-bufd-superseded-incomplete/EXECUTION_PLAN.md
  - .ralph/plans/archive/phase3a-bufd-superseded-incomplete/REQUIREMENTS.md
  - .ralph/plans/archive/phase3a-bufd-superseded-incomplete/SPECIFICATION.md
  - .ralph/plans/archive/plugin-test-container/EXECUTION_PLAN.md
  - .ralph/plans/archive/plugin-test-container/SPECIFICATION.md
  - >-
    .ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-2666843-expert-pass.md
  - >-
    .ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-47d2830-expert-block.md
  - >-
    .ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-d8dbc5d-expert-block.md
  - >-
    .ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice2-470be98-expert-block.md
  - >-
    .ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice2-bc00cba-expert-pass.md
  - .ralph/plans/archive/project-wide-testing-strategy/EXECUTION_PLAN.md
  - .ralph/plans/archive/project-wide-testing-strategy/SPECIFICATION.md
  - >-
    .ralph/plans/archive/worktree-isolated-specification-episodes/EXECUTION_PLAN.md
  - >-
    .ralph/plans/archive/worktree-isolated-specification-episodes/SPECIFICATION.md
  - .ralph/plans/future/delivery-manager-episode-supervision/SPECIFICATION.md
  - .ralph/plans/future/phase3a-brain-hosting-completion/EXECUTION_PLAN.md
  - .ralph/plans/future/phase3a-brain-hosting-completion/SPECIFICATION.md
  - LONG_RANGE_PLAN.md
  - README.md
  - VISION.md
  - >-
    backlog/tasks/primeclaw-10.38 -
    Replace-.ralph-plans-with-task-native-Backlog-Ralph-lifecycle.md
  - bin/prime-claw
  - docs/README.md
  - docs/backlog.md
  - docs/conversation-driven-episode-oversight.md
  - >-
    docs/evidence/task-native-backlog-cutover/2026-10-17-step-7-plan-tree-deletion.json
  - >-
    docs/evidence/task-native-backlog-cutover/2026-10-18-step-8-least-technology-simplification.md
  - docs/future-specification-bundles.md
  - docs/handoff-chain.md
  - docs/user-stories/C-specification.md
  - docs/user-stories/D-planning.md
  - docs/user-stories/F-episode-execution.md
  - docs/user-stories/G-oversight-and-review.md
  - docs/user-stories/H-handoff-and-continuation.md
  - docs/user-stories/I-episode-finalization.md
  - docs/user-stories/README.md
  - docs/user-stories/traceability.md
  - src/prime-agent-plugin/extension-support/episode-ownership.ts
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
  - src/prime-agent-plugin/extensions/reviewed-plan.ts
  - src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md
  - tests/reviewed_plan_extension.test.mjs
  - tests/spec_episode_extension.test.mjs
  - tests/test_backlog_workflow.py
  - tests/test_oversee_episode_skill.py
  - tests/test_project_initialization.py
  - tests/test_reviewed_plan_extension.py
  - tests/test_role_kernel.py
parent_task_id: PRIMECLAW-10
priority: p1
type: epic
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome

`PRIMECLAW-10.38` performs this repository's own `.ralph/plans` data cutover to the task-native workflow. It does not remove the generic plugin's legacy workflow. Other initialized repositories may continue to use the legacy workflow, including repositories that use Backlog for tracking.

Tracker migration and specification authority are orthogonal. Backlog tracking may coexist with legacy bundles. Beads migration is optional and separate from workflow selection. A Beads-only repository initializes the task-native workflow. Archive-only bundles do not force the legacy workflow.

Keep the established Conversation, operator, Episode, and Expert authority boundaries. Preserve exact task identity, Episode ownership, isolated worktrees and sessions, handoff and compaction continuation, review, recovery, merge authority, abandonment authority, finalization, and cleanup boundaries.

## Task-native workflow

This repository retains these configured Backlog statuses:

1. `In Design`
2. `In Planning`
3. `In Progress`
4. `Blocked`
5. `Ready for Merge`
6. `Done`

The prompt-led task-native lifecycle keeps `Ready for Merge` as an observable status gate without a custom handshake, coordinator, or receipt. Work remains `In Progress` through review. After accepting an exact pushed candidate, the Conversation sets only the bound main task to `Ready for Merge`, verifies and commits only that path, and pushes. It then uses ordinary Git in the idle Episode to integrate current main while preserving Episode-owned task content and applying only the authorized status, pushes and verifies the refreshed candidate, and shows the operator the exact `(taskId, mainHead, candidateHead)`. `Done` is the successful terminal status after an ordinary fast-forward merge. Confirmed abandonment uses Backlog soft deletion and never marks the task `Done`. New ordinary tasks default to `In Design`; this repository removes active `To Do` guidance only after its data migration is proven.

`/design` and `/spec-it-out` create or revise `In Design` tasks. `/plan TASK-ID` accepts only `In Design` or `In Planning`, writes the native Implementation Plan, and leaves the task `In Planning`. `/implement-task TASK-ID` is the task-native workflow's new-Episode admission command. It accepts only an `In Planning` task with a meaningful native plan and preserves the proportional structural and semantic readiness gate.

After readiness succeeds, the Conversation changes the exact task on main to `In Progress` and commits that exact path before creating Episode resources. The Episode branch starts at that commit. A proven-clean failure returns the task to `In Planning`; uncertain or partial creation publishes `Blocked` with the exact recovery condition and is not retried as a new Episode.

During a task-native Episode, the Episode owns task content on its branch and never independently changes lifecycle status. The Conversation owns lifecycle status on main and applies the accepted `Ready for Merge` or requested-revision `In Progress` status during its ordinary same-Episode Git integration. The same task and ownership record span execute, handoff, compaction, review, blocked/resume, Ready publication, and revision passes. Review and operator decisions are prompt-led. Delay is a no-op. Request Changes returns only the bound main task to `In Progress`, commits and pushes that path, integrates current main into the same Episode as needed while preserving its task content and applying the authorized status, then uses existing handoff. Merge uses a fresh exact `(taskId, mainHead, candidateHead)` preflight followed by ordinary `git merge --ff-only`, a supported Backlog `Done` edit, an exact task-only commit, and push. Confirmed abandonment selects only the bound pushed task content, records a truthful Final Summary, archives without `Done`, commits only the task move, and pushes. Ownership and resources remain until a separate explicit cleanup decision. The cleanup-only stable host boundary durably binds the exact pushed Episode head, verifies the terminal state, removes runtime, worktree, and branch in order, and closes ownership last.

## Legacy workflow preserved by the generic plugin

The generic plugin retains the legacy workflow for initialized repositories that select it. Preserve the four project-local legacy workflow assets:

- `project-workflow-plan-prep`
- `project-workflow-plan-spec`
- `project-workflow-implement-prep`
- `project-workflow-implement-spec`

Preserve `/plan-spec`, `/implement-spec`, `plan_spec`, `create_spec_episode`, `handoff_spec_episode`, and `finalize_spec_episode`. Preserve ownership version 1 parsing and the legacy promotion, recovery, handoff, review, finalization, and cleanup behavior needed by existing Episodes. Preserve old active-snapshot fallback for `.ralph/skills/handoff` and `.ralph/skills/execute`.

Execute, handoff, blocked handling, Expert review, and Conversation oversight use hybrid routing. Persisted ownership decides the workflow before prompt-tag absence: a valid ownership version 1 record selects the legacy workflow and a valid ownership version 2 record selects the task-native workflow. `<operator-episode-task>` is only a candidate task binding when ownership does not decide. When persisted ownership is absent, active legacy `SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files on canonical main may represent the old in-place legacy workflow without any live Prime Claw Episode or ownership version 1 record; that remains a valid legacy workflow case. This no-ownership fallback selects old in-place work only and does not establish Episode identity. Active plan placement alone does not prove live Episode identity. A live ownership version 1 Episode requires persisted version 1 ownership plus active files in that Episode worktree.

Legacy workflow completion wording must not claim or mutate task-native Backlog lifecycle authority. The generic plugin also retains separately named project-local `design-legacy` and `spec-it-out-legacy` authoring assets that preserve current-main legacy authoring without mechanically duplicating neutral or shared Markdown.

Project-local `.prime-claw/workflows` files are the runtime surfaces. Plugin-root copies are delivery sources installed or reconciled into projects. Tests and inventory must preserve that distinction.

## Repository-local migration and cutover

The completed historical migration maps the frozen `.ralph/plans` inventory to durable Backlog owners while preserving IDs, parents, source content, checked-state evidence, source paths, and Git provenance. This tracking migration does not select a workflow for another repository and does not retire generic compatibility.

Remaining work is split into three ordered slices:

1. **Compatibility preservation and mode resolution.** Preserve the legacy workflow assets and commands, both ownership schemas, hybrid role routing, old active-snapshot fallback, the identity rules above, separate legacy authoring assets, and runtime-versus-delivery-source behavior while completing the task-native workflow.
2. **This repository's status, configuration, and data cutover.** Migrate this repository's remaining task statuses and guidance, remove its active `To Do` use only after proving the data state, and configure this repository to use the task-native workflow without changing generic plugin defaults or another repository's workflow.
3. **This repository's `.ralph/plans` deletion and final validation.** Delete only this repository's tracked plan tree after all live evidence has moved to durable task or documentation surfaces. Final searches require task-native surfaces to reject legacy authority while retained legacy workflow surfaces continue to use it.

The final tree deletion is repository-local. It does not retire the legacy workflow, its generic commands or tools, ownership version 1, or compatibility assets.

## Historical bundle evidence

Every durable historical bundle has one Backlog epic. Exact owners were reused where unambiguous; new epics preserve references where ownership was not one-to-one. Material specification, plan, notes, outcome, criteria state, legacy IDs, source paths, and the frozen provenance commit remain traceable. Successful historical epics may live in `backlog/completed/`; no historical bundle is placed in `backlog/archive/`. The superseded incomplete Phase 3a epic remains completed-but-partial with evidence-based unchecked criteria and bidirectional replacement references.

## Constraints and non-goals

- Preserve operator authority over scope, admission, merge, delay, abandonment, finalization, and destructive cleanup.
- Use supported Backlog and Prime Agent interfaces. Prime Agent remains an upstream dependency.
- Do not add a pickup surface, make every task require an Episode, split one Episode per execute pass, or add task reparenting.
- Do not add cross-checkout task wrappers, branch projections, status-sync protocols, approval blobs or tags, task-native content digests, lifecycle receipts/progress objects, transaction journals, custom merge/archive recovery, custom merge drivers, or another tracker abstraction.
- Do not infer workflow selection from tracker choice, archive-only bundles, active plan placement alone, or missing prompt tags when ownership exists.
- Validate plugin-source changes only through the Docker-isolated candidate path. Never apply a candidate to the installed user-global plugin.
- This specification reconciliation changes no code, asset, template, test, status, configuration, plan placement, or cutover state.

## Migrated bundle authority

The pre-cutover source tree remains available at `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. The task's references, Implementation Plan, Implementation Notes, and Git history preserve the completed migration and repair evidence. This task is the authoritative specification for this repository's remaining cutover work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Project configuration, guidance, and tests expose the ordered statuses `In Design`, `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, and terminal `Done`; default new ordinary tasks to `In Design`; and contain no active workflow that creates or selects `To Do` after migration.
- [x] #2 Fresh and existing-task tests prove `/design` and `/spec-it-out` create or update only `In Design` tasks, persist specification content in supported task fields, and reject later states without planning or implementation authorization.
- [x] #3 `/plan TASK-ID` tests prove only `In Design` and `In Planning` are accepted; the same task receives a meaningful Implementation Plan and becomes or remains `In Planning`; later states are rejected without mutation or Episode creation.
- [x] #4 Task-native admission tests prove `/implement-task TASK-ID` is the sole new-Episode admission command for the task-native workflow and accepts only an `In Planning` task. Structural and semantic tests preserve the proportional plan-readiness gate and reject missing, blank, placeholder-only, contradictory, blocked, or materially unresolved plans before Episode resources or ownership are created.
- [x] #5 Admission tests prove semantic readiness precedes an exact main-task `In Progress` commit; the Episode branch starts from that committed SHA; prompt push failure alone does not block local creation; a proven-clean creation failure returns the task to `In Planning`; and uncertain partial creation marks main `Blocked` without retry.
- [x] #6 End-to-end evidence proves one task spans one Episode across multiple execute, handoff, compaction, review, and revision iterations and retains exact task, owner, branch, worktree, and session identity.
- [x] #7 Ownership tests prove the Episode alone mutates task content on its branch, the Conversation alone mutates lifecycle status on main, the Episode never independently changes status, and ordinary execution performs no cross-checkout content copy, mirroring, or dual write.
- [x] #8 Blocked/resume evidence proves an Episode records blocker content on its branch through existing reporting, the Conversation uses the supported Backlog CLI and exact task-only commits to publish `Blocked` and resumed `In Progress` on main, and the same Episode resumes through ordinary handoff without a new task, admission, or custom block/resume action.
- [x] #9 Final-review evidence proves Expert or Conversation findings can revise the same Episode; after exact pushed candidate acceptance, the Conversation publishes only the bound main task as `Ready for Merge` in an exact task-only commit and push, then uses ordinary Git in the idle Episode to integrate current main while preserving Episode-owned task content and applying that authorized status, pushes and verifies the refreshed candidate, and shows the operator the exact `(taskId, mainHead, candidateHead)`. Delay is a no-op. Request Changes publishes only the bound main task back to `In Progress`, integrates current main into the same Episode as needed, and resumes through ordinary handoff. Immediately before merge the Conversation freshly revalidates the displayed tuple. No lifecycle receipt, task-native content digest, custom status publisher, or reconciliation transaction is required.
- [x] #10 Operator-decision evidence proves authorized merge uses ordinary canonical-main `git merge --ff-only`, a supported Backlog edit to `Done`, an exact task-only commit, and push; Git and Backlog report intermediate failures directly; ownership records and resources remain until a separate explicit cleanup decision; and `backlog task complete` is not invoked per Episode.
- [x] #11 Confirmed-abandonment tests prove strong confirmation precedes mutation; only the exact bound Episode task blob is selected; the effective main diff imports Episode-owned content while preserving Conversation-owned status plus invariant identity/hierarchy metadata; no candidate code is merged; an abandonment Final Summary is recorded; the task is archived without being marked `Done`; and exact archival state is committed and pushed before destructive Episode cleanup.
- [x] #12 Task-native commands, tools, skills, managed templates, initialization/reconciliation assets, ownership version 2 records, docs, recovery, review, handoff, finalization, and tests use exact Backlog task identity and supported fields instead of `.ralph/plans` location or file movement as task-native lifecycle authority.
- [x] #13 A task-status migration fixture proves every pre-cutover `To Do` task with a meaningful Implementation Plan becomes `In Planning`, every `To Do` task without one becomes `In Design`, and existing active, blocked, ready, and done work retains truthful semantics.
- [x] #14 A bundle migration fixture proves each legacy bundle becomes one epic; exact owning tasks are reused when unambiguous; otherwise new epics reference related tickets without changing any existing task ID or parent; specification, plan, notes, outcomes, criteria state, legacy IDs, source paths, and pre-cutover commit provenance remain traceable.
- [x] #15 A representative terminal-history fixture proves completed and accepted-historical bundles become truthful `Done` epics, the superseded incomplete Phase 3a bundle remains explicitly partial with evidence-based unchecked criteria and bidirectional replacement references, one-time successful history may enter `backlog/completed/`, and no existing bundle enters `backlog/archive/`.
- [x] #16 Repository-wide acceptance proves task-native surfaces and this repository's current task-native guidance do not treat `.ralph/plans` as authoritative. Historical provenance remains truthful, and retained legacy workflow surfaces may continue to use legacy bundles where that workflow requires them.
- [x] #17 This repository's final candidate tree contains its completed state migration and task-native workflow and no `.ralph/plans` directory. That repository-local deletion does not retire generic legacy workflow compatibility, assets, commands, tools, ownership parsing, or another initialized repository's bundles.
- [x] #18 Existing tests plus focused Docker-isolated plugin acceptance prove Conversation, operator, Episode, and Expert authority; exact ownership; isolated code worktrees; iteration handoff; recovery; review; prompt-led terminal Git/Backlog actions; post-merge `Done`; and separately authorized exact-resource cleanup remain intact apart from the specified simplification.
- [x] #19 Static and behavioral acceptance proves no pickup surface, Backlog reparenting feature, cross-checkout Backlog wrapper, branch-projection rule, approval commit/blob/tag scheme, task-native content digest, lifecycle receipt/progress/replay protocol, bespoke merge/archive coordinator, transaction journal, Prime Agent patch, or other unapproved scope expansion is introduced.
- [x] #20 The generic plugin retains the project-local legacy workflow assets `project-workflow-plan-prep`, `project-workflow-plan-spec`, `project-workflow-implement-prep`, and `project-workflow-implement-spec`; initialization, reconciliation, inventory, and tests preserve customized instances correctly.
- [x] #21 The legacy workflow retains `/plan-spec`, `/implement-spec`, `plan_spec`, `create_spec_episode`, `handoff_spec_episode`, and `finalize_spec_episode`, with tests covering their current authority and operator gates.
- [x] #22 Compatibility tests retain ownership version 1 parsing and the legacy workflow promotion, recovery, handoff, review, finalization, and cleanup behavior required by existing Episodes.
- [x] #23 Execute, handoff, blocked handling, Expert review, and Conversation oversight route across both workflows, and old active-snapshot fallback remains supported for `.ralph/skills/handoff` and `.ralph/skills/execute`.
- [x] #24 Persisted ownership decides routing before prompt-tag absence: a valid ownership version 1 record selects the legacy workflow, a valid ownership version 2 record selects the task-native workflow, and `<operator-episode-task>` is only a candidate task binding when ownership does not decide.
- [x] #25 Persisted ownership decides first when it exists. With no ownership, active legacy `SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files on canonical main remain a valid old in-place legacy workflow case without a live Prime Claw Episode or ownership version 1 record. This fallback does not make active plan placement proof of live Episode identity; a live ownership version 1 Episode requires persisted version 1 ownership plus active files in that Episode worktree.
- [x] #26 Legacy workflow execute completion wording cannot claim or mutate task-native Backlog lifecycle authority, status, completion, archival, or cleanup decisions.
- [x] #27 Separately named project-local `design-legacy` and `spec-it-out-legacy` assets preserve current-main legacy authoring without mechanically duplicating neutral or shared Markdown.
- [x] #28 Workflow selection remains orthogonal to tracker migration and specification storage: Backlog tracking may coexist with legacy bundles, Beads migration is optional and separate, Beads-only repositories initialize the task-native workflow, and archive-only bundles do not force the legacy workflow.
- [x] #29 Project-local `.prime-claw/workflows` files are tested as runtime surfaces while plugin-root copies remain delivery sources installed or reconciled into projects.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Execution Plan — Task-native Backlog/Ralph lifecycle

> **Authoritative product contract:** Backlog epic `PRIMECLAW-10.38`
>
> **Final old-style admission bundle:** `.ralph/plans/future/replace-ralph-plans-with-backlog`
>
> This is the last plan stored under `.ralph/plans`. Its accepted implementation
> migrates this plan into `PRIMECLAW-10.38` and deletes `.ralph/plans` in the
> candidate tree. Planning does not authorize implementation.

## Implementation boundary

Replace plan-folder identity with one exact Backlog task across design, planning,
Episode admission, execution, handoff, review, completion, and abandonment. Reuse
the current prep/follow-up chain, Orca/local worktree creation, durable Prime
Agent sessions, exact-owner checks, and uncertainty handling. Do not add a
second tracker abstraction, cross-checkout wrapper, status-sync protocol,
replacement digest, transaction journal, custom merge driver, runtime cutover
hook, or Prime Agent change.

The implementation Episode must use the repository-built Backlog candidate for
development and migration commands. Plugin runtime code may invoke the supported
`backlog` CLI from `PATH`; it must not parse or edit task Markdown directly.
Plugin-source validation remains Docker-only and must not apply or probe the
user-global candidate.

## Final old-style admission prerequisite

This migration is admitted through the existing `/implement-spec` path, but its
branch must already start from truthful task state. After the future bundle is
approved and the implementation-readiness review passes, the owning Conversation
must, before calling `create_spec_episode`:

1. update only `PRIMECLAW-10.38` to `In Progress` through the Backlog CLI;
2. commit only the returned task path on main and verify the commit contains no
   other path;
3. attempt a prompt push when the remote is available, without making push
   success a local creation gate; and
4. call the existing Episode-creation tool so its `baseRef` is that exact status
   commit.

The pre-cutover config does not yet admit `In Planning`. If this final old-style
creation fails before any resource or ownership mutation and the failure is
proven clean, restore its exact pre-admission `To Do` state in a task-only
commit; this is a one-time compatibility rollback, not the new product
behavior. If creation is partial or uncertain, set the task `Blocked` with the
exact recovery condition and do not retry it as a new Episode. The implemented
`/implement-task` path must use the specified `In Planning` clean rollback.

## Ordered implementation slices

### 1. Establish task-native lifecycle and reviewed authoring/planning

- Add focused Backlog CLI support in the plugin for resolving an exact task by
  ID and consuming its supported JSON fields. Keep this as a narrow command
  seam for existing lifecycle code and tests, not a parallel task model or a
  Markdown parser.
- Replace folder validation and public reviewed-plan surfaces in
  `src/prime-agent-plugin/extensions/reviewed-plan.ts` and
  `extension-support/reviewed-plan-support.ts` with task identity:
  `/plan TASK-ID`, `plan_task`, `/implement-task TASK-ID`,
  `create_task_episode`, `handoff_task_episode`, and
  `finalize_task_episode`. Preserve the existing
  prep-turn, focused-compaction, sole-follow-up, ephemeral approval, and
  optional exact Orca host-selection behavior.
- Update `backlog/config.yml` to the final ordered statuses `In Design`,
  `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, `Done`, with
  default `In Design`. During the one-time state migration only, temporarily
  retain `To Do` in the uncommitted working configuration until every existing
  task has a truthful replacement status.
- Rewrite the source `design` and `spec-it-out` project templates to create a
  new `In Design` task or update only an explicitly selected task already in
  `In Design`. Store specification narrative, native acceptance criteria,
  constraints, references, and documentation in supported task fields. Reject
  later states and stop for review without planning or implementation.
- Replace plan-prep/plan-spec policy with task-native planning. Native preflight
  accepts only `In Design` or `In Planning`; the semantic turn reloads the task,
  writes a meaningful native Implementation Plan through the CLI, changes or
  retains `In Planning`, commits only that task path, attempts a prompt push,
  links the task for review, and stops. Later states reject without mutation.
- Cover fresh/existing authoring, exact-ID resolution, status matrices, blank or
  placeholder plans, task-only commits, and non-gating push failure in focused
  Node/Python fixtures.

#### Slice 1 progress — Backlog task-resolution foundation (2026-10-13)

Completed the first bounded increment of slice 1:

- added a narrow `backlog task view --json -- <task-id>` command seam that lets
  Backlog normalize supported IDs and binds the canonical returned ID, current
  status, optional Implementation Plan, and contained regular task path;
- kept Backlog as the task model and Markdown owner; plugin code neither parses
  task Markdown nor introduces a second tracker abstraction;
- added focused fixtures for canonical shorthand resolution, exact argv/CWD,
  supported JSON fields, unsafe selection, command failure, malformed JSON, and
  escaped task paths;
- documented the seam and its intentionally deferred activation boundary; and
- passed focused host-safe policy checks plus source-mode
  `scripts/test-tier1.sh --probe`, with evidence at
  `.test-results/20261013T060350Z-97903-65a8f369/tier1`.

#### Slice 1 progress — staged task-native planning policy (2026-10-13)

Completed the next bounded increment of slice 1:

- added inert `plan-task-prep` and `plan-task` workflow assets under new names,
  leaving the working `/plan-spec` command and folder workflows unchanged;
- encoded exact task/status checks, compact-first sole-follow-up behavior,
  proportional semantic readiness, native Implementation Plan mutation, exact
  task-only commits, non-gating push evidence, and the operator review stop;
- reconciled source and builder-project copies through the asset inventory and
  template manifest without registering any public command;
- made project-asset `migrateFrom` optional in both inventory consumers so a new
  asset with no truthful predecessor does not invent migration provenance;
- added direct inventory-loader, fresh reconciliation, managed-copy, and dynamic
  documentation coverage; and
- passed 19 focused host-safe checks plus source-mode
  `scripts/test-tier1.sh --probe`, with evidence at
  `.test-results/20261013T062411Z-55643-de31915d/tier1`.

#### Slice 1 progress — additive task-native planning activation (2026-10-13)

Completed the next bounded increment of slice 1:

- exposed `/plan TASK-ID` and structured `plan_task({"taskId":"TASK-ID"})`
  while preserving `/plan-spec`, `plan_spec`, and implementation admission;
- resolved operator input through Backlog, admitted only exact `In Design` or
  `In Planning`, and passed the canonical returned task ID into both preloaded
  workflows;
- reused the compact-first two-message chain without changing native ordinary
  delivery, tool `steer` delivery, sole `followUp`, or uncertain-send behavior;
- staged `In Design` and `In Planning` in Backlog configuration while retaining
  `To Do` as the temporary default and selectable pre-migration state;
- updated current planning docs, story traceability, command/tool discovery,
  status matrices, and folder-compatibility regressions; and
- passed 17 focused Node behavior tests, 29 host-safe checks, independent review
  with no material findings, and source-mode `scripts/test-tier1.sh --probe`,
  with final evidence at
  `.test-results/20261013T063848Z-99892-f5ef0597/tier1`.

#### Slice 1 progress — task-native specification authoring (2026-10-13)

Completed the next bounded increment of slice 1:

- converted the managed `design` and `spec-it-out` skills from new future-folder
  artifacts to one new explicit `In Design` task or one exact selected existing
  task already in `In Design`, while preserving their distinct discovery modes;
- made Description, native Acceptance Criteria, References, and Documentation
  the living specification fields and prohibited Implementation Plan, notes,
  final-summary, status, and Episode mutation during authoring;
- rejected later lifecycle states without mutation, required clarification when
  new-versus-existing intent is ambiguous, and made an uncertain create a
  fail-closed no-blind-retry result;
- required canonical reload/path verification, exact task-only commits, prompt
  non-gating pushes, and an explicit operator specification-review stop;
- updated required orientation and operator docs so new authoring is task-native
  while `/plan-spec`, `/implement-spec`, and existing folder Episodes remain a
  bounded compatibility path;
- added a disposable Backlog/Git fixture that executes fresh creation, existing
  revision, native field preservation, exact path binding, task-only commits in
  a dirty worktree, and non-gating push failure; and
- passed 22 focused host-safe checks, independent review with all findings
  repaired, and source-mode `scripts/test-tier1.sh --probe`, with final evidence
  at `.test-results/20261013T065752Z-55162-273d77d8/tier1`.

#### Slice 1 progress — staged task-native Episode-admission policy (2026-10-13)

Completed the next bounded increment of slice 1:

- added inert project-customizable `implement-task-prep` and `implement-task`
  workflow assets without registering `/implement-task` or
  `create_task_episode` before their trusted mechanics exist;
- encoded exact canonical task binding, structural `In Planning` plus meaningful
  plan checks, proportional semantic readiness, and one exact tool-call boundary;
- specified the trusted order as exact main-task `In Progress` commit, durable
  `provisioning` ownership reservation, then branch/worktree/session creation
  from the recorded status-commit SHA;
- preserved best-effort push semantics, clean pre-resource rollback to `In
  Planning`, and partial/uncertain `Blocked` outcomes without fresh replay;
- reconciled source and builder-project copies through the inventory and
  manifest while keeping retained `/implement-spec` assets and behavior live;
- updated project initialization and Episode-promotion documentation and added
  focused policy, non-activation, ordering, and fresh-reconciliation coverage;
  and
- passed 28 focused Node reconciliation tests, 23 host-safe Python checks with
  3 container cases deselected, independent review after repairing one
  provisioning-order defect, and source-mode `scripts/test-tier1.sh --probe`,
  with final evidence at
  `.test-results/20261013T071323Z-8630-3272b5af/tier1`.

#### Slice 2 progress — task-native ownership reservation foundation (2026-10-13)

Completed the first bounded increment of slice 2 without activating public
admission:

- added a strict version-2 ownership identity containing the canonical Backlog
  task ID and project-relative task path while retaining disjoint version-1
  folder identity for existing Episodes;
- added an internal `reserveTaskEpisodeOwnership` boundary that re-resolves the
  exact canonical task, requires committed `In Progress` plus a meaningful
  native plan, and proves HEAD contains only that clean task path;
- made the first task-native write a minimal `provisioning` reservation bound to
  the status-commit SHA, with no branch, worktree name/identity, session, or
  assignment identity and no arbitrary fields that could become shadow
  lifecycle authority;
- blocked every non-terminal ownership replay, preserved existing inactive
  replacement behavior, taught Conversation compaction to retain either
  identity, and made retained folder admission/close reject task-native
  ownership rather than misinterpret it;
- kept `/implement-task`, `create_task_episode`, and task-native allocation
  unregistered and preserved existing `/implement-spec` creation behavior;
- added executable Git fixtures for exact task re-resolution, status/plan gates,
  task-only HEAD commits, post-commit cleanliness, strict schema separation,
  replay rejection, Orca placement binding, and absence of resource identities;
  and
- passed 97 focused Node tests, 18 host-safe Python checks with 10 container
  cases deselected, independent review after repairing strict-field,
  placeholder-plan, and premature-worktree-name defects, and source-mode
  `scripts/test-tier1.sh --probe`, with final evidence at
  `.test-results/20261013T074625Z-51506-443b013a/tier1`.

#### Slice 2 progress — task-native allocation after reservation (2026-10-13)

Completed the next bounded slice-2 increment without activating public
admission:

- added an internal allocator that accepts only the exact version-2 task/owner
  reservation and derives non-authoritative branch/worktree/session labels from
  the canonical task ID;
- made local and exact reserved local-Orca worktrees start from the bound
  task-only status-commit SHA, with no bundle copy, plan promotion, or promotion
  commit;
- bound one durable exact-CWD Prime Agent session, retained the visible Orca tab
  behavior, and injected the exact task ID into one execute assignment;
- made active replay validate worktree, provider, durable session ID/file, and
  exact session CWD, reopening the same session when needed without replaying
  allocation or assignment;
- changed partial provisioning and all post-reservation allocation failures to
  durable `uncertain` ownership that cannot replay as fresh allocation, while
  leaving later Conversation-owned `Blocked` publication unwired;
- kept `/implement-task` and `create_task_episode` unregistered and preserved
  the complete version-1 folder allocator and public compatibility path; and
- passed 106 focused Node tests, 36 host-safe Python checks with 10 container
  cases deselected, independent review after repairing a foreign-session-CWD
  replay defect, and source-mode `scripts/test-tier1.sh --probe`, with final
  evidence at `.test-results/20261013T081542Z-76164-4158db63/tier1`.

#### Slice 2 progress — trusted task-native admission transaction (2026-10-13)

Completed the next bounded slice-2 increment without activating public
admission:

- added an internal transaction that accepts only the exact clean `In Planning`
  task with a meaningful native plan and no non-terminal project ownership;
- changed the task to `In Progress` through supported Backlog CLI, committed
  only its canonical path, and treated push failure as non-gating evidence;
- reserved ownership against that exact status-commit SHA, called the existing
  allocator, and verified strict durable active identity plus unchanged main
  task status, HEAD, and path cleanliness before returning success;
- made a proven clean failure before ownership/resource mutation publish one
  exact task-only rollback commit to `In Planning`;
- made every recorded, partial, uncertain, or missing-active-postcondition
  outcome publish `Blocked` plus a precise `.prime-claw/ownership.json`
  reconciliation condition, retain all evidence/resources, and reject fresh
  replay;
- kept `/implement-task` and `create_task_episode` unregistered and preserved
  the version-1 folder admission path unchanged; and
- passed 113 focused Node tests, 36 host-safe Python checks with 10 container
  cases deselected, independent review with no material findings, and
  source-mode `scripts/test-tier1.sh --probe`, with final evidence at
  `.test-results/20261013T090020Z-68646-c18d94ca/tier1`.

#### Slice 2 repair — canonical primary-main admission boundary (2026-10-13)

Completed the operator-accepted repair without activating public admission:

- `createTaskEpisode` now proves the caller is at the repository root of the
  primary Git worktree on `main` before task lookup or any mutation;
- linked worktrees and a primary checkout on another branch fail before Backlog
  edit, commit, ownership read/write, reservation, or allocation;
- a disposable linked worktree on `main` carries an eligible `In Planning` task
  and no ownership record, and proves unchanged task bytes, HEAD, worktree
  status, primary-checkout state, ownership, reservation count, and allocator
  count; and
- the accepted admission transaction, retained folder compatibility, and
  inactive `/implement-task` / `create_task_episode` surface remain unchanged.

Validation passed 114 focused Node tests, 36 host-safe Python checks with 10
container cases deselected, independent review with no material findings, and
source-mode `scripts/test-tier1.sh --probe`, with final evidence at
`.test-results/20261013T091936Z-61769-1fbb9755/tier1`.

#### Slice 3 progress — task-native execute policy (2026-10-13)

Staged the task-bound Episode execution contract without activating public
admission:

- an execute assignment carrying `<operator-episode-task>` now reloads that
  exact Backlog task and rejects changed identity, path, parent, or non-
  `In Progress` status rather than selecting replacement work;
- the task specification fields, Implementation Plan, Implementation Notes,
  acceptance evidence, references, documentation, modified files, and Final
  Summary are the sole durable authority in task-native mode;
- Episode-owned content changes use supported Backlog CLI operations only in
  the Episode worktree, while lifecycle status stays Conversation-owned on
  main with no `--status`, completion, archive, cross-checkout copy, mirroring,
  or dual write;
- blocked passes must commit and push their exact durable blocker checkpoint
  before reporting, and candidate passes likewise leave status unchanged and
  report a pushed reviewable commit; and
- assignments without a task block retain the complete folder-plan execute
  workflow for existing `/implement-spec` Episodes. Source, tracked project
  asset, and managed-template hashes remain synchronized.

A disposable Backlog fixture proves supported plan/note/criterion/modified-file
updates preserve canonical ID, task path, parent, `In Progress` status, and an
unrelated dirty path while allowing an exact task commit. Independent review
found and the final policy repaired the missing blocked-pass commit/push gate;
repair review found no remaining material defect. Validation passed 40
host-safe Python checks with 9 deselected, 70 focused Node tests,
`git diff --check`, and source-mode `scripts/test-tier1.sh --probe`, with final
evidence at `.test-results/20261013T094041Z-49232-6f8646b6/tier1`.

#### Slice 3 progress — inactive task-native continuation (2026-10-13)

Added the internal task-native handoff transport and dual-mode handoff policy
without registering a public task admission, handoff, or finalization surface:

- `handoffTaskEpisode` accepts only the exact top-level owner in the canonical
  primary `main` checkout with strict active version-2 ownership;
- main and the Episode worktree must resolve the same bound task ID/path, both
  remain `In Progress` with meaningful plans, and the owned Episode worktree
  must be clean with matching Git and optional Orca identity;
- the durable session must match its recorded ID/file and exact owned worktree
  CWD, and the route must be fully quiescent before delivery;
- canonical handoff and its sole execute follow-up both carry the same
  `<operator-episode-task>` binding, guidance appears only in handoff, route
  reopen may refresh only active routing identity, and no resource is created
  or replaced; and
- task-mode handoff uses supported Backlog task fields only, never status or
  `.ralph/plans`, while no-block handoff and `handoffSpecEpisode` retain the
  complete folder workflow. Source/project copies and template hashes match.

The seam rejects `Blocked` until the Conversation has truthfully published a
resumed `In Progress` state and rejects `Ready for Merge` until the constrained
final-integration handshake exists. It also rejects identity/path/plan drift,
non-active ownership, dirty worktrees, foreign session CWD, and noncanonical
caller checkout before delivery. Independent review found no material defect.
Validation passed 41 host-safe Python checks with 11 deselected, 115 focused
Node tests, `git diff --check`, and source-mode
`scripts/test-tier1.sh --probe`, with final evidence at
`.test-results/20261013T100557Z-41220-9a097e6b/tier1`.

#### Completed follow-up repair after b1f49bf (2026-10-13)

Repaired the accepted continuation preflight defect before public activation.
After resolving and matching the exact main task, `handoffTaskEpisode` now runs
path-scoped Git status for only the recorded task path and requires it to match
committed `HEAD` before status/plan acceptance, route reopen, ownership refresh,
handoff, or execute delivery. Unrelated dirty main paths remain allowed.

The regression commits a `Blocked` task, changes only its working-tree bytes to
`In Progress`, proves the committed and working views differ, and verifies zero
reopen, ownership refresh, handoff, or execute delivery. A companion regression
proves unrelated main dirt still permits valid continuation. The repair
preserves the accepted task-native transport, folder compatibility, and
inactive public task surfaces. Independent review found no material defect.
Validation passed 50 focused Node tests, 23 focused host-safe Python checks with
2 deselected, 117 broad Node tests, 41 broad host-safe Python checks with 11
deselected, `git diff --check`, and source-mode
`scripts/test-tier1.sh --probe`; final Docker evidence is at
`.test-results/20261013T102307Z-99098-156da715/tier1`.

Slices 1 through 3 remain open. Public `/implement-task`,
`create_task_episode`, and task-native handoff/finalization remain inactive.
Task-native placement/approval wiring, Conversation-owned Blocked/resume status
publication, oversight/Expert task authority, Ready-for-Merge integration,
operator decision outcomes, finalization/abandonment, retained real-session
evidence, and final lifecycle/default migration remain later increments.
Acceptance criteria #2, #3, #6, #7, and #8 remain unchecked until their
real-session or end-to-end semantic paths are retained; this inactive
continuation slice alone completes no criterion.

#### Slice 3 progress — task-native oversight and Expert authority (2026-10-13)

Converted the managed Conversation and Expert review policies to select one
disjoint durable authority from ownership. Version 2 binds the exact Backlog
task ID/path, supported task fields, parent identity, and candidate commit;
Conversation supervision and independent review never consult `.ralph/plans`,
do not substitute a related task, and do not copy or mirror Episode-owned task
content. Version 1 retains its exact approved specification/plan folder.

The Conversation guide remains judgment-only and preserves the four bounded
dispositions, recorded acceptance evidence, canonical exact-owner handoff,
non-adversarial review boundary, goals/heartbeat discipline, and operator-only
product/merge/abandonment/cleanup authority. The Expert workflow retains native
RLM bootstrap/message/observe/delete mechanics and now sends the selected
exact-task or exact-folder contract to the read-only reviewer. Static policy and
managed-protocol tests cover both modes, and the existing compaction hook still
reinjects the complete guide only for the exact active owner.

This is a policy-only dependency slice. It registers no task-native command or
tool, changes no lifecycle state, and leaves public task admission, handoff, and
finalization inactive. Conversation-owned `Blocked`/resume publication,
`Ready for Merge` integration, operator decision mechanics, retained native
receipts, and final migration remain later work. No acceptance criterion is
newly claimed by this staged policy.

Validation passed 6 focused policy checks, 31 broad host-safe Python checks with
43 container cases deselected, 56 broad Node checks, and `git diff --check`.
The dependency audit endorsed this as the smallest coherent next slice, the
independent bounded diff review found no material defects, and source-mode
`scripts/test-tier1.sh --probe` passed with immutable-image, offline-RPC,
teardown, and manifest evidence at
`.test-results/20261013T103834Z-65715-7dcc0310/tier1`.

#### Slice 3 progress — inactive task placement and ephemeral approval (2026-10-13)

Staged the deterministic task-native compact-first admission seam without
registering `/implement-task` or `create_task_episode`. Before either workflow
message, it resolves the exact `In Planning` task and selects one exact ready
local Orca setup: a sole setup, explicit stable ID, or native picker result.
Zero ready setups, remote placement, noninteractive ambiguity, cancellation,
and other inventory errors fail before queueing. Direct local fallback is
allowed only when the production Orca command is definitively absent and no
explicit setup was requested; malformed or negative inventory fails closed.
Placement selection performs no task, Git, ownership, worktree, session, or
other resource mutation.

Only after placement and both workflow messages succeed does the seam grant one
in-memory approval bound to the owner session, canonical task ID/path and
project root, and exact placement. The prep-turn end exposes it to the semantic
turn; exact identity is required, one consume removes it, and phase end,
session start, or shutdown clears it. The full ordinary oversight guide is
prepended to `implement-task` semantic readiness. Retained folder admission and
all currently registered public surfaces remain unchanged.

This slice connects no approval consumer to the trusted task-creation
transaction and changes no lifecycle state. Conversation-owned `Blocked`/resume
publication, `Ready for Merge` integration, operator outcomes, task-native
close/abandonment, coordinated public activation, retained native receipts, and
final migration remain later work. No acceptance criterion is newly claimed.

Focused validation passed 32 Node tests. Broad validation passed 107 Node tests
and 43 host-safe Python checks with 43 container cases deselected, plus
`git diff --check`. Independent review identified an overbroad production Orca
fallback classification: retained inventory translated malformed and negative
responses into `OrcaUnavailableError`. The accepted repair added a strict
Task-placement inventory path that falls back only for process `ENOENT`, leaves
retained behavior unchanged, and proves malformed/negative responses fail.
Repair rereview found no material defects. Source-mode
`scripts/test-tier1.sh --probe` passed with immutable-image, offline-RPC,
teardown, and manifest evidence at
`.test-results/20261013T110322Z-62776-06322ace/tier1`.

#### Slice 3 progress — inactive task-native Blocked publication and resume (2026-10-13)

Staged Conversation-owned blocker status publication without registering any
public task-native lifecycle surface. The Episode must remain `In Progress`,
commit its exact task evidence after admission, push the exact reported branch
head, and leave its worktree clean. The status seam then proves exact active
version-2 ownership, the owning persisted top-level Conversation, canonical
primary `main`, matching task identity/path and meaningful plans in both
checkouts, committed main task bytes, and the exact local/upstream Episode head.
Only then may it use Backlog to commit the exact main task path from `In
Progress` to `Blocked`. An accepted unblock repeats the same proof and commits
only that path from `Blocked` to `In Progress`; each main push is best effort and
its failure is returned as evidence after the authoritative local commit.
Unrelated main dirt remains allowed and no Episode-owned content crosses
checkouts.

The existing task handoff then revalidates the committed resumed main state and
continues the same ownership, branch, worktree, and session without a new task,
admission, resource, or assignment. The managed blocked skill is now dual-mode:
it selects durable ownership before prompt text, so active version-2 ownership
forces task mode for the exact owner Conversation even without a task block,
while an Episode/foreign owner or mismatched candidate block fails closed.
Only the absence of version-2 ownership and a task block permits the retained
`.ralph/plans/blocked` restoration workflow. Source and tracked skill bytes plus
managed hashes remain aligned.
Public `/implement-task`, `create_task_episode`, task lifecycle/handoff, and
finalization surfaces remain inactive. `Ready for Merge`, operator outcomes,
task-native close/abandonment, coordinated activation, retained native receipts,
and final migration remain later work. No acceptance criterion is newly
claimed.

Initial focused validation passed 70 Node tests and 32 host-safe Python checks
with 3 container cases deselected, plus `git diff --check`. Independent review
then found that a discoverable owner-Conversation invocation without a task block
could incorrectly enter retained folder mode. The accepted repair added the
deterministic ownership-first resolver described above and a behavioral
owner-versus-Episode routing fixture. Repair-focused validation passed 71 Node
tests and the same 32 Python checks. Final broad validation passed 144 Node
tests and 55 host-safe Python checks with 45 container cases deselected, plus
`git diff --check`. Repair rereview found no material defects. Source-mode
`scripts/test-tier1.sh --probe` passed with immutable-image, offline-RPC,
teardown, and manifest evidence at
`.test-results/20261013T112716Z-81931-e0b2a21c/tier1`.

#### Slice 4 progress — inactive Ready-for-Merge integration handshake (2026-10-13)

Staged the final-review handshake without registering a public task-native
surface or implementing operator outcomes. From an accepted exact pushed
candidate, only the exact persisted top-level owner in canonical primary
`main` may publish `Ready for Merge`. The status mutation reuses the existing
ownership and candidate guards, commits only the clean exact task path, and
returns best-effort push failure as evidence after the authoritative local
commit. A supported task-view snapshot binds the accepted task path, parent,
and all Episode-owned fields; lifecycle status, volatile update time, and derived readiness,
dependency-graph, subtask, and acceptance-count projections are excluded from
its digest while their owning supported fields remain bound.

The same active durable Episode must be clean and idle at its exact recorded
worktree/session. It integrates current main without handoff, admission, or
resource creation. Merge conflicts outside the exact task abort. Within the
Episode worktree, the accepted task is restored from the Episode parent and
Backlog reapplies only `Ready for Merge`; the content digest and parent must
remain exact. The resulting commit must have exactly the accepted candidate and
current main as its parents, and its branch is pushed. Conversation verification
then requires main not to have advanced, the exact refreshed local/upstream
head, clean state, both parents and ancestry, unchanged task content/path/parent,
and `Ready for Merge` in both checkouts. Until that succeeds, policy forbids
calling the candidate ready or requesting merge authorization. Ordinary handoff
continues to reject `Ready for Merge`.

The handshake remains deliberately inactive. Delay, requested changes, merge,
`Done`, abandonment, finalization, cleanup, coordinated activation, retained
native receipts, and migration remain later work. No acceptance criterion is
newly claimed; AC #8/#9 still require retained end-to-end and refreshed-candidate
evidence.

Focused validation passed 80 Node tests and 18 host-safe Python checks with 3
container cases deselected, plus `git diff --check`. Final broad validation
passed 153 Node tests and 59 host-safe Python checks with 45 container cases
deselected, plus `git diff --check`. Independent review found no material
defects. Source-mode `scripts/test-tier1.sh --probe` passed with immutable-image,
offline-RPC, teardown, and manifest evidence at
`.test-results/20261013T115543Z-40109-e5bf6466/tier1`.

#### Slice 5 progress — inactive reversible operator outcomes (2026-10-13)

Staged only Delay and Request Changes behind the unregistered task-native review
boundary. Delay takes an explicit operator decision, re-verifies the exact
Ready-for-Merge publication/integration/verification evidence and current idle
Episode, then returns `delayed` without status mutation, merge, push, handoff, or
other transport. It retains main `Ready for Merge`, the exact refreshed
candidate, ownership, branch, worktree, session, and resources; it is never
abandonment.

Request Changes also requires an explicit operator decision and the still-current
verified handshake. Its phases are deliberately separate. The publication phase
commits only the exact main task back to `In Progress` with best-effort push.
The integration phase requires that returned commit, the same active clean idle
Episode and exact previous refreshed upstream head; it merges current main,
restores Episode-owned content, applies only `In Progress` through Backlog,
preserves the content digest/path/parent, creates an exact two-parent commit, and
pushes it. Verification requires current main, exact local/upstream head,
parents/ancestry, task content/hierarchy, and status. Only the resume phase then
calls canonical task handoff. This separation permits retrying integration after
a bounded failure without repeating the status transition or creating an
admission, resource, assignment, branch, worktree, session, or journal.

No merge authorization, merge, `Done`, abandonment, finalization, cleanup,
public activation, or migration mechanic is included. Initial focused
validation passed 76 Node tests and 11 host-safe Python checks. Independent
review found one material retry defect after a merge commit whose Episode push
failed. The accepted repair recognizes only an exact clean existing two-parent
candidate, retries or confirms only its idempotent push, and never repeats the
status transition, merge, admission, resource, or assignment. Repair-focused
validation passed 78 Node tests and 4 policy checks; rereview found no material
defects. Final broad validation passed 163 Node tests and 59 host-safe Python
checks with 45 container cases deselected, plus `git diff --check`. Source-mode
`scripts/test-tier1.sh --probe` passed with immutable-image, offline-RPC,
teardown, and manifest evidence at
`.test-results/20261013T122422Z-16240-2b8e093d/tier1`. No acceptance criterion is
newly claimed; AC #8/#9 still require retained end-to-end, refreshed-candidate,
and operator-outcome receipts.

#### Slice 6 progress — inactive exact Merge and `Done` publication (2026-10-13)

Staged the terminal accepted-candidate outcome without registering a public
surface or merging this live Episode. `mergeTaskEpisodeReadyForMerge` requires
an explicit operator Merge decision bound to the still-current exact task,
verified canonical-main head, and pushed refreshed candidate. It revalidates the
exact owner, active ownership, idle durable Episode and Orca identity, candidate
status/content/path/parent, two-parent ancestry, the Ready publication commit in
verified main history, clean canonical primary `main`, and exact upstream state.
It then fast-forwards only to that candidate; there is no force, rebase, or
substitute merge. Backlog immediately changes only the exact task to `Done`, the
resulting one-path commit must directly parent the candidate, and final checks
prove merged code, task digest/path/parent/status, and retained ownership,
branch, worktree, durable session, and resources. The verified local `Done`
commit is authoritative; push, upstream lookup, or observed-remote mismatch is
returned as best-effort transport evidence.

The journal-free replay boundary accepts only four exact states: original main
plus `Ready for Merge`, the candidate plus `Ready for Merge`, that candidate
with only the bound task dirty or staged as exact `Done`, or one exact task-only
`Done` child. It completes the missing fast-forward, task commit, verification,
or push without duplicating lifecycle mutation. Extra paths, rename/delete or
untracked state, wrong task status/content/hierarchy, stale ancestry, stale
main, or unpushed candidate fail closed. Production porcelain parsing uses raw
NUL-delimited Git output so leading status columns remain intact; a disposable
repository test covers clean, unstaged, staged, mixed staged/unstaged, extra,
untracked, and renamed states.

Independent review found four material defects across successive passes:
post-fast-forward replay, post-`Done` transport verification, the dirty/staged
mutation window plus missing Ready-publication ancestry, and production raw-Git
parsing. Each finding was accepted and repaired with focused recovery and
negative tests. Final rereview found no material defects. Focused validation
passed 101 Node tests and 4 policy checks. Final broad validation passed 186
Node tests and 59 host-safe Python checks with 45 container cases deselected,
plus `git diff --check`. Source-mode `scripts/test-tier1.sh --probe` passed with
immutable-image, offline-RPC, teardown, and manifest evidence at
`.test-results/20261013T130723Z-39269-445a6588/tier1`.

No actual merge or live `Done` transition was performed. No abandonment,
finalization, cleanup, public activation, or migration mechanic is included. No
acceptance criterion is newly claimed; AC #8/#9 still require retained
end-to-end, refreshed-candidate, and operator-outcome receipts.

#### Slice 7 progress — inactive confirmed abandonment (2026-10-13)

Staged the explicit non-success terminal outcome without registering a public
tool or abandoning this live Episode. `abandonTaskEpisode` requires explicit
operator confirmation bound to the exact active owner, project-relative task
path, canonical-main head and captured non-`Done` status, pushed idle Episode
head, candidate/main relationship, invariant parent, Episode-content digest,
and normalized truthful Final Summary. Canonical main/upstream and the Episode
head/upstream must remain exact. Before any main mutation, active and completed
Backlog task records are resolved through supported structured task view and
checked for inbound dependencies or exact task references whose archive cleanup
would rewrite another task. Comparison follows Backlog task-ID identity for
case, optional dependency prefixes, required reference prefixes, dotted numeric
segments, leading zeroes, and surrounding whitespace.

Git selects only the exact Episode task blob; Episode code is never integrated.
Supported Backlog edit reapplies the captured Conversation lifecycle status and
Final Summary. Structured semantic checks and a normalized task-file digest
prove that every Episode-owned field is retained while excluding only path,
lifecycle/update metadata, and the Conversation-owned abandonment summary.
After creating the otherwise-untracked canonical `backlog/archive/tasks`
directory, the supported Backlog archive command moves the task without `Done`.
The effective worktree state must be exactly the active deletion and archive
addition/staged rename; a direct two-path child is committed and verified.
Archived tasks are intentionally not resolvable through `task view`, so
post-archive verification uses the regular archived file, normalized digest,
exact Git paths/parent, clean worktree, and unchanged active ownership/resources
rather than inventing archived-task resolution. Local verified archival state is
authoritative; push or remote-verification failure is returned as transport
evidence. Journal-free replay accepts only exact task preparation, archive
move/stage, or direct archival child and rejects stale, dirty, ambiguous,
mismatched, and cross-path states. Cleanup remains separately authorized.

Actual vendored-CLI fixtures prove missing-directory behavior, archive
visibility semantics, exact byte movement, active dependency and completed
reference preflight, and alias spellings `PRIMECLAW-01`, `primeclaw-1`, and
whitespace-normalized references. A real Git fixture proves task-only blob
selection and archival commit while Episode code remains absent. Independent
review found five material defects across its passes: impossible archived-task
lookup, missing archive directory, path-sensitive digest, inbound-link cleanup,
and alias identity mismatch. All were accepted and repaired; final rereview
found no material findings. Focused validation passed 118 Node tests and 4
policy checks. Final broad validation passed 203 Node tests and 59 host-safe
Python checks with 45 container cases deselected, plus `git diff --check`.
Source-mode Docker Tier-1 passed with immutable-image, offline-RPC, teardown, and
manifest evidence at `.test-results/20261013T140634Z-37005-1a3b77c9/tier1`.

An accepted in-scope follow-up revision remains for the next execute pass. Before
any canonical-main task restore, Backlog edit, or archive mutation, compute the
exact archive destination and fail closed when it already exists from tracked
history. Backlog deliberately reuses archived IDs, and a same-ID/same-title
archive currently succeeds by replacing the historical file, leaving active
`D` plus archive `M` only after mutation. Preserve the already-authorized exact
task-preparation, archive-move/stage, and committed-child recovery states, where
the destination is expected as part of the partial state. Add a clean-Git real
vendored-CLI regression proving collision rejection occurs before mutation,
historical archive bytes remain exact, the active task remains present, and
main remains clean. Keep the repair inside Prime Claw; do not patch Backlog or
add recovery machinery.

The accepted follow-up is now implemented. `TaskEpisodeAbandonmentGit` exposes
an exact tracked-path-at-ref query. The CLI adapter reads raw NUL-delimited
`git ls-tree -z --name-only` output so Git path quoting cannot hide Unicode
archive names. `abandonTaskEpisode` computes the canonical destination and
rejects it when tracked at the bound main head before cleanup preflight, main
state classification, task selection, Backlog edit, or archive. Checking the
bound head preserves the authorized preparation, move/stage, and direct-child
recovery states because their destination was absent from that history.

The real vendored-CLI clean-Git regression archives `PRIMECLAW-1`, commits the
historical bytes, reuses the ID with the same Unicode title `Reusable Café`,
commits the active task, and proves the production guard rejects with historical
bytes unchanged, the active task present, and main clean. Unit evidence proves
the check precedes every mutation and collision runs no select/edit/archive or
commit action. Independent review identified one material `core.quotePath`
Unicode bypass in the initial implementation; raw `-z` parsing repaired it and
final rereview found no material findings. Final validation passed 119 focused
Node tests and 4 policy checks, 204 broad Node tests and 59 host-safe Python
checks with 45 container cases deselected, `git diff --check`, and source-mode
Docker Tier-1 with immutable-image, offline-RPC, teardown, and manifest evidence
at `.test-results/20261013T143741Z-33220-7f0043db/tier1`.

No actual abandonment, status change, archive, finalization, cleanup, public
activation, or migration occurred. No acceptance criterion is newly claimed;
AC #8/#9 still require retained end-to-end and operator-outcome receipts.

#### Slice 8 progress — inactive task-native finalization and cleanup (2026-10-13)

Implemented the internal `finalizeTaskEpisodeCleanup` coordinator without
registering a task-native tool or host cleanup adapter. A separate explicit
Cleanup decision binds the exact task/path, owner Conversation, terminal Episode
head/outcome/commit, durable session and route, worktree/branch, and every
optional local or Orca resource. Before deletion it re-verifies canonical main
and upstream plus either the pushed one-task Merge/`Done` child or the pushed
non-`Done` Abandon/archive child. Abandonment results now retain the verified
archived-file digest for this terminal proof.

Resource inspection accepts only the exact monotonic states: all present,
runtime absent, worktree absent, or all absent. The injected host adapter removes
only the exact idle runtime, worktree, and branch in that order, verifying each
boundary; exact worktree removal may also remove its exact branch. Ownership
remains active across interrupted removal and changes to inactive only after all
resources are absent. Exact prefix retry and inactive replay are idempotent.
Busy, dirty, foreign, mixed-outcome, unpushed, identity-drifted, unsafe-gap,
provisioning, and uncertain states fail closed.

Independent review found two material defects. First, cleanup incorrectly bound
the terminal branch head to the stale allocation-time ownership head; the repair
binds the explicit terminal Episode head, proves it descends from the owned
admission base while resources exist, and uses it for branch/worktree identity.
Second, all-absent abandonment replay required the deliberately deleted Episode
ref; the repair skips only that no-longer-possible ancestry check at stage 3
while retaining all canonical-main terminal proofs. Final rereview found no
material findings.

Final validation passed 132 focused task-native Node tests, 4 retained close
tests, and 4 oversight policy checks; 217 broad Node tests and 59 host-safe
Python checks with 45 container cases deselected; `git diff --check`; and
source-mode Docker Tier-1 with immutable-image, offline-RPC, teardown, and
manifest evidence at `.test-results/20261013T153144Z-87272-78cdefce/tier1`.

No actual finalization, resource deletion, abandonment, merge, status change,
public activation, host-adapter registration, migration, or acceptance-criterion
claim occurred. The live Episode ownership and resources remain unchanged.

The operator accepted checkpoint
`e3266cafb426c291579c6206c5e987e466d4e160`, including the complete inactive
task-native lifecycle mechanics through finalization and cleanup. The next
bounded execute pass is the already-approved coherent task-native public
activation plus its required host cleanup adapter. Preserve retained folder
compatibility until final migration/cutover, exact task/Episode ownership,
operator authority for merge, abandonment, and destructive cleanup, supported
Prime Agent and Backlog interfaces, Docker-only plugin validation, and no
unrelated scope.

#### Slice 9 progress — public task-native activation and production cleanup host (2026-10-13)

Activated the complete guarded task-native surface beside retained folder
compatibility: `/implement-task`, `create_task_episode`,
`handoff_task_episode`, and the single `finalize_task_episode` lifecycle
coordinator. Creation consumes one exact post-preparation approval and its bound
placement once. Ordinary handoff remains disjoint from blocker, final-review,
operator-outcome, abandonment, and cleanup boundaries.

The lifecycle coordinator exposes Block, Resume, Accept Candidate, Delay,
Request Changes, Merge, Abandon, and Cleanup without exposing internal phase
ordering. It returns exact publication, integration, Ready, changes, and
terminal receipts; exact partial receipts resume completed phases without
repeating lifecycle mutations. Delay and Request Changes require explicit
operator decisions, as do Merge and Abandon. Cleanup requires a separate
explicit decision and exact Merge or Abandon terminal evidence. Integration
push errors replay only the existing merge head, unpushed abandonment reuses
its original decision, and admitted or uncertain handoff transport is never
reported as retryable.

Added the production cleanup adapter over supported Prime Agent daemon, Orca
CLI, and Git interfaces. It rejects foreign/duplicate sessions, route/file/CWD
drift, untracked saved-session files, dirty or changed worktrees, moved branch
heads, unsafe resource gaps, malformed/unavailable inventory, and later Orca
terminals. Task-native Orca activation now inventories every retained terminal,
including its fallback/default and primary Prime terminals. Cleanup deletes the
exact idle Prime session first, then uses exact non-force Orca worktree removal
so Orca must prove all bound PTYs stopped; local cleanup rechecks path, head,
branch, and cleanliness at each mutation edge. The owned daemon connection is
closed after every action.

Independent architecture and cleanup reviews found material retry, authority,
session-collision, mutation-edge, daemon-lifetime, and normal Orca-topology
defects. Every finding was repaired and both final rereviews reported no
material findings. Retained `/plan-spec`, `/implement-spec`, `plan_spec`,
`create_spec_episode`, `handoff_spec_episode`, and `finalize_spec_episode`
remain active until explicit final migration/cutover.

Final validation passed 181 focused Node lifecycle/cleanup checks and 4 focused
oversight-policy checks; 228 broad Node tests and 59 host-safe Python checks
with 45 container cases deselected; `git diff --check`; and source-mode Docker
Tier-1 with immutable-image, offline-RPC, teardown, and manifest evidence at
`.test-results/20261013T164613Z-92027-eedd4a14/tier1`.

No live Episode lifecycle transition, merge, abandonment, finalization, cleanup,
resource deletion, plugin activation, migration, or cutover occurred. The task
remains `In Progress`, live ownership/resources are unchanged, and no acceptance
criterion is newly claimed; the recorded real-session receipt gaps remain open.

#### Slice 10 progress — exact managed-asset retirement rehearsal (2026-10-13)

Re-audited ordered step 4 after public task-native activation. The task-native
planning and implementation workflows are already installed beside retained
folder compatibility. Exactly four managed project assets remain coupled to
that compatibility path: `project-workflow-plan-prep`,
`project-workflow-plan-spec`, `project-workflow-implement-prep`, and
`project-workflow-implement-spec`. Removing any of them from the production
inventory now would break retained `/plan-spec` or `/implement-spec` work, so
production assets and version-1 ownership remain unchanged.

Added an isolated cutover-retirement rehearsal to the project-initialization
suite. It creates a copied plugin generation without exactly those four rows and
source files, then proves a real version-1 active ownership snapshot holds every
compatibility workflow and the retained `.ralph/plans` sentinel byte-for-byte.
After the snapshot is released, the rehearsal proves the three unchanged
managed compatibility files are pruned, one customized compatibility workflow
is preserved and released from manifest ownership, every remaining managed
asset is one of the exact ten task-native/shared assets with source-identical
bytes, and retained plan bytes remain unchanged. A fresh project under the
rehearsed generation receives exactly those ten assets and no `.ralph/plans`
tree.

Independent read-only review reported no material findings. Focused validation
passed all 29 project-initialization Node checks, including a one-test isolated
review rerun. The exact curated broad candidate passed 229 Node checks and 59
host-safe Python checks with 45 container cases deselected, plus `git diff
--check`. Source-mode Docker Tier-1 passed with immutable-image, offline-RPC,
verified-teardown, and published-manifest evidence at
`.test-results/20261013T181209Z-47602-ef7f6389/tier1`.

This is preparation evidence only. No production inventory row, source asset,
project template, command, tool, workflow, ownership record, task, bundle,
status, or `.ralph/plans` content was removed or migrated. Final asset
retirement remains coupled to the explicitly authorized migration/cutover.

#### Accepted next dependency — activation-truth documentation and traceability
reconciliation

The operator accepted pushed checkpoint
`bf1b320e8649f252b6bf3031c0563ded17bffc9f`, including the isolated exact
managed-asset retirement rehearsal. The next execute pass is the explicitly
recorded ordered step-4 documentation prerequisite: make the already-active
task-native lifecycle the primary current architecture and operator path, and
label every retained folder procedure clearly as version-1 compatibility.
Reconcile the current architecture, operator, user-story, and traceability
surfaces identified by the recorded audit while keeping those compatibility
procedures operational and documented.

Do not begin the separate no-`To Do` guidance migration, proof-reference
normalization, task/bundle migration, production asset retirement,
`.ralph/plans` deletion, or final cutover. Preserve exact IDs and parents,
operator authority, supported interfaces, Docker-only plugin validation when
applicable, and the no-unrelated-scope boundary.

#### Slice 11 progress — task-native activation truth and retained version-1
compatibility

Reconciled the current architecture, operator workflow, user-story map, and
traceability matrix with the active runtime. `/plan TASK-ID` followed by
`/implement-task TASK-ID`, exact version-2 task ownership, task-bound execution,
`handoff_task_episode`, and guarded `finalize_task_episode` outcomes are now the
primary current lifecycle. Every retained folder procedure in the approved
surfaces is explicitly labeled version-1 compatibility and remains operational:
`/plan-spec`, `plan_spec`, `/implement-spec`, bundle promotion,
`create_spec_episode`, `handoff_spec_episode`, folder blocking/archival, and the
bookkeeping-only `finalize_spec_episode` close.

The traceability rows for US-11 through US-16 and US-24 now distinguish the two
schemas and their observable behavior. Public task-native admission fails closed
on existing non-terminal ownership; only retained version-1
`create_spec_episode` may return its matching Episode. Primary task-native
recovery rolls a proven-clean pre-ownership/resource failure back to `In
Planning`, publishes `Blocked` after recorded/partial/uncertain mutation, and
never duplicates resources. Retained version-1 partial provisioning/allocation
persists exact `uncertain` ownership and cannot replay fresh. Task-native
terminal review publishes `Ready for Merge`, refreshes the same Episode,
verifies the resulting handshake, and waits for explicit operator authority;
cleanup remains separately confirmed and closes ownership last.

Focused static contracts now bind those authority, replay, recovery, and
compatibility claims to their exact documents and traceability rows. Independent
review found and drove repairs for the public replay overstatement, the collapsed
recovery model, and initially weak bag-of-words assertions; final rereview found
no material findings. Validation passed 31 focused host-safe policy checks with
5 container cases deselected, 229 broad Node checks, 62 curated broad host-safe
Python checks with 45 container cases deselected, and `git diff --check`.

This slice changes documentation and host-safe static tests only. It does not
change plugin source or managed assets, so Docker Tier 1 is not required by the
repository validation policy. It does not begin the separate no-`To Do`
guidance migration, proof-reference normalization, task/bundle migration,
production asset retirement, `.ralph/plans` deletion, or final cutover. Existing
IDs, parents, status, ownership/resources, operator authority, and acceptance
evidence remain unchanged.

#### Accepted revision — correct Episode edit scope and lifecycle-receipt
ownership

The owning Conversation requested an in-scope revision of candidate
`d8507d7dd1a5d2d31354aaeecf6c5bffbbba0575` after Conversation and independent
EXPERT review demonstrated two concrete defects against the already
operator-approved contract. First, `docs/future-specification-bundles.md` must
not say
a task-native Episode edits only bound-task content: it implements approved
code, documentation, and tests in its worktree, exclusively owns the bound
task's content there, and leaves lifecycle status to the Conversation. Second,
`docs/conversation-driven-episode-oversight.md` must not place task-native
lifecycle receipts inside strict version-2 ownership: durable ownership stores
identity and resource bindings, while `finalize_task_episode` actions return
exact lifecycle receipts that the owning Conversation retains for later outcomes
and retries. Add focused static assertions for both distinctions.

Revise only those two claims and focused tests, then validate, independently
rereview, commit, push, report, and stop. Preserve every other accepted
activation-truth, retained version-1 compatibility, replay/recovery,
terminal-authority, cleanup, exclusion, task identity/parent/status/acceptance,
and no-unrelated-scope boundary. Do not begin no-`To Do` guidance migration,
proof normalization, task/bundle migration, production retirement,
`.ralph/plans` deletion, or final cutover.

#### Slice 12 progress — correct Episode edit scope and lifecycle-receipt
ownership

Repaired the two accepted documentation defects in candidate
`d8507d7dd1a5d2d31354aaeecf6c5bffbbba0575`.
`docs/future-specification-bundles.md` now states that a task-native Episode
implements approved code, documentation, and tests in its isolated worktree,
exclusively owns the bound task's content there, and leaves lifecycle status on
main to the Conversation. `docs/conversation-driven-episode-oversight.md` now
keeps strict ownership to lifecycle state plus durable owner, authority,
placement, and resource bindings. Ready, phased-progress, and terminal action
receipts are returned by `finalize_task_episode` and retained by the owning
Conversation for later authorized outcomes or bounded retries; they are not
ownership fields or event-journal entries.

A focused static contract protects every part of both distinctions and rejects
the former false claims. Independent read-only rereview reported no material
findings. Validation passed 32 focused host-safe policy tests with 5 container
cases deselected, 63 curated broad host-safe Python tests with 45 container
cases deselected, 218 broad Node tests, and `git diff --check`.

This repair changes only the two approved documentation files, one focused
static test, and durable task/plan evidence. It changes no plugin source or
managed asset, so Docker Tier 1 is not required. All other task-native-primary,
retained version-1 compatibility, replay/recovery, terminal-authority, cleanup,
exclusion, task identity/parent/status/acceptance, and no-unrelated-scope
behavior remains unchanged. The separate no-`To Do` guidance migration, proof
normalization, task/bundle migration, production retirement, `.ralph/plans`
deletion, and final cutover remain unstarted and unauthorized.

#### Accepted next dependency — retire active `To Do` guidance

The owning Conversation accepted pushed checkpoint
`1ef3ce44cc0c5e6855a591af0e612bf8f2dc024c`. The next execute pass must
implement only the next already-approved ordered step-4 prerequisite: re-audit
and remove active guidance that creates or selects `To Do`, including the
operator/project guidance and source/project `prepare` or backlog surfaces named
by the approved plan. Replace it with truthful task-native lifecycle guidance
that uses supported Backlog CLI behavior.

Keep all still-unmigrated tasks and the transitional configuration intact for
the later one-time migration. Do not migrate task statuses or bundles and do not
remove `To Do` from final configuration in this slice. Preserve retained
version-1 compatibility and all accepted activation, recovery, authority,
cleanup, and exclusion behavior. Keep proof-reference normalization,
requirements-inventory deletion gating, production asset retirement,
`.ralph/plans` deletion, and final cutover separate. If managed plugin source
changes, run the required Docker-isolated candidate validation. Independently
review the bounded candidate, commit, push, report, and stop.

#### Slice 13 progress — retire active `To Do` guidance

Re-audited the named operator, project, source/project `prepare`, Backlog, and
current-documentation surfaces. Five active surfaces still selected `To Do`:
`AGENTS.md`, `README.md`, `.agents/skills/prepare/SKILL.md`,
`.agents/skills/backlog/SKILL.md`, and `docs/backlog.md`. The project Backlog
skill and Backlog documentation also had creation examples that omitted status
and therefore inherited the transitional default. The generic source `prepare`
template was already tracker-neutral and required no change.

Replaced those active selection paths with the supported repeatable-status
`In Design` plus `In Planning` discovery command. New ordinary task examples
now pass `--status "In Design"` explicitly. Removed generic claim, completion,
and archive examples that bypassed the accepted task-native phase and
Conversation authority, and replaced them with truthful `/design` or
`/spec-it-out`, `/plan TASK-ID`, `/implement-task TASK-ID`, and owning
Conversation lifecycle guidance. Focused static coverage protects the named
operator/project/source surfaces, explicit authoring status, generic source
`prepare` behavior, and the absence of an active `To Do` selector.

The supported CLI accepted the repeated-status list command and returned a
versioned `task-list`. Focused validation passed 18 host-safe tests with 8
container cases deselected. The curated broad candidate passed 229 Node tests
and 68 host-safe Python tests with 45 container cases deselected, plus
`git diff --check`. Independent read-only review reported no material defects.
No managed plugin source changed, so Docker Tier 1 is not required by repository
policy.

The still-unmigrated tasks and transitional `backlog/config.yml` remain intact;
`To Do` is still the temporary configured default/selectable migration state.
No task status, bundle, production asset, retained version-1 compatibility,
accepted activation/recovery/authority behavior, or acceptance criterion
changed. Proof-reference normalization, requirements-inventory deletion
gating, production asset retirement, `.ralph/plans` deletion, and final cutover
remain separate.

#### Accepted next dependency — normalize proof references and gate inventory

The owning Conversation accepted pushed checkpoint
`4a40a0832d561e380da32099f07d3ea2195e7e65`. The next execute pass must
implement only the next already-approved ordered step-4 prerequisite: first
re-audit the exact tracked `config/requirements-inventory.json` and every
affected live proof reference, then make all live proof paths deletion-safe and
add or repair the inventory test gate that proves they will survive later
deletion of `.ralph/plans`.

Preserve literal old paths only where they are clearly historical evidence,
reports, completed-task prose, or provenance whose rewriting would falsify
history. Convert live proof authority to durable task references or explicit Git
provenance as the approved plan permits. Keep this to one bounded
proof-normalization and inventory-gating slice.

Do not migrate tasks, statuses, or bundles; do not remove `To Do` from
configuration; do not retire production assets or retained version-1
compatibility; do not delete or move `.ralph/plans`; and do not begin final
cutover. Preserve existing IDs, parents,
lifecycle state, ownership/resources, acceptance criteria, and operator
authority. If managed plugin source changes, run the required Docker-isolated
candidate validation. Validate the relevant inventory and static contracts,
independently review the bounded candidate, commit, push, report, and stop.

#### Slice 14 progress — normalize proof authority and gate deletion

Re-audited the exact tracked `config/requirements-inventory.json` before
editing. It contained 62 scalar references, across 21 distinct strings, to
eight `.ralph/plans` files. Seventeen Phase 2 verdicts incorrectly reused the
current active root plan even though their actual source is the archived Phase
2 runtime plan. Fifteen project-wide-testing rows incorrectly reused the final
Slice 8 archive files for claims from Slices 1–7.

Normalized the 17 Phase 2 verdicts to explicit Git provenance at
`.ralph/plans/archive/phase2-runtime/EXECUTION_PLAN.md @ 4a40a0832d561e380da32099f07d3ea2195e7e65`.
The other still-historical plan sources use the same accepted pre-cutover
checkpoint. The 15 project-wide-testing rows now use their exact durable
Backlog authorities: `PRIMECLAW-20` for the aggregate and `PRIMECLAW-20.1`
through `PRIMECLAW-20.8` for the applicable slice, including every source for
composite claims. The resulting inventory has 47 explicit Git references to six
audited files plus the slice-correct task references; no live proof claim
depends on the working-tree plan path.

Removed the remaining deletion-sensitive current proof links from
`DEVELOPERS.md`, `LONG_RANGE_PLAN.md`, `docker/test.Dockerfile`, the three
`docs/derisk` verdict surfaces, and user-story traceability. Current guidance
now uses canonical docs or durable Backlog tasks. Historical Phase 1 spec and
requirements paths remain truthful as explicit `path @ 4a40a0832d561e380da32099f07d3ea2195e7e65`
provenance. Historical reports, completed-task prose, retained version-1
compatibility behavior, and migration descriptions remain unchanged.

Expanded `tests/test_inventory_integrity.py` to scan every inventory string,
reject any unpinned plan reference, require the exact 47-reference/six-file
audited set and common provenance commit, resolve every Git object, enforce the
15 per-row project-wide-testing task mappings, resolve each task to exactly one
canonical tracked Markdown file, and protect the named current proof surfaces.
Initial independent read-only review found the false Phase 2 and testing-slice
source mappings. Both were repaired; its rereview reported no material findings
in the repaired inventory and gate.

Focused inventory and deletion-safety validation passed 7 tests. The curated broad
host-safe suite passed 653 tests plus 75 subtests, with 1 skip, 67 deselections,
and 12 warnings; `git diff --check` passed. An initial unrestricted host-safe
run also exposed two unrelated static-policy failures already present at the
handoff base: the `test_runtime_connect.py` literal-policy check and the missing
pytest bridge for `task_episode_admission_extension.test.mjs`. Their source and
policy files are unchanged by this slice. No managed plugin source changed, so
Docker Tier 1 is not required by repository policy.

No task identity, status, bundle, `backlog/config.yml`, production asset, plugin source,
retained version-1 compatibility behavior, lifecycle state,
ownership/resource, acceptance criterion, or operator authority changed. No
migration, retirement, plan deletion or movement, final cutover, host-global
apply, or live resource cleanup occurred.

#### Post-review repair — align US-17 Episode scope

Corrected the active US-17 traceability row after review of candidate
`88f66e559b70ab7fb2e2cc22244440674e305415`. It now states the accepted three
scope distinctions: a task-native Episode implements approved code,
documentation, and tests in its isolated worktree; it exclusively owns the
bound task's content there; and lifecycle status remains with the Conversation.
The retained version-1 compatibility clause and durable Backlog evidence
references remain unchanged.

Extended the existing focused Episode-scope contract in
`tests/test_oversee_episode_skill.py` to require all three distinctions on the
active traceability surface, reject the former task-content-only claim, and
preserve the compatibility and evidence clauses. Focused scope plus inventory
validation passed 13 host-safe tests and `git diff --check` passed. No proof
mapping, inventory gate, current-proof normalization, historical/version-1
exclusion, task identity/status/acceptance, plugin source, migration,
configuration/default, asset, plan placement, or cutover behavior changed.

### 2. Bind Episode creation and durable ownership to the exact task

- Refactor `extension-support/spec-episode.ts` around exact `taskId` and
  `taskPath`. Remove bundle hashing, copy/promotion, reserved plan directories,
  and plan-promotion commits while retaining the current Orca/local allocation,
  durable session publication, one fixed execute assignment, route recovery,
  and uncertain-mutation safeguards.
- Replace ownership version 1 plan fields (`sourceLocation`, `slug`,
  `bundleDigest`) in `episode-ownership.ts` with the minimal exact task plus
  existing owner/base/worktree/session identity. Update strict parsing, atomic
  writes, Conversation lookup, idempotent close, and display/branch naming;
  derive a safe branch label from the task ID without making it authority.
- Make the trusted post-readiness creation path verify `In Planning` plus a
  meaningful plan, update the exact main task to `In Progress` through the CLI,
  commit only that path, and create the branch from the resulting SHA. A push is
  prompt and best effort, never the branch-creation gate.
- Define and test the recovery boundary: a failure proven to have created no
  ownership/resource returns main to `In Planning`; any recorded, partial, or
  uncertain mutation publishes `Blocked` with its recovery condition, retains
  evidence/resources, and rejects replay as a fresh creation.
- Inject the exact task ID into the Episode execute prompt. Prove the new
  worktree starts at the status commit and one ownership record continues across
  execute, compaction, handoff, route reopen, and revision passes.

### 3. Convert Episode work and Conversation oversight without changing authority

- Rewrite `execute` so the Episode reloads its bound task and changes only task
  content on its branch: in-scope plan refinements, Implementation Notes,
  acceptance evidence/check state, blocker details, references, and Final
  Summary. It never changes lifecycle status and no longer reads, moves, or
  archives plan files.
- Rewrite `blocked` and `handoff` so blockers and resumable context live in the
  same task. The Episode reports through existing messaging; the Conversation
  publishes `Blocked` or resumed `In Progress` on main with exact task-only
  commits and prompt pushes, then continues the same Episode.
- Update `prime-claw-oversee-episode` and Expert-review artifact language to the
  approved task fields. Keep Expert review read-only and findings bounded by
  the approved contract.
- Implement and test the final-review handshake: the candidate task is complete
  but remains `In Progress`; Conversation acceptance publishes
  `Ready for Merge` on main; the same Episode integrates main and resolves the
  expected task-file divergence by retaining all Episode-owned content plus the
  main-owned status; the Conversation verifies that refreshed candidate before
  asking for merge authority.
- Encode the operator outcomes in guidance and fixtures: delay retains
  `Ready for Merge` and all resources; requested changes publish `In Progress`
  and resume the same Episode; verified merge is followed immediately by the
  exact main task `Done` commit/push; ownership and resources remain until the
  separately authorized finalization/cleanup path.
- Document and test confirmed abandonment without a new tool: bind the exact
  Episode head/task path, snapshot main status and invariant ID/parent metadata,
  select only the Episode task blob, reapply captured status through the CLI,
  verify the effective diff imports only Episode-owned task content and no code,
  add the abandonment Final Summary, archive without `Done`, commit/push the
  exact archival state, verify it, and only then perform authorized cleanup.

### 4. Reconcile managed assets, current documentation, and traceability

- Rename or retire old plan-folder workflow assets in
  `asset-inventory.json`; install task-native project-customizable workflows and
  preserve customized assets through the existing project-initialization
  reconciliation rules. Update the builder project's tracked `.agents` and
  `.prime-claw` copies and `.prime-claw/templates.json` from source inventory;
  do not use the installed user-global plugin.
- Update initialization tests so a current project receives task-native assets
  and no `.ralph/plans` tree. Keep active-Episode snapshot protection and safe
  customized-template behavior unchanged.
- Rewrite current architecture and operator guidance in `AGENTS.md`,
  `README.md`, `VISION.md`, `LONG_RANGE_PLAN.md`, `DEVELOPERS.md`,
  `.agents/skills/backlog/SKILL.md`, the source/project `prepare` guidance, and
  the relevant docs for backlog, preparation/handoff, project initialization,
  Conversation oversight, user stories C–I, story traceability, and the docs
  index. Replace live plan links with task IDs and `backlog task view` guidance.
  The Backlog skill must discover and claim work through the new lifecycle and
  must not retain an active `--status "To Do"` selection path; this does not add
  an ordinary-work plugin command.
- Update `config/requirements-inventory.json` and inventory tests so every live
  proof path survives deletion. Keep literal old paths only in clearly
  historical evidence, reports, completed-task prose, or provenance statements
  where rewriting would falsify history; convert broken live links to task
  references or `path @ pre-cutover commit` provenance.

#### Accepted next dependency — one-time Backlog migration without cutover

The next bounded slice uses
`6d11d9c2797cea54ecd07171e8a5b2019d6ee530` as the exact frozen
pre-cutover provenance tree and performs only the reviewed task and historical
bundle migration in step 5. Inventory every tracked `.ralph/plans` file at that
commit. Apply the table and classification rules exactly through the supported
Backlog CLI: preserve every existing ID and `parent_task_id`; reuse or create
only the named epics; retain `PRIMECLAW-7` as the sole Blocked Phase-3a
replacement with children `.3`–`.6`; preserve both supersession directions;
import source-ordered criteria, content, execution history, terminal outcome,
index evidence, and all source paths truthfully; and call `backlog task
complete` only for explicitly successful historical epics. Classify every
existing `To Do` task by meaningful native plan or stronger recorded evidence,
including the recorded special handling for `PRIMECLAW-10.37` and
`PRIMECLAW-7.6`. Remove `To Do` from final configuration only after proving no
active task still uses it. Put no migrated bundle in `backlog/archive/`.

Use no committed migration script, journal, wrapper, dual-write layer, or
alternate tracker. A bounded temporary helper may only issue supported CLI
operations. Add or repair the approved representative migration validation,
independently review the result, commit, push, and report exact mapping, counts,
and provenance.

This migration slice stops before compatibility retirement and cutover. It does
not retire production or version-1 assets, delete or move any tracked
`.ralph/plans` source, disable retained folder compatibility, perform final
cutover, change `PRIMECLAW-10.38` lifecycle status, or claim terminal
acceptance. Accordingly, step 5's final plan-tree deletion and step 6's
plan-absence/cutover assertions remain deferred until separately authorized.

#### Migration execution blocker — completed-record mutation has no supported CLI path

The bounded migration preflight at clean checkpoint
`5ca6d463efa5433192e3bc7a17894a60293f4738` inventoried all 43 tracked
`.ralph/plans` files at frozen tree
`6d11d9c2797cea54ecd07171e8a5b2019d6ee530` and reconciled 16 present
bundle owners: nine existing tasks and seven new epics. The reviewed
`replace-beads` mapping is a no-op because neither candidate source path exists
in the frozen tree; `PRIMECLAW-35` must remain unchanged.

Execution stopped before any migration mutation remained. Seven required reused
owners — `PRIMECLAW-6`, `PRIMECLAW-10.15`, `PRIMECLAW-10.26`,
`PRIMECLAW-10.28`, `PRIMECLAW-19`, `PRIMECLAW-20`, and
`PRIMECLAW-10.34` — already live under `backlog/completed/`. Supported
`backlog task view --json` resolves them, but the supported `backlog task edit`
interface returns `Task not found` because edits resolve only the active corpus.
The repository-built Backlog implementation explicitly states that a completed
record cannot pass through `updateTask`, and its diagnostics recommend direct
file editing for completed records. Direct task-Markdown edits are forbidden by
this repository and contradict this migration's CLI-only contract. `task
demote` is not a valid escape hatch because it assigns a new draft ID and would
violate immutable task identity.

A temporary create attempt for the seven new epics was fully rolled back; the
working tree returned clean before this blocker record. No existing task,
status, parent, config, bundle, asset, or source plan was changed.

The operator selected the supported-capability unblock. Before broader migration
resumes, implement and validate an upstream-quality Backlog operation that
restores one exact completed record to active task storage without changing its
ID, parent, content, or terminal `Done` status. The normal supported `task edit`
flow may then update that same record, and `task complete` must run only after
all intended edits and validation. Land the capability as its own reviewable
checkpoint; do not combine its acceptance with migration mutation. Keep the
implementation and validation in this Episode, but do not open, prepare, or
pursue an upstream issue or pull request. The owning Conversation may assign
that separate transport only after it accepts the capability candidate. Until
the capability checkpoint is accepted, do not resume the migration, infer a
direct-edit exception, move/delete plan files, or change `PRIMECLAW-10.38`
lifecycle status.

#### Supported completed-task restore capability checkpoint

The operator-selected unblock is implemented as an isolated Backlog capability
candidate. Dependency commit
`5d556c1954f7724abd180f6211cf528e9253ad4c` adds
`backlog task restore <taskId>` as a canonical CLI operation. It resolves one
exact local completed identity, holds its task lock, moves the same file back to
active storage with no-clobber hard-link/unlink semantics, and never parses or
serializes the record. The ID, `parent_task_id`, filename, raw bytes, and
terminal status therefore remain unchanged. The restored record is published
coherently into the active ContentStore corpus; normal `task edit` works, and
`task complete` returns it to completed storage only after intended edits and
validation.

The implementation also makes auto-commit staging transactional. Both sides of
the move are prepared in a temporary Git index and published to the real index
in one `update-index` operation. A staging or commit failure conditionally
restores owned index entries and moves the byte-identical file back; ownership
loss reports explicit partial state instead of inviting a blind retry. Core
forces working-copy-only resolution even when an internal caller omits read
options. Independent review found the earlier partial-staging and caller-locality
defects; both were repaired before this checkpoint.

Validation evidence:

- 125 focused/regression tests passed across restore lifecycle, custom-prefix ID
  resolution, ContentStore transitions, and local command boundaries.
- Restore proof covers byte-for-byte identity/content/parent/status preservation,
  occupied-destination no-clobber behavior, restore → normal edit → complete,
  commit-failure rollback that preserves prior staged work, and staging-failure
  rollback that leaves the real index unchanged.
- `bun run check`, `bun run check:types`, and `bun run build` passed.
- The complete native dependency suite recorded 2,892 passes and 8 skips. Its 13
  unrelated failures were triaged: MCP search, Git timeout, bulk move, and
  ContentStore watcher failures cleared on isolated/sequential rerun; the eight
  TUI move failures/errors reproduce unchanged on the untouched dependency base;
  and the branch-loader mock-count assertion also fails on the untouched base in
  this nested submodule path while passing in an external clean worktree.
- The project host-safe suite recorded 653 passes, 1 skip, 65 deselections, and
  75 subtests; its two failures are the already-recorded unrelated static-policy
  baseline failures.
- `git diff --check` passed, and the built candidate exposes the documented
  `task restore` help contract.

This checkpoint changed no migration record. The seven completed owners remain
under `backlog/completed/`; no historical epic, `To Do` classification, config,
asset, lifecycle status, or plan location changed. The owning Conversation has
accepted and pushed the capability at Backlog dependency
`5d556c1954f7724abd180f6211cf528e9253ad4c` and parent
`817a5936607fcb9493630ad14544c744030ebb40`; both were verified clean,
upstream-equal, and linked exactly.

The next execute pass is approved only for the reviewed one-time task and
historical-bundle migration in Step 5. Restore `PRIMECLAW-6`,
`PRIMECLAW-10.15`, `PRIMECLAW-10.26`, `PRIMECLAW-10.28`, `PRIMECLAW-19`,
`PRIMECLAW-20`, and `PRIMECLAW-10.34` through `backlog task restore`; preserve
each exact ID, parent, filename, bytes/content, and `Done` status through the
restore; make only supported CLI edits; validate; and run `backlog task
complete` only after all intended edits. Reconcile the frozen 43 source paths
into the 16 recorded bundle owners, preserve the approved `PRIMECLAW-7` Phase
3a mapping and bidirectional superseded-history references, and leave
`PRIMECLAW-35` unchanged when its source bundle is absent. Do not perform
upstream outreach, asset retirement, `.ralph/plans` deletion, final cutover,
lifecycle status changes, or unrelated cleanup. Commit and push this bounded
migration candidate, report exact evidence, and stop idle for Conversation
review.

#### Bounded historical-bundle migration candidate — completed

The accepted one-time migration used frozen provenance tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530` and
reconciled its 43 tracked `.ralph/plans` paths into 16 owners. The shared
`.ralph/plans/archive/README.md` is recorded as terminal/status evidence; the
other 42 paths are owned exactly once by the groups below. The reviewed
`replace-beads` source paths are absent, so `PRIMECLAW-35` remains unchanged.

| Bundle group | Source paths | Owner | Status | Storage path | Checked criteria |
|---|---:|---|---|---|---:|
| `active-root` | 2 | `PRIMECLAW-10.38` | `In Progress` | `backlog/tasks/primeclaw-10.38 - Replace-.ralph-plans-with-task-native-Backlog-Ralph-lifecycle.md` | 0/19 |
| `archive/compaction-first-phase-transitions` | 2 | `PRIMECLAW-39` | `Done` | `backlog/completed/primeclaw-39 - Historical-Compaction-first-phase-transitions.md` | 2/5 |
| `archive/conversation-driven-episode-oversight` | 2 | `PRIMECLAW-10.26` | `Done` | `backlog/completed/primeclaw-10.26 - Implement-conversation-driven-episode-oversight-plugin.md` | 13/13 |
| `archive/conversational-ralph-command-routing` | 2 | `PRIMECLAW-38` | `Done` | `backlog/completed/primeclaw-38 - Historical-Conversational-Ralph-command-routing.md` | 9/9 |
| `archive/goal-heartbeat-work-control` | 2 | `PRIMECLAW-10.28` | `Done` | `backlog/completed/primeclaw-10.28 - Implement-plugin-global-goal-and-heartbeat-work-control.md` | 13/13 |
| `archive/handoff-continuation-resilience` | 2 | `PRIMECLAW-10.15` | `Done` | `backlog/completed/primeclaw-10.15 - POC-conversation-owned-episode-for-resilient-conversational-handoff.md` | 9/9 |
| `archive/official-lean-compatibility-cleanup` | 2 | `PRIMECLAW-10.34` | `Done` | `backlog/completed/primeclaw-10.34 - Complete-official-lean-role-protocol-and-remove-compatibility.md` | 20/20 |
| `archive/official-lean-session-protocol` | 2 | `PRIMECLAW-40` | `Done` | `backlog/completed/primeclaw-40 - Historical-Official-lean-session-protocol.md` | 16/16 |
| `archive/phase1-derisk-gate` | 4 | `PRIMECLAW-36` | `Done` | `backlog/completed/primeclaw-36 - Historical-Phase-1-de-risk-gate.md` | 22/22 |
| `archive/phase2-runtime` | 4 | `PRIMECLAW-6` | `Done` | `backlog/completed/primeclaw-6 - Phase-2-sandbox-runtime-foundation-prime-agent-in-OpenShell.md` | 20/20 |
| `archive/phase3a-bufd-superseded-incomplete` | 4 | `PRIMECLAW-41` | `Done` | `backlog/completed/primeclaw-41 - Historical-Superseded-incomplete-Phase-3a-brain-hosting-BUFD.md` | 10/17 |
| `archive/plugin-test-container` | 7 | `PRIMECLAW-19` | `Done` | `backlog/completed/primeclaw-19 - Test-tier-architecture-tier-1-plugin-test-container.md` | 7/7 |
| `archive/project-wide-testing-strategy` | 2 | `PRIMECLAW-20` | `Done` | `backlog/completed/primeclaw-20 - Project-wide-testing-strategy-specification-planning-only.md` | 5/5 |
| `archive/worktree-isolated-specification-episodes` | 2 | `PRIMECLAW-37` | `Done` | `backlog/completed/primeclaw-37 - Historical-Reviewed-future-plans-and-worktree-isolated-specification-episodes.md` | 16/21 |
| `future/delivery-manager-episode-supervision` | 1 | `PRIMECLAW-42` | `In Design` | `backlog/tasks/primeclaw-42 - Design-delivery-manager-episode-supervision.md` | 0/17 |
| `future/phase3a-brain-hosting-completion` | 2 | `PRIMECLAW-7` | `Blocked` | `backlog/tasks/primeclaw-7 - Phase-3-tracer-bullet-end-to-end-working-claw.md` | 0/5 |

Before editing each reused completed owner, `backlog task restore` moved the
exact completed file to active storage without changing its bytes, ID, parent,
filename, or `Done` status. These pre-edit byte receipts were verified after
each restore:

| Owner | Parent | Filename | Bytes | SHA-256 before and immediately after restore |
|---|---|---|---:|---|
| `PRIMECLAW-6` | `null` | `primeclaw-6 - Phase-2-sandbox-runtime-foundation-prime-agent-in-OpenShell.md` | 4758 | `79168c7f1fbd4339c4dafed49b3fdb224d21bc55d7762fca597fe57dd10f33ed` |
| `PRIMECLAW-10.15` | `PRIMECLAW-10` | `primeclaw-10.15 - POC-conversation-owned-episode-for-resilient-conversational-handoff.md` | 34126 | `ae4e0d7ce36ecd75a49134959c4fe1a72271110147938d0b96e5a7606bed7a16` |
| `PRIMECLAW-10.26` | `PRIMECLAW-10` | `primeclaw-10.26 - Implement-conversation-driven-episode-oversight-plugin.md` | 484000 | `f4cf57d8770280b78a51fb4364546e6513b09ddd3d9bb0a0c76c3d3c0721af24` |
| `PRIMECLAW-10.28` | `PRIMECLAW-10` | `primeclaw-10.28 - Implement-plugin-global-goal-and-heartbeat-work-control.md` | 13708 | `81c2822934ceb858f22829ec176ef032ef1c61ee61c3da79cc880560556ce339` |
| `PRIMECLAW-19` | `null` | `primeclaw-19 - Test-tier-architecture-tier-1-plugin-test-container.md` | 42404 | `bc414298280d29e4842ca30d37ee95464d36cab1f0d66b41ae91244d8fca7fed` |
| `PRIMECLAW-20` | `null` | `primeclaw-20 - Project-wide-testing-strategy-specification-planning-only.md` | 3335 | `fecd81ce8f13e7cec1fc1d4945574fe8284772f305bcea629504b50708c250bb` |
| `PRIMECLAW-10.34` | `PRIMECLAW-10` | `primeclaw-10.34 - Complete-official-lean-role-protocol-and-remove-compatibility.md` | 195925 | `ac40110fdb8000115645e12ef1c390464152ff33e3ce0dd34cd02fa210fc1437` |

All task mutations used supported Backlog CLI operations. Each successful
historical owner was validated before `backlog task complete` returned it to
`backlog/completed/`. `PRIMECLAW-41` is intentionally completed-but-partial
with 10/17 source-supported criteria; it links bidirectionally with the sole
live Blocked Phase 3a replacement, `PRIMECLAW-7`. Historical predecessor
`PRIMECLAW-40` links bidirectionally with replacement `PRIMECLAW-10.34`.
`PRIMECLAW-42` remains `In Design`. `PRIMECLAW-10.38` remains `In Progress`
under `PRIMECLAW-10` with 0/19 criteria checked.

Validation evidence:

- an in-memory audit proved the frozen inventory is exactly 43 unique paths,
  the 16 non-index groups map to 16 exact task owners, every source path and
  frozen commit appears in owner provenance, imported specifications,
  requirements, plans, decisions, and nested reviews survive normalized
  Backlog serialization, and the archive index outcome is present for every
  historical bundle;
- identity/storage checks proved the seven restored owners retain their exact
  IDs, parents, filenames, `Done` status, and completed storage after edits;
- hierarchy checks proved `PRIMECLAW-7.3` through `.7.6` retain parent
  `PRIMECLAW-7` and their pre-migration statuses;
- `git diff --quiet 7df23e5c811afbb49ebf877734870730206dcb48 -- <PRIMECLAW-35 path>`
  passed, proving the absent-source no-op;
- `python3 -m pytest tests/test_backlog_workflow.py tests/test_backlog_build.py -q`
  passed: 7 tests.

This candidate does not classify remaining `To Do` work, change configuration
or existing lifecycle statuses, delete or move `.ralph/plans`, retire assets,
perform final cutover, initiate upstream outreach, or do unrelated cleanup.
Those actions remain deferred for separate Conversation authority.

#### Accepted review correction — deferred dogfood criteria remain unchecked

The accepted material finding against migration candidate
`2ddd6dc45bbf47665354b6983e930daaa23e8f86` is repaired. Imported native
criteria no longer mark explicitly deferred manual dogfood as complete.

- `PRIMECLAW-39` was restored byte-for-byte before editing (39856
  bytes, SHA-256 `69cd72ccf3032710d84a0e8c77c7514cff110f820dffde83bd170b0f15b854b0`), retained its exact ID, null parent,
  filename, and `Done` status, and returned to its exact completed path with
  only criteria 3 and 4 checked (2/5). Criteria 1, 2, and 5 remain unchecked.
- `PRIMECLAW-37` was restored byte-for-byte before editing (44721
  bytes, SHA-256 `fc5f8b0eeed910885393308388a05158425095288e2955d212740e57213031ef`), retained its exact ID, null parent,
  filename, and `Done` status, and returned to its exact completed path with
  criteria 1–16 checked and deferred Slice 4 criteria 17–21 unchecked (16/21).
- `python3 -m pytest tests/test_backlog_workflow.py tests/test_backlog_build.py
  -q` passed: 7 tests. Exact criterion-state, identity, storage, bounded-diff,
  and `git diff --check` validation passed before the repair commit.

No new dogfood ran. No lifecycle status, other mapping/content, asset,
`.ralph/plans` location, cutover, or unrelated cleanup changed.

### Operator-approved compatibility-preservation correction

This correction is the current planning authority and supersedes the Slice 10
four-asset retirement rehearsal, the former Steps 2–6 where they remove generic
legacy workflow behavior, and every later generic compatibility-retirement or
repository-wide plan-absence instruction. Those records remain historical
execution evidence only.

`PRIMECLAW-10.38` cuts over this repository's own `.ralph/plans` data and
current guidance to the task-native workflow. The generic plugin continues to
provide the legacy workflow for other initialized repositories. Tracker
migration and specification authority are orthogonal: Backlog tracking may
coexist with legacy bundles; Beads migration is optional and separate;
Beads-only repositories initialize the task-native workflow; and archive-only
bundles do not force the legacy workflow.

The generic plugin must preserve:

- the project-local legacy workflow assets `project-workflow-plan-prep`,
  `project-workflow-plan-spec`, `project-workflow-implement-prep`, and
  `project-workflow-implement-spec`;
- `/plan-spec`, `/implement-spec`, `plan_spec`, `create_spec_episode`,
  `handoff_spec_episode`, and `finalize_spec_episode`;
- ownership version 1 parsing and the legacy workflow promotion, recovery,
  handoff, review, finalization, and cleanup behavior needed by existing
  Episodes;
- hybrid routing for execute, handoff, blocked handling, Expert review, and
  Conversation oversight;
- old active-snapshot fallback for `.ralph/skills/handoff` and
  `.ralph/skills/execute`; and
- separately named project-local `design-legacy` and `spec-it-out-legacy`
  authoring assets that preserve current-main legacy authoring without
  mechanically duplicating neutral or shared Markdown.

Persisted ownership decides routing before prompt-tag absence. A valid ownership
version 1 record selects the legacy workflow and a valid ownership version 2
record selects the task-native workflow. `<operator-episode-task>` is only a
candidate task binding when ownership does not decide. When persisted ownership
is absent, active legacy `SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files
on canonical main may represent the old in-place legacy workflow without any
live Prime Claw Episode or ownership version 1 record; that remains a valid
legacy workflow case. This no-ownership fallback selects old in-place work only
and does not establish Episode identity. Active plan placement alone does not
prove live Episode identity; a live ownership version 1 Episode requires
persisted version 1 ownership plus active files in that Episode worktree.
Legacy workflow execute completion wording cannot claim or mutate task-native
Backlog lifecycle authority.

Project-local `.prime-claw/workflows` files are runtime surfaces. Plugin-root
copies are delivery sources installed or reconciled into projects. Inventory,
initialization, reconciliation, and tests must preserve that distinction.

No code, skill, template, test, asset, status, configuration, plan placement,
or cutover mutation is authorized by this specification-only reconciliation.
Remaining implementation is split into the three ordered slices below.

### 5. Preserve compatibility and resolve workflow mode

- Restore or retain the four named project-local legacy workflow assets and
  their initialization/reconciliation inventory. Preserve customized instances
  under the existing reconciliation rules.
- Retain all six named legacy commands/tools, ownership version 1 parsing, and
  legacy promotion, recovery, handoff, review, finalization, and cleanup paths.
- Make execute, handoff, blocked handling, Expert review, and Conversation
  oversight route from persisted ownership first. Ownership version 1 selects
  the legacy workflow; ownership version 2 selects the task-native workflow.
  Only when ownership does not decide may `<operator-episode-task>` become a
  candidate task binding.
- With no persisted ownership, retain active legacy `SPECIFICATION.md` and
  `IMPLEMENTATION_PLAN.md` files on canonical main as a valid old in-place
  legacy workflow case without a live Prime Claw Episode or ownership version 1
  record. Only this no-ownership old in-place case falls back to active legacy
  files.
- Do not treat active plan placement alone as proof of live Episode identity.
  Require persisted version 1 ownership plus active files in the Episode
  worktree for a live ownership version 1 Episode. Retain old active-snapshot
  fallback for `.ralph/skills/handoff` and `.ralph/skills/execute`.
- Bound completion language by workflow: legacy workflow execution may record
  its own result but must not claim or mutate task-native Backlog status,
  completion, archival, finalization, or cleanup authority.
- Add separately named project-local `design-legacy` and
  `spec-it-out-legacy` assets by preserving the current-main legacy authoring
  behavior and reusing neutral/shared Markdown rather than mechanically copying
  it.
- Treat project-local `.prime-claw/workflows` as runtime surfaces and plugin-root
  copies as delivery sources. Prove initialization, reconciliation, inventory,
  customization preservation, and both workflow routes through focused tests
  and Docker-isolated plugin acceptance.

Stop after a reviewable compatibility-preservation/mode-resolution candidate.
Do not change this repository's status configuration, migrate remaining data,
delete `.ralph/plans`, or perform cutover in the same slice.

### 6. Cut over this repository's status, configuration, and data

- Configure only this repository for the task-native workflow. Do not change the
  generic plugin's legacy workflow support or infer another repository's mode
  from its tracker.
- Complete this repository's remaining status migration: meaningful native plan
  means `In Planning`; no meaningful plan means `In Design`; stronger active,
  blocked, ready, or done evidence remains authoritative. Preserve every ID and
  parent. Remove active `To Do` configuration/guidance only after proving no
  active task still uses it.
- Update this repository's current guidance and task-native runtime surfaces to
  exact Backlog identity and supported task fields. Backlog tracking may still
  coexist with legacy bundles elsewhere.
- Keep Beads migration optional and separate. A Beads-only repository
  initializes the task-native workflow. Archive-only bundles do not select the
  legacy workflow.
- Validate exact status counts, unchanged identity/hierarchy, configuration,
  current guidance, initialization selection, and the retained generic legacy
  workflow. Stop before deleting this repository's `.ralph/plans` tree.

### 7. Delete this repository's `.ralph/plans` tree and run final validation

- Confirm every live repository-local specification, plan, progress, blocker,
  and outcome needed by the task-native workflow is durable in Backlog tasks or
  current documentation, then delete only this repository's tracked
  `.ralph/plans` tree.
- Scope final searches by workflow. Task-native surfaces and this repository's
  current task-native guidance must reject legacy authority. Retained legacy
  workflow surfaces may and must continue to use their legacy bundles,
  commands, tools, ownership version 1, and compatibility assets. Historical
  literals and frozen provenance remain truthful.
- Prove both ownership parsers and routing precedence; live ownership version 1
  identity requirements; candidate task binding only when ownership does not
  decide; old active-snapshot fallback; bounded completion wording; separate
  legacy authoring assets; runtime-versus-delivery-source behavior; and all
  preserved operator boundaries.
- Run focused Node and Python suites, task parsing/count checks,
  `git diff --check`, the host-safe suite, and the required Docker-isolated
  plugin gate. Never run a user-global candidate apply/check or an unwrapped
  native mutation probe.
- Update `PRIMECLAW-10.38` with final plan, notes, acceptance evidence,
  references, modified files, and Final Summary while leaving lifecycle status
  unchanged. Commit and push the candidate for Conversation review. Do not
  merge, mark status, finalize ownership, or clean resources.

Repository-local deletion completes this task's data cutover only. It does not
retire generic legacy workflow support.

## Completion evidence

The candidate is ready for Conversation review only when all three remaining
slices are complete: the generic plugin demonstrably preserves both workflows
and resolves mode from persisted ownership; this repository's status,
configuration, data, and current guidance use the task-native workflow; this
repository's tracked `.ralph/plans` tree is absent; task-native searches reject
legacy authority without breaking retained legacy workflow surfaces; required
focused, host-safe, and Docker-isolated validation passes; and
`PRIMECLAW-10.38` contains the complete evidence while remaining `In Progress`.
The owning Conversation then performs the separate review, lifecycle, merge,
finalization, and cleanup decisions.

## Step 5 compatibility-preservation completion checkpoint

Completed only Step 5, "Preserve compatibility and resolve workflow mode," against accepted base `e4d1cdd46fd96f7b6f4f529e286b316bb60adf77`.

- Retained the four customizable legacy workflow assets and all six legacy command/tool surfaces, version-1 ownership parsing, promotion, replay, recovery, handoff, review, finalization, and cleanup behavior.
- Made persisted ownership authoritative before prompt text: version 1 selects retained-folder mode and version 2 selects task-native mode. Without ownership, complete active files on canonical main remain valid old in-place work but do not create Episode identity.
- Required live version-1 Episode identity to include readable, non-empty active specification and implementation files in the recorded Episode worktree. Missing files now fail closed for replay, handoff, oversight, and initialization reconciliation.
- Accepted `IMPLEMENTATION_PLAN.md` plus retained `EXECUTION_PLAN.md`, and kept `.ralph/skills` snapshot fallback limited to `handoff` and `execute`.
- Added separately named `design-legacy` and `spec-it-out-legacy` project skills. Their shared future-folder contract has one owner, and the new assets have no competing migration source.
- Bounded legacy completion and blocking so retained-folder actions cannot claim or mutate task-native Backlog lifecycle, finalization, or cleanup authority.
- Preserved runtime project copies separately from plugin delivery sources, including customized initialized-project assets.

Validation:
- focused host-safe suites: 56 passed, 11 deselected;
- managed inventory/workflow suites: 15 passed, 34 deselected;
- broad non-container suite: 655 passed, 1 skipped, 65 deselected, 75 subtests passed, with only three unchanged accepted-base/environment failures;
- full focused Docker bridge: 136/137 Node cases passed; the sole failure is the unchanged pre-Step-5 test that expects the ignored host-built `deps/backlog/dist/backlog` artifact inside the read-only snapshot;
- final Step-5 Docker selection excluding that exact unchanged baseline: 11 passed, 21 deselected;
- independent read-only review: no material findings; directly affected suites passed;
- `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe`: passed with offline RPC probe, verified teardown, and published manifest;
- `git diff --check`: passed.

Steps 6 and 7 remain unstarted. This checkpoint does not change repository lifecycle status/configuration/data cutover, publish final lifecycle state, retire compatibility assets, delete `.ralph/plans`, merge/finalize, clean resources, or apply user-global assets.

## Accepted Step 5 revision after candidate `d3545929163cded2872cf027cf96ffee138f3fc0`

Candidate `d3545929163cded2872cf027cf96ffee138f3fc0` is not accepted. Repair one concrete in-scope legacy-compatibility defect before reconsidering Step 5 acceptance.

The live version-1 active-file gate currently conflicts with normal retained-workflow transitions. `execute` may move the active specification/implementation pair to `.ralph/plans/blocked/` when work blocks and may archive it at candidate completion. That absence then makes `blocked`, replay/handoff, Conversation oversight, and review/revision reject the same persisted version-1 Episode.

Repair requirements:

1. Keep the active specification/implementation pair available throughout live version-1 blocked and candidate-review/revision states. Defer destructive archival until the owned version-1 lifecycle is terminal.
2. Preserve the distinct no-ownership old in-place workflow behavior.
3. Add a narrow exact-version-1 recovery path for already-blocked snapshots. It must use persisted version-1 ownership and the recorded worktree, restore only that Episode's blocked pair after the required operator unblock decision, and revalidate active identity before ordinary continuation.
4. Missing active files never count as live and never fall through to task-native mode.
5. Add focused blocked → restore → same-Episode continuation coverage and completed-candidate → review/revision coverage.
6. Synchronize every affected plugin delivery source, project runtime copy, asset inventory/manifest entry, documentation, and focused test.
7. Preserve all other reviewed Step 5 behavior. Host checks passed (55 Python and 179 Node) and configured Docker Tier-1 passed for the rejected candidate; do not reopen sound areas without concrete evidence.

Do not start Step 6. Do not change repository lifecycle status/configuration/data cutover, publish final lifecycle state, retire compatibility assets, delete `.ralph/plans`, merge/finalize, clean resources, or apply user-global assets.

## Step 5 active-lifecycle revision completion

Completed the accepted revision after rejected candidate `d3545929163cded2872cf027cf96ffee138f3fc0`.

- Persisted active version-1 Episodes keep their specification/implementation pair in `.ralph/plans/` while blocked and throughout candidate review and bounded revision. The distinct no-ownership old in-place workflow retains its historical blocked/archive transitions.
- `restore_blocked_spec_episode` is the sole guarded recovery surface for an older blocked-only version-1 snapshot. It requires the operator's explicit unblock decision, the exact top-level owner in canonical primary `main`, active version-1 ownership, the recorded Git/Orca worktree identity, an absent active pair, one readable non-empty regular blocked pair under real in-worktree directories, and collision-free destinations. It restores only those two files with rollback checks, re-reads unchanged ownership, and revalidates live identity. It never selects task-native mode, allocates resources, or creates another Episode.
- `handoff_spec_episode` permits ordinary same-Episode continuation only after successful restore/revalidation. Missing active files remain non-live and fail closed. `execute` cannot substitute chat instructions or any no-ownership fallback while a version-1 record exists.
- Candidate review/revision keeps the same active pair, ownership, worktree, and durable session. Conversation oversight and Expert review continue to bind that pair.
- `finalize_spec_episode` remains bookkeeping-only and performs no plan archival. The pair stays active until ownership becomes terminal; this repair adds no archival tool, and any later archival requires separate explicit legacy authority.
- Delivery-source and project-runtime copies, managed hashes, docs, public tool discovery, and focused lifecycle regressions are synchronized. Step 6 remains unstarted.

Validation evidence:
- directly affected Node suites: 222/222 passed in independent review;
- final `tests/spec_episode_extension.test.mjs`: 151/151 passed after recovery safety hardening;
- focused host-safe policy suites: 56 passed, 12 deselected;
- inventory/install/workflow suites: 13 passed, 33 deselected;
- broad non-container suite: 655 passed, 1 skipped, 65 deselected, 75 subtests passed, with only the same three accepted-base/environment failures (runtime-test host-safe marker wording, existing missing pytest bridge, and existing Backlog source pin mismatch);
- independent review found one material execute-policy fallback contradiction; the delivery/runtime wording and static rejection coverage were repaired, and all other reviewed revision behavior was sound;
- post-repair `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe`: passed with immutable source-mode image, offline RPC probe, network absence, verified teardown, and published manifest;
- `git diff --check`: passed.

This completion does not change repository lifecycle status/configuration/data cutover, publish final lifecycle state, retire compatibility assets, delete `.ralph/plans`, merge/finalize, clean resources, or apply user-global assets.

## Operator acceptance and Step 6 authorization

Step 5 is accepted at exact pushed candidate `5cdabed7a6850e6f684465acd77ea3d589ec213a`.

The next execute pass is authorized for Step 6 only: this repository's status, configuration, and data cutover exactly as already approved in `PRIMECLAW-10.38` and this plan.

- Configure only this repository for the task-native workflow.
- Migrate remaining task statuses truthfully.
- Remove active `To Do` use only after proving the repository data state permits it.
- Update this repository's current guidance and runtime surfaces.
- Preserve task IDs, parent relationships, stronger existing statuses, generic legacy compatibility, tracker/specification orthogonality, and all operator authority boundaries.
- Produce one clean pushed Step 6 candidate for review, then stop.

Do not start Step 7, delete `.ralph/plans`, publish final lifecycle state, merge, finalize ownership, clean resources, or apply user-global assets.

## Step 6 repository-local cutover completion

Completed only Step 6, "Cut over this repository's status, configuration, and data," from pushed checkpoint `9cd16a40c0bbc0ff9c610bbbdb1c8395c30ac47e`.

- The supported structured Backlog interface found 41 active tasks before migration: 31 `To Do`, 1 `In Design`, 3 `In Progress`, 4 `Blocked`, and 2 `Done`.
- Exact `task view --json` inspection proved all 31 `To Do` tasks had `implementationPlan: null`. The approved rule therefore classified all 31 as `In Design`, with zero `In Planning` classifications and zero ambiguities.
- One supported `backlog task edit ... --status "In Design"` operation migrated those exact 31 tasks. Post-edit reload proved no ID, path, or parent drift and no change to the 10 stronger existing statuses. Task-file diffs contain only the status plus Backlog-managed `updated_date`.
- Only after the active `To Do` count reached zero, `backlog/config.yml` changed to default `In Design` and the exact ordered statuses `In Design`, `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, and `Done`.
- Current repository guidance now describes the completed cutover. The project-local `design` and `spec-it-out` runtime copies state the final repository default while retaining explicit `In Design` creation; their manifest rows are intentionally `customized`. Generic plugin delivery sources, vendored Backlog behavior, legacy workflow assets, and hybrid ownership routing remain unchanged.
- `docs/evidence/task-native-backlog-cutover/2026-10-14-step-6-status-migration.json` records the pre/post counts, classification, exact IDs/paths/parents, preserved states, and configuration gate.

Validation evidence:
- focused host-safe configuration, receipt, guidance, initialization, inventory, and lifecycle checks: 50 passed, 42 deselected;
- focused current-guidance/status subset after final receipt assertions: 40 passed, 8 deselected;
- initialization and reviewed-lifecycle Node suites: 59/59 passed;
- broad non-container suite: 656 passed, 1 skipped, 65 deselected, 75 subtests passed, with only the same three accepted-base/environment failures (runtime-test host-safe marker wording, existing missing pytest bridge, and existing Backlog source pin mismatch);
- independent read-only review: no material findings; it independently reclassified all 31 tasks, compared every task diff, verified all identities/parents/stronger states, and confirmed repository-only scope and the Step 7 boundary;
- final post-edit `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe`: passed with immutable source-mode image, offline RPC probe, network absence, verified teardown, and published manifest;
- `git diff --check`: passed.

Step 7 remains unstarted. `.ralph/plans` stays active, `PRIMECLAW-10.38` remains `In Progress`, version-1 ownership remains active, and no final lifecycle publication, plan-tree deletion, merge, finalization, cleanup, or user-global asset application occurred.

## Step 6 acceptance revision after candidate `8ef465d132231d35bdacef64627f4ec3162a43dd`

Candidate `8ef465d132231d35bdacef64627f4ec3162a43dd` is not accepted because AC #13 lacks one bounded synthetic branch-coverage fixture.

Keep the truthful real migration and its receipt unchanged. All 31 actual pre-cutover `To Do` tasks had `implementationPlan: null` and correctly became `In Design`; the recorded counts, IDs, paths, parents, stronger real states, configuration, generic-plugin isolation, and Step 7 boundary are sound.

Repair only the acceptance-evidence gap:

- Add a small deterministic synthetic migration fixture/test with at least one meaningful-plan `To Do`, one planless `To Do`, and representative stronger statuses including `In Progress`, `Blocked`, `Ready for Merge`, and `Done`.
- Prove the two exact classifications: meaningful-plan `To Do` becomes `In Planning`; planless `To Do` becomes `In Design`.
- Prove unchanged ID, parent, path, and every stronger status.
- Do not add migration wrappers or production machinery.
- Re-run focused validation, commit and push one clean repair candidate, then stop.

Do not alter the actual migration receipt, actual task statuses, `backlog/config.yml`, or other accepted Step 6 data. Do not start Step 7, delete `.ralph/plans`, publish final lifecycle state, merge, finalize ownership, clean resources, or apply user-global assets.

## Step 6 AC #13 synthetic-fixture repair completion

Completed the bounded acceptance-evidence repair from pushed handoff `b06f823b6e94ed1cf442762eb3a0d76a73762486` without changing production behavior or accepted repository data.

- `tests/test_backlog_workflow.py` now has one deterministic six-record synthetic migration fixture: meaningful-plan and planless `To Do` records plus representative `In Progress`, `Blocked`, `Ready for Merge`, and `Done` records.
- The test-only policy application proves meaningful-plan `To Do` becomes `In Planning`, planless `To Do` becomes `In Design`, every ID/parent/path tuple remains exact, and each stronger-state record remains entirely unchanged.
- Focused migration test: 7 passed.
- Focused cutover/guidance/initialization/lifecycle validation: 41 passed, 8 deselected.
- The actual migration receipt and `backlog/config.yml` remain byte-identical to candidate `8ef465d132231d35bdacef64627f4ec3162a43dd`; no actual task file, generic plugin source, vendored Backlog source, or production migration machinery changed.

Step 7 remains unstarted. `.ralph/plans` stays active, `PRIMECLAW-10.38` remains `In Progress`, version-1 ownership remains active, and no final lifecycle publication, plan deletion, merge, finalization, cleanup, or user-global asset application occurred.

## Step 6 acceptance and Step 7 authorization

Step 6 is accepted at exact clean pushed candidate `c63dae91dfa15c4059914eeeeb5dace6debd56fa` and must not be reopened.

The next execute pass is authorized for approved Step 7 only:

1. Confirm every live repository-local specification, plan, progress, blocker, and outcome needed by the task-native workflow is durable in Backlog tasks or current docs.
2. Delete only this repository's tracked `.ralph/plans` tree.
3. Keep generic plugin legacy workflow support intact: retained legacy bundles, commands, and tools; ownership version-1 parsing and live-identity rules; no-ownership old active-snapshot fallback; hybrid routing precedence; separate legacy authoring assets; runtime-versus-delivery sources; and operator authority.
4. Scope final searches so task-native/current project surfaces reject legacy authority while retained legacy surfaces may still require it. Historical literals and frozen provenance must remain truthful.
5. Run the approved focused Node/Python checks, task parsing/count checks, `git diff --check`, host-safe suite, and Docker-isolated plugin gate.
6. Update `PRIMECLAW-10.38` through the supported Backlog CLI with final plan, notes, evidence, references, modified files, and Final Summary while leaving status exactly `In Progress`.
7. Commit and push one clean candidate, report it, and stop.

Do not publish `Ready for Merge`, merge, finalize ownership, clean resources, apply user-global assets, or retire generic legacy compatibility.

## Step 7 blocked — active version-1 identity conflicts with pre-review plan deletion

A bounded Step 7 attempt confirmed that all 43 tracked `.ralph/plans` paths have durable frozen-Git provenance and mapped Backlog owners, and that the active specification is only a pointer to `PRIMECLAW-10.38`. Before deletion, the complete active execution plan was also successfully round-tripped into the task through the supported CLI without changing task identity, parent, path, or `In Progress` status.

The deletion cannot safely proceed under the current authority state. Canonical ownership remains active version 1 for this exact Episode. The accepted Step 5 live-identity rule requires that ownership plus readable, non-empty active specification and execution-plan files remain present in the recorded Episode worktree throughout candidate review and revision. Deleting this worktree's active pair before review makes the Episode non-live; execute, handoff, Conversation oversight, and Expert review then fail closed. The Step 7 instruction also expressly forbids finalizing ownership, so this pass has no authority to remove or replace the ownership record first.

The attempted deletion, task update, receipt, documentation, and test edits were all uncommitted and were fully restored. The worktree returned to the exact clean pushed checkpoint `298146d24b0c6efb98d9d33dbb836140ba85c0f2` before this blocker note was added. No `.ralph/plans` content, task content/status, compatibility source, configuration, ownership state, or lifecycle resource changed.

Unblock requires an explicit reviewed lifecycle transition that reconciles the final repository-local deletion with current active version-1 ownership while preserving review and revision capability. For example, the owning Conversation must authorize and implement a safe ownership-mode transition or another exact mechanism before deletion; Step 7 cannot infer that product/authority change. After that decision is durably recorded, resume from this same Episode without reopening accepted Step 6.

## Operator-approved two-stage cutover — pre-activation ownership bridge

The operator approved a revised two-stage same-Episode cutover design. The next execute pass is authorized only for the pre-activation ownership-bridge candidate. Do not resume Step 7 plan-tree deletion in that pass.

- Keep canonical ownership active version 1 and keep this worktree's active `.ralph/plans/SPECIFICATION.md` plus `EXECUTION_PLAN.md` present throughout the candidate.
- Through the supported Backlog CLI, migrate the complete authoritative execution-plan detail and necessary notes/evidence into `PRIMECLAW-10.38`, record the thin specification wrapper as superseded by that task, preserve exact Git/path/hash provenance, and leave status exactly `In Progress`.
- Add one narrow guarded canonical transition surface for later execution only after this candidate is separately reviewed, merged, globally activated from primary `main`, restarted, and proven by UAT.
- The transition must bind the exact owner Conversation, active version-1 ownership, source location, operation/Episode/session, worktree identity/path, branch/head ancestry, task ID/path, committed-main task status/evidence, and active-plan identity.
- It must atomically replace only version-1 authority fields with version-2 task binding while preserving the same Episode, session, worktree, branch, and optional Orca resources.
- It must be one-way, exact, idempotent only for the same completed binding, and fail closed on drift, partial state, foreign owner, dirty or unsafe state, or unavailable evidence.
- Add the focused tests, documentation, public/canonical registration, and authority guidance needed for post-activation use.
- Run the required host-safe and Docker-isolated plugin validation, commit and push one clean candidate, report it, and stop.

Do not execute the live ownership transition, delete or archive the active pair, publish `Ready for Merge`, merge, apply globally, restart, finalize, clean resources, or reopen accepted Step 5 or Step 6 behavior. The prior Step 7 blocker remains truthful evidence; this approved bridge is its recorded unblock design, not permission to perform the later live transition or deletion.

## Pre-activation ownership bridge candidate completed

Implemented only the approved dormant version-1-to-version-2 authority bridge. `transition_spec_episode_to_task` is a public sequential tool gated on explicit post-review, post-merge, primary-main global activation, full restart, and UAT confirmation. It binds the exact owner Conversation, retained source, task ID/path, task-only admission `baseRef`, historical recorded head, reviewed pushed Episode head, activated pushed main head, active plan Git blobs, committed task blob and exact plan content, worktree/branch identity, durable Episode/session route, and optional Orca setup/worktree/terminal resources.

The guarded transition requires clean primary `main` and Episode worktrees with exact upstream heads and safe ancestry. It requires the committed `In Progress` main task and reviewed Episode task to be byte-identical, the task Implementation Plan to equal the active execution plan modulo terminal-newline normalization, and an exact task reference to preserve the superseded legacy source for same-binding replay proof. Runtime preflight requires one exact idle durable session at the owned CWD; Orca mode also requires the exact setup, worktree identity/path/branch/head, and connected writable visible terminal inventory.

The atomic write removes only version-1 authority fields (`version`, `sourceLocation`, `slug`, and `bundleDigest`), adds version 2 plus canonical `taskId` and `taskPath`, updates only bookkeeping time, and preserves every common owner, operation, `baseRef`, Episode, session, worktree, branch, recorded-head, and Orca field. Exact replay of the same durable owner/Episode/task/resource binding performs no write after revalidating the supplied current heads and active plan. A different durable binding, unsafe or unmerged current head/plan, foreign resource or route, partial record, dirty state beyond the mandatory untracked ownership file, unavailable evidence, unsafe ancestry, or ownership drift fails closed. A write error is reconciled only when disk already contains the exact target; otherwise the tool fails without inference.

`PRIMECLAW-10.38` now contains the complete authoritative execution plan through the supported Backlog CLI. Its notes and references preserve the accepted Step 5/6 evidence, the rolled-back Step 7 blocker, bridge authorization, exact active-plan Git/blob/SHA provenance, and the exact superseded future-source binding. The thin active specification explicitly records that the task supersedes it as specification authority while remaining present for live version-1 identity.

Validation evidence:

- focused transition/registration Node rerun: 51 passed;
- focused ownership, runtime preflight, public registration, and existing lifecycle Node suite before the final source-reference tightening: 203 passed; the final 50-test rerun covers that tightening;
- focused host-safe policy checks: 35 passed, 5 skipped;
- broad host-safe suite: 657 passed, 1 skipped, 65 deselected, 75 subtests passed; only the three unchanged accepted failures remained (two Node/Pytest bridge-topology checks and the existing Backlog source-pin mismatch);
- source-mode Docker Tier-1 with `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env` and `--probe`: passed immutable-image launch, network absence, plugin checks, offline RPC discovery, teardown, and manifest publication at `.test-results/20261014T172001Z-94283-f4b0ce0a/tier1`; and
- `git diff --check`: passed before final commit preparation.

No live ownership transition, plan deletion/archive, lifecycle status change, merge, user-global apply, restart, finalization, resource cleanup, Step 7 deletion, or Step 5/6 behavior change occurred. Canonical ownership remains active version 1 and both active plan files remain present for separate candidate review and any revision.

## Accepted independent-review repair — mandatory ownership file cleanliness

Independent GPT-6 Astra review of candidate `b39900a1574bb070cacb8b17d69dddde32c2ed87` reproduced one material in-scope defect: canonical-main cleanliness treated the required untracked `.prime-claw/ownership.json` authority record as unrelated dirt, so a valid live version-1 Episode could never transition unless a repository happened to hide that file. The original fixture masked the defect with a test-only ignore rule.

The production guard now accepts either an otherwise empty status or exactly one untracked `.prime-claw/ownership.json` line. Every other tracked or untracked canonical-main change still fails closed. The transition fixture no longer adds an ignore rule and explicitly proves the required untracked ownership file is present while the success case proceeds; the existing unrelated-dirt case still rejects before mutation.

The reviewer also asked whether idempotent replay freezes the original transition heads and active-plan blobs. The approved constraint forbids a hidden transition receipt or additional ownership fields. The resolved interpretation is that the completed binding is the durable owner/Episode/task/resource binding. Exact replay performs no write only after fresh full validation of the caller-supplied current pushed heads, safe ancestry, exact source reference, task/plan equality, active pair, session, and resources. Wording that overclaimed every later safe head/plan as drift was corrected. The reviewer accepted this interpretation as non-defective.

Post-repair validation passed the focused transition/registration suite (51 passed) and exact-current-source Docker Tier-1 offline probe with immutable-image, network-absence, teardown, and manifest evidence at `.test-results/20261014T172001Z-94283-f4b0ce0a/tier1`. No live transition or lifecycle/resource mutation occurred.

## Accepted post-restart ownership-bridge repair — execute next

The operator accepted one bounded post-restart repair pass after the reviewed dormant bridge candidate. Before changing the candidate, integrate canonical `origin/main` commit `a577df50a299e501386f2c57ff6e5cecc4566834` into this Episode branch so the reviewed post-restart manifest state and explicit exact source-bundle recovery commits are ancestors of the repaired candidate.

Repair these two reproduced defects only:

1. **Ephemeral runtime-route refresh.** A full restart resumed the exact durable Episode session `01a133c6-0834-7465-8597-91cf46c0b19e` at runtime route `35add98ce00e`, while the retained version-1 record had named the pre-restart route `93aac01f2eb7`. `transition_spec_episode_to_task` must accept and atomically bind the verified current route only when exactly one idle durable session matches the Episode ID, session file, CWD/worktree, branch/resource identity, and owner, and the old route is absent. It must fail closed on ambiguity, concurrent or old live routes, foreign ownership, unavailable evidence, or durable drift. Ephemeral route refresh must not change durable Episode, session, worktree, branch, terminal, Orca, or owner identity. At handoff time canonical ownership remained active version 1 and already named current route `35add98ce00e`; implementation must re-read and validate live state rather than trust this observation.

2. **Ownership-first retained handoff.** Canonical retained-Episode handoff currently validates that the original future folder exists before consulting exact ownership. After promotion and merge, the exact persisted source folder is normally absent, producing `Invalid future-plan folder`. Ownership-first handoff validation must accept the exact persisted `sourceLocation` without requiring that obsolete promoted folder, while retaining strict location syntax, exact owner validation, the readable non-empty active root specification/execution-plan pair, and all Episode/worktree/branch/resource identity checks. No-ownership and foreign/mismatched-location paths must retain their existing fail-closed behavior.

Add focused regression tests for both defects. Update lifecycle and oversight documentation to distinguish an ephemeral runtime-route refresh from preservation of durable Episode/session/resource identity. Before presenting the repaired candidate, ensure the temporarily restored `.ralph/plans/future/replace-ralph-plans-with-backlog` pair is absent and prove that its absence does not affect the active root `.ralph/plans/SPECIFICATION.md` and `.ralph/plans/EXECUTION_PLAN.md` pair. At this handoff the obsolete source folder was absent and both active root files were present and non-empty.

Do not execute the live transition; delete the active root pair or any unrelated plan tree; alter `PRIMECLAW-10.38` status; publish `Ready for Merge`; merge; finalize; clean resources; retire generic legacy compatibility; or touch the preserved untracked canonical-main archive. This is a repair candidate only and requires focused validation, independent review, commit, and push before returning to the owning Conversation.

## Post-restart ownership-bridge repair candidate — completed

Integrated canonical `origin/main` commit `a577df50a299e501386f2c57ff6e5cecc4566834` through merge commit `d0fb9c1`, making the reviewed post-restart manifest and exact source-bundle recovery history ancestors of this candidate.

Implemented the two accepted repairs:

- ownership transition preflight now accepts a replacement runtime route only when exactly one durable session matches the recorded Episode ID, session file, exact worktree CWD, owner, branch, and resources; the session and full state are idle; and the recorded route is absent. Concurrent old routes, duplicate durable matches, missing routes, foreign ownership, identity drift, or unavailable evidence fail closed. The verified route is passed with the exact previous route into the low-level transition and is bound in the same atomic ownership-file replacement. Durable Episode, session ID/file, worktree, branch, head, terminal, Orca, operation, and owner identity remain unchanged;
- retained version-1 handoff now validates strict future-source syntax and exact persisted ownership before bundle storage, so the obsolete promoted future folder may be absent. Exact owner, active root plan pair, worktree, branch, session, route, and resource identity remain mandatory, and missing or mismatched ownership fails closed.

Focused Node validation passed 207/207 across transition, Episode, and public registration suites. Focused host policy validation passed 35 with 5 environment skips. Exact-current-source Docker Tier-1 passed immutable-image launch, network absence, plugin checks, offline RPC discovery, teardown, and manifest publication at `.test-results/20261014T195838Z-87657-4cdd8ad3/tier1`. `git diff --check` passed.

The temporarily restored `.ralph/plans/future/replace-ralph-plans-with-backlog` pair was removed again. The active root `.ralph/plans/SPECIFICATION.md` and `.ralph/plans/EXECUTION_PLAN.md` remain present and non-empty. Canonical ownership remains active version 1 for Episode `01a133c6-0834-7465-8597-91cf46c0b19e`; no live transition, lifecycle/status publication, merge to main, finalization, cleanup, or generic compatibility retirement occurred.

## Accepted canonical-main safety-guard revision — execute next

The operator accepted one narrowly bounded revision to the ownership-transition canonical-main safety guard. A committed main advancement is valid when canonical `HEAD` equals both its upstream and the exact reviewed expected main head. The guard must reject staged changes, tracked working-tree changes, and any in-progress merge, rebase, cherry-pick, or revert state, but it must not reject unrelated untracked paths.

Preserve every existing exact task-path, ownership, Episode, active-plan, ancestry, route/session/resource, and before-write revalidation guard. Add focused regression tests proving unrelated untracked paths pass while staged or tracked drift and each in-progress Git operation fails closed. Update only directly relevant documentation when needed.

Do not touch `.ralph/plans/archive/replace-beads/`; transition ownership; delete active or unrelated plans; change task lifecycle status; activate plugin assets globally; finalize; or clean resources. Complete one clean validated candidate, synchronize the exact target task plan to the active execution plan through the supported CLI before review, push it, and report evidence to the owning Conversation.

## Canonical-main transition safety guard — completed

Revised only the ownership-transition canonical-main safety guard. Canonical `HEAD` and upstream must still equal the exact reviewed expected main head. Porcelain status now permits any untracked path while rejecting every staged or tracked change. The Git adapter detects `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `rebase-merge`, `rebase-apply`, and `sequencer`; any matching operation fails before transition. Operation, head, upstream, and staged/tracked cleanliness are revalidated immediately before the sole ownership write. Episode cleanliness and all task-path, ownership, Episode, active-plan, ancestry, route/session/resource, and before-write ownership guards remain unchanged.

Focused regressions cover clean committed main, unrelated untracked paths, staged changes, tracked unstaged changes, merge/rebase/cherry-pick/revert and sequencer state, exact expected-head/upstream mismatch, and operation drift before write. Exact-current-source Node validation passed 210/210. Focused policy validation passed 35 with 5 environment skips. Docker Tier 1 passed immutable-image launch, network absence, checks, teardown, and manifest publication at `.test-results/20261016T144354Z-80085-a24d2404/tier1`. `git diff --check` passed.

No live ownership transition, plan deletion, task lifecycle status change, user-global activation, merge, finalization, cleanup, or protected archive modification occurred. Canonical ownership remains active version 1 and the active root plan pair remains present.

## Step 7 repository-local plan-tree deletion — completed

Completed the approved final data-cutover slice from pushed task-native checkpoint `cbd7b4f0b794f0b9520deb8f5d8b32f775559318`.

- Revalidated all 43 tracked `.ralph/plans` paths against frozen provenance commit `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`, 16 exact Backlog owners, and the complete task-native active plan/specification record.
- Deleted only those 43 tracked paths. The Episode now has no `.ralph/plans` directory or tracked plan path.
- Preserved generic version-1 compatibility sources, assets, commands, tools, ownership parsing/routing, recovery, and tests without modification.
- Preserved the protected untracked canonical-main `.ralph/plans/archive/replace-beads/` pair byte-for-byte.
- Recorded the complete durability and deletion receipt in `docs/evidence/task-native-backlog-cutover/2026-10-17-step-7-plan-tree-deletion.json`.

This candidate leaves `PRIMECLAW-10.38` `In Progress`. Ready-for-Merge publication, merge, finalization, cleanup, and user-global activation remain separate Conversation/operator actions.

## Step 8 — operator-directed least-technology simplification

Audit the full task-native implementation for deletion opportunities and produce one coherent clean pushed candidate. Preserve only the observable contract: exact task selection, one reusable Episode, Conversation-owned lifecycle decisions, explicit operator authority for merge, abandonment, and cleanup, generic version-1 compatibility, and no Prime Agent patch.

Prefer instructions in the existing Conversation, Episode, Expert, blocked, execute, and handoff prompts plus ordinary Git and the supported Backlog CLI. Remove custom state machines, multi-phase receipts/progress/replay machinery, content digests, redundant invariant layers, custom merge/recovery logic, and tests or documentation whose only purpose is that machinery unless a small code boundary is strictly required for durable resource ownership or a stable public tool surface.

Replace custom merge orchestration with a straightforward exact-candidate preflight, ordinary `git merge --ff-only`, supported Backlog status update to `Done`, exact task commit, and push; let Git report merge safety. Keep ownership/resource cleanup separate and operator-gated. Do not use ignore/config tricks or touch the protected untracked canonical-main `.ralph/plans/archive/replace-beads/` content.

Record a clear before/after machinery inventory and focused evidence that the simpler prompt-led flow satisfies the observable contract.

## Step 8 — least-technology task-native lifecycle completed

Removed the task-native review/outcome coordinator and replaced it with prompt-led Conversation decisions, ordinary Git, and supported Backlog operations. The public task-native host surface now covers only creation, same-Episode handoff, and separately authorized exact-resource cleanup. Merge uses fresh exact-candidate preflight, `git merge --ff-only`, `Done`, an exact task-only commit, and push. Abandonment uses exact task-only selection, truthful Final Summary/archive operations, an exact move commit, and push. Cleanup durably binds one exact pushed Episode head, removes runtime/worktree/branch in order, and closes ownership last.

Retained exact task selection, version-2 ownership reservation/allocation, one reusable Episode, generic version-1 compatibility and bundle digest, operator authority, and the no-Prime-Agent-patch boundary. Removed Ready receipts, multi-phase progress/replay objects, task-native content digests, custom merge/Done recovery, custom abandonment/archive recovery, and machinery-only tests/docs. The before/after inventory is `docs/evidence/task-native-backlog-cutover/2026-10-18-step-8-least-technology-simplification.md`.

This is a clean candidate only. It does not publish a lifecycle transition, merge to canonical main, abandon the task, clean Episode resources, apply user-global assets, or touch the protected canonical-main archive.

## Step 9 — restore observable Ready for Merge status gate with prompts only

The operator identified one in-scope contract defect in pushed simplification candidate `0930622f9be8ff015c0a03a79dbf5cdc1dce8431`: it removed the required observable `Ready for Merge` status transition and rewrote AC #9 instead of satisfying the approved contract through instructions.

Restore only that observable gate using the existing Conversation guide, ordinary Git, and the supported Backlog CLI:

1. After accepting an exact pushed candidate, the Conversation sets only the bound main task to `Ready for Merge`, verifies and commits only that path, and pushes.
2. In the exact idle Episode worktree, integrate current main with ordinary Git while preserving Episode-owned task content and applying the Conversation-authorized `Ready for Merge` status. Push and verify the refreshed exact candidate.
3. Show the operator the exact `(taskId, mainHead, candidateHead)` before a terminal choice.
4. Delay is a no-op.
5. Request Changes sets only the bound main task back to `In Progress`, commits/pushes that path, integrates current main in the same Episode with ordinary Git as needed, then uses existing task handoff.
6. Authorized Merge remains ordinary `git merge --ff-only`, followed by supported Backlog `Done`, an exact task-only commit, and push.

Update the task Description/AC #9 and directly relevant prompts, docs, and prompt/static tests. Do not restore any lifecycle tool/coordinator, Ready receipt, progress/replay object, task-native digest, custom merge/Done recovery, or custom abandonment/archive recovery. Preserve the pushed simplification, cleanup-only tool, generic version-1 compatibility, exact Episode resources, zero tracked `.ralph/plans`, and the protected canonical-main archive. Produce one clean validated independently reviewed pushed correction candidate, notify the owning Conversation and Ralph PVA, and stop. Do not merge, change lifecycle status live, clean resources, or apply user-global assets.

## Step 9 — observable Ready for Merge gate restored

Restored the required status gate entirely through the existing Conversation guide, ordinary Git, and the supported Backlog CLI. Candidate acceptance now publishes an exact main-task-only `Ready for Merge` commit, integrates that main head into the idle Episode with ordinary `git merge --no-edit` while preserving pre-merge Episode task content and applying only the authorized status, pushes and verifies the refreshed candidate, and shows the operator `(taskId, mainHead, candidateHead)`. Delay remains a no-op. Request Changes publishes only `In Progress`, performs the same bounded ordinary-Git integration as needed, and resumes through existing handoff. Merge remains fresh tuple preflight, `git merge --ff-only`, supported Backlog `Done`, exact task-only commit, and push.

No lifecycle coordinator, status publisher, receipt/progress/replay object, task-native digest, custom merge/Done recovery, or custom abandonment/archive recovery was restored.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 2026-10-13 — Backlog task-resolution foundation

Implemented the first bounded increment of execution-plan slice 1. `resolveBacklogTask` now invokes `backlog task view --json -- <task-id>` from the nearest project root, lets Backlog normalize supported IDs, consumes the supported v1 task-view envelope, and returns the canonical ID, title, status, optional Implementation Plan, project root, and contained regular task path. The seam rejects unsafe selector text and fails closed on command, schema, JSON, and path errors. It does not parse task Markdown or introduce a second task model.

Added focused Node fixtures for canonical shorthand resolution, exact command argv/CWD, supported fields, unsafe selection, nonzero command failure, malformed JSON, and escaped paths. Documented the seam and explicitly deferred public `/plan` activation until compatible lifecycle statuses and reconciled project workflow assets can land together.

Evidence:
- `python3 -m pytest tests/test_reviewed_plan_extension.py tests/test_future_plan_skills.py -q -m "not container"` — 20 passed, 5 deselected.
- `git diff --check` — passed.
- `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC probe, teardown, and manifest publication verified. Evidence: `.test-results/20261013T060350Z-97903-65a8f369/tier1`.
- The earlier full host-safe suite baseline produced 634 passed, 1 skipped, 65 deselected, and 75 subtests, with one unrelated existing policy assertion because `tests/test_runtime_connect.py` says `Offline` rather than the required literal `Offline:` or `host-safe`; this slice does not modify that file.

This foundation does not complete an acceptance criterion. Public task-native planning, task-native authoring, lifecycle status migration, `/implement-task`, ownership, and legacy bundle migration remain.

## 2026-10-13 — staged task-native planning policy assets

Added inert project-customizable `plan-task-prep` and `plan-task` workflows under new names. They define exact task-ID and `In Design`/`In Planning` checks, compact-first sole-follow-up behavior, proportional semantic readiness, native Implementation Plan mutation through Backlog CLI, exact task-only commit verification, non-gating push evidence, and the operator review stop. No command or tool loads them yet; the existing `/plan-spec` path and folder workflows remain unchanged until compatible lifecycle statuses can activate the task-native surface coherently.

Added the source assets, tracked builder-project copies, asset-inventory rows, and template-manifest entries. New assets have no truthful legacy predecessor, so `migrateFrom` is now optional in both the Python delivery validator and TypeScript project reconciler; declared legacy migrations retain their prior behavior. Independent review identified the initial required-field incompatibility and stale project-initialization inventory documentation. Direct loader/fresh-reconcile coverage and dynamic documentation coverage now protect the repair.

Evidence:
- `python3 -m py_compile scripts/manage-prime-agent-delivery.py` — passed.
- `python3 -m pytest tests/test_future_plan_skills.py tests/test_project_initialization.py::test_delivery_manifest_covers_every_shipped_source_once tests/test_project_initialization.py::test_builder_project_uses_regular_project_assets_and_no_legacy_skill_tree tests/test_project_initialization.py::test_project_initialization_docs_name_every_managed_workflow -q` — 19 passed.
- Isolated explicit-root `scripts/apply-prime-agent-plugin.sh` diagnostic — passed after the optional-migration repair; no host-global plugin was touched.
- Pre-repair Docker failure evidence: `.test-results/20261013T061848Z-39722-97b4ebcd/tier1` (`primary-command-failed` during plugin apply).
- Final `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC probe, teardown, and manifest publication verified. Evidence: `.test-results/20261013T062411Z-55643-de31915d/tier1`.

This slice does not complete an acceptance criterion. Public planning activation, lifecycle status migration, task-native authoring, `/implement-task`, ownership, and legacy bundle migration remain.

## 2026-10-13 — additive task-native planning activation

Activated `/plan TASK-ID` and `plan_task({"taskId":"TASK-ID"})` as additive task-native planning surfaces. Native admission resolves the exact operator input through Backlog's supported JSON view, accepts only `In Design` or `In Planning`, and passes the canonical returned ID into both preloaded project workflows. The shared compact-first chain preserves ordinary delivery for the command, `steer` for the tool, one sole `followUp`, preloading before either send, and explicit uncertainty after a failed second send. The semantic workflow independently reloads and rechecks identity/status before any task mutation.

Staged `In Design` and `In Planning` in `backlog/config.yml` while retaining `To Do` as both the temporary default and a selectable migration state. `/plan-spec`, `plan_spec`, `/implement-spec`, and all current folder-Episode mechanics remain live and unchanged. This slice does not add `/implement-task`, change ordinary task creation, migrate tasks, or claim real-session semantic mutation acceptance.

Updated planning/backlog/prep-chain docs, US-11/US-12 traceability, native RPC/tool discovery, command provenance checks, full disallowed-status behavior, canonical-ID binding, missing-workflow atomicity, and transitional config coverage. Independent review found no material defects.

Evidence:
- `node --experimental-strip-types --test tests/reviewed_plan_extension.test.mjs` — 17 passed.
- `python3 -m pytest tests/test_reviewed_plan_extension.py tests/test_future_plan_skills.py tests/test_tier1_driver.py -q -m "not container"` — 29 passed, 5 deselected.
- `deps/backlog/dist/backlog task view PRIMECLAW-10.38 --json` — passed against the transitional config.
- `git diff --check` — passed.
- Final `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC command/tool discovery, teardown, and manifest publication verified. Evidence: `.test-results/20261013T063848Z-99892-f5ef0597/tier1`.

Slice 1 remains open. Task-native authoring, retained real-session planning mutation evidence, final lifecycle-default migration, `/implement-task`, ownership conversion, and legacy bundle migration remain.

## 2026-10-13 — task-native specification authoring

Converted the managed `design` and `spec-it-out` source/project skills from creating new `.ralph/plans/future/` artifacts to one exact Backlog specification task. Both now create exactly one task with explicit `In Design` status when no task was selected, or revise only an exact operator-selected task already in `In Design`. They preserve their discovery-first versus synthesis-first postures while making Description, native Acceptance Criteria, References, and Documentation the living product contract. They do not write an Implementation Plan, mutate later statuses, allocate Episode resources, or authorize implementation.

Authoring now fails closed on ambiguous new-versus-existing intent and every later lifecycle state. A fresh create is one mutation attempt: uncertain exit/output/identity/reload evidence stops without blind retry. Successful creation or revision reloads the canonical task and contained regular path, verifies meaningful supported fields and `In Design`, commits only that path, attempts a prompt non-gating push, and stops for explicit operator specification review. Existing `/plan-spec`, `/implement-spec`, and folder Episode mechanics remain the bounded compatibility path for already-created bundles.

Updated required orientation and current operator documentation (`README.md`, `VISION.md`, and `LONG_RANGE_PLAN.md` included), managed template hashes, story documentation, and traceability. Independent review found stale authority documents, missing executable CLI/Git substrate evidence, and the uncertain-create retry gap; all findings were repaired. A disposable repository fixture now executes fresh create and existing revision through the vendored Backlog CLI, verifies native fields/status/path, proves exact task-only commits with an unrelated dirty path, and proves a failed push does not undo the local commit.

Evidence:
- `python3 -m pytest tests/test_future_plan_skills.py tests/test_project_initialization.py -q -m "not container"` — 22 passed, 3 deselected.
- `git diff --check` — passed.
- Final `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC probe, teardown, and manifest publication verified. Evidence: `.test-results/20261013T065752Z-55162-273d77d8/tier1`.

Slice 1 remains open. AC #2 remains unchecked because policy and the disposable substrate fixture do not replace retained real-session semantic authoring evidence. AC #3 likewise still awaits retained real-session planning mutation evidence. Final lifecycle/default migration, `/implement-task`, task ownership conversion, and legacy bundle migration remain.

## 2026-10-13 — staged task-native Episode-admission policy

Added inert, project-customizable `implement-task-prep` and `implement-task` workflow assets. The preparation policy binds one canonical operator-selected task, performs only a light `In Planning` plus meaningful native Implementation Plan sniff, and requests focused compaction once without controlling the independently queued semantic follow-up. The semantic policy reloads the exact task, rejects every non-`In Planning` state without mutation, applies the existing proportional readiness judgment, and permits exactly one future `create_task_episode(taskId=...)` call only after the approved specification and plan are implementation-ready.

The staged policy defines the trusted mechanical order without activating it: re-resolve the task; commit only its `In Progress` status change on main; persist one durable `provisioning` ownership reservation bound to the task and status-commit SHA; then create the branch, worktree, and session from that SHA. Prompt push failure alone does not block local creation. A proven clean failure before ownership/resource mutation returns the exact task to `In Planning`; any recorded, partial, or uncertain mutation publishes `Blocked`, preserves evidence/resources, and cannot be replayed as fresh creation.

The new assets are reconciled through the plugin inventory and project manifest with no invented predecessor. `/implement-task` and `create_task_episode` are deliberately unregistered until trusted task-native creation mechanics land. Existing `/implement-spec`, `create_spec_episode`, and folder Episode behavior remain live and unchanged. Updated project-initialization and Episode-promotion documentation plus policy, non-activation, ordering, source-copy, and fresh-reconciliation tests.

Independent review found that the first draft created the branch before the ownership reservation. The final policy repairs that material defect by reserving `provisioning` ownership before any branch/worktree/session creation and tests the required order.

Evidence:
- `node --experimental-strip-types --test tests/project_initialization_extension.test.mjs` — 28 passed.
- `python3 -m pytest tests/test_future_plan_skills.py tests/test_project_initialization.py -q -m "not container"` — 23 passed, 3 deselected.
- `git diff --check` — passed.
- Final `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC probe, teardown, and manifest publication verified. Evidence: `.test-results/20261013T071323Z-8630-3272b5af/tier1`.

Slice 1 remains open. This staged policy alone completes no acceptance criterion. Public `/implement-task`, trusted task-native creation and ownership mechanics, retained real-session authoring/planning evidence, and final lifecycle/default migration remain.

## 2026-10-13 — task-native ownership reservation foundation

Added the first bounded Slice 2 mechanics without activating public task admission. The ownership store now parses two strict, disjoint schemas: retained version 1 binds existing future-folder location/slug/bundle digest, while version 2 binds only the canonical Backlog task ID and project-relative task path plus existing lifecycle/resource fields. Version 2 requires an exact Git object ID in `baseRef`, rejects legacy identity fields and every unknown field, and therefore cannot carry copied plan, progress, or status authority.

Added internal `reserveTaskEpisodeOwnership`. It re-resolves the exact canonical task through the supported Backlog seam; requires current `In Progress` and a meaningful native Implementation Plan; verifies the resolved regular task remains in the same project; requires HEAD to be an exact Git status commit containing only that task path; rejects post-commit task changes; refuses every non-terminal ownership replay; and atomically writes one version-2 `provisioning` reservation bound to the status-commit SHA. The initial reservation contains no branch, worktree name/identity, session, terminal, automation, or assignment identity. Orca placement may be bound before allocation; no resource is created.

Retained version-1 `/implement-spec` behavior remains live. Folder admission and final bookkeeping fail closed on a version-2 collision. Conversation compaction can retain either folder or task identity. The new support file is included in the authoritative plugin asset inventory. `/implement-task`, `create_task_episode`, task-native allocation, clean rollback, and uncertain `Blocked` publication remain intentionally unregistered/unimplemented.

Independent review identified three material defects in the first draft: arbitrary version-2 fields could preserve shadow authority, a small exact-string placeholder regex admitted multiline/TODO-framed placeholder plans, and the first reservation persisted `worktreeName` too early. The final implementation uses exact per-version field allowlists, a lightweight multiline/Markdown placeholder-only rejection, and zero resource identity in the initial reservation.

Evidence:
- Focused Node command covering task ownership, retained folder creation, Conversation oversight, final bookkeeping, reviewed-plan behavior, and project initialization — 97 passed.
- Focused host-safe Python command covering discovery, extension policy, Conversation oversight, managed source inventory, and project initialization — 18 passed, 10 deselected.
- `git diff --check` — passed.
- Final `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC probe, teardown, and manifest publication verified. Evidence: `.test-results/20261013T074625Z-51506-443b013a/tier1`.

Slices 1 and 2 remain open. This inactive foundation completes no acceptance criterion. Next work must audit before choosing a bounded allocator or activation increment and must preserve folder compatibility and the transitional `To Do` configuration.

## 2026-10-13 — inactive task-native allocation after reservation

Added the next bounded Slice 2 mechanics without registering public task admission. Internal `allocateReservedTaskEpisode` consumes only the exact version-2 task/owner `provisioning` reservation. It derives non-authoritative branch, worktree, and session labels from the canonical task ID. The local path persists the expected worktree/branch identity before mutation, creates the worktree from the reserved task-only `baseRef`, verifies the clean worktree starts at that exact SHA, creates one durable exact-CWD Prime Agent session, and delivers one execute assignment containing the task ID. The Orca path re-resolves the exact reserved ready local setup, creates the worktree from the same `baseRef`, preserves the existing visible writable retained-tab binding flow, and embeds the task ID in the one automation assignment. Neither path copies a bundle, moves a plan, or creates a promotion commit.

Active task-native replay validates the exact task and owner, worktree/branch, Orca identity when applicable, durable session ID/file, and session CWD. It may reopen the same durable session with a task-derived name, but does not recreate resources or replay execute. A `provisioning` record that already contains any resource identity is treated as partial and becomes `uncertain`. Missing reserved placement and all failures after the durable reservation likewise preserve `uncertain` evidence and cannot replay as fresh allocation.

Independent review found that the first draft matched an active durable session by ID/file without also proving its CWD. The final allocator rejects a correct ID/file rooted in main or another checkout before reopen or assignment. The version-1 folder path remains unchanged.

Evidence:
- Focused Node command covering task allocation/reservation, retained folder creation, Conversation compaction, final bookkeeping, reviewed-plan behavior, and project initialization — 106 passed.
- Focused host-safe Python command covering discovery, policy, Conversation oversight, managed source inventory, project initialization, and staged workflow assets — 36 passed, 10 deselected.
- `git diff --check` — passed.
- Final `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC probe, teardown, and manifest publication verified. Evidence: `.test-results/20261013T081542Z-76164-4158db63/tier1`.

Slices 1 and 2 remain open. `/implement-task` and `create_task_episode` remain unregistered. Status mutation/commit, the combined reservation/allocation transaction, proven-clean rollback to `In Planning`, and Conversation-owned `Blocked` publication remain later work. This inactive allocator completes no acceptance criterion.

## 2026-10-13 — inactive trusted task-native admission transaction

Joined the existing task-native reservation and allocator behind one internal transaction without registering public task admission. `createTaskEpisode` accepts only the exact canonical task in `In Planning`, with a meaningful native Implementation Plan, a clean canonical task path, a persisted top-level owner Conversation, and no non-terminal project ownership. Before ownership or resource mutation, it changes the task to `In Progress` through the supported Backlog CLI, re-resolves exact identity/path/status, commits only that task path, verifies the commit path and post-commit cleanliness, and attempts a prompt non-gating push.

The transaction then reserves version-2 ownership against that exact status-commit SHA, runs the existing local or exact reserved Orca allocator, and returns only after strict parsing proves one durable active ownership record with the same task, owner, operation, and base SHA while the main task remains clean `In Progress` at that exact commit. Push failure is returned as transport evidence and does not block local allocation.

A failure with no ownership/resource mutation is classified only after re-reading ownership and task/Git state. It either leaves a proven unchanged `In Planning` task alone or commits one exact rollback to `In Planning`. Any durable, partial, uncertain, unreadable, or missing-active-postcondition outcome instead commits the task `Blocked`, appends the precise recovery condition to inspect `.prime-claw/ownership.json` and reconcile every recorded task/worktree/session identity, preserves all resources and evidence, and rejects fresh replay. Failure to publish rollback or `Blocked` is itself reported as an unreconciled recovery failure rather than claimed successful.

Disposable Backlog/Git fixtures execute the real vendored Backlog CLI and prove: status-only admission commit order and reservation SHA binding; non-gating push failure; unrelated dirty-path isolation; clean pre-reservation rollback; recovery from a failed first status commit; preflight rejection for wrong status, placeholder plan, dirty task path, and non-terminal ownership; `Blocked` plus recovery notes after uncertain allocation; no fresh replay; and `Blocked` publication when an allocator returns without durable active identity.

Evidence:
- Focused Node command covering admission, reservation/allocation, retained folder creation, Conversation compaction, final bookkeeping, reviewed-plan behavior, and project initialization — 113 passed.
- Focused host-safe Python command covering discovery, policy, Conversation oversight, managed source inventory, project initialization, and staged workflow assets — 36 passed, 10 deselected.
- Independent bounded review — no material findings.
- `git diff --check` — passed.
- Final `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC probe, teardown, and manifest publication verified. Evidence: `.test-results/20261013T090020Z-68646-c18d94ca/tier1`.

Slices 1 and 2 remain open. `/implement-task` and `create_task_episode` remain unregistered. Task-native placement selection, ephemeral readiness approval wiring, retained real-session authoring/planning evidence, and final lifecycle/default migration remain later work. This inactive transaction completes no acceptance criterion.

## 2026-10-13 — accepted follow-up revision after c690468

The accepted inactive admission transaction has one remaining in-scope defect before public activation: `createTaskEpisode` currently proves only that `ctx.cwd` is a Git repository root. A top-level session rooted in a linked worktree or other foreign checkout with no local ownership record could therefore mutate that branch task to `In Progress` and allocate a nested Episode, violating the Conversation-owned canonical-main status boundary.

Next execution must repair the trusted pre-mutation boundary so task-native admission proves it is running in the canonical primary main checkout before any Backlog edit, Git commit, ownership write, or allocator call. Add a disposable linked-worktree/foreign-checkout fixture whose task is eligible `In Planning` and whose checkout has no ownership record; it must prove zero task bytes, Git HEAD/status, ownership, and allocator mutation. Preserve the accepted transaction behavior, KISS scope, retained folder compatibility, and inactive public `/implement-task` / `create_task_episode` surface.

## 2026-10-13 — canonical primary-main admission boundary repair

Repaired the accepted inactive `createTaskEpisode` transaction before public activation. The trusted pre-mutation boundary now resolves the exact project checkout, rejects a linked Git worktree, and requires the primary worktree to be on `main` before task lookup, Backlog edit, commit, ownership access, reservation, or allocator invocation. The accepted task-only status transaction, non-gating push, reservation/allocation binding, clean rollback, uncertain `Blocked` publication, strict active postconditions, retained folder behavior, and inactive public surfaces are unchanged.

The disposable regression creates an eligible `In Planning` task in a linked worktree whose checked-out branch is `main`, leaves that checkout without a local ownership record, and also puts the primary worktree on another branch. Both calls reject at the canonical-checkout boundary. The test proves byte-identical task files in both checkouts, unchanged HEAD and worktree status in both checkouts, no in-memory or on-disk ownership, zero ownership operations, zero reservation calls, and zero allocator calls.

Evidence:
- Focused Node command covering admission, reservation/allocation, retained folder creation, Conversation compaction, final bookkeeping, reviewed-plan behavior, and project initialization — 114 passed.
- Focused host-safe Python command covering discovery, policy, Conversation oversight, managed source inventory, project initialization, and staged workflow assets — 36 passed, 10 deselected.
- Independent bounded review — no material findings.
- `git diff --check` — passed.
- Final `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC probe, teardown, and manifest publication verified. Evidence: `.test-results/20261013T091936Z-61769-1fbb9755/tier1`.

Slices 1 and 2 remain open. `/implement-task` and `create_task_episode` remain unregistered. Task-native placement selection and approval wiring, retained real-session authoring/planning evidence, and final lifecycle/default migration remain later work. This inactive repair completes no acceptance criterion.

## 2026-10-13 — staged task-native execute policy

Added the next bounded Slice 3 increment without registering `/implement-task` or `create_task_episode`. An execute assignment carrying `<operator-episode-task>` now binds the exact Backlog task as its sole durable authority. The policy reloads the canonical ID and returned task path, requires normal execution to remain `In Progress` with a meaningful Implementation Plan, and stops rather than selecting replacement work when identity, path, parent, or status changes.

The Episode may update only its task content in its own worktree through supported Backlog CLI operations: in-scope plan refinements, Implementation Notes, acceptance evidence/check state, references, documentation, modified files, and Final Summary. It may not pass `--status`, complete or archive the task, mark `Blocked`, `Ready for Merge`, or `Done`, or perform cross-checkout copy, mirroring, or dual write. Blocked work must record the exact blocker/attempts/evidence/unblock condition, verify identity and unchanged status, commit the exact durable checkpoint plus only safe in-scope resumable changes, push, and report commit/push evidence before stopping. A complete candidate likewise remains `In Progress` and is committed/pushed for Conversation review. Assignments without a task block retain the existing folder-plan execute workflow.

The source execute template, tracked `.agents` copy, and `.prime-claw/templates.json` hashes are synchronized. A disposable CLI fixture proves supported plan, notes, acceptance-check, and modified-file updates preserve canonical ID, task path, parent, and `In Progress` status; an unrelated dirty path remains untouched and the task can be committed exactly. Independent review found one material gap in the first draft: blocked task evidence was not required to be committed and pushed. The final policy adds that gate and a static regression; repair review found no material findings.

Evidence:
- Focused task execute/backlog policy checks — 9 passed.
- Host-safe Python checks covering execute, Backlog workflow, task policies, initialization, reviewed-plan discovery, and managed protocol — 40 passed, 9 deselected.
- Focused Node checks covering initialization, retained folder Episodes, task allocation/admission, and exact task ownership — 70 passed.
- `git diff --check` — passed.
- Final `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC probe, teardown, and manifest publication verified. Evidence: `.test-results/20261013T094041Z-49232-6f8646b6/tier1`.

Slices 1 through 3 remain open. Public task admission, placement/approval wiring, task-native handoff/block/resume/review/finalization mechanics, retained real-session evidence, and final lifecycle/default migration remain later work. AC #2, #3, #6, #7, and #8 remain unchecked; this staged policy alone completes no acceptance criterion.

## 2026-10-13 — inactive task-native Episode continuation

Added the next bounded Slice 3 increment without registering public `/implement-task`, `create_task_episode`, task-native handoff, or task-native finalization surfaces. Internal `handoffTaskEpisode` now continues only the exact active version-2 Episode owned by the top-level Conversation from the canonical primary `main` checkout. It requires the bound task to resolve to the exact recorded ID/path both on main and in the Episode worktree, requires both copies to remain `In Progress` with meaningful Implementation Plans, requires a clean owned worktree with matching Git and optional Orca identity, and requires the durable session ID/file and exact worktree CWD plus a fully quiescent route before delivery.

The same `<operator-episode-task>` binding is appended to canonical handoff and the sole queued execute follow-up. Operator or accepted in-scope focus appears only in handoff. A stale active route may reopen the same durable session and update only active routing identity; continuation does not create or replace a worktree, session, assignment, ownership record, or other resource. It rejects `Blocked` until the Conversation publishes a truthful resumed `In Progress` state and rejects `Ready for Merge` until the later constrained final-integration handshake exists. Identity/path/plan drift, non-active ownership, a dirty Episode checkout, a foreign durable-session CWD, or noncanonical caller checkout reject before delivery.

The managed handoff workflow now selects task mode only from exactly one `<operator-episode-task>` block. Task mode treats the bound Backlog task as sole durable authority, uses supported task edits only in the Episode worktree when genuinely needed, keeps lifecycle status Conversation-owned, and never consults `.ralph/plans` or copies task content across checkouts. With no task block, the existing folder-plan handoff remains operational. The retained `handoffSpecEpisode` public tool is unchanged. Source/project workflow copies and `.prime-claw/templates.json` hashes match.

Evidence:
- Focused task handoff mechanics and policy — 48 Node tests and 23 host-safe Python checks passed, with 2 container cases deselected.
- Broader handoff/admission/initialization/review compatibility — 115 Node tests and 41 host-safe Python checks passed, with 11 container cases deselected.
- Independent bounded review — no material findings.
- `git diff --check` — passed.
- Final `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe` — passed; immutable image, offline RPC probe, teardown, and manifest publication verified. Evidence: `.test-results/20261013T100557Z-41220-9a097e6b/tier1`.

Slices 1 through 3 remain open. Public task admission/handoff/finalization, Conversation-owned Blocked/resume publication, oversight and Expert task authority, Ready-for-Merge integration, operator decision outcomes, abandonment/finalization, retained real-session evidence, and final lifecycle/default migration remain. AC #2, #3, #6, #7, and #8 remain unchecked; this inactive continuation seam alone completes no acceptance criterion.

## 2026-10-13 — accepted continuation preflight revision after b1f49bf

The accepted inactive task-native continuation has one remaining in-scope defect before public activation: `handoffTaskEpisode` resolves the main task from working-tree bytes but does not prove the exact main task path matches its committed state. A committed `Blocked` or `Ready for Merge` task can be edited locally and uncommitted back to `In Progress`, allowing ordinary continuation before the Conversation has truthfully published the status commit.

Next execution must require the exact main task path to be clean against HEAD before any route reopen, ownership refresh, handoff, or execute delivery, while allowing unrelated dirty main paths. Add a regression with committed non-resumable status plus dirty task-path bytes that resolve as `In Progress` and prove zero reopen, ownership refresh, handoff, or execute delivery. Also prove unrelated main dirt does not block valid continuation. Preserve the otherwise accepted continuation behavior, retained folder compatibility, and inactive public task admission/handoff/finalization surfaces.

## 2026-10-13 — completed exact main task-path HEAD guard

Repaired the accepted inactive-continuation preflight defect recorded after `b1f49bf`. After resolving and matching the exact main task, `handoffTaskEpisode` now checks path-scoped Git status for only the recorded task path and requires it to match committed HEAD before status/plan acceptance, route reopen, ownership refresh, handoff, or execute delivery. Unrelated dirty paths in the canonical main checkout remain allowed.

The regression creates a real Git commit whose task status is `Blocked`, changes only that task's working-tree bytes to `In Progress`, verifies the committed and dirty views differ, and proves zero reopen, ownership refresh, handoff, or execute delivery. A companion regression proves an unrelated uncommitted main path does not block valid continuation. The accepted task-bound prompts, strict ownership/session/worktree checks, folder compatibility, and inactive public `/implement-task`, `create_task_episode`, task handoff, and finalization surfaces are unchanged.

Evidence:
- Focused continuation validation: 50 Node tests passed; 23 host-safe Python checks passed with 2 container cases deselected.
- Broader handoff/admission/initialization/review compatibility: 117 Node tests passed; 41 host-safe Python checks passed with 11 container cases deselected.
- Independent bounded review: no material findings.
- `git diff --check`: passed.
- `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe`: passed; immutable image, offline RPC probe, teardown, and manifest publication verified at `.test-results/20261013T102307Z-99098-156da715/tier1`.

No acceptance criterion is newly claimed. AC #2/#3 still require retained real-session authoring/planning evidence. AC #6/#7/#8 still require retained end-to-end task Episode lifecycle evidence. Public task Episode surfaces remain inactive.

## 2026-10-13 — staged task-native oversight and Expert authority

Converted the managed Conversation oversight and independent Expert review policies to select one disjoint durable authority from ownership. Version 2 binds supervision and review to the exact Backlog task ID/path, parent identity, candidate commit, and supported task fields as the sole durable contract. It never consults `.ralph/plans`, substitutes a related task, or copies/mirrors Episode-owned task content from the Conversation checkout. Retained version 1 keeps its exact approved specification/plan folder.

The Conversation guide remains judgment-only. It preserves the four bounded dispositions, recorded acceptance evidence, canonical exact-owner handoff, operator-only product/merge/abandonment/cleanup authority, non-adversarial review boundary, and goals/heartbeat discipline. The Expert workflow remains read-only and evidence-only and retains its native RLM bootstrap/message/observe/delete lifecycle. The post-compaction hook still reinjects the full guide only for the exact active owner.

Evidence:
- Focused oversight/Expert policy: 6 passed.
- Broad host-safe policy, installation, initialization, and discovery compatibility: 31 Python passed with 43 container cases deselected; 56 Node passed.
- `git diff --check`: passed.
- Independent remaining-gap audit: endorsed this as the smallest coherent next dependency.
- Independent bounded diff review: no material findings.
- `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe`: passed; immutable image, offline RPC probe, teardown, and manifest publication verified at `.test-results/20261013T103834Z-65715-7dcc0310/tier1`.

This policy-only slice registers no task-native command/tool and changes no lifecycle state. Public `/implement-task`, `create_task_episode`, task handoff, and task finalization remain inactive. Placement/approval wiring, Conversation-owned `Blocked`/resume publication, Ready-for-Merge integration, operator decision mechanics, task-native finalization/abandonment, retained real-session evidence, and final migration remain later work. No acceptance criterion is newly claimed; AC #2/#3 and #6/#7/#8 still require their retained real-session or end-to-end evidence.

## 2026-10-13 — staged inactive task placement and ephemeral implementation approval

Added the deterministic compact-first task admission seam without registering `/implement-task` or `create_task_episode`. Before either workflow message, it resolves the exact `In Planning` task and one exact ready local Orca setup through sole selection, explicit stable ID, or the native picker. Zero ready setups, remote selection, noninteractive ambiguity, cancellation, malformed or rejected inventory, and other inventory failures stop before workflow delivery or any task, Git, ownership, worktree, session, or resource mutation. Direct local fallback is allowed only when the production `orca` command is absent (`ENOENT`) and no explicit host was requested. Retained folder inventory/fallback behavior is unchanged.

Only after exact placement and both workflow messages succeed does the seam grant one in-memory approval. It binds the owner session, canonical task ID/path and project root, and exact placement. It is unavailable during the prep turn, becomes usable for the semantic turn after the first phase boundary, requires the same re-resolved task, is removed by one exact consume, and clears on phase end, session start, or shutdown. The complete ordinary oversight guide precedes the `implement-task` semantic workflow. The trusted task-creation transaction remains disconnected and every public task Episode surface remains inactive.

Evidence:
- Focused reviewed-plan/task-admission validation: 32 Node tests passed.
- Broad compatibility: 107 Node tests passed; 43 host-safe Python checks passed with 43 container cases deselected.
- `git diff --check`: passed.
- Independent review found one material defect: production task placement inherited overbroad retained Orca-unavailable classification. The accepted repair added a strict task-placement inventory path that permits fallback only for process `ENOENT`, propagates malformed/negative/other failures, and leaves retained behavior unchanged.
- Repair rereview: no material findings.
- `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe`: passed; immutable image, offline RPC, teardown, and manifest publication verified at `.test-results/20261013T110322Z-62776-06322ace/tier1`.

This staged dependency changes no task lifecycle state and claims no acceptance criterion. Conversation-owned `Blocked`/resume publication, `Ready for Merge` integration, operator decision mechanics, task-native finalization/abandonment, coordinated activation, retained native receipts, and final migration remain later work. AC #2/#3 and #6/#7/#8 still require their retained real-session or end-to-end evidence.

## 2026-10-13 — staged inactive Conversation-owned Blocked publication and resume

Added exact task-native blocker lifecycle mechanics without registering a public task lifecycle or handoff surface. `publishTaskEpisodeBlocked` and `publishTaskEpisodeResumed` require active version-2 ownership, the exact persisted top-level owner in canonical primary `main`, matching canonical task ID/path and meaningful plans in both checkouts, clean committed main task bytes, Episode status still `In Progress`, a clean exact reported Episode head that equals its upstream head, and committed post-admission task-path evidence. They mutate status only through supported Backlog operations and commit only the exact main task path. Unrelated main dirt is allowed. Main push is best-effort evidence after the authoritative local commit. No Episode-owned content crosses checkouts.

After resumed `In Progress` publication, existing `handoffTaskEpisode` revalidates committed main `HEAD` and continues the same ownership, branch, worktree, and durable session. The tested sequence creates no task, admission, resource, or assignment. The managed blocked skill now selects durable ownership before prompt text: active version-2 ownership forces task mode for the exact owner Conversation even without `<operator-episode-task>`; a task block is only a candidate binding; Episode, foreign-owner, non-active, and mismatched contexts fail closed. Only no version-2 record and no task block permits retained `.ralph/plans/blocked` restoration. Source/tracked bytes and managed hashes match.

Evidence:
- Initial focused validation: 70 Node tests and 32 host-safe Python checks passed with 3 container cases deselected.
- Independent review found one material defect: the owning Conversation had no tagged blocked assignment and could enter retained folder mode. The accepted repair added production `resolveBlockedWorkflowAuthority`, made lifecycle publication consume it, aligned policy/docs/hashes, and added an owner-Conversation-versus-Episode behavioral routing fixture.
- Repair-focused validation: 71 Node tests and 32 host-safe Python checks passed.
- Final broad compatibility: 144 Node tests and 55 host-safe Python checks passed with 45 container cases deselected; `git diff --check` passed.
- Repair rereview: no material findings.
- `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe`: passed; immutable image, offline RPC, teardown, and manifest publication verified at `.test-results/20261013T112716Z-81931-e0b2a21c/tier1`.

This staged slice changes no live task Episode lifecycle because every public task admission/lifecycle/handoff/finalization surface remains inactive. It claims no acceptance criterion. In particular, AC #8 still requires retained end-to-end Episode evidence. `Ready for Merge` integration, operator outcomes, task-native close/abandonment, coordinated activation, retained native receipts, and final migration remain later work.

## 2026-10-13 — staged inactive Ready-for-Merge integration handshake

Added the internal final-review handshake without registering a public task lifecycle, integration, or handoff surface. From an accepted exact pushed `In Progress` candidate, `publishTaskEpisodeReadyForMerge` requires active version-2 ownership, the exact persisted top-level owner in canonical primary `main`, exact task ID/path/parent and meaningful plan, committed task bytes in both checkouts, and the accepted local/upstream Episode head with post-admission task evidence. It uses supported Backlog status mutation and commits only the exact main task path as `Ready for Merge`; unrelated main dirt remains allowed and push failure is returned as best-effort evidence after the authoritative local commit.

`integrateTaskEpisodeReadyForMerge` requires the same owned durable Episode, branch, worktree, and session to be exact, clean, and idle. It proves current main contains the status commit and the accepted Episode head is still local and upstream. Conflicts outside the exact task abort. In the Episode worktree it restores the accepted task from the Episode parent and uses Backlog to apply only `Ready for Merge`. A supported task-view digest preserves every task-owned field plus exact path and parent while excluding lifecycle status, volatile update time, and derived readiness/dependency/subtask/acceptance-count projections. The refreshed commit must have exactly the accepted candidate and current main as parents. The branch is pushed; no handoff, admission, session, worktree, resource, or assignment is created.

`verifyTaskEpisodeReadyForMerge` then requires main not to have advanced, the exact refreshed local/upstream head, clean worktree, exact parents and ancestry, unchanged task path/parent/content digest, and `Ready for Merge` in both checkouts. Policy permits calling the candidate ready or requesting the separate operator merge decision only after this verification. Ordinary task handoff continues to reject `Ready for Merge`.

Evidence:
- Focused: 80 Node tests and 18 host-safe Python checks passed with 3 container cases deselected; `git diff --check` passed.
- Broad: 153 Node tests and 59 host-safe Python checks passed with 45 container cases deselected; `git diff --check` passed.
- Independent review: no material findings.
- `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe`: passed; immutable image, offline RPC, teardown, and manifest publication verified at `.test-results/20261013T115543Z-40109-e5bf6466/tier1`.

This slice implements no delay, request-changes, merge, `Done`, abandonment, finalization, cleanup, coordinated activation, or migration mechanics. All public task Episode surfaces remain inactive. It claims no acceptance criterion; AC #8/#9 still require retained end-to-end and refreshed-candidate receipts.

## 2026-10-13 — staged inactive reversible operator outcomes

Added only Delay and Request Changes behind the deliberately unregistered task-native review boundary. `delayTaskEpisodeReadyForMerge` requires the explicit Delay decision, re-verifies the exact still-current Ready-for-Merge publication/integration/verification evidence and same idle Episode, then returns `delayed` without a status edit, merge, push, handoff, resource mutation, or other state transport. Main remains `Ready for Merge`; the refreshed candidate, ownership, branch, worktree, durable session, and resources remain exact. Delay is not abandonment.

Request Changes is split into four retryable phases. `publishTaskEpisodeChangesRequested` requires the explicit operator decision, exact owning top-level Conversation in canonical primary `main`, still-current verified refreshed candidate/main, and the same idle Episode; it commits only the exact main task from `Ready for Merge` to `In Progress`, with push retained as best-effort evidence after the authoritative local commit. `integrateTaskEpisodeChangesRequested` reuses the constrained review integration: current main is merged into the same active clean idle Episode, conflicts outside the task abort, Episode-owned content is restored, only `In Progress` is applied through Backlog, content digest/path/parent identity remain exact, and a two-parent candidate is pushed. `verifyTaskEpisodeChangesRequested` requires current main, exact local/upstream head, parents and ancestry, content/hierarchy, and status. Only `resumeTaskEpisodeChangesRequested` then invokes canonical task handoff; no admission, branch, worktree, session, resource, or assignment is duplicated.

Independent review found one material recovery defect: after the request integration created its merge commit, a transient Episode push failure left local HEAD advanced and made integration non-retryable. The accepted repair idempotently recognizes only the exact clean existing candidate with parents `[returned publication base, current main]`, exact target status/content/path/parent digest, and upstream at either the base or candidate. It retries or confirms only that candidate push and returns the same integration evidence without another status commit, merge, admission, resource, assignment, or journal. Tests cover fail-once push recovery followed by verification/handoff with exactly one reversal and one request merge, persistent push failure with no handoff, and retry after pre-commit merge failure.

Evidence:
- Initial focused: 76 Node tests and 11 host-safe Python checks passed; `git diff --check` passed.
- Independent review: one actionable P1 retry finding; accepted repair implemented.
- Repair-focused: 78 Node tests and 4 policy checks passed; rereview found no material findings.
- Final broad: 163 Node tests and 59 host-safe Python checks passed with 45 container cases deselected; `git diff --check` passed.
- `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe`: passed; immutable image, offline RPC, teardown, and manifest publication verified at `.test-results/20261013T122422Z-16240-2b8e093d/tier1`.

This slice adds no merge authorization, merge, `Done`, abandonment, finalization, cleanup, coordinated activation, or migration mechanics. Public task Episode surfaces remain inactive. It claims no acceptance criterion; AC #8/#9 still require retained end-to-end, refreshed-candidate, and operator-outcome receipts.

## 2026-10-13 — staged inactive exact Merge and Done publication

Added the unregistered terminal accepted-candidate seam only; this did not merge the live Episode or change its task status. `mergeTaskEpisodeReadyForMerge` accepts an explicit operator Merge decision only when it binds the exact task, verified canonical-main head, and pushed refreshed candidate from one coherent Ready-for-Merge handshake. It revalidates canonical primary `main`, the exact active owner, idle durable Episode/Orca identity, candidate upstream, content digest/path/parent/status, two-parent ancestry, and the exact Ready publication commit in verified main history. Canonical main must have the exact upstream and no unrelated dirty state. Integration is exact fast-forward only, never force/rebase/substitute merge. Backlog then changes only the exact task to `Done`; its one-path commit must directly parent the candidate. Final verification proves merged code, task digest/path/parent/status, and unchanged active ownership, branch, worktree, durable session, and resources. The local verified `Done` commit is authoritative; push failure, upstream lookup error, or observed mismatch is returned as transport evidence.

Journal-free recovery accepts only four exact states: original main + `Ready for Merge`; exact candidate + `Ready for Merge`; candidate plus only the bound modified/staged task already at exact `Done`; or one exact task-only `Done` child. It resumes the missing fast-forward, commit, verification, or transport without duplicate lifecycle mutation. Extra paths, rename/delete/untracked state, wrong task fields, stale ancestry/main, or unpushed candidate fail closed. Raw NUL-delimited porcelain parsing preserves leading Git status columns; real disposable tests cover clean, ` M`, `M `, `MM`, extra, untracked, and rename states.

Independent review found and drove repairs for post-fast-forward replay, post-`Done` best-effort transport, the dirty/staged mutation window, missing Ready-publication ancestry, and production raw-Git parsing. Final rereview reported no material findings. Evidence: 101 focused Node tests and 4 policy checks passed; final broad 186 Node and 59 host-safe Python tests passed with 45 container cases deselected; `git diff --check` passed; source-mode Docker Tier-1 passed at `.test-results/20261013T130723Z-39269-445a6588/tier1` with immutable image, offline RPC, teardown, and manifest publication verified.

No abandonment, finalization, cleanup, public activation, or migration was added. No acceptance criterion is newly claimed; AC #8/#9 still require retained end-to-end, refreshed-candidate, and operator-outcome receipts.

## 2026-10-13 — staged inactive confirmed abandonment

Added only the unregistered explicit abandonment seam; this did not abandon the live Episode, change its status, archive its task, or clean resources. `abandonTaskEpisode` requires operator confirmation bound to the exact active owner, task path, canonical-main head and captured non-`Done` status, pushed idle Episode head, candidate/main relationship, invariant parent, Episode-content digest, and normalized truthful Final Summary. Main/upstream and Episode head/upstream must remain exact. Before mutation, active and completed records are resolved through supported structured Backlog task view and rejected if inbound dependencies or exact task references would make archive rewrite another task. Identity comparison matches Backlog case, prefix, dotted-numeric, leading-zero, and whitespace semantics.

Git selects only the Episode task blob, never Episode code. Supported Backlog edit reapplies the captured Conversation status and Final Summary. Structured semantics and a normalized file digest prove all Episode-owned content remains exact while excluding only path, lifecycle/update metadata, and abandonment summary. The seam creates the canonical archive directory when absent, invokes supported `backlog task archive`, accepts only the exact active-delete/archive-add or staged rename state, and commits a direct two-path child without `Done`. Because supported `task view` intentionally cannot resolve archived tasks, post-archive verification uses the regular archived file, normalized digest, exact Git parent/paths, clean tree, and unchanged active ownership/resources. Local verified archival state is authoritative; final transport failure is evidence. Journal-free replay accepts only exact task preparation, archive move/stage, or direct archival child. Cleanup remains separately authorized.

Actual vendored-CLI fixtures cover missing archive directory, archived-task invisibility, exact byte move, active dependency and completed reference rejection, plus `PRIMECLAW-01`, case, and whitespace aliases. A real Git fixture proves task-only selection and no code import. Independent review found and drove repairs for archived lookup, missing directory, path digest, inbound cleanup, and alias identity; final rereview reported no material findings. Evidence: 118 focused Node tests and 4 policy checks; final broad 203 Node and 59 host-safe Python tests with 45 container cases deselected; `git diff --check`; source-mode Docker Tier-1 `.test-results/20261013T140634Z-37005-1a3b77c9/tier1` with immutable image, offline RPC, teardown, and manifest publication verified.

No actual abandonment, `Done`, finalization, cleanup, public activation, or migration occurred. No acceptance criterion is newly claimed; AC #8/#9 still require retained end-to-end and operator-outcome receipts.

### Accepted follow-up revision — preflight tracked archive-destination collision

The next execute pass must repair one in-scope abandonment edge case before any canonical-main task restore, Backlog edit, or archive mutation. Compute the exact archive destination and fail closed if it already exists from tracked history. Backlog deliberately reuses archived IDs; with a reused ID and the same title, the vendored `backlog task archive` currently succeeds while replacing the historical archive file, leaving active `D` plus archive `M` only after mutation. Preserve the existing exact task-preparation, archive-move/stage, and committed-child recovery paths, where the destination is expected as part of the authorized partial state. Add a real vendored-CLI clean-Git regression proving rejection occurs before mutation, historical archive bytes remain identical, the active task remains present, and main remains clean. Keep this repair inside Prime Claw; do not patch Backlog or add recovery machinery or scope. The accepted base checkpoint is the actual clean pushed commit `039d4d204d0c2b3bb636be971161c96d30ba5409`.

### Implemented follow-up — tracked archive-destination collision guard

The inactive abandonment seam now computes the exact canonical archive destination and rejects it when it was already tracked at the bound main head, before cleanup preflight, main-state classification, task selection, Backlog edit, or archive mutation. `TaskEpisodeAbandonmentGit.pathTrackedAtRef` uses raw NUL-delimited `git ls-tree -z --name-only` output so Git quoting cannot hide Unicode task paths. Binding the check to the pre-abandonment main head preserves the authorized exact task-preparation, archive-move/stage, and direct archival-child recovery states because their destination was absent from that history.

A real vendored-CLI clean-Git fixture archives `PRIMECLAW-1`, commits the historical file, reuses the ID with the same Unicode title `Reusable Café`, commits the active task, and proves the production guard rejects before mutation while historical archive bytes remain identical, the active task remains present, and main stays clean. Unit evidence proves the guard precedes selection and a collision performs no select, Backlog edit, archive, or commit. Independent review found one material `core.quotePath` Unicode bypass in the initial implementation; raw `-z` parsing repaired it and final rereview reported no material findings.

Final evidence: 119 focused Node tests and 4 policy checks; 204 broad Node tests and 59 host-safe Python checks with 45 container cases deselected; `git diff --check`; source-mode Docker Tier-1 `.test-results/20261013T143741Z-33220-7f0043db/tier1` with immutable image, offline RPC, teardown, and manifest publication verified. No actual abandonment, status change, archive, `Done`, finalization, cleanup, public activation, vendor patch, migration, or new recovery machinery occurred. No acceptance criterion is newly claimed.

### Accepted next dependency — inactive task-native finalization and cleanup

The operator accepted clean checkpoint `4588abcd60f78b0ccb40241d296c1003a885642a`, including the complete inactive abandonment slice and archive-collision repair. The next bounded execute pass is the already-approved inactive task-native finalization/cleanup dependency. Keep all public task-native surfaces inactive. Preserve separate explicit operator authority for destructive cleanup, retained ownership and every Episode resource until authorized terminal work is verified, exact task/Episode identity, and the current lifecycle boundaries. Add no unrelated scope.

### Implemented slice — inactive task-native finalization and cleanup

Added the internal unregistered `finalizeTaskEpisodeCleanup` coordinator with a required injected host adapter. A separate explicit Cleanup decision binds the exact task/path, owner Conversation, terminal Episode head/outcome/commit, durable session/route, worktree/branch, and every optional local or Orca resource. It re-verifies canonical main/upstream and either the pushed one-task Merge/`Done` child or pushed non-`Done` Abandon/archive child before deletion; abandonment results now retain the verified archived-file digest.

Cleanup accepts only exact monotonic states: all resources present, runtime absent, worktree absent, or all absent. It removes exact idle runtime, worktree, and branch in order and verifies each boundary. Ownership remains active across interruption and becomes inactive only after every bound resource is absent. Exact partial-prefix retry and inactive replay are idempotent. Busy, dirty, foreign, mixed, unpushed, drifted, unsafe-gap, provisioning, and uncertain states fail closed.

Independent review found two material defects. The first bound cleanup to the stale allocation-time ownership head; the repair explicitly binds the terminal Episode head, proves admission-base ancestry while resources exist, and uses that head for worktree/branch identity. The second made all-absent abandonment replay depend on the deliberately deleted Episode ref; stage 3 now skips only that impossible ancestry check while preserving canonical-main terminal proof. Final rereview found no material findings.

Final evidence: 132 focused task-native Node tests, 4 retained close tests, and 4 oversight policy checks; 217 broad Node tests and 59 host-safe Python checks with 45 container cases deselected; `git diff --check`; Docker Tier-1 `.test-results/20261013T153144Z-87272-78cdefce/tier1`. No actual cleanup, finalization, resource deletion, merge, abandonment, status change, public activation, host adapter, vendor/Prime Agent patch, migration, or new acceptance claim occurred. Live ownership/resources remain unchanged.

### Accepted next dependency — coherent task-native public activation and host adapter

The operator accepted clean checkpoint `e3266cafb426c291579c6206c5e987e466d4e160`, including the complete inactive task-native lifecycle mechanics through finalization and cleanup. The next bounded execute pass is the already-approved coherent task-native public activation plus its required host cleanup adapter. Preserve retained folder compatibility until final migration/cutover, exact task/Episode ownership, operator authority for merge, abandonment, and destructive cleanup, supported Prime Agent and Backlog interfaces, Docker-only plugin validation, and no unrelated scope.

### Implemented slice — public task-native activation and production cleanup host

Activated the coherent guarded task-native product surface beside retained folder compatibility: `/implement-task`, `create_task_episode`, `handoff_task_episode`, and the single `finalize_task_episode` coordinator. Task creation consumes one exact ephemeral approval and bound placement once. The lifecycle coordinator preserves exact phase receipts across retryable status/integration failures, never retries uncertain handoff transport, requires explicit operator decisions for Delay, Request Changes, Merge, and Abandon, and requires a separate explicit Cleanup decision with exact terminal evidence. Unpushed abandonment replays only from its returned decision/evidence.

Added `CliTaskEpisodeCleanupAdapter` over supported Prime Agent daemon, Orca CLI, and Git boundaries. It verifies exact session route/ID/file/CWD and idleness, rejects untracked or colliding sessions, rechecks clean worktree/branch/head identity at mutation edges, and closes its owned daemon connection. Task-native Orca activation inventories every retained fallback/default and primary Prime terminal. Cleanup permits only that exact set and delegates PTY stop proof to exact non-force Orca worktree removal before branch cleanup. Ownership closes only after every exact resource is absent.

Independent architecture and cleanup reviews found material recovery, authority, collision, mutation-edge, daemon-lifetime, and normal Orca-topology defects. Every finding was repaired; final rereviews reported no material findings. Retained `/plan-spec`, `/implement-spec`, `plan_spec`, `create_spec_episode`, `handoff_spec_episode`, and `finalize_spec_episode` remain active until explicit final migration/cutover.

Final evidence: 181 focused Node lifecycle/cleanup tests; 4 focused oversight-policy checks; 228 broad Node tests; 59 host-safe Python checks with 45 container cases deselected; `git diff --check`; source-mode Docker Tier-1 at `.test-results/20261013T164613Z-92027-eedd4a14/tier1` with immutable image, offline RPC probe, verified teardown, and published manifest.

No live Episode transition, merge, abandonment, finalization, cleanup, resource deletion, plugin activation, migration, or cutover occurred. `PRIMECLAW-10.38` remains `In Progress`; live ownership/resources are unchanged. No acceptance criterion is newly claimed: AC #2/#3/#6/#7/#8/#9 still require their retained real-session receipts.

### Accepted next dependency — ordered managed-asset and documentation cutover preparation

The operator accepted pushed checkpoint `afe284cf7ffe7917e5c63221a60c166fde66f126`, including coherent task-native public activation and the supported production cleanup-host adapter. The intervening daemon restart preserved the exact active owner, saved session file, worktree, branch, clean Episode head, and upstream equality.

The next execute pass must take the smallest coherent already-approved prerequisite from ordered plan step 4, **Reconcile managed assets, current documentation, and traceability**. First re-audit what remains after the activation slice, then implement one bounded cutover-preparation dependency. Keep all retained folder commands, tools, workflows, templates, ownership parsing, and existing `.ralph/plans` content operational until the explicitly authorized final migration/cutover. Do not begin plan step 5, migrate tasks or bundles, remove `To Do`, delete `.ralph/plans`, change existing IDs/parents, apply the plugin globally, or perform any live lifecycle or cleanup transition. Preserve operator authority, supported Backlog/Prime Agent/Orca interfaces, Docker-only plugin validation, and the unrelated-scope boundary.

### Implemented cutover preparation — exact managed-asset retirement rehearsal

Re-audited ordered plan step 4 after public activation. Task-native planning and implementation workflows are already managed beside retained folder compatibility. Exactly four project workflow assets remain coupled to that compatibility path: `project-workflow-plan-prep`, `project-workflow-plan-spec`, `project-workflow-implement-prep`, and `project-workflow-implement-spec`. They remain live because production removal now would break retained `/plan-spec` or `/implement-spec` work.

Added an isolated project-initialization rehearsal using a copied future plugin generation with exactly those four inventory rows and source files absent. A real version-1 active ownership record holds all four compatibility workflow bytes, the managed manifest, and retained `.ralph/plans` content unchanged. After releasing the snapshot, the rehearsal proves three unchanged managed compatibility files are pruned; one customized compatibility workflow is preserved and released from manifest ownership; the remaining manifest contains exactly ten task-native/shared managed assets with source-identical bytes; and retained plan bytes stay unchanged. A fresh project under the rehearsed generation receives exactly those ten assets and no `.ralph/plans` tree.

Independent read-only review reported no material findings. Focused validation passed 29 project-initialization Node checks and the reviewer reran the isolated new case successfully. The exact curated broad candidate passed 229 Node checks and 59 host-safe Python checks with 45 container cases deselected, plus `git diff --check`. Source-mode Docker Tier-1 passed with immutable-image, offline-RPC, verified-teardown, and published-manifest evidence at `.test-results/20261013T181209Z-47602-ef7f6389/tier1`.

The parallel step-4 audit also identified the remaining ordered prerequisites without changing them: current architecture/operator/story/traceability documents still need to make the active task-native path primary while labeling folder mechanics as retained version-1 compatibility; then legacy proof references need normalization and a deterministic deletion gate before the pre-cutover SHA is frozen. Those are later bounded slices. This slice does not start them.

No production asset row, source asset, project template, command, tool, workflow, ownership record, task, bundle, status, or `.ralph/plans` content was removed or migrated. No live lifecycle transition, cleanup, plugin activation, final cutover, or acceptance-criterion claim occurred. Final asset retirement remains coupled to explicitly authorized migration/cutover.

### Accepted next dependency — activation-truth documentation and traceability reconciliation

The operator accepted pushed checkpoint `bf1b320e8649f252b6bf3031c0563ded17bffc9f`, including the isolated exact managed-asset retirement rehearsal. The next execute pass is the explicitly recorded ordered step-4 documentation prerequisite: make the already-active task-native lifecycle the primary current architecture and operator path, and label every retained folder procedure clearly as version-1 compatibility. Reconcile the current architecture, operator, user-story, and traceability surfaces identified by the recorded audit while keeping those compatibility procedures operational and documented.

Do not begin the separate no-`To Do` guidance migration, proof-reference normalization, task/bundle migration, production asset retirement, `.ralph/plans` deletion, or final cutover. Preserve exact IDs and parents, operator authority, supported interfaces, Docker-only plugin validation when applicable, and the no-unrelated-scope boundary.

### Implemented slice — task-native activation truth and retained version-1 compatibility

Reconciled the approved current architecture, operator workflow, user-story, and traceability surfaces with the active runtime. `/plan TASK-ID` followed by `/implement-task TASK-ID`, exact version-2 task ownership, task-bound execution, `handoff_task_episode`, and guarded `finalize_task_episode` outcomes are now documented as the primary current lifecycle. Every retained folder procedure in these surfaces is explicitly version-1 compatibility and remains operational: `/plan-spec`, `plan_spec`, `/implement-spec`, bundle promotion, `create_spec_episode`, `handoff_spec_episode`, folder blocking/archival, and the bookkeeping-only `finalize_spec_episode` close.

Traceability now distinguishes the schemas and their observable behavior. Public task-native admission fails closed on existing non-terminal ownership; only retained version-1 `create_spec_episode` may return its matching Episode. A proven-clean primary task failure before ownership/resource mutation returns the exact task to `In Planning`; recorded, partial, or uncertain mutation publishes `Blocked` with exact recovery evidence. Retained version-1 partial provisioning/allocation persists exact `uncertain` ownership and cannot replay fresh. Task-native terminal review publishes `Ready for Merge`, refreshes the same Episode, verifies the resulting handshake, and waits for explicit operator authority; destructive cleanup remains separately confirmed and closes ownership last.

Independent review found three material truth/test gaps: public replay was overstated, the two recovery models were collapsed, and the first static assertions were loose bag-of-words checks. All three were repaired with schema-bound documentation and clause-level traceability contracts. Final rereview reported no material findings.

Validation passed 31 focused host-safe policy checks with 5 container cases deselected, 229 broad Node checks, 62 curated broad host-safe Python checks with 45 container cases deselected, and `git diff --check`. This documentation/static-test-only slice changes no plugin source or managed asset, so Docker Tier 1 is not required by repository policy.

No lifecycle status, task/bundle, production asset, ownership/resource, or acceptance criterion changed. The separate no-`To Do` guidance migration, proof-reference normalization, production retirement, `.ralph/plans` deletion, and final cutover remain unstarted and unauthorized.

### Accepted revision — correct Episode edit scope and lifecycle-receipt ownership

The owning Conversation requested an in-scope revision of candidate `d8507d7dd1a5d2d31354aaeecf6c5bffbbba0575` after Conversation and independent EXPERT review demonstrated two concrete defects against the already operator-approved contract. First, `docs/future-specification-bundles.md` must not say a task-native Episode edits only bound-task content: it implements approved code, documentation, and tests in its worktree, exclusively owns the bound task's content there, and leaves lifecycle status to the Conversation. Second, `docs/conversation-driven-episode-oversight.md` must not place task-native lifecycle receipts inside strict version-2 ownership: durable ownership stores identity and resource bindings, while `finalize_task_episode` actions return exact lifecycle receipts that the owning Conversation retains for later outcomes and retries. Add focused static assertions for both distinctions.

Revise only those two claims and focused tests, then validate, independently rereview, commit, push, report, and stop. Preserve every other accepted activation-truth, retained version-1 compatibility, replay/recovery, terminal-authority, cleanup, exclusion, task identity/parent/status/acceptance, and no-unrelated-scope boundary. Do not begin no-`To Do` guidance migration, proof normalization, task/bundle migration, production retirement, `.ralph/plans` deletion, or final cutover.

### Completed repair — Episode edit scope and lifecycle-receipt ownership

Repaired the two accepted documentation defects in candidate `d8507d7dd1a5d2d31354aaeecf6c5bffbbba0575`. `docs/future-specification-bundles.md` now states that a task-native Episode implements approved code, documentation, and tests in its isolated worktree, exclusively owns the bound task's content there, and leaves lifecycle status on main to the Conversation. `docs/conversation-driven-episode-oversight.md` now keeps strict ownership to lifecycle state plus durable owner, authority, placement, and resource bindings. Ready, phased-progress, and terminal action receipts are returned by `finalize_task_episode` and retained by the owning Conversation for later authorized outcomes or bounded retries; they are not ownership fields or event-journal entries.

A focused static contract protects every part of both distinctions and rejects the former false claims. Independent read-only rereview reported no material findings. Validation passed 32 focused host-safe policy tests with 5 container cases deselected, 63 curated broad host-safe Python tests with 45 container cases deselected, 218 broad Node tests, and `git diff --check`. This documentation/static-test-only repair changes no plugin source or managed asset, so Docker Tier 1 was not required.

No lifecycle status, task/bundle, production asset, ownership/resource, or acceptance criterion changed. All other task-native-primary, retained version-1 compatibility, replay/recovery, terminal-authority, cleanup, exclusion, task identity/parent/status/acceptance, and no-unrelated-scope behavior remains unchanged. The separate no-`To Do` guidance migration, proof normalization, task/bundle migration, production retirement, `.ralph/plans` deletion, and final cutover remain unstarted and unauthorized.

### Accepted next dependency — retire active `To Do` guidance

The owning Conversation accepted pushed checkpoint `1ef3ce44cc0c5e6855a591af0e612bf8f2dc024c`. The next execute pass must implement only the next already-approved ordered step-4 prerequisite: re-audit and remove active guidance that creates or selects `To Do`, including the operator/project guidance and source/project `prepare` or backlog surfaces named by the approved plan. Replace it with truthful task-native lifecycle guidance that uses supported Backlog CLI behavior.

Keep all still-unmigrated tasks and the transitional configuration intact for the later one-time migration. Do not migrate task statuses or bundles and do not remove `To Do` from final configuration in this slice. Preserve retained version-1 compatibility and all accepted activation, recovery, authority, cleanup, and exclusion behavior. Keep proof-reference normalization, requirements-inventory deletion gating, production asset retirement, `.ralph/plans` deletion, and final cutover separate. If managed plugin source changes, run the required Docker-isolated candidate validation. Independently review the bounded candidate, commit, push, report, and stop.

### Implemented slice — active `To Do` guidance retired

Re-audited the named operator, project, source/project `prepare`, Backlog, and current-documentation surfaces. Five active surfaces still selected `To Do`: `AGENTS.md`, `README.md`, `.agents/skills/prepare/SKILL.md`, `.agents/skills/backlog/SKILL.md`, and `docs/backlog.md`. The project Backlog skill and Backlog documentation also had creation examples that omitted status and therefore inherited the transitional default. The generic source `prepare` template was already tracker-neutral and required no change.

Replaced those active selection paths with the supported repeatable-status `In Design` plus `In Planning` discovery command. New ordinary task examples now pass `--status "In Design"` explicitly. Removed generic claim, completion, and archive examples that bypassed the accepted task-native phase and Conversation authority, and replaced them with truthful `/design` or `/spec-it-out`, `/plan TASK-ID`, `/implement-task TASK-ID`, and owning Conversation lifecycle guidance. Focused static coverage protects the named operator/project/source surfaces, explicit authoring status, generic source `prepare` behavior, and the absence of an active `To Do` selector.

The supported CLI accepted the repeated-status list command and returned a versioned `task-list`. Focused validation passed 18 host-safe tests with 8 container cases deselected. The curated broad candidate passed 229 Node tests and 68 host-safe Python tests with 45 container cases deselected, plus `git diff --check`. Independent read-only review reported no material defects. No managed plugin source changed, so Docker Tier 1 is not required by repository policy.

The still-unmigrated tasks and transitional `backlog/config.yml` remain intact; `To Do` is still the temporary configured default/selectable migration state. No task status, bundle, production asset, retained version-1 compatibility, accepted activation/recovery/authority behavior, or acceptance criterion changed. Proof-reference normalization, requirements-inventory deletion gating, production asset retirement, `.ralph/plans` deletion, and final cutover remain separate.

### Accepted next dependency — normalize proof references and gate inventory

The owning Conversation accepted pushed checkpoint `4a40a0832d561e380da32099f07d3ea2195e7e65`. The next execute pass must implement only the next already-approved ordered step-4 prerequisite: first re-audit the exact tracked `config/requirements-inventory.json` and every affected live proof reference, then make all live proof paths deletion-safe and add or repair the inventory test gate that proves they will survive later deletion of `.ralph/plans`.

Preserve literal old paths only where they are clearly historical evidence, reports, completed-task prose, or provenance whose rewriting would falsify history. Convert live proof authority to durable task references or explicit Git provenance as the approved plan permits. Keep this to one bounded proof-normalization and inventory-gating slice.

Do not migrate tasks, statuses, or bundles; do not remove `To Do` from configuration; do not retire production assets or retained version-1 compatibility; do not delete or move `.ralph/plans`; and do not begin final cutover. Preserve existing IDs, parents, lifecycle state, ownership/resources, acceptance criteria, and operator authority. If managed plugin source changes, run the required Docker-isolated candidate validation. Validate the relevant inventory and static contracts, independently review the bounded candidate, commit, push, report, and stop.

### Implemented slice — normalize proof authority and gate deletion

Re-audited the exact tracked `config/requirements-inventory.json` before editing. It contained 62 scalar references, across 21 distinct strings, to eight `.ralph/plans` files. Seventeen Phase 2 verdicts incorrectly reused the current active root plan even though their actual source is the archived Phase 2 runtime plan. Fifteen project-wide-testing rows incorrectly reused the final Slice 8 archive files for claims from Slices 1–7.

Normalized the 17 Phase 2 verdicts to explicit Git provenance at `.ralph/plans/archive/phase2-runtime/EXECUTION_PLAN.md @ 4a40a0832d561e380da32099f07d3ea2195e7e65`. The other still-historical plan sources use the same accepted pre-cutover checkpoint. The 15 project-wide-testing rows now use their exact durable Backlog authorities: `PRIMECLAW-20` for the aggregate and `PRIMECLAW-20.1` through `PRIMECLAW-20.8` for the applicable slice, including every source for composite claims. The resulting inventory has 47 explicit Git references to six audited files plus the slice-correct task references; no live proof claim depends on the working-tree plan path.

Removed the remaining deletion-sensitive current proof links from `DEVELOPERS.md`, `LONG_RANGE_PLAN.md`, `docker/test.Dockerfile`, the three `docs/derisk` verdict surfaces, and user-story traceability. Current guidance now uses canonical docs or durable Backlog tasks. Historical Phase 1 spec and requirements paths remain truthful as explicit `path @ 4a40a0832d561e380da32099f07d3ea2195e7e65` provenance. Historical reports, completed-task prose, retained version-1 compatibility behavior, and migration descriptions remain unchanged.

Expanded `tests/test_inventory_integrity.py` to scan every inventory string, reject any unpinned plan reference, require the exact 47-reference/six-file audited set and common provenance commit, resolve every Git object, enforce the 15 per-row project-wide-testing task mappings, resolve each task to exactly one canonical tracked Markdown file, and protect the named current proof surfaces. Initial independent read-only review found the false Phase 2 and testing-slice source mappings. Both were repaired; its rereview reported no material findings in the repaired inventory and gate.

Focused inventory and deletion-safety validation passed 7 tests. The curated broad host-safe suite passed 653 tests plus 75 subtests, with 1 skip, 67 deselections, and 12 warnings; `git diff --check` passed. An initial unrestricted host-safe run also exposed two unrelated static-policy failures already present at the handoff base: the `test_runtime_connect.py` literal-policy check and the missing pytest bridge for `task_episode_admission_extension.test.mjs`. Their source and policy files are unchanged by this slice. No managed plugin source changed, so Docker Tier 1 is not required by repository policy.

No task identity, status, bundle, `backlog/config.yml`, production asset, plugin source, retained version-1 compatibility behavior, lifecycle state, ownership/resource, acceptance criterion, or operator authority changed. No migration, retirement, plan deletion or movement, final cutover, host-global apply, or live resource cleanup occurred.

### Post-review repair — align US-17 Episode scope

Corrected the active US-17 traceability row after review of candidate `88f66e559b70ab7fb2e2cc22244440674e305415`. It now states the accepted three scope distinctions: a task-native Episode implements approved code, documentation, and tests in its isolated worktree; it exclusively owns the bound task's content there; and lifecycle status remains with the Conversation. The retained version-1 compatibility clause and durable Backlog evidence references remain unchanged.

Extended the existing focused Episode-scope contract in `tests/test_oversee_episode_skill.py` to require all three distinctions on the active traceability surface, reject the former task-content-only claim, and preserve the compatibility and evidence clauses. Focused scope plus inventory validation passed 13 host-safe tests and `git diff --check` passed. No proof mapping, inventory gate, current-proof normalization, historical/version-1 exclusion, task identity/status/acceptance, plugin source, migration, configuration/default, asset, plan placement, or cutover behavior changed.

### Accepted next dependency — one-time Backlog migration without cutover

Use `6d11d9c2797cea54ecd07171e8a5b2019d6ee530` as the exact frozen pre-cutover provenance tree. Perform only the reviewed task and historical-bundle migration in `.ralph/plans/EXECUTION_PLAN.md` step 5. Inventory every tracked `.ralph/plans` file at that commit and apply the reviewed mapping/classification rules exactly through the supported Backlog CLI. Preserve every existing ID and `parent_task_id`; reuse or create only the named epics; retain `PRIMECLAW-7` as the sole Blocked Phase-3a replacement with children `.3`–`.6`; preserve both supersession directions; import source-ordered criteria/content/history/outcomes/index evidence/source paths truthfully; and use `backlog task complete` only for explicitly successful historical epics. Classify all existing `To Do` tasks by meaningful plan or stronger evidence, including the recorded special handling for `PRIMECLAW-10.37` and `PRIMECLAW-7.6`. Remove `To Do` from final configuration only after proving no active task still uses it. Put no migrated bundle in `backlog/archive/`.

Use no committed migration script, journal, wrapper, dual-write layer, or alternate tracker. A bounded temporary helper may only issue supported CLI operations. Add or repair representative migration validation, independently review, commit, push, and report exact mapping, counts, and provenance.

This migration slice stops before compatibility retirement and cutover. Do not retire production/version-1 assets, delete or move any tracked `.ralph/plans` source, disable retained folder compatibility, perform final cutover, change this task's lifecycle status, or claim terminal acceptance. The plan's final plan-tree deletion and plan-absence/cutover assertions remain deferred until separately authorized.

### Migration execution blocker — completed-record mutation has no supported CLI path

At clean checkpoint `5ca6d463efa5433192e3bc7a17894a60293f4738`, preflight inventoried all 43 tracked `.ralph/plans` files at frozen tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530` and reconciled 16 present bundle owners: nine existing tasks and seven new epics. The `replace-beads` row is a no-op because neither candidate source path exists; `PRIMECLAW-35` remains unchanged.

Execution stopped before any migration mutation remained. Seven required reused owners — `PRIMECLAW-6`, `PRIMECLAW-10.15`, `PRIMECLAW-10.26`, `PRIMECLAW-10.28`, `PRIMECLAW-19`, `PRIMECLAW-20`, and `PRIMECLAW-10.34` — already live under `backlog/completed/`. `backlog task view --json` resolves them, but supported `backlog task edit` returns `Task not found` because edits resolve only the active corpus. The repository-built Backlog implementation explicitly says a completed record cannot pass through `updateTask`; its diagnostics recommend direct file editing for completed records. Direct task-Markdown edits are forbidden by repository policy and contradict this migration's CLI-only contract. `task demote` assigns a new draft ID and would violate immutable task identity.

A temporary create attempt for the seven new epics was fully rolled back before this blocker record. No existing task, status, parent, config, bundle, asset, or source plan changed. Unblock requires one explicit operator decision: authorize exact direct edits of only those seven completed records, authorize a separately scoped supported Backlog capability for completed-record edits, or revise the mapping so those completed IDs need no field/type import. Do not continue migration, infer an exception, move/delete plans, or change this task's lifecycle status before that decision.

### Operator-selected unblock — supported completed-task restore capability

The operator selected the supported-capability path. Implement and validate an upstream-quality Backlog operation that restores one exact completed record from `backlog/completed/` to active task storage without changing its ID, parent, content, or terminal `Done` status. Normal supported `task edit` may then update that same record; `task complete` must run only after all intended edits and validation.

This capability is the next bounded slice and must be delivered as its own reviewable checkpoint before broader migration resumes. Keep implementation and validation in this Episode. Do not open, prepare, or pursue any upstream issue or pull request; the owning Conversation may assign that transport separately only after accepting the capability candidate. No direct-edit exception, migration mutation, plan movement/deletion, or lifecycle-status change is authorized by this decision.

### Completed-task restore capability candidate

Implemented the operator-selected unblock as dependency commit `5d556c1954f7724abd180f6211cf528e9253ad4c`. `backlog task restore <taskId>` now restores one exact local completed file to active storage without parsing or reserializing it, preserving ID, `parent_task_id`, filename, raw bytes/content, and terminal status. It uses a per-task lock and no-clobber hard-link/unlink move; ContentStore publishes the record only in the active corpus. The normal `task edit` path then works, and `task complete` returns the record to completed storage only after intended edits and validation.

Auto-commit prepares both paths in a temporary Git index and publishes them atomically. Staging/commit failure restores owned index state and the byte-identical completed file; ownership loss reports partial state. Core now forces working-copy-only resolution even when a caller omits options. Independent review identified and the implementation repaired the earlier partial-staging and caller-locality defects.

Validation: 125 focused/regression tests passed, including exact preservation, destination collision, restore→edit→complete, prior-staged-state commit rollback, staging-failure index atomicity, custom prefixes, cache transition, and local-only resolution. `bun run check`, `bun run check:types`, and `bun run build` passed. The full dependency run recorded 2,892 passes and 8 skips; its 13 unrelated failures were triaged: four cleared in isolation/sequentially, eight TUI move failures/errors reproduce on the untouched base, and the branch-loader mock-count assertion also reproduces on the untouched base in this nested submodule path. The project host-safe suite recorded 653 passes, 1 skip, 65 deselections, and 75 subtests with the same two known unrelated static-policy failures. `git diff --check` passed.

No migration record, historical epic, To Do status, config, asset, lifecycle status, or plan location changed. Broader migration remains paused until the owning Conversation accepts this separate capability checkpoint. No upstream issue or pull request was opened or prepared.

### Conversation acceptance and next migration slice

The completed-task restore checkpoint is accepted and pushed: Backlog dependency `5d556c1954f7724abd180f6211cf528e9253ad4c` and parent `817a5936607fcb9493630ad14544c744030ebb40` are clean, upstream-equal, and linked exactly.

Resume only the reviewed one-time task and historical-bundle migration. Use `backlog task restore` for `PRIMECLAW-6`, `PRIMECLAW-10.15`, `PRIMECLAW-10.26`, `PRIMECLAW-10.28`, `PRIMECLAW-19`, `PRIMECLAW-20`, and `PRIMECLAW-10.34`; preserve each exact ID, parent, filename, bytes/content, and `Done` status through restore; make only supported CLI edits; validate; then run `backlog task complete` after all intended edits. Reconcile the frozen 43 source paths into the 16 recorded bundle owners, preserving the approved `PRIMECLAW-7` Phase 3a mapping, bidirectional superseded-history references, and `PRIMECLAW-35` no-op when its source bundle is absent.

Do not perform upstream outreach, asset retirement, `.ralph/plans` deletion, final cutover, lifecycle status changes, or unrelated cleanup in this slice. Commit and push the bounded migration candidate, report exact evidence, and stop idle for Conversation review.

## One-time historical-bundle migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. The 43 tracked `.ralph/plans` paths reconcile to these 16 owners:

- `active-root` → `PRIMECLAW-10.38`
- `archive/compaction-first-phase-transitions` → `PRIMECLAW-39`
- `archive/conversation-driven-episode-oversight` → `PRIMECLAW-10.26`
- `archive/conversational-ralph-command-routing` → `PRIMECLAW-38`
- `archive/goal-heartbeat-work-control` → `PRIMECLAW-10.28`
- `archive/handoff-continuation-resilience` → `PRIMECLAW-10.15`
- `archive/official-lean-compatibility-cleanup` → `PRIMECLAW-10.34`
- `archive/official-lean-session-protocol` → `PRIMECLAW-40`
- `archive/phase1-derisk-gate` → `PRIMECLAW-36`
- `archive/phase2-runtime` → `PRIMECLAW-6`
- `archive/phase3a-bufd-superseded-incomplete` → `PRIMECLAW-41`
- `archive/plugin-test-container` → `PRIMECLAW-19`
- `archive/project-wide-testing-strategy` → `PRIMECLAW-20`
- `archive/worktree-isolated-specification-episodes` → `PRIMECLAW-37`
- `future/delivery-manager-episode-supervision` → `PRIMECLAW-42`
- `future/phase3a-brain-hosting-completion` → `PRIMECLAW-7`

Shared evidence: `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. The reviewed `replace-beads` source is absent from the frozen tree, so `PRIMECLAW-35` remains an intentional no-op. `PRIMECLAW-7` is the sole Blocked Phase 3a replacement and links bidirectionally to completed-but-partial historical epic `PRIMECLAW-41`. `PRIMECLAW-10.34` links bidirectionally to historical predecessor `PRIMECLAW-40`.

This bounded slice does not delete or move `.ralph/plans`, retire assets, change configuration or existing lifecycle statuses, perform final cutover, or initiate upstream outreach.

## Historical-bundle migration candidate evidence

Completed the reviewed bounded migration from frozen provenance `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. All 43 tracked plan paths reconcile to 16 exact owners; the shared archive index supplies terminal/status evidence. The seven reused completed owners passed exact pre-edit restore receipts and returned to completed storage only after supported CLI edits and validation. New historical epics are `PRIMECLAW-36` through `PRIMECLAW-41`; `PRIMECLAW-42` is the retained `In Design` delivery-manager bundle. `PRIMECLAW-7` remains the sole Blocked Phase 3a replacement. Superseded-history links are bidirectional (`PRIMECLAW-7` ↔ `PRIMECLAW-41`, `PRIMECLAW-10.34` ↔ `PRIMECLAW-40`). `PRIMECLAW-35` is unchanged because its reviewed source bundle is absent.

Focused repository validation: `python3 -m pytest tests/test_backlog_workflow.py tests/test_backlog_build.py -q` → 7 passed. Full mapping, content, identity, storage, hierarchy, and provenance audits passed in the bounded migration helper. No configuration, asset, source-plan location, cutover, upstream, or existing lifecycle-status change is included.

## Accepted migration review correction

Conversation accepts one material in-scope finding against `2ddd6dc45bbf47665354b6983e930daaa23e8f86`: imported native criteria falsely mark explicitly deferred manual dogfood as complete.

Repair only checked-state evidence through supported CLI operations. Restore `PRIMECLAW-39`; uncheck criteria 1, 2, and 5 while retaining 3 and 4 checked (2/5); validate and complete it back to its exact completed path. Restore `PRIMECLAW-37`; uncheck deferred Slice 4 criteria 17–21 while retaining 1–16 checked (16/21); validate and complete it back to its exact completed path. Preserve both tasks' `Done` status, IDs, parents, filenames, and completed paths. Update only affected migration count/evidence claims here and in `.ralph/plans/EXECUTION_PLAN.md`, rerun the existing focused Backlog checks and `git diff --check`, commit and push, then stop idle.

Do not run new dogfood, change lifecycle status, alter another mapping or content, retire assets, delete `.ralph/plans`, perform cutover, or do unrelated cleanup.

## Deferred-dogfood criteria-state repair completed

Repaired the one accepted material finding against migration candidate `2ddd6dc45bbf47665354b6983e930daaa23e8f86` without running dogfood or changing lifecycle status. `PRIMECLAW-39` restored byte-for-byte (39856 bytes, SHA-256 `69cd72ccf3032710d84a0e8c77c7514cff110f820dffde83bd170b0f15b854b0`), retained its ID, null parent, filename, and `Done` status, and returned to `backlog/completed/primeclaw-39 - Historical-Compaction-first-phase-transitions.md` with criteria 3 and 4 checked and 1, 2, and 5 unchecked (2/5). `PRIMECLAW-37` restored byte-for-byte (44721 bytes, SHA-256 `fc5f8b0eeed910885393308388a05158425095288e2955d212740e57213031ef`), retained the same invariants, and returned to `backlog/completed/primeclaw-37 - Historical-Reviewed-future-plans-and-worktree-isolated-specification-episodes.md` with criteria 1–16 checked and deferred Slice 4 criteria 17–21 unchecked (16/21).

Focused validation: `python3 -m pytest tests/test_backlog_workflow.py tests/test_backlog_build.py -q` → 7 passed. Exact criterion-state, identity, storage, bounded four-file diff, and `git diff --check` validation passed. No other mapping/content, asset, plan location, cutover, or unrelated cleanup changed.

## Operator-approved compatibility-preservation scope correction

Accepted repair candidate `b00d7bded447e4d303050dcaca0db444f91df308` and reconciled the authoritative specification without implementing behavior. `PRIMECLAW-10.38` now governs this repository's own `.ralph/plans` data cutover to the task-native workflow while the generic plugin retains the legacy workflow for other initialized repositories.

The revised specification makes tracker migration and specification authority orthogonal; preserves the named legacy assets, commands, tools, ownership version 1, hybrid role routing, old active-snapshot fallback, separate legacy authoring assets, and runtime-versus-delivery-source distinction; makes persisted ownership decide routing before prompt-tag absence; and confines final plan-tree deletion to this repository. Remaining work is ordered as compatibility preservation and mode resolution, this repository's status/configuration/data cutover, then this repository's `.ralph/plans` deletion and final validation.

This reconciliation changed only `PRIMECLAW-10.38`, `.ralph/plans/SPECIFICATION.md`, and `.ralph/plans/EXECUTION_PLAN.md`. It changed no code, skill, template, test, asset, status, configuration, plan placement, or cutover state. The task remains `In Progress` under `PRIMECLAW-10` with the same canonical path and ownership binding.

## Accepted routing clarification — old in-place legacy workflow

Conversation review of `2287a37c7f3ed66db07a8a3dcf8093a1a881dd3e` identified one missing distinction. Persisted ownership version 1 or version 2 still decides routing first. When no ownership exists, active legacy `SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files on canonical main may represent valid old in-place legacy workflow work without any live Prime Claw Episode or ownership version 1 record. That fallback does not establish live Episode identity: a live version 1 Episode still requires persisted version 1 ownership plus active files in that Episode worktree.

This repair changes wording only in this task and `.ralph/plans/EXECUTION_PLAN.md`. It changes no code, skill, template, test, asset, other criterion or scope, lifecycle status, configuration, retirement, cutover, or plan placement. `.ralph/plans/SPECIFICATION.md` remains unchanged.

## Step 5 compatibility-preservation implementation evidence

Implemented and validated the approved compatibility-preservation slice only. Persisted ownership now selects version-1 retained-folder or version-2 task-native routing before prompt tags. Old in-place active legacy files on canonical main remain valid without claiming Episode identity. Live version-1 identity requires ownership plus readable, non-empty active files in the recorded worktree and fails closed when they are absent. The four customizable legacy workflows, six legacy commands/tools, version-1 lifecycle mechanics, and bounded handoff/execute snapshot fallback remain available. Added separate `design-legacy` and `spec-it-out-legacy` assets without competing migration sources or duplicated common policy. Legacy completion/blocking cannot mutate task-native Backlog lifecycle, finalization, or cleanup authority.

Validation passed: focused host-safe 56 passed; managed inventory/workflow 15 passed; final Step-5 Docker selection 11 passed; independent review found no material defects; source-mode `scripts/test-tier1.sh --probe` passed with verified teardown and manifest publication; `git diff --check` passed. The earlier full Docker bridge passed every Step 5 case and 136/137 Node cases overall; its sole failure is an unchanged pre-Step-5 test that expects ignored host-built `deps/backlog/dist/backlog` inside the read-only container snapshot. The broad non-container suite reached 655 passed with only three unchanged accepted-base/environment failures.

No Step 6 or 7 status/configuration/data cutover, final publication, retirement, plan deletion, merge/finalization, cleanup, or user-global application occurred.

## Pre-activation bridge authority migration

The complete authoritative execution plan was imported through the supported Backlog CLI from `.ralph/plans/EXECUTION_PLAN.md` at `6447b87da65274046af4388474426a6b68718706` (Git blob `20d41abbed237a823f19551f8f6d433612b4f5e9`; SHA-256 `62df6aade82219986cd24fd0833c0718e6208d833d30169621c9eb11ab7f1ae8`) and round-tripped exactly modulo the CLI's terminal-newline normalization.

`.ralph/plans/SPECIFICATION.md` at the same commit (Git blob `45ddd044737f5370f72886a0823231aba3fb90b4`; SHA-256 `5e34f819078103828cfb970b2836c78f2249a673c6d7474f4816191450652999`) is a thin compatibility/admission wrapper superseded as specification authority by `PRIMECLAW-10.38`. It remains present only to keep current active version-1 ownership live through candidate review and revision.

Step 5 was accepted at `5cdabed7a6850e6f684465acd77ea3d589ec213a`. Step 6 was accepted at `c63dae91dfa15c4059914eeeeb5dace6debd56fa`; its status-migration evidence is `docs/evidence/task-native-backlog-cutover/2026-10-14-step-6-status-migration.json`. The attempted Step 7 deletion was fully rolled back and its ownership conflict was recorded at `d6bf6d352c88eef4c48ff3bbe434f7ea702b65e8`. The approved bridge-only authorization is `6447b87da65274046af4388474426a6b68718706`.

Step 7 remains incomplete. This candidate must not execute the live ownership transition, delete or archive either active plan file, publish `Ready for Merge` or `Done`, merge, finalize, clean resources, apply globally, or restart Prime Agent.

## Pre-activation ownership bridge candidate evidence

Implemented the dormant public `transition_spec_episode_to_task` surface without invoking it. The tool requires explicit post-review/merge/primary-main activation/restart/UAT confirmation; exact owner, source, task, admission base, reviewed Episode/main heads, plan/task Git identity, clean pushed ancestry, idle durable session, and unchanged worktree/branch/optional Orca resources. It atomically replaces only version-1 authority fields with the exact version-2 task binding, preserves all resources and common identity, permits only replay of the same durable owner/Episode/task/resource binding after fresh full current-state validation, and fails closed on binding drift, partial or foreign state, dirt beyond the mandatory ownership record, unsafe ancestry, or unavailable evidence.

The active thin specification now explicitly records that `PRIMECLAW-10.38` supersedes it as specification authority while it remains present for version-1 live identity. The exact legacy source is retained as the task reference `legacy-episode-source=.ralph/plans/future/replace-ralph-plans-with-backlog; superseded-by=PRIMECLAW-10.38` so a completed transition replay can still prove the original source after legacy authority fields are removed.

Validation passed: final focused transition/registration Node rerun 51/51; earlier full focused ownership/runtime/registration/lifecycle Node run 203/203 before the final source-reference tightening; focused host-safe policy 35 passed and 5 skipped; broad host-safe 657 passed, 1 skipped, 65 deselected, and 75 subtests passed with only the three unchanged accepted failures; Docker Tier-1 source-mode offline probe passed with evidence at `.test-results/20261014T172001Z-94283-f4b0ce0a/tier1`.

No live transition, plan deletion/archive, lifecycle publication, merge, user-global application, restart, finalization, cleanup, Step 7 deletion, or Step 5/6 behavior change occurred. Ownership remains active version 1; both active plan files remain present; task status remains `In Progress`; Final Summary remains unset because the overall task and Step 7 are incomplete.

## Independent review repair evidence

GPT-6 Astra reproduced one material defect in `b39900a1574bb070cacb8b17d69dddde32c2ed87`: the main cleanliness check rejected the required untracked `.prime-claw/ownership.json`, while the original fixture hid it through `.gitignore`. Production now allows only that exact untracked authority file and rejects every additional tracked or untracked change. The fixture carries the real unignored ownership file and proves both success and unrelated-dirt rejection.

Replay semantics were clarified without adding forbidden receipt or ownership fields: same-binding means the same durable owner/Episode/task/resource binding, with fresh validation of current pushed heads, plan/task identity, source reference, active pair, session, and resources. The reviewer accepted this as consistent with the approved contract.

Post-repair focused Node validation passed 51/51. Exact-current-source Docker Tier-1 passed at `.test-results/20261014T172001Z-94283-f4b0ce0a/tier1`. No live transition or lifecycle/resource mutation occurred.

## Version-2 Step 7 continuation checkpoint

Canonical ownership is now active version 2 for this exact Episode and binds `PRIMECLAW-10.38`; the post-restart route is `a70b200f031a`. The next execute pass is authorized only for already-approved Step 7 in this task's Implementation Plan: confirm durable task/documentation coverage, delete only this repository's tracked `.ralph/plans` tree, preserve generic legacy compatibility and the protected untracked canonical-main `.ralph/plans/archive/replace-beads/`, run the specified validation, and update only this task through the supported Backlog CLI while keeping it `In Progress`. Produce one clean pushed candidate and report it.

Do not publish `Ready for Merge`, merge, finalize, clean resources, apply global assets, alter lifecycle status, or reopen accepted Step 5/6 work.

## Step 7 repository-local cutover evidence

Completed only the already-approved Step 7 from pushed task-native checkpoint `cbd7b4f0b794f0b9520deb8f5d8b32f775559318` under active version-2 ownership for this exact Episode and task.

Durability and deletion:
- Revalidated the 43 tracked `.ralph/plans` paths at frozen provenance commit `6d11d9c2797cea54ecd07171e8a5b2019d6ee530` against 16 exact durable Backlog owners. All 42 owner-specific paths have a pinned task reference or imported task body; the shared archive index is pinned by every owner.
- Confirmed the active specification was only a superseded pointer and the complete active execution plan matched this task's Implementation Plan modulo the terminal newline before deletion.
- Deleted exactly the 43 Git-tracked paths. The Episode worktree now has no `.ralph/plans` directory and `git ls-files -- .ralph/plans` is empty.
- The protected untracked canonical-main `.ralph/plans/archive/replace-beads/` remains present and byte-identical: `EXECUTION_PLAN.md` SHA256 `68f6a8cfd297f3c5bd46d5a4551cedaca4707ef865b351af790459e684339f13`; `SPECIFICATION.md` SHA256 `1d587130ff368ba190ab8b987267bce73bee5c5342ef23b56da7814b15e4cfad`.
- Generic version-1 compatibility source, project assets, commands, tools, ownership parsing/routing, recovery, and behavioral tests have no candidate diff. Current builder-repository guidance now distinguishes its completed local cutover from generic retained-project compatibility.
- The complete 43-path mapping, owner identities/statuses/paths, active-root hashes, version-2 binding, and frozen provenance are recorded in `docs/evidence/task-native-backlog-cutover/2026-10-17-step-7-plan-tree-deletion.json`.

Task/data checks:
- Supported Backlog parsing returns 41 active tasks: 32 `In Design`, 3 `In Progress`, 4 `Blocked`, and 2 `Done`; there are no `To Do` tasks.
- `backlog/config.yml` retains default `In Design` and the exact ordered statuses `In Design`, `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, and `Done`.
- This task retains exact ID `PRIMECLAW-10.38`, parent `PRIMECLAW-10`, canonical path, status `In Progress`, and active version-2 ownership.

Validation:
- Focused lifecycle/ownership/initialization Node suites: 267 passed.
- Focused host-safe Python: 83 passed, 45 deselected. Final receipt/inventory/project-state/role-kernel rerun: 22 passed, 4 deselected.
- Broad host-safe Python: 657 passed, 1 skipped, 65 deselected, and 75 subtests passed. Four unrelated baseline failures remain: the two accepted Node/Pytest topology checks, the existing vendored Backlog source pin mismatch, and unchanged customized design/spec-it-out template-source hashes. Both files behind the last mismatch and `.prime-claw/templates.json` are byte-unchanged by this candidate.
- `TIER1_ENV_FILE=/tmp/prime-claw-tier1-source.env scripts/test-tier1.sh --probe`: passed source-mode immutable-image launch, verified network absence, checks, teardown, and manifest publication at `.test-results/20261017T173603Z-71285-e80a6686/tier1`.
- `git diff --check`: passed.

No `Ready for Merge` publication, merge, ownership finalization, cleanup, user-global asset application, generic compatibility retirement, or accepted Step 5/6 revision occurred.

## Final acceptance-evidence traceability supplement

This final checkpoint supersedes earlier slice-local notes that left AC #2/#3/#6/#7/#8/#9 unchecked while their implementation or retained evidence was still incomplete. It distinguishes behavioral-test evidence from retained dogfood instead of implying that every criterion requires a live lifecycle mutation.

- **AC #2 and #3 — executable behavioral evidence.** Their accepted wording requires tests. `tests/test_future_plan_skills.py` and the task-planning/admission coverage execute the supported Backlog CLI and prove exact `In Design` authoring/revision, later-state rejection, exact `In Design`/`In Planning` planning, meaningful native plan persistence, unchanged identity/path/parent, and no Episode creation. The final focused host-safe set passed 83 tests; the combined lifecycle Node set passed 267 tests. No unrecorded real `/design` or `/plan` session is claimed.
- **AC #6 — retained same-Episode dogfood.** Durable Episode `01a133c6-0834-7465-8597-91cf46c0b19e` kept the same owner, session file, worktree, branch, Orca worktree/terminal resources, and implementation task through repeated execute, handoff, compaction, independent review, and accepted revision passes. The continuous candidate chain includes Step 5 `5cdabed7a6850e6f684465acd77ea3d589ec213a`, Step 6 `c63dae91dfa15c4059914eeeeb5dace6debd56fa`, Step 7 blocker `d6bf6d352c88eef4c48ff3bbe434f7ea702b65e8`, reviewed bridge `6dd19ca4ccb63a0cf78903d0332390bd70783578`, post-restart repair `1d1c968b265f254e9f28b1378aa08f35ae429eab`, reviewed safety revision `a7038a901819c6d2b04ebef07f1c8a941b87ecdd`, version-2 handoff `cbd7b4f0b794f0b9520deb8f5d8b32f775559318`, and this Step 7 candidate. The guarded version-1-to-version-2 transition changed only authority binding and preserved that exact Episode/session/worktree/branch/resource identity.
- **AC #7 — behavioral evidence plus retained ownership evidence.** Task lifecycle/ownership suites prove branch-owned task content, Conversation-owned main status, and no ordinary cross-checkout copy or dual write. This retained Episode independently confirms that its supported-CLI content edits stayed on the Episode branch while main lifecycle status remained `In Progress` and ownership/resources stayed bound.
- **AC #8 and #9 — executable behavioral evidence.** The task Episode lifecycle suites prove exact-task Blocked/resume continuation, Ready-for-Merge publication/integration/verification, and same-Episode review/revision boundaries. This migration Episode did not perform or claim a live Blocked/resume or Ready-for-Merge transition. Its multiple independent reviews and accepted repair passes provide additional retained review/revision evidence without crossing the Conversation/operator gates.

The distinction above is intentional: test-proven lifecycle behavior remains test evidence; the retained migration Episode is claimed only for the exact dogfood it actually exercised.

## Independent review repair — protected untracked archive-compatible assertions

Independent GPT-6 Astra review of candidate `ffe246be6e740833e9097a61af71b868210aa069` found one material Step 7 test defect. The implementation and deletion receipt correctly remove only the 43 tracked plan paths and preserve canonical main's protected untracked `.ralph/plans/archive/replace-beads/`, but two new assertions required the physical `.ralph/plans` directory to be absent. Those assertions would fail after a correct merge because Git leaves the protected untracked archive in place.

The repair changes only those assertions. `tests/test_backlog_workflow.py` and `tests/test_project_initialization.py` now run path-scoped `git ls-files -- .ralph/plans` and require zero tracked plan paths. They do not require physical directory absence and therefore preserve the approved tracked-versus-untracked boundary. The canonical protected pair remains byte-identical and is not part of the candidate.

Post-repair focused receipt, project-state, inventory, and frozen-provenance validation passed 22 tests with 4 unrelated cases deselected; `git diff --check` passed. Plugin source and generic compatibility assets remain unchanged, so the already-passed exact-candidate Docker Tier-1 gate remains applicable.

## Accepted operator revision — least-technology task-native lifecycle

After the clean pushed Step 7 candidate `1deeb26136efb22f60a16ab626f6e8446ecea0ac`, the operator directed the next execute pass to simplify the complete task-native lifecycle rather than patch the immediate untracked-file failure. Step 8 in the Implementation Plan is the durable scope for that pass. It preserves the protected untracked archive, generic legacy compatibility, exact task/Episode ownership, Conversation and operator authority boundaries, supported public interfaces, and the no-Prime-Agent-patch constraint while deleting unnecessary custom machinery. No lifecycle status, ownership/resource state, merge, cleanup, or global activation changed in this handoff.

## Step 8 simplification evidence

The accepted operator revision supersedes earlier task notes and acceptance evidence that described the removed Ready-for-Merge handshake, digest, receipt, and custom terminal coordinator. Those entries remain historical records of prior candidates, not the current task-native contract.

Implementation:
- collapsed `finalize_task_episode` to the cleanup-only `(taskId, episodeHead, outcome, confirmed)` boundary;
- added durable optional `cleanupHead` to version-2 ownership and kept version-1 `bundleDigest` unchanged;
- retained exact owner/task/worktree/session validation and ordered runtime → worktree → branch deletion, with canonical-main terminal-state verification and ownership closure last;
- moved Block/Resume, Delay, Request Changes, Merge, and Abandonment to the existing Conversation oversight instructions using ordinary Git and supported Backlog commands;
- deleted the task-native lifecycle status publisher, Ready publication/integration/verification, content digests, multi-phase receipts/progress/replay, custom merge/Done recovery, custom abandonment/archive recovery, and their machinery-only tests;
- rewrote user stories, handoff/oversight docs, traceability, and focused tests around the observable contract.

Validation:
- focused host-safe policy/workflow checks: 49 passed, 5 skipped;
- isolated Docker reviewed-plan and Episode behavior suites: 2 passed at `.test-results/20261017T224746Z-48221-ff5a38af/tier1`;
- broad host-safe suite: 663 passed, 1 skipped, 65 deselected, and 75 subtests passed; only the four accepted unrelated topology/template-pin/vendor-pin failures remained;
- Docker Tier 1 source-mode offline probe passed at `.test-results/20261017T224940Z-52575-28e2f8e3/tier1`;
- `git diff --check` passed;
- the protected canonical-main archive pair remains byte-identical and this Episode still has zero tracked `.ralph/plans` paths.

No lifecycle status change, merge, abandonment, cleanup, user-global activation, Prime Agent source change, ignore workaround, or generic version-1 retirement occurred.

## Independent review repair — cleanup-compatible canonical main

Independent GPT-6 Astra review of exact candidate `a2842dbe5066cc47158f8de34a64d94d0e44e228` reproduced one material defect: the cleanup canonical-main guard rejected all untracked paths, including required `.prime-claw/ownership.json` and the protected untracked archive pair, so authorized cleanup would stop before resource removal.

The repair makes canonical-main cleanliness mean no staged or tracked changes. It allows untracked state without an ignore rule or path-specific exception, keeps the Episode worktree fully clean, and aligns Merge/Abandon prompt wording with the same approved distinction. A real-Git regression writes valid active version-2 ownership plus the protected archive pair and proves they pass, while both unstaged tracked drift and staged drift fail closed. No receipt, digest, lifecycle coordinator, or custom recovery was restored.

Post-repair focused host checks passed 49 with 5 skips. The isolated reviewed-plan and Episode behavior suites passed at `.test-results/20261017T225626Z-67704-a2ecdbca/tier1`. Final Docker Tier 1 source-mode probing passed at `.test-results/20261017T225826Z-72047-42eaff0a/tier1`. `git diff --check` passed. The protected canonical archive hashes and zero tracked `.ralph/plans` paths remain unchanged.

No lifecycle transition, merge, abandonment, cleanup, global activation, ignore workaround, Prime Agent source change, or generic version-1 retirement occurred.

## Operator correction accepted — Ready for Merge remains observable

The operator accepted a bounded correction after reviewing pushed Step 8. The least-technology deletion remains accepted, including removal of coordinator/receipt/progress/replay/digest/custom terminal machinery. The defect is only that the prompt-led contract must still publish the approved observable `Ready for Merge` status gate and carry it through ordinary same-Episode Git integration before operator choice. Step 9 in the Implementation Plan is the sole next execute scope. No lifecycle status or resource state changed in this handoff.

## Step 9 implementation and validation (2026-10-17)

Repaired the operator-identified contract defect in pushed simplification `0930622f9be8ff015c0a03a79dbf5cdc1dce8431`.

Changed only the task contract, the existing `prime-claw-oversee-episode` Conversation guide, directly relevant lifecycle documentation/user stories/traceability, the Step 8 before/after evidence table, and prompt/static assertions. The guide now gives an actionable ordinary-Git conflict path: merge the published main head, restore pre-merge Episode task content if that path conflicts, apply only the Conversation-authorized status through Backlog, and let Git block unrelated conflicts.

Validation before independent review:

- Focused prompt/lifecycle/inventory suites: `70 passed, 7 skipped`.
- Broad host suite: `663 passed, 66 skipped, 75 subtests passed`; only the four previously documented unrelated failures remained (`test_mocked_runtime_tests_are_host_safe_tier0`, `test_every_node_suite_has_a_pytest_bridge`, `test_builder_project_uses_regular_project_assets_and_no_legacy_skill_tree`, and `test_backlog_source_identity_matches_pin`).
- Docker Tier 1 source-mode offline probe passed with immutable image, network absent, checks passed, teardown verified, and manifest published at `.test-results/20261017T231329Z-7558-67f49071/tier1`.
- `git diff --check` passed.

The task remains `In Progress`. This candidate performs no live `Ready for Merge` publication, Request Changes transition, merge, abandonment, cleanup, global activation, protected-archive mutation, or Prime Agent source change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Step 9 restores the required observable `Ready for Merge` status gate without restoring task-native lifecycle machinery. The existing Conversation guide now directs exact task-only main status commits, ordinary same-Episode Git integration that preserves Episode-owned task content while applying the Conversation-authorized status, refreshed candidate push/verification, and presentation of `(taskId, mainHead, candidateHead)`. Delay is a no-op; Request Changes returns only the main task to `In Progress`, integrates current main as needed, and uses existing handoff; authorized Merge remains `git merge --ff-only`, supported Backlog `Done`, exact task-only commit, and push. Focused tests, the broad baseline suite, and Docker Tier 1 passed within the documented baseline. The task remains `In Progress`; no live lifecycle transition, merge, cleanup, global activation, protected-archive mutation, or Prime Agent source change occurred.
<!-- SECTION:FINAL_SUMMARY:END -->
