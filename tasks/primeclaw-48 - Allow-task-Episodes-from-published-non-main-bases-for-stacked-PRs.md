---
id: PRIMECLAW-48
title: Allow task Episodes from published non-main bases for stacked PRs
status: Ready for Merge
assignee: []
created_date: '2026-10-30 23:31'
updated_date: '2026-11-03 19:26'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md
  - src/prime-agent-plugin/workflows/implement-task.md
documentation:
  - docs/evidence/primeclaw-48-integration-target-foundation-20261103.md
  - docs/evidence/primeclaw-48-target-aware-lifecycle-20261103.md
modified_files:
  - docs/conversation-driven-episode-oversight.md
  - docs/evidence/primeclaw-48-integration-target-foundation-20261103.md
  - docs/evidence/primeclaw-48-target-aware-lifecycle-20261103.md
  - docs/user-stories/E-episode-promotion.md
  - docs/user-stories/I-episode-finalization.md
  - docs/user-stories/traceability.md
  - src/prime-agent-plugin/extension-support/episode-ownership.ts
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
  - src/prime-agent-plugin/extension-support/task-episode-ownership.ts
  - src/prime-agent-plugin/extensions/reviewed-plan.ts
  - src/prime-agent-plugin/skills/implement-task/SKILL.md
  - src/prime-agent-plugin/skills/prime-claw-expert-review/SKILL.md
  - src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md
  - src/prime-agent-plugin/skills/project-templates/blocked.md
  - src/prime-agent-plugin/skills/project-templates/execute.md
  - src/prime-agent-plugin/workflows/handoff.md
  - src/prime-agent-plugin/workflows/implement-task.md
  - tests/beads_task_episode_admission_extension.test.mjs
  - tests/spec_episode_extension.test.mjs
  - tests/task_episode_admission_extension.test.mjs
  - tests/task_episode_ownership_extension.test.mjs
  - tests/test_blocked_skill.py
  - tests/test_oversee_episode_skill.py
priority: p1
type: bug
ordinal: 133000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Observed failure

Direct report from Conversation Prime-Agent-Pi (`01a18414-077b-7038-85d3-6d13ece95269`), not a new reproduction: in `/Users/jlanders/code/prime-agent`, the owning primary checkout was clean and pushed on `fix/daemon-cwd-session-recovery`, at code HEAD/upstream `a1faacd53ac4473a75de1d434afaf50945c2f647`. This was the reviewed TypeScript baseline.

Joe invoked `/implement-task TASK-2` for “Prevent orphaned RLM settlement after child finalization errors”. Backlog was the sole valid provider, with an ignored independent ordinary-Git `.backlog` clone, origin `https://github.com/SailorJoe6/prime-agent.git`, task ref `refs/heads/prime-claw/tasks`, and task path `.backlog/tasks/task-2 - Prevent-orphaned-RLM-settlement-after-child-finalization-errors.md`. The task was `In Planning`, with a meaningful 642-word plan, seven unchecked acceptance criteria and no blocking dependencies. Its complete specification/plan had been read and judged ready; task HEAD, FETCH_HEAD and direct published revision agreed at `61b5bfe5870e2d04ff092d6280db894f104c1997`.

The canonical readiness workflow completed preparation and called `create_task_episode` exactly once with `{"taskId":"TASK-2"}`. It returned:

> Task Episode creation failed: Task-native Episode creation must run from the canonical primary main checkout

Afterward, the task remained field-for-field unchanged in `In Planning`; the task clone remained clean and published at the same revision; no `.prime-claw/ownership.json` existed; and the worktree inventory contained only the original primary and existing cwd-fix/upstream-assessment trees, with no new Episode tree. Code stayed clean and unchanged. No implementation, status change, assignment/handoff, branch switch, bypass or creation retry was attempted. These are observed native/Git/filesystem facts, not proof about unseen resources.

Local main was `08ff1b2e2794ea9e8f4a08d12bc95408a66e1074` (v0.9.7), four commits behind the selected baseline (`main...HEAD` = `0/4`); origin/main was independently newer/different. Switching to main would change the approved implementation basis. No switch, merge, pull or reset workaround was authorized.

