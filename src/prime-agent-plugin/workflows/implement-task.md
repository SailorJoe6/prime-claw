---
name: implement-task
description: Review one exact operator-approved provider-native task and create its isolated implementation Episode only when it is implementation-ready.
---

## Select fresh admission or existing creation

Before fresh provider/status/readiness checks, inspect canonical-primary
`.prime-claw/ownership.json` at this Conversation's exact durable owner session
key. Do not scan owners to select work. An existing version-2 `provisioning` or
`uncertain` entry selects **Owner-led creation recovery** below, not a new
readiness admission. Bind its persisted task and provider; any supplied task or
host must match. No fresh-admission tag is needed to inspect that exact owned
operation. A missing recorded session is not proof that none was created.
An already active entry uses ordinary oversight, not another initial assignment.
Retained version-1 ownership stays on its existing retained recovery path.
Never replace a nonterminal owner entry or redetect its provider.

Only the fresh path below resolves the live provider. For Backlog, run the
`prepare` skill normally. For Beads, perform `prepare`'s repository-orientation
reads but skip its Backlog-only queue inventory; that unrelated queue is not
task authority and must not mix providers before this readiness review.

For fresh admission, read the canonical task ID from the `<operator-implementation-task-id>` block
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

## Show the code basis

Show the current named branch and code HEAD during readiness. Fresh admission
records that branch as `integrationBranch`, the merge/publication target;
`baseRef` is the exact starting code commit and `branch` names the isolated
Episode branch. Grandfathered Backlog uses its task-only status commit as base;
independent Backlog and Beads keep code and provider revisions separate.
Never switch or silently substitute the target branch.

## Check prerequisites before fresh allocation

First inspect this Conversation's exact entry in canonical-primary
`.prime-claw/ownership.json`, using its durable owner session ID as the registry
key. Do not scan other owners to select work. If this task already has an owned
operation, keep its original binding and use the existing continuation and
failure-disposition sections below instead of fresh admission. A missing recorded
session does not prove that no session or assignment exists. Do not reserve,
republish In Progress, or allocate again to discover what happened.

For a fresh request, finish the native checks that do not need Episode resources
BEFORE calling `create_task_episode`, publishing its In Progress admission, or
reserving ownership. This is editable LLM guidance, not a new preflight tool,
receipt, code gate, or promise that later external operations cannot fail:

1. **Code and execute assets.** Inspect `git worktree list --porcelain`, the
   canonical primary root, current branch, exact code HEAD, status and upstream.
   Use `git rev-parse --show-toplevel`, `git rev-parse --git-dir` and
   `git rev-parse --git-common-dir`; compare resolved paths rather than relative
   spellings. Creation must address the intended primary checkout, not a linked
   Episode checkout. Read `git show HEAD:.agents/skills/execute/SKILL.md` to check
   the execute instructions the new worktree will actually receive. A readable
   untracked or working-tree-only asset is not evidence it exists at the code
   base. Decide suitability from the actual facts; do not turn unrelated work
   or a non-main branch into a cleanliness/approval gate.
2. **Provider and selected ticket.** Reread the exact native task and its
   committed/published history as above. Inspect the native CLI/configuration
   needed for the intended status update and subsequent execution, including
   commit identity where a native history commit needs it. For independent
   Backlog, inspect the selected store's native `config.yml` or `config.yaml`,
   store/config containment, and effective ignore evidence with
   `git check-ignore -v -- <store>/probe`. Only when root configuration is the
   selected authority, inspect `backlog.config.yml` and its relative link into
   that store; a supported folder-config layout needs no root link. Inspect the
   chosen code base with
   `git ls-tree HEAD -- backlog.config.yml .gitignore` and `git show HEAD:<path>`
   as needed: a root-link or ignore repair only in current working bytes will
   not transfer to the new worktree. Retain the actual ignore-rule source;
   do not require one particular ignore file or synchronize another owner's
   clone. Do not apply independent-store requirements to grandfathered
   code-DAG Backlog or copy a Beads store into an Episode.
3. **Provider transport.** For independent Backlog, resolve the current branch's
   upstream remote (or the sole configured remote), inspect
   `git remote get-url <remote>`, the intended push target with
   `git remote get-url --push <remote>`, and
   `git ls-remote --heads <url> refs/heads/prime-claw/tasks`. If publication or
   selected-ticket/config readability needs confirmation, use a disposable
   ordinary clone of that exact task branch; never another writer's mutable
   primary clone. No remote, an ambiguous target, unavailable credentials, or
   unreadable published content needs resolution before allocation; local-only
   initialization does not establish remote-backed Episode support. For Beads,
   inspect `bd context --json`, `bd dolt show --json`, `bd dolt status --json`,
   `bd config get sync.remote --json` and `bd dolt remote list --json` on the
   selected native workspace, with native history/ref observations as needed.
   Judge pending/staged multi-issue consequences and actual publication facts
   under the existing Beads guidance, not a blanket clean-store or frozen-head
   requirement. Never print credentials or infer success from CLI exit alone.
