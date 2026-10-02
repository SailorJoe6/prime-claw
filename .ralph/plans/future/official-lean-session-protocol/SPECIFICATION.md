# Future Specification — Official lean session protocol

> **Status:** Draft for operator review
>
> **Scope:** Promote the dogfooded lean conversation/episode and goal/heartbeat
> protocol from a reversible POC to Prime Claw's supported default without
> breaking sessions that still run an older loaded plugin generation.
>
> **Tracking:** `prime-claw-h6w.25`

## Summary

Prime Claw currently has a successful lean-protocol POC from commit `00ad366`.
For several days of dogfooding, the operator found it decidedly better than the
prior design. The lean design puts one short protocol in the managed global
`APPEND_SYSTEM.md` block and stops injecting the full project-local
`oversee-episode` skill as a fresh user-shaped message on every provider call.
It also makes that same managed block the model-facing goal/heartbeat policy,
instead of adding a second detailed `before_agent_start` prompt.

This work makes that behavior official. It removes the retired runtime paths,
updates current documentation and tests, and preserves the exact lifecycle
mechanics that protect conversation and episode ownership.

The migration must be staged. A loaded old conversation-oversight extension
keeps its code in memory but rereads
`.ralph/skills/oversee-episode/SKILL.md` from the live project filesystem on
every turn. An attempted one-step cleanup deleted that file before the old
loaded generation had been replaced, immediately blocking existing sessions.
The repository was restored byte-for-byte to the known-good state and the
installed plugin again passed check. This specification treats that failure as
a binding compatibility requirement.

## Current system

### Dogfooded POC

The current merged POC has these properties:

- `src/prime-agent-plugin/APPEND_SYSTEM.md` contains a lean managed protocol for
  conversation, episode, expert, delegated-role, handoff, goal, and heartbeat
  behavior.
- The conversation context hook still validates exact lifecycle state and
  filters historical package messages.
- Active owner calls no longer receive a newly appended full oversight package.
- `goal-heartbeat-work-control.ts` remains installed but is intentionally inert.
- The old `oversee-episode` skill, its discovery link, supporting profile, parser,
  validation calls, installer preflight, tests, and documentation remain as
  rollback or POC scaffolding.

Container reconciliation commit `535f584` corrected three assertions that the
old host-skipped test path had hidden. Merge `1442abb` made the three-tier test
architecture available on `main`: plugin, Prime Agent, and installer tests now
run in an isolated ephemeral tier-1 Docker container rather than against the
host harness.

### Trusted lifecycle mechanics

The plugin records exact owner/episode identity separately from model-facing
policy. It validates the managed system block, durable episode expectation,
current owner session, branch, worktree, session file, future-folder location,
and bootstrap state. It restores a missing exact marker, rejects corrupt or
conflicting current-owner state, keeps positively identified foreign copied
state inert, gives an episode a bounded identity, supports owner-driven handoff,
and performs location-scoped idempotent bookkeeping close only after terminal
work.

Those mechanics are not POC scaffolding. They remain required.

## Problem

The repository presents the lean behavior as temporary while retaining large
pieces of the design it replaced:

1. New-generation runtime code still parses and requires the full oversight
   skill even though it no longer sends that skill to the model.
2. A separately installed goal/heartbeat extension exists only as an inert
   placeholder.
3. Installer manifests, checks, and tests still treat those retired resources as
   current production dependencies.
4. Current design documentation describes package injection and transient
   work-control behavior that no longer occurs.
5. Deleting compatibility resources in one step can break already-loaded old
   sessions before the new generation is active.

The official migration must remove the dead architecture without recreating the
live-session failure.

## Required end state

### One model-facing protocol

The managed Prime Claw block in `APPEND_SYSTEM.md` is the single model-facing
protocol for this capability. It remains concise and covers:

- independent top-level sessions as `CONVERSATION`s;
- reviewed `/design` or `/spec-it-out` → `/plan` → `/implement-spec` promotion;
- an owner conversation supervising, rather than implementing, its episode;
- one reviewable vertical episode slice at a time;
- accept, revise, pause, consult, and optional independent `EXPERT` judgment;
- canonical handoff, focused compaction, and the next `execute` pass;
- operator authority over product scope, merge, abandonment, and destructive
  cleanup; and
- goals for substantive active work, heartbeats for exact observable waits, no
  heartbeat while waiting on a person, and no retained work-control object after
  completion.

The normalized managed block must stay at or below 250 words. The plugin must not
add another detailed work-control or oversight prompt on provider calls.

