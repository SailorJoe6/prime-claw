---
id: PRIMECLAW-43
title: Support selectable task providers with grandfathered legacy execution
status: In Progress
assignee: []
created_date: '2026-10-15 21:20'
updated_date: '2026-10-18 21:16'
labels: []
dependencies: []
references:
  - PRIMECLAW-10.38
  - >-
    https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md
  - 'https://www.dolthub.com/docs/concepts/dolt/git/remotes/'
documentation:
  - VISION.md
  - LONG_RANGE_PLAN.md
  - docs/project-initialization.md
  - docs/future-specification-bundles.md
  - docs/conversation-driven-episode-oversight.md
  - docs/backlog.md
  - docs/user-stories/C-specification.md
  - docs/user-stories/D-planning.md
  - docs/user-stories/E-episode-promotion.md
  - docs/user-stories/F-episode-execution.md
  - docs/user-stories/G-oversight-and-review.md
  - docs/user-stories/H-handoff-and-continuation.md
  - docs/user-stories/I-episode-finalization.md
  - docs/user-stories/traceability.md
priority: p1
type: epic
ordinal: 125000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome

Prime Claw supports exactly one live task provider per repository—Backlog.md or Beads—behind the same task-native design, planning, Episode, review, recovery, and terminal lifecycle. Task history is canonical and independent of code branches. Exactly grandfathered `.ralph/plans` work may finish or migrate, but no new legacy specification may be created or revised.

This work supersedes the Backlog-only and branch-local assumptions in `PRIMECLAW-10.38`. Its already admitted Episode may finish under its current authority. Implementation of this task and the repository cutover in `PRIMECLAW-43.1` must wait until `PRIMECLAW-10.38` reaches a terminal decision.

## Governing implementation rule: least technology

Implement the smallest design that satisfies these requirements. The required order of preference is:

1. use the provider's supported native command, configuration, Git, or Dolt behavior;
2. express semantic judgment as concise managed instructions to the responsible LLM role;
3. add only the narrow deterministic adapter code needed for integrity or transport; and
4. introduce new persistent state or a custom state machine only when the first three cannot meet a named acceptance criterion and the implementation plan proves why.

Do not encode LLM-suitable judgment as workflow machinery. In particular, the Episode or supervising Conversation reasons about newly discovered implementation facts, compatible task edits, living-plan revisions, and semantic conflicts. Code only synchronizes exact data, reports exact changes, preserves identity and revisions, enforces authority boundaries, and prevents silent loss. Do not build a replacement tracker, speculative abstraction framework, task mirror, persistent lock service, or parallel migration ledger.

## Authority, discovery, and provider selection

The live stores themselves select authority; there is no separate provider-selection file or shadow record.

- One valid Backlog store and no valid Beads store selects Backlog.
- One valid Beads store and no valid Backlog store selects Beads.
- No live provider evidence causes Prime Claw initialization to recommend and create `.backlog/` unless the operator explicitly selects supported Beads.
- Simultaneous valid Backlog and Beads evidence is an incomplete migration and blocks task lifecycle mutation.
- Malformed, unavailable, or uncertain evidence blocks with exact remediation. Exports, archives, and stray directories are not live evidence.

Prime Claw supplies one pinned managed Backlog executable and capability-checks it. Direct use of that executable retains upstream's `backlog/` initialization default; Prime Claw initialization and migration explicitly choose `.backlog/`. A valid existing `backlog/` or custom layout remains supported when the operator elects to retain it.

Backlog discovery preserves native configuration behavior: root `backlog.config.yml` takes precedence, otherwise `backlog/config.yml` or `.backlog/config.yml` is valid, and a root configuration may select a custom directory. During nested-checkout migration, folder-local configuration moves with its store. Root configuration moves into the task checkout. A retained custom directory uses a validated relative root `backlog.config.yml` symlink to the checkout configuration and receives a brittleness warning; normalization to `.backlog/` is offered instead.

A supported existing Beads store selects Beads even though managed Backlog is installed. Prime Claw validates the installed `bd` capabilities and required configuration rather than treating executable presence as authority.

## Common lifecycle and narrow provider boundary

Both providers map their native fields to:

1. `In Design`
2. `In Planning`
3. `In Progress`
4. `Blocked`
5. `Ready for Merge`
6. `Done`

Backlog defines those exact ordered statuses. Beads uses `in_design:active`, `in_planning:active`, `ready_for_merge:wip`, and `done:done`, plus compatible built-in `in_progress` and `blocked`. Capability checks include category-aware readiness.

Existing skills and canonical lifecycle tools remain the UX. A narrow internal provider adapter covers only exact identity, reads, native mutations, transitions, workspace preparation, synchronization, publication, revision evidence, and exact change presentation. Native `backlog` and `bd` commands remain underneath it. A Backlog path is provider detail, not universal identity.

Living specifications, acceptance criteria, plans, execution notes, references, documentation, modified files, comments, and final summaries use supported provider-native fields. Implementation plans remain living documents. An authorized Episode may revise its task and plan as implementation uncovers in-scope facts.

## Backlog topology

Backlog task history uses the ordinary orphan branch `refs/heads/prime-claw/tasks` in the existing repository remote. Its DAG is disconnected from code history. Every code checkout or worktree gets an ignored independent nested clone at the configured Backlog directory, checked out on that branch. It is not a submodule, linked worktree, alternate-index view, same-root custom Git work tree, or separate hosted repository.

