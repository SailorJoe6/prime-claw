# Specification — Official lean compatibility cleanup

> **Status:** Future specification; awaiting operator review
>
> **Tracking:** `prime-claw-h6w.30`
>
> **Predecessor:** accepted official lean session-protocol cutover (`d2ee807ee2f0f066dac1a6b0f1d1c661f2fe1fd4`), terminal main `62ee095cc9cfc7e88a884edec03024edf87953f0`
>
> **Implementation authority:** none. Planning, episode creation, landing, restart, and terminal cleanup remain separately authorized.

## Summary

The official lean session protocol is active and accepted. One coordinated full Prime Agent restart completed, the owner conversation, exact transition episode, and an ordinary saved conversation all passed post-restart UAT, and the transition episode was finalized and physically cleaned. The runtime no longer reads, parses, validates, or injects the detailed project-local oversight package.

Three project resources remain only because they protected loaded old-generation sessions during the transition:

- `.ralph/skills/oversee-episode/SKILL.md`;
- `.agents/skills/oversee-episode`; and
- `.prime/agent/profiles/expert-reviewer.md`.

This work removes those resources only after a fresh current-use audit proves they have no independent live dependency. It updates current tests and documentation to describe the lean protocol as the official default while preserving deterministic identity/lifecycle mechanics, historical provider-message filtering, optional independent expert judgment, immutable evidence, and rollback safety.

The cleanup is a new product change. It requires its own reviewed plan, fresh episode, candidate review, landing decision, coordinated restart, resumed-session UAT, finalization, and explicitly authorized terminal resource cleanup. It does not reuse the finalized transition episode.

## Background and accepted evidence

The transition exists because Prime Agent converts unfiltered custom messages to provider-visible user messages. The former conversation-oversight path appended an approximately 11.5 KB `oversee-episode` package on provider calls, causing the model to perceive a procedure as fresh user input. The accepted generation replaced that behavior with one 246-word managed block in `src/prime-agent-plugin/APPEND_SYSTEM.md` and kept deterministic ownership, lifecycle, admission, and historical-message filtering in plugin code.

Cutover evidence established all required migration gates:

- accepted integration commit `d2ee807ee2f0f066dac1a6b0f1d1c661f2fe1fd4` is in `main` history;
- user-global apply/check passed from clean synchronized primary `main`;
- one full Prime Agent restart completed;
- owner, exact episode, and ordinary-session UAT passed;
- operator accepted the cutover;
- transition episode bookkeeping and physical resources were cleaned;
- tracking Bead `prime-claw-h6w.25` is closed; and
- final main checkpoint `62ee095cc9cfc7e88a884edec03024edf87953f0` changes no accepted plugin bytes.

The original loaded-generation failure remains the governing safety lesson: deleting the skill while an old loaded owner still reread it blocked that conversation immediately. Cleanup must not repeat that sequencing error.

## Current system

### Official runtime

The accepted runtime has these properties:

- the managed identity block in `APPEND_SYSTEM.md` is the sole always-on model-facing protocol for conversations and episodes;
- deterministic plugin code owns exact session identity, lifecycle classification, promotion, handoff admission, finalization, recovery, and fail-closed behavior;
- no current conversation-oversight plugin path reads or injects `.ralph/skills/oversee-episode/SKILL.md`;
- no current conversation-oversight plugin path loads `.prime/agent/profiles/expert-reviewer.md`;
- historical `prime-claw-oversee-episode-package` messages are still removed before provider dispatch;
- the retired detailed goal/heartbeat overlay is absent, with regression coverage proving it stays absent; and
- optional independent EXPERT judgment remains part of the lean protocol without requiring one fixed model or profile.

### Retained compatibility resources

The skill, discovery link, and reviewer profile remain discoverable in the primary checkout and in any worktree created from a commit that contains them. A saved or active session may therefore still have a prompt-time skill reference even though the official runtime does not invoke the old package path. Removing files beneath a loaded session can create a dangling reference until that session is safely restarted.

### Current and historical references

A preliminary audit finds current references across runtime migration filtering, provider-context tests, installer tests, skill/profile tests, current documentation, and the still-active predecessor specification/plan. It also finds references in archived plans, immutable evidence, and historical dogfood reports.

Those categories are not equivalent:

