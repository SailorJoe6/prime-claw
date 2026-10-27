---
id: PRIMECLAW-10.41
title: Handle Orca nonzero after successful Episode worktree removal
status: In Progress
assignee: []
created_date: '2026-10-27 12:48'
updated_date: '2026-10-27 16:48'
labels: []
dependencies: []
references:
  - PRIMECLAW-10.40
documentation:
  - docs/user-stories/I-episode-finalization.md
  - docs/conversation-driven-episode-oversight.md
modified_files:
  - src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
  - tests/spec_episode_extension.test.mjs
  - docs/user-stories/I-episode-finalization.md
  - docs/conversation-driven-episode-oversight.md
  - >-
    backlog/tasks/primeclaw-10.41 -
    Handle-Orca-nonzero-after-successful-Episode-worktree-removal.md
parent_task_id: PRIMECLAW-10
priority: p1
type: bug
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome

Keep task-native Episode cleanup simple and complete when Orca successfully removes the exact verified worktree but returns a nonzero result during a post-removal inspection of the now-absent path.

The authoritative result of a destructive provider step is the freshly observed exact resource state. If the exact owned Orca worktree is absent after the removal command, that step is complete even when Orca returned nonzero. Cleanup must continue in the same invocation using the upstream identity it already resolved, remove any remaining exact local branch, verify absence, and delete only the unchanged owner entry.

## Reproduction and context

During the merged `PRIMECLAW-10.40` UAT cleanup, the exact session tree and upstream branch were removed, then `orca worktree rm --force` removed the worktree, local branch, and branch configuration. Orca returned nonzero because it subsequently ran `git -C <deleted-worktree> rev-parse HEAD`. Cleanup treated the command result as failure even though the exact worktree was absent. A fresh retry correctly refused to infer the erased upstream identity, leaving ownership stranded and requiring manual exact-identity recovery.

## Required behavior

- Preserve all existing pre-removal gates: exact owner and task, truthful pushed terminal outcome, exact terminal head, provider identity, clean worktree, explicit idle session tree, and upstream-before-worktree ordering.
- After the supported Orca removal command returns, re-read the exact provider/Git worktree state. Exact absence means removal succeeded, including when the command returned nonzero after deleting it.
- Continue that same cleanup invocation so its already-resolved upstream identity remains available through final branch verification and owner removal.
- If the exact worktree remains present, changed, foreign, or ambiguous, return the bounded provider error and retain ownership.
- Keep actual-state recovery direct. Add no cleanup state, persisted upstream metadata, receipt, stage, retry loop, error taxonomy, coordinator, background work, or generalized reconciliation framework.

## Scope and non-goals

This is a narrow correction to Orca post-removal result handling. Do not redesign cleanup, weaken pre-deletion safety, change the public `finalize_task_episode` schema, change Git/provider ordering, add automatic retries, or alter version-1 `finalize_spec_episode` behavior. Do not encode the one-time manual recovery procedure as product behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a clean exact Orca worktree is removed and the provider command returns nonzero only after the exact worktree has become absent, task-native cleanup treats the worktree step as complete and finishes the same invocation, including exact owner removal.
- [x] #2 When the worktree is still present, changed, foreign, or not provably absent after a nonzero provider result, cleanup fails closed, preserves ownership, and performs no unsafe follow-on deletion.
- [x] #3 Existing idle-session, exact identity/head, cleanliness, remote-before-worktree, unrelated-owner preservation, and version-1 finalization behavior remain unchanged.
- [x] #4 A focused regression reproduces delete-then-nonzero Orca behavior and proves successful completion without persistent cleanup state or retry machinery; Docker-only plugin validation passes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Reconcile only the Orca worktree-removal result at the existing adapter boundary.**
   - In `src/prime-agent-plugin/extension-support/task-episode-cleanup.ts`, keep every current pre-removal identity, idle, head, cleanliness, terminal, and upstream-order check unchanged.
   - Around only the existing `orca worktree rm --force` call in `CliTaskEpisodeCleanupAdapter.removeWorktree`, catch a removal error and run one fresh `inspect(record)` with the same adapter instance. Treat the step as successful only when that inspection proves the exact worktree absent; this preserves the invocation-local resolved upstream identity when Orca also removed the local branch and configuration.
   - If the worktree remains present or the post-state is changed, foreign, partial, or ambiguous, fail closed with the bounded removal/observation error. Do not retry the command or add persisted cleanup state, metadata, stages, receipts, classifiers, or generalized reconciliation.
   - Leave `finalizeTaskEpisodeCleanup`, its public tool schema, resource order, existing post-removal verification, remaining-branch removal, and owner compare-and-delete unchanged.

