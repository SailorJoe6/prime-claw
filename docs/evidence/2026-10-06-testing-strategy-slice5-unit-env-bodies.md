# Testing strategy Slice 5 — unit-env body migration

## Decision

The local host, checkout, Docker daemon, launcher, and same-UID operator are
trusted. Slice 5 removes accidental host execution for the remaining named
environment-dependent unit behavior. It does not add same-UID attack defenses
or security attestation.

## Placement

`tests/test_unit_env_bridges.py` is the only host-collected entry for eight
non-default body files and 56 environment-sensitive test functions:

| Family | Body | Cases |
|---|---|---:|
| POSIX watchdog | `tests/unit_env_watchdog_body.py` | 8 |
| npm-onload | `tests/unit_env_npm_onload_body.py` | 1 |
| launcher meta | `tests/unit_env_tier1_driver_body.py`, `tests/unit_env_tier1_launch_error_body.py`, `tests/unit_env_tier1_fixture_body.py`, `tests/unit_env_tier1_image_body.py` | 44 |
| Git/worktree/socket cleanup | `tests/unit_env_cleanup_body.py` | 1 |
| probe wrapper | `tests/unit_env_probe_wrapper_body.py` | 2 |

The five outer bridges request `tier1_container`. Exact `-m container` is
therefore required before any body runs. Plain pytest does not discover the
body filenames. Each body uses only `/workspace` read-only source plus
container-local temporary paths, processes, HOME, Git repositories, and Unix
sockets. The offline runtime has no Docker socket/CLI, OpenShell channel, host
home, credentials, or operator state.

## Coverage reconciliation

The default-collected `test_tier1_driver.py`, `test_tier1_fixture.py`, and
`test_tier1_image.py` modules now retain only pure/static or fully mocked cases;
the old host-collected `test_prime_agent_probe_isolation.py` path is removed. The
real watchdog, Node preload, cleanup, and wrapper executions each have one
authoritative body. Static checks pin the eight body names, exact case count,
five guarded bridges, fixed container-local HOME, and absence of the old host
modules.

## Scope reconciliation

This slice moves the environment-dependent bodies named by the approved audit.
It does not reclassify every test that happens to create a temporary Git repo or
AF_UNIX object. `test_testing_provenance.py` exercises the host-side snapshot
and owned-path controller against test-owned temporary objects; source-builder
tests exercise the accepted host-controller/read-only-checkout boundary from
Slice 2. Those are the real host layer they specify, not the reviewed-plan
post-creation cleanup body moved here. Existing tier-1 Prime Agent discovery
tests already use `cgit`, `croot`/`ctmp`, and the container fake daemon. This
bounded distinction avoids turning Slice 5 into a new source-builder or
provenance redesign.

## Validation

Focused source tier-1 migration gate:

- command: `TIER1_ENV_FILE=/tmp/prime-claw-slice5.env TIER1_RESULTS_ROOT=/Users/jlanders/code/prime-claw-project-wide-testing-strategy-episode/.test-results/slice5-source-20261006T054000Z python3 -m pytest -q -m container tests/test_unit_env_bridges.py`;
- result: **5 passed in 190.49s**; all 55 inner environment-sensitive test
  functions and their parameter/subtest cases passed;
- log: `.test-results/slice5-source-20261006T054000Z/tier1-bodies.log` (SHA-256 `7f34a60ba0d8140d4e1de4b7123682b19f82940c8b4855400ca7385c1530c7e8`);
- manifest: `.test-results/slice5-source-20261006T054000Z/20261006T053227Z-13592-9427c5e5/tier1/manifest.json` (SHA-256
  `1f88a5148b95ca54c2661ef3187942d0a0de2712cdbc9416fcd4289ec4865cd1`), valid schema 2,
  verified network absent, clean/absent teardown, and exact captured CID absent.

Plain-host Docker-sentinel gate:

- command: `PATH=/tmp/prime-claw-slice5-docker-sentinel:$PATH python3 -m pytest tests/ -q`;
- result: **451 passed, 47 skipped, 76 subtests passed** in 34.52s;
- poison Docker sentinel was never invoked;
- log: `.test-results/slice5-source-20261006T055000Z/plain-pytest-retry.log` (SHA-256 `3a87c00cb995d416903d0fb765e7fe14fb81d50ce97f0da93d911893ef3b19dc`).


Expanded launcher-meta gate after moving the launch-error regression:

- result: **1 bridge passed in 137.56s**;
- log: `.test-results/slice5-source-20261006T060000Z/launcher-meta.log` (SHA-256 `724d5587f7935e54d2ae499d101d27eba77c653fa647450793254e81bc4e6157`);
- manifest: `.test-results/slice5-source-20261006T060000Z/20261006T053823Z-27731-9faef96f/tier1/manifest.json` (SHA-256
  `6692b088f7390633cd15635f5b066f1882b49b6f1dd3515e578e66b901188482`), valid schema 2,
  network absent, teardown clean/absent.

Final exact-commit sequential tier and bounded-review evidence is recorded in
the Slice-5 Bead receipt after those gates settle.
