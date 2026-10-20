# Conversation-driven Episode oversight

Prime Claw uses the hierarchy **Universal → Project → Conversation → Episode**.
The Conversation supervises one implementation Episode. The Episode implements
an approved specification in its own worktree. Roles are responsibilities
expressed through normal skills and deterministic lifecycle state; prompt bytes
do not grant product authority.

## Authority boundary

The operator alone decides product direction, scope changes, merge,
abandonment, destructive cleanup, and any future remote transport. The
Conversation may review evidence, accept an in-scope candidate, record a bounded
revision, pause, or consult the operator. It does not implement Episode work.
A retained version-1 Episode implements only its promoted specification and
execution plan. A version-2 Episode implements only the exact provider-native
task selected by its owner record. Provider-absent or `provider: "backlog"`
retains the canonical ID, project-relative task path, and supported Backlog
contract. `provider: "beads"` instead has no task path and binds the canonical
ID, published provider revision, complete raw task evidence, code base, and
Episode identity. Persisted ownership decides the mode and provider before
prompt tags; no universal normalized task replaces either native contract. A
live version-1 Episode additionally requires readable, non-empty active
specification and implementation-plan files in its recorded worktree. With no
ownership, equivalent files on canonical main remain valid old in-place legacy
work but do not create Episode identity.

## Planning and implementation admission

### Primary task-native path

Use `/plan TASK-ID` or `plan_task({"taskId":"TASK-ID"})` to plan one exact
Backlog `In Design` or `In Planning` task. Planning remains Backlog-only. The
compact-first chain writes the native Implementation Plan, retains or publishes
`In Planning`, and stops for separate operator approval without creating
implementation resources.

After approval, use `/implement-task TASK-ID`. Before either workflow message,
it resolves one exact selected live provider and one exact ready local Orca
setup, or uses direct local fallback only when the production Orca command is
absent and no explicit setup was requested. Backlog keeps its ID/path and
structured task contract. Beads uses its exact canonical ID, raw native design
and task view, `in_planning` status, and project root without inventing a path or
normalized task. Cancellation, ambiguity, provider drift, zero ready setups,
remote selection, malformed or negative inventory, and other inventory failures
grant no approval and queue no workflow. Placement performs no task, Git,
ownership, or resource mutation.

After both messages are admitted, the ephemeral approval binds the owner
session, provider, canonical task ID and project root, exact placement, and a
task path only for Backlog. The first phase boundary exposes it to the semantic
turn; one exact consume removes it. A completed phase without creation, session
start, or shutdown clears it. The complete ordinary
`prime-claw-oversee-episode` guidance precedes provider-native semantic
readiness. `create_task_episode` then re-resolves provider evidence and consumes
this approval exactly once; callers cannot override its placement or resource
identity.

### Retained version-1 compatibility path

Use `/plan-spec .ralph/plans/future/<slug>` or model tool `plan_spec` only for
reviewed planning of an existing version-1 compatibility bundle. Both paths run
`plan-prep` first and queue `plan-spec` as the sole follow-up, preserving the
compact-first boundary.

Use `/implement-spec .ralph/plans/future/<slug>` to review that approved bundle.
An optional stable location bypass is:

```text
/implement-spec .ralph/plans/future/<slug> --host id:<project-host-setup-id>
```

`implement-prep` runs first and `implement-spec` is the sole queued follow-up.
The post-preparation message contains the complete ordinary
`prime-claw-oversee-episode` guidance before the semantic readiness workflow.
There is no guide activation, disclosure, hash, version, receipt, readiness
query, collision check, consumed state, or transcript redaction protocol.

A failed or interrupted pre-creation chain is rerun visibly. The retained
version-1 folder approval guard exists only to bind the current owner session,
selected folder, and optional setup ID across the two-turn compact-first chain.
It is not a second approval UX.

## One durable Conversation-keyed ownership registry

`.prime-claw/ownership.json` is the sole durable lifecycle registry. It is a
small human-readable object keyed by exact `ownerSessionId`; the former direct
record remains valid migration input and is converted on the next mutation:

```json
{
  "schemaVersion": 1,
  "owners": {
    "<ownerSessionId>": { "version": 2, "ownerSessionId": "<ownerSessionId>", "...": "..." }
  }
}
```

Each entry uses one of two strict, disjoint schemas:

- primary version 2 binds the owner Conversation and one provider-native task:
  provider-absent/Backlog retains canonical ID and project-relative path, while
  Beads retains canonical ID with no path plus published provider revision and
  complete raw task evidence; both retain project root, exact `baseRef`, and
  placement;