### No current oversight-package dependency

After cutover, current runtime code must not read, parse, validate, or inject
`.ralph/skills/oversee-episode/SKILL.md`. Promotion, recovery, ordinary owner
turns, queued turns, tool continuations, heartbeats, agent messages, reload,
resume, and the first real post-compaction turn must work without that file.

The context hook must continue to strip historical
`prime-claw-oversee-episode-package` messages from resumed session history. This
is a migration filter, not a current package source. It must not reinterpret or
reinject their contents.

The bounded episode identity message remains permitted because it carries exact
mechanical identity, not an owner procedure.

### No separate work-control extension

The inert `goal-heartbeat-work-control.ts` entry point must not remain a current
managed plugin file. New installs and refreshed installs use the managed
`APPEND_SYSTEM.md` protocol. Apply must safely remove a stale formerly managed
copy, and check must reject one.

The retired goal-blocker tools and autonomous `/goal pause` or `/goal resume`
transport remain absent.

### Preserved authority and lifecycle boundaries

The migration must not weaken or broaden:

- the requirement for an explicit reviewed `/implement-spec` promotion;
- exact owner, episode, future-folder, session-file, branch, and worktree
  agreement;
- fail-closed behavior for corrupt, duplicate, orphaned, or disagreeing
  current-owner state;
- inert handling of positively identified foreign copied history;
- bounded `EPISODE`, `EXPERT`, and delegated roles;
- handoff admission and uncertainty boundaries;
- the distinction between model judgment and deterministic host mechanics;
- the operator's exclusive product, scope, merge, abandonment, and destructive
  cleanup authority; or
- the location-only, no-UI, idempotent nature of `finalize_spec_episode`.

No Prime Agent source change, fork, patch, or unsolicited upstream contribution
is in scope.

## Migration contract

The transition and cleanup are two independently reviewable and deployable
changes. Cleanup must not be merged merely because transition code exists.

### Stage 1 — Transition generation

The transition generation establishes the complete official runtime behavior:

- new plugin code has no current oversight-skill dependency;
- historical oversight-package messages are still filtered;
- the managed system block is the sole behavioral prompt;
- the inert goal/heartbeat extension is retired from the managed install set;
- apply/check know how to remove or reject the retired installed entry;
- current lifecycle mechanics and authority gates remain intact; and
- current normative documentation describes the lean default and the staged
  compatibility boundary.

For this stage, all filesystem resources that an already-loaded old generation
may read or expose must remain available in the canonical checkout. At minimum,
this includes `.ralph/skills/oversee-episode/SKILL.md`. Its discovery link and
supporting profile must also remain until an audit proves that loaded or
operator-invoked old behavior cannot require them. These files are explicitly
compatibility shims, not current policy sources.

Stage 1 must be safe to merge, apply, and run while old sessions are still
loaded. No Stage-1 edit may make an old loaded session fail before the restart.

### Cutover gate — one coordinated restart

After Stage 1 is merged and the global apply/check gate passes:

1. Active turns, subagents, tests, episodes, and background jobs become
   quiescent or reach a durable checkpoint.
2. The operator performs one full Prime Agent daemon/harness restart. `/reload`
   is not accepted as cutover evidence.
3. Saved conversations remain saved; they are not deleted merely to update the
   plugin generation.
4. Existing ordinary and episode-owning conversations are resumed and exercised
   through representative real turns.
5. Evidence confirms the refreshed global plugin generation is loaded, exact
   lifecycle behavior still works, no full oversight package reaches provider
   messages, and no current turn depends on the compatibility skill.
6. Any mismatch restores the compatibility resources and known-good plugin
   generation before further cleanup.

The operator explicitly accepts the cutover evidence before Stage 2 cleanup may
land. Time passing, a successful file copy, or a container-only result does not
substitute for this gate.

### Stage 2 — Post-cutover cleanup

Only after the accepted cutover gate may cleanup remove compatibility-only
resources. Before deletion, a current-reference audit must distinguish truly
retired resources from independently useful project policy. Historical archived
specifications, execution plans, dogfood reports, and immutable evidence retain
their original descriptions.

Expected cleanup candidates include:

- the project-local `oversee-episode` skill;
- its normal-discovery link;
- any reviewer profile used only by that retired skill;
- parser and package-validation tests that no longer describe runtime behavior;
- POC-only inert-extension tests; and
- current docs or test names that still call the lean default temporary.

If the reference audit finds a current independent use for a candidate, that
resource is retained or replaced by an explicit current contract rather than
silently deleted.

