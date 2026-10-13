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
execution plan. A version-2 Episode implements only its exact Backlog task,
whose supported specification, plan, execution, and outcome fields replace the
folder authority without changing role authority.

## Planning and implementation admission

### Primary task-native path

Use `/plan TASK-ID` or `plan_task({"taskId":"TASK-ID"})` to plan one exact
`In Design` or `In Planning` task. The compact-first chain writes the native
Implementation Plan, retains or publishes `In Planning`, and stops for separate
operator approval without creating implementation resources.

After approval, use `/implement-task TASK-ID`. Before either workflow message,
it resolves the exact `In Planning` task and one exact ready local Orca setup,
or uses direct local fallback only when the production Orca command is absent
and no explicit setup was requested. Cancellation, ambiguity, zero ready setups,
remote selection, malformed or negative inventory, and other inventory failures
grant no approval and queue no workflow. Placement performs no task, Git,
ownership, or resource mutation.

After both messages are admitted, the ephemeral approval binds the owner
session, canonical task ID/path and project root, and exact placement. The first
phase boundary exposes it to the semantic turn; one exact consume removes it. A
completed phase without creation, session start, or shutdown clears it. The
complete ordinary `prime-claw-oversee-episode` guidance precedes task semantic
readiness. `create_task_episode` then consumes this approval exactly once;
callers cannot override its placement or resource identity.

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

## One durable ownership record

`.prime-claw/ownership.json` is the sole durable lifecycle record. Its two
schemas are strict and disjoint:

- primary version 2 binds the owner Conversation, canonical Backlog task ID and
  project-relative path, project root, exact task-only `In Progress` `baseRef`,
  placement, and task-native lifecycle receipts;
- retained version-1 compatibility binds the owner Conversation, approved
  future-folder location and slug, and a digest of the exact bundle bytes; and
- both bind the creation operation and engine, selected Orca setup and routing
  environment when applicable, exact worktree and branch identity, durable
  Episode session ID/file and refreshable route, terminal handles, and lifecycle
  status: `provisioning`, `active`, `uncertain`, or `inactive`.

The record is written before external mutation. It is updated at genuine
external boundaries, but it is not an event journal. Active and inactive state
retain exact bindings needed for restart recovery and idempotent final
bookkeeping. The former per-slug identity directory and transcript oversight
markers are retired.

