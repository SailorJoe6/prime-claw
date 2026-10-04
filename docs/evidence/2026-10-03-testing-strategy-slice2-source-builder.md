# Slice 2 evidence — isolated Prime Agent source builder

Date: 2026-10-03
Bead: `prime-claw-5v7.1`
State: candidate evidence; owner acceptance pending

## Isolation contract

Source mode uses `scripts/build-prime-agent-test-release.sh` as the single
producer for the standalone driver and pytest fixture. The host controller:

- captures tracked, dirty, and nonignored untracked inputs with
  `GIT_OPTIONAL_LOCKS=0` and retained no-follow descriptors;
- separately inventories the complete checkout, including ignored dependency
  and build outputs, modes, file bytes, and link-target bytes;
- builds `docker/test-prime-agent-builder.Dockerfile` from only the Dockerfile
  and fixed payload, captures an iidfile, and launches that exact image with a
  cidfile;
- attests exactly two read-only mounts (`/source` and the sanitized input
  manifest) plus one fresh run-owned writable export, with no host home,
  credentials, socket, config, live service, or repository workspace;
- copies and rehashes selected inputs inside the container, then installs,
  cleans, builds, and packs only the container-local copy;
- accepts exactly four release tarballs plus `SHA256SUMS`, `stable`, and
  `latest.json`, with a strict manifest and no special/link/extra files;
- removes and inspects only the captured builder CID; and
- requires the complete post-build checkout inventory to equal the pre-build
  inventory before source mode can green.

The runtime never mounts the selected checkout. It mounts only validated
artifacts read-only, verifies the expected `SHA256SUMS` identity and every
listed tarball, installs during preparation, removes all networks, and then
runs identity, plugin apply/check, and probe/test actions offline.

## Hermetic proof

Focused Slice-2 coverage exercises:

- selected-source identity versus complete ignored-output inventory;
- clean and dirty content identity, relevant untracked inputs, file modes, and
  safe links;
- stale `dist`, `release/tier1`, and dependency caches without reuse or source
  mutation;
- dependency/build and pack failures with identical checkout inventory;
- run-owned iid/cid execution, exact-ID teardown, and read-only mount shape;
- nonzero builder exit, tampered tarball, extra output, contradictory lineage,
  unclean teardown, and private-path rejection;
- both consumers invoking only the canonical producer; and
- source installed-version discovery from package metadata without depending on
  a CLI launch.

The focused repair gate passed **17 tests**. The broader source/provenance/
driver/fixture/image gate passed **162 tests and 92 subtests** before the live
source run; final candidate validation is recorded below.

## Real selected-checkout proof

The first real probe is retained as a failed gate at
`.test-results/slice2-source-20261003T232357Z/`. The isolated source build,
release validation, local install, network removal, and exact teardown all
completed. Installed-version discovery through the CLI produced no parseable
identity, so the run failed rather than inferring or reusing a version.

The direct repair reads the installed global package metadata for source mode;
pinned mode retains its accepted CLI-version path. The corrected probe at
`.test-results/slice2-source-fix-20261003T232813Z/` passed in **101 seconds**.
Its source-builder interval was **67 seconds**, below the 3-minute warm budget.
The run proved:

- source HEAD `a1faacd53ac4473a75de1d434afaf50945c2f647`;
- selected-source content SHA-256
  `c159dd4a40619f886955c053bbe200c0874f208cb5860a4fe8970b1c3621db75`;
- package and installed version `0.9.8`;
- primary release SHA-256
  `80efeb93ad1525ac94056420a9310194890cc1c0cf6b849bf555e9cc634d359c`;
- complete checkout inventory SHA-256
  `b10e91aaf8b350ed74187e9f94fb89a61607813ac60f7397b00df088ba72a829`
  before and after, with 34,038 entries (3,066 directories, 30,928 files,
  44 links);
- builder image ID captured from a run-owned iidfile;
- builder and runtime containers both verified absent with clean exact-ID
  teardown;
- runtime network verified absent before installed identity, apply/check, and
  RPC probe; and
- sanitized schema-v2 source lineage with 15 hashed evidence files.

The selected checkout remained Git-clean after the run. No source bytes,
private checkout path, raw Docker/npm diagnostics, credentials, or private
endpoint values were written to durable evidence.

## Reproduction

```bash
python3 -m pytest tests/test_source_builder.py   tests/test_testing_provenance.py tests/test_tier1_driver.py   tests/test_tier1_fixture.py tests/test_tier1_image.py -q

TIER1_ENV_FILE=/path/to/ignored-source.env scripts/test-tier1.sh --probe
TIER1_ENV_FILE=/path/to/ignored-source.env   python3 -m pytest tests/ -q -m container
```

## Pre-review candidate validation

The final frozen implementation passed all sequential gates without retries:

- Docker-free host suite: **343 passed, 147 skipped, 92 subtests** in 133.52s;
- source-mode container suite: **40 passed, 450 deselected** in 215.10s,
  manifest `20261003T233621Z-98194-cfcf86bf`, with equal checkout inventory,
  verified network absence, and clean builder/runtime teardown;
- pinned-mode container suite: **40 passed, 450 deselected** in 112.19s,
  manifest `20261003T234005Z-53874-e65fec43`;
