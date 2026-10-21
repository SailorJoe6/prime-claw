---
id: PRIMECLAW-10.40
title: Make task-native Episode cleanup complete and owner-safe
status: In Progress
assignee: []
created_date: '2026-10-20 04:32'
updated_date: '2026-10-21 19:17'
labels: []
dependencies: []
references:
  - PRIMECLAW-10.38
documentation:
  - docs/user-stories/I-episode-finalization.md
  - docs/conversation-driven-episode-oversight.md
  - docs/user-stories/F-episode-execution.md
  - docs/user-stories/H-handoff-and-continuation.md
modified_files:
  - docs/conversation-driven-episode-oversight.md
  - docs/user-stories/F-episode-execution.md
  - docs/user-stories/H-handoff-and-continuation.md
  - docs/user-stories/I-episode-finalization.md
  - src/prime-agent-plugin/extension-support/episode-ownership.ts
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
  - tests/reviewed_plan_extension.test.mjs
  - tests/spec_episode_extension.test.mjs
  - tests/task_episode_ownership_extension.test.mjs
  - tests/test_oversee_episode_skill.py
  - tests/test_reviewed_plan_extension.py
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
- [x] #3 Cleanup recursively selects only sessions connected to the exact Episode by explicit Prime Agent parent ID or canonical parent session-file path edges; shared-worktree sessions, possible siblings, and unrelated sessions are never selected.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Slice 1 selected (2026-10-21): implement plan step 3 explicit recursive session lineage in task-episode-cleanup.ts, focused runtime identity/idle tests, and living finalization docs. Session ownership follows parentSessionId or canonical parentSessionPath; CWD and RLM metadata are not ownership. Keep the remaining cleanup-state, owner removal, Git/provider transport, and prompt-policy changes for subsequent slices. Local submodule CLI is absent; use the repository-built /Users/jlanders/code/prime-claw/deps/backlog/dist/backlog artifact from this Episode CWD.

Slice 1 complete: explicit recursive runtime ownership (plan step 3 runtime portion).
- task-episode-cleanup.ts accepts parentSessionId-only or canonical parentSessionPath-only edges, requires agreement when both exist, and derives deletion depth from those edges. Descendant CWD, runtimeKind, rlmDepth, and rlmChildId are not ownership requirements. The exact root still matches its recorded session ID/file/worktree and route.
- Focused tests cover ID-only/path-only and canonical symlink paths, a routed path-only child, nested mixed lineage with interrupted deletion, descendants outside the worktree or without CWD/RLM metadata, preserved possible siblings, contradictory and duplicate identities, root/descendant activity, missing idle proof, and identity drift before deletion. No runtime/provider operation is added; no persistent state is added. Version-1 behavior and code are unchanged.
- Docker behavior: `python3 -m pytest tests/test_reviewed_plan_extension.py -q -m container` -> 5 passed, 9 deselected (136.22s). The first attempt failed in disposable builder setup before tests; one retry passed against the final source/tests. Evidence: /tmp/primeclaw-10-40-slice1-container-retry.log and .test-results/20261021T184353Z-30991-17925498/tier1/manifest.json; all run-owned containers removed.
- Docker plugin probe: `scripts/test-tier1.sh --probe` -> passed, offline checks and teardown verified. Evidence: .test-results/20261021T184203Z-24100-4daa17ad/tier1/manifest.json (run.status=passed, no failure codes). Source checkout identities were independently verified against docs/prime-agent-installation.md before setting the ignored local .env selector.
- Red test: run only `production cleanup adapter removes ID-only` in the immutable Tier-1 image with the final test and pre-slice cleanup source -> expected failure `ambiguous Prime Agent descendant parent chain`. Docker was offline/read-only with only a scratch test snapshot mounted. Evidence: /tmp/primeclaw-10-40-slice1-red.log.
- Host-safe focused static: `python3 -m pytest tests/test_reviewed_plan_extension.py tests/test_managed_session_protocol.py -q` -> 11 passed, 6 skipped. Full host-static suite -> 663 passed, 68 skipped, 8 failed, 75 subtests passed. All eight failures were reproduced in an isolated local clone at unchanged base ebc7c7399d72fdecc558054dbe27222e87cd61aa: duplicate pre-existing archived PRIMECLAW-10.40 ID, missing local Backlog artifact (three tests), two stale test-tier/bridge assertions, stale installed template hash, and absent/uninitialized pinned Backlog source. Evidence: /tmp/primeclaw-10-40-slice1-static-full.log and /tmp/primeclaw-10-40-slice1-baseline.log. No unrelated repairs attempted.
- Validation correction: an initial direct host Node invocation was stopped without using it as acceptance evidence. All final behavior and plugin validation ran in Docker; no host-global apply/check/probe ran.
Remaining scope: plan steps 1-2 (remove cleanup state/stages and compare-and-remove owner), step 4 (Orca force and remote/local branch transport), step 5 (prompt-led cleanup and public schema), and their focused tests/living policy updates. Merge-readiness idle guidance is also pending. Leave status In Progress; this is an intermediate slice, not a full task candidate.

