---
id: PRIMECLAW-43
title: Support selectable task providers with grandfathered legacy execution
status: In Design
assignee: []
created_date: '2026-10-15 21:20'
updated_date: '2026-10-15 22:00'
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

Prime Claw supports one repository-selected task provider—Backlog.md or Beads—behind the same task-native design, planning, Episode, review, recovery, and terminal lifecycle. Task state has one canonical history independent of code branches. Grandfathered `.ralph/plans` work remains plan-able, implementable, completable, or explicitly migratable, while no new legacy specification can be created or revised.

This work supersedes the Backlog-only and branch-local assumptions that remain in `PRIMECLAW-10.38`; it does not invalidate that task’s landed compatibility work or authorize changes to its active implementation without a separate reviewed relationship.

## Required design and rationale

This specification selects the least-technology design that meets the coordination requirements. These are requirements, not interchangeable examples:

- Beads keeps its native shared Dolt task store and synchronization model.
- Backlog uses one ordinary orphan task branch in the same Git repository and remote, materialized as an ignored nested checkout in every code worktree.
- Task writers use tracker-native mutations plus standard optimistic Git or Dolt concurrency.
- Semantic single-writer authority and exact revision handoffs prevent same-task ambiguity without a persistent Prime Claw lock.
- Prime Claw exposes one lifecycle through existing skills and canonical tools, backed by a narrow internal provider contract rather than a new public tracker CLI.
- Retained legacy authority stays independent of task-provider choice until an explicit migration.

The design rejects branch-local Backlog snapshots, redirecting every actor to one primary-worktree folder, persistent application-level task/store locks, alternate Git indexes, linked nested worktrees, submodules, a separately hosted Backlog repository, tracker mirroring, and a general Prime Claw task CLI. Those alternatives add stale-state, path, cleanup, locking, or duplicated-authority complexity without improving the required user experience.

## Provider capability, discovery, and selection

Prime Claw distributes and installs one pinned, supported Backlog executable as a managed runtime dependency. This is the dependable default and may carry Prime Claw’s maintained fork changes as it diverges from upstream. Prime Claw does not copy Backlog source into each managed project. Initialization verifies the exact managed executable and required capabilities before using it.

Installed executables are capabilities, not repository authority. Repository initialization evidence and explicit Prime Claw project configuration determine authority:

1. Existing Backlog initialization evidence alone selects Backlog after capability validation.
2. Existing Beads initialization evidence alone selects Beads after capability validation, even when the managed Backlog executable is available.
3. With neither provider initialized, Prime Claw initializes Backlog by default. The operator may explicitly select Beads instead when a supported `bd` installation passes capability checks.
4. Evidence that both providers are initialized is an unconditional blocker. It means a provider migration has not completed and must be resolved before design, planning, task admission, or provider mutation continues.
5. An explicit provider change requires a reviewed migration of every nonterminal authoritative task before selection changes. The destination must be complete and verified, and the source provider’s active initialization evidence must be retired before the migration is complete.

Closed or historical source-provider data may remain only as explicitly archived, read-only provenance that is not discoverable as another initialized live provider. Legacy specifications that merely reference Beads or Backlog tasks do not count as provider initialization and do not force provider selection.

If an existing sole provider is unavailable or unsupported, initialization stops with an exact remediation requirement. It never silently initializes the other provider, falls back to legacy-only authoring, or creates a second live task store. Once selected, explicit project configuration records the provider, and each active task-native Episode pins that provider at admission.

## Lifecycle and native field mapping

Both providers expose the same conceptual lifecycle:

1. `In Design`
2. `In Planning`
3. `In Progress`
4. `Blocked`
5. `Ready for Merge`
6. successful terminal `Done`

This lifecycle is implemented through each tracker’s supported configurable status mechanism, not labels, comments, event beads, or inferred file placement.

Backlog configuration defines the six exact status names and their ordering. Beads configuration uses `status.custom` for `in_design:active`, `in_planning:active`, `ready_for_merge:wip`, and `done:done`, while using the compatible built-in `in_progress` and `blocked` states. Provider presentation maps those native values to the common Prime Claw names. Prime Claw must capability-test the installed versions, including category-aware ready behavior, rather than assuming status support from executable presence.

