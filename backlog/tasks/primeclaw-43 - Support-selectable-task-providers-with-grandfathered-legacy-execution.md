---
id: PRIMECLAW-43
title: Support selectable task providers with grandfathered legacy execution
status: In Design
assignee: []
created_date: '2026-10-15 21:20'
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

Prime Claw supports one repository-selected task provider—Backlog.md or Beads—behind the same task-native design, planning, Episode, review, recovery, and terminal lifecycle. The workflow preserves one canonical task record across code worktrees without forcing either provider to imitate the other’s storage model. Grandfathered `.ralph/plans` work remains plan-able, implementable, completable, or explicitly migratable, while no new legacy specification can be created or revised.

This work supersedes the Backlog-only and branch-local assumptions that remain in `PRIMECLAW-10.38`; it does not invalidate that task’s already-landed compatibility work or authorize changes to its active implementation without a separate reviewed relationship.

## Authority and provider model

Authority kind and task provider are orthogonal:

- task-native authority binds one exact task in the repository’s selected provider;
- retained legacy authority binds one exact grandfathered `.ralph/plans/future/<slug>` source and remains file-authoritative regardless of provider; and
- migration is an explicit reviewed transition from one authority to the other, never ongoing mirroring.

A repository has exactly one selected task provider at a time. Initialization and upgrade preserve a supported existing provider, select or configure one when none exists, and fail closed for ambiguous dual-provider state. Changing providers is an explicit migration and cannot occur underneath an active task-native Episode. Episode ownership pins the provider selected at admission.

