# Testing strategy

prime-claw uses the lowest sufficient isolation tier. Pure repository checks
stay on the host. Tests that need Prime Agent or the plugin run in the slim
disposable tier. Tests that need gbrain and PostgreSQL run in a separate
credential-free brain-stack image. The later lifecycle slice owns the explicit
OpenShell observer; Slice 3 does not authorize or run it.

## Current tiers

| Tier | Current command | Boundary |
|---|---|---|
| 0 | `python3 -m pytest tests/ -q` | Host-only static and recording-fake tests; no Docker. |
| 1 | `python3 -m pytest tests/ -q -m container` or `scripts/test-tier1.sh` | One disposable Docker container; read-only repository; run-owned writable share; no credentials or host home. |
| 2 | `scripts/test-integration.sh` | Plain-Docker PostgreSQL 16 + pgvector + exact gbrain; offline assertions; fixture-owned state. |
| transition | `python3 -m pytest tests/ -q -m sandbox` | Existing explicit host OpenShell tests pending the Slice-4 taxonomy change. |

`scripts/test-all.sh` remains the current tier-0/tier-1 fail-fast sequencer.
Slice 3 exposes tier 2 through its standalone launcher; Slice 4 owns the
sequencer/taxonomy migration. Lifecycle work is not part of the default command
and is not enabled by this slice.

## Tier-2 disposable brain stack

`config/test-artifacts.lock.json` is the only input selector. It pins upstream
`garrytan/gbrain` commit `a6be012a3bcfac42e279630aedec5cda4a450e29`,
tree `68bed6c798259e641172b9c4b277fc524b06f3f2`, package `0.50.0.0`,
and exact Git-archive SHA-256. It also pins Bun `1.3.11` release archives and
Ubuntu 24.04 image digests for native `linux/arm64` and `linux/amd64`.
Unsupported platforms fail. The launcher never silently uses emulation.

Source preparation and image build are the only networked phases. Product
assertions are offline:

1. Allocate a fresh descriptor-bound result tree and repository snapshot.
2. Fetch the locked public commit into a run-owned temporary bare repository,
   or use `INTEGRATION_GBRAIN_MIRROR` only as a transport cache. Verify commit,
   tree, package version, and `git archive` hash. Never copy a mirror working
   tree.
3. Download the platform's official Bun archive and verify its locked hash.
4. Generate a fresh context containing only the locked archive contents, Bun,
   lock, run identity, and `docker/test-integration.Dockerfile`.
5. Build with a native platform, run-owned iidfile, immutable base digest, and
   run ownership labels. Require the exact local tag from image inspection,
   normalize only the allow-listed local repository digest, capture executable
   and embedded base/source lineage, then delete the context through its exact
   owned-directory binding.

The launcher then creates one exact iid image with a run-owned cidfile and
`--network none`. Host inspection requires:

- labels and image/container identities for this run;
- unprivileged user `tester`;
- no published or exposed ports, privileged mode, Docker/OpenShell socket,
  host home, data directory, or credential/provider environment;
- exactly `/workspace` from the run-owned snapshot read-only and `/results`
  from the run-owned share read/write; and
- only fixed `PATH`, `HOME`, and `LANG` image environment.

Only after that inspection does the launcher invoke
`tests/integration/environment_body.py` with a run/container/image attestation.
The body is intentionally not named `test_*.py`, so plain host pytest cannot
collect it. Direct invocation fails before fixture creation unless the exact
container attestation and mounts exist.

Inside the already-offline container, the body proves:

- non-root execution, read-only repository, writable result share, and refused
  external TCP while loopback remains usable;
- exact embedded gbrain/Bun/source hashes and gbrain `0.50.0.0`;
- fixture-owned PGDATA/socket/database with PostgreSQL 16 and `vector`,
  `pg_trgm`, and `pgcrypto` extensions;
- idempotent public migrations at gbrain schema version 149;
- a synthetic committed corpus, fixture-owned bare remote and round-trip clone,
  local-only source registration/sync, and keyless get/search; and
- bounded PostgreSQL fast-stop before the assertion process succeeds.