The remote is selected from the primary code branch's upstream. If none exists, the sole repository remote is used. No remote permits explicitly unpublished local-only task history. Ambiguous multiple remotes block for operator selection.

Prime Claw creates or verifies the task branch and primary nested checkout, prepares one in each Episode worktree before session start, repairs a missing checkout on preparation or first access, and refuses parent-worktree cleanup while the nested checkout is dirty or unpublished.

Backlog's code-repository auto-commit behavior is disabled. Prime Claw runs supported Backlog mutations, then ordinary Git commit and push inside the nested clone. Reads fetch and reconcile first. Stale pushes are rejected; force overwrite is forbidden. Different-task changes reconcile through normal Git behavior.

## Beads topology

Beads keeps its repository-associated canonical Dolt database. Supported multi-agent use requires native per-project server mode. Prime Claw validates and configures supported `bd` auto-start/lifecycle or a validated operator-managed external server; it does not build another server manager or require the machine-global shared-server mode under `~/.beads/`.

Dolt history remains independent of the code DAG and is synchronized through supported Dolt operations, including `refs/dolt/data` transport through the repository remote when configured. `.beads/issues.jsonl` is export, interchange, or backup data, never live authority. Raw Dolt operations do not race an active server.

## Revisions, iteration, and concurrent edits

Revision evidence records facts; it does not freeze development.

Each ownership and lifecycle receipt binds the provider, canonical task ID, exact Episode code HEAD, the provider's published store revision, and task-scoped evidence. Backlog uses ordinary task-branch Git evidence. Beads uses the Dolt revision plus a normalized task view because its row `revision` alone does not cover every label, dependency, comment, rename, or related write.

An unrelated task update never blocks an Episode merely because the store revision advanced. Owner-authored task or plan updates are normal iterative development: publish them and advance the receipt. When an outside writer changes the owned task, deterministic code synchronizes and presents the exact change; it does not decide semantic compatibility. Managed Episode or Conversation instructions require the LLM to incorporate compatible in-scope changes and continue, while escalating only genuine semantic conflicts, authority changes, or product/scope decisions to Conversation oversight and, when required, the operator.

Automated tests prove change detection, exact diff delivery, revision transport, publication, and no-silent-overwrite behavior. Prompt review and representative UAT prove the LLM reconciliation policy. Do not implement a semantic merge state machine.

## Command routing and grandfathered legacy work

`/design` and `/spec-it-out` author only exact `In Design` tasks in the selected provider. They never create or revise `.ralph/plans`.

`/plan` and `/implement-task` accept either one exact selected-provider task ID or one exact grandfathered `.ralph/plans/future/<slug>` path. They never search for or invent a target. Version-2 ownership binds provider plus canonical task identity; version-1 ownership retains the exact legacy source and mechanics.

Upgrade records the exact unfinished grandfathered inventory and accepted specification digest for each source. Archive-only history does not qualify or trigger reminders. A grandfathered specification is frozen; its plan remains living. Pure legacy work neither requires nor mutates a provider task. New follow-up work uses the selected provider. A material product-contract change migrates the legacy work instead of revising the legacy specification.

Legacy-to-task migration is explicit, reviewed, one-way, and lossless. It preserves source location, content, provenance, criteria, execution history, exact revisions, and—when active—the same Episode, session, worktree, branch, and reviewed code identity. It establishes one task authority before retiring legacy authority and never leaves two writable sources.

## Complete provider migration and cutover

A provider switch migrates every task, including all closed work, with all content, hierarchy, dependencies, comments, lifecycle state, history, and provenance. Nothing is deliberately omitted; data without an equivalent destination field is preserved losslessly in destination-supported metadata or provenance. Preserve source IDs when the destination safely supports them; otherwise allocate provider-native IDs and retain immutable source-to-destination mappings in the migration receipt.

Migration uses a bounded repository-wide maintenance window. Provider mutations are quiesced; the exact source revision is captured; everything is migrated and verified; active ownership is transitioned; the destination is activated; and only then is the source store deleted. Prime Claw does not build online change capture or dual-write synchronization.

The migration receipt binds exact source and destination revisions, complete counts and digests, ID mappings, verification evidence, ownership transitions, actor, and timestamp. Any failure or uncertainty before verified cutover leaves the source intact and authoritative, blocks lifecycle mutation with an exact recovery condition, and never creates another destination copy or force-selects a provider. After complete verification, ownership transition, and cutover, source deletion is immediate; no source-provider archive remains.

## Validation boundary

Automated tests cover only deterministic behavior: provider evidence and capability gates, workspace setup and cleanup, native synchronization, optimistic concurrency, ownership and receipts, exact change delivery, lifecycle transitions, complete migration, verification, failure recovery, and destructive cutover guards.

Managed Markdown instructions receive content review, reconciliation checks, and representative UAT. Tests must not pretend to prove semantic LLM behavior. The implementation plan must identify the smallest mechanism for each acceptance criterion and explicitly reject unnecessary persistent state or state-machine machinery.

## Non-goals

