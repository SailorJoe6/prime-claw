# Testing strategy

prime-claw uses the lowest sufficient isolation tier. Pure and ordinary
recording-fake unit tests stay on the host. Environment-sensitive process,
launcher, wrapper, Git/worktree/socket, Node, Prime Agent, and plugin behavior
runs in the slim disposable Docker tier. Tests that execute gbrain and PostgreSQL run in
a separate credential-free Docker image. The lifecycle boundary is inert by
default; one exact host observer exists behind the explicit
`scripts/test-all.sh --with-lifecycle` sequence.

## Current tiers

| Tier | Current command | Boundary |
|---|---|---|
| 0 | `python3 -m pytest tests/ -q` | Host-safe static, pure unit, and recording-fake orchestration tests; no Docker. |
| 1 | `python3 -m pytest tests/ -q -m container` or `scripts/test-tier1.sh` | Real Prime Agent/plugin execution in one disposable Docker container; no credentials or host home. |
| 2 | `scripts/test-integration.sh` | Real PostgreSQL 16 + pgvector + exact gbrain in plain Docker; offline assertions; fixture-owned state. |
| lifecycle | `scripts/test-all.sh --with-lifecycle` | After tiers 0–2, runs one exact registered host body with marker + fixture + pytest + sequencer admission. |

Plain pytest is Docker-free. Only the exact marker expression `-m container`
authorizes tier 1; arbitrary or compound expressions keep protected tests
skipped. Tier 2 is not a pytest body: its non-collectable assertion program has
an explicit container-entry guard and runs only through
`scripts/test-integration.sh`. Plain `scripts/test-all.sh` runs tiers 0, 1,
and 2 in that order and stops on the first failure. Exact
`--with-lifecycle` adds only
`tests/test_lifecycle_destroy.py::test_destroy_only_generated_target` after all
three tiers pass. The body also requires `lifecycle` + `macos_host`, the
`lifecycle_scope` fixture, pytest `--run-lifecycle`, and the sequencer admission
environment. The sequencer removes inherited `PYTEST_ADDOPTS` and
`PRIME_CLAW_LIFECYCLE_SEQUENCER` from its interpreter check and prerequisite
tiers, and introduces sequencer admission only for the exact lifecycle child.
Missing any gate skips before fixture setup; marker/fixture mismatch is an
error. It is never automatically retried. Legacy
`--with-sandbox`, unknown, and multi-argument forms return exit 64 before any
command or result directory.

## Tier-1 unit-env bodies

Six environment-dependent behavior families are explicit tier-1 bodies:

- Linux POSIX watchdog process groups, signals, status, and reaping;
- the real Node `npm-onload.js` preload and header rewrite;
- tier-1 launcher, fixture, and image behavior against recording fakes;
- real Git worktree, Unix-socket, and state cleanup; and
- `scripts/run-prime-agent-probe.sh` config/session isolation and exit status; and
- the Slice-6 lifecycle control matrix against a recording fake only.

Their files use the non-default `tests/unit_env_*_body.py` pattern. Plain host
pytest cannot discover them. `tests/test_unit_env_bridges.py` is the only
collected entry: its six tests request `tier1_container`, so collection
applies the `container` marker and exact-selector guard before any body can run.
Each bridge invokes an explicit body path with container Python after the
fixture has disconnected all networks. Tier-1 containers use Docker `--init`
so the Linux target reaps orphaned watchdog/launcher descendants. Body temporary state, processes, Git
repositories, sockets, HOME, Node, and shell tools are container-local. The
read-only `/workspace` snapshot is the only test-subject source. The image has
no Docker CLI/socket or OpenShell control path, and the bridge passes only its
fixed container-local HOME. Static tier 0 retains contract/string checks but no
second execution of these named behaviors.

## Fail-closed lifecycle control boundary

`tests/lifecycle/support.py` owns identity generation, exact inspection,
ownership capture, normalized evidence, and bounded teardown. A run uses a full
32-hex ID, `pct-<12hex>` workspace, `pct-<12hex>-t` target,
`pct-<12hex>-s` sentinel, and a unique image identity. The target and sentinel
fit OpenShell v0.0.116's 19-character maximum; both the pure scope and live
adapter reject overlength sandbox names before an OpenShell command. Exact
`pc-test=true` plus `pc-run=<full-id>` labels bind ownership. Gateway and
workspace are explicit on every adapter call. The tracked minimal policy denies
network and declares no provider or credential input; generated config refuses
local overlays and automatic providers.

Preflight reads capabilities and each exact identity using
present/absent/unknown semantics. Default, forbidden, colliding, malformed,
incompatible, unreachable, ambiguous, unowned, or label/policy-mismatched state
cannot authorize mutation. Teardown visits target, sentinel, workspace, then
image. It deletes only a captured identity after an exact ownership reread and
one post-delete absence check. There are no retries, broad selectors, `--all`,
or prune operations. Unknown or refusal is terminal and the mode-0600 evidence
file remains.

The command/control matrix is `tests/lifecycle/control_body.py`. Its filename
is not default-collectable, its entry guard refuses host execution, and its only
bridge runs inside the offline tier-1 container. Tier-0 guards validate the
architecture and collection contract. This proves the boundary without a live
OpenShell, Docker, provider, service, policy, remote, or sandbox call.

## Guarded host lifecycle observer

Slice 7 adds one reviewed body and one process seam. The body contains no
process code. `tests/lifecycle/live.py` is the only host adapter. It uses bounded
commands, an overall deadline, explicit gateway/workspace flags, a pinned
`docker/test-lifecycle.Dockerfile`, and tracked
`policies/test-lifecycle.yaml` with no network policies, providers,
credentials, or endpoints.

