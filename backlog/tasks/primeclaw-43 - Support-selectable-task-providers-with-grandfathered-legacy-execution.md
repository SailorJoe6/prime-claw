---
id: PRIMECLAW-43
title: Support selectable task providers with grandfathered legacy execution
status: In Planning
assignee: []
created_date: '2026-10-15 21:20'
updated_date: '2026-10-18 15:19'
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
- Do not add a public tracker CLI, provider-selection file, mirror, lock service, semantic merge engine, workflow state machine, submodule, alternate index, linked nested worktree, or dual-write path.
- Add no new mutable coordinator state. The only durable additions allowed are fields on the existing version-2 ownership/receipt records required by AC 9/14/17, the grandfathered-work inventory required by AC 16, and the final migration receipt required by AC 18/19. Keep the migration receipt in destination-native history/provenance; if a provider cannot hold the exact receipt, stop for plan review rather than inventing a sidecar authority.

## Implementation slices

1. **Introduce one narrow provider seam and deterministic discovery.** Replace Backlog-specific resolution at the lifecycle boundary with a small internal `TaskProvider` contract covering only capability validation, exact task read/mutation, sync/publish, workspace preparation, store revision, and task-scoped evidence. Keep the two native CLI implementations thin and in one module until size proves a split necessary. Detect valid Backlog or Beads initialization directly from native configuration/store evidence, reject malformed or dual evidence, and default Prime Claw initialization to `.backlog/` while allowing explicit supported Beads selection. Preserve the pinned managed Backlog build and upstream direct-init behavior. Update the plugin asset inventory for any new managed source. **[AC 1, 3, 4, 6, 7]**

2. **Implement provider-native workspace behavior without new coordination services.**
   - For Backlog, use ordinary Git to create/verify disconnected `refs/heads/prime-claw/tasks`, select the primary branch upstream or sole remote, and materialize an ignored independent nested clone in the configured directory for the primary checkout and each Episode worktree. Preserve root/folder configuration rules, offer `.backlog/` normalization, validate the retained custom-directory relative symlink, disable Backlog auto-commit, and use fetch/reconcile/commit/push with stale-push rejection and no force overwrite. Refuse cleanup when the nested checkout is dirty or unpublished.
   - For Beads, validate the installed `bd` version, lifecycle statuses, category-aware readiness, native per-project server mode, and supported auto-start or operator-managed server configuration. Use supported Dolt synchronization and `refs/dolt/data` transport; never use JSONL as authority or race raw Dolt writes against the server.
   Wire workspace preparation and cleanup into existing project initialization and Episode allocation/cleanup paths rather than adding a daemon. **[AC 4, 5, 6, 10, 11, 12, 13]**

3. **Route the existing task-native UX through the selected provider.** Generalize the reviewed-plan resolver, prep-chain admission, task Episode admission/status changes, handoff, oversight, finalization, and cleanup to the provider-neutral identity while leaving version-1 folder routes intact. Revise the managed `design`, `spec-it-out`, `plan-task`, `implement-task`, `execute`, `blocked`, handoff, expert-review, and Conversation oversight instructions to call the selected provider's native CLI and accept only one exact task ID or one exact grandfathered path. Put compatible-edit, living-plan, and semantic-conflict decisions in those managed instructions, not code. Reconcile project-customizable copies through the existing template mechanism. **[AC 7, 8, 15]**

4. **Generalize ownership and revision evidence in place.** Extend version-2 ownership and lifecycle receipts with provider, canonical task ID, published provider revision, task-scoped evidence, and exact Episode code HEAD; retain Backlog path data only as provider-specific evidence. Safely recognize existing version-2 Backlog records only when live evidence corroborates them; do not create version 3 or another authority file. At every boundary run `sync → read → native mutate → publish → record revision`. Advance receipts after owner-authored task/plan changes, ignore unrelated-task store advances, and present exact outside same-task changes to the Episode or Conversation prompt. Deterministic code must only prevent silent overwrite and prove publication. **[AC 9, 12, 14, 15]**