Joe's feedback: '"The tool requires the canonical primary main checkout" bad design. it blocks stacking PRs and other such fun'

## Source evidence and diagnosis

Prime Claw source inspected at `24b519c3c967269dd3867bf06a9e92a2f125012d`: `src/prime-agent-plugin/extension-support/spec-episode.ts:3145-3153` rejects `git.branch(projectRoot) !== "main"` alongside primary-checkout identity checks. Beads admission repeats this at `2913-2921`. This confirms a literal branch-name restriction; equating primary ownership with main is the inferred design defect, not a newly reproduced runtime trace.

Downstream assumptions also need coherent treatment: task blocked handling (`977-984`), handoff (`1776-1782`), cleanup (`2671-2673`), and terminal publication/ancestry checks (`2547-2605`, including Beads direct-remote `main`). Managed oversight at `src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md:41-49` hardcodes main for readiness, merge and abandonment. `src/prime-agent-plugin/workflows/implement-task.md:90` also assumes canonical main. Removing only the admission check is insufficient.

## Intended outcome and boundaries

Use the current checked-out branch as the Episode base and default merge target, including a clean, published feature/stack branch in the primary owning checkout. Show its name and exact base commit during readiness; bind that commit and integration branch so continuation, review, merge and cleanup use the correct target. The repository's actual primary/default branch is supported regardless of whether it is named main, master or something else; it is not a universal admission gate. Preserve task/provider/publication/owner/resource identity, isolated Episode resources, and explicit operator merge/abandonment authority.

The implement-task skill must instruct the LLM to check whether the current branch differs from the repository's actual primary/default branch. If it does, the LLM should ask the user before stacking, for example: "Current branch is xxxx; are you sure you want to stack a branch off this?" This is ONLY an instruction in the skill file. Add no code to require, track, validate or enforce this check-in, no approval token/receipt, and no deterministic confirmation gate or compliance test. Joe explicitly accepts that the LLM may ignore this instruction. This does not weaken the separate existing identity, isolation or publication checks.

Use native Git/provider behavior and the smallest explicit binding needed. Do not introduce a branch classifier, reconciler, coordinator, new state machine or lifecycle receipts. This bug concerns task-native admission and affected downstream target assumptions, not blanket permission for arbitrary checkout admission. Preserve legacy compatibility and the distinct post-acceptance primary-main `--user-global` activation policy. No Prime Agent source changes, release/Rust/fork proposals, or changes to foreign TASK-2 are in scope. This ticket authorizes specification review only, not planning, implementation or real Episode reproduction.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The current checked-out branch is the Episode base and default merge target. A clean, published non-default branch in the primary owning checkout can admit an otherwise-ready task Episode without changing that baseline; the repository default branch is supported regardless of its name.
- [x] #2 The exact base commit and intended integration branch remain unambiguous for the same owner/task/Episode through continuation, blocked handling, review and terminal cleanup; merge and publication target that integration branch rather than a hardcoded main.
- [x] #3 Admission never silently switches the primary checkout to main, discards stacked commits or substitutes another implementation basis. Existing unsafe-state, provider/publication, owner and resource identity rejections remain effective, with isolation preserved.
- [x] #4 Merge and abandonment still require explicit operator authority. Task status/publication and terminal ancestry checks remain correct for the selected target; unrelated tasks and resources are not changed.
- [x] #5 Focused disposable regression evidence covers clean published non-main acceptance with isolation/identity and invalid admission leaving task/resources unchanged. Review affected managed instructions for consistent target handling; do not require a new broad test harness or matrix.
- [x] #6 The change stays within Prime Claw, preserves legacy compatibility and does not loosen the separate primary-main user-global activation policy or introduce unnecessary coordination/state machinery.
- [x] #7 Content review confirms the implement-task skill tells the LLM to ask the user before stacking from a branch other than the repository’s actual primary/default branch, naming the current branch. This check-in exists only as a skill instruction: no code enforcement, confirmation tracking/receipt or compliance test is added; LLM noncompliance is explicitly acceptable.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Scope and implementation basis