4. **Placement and runtime.** Read `orca project setups --json` when Orca is
   selected/available and inspect the exact project path, setup readiness,
   selected stable host and its native runtime/transport availability. Check
   the selected environment's Prime Agent command availability without starting
   an Episode or launch automation. Retain explicit placement; do not silently
   select another setup, treat inventory/transport failure as an absent CLI, or
   fall back to local execution. Missing CLI and native inventory failure are
   different facts. Resolve any material placement decision before creation.

A known prerequisite failure stops here without a branch, worktree, session or
ownership reservation. Report the failed native command and the exact current
native task status/history. If a justified selected-task lifecycle correction
is needed, the owning Conversation publishes it promptly through the native
exact-task procedure above, preserving unrelated content, staging and owners.
If that publication fails, inspect and report local versus published status;
do not claim rollback, retry blindly, or allocate while the cause is unresolved.
An untouched In Planning task needs no synthetic rollback or status churn.

Only target-specific workspace materialization and checks that require the new
resource stay after allocation. Preflight cannot prove the future worktree,
clone, session, Orca launch or initial assignment will succeed. Preserve and
inspect any late effects through the existing failure/continuation guidance;
deleting branches or worktrees is not routine recovery and requires separate
operator authority.

## Create the Episode

The full ordinary `prime-claw-oversee-episode` guidance is loaded above this
workflow in the post-preparation turn. Follow it as judgment guidance. It grants
no product, scope, merge, abandonment, cleanup, or transport authority.

Apply Conversation, Episode and Expert responsibilities here as editable policy.
Only the invoking Conversation with implementation authority requests creation;
an Episode or Expert does not acquire its owner's lifecycle authority. RLM depth
or a branch label does not establish a role or grant authority. Inspect the actual
owner/session and placement facts; never substitute another owner's identity.
Code preserves the exact requested owner, task, root and resource bindings rather
than treating runtime depth as a second role-approval rule.

Only when the complete task is ready, the native pre-allocation checks above
are resolved, and operator implementation authority applies, call
`create_task_episode` exactly once, whether readiness was reached
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

## Owner-led creation recovery

This is the narrow exception to ordinary no-direct-ownership-edit guidance.
Only the exact owning Conversation may reconcile its existing incomplete
version-2 creation under the approved implementation scope. The operator need
not repair JSON. An Episode or Expert cannot use this exception. It grants no
new scope, merge, activation, abandonment or destructive cleanup authority.
Do not invoke `implement_task`, fresh admission or ordinary handoff to finish
creation. No new recovery API, schema/state, checkpoint, approval/receipt or
retry engine is needed; the Conversation judges native evidence.

### Inspect before choosing an unfinished step

Reread only this owner's entry from the canonical checkout and its recorded
integration branch. Keep `operationId`, owner, exact task/provider/path, original
`baseRef`, integration target, engine, selected host/setup/routing environment,
branch and worktree. Inspect current native task/history/publication, Git
worktree inventory, code ancestry and actual Orca worktree/setup identity. An
unrelated ticket edit, compatible task-history descendant or integration-target
advance is not a reason to rebase, change the original base or allocate again.
Judge compatible same-task content from complete native views, not raw revision
equality. Foreign resources, changed bindings or unsafe ancestry stop recovery.

Inspect saved AND live native sessions at the exact worktree, their durable
ID/file/CWD, messages, queued actions and state, plus Orca terminals and exact
launch automation/run history. A missing recorded session, empty screen or
retired automation history does not prove no session or assignment exists.
Retain actual command results and warnings. If assignment delivery is genuinely
ambiguous or session evidence contradicts the resource binding, stop with the
exact missing fact and needed native inspection/operator resolution. Never
clear session/launch/resource fields, infer non-delivery from an error, replay
uncertain transport, or delete and recreate resources.

Read actual native status before any correction. Keep truthful `Blocked` while
its recorded cause is unresolved. Once the operator or accepted evidence clears
that condition, restore and publish `In Progress` only if needed before initial
execution. Do not reset to `In Planning` to pass fresh admission or repeat an
already completed transition. Use the exact-task native publication procedure
above. A failed status publication may leave changed local bytes or a local
commit: report local AND published task/history, preserve them, inspect the
native failure and reconcile only the proven-missing step. Do not claim a
rollback or continue initial execution while required publication is unresolved.

### Make only the justified targeted ownership edit

Decide the minimal field changes from the inspected evidence, not from a desired
status. Preserve every known resource/session/automation identity and all other
owners, including unknown historical fields. A cleared, resolved incomplete
creation may use the existing `provisioning` value; keep `uncertain` when facts
are unresolved. Mark `active` only after the exact durable session AND its
single initial assignment are established. Binding a session alone is not
assignment proof. Do not create or delete the owner entry, migrate the registry,
change provider, or erase identities to bypass a native guard.

