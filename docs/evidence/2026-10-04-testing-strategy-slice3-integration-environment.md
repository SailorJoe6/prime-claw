# Slice 3 evidence — disposable brain-stack integration environment

**Date:** 2026-10-04
**Bead:** `prime-claw-5v7.5`
**Status:** implementation validation in progress; owner acceptance pending

## Capability

Slice 3 adds a plain-Docker, credential-free integration tier for the exact
upstream gbrain build and a fixture-owned PostgreSQL 16 + pgvector stack. It is
separate from Prime Agent, OpenShell, operator homes, live brains, and live
databases.

Tracked inputs:

- `config/test-artifacts.lock.json` — gbrain commit/tree/archive/package, Bun
  `1.3.11` archive hashes, and Ubuntu 24.04 index/platform digests;
- `docker/test-integration.Dockerfile` — checksum-fed two-stage native build;
- `scripts/test-integration.sh` plus the integration driver, supervisor, and
  provenance validator;
- `tests/integration/environment_body.py` — explicit, non-default assertion
  body; and
- `tests/fixtures/brain-source/` — synthetic corpus and exact manifest.

## Locked identity

- gbrain commit: `a6be012a3bcfac42e279630aedec5cda4a450e29`
- tree: `68bed6c798259e641172b9c4b277fc524b06f3f2`
- package: `0.50.0.0`
- Git archive SHA-256:
  `78ef4b78fbe2cb1de32862c45a244c0f0b8c20ec468a21c5ecffbba50d53ca1e`
- native platform observed during development: `linux/arm64`
- Bun archive SHA-256:
  `d13944da12a53ecc74bf6a720bd1d04c4555c038dfe422365356a7be47691fdf`
- Ubuntu arm64 child digest:
  `sha256:08571ca13e00ca07a2a84eab83a959b4242e22cceb16486a11bef1428c9e93a7`

The lock also contains reviewed native `linux/amd64` identities. Cross-platform
emulation is not an implicit fallback.

## Development evidence

### Retained first red

The first empirical run built the locked image, then rejected its own boundary
receipt because a boolean key contained the sanitizer-forbidden word
`credential`. Exact container/image cleanup completed, but the same defect
prevented terminal-manifest publication. The incomplete red root is retained at
`.test-results/slice3-dev1-20261004T184717Z/`. It is not acceptance evidence.
The repair uses a non-sensitive key and has a direct sanitizer regression.

### Revision status-IPC red

The first exact run of the owner-requested revision stopped before any image
build or container creation. The supervisor status channel used the sanitized
evidence writer for its ephemeral local `tier_dir`; the evidence sanitizer
correctly rejected that host path. Retained outer log:
`.test-results/slice3-replacement-43e594068d98-run1/outer.log` SHA-256 `fa2cd9dbd48607172ff237d9b455f7529833ed4043bcb59f504b0aa278b25652`. Run `20261005T002723Z-27261-03a52d18` published only a
non-green preparation receipt, and exact label-filter checks found no container
or image for that run. The repair keeps the channel descriptor-bound and bounded
but writes canonical private IPC bytes rather than treating the local path as
durable sanitized evidence. A direct status round-trip regression covers it.

### First green environment proof

Run `20261004T185004Z-50970-05ca4d85` passed under
`.test-results/slice3-dev2-20261004T185003Z/` before later validator hardening.
Its manifest SHA-256 was
`f221116d68bc7b3490c3cdfa18df176bc7c084cfb854803b330f8c9690ad02df`.
It proved the real environment recipe:

- unprivileged offline assertion container;
- exact gbrain `0.50.0.0` executable SHA-256
  `fd0de09648fb181e1a671372bc9c3b2c940d099ecb004525adb6dd5f4cbc5714`;
- PostgreSQL `16.15`, pgvector `0.6.0`, and migration version `149` across 69
  public tables;
- local synthetic source sync plus get/search and a fixture-owned bare Git
  round trip;
- no host port, Docker/OpenShell socket, credential environment, host home, or
  host data mount;
- external TCP refused while loopback PostgreSQL worked; and
- successful exact-ID container, image, and generated-context removal followed
  by strict absence.

This run is discovery evidence only because validator/cross-binding hardening
continued afterward.

### Safe image-lineage red

Run `20261004T192823Z-68492-b92caa57` under
`.test-results/slice3-dev4-20261004T192822Z/` rejected an over-strict assumption
that local BuildKit images have no repository digest. It published a verified
failed manifest (SHA-256
`75166265e1d814e909413aa9fe68dc001521b4a72264bfd8822088b396ff23b6`)
and proved clean preparation/image/context/snapshot/share teardown with no
container created and no matching Docker resource retained. The repair accepts
only the exact local repository name and records its normalized `sha256:...`
digest; arbitrary repositories and duplicate/malformed digests remain rejected.

### Post-review green environment proof