- Do not patch or fork Prime Agent.
- Do not create a provider-selection file, shadow task model, general Prime Claw tracker CLI, mirror, or dual-write path.
- Do not add persistent Prime Claw task/store locks.
- Do not use submodules, alternate Git indexes, linked nested worktrees, same-root custom Git work trees, or a separate hosted Backlog repository.
- Do not require DoltHub or Beads machine-global shared-server mode.
- Do not turn semantic task reconciliation or iterative plan refinement into deterministic workflow code.
- Do not create or revise legacy specifications after cutover.
- Do not implement, migrate data, change provider authority, or alter active Episode ownership merely by authoring this specification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The implementation plan maps every acceptance criterion to the least-technology mechanism in this order: provider-native behavior, managed LLM instruction, then narrow deterministic adapter code; it justifies any new persistent state or state machine, and review rejects semantic workflow machinery that a prompt can perform.
- [ ] #2 Sequencing gates prove the admitted PRIMECLAW-10.38 Episode may finish under existing authority while implementation of PRIMECLAW-43 and PRIMECLAW-43.1 remains blocked until PRIMECLAW-10.38 reaches a terminal decision.
- [ ] #3 Provider discovery recognizes only valid live initialization evidence, selects the sole Backlog or Beads store, defaults new Prime Claw initialization to `.backlog/` unless supported Beads is explicitly selected, blocks malformed or dual live evidence, and creates no provider-selection file or shadow authority.
- [ ] #4 Prime Claw supplies and capability-checks one pinned managed Backlog executable while preserving upstream direct-init `backlog/` behavior; Prime Claw initialization recommends `.backlog/`, and valid retained `backlog/` or custom layouts remain supported by explicit operator choice.
- [ ] #5 Backlog configuration and migration acceptance preserves native root and folder discovery, moves configuration with the nested task checkout, offers custom-layout normalization, and uses only a validated relative root symlink when an operator retains a custom directory.
- [ ] #6 Provider fixtures prove Backlog statuses and Beads custom plus built-in statuses map exactly to In Design, In Planning, In Progress, Blocked, Ready for Merge, and Done, including category-aware readiness capability checks before mutation.
- [ ] #7 Existing skills and canonical tools remain the UX over a narrow provider adapter for identity, native reads and writes, workspace preparation, synchronization, publication, revisions, and exact change presentation; native `backlog` and `bd` interfaces remain underneath, with no general replacement tracker CLI.
- [ ] #8 Managed `/design` and `/spec-it-out` content, reconciliation, and UAT target only exact selected-provider In Design tasks and never create or revise `.ralph/plans`; `/plan` and `/implement-task` deterministically accept only one exact provider task ID or grandfathered path without search or substitution.
- [ ] #9 Generalized version-2 ownership and all task-native lifecycle receipts bind provider, canonical task ID, exact Episode code HEAD, published store revision, and task-scoped evidence without treating a Backlog path as universal identity.
- [ ] #10 Backlog acceptance proves task history uses disconnected ordinary orphan branch `refs/heads/prime-claw/tasks` in the selected existing remote and an ignored independent nested clone per code worktree, never a submodule, linked worktree, alternate index, same-root custom work tree, or separate hosted repository.
- [ ] #11 Backlog remote selection uses the primary code branch upstream, otherwise the sole remote; no remote permits explicit local-only unpublished history, while ambiguous remotes block. Workspace setup creates, validates, or repairs each nested checkout and cleanup refuses dirty or unpublished state.
- [ ] #12 Backlog synchronization disables tracker auto-commit, commits supported native mutations in the nested clone, refreshes before reads and writes, rejects stale pushes and force overwrite, and reconciles unrelated-task changes through ordinary Git behavior without persistent locks.
- [ ] #13 Beads acceptance uses one repository-associated Dolt store in native per-project server mode, validates supported `bd` auto-start/lifecycle or an operator-managed external server, rejects unsupported concurrency, uses supported Dolt transport including `refs/dolt/data` when configured, and never treats `.beads/issues.jsonl` as authority.
- [ ] #14 Revision acceptance proves unrelated-task advances and owner-authored iterative task or living-plan updates do not block; receipts advance after publication, and outside same-task changes are synchronized and delivered as exact evidence to the responsible LLM rather than decided by a deterministic semantic merge state machine.
- [ ] #15 Managed Episode and Conversation instructions require LLM reasoning to incorporate compatible in-scope task changes, keep the task and plan current, and escalate only genuine semantic conflicts, authority changes, or product/scope decisions; representative UAT covers this behavior while automated tests cover only deterministic transport and integrity.
- [ ] #16 Upgrade records the exact unfinished grandfathered set and accepted specification digests, rejects new or materially revised legacy specifications, excludes archive-only history from reminders, and preserves provider-independent version-1 planning, execution, review, recovery, and finalization with frozen specifications and living plans.
- [ ] #17 Legacy-to-task migration is explicit, reviewed, one-way, and lossless; it targets the selected provider, preserves provenance and exact active Episode identity, establishes one task authority before retiring legacy authority, and leaves version-1 recovery intact on failure.
- [ ] #18 Provider-switch acceptance uses a bounded mutation-free maintenance window and migrates every open and closed task with all fields, relationships, comments, lifecycle state, history, and provenance, preserving any non-native value losslessly in destination-supported metadata or provenance; IDs are preserved when safely supported and otherwise receive immutable source-to-destination mappings.
- [ ] #19 Cutover verification binds exact source and destination revisions, complete counts and digests, ID mappings, ownership transitions, actor, and timestamp. Any pre-cutover failure keeps the source intact and authoritative; only complete verification and ownership transition activate the destination and immediately delete the source store.
- [ ] #20 Automated tests cover deterministic discovery, capability gates, workspaces, synchronization, optimistic concurrency, revision and diff transport, ownership, transitions, complete migration, recovery, and destructive cutover guards. Managed prose receives content review, reconciliation checks, and representative UAT instead of artificial behavioral unit tests.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Guardrails and sequencing

