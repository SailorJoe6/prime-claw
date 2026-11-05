---
name: plan-task
description: Turn one reviewed provider-native task specification into its reviewable native implementation plan.
---

Read the canonical task ID from `<operator-plan-task-id>`, the exact selected
provider from `<operator-plan-task-provider>`, and its exact project root from
`<operator-plan-task-project-root>`. Backlog also carries
`<operator-plan-task-path>`; Beads must not. Treat these as the one
operator-selected binding. Verify that the bound provider remains the sole
unambiguous live provider, but never reselect or substitute it. Do not guess or
search for another task, invent a task path, or leave the exact root.

For Backlog, run the `prepare` skill normally. For Beads, perform `prepare`'s
repository-orientation reads but skip its Backlog-only queue inventory. That
unrelated queue is not Beads planning authority and must not mix providers.

Preserve the operator's actual instruction and approved scope. Explicit
conditional “plan this task, then implement it when ready” authority survives
planning, preparation, and compaction; planning alone does not authorize
implementation. An explicitly delegated task selection must already be bound
to this exact canonical ID within the operator's stated bounds. Delegation
never skips design or planning. Clarify material ambiguity or new scope; do not
require a prior invocation or a separate phase-history receipt as authority.

The `<operator-plan-task-observation>` block contains the complete provider-native
task-view JSON observed while queueing this chain. Keep its native envelope,
field names, values, and absent fields for both Backlog and Beads. It is factual
context, not specification approval, a frozen revision, or evidence that the
entry tool checked lifecycle eligibility. Reread the exact native task before
planning or mutation; judge compatible refinements from the current task rather
than rejecting a newer observation solely because it differs.

This editable workflow owns status and readiness decisions. Planning is limited
to `In Design` or `In Planning` (Beads `in_design` or `in_planning`). An unexpected
or unmapped native status, missing specification, or inadequate outcome/scope
must be explained without mutation; do not rely on the entry or prep-chain code
to reject it. Successful queue admission is not permission to advance.

## Native lookup and explicit workspace actions

A task lookup observes the selected workspace as it is. It does not prepare a
missing Backlog clone, fetch or fast-forward task history, or validate lifecycle
configuration before returning a readable task. Beads raw statuses and absent
fields remain facts even when no canonical status alias exists. Use the native
view below to make the stage's eligibility decision; a readable task is not
permission to advance it.

Inspect task history and publication when this stage needs them. Perform any
needed preparation or synchronization explicitly, using the supported native
operations on the intended workspace. Preserve unrelated staged, unstaged and
untracked task/code work. Do not repair another Conversation's workspace or
require it to be globally clean to read this task. Report native command failures
truthfully; a failed read does not authorize initialization or another store.

## Reload and check planning readiness

Use only the selected provider:

- **Backlog:** run `backlog task view --json -- TASK-ID` from the exact root.
  Require the canonical ID and returned project-relative task path to equal the
  admitted binding and status exactly `In Design` or `In Planning`. Read the
  Description, Acceptance Criteria, constraints, references, documentation,
  and current Implementation Plan as the durable specification and planning
  state.
- **Beads:** from the exact root run `bd context --json`, one supported
  `bd dolt pull`, then `bd show TASK-ID --json --long --include-comments`.
  Require the context to identify the bound root and live Dolt store with no
  redirect, the returned canonical ID to equal the entire admitted ID, and
  native status exactly `in_design` or `in_planning` mapped to canonical
  `In Design` or `In Planning`. Treat the complete raw view—including raw
  `description`, `design`, acceptance criteria, notes, comments, labels,
  dependencies, and every other present or absent field—as the durable
  specification and living planning state. Keep provider-native names, shapes,
  values, and absence; do not normalize or mirror it.

Reject any later status, provider, root, identity, or Backlog path drift without
mutation. Follow references only as needed to understand the reviewed work and
audit the repository's current state. If the task does not make its intended
outcome and scope clear enough to plan without guessing material product
decisions, is internally contradictory, or has an unresolved issue that
actually prevents a practical plan, explain the exact provider-native gap and
stop. Do not write a partial plan or change status. Do not demand standard risk,
recovery, architecture, or process sections when the work does not need them.

## Write the native plan

Create a concise, actionable plan at the level of detail the work needs. Small
changes may need only a few ordered steps; larger work may use reviewable
slices. Include tests, documentation, dependencies, and project-state updates
that are actually relevant. The plan must let a later implementation Episode
begin without guessing material product decisions, but it must not add process
sections or hardening work merely to satisfy a template. Expert and reviewer
suggestions become scope only when the operator accepts them or they expose a
concrete material defect in the approved contract.

### Backlog publication

