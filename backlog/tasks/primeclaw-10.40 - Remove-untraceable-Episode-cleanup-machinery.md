---
id: PRIMECLAW-10.40
title: Make task-native Episode cleanup complete and owner-safe
status: In Planning
assignee: []
created_date: '2026-10-20 04:32'
updated_date: '2026-10-20 15:00'
labels: []
dependencies: []
references:
  - PRIMECLAW-10.38
documentation:
  - docs/user-stories/I-episode-finalization.md
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome

Keep `finalize_task_episode` as the version-2 task-native cleanup boundary, but make it complete, owner-safe, and direct. After an operator-authorized merge or abandonment is committed and pushed and the owning Conversation verifies the terminal result, cleanup continues automatically without a second cleanup confirmation.

Cleanup removes all and only the resources created for that exact owned Episode. It must not alter another Conversation, another Episode, or any unrelated session or Git resource.

## Exact owned resources

The cleanup boundary contains:

- the exact Prime Agent Episode session recorded when the owning Conversation created it;
- every recursive child session connected to that Episode by a clear Prime Agent parent-child chain, where each edge is explicit through either `parentSessionId` or the canonical parent session-file path;
- the exact provider-managed worktree;
- the exact local Episode branch and its exact upstream remote branch; and
- that Conversation's exact ownership-registry entry.

A shared worktree is not session ownership. Do not search for, infer, or delete possible sibling sessions. Sessions outside the explicit descendant tree are out of scope.

## Required behavior

- Merge readiness must establish that the Episode and its proven descendants have completed their work and are idle. Cleanup rechecks this. If any owned session is active, cleanup performs no destructive mutation and reports that the Episode has not completed its work.
- Verify the truthful terminal merge or abandonment state, the exact terminal Episode head, and a clean exact worktree before deleting resources.
- Remove the explicit owned session tree through supported Prime Agent operations.
- Remove the worktree through the owning provider's supported operation. For Orca, use its supported force option after the exact worktree is proven clean so initialized submodules do not block cleanup.
- Delete both the exact local branch and its exact upstream remote branch only while they still identify the terminal Episode head.
- Delete the exact ownership entry only after every owned runtime and Git resource is absent. Do not retain an inactive record or tombstone.
- If cleanup is interrupted or a provider operation fails, re-read the ordinary ownership record and actual Prime Agent, provider, and Git state, then keep making safe progress. Already absent exact resources count as cleaned. Retry recoverable operations and ask the operator for help only when safe autonomous progress is no longer possible.
- Do not persist `cleanupHead`, a cleanup stage, or another cleanup-progress marker. Do not replace them with a receipt, registry, replay engine, coordinator, or background reconciliation protocol.

## Scope and non-goals

This task changes only version-2 task-native cleanup. It does not change version-1 `finalize_spec_episode` behavior. Unifying the duplicated legacy `*spec*` and task-native `*task*` command surfaces is separate future work. Prime Agent remains an upstream dependency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After an operator-authorized merge or abandonment is committed and pushed and its terminal result is verified, task-native Episode cleanup runs without requiring a second cleanup confirmation.
- [ ] #2 Before destructive cleanup, the exact root Episode and every explicitly related descendant are idle. Any active owned session causes zero destructive mutation and a clear report that the Episode has not completed its work.
- [ ] #3 Cleanup recursively selects only sessions connected to the exact Episode by explicit Prime Agent parent ID or canonical parent session-file path edges; shared-worktree sessions, possible siblings, and unrelated sessions are never selected.
- [ ] #4 Cleanup removes the exact owned session tree, provider worktree, local branch, exact upstream remote branch, and ownership entry. Initialized submodules do not block removal of a proven-clean Orca worktree, and unrelated ownership records and resources remain unchanged.
- [ ] #5 Terminal outcome, exact terminal head, clean worktree, branch identity, and remote identity are verified before deletion; dirty, changed, ambiguous, foreign, or mismatched evidence blocks unsafe mutation.
- [ ] #6 After partial or transient failure, cleanup re-reads ordinary ownership plus actual Prime Agent, provider, and Git state and continues safe remaining work. It stores no `cleanupHead`, cleanup stage, tombstone, receipt, or background reconciliation state and asks for help only when safe autonomous progress is impossible.
- [ ] #7 Focused tests and living finalization documentation prove the direct version-2 behavior while version-1 `finalize_spec_episode` remains unchanged; command-surface unification remains out of scope.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Remove cleanup-only state while preserving upgrade safety.** In `episode-ownership.ts` and the cleanup types in `spec-episode.ts`, stop emitting or depending on `cleanupHead`, inactive task-cleanup records, numeric cleanup stages, and replay-result fields. Accept and discard a legacy `cleanupHead` only as bounded read compatibility so an existing registry cannot make unrelated owners unreadable. Add an atomic exact-owner removal operation that deletes only the calling Conversation's unchanged version-2 record after all resources are verified absent; keep version-1 parsing and `finalize_spec_episode` behavior unchanged.

