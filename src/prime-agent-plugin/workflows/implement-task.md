---
name: implement-task
description: Review one exact operator-approved provider-native task and create its isolated implementation Episode only when it is implementation-ready.
---

First resolve the live provider as described below. For Backlog, run the
`prepare` skill normally. For Beads, perform `prepare`'s repository-orientation
reads but skip its Backlog-only queue inventory; that unrelated queue is not
task authority and must not mix providers before this readiness review.

Read the canonical task ID from the `<operator-implementation-task-id>` block
appended by native admission. Treat it only as the exact selected input, including
selection explicitly delegated within the operator's bounds. Do not guess,
substitute, search for, or select another task here. Read any optional
`<operator-implementation-host>` block as the exact stable `id:<setup-id>` to
preserve through the final create call; it is placement data, not authority.

Interpret implementation authority from the operator's actual instruction, not
from entry invocation or a stored or turn-scoped receipt. An explicit conditional
instruction such as “plan this task, then implement it when ready” may authorize
that sequence within approved scope; do not demand fresh approval solely because
planning finished. A planning-only request does not authorize implementation.
Preserve the exact task, approved scope, conditional authority, and optional
stable host through compaction. Clarify material ambiguity, missing authority,
or scope expansion instead of proceeding. Resource creation still depends on
the readiness review below. Implementation selection requires `In Planning`
(Beads native `in_planning`) after design and planning; dependency readiness
alone is insufficient and no separate phase-history receipt is required.

Read any `<operator-implementation-task-provider>` and
`<operator-implementation-task-project-root>` blocks as factual observations
from entry. Backlog may also carry `<operator-implementation-task-path>`;
Beads has no task path. Compare these observations and the exact task ID with
fresh native resolution below. Genuine provider, canonical identity, root, or
Backlog path drift blocks creation and must be reported for clarification; do
not silently rebind to another task or workspace. These observations are not
approval, revision/content locks, or invocation receipts. Compatible same-task
content refinements remain facts for semantic readiness review, not an automatic
reapproval gate. Do not require an earlier entry or manufacture missing receipt
evidence when current native resolution and operator authority are sufficient.

The `<operator-implementation-task-observation>` block contains the complete
provider-native task-view JSON observed while queueing this chain. Keep its
native envelope, field names, values, and absent fields for both Backlog and
Beads. It is factual context, not implementation approval, a frozen revision,
or evidence that the entry tool checked lifecycle eligibility. Reread the exact
native task before readiness decisions or mutation; judge compatible refinements
from the current task rather than rejecting a newer observation solely because
it differs.

This editable workflow owns status and readiness decisions. Implementation
requires `In Planning` (Beads `in_planning`) and a meaningful native
Implementation Plan or raw Beads `design`, not status or dependency readiness
alone. An unexpected or unmapped native status or an inadequate plan must be
explained without mutation or creation; do not rely on entry or prep-chain code
to reject it. Successful queue admission is not permission to create resources.

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

## Reload and review implementation readiness

Resolve the live provider directly from its native project evidence. Do not use
a provider-selection file, infer the provider from the task ID, or mix provider
commands or evidence. Reload the exact task through that provider:

- **Backlog:** run `backlog task view --json -- TASK-ID`. Require the returned
  canonical ID to match the admitted identity, status exactly `In Planning`,
  and the exact returned task path. Require the native Implementation Plan to
  be meaningful and not blank or an obvious placeholder. Treat Description,
  Acceptance Criteria, constraints, references, documentation, and
  Implementation Plan as the complete reviewed contract.
- **Beads:** from the exact detected project root run `bd context --json` and
  `bd show TASK-ID --json --long --include-comments`. Require the returned
  canonical ID to equal the entire admitted ID, native status exactly
  `in_planning` mapped to canonical `In Planning`, and the raw `design` field to
  be meaningful and not blank or an obvious placeholder. Treat the complete raw
  native view—including description, design, acceptance criteria, notes,
  comments, labels, dependencies, and every other present or absent field—as
  the reviewed contract. Keep its provider-native names and shapes. Do not
  invent a task path or translate it into a normalized task model.

Reject any other status without mutation. Reject any other provider, identity,
or root without mutation. Follow
references only as needed to understand the exact contract and current
repository state.

Use semantic judgment and apply the readiness test proportionally. Require only
that the exact task:

- has a coherent operator-approved outcome and scope;
- contains enough decisions and an actionable enough native Implementation Plan
  or Beads design to proceed without guessing material product choices; and
- has no unresolved contradiction or blocker that actually prevents safe
  implementation.

