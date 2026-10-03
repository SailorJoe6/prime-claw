# Project-wide testing Slice 1 — pinned provenance and source fail-close

**Bead:** `prime-claw-5v7.2`
**Branch:** `episode/project-wide-testing-strategy`
**Promoted bundle:** `b71405c`
**Rejected candidate:** `fd1f2b7c4a6b1fba1bc4671b3baac95248aed09e`
**Revised delivery commit:** exact pushed SHA is recorded in the Bead receipt

## Revision authority

The owner rejected `fd1f2b7` and reopened the Slice-1 Bead. The accepted repair
scope is the durable `OWNER REVIEW — REVISE` Bead note: B1–B8 plus the recorded
R-TEST-7 standalone writable-evidence-root seam. The immutable review report is:

`/Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-61c1b2d1/slice1-fd1f2b7c-review.md`

Its SHA-256 is
`d076887fc09674274d7daa0dd842ce3689fe92ad6bc7260d66131456f56ba79f`.
The four manifests cited by the rejected candidate remain historical artifacts.
They do not prove this revision and are not relabeled as revised-candidate runs.

## Delivered boundary

Slice 1 gives tier 1 a run-owned evidence tree, immutable image execution,
offline product actions, exact-ID teardown, and immediate source-mode
fail-close. It does not implement the source builder, integration brain stack,
lifecycle observer, or any later-slice taxonomy work.

- Repository capture retains one no-follow root descriptor for the full
  operation and writes through one retained destination descriptor. Root,
  ancestor, leaf, mode, and destination swaps cannot redirect reads or writes.
  File bytes are hashed and copied from the same checked descriptor; safe
  relative leaf links are preserved and link chains are validated abstractly.
- Repository and declared-input content use unambiguous v2 length-framed digest
  records. The Dockerfile and declared-input hashes describe the final captured
  build context submitted to Docker, never a later mutable checkout read.
- Schema v2 records safe failure codes and keeps teardown presence separate
  from remove/inspect command health. Failed version validation can retain an
  exact rejected stable or prerelease identity; passed runs still require exact
  requested/installed equality.
- Image metadata is allow-listed and sanitized before `image.json` is created.
  Arbitrary registry/repository metadata is discarded. Evidence inventory rejects
  unknown encodings, directory/file links, and special files.
- The standalone driver mounts only its scratch `share/` writable. The host
  evidence root, build context, iidfile, cidfile, and durable metadata are never
  container-writable.
- Both launcher paths use the shared bounded process-group contract. Every wait,
  TERM grace, KILL reap, and output capture is bounded. Detached children cannot
  hold a pipe drain open. The shell tracks each bounded controller, forwards
  TERM/INT/HUP promptly, and records cleanup-time signals. The fixture handles
  signals through exact-ID cleanup and terminal evidence before restoring and
  redelivering them; a returning/ignored prior handler still raises failure.
- Success is derived only after setup/body success, exact identities, verified
  network absence, clean teardown, evidence publication, and verification.
  Interruption or finalizer failure cannot produce a passed manifest or `OK`.
- `PRIME_AGENT_SOURCE` still fails before checkout or Docker access with Slice-2
  guidance. No source builder or host-mutating fallback was restored.

## Red-before-green repairs

- **B1:** the default no-Docker test now constructs an owned PATH with only
  explicit prerequisites and proves a poison Docker in a fallback directory is
  never invoked.
- **B2/B3:** synthetic ancestor-link, root/destination swap, regular-mode swap,
  safe-link replay, and the report's exact NUL-framing states fail before repair
  and are now covered by retained-fd secure-capture and framed-digest tests.
- **B4/B5:** detached-pipe, TERM-ignoring tree, leader-exit, real shell TERM
  after CID publication and again during cleanup, fixture-signal, teardown-
  interruption, the post-spawn/pre-handler signal race, failed-manifest, exact
  version-mismatch, and smoke-failure/replay tests cover the repaired outcomes.
- **B6/R-TEST-7:** unsafe image metadata, unknown encoding, directory/file links,
  FIFO evidence, and writable-mount inspection cover pre-write sanitization and
  scratch-only mounting.
- **B7:** redundant full-driver process setup was replaced with a lightweight
  recording shell where process-boundary proof was not the subject. Real bounded
  subprocess cases remain for timeout, signal, process-tree, and detached-pipe
  behavior. The required deliberate warm measurements are recorded below.
