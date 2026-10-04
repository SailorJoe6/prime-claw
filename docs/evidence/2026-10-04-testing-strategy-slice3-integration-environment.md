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

This is repaired implementation evidence, not the final exact-candidate pair,
because documentation and receipts were still changing. Final exact-candidate
two-run receipts will be appended before publication.

## Contract tests

The focused pure gate covers lock shape, exact absence diagnostics,
ordinary-nonzero cleanup, boundary drift, sanitizer safety, verified run
disjointness, manifest/body tampering and cross-binding, explicit-body
placement, pinned Dockerfile, dry-run isolation, partial build/create recovery,
exact tag/name/ID cleanup, directory retention, deferred signals through the
real bounded wrapper, supervisor closure, and plain-host collection/direct
invocation.

## Host gates

- Focused Slice-3 file: **33 passed**.
- Integration plus accepted Tier-1 signal regression: **124 passed, 68
  subtests passed**. This specifically proved the test harness restores the
  caller signal mask/handlers after simulating production process exit.
- Full Docker-free host suite: **394 passed, 149 skipped, 130 subtests passed**
  in 169.81 seconds. Skips are explicit environment tiers.
- Both read-only preflight reviewers reported PASS after the signal-finalizer
  and exact-tag fallback repairs.

These are pre-commit gates. Exact-candidate Docker receipts are recorded below
only after the candidate commit is frozen.

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
