# PRIMECLAW-45 — bounded migration lifecycle slice 2

Date: 2026-11-06. This is a review candidate, not whole-upgrade acceptance or
activation. The accepted v1.53.0 host artifact remains authoritative. The same
Episode, original basis and resources continue after the accepted Bun-isolation
repair `cd9193cba4082229df973d4a557388dfb83e2b62`.

> **2026-11-12 policy update:** The operator resolved the archived-draft question:
> absence of an unsupported native archived-draft view alone must not block
> migration. Exact files/bytes/paths/history and physical identity/collision
> safeguards remain. The November 6 refusal and probe below are historical;
> the CLI limitation is still true. See the dated adaptation section at the end.

## Changed seam

The provider-history adapter uses the v1.55.3 native lifecycle:

- Active `Done` is closed and remains under `tasks/`.
- Both legacy `completed/` and canonical `archive/tasks/` are archives, regardless
  of status. Native task views read those records in place. No archive is moved
  or presented as an active record to obtain evidence.
- Beads status maps normally (`closed` → `Done`). Only explicit source archive
  or abandonment evidence triggers archive, after the mapped status is written.
  Raw status, close reason and provenance remain in the exact source package.
- Archived task and active draft dependency targets follow native eligibility.
  The adapter no longer excludes an archived source target merely for archival.
- The existing physical inventory refuses repeated canonical IDs across tasks,
  drafts and legacy/canonical archives before layout preparation or allocation.
  Native views also retain their own ambiguity checks. No repair, renumbering,
  allocator, parallel identity index or `doctor --fix` is introduced.
- Native draft evidence validates the returned original file path before its
  stable evidence-path normalization.

Source capture, baseline byte/history checks, destination publication/readback,
receipt proof, active ownership/resources and source-deletion-last ordering are
not replaced or weakened. Reverse migration remains retired.

## Native interface limit: archived drafts

Backlog v1.55.3 has native archived **task** reads, but no archived **draft** read
surface. `draft view --plain` only reads active drafts. After native draft
archive it can return exit zero with no view and a not-found diagnostic. Task
view excludes drafts, and draft view has no JSON option. The adapter checks
actual view identity/path/status rather than trusting exit zero.

An existing archived-draft baseline therefore cannot supply the required native
readback through the supported CLI. The candidate refuses that unreadable
baseline before destination preparation. It does not relocate, manufacture an
active view, silently omit the record, patch upstream, or waive preservation.
This concrete capability limit is reported to the owner and remains unresolved;
this slice must not be described as full archived-draft or upgrade acceptance.

### Archived-draft probe receipt

A disposable offline container (no mounts) used the immutable Tier-1 image
`sha256:13b357723400a656eb48c8fb94712f252193f95f6412ca949a3d8e304e304ced`.
Its labels bind Backlog v1.55.3 and exact upstream commit above. The executed
binary SHA-256 is
`7b7392ce39def4fc96edc1903109ed9564dc25eb8bd79d3924378cb568ed590d`.

After native `task create ... --draft`, `draft view DRAFT-1 --plain` displayed
the active record. After `draft archive DRAFT-1`:

| Exact native command | Exit | Observation |
| --- | ---: | --- |
| `backlog draft view DRAFT-1 --plain` | 0 | Empty stdout; `Draft DRAFT-1 not found.` on stderr |
| `backlog task view DRAFT-1 --json` | 1 | Task not found; task lookups use the local working copy |
| `backlog draft view DRAFT-1 --json` | 1 | Unknown `--json` option |
| `backlog draft list --json` | 0 | Empty draft list |
| `backlog draft view --help` | 0 | Only `--plain` and `--help` options |

The final replay preserves the exact archive filename and Base64 bytes before
and after every read; both SHA-256 values are
`f53de3367a25b7f4e66a9c5a8f6f5af344f32a7b743d9d1ce2f91e5582adf260`.
Generated fixture dates differ between the original run and replay. This is
within-replay equality, not a cross-run byte-equality claim. Both disposable
containers were verified absent after `--rm` cleanup.

Raw fixture, exact outer Docker command, inner command argv/status/stdout/stderr,
binary/image/source identities and cleanup observations are in
`.test-results/primeclaw45-slice2-08450108/native-archived-draft-probe/`.
The settled `manifest.json` SHA-256 is
`7461ca0bea5a67f90a77fab4f9aabede4fa1f8e303fd2218bc4589580e1d44b7`. Its per-file hashes and before/after payloads were
reread and verified against the saved replay. An intermediate manifest was read
while the helper was still updating replay artifacts; it was not accepted as
final evidence. No read command or archive byte changed to obtain this proof.