- aggregate `.test-results/20261003-165059-18513`: Tier 0 **343 passed,
  147 skipped, 92 subtests** in 135.65s; Tier 1 **40 passed, 450 deselected**
  in 104.80s; overall PASS; and
- static/syntax/compile/JSON/inventory source-builder gate: **13 passed**.

The 215.10s source-container result includes the complete 40-test body. Its
builder stayed within the separately measured warm preparation budget. Pinned
behavior remains green, and the sponsor-recorded Slice-1 performance boundary
is unchanged.

## Final-review repair

The first whole-candidate review correctly blocked publication. Report:
`/Users/jlanders/.prime/agent/session-artifacts/01a10432-5571-72cf-8d69-01504a7580b3/SLICE2_WHOLE_CANDIDATE_REVIEW.md`, SHA-256
`14d71ed035472eaef0d6c2dfcc9de0760b24e41167b17501e9cf821c9267334a`.
Two material findings were repaired:

1. Release validation now compares exact full relative paths, so a nested file
   such as `artifacts/sub/stable` cannot alias the basename of an allowed
   top-level output.
2. The builder blocks watched signals through checkout/output validation,
   evidence publication, and handler restoration. A signal during validation
   publishes failed `interrupted` evidence; a signal after green publication
   atomically exchanges it for an exact failed record before the terminal
   boundary.

Deterministic regressions cover both cases, including preservation of the
replaced public object for diagnosis. The repaired source/provenance/driver/
fixture/image gate passed **165 tests and 92 subtests**. Final exact-generation
host and Docker replay plus renewed independent review remain required.

## Renewed-review repair

The renewed whole-candidate review again correctly blocked publication. Report:
`/Users/jlanders/.prime/agent/session-artifacts/01a1044b-2f33-7646-be8d-1dbaf362eb2b/SLICE2_REPAIRED_WHOLE_CANDIDATE_REVIEW.md`, SHA-256
`b6ccf90de0ae681b53a643d43c6bec02c61677a075dcda70db4816640fd48bc0`.
It verified both prior blockers closed, then found two further durable-truth gaps:

1. A publication error after atomic rename could leave a public passed builder
   receipt. Any publication exception now immediately exchanges any public entry
   for a minimal failed record before attempting the full failed receipt.
2. Final manifest validation now independently requires the exact seven release
   paths, recomputes the framed output-inventory hash, and binds the primary
   artifact to the expected versioned main tarball.

Deterministic regressions cover post-rename publication failure, stale inventory
hash, and a recomputed nested extra. The repaired affected gate passed **167
 tests and 92 subtests**. A new exact-generation replay and renewed independent
review remain required.

## Final replacement-failure repair

A third exact-files review verified the durable schema and initial publication
repairs, then found one remaining branch: if late-signal replacement of a
previously passed receipt failed before exchange, the earlier green receipt
could remain public. Report:
`/Users/jlanders/.prime/agent/session-artifacts/01a1044b-2f33-7646-be8d-1dbaf362eb2b/SLICE2_SECOND_REPAIR_WHOLE_CANDIDATE_REVIEW.md`, SHA-256
`52380bd95e98251e22745bbc5154a3b85254170ab6160eb4963bce84505c0810`.
The replacement-error handler now unconditionally invokes the failed-entry
exchange used by the initial publication-error path. A deterministic combined
post-publication signal plus pre-exchange replacement failure proves the public
receipt is failed while the displaced passed object remains private. The
affected gate passed **168 tests and 92 subtests**. Exact-generation replay and
renewed review remain required.

## Exact final repaired-generation validation

After all review repairs, the exact final files passed the full gates:

- affected source/provenance/driver/fixture/image gate: **168 passed, 92
  subtests** in 103.85s;
- Docker-free host suite: **348 passed, 147 skipped, 92 subtests** in 128.86s;
- source-mode container suite: **40 passed, 455 deselected** in 191.84s,
  manifest `20261004T005155Z-71627-5d0a0e9c`, complete checkout inventory
  equal and builder/runtime exact-ID teardown clean; and
- authoritative pinned-mode container suite after operator license acceptance:
  **40 passed, 455 deselected** in 214.01s, manifest
  `20261004T150637Z-6967-5b2ce894`; and
- final syntax/compile/JSON/inventory/source-builder gate: **18 passed** in
  5.67s.

The first final pinned attempt is retained red at manifest
`20261004T005510Z-96783-edc0c264`: **1 failed, 39 passed, 455 deselected** in
99.10s. Its only failure was a host-side fixture `git init` refused by the
system-selected Apple Git because the unrelated Xcode license was not accepted.
A subsequent direct-Command-Line-Tools Git retry, manifest
`20261004T005724Z-14541-3c7463f3`, is retained but explicitly non-authoritative;
it changed no system or candidate state. After the operator accepted the
license, `/usr/bin/git` 2.54.0 passed version, status, and HEAD checks, and the
unchanged candidate passed the authoritative pinned gate recorded above.

Exact candidate commit/tree, renewed review, and remote-equality proof are
appended to the Bead receipt before publication. Later slices and Phase 3a
remain unstarted.