Implement only PRIMECLAW-48 in Prime Claw. The current checked-out branch is the code base and default integration target; show the branch and exact SHA during readiness. Keep the owning primary-root requirement, provider-native publication and unsafe-state/resource checks. This plan does not authorize implementation, real Episode reproduction, foreign TASK-2 changes or user-global activation.

Current source at `fe61016a5eab4a41f7d10fe3ca3996d3bb0d3fc8` confirms literal-main restrictions in `extension-support/spec-episode.ts` admission, task blocked handling, handoff and finalization. Existing ownership has `baseRef` and the Episode `branch`, but no integration target. Use these existing boundaries rather than adding orchestration.

## Ordered work

1. **Put the stacking check-in only in the skill.** Update `src/prime-agent-plugin/skills/implement-task/SKILL.md` to have the LLM inspect the current branch and the repository's actual primary/default branch using ordinary Git evidence (not a literal `main` assumption). On a non-default branch, instruct it to ask: “Current branch is xxxx; are you sure you want to stack a branch off this?” Show current branch and code SHA during readiness. Add no confirmation argument, code enforcement, approval token/receipt, tracking or compliance test. LLM failure to ask is explicitly acceptable. This must not become a second readiness/approval mechanism.

2. **Bind the integration branch in existing task ownership.** Add one task-only `integrationBranch` field to the version-2 types/allowlists/parser in `extension-support/episode-ownership.ts`, and carry it through the three reservation inputs/factories in `extension-support/task-episode-ownership.ts`. Fresh admissions always record the current named branch; `baseRef` continues to identify the exact code base and `branch` continues to identify the isolated Episode branch. Use ordinary Git branch/ref validation. Include the effective target in existing `sameEpisodeBinding` immutability checks so an active owner cannot silently retarget. Old version-2 records without the field retain their previous `main` target through one narrow compatibility fallback; never infer their target from whichever branch is now checked out. Leave version-1 records and their main-only transition/activation policy unchanged. Preserve this field across provider migration and same-owner evidence/routing updates; do not migrate or rewrite live ownership. No new schema generation, state machine, target registry or receipt.

3. **Admit from that branch without changing the baseline.** In Backlog `createTaskEpisode` and Beads `createBeadsTaskEpisode` in `extension-support/spec-episode.ts`, replace only the task-native literal-main gate with capture/validation of the current named branch. Retain repository-root/primary-worktree, persisted top-level owner, placement, exact task status/plan, and nonterminal ownership checks. Recheck branch and code identity at the existing serialized/publication/reservation boundaries so a switch cannot silently retarget admission. Independent Backlog and Beads keep code and provider DAGs separate and retain their clean published-code proofs against the selected branch's configured upstream. Grandfathered branch-local Backlog retains its exact task-only status commit as `baseRef` and existing prompt-push behavior. Pass the target to the reservation before any resource allocation; provision the worktree from the exact `baseRef`, never by switching the primary checkout or substituting default-branch HEAD. Preserve existing rollback/Blocked/no-retry behavior and one fixed execute assignment.

4. **Use the same target for the rest of the task lifecycle.** Update task-native blocked handling, `handoffTaskEpisode`, `allocateReservedTaskEpisode` fresh/replay branch identity checks, and `finalizeTaskEpisodeCleanup`/`verifyTaskEpisodeTerminalState` in `spec-episode.ts` to use the recorded integration target instead of `main`. The owner checkout must match that branch; if it has switched, report the mismatch without switching, rebinding or allocating again. Normal target-branch advancement remains allowed under existing ancestry/publication rules; do not pin its HEAD forever to admission. Fresh review/merge evidence names the integration branch plus target and candidate heads. Check pushed terminal code and merged/abandoned Episode ancestry against that target, including Beads direct-remote checks; keep independent Backlog terminal evidence on its task ref. Preserve exact owner/task/provider/resources, idle-work checks and cleanup-only behavior. Cleanup still deletes only the Episode’s own configured upstream, never the integration branch. Keep explicit operator merge/abandonment authority; do not add retarget automation or a coordinator.