- Recheck that `PRIMECLAW-10.38` is terminal before the first implementation change. It is currently `Done`. This task builds provider support only; `PRIMECLAW-43.1` performs this repository's later data cutover.
- For every slice, use native `backlog`, Git, `bd`, and Dolt behavior first; use managed Markdown instructions for semantic judgment; add TypeScript only for deterministic identity, integrity, transport, and lifecycle authority.
- Do not add a public tracker CLI, provider-selection file, mirror, lock service, semantic merge engine, workflow state machine, abstract provider class, dynamic provider registry, universal task model, custom diff format, canonical migration schema, persisted migration checkpoint, submodule, alternate index, linked nested worktree, or dual-write path.
- Add no new mutable coordinator state. The only durable additions allowed are fields on the existing version-2 ownership/receipt records required by AC 9/14/17, the grandfathered-work inventory required by AC 16, and the final migration receipt required by AC 18/19. Keep the migration receipt in destination-native history/provenance; if a provider cannot hold the exact receipt, stop for plan review rather than inventing a sidecar authority.

## Implementation slices

1. **Add only the provider functions that existing lifecycle call sites need.** Replace each Backlog-specific resolver or mutation with direct functions for live-provider detection, capability checking, exact task resolution/mutation, native sync/publication, workspace preparation, and revision evidence. Keep the Backlog and Beads branches together in one module unless ordinary file size alone later requires a split. Do not create an abstract base class, registration mechanism, dynamically extensible provider system, provider-neutral task object, or duplicated task store. Detect valid Backlog or Beads initialization directly from native configuration/store evidence, reject malformed or dual evidence, and default Prime Claw initialization to `.backlog/` while allowing explicit supported Beads selection. Preserve the pinned managed Backlog build and upstream direct-init behavior. Update the plugin asset inventory only for an actual new managed source file. **[AC 1, 3, 4, 6, 7]**

2. **Implement provider-native workspace behavior without new coordination services.**
   - For Backlog, use ordinary Git to create/verify disconnected `refs/heads/prime-claw/tasks`, select the primary branch upstream or sole remote, and materialize an ignored independent nested clone in the configured directory for the primary checkout and each Episode worktree. Preserve root/folder configuration rules, offer `.backlog/` normalization, validate the retained custom-directory relative symlink, disable Backlog auto-commit, and use fetch/reconcile/commit/push with stale-push rejection and no force overwrite. Refuse cleanup when the nested checkout is dirty or unpublished.
   - For Beads, validate the installed `bd` version, lifecycle statuses, category-aware readiness, native per-project server mode, and supported auto-start or operator-managed server configuration. Use supported Dolt synchronization and `refs/dolt/data` transport; never use JSONL as authority or race raw Dolt writes against the server.
   Wire workspace preparation and cleanup into existing project initialization and Episode allocation/cleanup paths rather than adding a daemon. **[AC 4, 5, 6, 10, 11, 12, 13]**

3. **Route the existing task-native UX through the selected provider.** Generalize the reviewed-plan resolver, prep-chain admission, task Episode admission/status changes, handoff, oversight, finalization, and cleanup to the provider-neutral identity while leaving version-1 folder routes intact. Revise the managed `design`, `spec-it-out`, `plan-task`, `implement-task`, `execute`, `blocked`, handoff, expert-review, and Conversation oversight instructions to call the selected provider's native CLI and accept only one exact task ID or one exact grandfathered path. Put compatible-edit, living-plan, and semantic-conflict decisions in those managed instructions, not code. Reconcile project-customizable copies through the existing template mechanism. **[AC 7, 8, 15]**

4. **Generalize ownership and revision evidence in place.** Extend version-2 ownership and lifecycle receipts with provider, canonical task ID, published provider revision, task-scoped evidence, and exact Episode code HEAD; retain Backlog path data only as provider-specific evidence. Safely recognize existing version-2 Backlog records only when live evidence corroborates them; do not create version 3 or another authority file. At every boundary run `sync → read → native mutate → publish → record revision`. Advance receipts after owner-authored task/plan changes and ignore unrelated-task store advances. For an outside same-task edit, pass the provider-native `git diff`, `dolt diff`, and exact task views to the Episode or Conversation prompt. Do not invent a normalized diff, patch language, semantic classifier, or merge algorithm. Deterministic code must only prevent silent overwrite and prove publication. **[AC 9, 12, 14, 15]**

