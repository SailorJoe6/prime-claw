---
id: PRIMECLAW-10.38
title: Replace .ralph/plans with task-native Backlog/Ralph lifecycle
status: In Progress
assignee: []
created_date: '2026-10-12 21:02'
updated_date: '2026-10-13 13:09'
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
<!-- SECTION:NOTES:END -->