## Validation and reproducibility

Bounded validation is complete as detailed below. Raw receipts are retained locally under
`.test-results/primeclaw45-slice2-08450108/`. Exact source is the unmodified
upstream v1.55.3 commit `0cf4fdbc70020327f4366a29d3f405f83d180301`.

### Required Docker plugin validation

The supported driver passed:

```sh
TIER1_ENV_FILE=.test-results/primeclaw45-slice2-08450108/tier1.env scripts/test-tier1.sh --probe
```

The selector file contains only
`PRIME_AGENT_SOURCE=/Users/jlanders/code/prime-agent`. The canonical upstream
harness was consumed read-only and built in a disposable native ARM64 container;
it was not edited or treated as a development target. Its pre/post full checkout
inventory hashes match. The driver built/installed Prime Agent `0.9.8` from
source `94589ebb002679a028435759ce3bfffdc7ff6127` inside Docker. The general Prime
Agent Node selection and Backlog/general-Bun isolation were not changed.

Run `20261106T152527Z-38814-3af256b7` passed offline plugin apply/check and the
native RPC command/tool discovery probe. The offline actions ran after the final
production-module edit. The module's SHA-256 is
`1fe53a06562e8dbf5eadd8892eefd2f1767d1e9ec587582338d811ecfc162155`. The image was
launched by immutable ID `sha256:77f4185253d80f6e1e03c8f229e38609b0aeef06161a5f5405d51e85e957eccb`. Network absence
and clean container teardown were verified; the run reports no failure codes.
Manifest and bound evidence-file hashes were reread and checked.

Receipts: `.test-results/20261106T152527Z-38814-3af256b7/tier1/manifest.json`
and `setup.log`; outer log
`.test-results/primeclaw45-slice2-08450108/tier1-probe-driver.log`. This proves the
required isolated plugin installation/probe boundary, not full migration,
full Tier-1 suite or live activation. Source-mode packaging takes the supported
public build path and does not patch Prime Agent.

### Representative migration results

The selected seams have passing evidence across the retained runs below. They
are not one passing full-suite invocation, and the historical failed runs above
remain failed. Later full integrated validation is still required.

| Selected scenario | Passing evidence |
| --- | --- |
| Native allocation reserves canonical/legacy archive IDs; archived-task and active-draft dependencies succeed; native archive reads stay in place | `focused-migration-node.tap` native allocation case; native-only worker smoke also passed |
| Ordinary closed imports remain active Done; only exact archive evidence archives; raw packages/history and source-authoritative publication ordering survive | `focused-migration-node.tap` closed/archive case |
| Explicit archive retains mapped non-Done Blocked status | `focused-archive-collision-rerun.tap` closed/archive case passed (its separate alias assertion failed) |
| Populated independent-hidden destination retains authored views, bytes, history, relationships and original clone identity | `focused-migration-node.tap` independent-hidden case passed |
| Archived source dependency maps to its archived destination rather than being excluded | `focused-migration-node.tap` archived-target case passed |
| Confirmed migration refuses active, canonical archive, legacy archive, draft and padded-ID collisions without source/baseline/index/ref mutation or cutover | `approved-replacement-collision-final.tap`: **6 passed, 0 failed/skipped** (one parent plus five subcases) |
| Ordinary code-tracked default layout adopts the native hidden store while preserving baseline/status/comments/dependencies/history and receipt/readback/source-deletion ordering | `approved-replacement-code-default-final.tap`: **1 passed, 0 failed/skipped** |

Both final runs used the explicitly inspected replacement image from the passed
Tier-1 run, with `--network none`, only read-only `src` and `tests` mounts, a
container-local candidate symlink and no host task/dependency/credential mounts.
Its executed Backlog version is exactly 1.55.3; binary SHA-256 remains
`7b7392ce39def4fc96edc1903109ed9564dc25eb8bd79d3924378cb568ed590d`.
Native Beads is 1.3.1 (`c1c4b642a`) and Dolt is 2.5.0. Dolt's ordinary newer-version
warning is retained; no dependency upgrade was made.