5. **Align managed instructions and focused docs.** Update the task-native portions of `workflows/implement-task.md`, `skills/prime-claw-oversee-episode/SKILL.md`, relevant execute/blocked/handoff/expert guidance, and the `finalize_task_episode` tool description in `extensions/reviewed-plan.ts` so readiness, review, status publication, merge and cleanup name the recorded integration target. Update `docs/conversation-driven-episode-oversight.md` and affected promotion/finalization user stories/traceability. Review each main reference rather than globally replacing it: retained version-1 workflows, legacy bridge and accepted-primary-main `--user-global` refresh/restart/UAT rules stay unchanged. Change inert source assets, not the installed global skill/plugin; no host apply/check/probe.

6. **Prove the change with existing disposable suites.** Extend `tests/task_episode_admission_extension.test.mjs` and `tests/beads_task_episode_admission_extension.test.mjs`: accept a clean published feature/stack base without losing its commits, retain the exact base/target through one isolated allocation, support a default branch named `master` or another non-main name, and replace the obsolete “primary non-main rejects” assertion while retaining linked-worktree rejection. Add focused pre-mutation detached/unsafe or branch-drift rejection assertions with unchanged task/ownership/resources. Extend existing ownership/handoff/blocked/close cases to show target retention, normal same-branch advancement, rejection of wrong-target cleanup, and correct merged/abandoned terminal ancestry/publication on the feature target. Retain old version-2 missing-target, provider-switch field preservation, forbidden active-target mutation and version-1 compatibility coverage and local/Orca identity coverage without creating a broad cross-product matrix. Review skill wording as content; add no test of whether the LLM asked or the user confirmed.

Run affected Node behavior suites only through their existing Docker Tier-1 pytest bridges (`tests/test_task_providers.py`, `tests/test_reviewed_plan_extension.py`), plus relevant policy/docs checks. After every plugin-source change run the required Tier-1 validation, such as `scripts/test-tier1.sh --probe` or `python3 -m pytest tests/ -q -m container`. Record actual results and any blockers in the native task during the later implementation Episode; do not claim tests have run during planning. Keep documentation and acceptance evidence current, commit/push the reviewed implementation candidate, then return it to the owning Conversation for review. Merge, abandonment, activation/restart and cleanup remain separate lifecycle decisions, not consequences of this plan.

## Execute checkpoint: slice 1 (2026-11-03)

Step 2 ownership foundation is implemented and Docker-validated in code candidate 82a307079b9a5034303a8705337d3eb337791351. integrationBranch remains optional for old records/callers and the compatibility target is main. Public admission is not changed yet. Continue with steps 1, 3 and 4 as the next coherent target-aware admission/lifecycle slice; then complete step 5 managed guidance and step 6 non-main admission/terminal acceptance. Exact evidence and the unchanged static-test path limitation are in Implementation Notes and the linked evidence doc. Stop for owner review after this one slice.

## Execute checkpoint: target-aware lifecycle candidate (2026-11-03)

Steps 1–6 now have implementation and focused disposable candidate evidence, following the accepted slice-1 ownership foundation. The exact pushed candidate head, green Docker manifests, static path limitation, and acceptance mapping are in Implementation Notes and docs/evidence/primeclaw-48-target-aware-lifecycle-20261103.md. Preserve this as a review candidate, not a live activation or terminal decision. Stop for the owning Conversation's independent review and operator-bounded next action; do not begin another slice, merge, change status, refresh installed assets, restart or clean resources.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Execute slice 1: integration-target ownership foundation (2026-11-03)

Bound Episode: `01a1a2b3-da23-77ee-8519-83f2e4a79e73`, owning Conversation `01a18f25-aee6-7352-991b-59275f14bf96`, code base `32a02232b65dffc2a51660661e38dc05cc289f5b`.

This bounded pass implements plan step 2 only: task-only optional `integrationBranch`, explicit native Git ref validation, legacy missing-field effective target `main`, immutable effective target for a live owner, and reservation/provider-switch/evidence retention tests. Existing public callers remain compatible. Public admission is still main-only in this staged slice; enabling non-main admission and switching all downstream lifecycle checks together are the next slice. The skill-only stacking check-in and full lifecycle/docs acceptance remain pending. No acceptance criterion is claimed complete by this foundation alone. No live ownership rewrite, provider switch, foreign task mutation, installed/global refresh, merge, terminal publication or cleanup is authorized/performed.