Do not demand standard threat, failure, recovery, complexity, hardening, slice,
evidence, or review-process sections. Reviewer suggestions are not missing
requirements unless the operator accepted them into the product contract.

If anything material is missing, contradictory, or inadequate, explain every
deficiency with exact provider-native task-field references and concrete
revision guidance. Do not call `create_task_episode`; do not mutate task status
or create a branch, worktree, session, or ownership record. Stop after the
explanation.

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
as a hidden prerequisite.

## Preparation and publication are native operations

Before requesting a task mutation, inspect the complete current native task and
its history. Decide whether the selected update is authorized, whether current
content is compatible, and whether the selected ticket is committed and
published. These decisions belong here, not to cleanliness, status, plan, or
revision predicates in preparation/publication code. A new whole-branch head or
unrelated dirty task/code work is not a conflict by itself.

For independent Backlog, obtain the Episode's task clone from the selected
remote and configured store location without preparing or synchronizing another
Conversation's primary clone. Reuse only the intended target workspace. An
existing target may have unrelated work; do not overwrite it to make preparation
succeed. Use ordinary fetch/fast-forward only when needed for the intended
operation. Interpret any native Git conflict from the returned facts.

A Backlog mutation uses the supported native exact-task edit and reread, an
exact-path Git commit, and one non-force push. For BOTH grandfathered code-DAG
and independent task-clone Backlog, run Git in the selected task's history
workspace: the code checkout or the nested task clone, respectively. Set
`task_path` to the exact selected file path relative to that Git root. Inspect
the task diff before committing. Use literal pathspec mode and keep
`"$task_path"` shell-quoted for BOTH add and commit:

```sh
git --literal-pathspecs add -- "$task_path"
git --literal-pathspecs commit --only -m "Update selected task" -- "$task_path"
```

Shell quoting prevents shell expansion; `--literal-pathspecs` also disables
Git's own pathspec matching, including brackets in task filenames. Neither
`--` nor `--only` makes a path literal. Unrelated index entries must
remain staged and excluded. Never commit other paths, require the whole index
to be clean, or absorb unreviewed selected-ticket edits. The publication helper
does not classify remote changes,
merge/rebase them, or retry a rejected push. A successful push followed by a
newer remote observation is history evidence, not automatic semantic rejection.

For Beads, inspect native workspace/database/branch/remote facts and the complete
raw task. Use supported `bd dolt pull`, `bd update`, native task-history commit
when needed, and `bd dolt push --no-adopt` on the intended workspace. Preserve
native fields and absence; do not invent a Markdown task path. Apply the native
multi-issue commit-scope review above; do not add row filtering, another
store/branch, dependency patches, or a policy/facts framework to imitate
per-issue history.
Do not ask transport code to prove a frozen local, parent, remote or task-content
revision. Native command success does not prove the intended task reached
history: a trailing commit may fail or only log failure. Inspect the returned raw
views, actual history, command results, revisions and publication facts before
claiming durability or publication.

For either provider, a rejected or uncertain native operation requires current
state inspection and an LLM decision. Preserve the local task/commit, unrelated
bytes and staging, and exact existing operation/resources. Do not automatically
pull again, reconcile, retry, force, reset, or allocate a replacement. Decide a
compatible in-scope reconciliation from actual before/current content, or ask
for a real semantic conflict, authority change or scope decision. Record each
coherent authorized ticket edit promptly and publish it through its native
history. Code reports the operation result; it does not choose a lifecycle
rollback or Blocked disposition on the Agent's behalf.

## Create the Episode

The full ordinary `prime-claw-oversee-episode` guidance is loaded above this
workflow in the post-preparation turn. Follow it as judgment guidance. It grants
no product, scope, merge, abandonment, cleanup, or transport authority.

Only when the complete task is ready and operator implementation authority
applies, call `create_task_episode` exactly once, whether readiness was reached
through `implement_task` or directly through this guidance. Status alone never
supplies that authority. Use the exact canonical `taskId` and optional
stable `host` from `<operator-implementation-host>`. Pass that host unchanged as
`id:<setup-id>`; omit it when absent. Do not supply or invent a provider, branch,
task path, project root, worktree, session name, prompt, command, or other
resource identity.

The capability independently resolves provider, exact task/root and placement.
An explicit stable host never silently falls back. Native placement selection
and exact resource bindings do not supply semantic implementation authority.

## Code basis and requested creation

