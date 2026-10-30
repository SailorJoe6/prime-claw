# Embedded Beads source-read proof — PRIMECLAW-44

## Scope

The original Slice 1a below is evidence-only: it tests direct native reads of a
disposable embedded/local-only Beads source. The subsequent bounded Slice 1b
integrates the inventory reads and raw capture context into production code;
its results and remaining limits are recorded below. Slice 1c subsequently
integrates the migration-only source identity/capture boundary through rechecks
and local retirement. These are bounded increments, not full-task acceptance
or authority for a live migration. Each slice's evidence and limits remain
separate below.

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


## Slice 1c — as-is source boundary through guarded local retirement

Migration-only `captureBeads` no longer calls active lifecycle capabilities or
workspace transport/publication preparation. It binds strict-readonly native
`context --json` and `dolt show --json` to the selected real store, canonical
repository, database and mode. The existing capture digest now includes stable
store/connection identity as well as raw version, complete catalog and complete
issue/view/history/event/provenance packages. The source confirmation revision
is `capture-sha256:<digest>`, explicitly a stable capture token rather than a
required outgoing Dolt publication. No persistent snapshot/controller is added.

Per-invocation cwd/worktree flags and transient connection health are excluded
from identity comparison. Each active source Episode resolves the same native
store from its own worktree and repeats the complete capture, so primary and
linked source identity/data must agree. Existing code ancestry/publication,
quiescence, exact owner records, runtime continuity and destination publication
checks remain unchanged and repeat through ownership cutover and deletion.

Guarded retirement removes the exact local `.beads` authority only after those
proofs. Embedded retirement invokes no server command. A server-mode source must
positively identify a non-shared server before native `bd dolt stop`; a shared
or unidentified server refuses safe local retirement. Outgoing remote history
is neither required, pushed, inspected nor deleted by Beads-source retirement.
A disposable regression explicitly preserves an existing `refs/dolt/data` ref.
The ordinary active Beads lifecycle/write safety implementation in
`task-providers.ts` is unchanged.

### Focused native proof

```sh
python3 -m pytest tests/test_task_provider_migration.py::test_retiring_beads_source_boundary_node_suite -q -m container
```

Result: **1 passed in 199.06s**, guarded run
`20261030T032024Z-1760-ab5529fd`. Its manifest records `passed`, no failure codes,
network absent and clean absent runtime/builder teardown. The focused bridge
runs the real native cases for:

- Built-in-only and partial-custom embedded/local-only source inspection, stable
  repeated capture and unchanged source authority bytes.
- Confirmed migration of supported open/in-progress/blocked issues into a fresh
  Backlog store, publication before local retirement, exact raw source packages,
  and compatible active-Episode ownership/runtime/code continuity.
- Mismatched linked source identity and unreadable required history refusal
  before destination creation, with source authority intact.
- Task and catalog drift between proofs, with no source deletion or ownership
  cutover.
The earlier focused snapshot did not establish the subsequently revised fresh
independent Backlog fixture. The corrected focused bridge subsequently passed
**1 test in 228.79s**, run `20261030T035346Z-1826-039dfdf6`, including that exact
fixture and all source-boundary groups above. Its manifest records `passed`,
network absent and clean absent builder/runtime teardown. The fixture retains
independent Backlog source-ref retirement coverage through a fresh legacy reverse
setup, then proves approved forward retirement preserves outgoing Dolt history
and exact actual operator/project ignore bytes.

Intermediate runs `20261030T032353Z-12829-6c5116df`,
`20261030T033733Z-53633-acf0c352`, and `20261030T034917Z-87991-bf079225`
exposed only revised fixture setup/expectation errors: missing local author in
the nested test clone, an uncommitted generated `.gitignore` projection, and an
ordinary-ignore-block assumption for a source seeded by `bd init --stealth`.
Corrections are confined to fixture seeding and exact input-byte expectations.
No production safety gate was bypassed and no host/global Git identity was set.
Each failure output is retained in its run-owned
`tier1/migration-pytest-output.txt`; final full validation is recorded below.

The embedded fixture removes an origin automatically adopted by native `bd init`
during **fixture seeding only**, before the guarded immutable source read. The
migration runner forbids source configuration writes, SQL, remote/server commands
and access to `refs/dolt/data`; only unchanged provider-discovery reads are
allowed outside strict-readonly data calls. The initial run
`20261030T030741Z-62503-fdb70b76` failed before new embedded identity checks because
that fixture remote was unexpectedly present; its output is retained under
`tier1/migration-pytest-output.txt`. It also exposed an old unrelated reverse
recreation expectation that depended on deleting outgoing Beads publication.
The revised fixture preserves independent Backlog source-ref retirement
coverage without recreating unrelated Beads history over a retained source ref.
No production reverse importer rewrite or source publication deletion was added.

