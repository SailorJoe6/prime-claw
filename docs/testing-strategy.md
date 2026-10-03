# Testing strategy

prime-claw uses the lowest sufficient isolation tier. Pure repository checks
stay on the host. Any test that needs Prime Agent or the plugin runs inside a
disposable container. Later slices add the integration brain stack and the
explicit OpenShell lifecycle observer; they are not implemented by Slice 1.

## Current tiers

| Tier | Current command | Boundary |
|---|---|---|
| 0 | `python3 -m pytest tests/ -q` | Host-only static and recording-fake tests; no Docker. |
| 1 | `python3 -m pytest tests/ -q -m container` or `scripts/test-tier1.sh` | One disposable Docker container; read-only repository; run-owned writable share; no credentials or host home. |
| 2 | `python3 -m pytest tests/ -q -m sandbox` | Existing explicit runtime tests. The future integration-tier conversion is not complete. |

`scripts/test-all.sh` remains the fail-fast default sequencer. Lifecycle work is
not part of the default command and is not enabled by this slice.

## Tier-1 pinned run

A direct driver or pytest fixture run allocates a fresh
`.test-results/<run-id>/tier1/` tree. It never adopts a stale tree.

1. Enumerate tracked plus nonignored untracked repository files, hash each
   path/type/mode/content (or safe relative symlink target), and stage that exact
   sanitized inventory into a run-owned snapshot. Ignored `.env`,
   `.test-results`, credentials, and operator-local files are neither mounted
   nor hashed.
2. Record repository HEAD, dirty/status hash, exact snapshot content hash, and
   entry count. Mount only the snapshot read-only at `/workspace`.
3. Copy `docker/test.Dockerfile` into an otherwise empty run-owned build
   context. The Dockerfile is the current declared input because it contains no
   `COPY` or `ADD` instruction.
4. Build with an informational input-hash tag and a fresh `--iidfile`.
5. Inspect and launch the immutable iidfile image ID. The tag is never used as
   execution identity.
6. Capture the container with a fresh `--cidfile` and install the requested
   pinned Prime Agent version while its network is attached.
7. Disconnect every network reported for that exact container and re-inspect.
   Any remaining network or unknown inspection fails before apply/check/probes
   or test bodies.
8. Offline, record installed artifact version/hash, apply and check the plugin
   against `PRIME_AGENT_PLUGIN_ROOT=/root/.prime/agent`, then run the optional
   probe or selected pytest bodies.
9. Remove only the captured container ID. A positive “absent” inspection is
   required. Present or unknown fails and preserves the run evidence.

Every host-side Docker wait uses `scripts/testing/bounded.py` with a validated
positive deadline and process-group TERM→KILL escalation. Build, install,
inspect/disconnect, apply/check, probe, and teardown use explicit budgets. An
exact cidfile identity recovered after a failed or timed-out launch is still
removed; malformed identities never reach a destructive command.

`PRIME_AGENT_SOURCE` is deliberately unavailable in Slice 1. After selector
parsing it fails with Slice-2 guidance before any checkout stat, read, build,
cleanup, pack, Docker call, or path echo. `prime-claw-5v7.1` owns the isolated
source builder; rollback must never restore the old host-mutating path.

## Provenance evidence

`manifest.json` uses schema version 1 and canonical sorted JSON. It records:

- run ID, mode, status, UTC bounds, and command-contract version;
- repository HEAD, dirty boolean, status/content SHA-256, and exact snapshot entry count without exposing paths or content;
- requested pinned Prime Agent version on every pinned attempt, plus installed
  version and executable SHA-256 once those identities are available;
- immutable image ID, optional local repo digests, platform, Dockerfile hash,
  declared-input hash, informational tag, and build bounds;
- verified network-removal time and teardown state; and
- SHA-256 for every other regular evidence file below the tier directory.

The manifest excludes itself and the optional scratch `share/` from its evidence inventory. Validation rejects an
unsupported schema, malformed hashes, source-mode claims, unsafe paths, common
credential forms, host-home values, symlink/special evidence, missing evidence,
extra stale evidence, changed content, contradictory success/teardown claims,
and malformed UTC timestamps. Setup logs contain only allow-listed phase names,
not raw tool output. Publication validates first, writes a
mode-0600 temporary file in the same directory, fsyncs, and atomically renames.
A pre-existing manifest is never overwritten.

A locally built image can have no `RepoDigests`; its exact `sha256:...` image ID
is authoritative. The build-input tag is informational because the Ubuntu tag
and package repositories are external inputs.

## Safety and reproduction

- Do not mount the Docker socket, host home, credential stores, live databases,
  arbitrary checkouts, or operator config into the container.
- Do not use broad Docker name matching or prune commands.
- Set `TIER1_ENV_FILE` to an ignored file containing exactly one selector.
- Set `TIER1_KEEP_SHARE=1` only when debugging; durable manifest and setup
  evidence remain even when the scratch share is removed normally.
- Reproduce Slice-1 unit coverage with:

  ```bash
  python3 -m pytest     tests/test_testing_provenance.py     tests/test_tier1_driver.py     tests/test_tier1_fixture.py     tests/test_tier1_image.py -q
  ```
