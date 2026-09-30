# Plugin test container — test tier architecture and the tier-1 container

> Status: FUTURE specification, awaiting operator review.
> Origin: design discussion 2026-09-27 on plugin-testing incidents caused by
> sharing one `$HOME` between the working prime-agent harness and the
> prime-agent under test. Scope widened during review to include the
> tiered-test architecture and a unified end-to-end entry point.

## Current system

Plugin tests for `src/prime-agent-plugin/` run **on the host**, in the same
environment as the prime-agent harness that is doing the development work:

- **Node logic suites.** `tests/*.test.mjs` exercise the TypeScript extensions
  against a mocked ExtensionAPI, driven by pytest bridge files
  (`tests/test_*_extension.py`) that shell out to
  `node --experimental-strip-types --test`.
- **Install tests.** `tests/test_prime_agent_plugin_install.py` exercises
  `scripts/apply-prime-agent-plugin.sh` / `check-prime-agent-plugin.sh`
  against a `PRIME_AGENT_PLUGIN_ROOT` redirect, never the real default
  `~/.prime/agent/` path.
- **Live RPC probes.** Some tests (e.g. the RPC loader test in
  `tests/test_handoff_chain_extension.py`) invoke the **host-installed**
  `prime-agent` binary directly.
- **Compensating controls.** `scripts/run-prime-agent-probe.sh` wraps probes
  in throwaway `PRIME_AGENT_CODING_AGENT_DIR` / `PRIME_AGENT_SESSION_DIR`
  roots so they cannot mutate operator config. Harness prompt notes encode
  further discipline (single-instance cutover safety, probe cleanup policy).

### Why this is a problem

The prime-agent under test and the prime-agent doing the work share one
`$HOME` and one process space. That shared environment is the root cause of
every plugin-testing incident so far: clobbered `settings.json`, mixed or
duplicate plugin generations that block startup, probe sessions polluting the
real session directory, and single-instance cutover hazards. The compensating
controls are env-var tricks and discipline layered over a shared environment;
they keep growing (the "10x the effort of the plugin itself" anti-pattern)
without eliminating the failure class.

## Required change

Two changes, one architecture:

1. **Make the test tier structure explicit.** prime-claw's tests need
   different environments, so they are organized into named tiers (below).
   This is inherent to the project, not an accident of any one suite: the
   OpenShell runtime tests must orchestrate sandboxes from outside any
   container, while agent-behavior tests need only a light prime-agent
   environment.
2. **Run all plugin tests inside a plain Docker container** (the new tier-1
   environment), so the prime-agent under test is physically isolated from
   the working harness. The container is the isolation boundary; no bespoke
   in-process isolation machinery is added or extended for plugin testing.

### Test tiers

- **Tier 0 — host, no environment.** Static content checks (skill-Markdown
  validators, inventory integrity). No node, no prime-agent.
- **Tier 1 — slim container.** Anything needing node + a prime-agent install
  + the plugin, but *not* the brain stack. The plugin suite is the first
  occupant; future agent-behavior tests that do not need gbrain, Postgres,
  or channels land here too.
- **Tier 2 — full runtime sandbox.** OpenShell lifecycle tests
  (`tests/test_runtime_*.py`) today; Phase 3 integration tests (gbrain in
  sandbox, browse shim, channels) later. These orchestrate Docker/OpenShell
  from the host and stay outside any container.

### Unified end-to-end entry point

Running the whole suite means one entry point that composes the tiers,
fast-first, fail-fast (e.g. `scripts/test-all.sh`, with pytest tier markers
such as `-m container` / `-m sandbox` for selective runs). The tiers are
heterogeneous; the invocation is unified. The end-to-end driver is a dumb
sequencer — run tier 0, run tier 1, optionally run tier 2, report — and must
not grow into a bespoke test harness.

### Shared image lineage

The slim tier-1 test image and the Phase 2 runtime image derive from a
common base (Ubuntu 24.04 + node + python), so the environments form one
image family rather than two unrelated Dockerfiles.

### Decisions locked with the operator

