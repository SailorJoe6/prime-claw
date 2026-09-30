# Evidence — Slice 1: tier-1 slim test image + dumb driver

Date: 2026-09-29 (initial), refreshed 2026-09-30 after two EXPERT review rounds
Bead: prime-claw-blw.1
Branch: episode/plugin-test-container
Reviews (reports in the main repo): the gate on `47d2830`
(`.ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-47d2830-expert-block.md`)
returned BLOCK with three findings (B1/B2/B3, repaired in `d8dbc5d`); the
gate on `d8dbc5d`
(`.ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-d8dbc5d-expert-block.md`)
verified B1/B2 resolved and returned BLOCK with one remaining finding (B3-R,
repaired here). Both reviewed commits are invalidated; this note describes
the repaired state.

## What was delivered

- `docker/test.Dockerfile` — slim tier-1 image: Ubuntu 24.04 + Node 22.x
  (NodeSource) + Python 3 + pytest. No Postgres/pgvector/gbrain/OpenShell/bun.
  Build-time assertions enforce the prime-agent prerequisite (Node >= 22.x
  major) and toolchain presence.
- `scripts/test-tier1.sh` — dumb driver: build image (cached), run ONE
  ephemeral container (`docker run --rm`) for a toolchain smoke report,
  destroy. Flags: `--rebuild` (no cache), `--dry-run`, `--help`.
  bash-3.2-compatible (macOS default shell): guarded empty-array expansion.
  `--help` and `--dry-run` are informational-only: they never invoke the
  docker CLI or contact the daemon. Docker readiness checks
  (`command -v docker`, `docker info`) live on the real-execution path only,
  before the build.
- `tests/test_tier1_image.py` — 17 tier-0 regression tests: Dockerfile
  statics (exists, single-stage ubuntu:24.04, required toolchain, stays
  slim), driver statics (executable, --help/--dry-run surface, rejects
  unknown args, ephemeral run), and negative-environment driver behavior
  (recording/failing docker substitute on PATH; docker-absent PATH; failing
  info/build/run stages; OK printed only when every step succeeds).
- `DEVELOPERS.md` — "Test tiers" section documents tier 0/1/2, the bounded
  tier-0-only gate command, and the current rollout reality (see B2 below).

## Build + smoke evidence (2026-09-29)

Command: `./scripts/test-tier1.sh` (host: macOS, Docker 29.6.2)

Result: build succeeded; ephemeral container smoke output:

```
v22.23.3        <- node (>= 22.8 prerequisite: PASS)
Python 3.12.3
pytest 7.4.4
tier-1 driver: OK — image built, smoke passed, container destroyed
```

The smoke run verifies only the container toolchain (Node/Python/pytest
versions). It does NOT install or validate the plugin.

Image sizes (both verified locally via `docker images` on 2026-09-30):

- `prime-claw-test-tier1:latest` — **606MB**
- `prime-claw-brain:0.1.0` (the OpenShell runtime image) — **5.17GB**

The tier-1 image omits Postgres 16 + pgvector + gbrain + OpenShell machinery
by construction (see `tests/test_tier1_image.py::test_dockerfile_stays_slim`),
which is consistent with the ~8.5x size difference. (An earlier revision of
this note claimed no runtime image existed locally to compare against; that
was wrong — `prime-claw-brain:0.1.0` is present at 5.17GB.)

## Test runs

Initial runs (2026-09-29):

- `python3 -m pytest tests/test_tier1_image.py -q` → 9 passed
- `python3 -m pytest tests/test_tier1_image.py tests/test_inventory_integrity.py tests/test_prime_agent_probe_isolation.py -q` → 13 passed
- Full suite: `python3 -m pytest tests/ -q` → **6 failed, 307 passed in
  31m31s** (analysis below).

Post-rework runs (2026-09-30, after the B1/B2/B3 repairs):

- `python3 -m pytest tests/test_tier1_image.py -q` → 17 passed
- Same file with Docker absent (`env PATH=/usr/bin:/bin`, confirmed
  `command -v docker` finds nothing) → 17 passed
- Same file with an unreachable daemon (a failing `docker` substitute first
  on PATH) → 17 passed
- Bounded tier-0 gate (command in DEVELOPERS.md; live-RPC probes and
  `test_runtime_*` deselected via `--ignore`) → **161 passed in 9.84s**;
  re-run after all rework edits → **161 passed in 10.09s**.
  Observation: one intermediate gate run showed a single transient failure in
  `test_embedding_candidate_build.py::test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero`
  (a timing-sensitive watchdog test); it passed standalone (2.22s) and in the
  final re-run. The rework diff does not touch embedding code, so this is
  recorded as a pre-existing host timing flake, not a rework regression.