- **Current behavioral references** must be retained, migrated, or removed with replacement coverage.
- **Transition-only references** may be removed or updated after their subject is deleted.
- **Historical references** remain unchanged and do not fail the cleanup audit.

## Goals

1. Remove transition-only skill/profile resources after proving no current independent dependency.
2. Make current documentation and tests describe the accepted lean protocol as the official default.
3. Preserve deterministic episode mechanics and provider-context safety without creating a new detailed oversight prompt.
4. Preserve optional independent expert review without retaining a mandatory exact-model project profile.
5. Prevent dangling skill/profile references in loaded sessions and branch-local active worktrees.
6. Prove cleanup through isolated tests, independent review, one coordinated restart, and resumed-session UAT.
7. Preserve immutable transition history, audit evidence, rollback material, and Beads records.

## Non-goals

- Patching, forking, or contributing to Prime Agent.
- Redesigning the lean managed protocol or increasing its 250-word ceiling.
- Removing historical provider-message filtering.
- Removing deterministic identity, lifecycle, recovery, finalization, or handoff enforcement.
- Introducing a replacement always-on oversight package, mandatory expert model, or fixed heartbeat interval.
- Solving probable hung-tool detection (`prime-claw-h6w.29`).
- Changing the active Project-Wide Testing scope or foreign episode branches.
- Rewriting archived specifications, plans, evidence, reports, or Git history to look current.
- Deleting rollback bundles or accepted UAT/review receipts.
- Implementing an orchestrator.

## Required behavior

### CLC-001 — Fresh current-use audit

Before deletion, audit every nonhistorical reference to the three target resources and their identifiers. At minimum, inspect current source, scripts, tests, docs, `AGENTS.md`, active `.ralph/plans` files, `.ralph/skills`, `.agents/skills`, and `.prime/agent/profiles`.

Each hit must be classified as one of:

1. current required behavior;
2. transition-only compatibility;
3. current documentation or test debt;
4. historical migration/negative coverage; or
5. immutable archive/evidence.

Deletion is blocked if a target resource has an independent current use that is not addressed by this specification. Unknown or ambiguous provenance is a blocker, not permission to delete.

### CLC-002 — Exact compatibility-resource removal

When the audit passes, remove:

- `.ralph/skills/oversee-episode/SKILL.md`;
- the `.agents/skills/oversee-episode` discovery link; and
- `.prime/agent/profiles/expert-reviewer.md`.

The result must not leave a broken symlink, empty compatibility directory created solely for these files, duplicate replacement skill, or alternate copy under `.prime/agent/extensions/`.

### CLC-003 — No replacement detailed oversight package

Cleanup must not move the old procedure into another prompt, skill, profile, custom message, continuation injection, harness entry, or system-prompt overlay. The one lean managed identity block remains the sole always-on model-facing protocol for this capability.

### CLC-004 — Deterministic lifecycle behavior remains

Cleanup must preserve exact owner/episode identity, durable expected-state reconciliation, fail-closed corruption handling, promotion gates, canonical handoff admission, finalization, ordinary-conversation noninterference, and copied-history noninheritance. Missing, duplicate, corrupt, or disagreeing trusted identity remains a blocker.

No behavior may fall back to model imitation merely because the detailed skill is gone.

### CLC-005 — Historical provider-message filtering remains

`prime-claw-oversee-episode-package` and bounded historical package records must continue to be filtered at the actual provider-context seam. Saved conversations with historical records must resume without reintroducing provider-visible user-shaped oversight instructions.

Current constants, parser/filter behavior, and regression tests may be renamed or simplified only if equivalent replay evidence proves historical sessions stay clean. Zero current filesystem copies of the skill is not evidence that saved transcripts contain no legacy records.

### CLC-006 — Retired work-control overlay remains absent

The detailed `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` overlay and retired extension remain absent from effective system prompts and installed managed files. Keep the positive and negative provider controls needed to detect reintroduction. Do not delete a regression merely because its former source file is already gone.

### CLC-007 — Independent EXPERT judgment remains optional

The lean protocol may still call an independent read-only EXPERT when stronger review would help. Cleanup intentionally retires the project-local exact-model profile if the audit confirms it is used only by the old skill.

