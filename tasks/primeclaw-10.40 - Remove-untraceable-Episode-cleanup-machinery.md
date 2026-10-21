---
id: PRIMECLAW-10.40
title: Make task-native Episode cleanup complete and owner-safe
status: Ready for Merge
assignee: []
created_date: '2026-10-20 04:32'
updated_date: '2026-10-21 19:58'
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

## Least-tech implementation boundary

Add deterministic code only where exact identity, atomic ownership removal, or provider/Git transport and verification require it. The Conversation remains responsible for semantic lifecycle judgment: deciding that the authorized terminal outcome is complete, interpreting ordinary provider errors, deciding whether observed state permits another call, and asking the operator only when safe progress is impossible.

`finalize_task_episode` may inspect and remove exact resources in dependency order, but it must not become a lifecycle coordinator. Do not add an event hook, background worker, retry loop, error-classification framework, task reconciliation, iterative plan-change engine, session registry, or a second model of Prime Agent lifecycle state. Use provider-native state and operations directly. A provider failure returns its bounded evidence; the Conversation may re-read actual state and invoke the tool again.

## Scope and non-goals

This task changes only version-2 task-native cleanup. It does not change version-1 `finalize_spec_episode` behavior. Unifying the duplicated legacy `*spec*` and task-native `*task*` command surfaces is separate future work. Prime Agent remains an upstream dependency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After an operator-authorized merge or abandonment is committed and pushed and its terminal result is verified, the owning Conversation immediately invokes task-native Episode cleanup without a second cleanup confirmation; no event hook or background automation is introduced.
- [ ] #2 Before destructive cleanup, the exact root Episode and every explicitly related descendant are idle. Any active owned session causes zero destructive mutation and a clear report that the Episode has not completed its work.
- [ ] #3 Cleanup recursively selects only sessions connected to the exact Episode by explicit Prime Agent parent ID or canonical parent session-file path edges; shared-worktree sessions, possible siblings, and unrelated sessions are never selected.
- [ ] #4 Cleanup removes the exact owned session tree, provider worktree, local branch, exact upstream remote branch, and ownership entry. Initialized submodules do not block removal of a proven-clean Orca worktree, and unrelated ownership records and resources remain unchanged.
- [ ] #5 Terminal outcome, exact terminal head, clean worktree, branch identity, and remote identity are verified before deletion; dirty, changed, ambiguous, foreign, or mismatched evidence blocks unsafe mutation.
- [ ] #6 After partial or transient failure, each invocation re-reads ordinary ownership plus actual Prime Agent, provider, and Git state: an absent exact resource is complete, an exact present resource is removable, and changed or ambiguous state blocks. The tool stores no `cleanupHead`, stage, tombstone, receipt, retry registry, error taxonomy, or background reconciliation state; the Conversation decides whether to invoke it again and asks for help only when safe progress is impossible.
- [ ] #7 Focused tests and living finalization documentation prove the direct version-2 behavior while version-1 `finalize_spec_episode` remains unchanged; command-surface unification remains out of scope.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
**Implementation boundary:** Add deterministic TypeScript only for exact identity checks, atomic owner-entry removal, and supported Prime Agent, provider, and Git transport. Keep terminal-readiness judgment, provider-error interpretation, retry decisions, escalation, and ordinary Git/Backlog lifecycle work in the Conversation skill. Do not add a merge-readiness tool, event hook, background worker, retry loop, error classifier, task reconciler, iterative plan engine, session registry, lifecycle coordinator, or new persistent state.

1. **Remove cleanup-only state with bounded read compatibility.** In `episode-ownership.ts` and the cleanup types in `spec-episode.ts`, stop emitting or depending on `cleanupHead`, inactive version-2 cleanup records, numeric cleanup stages, and replay-result fields. At the existing parser boundary only, tolerate and discard a legacy `cleanupHead` so one old record cannot make a multi-owner registry unreadable; do not add a migration workflow or rewrite unrelated owners. Add one atomic compare-and-remove ownership operation that deletes only the calling Conversation's unchanged version-2 entry after every exact resource is absent. Leave version-1 parsing and `finalize_spec_episode` unchanged.