Use the current registry's existing filesystem safeguards, not an unlocked
whole-file rewrite. Inspect a regular, non-symlink ownership file in the resolved
canonical `.prime-claw` directory and its `schemaVersion: 1` / `owners` format.
An older direct-record format needs its existing migration path, not an invented
conversion during recovery. Acquire the same exclusive directory lock at
`.prime-claw/ownership.json.lock` used by the registry writer. An existing lock
is not yours to remove or bypass; stop and inspect contention. Keep this a short
local edit, with no provider, runtime or network operation while holding it.

Under that lock, reread the current file immediately and compare this exact
selected entry with the entry whose evidence you inspected. If it changed,
release only your lock and inspect the new facts before deciding again; do not
overwrite it. Other owners may have advanced: retain their latest raw entries,
not the earlier whole-file snapshot. Replace only the justified fields of this
owner in that current registry, retaining its original binding. Write through a
new regular same-directory temporary file and atomic replacement, preserving
file permissions; never follow a symlink or overwrite an existing temporary
file. Reread and verify the intended selected-field diff, every original binding
and every other owner's raw value before releasing only the lock you acquired.
On any failure report current bytes and facts; do not restore an older registry
or retry the consequential operation automatically.

Commit and normally push the justified canonical-checkout ownership change
promptly, separately from task and code work. Inspect the actual selected diff
and index; preserve unrelated work. If another owner's uncommitted change shares
this file, do not commit it, reset it or conceal the publication conflict.
Resolve that concrete shared-file conflict without absorbing another writer's
work. These filesystem/identity precautions do not create a new approval record
or require a globally clean checkout.

### Complete only what current evidence proves missing

- **Allocated independent-Backlog Orca worktree, no session/assignment:** use
  the existing-operation call below for only missing target preparation and
  launch. Keep all identities and admit one fixed execute assignment.
- **Existing exact session with an admitted initial assignment:** use the
  session-binding call below. Inspect the returned observations; it sends no
  prompt. Reconcile active only with session AND assignment proof.
- **Complete active session/assignment:** reuse the exact binding without
  status publication, allocation, launch or initial delivery. Ordinary handoff
  is a separate later lifecycle decision, not creation recovery.
- **Existing session but a proven-missing launch/delivery step, or another
  provider/engine/partial shape:** inspect supported native interfaces and
  complete only that exact missing operation if they can address the same
  resources without duplicate delivery. The narrow `operationId` seam below
  does not support every shape. If an exact safe step is unavailable, report the
  concrete interface constraint; do not force fresh creation or claim recovery.

## Continue an allocated pre-session operation

This narrow path covers an independent Backlog Orca operation that already owns
its exact worktree but failed before session binding. It does not resume other
partial shapes, reserve ownership, publish a status or allocate another worktree.
The owning Conversation, not the Episode or Expert, decides continuation under
its existing implementation authority. Keep the recorded task, operation,
provider, code base, setup, worktree and branch. Historical incident IDs are
provenance, never permission to act on a foreign live operation.

Before requesting a launch, inspect the exact ownership and native worktree,
actual failure sequence, all native saved/live sessions at that worktree, their
messages and pending actions, and the exact Orca terminals and automation/run
history. Use supported native list/get_state/get_messages observations and
`orca automations list --json`, `orca automations show --id <id> --json`,
`orca automations runs --id <id> --json` for the operation's exact automation.
A missing ownership session ID, empty current terminal screen or absent current
run is NOT proof that an assignment was never delivered. Removal may retire
automation history, and a saved session may be inactive. Retain raw results and
warnings; do not classify delivery from an error string or absence alone.
If delivery remains ambiguous, preserve resources and report the actual gap.
Never replay an uncertain launch or choose another operation. Any justified
ownership correction follows only Owner-led creation recovery above.

When actual evidence establishes that this same operation has no session or
initial assignment, call `create_task_episode` with the exact canonical `taskId`
and existing `operationId`. This requests only the existing post-worktree native
preparation and launch steps, with ONE initial execute assignment. Omit `host`
to retain persisted placement, or repeat only its exact stable host. It is NOT
fresh admission; do not run implement-task readiness, reserve again, republish
In Progress or create another worktree. Existing session/launch resource
collisions are reported without guessing. A native failure can still follow
successful effects; inspect rather than retry.

If the original assignment already reached an exact existing session, inspect
its complete native messages/state/actions first, then supply that immutable
`sessionId` with the SAME task and operation. This binds the existing visible
Orca Prime Agent session and returns its raw message/state observations without
sending ANY prompt, automation run or second initial assignment. Judge the
returned facts; binding alone does not prove implementation started or finished.
An unavailable/inactive routing identity or ambiguous session/terminal binding
needs factual recovery, not an inferred replacement launch. Broader failed-launch
recovery remains outside this narrow path. On success continue normal ownership
oversight; an already active replay sends no assignment. No merge, activation,
abandonment or destructive cleanup authority is added.

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
no execution merely from a missing recorded session. Only the owning
Conversation may make the documented targeted creation-recovery ownership edit
above; never retry uncertain creation as a fresh Episode.

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
when applicable, exact `baseRef`, recorded `integrationBranch`, isolated Episode branch and worktree, and current ownership state. For
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