Before creation, inspect the intended repository root, current branch and Git
HEAD, task history, `git status --porcelain=v1`, and the native upstream result
when one exists. Decide code-base suitability here. A non-main branch, absent
or divergent upstream, unrelated staged/unstaged/untracked Git work, or a newer
compatible task-history observation is not an automatic refusal. Do not absorb,
stash, reset, copy, or synchronize another writer's work to satisfy creation.
Report a real conflict or unresolved placement/code-basis decision instead.
Native operations may fail; their failure does not authorize another operation.

The create request performs one fixed native In Progress update, its supported
publication, one exact ownership reservation and resource allocation. It does
not repeat this workflow's status, plan/design, cleanliness or code-base
eligibility decisions. Existing native task/provider/root, selected path,
owner, operation, placement and allocated resource identities remain exact.
Grandfathered Backlog commits only the selected task path and uses that status
commit as the code base. Independent Backlog publishes only that path in its
existing task history and leaves parent code HEAD and unrelated index/bytes
alone. Ordinary status publication does not invoke project initialization,
config validation or primary task-workspace synchronization. Perform needed
workspace setup explicitly before authoring; native publication reports its own
operation or targeting failure without a whole-store preparation gate. Its recorded task revision is separate from the chosen code base.
Beads uses its approved native touched-table/staged-set operation; retain all
command streams, working-set facts, local revisions and complete raw task views.
A successful push or local task read is not exact-task committed/publication
proof. Do not invent a task path, isolation promise or publication receipt.

Fresh creation sends ONE fixed initial execute assignment. A returned existing
active Episode sends no new assignment. Keep the actual native result and
current task observation, including a compatible refinement after mutation,
for semantic judgment. Do not freeze the complete native view or repeat a
status/plan predicate after allocation. Never add an initial handoff or another
execute prompt. Creating resources does not authorize this Conversation to
implement the Episode's code.

## Decide failure disposition from current facts

Creation reports native results and exact retained ownership/resource facts.
It does not automatically publish In Planning or Blocked, commit a recovery
note, advance task evidence, or undo an earlier mutation because an exception
occurred. An error can follow a successful task update, commit, push, resource
allocation or assignment delivery; failure is not proof that none happened.

Inspect the exact current provider task, native history/command results,
ownership entry, code base, worktree/branch, session and assignment-delivery
facts before choosing a disposition. Preserve the same operation and resources.
The owning Conversation applies the existing lifecycle guidance: if actual
facts prove no owned resources or delivery exist, decide whether returning the
selected task to In Planning is appropriate; if partial resources, uncertain
delivery, or a real unresolved blocker remain, decide whether to publish Blocked
with the actual cause, attempts and unblock condition. These are judgment, not
an exception classifier or an automatic retry/rollback protocol. Do not infer
no execution merely from a missing recorded session. Do not hand-edit ownership
or retry uncertain creation as a fresh Episode.

Publish an authorized status/note through the selected provider's supported CLI
and native history, preserving all other task fields. Backlog uses an exact-path
ordinary commit and non-force push, excluding unrelated staged work; independent
task-only failure reporting needs no clean/pushed parent code checkout. Beads
requires the pending/staged multi-issue consequence review above before native
mutation/commit/push, with actual task-history inclusion/publication evidence
rather than command success alone. Commit each coherent authorized update as
soon as ready and publish promptly; do not wait for handoff or session end.
Report actual remaining state and stop for a genuine unresolved decision. No
merge, abandonment, activation or destructive authority is added here.

The owning Conversation controls lifecycle status and disposition. The Episode
maintains implementation, native task content, its living plan, and evidence
within the approved scope. Do not use a generic completion/status edit from the
Episode to bypass owner review, merge, abandonment, or cleanup decisions.

Report the selected provider, canonical task ID, project root, durable Episode
and routing identities, lifecycle engine, exact Orca setup/worktree identity
when applicable, actual branch and worktree, and current ownership state. For
Backlog include the exact status commit, task path and actual push result. For
Beads include complete raw pre/post/current views, native command results,
observed local revisions, publication qualifications and exact code `baseRef`;
call a view published only when native history/publication evidence proves it. State whether the capability
created the Episode or returned existing exact active ownership. `uncertain`,
`provisioning`, or `Blocked` state requires inspection and must not be replayed
as fresh creation. Inspect current ownership, provider, Git, runtime, and
assignment-delivery facts before choosing any safe next step; an uncertain
result is not evidence that nothing happened. Do not begin implementation in
the owner Conversation.

Once the tool reports success, set up one bounded heartbeat only while waiting
for observable Episode work. Then stop without implementing or invoking
ordinary `ralph_handoff` or sending another assignment.