2. **Cover the exact success-after-error and failure-preservation cases.**
   - In `tests/spec_episode_extension.test.mjs`, extend the production Orca cleanup fixture through `finalizeTaskEpisodeCleanup` so `worktree rm` deletes the exact Git/Orca worktree and local branch/configuration, then returns nonzero. Prove that the same invocation completes, removes only the target owner, and preserves a foreign owner.
   - Add the paired negative case where nonzero does not produce provable exact absence. Prove ownership remains and no unsafe branch or owner deletion follows.
   - Keep the existing dirty-worktree, foreign-identity, upstream-order, absent-resource, ownership-integrity, and version-1 coverage passing.

3. **Align the two cleanup contracts and validate through supported paths.**
   - Update only the affected cleanup wording in `docs/user-stories/I-episode-finalization.md` and `docs/conversation-driven-episode-oversight.md`: a nonzero removal response is reconciled once against exact post-state, proven absence is success, and any present or ambiguous state remains a bounded failure with ownership retained.
   - Run the focused `tests/spec_episode_extension.test.mjs` suite, then the Docker-only plugin gate `scripts/test-tier1.sh --probe`. Record the resulting evidence in the task during implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution: verified exact v2 ownership, Episode session and worktree against canonical registry. Reused verified canonical deps/backlog/dist/backlog with Episode cwd (local build artifact absent). Root cause: removeWorktree propagates Orca nonzero before finalizer post-removal inspection, even when branch/config were erased. Added production-adapter/finalizer regression fixture for delete-then-nonzero and paired retained-owner failures. Documentation updated in the two approved files. No lifecycle status change.

Regression evidence: Docker focused delete-then-nonzero cases failed before source change with "Orca worktree removal failed: post-removal inspection failed"; retained-owner negative cases passed. Added narrow catch around only Orca removal; same-adapter inspect accepts proven absence, otherwise preserves removal/observation error. Pre-removal gates, finalizer, public schema, ordering and v1 remain untouched. Docker tier1 --probe and lifecycle suites running; verified source fork remote, tag object, HEAD, tree and lock hash against docs/prime-agent-installation.md. Evidence logs stored externally until final results are recorded.

Validation milestone: network-disabled Docker Node lifecycle suites passed 205/205 tests (spec_episode_extension, episode_close_extension, task_episode_ownership_extension). New success regression covers Orca deleting branch/config and Orca leaving the branch for final compare-and-delete. Five negatives cover present, changed metadata, foreign identity, partial deletion, and failed observation, preserving both owner entries and preventing follow-on branch deletion. Original pre-fix reproduction is recorded above. Tier1 source-mode --probe still running; bounded independent diff review requested.