5. **Preserve grandfathered version-1 work with one simple inventory.** During upgrade, record only the exact unfinished legacy locations and accepted specification digests. Keep their specifications frozen, plans living, archive-only history excluded, and pure legacy execution provider-independent. Reject new or materially revised legacy specifications. Adapt the existing reviewed legacy-to-task transition so it creates the selected-provider task, preserves all content/provenance and the same active Episode/session/worktree/branch/code identity, switches to one authority only after successful publication, and leaves version-1 recovery unchanged on failure. **[AC 16, 17]**

6. **Run provider migration as one linear maintenance operation.** Extend project initialization/upgrade with one operator-confirmed provider switch rather than a general tracker command. Quiesce mutations, capture the exact source revision, and use provider-native export/read/create/history operations to migrate every open and closed task plus all fields, comments, hierarchy, dependencies, status, history, and provenance. A concise managed migration prompt decides semantic placement only when the destination has no equivalent field; code records that decision and checks exact source/destination field projections, counts, relationships, revisions, and ID mappings. Do not build a universal migration model, semantic converter, persisted phase machine, checkpoint/resume engine, replay log, or online retry loop. After deterministic verification, transition active ownership, activate the destination, write the exact receipt to destination-native history/provenance, delete the source initialization/store, and resume mutations. Any pre-cutover failure leaves the source intact and authoritative and reports the exact native cleanup or same-destination retry condition; never dual-write or create another destination copy. **[AC 18, 19]**

7. **Validate each new deterministic seam once and update product documentation.** Reuse the existing Node lifecycle fixtures and Python asset/skill checks. Add one focused contract fixture per new provider function, then only representative Backlog and Beads end-to-end paths for admission, publication, cleanup, legacy transition, successful full migration, pre-cutover failure, and source-deletion refusal. Do not create a provider × lifecycle Cartesian test matrix or duplicate unchanged lifecycle tests. Keep semantic reconciliation and non-equivalent-field placement out of fake unit tests: review the managed prompts and run representative UAT for compatible edits, real conflicts, and migration placement. Update `docs/backlog.md`, the lifecycle user stories and traceability matrix, installation/upgrade guidance, and architecture notes. After each plugin-source change run Docker-only tier 1; finish with the relevant Node/Python suites and `scripts/test-all.sh`. Do not apply the candidate user-globally during implementation. **[AC 20]**

## Acceptance-to-mechanism check

| AC | Least-technology mechanism |
|---|---|
| 1 | These guardrails plus review of every slice; native behavior and prompts precede code. |
| 2 | One structured prerequisite check with recorded evidence before implementation; `PRIMECLAW-10.38` is already `Done`, so no permanent runtime gate is added. |
| 3 | Native live-store evidence inspected by the small discovery function; no selection record. |
| 4 | Existing pinned Backlog build plus explicit `.backlog/` argument only in Prime Claw initialization. |
| 5 | Backlog's own config discovery and one validated relative symlink only for retained custom layout. |
| 6 | Provider capability/status fixtures against native CLI output. |
| 7 | Direct functions at existing lifecycle call sites; no provider framework or universal task model. |
| 8 | Existing managed skills and prep chains with provider-aware instructions and exact input validation. |
| 9 | Additional fields on the existing version-2 ownership/receipt schema, not another store. |
| 10 | Ordinary orphan branch plus independent nested clones. |
| 11 | Ordinary Git upstream/remote discovery and clean/published checks. |
| 12 | Ordinary fetch, reconcile, commit, and push; no lock service. |
| 13 | Native Beads per-project server and Dolt transport. |
| 14 | Native optimistic concurrency and raw provider diffs/task views delivered to the LLM. |
| 15 | Managed Episode/Conversation prompts and representative UAT. |
| 16 | One exact grandfather manifest because a durable allowlist/digest is required to reject new legacy work. |
| 17 | The existing ownership-transition path generalized to the selected provider. |
| 18 | One linear maintenance-window migration using native operations, prompt-based semantic placement, and narrow field/count/relation checks. |
| 19 | One destination-native immutable receipt and a final verified source deletion gate. |
| 20 | One contract fixture per new seam, a few representative end-to-end paths, prompt review, and real semantic UAT. |
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18 Episode slice 1a (provider discovery + capability gates, first sub-slice of plan slice 1):

- Added `src/prime-agent-plugin/extension-support/task-providers.ts`: `detectTaskProvider` selects the sole live provider from native store evidence (Backlog: root `backlog.config.yml` precedence mirroring upstream `resolveBacklogDirectory`, else config-bearing `backlog/` or `.backlog/` folder, custom directory via root config; Beads: `.beads/` with coherent Dolt `metadata.json` + `config.yaml`, `no-db` mode rejected since JSONL is never authority). Malformed evidence and dual live evidence block with exact remediation; stray directories and exports are not evidence; no evidence returns `none` so initialization can default to `.backlog/`. No provider-selection file or shadow state.
- Added `checkBacklogCapabilities` (pinned executable responds; `backlog config get statuses` matches the exact ordered canonical lifecycle) and `checkBeadsCapabilities` (`bd --version`; `bd statuses --json` proves `in_design:active`, `in_planning:active`, built-in `in_progress`/`blocked` as wip, `ready_for_merge:wip`, `done:done`). Capability checks are behavioral; the exact Backlog version pin is enforced at image build time (Dockerfile ARG + smoke), not duplicated in plugin source.
- `BEADS_STATUS_MAP` exported as the single exact mapping table. Verified live against real stores: this repo (Backlog, folder config) and a scratch `bd init` store (Beads 1.1.2, embedded mode).
- Tests: new `tests/task_providers.test.mjs` (25 cases: selection, precedence, custom dirs, malformed/dual blocking, no-db rejection, capability pass/fail) + `tests/test_task_providers.py` bridge (tier-1 node suite + tier-0 static contract). Asset inventory gained `plugin-extension-support-task-providers-ts`; `EXPECTED_TYPESCRIPT` updated.
- Docs: `docs/backlog.md` gained a "Provider discovery and capability seam" section.
- AC progress (partial, none complete yet): AC 3 discovery core and AC 6 status-mapping checks implemented for both providers; AC 1 mechanism ordering preserved (native CLI + FS evidence only, zero new persistent state).

