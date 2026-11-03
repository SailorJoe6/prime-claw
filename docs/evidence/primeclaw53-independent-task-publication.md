# PRIMECLAW-53 — independent task publication

Date: 2026-11-03. Candidate evidence only; no global delivery or runtime activation.
Code base: `b89111fface03f7a510dbef000a2383c217e9031`.

## Bounded change

- `skills/project-templates/design.md` and `spec-it-out.md` use the approved
  Backlog authoring block. Clean/directly published task history is a pre-write
  requirement. Post-write proof is scoped to the intended task path.
- The independent Backlog branch of `commitConversationTaskStatus` no longer
  requires clean/upstream-equal parent code. It retains the code HEAD check,
  exact native identity/source-state/plan checks, and existing task-history
  preparation/publication helpers. Those helpers commit and push only inside
  the selected task clone.
- The existing code operation/clean/upstream checks now run in
  `createTaskEpisode` before ownership reservation. Failure reporting does not
  repeat code-admission checks after allocation has dirtied ownership.
- Branch-local Backlog, Beads, retained-specification allocation, ownership
  format, assignment, recovery, and cleanup behavior are not changed.

## Regression evidence

`tests/spec_episode_extension.test.mjs` uses real disposable code/task Git
repositories, bare remotes, the managed Backlog binary, native task publication,
local worktree allocation, and tracked ownership writes. Session binding uses a
fake publisher; it is not a live-daemon or Orca launch test.

The focused tests cover:

1. Task-only status publication with unrelated staged, unstaged, untracked code
   and genuine one-ahead/one-behind parent divergence. Parent HEAD, full index,
   unrelated diffs/files, upstream, and remote main remain unchanged.
2. Unsuitable code admission rolls the task back before ownership/allocation.
3. Tracked ownership writes followed by a session-binding failure still publish
   truthful `Blocked` status/notes. Uncertain worktree/branch/session evidence
   remains; no assignment, duplicate creation, or automatic cleanup follows.
4. Dirty/unpublished task history, wrong task/path/source-state/plan, rejected
   task push, and changed code HEAD retain their existing failure behavior.
   A rejected push leaves local task evidence intact without claiming publication.

## Reproduction and results

Candidate plugin work ran only in Docker. The documented source selector was
verified read-only at annotated tag `cwd-fix-v0.9.8-r1`, tag object
`8ca4d5c39b7c738f71b5c86422ea46394c3d0558`, commit
`a1faacd53ac4473a75de1d434afaf50945c2f647`, tree
`5301c70d9c9d74e474ccaf258fdd3c8de982c52f`, lock SHA-256
`3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74`.
No Prime Agent source or dependency change was made.

- `TIER1_ENV_FILE=<source-selector> scripts/test-tier1.sh --probe`: **passed**.
  Manifest: `.test-results/20261103T193459Z-10144-7a477a75/tier1/manifest.json`.
  It records absent runtime networking, successful checks/probe, verified
  teardown, and source checkout noninterference.
- Focused existing Docker bridges:
  `python3 -m pytest tests/test_reviewed_plan_extension.py::test_spec_episode_node_suite tests/test_task_providers.py::test_backlog_task_episode_admission_node_suite tests/test_task_providers.py::test_beads_task_episode_admission_node_suite tests/test_task_history_workspace.py::test_task_history_workspace_node_suite -q -m container`.
  Initial run: **3 passed, 1 failed**. The Episode suite had 230 passes and one
  new test-fixture failure: the rejected-push injection matched `git push` but
  the helper sends `git -C <store> push`. Corrected only that test seam. The
  task-history Node suite passed all 80 tests.
  Log: `.test-results/primeclaw-53-focused-bridges.log`; fixture manifest:
  `.test-results/20261103T193835Z-22889-ad601a73/tier1/manifest.json`.
- Corrected complete Episode Node suite: **231 passed, 0 failed, 0 skipped**.
  Command: `node --experimental-strip-types --test tests/spec_episode_extension.test.mjs`
  inside the offline immutable Docker image below. This rerun includes the
  corrected rejected-push test and the tracked-ownership/session-failure case.
  Log: `.test-results/primeclaw-53-spec-episode.tap`.
- Prior-runtime red check: **2 failed as expected** using the current tests
  with only `spec-episode.ts` replaced by its code-base version in a disposable
  read-only Docker mount. Both failures report the original clean/upstream-equal
  parent requirement, including failed `Blocked` publication after the tracked
  ownership write and session-binding error.
  Command: `node --experimental-strip-types --test --test-name-pattern 'independent Backlog status publication preserves|session binding failure publishes independent' tests/spec_episode_extension.test.mjs`.
  Log: `.test-results/primeclaw-53-regression-before.tap`.