**Limits:** this proves one bounded source-as-is boundary, not all of plan steps
1–2 or the complete migration contract. Unsupported-used-status preflight and
ordinary closed versus positively evidenced archive classification are still
unfinished and remain required before full acceptance. The fresh destination
fixture does not prove merging into populated Backlog stores, default/custom
layout normalization or the initialization skill/text-patch flow. Full-corpus
history coverage remains limited as noted above. No live store migration,
merge, deployment, global activation, settings/model or upstream edit occurred.


### Final Slice 1c regression evidence

```sh
scripts/test-tier1.sh --probe
python3 -m pytest tests/test_task_provider_migration.py::test_retiring_beads_source_boundary_node_suite -q -m container
python3 -m pytest tests/test_task_provider_migration.py tests/test_beads_retiring_source_capture.py tests/test_task_providers.py -q -m container -k "not retiring_beads_source_boundary"
python3 -m pytest tests/test_task_provider_migration.py tests/test_beads_retiring_source_capture.py tests/test_task_providers.py -q
```

- Mandatory Tier 1: exit 0, run `20261030T030649Z-59705-61731a7e`.
  Production code was unchanged after this pass; subsequent repairs were test
  fixture seeding/expectations only.
- Corrected focused native bridge: **1 passed in 228.79s**, run
  `20261030T035346Z-1826-039dfdf6`.
- Complete native migration/capture/active-provider bridge set:
  **6 passed, 6 deselected in 679.38s**, run
  `20261030T035741Z-13439-340dd01f`. The selector excludes only the duplicate
  focused Python bridge plus ordinary host-safe checks; the complete migration
  Node suite still executes every source-boundary and independent-history case.
- All three final receipts record `passed`, no failure codes, network verified
  absent and clean absent builder/runtime teardown in their run-owned
  `tier1/manifest.json`.
- Final full regression repository content SHA-256:
  `028e8ed0381c93739d54045097416ea8d014419faebf4ab7ed62c6c0b189b7da`.
  Runtime image:
  `sha256:76b2da2595b8ae79ecb8d3391e405171e1b77a75b548d2911a8440aa207de51e`.
- Host-safe targeted inventory/structural checks: **5 passed, 7 skipped**.
  Final task/evidence prose was updated after tests; production/test bytes were
  not changed after the final full native run started.

This is a bounded candidate for separate Conversation review. All full-task
Acceptance Criteria remain unchecked. In particular, no unsupported-status
projection, ordinary closed/archive correction, populated Backlog preservation,
layout normalization, skill-led flow or live migration acceptance is claimed.
Shared/external server retirement is not newly established by this fixture.


## Slice 1d: used-status preflight and exact archive evidence

Implemented and Docker-validated as one bounded continuation of existing plan
step 2, for separate Conversation review. This is not full-task acceptance.

The source read must inspect every actually used status before Backlog
preparation or writes. Unsupported statuses are reported together with exact
source IDs/statuses; unused catalog definitions do not block. Existing
`statusFromBeads` projections remain unchanged: legacy `open` becomes `In Design`
and ordinary `closed` becomes `Done` with physical `completed/` placement.

Archive is not inferred from a nonempty reason, keywords or catalog category.
The existing exact positive formats are:

- A coherent retained `prime_claw_migration` source package with the existing
  source marker, Backlog source identity, explicit `archived` classification and
  matching archived task/draft placement/native task identity.
- The complete task-specific reason already emitted by Prime Claw:
  `Prime Claw abandonment: task TASK-ID; pushed Episode head HEAD; code was not merged.`
  `HEAD` is a lowercase 40–64-hex Git object name.

These signals apply to native `closed` records. Contradictory/malformed marked
archive evidence, or an archive signal on a nonclosed record, requires a bounded
agent/operator decision; it must be reported alongside unsupported-used-status
records before destination mutation. Arbitrary metadata and ordinary closure
reasons are not such evidence. This adds no new mapping, semantic-placement API,
classifier or approval mechanism.

Ordinary completion uses the existing projected `Done` status and native
`task complete`. Native Backlog refuses archiving a `Done` task; exact-positive
archives therefore retain the existing importer's native archive operation and
its created `In Progress` status, with physical `archive/tasks/` placement and no
`task complete`. This does not restore an inferred historical lifecycle or add a
new status mapping. Both native status and actual physical placement are checked
for every record. Verification uses actual walked files, not the temporary path
reported while a disposable clone reads an archived task. Raw source status,
catalog/category, reason, history/events/provenance remain in the complete source
package and stable recapture.

### Focused native proof and corrections

```sh
python3 -m pytest tests/test_task_provider_migration.py::test_beads_status_archive_preflight_node_suite -q -m container
```

