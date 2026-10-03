# Future Specification — Official lean session protocol

> **Status:** Active; exact Slice 1 transition accepted, transition-first landing plan pending owner review
>
> **Scope:** Promote the dogfooded lean conversation/episode and goal/heartbeat
> protocol from a reversible POC to Prime Claw's supported default without
> breaking sessions that still run an older loaded plugin generation.
>
> **Tracking:** `prime-claw-h6w.25`

## Accepted Slice 1 transition

The exact accepted Slice 1 candidate is
`615687aff1aa3549e986cc030073ee2539b836fe` (tree
`e23e1841fecadabf2f0d85269aeb4535ee2bb056`). It preserves the OL-011
provider-`systemPrompt` proof, OL-008 isolation, all lifecycle safeguards, and
the compatibility skill, discovery link, and reviewer profile. Its canonical
`scripts/test-all.sh` run passed Tier 0 (`284 passed, 155 skipped`) and complete
selected Tier 1 (`48 passed, 391 deselected`), with receipt
`.test-results/ol011-integrated-final/exact-candidate-pass.json` (SHA256
`971e66f69108c1b66b0213d8603faa608d2594028b90d92d204b9be152f65588`).

The owner accepted that exact commit after independent final review PASS. The
review report is
`/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/sub-283381d7/official-lean-slice1-final-review-615687a.md`
(SHA256
`9fe07a62f2d8c5fcb8b1bd9a2fb45903cd2ec54ab8d09c02b05872bea9ef78db`).
The accepted implementation commit is immutable. A later planning-only commit
may revise this specification and plan, but it must not change the accepted
runtime, installer, managed-system-block, test, compatibility-resource, or
normative-documentation bytes.

The operator approved a transition-first landing topology for planning. That
approval authorizes only a specification/plan checkpoint for review. It does not
authorize merge, host-global apply/check, restart, UAT, rollback, episode
finalization, compatibility cleanup, or creation of a future cleanup folder.

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

The transition and cleanup are now separate landings with separate reviewed
episodes:

1. **Accepted transition checkpoint.** The accepted seven-file transition is
   commit `615687aff1aa3549e986cc030073ee2539b836fe`. The first merge lands that
   transition, plus only reviewed planning state, onto synchronized primary
   `main`. The compatibility skill, discovery link, and reviewer profile remain
   present on both `main` and the episode worktree.
2. **Main-only activation and cutover checkpoint.** After the first merge,
   user-global apply/check runs only from a clean, synchronized primary `main`
   checkout. One coordinated full Prime Agent restart then resumes and verifies
   the exact owner conversation, this exact episode, and one pre-identified
   ordinary saved project conversation. The operator must accept that UAT before
   the transition episode is finalized.
3. **Future cleanup checkpoint.** Compatibility-resource removal and final
   documentation cleanup occur only in a separately reviewed future
   specification, episode, branch, and later second merge. No future cleanup
   folder is named or created until the operator selects it.

After the first merge, this episode's session, branch, and worktree remain
unchanged solely as the exact post-restart UAT fixture. They receive no further
implementation commit, planning commit, execute pass, or cleanup work. Merge is
therefore not treated as proof that the episode can continue producing changes.

`/reload`, elapsed time, file-copy success, a fresh probe, or container evidence
alone does not satisfy cutover. Saved conversations are resumed, not deleted.
Before activation, the landing record must identify the current known-good
installed generation, its exact hashes or check receipt, the first merge commit
and rollback parent, and the ordinary saved conversation selected for UAT.

A failed activation or UAT fails closed from primary `main`: retain every
compatibility resource, revert the exact first merge with a normal history-
preserving revert commit, synchronize `main`, re-apply and check the known-good
installed generation from that clean primary checkout, perform the same
coordinated restart discipline, and verify recovery. No cleanup starts while
rollback state is uncertain.

## Cleanup boundary

The transition episode does not remove compatibility resources. After accepted
restart UAT, its only remaining work is verified terminal bookkeeping and the
operator-approved session/worktree cleanup; its branch and worktree stay
unchanged after the first merge.

Only a later, separately approved future specification may audit and remove:

- the project-local `oversee-episode` skill and discovery link;
- a reviewer profile used only by that skill;
- package-parser and package-policy tests;
- POC-only inert-extension tests; and
- current documentation or names that still describe the lean default as
  temporary.

That future work must begin with a fresh nonhistorical reference audit, retain or
replace anything with an independent current use, pass its own review and test
gates, and land through a second merge. Archived specifications, plans, reviews,
dogfood reports, and immutable evidence keep their original historical
descriptions. This specification does not select or create the future folder.

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

The transition work is accepted only when:

1. exact Slice 1 candidate `615687aff1aa3549e986cc030073ee2539b836fe`
   remains unchanged and its accepted evidence remains durable;
2. the operator accepts the planning-only transition topology before landing;
3. the first merge lands the accepted transition on synchronized primary
   `main` while the compatibility skill, link, and profile remain present;
4. this exact episode session, branch, and worktree remain unchanged after that
   merge and are used only as the post-restart UAT fixture;
5. the ordinary saved conversation is identified and proves a normal turn before
   restart;
6. rollback identifies the exact first merge, rollback parent, known-good
   installed generation, and recovery verification before global mutation;
7. user-global apply/check passes only from clean synchronized primary `main`;
8. one coordinated full restart plus resumed owner, exact episode, and exact
   ordinary-session UAT proves the transition;
9. provider evidence still shows one lean managed block, no new oversight
   package, and no retired detailed work-control overlay;
10. lifecycle identity, authority, handoff, finalization, and goal/heartbeat
    behavior remain fail-closed;
11. failed cutover, if any, completes the specified history-preserving rollback
    from `main` with compatibility resources retained;
12. `prime-claw-h6w.25` records merge, activation, restart, UAT, rollback state,
    and the operator's cutover decision;
13. after accepted UAT, the transition episode is finalized and cleaned only as
    explicitly authorized, without further branch changes; and
14. primary `main` is clean and synchronized at every landing and terminal gate.

Compatibility-resource removal and final documentation cleanup are deliberately
not acceptance criteria for this transition episode. They require a separately
reviewed future specification and episode and a later second merge.

## Out of scope

- Prime Agent source or runtime changes.
- Any change to accepted Slice 1 implementation or evidence bytes.
- Host-global apply/check, merge, restart, UAT, rollback, or episode finalization
  during the planning-only revision pass.
- Compatibility-resource removal or final documentation cleanup in this
  transition episode.
- Naming or creating the future cleanup folder before operator selection.
- Universal-agent orchestrator automation.
- New episode product or merge authority.
- Changes to reviewed specification/planning gates.
- Redesign of the tier-1 container framework.
- Rewriting historical artifacts to look current.
- Deleting saved conversations as a migration shortcut.