The observer first takes a conservative names-only snapshot of the exact
configured production sandbox in the explicit tracked production workspace.
It hashes only the configured identity/workspace and present/absent state; it
does not request `sandbox get`, policy, annotations, provider state, endpoints,
operator-local config, or brain content. The after snapshot must match. On any
primary or cleanup failure, a mode-0600 `failure.json` retains the canonical
before/after snapshot hashes (or `null` only when the after snapshot itself
could not be obtained), equality result, and failure-class booleans without raw
production names.

It then preflights generated identities, builds/captures the fixture image by
immutable iid, and creates target and sentinel with `--no-auto-providers`,
`--no-tty`, exact labels, and the no-egress policy. Both provider lists must be
empty. A mode-0600 generated runtime config names only the target/image plus
explicit gateway/workspace. Product `destroy --yes` runs without `--image`
through a generated guard proxy that accepts exactly the target get and delete
argv and records only safe command classes. The target must be absent while the
sentinel remains exactly owned. Finally, the Slice-6 finalizer revalidates and
removes only captured target, sentinel, workspace, and immutable image IDs and
positively verifies absence. Unknown/refusal retains evidence and fails without
retry.

Sanitized evidence is under the sequencer run's `lifecycle-evidence/` directory
and is summarized in
`docs/evidence/2026-10-06-testing-strategy-slice7-lifecycle-destroy.md` plus the
terminal `prime-claw-5v7.6` receipt. The deferred P0 incident
`prime-claw-5v7.10` is outside this observer: the snapshot proves only this
run's noninterference and authorizes no incident inspection or recovery.

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

The launcher verifies `config/test-artifacts.lock.json`, selects only native
`linux/arm64` or `linux/amd64`, and stages a private temporary build context
containing the exact locked gbrain and Bun artifacts, Dockerfile/lock/build
metadata, the coordinator, both explicit property bodies, shared support, and
the two public synthetic fixture trees. Every baked asset has an exact SHA-256
in the integration-v3 receipt. No ignored operator state enters the context.
The public dependency build may use network; assertion execution cannot.

### Runtime isolation

The fixed nonroot `tester` container has `--network none`, no host mounts,
ports, privileged/host namespaces, Docker/OpenShell socket, host home,
credentials, providers, private data, external remote, or production service.
HOME, five PostgreSQL clusters (the retained Slice-3 stack plus four Slice-8
property stacks), results, temporary files, worktrees, and bare remotes are
container-local. The coordinator preserves the original sync/get/search and
Git round-trip proof before running the new properties.

### Dry-run logical non-mutation

For `dry-run-a` and `dry-run-b`, each fresh fully migrated database registers
and seeds its own source, commits a synthetic delta, snapshots logical state,
and runs exactly:

```text
gbrain sync --source fixture --dry-run --no-pull --no-embed --yes
```

The post-exit snapshot must equal the baseline byte-for-byte as canonical JSON.
Named dimensions are schema objects, migration version, sequence state, every
public table's ordered rows, exact fixture source/bookmark, sync-failure ledger
and lock, cycle/advisory locks, remaining database sessions, parsed and raw
effective config, worktree HEAD/status/tree, and bare refs. PGDATA and WAL bytes
are deliberately excluded. Host negative tests make each dimension red.
Sanitized stdout/stderr and exact exited/return-code semantics are retained.

### Whole-source path/slug accounting

For `source-coverage-a` and `source-coverage-b`, fresh disjoint databases run a
baseline sync, commit add/modify/rename/delete changes, and run exactly:

```text
gbrain sync --source fixture --no-pull --no-embed --no-extract --yes
```

The valid bookmark must reach the committed delta. Every synthetic path and
slug appears exactly once in the manifest and is represented by an exact live
row, delete tombstone, renamed tombstone/absence, or named exclusion. Duplicate,
missing, stale, live rename residue, or unexpected paths/slugs fail. Invalid
YAML frontmatter is then committed separately and run with the same command;
the pinned CLI reports `blocked_by_failures` with exit 0, while its source
bookmark and page rows remain unchanged and its fixture-owned failure ledger
names the excluded path. A/B normalized outcomes must match while all four raw
database and property identities remain distinct.

### Result, validation, and cleanup

After the coordinator finishes, the launcher stops the container before copying
`/home/tester/results/body.json`. The integration-v3 validator checks locked
artifacts, every asset hash, exact commands, four disjoint identities, named
snapshots, row/accounting parity, malformed-frontmatter behavior, A/B equality,
legacy Slice-3 proof, immutable Docker identities, and cleanup. Cleanup remains
exact-ID and label-gated; unknown ownership, command failure, timeout,
interruption, missing/malformed output, property mismatch, or cleanup failure is
nonzero.

Validate retained evidence with:

```bash
python3 -m scripts.testing.integration_provenance   .test-results/<run-id>/integration/manifest.json
```

One outer integration-v3 run contains the two mandatory disjoint repetitions of
each property. Lifecycle evidence remains the accepted consumed Slice-7 run and
is never rerun for Slice 8.

### Phase 3a consumer boundary

The following is a proposal for later owner review only. It was not applied,
handed off, activated, or used to mutate Phase 3a:

> When the project-wide tier-2 integration fixture is admitted under
> R-TEST-3/R-TEST-6/R-TEST-13, Phase 3a may cite fixture evidence for exact
> installed-binary provenance, fully migrated
> `gbrain sync --dry-run --no-pull --no-embed --yes` logical non-mutation, and
> synthetic whole-source path/slug accounting. This supports and never replaces
> authorized host/in-sandbox exact-model probes, operator clearance, the single
> bounded resumed build, production Git/L7 proof, or cutover. No production
> dry-run or Phase 3a handoff is authorized.

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
