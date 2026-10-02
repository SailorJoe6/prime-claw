# Future Specification — Official lean session protocol

> **Status:** BLOCKED during OL-011 acceptance validation
>
> **Scope:** Promote the dogfooded lean conversation/episode and goal/heartbeat
> protocol from a reversible POC to Prime Claw's supported default without
> breaking sessions that still run an older loaded plugin generation.
>
> **Tracking:** `prime-claw-h6w.25`

## Current validation blocker

The accepted OL-011 test-only repair is implemented at `6322a18e1bb921478a7d9e7c67a8eff4088481a3`, but the
required complete Tier 0/Tier 1 sequencer cannot finish because the independently
tracked Darwin watchdog defect `prime-claw-zwg.5.1` failed Tier 0 on three bounded
exact-candidate attempts. Complete selected Tier 1 and all focused OL-011 tests
pass. This specification does not authorize folding that unrelated watchdog
repair into Slice 1, excluding it, or retrying indefinitely. Resume only after an
independent accepted fix is authorized for integration, or the operator explicitly
revises the gate contract. Full receipts and the resumable checkpoint are in the
blocked execution plan and `prime-claw-h6w.25`.

## Summary

Prime Claw's merged lean-protocol POC (`00ad366`) has been dogfooded for several
days and is decidedly better than the prior design. One short managed block in
`src/prime-agent-plugin/APPEND_SYSTEM.md` now carries the model-facing
conversation, episode, handoff, goal, and heartbeat policy. The plugin no longer
sends the full project-local `oversee-episode` skill as a fresh user-shaped
message on every provider call.

This work makes that behavior the supported default. It removes retired runtime
paths and POC scaffolding while preserving exact lifecycle mechanics and the
operator's authority boundaries.

The migration must be staged. A loaded old conversation-oversight extension
keeps its code in memory but rereads
`.ralph/skills/oversee-episode/SKILL.md` from the live project filesystem on
every turn. An attempted one-step cleanup deleted that file before the old
loaded generation had been replaced and immediately blocked existing sessions.
The repository and installed plugin were restored to the known-good generation.
No compatibility resource may be removed until a full runtime restart and
resumed-session evidence prove the new generation is active.

## Current system

The current POC has these properties:

- the lean managed `APPEND_SYSTEM.md` block is active;
- active owner calls do not receive a newly appended oversight package;
- exact lifecycle validation and historical-package filtering remain active;
- `goal-heartbeat-work-control.ts` is installed but intentionally inert; and
- the old skill, discovery link, reviewer profile, package parser, installer
  preflight, tests, and current documentation remain as POC or rollback
  scaffolding.

The merged three-tier test architecture (`1442abb`, reconciled by `535f584`) is
the authoritative execution boundary for plugin, Prime Agent, and installer
tests. Those tests run in an isolated ephemeral tier-1 Docker container rather
than against the host harness.

## Required end state

### One model-facing protocol

The managed Prime Claw `APPEND_SYSTEM.md` block is the sole model-facing protocol
for this capability. It remains at or below 250 normalized words and covers:

- independent top-level sessions as `CONVERSATION`s;
- reviewed `/design` or `/spec-it-out` → `/plan` → `/implement-spec` promotion;
- an owner conversation supervising rather than implementing its `EPISODE`;
- review of one vertical episode slice at a time;
- accept, revise, pause, consult, and optional independent `EXPERT` judgment;
- canonical handoff, focused compaction, and the next `execute` pass;
- operator authority over product scope, merge, abandonment, and destructive
  cleanup; and
- goals for substantive work, heartbeats for exact observable waits, no
  heartbeat while waiting on a person, and no retained work-control object after
  completion.

The plugin must not add another detailed oversight or work-control prompt on
provider calls.

### No current oversight-package dependency

The official runtime must not read, parse, validate, or inject
`.ralph/skills/oversee-episode/SKILL.md`. Promotion, recovery, owner turns,
queued turns, tool continuations, heartbeats, agent messages, reload, resume,
and the first real post-compaction turn must work without that file.

The context hook must continue to remove historical
`prime-claw-oversee-episode-package` messages from resumed provider context. The
legacy message type is a migration filter only. Bounded episode identity remains
permitted because it carries exact mechanical identity rather than an owner
procedure.

### No separate work-control extension

`goal-heartbeat-work-control.ts` must leave the current managed plugin set. New
and refreshed installs use the managed system block. Apply safely removes a
stale formerly managed copy; check rejects one. Retired goal-blocker tools and
autonomous `/goal pause` or `/goal resume` transport remain absent.

### Preserved lifecycle and authority boundaries

The migration must preserve:

- explicit reviewed `/implement-spec` promotion;
- exact owner, episode, future-folder, session-file, branch, and worktree
  agreement;
- fail-closed handling of corrupt, duplicate, orphaned, or disagreeing
  current-owner state;
- inert handling of positively identified foreign copied history;
- bounded `EPISODE`, `EXPERT`, and delegated roles;
- existing handoff admission and uncertainty boundaries;
- model judgment separated from deterministic host mechanics;
- operator-only product, scope, merge, abandonment, and destructive cleanup
  decisions; and
- location-only, no-UI, idempotent `finalize_spec_episode` bookkeeping after
  verified terminal work.

No Prime Agent source change, fork, patch, or unsolicited upstream contribution
is allowed.

## Compatibility and cutover requirements

The implementation must expose two separately reviewable checkpoints:

