# Evidence — Slice 3: tier markers, session container fixture, tier-1 migration, dumb sequencer

Date: 2026-09-30
Bead: prime-claw-blw.3 (final slice of epic prime-claw-blw)
Branch: episode/plugin-test-container

## What was delivered

- **`pytest.ini`** — registers the `container` (tier 1) and `sandbox`
  (tier 2) markers; unmarked tests are tier 0.
- **`tests/conftest.py`** — the tier policy lives here:
  - `pytest_collection_modifyitems` auto-marks any test requesting the
    `tier1_container`/`ctmp`/`croot` fixtures as `container`, and skips
    tier-1/tier-2 tests unless pytest was invoked with an explicit `-m`
    mark expression. Plain `pytest tests/ -q` is therefore always the
    tier-0 default with **no Docker dependency** (the fixture is never
    instantiated for skipped tests).
  - `tier1_container` (session-scoped): ONE container per pytest run that
    includes container tests. Mirrors the driver contract
    (`scripts/test-tier1.sh` is the source of truth): same `.env`
    selection semantics (exactly one of `PRIME_AGENT_PINNED` /
    `PRIME_AGENT_SOURCE`, `TIER1_ENV_FILE` override, fail fast on
    neither/both), same fail-fast ladder (docker readiness → source
    staging → image build → container run), same install commands
    (vendor installer for pinned; fresh fork `release:pack` for source),
    then plugin apply + check against the container's own
    `~/.prime/agent/`, once per session. Destroyed at session end
    (`docker rm -f`), plus a per-test scratch cleanup.
  - Exec helper API: `run()` (in-container `timeout --kill-after` hard
    deadline on every command — the slice-1/B3 lesson), `popen()`
    (interactive RPC drivers), `start_daemon()` (in-container fake
    daemon), `read_repo()` (reads from `/workspace`, never the host),
    `read_text`/`write_text`/`exists`/`mkdir_p`/`symlink` (share-aware).
  - `ctmp` (function-scoped): per-test scratch on the session share —
    a directory bind-mounted at the SAME absolute path on host and
    container, so paths embedded in probe sources and daemon protocol
    payloads resolve identically in both.
  - `croot` (function-scoped): per-test scratch on CONTAINER-LOCAL
    storage (see "Findings" below for why this exists).
  - `TIER1_KEEP_SHARE=1` preserves the session share for post-mortem
    debugging (used during this slice's failure investigation).
- **`tests/container/`** — committed container-side helpers (compile-
  checked in tier 0, executed in place via `/workspace`):
  - `fake_daemon.py` — union of the two former host-side fake daemons
    (publication + discovery flavors; `--route` selects the fake route),
    protocol 7 / schema 28, logs every envelope and response as JSONL on
    the share for host-side assertions.
  - `sigterm_orphan_probe.py`, `concurrent_apply_probe.py` —
    self-verifying runners for the two append-manager scenarios whose
    pipe/pass_fds/flock choreography cannot cross a `docker exec`
    boundary; they operate on container-local `/tmp` and print a JSON
    verdict.
- **Migration** — the tier-1 inventory now runs node/prime-agent
  subprocesses INSIDE the container:
  - `test_handoff_chain_extension.py`, `test_reviewed_plan_extension.py`,
    `test_project_conversation_extension.py`,
    `test_goal_blocker_control_extension.py`,
    `test_conversation_oversight_native.py`,
    `test_reviewed_plan_native_discovery.py`,
    `test_prime_agent_plugin_install.py` (converted from unittest to
    pytest style; `subTest` loops became `parametrize`).
  - Tier assignment is per-test: static repo checks in those files stay
    tier 0 and run in the default gate.
  - No tier-1 test code resolves host binaries; a tier-0 static guard
    (`test_container_helpers_static.py`) fails if
    `shutil.which("prime-agent")` / `shutil.which("node")` ever reappears
    in any test file.
- **Node-suite bridges** — every committed `tests/*.test.mjs` suite now
  has a pytest bridge running it in-container. The planning inventory
  flagged only `episode_close_extension.test.mjs` as unbridged; the
  re-audit found `project_conversation_extension.test.mjs` was also
  unbridged. **Decision: both bridges added** (trivial container execs;
  the alternative — documenting them as permanently unbridged — would
  leave real node coverage invisible to the suite). A tier-0 static test
  (`test_every_node_suite_has_a_pytest_bridge`) now fails if any future
  `.test.mjs` suite lands without a bridge.
- **`scripts/test-all.sh`** — dumb sequencer: tier 0 → tier 1 → (tier 2
  only on explicit `--with-sandbox`), fail-fast, prints a tier summary,
  logs to the gitignored `.test-results/` results directory. bash-3.2
  safe. Tier-1 preflight gives a clear message when Docker or `.env` is
  missing instead of per-test fixture errors.
- **`tests/test_runtime_*.py`** — marked `sandbox` (tier 2); they stay
  host-orchestrated and out of default runs, as before.
- **`config/requirements-inventory.json`** — new R-T1-1..R-T1-5 entries
  covering slices 1-3 (image+driver, install selection, markers+policy,
  fixture+migration, sequencer) per the apply/check/validate/test
  discipline; `tests/test_inventory_integrity.py` stays green.
- **DEVELOPERS.md** — Testing section rewritten for the final tier state
  (markers, `.env` setup, per-tier commands, sequencer).

## Findings from the migration (durable lessons)

1. **A host-bound Unix socket is unreachable from the container through
   the macOS gRPC-FUSE/virtiofs share** (connect(2) → EOPNOTSUPP, spiked
   directly). The fake daemons therefore run in-container
   (`tests/container/fake_daemon.py`), binding container-local sockets and
   logging to the share; the host tests reconstruct envelopes/responses
   from the logs via the `ContainerDaemon` shim.
2. **Node `fs.cpSync` fails with EACCES on the share when the copy SOURCE
   is a guest-created file** (its create-write-only-then-chmod pattern;
   the chmod is refused for files whose gRPC-FUSE ownership xattr was
   written by a previous guest-side copy). The plugin's
   `promoteBundle` does exactly such a two-stage copy. Matrix proven
   in-container: host-created source → OK (any parent); guest-created
   source → EACCES (any parent). So git-heavy episode flows
   (worktrees + promoteBundle) run on container-local `/tmp` via the
   `croot` fixture; only plain append/read artifacts stay on the share.
   Plain `chmod`, `cp`, `install`, `rm -rf`, git worktree add/commit all
   work fine on the share — the failure is specific to Node cpSync's
   chmod pattern.
3. **The migration surfaced a stale daemon-trace assertion** (real
   test/plugin drift): `assert_creation_trace` expected the creation-path
   handoff prompt to have no `streamingBehavior` and `queueIfBusy: false`,
   but `376bc2b` ("fix(episodes): queue bootstrap behind preparation",
   the automatic-preparation admission-race fix) deliberately changed the
   creation path to queue the handoff with `streamingBehavior:
   "followUp"`, `queueIfBusy: true` — updating the node suite
   (`spec_episode_extension.test.mjs`) but not this pytest assertion,
   which was invisible because the file was excluded from the host gate.
   The assertion now matches the current reviewed contract; owner
   continuations still use the fail-closed ordinary prompt (default
   `queueHandoffIfBusy=false`, covered by the node suite).

## Acceptance evidence

- **Tier-0 default, no Docker dependency**: `python3 -m pytest tests/ -q`
  → **222 passed, 141 skipped in ~21s**. (222 = the previous 194-test
  bounded gate + 22 static tests from the migrated files + 6 new tier-0
  statics; 141 skipped = 34 container + 107 sandbox-marked runtime
  tests.) Skips happen at collection; the container fixture never starts,
  so no Docker daemon is touched.
- **Full tier-1 suite in ONE container**:
  `python3 -m pytest tests/ -q -m container` (pinned `PRIME_AGENT_PINNED=0.9.3`)
  → **34 passed in 122s**. One session container: cached image build,
  vendor-installer 0.9.3, apply+check, all tests, destroyed at session end
  (`docker ps -aq --filter name=prime-claw-tier1-session` empty after).
- **Source mode** (`PRIME_AGENT_SOURCE=/Users/jlanders/code/prime-agent`,
  fresh `npm run build` + `release:pack` per the B1 contract): see the
  source-mode section below.
- **Sequencer end-to-end**: `scripts/test-all.sh` →
  `tier0: PASS (21s)`, `tier1: PASS (128s)`, `test-all: OK`; logs in
  `.test-results/<timestamp>/`.
- **Host plugin untouched**: sha256 over the 8 managed plugin files +
  `APPEND_SYSTEM.md` under the host's `~/.prime/agent/` identical before
  and after all slice-3 container runs
  (`/tmp/tier1-host-before-slice3.sha256` ==
  `/tmp/tier1-host-after-slice3.sha256`).
- **Inventory integrity**: `tests/test_inventory_integrity.py` green with
  the R-T1-* entries (all `proven_by` paths exist).

## Source mode

`PRIME_AGENT_SOURCE=/Users/jlanders/code/prime-agent` (fork v0.9.8): the
session fixture ran the B1 fresh-build contract (removed the four
pack-consumed dist dirs, `npm run build`, `release:pack`, staged over
`file:///stage`) and the full suite passed in ONE container:
**34 passed in 139s**. During this run the concurrently-executed tier-0
gate showed a single transient failure in
`tests/test_embedding_candidate_build.py::test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero`
— the documented pre-existing timing flake, under fork-build CPU load;
the gate re-run immediately after was green (222 passed). Pinned and
source modes both carry the full migrated suite.

Note: the two `native_discovery` lifecycle tests exercise prime-agent
runtime internals (session `forkFrom`, from the fork-support era). They
pass against both the pinned 0.9.3 vendor release and the fork — the
failures seen during migration were the gRPC-FUSE cpSync issue and the
stale trace assertion, NOT version coupling.

## Container/artifact hygiene

- `docker ps -aq --filter name=prime-claw-tier1-session` empty after every
  session run (fixture teardown `docker rm -f`).
- `.test-results/` (session share, per-run logs) is gitignored; debug
  scratch from the failure investigation was removed.
- The scratch-space patched plugin copy used to extract the EACCES stack
  lived only under `.test-results/` (never the repo, never the host
  plugin) and was deleted with it.