2. **Drive finalization from the current resource state.** Refactor `finalizeTaskEpisodeCleanup` to keep the existing exact owner/task, canonical-main, terminal outcome, pushed-head, ancestry/archive, cleanliness, and foreign/mismatch guards, but replace `taskCleanupStage` and cleanup-head binding with direct inspect → remove → re-inspect steps. Treat already absent exact resources as completed partial cleanup, remove only resources still proven to match, preserve ownership on every failure, and delete the ownership entry last. Return a result that reports ownership removal rather than inactive/tombstone reuse. Use precise errors so the Conversation can retry a recoverable provider failure without asking, while busy, dirty, changed, ambiguous, or unavailable evidence remains a real blocker.

3. **Make the host adapter match the exact ownership boundary.** In `task-episode-cleanup.ts`, build the recursive session tree only from the recorded root and explicit Prime Agent parent edges: accept an exact `parentSessionId` or canonical `parentSessionPath`, require both to agree when both are present, and never infer or delete siblings from a shared worktree. Revalidate the complete tree before mutation and each selected session before deleting descendants deepest-first and then the root. If any selected root or descendant is working, streaming, compacting, running tools/commands/children, scheduled, attached, or otherwise non-idle, perform no destructive operation and report that the Episode has not completed its work. Preserve collision checks needed to avoid disrupting an unrelated session, without claiming that session as owned.

4. **Complete provider and Git cleanup.** Extend inspection/removal to cover the exact configured upstream remote branch as well as the local branch. Verify local and remote refs still identify the supplied terminal head; delete the remote ref before the local ref so a failed remote operation remains retryable from normal Git configuration, and verify absence after each operation. Keep local-worktree cleanup exact and clean. For an Orca-owned worktree, retain the ID/identity/path/branch/head/setup and terminal checks, then use `orca worktree rm --force` only after those checks so initialized submodules cannot block removal. Re-inspection must allow any safely completed prefix of session, worktree, remote-branch, and local-branch removal without a persisted cleanup stage.

5. **Align the public lifecycle with the approved authority model.** In `reviewed-plan.ts`, remove the `confirmed` parameter and separate-cleanup-confirmation gate from `finalize_task_episode`; keep task ID, terminal Episode head, and truthful `merged`/`abandoned` outcome. Update the managed `prime-claw-oversee-episode` skill so merge readiness verifies the owned tree is idle, a verified pushed merge or abandonment immediately proceeds to cleanup, safe recoverable failures are retried from observed state, and operator help is requested only for a true safety/provider blocker. Do not change any `*spec*` command or version-1 finalization surface.

6. **Replace machinery-shaped tests with contract tests.** Update `tests/spec_episode_extension.test.mjs` and `tests/reviewed_plan_extension.test.mjs` to prove: no second confirmation or `cleanupHead`; exact owner-entry deletion with foreign owners unchanged; direct resumption from each partially absent resource state; zero mutations when any owned session is active; mixed ID-only, path-only, and nested lineage; inconsistent dual-parent evidence and duplicate identity refusal; siblings/shared-worktree sessions are never selected; deepest-first supported session deletion; proven-clean Orca force removal; and exact remote-then-local branch deletion with mismatch and transport-failure refusal. Update the focused Python/static tests for the tool schema, ownership shape, managed skill, and docs, and retain explicit regression coverage for `finalize_spec_episode`.

7. **Update current lifecycle documentation and validate the candidate.** Rewrite the task-native cleanup contract in the living overview/finalization/oversight/traceability docs (`VISION.md`, `LONG_RANGE_PLAN.md`, `docs/backlog.md`, `docs/future-specification-bundles.md`, `docs/handoff-chain.md`, `docs/conversation-driven-episode-oversight.md`, and relevant `docs/user-stories/*`) so they describe terminal authorization followed by automatic exact cleanup, recursive explicit lineage, active-session refusal, local and remote branch removal, owner-entry deletion, and actual-state retry. Leave historical evidence files unchanged and record command-surface unification as out of scope. Run the focused Node and Python tests, then the required Docker-only Tier 1 plugin validation (`scripts/test-tier1.sh --probe` or the equivalent container-marked suite), and verify the candidate diff contains no version-1 behavior change.
<!-- SECTION:PLAN:END -->