- retained version-1 compatibility binds the owner Conversation, approved
  future-folder location and slug, and a digest of the exact bundle bytes; and
- both bind the creation operation and engine, selected Orca setup and routing
  environment when applicable, exact worktree and branch identity, durable
  Episode session ID/file and refreshable route, terminal handles, and lifecycle
  status: `provisioning`, `active`, `uncertain`, or `inactive`.

Cardinality is one active Episode per Conversation, not one per repository.
Different Conversations can reserve and own independent Episodes concurrently.
Active task IDs/paths and retained source locations remain unique across all
entries. Owner-facing reads and updates select the exact `ownerSessionId`; only
binding-collision and worktree-activity checks inspect all entries. Registry
read-modify-write mutations use an inter-process lock plus atomic rename so a
concurrent reservation cannot overwrite another Conversation's entry.

Each strict entry persists lifecycle state plus durable owner, authority,
placement, and resource bindings. The registry is not an event journal and
stores no review, progress, merge, or abandonment receipts. Version 2 adds only
an optional `cleanupHead`, bound immediately before separately authorized
resource deletion so same-head cleanup can resume safely.

An entry is written before its external mutation and updated at genuine external
boundaries. Active and inactive entries retain exact bindings needed for restart
recovery and idempotent final bookkeeping. The former per-slug identity
directory and transcript oversight markers are retired.

For primary version-2 ownership, a short inter-process admission lock serializes
only the exact Backlog status edit, task-only commit, and durable reservation.
The reservation seam re-resolves the exact task, verifies the caller-supplied
admission commit and a clean task, then writes `provisioning` before releasing
the lock or starting push, branch, worktree, session, or assignment work. Its
allocator consumes only that reservation, creates the selected local or Orca
worktree from `baseRef`, skips bundle promotion, binds one durable exact-CWD
session, and sends one execute assignment carrying both the task ID and exact
owning Conversation registry key. The active execute policy treats that task as the sole durable
authority, permits only Episode-owned content edits through Backlog in the
Episode worktree, verifies status remains `In Progress`, and reserves every
lifecycle transition on main for the Conversation.

Retained version-1 compatibility ownership keeps its existing folder plan
workflow. Owned-resource recovery validates exact active resources before
reopening without reassigning. For version 2 this is an internal recovery seam:
public `/implement-task` and `create_task_episode` admission reject existing
non-terminal ownership, and the owner continues through the existing Episode's
lifecycle surfaces. Partial provisioning or allocation failure becomes
`uncertain` and cannot replay fresh. The trusted task-admission
transaction first proves it is at the repository root of the primary Git
worktree on `main`; linked worktrees and other branches fail before any task,
Git, ownership, or allocator mutation. It then commits the exact clean `In
Planning` task as `In Progress`, reserves from that exact SHA while holding the
short admission lock, releases the lock before best-effort push and allocation,
and verifies durable active identity. Proven-clean pre-ownership
failure commits the task back to `In Planning`; any recorded or uncertain
mutation commits `Blocked` with its exact recovery condition while retaining
evidence. Folder admission and close operations explicitly reject version 2;
task-native creation, handoff, lifecycle, and cleanup use their separate public
surfaces.

## Guarded version-1 to version-2 ownership bridge

A live retained Episode can become task-native without creating a second
Episode only through `transition_spec_episode_to_task`. This exceptional
cutover is not admission or ordinary handoff. It is available only after its
bridge candidate has been separately reviewed, merged to canonical primary
`main`, applied user-globally from that checkout, followed by a full Prime Agent
restart, and proven by UAT. The exact owner supplies the retained source,
canonical task ID, reviewed pushed Episode head, activated pushed main head, and
explicit readiness confirmation.

Before the one atomic ownership write, the host proves:

- the caller is the top-level owner Conversation in pushed primary `main`, where
  `HEAD` equals both upstream and reviewed evidence, no merge, rebase, cherry-pick,
  or revert is in progress, and no staged or tracked changes exist; unrelated
  untracked paths are allowed;
- active version-1 ownership matches the exact source, operation, Episode,
  worktree identity/path, branch, and optional Orca resources; the recorded
  runtime route must either remain exact or be absent while one sole idle
  durable session exposes a verified current replacement route;
- the exact `In Progress` task path and meaningful native plan are committed on
  main and byte-identical on the reviewed Episode head, and an exact task
  reference retains the superseded legacy source binding for replay proof;
- the task plan exactly equals the active execution plan, while the readable
  active specification and plan remain tracked at that head;
