---
name: execute
description: Use for Ralph's execution phase in Backlog.md-tracked projects to implement the current spec and plan while keeping Backlog.md tasks, docs, and tests current.
---

Run the `prepare` skill if it is not fresh in your context window. If the
conversation was recently compacted, nothing is fresh.

Ordinary direct task implementation follows the direct path in the managed
`implement-task` skill, not this workflow. The checks below apply to managed
Episodes and existing retained folder-plan execution; a direct request cannot
bypass an owned same-task Episode or change the mode of a bound execute pass.

## Select the bound authority

A managed Episode prompt normally carries `<operator-episode-owner-session>`.
Its exact value is the owning Conversation's registry key and intentionally
differs from the Episode's own session ID. Inspect `.prime-claw/ownership.json`
from the canonical primary checkout before interpreting task/source tags. When
the file is a Conversation-keyed registry, require the tag and select only that
exact `ownerSessionId` entry. If the tag or exact registry binding is missing,
stop for recovery; never scan all owners or infer the key from task/source
placement.

One live-upgrade bootstrap exception applies only when the canonical file is the
pre-upgrade direct record, not registry form. With no owner tag, its embedded
`ownerSessionId` is self-identifying only after its non-inactive status, exact
recorded current worktree, durable Episode ID, readable matching Episode session
file, and exact prompt task/source binding all match this Episode. If a tag is
present, it must match the embedded owner. Any failed or ambiguous check stops
for recovery. The direct record remains valid migration input; this exception
never applies to a registry and never authorizes scanning or choosing among
owners.

Require the selected record's worktree and Episode session identity to match the
current Episode. Other Conversations' entries never select or block this
Episode, though repository-wide task/source collision checks inspect all
non-inactive entries. In a linked Episode worktree, locate the canonical checkout
through Git worktree metadata; a missing worktree-local file does not mean the
tagged owner's entry is absent.