## Full-suite failure analysis (2026-09-29 run)

### Observations (directly recorded facts)

- `python3 -m pytest tests/ -q` on the host produced 6 failed / 307 passed
  in 31m31s. The 6 failures:

  - test_conversation_oversight_native.py::test_native_run_paths_and_real_child_precedence
  - test_conversation_oversight_native.py::test_native_auto_compaction_restores_first_real_active_call
  - test_reviewed_plan_extension.py::test_prime_agent_rpc_loads_native_commands_and_structured_tool
  - test_reviewed_plan_extension.py::test_installed_prime_agent_forks_valid_context_and_publishes_worktree_session
  - test_reviewed_plan_native_discovery.py::test_installed_discovery_real_implement_spec_activation_resume_and_absence
  - test_reviewed_plan_native_discovery.py::test_installed_inactive_generation_allows_later_cycle_and_is_inert

- Slice 1's diff was additive-only (`git status`: DEVELOPERS.md modified;
  docker/test.Dockerfile, scripts/test-tier1.sh, tests/test_tier1_image.py,
  docs/evidence/ new). No plugin source or existing test was touched.
- Read-only `./scripts/check-prime-agent-plugin.sh` on the host reported:
  `missing installed plugin file: ~/.prime/agent/extensions/goal-blocker-control.ts`
  and `stale installed plugin file: ~/.prime/agent/extension-support/spec-episode.ts`.
  This branch's `src/prime-agent-plugin/` carries the newer plugin generation
  (`goal-blocker-control.ts`, main commits 2651573 / b56b080), while the host
  install has the older `goal-heartbeat-work-control.ts` generation.
- During the same run, `test_installed_rpc_characterizes_confirmed_steer_lifecycle_order`
  spawned a `prime-agent --mode rpc --offline --provider probe` child that
  went idle at 0% CPU and orphaned (PPID 1); pytest deadlocked in `read()`
  on its stdout pipe. The owner killed only the orphaned probe; the suite
  then completed, and that steer-lifecycle test is NOT in the failed set.

### Demonstrated (verified in code or by direct re-observation)

- Neither slice-1 commit (`47d2830`, `d8dbc5d`) changes any existing plugin
  or probe code: both diffs are additive-only (the `git status` observation
  above, plus rework files limited to the new driver, new tests, and docs).
  This bounds what the slice touched; additive scope alone does NOT establish
  non-causation. The six per-test failure causes remain **UNRESOLVED** — no
  retained failure traces were re-analyzed to establish them.
- At least one failed test does NOT load the host-installed plugin at all:
  `test_prime_agent_rpc_loads_native_commands_and_structured_tool` invokes
  `prime-agent --no-extensions -e <repo extension source> -e <temp probe>`
  (tests/test_reviewed_plan_extension.py) — it loads explicit repo source and
  a temp probe, so the host `~/.prime/agent` generation is irrelevant to it.
  The EXPERT report notes several failed tests share this pattern.
- The steer-lifecycle test source contains pipe reads without deadlines:
  `selector.select()` gates only readiness, then `readline()` blocks until
  newline/EOF, and cleanup ends with an unbounded `process.stderr.read()`.
  The `process.wait(timeout=3)` guard covers only the direct child, never the
  pipes. An orphaned descendant that inherits the pipe write ends prevents
  EOF indefinitely (tests/test_reviewed_plan_extension.py, lines ~340-395).

### Hypotheses (plausible, NOT demonstrated)

- The host plugin generation mismatch MAY explain some of the `installed-*` /
  `native-*` failures (the ones that do exercise the host install). This is
  observed host state, but it is NOT demonstrated as the cause of the six
  failures — in particular it cannot explain failures in tests that load
  explicit repo source or temp installs.
- The unbounded pipe reads described above fully explain the observed
  read()-deadlock symptoms (select-then-readline mid-line stall, or orphaned
  grandchild holding the pipe open). No stack sample was taken during the
  incident, so the identification of WHICH read blocked is inference from the
  code, not direct observation.
- Hypothesis: the failures and the hang belong to the host-coupling incident
  class (SPECIFICATION.md "Why this is a problem") that tier 1's
  filesystem/process isolation is designed to prevent — isolation stops the
  prime-agent under test from contaminating the host's real environment.
  This is a design motivation, not a demonstrated per-test attribution.
  Isolation also does NOT itself repair the unbounded pipe reads documented
  above; those are test-code defects that persist in any environment until
  every pipe read is given a deadline (Slice 3 scope, below).