The host validates and promotes only the sanitized body receipt. It re-inspects
the unchanged boundary, removes the exact labelled container and image, and
requires successful removal plus an exact allow-listed not-found inspection.
Ordinary nonzero removal remains non-clean even if absence is later proved.
Malformed identity, label drift, daemon/transport error, timeout, signal,
presence, or unknown state preserves possibly mounted state and keeps the run
red. A lost iid/cid may fall back only to the exact expected tag/name; immutable
ID plus run/contract labels and image/name bindings must match before deletion.
The driver defers TERM/INT/HUP across ordinary Python phases, freezes them for
exact cleanup, then returns `128+signal`. The supervisor owns the same signals
through terminal publication and replaces any just-published success with failed
evidence if interruption wins the boundary.

`manifest.json` uses the separate `integration-v1` contract. It cross-binds the
artifact lock, repository snapshot, immutable image, inspected container,
inner receipt, platform, exact gbrain binary, PG/vector/migration identity,
synthetic-corpus hashes, local Git identities, offline proof, normalized local
image digest, immutable base digest, and preparation/container/image/context/
snapshot/share teardown. The scratch share, workspace snapshot, preparation
repository, and generated context are never accepted as durable evidence. A
passed receipt requires all six exact teardown rows to be clean. Passed
manifests can be compared with:

```bash
python3 -m scripts.testing.integration_provenance compare-runs \
  .test-results/<first>/<run>/integration/manifest.json \
  .test-results/<second>/<run>/integration/manifest.json
```

The comparison loads and independently verifies both complete evidence trees,
rejects the same directory, requires disjoint run/image/container/database/
PGDATA/gbrain-home/bare-remote/Git identities, and requires equal repository,
platform, lock, Dockerfile, base image, gbrain, corpus, PostgreSQL, extension,
migration, and schema identities.

## Tier-1 pinned run

A direct driver or pytest fixture run allocates a fresh
`.test-results/<run-id>/tier1/` tree. It never adopts a stale tree.

1. Enumerate tracked plus nonignored untracked repository files through
   root-anchored file descriptors. Every ancestor and regular leaf is opened
   with no-follow semantics; nonblocking leaf opens reject FIFO/special-file
   swaps before reads. File bytes are hashed and copied from the same checked
   descriptor. Rollback and terminal removal require the captured owned
   directory binding and never recurse through a replacement pathname. Safe
   relative leaf links are copied as link text and
   validated inside the finished snapshot. Ignored `.env`,
   `.test-results`, credentials, and operator-local files are neither mounted
   nor hashed.
2. Record repository HEAD, dirty/status hash, entry count, and a v2
   length-framed digest identity for the captured snapshot. Mount only the
   snapshot read-only at `/workspace`.
3. Copy `docker/test.Dockerfile` from that snapshot into an otherwise empty
   run-owned build context. Hash the final captured context file used by Docker,
   not the mutable checkout path. The Dockerfile is the current declared input
   because it contains no `COPY` or `ADD` instruction.
4. Build with an informational input-hash tag and a fresh `--iidfile`.
5. Inspect and launch the immutable iidfile image ID. The tag is never used as
   execution identity.
6. Capture the container with a fresh `--cidfile` and install the requested
   pinned Prime Agent version while its network is attached.
7. Disconnect every network reported for that exact container and re-inspect.
   Any remaining network or unknown inspection fails before apply/check/probes
   or test bodies.
8. Offline, pipe image/version/artifact observations directly to allow-listing
   producers. Require a full lowercase executable SHA-256 before any named
   artifact write, retain an exact valid rejected version (including a
   prerelease), then apply and check the plugin against
   `PRIME_AGENT_PLUGIN_ROOT=/root/.prime/agent`, then run the optional probe or
   selected pytest bodies.
9. Mount only a fresh `share/` scratch directory writable. The durable evidence
   root, iidfile, cidfile, build context, and metadata never enter a writable
   container mount.
10. Remove only the captured container ID. Presence and command health remain
   separate: any ordinary nonzero removal, target signal death, controller
   interruption, timeout, launch error, or reap failure stays a failed teardown
   even if the final inspect positively reports absence. Remove the workspace/
   share only when teardown is positively clean and every captured directory
   binding still matches.