Do not introduce a replacement mandatory model, reasoning level, profile, or hidden fallback policy. A future owner may select an available stronger model through supported Prime Agent interfaces and provide a bounded exact-commit review packet. Lack of a particular model must not corrupt episode state or silently convert review into implementation authority.

### CLC-008 — Current tests follow behavior, not deleted files

Remove tests whose sole purpose is validating the deleted skill, link, or profile. Retain or migrate any unique behavioral assertion that still protects the lean protocol.

Current test coverage must continue to prove:

- one intact managed identity block;
- no new oversight package in provider-visible user text;
- no retired work-control policy in the effective system prompt;
- ordinary user content preservation;
- historical saved-session filtering and replay;
- exact owner/episode lifecycle behavior;
- no-skill startup and resume;
- installer convergence and stale retired-file handling; and
- safe failure for malformed destination types and state.

Source-string assertions are insufficient when a provider, lifecycle, installer, or filesystem behavior can be exercised directly.

### CLC-009 — Current documentation describes the official default

Update current normative documentation and indexes so they no longer instruct owners to load the deleted skill/profile or describe the lean protocol as a temporary POC. At minimum, audit:

- `docs/conversation-driven-episode-oversight.md`;
- `docs/goal-heartbeat-work-control.md`;
- `docs/lab-global-plugin.md`; and
- `docs/README.md`.

Current docs must explain the separation between lean model-facing policy and deterministic plugin mechanics, the retained historical-message filter, optional EXPERT judgment, goal/heartbeat lifecycle, restart discipline, and operator authority boundaries.

### CLC-010 — Historical evidence remains immutable

Do not rewrite archived specifications/plans, `docs/evidence`, historical dogfood reports, review reports, Beads chronology, or accepted commit history merely to remove old names. Historical references are allowed when their location and purpose are clearly historical.

When the cleanup planning workflow replaces the predecessor active plan/spec, preserve the predecessor documents intact in the project archive and update only current indexes/links needed to find them.

### CLC-011 — Active-session and worktree safety

Before landing any deletion into primary `main`, identify every live Prime Claw owner, episode, expert, delegated worker, and linked worktree that can still resolve the target resources.

- Active work must reach a durable safe checkpoint voluntarily.
- No session is automatically interrupted, killed, or deleted.
- No foreign episode branch is modified to force cleanup.
- No affected turn runs between primary-main deletion and the coordinated restart.
- A live episode worktree that still contains the resources is a landing blocker unless it has reached an operator-approved terminal state and is cleaned, or a reviewed alternative explicitly proves it cannot exercise stale compatibility behavior.

Project-Wide Testing is independent work. Its active episode must finish or otherwise satisfy this gate; cleanup may not expand or rewrite its scope.

### CLC-012 — Fresh episode and branch

Implementation uses a new future folder, new reviewed plan, fresh `/implement-spec` promotion, fresh isolated episode session, fresh branch, and fresh worktree. It must not reuse the finalized/deleted transition episode or its branch name.

The cleanup candidate is built and tested in isolation. Primary `main` retains compatibility resources until the operator separately authorizes landing.

### CLC-013 — Test and review gates

The exact cleanup candidate must pass:

- complete Tier 0;
- complete selected Tier 1 in Docker;
- focused no-skill, provider-context, installer, lifecycle, and replay coverage;
- `git diff --check`;
- current-reference and broken-link audits; and
- an independent read-only exact-candidate review.

Receipts must correlate exact commit/tree, dependency revision, commands, raw logs, hashes, counts, elapsed time, superseded failures, and teardown. Known unrelated failures are reproduced or tracked, never hidden through broad deselection.

The reviewer profile being removed cannot be the only durable justification for review quality. Preserve the review packet, reviewer identity/model/reasoning actually admitted, report, and disposition as evidence without creating a new permanent profile requirement.

### CLC-014 — Landing and activation are separate decisions

Candidate acceptance does not authorize landing. Landing requires an explicit operator decision after all live-session blockers are cleared.

Immediately before landing, primary `main` must be clean and synchronized with the verified expected parent. Land through a history-preserving topology selected by the reviewed plan. Do not rewrite accepted history.

If no managed plugin source or deployment script changes, do not perform a redundant user-global apply. The installed plugin check must still pass. Any discovered need to change managed plugin bytes is a material scope change that must be added to this specification and reviewed before implementation.