- the original task-only admission `baseRef`, historical recorded head,
  reviewed Episode head, and activated main head have safe ancestry; and
- the durable Episode session is unique, exact-CWD, and fully idle, with exact
  connected writable visible Orca terminal inventory when applicable.

The atomic replacement removes only `version`, `sourceLocation`, `slug`, and
`bundleDigest`; adds version 2 plus the canonical `taskId` and `taskPath`;
updates bookkeeping time; and preserves every common owner, operation,
`baseRef`, Episode, durable session ID/file, worktree, branch, recorded-head,
and Orca field. When a full restart replaced only the ephemeral runtime route,
the same atomic write binds that sole verified current route; it refuses the
refresh if the recorded route is still live, another durable match exists, or
any owner, CWD, branch, worktree, session-file, or resource evidence differs.
The tool creates no resource, assignment, task/status commit, merge, handoff,
finalization, deletion, or cleanup. Only an exact same-binding replay is
idempotent. Dirty, partial, foreign, divergent, unpushed, busy, missing, or
unverifiable state fails closed. The active pair remains until the later,
separately reviewed repository-local deletion.

## Retained version-1 compatibility Orca creation

For a ready local project-host setup, Episode creation is ordered as follows:

1. Enumerate exact ready local setups without querying unsupported remote
   environments. Select the only row, use the native picker for multiple local
   rows, or honor the exact `id:<setup-id>` bypass. Cancellation and
   noninteractive ambiguity create nothing.
2. Bind a deterministic recursive content digest at implementation admission,
   reject unsupported bundle entries, and persist provisioning ownership with
   that exact digest, setup, and base commit.
3. Create an Orca worktree with no agent, prompt, or `--activate`. Record Orca's
   returned path, stable identity, generated branch, and head.
4. Revalidate the approved source digest, overlay the exact bundle into active
   `.ralph/plans`, verify the copied and promoted bytes plus canonical source,
   and commit the promotion in the Episode worktree. Unrelated safe canonical-main
   advancement may proceed while the worktree remains bound to its captured base.
5. Create one disabled existing-workspace automation using provider
   `prime-agent`, `reuseSession: true`, and the fixed execute assignment. Run it
   manually.
6. Bind exactly one fresh durable Prime Agent root session at the exact
   worktree CWD and one connected, writable, visibly laid-out background tab.
   Require the rendered Prime Agent readiness footer rather than a generic TUI
   or terminal presence.
7. Remove the launch automation and prove that the same tab and pane remain
   visible, connected, writable, and provider-ready.
   Transition ownership to `active`.

The Episode inherits no Conversation transcript. Its fixed execute assignment
carries the exact owning Conversation registry key; the Episode uses that key,
not its own session ID, and verifies the persisted worktree/session binding. It
receives exactly one execute assignment after promotion. Creation sends no initial handoff and no
second daemon prompt. `pi` remains Orca's distinct TUI agent ID; the native
provider is `prime-agent`.

Remote placement is disabled. Current Orca interfaces do not transport an exact
approved local bundle into a remote checkout. Prompt text is not transport.
Prime Claw does not inventory remote setups; an explicit ID outside the ready
local rows fails before mutation and never falls back locally.

## Direct local fallback for both schemas

Direct local creation is permitted only when Orca is definitively unavailable
before external mutation. It creates a fresh Prime Agent session and admits the
same one fixed execute assignment. It does not fork Conversation history.

After any Orca worktree create, automation create/run, assignment, or removal
operation is admitted or has an ambiguous result, the lifecycle remains
Orca-owned. Prime Claw records `uncertain`, preserves resources, and refuses
creation replay or inferred assignment. It never creates a duplicate local fallback. The supported
v1 outcome is operator-guided manual reconciliation, not automatic state-machine
continuation.

Reconciliation uses zero-or-one exact matches in this order: selected setup plus
`worktreeName`; worktree ID plus the deterministic `launchAutomationName`
derived from `operationId`; automation ID plus run history; durable session
ID/file at the exact worktree CWD; and terminal handle plus visual layout.
Routine route refresh for an already `active` Episode remains automatic. An
uncertain record must not be edited back to active, nor may create, run, or prompt
be retried, until the operator has inspected the evidence and explicitly chosen
a bounded recovery or cleanup. A future continuation tool requires separate
scope and approval.

## Guide reinjection after compaction

Prime Agent saves the compaction and rebuilds session messages before awaiting
`session_compact`. For every actual compaction event, the handler reads the one
ownership record. Only the exact owner of an `active` Episode receives one full
`prime-claw-oversee-episode` custom message with `triggerTurn:false`.