Each provider maps the living specification, acceptance criteria, implementation plan, execution notes, references, documentation, modified files, and final summary to supported native fields. Implementation plans remain living documents that the authorized Episode may refine as implementation reveals facts; approval does not make a plan immutable. Lifecycle authority is defined per transition rather than assigning every field or transition wholesale to the Conversation or Episode.

## Internal provider boundary

Prime Claw uses a narrow internal provider contract only for lifecycle invariants: exact task identity, supported reads and mutations, transitions, workspace preparation, publication, and opaque revision evidence. Existing Prime Claw skills and canonical lifecycle tools remain the operator and agent interface. Native `backlog` and `bd` commands remain the underlying tracker interfaces.

Generalized version-2 ownership records the selected provider, canonical task ID, and provider-specific opaque revision or workspace evidence. A Backlog Markdown path is provider detail, not universal task identity. Once ownership exists, it outranks prompt tags, provider discovery, and current filesystem placement.

## Backlog provider: required Git topology

Backlog task data lives on the reserved ordinary orphan branch `refs/heads/prime-claw/tasks` in the same Git repository and remote as the code. Its commit DAG is disconnected from the code DAG. The configured Backlog directory is ignored by every code branch and is materialized as an independent nested Git clone checked out on that same task branch. It is not a linked worktree, submodule, alternate-index view, or separate hosted repository.

The primary code checkout and every linked code worktree receive the same configured ignored Backlog directory with their own local nested checkout. Code branch switching leaves that nested checkout and task state unchanged. Each nested checkout has its own ordinary Git index and local task branch while sharing the same remote task history.

Prime Claw tooling owns the setup lifecycle:

- project initialization or upgrade creates or verifies the orphan task branch, configures the code-tree ignore and Backlog project path, and materializes the primary task checkout;
- every Prime Claw-created Episode worktree materializes and validates its task checkout before the Episode session begins;
- preparation or first provider access idempotently repairs a missing checkout in an existing or manually created code worktree; and
- worktree cleanup requires the nested task checkout to be clean and fully published before its parent code worktree is removed.

Backlog’s code-repository auto-commit behavior is disabled in this mode. Prime Claw invokes the supported Backlog CLI for task mutations, then commits and pushes inside the nested task checkout. Reads refresh first. A handoff or candidate publishes its task-data commit before authority moves, and the receiver refreshes to that exact revision before writing.

Concurrency uses ordinary Git behavior. A concurrent remote advance rejects the stale push. The writer fetches and rebases or merges, then retries. Different-task file changes should reconcile normally; same-task conflicts stop for explicit review. Prime Claw never force-overwrites the task branch and does not add a persistent locking protocol.

## Beads provider: required native topology

Beads uses its canonical Dolt database rather than projecting issue Markdown into code branches. Supported local Git worktrees discover and share the repository-associated Beads database. Concurrent-agent operation uses a supported Beads server or concurrency mode and fails clearly when the installed version or configuration lacks the required semantics.

Dolt task history remains distinct from the code Git DAG. The same code remote may carry Dolt storage through `refs/dolt/data`; DoltHub or another separately visible repository is not required. Supported Dolt push/pull or equivalent synchronization publishes exact task history. `.beads/issues.jsonl` remains export, interchange, or backup material and never becomes a competing live authority.

## Task-native and retained command routing

`/design` and `/spec-it-out` are Markdown policy skills. Their managed content directs new or revised specifications only to an exact `In Design` task in the selected provider and never to `.ralph/plans`. Acceptance relies on content review, reconciliation checks, and representative provider UAT rather than pretending unit tests can prove an agent obeys prose.

`/plan` accepts one explicit, syntactically unambiguous target:

- a canonical selected-provider task ID selects task-native planning; or
- an exact grandfathered `.ralph/plans/future/<slug>` path selects retained legacy planning.

`/implement-task` likewise admits either one exact implementation-ready selected-provider task or one exact implementation-ready grandfathered source. Compatibility aliases may remain during upgrade, but routing never searches for or guesses another target.

