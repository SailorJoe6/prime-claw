# Slice 7 — guarded lifecycle destroy acceptance PASS

Date: 2026-10-07
Bead: `prime-claw-5v7.6`
Accepted base: `fda41dcadbac15b2c957c866d9e22eafb5f6afca`
Final-observer source identity: framed SHA-256 `6ca183fbd692322db748592091f2b915ceac2fdd89208e71ec7c2ab2820644c5` (287 entries)

## Final result

**PASS.** The sole final fresh observer `2f8d0cd3754147028f71a6a34a740441` proved the
product destroy path, sentinel preservation, empty providers, exact-owned
teardown, positive absence for every generated resource, and unchanged
configured-production hash `fd7e356ab7c2050174c4a817d790e9a83e4cced9e77ec74a728443ced685f945`. It
was not retried. The earlier two consumed observer identities below are retained
only as historical failure and repair evidence; neither is acceptance evidence.

## Final bounded review correction

The final read-only review found that inherited `PYTEST_ADDOPTS=--run-lifecycle`
plus `PRIME_CLAW_LIFECYCLE_SEQUENCER=1` could admit the lifecycle node during a
prerequisite pytest process. The publication candidate now clears both inputs
from the interpreter check and tiers 0–2, sets sequencer admission only for the
exact final lifecycle child, and has an inherited-environment regression. This
was an offline admission repair after the successful observer; the observer was
not rerun. Focused review-correction tests passed **43 tests**. The final
plain-host sentinel passed **489 tests, 49 skipped, 75 subtests**, with zero
OpenShell/Docker/gh calls; log `.test-results/slice7-final-20261007T042755Z/post-review-plain-host-sentinel.log`, SHA-256
`1cb86e7597056c70239bcf36b6e90981ea62091075a68dbb703b2b56fb4b15d2`.

## Historical attempt 1 — blocked before product proof

The first live observer reached generated test-resource setup, then failed
before creating a target sandbox or invoking `bin/prime-claw destroy`. That
identity was not retried.

The exact failure is deterministic: generated target
`pct-6824af5f4fa1-target` is 23 characters and sentinel
`pct-6824af5f4fa1-sentinel` is 25, while OpenShell v0.0.116 limits sandbox names
to 19. The connected client/server both reported `0.0.116`. Exact tag
`v0.0.116` (`d1155aa70042d3e2ee49dbfa15346b108b7c1d92`) validates sandbox names before
I/O and rejects length greater than `MAX_ROUTABLE_NAME_LEN = 19`.

## Sequencer evidence

The resumed unchanged sequence passed all prerequisite tiers before the live
body:

- tier 0: PASS, log SHA-256 `e3c3c86919057169682bc7fc5c00f9d1141b434051b76d3720b70166a4b62e5d`
- tier 1: PASS, log SHA-256 `6a6c33c64957150db2be40c62ac4a5f8b89a0cd8f84ade4aa5c23f60adbf2ed3`; manifest
  `.test-results/20261006T162804Z-26028-977e82d4/tier1/manifest.json` SHA-256 `73c12629d791c8f2a7e1112769176fcab94fd902f3fe8a2b65f1c21c17ea7b59`;
  network absent and teardown clean/absent
- tier 2: PASS, log SHA-256 `8b1f86f21acec5a6c0946b06c0747f4b29be608cb09166a67ac8f0aa28cfb7e3`; manifest
  `.test-results/20261006T163342Z-43797-712e69a7/integration/manifest.json` SHA-256 `93b29fff5687b4f3d26997f036daaad719070023b1f9caebd67f3e0fe8946409`;
  container/image/context cleanup true
- lifecycle: FAIL once, log `.test-results/20261006-092723-23359/lifecycle.log` SHA-256 `2cf2e01f1665a08c311476b23387a6088a0d41e038178f9534c4aad68b1d9d33`
- outer log `.test-results/slice7-one-shot-test-all-with-lifecycle-resume.log` SHA-256 `7fad4b0b976b6a266be6846b3377637b0be3d5ff6cd696db2b3f494c2620e875`

An earlier sequence was operator-aborted during the tier-1 source build because
of a network hang. It never reached tier 2 or lifecycle and created no lifecycle
identity. The resumed run was the first live observer execution.

## Live evidence and cleanup

Sanitized evidence:
`.test-results/20261006-092723-23359/lifecycle-evidence/6824af5f4fa145eeb65ba230100e7fb3.jsonl` SHA-256
`8292b7d4c2e20b6bb99af30b566ab9045231a9d21e93cfa5ae047864b7f8f2e1`.