5. **Preserve grandfathered version-1 work with one simple inventory.** During upgrade, record only the exact unfinished legacy locations and accepted specification digests. Keep their specifications frozen, plans living, archive-only history excluded, and pure legacy execution provider-independent. Reject new or materially revised legacy specifications. Adapt the existing reviewed legacy-to-task transition so it creates the selected-provider task, preserves all content/provenance and the same active Episode/session/worktree/branch/code identity, switches to one authority only after successful publication, and leaves version-1 recovery unchanged on failure. **[AC 16, 17]**

6. **Add one explicit, bounded provider-migration operation.** Extend project initialization/upgrade with an operator-confirmed provider switch rather than a general tracker command. Quiesce provider mutations, capture one exact source revision, migrate every open and closed task plus all fields, comments, hierarchy, dependencies, status, history, and provenance using native commands, preserve safe IDs or record immutable mappings, and verify counts and normalized digests. Transition active ownership only after verification, activate the destination, write the exact receipt to destination-native history/provenance, then delete the source initialization/store and resume mutations. Before cutover, any failure leaves the source intact and authoritative and reports one exact recovery condition; never dual-write or retry into another destination copy. **[AC 18, 19]**

7. **Validate behavior at the right boundary and update product documentation.** Reuse the existing Node lifecycle fixtures and Python asset/skill checks; add focused provider fixtures for discovery, capabilities, status mapping, Backlog nested-clone Git concurrency, Beads server/Dolt synchronization, workspace cleanup, ownership revisions, exact diff delivery, legacy transition, full migration verification, failure recovery, and source-deletion guards. Keep semantic reconciliation out of fake unit tests: review the managed prompts and run representative task-edit UAT for compatible and conflicting changes. Update `docs/backlog.md`, the lifecycle user stories and traceability matrix, installation/upgrade guidance, and architecture notes. After each plugin-source change run Docker-only tier 1; finish with the relevant Node/Python suites and `scripts/test-all.sh`. Do not apply the candidate user-globally during implementation. **[AC 20]**

## Acceptance-to-mechanism check

| AC | Least-technology mechanism |
|---|---|
| 1 | These guardrails plus review of every slice; native behavior and prompts precede code. |
| 2 | One structured prerequisite check with recorded evidence before implementation; `PRIMECLAW-10.38` is already `Done`, so no permanent runtime gate is added. |
| 3 | Native live-store evidence inspected by the small discovery function; no selection record. |
| 4 | Existing pinned Backlog build plus explicit `.backlog/` argument only in Prime Claw initialization. |
| 5 | Backlog's own config discovery and one validated relative symlink only for retained custom layout. |
| 6 | Provider capability/status fixtures against native CLI output. |
| 7 | One internal lifecycle seam; native CLIs remain the user/agent interfaces. |
| 8 | Existing managed skills and prep chains with provider-aware instructions and exact input validation. |
| 9 | Additional fields on the existing version-2 ownership/receipt schema, not another store. |
| 10 | Ordinary orphan branch plus independent nested clones. |
| 11 | Ordinary Git upstream/remote discovery and clean/published checks. |
| 12 | Ordinary fetch, reconcile, commit, and push; no lock service. |
| 13 | Native Beads per-project server and Dolt transport. |
| 14 | Native optimistic concurrency plus exact diff delivery to the LLM. |
| 15 | Managed Episode/Conversation prompts and representative UAT. |
| 16 | One exact grandfather manifest because a durable allowlist/digest is required to reject new legacy work. |
| 17 | The existing ownership-transition path generalized to the selected provider. |
| 18 | One maintenance-window migration using native export/read/create/history operations and normalized verification. |
| 19 | One destination-native immutable receipt and a final verified source deletion gate. |
| 20 | Deterministic automated tests plus prompt review and real UAT for semantic behavior. |
<!-- SECTION:PLAN:END -->