Owner accepted Slice 1 and authorized the next bounded execute slice (plan steps 1-2 only): remove cleanupHead/stage/inactive version-2 bookkeeping and implement exact atomic compare-and-remove ownership after resources are absent. Preserve version-1 finalize_spec_episode behavior and foreign owners. Use actual state: absent is complete, exact present is removable, changed or ambiguous state blocks. At the parser boundary only, tolerate and discard legacy cleanupHead; do not add migration workflows, retry machinery, lifecycle state, provider/Git transport changes, or prompt/schema policy in this slice. Keep provider/Git transport (step 4) and prompt/schema changes (step 5) deferred. Validate candidate behavior and plugin execution only in Docker Tier 1; host-safe static checks are allowed. Known baseline static failures and Slice 1 evidence are recorded above.

Slice 2 selected after owner acceptance: implement plan steps 1-2 only. Replace version-2 cleanupHead/stage/inactive replay bookkeeping with direct actual-state cleanup and atomic compare-and-remove of the unchanged owner after resources are absent. Preserve version-1 behavior, foreign owners, provider/Git commands, and public prompt/schema policy. Ownership/parser/CAS focused changes are delegated; cleanup path, integration tests, docs and Docker validation remain with the Episode root.

Slice 2 review found a concrete retained-owner safety hole inherited from the session-tree inspector: a root-absent explicit child outside the worktree could be overlooked. Accepted minimal in-scope repair: refuse a missing recorded root with any directly explicit parent-ID or canonical parent-path child before returning runtime absence; do not infer missing intermediate sessions. Real-adapter/finalizer tests prove active children and ownership are retained for both edge forms. Read-only re-review confirmed the repair. Version-1 close remains byte-identical; provider/Git transport and prompt/schema policy remain unchanged. Validation is still pending on the final corrected snapshot.

Slice 2 resumable checkpoint (plan steps 1-2 implemented; final supported Tier-1 acceptance BLOCKED):
- Removed version-2 cleanupHead from ownership types and all cleanup head/stage/inactive/replay bookkeeping from finalizeTaskEpisodeCleanup. Cleanup now verifies each present resource, skips already absent resources, removes runtime/worktree/branch in dependency order, verifies resulting absence, then calls exact atomic compare-and-remove. Provider failures return immediately without internal retry; ordinary ownership remains unchanged until final removal. Base ancestry, terminal merged/archived outcome, pushed canonical main, present local branch's pushed head, and exact clean identity checks remain.
- Added removeTaskEpisodeOwnership using the existing registry lock and atomic rename. It requires the unchanged active version-2 entry and rejects missing/replayed, changed, wrong-version, or non-active ownership. Parser-only compatibility validates/discards a legacy cleanupHead; persistence omits the caller's marker and preserves foreign raw entries, including legacy markers. Version-1 parsing and finalize_spec_episode behavior remain unchanged; episode-close.ts is byte-identical to accepted base.
- Removed adapter-only unsafe-order assumptions, not provider/Git commands. A recorded root missing while a directly explicit child survives is a bounded refusal, not inferred absence. This prevents owner deletion while that known child remains. No lifecycle coordinator, new state, receipt, migration workflow, retry machinery, provider/Git transport, public schema, or prompt-policy change.
- Focused tests cover all eight presence/absence combinations, exact resource mismatch, busy runtime, terminal/push/archive/ancestry refusal before mutation, verified provider no-op failure, one-call provider failure and later caller-led continuation, owner drift and foreign preservation, real registry integration, parser compatibility, root-only runtime cleanup after Git absence, and active explicit children outside the worktree when the root is absent. Living docs now describe current owner removal and actual-state semantics, leaving confirmation/provider/remote policy for later slices.
- Final Docker unit snapshot: four existing suites (spec_episode_extension, task_episode_ownership_extension, reviewed_plan_extension, episode_close_extension) run together with `node --experimental-strip-types --test --test-timeout=60000` in immutable Tier-1 image sha256:5e58aee2dadb960c1768f696081c19361211fc0e602634883f3ae08c0d61d2dc; offline/read-only scratch source/test snapshot, tmpfs /tmp, no host plugin state. 214 tests passed, 0 failed (6.21s Node / 8.24s outer). Host Docker command ran through scripts/testing/bounded.py --timeout 150 --kill-grace 3. Evidence: /tmp/primeclaw-10-40-slice2-green.log. Snapshot inputs: /var/folders/4_/twy0wz3s1mq650wnqzn1b8rr0000gq/T/primeclaw-10-40-slice2-green-gn7xfjnh.
- Red evidence in the same isolated immutable image: original adapter rejects the runtime-only absent-Git case (`runtime state after both worktree and branch disappeared`); final explicit-child safety tests fail against original adapter with `Missing expected rejection.` for both parent-ID and parent-path. Evidence: /tmp/primeclaw-10-40-slice2-red.log and /tmp/primeclaw-10-40-slice2-orphan-red-final.log. An initial orphan test setup caught its generated worktree still existing; the fixture was corrected before the final 214-test pass.
- Final host-safe focused command: `python3 -m pytest tests/test_reviewed_plan_extension.py tests/test_managed_session_protocol.py tests/test_oversee_episode_skill.py -q` -> 17 passed, 7 skipped (0.42s). Full host static -> 663 passed, 69 skipped, 8 failed, 75 subtests passed; the exact same eight baseline failure IDs recorded in Slice 1, no new failure IDs. Evidence: /tmp/primeclaw-10-40-slice2-static-final.log and /tmp/primeclaw-10-40-slice2-static-full.log. No unrelated fixes.
BLOCKER: final supported `python3 -m pytest tests/test_reviewed_plan_extension.py -q -m container` could not reach tests: source builder passed, but disposable source Prime Agent install returned nonzero at tests/conftest.py:888. One bounded retry with unchanged candidate failed at the same pre-test phase. Both runtime teardowns are clean/absent; no run-owned containers remain. Installer detail is not preserved by the fixture; the underlying cause is unknown. Evidence: /tmp/primeclaw-10-40-slice2-container-corrected.log, .test-results/20261021T185822Z-41637-cb71f2d1/tier1/manifest.json; /tmp/primeclaw-10-40-slice2-container-retry.log, .test-results/20261021T190056Z-84314-366eb8e3/tier1/manifest.json. Earlier superseded snapshots passed the bridge or exposed the corrected test-fixture issue; they are not final acceptance evidence.
UNBLOCK CONDITION / NEXT ACTION: restore the supported disposable source Prime Agent installation path (without upstream changes, credentials, host plugin activation, or scope expansion), then run the exact supported Docker bridge against this unchanged source/test snapshot and obtain a passing result with clean teardown. Do not implement plan steps 4-5 in that validation pass. This checkpoint is not Ready for Merge and does not claim completed acceptance. No more installer retries in this pass. Task status remains In Progress; only the owning Conversation may publish Blocked or other lifecycle state. After validation, report the candidate and wait for owner acceptance. Later provider/remote transport and prompt/schema policy remain deferred.

