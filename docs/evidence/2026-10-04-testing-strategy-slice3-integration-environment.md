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

### Owner-requested B1-B5 failure-path revision

The authoritative owner BLOCK report is
`/Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-791d8992/slice3-22e41a0-owner-review.md`,
SHA-256
`155ec9b098df03b4cdbdfded7a52cbfd61d460dcc099edf0b1c32cb2c8ad1eb1`.
It rejected candidate `22e41a0ed39070017a92b7beddc4b2440ed33b05` for B1-B5.
That commit and all of its receipts remain regression baselines only.

The current bounded repair is still an uncommitted, unpublished candidate. A
read-only adversarial checkpoint audit BLOCK is retained at
`/Users/jlanders/.prime/agent/session-artifacts/01a0fee6-4ed7-725a-8cf9-0ba9fbf056b9/sub-750168dc/b1-b5-current-audit.md`, SHA-256
`5d1d49e626a272a3e6354c0525eb911a8e254f486f5897da154a5d80893ce419`.
Its concrete B1/B2/B3/B5 reproductions were accepted and repaired; B4 remained
closed. A subsequent adversarial re-audit BLOCK is retained at
`/Users/jlanders/.prime/agent/session-artifacts/01a0fee6-4ed7-725a-8cf9-0ba9fbf056b9/sub-4048acc1/b1-b5-repair-reaudit.md`, SHA-256
`ff716ecb824a3f89b74b8fb557e407871130abf11e45e34b22229b639d6a752d`.
It found B2/B3/B5 materially closed and B4/F3 preserved, but reproduced one
remaining B1 transient leaf replace/read/restore gap. That finding is accepted
and repaired below. Targeted independent recheck
`/Users/jlanders/.prime/agent/session-artifacts/01a0fee6-4ed7-725a-8cf9-0ba9fbf056b9/sub-a3938430/b1-exact-leaf-recheck.md`, SHA-256
`cb6e9708124c0bd0fbfe1ff6d9952e9e17ec47751ce8868c31a681f7bb643b84`,
returns **PASS** and closes B1 without reopening B2-B5/F3.

The repaired working tree now:

- acquires/creates the snapshot parent through one continuous descriptor chain,
  retains exact destination regular-file bindings in capture records, and rejects
  root/ancestor republishing or copied regular/link/mode/content changes. Each
  Dockerfile/lock read retains and matches its exact capture-time inode before
  returning digest-checked bytes, closing transient replace/read/restore ABA;
- treats Docker's client/daemon pathname consumption truthfully: retained checks
  reject persistent replacement, while a hostile same-UID transient
  replace-and-restore during daemon path resolution is outside the run-owned
  results-tree trust boundary rather than claimed as impossible;
- makes the inner driver provisional and keeps owned handlers installed through
  disposable child exit, so direct-child TERM/INT/HUP cannot be consumed by a
  restored returning/ignored/default/throwing prior handler;
- makes the outer CLI supervisor the sole final publisher through child exit,
  candidate/evidence validation, final publication, terminal unmasking, and
  `os._exit`;
- retains the exact writable final-manifest inode and writes a binding sidecar.
  Descriptor-only neutralization leaves a raced replacement untouched, while
  binding-aware public validation rejects that replacement as unauthoritative;
- owns only watched signals absent from the caller's original mask. Pre-existing
  and later caller-blocked signals remain pending through run, cleanup, and
  restoration; and
- uses stable bounded no-follow reads with iid/cid/body-specific limits and
  aggregate evidence entry/file/byte/depth limits before sorting or hashing.
  Final publication and evidence are revalidated after unmask and again at exit.

F3 remains closed and unchanged: malformed Docker shapes become typed unknown,
and every independently safe recovery/cleanup/failure-publication stage is still
attempted.

## Current repair regressions

The focused B1-B5 set now covers the audit reproductions as well as the original
owner matrices:

- capture-time ancestor transfer, post-capture root/ancestor republishing, and
  capture-bound regular-inode replacement;
- direct-child TERM/INT/HUP with returning, ignored, default, and throwing prior
  handlers, proving the supervised driver retains ownership through exit;
- public-manifest replacement outside the tier with byte-identical passed JSON,
  exact old-inode neutralization, and binding-aware rejection of the untouched
  replacement;
- iid/cid/body path-specific inventory budgets, bounded directory fan-out/depth,
  append-under-read rejection, and public post-unmask evidence mutation; and
- the previously recorded B4 timing matrix, namespace failures, special-file
  deadlines, typed recovery, exact cleanup, and two-run invariants.

Post-B1 source evidence now passes:

- focused: **252 tests + 30 subtests** in 40.87 seconds, log
  `.test-results/slice3-b1-final-source-20261006T024136Z/focused.log`, SHA-256 `148a78b090cf4e3c37b0c18f504f56bd44e70adb06c7ba3d94b1550bce7e3d23`; and
- affected: **343 tests + 98 subtests** in 134.87 seconds, log
  `.test-results/slice3-b1-final-source-20261006T024136Z/affected.log`, SHA-256 `9e87e4dc3f8d126cb706adfa7833e55f1e5240d0c39647eec11dffc5803fef5f`.

The independent B1 recheck additionally passed 12 selected tests and the same
252-test focused pair. The full host gate then passed **559 tests / 149 skipped /
130 subtests** in 188.51 seconds, log `.test-results/slice3-b1-final-source-20261006T024136Z/full-host.log`, SHA-256
`f7a87ae165cd3acfc63e45650954ee8c3dc5af3b18e4100f38c41345041ccbb9`. These source and review results are not yet frozen-candidate
Docker acceptance.

The earlier affected source gate passed **317 tests + 98 subtests** and the full
host gate passed **533 tests / 149 skipped / 130 subtests**, but both ran before
the audit repairs and are therefore superseded. Their retained raw logs are:

- `.test-results/slice3-b1b5-repair-20261006T015957Z/affected.log`, SHA-256
  `5ca033e99bd8cee1c598cf95b40eb8284fb7722e93da5134022b1ccdfb219bc6`; and
- `.test-results/slice3-b1b5-repair-20261006T015957Z/full-host.log`, SHA-256
  `724271268924e6763ae31238f04257fdf5922e6d96af56c79ae57205540c63cd`.

Fresh affected/full source gates, independent re-audit, exact-commit two-run
Docker validation, manifest comparison, cleanup proof, and final independent
review remain required before publication.

## Historical host and Docker evidence

The rejected `22e41a0…` generation passed focused **124**, affected **269 + 98
subtests**, and full host **485 passed / 149 skipped / 130 subtests**. Its retained
full-host log SHA-256 is
`ae072fc715c31f8f2c5a73bf406424509ca026cda97f1263609fa58aaa540376`.
Its two ordinary Docker manifests and pair summary remain useful regression
baselines, but the owner BLOCK supersedes every earlier PASS recommendation.
None is acceptance evidence for the current B1-B5 repair.

Fresh terminal evidence will be recorded only after the repair passes the
sequential source gates, is frozen to one clean commit, completes two exact-commit
`--rebuild` Docker runs, passes manifest validation/comparison and cleanup checks,
and receives independent review. The Bead and owner packet remain the terminal
receipt authorities.

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
