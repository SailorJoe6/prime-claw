---
name: implement-task
description: Route authorized task implementation by operator placement and task evidence; work directly or enter isolated Episode readiness.
---
# Implement an approved task

Read `/skill:goals-and-heartbeats` unless it is already in context. Bind the
exact canonical task and approved scope before proceeding. Never substitute a
task or select work beyond explicitly delegated bounds. An EXPERT stays read-only.

## Choose placement

- Explicit placement wins. “Here”, “in this checkout”, or “on main” means
  direct implementation in that checkout. Verify the actual branch and checkout
  match the request; do not silently switch, substitute a location, or stack a
  branch. An explicit Episode request uses the isolated path below.
- If placement is unspecified, read the exact native ticket and use judgment.
  Appropriate planning status (`In Planning` / Beads `in_planning`) plus a
  meaningful Implementation Plan or Beads `design` normally points to an
  Episode. An obvious small unplanned fix normally stays direct; `In Design`
  alone does not disqualify it. For substantial work still in design that would
  benefit from formal planning, or genuinely unclear/conflicting evidence, ask
  one focused question before starting a workflow. Do not always ask or turn
  size/status into a programmatic classifier.
- Preserve explicit placement through planning, preparation, and compaction.
  Planning alone grants no implementation authority. Even a newly published plan
  does not turn “plan it, then implement it here” into an Episode request.

## Direct tracked implementation

Use ordinary editing, tests, and Git in the verified checkout. Do not call
`implement_task` or any Episode tool, allocate an Episode or ownership record,
load the Episode `execute` workflow, or require Episode identity or a formal
plan. A small change still needs exact task identity, scope, and safe Git state.

1. Read the exact task through the project's selected provider. Verify its
   canonical identity, current native status, and the requested placement.
   Locate the canonical primary checkout via Git worktree metadata and check its
   `.prime-claw/ownership.json` for a non-inactive Episode bound to this task,
   including provisioning or uncertain ownership. Inspect the registry for
   conflicts only, never to select or adopt an owner. If a same-task Episode
   exists or the collision check is inconclusive, stop for operator resolution.
   Do not mutate another owner's task or resources.
2. Before editing implementation files, publish and verify the exact task's
   native `In Progress` (Beads `in_progress`), even for a quick fix. Use only
   supported native task operations and the selected task-history topology.
   Re-read the task and prove the status in committed history, published when
   a remote exists. Do not overwrite concurrent task changes or bypass another
   lifecycle authority. If native identity, transition, or publication is
   unsafe or uncertain, report it and stop rather than editing code or retrying.
3. Implement the approved change. Run required project checks, commit only the
   intended changes, and push the authorized branch without force when a remote
   exists. Preserve unrelated edits, staging, history, and credentials. If
   there is no remote, prove the local commit instead.
4. Only after required checks and code commit/publication are proven, recheck
   exact native task and ownership facts and publish and verify native `Done`
   (Beads `done`). No separate approval is needed solely for this status.
   Honor explicit review holds; do not mark incomplete, blocked, or
   publication-uncertain work `Done`. Report exact code and task publication
   evidence. This grants no separate merge, deployment, or activation authority.

Backlog uses `backlog task view --json -- TASK-ID` and `backlog task edit`
with the native status. Keep task edits in exact-path-only commits, in the
independent task clone/ref when selected, or on the code branch for a
branch-local store, and verify the exact native view and publication after
writes. Beads uses `bd show --json --long --include-comments` for the exact ID
and a supported guarded `bd update` status transition; inspect native pending
and staged work before an update, commit, or push. Auto-commit can include
unrelated pending work. Consult if not authorized or clear; verify actual task
history and native publication, not just command success. Do not change
providers, migrate storage, force publication, or reset another writer's work.

## Isolated Episode implementation

Only this path calls `implement_task(taskId, host?)`. This global entry skill
routes to the project's customizable `.prime-claw/workflows/implement-task-prep.md`
and `implement-task.md` policies. The Conversation supervises; the Episode
implements. Before fresh resource creation, follow the workflow's native
pre-allocation checks. An already owned operation follows its
continuation/failure guidance, not replacement allocation.

## Bind scope and authority

Interpret the operator's actual instruction before advancing. An explicit
conditional instruction such as “plan this task, then implement it when ready”
may authorize that sequence within the approved scope. Preserve that authority
through planning, preparation, and compaction; do not demand a fresh approval
solely because planning finished. A planning-only request does not authorize
implementation. Clarify material ambiguity, missing authority, or new scope.
Neither a prior tool/command invocation nor a stored or turn-scoped receipt is
approval authority.

