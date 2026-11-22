# PRIMECLAW-59 — two corrections to same-ID coexistence

This revision addresses two review findings on `7b2e386ea9b6ad8109996f8feb431e36735ce623`.
It leaves the [coexistence baseline](primeclaw-59-same-id-coexistence-20261122.md)
and the accepted parked-store increment `e4878f1` in history. See also
[project initialization](../project-initialization.md).

## Behavior and regression coverage

- A title that mentions an import marker is not an import reference. The
  preflight checks actual `references` entries and still refuses genuine
  references, receipt markers, and mappings. The title-only fixture imports
  unrelated tickets, preserves the original live/archive paths, bytes, modes,
  and native history, and lets native allocation reserve the occupied ID.
  Neither original is given a fabricated singleton native view.
- On clean selected-store replay, the preflight reads the native receipt and
  checks its bound memory USER task ID for live/archive ambiguity before
  destination preparation. The USER task need not carry import references.
  The regression checks that refusal leaves the regular root config, destination
  layout, Git state, and native task publication unchanged, with no native
  writes or retirement. Existing later receipt validation and retirement guards
  still apply. The preflight is a refusal check, not proof of reuse.

## Evidence by stage

| Stage | Tier-1 run | Result |
| --- | --- | --- |
| Published code with regression fixtures | `20261122T090523Z-56458-459fd1f4` | 10 native passes, two intended failures: the title-only marker blocked an unrelated import; the root config was relocated before refusal of the receipt-bound USER target. The standalone genuine-reference negative was not yet present. |
| Intermediate fix | `20261122T090940Z-68401-1dec25b5` | 13 native passes, one pytest pass (315.74 s), including the genuine-reference negative. This predates the final indexed ambiguity lookup and does not qualify as final-source evidence. |
| Final-source probe | `20261122T100827Z-23721-ebe2b56a` | Required tier-1 probe passed. |
| Initial combined regression | `20261122T101031Z-26591-d810dae8` | Incomplete: the log retained only `F`, with no TAP, pytest summary, or runtime teardown proof. The cause is unknown. This is not a pass or a diagnosed failure. The idle, offline container and artifacts were left untouched. |
| Final-source migration | `20261122T104351Z-60571-f58046a4` | 99 native passes, 12 retired reverse-migration skips; one pytest pass (1260.85 s). The earlier `F` did not reproduce. |
| Final-source helpers | `20261122T110528Z-85930-ae9b0837` | 20 current-state, 10 Web transport, and 89 workspace native passes; three pytest passes (186.99 s). |

The final probe and two completed regression runs share repository digest
`d3ae77d4b48719b37890cc735931651d1036dfc50a84143d6d5587c0603fe18f`.
The manifests attest to offline execution, clean runtime and source-builder
teardown, and unchanged upstream checkout inventories. All 47 listed
artifacts verified. All 223 recorded repository input hashes match the
published candidate; the three tested draft files were not edited during
publication. This evidence document was added after validation.

## Test entry points and retained artifacts

With the standard readonly source-mode `TIER1_ENV_FILE` (Prime Agent source
`a1faacd53ac4473a75de1d434afaf50945c2f647`), the validation used:

```sh
scripts/test-tier1.sh --probe
python3.14 -m pytest -q -m container \
  tests/test_task_provider_migration.py::test_task_provider_migration_node_suite
python3.14 -m pytest -q -m container \
  tests/test_task_provider_migration.py::test_beads_backlog_current_node_suite \
  tests/test_task_provider_migration.py::test_migration_backlog_web_node_suite \
  tests/test_task_history_workspace.py::test_task_history_workspace_node_suite
```

The focused baseline and intermediate runs used
`tests/test_task_provider_migration.py::test_same_id_coexistence_node_suite`.
Their logs, final input hashes, the final probe log, and the incomplete-run
record are retained under `.test-results/primeclaw59-coexistence-revision/`.
The completed regression logs (`first-failing-suite.log` and
`remaining-helper-suites.log`) and their manifests and TAP are under
`owner-diagnostic/` within that directory.

The four affected suites account for 218 passes and 12 skips, not a full-project
pass. The earlier ownership test #83 has only a static comparison against the
older source; no runtime baseline was established, and it is outside this
revision. No live migration, activation, merge, or task acceptance is implied.
