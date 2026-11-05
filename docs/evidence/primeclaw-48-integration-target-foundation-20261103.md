# PRIMECLAW-48: integration-target ownership foundation

Date: 2026-11-03. Status: bounded implementation slice, not stacked-PR acceptance.
Task: `PRIMECLAW-48`. Admission code base: `32a02232b65dffc2a51660661e38dc05cc289f5b`.

## Delivered boundary

This slice implements plan step 2. Version-2 ownership can retain an optional
`integrationBranch` across the parser, all three reservation factories, provider
switching, and evidence/runtime-route refresh. Native Git validates explicit
branch names. The effective-target helper returns `main` only for an omitted
field; it does not inspect a checkout. Existing active ownership cannot change
its effective target, including by deleting a feature target. Missing and explicit
`main` remain compatible. Version-1 ownership still rejects the task-only field.

The existing public admission callers remain main-only. No live owner record is
rewritten. This does not yet permit a stacked Episode. Fresh branch capture and
coherent continuation/blocked/review/terminal-cleanup target handling are the next
implementation slice. The skill-only user check-in is also pending. None of the
whole-task acceptance criteria is claimed complete by this foundation alone.

## Reproduction and actual results

Use the documented Docker test interface with `TIER1_ENV_FILE` selecting a verified
read-only `cwd-fix-v0.9.8-r1` source checkout. The local selector used here is
`.test-results/primeclaw-48-binding-slice1/source.env`. It contains no credentials.
Source identity was verified before testing: annotated tag object
`8ca4d5c39b7c738f71b5c86422ea46394c3d0558`, commit
`a1faacd53ac4473a75de1d434afaf50945c2f647`, tree
`5301c70d9c9d74e474ccaf258fdd3c8de982c52f`, and lockfile SHA-256
`3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74`.
The source remote is the documented public `SailorJoe6/prime-agent` fork and the
source checkout was clean. No Prime Agent source change was made.

| Command | Result | Local evidence |
| --- | --- | --- |
| `scripts/test-tier1.sh --probe` | Exit 0; offline apply/check and RPC probe passed; teardown verified; manifest published | `.test-results/primeclaw-48-binding-slice1/tier1-probe.log`; `.test-results/20261103T184113Z-62440-fcbcc1a5/tier1/manifest.json` |
| `python3 -m pytest tests/test_task_providers.py tests/test_reviewed_plan_extension.py::test_task_episode_ownership_node_suite tests/test_reviewed_plan_extension.py::test_spec_episode_node_suite tests/test_reviewed_plan_extension.py::test_episode_close_node_suite -q -m container` | 7 passed, 3 deselected; 356.25 seconds | `.test-results/primeclaw-48-binding-slice1/focused-container.log`; `.test-results/20261103T184121Z-63056-69b1f777/tier1/manifest.json` |
| `python3 -m pytest tests/test_task_providers.py tests/test_reviewed_plan_extension.py -q` | **Not green:** 1 failed, 11 passed, 10 skipped | `.test-results/primeclaw-48-binding-slice1/focused-static.log` |
| `git diff --check` | Passed | Slice working-tree diff |

The static failure is
`test_repository_status_cutover_uses_task_native_order_without_to_do`: it reads
`backlog/config.yml`, which is absent in this independent `.backlog` topology.
The test file is byte-for-byte unchanged from the admission base, and that base
tracks neither `backlog/config.yml` nor `.backlog/config.yml`. The actual config
is in the ignored independent `.backlog` clone. This slice does not add a symlink,
change store topology, fix that unrelated test, or claim a fully green static
suite. No baseline execution in a separate checkout is claimed.

Both Docker runs captured the same candidate repository content hash
`aae13124f2eb03e6044c94642ce7181d93090c2bd2b92a7e92fb7d303b0b9fad`
(`framed-sha256-v2`). The probe image is
`sha256:239028f15b445800ae2ef3370b23d7c6f4ee170db88bceed34b8ee2c6409ac10`;
the focused-suite image is
`sha256:e17733846664a3c6f6ba69018c9ca3ff5e6d10511111e4b894efe57dcb720619`.
Both manifests prove network absence and clean, verified container teardown.

## Focused behavioral evidence

`tests/task_episode_ownership_extension.test.mjs` adds representative cases for:

- exact feature and non-main default branch names across each version-2 shape;
- omitted-field fallback without rewriting existing ownership;
- malformed explicit branch refusal and unchanged version-1 authority;
- explicit-target round trips through branch-local Backlog, independent Backlog,
  and Beads reservations, while retaining old callers;
- active effective-target immutability, including field deletion;
- compatible explicit/implicit `main` identity.

Existing provider-switch, rollback, fresh-route, and Beads evidence-refresh cases
now also prove that the target survives those updates. The existing admission,
provider, legacy Episode, and close suites pass through their Docker bridges.
These tests do not exercise new non-main public admission. They add no LLM
check-in compliance test or deterministic user-confirmation mechanism.

Executable input SHA-256 values:

- `src/prime-agent-plugin/extension-support/episode-ownership.ts`: `19d2ea7f86fa68345c331f894943aa64a8078b770ddae9b0f1b4fc404d5a9017`
- `src/prime-agent-plugin/extension-support/task-episode-ownership.ts`: `c5107e7e5c0ec0de3b91c61932d32c9efdbd962c30ac9733d2ff8ca932e62530`
- `tests/task_episode_ownership_extension.test.mjs`: `24b29797eb130dbad724e1f7595c5f1e35840a29eec37c771fd6d8c99a25fb20`

## Publication and remaining authority

The code slice and native task notes are published separately on the Episode
code branch and `refs/heads/prime-claw/tasks`. Exact heads are reported in the
native task and to the owning Conversation. Task status remains `In Progress`.
No merge, abandonment, Ready-for-Merge/Done publication, host/global apply/check,
restart, live ownership migration, foreign task change, or Episode finalization
is performed. The primary-main user-global activation policy is unchanged.
