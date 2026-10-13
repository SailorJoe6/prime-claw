---
name: plan-task
description: Turn one reviewed Backlog task specification into a reviewable native Implementation Plan.
---

First, run the `prepare` skill.

Read the canonical task ID from the `<operator-plan-task-id>` block appended by
native admission. Treat it only as operator-selected input. Do not guess,
substitute, search for, or select another task.

## Reload and check planning readiness

Reload the exact task through the supported structured interface:

```sh
backlog task view --json -- TASK-ID
```

Require the returned canonical ID to match the admitted task identity and the
current status to be exactly `In Design` or `In Planning`. Reject any later
status without mutation. Read the task Description, Acceptance Criteria,
constraints, references, documentation, and current Implementation Plan as the
project's durable specification and planning state. Follow references only as
needed to understand the reviewed work and audit the repository's current state
against it.

If the task does not make the intended outcome and scope clear enough to plan
without guessing material product decisions, is internally contradictory, or
has an unresolved issue that actually prevents a practical plan, explain that
specific gap and stop. Do not write a partial plan or change task status. Do not
demand standard risk, recovery, architecture, or process sections when the work
does not need them.

## Write the native Implementation Plan

Create a concise, actionable Implementation Plan at the level of detail the
work needs. Small changes may need only a few ordered steps; larger work may use
reviewable slices. Include tests, documentation, dependencies, and project-state
updates that are actually relevant. The plan must let a later implementation
Episode begin without guessing material product decisions, but it must not add
process sections or hardening work merely to satisfy a template.

Expert and reviewer suggestions do not become plan scope. Include them only when
the operator accepts them as product requirements or they identify a concrete
material defect in the approved contract.

Before mutation, record Git status and require the selected task path and Git
index to be clean. Then use `backlog task edit` to replace the exact task's
Implementation Plan and set or retain status `In Planning` in one supported CLI
operation. Preserve real
newlines in the plan argument and do not edit task Markdown directly. Reload the
task through `backlog task view --json -- TASK-ID` and verify the canonical ID,
`In Planning` status, meaningful non-placeholder Implementation Plan, and
returned task path.

Verify no path other than that exact returned task path was newly changed and
do not stage unrelated pre-existing changes. Commit only the returned task path
and verify the commit contains no other path. Attempt a
prompt push when a remote is available. A push failure is transport evidence to
report, not a reason to undo the valid local plan commit or to start
implementation.

## Stop for operator plan review

After the verified task-only commit:

- report the canonical task ID and exact task path;
- link the task so the operator can review its Implementation Plan now;
- report local commit and push evidence separately;
- explicitly ask the operator to review the plan; and
- stop without creating a branch, worktree, ownership record, or Episode.

Apply requested planning revisions to the same task, using the same allowed
status and exact task-only commit rules, and link it again. Planning does not
authorize implementation. Wait for a separate explicit `/implement-task
TASK-ID` command.