- run: `6824af5f4fa145eeb65ba230100e7fb3`
- workspace: `pct-6824af5f4fa1`
- target: `pct-6824af5f4fa1-target`
- sentinel: `pct-6824af5f4fa1-sentinel`
- image: `prime-claw-lifecycle:6824af5f4fa1`
- fixture immutable iid: `sha256:e254d2d925c5ac6b08f661d7bd9c9299efcd0157b0782161be57b6267c706a9d`
- fixture Dockerfile SHA-256: `b50f7c8e70628aea72ab77b0989339621e32b33d1167933e81e5e067543e1ccb`
- no-egress policy semantic SHA-256: `c1716d44107b8b44a6174ff8bbdcfca8756ed6f31fde83ee7ef8bcd8cec5fa56`

Preflight proved workspace/image/target/sentinel absent. Workspace and image
were created, reread with exact ownership labels, captured, then positively
removed after target creation was refused. Final evidence records workspace and
immutable image absent. The overlength target was rejected by OpenShell's
pre-I/O validation, so it was not persisted; sentinel creation was never
attempted. Product config/proxy/destroy and provider-list checks were never
reached.

The read-only names-only configured-production snapshot succeeded before and
after and compared equal (`snapshot=False` in the normalized failure state).
The repaired implementation now writes a mode-0600 `failure.json` on failed
acceptance with canonical configured-production before/after snapshot hashes,
equality, and failure-class booleans; raw production names remain excluded. No
production policy, annotations, providers, endpoints, credentials, local
overlay, or brain content were requested. No configured production mutation
occurred.

## Repair/review cycle 1 result — 2026-10-07

OWNER REVISE shortened sandbox identities and authorized exactly one revised
observer after non-live validation. Repaired source identity was framed SHA-256
`cbc9ce548b3ff522dddcd6f1bb44bf427ab06c006b446370ff3ef5857296c298`
(287 entries; status SHA-256
`c4e5161e6327db62b6ebc372dd9f346419aaeed42df2246aae31f08168991aba`).
The revised observer ran once and was not retried.

Pre-live repaired gates:

- focused fake/static/sequencer/inventory: **29 passed, 1 skipped**;
- plain-host sentinel: **475 passed, 49 skipped, 75 subtests**, zero
  Docker/OpenShell sentinel calls; log
  `.test-results/slice7-repair-20261007T022914Z/plain-host-sentinel.log`
  SHA-256 `f2c95fde507fe142706259d73844c6e4e0998f0bf158f4c0a6e2a30b9c7cbb65`;
- offline tier-1 recording fake: **1 passed**; log
  `.test-results/slice7-repair-20261007T022914Z/tier1-recording-fake.log`
  SHA-256 `8cd7b40ed8d7e5b841da0bd95295ee552991bb689ae3ea938412cda9ef7f3f6e`;
  manifest `.test-results/20261007T023033Z-39439-49aa1b45/tier1/manifest.json`
  SHA-256 `26ca0b0a2497d0c3fe06e63d850b853bcb25ab41986d11a604306baa047dd3ee`,
  validated passed, network absent, teardown clean/absent.

The revised sequence passed its prerequisites:

- tier 0: **475 passed, 49 skipped, 75 subtests**;
- tier 1: **47 passed, 1 skipped, 476 deselected**; manifest
  `.test-results/20261007T023408Z-50972-92b4ee52/tier1/manifest.json`
  SHA-256 `3ae251051522467e3119100aec846bc55f03d52b0a93a3149f536d79eb15d0e3`,
  validated passed, network absent, teardown clean/absent;
- tier 2: PASS; manifest
  `.test-results/20261007T023924Z-67530-8e27d3d8/integration/manifest.json`
  SHA-256 `ae63304d7492622039720c1c209e84ace7c58c2df211307708a8a9da32091945`,
  validated passed with container/image/context cleanup and zero host mounts;
- lifecycle: FAIL once; log
  `.test-results/20261006-193320-48138/lifecycle.log` SHA-256
  `7afb3cd117871afaddb1cdabfb2ed15d6241fcd356681bb87af63f4be63f577d`;
- outer log `.test-results/slice7-repair-20261007T022914Z/revised-live-test-all.log`
  SHA-256 `5ab9fcfcc3ad6e7e382f5cc48f38f8a263204243fa3b5ad01a4b7f78aeb605ce`.

Exact revised run:

- run: `6ffc582724e84015a4986dbfd8077be0`;
- workspace: `pct-6ffc582724e8`;
- target: `pct-6ffc582724e8-t` (19 characters);
- sentinel: `pct-6ffc582724e8-s` (not created);
- image: `prime-claw-lifecycle:6ffc582724e8`;
- immutable iid:
  `sha256:7c78fa8cbba3fab55981d458e7ee31874c058174b69521852f058c031996a9bf`;
- JSONL `.test-results/20261006-193320-48138/lifecycle-evidence/6ffc582724e84015a4986dbfd8077be0.jsonl`
  SHA-256 `a3bf8ee109414c822d3022ef03c831b5aeabc29f68fe59cada04671b6f2a5a33`;