1. **Transition checkpoint.** The complete official runtime and installer
   behavior is testable and deployable, while every filesystem resource needed
   by an already-loaded old generation remains present in the canonical
   checkout and implementation worktree. At minimum this includes the old skill;
   its discovery link and supporting profile also remain until the reference
   audit proves they are compatibility-only.
2. **Cleanup checkpoint.** Compatibility-only resources are removed only after
   the transition generation is installed, one full Prime Agent daemon/harness
   restart occurs, the exact owner and episode plus one pre-identified saved
   ordinary project conversation resume successfully, and the operator accepts
   the cutover evidence.

`/reload`, elapsed time, file-copy success, or container evidence alone does not
satisfy the runtime cutover. Saved conversations are resumed, not deleted. A
failed cutover restores the known-good installed generation and compatibility
resources before any cleanup.

The execution plan must keep compatibility files isolated from premature main
checkout deletion, record exact rollback state, obey the one-host-daemon rule,
and respect episode terminality. It may use separately pushed commits within one
unmerged episode when that keeps the canonical checkout safe; it must not assume
an episode continues after merge.

The isolation-first installer guard now refuses user-global activation from a
linked episode worktree and permits it only from primary `main`. That conflicts
with the previously planned unmerged transition install/restart/cleanup topology.
Slice 1 remains independently reviewable, but no later deployment, early merge,
terminality change, or cleanup topology is authorized until the owner/operator
reviews a revised plan. The guard must not be bypassed to preserve the old plan.

## Cleanup boundary

After accepted cutover evidence, audit current nonhistorical references before
removing:

- the project-local `oversee-episode` skill and discovery link;
- a reviewer profile used only by that skill;
- package-parser and package-policy tests;
- POC-only inert-extension tests; and
- current documentation or names that still describe the lean default as
  temporary.

Retain or replace any resource with an independent current use. Archived
specifications, plans, reviews, dogfood reports, and immutable evidence keep
their original historical descriptions.

## Verification requirements

The migration must pass:

- tier-0 static and pure tests;
- the complete selected tier-1 Docker plugin gate;
- installer migration tests for stale retired files, unsafe destination types,
  unrelated-file preservation, convergence, and diagnostics;
- provider-context coverage at the actual post-conversion provider seam proving
  one managed system block, zero provider-visible user-shaped oversight
  packages, and zero retired work-control overlay in the effective system prompt;
  the shared capture/assertion helper and all six spies must inspect user messages
  and `systemPrompt` as separate channels;
- independent controlled failures: bypass the oversight filter to prove the
  user-shaped detector, and inject a historical-shaped
  `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` policy through a fixture-only
  `before_agent_start`/system-prompt seam to prove the system-overlay detector;
  the clean seven-file generation has neither leak, and removal of the retired
  injector—not a new runtime scrubber—is the product mechanism;
- lifecycle and replay coverage for active ownership, recovery, bounded episodes,
  handoff, finalization, reload/resume, first post-compaction turns, tool and
  heartbeat continuations, agent-message and queued turns, and ordinary-user
  preservation without the old skill; every provider row produced by saved-
  session recovery and legacy migration is asserted, not only initial/final rows; and
- `git diff --check` plus current-documentation and reference audits.

Known unrelated failures must be independently reproduced or tracked, never
hidden by broad deselection. The Slice 1 rejected-candidate revision runs complete
tier 0 and selected tier 1 only through the Docker-isolated boundary and retains
correlatable raw stdout, stderr, exit, tested-tree/dependency identity, superseded-
failure disposition, and teardown receipts. Later host activity remains limited
to the separately authorized global apply/check, coordinated restart, and
resumed-session UAT; tests must not launch a second host Prime Agent instance.

Current normative documentation must describe the lean default, separate
model-facing policy from lifecycle mechanics, identify historical package
filtering as compatibility behavior, document the staged cutover, and describe
the final seven-file managed plugin layout. Audit `VISION.md` and
`LONG_RANGE_PLAN.md`, but edit them only if their current architectural claims
would otherwise be false. Historical artifacts remain unchanged.

## Acceptance criteria

The work is accepted only when:

1. the transition and cleanup checkpoints receive separate owner/operator
   acceptance;
2. the managed block is the sole model-facing protocol and stays within 250
   normalized words;
3. current runtime code has no old-skill read, parse, validation, or injection;
4. historical full-package messages are still filtered;
5. the separate goal/heartbeat extension is absent from the managed set and
   safely removed/rejected by apply/check;
6. exact lifecycle, bounded-role, handoff, authority, and finalization invariants
   remain passing;
7. compatibility resources remain available throughout the old-generation
   window;
8. one full coordinated restart plus resumed owner, episode, and exact saved
   ordinary-session UAT proves the transition before cleanup;
9. cleanup removes only resources proven compatibility-only and preserves
   historical evidence;
10. tier 0 and the complete tier-1 Docker gate pass with no owned test container
    or scratch artifact left behind;
11. the final global apply/check gate passes;
12. current documentation describes the supported lean design;
13. `prime-claw-h6w.25` records commands, results, cutover evidence, cleanup,
    and rollback state; and
14. both checkpoints are clean commits pushed for review, with final `main`
    clean and synchronized after landing.

## Out of scope

- Prime Agent source or runtime changes.
- Universal-agent orchestrator automation.
- New episode product or merge authority.
- Changes to reviewed specification/planning gates.
- Redesign of the tier-1 container framework.
- Rewriting historical artifacts to look current.
- Deleting saved conversations as a migration shortcut.