Validation complete (2026-10-27):
- Red reproduction: network-disabled Docker focused production Orca tests failed on both delete-then-nonzero variants before the adapter fix, with the reported removal error. The positive tests then passed after the source fix and correction of an auxiliary test-only fresh-adapter assertion.
- Docker regression command: docker run --rm --network none -v "$PWD":/workspace:ro -w /workspace b08d8449361d node --experimental-strip-types --test tests/spec_episode_extension.test.mjs tests/episode_close_extension.test.mjs tests/task_episode_ownership_extension.test.mjs. Result: 205 passed, 0 failed. Includes unchanged pre-removal safety, upstream ordering, owner integrity, and v1 coverage.
- Static policy: python3 -m pytest tests/test_reviewed_plan_extension.py -q -m "not container". Result: 9 passed, 6 deselected.
- Docker plugin gate: TIER1_ENV_FILE=<file containing PRIME_AGENT_SOURCE=/absolute/path/to/verified/cwd-fix-v0.9.8-r1-source> scripts/test-tier1.sh --probe. Result: exit 0; offline plugin apply/check and command probe passed; network absent; source-builder/runtime teardown verified. Source HEAD a1faacd53ac4473a75de1d434afaf50945c2f647 matched documented tag/tree/lock identity.
- Tier1 evidence: .test-results/20261027T143033Z-36498-66dfbf11/tier1/manifest.json (run.status=passed, teardown.clean=true); setup.log includes plugin-applied, plugin-checked, probe-passed.
- Independent read-only diff review: cleanup-diff-review reported no material findings against the approved contract. git diff --check passed.
No host/global plugin application, upstream source edits, public schema changes, persistent cleanup state, retries, or v1 behavior changes. Task stays In Progress for owning Conversation review. Host/manual Orca UAT remains a later operator-controlled acceptance step, not claimed by this fixture proof.

Final integration validation: required git pull --rebase origin main integrated newly landed PRIMECLAW-43 at ddcbf9c. Only the two documentation paragraphs conflicted; resolution preserved all selected-provider/independent-history wording and inserted only this approved Orca reconciliation text. Code/tests merged automatically; diff remains the same five-file single-purpose slice. No scope expansion.
Reran the same network-disabled Docker lifecycle command on integrated HEAD: 287 passed, 0 failed (expanded current suites). Reran static policy: 9 passed, 6 deselected. Reran source-mode scripts/test-tier1.sh --probe: exit 0, offline apply/check/probe passed, network absent, teardown clean. Final gate evidence: .test-results/20261027T143357Z-44293-2d276d1c/tier1/manifest.json (run.status=passed, teardown.clean=true), setup.log phases plugin-applied/plugin-checked/probe-passed. This integrated validation supersedes the pre-rebase counts above. Task remains In Progress; no merge, deployment or lifecycle mutation.

Owner-authorized next execute integration (2026-10-27; accepted candidate remains 0c6073eba563e512559535126022e619547aa13e until refreshed):
Integrate current canonical main `6719d19716f19dcc187c50572bea189fb7fd32b5` into this same accepted Episode. Preserve the existing narrow PRIMECLAW-10.41 Orca delete-then-nonzero fix and all current-main behavior, including commit `0174975` and the supported PRIMECLAW-10.39 reproduction comment on PRIMECLAW-10.41. Treat histories nested under an Episode artifact root as intentionally owned by that Episode; recursive deletion of that nested subtree is expected, not a defect. Do not add or revise cleanup behavior for that clarification. Resolve only in-scope integration conflicts in the overlapping task, cleanup adapter, focused tests, and cleanup document; do not broaden scope or add state/retries/frameworks. Re-run the focused Docker lifecycle tests, static policy tests, and Docker-only `scripts/test-tier1.sh --probe`, update task evidence through supported Backlog CLI without changing `In Progress`, push the refreshed candidate, and report the exact head. Do not merge, publish lifecycle status, run cleanup, or perform plugin/global actions.
Handoff preparation records direction only; integration and validation are not yet performed. Preserve the existing task plan and prior evidence; refresh evidence/Final Summary after integration.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the narrow Orca delete-then-nonzero correction. Only the supported Orca removal call gains error reconciliation: one fresh same-adapter inspection accepts exact absence and lets the existing finalizer finish branch verification and exact owner deletion in the same invocation. Present, changed, foreign, partial or unreadable state fails closed. Added production-adapter/finalizer regressions and aligned both cleanup contracts. Docker lifecycle tests after integrating main: 287/287; static policy: 9/9; source-mode tier1 --probe passed; independent diff review found no material defects. Candidate prepared for owning Conversation review; no lifecycle transition or deployment performed.
<!-- SECTION:FINAL_SUMMARY:END -->