- failure summary SHA-256
  `2d2ef9546599c17764bcf2a0acfbc8ff8b8c3d1bdcded9f65fc5e00a00be4c85`,
  mode 0600.

The short target was created and reread with the exact run labels. Its returned
policy hash was
`99d5d41a240fbfd4da6049f101ca47bcd8af436cba33b1e361283e9e4fd2cf68`,
not the tracked policy semantic hash
`c1716d44107b8b44a6174ff8bbdcfca8756ed6f31fde83ee7ef8bcd8cec5fa56`.
The fail-closed ownership guard refused target capture. The finalizer therefore
did not attempt target deletion, then exact workspace deletion was refused and
the finalizer stopped before immutable-image removal. Retained evidence shows
target, workspace, and image creation, but does not prove their absence.
Sentinel creation, provider inspection, generated product config/proxy, and
product destroy were not reached.

`failure.json` proves configured-production noninterference: before and after
canonical hashes both equal
`fd7e356ab7c2050174c4a817d790e9a83e4cced9e77ec74a728443ced685f945`,
with `production_unchanged=true`. No configured-production mutation or P0
incident inspection occurred.

Cycle 1 is now blocked. Any exact-run cleanup or policy-equivalence repair is a
new owner decision. No further live call is authorized. A safe cycle-2 proposal
must fake-test the accepted OpenShell v0.0.116 policy representation, reread
exact names and run labels, delete target before workspace and immutable image,
and positively verify absence. Neither consumed identity may be retried.

## Final fresh observer PASS — 2026-10-07

The one still-unused final observer ran once with fresh run ID
`2f8d0cd3754147028f71a6a34a740441`. It was not retried. The complete sequencer passed:
tier 0 in 56s, tier 1 in 339s, tier 2 in 155s, and lifecycle in 8s.

The lifecycle summary records:

- target `pct-2f8d0cd37541-t` absent after product destroy;
- sentinel `pct-2f8d0cd37541-s` preserved until finalization;
- target, sentinel, workspace `pct-2f8d0cd37541`, and image
  `prime-claw-lifecycle:2f8d0cd37541` all positively absent after teardown;
- target and sentinel provider lists empty;
- mutation classes confined to generated workspace/image/target/sentinel;
- configured-production before/after SHA-256 both
  `fd7e356ab7c2050174c4a817d790e9a83e4cced9e77ec74a728443ced685f945` and unchanged;
- final status `passed`.

Frozen candidate identity before and after the observer: HEAD
`fda41dcadbac15b2c957c866d9e22eafb5f6afca`, status SHA-256
`c4e5161e6327db62b6ebc372dd9f346419aaeed42df2246aae31f08168991aba`, content SHA-256
`6ca183fbd692322db748592091f2b915ceac2fdd89208e71ec7c2ab2820644c5`, 287
entries under `framed-sha256-v2`.

Evidence:

- outer log `.test-results/slice7-final-20261007T042755Z/final-live-test-all.log`, SHA-256 `a7f20564df26509cf0bc46f37116ffc547d6aaec7bfbc7a31fddf8bb15c3f161`;
- lifecycle log `.test-results/20261006-214041-8968/lifecycle.log`, SHA-256 `aa40ad10e450162e63a0ab3bb7f4fb645d80180cf0044903a0c2df317dcc592c`;
- lifecycle summary `.test-results/20261006-214041-8968/lifecycle-evidence/summary.json`, SHA-256 `a779b6818d9420c79434926290160a587cfe657019d3744c64bcbfb9256bb7d0`;
- lifecycle JSONL `.test-results/20261006-214041-8968/lifecycle-evidence/2f8d0cd3754147028f71a6a34a740441.jsonl`, SHA-256 `07ad81fc408a34f1b69e87f32cf5bcad46fed78773f3aa460b8d9d1f5392b888`;
- tier-1 manifest `.test-results/20261007T044138Z-12162-39ac4855/tier1/manifest.json`, SHA-256
  `2ff824ecd0fe60b05785270461826b921b9b6eec0da62a425e4344e19c3fc24d`;
- tier-2 manifest `.test-results/20261007T044716Z-28372-c02bc49a/integration/manifest.json`, SHA-256
  `042588f509771fb050cd0a011c3627bb6b2faa890d53e1f81a4752acdff984b3`.

The immediately preceding invalidated non-live gates also passed: focused
structured-identity/policy tests **35 passed**; plain host **488 passed, 49
skipped, 75 subtests** with zero OpenShell/Docker/gh sentinel calls; lifecycle
recording fake **1 passed**; full non-live `test-all` tiers 0–2 PASS with no
lifecycle admission.

## Operator stop-loss disposition — 2026-10-07

