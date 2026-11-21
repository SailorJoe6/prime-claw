# PRIMECLAW-59 — forward/replay readable current-content integration

Date: 2026-11-21. Status: tested candidate; independent owner review pending.
This is one bounded steps 1–2 increment, not full-task acceptance or live authority.

## Scope

The accepted current-source capture, owned native Web transport and repaired
readable-content helper are integrated into forward import and complete-receipt
same-destination replay. The forward source-package producer, base64 chunk
comments, repeated whole-source context and archive-package verifier are removed,
not relocated. Current fields and meaningful unknown metadata remain readable;
actual authored comments keep their source author/time. Initial native references
identify source tasks before later writes. Initial store/connection identity lives
once in the existing destination-native receipt. Memory documents/index/USER
remain separate and once-only.

Parent-first native POST/current-comment PUT authoring uses the accepted full
verifier. Mapped dependency batches and native archive placement get full final
CLI readback. The same projection checks reused records before writes, published
data, refresh and fresh complete-receipt replay. Configured priority/type arrays
come from the existing native GET /api/config, without lossy comma splitting;
receipt and USER bookkeeping use a valid configured type. Actual source comments
that resemble metadata are not treated as receipt/legacy bookkeeping when the
native task has its current source binding.

One migration-owned browser is shared across fresh replay and forward import.
Exact selected project/store readiness, private file-backed input/results and
BACKLOG_CWD pinning remain. Synchronous migration Backlog calls pin and restore
their ambient context too. Owned server/readback children stop before publication
or cutover; early replay failures close the same owned resources. Uncertain
allocation/write/readback stops without resend, fallback allocation, completion,
reconciliation, rollback or record cleanup. Existing baseline/originals,
publication/receipt, source recapture/drift and active continuity/cutover guards
remain in place.

## Validation

All plugin/native checks ran in disposable Docker through the existing tier-1
fixture and driver. Logs and input hashes are under
`.test-results/primeclaw59-current-integration-20261121/`.

- Final full native migration sweep: **1 pytest passed, 11 deselected** in
  1028.54s; **71 native TAP checks passed, 0 failed, 12 skipped** (83 total).
  The skips are existing retired reverse-migration cases; explicit reverse
  no-command refusal is still tested.
  `.test-results/20261121T050501Z-78066-1e3c6741/tier1/manifest.json`.
- Corrected-fixture focused run: **1 pytest passed, 11 deselected** in 277.99s;
  **8 native TAP checks passed**. It covers AC/comment drift with initial
  references retained, configured comma-bearing types/priorities and memory USER,
  metadata-shaped source-comment replay, partial-write STOP/no duplicate, and
  source/workspace/readback refusal.
  `.test-results/20261121T045940Z-57077-4ff6fae2/tier1/manifest.json`.
- Shared current-content/Web/layout/initialization checks: **219 passed**
  (20 + 10 + 89 + 88 + 12) on the same final production source. The full run
  initially failed only its subsequently repaired configured fixture, as retained
  below. No shared-suite failure is hidden by the later focused/full reruns.
- Required `scripts/test-tier1.sh --probe`: **passed** on final production source,
  `.test-results/20261121T044323Z-94227-658aec2e/tier1/manifest.json`.
- Final host-safe static migration bridge: **2 passed, 10 skipped** in 0.04s;
  skipped native bridges are Docker-only.
- **112 manifest-listed hashes across seven retained runs** were recomputed and
  matched. Every manifest proves network absent and clean runtime and
  source-builder teardown. Final five source/test input hashes still match.
  Manifests capture pre-commit working trees based on `06555ad70a91a1f2b3e7107cba0334a84221d6e7`;
  documentation was finalized after tests. No production code changed after the
  final-source probe.

Reproduction commands (with the configured tier-1 source selector):

```sh
python3.14 -m pytest tests/test_task_provider_migration.py -q -m container -k task_provider_migration_node_suite
python3.14 -m pytest tests/test_task_provider_migration.py -q -m container -k current_native_migration_integration_node_suite
python3.14 -m pytest tests/test_task_provider_migration.py tests/test_task_history_workspace.py tests/test_project_initialization.py -q -m container -k "task_provider_migration_node_suite or beads_backlog_current_node_suite or migration_backlog_web_node_suite or task_history_workspace_node_suite or project_initialization_node_suite or project_initialization_active_backlog_node_suite"
scripts/test-tier1.sh --probe
python3.14 -m pytest tests/test_task_provider_migration.py -q
```

Final input SHA-256:

