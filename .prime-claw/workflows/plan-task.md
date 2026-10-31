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

## Reload and check planning readiness

Use only the selected provider:

- **Backlog:** when the selected store is an independent nested clone, first fetch
the exact task ref and fast-forward only a clean clone to the stable direct
published head; dirty, local-ahead, divergent, unavailable, or foreign history
blocks. Then run `backlog task view --json -- TASK-ID` from the exact root.
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

Before mutation, record Git status for the code checkout and selected task
store. Require the bound task path and the task store's Git index to be clean. Use `backlog task edit` to replace that exact task's Implementation
Plan and set or retain status `In Planning` in one supported CLI operation.
Preserve real newlines and never edit task Markdown directly. Reload through
`backlog task view --json -- TASK-ID` and verify the exact canonical ID, bound
path, `In Planning` status, and meaningful non-placeholder Implementation Plan.
Verify no other task path changed and preserve the selected store topology. If
the selected Backlog store is a validated ignored independent ordinary-Git
clone, whether built-in or custom, require the clone clean at the direct
published task head, commit only the bound task path inside the clone, push
`HEAD:refs/heads/prime-claw/tasks` without force, and prove direct publication.
Independent task publication does not require the code checkout to be clean or
upstream-equal. Multiple Conversations may work in the same main-tracking
checkout and drive separate Episodes concurrently; unrelated code changes,
including `.prime-claw/ownership.json`, are not a blocker. Do not write the code
checkout's HEAD, index, or files as part of independent task publication, and
never stash, revert, commit, or delete another Conversation's changes to satisfy
a cleanliness check. An unrelated concurrent code change is not evidence that
this task publication changed code. This planning policy does not bypass
separate hard-coded lifecycle admission or status gates. Only for an actual
branch-local store, keep the existing flow: commit only the bound task path in
the code repository, prove the commit contains no other path, and attempt one
prompt push. A push failure is transport evidence,
not permission to undo the valid local plan or begin implementation.

### Beads publication

Immediately before mutation, reread `bd context --json`, the complete exact task
view, native revision/publication evidence, and clean working-set state. Compare
that raw view with the synchronized view field for field. A normal compatible
owner-authored refinement or outside same-task planning change becomes the
current planning basis; revise the proposed design to incorporate it. Escalate
only a genuine semantic conflict, authority change, or scope expansion. Do not
replace this judgment with byte equality, a classifier, or a new approval gate.

Apply the exact plan and lifecycle transition together through one guarded
supported native command equivalent to:

```sh
bd --dolt-auto-commit=on update TASK-ID --design "$PLAN" --status in_planning --if-status CURRENT_NATIVE_STATUS --json
```

Do not change any other owner or lifecycle field. Do not force, retry, adopt,
reset, use raw Dolt writes, or create a task path, sidecar, snapshot, digest, or
receipt. Reread the complete raw task plus native revision and clean
working-set evidence. Require the intended meaningful raw `design`, exact
`in_planning`/`In Planning` status, exact canonical ID, and every unrelated
native field unchanged apart from provider-generated revision/timestamp data.

Publish exactly once with `bd dolt push --no-adopt`. Then perform one native
post-publication pull/read cycle and exact publication-ref/revision proof.
Require the published raw task to contain the verified design and
`in_planning` status and the working set to remain clean. An unrelated-task
revision descendant is compatible when the exact target-task view is unchanged.
If the target task changed outside the planning write, use the exact raw values
to judge whether it is compatible; report a genuine semantic/scope/authority
conflict without another mutation. Any failed or uncertain sync, update, push,
or proof is evidence to report, not permission to retry or overwrite.

Beads planning performs no Backlog command, Git task-file commit, content
mirror, ownership write, branch/worktree/session creation, or implementation
admission.

## Stop for operator plan review

Report the selected provider, canonical task ID, exact project root, resulting
native status, and the reviewable native plan. For Backlog also report and link
the exact task path plus local commit and push evidence. For Beads report the
exact pre-write, post-write, and final published raw task views, provider
revision/publication ref, and any transport uncertainty without dumping
unrelated provider data. Explicitly ask the operator to review the plan and stop
without creating Episode resources.

Apply requested planning revisions to the same provider-native task with these
same identity, status, mutation, publication, and proof rules. Planning does not
authorize implementation. Wait for a separate explicit `/implement-task
TASK-ID` command.