### CLC-015 — One coordinated full restart

After the cleanup lands and before any affected project turn resumes, perform one coordinated full Prime Agent restart. `/reload`, elapsed time, file deletion, or a fresh unrelated session is not sufficient proof.

The restart must be preceded by safe checkpoints and a verified rollback input. Do not start a second host Prime Agent instance or use session deletion as a migration shortcut.

### CLC-016 — Resumed-session UAT

Post-restart UAT must pass in three exact contexts:

1. the owning cleanup conversation;
2. the unchanged cleanup episode fixture; and
3. one operator-approved ordinary saved conversation.

UAT proves:

- no startup, missing-skill, missing-profile, package, ownership, or lifecycle error;
- exact owner/episode identity reconciliation;
- normal ordinary-conversation behavior without promotion;
- no fresh detailed oversight or retired work-control package;
- optional EXPERT judgment remains possible without the removed profile when invoked through supported interfaces; and
- current skill discovery contains no dangling `oversee-episode` entry.

The ordinary conversation completes a natural turn before and after restart. Do not use an active episode owner as the ordinary fixture.

### CLC-017 — History-preserving rollback

Before landing, record the exact cleanup candidate, main parent/topology, hashes of all removed resources, current installed plugin check, and retained evidence locations.

If restart or UAT fails:

1. stop cleanup acceptance;
2. restore the deleted resources through a normal history-preserving revert appropriate to the landed topology;
3. synchronize primary `main`;
4. verify the restored skill/link/profile hashes and installed plugin check;
5. perform the same coordinated restart discipline; and
6. verify recovery in the affected saved conversations.

Do not reconstruct the deleted resources from chat text or patch Prime Agent.

### CLC-018 — Terminal disposition and cleanup

Only after operator acceptance of post-restart UAT may the cleanup episode be finalized. Physical episode session/worktree/local-branch/remote-branch cleanup remains a separate explicit operator-authorized terminal action.

Retain merged history, Beads records, review/UAT receipts, the preactivation rollback bundle, and immutable predecessor evidence. Cleanup of those records is outside this specification.

## Acceptance criteria

The compatibility cleanup is accepted only when all of the following are true:

1. `prime-claw-h6w.30` links the reviewed specification, plan, exact candidate, test/review evidence, landing, restart/UAT result, and terminal decision.
2. A fresh current-use audit classifies every nonhistorical target reference and finds no unresolved independent dependency.
3. The skill, discovery link, and exact-model reviewer profile are absent with no broken or duplicate replacement path.
4. The managed lean protocol remains at or below 250 normalized words and is still the sole always-on model-facing protocol.
5. Deterministic ownership/lifecycle mechanics and historical provider-message filtering remain intact.
6. Provider evidence shows one managed identity block, zero fresh oversight package in provider-visible user text, and zero retired work-control overlay in the effective system prompt.
7. Current tests/docs no longer require the deleted resources or call the lean default temporary; immutable history remains unchanged.
8. Complete Tier 0, selected Tier 1, focused regression gates, and independent exact-candidate review pass with correlatable receipts.
9. No active foreign episode or linked worktree can exercise stale compatibility behavior at landing.
10. Primary `main` is clean and synchronized before and after the separately authorized landing.
11. Installed plugin check passes; no redundant global apply occurs unless a separately reviewed managed-byte change requires it.
12. One coordinated full restart completes with no affected turn in the deletion-to-restart window.
13. Exact owner, cleanup episode, and ordinary saved conversation UAT pass.
14. The operator explicitly accepts or rejects the cleanup cutover.
15. On acceptance, episode finalization and any physical terminal cleanup occur only with their required authority; on failure, the verified history-preserving rollback completes.

## Dependencies and sequencing

- The accepted lean transition and its terminal cleanup are complete.
- Project-Wide Testing may continue independently, but an active worktree retaining compatibility resources blocks cleanup landing.
- `prime-claw-h6w.29` is independent and receives no implementation authority from this specification.
- Prime Agent public interfaces are constraints, not an implementation target. Any unsupported capability is reported as a product constraint.

## Open decisions

No product decision is required to review this specification. The later execution plan must select exact slice boundaries, test commands, candidate topology, rollback commands, UAT fixtures, and terminal cleanup sequence without weakening these requirements.