The corrected focused bridge passed **1 test in 184.28s**, run
`20261030T043053Z-17384-99ccd474`. Its manifest records `passed`, no failure
codes, network absent and clean absent builder/runtime teardown. The two actual
Node groups prove:

- Inspection and confirmation capture report every used unsupported
  `deferred/pinned/hooked/finished:done/paused:wip` issue and contradictory exact
  archive record with exact IDs/statuses, with no destination directory or source
  change. Unused catalog definitions do not block.
- Nine-task embedded/local-only migration produces counts
  `open=3, closed=3, archived=3`; ordinary reasons/keywords/nonarchive metadata
  complete normally, while exact native abandonment and retained task/draft
  archive packages use native archive placement. Native views and physical paths
  agree, full raw version/catalog/export/view/history/events/provenance survives,
  and Backlog is published with source intact before local retirement.

Initial focused run `20261030T042733Z-7447-60dbe7ae` passed the preflight group
but failed migration because native Backlog prohibits archiving `Done`. This was
an integration mistake in the agent's initial status-first implementation, not a
fixture-only issue. The correction preserves the existing importer archive
operation/status and verifies it; no native guard was bypassed or new mapping
policy introduced. Failure output is retained in that run's
`tier1/migration-pytest-output.txt` and its teardown is clean/absent.

Initial Tier 1 `20261030T042455Z-97932-4e2f35df` passed before that correction.
The next probe run `20261030T043053Z-17490-d2a3492d` failed in the source builder
before plugin/runtime checks; its `source-build.json` records `builder-failed`,
null release/image and absent clean not-needed builder teardown, while setup
records `manifest-failed` with no final manifest. The bounded cause is not
established; upstream checkout inventories stayed identical and no config,
upstream or test-driver change was made. A serialized probe rerun follows the
successful corrected focused test.

The serialized mandatory probe subsequently passed, exit 0, run
`20261030T043404Z-27562-5486de10`. Its final manifest records `passed`, no
failure codes, network absent and clean absent builder/runtime teardown. The
corrected focused test and this final-source probe used unchanged production/test
bytes. The complete selected migration/capture/active-provider bridge set is
running before publication; it excludes only the two duplicate focused Python
bridges while its full Node suite remains unfiltered.

### Final Slice 1d regression evidence

```sh
scripts/test-tier1.sh --probe
python3 -m pytest tests/test_task_provider_migration.py::test_beads_status_archive_preflight_node_suite -q -m container
python3 -m pytest tests/test_task_provider_migration.py tests/test_beads_retiring_source_capture.py tests/test_task_providers.py -q -m container -k "not retiring_beads_source_boundary and not beads_status_archive_preflight"
python3 -m pytest tests/test_task_provider_migration.py tests/test_beads_retiring_source_capture.py tests/test_task_providers.py -q
```

- Corrected focused native bridge: **1 passed in 184.28s**, run
  `20261030T043053Z-17384-99ccd474`.
- Corrected mandatory Tier 1 probe: **exit 0**, run
  `20261030T043404Z-27562-5486de10`.
- Complete selected migration/capture/active-provider bridge set:
  **6 passed, 7 deselected in 723.12s**, run
  `20261030T043539Z-32429-a5620c7e`. The full Node migration suite is
  unfiltered and includes the new status/archive groups; only duplicate focused
  Python bridges and host-safe checks are deselected.
- All three final manifests record `passed`, no failure codes, network verified
  absent and clean absent builder/runtime teardown.
- Full regression repository content SHA-256:
  `918b2a314df06aae3ab4630735fbe88211113e97edc862d1a44f91a2a325eccf`.
  Runtime image:
  `sha256:a2dfa58e75e327fcfbd3015d42f10b2c364cb2e5e6b4b9ae6fa34652aa66f0e4`.
- Host-safe targeted structural checks: **5 passed, 8 skipped**.
- Production/test bytes were unchanged after the corrected focused run began.
  Final task/evidence prose was updated after tests.

**Limits:** this is one bounded status/preflight/native-placement candidate, not
completion of steps 1–2 or all task criteria. Unsupported statuses remain refused,
not assigned guessed projections. Exact-looking contradictory archive evidence
requires bounded agent/operator resolution; no new task-specific placement API,
semantic classifier or approval mechanism was added. The existing importer is
retained, including native `In Progress` archive status rather than a prohibited
`Done` archive. Populated-destination merge/preservation, layout normalization,
initialization skill/text patches and broader shared/external/full-corpus variants
remain unfinished or unestablished. All 10 task Acceptance Criteria remain
unchecked. No live migration, lifecycle/ownership change, merge, deployment,
global candidate apply/check/probe, config/model or upstream edit occurred.