Every host-side Docker wait uses `scripts/testing/bounded.py` with a validated
positive deadline, a run-owned process group, TERM→KILL escalation, a bounded
leader reap, and regular-file output capture that cannot wait on pipe EOF from a
detached child. The controller keeps its post-spawn orphan-race mask while an
owned exec-in-place shim restores the intended child mask. On every terminal
outcome it re-blocks TERM/INT/HUP, restores every caller handler, and only then
restores the exact caller mask. That final mask transition naturally redelivers
newly pending caller-unblocked signals while preserving caller-blocked pending
signals. Target signal death is typed separately from controller interruption.
The standalone supervisor
keeps TERM/INT/HUP blocked through terminal evidence closure, folds newly
pending watched signals into the typed nonzero result, invalidates any just-
published green manifest, then restores the caller's handlers and mask. Signals
the caller already had blocked remain caller-owned. The pytest fixture captures the caller mask and pending watched signals before
evidence-capability acquisition, then keeps acquisition, signal ownership,
partial handler installation, terminal publication, restoration, and capability
close inside one fail-closed boundary. It attempts every prior-handler
restoration before restoring the exact caller mask. Signals
consumed during setup or cleanup are replayed once; kernel-pending signals are
redelivered naturally; caller-blocked pending signals remain caller-owned. The
evidence capability closes even when replay or a prior handler raises. Signals
observed at inventory, manifest write, post-write verification, or restoration
publish `interrupted` failed evidence (or fail closed with no green manifest).
Build, install, inspect/disconnect, apply/check, probe, and teardown use explicit
budgets. A valid cidfile recovered after failed launch is still removed;
malformed identities never reach a destructive command.

## Tier-1 source run

`PRIME_AGENT_SOURCE` now uses the same runtime boundary as pinned mode plus a
separate disposable preparation container:

1. Before Docker contact, the host reads Git with `GIT_OPTIONAL_LOCKS=0` through
   a retained no-follow checkout descriptor. It records tracked plus nonignored
   untracked files, including dirty content, modes, safe relative links, and
   missing tracked inputs. Ignored dependency/build caches are excluded from the
   selected-source identity.
2. A second no-follow inventory hashes the complete checkout, including the root,
   ignored `node_modules`, every package `dist`, prior `release/tier1` output,
   modes, and link-target bytes. Only the aggregate hash/counts become durable.
3. `docker/test-prime-agent-builder.Dockerfile` is built from a fresh context
   containing only that Dockerfile and `source_builder_payload.py`. The image is
   captured by iidfile and launched by exact ID with a cidfile.
4. The selected checkout and sanitized source manifest are mounted read-only.
   Only `share/source-release` is writable. The controller inspects the exact
   container and requires precisely those two read-only mounts plus the fresh
   writable export; it passes no host home, socket, credentials, config, or
   repository workspace.
5. Inside the builder, selected inputs are rehashed while copied to container-
   local `/work`. Dependency install, stale-output cleanup, build, and
   `release:pack` operate only on that local copy. Output is restricted to the
   four release tarballs, `SHA256SUMS`, `stable`, `latest.json`, and a manifest
   published last.
6. The host removes and inspects only the captured builder CID. Absence is
   established only by an allow-listed Docker `no such container/object`
   diagnostic. An ordinary nonzero removal remains non-clean even when that
   later inspection proves absence. Daemon, permission, transport, malformed or
   non-UTF8, timeout, signal, launch, present, and unknown results also remain
   non-clean. The complete checkout inventory must remain exactly equal before/
   after.
7. Builder and runtime share ownership are tracked independently. The writable
   share is deleted only after every possible owner is positively clean and
   absent; a missing, unreadable, JSON-invalid, type-invalid, present, unknown,
   or failed-removal builder receipt preserves it and keeps the run red. A
   terminal receipt failure cannot bypass independent exact-ID runtime cleanup
   or failed evidence publication. The runtime mounts the run-owned scratch
   share read/write for ordinary results and separately exposes the validated
   artifact subtree read-only at `/stage`; installation rehashes and reads only
   `/stage`. It then removes the network, records installed package metadata and
   executable identity, and performs apply/check/probe or pytest bodies offline.
   The source checkout is never mounted into runtime.

