# Evidence — Slice 1: tier-1 slim test image + dumb driver

Date: 2026-09-29
Bead: prime-claw-blw.1
Branch: episode/plugin-test-container

## What was delivered

- `docker/test.Dockerfile` — slim tier-1 image: Ubuntu 24.04 + Node 22.x
  (NodeSource) + Python 3 + pytest. No Postgres/pgvector/gbrain/OpenShell/bun.
  Build-time assertions enforce the prime-agent prerequisite (Node >= 22.x
  major) and toolchain presence.
- `scripts/test-tier1.sh` — dumb driver: build image (cached), run ONE
  ephemeral container (`docker run --rm`) for a toolchain smoke report,
  destroy. Flags: `--rebuild` (no cache), `--dry-run`, `--help`.
  bash-3.2-compatible (macOS default shell): guarded empty-array expansion.
- `tests/test_tier1_image.py` — 9 tier-0 regression tests (Dockerfile exists,
  single-stage ubuntu:24.04 base, required toolchain, stays slim, driver
  executable, --help/--dry-run surfaces, rejects unknown args, ephemeral run).
- `DEVELOPERS.md` — "Test tiers" section documents tier 0/1/2 and the driver.

## Build + smoke evidence

Command: `./scripts/test-tier1.sh` (host: macOS, Docker 29.6.2)

Result: build succeeded; ephemeral container smoke output:

```
v22.23.3        <- node (>= 22.8 prerequisite: PASS)
Python 3.12.3
pytest 7.4.4
tier-1 driver: OK — image built, smoke passed, container destroyed
```

Image size: `prime-claw-test-tier1:latest 606MB` (no runtime image built
locally to compare against; the runtime image additionally bakes Postgres 16
+ pgvector + gbrain, which this image omits by construction — see
`tests/test_tier1_image.py::test_dockerfile_stays_slim`).

## Test runs

- `python3 -m pytest tests/test_tier1_image.py -q` → 9 passed
- `python3 -m pytest tests/test_tier1_image.py tests/test_inventory_integrity.py tests/test_prime_agent_probe_isolation.py -q` → 13 passed
- Full suite: `python3 -m pytest tests/ -q` → **6 failed, 307 passed in
  31m31s**. All 6 failures are host-coupled live-RPC/installed-plugin tests
  (the class Slice 3 re-homes into tier 1); see analysis below. Slice-1's own
  tier-0 tests are green (13/13 incl. inventory integrity).

## Full-suite failure analysis (host-coupling evidence, not Slice-1 regressions)

Slice 1's diff is additive-only (`git status`: DEVELOPERS.md modified;
docker/test.Dockerfile, scripts/test-tier1.sh, tests/test_tier1_image.py,
docs/evidence/ new). No plugin source or existing test was touched, so the 6
failures cannot be caused by this slice. Failed tests:

- test_conversation_oversight_native.py::test_native_run_paths_and_real_child_precedence
- test_conversation_oversight_native.py::test_native_auto_compaction_restores_first_real_active_call
- test_reviewed_plan_extension.py::test_prime_agent_rpc_loads_native_commands_and_structured_tool
- test_reviewed_plan_extension.py::test_installed_prime_agent_forks_valid_context_and_publishes_worktree_session
- test_reviewed_plan_native_discovery.py::test_installed_discovery_real_implement_spec_activation_resume_and_absence
- test_reviewed_plan_native_discovery.py::test_installed_inactive_generation_allows_later_cycle_and_is_inert

### Host plugin generation mismatch (smoking gun)

Read-only `./scripts/check-prime-agent-plugin.sh` on the host reports:

- `missing installed plugin file: ~/.prime/agent/extensions/goal-blocker-control.ts`
- `stale installed plugin file: ~/.prime/agent/extension-support/spec-episode.ts`

This branch's `src/prime-agent-plugin/` carries the newer plugin generation
(`goal-blocker-control.ts`, main commits 2651573 / b56b080 from the
goal/heartbeat work), while the host install still has the older
`goal-heartbeat-work-control.ts` generation. The installed-* / native-*
failures are consistent with this mixed host generation — the exact incident
class (SPECIFICATION.md "Why this is a problem") that tier 1 eliminates by
construction.

### RPC probe hang (owner-intervened, ~30 min)

`test_installed_rpc_characterizes_confirmed_steer_lifecycle_order` spawned a
`prime-agent --mode rpc --offline --provider probe` child that went idle at
0% CPU and orphaned (PPID 1); pytest deadlocked in `read()` on its stdout
pipe. The owner killed only the orphaned probe; the suite then completed.

Root-cause mechanism (from the test source, tests/test_reviewed_plan_extension.py):

1. The test drives the probe with `selector.select()` under a 20s deadline,
   then calls `process.stdout.readline()`. `select()` reports readability on
   PARTIAL data, but `readline()` blocks until newline/EOF — if the probe
   stalls mid-line, the deadline never fires because it only gates `select()`.
2. Cleanup does `process.wait(timeout=3)` (guarded) and then an UNBOUNDED
   `process.stderr.read()`. When the direct child exits but an orphaned
   grandchild inherits and holds the pipe write ends, no EOF ever arrives and
   the read blocks forever. The `wait(timeout=3)` guard covers only the
   direct child, never the pipes.

Fix direction (Slice 3 scope): when these probes move into the tier-1
container, give every pipe read a deadline (e.g. read via selector into a
byte buffer with manual line framing) and kill the whole process tree on
timeout. Recorded here; no test-code change in Slice 1.

### Standing instruction (owner, operator-approved)

Future host-side gates for this episode run the tier-0 subset only, with the
live RPC probe tests deselected; the probes get re-homed into the container
in Slice 3. This full-suite run pre-dates the instruction and was allowed to
finish.

## Shared-base extraction: DEFERRED (escape hatch)

The runtime image (`docker/runtime.Dockerfile`) derives FROM the OpenShell
sandbox base (`ghcr.io/nvidia/openshell-community/sandboxes/base`,
Ubuntu 24.04) and installs no Node. The tier-1 image is plain Docker from
`ubuntu:24.04`. There is no non-trivial shared layer to extract without
changing the runtime image's FROM line and risking its behavior. Per the
spec's explicit escape hatch, extraction is deferred to follow-up bead
`prime-claw-blw.4`; lineage is the common Ubuntu 24.04 baseline only.