The execution plan must respect episode terminality. It must not assume that one
implementation episode continues after its branch has been merged. If the
cutover requires Stage 1 to merge before Stage 2 begins, Stage 2 must use a fresh
reviewed work item or episode.

## Testing and evidence

### Authoritative automated path

All maintained tests that execute Node, Prime Agent, plugin apply/check, or
native discovery run through the merged tier-1 Docker framework. They must not
run against or mutate the host harness. The container is ephemeral, the
repository mount is read-only, writable state is isolated, and teardown must
prove the owned container is gone.

The migration must pass:

- tier-0 static and pure tests;
- the complete tier-1 plugin container gate;
- installer migration tests for stale retired files, unsafe destination types,
  unrelated-file preservation, convergence, and check diagnostics;
- provider-facing coverage proving one managed system block and zero current
  full oversight packages;
- active-owner, recovery, bounded-episode, handoff, finalize, reload/resume, and
  post-compaction coverage without a project oversight skill; and
- `git diff --check` plus documentation/reference checks.

No passing host-skipped result may be used in place of the selected tier-1 gate.
Known unrelated failures must be reproduced independently or tracked; they must
not be hidden by broad deselection.

### Host installation evidence

After automated gates pass, Stage 1 apply/check refreshes the complete managed
global copy. A loaded process is still treated as old until the coordinated
restart gate succeeds. Tests must not launch a concurrent host Prime Agent
instance. The Docker gate is the native test boundary; host activity is limited
to the authorized global apply/check, restart, and visible cutover UAT.

## Documentation requirements

Current normative documentation must:

- describe the lean managed session protocol as the supported default;
- separate model-facing policy from deterministic lifecycle mechanics;
- document historical package filtering without calling the old skill current;
- document the staged compatibility, restart, verification, and cleanup gates;
- describe the seven-file managed plugin layout after transition;
- identify tier 1 as the authoritative plugin execution gate; and
- preserve links to historical dogfood and archived design artifacts as history,
  not current instructions.

At minimum, review and update the conversation oversight, goal/heartbeat,
lab-global plugin, documentation index, vision, and long-range-plan surfaces.
Archived plans and evidence remain immutable unless a broken link requires a
narrow correction.

## Rollback and safety

Before global apply or restart, record the exact source commit and installed
managed-file generation. The compatibility skill remains present through the
cutover gate. If the new generation blocks conversation, episode, handoff, or
work-control behavior:

1. stop cleanup;
2. restore the known-good managed plugin generation through normal apply/check;
3. retain or restore compatibility resources byte-for-byte;
4. perform the same coordinated restart discipline if runtime code changed; and
5. record the failure and resumable checkpoint on the tracking bead.

Do not patch Prime Agent, start a second host daemon, use `/reload` as proof,
blindly retry uncertain lifecycle operations, or delete saved sessions to force
migration.

## Acceptance criteria

The work is accepted only when all of the following are true:

1. The operator accepts Stage 1 and Stage 2 separately.
2. The lean managed block is the sole model-facing protocol and remains at or
   below 250 normalized words.
3. The official plugin performs no current read, parse, validation, or injection
   of the old oversight skill.
4. Historical full-package messages are filtered from provider context.
5. The separate goal/heartbeat extension is absent from the current managed set,
   removed safely by apply, and rejected by check when stale.
6. Exact lifecycle, bounded-role, handoff, authority, and finalize invariants
   remain covered and pass.
7. Stage 1 proves compatibility with still-loaded old sessions because all live
   compatibility resources remain present.
8. A full coordinated restart and representative resumed-session UAT prove the
   new generation before cleanup.
9. Stage 2 removes only resources proven compatibility-only; historical evidence
   remains intact.
10. Tier 0 and the complete selected tier-1 Docker gate pass, with no owned test
    container or scratch artifact left behind.
11. The global apply/check gate passes for the final managed generation.
12. Current docs describe the official lean design and migration outcome.
13. The tracking bead records commands, results, cutover evidence, cleanup
    disposition, and rollback checkpoint.
14. Each independently deployable change is committed and pushed, and `main`
    is clean and matches its remote after landing.

## Out of scope

- Changing Prime Agent source or public runtime behavior.
- Automating the universal-agent orchestrator.
- Expanding episode product scope or merge authority.
- Replacing the reviewed specification and planning gates.
- Redesigning the tier-1 container framework.
- Rewriting archived specifications, plans, or historical evidence to make them
  appear as though they described the new design.
- Deleting or recreating saved conversations as a migration shortcut.
