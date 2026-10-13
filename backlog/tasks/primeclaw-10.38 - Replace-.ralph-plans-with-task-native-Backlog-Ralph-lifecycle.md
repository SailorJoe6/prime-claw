---
id: PRIMECLAW-10.38
title: Replace .ralph/plans with task-native Backlog/Ralph lifecycle
status: In Progress
assignee: []
created_date: '2026-10-12 21:02'
updated_date: '2026-10-13 06:26'
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
parent_task_id: PRIMECLAW-10
priority: p1
type: epic
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

The Beads-to-Backlog migration intentionally adopted Backlog.md as-is and preserved the existing Ralph specification, planning, and Episode workflow. That leaves Backlog tasks and `.ralph/plans` folders as duplicate authorities for the same work. Replace that split with one Backlog task that carries the durable design, plan, execution record, lifecycle status, and terminal history for one complete Episode.

Keep the established Conversation/operator/Episode authority boundaries and proven Episode mechanics unless this specification changes them explicitly.

## Task lifecycle

Ordinary work uses these ordered statuses:

1. `In Design`
2. `In Planning`
3. `In Progress`
4. `Blocked`
5. `Ready for Merge`
6. `Done`

`Done` remains the sole successful terminal lifecycle status. Confirmed abandonment uses Backlog soft-deletion as an explicit non-success disposition outside the ordinary status progression and never marks the task `Done`. New ordinary tasks default to `In Design`; `To Do` is retired after migration.

`/design` and `/spec-it-out` create a new `In Design` task or update an explicitly selected task that is already `In Design`. They reject later lifecycle states rather than silently invalidating a plan. The task Description, Acceptance Criteria, constraints, references, and documentation hold the durable specification. These skills do not plan or authorize implementation.

`/plan TASK-ID` accepts only `In Design` or `In Planning`. It writes or revises the task's optional Backlog Implementation Plan and leaves the task `In Planning`. It rejects `In Progress`, `Blocked`, `Ready for Merge`, and `Done`; active Episode revisions use the existing review and handoff loop instead of restarting planning.

Ordinary non-Episode task execution is outside this migration's scope.

## Episode admission

The current `/implement-spec` pathway already requires a usable `EXECUTION_PLAN.md`; the task-native workflow preserves rather than invents that gate. `/implement-task TASK-ID` is the only new-Episode admission path and accepts only an `In Planning` task with a meaningful Backlog Implementation Plan. The existing proportional two-stage review remains: a light structural sniff may reject missing, blank, or obvious-placeholder content, and the semantic workflow rejects unresolved contradictions, blockers, or material product decisions. Do not add a rigid plan schema or bespoke parser.

After semantic readiness succeeds, but before creating a branch, worktree, session, or ownership record, the Conversation changes the exact task on main to `In Progress` through the Backlog CLI and commits that exact task change. That local commit is the hard admission gate and the Episode branch is created from that committed SHA. Push promptly when a remote is available, but remote transport success is not a prerequisite for local Episode creation.

A proven-clean creation failure with no Episode resource or ownership mutation returns the main task to `In Planning`. Any uncertain or partial mutation changes main to `Blocked` with the exact recovery condition; never retry uncertain creation as a new Episode.

## Task and status ownership during an Episode

One task represents one complete Episode across as many execute, handoff, compaction, review, and revision iterations as needed. A handoff continues the same task and Episode; it is not a task or Episode boundary.

While the Episode branch exists:

- the Episode exclusively owns task content on its branch, including Implementation Plan revisions inside approved scope, Implementation Notes, Acceptance Criteria evidence, blocker details, references, and Final Summary;
- the Episode does not independently change task status;
- the Conversation exclusively owns and publishes the true lifecycle status on main, using immediate exact-task commits and prompt pushes;
- main may move `In Progress → Blocked → In Progress` from accepted Episode reports while Episode content remains on the branch; and
- no role copies, mirrors, or dual-writes task content across checkouts during ordinary execution.

The existing Episode-to-Conversation reporting and Conversation-to-Episode continuation channels carry progress, blockers, review findings, and instructions. Do not add a new status signaling mechanism.

## Review, merge readiness, and completion

The Episode reports a candidate while remaining `In Progress`. Its candidate task content must include the current plan, notes, acceptance evidence, references, and Final Summary needed to understand the claimed outcome. The Conversation reviews the exact candidate and may request independent Expert evidence. Accepted findings return to the same Episode through the existing revision/handoff path.

When the Conversation accepts the candidate with no fixes remaining, it does not request merge immediately. It first changes the main task to `Ready for Merge`, commits, and pushes. The Episode then integrates current main into its branch, thereby incorporating the Conversation-owned status and all other landed work. It resolves the expected task-file divergence by preserving the complete Episode-owned content and the Conversation-owned `Ready for Merge` status. The Conversation verifies that refreshed candidate before telling the user it is ready and requesting merge authorization.

At that decision:

- **Delay:** leave main `Ready for Merge` and retain the idle Episode, branch, worktree, session, and ownership.
- **Request changes:** return main to `In Progress`, commit and push, integrate main into the same Episode, and resume it.
- **Authorize merge:** the Conversation performs and verifies the merge. Immediately after verified merge, the Conversation changes the exact merged main task from `Ready for Merge` to `Done`, commits, and pushes. Episode ownership records and resources remain until the existing separately authorized finalization and cleanup paths complete.
- **Decline:** means explicit project abandonment, not delay. Require strong confirmation before any destructive action.

`backlog task complete` is periodic cleanup, not a per-Episode lifecycle step. Leave `Done` tasks on the active board until normal batch cleanup moves them to `backlog/completed/`.

For confirmed abandonment, preserve history without merging candidate code: stop the Episode; bind its exact head and task path; snapshot the Conversation-owned main status and invariant task identity/hierarchy metadata; restore only the bound task blob from the Episode branch; immediately reapply the captured main status through the Backlog CLI; and verify the effective diff preserves identity, hierarchy, and Conversation-owned status while importing only Episode-owned task content and no code path. Then add an abandonment Final Summary through the Backlog CLI, run `backlog task archive TASK-ID` without marking it `Done`, commit and push the exact archival change, verify it, and only then destroy the branch, worktree, session, and ownership resources. `backlog/archive/` remains reserved for soft-deleted work.

## Authority replacement

Backlog task fields and statuses replace every `.ralph/plans` authority, including future specification folders, active plan files, blocked-folder movement, promotion commits, and plan archives. Runtime ownership may retain only the minimal exact task/Episode identity needed by existing mechanics; it must not recreate specification, plan, progress, or status authority.

Update Prime Claw commands, model-callable tools, skills, managed templates, initialization and reconciliation assets, documentation, tests, recovery, handoff, review, and finalization language to use exact task identity and supported Backlog fields. Preserve Conversation supervision, exact Episode ownership, isolated code worktrees and sessions, handoff and compaction continuation, Expert review boundaries, recovery behavior, operator merge/abandonment/cleanup authority, and no-UI final bookkeeping.

## Legacy bundle and task migration

Migrate every existing `To Do` task: a task with a meaningful Implementation Plan becomes `In Planning`; one without becomes `In Design`. Preserve truthful `In Progress`, `Blocked`, `Ready for Merge`, and `Done` states where stronger legacy evidence exists.

Every durable legacy specification/plan bundle becomes one Backlog epic:

- reuse an exact one-to-one owning task and change its type to `epic` when needed;
- otherwise create one epic and link related existing tickets through Backlog references;
- never change existing task IDs or `parent_task_id` values, and add no Backlog reparenting feature;
- merge specification narrative into Description, true acceptance criteria into native Acceptance Criteria, the execution plan into Implementation Plan, execution history into Implementation Notes, and terminal outcome into Final Summary;
- import true acceptance criteria in source order so Backlog assigns native sequential markers, retaining legacy requirement IDs inside criterion text for provenance;
- preserve material meaning in supported task fields and record the exact pre-cutover commit and source paths so verbatim originals remain retrievable from Git history; and
- when ownership relationships are ambiguous, add references for every plausible relationship and flag the ambiguity for explicit disposition rather than guessing or duplicating tasks.

Successfully completed and accepted-historical bundles become truthful `Done` epics and may be moved to `backlog/completed/` as part of the one-time migration cleanup. The superseded incomplete Phase 3a bundle also becomes a `Done` completed epic because it records real work later reworked: preserve evidence-based checked and unchecked criteria, state the partial/superseded outcome in Final Summary, and link the replacement epic in both directions. Do not use `backlog/archive/` for any existing bundle; the current inventory contains no truly abandoned bundle.

## Cutover

Implement and land this change through one final old-style `.ralph/plans` migration Episode. The candidate branch itself contains the completed state migration, task-native workflow, and deletion of `.ralph/plans`. A normal accepted merge makes that repository state current. Do not build runtime cutover automation, merge hooks, a dual-write compatibility phase, or another tracker abstraction.

The compatibility `SPECIFICATION.md` for this effort remains only a pointer to this task until that final candidate deletes `.ralph/plans`.

## Material constraints and non-goals