Ordinary sessions, Episode sessions, foreign owners, inactive records, and
projects without ownership receive nothing. A later distinct compaction gets
one new message. No duplicate-event journal is needed because Prime Agent emits
one post hook for one saved compaction. The guide references
`goals-and-heartbeats`; that second full skill is not injected.

## Supervision and continuation

The Conversation selects the authority mode and provider from exact ownership
before it reviews a report. Version 1 retains its approved specification/plan
folder. Provider-absent/Backlog version 2 binds the exact task ID/path in main
and the Episode worktree and keeps its supported fields as the sole durable
contract. Beads version 2 has no task path: review binds the persisted raw task,
provider revision and publication ref, code base/head, and exact Episode
identity, then compares synchronized exact raw task reads from the correct
contexts. Unrelated-task revision descendants alone do not block. Compatible
same-task clarifications and living-plan changes require LLM judgment over exact
before/current fields; genuine semantic conflicts, authority changes, scope
expansion, and product decisions are escalated. Neither provider consults
`.ralph/plans` or becomes a normalized task model. The Conversation checks the
exact candidate, tree, diff, tests, documentation, durable authority, chronology,
and push state, then chooses one bounded disposition from the managed oversight
skill. Retained version-1 compatibility folder Episodes use
`handoff_spec_episode` for the exact idle owner record. Handoff resolves strict
source-location syntax and exact persisted ownership before consulting bundle
storage, so the obsolete promoted future folder may be absent after merge. The
exact owner, active root plan pair, worktree/branch/session/resource identity,
and idle state remain mandatory; missing or mismatched ownership never falls
through. The tool admits ordinary canonical handoff and queues canonical
execute as its sole follow-up. Admission is not completion and uncertain
transport is never retried blindly.

Provider-absent/Backlog version-2 blocker and resume publication are prompt-led Conversation work. After accepting an exact pushed blocker report, the Conversation runs supported `backlog task edit` on canonical main, verifies the bound ID/path and a one-path diff, commits only that task as `Blocked`, and pushes. After the operator accepts the unblock condition, it performs the same exact-task operation to restore `In Progress`, then uses `handoff_task_episode`. The dual-mode blocked skill still selects durable ownership before prompt text; active version-2 ownership forces task mode and never falls back to `.ralph/plans`.

A Beads report or EXPERT conclusion is evidence, not approval. One narrow
handoff path is active for unchanged-task continuation: `handoff_task_episode`
selects the exact owner first, preflights the same idle Episode/resources, and
uses the existing published-evidence advancement boundary with only the owner's
persisted raw evidence/revision and current clean pushed code head. An unrelated
published descendant may advance the receipt when the target raw view is
unchanged. A same-task raw mismatch returns exact review evidence and delivers
neither handoff nor execute; guidance never accepts the changed task or supplies
native authority. Newly reviewed same-task content acceptance remains deferred.
Blocked publication, status/terminal transitions, finalization, and cleanup
remain unavailable for Beads. At those boundaries the Conversation reports the
exact accepted evidence and stops; it does not route through Backlog-only
commands or write the ownership registry directly.

Persisted active version-1 ownership keeps its specification/plan pair active while blocked and throughout candidate review or revision. An older blocked snapshot with no active pair is not live: only after an explicit operator unblock decision may the blocked skill call `restore_blocked_spec_episode` for the exact owned future folder. The tool restores the exact readable pair without clobber or mode fallback and revalidates the same active identity. No-ownership old in-place blocking remains separate.

For provider-absent/Backlog ownership, `handoff_task_episode` proves canonical primary-main caller context, exact owner/task/path in main and the Episode worktree, committed `In Progress` status, meaningful plans, clean owned worktree, exact Git/Orca and durable-session CWD identity, and quiescence. The Beads branch proves canonical-primary Conversation context, exact active provider/task/operation/base/resource identity, meaningful persisted `in_progress` raw design, an idle/quiescent Episode, and a clean pushed current code head; then the accepted paired native evidence seam proves an unchanged target before its exact four-field receipt update. Both branches bind both prompts to the exact task and reuse the same resources. Neither performs status, review, or terminal work.

Provider-absent/Backlog candidate review is evidence-led. After accepting an exact pushed candidate with no fixes remaining, the Conversation uses the supported Backlog CLI on canonical main to set only the bound task to `Ready for Merge`, reloads its exact ID/path/parent/status, verifies a one-path diff, commits only that task path, pushes, and records `mainHead`. In the exact idle Episode worktree, it runs ordinary `git merge --no-edit mainHead`; if the task conflicts, it restores the pre-merge Episode task content and applies only the Conversation-authorized `Ready for Merge` status through Backlog, while Git blocks other conflicts. It completes the merge, pushes, and verifies the refreshed `candidateHead`, upstream, task identity/path/parent/status, and clean worktree. It then shows the operator `(taskId, mainHead, candidateHead)`. There is no custom Ready publisher, two-parent reconciliation transaction, content digest, progress receipt, or replay protocol.