Bind one exact canonical task ID before calling the tool. If the operator
selected a task, do not substitute another. If the operator explicitly delegated
selection, stay within those stated bounds and inspect the selected provider's
native tasks. Select implementation work only from `In Planning` (Beads native
`in_planning`) after design and planning, not from dependency readiness alone or
the highest-priority open task. Selection does not skip either phase. Verify a
meaningful native Implementation Plan or Beads `design`; the project workflow
still performs the full semantic readiness review. Apply the same rule to an
operator-selected task. If the native status is not `In Planning`/`in_planning`,
is unmapped, or the plan/design is missing or placeholder-only, explain the
current native facts and stop without mutation or admission. Do not rely on code
to refuse an ineligible task. Status, dependency readiness, and successful queue
admission alone establish neither authority nor implementation readiness. If the
task or delegated bounds are materially unclear, ask instead of guessing.

## Selected-ticket durability before creation

Ensure the exact selected ticket's coherent specification and plan are committed
and, when a remote exists, published before an Episode needs to obtain them.
This is your responsibility under this editable workflow, not a frozen-revision
approval or a code-level whole-checkout cleanliness check. Inspect current task
and history facts first. If needed, commit and publish the authorized ticket
update through the provider's native history. Backlog commits only the selected
task path and excludes unrelated staged changes. Beads v1.3.1 uses native
touched-table/staged-set commits that may include multiple issues; it does not
promise per-issue history isolation. Before consequential native mutation,
commit, or push, inspect pending/staged native changes, disclose and review the
consequences, and consult if pending work is unauthorized or unclear. With
auto-commit on, a native update may commit touched-table/pre-staged pending work
before any push. Pending or concurrent native Beads database changes can prevent
a safe operation; judge those facts without a
replacement code-level dirty gate or blanket quiescence requirement. Commit each
coherent update as soon as it is ready and publish promptly; do not defer it
until handoff or session end. Preserve unrelated bytes, staging, fields and
history. An unrelated published descendant is not a conflict by itself. Use
semantic judgment for actual same-task changes and report native publication
conflicts or uncertainty without force, automatic retry or another
allocation. Confirm that the Episode can obtain the selected committed ticket
from its provider workspace; do not synchronize another owner's dirty checkout
as a hidden prerequisite. Follow the canonical readiness workflow's native
preparation/publication procedure. Native command success alone does not prove
the changed task reached history: a trailing commit may fail or only log failure.
Inspect actual history, revisions and publication facts. These are not a duplicate
readiness decision; preserve failures for judgment instead of asking code to
reconcile or retry them. Do not add row filtering, another store/branch, dependency
patches, or a policy/facts framework to imitate per-issue Beads history.

## Inspect the code base

Use ordinary Git evidence to compare the current branch with the repository's
actual primary/default branch; do not assume its name is `main`. If they differ,
ask: “Current branch is xxxx; are you sure you want to stack a branch off this?”
Replace `xxxx` with the current branch name. Show the current branch and exact
code HEAD SHA during readiness. The current branch is the Episode's code base
and default integration target; do not switch branches to change that basis.

This check-in is LLM guidance only, not a second readiness or approval mechanism.
LLM noncompliance is explicitly acceptable. Add no confirmation argument,
tracking, token, receipt, code enforcement, or compliance test. Existing native
identity, isolation, and publication checks remain separate and unchanged.

## Admit once, then stop

Call `implement_task` with the exact canonical `taskId`. Supply optional `host`
only as an exact stable `id:<project-host-setup-id>`, never a display name or
resource identity. Otherwise let native placement selection choose the sole
ready local setup or present its picker. An explicit host cannot silently fall
back to another setup or local execution.

The tool queues preparation and one canonical readiness follow-up. Admission is
not proof of compaction, readiness, or Episode creation. On successful admission,
end the turn so those queued workflows can run. On failure or uncertainty,
report the actual result and inspect current delivery, ownership, provider, and
resource facts; do not automatically retry, create another Episode, or send an
initial handoff or second execute assignment. Carry the exact selected host
unchanged through readiness and final creation. The workflows own lifecycle
eligibility, code-basis and failure-disposition decisions; native creation
performs the one requested In Progress operation and exact resource mechanics,
not an automatic In Planning rollback or Blocked publication. Inspect actual
native/ownership/resource/assignment facts after failure before deciding any
next status or continuation. No earlier invocation receipt supplies authority.

Custom slash commands are not workflow prerequisites. Retained version-1
workflows, ownership, plans, and resources remain supported. This skill grants
no merge, abandonment, deployment, restart, or destructive cleanup authority.
