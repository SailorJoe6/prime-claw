# Embedded Beads source-read proof — PRIMECLAW-44

## Scope

This is the first, evidence-only slice of PRIMECLAW-44. It tests direct native
reads of a disposable embedded/local-only Beads source. It does **not** change
production migration, prove destination publication/retirement, or authorize a
live migration. The current migration still requires active-provider transport
and SQL inventory evidence; those changes remain in the task's living plan.

No ralph-pva, nemo-setup, builder task-store migration, user-global plugin apply,
Prime Agent restart, or upstream Prime Agent edit is part of this proof.

## Native environment and reproduction

- Docker Tier 1: `docker/test.Dockerfile` pins Beads 1.3.1 and Dolt 2.5.0.
- Prime Agent test input: the verified `cwd-fix-v0.9.8-r1` source release described
  in [the installation policy](../prime-agent-installation.md). The ordinary
  `tier1_container` fixture builds it in a disposable builder, then runs the
  native suite in the isolated, offline test container.
- Test: `tests/beads_retiring_source_capture.test.mjs`.
- Guarded bridge: `tests/test_beads_retiring_source_capture.py`.

From this Episode worktree, select the verified source in ignored `.env` as
specified by `.env.example`, then run:

```sh
python3 -m pytest tests/test_beads_retiring_source_capture.py -q -m container
```

The fixture creates a temporary Git repository and runs native `bd init` without
`--server`, custom lifecycle status configuration, a Dolt/Git remote, backup
configuration, or publication. Only fixture setup uses native writes. Every
source-capture command uses `--readonly`; `bd --version` is the version query.
`BD_JSON_ENVELOPE=0` makes the tested legacy native JSON shape explicit.

## Read path under test

The independent inventory uses all inclusion flags and disables the list limit:

```sh
bd --readonly list --all --limit 0 --include-infra --include-templates --include-gates --include-ephemeral --json
bd --readonly export --all
bd --readonly show TASK-ID --json --long --include-comments
bd --readonly history TASK-ID --json --limit 0
bd --readonly history TASK-ID --events --json --limit 0
bd --readonly provenance log TASK-ID --json
bd --readonly statuses --json
bd --readonly context --json
bd --readonly where --json
bd --readonly dolt show --json
bd --readonly dolt remote list --json
bd --version
```

These are native read capabilities, not a new production capture authority or a
persistent snapshot service. The test compares exact unique IDs across native
inventory and export. It then checks every issue's native view, issue history,
events and provenance. Native history retains the capitalized `CommitHash`,
`Committer`, `CommitDate`, and `Issue` keys. Provenance payload remains an opaque
native string. Raw catalog rows retain names, categories, descriptions and icons
where provided; they are not replaced by canonical Prime Claw status names.

The seeded corpus has seven issues covering all seven built-in statuses. It
includes an ordinary completed `closed` child with its exact `close_reason`, a
parent with multiple field revisions, a parent relationship and blocking
relationship, opaque metadata, a label, a comment, and provenance. Assertions
check historical values, not only nonempty history. The seeded relationships
are checked in export; comments and metadata are checked in both export and
direct views.
A second fixture uses a partial custom catalog and proves catalog-only drift is
visible. A configured export-owner filter remains untouched and produces a
precise inventory/export mismatch instead of silently omitting the issue.

Repeated strict capture must equal the first logical capture, and source config
and metadata bytes must remain unchanged. Native location evidence supplies the
actual embedded data directory rather than assuming the server `.beads/dolt`
layout.

## Runtime evidence

The guarded regression passed: **1 Python bridge passed**, containing **2
native Node tests**, in 114.94 seconds. The suite asserts all the native data
properties described above; its successful exit is required by the bridge.
The host-safe collection/static check also passed with **2 passed, 2 skipped**:

```sh
python3 -m pytest tests/test_beads_retiring_source_capture.py tests/test_task_provider_migration.py -q
```

Run-owned provenance: `.test-results/20261030T011041Z-3867-acbbb0fc/tier1/manifest.json`
(ignored local evidence). The manifest records:

- source-mode test run: `passed`, no failure codes;
- tested repository content SHA-256:
  `7cd47144e94d172d207dcb3b6002d578aaa15cc32a8acd33037b4c545f4a1d0d`;
- immutable runtime image:
  `sha256:a0643345237047a34ccb73ff130ef05bba712201eed200f714886e6b09ed3da2`;
- runtime network set: verified absent before tests;
- source builder and runtime: teardown clean and state `absent`.

The exploratory run and first two regression attempts were nonzero and retained
in their run-owned evidence directories. They exposed test setup assumptions,
not a requirement to change the source engine or weaken its native rules:

| Run | Finding | Test correction |
| --- | --- | --- |
| `20261030T010119Z-66201-239da699` | Hardcoded server data directory does not exist in embedded mode | Use native context/data-dir evidence |
| `20261030T010553Z-84563-15f9819e` | A child cannot also block on its hierarchy ancestor; email is not the native export-owner key | Use a separate blocker and native `created_by` |
| `20261030T010827Z-94921-d44f9423` | Native close refuses an unresolved blocking edge | Put the blocking edge on the separate blocked issue; close the ordinary child without force |

A read-only source audit also corrected the event assertion: a transaction that
changes status and description emits native `status_changed`, not `updated`.
All three failed runs record clean, absent container teardown. The final run
validates the corrected fixture and capture assertions end to end.

The initial disposable capability probe confirmed embedded issue/history/event/
provenance reads and no configured Dolt remotes. It also confirmed the current
migration's SQL command fails in embedded mode:

```text
Error: 'bd sql' is not yet supported in embedded mode
```

That exploratory run ended nonzero on its own directory assumption: it tried
`.beads/dolt`, while native evidence reported `.beads/embeddeddolt`. No source
conversion or server start is required to address that test-only assumption.

## Limits and next implementation boundary

This small corpus is not proof of every infrastructure/template/gate/ephemeral
variant, default pagination beyond 50, all historical relationship revisions,
all possible native data corruption, or a full Dolt database backup. `bd history`
returns issue snapshots; it must not be described as all-table Dolt history.
The export filter test demonstrates refusal, not a production filter bypass or
an approved source-configuration change. Unsupported statuses are captured for
inventory evidence; this does not approve their projection to Backlog.

The remaining implementation must integrate source-read evidence with the
existing in-memory capture and destination provenance; bind version/catalog and
stable recaptures; preserve ownership continuity and quiescence; keep ordinary
active Beads lifecycle/write checks strict; preflight unsupported projections;
and prove verified/published Backlog content before guarded source retirement.
No acceptance criterion for the full task is marked complete by this slice.