- Preserve operator authority over product and scope changes, Episode admission, merge, delay, abandonment, and destructive cleanup.
- Keep the migration KISS: adapt existing lifecycle guards and ownership from exact plan-folder identity to exact task identity.
- Do not add a pickup command or other ordinary direct-work plugin surface.
- Do not make every task require planning or an Episode.
- Do not split one Episode into tasks per execute or handoff iteration.
- Do not add Backlog reparenting, cross-checkout task wrappers, branch-projection rules, status-sync protocols, approval commits, Git-blob or tag approval schemes, replacement digest protocols, transaction journals, or custom merge drivers.
- Do not broaden this work into Orca redesign, Prime Agent upstream changes, general plugin simplification, or unrelated cleanup.
- Use supported Prime Agent and Backlog.md interfaces. Prime Agent remains an upstream dependency, not a development target.
- Validate plugin-source changes only through the repository's Docker-isolated candidate path; do not mutate the installed user-global plugin during development.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Project configuration, guidance, and tests expose the ordered statuses `In Design`, `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, and terminal `Done`; default new ordinary tasks to `In Design`; and contain no active workflow that creates or selects `To Do` after migration.
- [ ] #2 Fresh and existing-task tests prove `/design` and `/spec-it-out` create or update only `In Design` tasks, persist specification content in supported task fields, and reject later states without planning or implementation authorization.
- [ ] #3 `/plan TASK-ID` tests prove only `In Design` and `In Planning` are accepted; the same task receives a meaningful Implementation Plan and becomes or remains `In Planning`; later states are rejected without mutation or Episode creation.
- [ ] #4 `/implement-task TASK-ID` is the sole new-Episode admission command and accepts only an `In Planning` task. Structural and semantic tests preserve the existing proportional plan-readiness gate and reject missing, blank, placeholder-only, contradictory, blocked, or materially unresolved plans before Episode resources or ownership are created.
- [ ] #5 Admission tests prove semantic readiness precedes an exact main-task `In Progress` commit; the Episode branch starts from that committed SHA; prompt push failure alone does not block local creation; a proven-clean creation failure returns the task to `In Planning`; and uncertain partial creation marks main `Blocked` without retry.
- [ ] #6 End-to-end evidence proves one task spans one Episode across multiple execute, handoff, compaction, review, and revision iterations and retains exact task, owner, branch, worktree, and session identity.
- [ ] #7 Ownership tests prove the Episode alone mutates task content on its branch, the Conversation alone mutates lifecycle status on main, the Episode never independently changes status, and ordinary execution performs no cross-checkout content copy, mirroring, or dual write.
- [ ] #8 Blocked/resume tests prove an Episode records blocker content on its branch through existing reporting, the Conversation publishes `Blocked` and resumed `In Progress` on main through exact commits, and the same Episode resumes without a new task or admission.
- [ ] #9 Final-review tests prove Expert or Conversation findings can revise the same Episode; final Conversation acceptance publishes `Ready for Merge` on main before merge authorization; the Episode integrates current main and preserves Episode content plus Conversation status; and the Conversation verifies the refreshed candidate before requesting user authorization.
- [ ] #10 Operator-decision tests prove delay retains `Ready for Merge` and all Episode resources, requested changes return main to `In Progress` and resume the same Episode, and authorized merge is verified before the Conversation immediately commits the exact main task as `Done`; ownership records and resources remain until separately authorized finalization/cleanup; `backlog task complete` is not invoked per Episode.
- [ ] #11 Confirmed-abandonment tests prove strong confirmation precedes mutation; only the exact bound Episode task blob is selected; the effective main diff imports Episode-owned content while preserving Conversation-owned status plus invariant identity/hierarchy metadata; no candidate code is merged; an abandonment Final Summary is recorded; the task is archived without being marked `Done`; and exact archival state is committed and pushed before destructive Episode cleanup.
- [ ] #12 Commands, tools, skills, managed templates, initialization/reconciliation assets, ownership records, docs, recovery, review, handoff, finalization, and tests use exact Backlog task identity and supported fields instead of `.ralph/plans` location or file movement as lifecycle authority.
- [ ] #13 A task-status migration fixture proves every pre-cutover `To Do` task with a meaningful Implementation Plan becomes `In Planning`, every `To Do` task without one becomes `In Design`, and existing active, blocked, ready, and done work retains truthful semantics.
- [ ] #14 A bundle migration fixture proves each legacy bundle becomes one epic; exact owning tasks are reused when unambiguous; otherwise new epics reference related tickets without changing any existing task ID or parent; specification, plan, notes, outcomes, criteria state, legacy IDs, source paths, and pre-cutover commit provenance remain traceable.
- [ ] #15 A representative terminal-history fixture proves completed and accepted-historical bundles become truthful `Done` epics, the superseded incomplete Phase 3a bundle remains explicitly partial with evidence-based unchecked criteria and bidirectional replacement references, one-time successful history may enter `backlog/completed/`, and no existing bundle enters `backlog/archive/`.
- [ ] #16 Repository-wide acceptance proves no live command, skill, workflow, template, test, or documentation treats `.ralph/plans` as authoritative; historical references remain only where changing them would falsify history.
- [ ] #17 The final candidate tree contains the completed state migration and task-native workflow and no `.ralph/plans` directory; normal merge applies that tree without runtime cutover automation, merge hooks, dual-write compatibility, custom merge drivers, or another tracker abstraction.
- [ ] #18 Existing tests plus focused Docker-isolated plugin acceptance prove Conversation, operator, Episode, and Expert authority; exact ownership; isolated code worktrees; iteration handoff; recovery; review; post-merge `Done` before separately authorized finalization/cleanup; final bookkeeping; and cleanup boundaries remain intact apart from the specified task-native lifecycle.
- [ ] #19 Static and behavioral acceptance proves no pickup surface, Backlog reparenting feature, cross-checkout Backlog wrapper, branch-projection rule, approval commit/blob/tag scheme, replacement digest protocol, bespoke transaction journal, Prime Agent patch, or other unapproved scope expansion is introduced.
<!-- AC:END -->

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
<!-- SECTION:NOTES:END -->