Pre-existing main-branch test drift observed (NOT from this slice, reproduced on canonical main): `test_runtime_image.py::test_backlog_source_identity_matches_pin` (deps/backlog submodule is at 5d556c19 = v1.53.0-1-g5d556c19 after the `task restore` fork commit, but `scripts/build-backlog.sh`, `docker/runtime.Dockerfile`, and `tests/test_backlog_build.py` still pin fd20f714), `test_project_initialization.py::test_builder_project_uses_regular_project_assets_and_no_legacy_skill_tree` (templates.json manifest not re-reconciled after 7afcf67 changed design/spec-it-out template sources), `test_container_helpers_static.py` (two failures: unbridged task_episode_admission suite; runtime-connect host-safe sentinel). Reported to the owning Conversation for triage; left untouched as out of scope.

Remaining for later sub-slices of plan slice 1: route existing lifecycle call sites (`resolveBacklogTask`, task admission status mutations) through provider-aware resolution, live-provider gating at lifecycle boundaries, and plugin-managed `.backlog/` defaulting in project initialization. Workspace preparation (orphan task branch + nested clones), revision evidence, and sync/publication remain plan slices 2+.

2026-10-18 Conversation review of slice 1a (6c9878a): Conversation review requested a revision for three accepted in-scope findings; repair the pushed candidate before advancing to lifecycle routing.

Accepted repair scope (exact):
1. Root `backlog.config.yml` branch without `backlog_directory`: match native Backlog store selection — prefer a built-in directory carrying folder configuration BEFORE falling back to a bare built-in directory (current code takes the first existing bare `backlog/` over `.backlog/config.yml`). Parity fixture: empty `backlog/` plus `.backlog/config.yml` must select `.backlog`.
2. Export-only/non-initialized `.beads/` residue (e.g. only `issues.jsonl`) is NO live Beads evidence (not malformed): export-only alone yields `none`; valid Backlog plus export-only Beads still selects Backlog. Genuine partial native initialization (e.g. config.yaml present, metadata.json missing/invalid) keeps blocking.
3. Replace the literal YAML regex for `no-db` with the supported native effective-config read (`bd config get no-db`) once native Beads store evidence exists; block when the effective value is true OR unreadable/uncertain, with exact remediation. Regression: quoted `no-db: "true"` (native bd reports true) must block.

Boundary: least-technology only — no framework, registry, state, semantic machinery, or test-matrix expansion. Re-run focused host tests + Docker tier-1 bridge, update notes/docs only as needed, commit and push one clean repair candidate, stop and report. Pre-existing main failures and later slices stay untouched.

2026-10-18 Episode slice 1a repair pass (accepted review defects fixed on top of 6c9878a):

1. Root `backlog.config.yml` without `backlog_directory` now mirrors upstream `resolveBuiltInBacklogDirectory` exactly: a built-in directory carrying folder configuration wins over a bare built-in directory, `backlog/` then `.backlog/` breaks ties within each class. Parity fixture proves empty `backlog/` + `.backlog/config.yml` selects `.backlog`.
2. Export-only/non-initialized `.beads/` residue (no `config.yaml` and no `metadata.json`, e.g. only `issues.jsonl`) is no live evidence: alone it returns `none`, and valid Backlog plus export-only Beads selects Backlog. Genuine partial initialization (exactly one of the two files present) still blocks.
3. The literal `no-db` YAML regex is replaced by the native effective-config read `bd config get no-db` once Beads store evidence exists; enabled (`true`) or unreadable/uncertain probe output (non-zero exit, or anything other than exactly `true`/`false`) blocks with exact remediation. Regression covers the quoted `no-db: "true"` case, verified live against bd 1.1.2 (native resolves it to `true`; the regex would have missed it).

Evidence: host Node suite 31/31 (`node --experimental-strip-types --test tests/task_providers.test.mjs`); live smoke against this repo (backlog selected) and real scratch bd stores (beads selected + capabilities pass; quoted no-db true blocks). Docker tier-1 bridge rerun recorded in the commit message.

Boundary kept: no framework, registry, selection file, or matrix expansion. Lifecycle call-site routing and later slices remain untouched; pre-existing main failures remain with the Conversation.

2026-10-18 Conversation accepted the slice 1a repair candidate (6cdfbaf): all three recorded discovery defects closed; head/upstream match; worktree clean; Conversation reruns passed 31/31 Node tests and 2/2 non-container Python checks; Docker tier-1 bridge reported passing.