Run `20261004T193111Z-86606-6ebbc3e5` under
`.test-results/slice3-dev5-20261004T193109Z/` passed after all preflight repairs.
Its independently loaded and hash-verified manifest SHA-256 is
`ad5cbc53fc3e9a906fef9e3de084222b358d2724b72520b3d750d3727ebbc439`.
It records local image digest
`sha256:651c319cadb862d8fbb7548354c8e402642689b5daa957a04b0932d012341a12`,
container ID
`9c0bfdfc70dd64d94a74d7feff559b2c708ab5514b8d11623779bdb660b0cf24`,
PostgreSQL `16.15`, pgvector `0.6.0`, schema version `149`, 69 public
tables, exact body attestation, and clean preparation/container/image/context/
snapshot/share teardown. Independent label-filter inspection found no remaining
run-owned Docker object.

This run is repaired development evidence. The later exact candidate
`6d6f7ee7bbb208b88c798fe4c469188930f07579` produced two independently
verified manifests (`7dafc77e8c44031ca5bf7d29f75a9b006f0179b90b6000b8526a8c7bb5987dcc`
and `f8cbc622598ab5e5bc163f1916115610c281a2f61f8e4d2530cc113fa73eefcb`),
but the owner rejected that candidate for failure-path defects. Those receipts
remain regression baselines, not acceptance evidence. Terminal exact-candidate
receipts are recorded in the Bead and owner packet after a candidate is frozen;
the tracked document is not edited after exact-commit validation.

### Owner-requested failure-path revision

The authoritative owner report SHA-256 is
`1e8e1f94f19221e6682a1dc17b4cc0e56fc78f9b503445f05bd591523ca5c759`.
The bounded revision:

- retains a no-follow descriptor/binding chain for every public directory
  component through preparation, build, mount validation, reads, and cleanup;
- reads iid, cid, body, and supervisor status as bounded, stable regular files
  with `O_NOFOLLOW|O_NONBLOCK`, rejecting links, FIFOs, directories, devices,
  oversized content, mutation, and replaced ancestors; a nonce ACK prevents any
  real driver from publishing green before the supervisor retains both the full
  tier chain and an fd-only terminal-closure capability;
- quarantines and restores caller-preexisting pending signals while owning only
  run-arrival TERM/INT/HUP, and closes green evidence through supervisor handler
  restoration with descriptor-only invalidation even after status/tier root or
  ancestor replacement;
- normalizes malformed Docker inspect row/`Config`/`Labels` structures to typed
  unknown; and
- isolates recovery, exact container/image cleanup, directory cleanup, and
  failed-manifest publication so one malformed stage cannot skip another safe
  stage.

## Contract tests

The current focused Slice-3 file covers **124 tests**: lock and boundary shape,
exact absence, ordinary-nonzero cleanup, sanitizer and evidence cross-binding,
two-run disjointness, root/ancestor republishing, mount alias replacement,
FIFO/special-file reads, iid/cid/body/status authority, caller pending/mask/
handler ownership, real TERM/INT/HUP restoration races, replacement-failure
neutralization, malformed inspect matrices, partial-create cleanup, and
exception-isolated public finalization.

## Host gates

Fresh revision gates before candidate freeze:

- focused Slice-3: **124 passed**; and
- integration plus Tier-1 signal set: **269 passed, 98 subtests passed**.

The final retained-tier-handshake source full-host gate passed **485 tests,
149 skipped, 130 subtests** in 179.88 seconds. Retained raw log:
`.test-results/slice3-final-b12-host-20261005T040024Z/full-host.log` SHA-256
`ae072fc715c31f8f2c5a73bf406424509ca026cda97f1263609fa58aaa540376`.
The prior 424-, 433-, and 434-test checkpoints remain retained history but are
superseded by this final source run.

The earlier **89 + 30**, **124 + 68**, and full-host **394 passed / 149 skipped /
130 subtests** totals belong to the rejected candidate and lack retained raw
stdout. They remain historical reported-only context, not replayed revision
evidence. Replacement full-host and exact-Docker evidence is recorded only after
those sequential gates run on the final source and frozen commit.

### Final-review repair checkpoint

Independent review report SHA-256
`d745fb257eff01c82b0f97aefe03fdb314f5a8151014a4a5e337169807d13baa`
blocked the first replacement on a shadowed unsafe identity helper and a
status-loss false-green boundary. The unsafe duplicate was removed. Producer
iid/cid tests now exercise special leaves and replaced roots through the real
build/create consumers. Real runs use the nonce ACK and retained tier closure
capability described above. Seeded-green tests cover status and tier root/
ancestor loss, child exit 0/7, and late TERM/INT/HUP; every detached original
manifest becomes failed. The same reviewer returned PASS for the repaired B1/B2
boundary before final source freeze.

## Accepted boundaries and limitations

- Online work is limited to public locked source/Bun/base acquisition and image
  build. Product assertions run with `--network none`.
- A local gbrain checkout can be a transport mirror only. Its working tree is
  never copied, and every locked identity is recomputed.
- The repository snapshot is read-only. The result share is the only writable
  host mount and is removed only after clean exact ownership closure.
- The local bare remote proves fixture Git behavior only. It is not evidence for
  production L7 Git routing.
- This slice does not run or authorize any Phase 3a live action, lifecycle
  observer, OpenShell mutation, Prime Agent probe, Slice 4, or later work.