Delay changes nothing. Request Changes requires an explicit operator decision and a concrete accepted in-scope finding. The Conversation uses Backlog on canonical main to return only the bound task to `In Progress`, verifies and commits only that path, and pushes. The same idle Episode then integrates current main with ordinary Git as needed, preserves Episode-owned task content while applying only the authorized `In Progress` status, pushes any refreshed candidate, and resumes through `handoff_task_episode`.

Immediately before Merge, the Conversation re-reads ownership and freshly preflights the exact `(taskId, mainHead, candidateHead)` shown to the operator: canonical main has no staged or tracked changes, is operation-free, equals upstream and `mainHead`, and holds the bound task as `Ready for Merge`; the exact idle Episode worktree is clean; branch, local head, and upstream all equal `candidateHead`; its task has the same bound identity/path/parent and `Ready for Merge` status; and the candidate descends `mainHead`. Only explicit operator authority for that tuple permits ordinary `git merge --ff-only candidateHead`. Git rejects drift. The Conversation then uses Backlog to set the exact task to `Done`, verifies a one-path diff, commits only that path, pushes, and rechecks main/upstream, ancestry, identity, parent, and status. A push failure is ordinary transport recovery, not lifecycle replay. Ownership and resources remain active.

Confirmed abandonment is also prompt-led. From clean pushed canonical main, after explicit operator confirmation, the Conversation selects only the bound task file from the exact pushed Episode head, reapplies the non-`Done` status and truthful Final Summary with Backlog, archives the task, verifies only the exact active/archive move and no Episode code, commits, and pushes. Git and Backlog report unsafe intermediate state directly. Ownership and resources remain active.

Cleanup alone remains a native destructive resource boundary. After the terminal main state is pushed and the operator separately authorizes Cleanup, `finalize_task_episode` receives the exact task, terminal Episode head, truthful merged/abandoned outcome, and confirmation. It durably records `cleanupHead`, verifies terminal main plus exact idle clean resources, removes runtime, worktree, and branch, verifies absence, and marks ownership inactive last. Same-head partial retry is idempotent. A different head, unpushed main, changed task/archive state, busy or foreign runtime, dirty or changed worktree, unsafe resource gap, provisioning, or uncertain ownership fails closed. The tool performs no review, task status edit, merge, abandonment, archive, or push.

Later routing refreshes `activeSessionId` from the durable Episode session
ID/file. Orca terminal handles are also refreshable. Durable session and
worktree identities remain authoritative across restarts. Expert review follows
the same disjoint authority selection. Backlog uses the exact bound task fields
at its candidate commit. Beads uses exact persisted/current raw task,
revision/ref, code base/head, and Episode identity evidence without normalizing
it. Retained version-1 compatibility uses its approved specification/plan
folder. It is a normal review of the approved contract, not adversarial red
teaming unless the operator explicitly requests it. Every material finding must
show evidence, realistic impact, violated approved behavior, and a proportionate
repair direction. Speculative hardening and reviewer-invented requirements are
non-blocking. Expert review, bounded goals, and one heartbeat while waiting
remain available; none becomes workspace scheduling or product authority.

## Task-native terminal outcomes and cleanup

Provider-absent/Backlog version-2 review, Blocked/Resume, Delay, Request Changes, Merge, and Abandonment are Conversation instructions implemented with ordinary Git and the supported Backlog CLI. The only native terminal tool is cleanup-only `finalize_task_episode`, because exact session/worktree/branch removal and ownership closure require a stable host boundary. Cleanup remains a separate explicit operator decision and closes ownership only after every bound resource is absent.

## Retained version-1 compatibility finalization

After the operator's terminal decision has been carried out and verified,
`finalize_spec_episode(location)` changes only the exact active version-1
ownership record to `inactive`. The active plan pair remains in place until that
close succeeds. The tool performs no Git operation, plan archival, merge,
abandonment, session stop, worktree removal, branch deletion, or cleanup. Any
legacy plan archival requires separate explicit post-terminal authority. This
repair adds no archival tool, so the plans remain until a later action is
approved. An identical close replay is idempotent. Owner, location, and
nonterminal-state mismatches fail closed.