Version-1 ownership continues to select retained legacy files and mechanics. Version-2 ownership selects one provider task. Every blocker, handoff, reviewable candidate, revision, and terminal receipt binds both ledgers: the exact Episode code HEAD and the exact provider task revision. Backlog revisions are task-branch Git commits; Beads revisions are exact supported Dolt/task revisions or digests.

## Grandfathered legacy behavior

Upgrade records an exact inventory of unfinished legacy sources and the accepted specification digest for each. Archive-only history does not enter that inventory or trigger reminders. Newly created or materially changed legacy specifications are rejected after cutover, including manually added folders that were not grandfathered.

A grandfathered specification remains the frozen product contract. Its implementation plan is living and may be created or refined during planning and execution. If implementation reveals a material product-contract change, the work migrates to one task in the selected provider rather than reopening legacy specification authoring.

Pure legacy planning and execution do not require or mutate a provider task. Related tracker entries are references, not lifecycle authority. New follow-up work discovered from a legacy Episode is created in the selected provider. Provider choice affects the migration destination but does not change active version-1 identity or mechanics.

Legacy-to-task migration is optional, explicit, reviewed, and one-way. It preserves source location, specification and plan content, provenance, criteria, execution history, and exact revision evidence. It establishes one selected-provider task before retiring legacy authority and never leaves both as writable sources of truth. Migration of an active Episode preserves its Episode, session, worktree, branch, and reviewed code identity unless an independently approved migration contract requires otherwise.

## Migration, failure, and recovery

Project initialization and upgrade explain provider evidence, capabilities, unfinished grandfathered work, active ownership, and conflicting authorities before mutation. Existing task data moves only through an isolated, reviewed, lossless migration with verifiable source and destination revisions. The migration is incomplete while both providers retain live initialization evidence.

A failed or uncertain migration preserves the source authority and reports an exact recovery condition. It never creates another destination task, silently selects a provider, force-pushes task history, deletes source data, or resumes lifecycle work against ambiguous authority.

New sessions remind the operator while unfinished grandfathered work remains. Reminders distinguish finishing from migrating and disappear when only archive history remains.

## Validation boundary

Automated tests cover deterministic code: provider discovery and capability gates, task-workspace creation and cleanup, Git and Dolt synchronization, optimistic-concurrency rejection and retry, ownership, revision receipts, lifecycle transitions, migration, and recovery. Managed Markdown skills receive content and reconciliation checks plus representative UAT; they do not gain artificial unit-test plumbing that claims to prove model compliance.

## Non-goals