Validation and exact publication evidence will be appended after the candidate is ready.

## Slice 1 completed and published (2026-11-03)

Code candidate: `82a307079b9a5034303a8705337d3eb337791351` on `JLanders/prime-claw-primeclaw-48-episode-97fc9b02`, non-force pushed; direct remote head equals that SHA. Code checkout is clean and up to date with its own upstream. Only five approved code/docs/test paths changed; task history is not in the code DAG. Evidence: `docs/evidence/primeclaw-48-integration-target-foundation-20261103.md`.

Delivered: task-only optional integrationBranch across all version-2 ownership shapes and all three reservation inputs/factories; native Git branch/ref validation; effectiveTaskEpisodeIntegrationBranch with omitted-field-only main fallback; live effective-target immutability, including refusal of feature-target deletion; representative provider-switch/rollback/route/evidence retention regression coverage. Existing public callers remain compatible; version-1 does not gain this task field. No live ownership rewrite occurred.

Actual validation:
- scripts/test-tier1.sh --probe: exit 0, offline apply/check plus RPC probe passed, network absent, teardown verified, manifest published. Evidence .test-results/20261103T184113Z-62440-fcbcc1a5/tier1/manifest.json.
- python3 -m pytest tests/test_task_providers.py tests/test_reviewed_plan_extension.py::test_task_episode_ownership_node_suite tests/test_reviewed_plan_extension.py::test_spec_episode_node_suite tests/test_reviewed_plan_extension.py::test_episode_close_node_suite -q -m container: 7 passed, 3 deselected in 356.25s. Evidence .test-results/20261103T184121Z-63056-69b1f777/tier1/manifest.json. Both Docker runs captured repository hash aae13124f2eb03e6044c94642ce7181d93090c2bd2b92a7e92fb7d303b0b9fad.
- python3 -m pytest tests/test_task_providers.py tests/test_reviewed_plan_extension.py -q: NOT GREEN; 1 failed, 11 passed, 10 skipped. Unchanged test test_repository_status_cutover_uses_task_native_order_without_to_do reads absent backlog/config.yml rather than the independent .backlog config. The test is byte-identical to the admission base and neither config path is tracked there. No separate baseline execution claimed and no unrelated fixture/topology repair made. Full output .test-results/primeclaw-48-binding-slice1/focused-static.log.
- git diff --check: passed.

The Docker source selector points only to the documented clean read-only cwd-fix-v0.9.8-r1 source; exact tag/commit/tree/lockfile identities and immutable image IDs are in the tracked evidence note. No Prime Agent source modification, candidate host/global execution or activation occurred.

At final task-write preparation, independent history advanced from 0adba82d1caeed1d9dd62a16a17442a0f6067e93 to 0a85356dc374d6c90f2961c03296469aa0a22472 only through unrelated task changes. The complete PRIMECLAW-48 native task view remained unchanged. This update preserves those unrelated changes, the task identity, parent, status and specification; it updates only owner-authored plan checkpoint, notes, documentation and modified-file fields.

STOP after this slice for owning Conversation review/continuation. Public admission is still main-only. Next: skill-only stacking check-in, fresh current branch capture/reservation and all downstream target lifecycle checks together, then focused non-main admission/terminal evidence and managed-instruction alignment. No whole-task AC checked, no final whole-task completion claim, no merge/Ready for Merge/Done/archive/cleanup. Task remains In Progress.

## Accepted advance and handoff focus (2026-11-03)

The owning Conversation supplied the following accepted in-scope continuation guidance. It supersedes the slice-1 stop-for-review checkpoint; it does not expand the specification or authorize a terminal outcome:

Foundation candidate 82a307079b9a5034303a8705337d3eb337791351 is accepted for advance after independent GPT-6 Astra review found no material defects in its scoped ownership-binding claims. Continue the same Episode with the next coherent slice already recorded in the native plan/checkpoint: skill-only stacking check-in, fresh current-branch capture/reservation, and matching task-native admission, replay, handoff, blocked and terminal integration-target handling; then focused non-main behavior and managed-guidance alignment. Preserve the existing branch/base/provider separation, version-1 and missing-field main compatibility, and separate primary-main global activation policy. The stacking question remains ONLY LLM skill prose: no code enforcement, confirmation tracking/token/receipt or compliance test. Keep required Docker validation and report the unchanged static backlog/config.yml path limitation honestly; do not add an unrelated topology repair. No merge, activation, restart or cleanup is authorized.

