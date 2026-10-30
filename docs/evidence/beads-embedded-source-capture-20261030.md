# Embedded Beads source-read proof — PRIMECLAW-44

## Scope

The original Slice 1a below is evidence-only: it tests direct native reads of a
disposable embedded/local-only Beads source. The subsequent bounded Slice 1b
integrates the inventory reads and raw capture context into production code;
its results and remaining limits are recorded at the end of this document.
Neither slice proves complete embedded-source destination publication/retirement
or authorizes a live migration. Active-provider transport requirements still
remain in the migration path.

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

At the end of Slice 1a, production integration, raw version/catalog provenance,
recaptures, ownership continuity, unsupported-projection preflight and guarded
retirement still remained. Slice 1b below advances only the capture-data portion.
No acceptance criterion for the full task is marked complete by either slice.

## Slice 1b — bounded production capture-data integration

`completeBeadsExport` now uses the strict-readonly native export and unbounded
native list inventory above instead of SQL and an unconditional configured-filter
refusal. It compares exact duplicate-free IDs and refuses actual export omissions
without clearing the source filter. A nonempty filter that omits no current
issue is accepted. The production helper is tested directly against a disposable
embedded source containing all seven built-in statuses, with no lifecycle-status,
server, remote or publication setup. This is helper-level evidence, not canonical
embedded migration admission or approval to map every captured status.

`captureBeads` now retains raw `bd --version` stdout and the entire native
`statuses --json` object in the existing snapshot digest and Backlog source
package. It uses readonly full issue views/history/events/provenance and disables
history/event limits explicitly. Existing published-server fixtures verify the
readonly/unbounded command shapes, raw version/catalog digest sensitivity, and
exact raw context in destination-native provenance comments. Unknown catalog
context is retained, not reduced to statuses used by tasks. No importer status
mapping, ownership format, receipt format or ordinary active Beads safety code
was redesigned.

Validation from the Episode worktree:

```sh
scripts/test-tier1.sh --probe
python3 -m pytest tests/test_task_provider_migration.py tests/test_beads_retiring_source_capture.py tests/test_task_providers.py -q -m container
python3 -m pytest tests/test_task_provider_migration.py tests/test_beads_retiring_source_capture.py tests/test_task_providers.py -q
```

- Mandatory Docker Tier 1: exit 0; run
  `20261030T022952Z-48070-299609c0`, offline RPC probe and apply/check passed.
- Guarded native regression bridges: **6 passed, 5 deselected**, 635.42 seconds;
  run `20261030T023343Z-62900-0aa24605`. This includes the complete migration
  suite, embedded capture proof and active-provider safety bridges.
- Host-safe static/collection check: **5 passed, 6 skipped**.
- Both run-owned `tier1/manifest.json` receipts record `passed`, no failure
  codes, network verified absent, and clean absent builder/runtime teardown.
- The native-regression input repository content SHA-256 is
  `dfd4cbf2e346840ec7f859072ddb9ccd396b88fd936bb484746f4f9848b8031a`;
  runtime image is
  `sha256:7c38a6b82a05542416d519b8383d46abd9232f8990fc91fc3797e5ebb47add4c`.
  Final task/evidence prose was updated after those tests; source and test code
  were unchanged.

**Still unfinished:** initial capture still calls active capabilities and
server/publication transport preparation. Owner-workspace rechecks and source
retirement still impose that outgoing transport contract. The closed-as-archived
branch and unsupported-used-status preflight are not fixed here. Source identity
and recapture must be carried through those seams before claiming as-is
embedded/local-only migration support. The broader destination-preservation,
layout and initialization-skill work also remains. Earlier corpus/history limits
above still apply. This is one partial production candidate for review, not full
PRIMECLAW-44 completion or merge/deployment authority.