Exact commands, patterns, image/native identities, exit codes and per-run counts
are saved in the corresponding `*-receipt.json` and `*-command.txt` files under
`.test-results/primeclaw45-slice2-08450108/`. The final receipt exit codes are
both zero. The initial six-scenario run has 4 passed/7 failed including nested
collision cases; the affected two-scenario rerun has 5 passed/2 failed. Neither
is relabeled as a passed suite. Two rejected image launches ran no tests.

To reproduce the same representative selection in a supported isolated image,
use the recorded Docker command, its container-local candidate symlink and this
Node selection (do not run candidate plugin tests on the host):

```sh
node --experimental-strip-types --test --test-name-pattern 'native populated Backlog allocation|Beads closed reasons and categories|confirmed populated Backlog migration preserves baseline/imports/receipt for independent-hidden|confirmed populated Backlog migration preserves baseline/imports/receipt for code-default|native archived-target source graph|migration admission refuses contested Backlog IDs' /workspace/tests/task_provider_migration.test.mjs
```

The initial run began before the narrow full-body ID-comparison repair and the
test expectation fixes. Its unchanged successful seams are reused within that
limit; the final collision/default-layout runs and affected archive-status run
exercise the final production helper. No skipped, failing or unavailable check
is counted as successful whole-upgrade acceptance.

### Historical test expectation and launch failures

The first selected migration run is retained as a **failed run**, not counted as
a passing suite. Native allocation, closed/archive mapping, independent-hidden
baseline migration and archived-source dependency mapping passed. Its collision
fixture still required source-only inspection to refuse the destination; the
required refusal is at confirmed migration, before any destination preparation
or write. The ordinary default-layout migration completed but its new draft
plain-view assertion compared an authorized `backlog/` → `.backlog/` file-header
change as if it were a content change. The rest of that native view and the
baseline byte/history checks matched.

Corrections are test-only and narrow: confirmed migration must refuse each
contested identity before writes; its diagnostic retains the original ID rather
than rewriting it; and only default-layout adoption translates the final draft
`File:` header back to its known original location for comparison. All other
view bytes, status, dependencies, physical records and history remain checked.
An affected rerun also proves explicit archive preserves a mapped non-Done
`Blocked` status. The retained failed rerun has an alias diagnostic
assertion failure, not a successful complete test run.

Two later final-test launches did not execute native tests: Docker returned 125
with `No such image: sha256:13b357723400a656eb48c8fb94712f252193f95f6412ca949a3d8e304e304ced`.
The cause of image unavailability was not established. There was no automatic
pull/rebuild or attempt to alter the host. The immutable image from the passed
supported Tier-1 driver was inspected and selected explicitly for only the two
remaining checks:
`sha256:77f4185253d80f6e1e03c8f229e38609b0aeef06161a5f5405d51e85e957eccb`.
Its labels bind the same exact Backlog source/version, Beads 1.3.1 and Dolt 2.5.0.
Each execution retains a separate receipt; no equality of different image IDs
or unexecuted results is inferred. Earlier successful, unchanged seams are not
rerun merely to create a whole-suite gate at this bounded slice boundary.

### Host-safe bridge assertions

`python3 -m pytest tests/test_task_provider_migration.py -q -m "not container"`
passed **2 tests**, with 7 container tests deselected. These are static inventory
and least-technology assertions only. Raw log:
`.test-results/primeclaw45-slice2-08450108/focused-static-pytest.log`.

The prior source/build/Nix/Git-trust results and Bun-isolation proof are reused
only within the limits in
[the source/build receipt](primeclaw45-upstream-candidate-20261106.md).
General/runtime/gbrain Bun remains 1.3.11; Backlog build/smoke alone uses 1.4.4.
The plugin is not installed or probed in the host/user-global environment.

Full normative asset conversion, remaining lifecycle seams and the integrated
migration/lifecycle/Tier-0/Tier-1 gates remain required later. No merge, global
refresh, restart, live migration or resource cleanup is authorized by this slice.

## Retained raw log hashes

