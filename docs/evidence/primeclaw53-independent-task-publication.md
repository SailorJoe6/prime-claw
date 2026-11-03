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