Continue the exact existing Episode and task; do not allocate another Episode or rewrite ownership. Code remains at the accepted pushed slice-1 head. Prior published task observations are factual context; the change from the initial revision to 8c5a97fd8ec8b8804ca07ba2067c9c85523a51cc consists of the Episode's own in-scope plan/notes/evidence updates with specification, canonical identity, parent and In Progress lifecycle unchanged. This handoff adds only these accepted notes to independent task history. Existing implementation plan and evidence doc remain the durable resume sources. Canonical execute is already queued independently; handoff requests compaction once, not another execute assignment.

## Execute slice 2 started (2026-11-03)

Continuing the accepted foundation in the same Episode. This bounded slice wires current named primary-branch capture through task-native Backlog/Beads reservation and matching replay, handoff, blocked and terminal target checks; aligns the skill-only stacking instruction and managed guidance; and extends focused existing Docker suites. The owning Conversation accepted this advance in the preceding note. Existing branch/base/provider separation and omitted-target main compatibility remain; retained version-1 and primary-main user-global activation are unchanged.

Parallel workers have disjoint runtime, admission-test, lifecycle-test, and managed-guidance files. The Episode owner integrates and runs Docker-only candidate validation. No code-level stacking question/confirmation mechanism or compliance test is permitted. Validation and exact publication results will follow. The known static backlog/config.yml path assumption is not being repaired. No status/terminal/global/ownership mutation is authorized.

## Slice 2 candidate published for owner review (2026-11-03)

Code HEAD: `e16a009972f647752279c683f7c9fc21dfcdf864` on `JLanders/prime-claw-primeclaw-48-episode-97fc9b02`. One single-purpose 22-path commit, pulled/rebased and non-force pushed; direct remote equals this head and code checkout is clean. Foundation remains its parent. Evidence: `docs/evidence/primeclaw-48-target-aware-lifecycle-20261103.md`.

Delivered the accepted next coherent slice: skill-only stacking question and current branch/SHA display; fresh current named primary-branch capture/reservation for Backlog and Beads; target-aware task admission, fresh/active allocation, handoff, blocked and terminal checks; managed guidance/user-story alignment; focused non-main behavior in the existing Docker suites. `baseRef`, isolated Episode `branch`, recorded `integrationBranch` and independent provider revisions remain distinct. Omitted-only version-2 main fallback and version-1/bridge/primary-main activation policy are preserved. No live ownership was rewritten.

The configured target upstream may use a different ordinary branch name. Cleanup refuses a local Episode ref equal to the target or an Episode upstream alias of the target configured destination/ref, and otherwise deletes only the exact Episode refs/resources. These are candidate safeguards; no live cleanup occurred.

Actual final validation:
- `python3 -m pytest tests/test_task_providers.py tests/test_reviewed_plan_extension.py::test_task_episode_ownership_node_suite tests/test_reviewed_plan_extension.py::test_spec_episode_node_suite tests/test_reviewed_plan_extension.py::test_episode_close_node_suite tests/test_reviewed_plan_extension.py::test_reviewed_plan_node_suite tests/test_reviewed_plan_extension.py::test_prime_agent_rpc_loads_tools_without_custom_commands_and_preserves_native_skill_discovery -q -m container`: 9 passed, 3 deselected in 355.97s. Manifest `.test-results/20261103T191049Z-84683-1e0cceaf/tier1/manifest.json`.
- scripts/test-tier1.sh --probe: exit 0 in 128.65s, offline apply/check and RPC probe passed, network absent, verified teardown, final manifest `.test-results/20261103T191651Z-15619-8a9010c8/tier1/manifest.json`.
- Both green final Docker runs captured repository hash `c2015f443f5e11ac5c08435f0f62f21604c31ef7742a12c9806d2cb44af6d99b`. Final plugin and test bytes were verified unchanged through code publication. The evidence document was completed afterward; manifests retain its earlier draft, not final prose.
- `python3 -m pytest tests/test_oversee_episode_skill.py tests/test_blocked_skill.py::test_blocked_skill_supports_disjoint_task_and_retained_folder_authority -q`: 10 passed in 0.17s. These are content/policy checks, not stacking-compliance tests.
- `python3 -m pytest tests/test_task_providers.py tests/test_reviewed_plan_extension.py -q`: NOT GREEN, 1 failed, 11 passed, 10 skipped. The unchanged test test_repository_status_cutover_uses_task_native_order_without_to_do reads absent backlog/config.yml; independent config is .backlog/config.yml. No separate baseline execution or topology repair claimed.
- git diff --check and final staged diff check passed. Supported clean read-only cwd-fix-v0.9.8-r1 source tag/HEAD/tree/remote/lockfile identities were independently verified before Docker source builds.