At that checkpoint, the operator accepted the retained cycle-2 JSONL as
successful exact cleanup and prohibited rerunning it. Authorization was limited
to an offline exact structured identity audit fix, regressions, invalidated
non-live gates, and the then-unused final live observer with a fresh identity.
That observer is now the PASS recorded above. All P0, credential,
configured-production, third-cycle, extra-run, and Slice-8 exclusions remained
in force.

## FINAL cycle-2 exact cleanup result — 2026-10-07

The policy-equivalence repair normalized only OpenShell v0.0.116's omission of
an empty `network_policies` map. The exact observed raw server hash
`99d5d41a240fbfd4da6049f101ca47bcd8af436cba33b1e361283e9e4fd2cf68`
then maps to the tracked semantic hash
`c1716d44107b8b44a6174ff8bbdcfca8756ed6f31fde83ee7ef8bcd8cec5fa56`.
Material and malformed policy drift remains rejected. Focused fake/static proof:
**32 passed**.

The separately bounded cleanup ran once against only retained run
`6ffc582724e84015a4986dbfd8077be0` and immutable iid
`sha256:7c78fa8cbba3fab55981d458e7ee31874c058174b69521852f058c031996a9bf`.
It validated exact labels and policy, observed sentinel absent, deleted target,
then workspace, then immutable image, and positively reread all four exact
resources absent. It also required the names-only production snapshot to match
preserved hash
`fd7e356ab7c2050174c4a817d790e9a83e4cced9e77ec74a728443ced685f945`
before mutation and again after cleanup.

The command exited 1 only after those checks. The final mutation audit used
substring matching and rejected the authorized owned image name
`prime-claw-lifecycle:6ffc582724e8` because it contains configured identity
`prime-claw`. Therefore the retained status file is `failed`, and the success
summary was not published. Under the cycle-2 stop-loss, no cleanup retry or
final observer followed.

- log `.test-results/slice7-cycle2-cleanup-20261007T025301Z/cleanup.log`, SHA-256 `ac9b530ee4ad3f56b5955cfeb60349f3b616b491e2a1e1203ca51fc614504096`;
- JSONL `.test-results/slice7-cycle2-cleanup-20261007T025301Z/evidence/6ffc582724e84015a4986dbfd8077be0.jsonl`, SHA-256 `848abd2350fc48c655d598fea8190eac8f5f24c41c5332f44b8cb2602c47e0c2`;
- failure summary `.test-results/slice7-cycle2-cleanup-20261007T025301Z/evidence/cleanup-failure.json`, SHA-256 `20ff29f81e4a0b913aa958f46661c7c231d5aa37b0d378a2693af1dfd166b2e1`;
- executing `tests/lifecycle/live.py` SHA-256 `2e1cf7ef4526587f2f40543eafbdf56ebdb69de772a5c38465bcbd60f88954be`.

Owner reassessment must decide whether the ordered deletion and positive
absence evidence counts as successful cleanup and whether to authorize only the
offline exact-identity audit correction, invalidated non-live gates, and the
still-unused final fresh observer. No third cycle or extra live retry is
permitted.

## FINAL repair cycle 2 authorization — 2026-10-07

OWNER REVISE accepts the policy-representation mismatch as an in-scope blocker
and authorizes the final cycle under the two-cycle stop-loss. Before any live
cleanup, the implementation must derive and fake-test a stable OpenShell
v0.0.116 policy-equivalence contract that accepts only the known semantic policy
in its equivalent server-reread representation and fails closed on material
drift. One separately bounded cleanup may then operate only on exact run
`6ffc582724e84015a4986dbfd8077be0`, deleting exact target before exact workspace
and immutable image iid
`sha256:7c78fa8cbba3fab55981d458e7ee31874c058174b69521852f058c031996a9bf`,
with positive absence checks. Ambiguity or refusal stops all live work.

After successful cleanup and invalidated non-live gates, exactly one final live
observer may run with a fresh identity. Neither consumed identity may be
retried. Cleanup or final-observer failure ends the cycle: no third cycle or
extra live retry. P0 `prime-claw-5v7.10`, credentials, configured production,
and Slice 8 remain outside scope.

## Authorized in-scope revision

OWNER REVISE was accepted on 2026-10-07. This is repair/review cycle 1 under the
two-cycle stop-loss:

1. Shorten derived sandbox identities to at most 19 characters, for example
   `pct-<12hex>-t` and `pct-<12hex>-s`, while preserving unique derivation.
2. Add a local fail-before-call maximum-length guard and fake/static regression
   tests tied to the OpenShell v0.0.116 contract.
3. Publish before/after snapshot hashes in retained failure evidence as well as
   pass summaries.
4. Re-run all invalidated non-live gates.
5. Then and only then perform exactly one revised live observer execution.
   Never retry the failed identity or perform more than that one revised live
   run.

No Slice 8 or deferred P0 incident work was performed or authorized.