NEXT bounded sub-slice (plan slice 1, approved scope — exact):
1. Route the existing exact task-resolution and task-admission status-mutation call sites through direct selected-provider functions, starting with the current `resolveBacklogTask` and admission transition paths. Native `backlog`/`bd` reads and mutations underneath. Preserve exact selected task identity; fail closed on none/dual/malformed/unavailable provider evidence.
2. Add Prime Claw's `.backlog/` default only at the existing project-initialization path when no live provider evidence exists; preserve upstream direct `backlog` init behavior and explicit supported Beads selection.
3. Keep the seam direct and narrow: NO abstract provider class, registry, universal task model, public tracker CLI, selection file, mirror, persistent state, semantic classifier, custom diff/merge layer, or provider-by-lifecycle matrix. Workspace/orphan-branch/Dolt sync, receipts/revisions, migration, and other lifecycle call sites stay in their planned later slices.
4. Only focused contract tests for the touched call sites + representative Backlog/Beads behavior. Docker-only plugin validation after source changes. Update living task notes and relevant docs; commit and push one clean candidate; stop and report.

Notes correction required during this pass (operator instruction): the earlier sentence "candidate ACCEPTED with three recorded in-scope defects" is inaccurate — Conversation review actually REQUESTED A REVISION for three accepted findings. Fix that one sentence using supported `backlog task edit --notes` (full corrected notes text); do not otherwise rewrite history.

Do not touch the separately reported pre-existing main failures.

2026-10-18 Episode sub-slice (plan slice 1, second sub-slice): routed existing lifecycle call sites through the provider seam and added `.backlog/` defaulting at project initialization.

What changed:
- `task-providers.ts`: new `resolveProviderTask(cwd, taskId, runner)` — detect live provider + capability gate, then native read (`backlog task view --json` via the existing exact parser; `bd show <id> --json` with schema validation), canonical status via `BEADS_STATUS_MAP` reversed (unmapped status fails closed), exact task-ID re-verification, and provider identity on the selection (`taskPath`/`taskPathRelative` null for Beads). New `mutateProviderTaskStatus({projectRoot, taskId, status, note?, runner?})` — native mutation (`backlog task edit --status [--append-notes]` / `bd update --status <mapped> [--append-notes] --json`) followed by native re-read proving the exact task reached the exact canonical status. Both fail closed on none/dual/malformed evidence and unavailable provider executables.
- Call-site routing (Backlog behavior byte-identical; `resolveBacklogTask` remains the exported Backlog primitive): `prep-chain.ts` default resolver, `spec-episode.ts` four admission/lifecycle resolver defaults, `task-episode-ownership.ts` reservation/transition resolver defaults, `extensions/reviewed-plan.ts` `create_task_episode` tool resolver — all now provider-aware, narrowed to the existing Backlog selection contract; a Beads store resolves the task but these file-bound paths reject it explicitly until their own provider slices land (sync/publication, archive, and git-commit choreography are plan slices 2/3). `commitConversationTaskStatus` now mutates through `mutateProviderTaskStatus`.
- `project-initialization.ts`: `reconcilePrimeClawProject` now runs one exact native `backlog init --defaults --backlog-dir .backlog --config-location folder --integration-mode none` ONLY when `detectTaskProvider` returns none; existing Backlog/Beads evidence is preserved untouched (selected), dual/malformed evidence blocks with exact remediation, init failure surfaces as `taskProvider.status: failed` evidence without failing asset reconciliation, and active/uncertain Episode worktrees skip the seam entirely. Upstream direct `backlog init` behavior preserved (native flags only; verified live against pinned v1.53.0: produces `.backlog/config.yml` with folder layout, no commit). Result carries the new `taskProvider` field; the tool summary prints `provider=...`.

Evidence: host Node suite 288/288 (41 task-providers incl. 11 new contract tests; 37 project-initialization incl. 5 new provider-defaulting tests; reviewed_plan/task_episode_ownership/spec_episode/task_episode_admission suites unchanged and green). Live smoke: this repo resolves PRIMECLAW-43 through the provider seam (backlog, In Progress, exact path); real scratch bd 1.1.2 store resolves `in_design` -> `In Design` and `mutateProviderTaskStatus` round-trips In Planning -> In Design through native `bd update --status` with re-read verification; unmapped `open` status fails closed. Docker tier-1 result recorded in the commit message.

Boundary kept: no abstract class, registry, universal task model, public tracker CLI, selection file, mirror, persistent state, semantic classifier, diff/merge layer, or lifecycle matrix. Workspace/orphan-branch/Dolt sync, receipts/revisions, migration, and remaining lifecycle call sites (handoff, oversight, finalization, cleanup UX) stay in their planned slices. Pre-existing main failures untouched.

Also corrected the historical sentence about the slice 1a review: it requested a revision for three accepted findings (was inaccurately recorded as an acceptance with defects).

2026-10-18 Conversation review of candidate ccc9ce5 requested a revision for four accepted, reproducible defects; repair this pushed candidate before advancing to workspace/synchronization or later lifecycle slices.

