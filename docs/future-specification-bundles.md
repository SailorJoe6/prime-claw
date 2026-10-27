# Future specification bundles — migration compatibility

New specification authoring is provider-native. `/design` and `/spec-it-out`
use the repository's sole live provider to create one explicit native
`In Design` task or revise one exact operator-selected task already in
`In Design`. Backlog publishes Description, native Acceptance Criteria,
References, and Documentation through an exact task-only Git commit. Beads
publishes raw `description` and acceptance criteria through one guarded native
Dolt mutation while preserving the complete raw task view and any material
reference/documentation meaning. Both stop for operator review without planning
or Episode admission.

## Primary task-native lifecycle

1. Create or revise one exact `In Design` task with `/design` or `/spec-it-out`.
2. Run `/plan TASK-ID`; review the provider-native Backlog Implementation Plan
   or Beads raw `design`, and approve it separately while the task remains
   `In Planning`.
3. Run `/implement-task TASK-ID`. The compact-first readiness chain binds the
   exact task and placement, then calls `create_task_episode` once.
4. Trusted admission publishes the exact task as `In Progress` in its selected
   provider-native topology, persists version-2 ownership, and creates one isolated
   Episode from the exact clean code base. Independent task history binds its
   separate published revision/native view. It copies no bundle and creates no
   `.ralph/plans` promotion commit.
5. The Episode implements approved code, documentation, and tests in its
   isolated worktree and exclusively owns bound task content in the selected
   branch-local Backlog, independent Backlog, or published Beads store. The
   Conversation exclusively owns lifecycle status and review through canonical
   code plus the selected provider's primary native history. It uses
   `handoff_task_episode` for continuation, ordinary Git plus the selected
   provider's native CLI for terminal outcomes, and cleanup-only `finalize_task_episode` for exact
   resource removal.
6. Before merge readiness, the Conversation verifies provider-reported idle
   completion of the exact Episode and explicitly proven descendants; active or
   unprovably idle work refuses readiness. Merge or abandonment requires an
   explicit operator decision. After that authorized terminal outcome is
   committed and pushed, the Conversation automatically invokes cleanup with
   exact `taskId`, terminal `episodeHead`, and truthful `outcome`, without
   separate cleanup confirmation. It interprets errors and re-reads current
   ownership, provider, Git, and selected-provider evidence before any safe re-invocation.
   Cleanup closes ownership only after the exact resources are absent. No
   coordinator, background worker, retry loop, receipt, or progress state is
   introduced.

The task's complete supported provider-native fields are the sole durable
authority throughout this path. Task-native code never falls back to a folder specification.

## Retained version-1 compatibility

Existing future bundles remain operational in initialized projects that still
use the ordered version-1 migration path. This retained compatibility surface
lets a Conversation finish work already stored at:

```text
.ralph/plans/future/<slug>/
```

At the first explicit initialization or upgrade boundary, Prime Claw writes one
`.prime-claw/legacy-specifications.json` allowlist. It contains only exact
unfinished `.ralph/plans/future/<slug>` locations and SHA-256 digests of their
accepted `SPECIFICATION.md` bytes. Archive-only history and inactive version-1
ownership are excluded after candidate directories pass the same safe-directory
checks, but before residual future specification bytes are required. Reading an
owned active or blocked specification requires the recorded worktree, its
`.ralph` directory, and its plan root to be real non-symlink directories. Later
startup and reconciliation verify this inventory; they never add a location or
replace an accepted digest.

A retained bundle contains `SPECIFICATION.md` and `EXECUTION_PLAN.md`, plus any
supporting artifacts needed to make the work self-contained. The accepted
specification is frozen, while its execution plan remains living. Planning and
fresh admission reject a later location or changed specification and direct new
work to the selected-provider task UX. New `/design` and `/spec-it-out`
invocations do not create this folder.

Active version-1 ownership remains provider-independent. Its promoted active or
blocked specification must match the inventory digest, but the original future
source may be absent. In that state, the registered `/implement-spec` and
`create_spec_episode` path recognizes only the exact active owner, reviews its
promoted active pair, returns the same Episode, and sends no new assignment.
Handoff, expert and owner review, operator-authorized blocked recovery, and
bookkeeping finalization keep the same Episode, session, worktree, branch, and
resources and never require a task provider or force a version-2 transition.

## Exceptional same-Episode authority cutover