For primary version-2 ownership, the task-native reservation seam re-resolves
the exact task, verifies the exact task-only `In Progress` status commit and a
clean task, then writes `provisioning` before any branch, worktree, session, or
assignment identity. Its allocator consumes only that reservation, creates the
selected local or Orca worktree from `baseRef`, skips bundle promotion, binds
one durable exact-CWD session, and sends one execute assignment carrying the
task ID. The active execute policy treats that task as the sole durable
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
Planning` task as `In Progress`, best-effort pushes, reserves and allocates from
that SHA, and verifies durable active identity. Proven-clean pre-ownership
failure commits the task back to `In Planning`; any recorded or uncertain
mutation commits `Blocked` with its exact recovery condition while retaining
evidence. Folder admission and close operations explicitly reject version 2;
task-native creation, handoff, lifecycle, and cleanup use their separate public
surfaces.

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
   verify the canonical checkout head did not change, and commit the promotion
   in the Episode worktree.
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

The Episode inherits no Conversation transcript. It receives exactly one fixed
execute assignment after promotion. Creation sends no initial handoff and no
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

The Conversation selects the authority mode from exact ownership before it
reviews a report. Version 1 retains its approved specification/plan folder.
Version 2 binds the exact Backlog task ID/path in main and the Episode worktree;
the task's supported fields are the sole durable contract, `.ralph/plans` is not
consulted, and the Conversation never copies or mirrors Episode-owned task
content. It checks the exact candidate, tree, diff, tests, documentation,
durable authority, chronology, and push state, then chooses one bounded
disposition from the managed oversight skill. Retained version-1 compatibility folder Episodes use
`handoff_spec_episode` for the exact idle owner record. The tool
admits ordinary canonical handoff and queues canonical execute as its sole
follow-up. Admission is not completion and uncertain transport is never
retried blindly.

Version-2 ownership exposes Conversation-owned blocker and resume actions through `finalize_task_episode`. `publishTaskEpisodeBlocked` and
`publishTaskEpisodeResumed` run only for the exact top-level owner in canonical
primary `main`, require active version-2 ownership and a clean owned worktree,
and bind the accepted report to the exact local and upstream Episode head. The
Episode task must remain `In Progress`, have a meaningful plan, and contain
committed post-admission task evidence. Main must expose the expected committed
status (`In Progress` before blocking, `Blocked` before resuming) with a clean
exact task path; unrelated main dirt is allowed. Each transition uses Backlog,
commits only that task path, and best-effort pushes. It never reads or copies
Episode-owned content into main. Local commit success remains authoritative and
a push failure is returned as evidence. The dual-mode blocked skill selects the durable ownership record before prompt
text: active version-2 ownership forces task mode for the exact owner
Conversation even without a task block, while an Episode or foreign owner fails
closed and can never enter folder fallback. A task block is only a candidate
binding that must match ownership. Task mode uses the accepted report and never
falls back to `.ralph/plans`; retained version-1 compatibility folder blocking and restoration remain
unchanged when no version-2 record or task block exists.

After resumed `In Progress` publication, `finalize_task_episode` invokes the same guarded task handoff transport for ordinary continuation.
Before delivery it proves canonical primary-main caller context, exact owner and
task/path in main and the Episode worktree, a main task path that matches
committed `HEAD` even when unrelated main paths are dirty, meaningful plans,
clean owned worktree, exact Git/Orca and durable-session CWD identity, and
quiescence. It binds both prompts to the exact task. It rejects `Blocked` until the
Conversation publishes a resumed `In Progress` state and always rejects `Ready
for Merge` because ordinary continuation ends at review.

The `finalize_task_episode` final-review handshake starts only from an accepted exact pushed candidate. `publishTaskEpisodeReadyForMerge` reuses the
exact owner/status guard and commits only main's task path as `Ready for Merge`;
push remains best-effort evidence after the authoritative local commit.
`integrateTaskEpisodeReadyForMerge` then proves the same durable Episode and
worktree are active, exact, clean, and idle, proves current main contains the
status commit, and accepts no merge conflict outside the bound task. Inside that
Episode worktree it restores the accepted task from the Episode parent, changes
only status through Backlog, and compares the supported task-view digest with
status/update time and derived cross-task projections excluded. Task content,
exact path, and parent identity must
remain unchanged. All current-main changes and this reconciliation become one
exact two-parent merge commit and the Episode branch is pushed.
`verifyTaskEpisodeReadyForMerge` finally requires current main not to have
advanced, the exact refreshed local/upstream head, clean worktree, both parents,
main ancestry, and the same task digest, hierarchy, and `Ready for Merge`
status. Only that verified refreshed candidate may be described to the operator
as ready or used to request the separate merge decision.

Two reversible operator outcomes are exposed through the same guarded `finalize_task_episode` boundary.
`delayTaskEpisodeReadyForMerge` re-verifies the exact current handshake and idle
Episode, then returns `delayed` without status mutation, merge, push, handoff, or
other transport. It does not mean abandonment. For an explicit Request Changes
decision, `publishTaskEpisodeChangesRequested` re-verifies the exact current
handshake and commits only the main task back to `In Progress`; main push is
best-effort evidence. `integrateTaskEpisodeChangesRequested` merges that current
main into the same idle Episode, restores all Episode-owned task content, applies
only `In Progress` through Backlog, and pushes another exact two-parent
candidate. `verifyTaskEpisodeChangesRequested` requires its main/head/ancestry,
task digest, hierarchy, and status to remain exact. Only
`resumeTaskEpisodeChangesRequested` then invokes canonical task handoff. These
phases preserve the successful status publication across a retryable integration
failure without a journal, duplicate status transition, new admission, or new
resource. An integration receipt carrying `pushError` is replayed through the
same integration helper so only its exact existing merge head is pushed again.
A handoff whose first message was admitted but whose follow-up is rejected is
reported as transport-uncertain and is never exposed as retryable.

The guarded terminal Merge action accepts only an explicit operator Merge
decision bound to the still-current exact task, canonical-main head, and pushed
refreshed candidate. It re-runs the review verification, requires the whole
canonical main checkout clean and its upstream exact, requires the candidate to
remain pushed with the reviewed two-parent ancestry, and performs only an exact
fast-forward. It never forces, rebases, or creates a substitute merge. A replay
accepts only the original verified main with `Ready for Merge`, the exact
candidate with `Ready for Merge`, that candidate plus only the exact dirty or
staged task already at `Done`, or one exact task-only `Done` child. It can finish
the one-path commit, verification, or transport without a second fast-forward
or lifecycle mutation and rejects every other intermediate state. Candidate
preflight also re-proves that the exact Ready publication commit remains in the
verified main history. After main reaches
the candidate, Backlog immediately changes only the exact task to `Done`; the
resulting one-path commit must directly parent the candidate and preserve the
supported content digest, path, parent identity, and merged code. A successful
local `Done` commit remains authoritative. Push failure, upstream lookup error,
or an observed remote mismatch is returned as best-effort transport evidence
rather than invalidating that local result. Final verification leaves active
ownership and the idle Episode branch, worktree, durable session, and resources
unchanged for a separately authorized finalization or cleanup decision. Public task-native admission, lifecycle, integration, handoff, merge, and cleanup are active through `/implement-task`, `create_task_episode`, `handoff_task_episode`, and `finalize_task_episode`.

Confirmed abandonment uses the separate guarded Abandon action of `finalize_task_episode`, never handoff. `abandonTaskEpisode` requires explicit operator authority bound
to the exact owner, active task path, main head and captured non-`Done` status,
Episode head, candidate/main relationship, invariant parent, Episode-content
digest, and truthful Final Summary. The idle Episode head must remain pushed.
Canonical main and its upstream must remain at the bound head. Before mutation,
the exact canonical archive destination is computed and rejected if it is
already tracked at the bound main head; a reused Backlog ID must never replace
historical archive bytes. A supported structured scan of active and completed
Backlog records also rejects any inbound dependency or exact task reference
whose archive cleanup would change a second task. Git selects only
the Episode task blob; Backlog reapplies the captured main status and Final
Summary, then archives that task without `Done`. Before commit, the effective
diff must contain only the task preparation and its exact active-to-archive
move, so no Episode code or unrelated path can enter main. The direct archival
child is verified and pushed best-effort. Retry accepts only exact selected-task,
archival-move/stage, or committed archival-child states. Backlog structured data
verifies identity, parent, status, and summary before archive; afterward a
normalized exact file digest and Git blob/move evidence verify unchanged content
without pretending archived tasks remain viewable. Path, ancestry relationship,
and ownership are also rechecked. An archival child with `pushError` can be
replayed only from its exact returned decision and terminal evidence; the
archive mutation is not prepared or repeated.
The branch, worktree, durable session, and every resource remain active; any
finalization or destructive cleanup needs separate operator authority.

The task-native Cleanup action accepts only a separate explicit
Cleanup decision that binds the exact task/path, owning Conversation, Episode
head/branch/worktree, durable session/route, and every optional local or Orca
resource recorded in ownership. The authorized terminal Episode head must
descend from the owned admission base; resource inspection binds that terminal
head rather than the allocation-time ownership head. Before deletion it
re-verifies either the pushed one-task `Done` child from Merge or the pushed
exact non-`Done` archival child from Abandon. Mixed outcomes, transport errors, changed task or archive
content, a busy runtime, dirty or foreign worktree, changed branch head, and
unsafe resource gaps reject without deletion. Authorized cleanup removes the
exact idle runtime first, then its worktree, then its branch. Each absence is
verified. A host cleanup that also removes the exact branch may advance that
monotonic sequence, but no out-of-order gap is accepted. Ownership remains
`active` across an interruption or uncertain removal and changes to `inactive`
only after every bound resource is proven absent. Local removal rechecks the
registered path, branch, terminal head, and cleanliness at the mutation edge.
Task-native Orca activation inventories every terminal retained in its newly
created worktree, including the default/fallback terminal and the primary Prime
terminal. Cleanup rejects any later unbound handle and uses one exact non-force
worktree removal so Orca itself must prove all bound terminals stopped before it
can retire the worktree; no tab-wide, workspace-wide, or forced terminal command
is used. The production-owned Prime daemon client is closed after each action.
Once all resources are absent,
retry and inactive replay do not require the deliberately deleted Episode ref;
the pushed terminal main evidence remains authoritative. Exact partial-prefix
retry and inactive replay are idempotent; provisioning and uncertain ownership cannot be
cleaned. `finalize_task_episode` invokes the production host adapter only for this separately confirmed action; all other lifecycle actions retain resources.

Later routing refreshes `activeSessionId` from the durable Episode session
ID/file. Orca terminal handles are also refreshable. Durable session and
worktree identities remain authoritative across restarts. Expert review follows
the same disjoint authority selection: an exact
task-native candidate uses only the bound task fields at its candidate commit,
while a retained version-1 compatibility candidate uses its approved
specification/plan folder. It is a
normal review of the approved contract, not adversarial red teaming unless the
operator explicitly requests it. Speculative hardening and reviewer-invented
requirements are non-blocking. Expert review, bounded goals, and one heartbeat
while waiting remain available; none becomes workspace scheduling or product
authority.

## Task-native terminal outcomes and cleanup

For primary version-2 ownership, `finalize_task_episode` is the guarded
Conversation coordinator. Its `accept-candidate` final-review action verifies an
exact pushed candidate and
refreshes it against current main before any operator outcome. Delay preserves
that state. Request Changes publishes only the task's `In Progress` transition,
refreshes the same Episode, and resumes through canonical task handoff. Merge or
abandonment occurs only after the matching explicit operator decision and exact
reverification.

Destructive cleanup is a separate explicit decision after verified terminal
work. It stops and removes only the recorded idle session, Orca terminals and
worktree, and branch through supported interfaces. Interrupted exact-prefix
cleanup is retryable; ownership remains active until every bound resource is
proven absent and closes last. No other action implies cleanup.

## Retained version-1 compatibility finalization

After the operator's terminal decision has been carried out and verified,
`finalize_spec_episode(location)` changes only the exact active version-1
ownership record to `inactive`. It performs no Git operation, merge,
abandonment, session stop, worktree removal, branch deletion, or cleanup. An
identical close replay is idempotent. Owner, location, and nonterminal-state
mismatches fail closed.