```json
{
  "focused-migration-node.tap": "874ba05c72237b79df4d5441388ae693378d10618cef7757bb33df24ae03d7eb",
  "focused-archive-collision-rerun.tap": "6a2ec62a18a8e1527b93846710d1d42cd3791bc1a6c26cc3c71e4a4f08e171d6",
  "approved-replacement-collision-final.tap": "b564bb23ccd6adc819ac209331459c2732ce7b29698b13890e984e774d4278d2",
  "approved-replacement-code-default-final.tap": "d93df73e98ff06287a7b9f22de153247e1861f1cc09a180d0a13ee61b047770f",
  "focused-collision-final.tap": "d9c343726e82a6237258cb03772b141b069030f167b5f3105ff8523165ad8567",
  "focused-code-default-final.tap": "d9c343726e82a6237258cb03772b141b069030f167b5f3105ff8523165ad8567",
  "focused-static-pytest.log": "ee467365c96d35008c8202d20d7421de2c47fdb74fdec8b7c14580dd6912a43b",
  "tier1-probe-driver.log": "1f4cb86af89f69c06c1f01897c4c281b5b2d6eb93df92bf468002f8e4f64768e",
  "native-archived-draft-probe/manifest.json": "7461ca0bea5a67f90a77fab4f9aabede4fa1f8e303fd2218bc4589580e1d44b7"
}
```

## Archived-draft operator decision and bounded adaptation — 2026-11-12

The owner accepted slice 2 at code
`619676b21d5feef0c5b941d42c6d8b0378432b89`, including an independent
GPT-6 Astra/max review with no material defect. The owner reran the six
representative migration scenarios together: 11 tests passed, zero failed or
skipped. This is bounded slice acceptance, not full-upgrade acceptance.

The operator then resolved the product question:

> archived drafts don't matter. the fact that it was a draft means it was never
> worked on, and never important in the first place. we should not fail closed
> over this.

This supersedes the November 6 archived-draft refusal, not its factual native
CLI-limit proof. Existing archived drafts must not block migration merely because
the public CLI cannot display them. They keep exact files, bytes, paths and
history, with the existing physical identity/collision safeguards. There is no
native-view fabrication, relocation, promotion, restore, discard, upstream patch,
custom parser/index/allocator or new protocol. Native evidence remains required
for active drafts and active/archived tasks; real identity, integrity and
transport failures still refuse.

### Minimal changed seam

`backlogDestinationViews` first runs the unchanged complete physical inventory,
then excludes only `archive/drafts/` from native-view collection. The existing
baseline file walk, tracked-file enumeration and per-file Git-history capture
still include those files. Existing verification checks exact bytes/mode/path,
file history, clone identity and ancestry through data/receipt publication and
final refresh. No source package, receipt, publication, ownership/resource or
source-deletion-last logic changes.

One representative real-candidate migration test creates and commits a draft,
archives it natively, commits/publishes that baseline, then migrates Beads into
the same destination. It checks original bytes/paths, full archived-draft history,
receipt-tree bytes, ancestry, mappings, direct publication and source retirement.
It also requires native active-draft/task reads and proves that no unavailable
archived-draft view is requested. One row added to the existing collision table
proves `archive/drafts/` conflicts still refuse before writes. The existing
pytest bridge already selects this new case through `confirmed populated Backlog`.

### Validation and scope

Raw commands, inputs and logs:
`.test-results/primeclaw45-archived-draft-08450108/`.

- Regression red on the prior production source: **1 failed**, at the exact
  unsupported `DRAFT-2` native-path read (`blocked` instead of `completed`).
- Same new representative case after the source adaptation: **1 passed**,
  zero failures/skips.
- Final affected native migration run: **13 tests passed**, zero failures/skips,
  across seven top-level scenarios (including six nested collision cases).
  This reruns the prior six representative seams plus the one new migration case:
  ordinary closed/explicit archive mapping, physical collisions (including
  archived drafts), native allocation/dependency eligibility, archived-draft
  baseline preservation, independent-hidden/default-layout populated migration,
  and archived-target source relationships.
- Host-safe static bridge checks: **2 passed**, 7 container tests deselected.
  The host's plain `python3` and `python3.13` had no pytest; those no-test failures
  are retained, not counted as passing checks. The supported pytest command ran
  in an isolated native uv tool environment, without changing project/runtime
  dependencies:
  `uv run --no-project --python python3.13 --with pytest python -m pytest tests/test_task_provider_migration.py -q -m "not container"`.
