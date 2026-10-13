# Future specification bundles — migration compatibility

New specification authoring is task-native. `/design` and `/spec-it-out` create
one explicit `In Design` Backlog task or revise one exact operator-selected task
already in `In Design`. The task Description, native Acceptance Criteria,
References, and Documentation are the living specification. Both authoring
skills make an exact task-only commit, attempt a prompt push, and stop for
operator review without planning or Episode admission.

## Primary task-native lifecycle

1. Create or revise one exact `In Design` task with `/design` or `/spec-it-out`.
2. Run `/plan TASK-ID`; review the native Implementation Plan and approve it
   separately while the task remains `In Planning`.
3. Run `/implement-task TASK-ID`. The compact-first readiness chain binds the
   exact task and placement, then calls `create_task_episode` once.
4. Trusted admission commits the exact task as `In Progress`, persists
   version-2 ownership, and creates one isolated Episode from that commit. It
   copies no bundle and creates no `.ralph/plans` promotion commit.
5. The Episode implements approved code, documentation, and tests in its
   isolated worktree and exclusively owns the bound task's content there. The
   Conversation exclusively owns lifecycle status on main, review,
   `handoff_task_episode` continuation, and the guarded
   `finalize_task_episode` actions.
6. Merge or abandonment requires an explicit operator decision. Destructive
   cleanup requires a separate explicit decision and closes ownership only
   after the exact resources are absent.

The task's supported Backlog fields are the sole durable authority throughout
this path. Task-native code never falls back to a folder specification.

## Retained version-1 compatibility

Existing future bundles remain operational during the ordered migration. This
retained version-1 compatibility surface lets a Conversation finish work
already stored at:

```text
.ralph/plans/future/<slug>/
```

A retained bundle contains `SPECIFICATION.md` and `EXECUTION_PLAN.md`, plus any
supporting artifacts needed to make the work self-contained. New `/design` and
`/spec-it-out` invocations do not create this folder.

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

`.ralph/plans/future`, `.ralph/plans/archive`, and `.ralph/plans/blocked` remain
reserved lifecycle directories until the final cutover. Bundle contents may not
collide with those names when promoted.

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
copy, in active `.ralph/plans`, and against the canonical source. The one
project-level `.prime-claw/ownership.json` record persists that digest before
external mutation. Orca then creates a background worktree without an agent,
prompt, or activation. Prime Claw copies the approved folder into that
worktree's active `.ralph/plans`, verifies the canonical checkout is unchanged,
and commits the promotion.

Only after that commit does a disabled, manually-run, existing-workspace Orca
automation launch provider `prime-agent` with `reuseSession: true` and the fixed
execute assignment. Prime Claw binds the exact fresh durable session and a visibly laid-out,
provider-ready background tab, removes the automation, and proves the same tab
and pane remain connected and writable.
The Conversation stays selected.

The Episode does not inherit Conversation history. Creation does not run an
initial handoff and does not send a second assignment. Later supervision uses
the durable Prime Agent session and `handoff_spec_episode`; the launch
automation is not retained.

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
revision, pause, or consult the operator. Accepted continuation uses canonical
handoff followed by one execute follow-up. After verified terminal work,
`finalize_spec_episode` changes only ownership bookkeeping to `inactive`. It
does not clean up resources or decide merge/abandonment.


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