- Focused Markdown contract tests: **4 passed, 33 deselected** via offline
  `python3 -m pytest tests/test_future_plan_skills.py -q -p no:cacheprovider -k 'authoring_skill_publishes or independent_backlog_authoring'`.
  Log: `.test-results/primeclaw-53-markdown-focused.log`.
- Full Markdown suite: **34 passed, 3 failed**. A disposable `git archive` of
  the unchanged code base reproduced all three failed test names:
  missing old `backlog/config.yml`; customized authoring/source-byte equality;
  managed planning-workflow/source-byte equality. No managed local skill,
  workflow, metadata, or old task-store path was repaired for this task.
  Logs: `.test-results/primeclaw-53-markdown.log` and
  `.test-results/primeclaw-53-markdown-baseline.log`.

The offline direct tests use immutable Tier-1 image
`sha256:6affe919932fd707db59560a827d4f9fc76f916913018641825a24416983ba71`,
`--pull never --network none`, a read-only `/workspace` mount, and no host
configuration or credential mounts. A first direct-test attempt selected an old
image ID that had disappeared; Docker refused it before testing. The inspected
immutable image above was then used. This is not an all-repository-green claim.

## Delivery boundary

The owning Conversation reviews source and controls status/merge decisions.
The separately approved two-file global Markdown delivery remains pending
accepted source. This Episode did not run global apply/check/probes, install
runtime code, restart, alter ADAPT/Nemo, change lifecycle status, or remove
Episode resources. Source publication, Markdown delivery, and runtime activation
must be reported separately.

## Integrated accepted PRIMECLAW-48/52 revision

The same Episode integrated accepted canonical main
`213689359cdcae9fadb31a4f898e2dc5d0725f0f` into code checkpoint
`bb9c1868ee33fffea7b9f7907fc70d702f806dd7` through ordinary Git. The initial
pending merge against `dd693cdc` was replaced, before validation, by the actual
accepted/pushed PRIMECLAW-52 checkpoint after the owner confirmed it. Only the
two expected `spec-episode.ts` hunks conflicted. No whole-file ours/theirs was
used and no uncommitted primary metadata was read or copied for integration.

The resolution keeps task-only code HEAD preservation and the existing native
publication safeguards, removes common and independent pre-call `assertCode`
assertions from the independent publisher, and retains accepted integration-
branch/resource safeguards. The exact independent `admitted.commit` versus
`preAdmissionHead` check and the separate code-admission operation/clean/upstream
checks remain **before ownership reservation**, not in failure reporting.
Beads, branch-local and retained behavior and all accepted migration changes
remain part of this combined candidate.

The existing real-Git tests now additionally prove that independent task-only
publication never invokes branch/operation/cleanliness/upstream admission methods
even when integration observations are supplied, and that a concurrently moved,
published code base is rejected before ownership/allocation without repairing
that actor's commit.

### Fresh validation and invocation limits

- Mandatory `TIER1_ENV_FILE=.test-results/primeclaw-53-selector.env scripts/test-tier1.sh --probe`:
  **passed**, exit 0. Manifest:
  `.test-results/20261103T220935Z-46297-9829eae8/tier1/manifest.json`.
  It proves network absent, checks/probe passed, exact driver runtime and source
  builder teardown absent, and source checkout noninterference. The selected
  Prime Agent source remains `a1faacd53ac4473a75de1d434afaf50945c2f647`.
- The owning Conversation coordinated the single builder startup. Immutable
  source-builder and runtime capture completed inside its bounded window, and
  the startup/capture reservation was explicitly returned before offline tests
  finished. No second builder was started.
- Runtime image: `sha256:9fc302620bf7198bf3da16d5f4b8b3ade58c04d8b83350dc8c954c9f1a20011d`.
  Combined Node tests use `docker run --rm --pull never --network none`, the
  Episode mounted read-only at `/workspace`, and **`-w /tmp`**. The six absolute
  suite paths are `/workspace/tests/` plus `spec_episode_extension.test.mjs`,
  `task_episode_admission_extension.test.mjs`,
  `beads_task_episode_admission_extension.test.mjs`,
  `task_episode_ownership_extension.test.mjs`, `task_history_workspace.test.mjs`,
  and `task_provider_migration.test.mjs`, following
  `node --experimental-strip-types --test`.
  Final combined result: **487 passed, 0 failed, 12 skipped, 0 cancelled**
  (499 tests; exit 0). All 12 skips are the suite's explicitly retired reverse-
  migration cases; the active refusal path remains covered. Total Node duration:
  3,229,201 ms. Log:
  `.test-results/primeclaw-53-integration-combined-isolated.tap`.
  The corrected offline container was verified absent after `--rm`; every
  subordinate native fixture process was confined to that container.