A retained version-1 Episode is never re-admitted as a task Episode. When an
approved migration requires the same live Episode to continue under task
authority, the separately activated `transition_spec_episode_to_task` tool can
replace only its ownership authority fields. The operator must first approve a
bridge candidate, merge it to canonical primary `main`, apply that accepted
plugin generation user-globally, complete a coordinated Prime Agent restart,
and prove the loaded generation by UAT.

Before cutover, the owning Conversation explicitly creates the selected
provider-native task with its native CLI. The reviewed authoring step preserves
the retained specification and living plan in native fields, records
`legacy-episode-source=<location>; superseded-by=<task-id>` in Backlog
references or as an exact Beads notes line, publishes the task, and prepares the
same provider workspace in the retained Episode. The transition tool never
creates a task, task-history clone, Beads store, or Episode resource.

The owning top-level Conversation passes the exact retained source, canonical
`In Progress` task ID, reviewed pushed Episode head, activated pushed main head,
and readiness confirmation. The host proves canonical `HEAD` equals both its
upstream and the reviewed main head, no merge, rebase, cherry-pick, or revert is
in progress, no staged or tracked canonical-main changes exist (unrelated
untracked paths are allowed), genuine code ancestry, a wholly clean Episode,
live owner and resource identity, and an idle exact-CWD durable session.
Separately, it proves the selected provider in both primary and Episode
workspaces. Branch-local Backlog retains its committed task/blob and exact-plan
checks. Independent Backlog binds the clean stable direct
`refs/heads/prime-claw/tasks` revision and complete native task view without
putting that task commit on the code DAG. Beads binds the clean stable published
Dolt revision/ref and complete raw task view without a Backlog path. The native
Backlog Implementation Plan or Beads design must exactly retain the living
execution plan. Provider publication is paired again immediately before the sole ownership
write, then the host re-proves the exact reviewed code heads and clean worktrees
so a slow native read cannot hide concurrent code drift. Before a Beads switch,
the preserved historical Episode head must also be an ancestor of the reviewed
Episode head because the first normal handoff and terminal cleanup require that
continuable code chain.

For Orca the host also proves the same setup, worktree identity, path, branch,
head, and connected writable visible terminal handles. If a restart replaced
the recorded ephemeral route, the host requires exactly one idle durable
session with the same ID, file, CWD, owner, worktree, branch, and resources,
requires the old route to be absent, and binds the verified current route in the
same atomic write. The replacement preserves the operation, existing Episode,
durable session, worktree, branch, original legacy admission `baseRef`,
historical recorded head, and optional Orca resources. A pure legacy
`baseRef` is not required to be a Backlog task-only commit. The write creates or
deletes nothing and performs no status change, assignment, handoff, merge,
finalization, or cleanup.

An exact same-binding replay is a no-op. Every different, partial, dirty,
unpublished, busy, foreign, or unverifiable state fails closed before the
switch, leaving version-1 authority and blocked recovery intact. The active plan
pair remains present after transition. Removing this repository's pair is a
later separately reviewed data-cutover step, not part of the bridge.

## Retained version-1 bundle lifecycle

1. Select one exact existing future folder.
2. Run `/plan-spec .ralph/plans/future/<slug>` or ask the Conversation to use
   `plan_spec` for that exact path.
3. Review and revise `EXECUTION_PLAN.md` in the same folder. Planning stops for
   operator approval and does not start implementation.
4. When approved, run `/implement-spec .ralph/plans/future/<slug>`.
5. The compact-first implementation chain loads ordinary oversight guidance,
   performs the full readiness review, and calls `create_spec_episode` only if
   the bundle is implementation-ready.
6. The host promotes the exact bundle in a fresh isolated Episode and admits
   one fixed execute assignment.

For a project still using version 1, `.ralph/plans/future`,
`.ralph/plans/archive`, and `.ralph/plans/blocked` remain reserved lifecycle
directories until that project's final cutover. Bundle contents may not collide
with those names when promoted. This task-native builder repository no longer
retains those directories.

## Retained version-1 planning surface

The native command is `/plan-spec`, the internal workflow is `plan-spec`, and
the model tool is `plan_spec`. All use the same compact-first prep chain. The
tool requires an exact operator-selected location and never searches for or
invents a folder.

## Retained version-1 implementation readiness

`implement-spec` checks only that the complete bundle has a coherent approved
outcome and scope, contains enough decisions and an actionable enough plan to
implement without guessing material product choices, and has no unresolved
contradiction or blocker that actually prevents safe implementation. The check
is proportional to the work and does not require standard risk, recovery,
complexity, hardening, slice, evidence, or review-process sections. A material
gap stops before mutation.