Earlier failed source-image inspection and first focused-test assertion/fixture failures are retained and explained in the evidence document. Their green replacements are not represented as first-run success. No host/user-global candidate apply/check/probe, source dependency installation, Prime Agent modification, global activation/restart or real Episode reproduction was used.

Acceptance evidence for this review candidate:
1. Real-Git independent Backlog and Beads feature-base fixtures retain a published feature commit beyond main in one isolated worktree/session/assignment. Grandfathered default master retains its exact task-only status base.
2. Handoff, blocked and active replay retain exact target/base/owner/resources after same-target advancement; mismatched owner branches refuse without switching/rebinding.
3. Detached, same-SHA branch drift, code drift, linked/unsafe admission and fresh allocation drift refuse before task/ownership/resource mutation; existing rollback/Blocked/no-retry cases remain.
4. Backlog/Beads merged and abandoned terminal cases use the recorded target and separate provider publication; wrong target/publication/ancestry refuse, and production cleanup preserves target refs. Merge/abandonment authority remains explicit operator policy.
5. Existing disposable bridge suites cover the focused non-main behavior, resource identity/isolation, and relevant managed guidance is aligned.
6. Scope is only Prime Claw, with old-record/version-1 compatibility and separate primary-main user-global policy intact; no live migration, coordinator, state machine, receipt or topology repair.
7. Root content review found the named stacking question only in skills/implement-task/SKILL.md, using actual-default comparison and explicit LLM-noncompliance allowance. No new code enforcement, confirmation tracking/token/receipt or compliance test exists.

All seven criteria are checked as implemented candidate evidence, not operator acceptance, live-generation UAT or terminal completion. Final Summary is a review-candidate summary only. Task identity/path/parent/specification and In Progress status stay unchanged. Immediate pre-write task history advanced from the start checkpoint through unrelated tasks only; this task view remained field-for-field identical. Those descendants are retained.

STOP after this published code slice and separate task-history checkpoint. The owning Conversation decides independent review, revisions, readiness and any explicit terminal outcome. No merge, lifecycle transition, archive, activation, restart, ownership mutation or resource cleanup is authorized/performed here.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented review candidate `e16a009972f647752279c683f7c9fc21dfcdf864` on the same Episode branch, following accepted foundation `82a307079b9a5034303a8705337d3eb337791351`. Fresh task Episodes bind the current named primary integration branch and exact code base; Backlog/Beads continuation, blocked, review guidance and terminal verification retain that target. Provider/code histories stay separate; omitted-target main and retained version-1 compatibility remain. The stacking question is only LLM skill prose, with no enforcement/tracking/receipt/compliance test.

Final disposable validation: 9 Docker suites passed (3 deselected), final Tier-1 offline apply/check/RPC probe passed with verified teardown, and 10 focused guidance checks passed. Broader static checks retain one unchanged backlog/config.yml path failure (11 passed, 10 skipped). Full evidence and earlier failed attempts: `docs/evidence/primeclaw-48-target-aware-lifecycle-20261103.md`.

Candidate is committed/pushed for owner review only. Task remains In Progress. No operator merge approval, live-generation UAT, activation/restart, terminal publication or resource cleanup is claimed.
<!-- SECTION:FINAL_SUMMARY:END -->