- The first direct combined attempt used `-w /workspace`. Its linked-worktree
  `.git` points at a host-only directory, so bare Git ref checks failed inside
  Docker. A Git-only Docker diagnostic reproduced that exact error; the same
  diagnostic passed from `/tmp`. The obsolete disposable test container was
  stopped and removed. This was an invocation correction, not a plugin source
  repair or product regression. Its partial log is retained as
  `.test-results/primeclaw-53-integration-combined.tap`; it is not a test-pass
  claim.
- Focused Markdown command in the same immutable offline image:
  `python3 -m pytest tests/test_future_plan_skills.py tests/test_blocked_skill.py tests/test_oversee_episode_skill.py -q -p no:cacheprovider -k 'authoring_skill_publishes or independent_backlog_authoring or task_native or integration'`:
  **6 passed, 2 failed, 40 deselected**. Log:
  `.test-results/primeclaw-53-integration-markdown.log`.
  Both failed names (`test_task_native_planning_workflows_are_exposed_without_removing_folder_compatibility`
  and `test_task_native_implementation_policies_are_publicly_activated_with_folder_compatibility`)
  fail only at installed/source workflow-byte equality and reproduce on a
  disposable Git archive of accepted main `213689359cdcae9fadb31a4f898e2dc5d0725f0f`.
  Baseline log: `.test-results/primeclaw-53-integration-markdown-main-baseline.log`.
  No local workflow refresh, global delivery or unrelated baseline repair was
  performed. This is not an all-repository-green claim.

Candidate runtime/test inputs did not change during fresh validation:
`spec-episode.ts` SHA-256 `de14fd0e1225fce457701ea319a7db1d4dff3352d7d7b3fe3aaadf322d09bd07`;
`spec_episode_extension.test.mjs` SHA-256 `26f3969907b16c813ff0c6059c95778aefcf8d405d72b3a739ba1854b8d76221`;
accepted `task-provider-migration.ts` SHA-256
`14eeb244e592007eaeaa3d53e0c37cd4280b82f6c707ca41eaaafbea97f1e6f9`.
The final diff against accepted main remains the same seven bounded PRIMECLAW-53
paths; all inherited PRIMECLAW-48/52 paths outside that slice are unchanged from
that accepted checkpoint. The renewed candidate is for owning Conversation
review, not merge acceptance or live UAT. Native task content is published
separately on `refs/heads/prime-claw/tasks` with the exact code head and direct
publication evidence. AC5/global Markdown delivery and all runtime activation
remain outside this revision.


## Accepted rollback transport noninterference repair

Renewed review reproduced a concrete defect in `f9e19a9` under existing AC3/6/9.
An actor commits local code after independent `In Progress` task publication but
before the publisher's retained HEAD check. That check correctly rejects the
changed HEAD before the caller receives its independent-history result. The
subsequent task-only `In Planning` rollback succeeds, but the caller discarded
its result and used the still-false admission flag to push parent code. The
accepted real-Git/native-Backlog/actual-push reproduction made one parent-code
push and advanced remote code with no ownership or allocation. Its accepted-main
comparison made zero parent-code pushes because the old clean-parent check
prevented rollback; restoring that check is not the fix.

The bounded caller correction captures the rollback's actual publication result
and sets the existing transport topology from `rolledBack.taskHistory` before
choosing recovery transport. No admission or native publication guard changed.
HEAD-drift rejection, exact `preAdmissionHead`, preownership code admission,
branch-local transport, Beads, and accepted48/52resource/migration paths remain.
No parent-code cleanliness/upstream requirement was restored inside independent
task-only publication. No new controller, receipt, replay state, dependency
change, or additional scope was added.

The focused caller regression lives in the existing
`tests/spec_episode_extension.test.mjs` / `independentStatusFixture`. It uses
real disposable code/task repositories, bare remotes, native Backlog, and actual
Git push; only the concurrent actor commit is injected. It requires zero parent
push attempts, unchanged remote code, a preserved local actor commit and code
snapshot, truthful independently published `In Planning` rollback, exactly two
task-path-only status commits, and zero allocation/ownership.

### Fresh validation

