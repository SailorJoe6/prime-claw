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
The Episode implements only the promoted specification and execution plan.

## Planning and implementation admission

Use `/plan-spec .ralph/plans/future/<slug>` or model tool `plan_spec` for
reviewed planning. Both paths run `plan-prep` first and queue `plan-spec` as the
sole follow-up, preserving the compact-first boundary.

Use `/implement-spec .ralph/plans/future/<slug>` to review an approved bundle.
An optional stable location bypass is:

```text
/implement-spec .ralph/plans/future/<slug> --host id:<project-host-setup-id>
```

`implement-prep` runs first and `implement-spec` is the sole queued follow-up.
The post-preparation message contains the complete ordinary
`prime-claw-oversee-episode` guidance before the semantic readiness workflow.
There is no guide activation, disclosure, hash, version, receipt, readiness
query, collision check, consumed state, or transcript redaction protocol.

A failed or interrupted pre-creation chain is rerun visibly. The ephemeral
approval guard exists only to bind the current owner session, selected folder,
and optional setup ID across the two-turn compact-first chain. It is not a
second approval UX.

## One durable ownership record

`.prime-claw/ownership.json` is the sole durable lifecycle record. It binds:

- owner Conversation session ID, approved future-folder location, and an ordinary
  content digest binding the exact approved bundle bytes;
- one creation operation and lifecycle engine (`orca` or `local`);
- selected Orca project-host setup and routing environment when applicable;
- exact worktree ID, stable worktree identity, path, actual branch, and
  promotion head;
- durable Episode session ID/file, refreshable active route, and visible
  terminal handle; and
- lifecycle status: `provisioning`, `active`, `uncertain`, or `inactive`.

The record is written before external mutation. It is updated at genuine
external boundaries, but it is not an event journal. Active and inactive state
retain exact bindings needed for restart recovery and idempotent final
bookkeeping. The former per-slug identity directory and transcript oversight
markers are retired.

## Preferred Orca creation

For a ready local project-host setup, Episode creation is ordered as follows:

1. Enumerate exact ready setups. Select the only row, use the native picker for
   multiple rows, or honor the exact `id:<setup-id>` bypass. Cancellation and
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
approved local bundle into a remote checkout. Prompt text is not transport. A
selected remote row fails before mutation and never falls back locally.

## Direct local fallback

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

The Conversation checks the Episode's exact candidate, tree, diff, tests,
documentation, plan, Bead chronology, and push state. It then chooses one
bounded disposition from the managed oversight skill. Accepted advancement or
an accepted in-scope revision uses `handoff_spec_episode` for the exact idle
owner record. The tool admits ordinary canonical handoff and queues canonical
execute as its sole follow-up. Admission is not completion and uncertain
transport is never retried blindly.

Later routing refreshes `activeSessionId` from the durable Episode session
ID/file. Orca terminal handles are also refreshable. Durable session and
worktree identities remain authoritative across restarts. Expert review,
bounded goals, and one heartbeat while waiting remain available; none becomes
workspace scheduling or product authority.

## Final bookkeeping

After the operator's terminal decision has been carried out and verified,
`finalize_spec_episode(location)` changes only the exact active ownership record
to `inactive`. It performs no Git operation, merge, abandonment, session stop,
worktree removal, branch deletion, or cleanup. An identical close replay is
idempotent. Owner, location, and nonterminal-state mismatches fail closed.