1. **Slim image.** A dedicated minimal test image, not the Phase 2 runtime
   image (which bakes PostgreSQL + gbrain). Built on the shared base
   (Ubuntu 24.04 + node + python, per "Shared image lineage") with only what
   the tests need: Node >= 22.8 (prime-agent prerequisite), Python 3 +
   pytest, and the plugin test toolchain.
2. **Plain Docker, not OpenShell.** The test container needs filesystem and
   process isolation only. No egress policy, no credential mediation, no
   OpenShell policy layer. Tests run offline at test time; image build is the
   only step that may use the network.
3. **prime-agent install: both source checkout and pinned release, selected
   by `.env`.** We run a fork of prime-agent installed from source, and the
   tests must exercise that. A local checkout of the fork is bind-mounted
   into the container and installed there. A pinned npm release is the
   alternative path for reproducibility. Selection lives in an **ignored
   `.env`** file; the repo gains a committed **`.env.example`** with
   instructions. (`.env` is already gitignored.)
4. **Plugin source enters by read-only bind mount.**
   `src/prime-agent-plugin/` is mounted read-only; the container runs
   `scripts/apply-prime-agent-plugin.sh` against the container's own real
   global `~/.prime/agent/` location. This tests the apply/check scripts
   against their true default path — a better test than today's
   `PRIME_AGENT_PLUGIN_ROOT` redirect.
5. **One ephemeral container per whole suite run.** Not per test. Tests
   within a run share the container's home, as they already share a home
   today; a test that genuinely needs a fresh home resets container-local
   state explicitly.
6. **Dumb driver.** The host-side driver does: build image (cached), start
   container, install prime-agent per `.env`, apply plugin, run tests,
   collect results, destroy container. No cleverness, no growing harness.
7. **`run-prime-agent-probe.sh` stays, untouched.** It remains available for
   general host-side probes, with its existing test. The plugin test suite
   simply stops depending on it.

### Test migration split

- **Move to tier 1 (slim container):** every test that needs Node, a
  `prime-agent` binary, or a plugin install — the `.test.mjs` extension
  suites and their pytest bridges, the apply/check install tests, and the
  live RPC/probe tests.
- **Stay at tier 2 (host, OpenShell):** `tests/test_runtime_*.py` — they
  orchestrate sandboxes and belong outside a container.
- **Stay at tier 0 (host, static):** pure content checks (e.g. skill-Markdown
  validators) that need neither Node nor prime-agent.

## Intended end state

- `docker/test.Dockerfile` — the slim tier-1 test image definition, sharing
  base lineage with the runtime image.
- `.env.example` + ignored `.env` — selects prime-agent source checkout path
  vs pinned release, with operator instructions.
- A thin host driver script for the tier-1 suite (exact name and shape
  decided in planning) that builds, runs, collects, and destroys.
- A unified end-to-end entry point (e.g. `scripts/test-all.sh`) plus pytest
  tier markers, so one command runs tier 0 + tier 1 (+ tier 2 on request),
  fast-first, fail-fast.
- A pytest session-scoped fixture so `pytest` itself can drive the tier-1
  suite in one container per run; test results and logs land in a gitignored
  results directory.
- Plugin tests no longer touch the host's `$HOME`, `~/.prime/agent/`,
  settings, sessions, or installed prime-agent. The class of
  "test clobbered the harness" incidents is eliminated by construction.
- Documentation updates describing how to run plugin tests (README or
  DEVELOPERS.md pointer, per planning).

## Boundaries and non-goals

- No changes to plugin source behavior; this is test infrastructure only.
- No changes to the OpenShell runtime image behavior or `bin/prime-claw`
  verbs. Extracting a shared base image is allowed only if the runtime image
  remains byte-comparable in behavior; if that gets complicated, the shared
  lineage can be deferred to a follow-up without blocking tier 1.
- No new tier-2 test suites in this slice; the tier model only re-homes
  existing tests and names the structure.
- No CI wiring in this slice (can follow once the manual path is proven).
- No new general test-orchestration framework; the driver stays dumb.
- This slice does not retire `run-prime-agent-probe.sh` or the harness prompt
  notes about host-side probing; those remain for non-plugin host probes.