Owner accepted Slice 2 after completing the exact supported Docker bridge against unchanged clean checkpoint d0d013aaf7928fb628e47d91e5ae1f1474235e65: `python3 -m pytest tests/test_reviewed_plan_extension.py -q -m container` -> 6 passed, 9 deselected. Manifest .test-results/20261021T191338Z-95197-f601a167/tier1/manifest.json records run.status=passed, no failure codes, exact clean checkpoint/source/artifact identity, offline network, and clean absent teardown. Episode re-read and verified the manifest's candidate HEAD, clean repository, passed status, offline network and teardown. This clears the prior final-validation blocker; do not repeat its pending/retry instructions as current state. The owner reports canonical main task restored to In Progress at e875e84f1d7282a5f95cd9eca74e3cf2632bf06f. Episode task remains In Progress; Slice 2 is accepted, not the full task.
Next execute authorization: one bounded Slice 3 for plan step 4 ONLY. Use Orca --force only after exact clean worktree/provider verification. Derive configured upstream remote/ref from ordinary Git on each invocation, verify exact terminal heads, delete remote before local, and treat absent exact resources as complete while mismatches block. Add focused transport/order/refusal tests and living docs for that scope, with Docker-only plugin behavior validation. Add no persistent state, retry machinery, prompt/schema policy, or version-1 behavior change. Leave step 5 to a later slice. Keep the same Episode/worktree/task binding; finish one committed/pushed slice and report owner, then stop.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slices 1 and 2 accepted. Explicit recursive lineage, direct actual-state cleanup, and atomic removal of only the unchanged version-2 owner are implemented. The owner cleared Slice 2's installer-validation blocker: exact supported Docker bridge against unchanged clean d0d013aaf7928fb628e47d91e5ae1f1474235e65 passed 6 tests (9 deselected), with offline network and clean absent teardown; see latest notes/manifest. Next authorized slice is plan step 4 only: exact clean Orca --force and configured upstream remote-before-local deletion, no new state/retry or version-1 change. Prompt/schema policy (step 5) remains deferred. Task remains In Progress; the whole task is not yet complete.
<!-- SECTION:FINAL_SUMMARY:END -->
