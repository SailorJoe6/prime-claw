# PRIMECLAW-59 — current-state source capture (slice 1a)

This source increment implements only the capture part of plan step 1. It is not
a complete migration candidate, live migration approval, or activation evidence.

## Changed behavior

Beads inspection and every primary/active-Episode recapture now read complete
current export rows, an independent issue inventory, and exact long task views
with actual comments. They retain native store/database/connection identity,
raw version/catalog, current metadata/relationships and memory content in the
content-bound `capture-sha256:` revision. They do not issue per-ticket `history`,
`history --events` or `provenance log` commands or include those datasets in the
source package. Required current output remains file-backed and uncapped.

Existing Backlog history/baseline preservation and outgoing remote-history
retention are unchanged. An old history-bound revision/receipt is not silently
accepted as current-state proof.

## Explicit limits

The forward writer still encodes the reduced current-data package into comments
and repeats source context. Removing that package and implementing readable
native projection/readback is the next part of step 1/step 2, not a completed
claim here. Destination coexistence/configuration, interrupted-import recovery,
ordinary cancellation, progress/performance acceptance and final documentation
remain unfinished. No acceptance criteria are marked complete by this slice.
Do not retry a live migration with this intermediate candidate.

## Validation

All native/plugin execution used disposable Docker resources. No host plugin
apply/check/probe or Prime Agent source changes ran. The accepted source input
was read-only `cwd-fix-v0.9.8-r1` at commit
`a1faacd53ac4473a75de1d434afaf50945c2f647`, with the documented tag object,
tree and lockfile hash verified. Candidate source publication is not deployment.

- `python3.14 -m pytest tests/test_task_provider_migration.py -q`: **2 passed,
  7 skipped** (static only).
- `scripts/test-tier1.sh --probe`: **passed**, including offline apply/check,
  RPC probe, verified teardown and manifest publication. Evidence:
  `.test-results/20261121T013016Z-6550-24967c0a/tier1/manifest.json`.
- The broad focused run completed with **3 bridges passed, 1 failed**. The
  failed source-boundary bridge was the known stale fixture described below;
  the remaining native suites passed: admission **15/15**, lifecycle/archive
  preflight **3/3**, populated Backlog **19/19**. Its verified-clean teardown
  and TAP files are under
  `.test-results/20261121T013313Z-18332-82054172/tier1/`.
- The fresh corrected source-boundary bridge **passed 23/23 native checks**
  (`1 passed, 8 deselected` at the pytest layer). Final source-boundary evidence:
  `.test-results/20261121T014558Z-69468-aced30c5/tier1/manifest.json`
  and `retiring-beads-source-boundary-node.tap`. Network absence and clean
  teardown were verified. Across the four selected bridges, **60 native checks
  passed**; the corrected bridge supersedes only the stale fixture failure,
  not the historical evidence.
- Paired isolated source regressions: **2 failed against pre-change code**
  (historical commands and history-bound digest), then **2 passed** with the
  changed module and corrected independent relationship target. Logs:
  `/tmp/primeclaw-59-slice1a-red.tap` and
  `/tmp/primeclaw-59-slice1a-green-fixed.tap`.

The tests cover no historical reads through capture/confirmation/recapture/replay;
current comment/relationship/metadata/raw export digest changes; source drift
refusal; active Episode continuity; and a 2,610,950-byte multibyte current native
view plus ENOBUFS/ENOSPC/EIO and bounded private-safe capture failures.

One initial focused run stopped before tests at builder image inspection: its
Buildx IID was not inspectable by the local daemon. A disposable diagnostic build
with `BUILDX_NO_DEFAULT_ATTESTATIONS=1` returned a directly inspectable exact IID;
the focused retry uses that environment setting without changing fixture checks.
The first broad snapshot also included an invalid fixture edge to a descendant;
it correctly failed native cycle preflight. The test now targets a separately
created independent task. No product guard was weakened for that fixture repair.

## Reproduction

Use the supported read-only source selector through `TIER1_ENV_FILE` as described
in `docs/prime-agent-installation.md`. The focused fixture invocation also set
`BUILDX_NO_DEFAULT_ATTESTATIONS=1` for the local Docker IID issue above.

```sh
scripts/test-tier1.sh --probe
python3.14 -m pytest tests/test_task_provider_migration.py -q -m container -k "retiring_beads_source_boundary_node_suite or beads_status_archive_preflight_node_suite or migration_entry_admission_node_suite or populated_backlog_migration_node_suite"
```

The broad run captured the old relationship fixture before its correction. The
final corrected invocation was:

```sh
python3.14 -m pytest tests/test_task_provider_migration.py -q -m container -k retiring_beads_source_boundary_node_suite
```

These are source-capture/compatibility checks, not the full PRIMECLAW-59 recovery,
cancellation, readable-output or representative 406-ticket performance proof.