- Do not patch or fork Prime Agent.
- Do not maintain two initialized live task providers or mirror tasks between Backlog and Beads.
- Do not require DoltHub, a separate Backlog repository, Git submodules, alternate indexes, linked nested worktrees, or a new public tracker CLI.
- Do not add persistent Prime Claw task/store locks or silently force-resolve same-task conflicts.
- Do not make code branches or code worktrees the source of provider task identity.
- Do not infer a live Episode from active plan-file placement alone.
- Do not retire version-1 recovery, review, finalization, or cleanup while grandfathered active work remains.
- Do not implement, migrate data, change provider selection, or alter active Episode ownership as part of specification authoring.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prime Claw distribution and initialization evidence prove one exact pinned supported Backlog executable is installed as a managed runtime dependency, capability-checked before use, and not copied as source into each project; an unsupported existing provider blocks rather than silently falling back.
- [ ] #2 Provider-discovery acceptance proves installed executables do not select authority: sole Backlog initialization selects Backlog, sole Beads initialization selects Beads, neither defaults to managed Backlog unless the operator explicitly selects supported Beads, and simultaneous Backlog and Beads initialization evidence blocks all task lifecycle mutation as an incomplete migration.
- [ ] #3 Provider-switch acceptance proves every nonterminal authoritative source task is migrated and verified before selection changes, the source provider’s live initialization evidence is retired before completion, and any retained closed history is explicitly archived and cannot be rediscovered as another initialized provider.
- [ ] #4 Provider fixtures prove Backlog’s configured status schema and Beads `status.custom` plus compatible built-ins implement the common lifecycle `In Design`, `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, and `Done`; unsupported custom-status or category-aware-ready capability fails before mutation.
- [ ] #5 Managed `/design` and `/spec-it-out` content, reconciliation checks, and representative UAT show that new and revised specifications target only an exact `In Design` task in the selected provider and never create or modify `.ralph/plans`, without adding artificial unit tests that claim to prove compliance with prose.
- [ ] #6 `/plan` routing deterministically distinguishes an exact selected-provider task ID from an exact grandfathered future-folder path, rejects missing or ambiguous targets without search or substitution, writes the plan only to the selected authority, and authorizes no implementation.
- [ ] #7 `/implement-task` routing deterministically distinguishes one implementation-ready selected-provider task from one implementation-ready grandfathered source; task-native admission creates generalized version-2 ownership and legacy admission creates version-1 ownership without cross-authority mutation.
- [ ] #8 Generalized version-2 ownership and all task-native admission, execute, handoff, review, blocked/resume, terminal, and cleanup paths bind an explicit provider, canonical task ID, and opaque provider revision evidence without treating a Backlog Markdown path as universal identity.
- [ ] #9 Backlog provider acceptance proves task data lives on the ordinary orphan `refs/heads/prime-claw/tasks` branch in the same repository and remote, with a DAG disconnected from code history, and appears at the configured Backlog path only through an ignored independent nested clone rather than a submodule, linked worktree, alternate index, or separate hosted repository.
- [ ] #10 Workspace lifecycle acceptance proves initialization or upgrade creates the task branch and primary checkout; every Prime Claw-created Episode worktree receives a validated task checkout before session start; preparation repairs missing checkouts in existing worktrees; code branch switching leaves task state unchanged; and cleanup refuses an unclean or unpublished nested checkout.
- [ ] #11 Backlog synchronization tests prove reads refresh the nested task checkout, supported Backlog mutations are committed there rather than to the code branch, different-task changes reconcile through standard Git operations, stale pushes are rejected, same-task conflicts stop for review, force overwrite is prohibited, and no persistent Prime Claw task/store lock is required.
- [ ] #12 Beads provider acceptance proves supported worktrees observe one canonical local Dolt task store, required custom lifecycle statuses and ready behavior work, concurrent-agent mode is validated, and supported Dolt synchronization preserves exact task history independently of code branches without treating `.beads/issues.jsonl` as live authority.
- [ ] #13 Provider integration keeps existing Prime Claw skills and canonical lifecycle tools as the common UX, uses native `backlog` and `bd` interfaces underneath a narrow internal lifecycle contract, and introduces no general public Prime Claw tracker CLI or shadow task model.
- [ ] #14 Candidate, blocker, resume, revision, handoff, and terminal receipts bind the exact Episode code HEAD to the exact provider task revision and reject identity, provider, ancestry, or revision drift before lifecycle mutation.
- [ ] #15 Upgrade records the exact unfinished grandfathered source set and accepted specification digests; manually added or materially revised legacy specifications are rejected; archive-only history neither qualifies nor triggers reminders; and sessions continue to remind while unfinished grandfathered work remains.
- [ ] #16 Legacy planning and execution acceptance proves version-1 authority is provider-independent, the frozen specification is not revised, the living implementation plan may be refined, tracker references do not select a provider or become authority, and pure legacy work does not require or mutate a provider task.
- [ ] #17 Legacy migration acceptance proves migration targets only the selected provider, preserves source content and provenance, receives independent review, establishes one exact task authority, and retires legacy authority without writable dual authority or hidden mirroring.
- [ ] #18 An active legacy-to-task transition preserves the exact Episode, session, worktree, branch, code identity, and reviewed evidence when valid, while a failed or uncertain transition leaves version-1 authority recoverable and reports an exact unblock condition.
- [ ] #19 Automated tests cover deterministic provider discovery, capability gates, workspace setup and cleanup, synchronization, optimistic concurrency, ownership, revision receipts, lifecycle transitions, migration, and recovery; documentation and UAT cover provider selection, worktree UX, grandfathered reminders, finish-versus-migrate choices, and the prohibition on new legacy authoring.
<!-- AC:END -->