2. **Use one direct actual-state cleanup path.** Keep the existing exact owner/task, canonical-main, terminal outcome, pushed-head, ancestry/archive, and cleanliness checks in `finalizeTaskEpisodeCleanup`. Replace `taskCleanupStage` and cleanup-head binding with the same rule for every resource: absent is complete, exact present is removable, and changed or ambiguous state blocks. Inspect before mutation, perform the next dependency-ordered supported removal, and verify its result. Preserve the ownership entry whenever an operation fails; delete it last. The tool does not retry provider errors internally. It returns a precise bounded error so the Conversation can inspect current state and decide whether another invocation is safe.

3. **Select only the provider-proven session tree.** In `task-episode-cleanup.ts`, start from the exact recorded root and recursively follow Prime Agent's existing `parentSessionId` or canonical `parentSessionPath`; when both are present, require agreement. Do not infer ownership from CWD, worktree sharing, `rlmDepth`, `rlmChildId`, runtime kind, or a possible sibling relationship. Use Prime Agent's current list/state response directly to require every selected session to be idle; do not persist or implement another lifecycle model, wait for quiescence, or force-stop working sessions. If activity is reported or idle cannot be proved, mutate nothing and report that the Episode has not completed. Delete proven descendants deepest-first and then the root, revalidating the selected identity before each provider-native deletion. If an unrelated listed session uses the worktree, refuse worktree deletion without selecting, recursively inspecting, stopping, or deleting that session.

4. **Finish exact provider and branch transport.** Preserve the existing worktree identity, head, terminal, and cleanliness checks. For Orca, call its supported `worktree rm --force` only after those checks so initialized submodules do not block the provider-native removal. Derive the Episode branch's upstream remote and ref from ordinary Git configuration on each invocation; persist no remote metadata. Verify both refs still identify the supplied terminal head, delete the remote ref first, verify it is absent, then delete the local ref and verify it is absent. If either ref is already absent, treat only that exact resource as complete; a present mismatch blocks.

5. **Keep automatic cleanup prompt-led.** In `reviewed-plan.ts`, remove the `confirmed` parameter and separate cleanup-confirmation gate from `finalize_task_episode`; retain only task ID, terminal Episode head, and truthful `merged`/`abandoned` outcome. Update `prime-claw-oversee-episode` so the Conversation checks provider-reported idle state before merge readiness, invokes cleanup immediately after the authorized terminal result is committed and pushed, interprets any returned provider error, and invokes the same tool again only when current evidence makes that safe. Do not implement this behavior with a hook, watcher, coordinator, or coded retry policy. Do not change any `*spec*` command or version-1 surface.

6. **Test the contract rather than the removed machinery.** Use small focused fixtures in `tests/spec_episode_extension.test.mjs` and `tests/reviewed_plan_extension.test.mjs` to cover the direct success and refusal paths: the public schema has no second confirmation; owner deletion leaves foreign records unchanged; already absent exact resources permit continuation without a stage; active or unprovable-idle owned sessions cause zero mutations; ID-only, path-only, and nested explicit lineage works while contradictory edges and possible siblings are never selected; Orca receives `--force` only after clean exact verification; and the exact remote branch is removed before the local branch while mismatches block. Update only the static Python assertions affected by the schema, managed skill, ownership shape, and current docs, and retain explicit `finalize_spec_episode` regression coverage. Do not build a generic cleanup test framework.

7. **Synchronize current policy and validate.** Update only living documents that currently assert separate cleanup confirmation, durable cleanup binding, or inactive version-2 ownership—including the relevant lifecycle paragraphs in `VISION.md`, `LONG_RANGE_PLAN.md`, `docs/backlog.md`, `docs/future-specification-bundles.md`, `docs/handoff-chain.md`, `docs/conversation-driven-episode-oversight.md`, and `docs/user-stories/*`. Describe prompt-led automatic cleanup, explicit recursive lineage, active-session refusal, exact local/remote branch removal, owner-entry deletion, and Conversation-led retry. Leave historical evidence unchanged and keep command-surface unification out of scope. Run the focused Node and Python tests, then Docker-only Tier 1 plugin validation, and verify the diff contains no version-1 behavior change or new lifecycle machinery.
<!-- SECTION:PLAN:END -->