Fix direction (Slice 3 scope): when these probes move into the tier-1
container, give every pipe read a deadline (e.g. read via selector into a
byte buffer with manual line framing) and kill the whole process tree on
timeout. Recorded here; no test-code change in Slice 1.

### Standing instruction (owner, operator-approved)

Future host-side gates for this episode run the tier-0 subset only, with the
live RPC probe tests deselected; the probes get re-homed into the container
in Slice 3. This full-suite run pre-dates the instruction and was allowed to
finish.

## EXPERT review rework (2026-09-30)

The EXPERT gate on `47d2830` returned BLOCK with three findings; repairs:

- **B1 — driver informational paths touched Docker.** `--help` already exited
  before any Docker contact, but `--dry-run` fell through to
  `command -v docker` and `docker info` before printing the plan. Repair:
  Docker readiness checks moved below the `--dry-run` exit, onto the
  real-execution path only. Regression coverage: 8 new negative-environment
  tests using a recording/failing docker substitute and docker-absent PATHs,
  proving `--help`/`--dry-run` never invoke docker, and that real runs fail
  fast (non-zero exit, no OK) on missing CLI, unreachable daemon, failed
  build, and failed smoke — with OK printed only when every step succeeds
  (positive control). Whole-file runs: 17 passed with docker present,
  17 passed with docker absent, 17 passed with an unreachable daemon.
- **B2 — DEVELOPERS.md described a tier-0 story that was not yet true.** The
  text claimed tier 0 was plain `pytest tests/ -q`; in reality that command
  still runs host-coupled live-RPC probes until slice 3. Repair: the Testing
  section now states the current reality explicitly and gives a bounded
  tier-0-only gate command (file-level `--ignore` list, verified green:
  161 passed in 9.84s). No pytest markers/conftest were added to make the
  text true; the smoke run is described as toolchain-only.
- **B3 — evidence epistemics and a factual error.** This note previously
  asserted the six-failure attribution too strongly and claimed no runtime
  image existed locally. Repair: the failure analysis now separates
  Observations / Demonstrated / Hypotheses; the host-generation mismatch is
  recorded as observed-but-not-demonstrated cause; and the image-size
  comparison is corrected to 606MB vs `prime-claw-brain:0.1.0` 5.17GB.

Round 2 (2026-09-30, EXPERT gate on `d8dbc5d`): B1 and B2 verified resolved;
one finding remained.

- **B3-R — residual epistemic overreach in this note.** The Demonstrated
  section still concluded the slice "cannot be the cause" of the six
  failures from additive scope alone, and the Hypotheses section stated
  tier 1 "eliminates by construction" the incident class too strongly.
  Repair: the Demonstrated claim is now bounded to the verified fact
  (neither slice-1 commit changes existing plugin/probe code) with the six
  per-test causes left explicitly UNRESOLVED; the "eliminates by
  construction" claim is demoted to an explicit hypothesis that also states
  isolation does not itself repair the unbounded reads. All observations
  from the original run are preserved unchanged.

## Rebase onto main (2026-09-30, start of Slice 2)

Main advanced past the branch point (`d0a9883`) by three review-report
commits only (EXPERT BLOCK on `47d2830`, EXPERT BLOCK on `d8dbc5d`, EXPERT
PASS on `2666843` — all docs under `.ralph/plans/future/plugin-test-container/reviews/`).
No goal/heartbeat plugin work (h6w.24 area) landed on main during Slice 1.

The episode branch was rebased onto `origin/main` (`1a0836d`) before Slice 2
so it carries those review records. The rebased commits are
content-identical to the reviewed ones; only hashes changed (reviewed
`2666843` → rebased `b2f6b86`). Post-rebase tier-0 gate (bounded command in
DEVELOPERS.md): **161 passed in 10.08s** — green.

## Shared-base extraction: DEFERRED (escape hatch)

The runtime image (`docker/runtime.Dockerfile`) derives FROM the OpenShell
sandbox base (`ghcr.io/nvidia/openshell-community/sandboxes/base`,
Ubuntu 24.04) and installs no Node. The tier-1 image is plain Docker from
`ubuntu:24.04`. There is no non-trivial shared layer to extract without
changing the runtime image's FROM line and risking its behavior. Per the
spec's explicit escape hatch, extraction is deferred to follow-up bead
`prime-claw-blw.4`; lineage is the common Ubuntu 24.04 baseline only.