- Fresh required `scripts/test-tier1.sh --probe`: **PASS**, run
  `20261112T152225Z-74778-86d469d0`. Offline plugin apply/check and native
  RPC tools/commands probe pass; network absence and clean runtime/builder
  teardown are verified. The image is
  `sha256:2749bf9aa8cf193c27da3f3aa840d7a40a94a30ee736ead4ff83fb5349ed19f3`.
  Prime Agent 0.9.8 builds only in Docker from unchanged read-only canonical
  source `94589ebb002679a028435759ce3bfffdc7ff6127`; complete checkout inventories
  before/after match. All 15 published evidence-file hashes were reread and match.
  Required-run manifest/setup/source/repository/image/network/artifact receipts:
  `.test-results/20261112T152225Z-74778-86d469d0/tier1/`.

Production source SHA-256 (unchanged after the required driver started):
`617986baab3be773536958e84eaa5f0d43f73c82ef37a220058a28e36d6360e0`.
Only later test/docs evidence edits differ from the initial driver snapshot; no
plugin source changed after its validated snapshot.

Exact native migration selector, used offline with read-only source/tests mounts:

```text
native populated Backlog allocation|Beads closed reasons and categories|confirmed populated Backlog migration preserves archived draft bytes|confirmed populated Backlog migration preserves baseline/imports/receipt for (independent-hidden|code-default)$|native archived-target source graph|migration admission refuses contested Backlog IDs
```

The native test image was inspected before reuse:
`sha256:77f4185253d80f6e1e03c8f229e38609b0aeef06161a5f5405d51e85e957eccb`.
Its labels retain exact unmodified upstream
`0cf4fdbc70020327f4366a29d3f405f83d180301`. A fresh offline/no-mount identity
read reports Backlog **1.55.3**, binary SHA-256
`7b7392ce39def4fc96edc1903109ed9564dc25eb8bd79d3924378cb568ed590d`,
Beads **1.3.1** (`c1c4b642a`) and Dolt **2.5.0**. Dolt's newer-version warning
is retained; no tool is upgraded. Native migration tests use `--network none`,
read-only source/tests mounts and no host task store, credentials or home.

Read-only implementation assistance (GPT-6.1 Sol) found no concrete material
defect in this bounded delta; it ran no tests and provides no owner acceptance.
The old CLI-limit probe and prior failed histories above remain unchanged. No
redundant archived-draft limitation probe was run. Prior unmodified-source/build,
compiled/fresh-Nix/Git-trust and Bun-isolation results are reused only within
their recorded limits. General/runtime/gbrain Bun stays 1.3.11; Backlog-only
build/smoke Bun stays 1.4.4; Prime Agent's Node runtime is unchanged.

The same owner, operation, Episode, worktree, branch, session, original code basis,
host and main integration target remain. Task stays `In Progress`, AC 0/9.
This adaptation is one candidate for owner review, not the remaining normative
assets/lifecycle/integrated Tier-0/Tier-1 acceptance. Accepted v1.53.0 remains
authoritative. No merge, host/global refresh, restart, live migration or resource
cleanup is included.

### Archived-draft adaptation raw receipt hashes

```json
{
  "regression-red.tap": "9eb359fbeae0034ec93c794f3367ed2cb2de999b470d0427db1690d2692fd0d7",
  "regression-green.tap": "33ed494269819d27a5740d6c29e88ccc3e421071a5d98df1162c602258bee716",
  "affected-migration.tap": "f521b38de6a9348135d63b46464f62b3965195767a33a5e5b5aca9217890cf25",
  "focused-static-pytest.log": "91261a52dc9831bdd6bbecce144daade485ee68829348b92c14c4caaea612e22",
  "pytest-python313-availability.log": "6292e661a1694825c6029238517051e765f6b77e8df24530e939a6e1a9f3022e",
  "focused-static-pytest-uv.log": "218bfb1808143380b442021f12befd1fd1ba36df565b77820f83d122cde29b00",
  "tier1-probe-driver.log": "683efc15fb3a2085a67781de31e64d8179721e8d1ec983de61ea07209d1b9a51",
  "native-identity.json": "79f45bfa768da4c9b7e0bb792975c9e48d57d92b53de81720de11a93a68748ec",
  "image-inspect.json": "9145e36cd82a029934b0d84a39244b3d1261f711773f6928442ec782026f4388",
  "inputs.json": "6f5cd2563719b7ebe1fc6f699e782bec73e049a809a8db6d70312a7f73690db0",
  "read-only-audit.txt": "9eb9ea3812eede355b90c117c123b825f7fcfe5cc85fff3dfb54d9c920855ad3",
  "required-tier1/manifest.json": "9ce3a17002600c47c11f1a4d92cfcfa94e4d2098f15dc327a14b180658e668d1"
}
```