- Red test against unchanged `f9e19a9` runtime source: **1 failed as expected**,
  actual parent-code push count **1**. Log:
  `.test-results/primeclaw-53-rollback-red.tap`. Command uses the prior immutable
  offline runtime image `sha256:9fc302620bf7198bf3da16d5f4b8b3ade58c04d8b83350dc8c954c9f1a20011d`
  with `node --experimental-strip-types --test --test-name-pattern="rollback never pushes a concurrent" /workspace/tests/spec_episode_extension.test.mjs`.
- Fresh mandatory `TIER1_ENV_FILE=.test-results/primeclaw-53-selector.env scripts/test-tier1.sh --probe`:
  **passed**, exit 0. Manifest:
  `.test-results/20261103T233312Z-31787-a86409bc/tier1/manifest.json`;
  log `.test-results/primeclaw-53-rollback-tier1.log`. The selected unchanged
  dependency is `a1faacd53ac4473a75de1d434afaf50945c2f647`. Network absence,
  apply/check/probe success, source noninterference, and clean runtime/builder
  teardown are verified. The single startup/capture was explicitly coordinated
  for 23:32:51–23:37:51Z and its slot returned at 23:36:27Z. No second builder
  was started. A live capture inspection arrived after successful runtime
  teardown; the final manifest and image evidence prove the exact immutable IDs.
- Captured source-builder image: `sha256:5086ae5a322242c6c483515c02e34abf4a7bc6307b66d8ce313b82875c6c239e`;
  runtime image: `sha256:2a78a4451169e1c4fce560fa007c857fdb43aa6658d682119faaa581cd2eca4e`.
- Complete affected Node run: **357 passed, 0 failed, 0 skipped, 0 cancelled**
  (125,237 ms), exit 0. Log `.test-results/primeclaw-53-rollback-affected.tap`.
  Command: `node --experimental-strip-types --test` followed by the four absolute
  `/workspace/tests/` paths: `spec_episode_extension.test.mjs`,
  `task_episode_admission_extension.test.mjs`,
  `beads_task_episode_admission_extension.test.mjs`, and
  `task_episode_ownership_extension.test.mjs`. The new rollback caller case
  passed, along with dirty/divergent task-only noninterference, exact changed
  code-base rejection before ownership, and tracked-ownership/session-binding
  failure with truthful independent Blocked publication. Branch-local and Beads
  admission/recovery and ownership/resource paths are covered by these suites.
- Focused authoring Markdown: **4 passed, 33 deselected**, exit 0. Command:
  `python3 -m pytest /workspace/tests/test_future_plan_skills.py -q -p no:cacheprovider -k 'authoring_skill_publishes or independent_backlog_authoring'`
  with Docker `--env PYTHONPATH=/workspace`. Log
  `.test-results/primeclaw-53-rollback-markdown-corrected.log`. The initial
  invocation omitted `PYTHONPATH` while using `/tmp` CWD and failed during
  conftest import with `ModuleNotFoundError: No module named 'scripts'` (exit 4,
  `.test-results/primeclaw-53-rollback-markdown.log`). Corrected only the test
  environment, without a source change or another builder. The earlier two
  installed/source workflow-equality baseline failures remain historical and
  unchanged; this focused pass is not an all-repository-green claim.
- Full migration revalidation was not repeated: only existing caller transport
  selection changed, and the migration helper's SHA-256 remains
  `14eeb244e592007eaeaa3d53e0c37cd4280b82f6c707ca41eaaafbea97f1e6f9`.
  The earlier integrated499test run is historical evidence, not a new repair
  pass. No affected migration path or new migration evidence justified another
  54-minute run. All direct test containers, including the failed-invocation
  container, were verified absent after completion.

Validated runtime/test hashes remained unchanged through completion:
`spec-episode.ts` SHA-256
`f5e61e688e2b96ab079e6e6896995f568778ebf9465ec54d42b7435e5f90e316`;
`spec_episode_extension.test.mjs` SHA-256
`a587427ba2dc6044257887eee202d48aa3b4fa5c21379812fc5dde4477e3f334`.
Session transport and some ownership observations remain test seams; the focused
case uses real native task history and actual Git pushes, but is not live
Orca/daemon UAT.

All direct Docker commands use `--rm --pull never --network none`, a read-only
`/workspace` source mount and `-w /tmp`. Builder startup/capture must be explicitly
coordinated before the fresh mandatory driver. This repaired source is for
renewed owner review; publication heads are recorded in the independent task
history and the Episode report. Task status stays `In Progress`; AC5/global Markdown
delivery is pending owner acceptance. No runtime activation/restart/global
install, main merge, lifecycle/ownership edit, resource replacement or cleanup.