| Input | SHA-256 |
| --- | --- |
| `src/prime-agent-plugin/extension-support/task-provider-migration.ts` | `832db7c0939d64e12bf406d47bab14d2b476d61def5081ff7e9c9be74bb29f39` |
| `src/prime-agent-plugin/extension-support/migration-backlog-web.ts` | `10cff65437e4c976f24f84d892a398b26772178636be566b7394324d26a7274b` |
| `tests/task_provider_migration.test.mjs` | `f4b5550f0b9e4e495f5c7bbfbd9efc04769a9e8a3751211d5daca24f8e14e542` |
| `tests/migration_backlog_web.test.mjs` | `8ad39fe128b59c7cb94607bc69b12ebfc9bd60da359fb2e6a5299b057467e95e` |
| `tests/test_task_provider_migration.py` | `bbd48c9489c5312015afd17ae2cbf5f4eacb520ced4aaa55170d6bee9969c804` |

Tests add meaningful 2,610,950-byte UTF-8 metadata with complete padding/tail,
real-native current-content mapping and exact values, full receipt replay drift
refusal with source references retained, and controlled accepted-comment response
failure followed by no next task/receipt/cutover and no duplicate on explicit
partial re-invocation. The latter wraps a real successful native HTTP response;
it is not ordinary importer cancellation or a real lost-response claim.

### Completed intermediate checks

- Preliminary native run: **1 pytest failed, 2 passed, 8 deselected** in
  909.49s. Migration TAP: **68 passed, 2 failed, 12 skipped** (82 checks).
  Failures: a new fixture attempted an empty Git commit; the changed STOP advice
  omitted the existing command/capture/resource guidance. The fixture now commits
  only actual changes; actionable resource guidance remains alongside STOP and
  no automatic resend/cleanup. Artifacts:
  `.test-results/20261121T042544Z-26770-0295c878/tier1/`.
- Latest full migration plus shared run: **1 pytest failed, 5 passed,
  19 deselected** in 1019.44s. Migration TAP: **70 passed, 1 failed,
  12 skipped** (83 checks). The only failure was the new configured-value test
  fixture overwriting the native `.gitignore`, losing the Beads lock ignore.
  The test-only repair appends the Backlog ignore without replacing existing
  entries. Production guards and source remain unchanged. Artifacts:
  `.test-results/20261121T044322Z-94135-cdb067e8/tier1/`.
- The same latest run passed current-content helper **20/20**, owned Web **10/10**,
  task-history workspace **89/89**, initialization extension **88/88** and active
  Backlog initialization **12/12**. These are native TAP checks, not migration
  runs. Its real partial-write/no-next/no-duplicate and foreign-context regression
  passed; the 2,610,950-byte integration, full replay drift, native archives,
  continuity, publication, originals and shared resource-failure checks passed.
- Required probe on final production source passed:
  `.test-results/20261121T044323Z-94227-658aec2e/tier1/manifest.json`.
  Earlier probes at `20261121T042544Z-27138-3e9463ad` and
  `20261121T043119Z-48696-fe161fa5` also passed but predate final source repairs;
  they are not substituted for the final-source probe.
- All **82** manifest-listed hashes across those five runs were recomputed and
  matched. Every manifest proves network absent and clean runtime/source-builder
  teardown. The earlier host-safe static bridge passed **2 checks, 9 skipped**;
  the final bridge and corrected-fixture/full green reruns are recorded above.
  Failures remain retained as intermediate evidence, not final acceptance.

## Limits and authority

No full responsive-worker/ordinary cancellation, automatic interrupted recovery,
parked-config/coexistence reconciliation, live progress or 406-ticket performance
acceptance is claimed. Existing native synchronous commands still block their
caller. No live migration/retry/provider switch, private incident-data access,
cleanup, merge, host plugin apply/check/activation/restart, provider or Prime Agent
source changes, new Episode resources/assignment, or lifecycle finalization.
Native PRIMECLAW-59 remains In Progress, all nine AC unchecked, Final Summary null.
Stop after this tested, documented, separately published slice for owner review.

## Publication

Native task progress was published separately at
`42f106e494a9f3b508e088824c337d1df5604155` on `refs/heads/prime-claw/tasks`.
Direct remote-head proof and complete native reread matched the intended update;
only plan, appended notes, documentation, modified paths and generated timestamp
changed. ID/path/parent, In Progress, all nine unchecked AC and null Final Summary
remain unchanged. The Episode code candidate is published separately; its exact
head accompanies the owner report. This report is evidence, not owner acceptance.
