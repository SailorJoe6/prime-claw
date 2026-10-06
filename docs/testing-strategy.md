# Testing strategy

prime-claw uses the lowest sufficient isolation tier. Pure and recording-fake
unit tests stay on the host. Tests that execute Prime Agent or the plugin run in
the slim disposable Docker tier. Tests that execute gbrain and PostgreSQL run in
a separate credential-free Docker image. Real OpenShell lifecycle execution is
disabled; no marker or test-all option enables it.

## Current tiers

| Tier | Current command | Boundary |
|---|---|---|
| 0 | `python3 -m pytest tests/ -q` | Host-safe static, pure unit, and recording-fake orchestration tests; no Docker. |
| 1 | `python3 -m pytest tests/ -q -m container` or `scripts/test-tier1.sh` | Real Prime Agent/plugin execution in one disposable Docker container; no credentials or host home. |
| 2 | `scripts/test-integration.sh` | Real PostgreSQL 16 + pgvector + exact gbrain in plain Docker; offline assertions; fixture-owned state. |
| lifecycle | disabled | No real OpenShell lifecycle test entry. Mocked lifecycle behavior is tier 0. |

Plain pytest is Docker-free. Only the exact marker expression `-m container`
authorizes tier 1; arbitrary or compound expressions keep protected tests
skipped. Tier 2 is not a pytest body: its non-collectable assertion program has
an explicit container-entry guard and runs only through
`scripts/test-integration.sh`. `scripts/test-all.sh` runs tiers 0, 1, and 2 in
that order and stops on the first failure. The legacy `--with-sandbox` and the
replacement `--with-lifecycle` both return a non-mutating usage error.

## Tier-2 disposable brain stack

Run the explicit real-stack integration tier with:

```bash
scripts/test-integration.sh
# force a fresh native build
scripts/test-integration.sh --rebuild
# optional local public-source cache; the checkout itself is never mounted
INTEGRATION_GBRAIN_MIRROR=/absolute/path/to/gbrain scripts/test-integration.sh
```

This tier assumes the local host, checkout, launcher, Docker daemon, and same-UID
operator are trusted during the run. It tests ordinary functionality and isolation;
it is not a defense against hostile local pathname or process races.

### Build and inputs

The launcher verifies `config/test-artifacts.lock.json`, selects only the native
`linux/arm64` or `linux/amd64` identities, and stages a private temporary build
context containing only:

- the exact locked gbrain Git archive;
- the exact locked Bun archive;
- `docker/test-integration.Dockerfile` and the artifact lock;
- `tests/integration/environment_body.py`; and
- the synthetic `tests/fixtures/brain-source/` corpus.

The assertion body and fixtures are baked into the image. The tested repository
HEAD, dirty state, and a deterministic selected-input content hash are recorded.
The build may use the network to install public locked dependencies. There is no
cross-platform emulation fallback.

### Runtime isolation

The image runs as fixed nonroot user `tester`. Its HOME, PostgreSQL data/socket,
results, temporary files, and synthetic Git repositories are all container-local.
The launcher creates the container with:

- `--network none`;
- no bind mounts or volumes from the host;
- no published ports;
- no privileged, host PID, or host IPC mode;
- no Docker/OpenShell socket, host home, credentials, provider environment, or
  production data/service connection; and
- exact run and contract labels.

The body proves real gbrain `0.50.0.0` initialization/migration against PostgreSQL
16 + pgvector, fixture sync/get/search, and a fixture-owned bare Git push/clone
round trip. It also proves nonroot execution, baked inputs are non-writable, local
result storage is writable, and external TCP fails under `--network none`.

### Result and cleanup

After the body finishes, the launcher stops the container and uses `docker cp` to
copy `/home/tester/results/body.json` into the run directory. It validates the
receipt and writes one readable `manifest.json` with tested commit/content,
platform and locked versions, immutable image/container IDs, result details, and
cleanup outcomes.

Cleanup is best-effort but ownership-safe: the launcher inspects the exact captured
ID (or the unique run name/tag after a partial create/build), requires matching
run/contract labels, and only then removes that object. It never prunes or deletes
an unverified resource. Command failure, timeout, SIGINT/SIGTERM interruption,
missing/malformed copied output, label mismatch, or cleanup failure is nonzero and
cannot publish a passed manifest.

Validate a retained manifest with:

```bash
python3 -m scripts.testing.integration_provenance   .test-results/<run-id>/integration/manifest.json
```

One successful native run is acceptance evidence. State the observed platform
truthfully. A second-run comparison can be used during review, but it is not
permanent launcher machinery or a completion requirement.

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