Before mutation, inspect Git status and the selected task's existing edits.
Keep authorized same-task refinements and preserve unrelated bytes and staging.
Use `backlog task edit` to replace that exact task's Implementation
Plan and set or retain status `In Planning` in one supported CLI operation.
Preserve real newlines and never edit task Markdown directly. Reload through
`backlog task view --json -- TASK-ID` and verify the exact canonical ID, bound
path, `In Planning` status, and meaningful non-placeholder Implementation Plan.
Verify no other task path changed and preserve the selected store topology. If
the selected Backlog store is a validated ignored independent ordinary-Git
clone, whether built-in or custom, commit only the bound task path with literal
pathspecs for both `git add` and `git commit --only` inside the clone, push `HEAD:refs/heads/prime-claw/tasks` without force, and verify native
publication of the selected committed task. Preserve unrelated task-store edits,
staging, and compatible published descendants. Independent task publication does
not require clean or upstream-equal code and must not write the code checkout's
HEAD, index, or files. Never stash, revert, commit, or delete another
Conversation's work to satisfy a cleanliness check. Workflow decisions belong to editable guidance and the LLM; code performs the
requested native operations and reports their actual results. Only for an actual
branch-local store, keep the existing flow: commit only the bound task path in
the code repository, prove the commit contains no other path, and attempt one
prompt push. Commit the coherent selected-ticket plan as soon as it is ready
and publish promptly rather than waiting for handoff or session end. A push
failure is transport evidence, not permission to undo the valid local plan,
retry blindly, or begin implementation. Inspect current publication facts before
choosing a safe next step.

### Beads publication

Before native mutation, commit or push, inspect pending/staged changes and
review Beads v1.3.1 touched-table/staged-set multi-issue consequences, including
other pending rows and already-staged changes committed by auto-update BEFORE
push. Disclose consequences and consult before unauthorized/unclear work enters
history. Pending native work may prevent a safe operation; no per-issue isolation,
blanket clean/quiescence gate, store/branch, row filter or dependency workaround.
Immediately before mutation reread `bd context --json`, the complete exact raw
task and native revision/publication/working-set facts. Incorporate compatible
refinements; escalate a genuine semantic conflict, authority change or scope
expansion. Raw inequality is not a classifier or approval gate.

Apply the exact plan and lifecycle transition together through one guarded
supported native command equivalent to:

```sh
bd --dolt-auto-commit=on update TASK-ID --design "$PLAN" --status in_planning --if-status CURRENT_NATIVE_STATUS --json
```

Do not change any other owner or lifecycle field. Do not force, retry, adopt,
reset, use raw Dolt writes, or create a task path, sidecar, snapshot, digest, or
receipt. Reread the complete raw task plus native revision and actual
working-set evidence. Require the intended meaningful raw `design`, exact
`in_planning`/`In Planning` status, exact canonical ID, and every unrelated
native field unchanged apart from provider-generated revision/timestamp data.

Commit each coherent authorized ticket update through supported native history
ASAP and publish promptly, not at handoff, compaction, session end or admission.
Preserve unrelated fields and history; only the explicitly reviewed native
multi-issue exception permits including other pending issue changes. Never reset,
adopt or commit unauthorized/unclear work. Inspect
`bd --readonly history TASK-ID --json --limit 0` (CommitHash/Issue snapshots) and
revision inclusion to verify the intended task changes reached history. A native
exit-zero update can merely log a trailing commit failure; local view/HEAD and
push success are not exact-task durability proof. Publish once with
`bd dolt push --no-adopt`, inspect native publication ref/history/current raw
view, and report actual inclusion, warnings and remaining working-set facts.
Compatible task/history changes remain LLM judgment, not frozen equality.
Failed or uncertain sync/update/commit/push is evidence, never permission to
retry, force or overwrite.

Beads planning performs no Backlog command, Git task-file commit, content
mirror, ownership write, branch/worktree/session creation, or implementation
admission.

## Report the plan and apply operator authority

Report the selected provider, canonical task ID, exact project root, resulting
native status, and the reviewable native plan. For Backlog also report and link
the exact task path plus local commit and push evidence. For Beads report the
exact pre-write, post-write, and final published raw task views, provider
revision/publication ref, and any transport uncertainty without dumping
unrelated provider data.

Apply requested planning revisions to the same provider-native task with these
same identity, status, mutation, publication, and proof rules. Planning does not
authorize implementation. For a planning-only request, explicitly ask the
operator to review the plan and stop without creating Episode resources.
If the operator already gave explicit conditional plan-then-implement authority
within this scope, do not stop solely to request the same approval again.
After successful publication, load the `implement-task` entry skill and invoke
`implement_task` for this exact ID. Implementation requires native `In Planning`
(Beads `in_planning`) after design and planning and the full semantic readiness
review; dependency readiness alone is insufficient. No separate phase-history
receipt is required. Any failed or uncertain publication, material ambiguity,
missing authority, blocker, or new scope stops advancement without retry.