A valid version-1 ownership record selects **retained folder-plan mode**. A live
version-1 Episode requires that record plus readable, non-empty active
`SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files in its recorded Episode
worktree; also accept the retained `EXECUTION_PLAN.md` spelling used by this
project. If those active files are missing, stop for exact ownership recovery
instead of switching modes. A valid version-2 ownership record selects
**task-native Episode mode** and binds its exact task ID. Select its provider
only from that exact record. A provider-absent record, or `provider: "backlog"`
without `providerRevision`/`taskEvidence`, is grandfathered branch-local Backlog
and must retain its exact `taskPath`. An explicit Backlog record with both fields
selects independent task history: bind its 40-hex revision and task evidence
(Git reference or legacy raw view) separately from code `baseRef`/`head`. A `provider: "beads"` record
must have no `taskPath` and must retain
its exact non-empty `providerRevision`, complete raw `taskEvidence`, `baseRef`,
worktree, branch, and Episode session identity. Any mixed or missing binding
stops for ownership recovery. If an `<operator-episode-task>` block is also
present, require its entire trimmed value to match the persisted version-2 task
ID. A prompt tag never overrides persisted ownership.

With no ownership, active legacy `SPECIFICATION.md` and
`IMPLEMENTATION_PLAN.md` files on canonical main select valid old in-place
folder work; the retained `EXECUTION_PLAN.md` spelling is equivalent. This
fallback is not a live Episode. Only when neither ownership nor old in-place
files decides may `<operator-episode-task>` become a candidate task binding.
The tag alone does not establish live Episode identity or grant Episode mutation
or lifecycle authority; stop for exact version-2 ownership recovery before a
task-native execute pass. Otherwise use retained folder-plan mode only for clear
operator-provided legacy instructions. Never guess, search for, or substitute
another task, mix the two modes, or copy content between their authorities.

## Task-native Episode mode

Use the provider selected from the exact version-2 owner. Do not redetect,
replace, or infer it from repository files. Do not use `.ralph/plans` as
authority in this mode. A provider-absent or either valid explicit Backlog
shape continues through the Backlog branch below. Only `provider: "beads"` selects
the Beads branch. Never mix commands, content, commits, or evidence between the
two branches.

Retain the recorded `integrationBranch` as the owner's merge/publication target;
only an omitted field in old version-2 records means `main`. Keep it separate
from `baseRef` (exact starting code commit), `branch` (this isolated Episode
branch), and provider revisions. A switched owner checkout is a recovery
blocker, not permission to retarget or switch branches. Continue the same
owner/task/worktree/session binding.

### Owner-authorized execute-only continuation

Under `prime-claw-oversee-episode`'s informed-authorization procedure, a version-2
owner may send one NEW canonical execute after demonstrably completed handoff with
failed or historically unproved execute, or after a verified pre-work runtime interruption
of both received prompts. This is distinct from replaying the old chain. Preserve the exact existing
binding and read current native task/history, meaningful living plan, accepted
bounded EXECUTE focus and full factual observation below. Continue from current
durable progress, not a stale task or comment snapshot, and do not repeat
historical side effects. Historical execute admission and callback/partial
effects may remain unknown; neither fresh idle/empty queues nor this new request
proves prior non-delivery. Current evidence may compatibly advance beyond stored
ownership observations. Judge its meaning; do not freeze task revisions or
replace native fields with summaries.


The optional `<operator-execute-guidance>` block carries the accepted bounded
EXECUTE focus for this new request, not compaction instructions or new scope.
Keep that focus within the current native task and stop after one slice.

No new resources, handoff, compaction prerequisite, initial assignment or
historical callback replay is part of this request. The owner alone authorizes
and sends it through the documented managed operation, never this Episode or a
handoff turn/hook. If it conflicts with current task/scope/identity or known
unfinished work, report and stop rather than duplicating work. The normal
provider-specific status and content-authority rules below still apply. Do not
repair ownership or resend if the owner's post-admission factual update failed;
preserve actual effects and report the failure. Retained version-1 and ordinary
successful handoffs are unchanged.

### Read the exact handoff observation

For a task-native continuation, `<task-handoff-observation-reference>` contains
JSON with `schemaVersion: 1`, `sessionId`, an absolute `sessionFile`, `entryId`,
`parentId`, `customType: "prime-claw-task-handoff-observation"`, `entrySha256`,
and `bindings`. This is factual context, not task authority or acceptance.
Load it before judging continuation:

1. Read only that exact native `sessionFile` through the Episode's Python REPL.
   Verify its session header has `type: "session"` and the exact `sessionId`.
   Select exactly one row whose `id` equals `entryId`; verify `type: "custom"`,
   `customType` and `parentId`. Hash its exact UTF-8 JSONL bytes, excluding the newline,
   with SHA-256 and require `entrySha256`. Do not hash reserialized JSON, choose
   the latest entry, search other sessions, or print the journal/history.
2. Require schema version 1 in the reference and entry data. Require the entry's
   `bindings` to equal the reference's `bindings` and match this exact selected
   owner/registry Episode: `ownerSessionId`, `provider`, `taskId`, `operationId`,
   `episodeId`, `episodeSessionFile`, `episodeActiveSessionId`, `worktree`,
   `branch`, `baseRef`, `integrationBranch`, `engine`, and optional
   `projectSetupId`/`routingEnvironmentId`. Apply the existing provider and
   integration-branch defaults above for older records. Require the reference's
   `sessionId` to equal `bindings.ownerSessionId`. That source Conversation
   session is not a replacement for the Episode's durable session binding.
   For an owner-authorized execute-only request, `episodeActiveSessionId` may
   instead be the freshly natively resolved route for that SAME durable Episode.
   Verify it against the complete supplied native session/state identity, not
   by a guessed name or CWD; the historical route in ownership need not be current.
   This factual route does not rebind resources or authorize an Episode registry edit.
3. Keep the full parsed entry data in named REPL variables. Its structure is
   `{schemaVersion: 1, bindings, providerTaskObservation,
   episodeSessionObservation: {session, state}}`. Retain the full unchanged
   provider observation and native session/state facts. Preserve provider-native
   envelopes, arrays, keys, unknown fields, nulls, and absent fields; never
   normalize, flatten, truncate, or replace them with a summary.
4. For Backlog, select the evidence pair by the bound topology: independent
   uses `previousTaskEvidence` and `currentTaskEvidence`; branch-local uses
   `mainTaskEvidence` and `currentTaskEvidence`. Require both to be valid Git
   references of that topology or both to be complete legacy raw native task
   views for the bound task. A mixed, missing or malformed pair stops; never
   interpret a failed reference as a raw view. Beads retains its raw views.
   For raw observations, enumerate their structure and inspect the entire
   current task contract and relevant prior/current differences, including
   fields and comments. Read large values
   and collections in chunks of about 4096 characters, with paths and offsets.
   A key list, digest, preview or summary cannot replace semantic inspection.
   Do not dump one giant JSON value into model context.

A missing, unreadable, ambiguous, mismatched or inaccessible exact session/entry
stops continuation with a bounded explanation. Same-filesystem access must be
real; a remote/host label does not establish it. Do not fall back to another
entry, ownership evidence, a copied journal, a new store or giant inline data.
Previously loaded generations may still supply `<provider-task-observation>`
and `<episode-session-observation>` inline. Read those complete native values
when no reference was supplied; they never repair a failed reference. Retained
version-1 folder-plan handling is unchanged.

### Read independent Backlog Git evidence

For ordinary handoff and execute-only continuation, each reference has
`{kind: "backlog-git", repository: {topology: "independent", identity}, commit, path}`.
The managed sender verifies both exact committed regular ticket blobs and their
native canonical task ID from committed frontmatter before delivery. Match the
previous commit to `previousProviderRevision` and the current commit to
`publishedProviderRevision`. The current reference is the observed published
checkpoint. An optional `localTaskEvidence` points to a separately retained
local head. When it matters to the decision, require the same repository
identity, topology and literal task path as the current reference. Resolve its
own commit, verify the bound canonical task ID and read or diff its blob against
the published blob using the same bounded procedure. If that relevant evidence
is unavailable or mismatched, report the gap; never guess from local `HEAD`.
Local evidence is not publication or a substitute for either required reference.
Use `selectedTaskStatus`, the raw literal-ticket Git status result, as separate
publication context. It is not an automatic cleanliness gate or a substitute
for committed content. Do not require these commits or the branch tips to be equal.

1. Use only this Episode's already selected independent task clone at its
   configured store location (normally `<worktree>/.backlog`), not the code
   repository or the primary clone. With `git --no-replace-objects -C "$root"
   rev-parse --show-toplevel`, verify the canonical root matches that exact
   store. Hash UTF-8 `remote:` followed by the output of `git -C "$root" remote
   get-url -- "$remote"` with trailing whitespace removed. Use the already
   selected task remote, not a guessed remote. Compare the lowercase SHA-256
   digest to both `repository.identity` values; do not print the URL.
2. For each reference require exactly 40 lowercase hex digits and
   `git --no-replace-objects -C "$root" cat-file -t "$oid"` to return `commit`.
   Require a literal `.md` path relative to the nested clone, with no empty,
   `.` or `..` components, NUL, CR, LF or backslash. Run
   `git --no-replace-objects -C "$root" --literal-pathspecs ls-tree -z "$oid" -- "$path"`.
   Require exactly one NUL-terminated entry of mode `100644` or `100755`, type
   `blob`, and the exact path after the tab. Keep its full blob OID; verify
   `cat-file -t` returns `blob`. The path and filename alone do not prove the
   task ID; check the committed header against the bound canonical ID when
   reading the blob.
3. In the REPL, stream `git --no-replace-objects -C "$root" cat-file blob "$blob"`
   for the entire current contract. Compare both verified blob OIDs with
   `git --no-replace-objects -C "$root" --no-pager diff --no-color --no-ext-diff --no-textconv --text "$old_blob" "$new_blob" --`.
   Pass arguments separately. Read stdout in successive windows of about 4096
   bytes, with offsets and incremental UTF-8 decoding. Do not cut at a long
   line or skip the tail. Check process exit and the blob's `cat-file -s` byte
   count for a complete blob read. Inspect all relevant changes, including
   frontmatter, plan, notes and comments. Do not print or save a full snapshot.

If either required reference cannot be bound, read or matched, stop and report
which evidence is missing or mismatched. Do not substitute `HEAD`, a tracking
ref, an index/working file, a native live view, or a cached observation. Resume
from the same task and assess current progress under existing guidance; the
observed commits do not freeze history or grant approval.

### Read branch-local Backlog Git evidence

For ordinary handoff and execute-only, `mainTaskEvidence` and
`currentTaskEvidence` each have `{kind: "backlog-git", repository: {topology:
"branch-local", identity}, commit, path}`. The shared sender helper takes the
exact current integration and Episode code head OIDs, respectively. The
integration branch is the one recorded in ownership, not necessarily `main`.
Both references use the literal code-repository-relative task path from the
exact branch-local binding. The sender verifies both committed headers with
native Backlog before delivery. Neither reference establishes remote publication;
keep native upstream and publication facts separate.

Use the code repository at the exact bound Episode worktree. Verify
`git --no-replace-objects -C "$root" rev-parse --show-toplevel` resolves to that
canonical worktree. Resolve `git --no-replace-objects -C "$root" rev-parse
--path-format=absolute --git-common-dir`, trim trailing whitespace, then apply
`realpath`. Hash UTF-8 `local:` plus that canonical common Git directory path.
Require both lowercase SHA-256 identities to match, both topologies to be
`branch-local`, and both literal paths to equal the bound task path. Do not
use the nested task clone, an unrelated clone, or a remote URL for this check.

Use steps 2 and 3 above in that code repository, with paths relative to its
root. Verify each committed header against the bound native canonical task ID;
the path or filename alone is not proof. Read the entire Episode ticket and
compare the integration blob to the Episode blob in bounded windows. Use only
the exact commit OIDs in the observation, never historical checkpoints, fresh
tips, tracking refs, the index, mutable files, or a live task view. If either
reference cannot be verified or read, report the evidence gap and stop.

### Read branch-local Backlog initial assignment evidence

A fresh branch-local assignment can supply `<provider-task-observation>` with
only `currentTaskEvidence`, a `backlog-git` reference. This is not a continuation
pair. Match its commit to the exact owned `baseRef` and its path to the owned
`taskPath`. Verify the repository identity and committed canonical task ID,
then stream the exact ticket to inspect the entire contract using the bounded
blob procedure above. Stop if the reference is missing required fields or
cannot be verified; a live task view cannot repair it. For this initial
assignment, judge status and plan from the committed ticket; use a live native
read separately when authoring. Legacy initial prompts without this reference
retain the ordinary native reload.

### Provider-absent or Backlog task authority

First retain the ownership-selected Backlog topology. Provider-absent and
explicit Backlog without revision/evidence remain branch-local. Explicit Backlog
with revision/evidence uses the ignored independent nested clone at the derived
store path as an ordinary Git clone on `prime-claw/tasks`; never stage it as a
gitlink or put task files in the code DAG. Inspect the selected committed ticket,
current history and publication facts. Unrelated bytes/staging and compatible
descendants do not block execution. A missing or foreign workspace, real native
conflict or unavailable selected-ticket history needs factual recovery; never
reset or absorb another writer's work to make it clean.

Use the exact task ID and path selected above. Do not use `.ralph/plans` as
authority in this mode. Except for the committed branch-local initial assignment above,
reload the exact task through the supported structured interface:

```sh
backlog task view --json -- TASK-ID
```

Require the returned canonical ID to match the bound ID and retain the returned
project-relative task path. For a normal execute pass, require status to be
exactly `In Progress` and the native Implementation Plan to be meaningful. If
the status differs, the task disappears, or identity/path changes, do not
mutate it or create replacement work. Report the exact state to the owning
Conversation and stop.

Read the task Description, Acceptance Criteria and constraints against the
operator's actual request. Documentation, Implementation Plan, Notes and Final
Summary supply approach, claims and progress, not additional user requirements.
Determine what requested behavior remains; follow references only as needed.
Plans, limits and checkpoints remain revisable. Reconsider an agent-created rule
that blocks work rather than harden around it or seek approval for routine
technique changes. Preserve genuine user limits and permission boundaries.
Review findings do not authorize their own repairs: follow the Conversation's
in-scope disposition, including correcting claims or removing unnecessary
mechanisms when that meets the request. Still fix concrete public-path bugs and
genuine safety, security or interface defects within scope. A handoff continues
this same task and Episode; it never selects a new task or adds preservation,
loss, duplication, crash or replay guarantees.

The Episode exclusively owns task content. In grandfathered mode it stays on
the Episode code branch. In independent mode it stays in the Episode nested task
clone and publishes only to `refs/heads/prime-claw/tasks`; the code branch HEAD
must remain unchanged by task-only work. Update through supported `backlog task
edit` operations, never by editing task Markdown directly. In approved scope, the Episode may refine the Implementation Plan,
append Implementation Notes, record acceptance evidence and checked criteria,
maintain references, documentation, and modified-file paths, and prepare the
Final Summary. Reload after each mutation and verify the canonical ID, task
path, parent identity, and lifecycle status are unchanged.

The owning Conversation exclusively owns lifecycle status: on the recorded
integration branch in the primary checkout for grandfathered Backlog, or in the
primary nested task clone for independent Backlog. The Episode must not pass
`--status`, archive, restore, or delete the task, mark it `Done`, publish
`Blocked` or `Ready for Merge`, or write task content in another checkout.
Ordinary execution performs no cross-checkout copy, mirroring, or dual write.

For a Backlog continuation in either topology, inspect the bound committed
pair and native history (or the complete raw pair for an old generation).
Keep live native reads for authoring distinct from committed evidence.
Incorporate compatible in-scope clarifications; stop for a real semantic
conflict, authority change, scope expansion or product decision, not raw
inequality or unrelated history.

For independent Backlog, prepare and read only this Episode's intended task
workspace when needed, not another writer's mutable primary clone. Immediately
before an authorized content write, synchronize and reread this workspace once
more. Preserve unrelated edits/index/history and inspect actual native
conflicts rather than imposing whole-clone cleanliness.

Commit each coherent ticket edit ASAP and publish promptly, during execution,
not only at candidate, blocker, handoff, compaction, session end or admission.
In BOTH Backlog topologies use a task-path-only commit, with literal pathspecs
for `git add` and `git commit --only`; inspect the selected diff, commit and
unrelated index entries. In independent mode publish non-force to
`HEAD:refs/heads/prime-claw/tasks`, prove direct publication/native reread, and
make no code HEAD/index/file write. In branch-local mode publish the exact task
commit normally. Commit code separately. Verify intended fields and preserve
ID/path/parent/status and all unrelated task fields. A rejected or uncertain
operation requires inspection, never a blind retry, force or automatic merge.

If blocked after a bounded attempt, append the exact blocker, attempted actions,
evidence, and unblock condition to this task's Implementation Notes on the
Episode task authority. Verify the task identity and unchanged status. In
grandfathered mode create a task-path-only code-branch commit and publish it
promptly; commit safe resumable code separately. In independent mode make
one task-path-only commit in the nested clone and push
`HEAD:refs/heads/prime-claw/tasks` without force; commit/push code separately only
when code changed. Report both exact heads and push
evidence through the existing Episode-to-Conversation channel. Then stop. Do
not change status or move plan files; the Conversation decides whether to
publish `Blocked` through the selected task authority; grandfathered Backlog
uses the recorded integration branch.

When the candidate is complete, ensure the task holds the current plan, notes,
acceptance evidence, references, documentation, modified files, and a useful
Final Summary. Leave its status unchanged. Grandfathered mode commits the
task path only, separately from implemented code/docs. Independent mode
commits and non-force-pushes task content only in the nested task clone, then
commits/pushes the code candidate separately. Report both exact published heads
and evidence to the owning Conversation. Do not
merge, mark `Ready for Merge` or `Done`, finalize ownership, or clean resources.

### Beads task authority

Use the exact task ID, raw task evidence, provider revision, code `baseRef`,
worktree, branch, and Episode session identity selected above. Run every Beads
command from the exact recorded current linked worktree. Do not use Backlog,
edit task Markdown, copy a task store, redirect Beads, or write the ownership
registry.

Before interpreting or changing the task, perform one native synchronization
and read cycle. Run the configured native pull and exact raw task read:

```sh
bd dolt pull
bd show TASK-ID --json --long --include-comments
```

Require one raw task whose exact canonical ID equals the bound task ID, whose
native status is exactly `in_progress` and maps to canonical `In Progress`, and
whose raw `design` is meaningful rather than blank or placeholder text. Also
inspect native evidence for the exact current Dolt database, branch, revision,
publication ref and working set. Apply these execution rules using actual facts,
not a duplicate code-level status/design/cleanliness or publication gate. If the
exact task/resource identity or actual authority cannot be established, report
the evidence and stop without replacement work.

Read the complete raw Beads view under the same request-versus-approach
distinction above, not as independent authority for every recorded choice:
description, design, acceptance criteria, notes, comments, labels, dependencies,
and every other field retain native names, shapes, values and absence. Do not
translate them into a normalized task model. Compare the prior
factual `taskEvidence` observation with the synchronized raw view field for
field. Inequality is not an approval boundary. A provider revision advance or
unrelated-task change alone does not block this Episode. For every outside
change to the same task, use the exact raw before/current values supplied by the
host and reason about their meaning. Incorporate a compatible change inside the
approved scope as the current working basis. Escalate a genuine semantic
conflict, scope expansion, or authority change without a write. Do not use a
deterministic semantic classifier and never silently overwrite either view.

The Episode may change only owner-authored task content through supported
`bd update TASK-ID` content fields: description, design, acceptance criteria,
and notes. It must not change status, title, type, priority, assignee, parent,
dependencies, labels, comments, metadata, task identity, or lifecycle fields.
Before every native content mutation, history commit or push, inspect native
pending/staged work. Beads v1.3.1 commits touched-table rows and the staged set,
including other pending issues/already-staged work during auto-commit BEFORE
push. Disclose consequences and consult about unauthorized or unclear work.
This approved multi-issue exception is not per-issue isolation; pending native
work can prevent a safe operation, but no blanket clean/quiescence gate or
store/branch/row-filter/dependency workaround replaces judgment.
Immediately before any write, synchronize once more, reread the complete raw
task, and repeat the same-task comparison. Apply at most the intended in-scope
content update without `--status`, `--force`, raw Dolt SQL writes, or retry.
Immediately after the write, reread the complete raw task and native revision,
branch, ref, and working-set state. Require the exact intended owner-authored
field changes, only the exact provider-generated revision/timestamp changes
caused by that write, every other raw task field unchanged, and actual remaining
working-set facts. Commit each coherent authorized ticket update through native
history ASAP and publish promptly; do not defer it to the end of the code slice.

Publish the verified native task update exactly once and without force:

```sh
bd dolt push --no-adopt
```

Inspect `bd --readonly history TASK-ID --json --limit 0` (native CommitHash and
Issue snapshots) to verify the intended task changes actually reached committed
history. Native update exit-zero may only log a trailing history-commit failure;
a local task read, local revision and successful push are not exact-task proof.
After publication, read current raw task/revision/ref/history evidence and report
actual inclusion and warnings/remaining working-set qualifications. Incorporate
compatible descendants/refinements with LLM judgment, not frozen-view equality.
A rejected or uncertain synchronization, update, commit or push is evidence,
not permission to pull again, retry, reset, force, adopt or overwrite.

On a candidate or blocker, keep the Beads design/notes and Episode code evidence
current through the same guarded native flow. Commit and push only the approved
Episode code-branch changes when appropriate. Report the exact prior task
observation, synchronized pre-write view, post-write view, final published view,
published provider revision/ref, code `HEAD`, and command failures to the owning
Conversation so it can record current factual provider/task/code observations.
The Episode never mutates ownership directly and never publishes lifecycle
status. The Conversation alone decides status, merge, abandonment,
finalization, and cleanup.

## Retained folder-plan mode

The promoted specification is frozen compatibility authority. Never revise or
rebaseline it, including when the original future source is absent. Keep the
implementation plan living as execution and review reveal accepted in-scope
facts.

Use the active `.ralph/plans/SPECIFICATION.md` with its retained
`.ralph/plans/EXECUTION_PLAN.md` or `.ralph/plans/IMPLEMENTATION_PLAN.md`. The
plan describes the implementation steps for the specification. A persisted
version-1 record with a missing active pair must stop and use only
`restore_blocked_spec_episode` after the operator's explicit unblock decision;
execute cannot use chat instructions or any fallback before successful
live-identity revalidation. Only when no persisted ownership exists may clear
operator-provided legacy instructions serve as the plan; ask only when no plan
or direction exists.

There may be Backlog.md tasks related to the plan. They are references, not
lifecycle authority for this compatibility workflow. Audit existing work before
deciding what remains, and keep the active legacy plan current. Never change a
Backlog task's status, mark it `Done` or `Blocked`, complete or archive it,
finalize task-native ownership, or clean task-native resources from retained
folder-plan mode.

For persisted active version-1 ownership, keep both active plan files in
`.ralph/plans/` while work is blocked and throughout candidate review or
revision. If no implementation remains, ensure the finished behavior is
documented under `docs/`, leave the active pair in place, and report the
candidate for Conversation review. Do not archive or move either file until the
operator's terminal decision has been carried out and the exact ownership
record is inactive. For a blocker that a bounded attempt cannot clear, record
the exact blocker and unblock condition in the active execution plan, leave the
pair active, report the resumable checkpoint, and stop without a Backlog
lifecycle mutation.

With no ownership, preserve the old in-place folder workflow. It may archive
its finished specification and execution plan under `.ralph/plans/archive/`
and update that legacy archive index, or move only its blocked plan pair to
`.ralph/plans/blocked/`. Those legacy file transitions do not create Episode
identity or claim Backlog status, completion, archival, finalization, or cleanup
authority.

## One bounded implementation slice

Assuming work remains in either mode, choose one small elephant-carpaccio slice:
the smallest end-to-end change that produces observable value or decisive
evidence. It must fit within the current context window, including
implementation, tests, documentation, prompt native task publication, and one
single-purpose code commit pushed for review. Task-only commits remain separate
and happen whenever each coherent ticket update is ready. Size the slice to finish without
relying on auto-compaction. If it cannot reasonably finish within that boundary,
split it before starting. After pushing the slice, stop and report; do not begin
another slice. You may use as many subagents as useful within that one slice.

Implement only the requested behavior and genuine user constraints. Expert and
reviewer findings are evidence, not new scope; the Conversation decides repairs
against the actual task. Distinguish a material defect from mismatch with an
agent's proposed approach. Correct or narrow false claims, or remove unnecessary
mechanisms, when that meets the request instead of building claimed machinery.
Keep concrete supported-path, safety, security and interface fixes in scope.
Speculative hardening, theoretical edge cases and newly imagined invariants
are not blockers.

General execution standards:

- Evidence-backed decisions: every correctness, completion, or causality claim
  cites an artifact such as test output, a log, code diff, or design document.
- Hypothesis hygiene: check the active plan for rejected approaches before
  re-attempting them.
- Single objective: implement one primary slice, record results, and stop.
- Reproducibility: record inputs, commands, flags, and configuration needed to
  reproduce results.
- Highest leverage: choose the next action by expected impact or information
  gain.

Make a sincere but bounded attempt to clear in-scope implementation blockers.
Routine authorized techniques and removal of self-imposed constraints do not
need fresh approval merely because an earlier plan prescribed something else.
Reconsider an agent-created rule before layering safeguards around it. Ask for
an actual material user decision or access need, not to ratify routine technique
choices. Preserve genuine scope, safety and permission boundaries.
Missing authority, unobtainable credentials, physical interaction, unavailable
hardware or required external coordination can be actual blockers.
Status-only churn, refreshed timestamps, repeated
checks without new evidence, and unchanged handoff text are not progress.

Maintain good documentation quality under `docs/` and high test coverage for
all changed behavior. Update the active durable authority as work proceeds; do
not defer every task or plan update until the end.

That is the execute workflow. Complete exactly one task or plan slice, then
report and await further instructions. In task-native mode, complete the
phase-bounded goal at that report or an earlier wait boundary. Goal and
post-compaction reminders are advisory, not authority for another slice or an
extra acknowledgement turn.