The full `prime-claw-oversee-episode` skill is included in the post-prep phase
message as ordinary guidance. There is no authenticated disclosure or readiness
receipt.

## Retained version-1 placement

Prime Claw reads ready local Orca project-host setups and does not enumerate
unsupported remote environments. One row is selected directly. Multiple local
rows use a native picker whose display labels contain the project, platform
when known, path, and stable ID. A
noninteractive caller uses:

```text
/implement-spec .ralph/plans/future/<slug> --host id:<setup-id>
```

Labels are not identifiers. Cancellation and noninteractive ambiguity create
nothing. Remote selection is rejected before mutation. Prime Claw does not
inventory remote setups; an explicit ID outside the ready local rows fails and
never falls back locally.

## Retained version-1 promotion and fresh Episode

A deterministic recursive content digest binds the exact approved bundle at
implementation admission. It is rechecked before mutation, after the isolated
copy, in active `.ralph/plans`, and against the canonical source. This
Conversation's exact entry in the project-level `.prime-claw/ownership.json`
registry persists that digest before external mutation; independent owners may
hold different retained sources concurrently. Orca then creates a background worktree without an agent,
prompt, or activation. Prime Claw copies the approved folder into that
worktree's active `.ralph/plans`, revalidates the approved source digest, and
commits the promotion. Unrelated safe canonical-main advancement may proceed
while the Episode stays bound to its captured base.

Only after that commit does a disabled, manually-run, existing-workspace Orca
automation launch provider `prime-agent` with `reuseSession: true` and the fixed
execute assignment. Prime Claw binds the exact fresh durable session and a visibly laid-out,
provider-ready background tab, removes the automation, and proves the same tab
and pane remain connected and writable. The assignment carries the exact owning
Conversation registry key; the Episode never substitutes its own session ID.
The Conversation stays selected.

The Episode does not inherit Conversation history. Creation does not run an
initial handoff and does not send a second assignment. Later supervision uses
the durable Prime Agent session and `handoff_spec_episode`; the launch
automation is not retained. That handoff validates the exact persisted source
binding before bundle existence, so the promoted future folder may be absent.
Strict source syntax, exact owner, the active root plan pair, and complete live
Episode identity are still required.

## Retained version-1 recovery

Only definitive pre-mutation Orca unavailability permits direct local fallback.
Any admitted or ambiguous Orca mutation remains Orca-owned. The ownership
record preserves the exact operation, setup, worktree, generated branch,
session, and terminal facts available at the boundary. `provisioning` or
`uncertain` is not permission to retry. Inspect and reconcile the existing
resources instead of creating another worktree or replaying execute.

Durable Prime Agent session ID/file and Orca worktree identity survive routing
restart. `activeSessionId` and terminal handles may be refreshed automatically
only for an already active Episode. Provisioning or uncertain creation uses
operator-guided manual reconciliation: require zero-or-one exact matches by
setup and `worktreeName`, worktree and `launchAutomationName`, automation and run
history, durable session ID/file, then terminal visual layout. Do not edit the
record active or retry create, run, or prompt before explicit operator review.
Remote transport, merge, abandonment, and destructive cleanup always require
separate operator authority.

## Retained version-1 completion

The Conversation reviews evidence and may accept, request a bounded in-scope
revision, pause, or consult the operator. Persisted active version-1 ownership
keeps the promoted specification and plan active through blockers, candidate
review, and every bounded revision. Accepted continuation uses canonical
handoff followed by one execute follow-up.

An older already-blocked version-1 snapshot is not live. After the operator
explicitly accepts its recorded unblock condition, the blocked skill calls
`restore_blocked_spec_episode` for the exact owned future folder. The tool
restores only the exact readable pair in the ownership record's worktree, then
revalidates the same active Episode identity before continuation. Missing or
ambiguous files never select task-native mode.

After verified terminal work, `finalize_spec_episode` changes only ownership
bookkeeping to `inactive`. It does not archive plans, clean up resources, or
decide merge/abandonment. Any retained-folder archival requires separate explicit legacy authority after
that successful terminal close. This repair adds no archival tool, so the plans
remain in place until such a later action is approved.


## Validation policy

Plugin candidates are validated only in isolated Docker Tier 1. Never apply,
check, or probe an unaccepted candidate against the host user-global plugin.
Useful gates are:

```bash
python3 -m pytest tests/ -q -m container
scripts/test-tier1.sh --probe
scripts/test-all.sh
```

The container suite includes the reviewed-plan Node behavior bridge and native
Prime Agent lifecycle probes. Host-safe Tier 0 covers static policy and pure
logic only.