Both `scripts/test-tier1.sh` and `tests/conftest.py` invoke only
`scripts/build-prime-agent-test-release.sh`; no fallback host build or old
`source/.../release/tier1` path exists. Rollback must leave source mode
fail-closed rather than restore host mutation.

## Provenance evidence

`manifest.json` uses schema version 2 and canonical sorted JSON. It records:

- run ID, mode, status, safe failure codes, UTC bounds, and command-contract version;
- repository HEAD, dirty boolean, status/content SHA-256, v2 hash contract, and exact snapshot entry count without exposing paths or content;
- requested pinned Prime Agent version on pinned attempts; source attempts add
  HEAD/dirty/content identity, versioned include/exclude rules, complete checkout
  equality, pack-command/output hashes, immutable builder image/CID teardown,
  validated release identity, installed version, and executable SHA-256;
- immutable image ID, allow-listed platform, captured Dockerfile and declared-
  input hashes, v2 hash contract, informational tag, and build bounds; arbitrary
  registry/repository metadata is discarded and never written;
- verified network-removal time plus teardown presence, remove outcome, inspect
  outcome, and clean boolean; and
- SHA-256 for every other regular evidence file below the tier directory.

On a dirty source run, `repository.head` names only the base commit and
`repository.content_sha256` binds the tested snapshot. Evidence may call a run
an exact-candidate execution only when it records a clean exact HEAD or retains
an independently reviewable tested-generation path/hash inventory whose digest
is verified against the candidate and before/after every cited run.

The manifest excludes itself and the optional scratch `share/` from its evidence inventory. Validation rejects an
unsupported schema, malformed hashes, incomplete or contradictory source lineage, unsafe paths, common
credential forms, host-home values, unknown text encodings, directory/file
links, special evidence, missing evidence, extra stale evidence, changed
content, contradictory success/teardown claims, and malformed UTC timestamps.
Setup logs contain only allow-listed phase names, not raw tool output. Teardown
stdout/stderr is classified in memory and never copied into console text,
exceptions, notes, or evidence. Publication validates first, writes a
mode-0600 temporary file in the same directory, fsyncs, and atomically renames.
A producer may replace only its own just-written manifest to turn a stale
success into terminal failure; it never adopts or overwrites prior-run evidence.
A publication fault leaves failed or no evidence, never a green contradiction.

Repository digest metadata is deliberately omitted from durable evidence; the
exact `sha256:...` iidfile image ID is authoritative. The build-input tag is
informational because the Ubuntu tag
and package repositories are external inputs.

## Safety and reproduction

- Do not mount the Docker socket, host home, credential stores, live databases,
  arbitrary checkouts, or operator config into the container.
- Do not use broad Docker name matching or prune commands.
- Set `TIER1_ENV_FILE` to an ignored file containing exactly one selector.
- Set `TIER1_KEEP_SHARE=1` only when debugging; durable manifest and setup
  evidence remain even when the scratch share is removed normally.
- Reproduce Slice-2 host coverage with:

  ```bash
  python3 -m pytest \
    tests/test_source_builder.py \
    tests/test_testing_provenance.py \
    tests/test_tier1_driver.py \
    tests/test_tier1_launch_error.py \
    tests/test_tier1_network_policy.py \
    tests/test_tier1_fixture.py \
    tests/test_tier1_image.py \
    tests/test_source_builder_real_install.py -q
  ```
- Run source mode with an ignored selector file:

  ```bash
  TIER1_ENV_FILE=/path/to/source.env scripts/test-tier1.sh --probe
  TIER1_ENV_FILE=/path/to/source.env python3 -m pytest tests/ -q -m container
  ```

  The source-selected container gate includes the disposable two-generation
  real-install proof. It installs and invokes generation A and then dirty
  generation B at the same version/path, with a stale A artifact present, and
  retains `source-generations/two-generation-summary.json` under the selected
  results root.