- **B8:** `prime-claw-5v7.2` remains `in_progress` and unaccepted. Delivery and
  advisory review do not close it; only explicit owner acceptance may do so.

## Revised-candidate runtime evidence

Raw manifests and logs stay gitignored below `.test-results/`; this note records
only sanitized identities, measurements, and verdicts.

- Standalone smoke `scripts/test-tier1.sh --smoke`: PASS, run
  `20261003T034958Z-69311-d4455834`, image
  `sha256:d48b47b41a0d249ed48316f99682b7cfb804f5fd6076f65b55f22426e5aead53`,
  network absent, remove clean, final inspect absent.
- Standalone pinned probe with `PRIME_AGENT_PINNED=0.9.8`: PASS, run
  `20261003T035020Z-70360-6298a94e`, image
  `sha256:ba5e1d21c996cebf8e65c8c4e08f15c4c73ee80bbc295d02fd540c2eee5521b4`,
  observed version `0.9.8`, executable SHA-256
  `e9ec0f8bff00369bac4a92de3acb4683e3bdc58615ee812e998f935992aa69f6`,
  network absent, remove clean, final inspect absent.
- Final comparable container samples used runs
  `20261003T034343Z-52052-b6eb42ea`,
  `20261003T034538Z-57173-ce08ec2c`, and
  `20261003T034725Z-62255-d307dd68`. All passed with repository v2 content
  identity `3bac4a32742c398199ab2bd580c5d83249b1eee137804b5c4d82a2ea5dff36b0`
  and clean verified-absent teardown.

## Validation and performance

### Tier 0

Command: `python3 -m pytest tests/ -q`.

- Approved planning median: **37.89s**.
- Reconstructed slice-entry comparator `eca48f8b284c990a8e030062ef70192313781b7f`
  (clean `git archive`, same interpreter), samples **57.84s, 55.45s, 54.38s**;
  median **55.45s**. This reconstruction is disclosed separately and does not
  replace the approved planning baseline.
- Revised-candidate samples: **41.80s, 42.92s, 42.53s**; median **42.53s**.
- Gate: **PASS**. The median is 12.25% above the approved 37.89s baseline,
  below both the accepted 12.5% repair threshold and the 60s absolute ceiling.
  It is 23.30% faster than the reconstructed slice-entry median.

Each revised run produced **282 passed, 147 skipped, 17 subtests passed**.

### Tier 1 preparation and test body

Command for every sample:
`TIER1_ENV_FILE=<mode-0600 pinned-0.9.8 file> python3 -m pytest tests/ -q -m container --durations=0`.
Preparation is the sum of pytest setup durations, body is the sum of call
durations, and teardown is reported independently. The comparator was a clean
`git archive` of slice-entry commit `eca48f8b284c990a8e030062ef70192313781b7f`.
The revised samples share the v2 repository identity recorded above.

| Input | Total samples (s) | Preparation samples (s) | Body samples (s) | Teardown samples (s) |
|---|---|---|---|---|
| slice entry `eca48f8` | 81.55, 79.82, 77.89 | 14.42, 13.48, 13.27 | 65.26, 64.84, 63.12 | 1.30, 1.30, 1.31 |
| revised candidate | 97.05, 96.03, 94.10 | 17.54, 16.34, 16.12 | 77.23, 77.39, 75.92 | 2.06, 2.01, 1.80 |

Medians are 79.82/13.48/**64.84**/1.30s at slice entry and
96.03/16.34/**77.23**/2.01s for the revision. The comparable test-body median
increased **19.11%**, so the Section 3.3 20% body gate is **PASS**. Preparation
and teardown growth are reported separately rather than charged to the body.
All six runs selected and passed 40 container tests.

### Other gates

- focused Slice-1 suite — **102 passed, 17 subtests passed** in **19.80s**;
- inventory/plan checks — **22 passed, 9 skipped**;
- standalone smoke and pinned offline RPC probe — PASS as recorded above;
- syntax, Python compilation, and `git diff --check` — PASS during repair;
- final post-review `scripts/test-all.sh` — tier 0 PASS in **44s**, tier 1
  PASS in **94s**, overall OK; tier 2 intentionally skipped;
- independent adversarial rereview after all BLOCK remediations — **PASS**.

## Rollback and remaining work

Rollback may remove additive provenance or launcher mechanics only while source
mode remains fail-closed. Never restore the prior host build/cleanup/pack path.
Slice 2 (`prime-claw-5v7.1`) remains unstarted and must add the read-only source
snapshot/disposable builder before source selection can execute.