The common lifecycle is `In Design`, `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, and successful terminal `Done`. Each provider maps these states and the specification, acceptance criteria, implementation plan, execution notes, references, documentation, modified files, and final summary to supported native fields. Implementation plans remain living documents that the authorized Episode may refine as implementation reveals facts; approval does not make a plan immutable.

Prime Claw uses a narrow internal provider contract for its lifecycle invariants, exact identity, transitions, workspace preparation, publication, and revision evidence. Existing Prime Claw skills and canonical lifecycle tools remain the operator and agent interface. Native `backlog` and `bd` commands remain the underlying tracker interfaces. This work does not create a general public Prime Claw tracker CLI or reimplement either tracker.

## Backlog provider behavior

Backlog task data must have one history independent of code branch history while remaining data owned by the same repository and remote. The configured Backlog folder is an ignored task checkout or materialized view of that task-data history, rather than a task snapshot committed separately on every code branch. Code branch switching must not select another task-state copy.

Each code worktree may have its own local checkout of the same task-data history. Writers use ordinary Git optimistic concurrency: refresh, mutate through the supported Backlog CLI, commit, and publish. Concurrent changes to different task files should reconcile through normal Git operations; concurrent changes to the same task must stop as an explicit conflict. Prime Claw must not introduce a persistent application-level task/store locking protocol, alternate-index plumbing as a required user concept, a submodule, or a separately hosted task repository. Semantic single-writer authority for each task and exact revision handoffs minimize conflicts without becoming an operating-system lock.

A task handoff or candidate report publishes the task-data commit before authority moves. The receiving actor refreshes to that exact revision before writing. A rejected non-fast-forward publication is recoverable Git concurrency evidence, not permission to overwrite another writer.

## Beads provider behavior

Beads uses its canonical Dolt database rather than projecting issue Markdown into code branches. Local Git worktrees share the repository-associated Beads database when supported by the configured Beads mode. Concurrent-agent operation uses a supported concurrency mode and fails clearly when the installed Beads version or configuration lacks required custom-status, worktree-discovery, or synchronization capabilities.

Dolt history and task revisions remain distinct from the code Git DAG. The same code remote may carry Dolt storage through `refs/dolt/data`; DoltHub or another separately visible repository is not required. Beads publication and recovery use supported Dolt synchronization. `.beads/issues.jsonl` is not promoted into a competing live authority.

## Task-native commands and ownership

`/design` and `/spec-it-out` create or revise only an exact `In Design` task in the selected provider. They never create or revise a legacy specification.

`/plan` accepts one explicit, syntactically unambiguous target:

- a canonical provider task ID selects task-native planning; or
- an exact grandfathered `.ralph/plans/future/<slug>` path selects retained legacy planning.

`/implement-task` likewise admits either one exact implementation-ready provider task or one exact implementation-ready grandfathered source. Compatibility aliases may remain during upgrade, but routing never searches for or guesses another target.

Version-1 ownership continues to select retained legacy files and mechanics. Generalized version-2 ownership records the provider, canonical task ID, and provider-specific opaque revision or workspace evidence; a Backlog path is not a universal identity requirement. Once ownership exists, it outranks prompt tags and current filesystem placement.

Every reviewable candidate and authority handoff binds both ledgers: the exact Episode code HEAD and the exact provider task revision. Backlog revisions are task-data Git commits; Beads revisions are exact supported Dolt/task revisions or digests. Lifecycle transitions remain operator- and role-bounded per transition rather than assigning all task writes wholesale to one role.

## Grandfathered legacy behavior

Upgrade records an exact inventory of unfinished legacy sources and the accepted specification digest for each. Archive-only history does not enter that inventory or trigger reminders. Newly created or materially changed legacy specifications are rejected after cutover, including manually added folders that were not grandfathered.

A grandfathered specification remains the frozen product contract. Its implementation plan is living and may be created or refined during planning and execution. If implementation reveals a material product-contract change, the work must migrate to one task in the selected provider rather than reopening legacy specification authoring.

Pure legacy planning and execution do not require or mutate a provider task. Related tracker entries are references, not lifecycle authority. New follow-up work discovered from a legacy Episode is created in the selected provider. Provider choice may change how a legacy bundle is migrated, but it does not change active version-1 identity or mechanics.

Legacy-to-task migration is optional, explicit, reviewed, and one-way. It preserves source location, specification and plan content, provenance, criteria, execution history, and exact revision evidence. It establishes one selected-provider task before retiring legacy authority and never leaves both as writable sources of truth. Migration of an active Episode preserves its Episode, session, worktree, branch, and reviewed code identity unless an approved migration contract explicitly requires otherwise.

## Upgrade, failure, and recovery

Repository initialization and upgrade must detect and explain provider state, unsupported versions, unfinished grandfathered work, active ownership, and conflicting authorities before mutation. Existing task data is migrated only through an isolated, reviewed, lossless operation with verifiable source and destination revisions. A failed or uncertain migration preserves the prior authority and reports an exact recovery condition; it never creates a second task, silently selects another provider, or deletes source data.

New sessions remind the operator while unfinished grandfathered work remains. Reminders distinguish finishing from migrating and disappear when only archive history remains.

## Non-goals

- Do not patch or fork Prime Agent.
- Do not maintain two live task providers or mirror tasks between Backlog and Beads.
- Do not require DoltHub, a separate Backlog repository, Git submodules, or a new public tracker CLI.
- Do not make code worktrees the source of provider task identity.
- Do not infer a live Episode from active plan-file placement alone.
- Do not retire version-1 recovery, review, finalization, or cleanup while grandfathered active work remains.
- Do not implement, migrate data, change provider selection, or alter active Episode ownership as part of specification authoring.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Initialization and upgrade tests prove every repository has at most one selected task provider; supported existing Backlog or Beads state is preserved; absent state can be configured; ambiguous dual-provider or unsupported state fails before mutation; and an active task-native Episode pins its provider.
- [ ] #2 Provider fixtures prove Backlog and Beads both represent the lifecycle `In Design`, `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, and `Done`, plus the supported specification, acceptance, living implementation-plan, execution-evidence, reference, documentation, modified-file, and final-summary content required by Prime Claw.
- [ ] #3 `/design` and `/spec-it-out` tests prove new and revised specifications use only an exact `In Design` task in the selected provider and never create or modify `.ralph/plans`.
- [ ] #4 `/plan` tests deterministically distinguish an exact provider task ID from an exact grandfathered future-folder path, reject missing or ambiguous targets without search or substitution, write the plan only to the selected authority, and authorize no implementation.
- [ ] #5 `/implement-task` admission tests deterministically distinguish one implementation-ready provider task from one implementation-ready grandfathered source; task-native admission creates generalized version-2 ownership and legacy admission creates version-1 ownership without cross-authority mutation.
- [ ] #6 Generalized version-2 ownership and all task-native admission, execute, handoff, review, blocked/resume, terminal, and cleanup paths bind an explicit provider, canonical task ID, and opaque provider revision evidence without treating a Backlog Markdown path as a universal task identity.
- [ ] #7 Backlog provider acceptance proves task history is independent of code branches, remains in the same repository and remote, appears through the configured ignored Backlog folder, survives ordinary code branch switches, and can be checked out in multiple code worktrees without submodules or a separately hosted task repository.
- [ ] #8 Backlog concurrency tests prove separately committed different-task updates reconcile through standard Git operations, a stale publication is rejected rather than overwritten, same-task concurrent edits stop with an explicit conflict, and no persistent Prime Claw task/store lock is required.
- [ ] #9 Beads provider acceptance proves supported worktrees observe one canonical local Dolt task store, required custom lifecycle statuses and ready behavior work, concurrent-agent configuration is validated, and supported Dolt push/pull or equivalent publication preserves exact task history independently of code branches.
- [ ] #10 Provider integration keeps existing Prime Claw skills and canonical lifecycle tools as the common UX, uses native `backlog` and `bd` interfaces underneath, and introduces no general public Prime Claw tracker CLI or shadow task model.
- [ ] #11 Candidate, blocker, resume, revision, and terminal receipts bind the exact Episode code HEAD to the exact provider task revision and reject identity, provider, ancestry, or revision drift before lifecycle mutation.
- [ ] #12 Upgrade records the exact unfinished grandfathered source set and accepted specification digests; manually added or materially revised legacy specifications are rejected; archive-only history neither qualifies nor triggers reminders; and sessions continue to remind while unfinished grandfathered work remains.
- [ ] #13 Legacy planning and execution tests prove version-1 authority is provider-independent, the frozen specification is not revised, the living implementation plan may be refined, related tracker tasks remain references only, and pure legacy work does not require or mutate a provider task.
- [ ] #14 Legacy migration tests prove migration targets only the selected provider, preserves source content and provenance, receives independent review, establishes one exact task authority, and retires legacy authority without a period of writable dual authority or hidden mirroring.
- [ ] #15 An active legacy-to-task transition preserves the exact Episode, session, worktree, branch, code identity, and reviewed evidence when those resources remain valid, while a failed or uncertain transition leaves the prior version-1 authority recoverable and reports an exact unblock condition.
- [ ] #16 Provider-switch and existing-data migration tests prove migration is explicit, isolated, reviewed, lossless, and reversible before cutover; active conflicting ownership blocks it; and failure never deletes source data, creates duplicate tasks, or silently selects another provider.
- [ ] #17 Documentation and end-to-end fixtures cover provider selection, Backlog task checkout synchronization, Beads/Dolt synchronization, target routing, revision receipts, grandfathered reminders, finish-versus-migrate choices, recovery, and the prohibition on new legacy authoring.
<!-- AC:END -->