Accepted repair scope (exact):
1. Fresh `.backlog/` initialization must work with the real managed Backlog CLI, not only stubs: pass a deterministic supported positional project name (repo basename), keep the accepted `.backlog`/folder/no-integration flags, then use supported native configuration commands to establish the exact six ordered lifecycle statuses plus an appropriate canonical default so the new store passes the existing capability gate. Verify exact ignored-stdin non-interactive argv against the repository-built executable; prove `.backlog/config.yml` exists and is lifecycle-ready; prove a second reconcile is a no-op. Partial/native failure returns exact failed evidence, never claims initialization.
2. Remove the forbidden provider-neutral content object `ProviderTaskSelection` (normalized title/status/plan/references/paths with invented null Beads plan/paths contradicts the approved plan). Replace with direct provider-specific operations or a discriminated native result: preserve the existing BacklogTaskSelection on the Backlog branch, a validated native Beads issue/view on the Beads branch. No new normalized/universal task shape. Canonical status mapping stays a small conversion only at the exact use boundary. File-bound call sites may explicitly reject the Beads native branch until their planned support lands.
3. Prove exact provider/task identity before ANY mutation: resolve natively first, require the raw requested ID to equal the provider's canonical ID (Beads shorthand resolving to a longer canonical ID rejects with zero writes), only then run native status/note mutation plus the existing post-write proof. Add a real or faithful native shorthand regression asserting no update call/status/note change occurs.
4. Make provider setup failures visible through the existing reconciliation/reporting path: count taskProvider blocked/failed in the existing warning/conflict decision (no new state); include exact failed detail and blocked detail/remediation in command/tool/startup summaries; prove a converged registered project with missing Backlog plus dual/malformed evidence emits an actionable warning rather than zero notifications or bare `provider=failed`.

Boundary: least-technology only — no abstract provider framework, registry, universal task model, persistent state, custom semantic/diff machinery, or lifecycle matrix. Focused tests incl. the real managed Backlog init command and native/faithful Beads shorthand behavior; Docker-only plugin validation; truthful task notes/docs; one clean repair commit; stop for review. Deferred slices and pre-existing main failures untouched.

2026-10-18 Episode repair pass for candidate ccc9ce5 — all four accepted defects repaired.

1. Real managed Backlog init: `reconcilePrimeClawProject` now invokes the real managed executable as `backlog init <repo-basename> --defaults --backlog-dir .backlog --config-location folder --integration-mode none` (deterministic positional project name, exact non-interactive argv asserted in tests). Upstream hardcodes generic To Do/In Progress/Done statuses and `backlog config set` exposes no `statuses` key (its supported customization surface for statuses is the config file / interactive wizard / Web UI), so the exact ordered canonical lifecycle plus `default_status: "In Design"` is established by a narrow, idempotent native-format update of only those two lines in the freshly written `.backlog/config.yml`, then PROVEN by the existing capability gate (`backlog config get statuses`) before reporting `initialized`. `.backlog/config.yml` existence is proven; any partial/native failure returns exact `failed` evidence; a second reconcile is a verified no-op (`selected`, changed=false) — proven against the real repo-built v1.53.0 executable in a focused test and a live scratch-repo smoke.
2. Removed the forbidden provider-neutral `ProviderTaskSelection` object. Replaced with the discriminated native result `ProviderTaskResolution`: the Backlog branch IS the existing `BacklogTaskSelection` plus provider identity; the Beads branch carries only the validated native `bd show --json` issue view (taskId/title/status) with NO invented plan/path/reference fields (asserted in tests). Canonical status mapping happens only at the use boundary (`beadsCanonicalStatus`); file-bound call sites narrow through the new `requireBacklogTaskSelection` helper that passes Backlog through and rejects the Beads branch explicitly.
3. Exact identity proof before mutation: `mutateProviderTaskStatus` now resolves the task natively FIRST and requires the raw requested ID to equal the provider canonical ID exactly; a Beads shorthand resolving to a longer canonical ID (or a Backlog ID resolving elsewhere, or an unresolvable task) rejects with ZERO writes before any mutation. Faithful-native regression tests assert no update call occurs; live smoke against a real bd 1.1.2 store confirmed shorthand `r1u` was rejected with the store unchanged while the exact full ID mutated and re-proved `In Planning`.
4. Provider setup failures now count in the existing reconcile conflict decision (blocked/failed add 1 to `conflicts`; no new state) and the exact failed detail / blocked detail+remediation are included inline in the command/tool/startup summary (`provider=blocked(code: detail remediation)` / `provider=failed(detail)`), proven by tests asserting conflicts=1 and summary content for dual-evidence and init-failure scenarios. `summarizeReconcile` is exported for tests.

Evidence: host Node suite 295/295 (task-providers 46, project-initialization 39 incl. real-managed-CLI init + warning-surface tests). Live smokes: real `backlog init` reconcile in a scratch git repo produces a lifecycle-ready `.backlog/` (capability gate passes, second reconcile no-op); real bd store shorthand rejection + exact-ID mutation round-trip. Docker tier-1: task_providers + project_initialization bridges 4/4 (the real-CLI test skips in the container because the tier-1 image ships no backlog binary; the host run exercises the repository-built executable). Full container suite result recorded in the commit message. Boundary kept: no abstract provider framework, registry, universal task model, persistent state, semantic/diff machinery, or lifecycle matrix. Deferred slices and pre-existing main failures untouched.
<!-- SECTION:NOTES:END -->
