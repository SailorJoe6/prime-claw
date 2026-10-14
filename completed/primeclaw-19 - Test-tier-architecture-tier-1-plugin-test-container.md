---
id: PRIMECLAW-19
title: Test tier architecture + tier-1 plugin test container
status: Done
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-14 02:54'
labels: []
dependencies: []
references:
  - >-
    .ralph/plans/archive/plugin-test-container/EXECUTION_PLAN.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/plugin-test-container/SPECIFICATION.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-2666843-expert-pass.md
    @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-47d2830-expert-block.md
    @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-d8dbc5d-expert-block.md
    @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice2-470be98-expert-block.md
    @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice2-bc00cba-expert-pass.md
    @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - PRIMECLAW-19.1
  - PRIMECLAW-19.2
  - PRIMECLAW-19.3
  - PRIMECLAW-19.4
priority: p1
type: epic
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement .ralph/plans/future/plugin-test-container: explicit test tiers (0 host static / 1 slim docker container for plugin tests / 2 OpenShell sandbox), slim tier-1 image, .env-selected prime-agent install (fork source pack or pinned npm), plugin applied inside container, one ephemeral container per suite run, dumb driver, unified test-all entry point.

## Migrated bundle authority

Imported from frozen pre-cutover tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Verbatim bytes remain available through the source references below; this task is the durable Backlog authority for the bundle's content and outcome.

## Specification imported from `.ralph/plans/archive/plugin-test-container/SPECIFICATION.md`

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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `docker/test.Dockerfile` — the slim tier-1 test image definition, sharing base lineage with the runtime image.
- [x] #2 `.env.example` + ignored `.env` — selects prime-agent source checkout path vs pinned release, with operator instructions.
- [x] #3 A thin host driver script for the tier-1 suite (exact name and shape decided in planning) that builds, runs, collects, and destroys.
- [x] #4 A unified end-to-end entry point (e.g. `scripts/test-all.sh`) plus pytest tier markers, so one command runs tier 0 + tier 1 (+ tier 2 on request), fast-first, fail-fast.
- [x] #5 A pytest session-scoped fixture so `pytest` itself can drive the tier-1 suite in one container per run; test results and logs land in a gitignored results directory.
- [x] #6 Plugin tests no longer touch the host's `$HOME`, `~/.prime/agent/`, settings, sessions, or installed prime-agent. The class of "test clobbered the harness" incidents is eliminated by construction.
- [x] #7 Documentation updates describing how to run plugin tests (README or DEVELOPERS.md pointer, per planning).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Imported from `.ralph/plans/archive/plugin-test-container/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Historical/current status statements are preserved literally; the task status and Final Summary state the migrated outcome.

# Execution plan — plugin test container (test tier architecture, tier 1)

> Status: FUTURE plan, awaiting operator plan review.
> Specification: [SPECIFICATION.md](SPECIFICATION.md) in this folder.
> Beads: epic `prime-claw-blw`; slices `prime-claw-blw.1` / `.2` / `.3`.
> Planning does not authorize implementation; that requires
> `/implement-spec .ralph/plans/future/plugin-test-container`.

## Repo audit findings that shape this plan

- The Phase 2 runtime image (`docker/runtime.Dockerfile`) does **not** install
  prime-agent or node at build time. `bin/prime-claw` stages prime-agent into
  the sandbox at converge time via **npm pinned version**
  (`prime_agent_version`, default `0.9.3`) with the `npm-onload.js` workaround.
  Installing prime-agent **from source** is new machinery for this repo.
- The prime-agent fork (`/Users/jlanders/code/prime-agent`) is an
  npm-workspaces monorepo with its own `release:pack` script
  (`scripts/pack-prime-agent-release.mjs`) that produces an installable
  tarball on the host.
- Host `node_modules` from macOS cannot be reused inside a Linux container
  (arch/ABI mismatch), so in-container `npm ci` of the whole monorepo is
  rejected: it needs network at container-start and is slow. Instead the
  source path packs a tarball **on the host** and the container installs that
  tarball — mechanically parallel to the pinned path (which installs the vendor's release tarball via the vendor installer; prime-agent is not on the public npm registry).
- Test inventory audit (tier assignments; point-in-time as of
  planning — the assignment rule below is the durable contract, re-audited
  at merge time):
  - **Tier 1 (move into container):** `tests/test_handoff_chain_extension.py`,
    `tests/test_reviewed_plan_extension.py` (node bridges + RPC probes),
    `tests/test_project_conversation_extension.py`,
    `tests/test_goal_blocker_control_extension.py`,
    `tests/test_conversation_oversight_native.py`,
    `tests/test_reviewed_plan_native_discovery.py`,
    `tests/test_prime_agent_plugin_install.py`, and the node suites
    `tests/handoff_chain_extension.test.mjs`,
    `tests/reviewed_plan_extension.test.mjs`,
    `tests/project_conversation_extension.test.mjs`,
    `tests/spec_episode_extension.test.mjs`,
    `tests/episode_close_extension.test.mjs` (currently has **no** pytest
    bridge — slice 3 either adds one inside the container or documents why
    not).
  - **Tier 0 (stay host):** `test_execute_skill.py`,
    `test_future_plan_skills.py`, `test_oversee_episode_skill.py`,
    `test_inventory_integrity.py`, `test_brain_query.py`,
    `test_brain_repo_config.py`, `test_embedding_*.py`,
    `test_portable_provider_defaults.py`,
    `test_prime_agent_probe_isolation.py` (guards the host wrapper script,
    which stays).
  - **Tier 2 (stay host, OpenShell):** `tests/test_runtime_*.py` (6 files).
- No pytest config file exists today (tests are plain pytest/unittest); tier
  markers require adding one.
- `.env` is already gitignored; `.env.example` will be the committed template
  (matches the existing local-state rule in DEVELOPERS.md).

## Slices

Strictly sequential: 1 → 2 → 3. Each slice ends committed and pushed with its
bead updated and acceptance evidence recorded under `docs/evidence/`.

### Slice 1 — tier-1 slim image + dumb driver (`prime-claw-blw.1`)

Deliver:

- `docker/test.Dockerfile` — slim tier-1 image: Ubuntu 24.04 + Node >= 22.8 +
  Python 3 + pytest. No Postgres, no gbrain, no OpenShell policy layer.
  - Attempt shared-base extraction (`docker/base.Dockerfile` consumed by both
    `runtime.Dockerfile` and `test.Dockerfile`). **Escape hatch (per spec):**
    if extraction threatens runtime-image behavior, keep the base lines
    duplicated, file a follow-up bead, and proceed. Do not block tier 1 on
    lineage cosmetics.
- `scripts/test-tier1.sh` — the dumb driver: build image (cached), start one
  ephemeral container, run a smoke command (`node --version`,
  `prime-agent --version` once install exists — slice 1 smokes node/python
  only), destroy container, exit non-zero on any failure.

Acceptance evidence:

- `scripts/test-tier1.sh` runs green end-to-end on the operator host; output
  captured to `docs/evidence/`.
- Image builds from clean cache; `docker images` shows the slim image
  materially smaller than the runtime image.
- Regression test `tests/test_tier1_image.py` (tier 0): asserts the
  Dockerfile exists, contains no Postgres/gbrain/OpenShell references, and
  the driver script is executable with a `--help` or dry-run surface.
- Bead `.1` updated; committed + pushed.

### Slice 2 — prime-agent install selection + plugin apply inside container (`prime-claw-blw.2`)

Deliver:

- `.env.example` (committed) + ignored `.env` selecting:
  - `PRIME_AGENT_PINNED=<version>` — container installs the released version
    via the vendor installer (`install.sh`, the same mechanism
    `bin/prime-claw` uses; corrected during implementation: `prime-agent` is
    not on the public npm registry — npm `E404` — releases are served from
    the vendor's download base), or
  - `PRIME_AGENT_SOURCE=<abs path to fork checkout>` — host runs the fork's
    `release:pack` to produce a tarball; the tarball is staged into the
    container and installed. Exactly one selector active; the driver fails
    fast on neither/both.
- Extend `scripts/test-tier1.sh` so container start: installs prime-agent per
  `.env`, bind-mounts `src/prime-agent-plugin/` **read-only**, runs
  `scripts/apply-prime-agent-plugin.sh` then `check-prime-agent-plugin.sh`
  **inside the container** against the container's real `~/.prime/agent/`.
- Network policy: image build and the prime-agent install step may use the
  network; test execution does not require it.

Acceptance evidence:

- With `PRIME_AGENT_SOURCE` pointing at the fork: container
  `prime-agent --version` matches the fork's version; apply/check pass inside
  the container; `check-prime-agent-plugin.sh` verifies the container's
  global install byte-for-byte.
- With `PRIME_AGENT_PINNED`: same checks pass against the vendor-installer install.
- A container-side RPC probe (the pattern from
  `tests/test_handoff_chain_extension.py`'s live probe) loads the plugin's
  native commands from the container's prime-agent — proving the previously
  dangerous probe is now safe.
- Host `$HOME/.prime/agent` demonstrably untouched (before/after checksum of
  the managed plugin files recorded in the evidence note).
- Regression test `tests/test_tier1_driver.py` (tier 0): static checks on
  `.env.example` completeness and driver fail-fast behavior on missing/both
  selectors.
- Bead `.2` updated; committed + pushed.

### Slice 3 — migrate plugin tests to tier 1 + tier markers + unified entry (`prime-claw-blw.3`)

Deliver:

- `pytest.ini` (or `pyproject.toml`) registering markers: `container`
  (tier 1) and `sandbox` (tier 2); unmarked tests are tier 0.
- `tests/conftest.py` session-scoped fixture: starts **one** tier-1 container
  per pytest run that includes `container` tests, exposes an exec helper, and
  destroys the container at session end. Driver-equivalent setup (install
  prime-agent, apply plugin) runs once per session, not per test.
- Migrate the tier-1 inventory (audit list above) so their node/prime-agent
  subprocess calls execute **inside** the container via the fixture. Tier-1
  test code must not reference host paths (`shutil.which("prime-agent")`
  against the host is replaced by container exec).
- `scripts/test-all.sh` — dumb sequencer: tier 0 → tier 1 → (tier 2 only on
  explicit request, e.g. `--with-sandbox`), fail-fast, prints a tier summary.
- Test results/logs land in a gitignored results directory.
- Decide and document the fate of `episode_close_extension.test.mjs`
  (add the missing bridge or document why it stays unbridged).
- Update DEVELOPERS.md "Testing" section: tiers, `.env` setup, how to run
  each tier and the whole suite.

Acceptance evidence:

- `pytest tests/ -q` (tier 0 default) passes with no Docker dependency.
- `pytest -m container` runs the full migrated plugin suite inside one
  container per run, green, with host plugin install untouched.
- `scripts/test-all.sh` runs tier 0 + tier 1 green end-to-end; evidence note
  recorded.
- `tests/test_inventory_integrity.py` still passes; new requirements
  (R-T1-* entries) added to `config/requirements-inventory.json` per the
  apply/check/validate/test discipline.
- Final pre-merge step: rebase on current `main`, re-run the tier-1
  inventory audit, and migrate any plugin-touching tests that landed during
  implementation (see "Merge reconciliation" risk).
- Bead `.3` and epic `prime-claw-blw` updated; committed + pushed.

## Explicit non-goals (this plan)

- No plugin source behavior changes.
- No OpenShell runtime image behavior changes; shared-base extraction is
  best-effort with a deferral escape hatch.
- No new tier-2 suites; no CI wiring; no retirement of
  `scripts/run-prime-agent-probe.sh`.
- No test-orchestration framework: the driver and sequencer stay dumb.

## Risks / watch items

- **Fork pack reproducibility:** `release:pack` must be runnable on the
  operator host without surprises; slice 2 evidence includes the exact pack
  command and its output hash.
- **Container-start latency:** prime-agent install happens once per suite
  run; if it proves slow, caching the install layer is a follow-up, not a
  redesign.
- **macOS Docker bind-mount performance** for the read-only plugin mount is
  expected to be a non-issue at this size; revisit only if measured slow.
- **Merge reconciliation against a moving main.** This repo has active
  parallel development. New plugin-touching tests (node suites, install
  tests, live RPC probes) may land on `main` while this plan is in flight.
  At merge time the episode must re-audit the test inventory (the tier-1
  candidate pattern: any test invoking `node`, a `prime-agent` binary, or a
  plugin install), migrate any new tier-1 tests into the container, and
  record the re-audit in the final evidence note. The tier assignment rule,
  not a frozen file list, is the durable contract.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One-time Backlog migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`.

Tracked source paths:
- `.ralph/plans/archive/plugin-test-container/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/plugin-test-container/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-2666843-expert-pass.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-47d2830-expert-block.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-d8dbc5d-expert-block.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice2-470be98-expert-block.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice2-bc00cba-expert-pass.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530` (shared terminal/status evidence)

Every listed source remains tracked in this bounded migration slice. Git history preserves verbatim bytes. This task imports the bundle's specification/requirements into Description and native criteria, execution plan into Implementation Plan, durable history into these notes, and terminal outcome into Final Summary. Existing task ID and `parent_task_id` are preserved. No bundle is placed under `backlog/archive/`.

Related durable Backlog tasks: `PRIMECLAW-19.1`, `PRIMECLAW-19.2`, `PRIMECLAW-19.3`, `PRIMECLAW-19.4`.

### Shared archive-index outcome

## plugin-test-container/ — Test tier architecture + tier-1 plugin test container ✅ COMPLETE (2026-09-30)

Delivered the three-tier test architecture and the tier-1 plugin test container
across three owner-reviewed slices: (1) the tier-1 image and driver
(`docker/test.Dockerfile`, `scripts/test-tier1.sh`, `tests/test_tier1_image.py`);
(2) install selection (pinned release via vendor installer, or source via fresh
fork pack), in-container apply/check, a validated probe, and a hard deadline; and
(3) pytest markers (`container` = tier 1, `sandbox` = tier 2, unmarked = tier 0),
the session-scoped `tier1_container` fixture (one container per run,
driver-mirrored setup, exec helpers), migration of all tier-1 suites to
in-container exec, and the `scripts/test-all.sh` sequencer. Acceptance
(verified split, mirroring the slice-3 evidence note): the tier-0 default
`python3 -m pytest tests/ -q` passes with no Docker (223 passed, 144 skipped,
post-reconciliation). Tier-1 in ONE session container: source mode
**34 passed/139s BEFORE the merge reconciliation**; pinned mode
**37 passed/118s AFTER reconciliation**; the post-reconciliation source-mode
gate is NOT claimed. Accepted commits: slice 1 `2666843`, slice 2 `bc00cba`,
slice 3 `d040c02` plus merge-reconciliation `7118a44` (rebased onto main
`9b3edd2`, the goal-heartbeat plugin generation).

- [Archived specification](plugin-test-container/SPECIFICATION.md)
- [Archived execution plan](plugin-test-container/EXECUTION_PLAN.md)
- [EXPERT review reports (BLOCK/PASS trail)](plugin-test-container/reviews/)
- Acceptance evidence:
  [slice 1 image + driver](../../../docs/evidence/2026-09-29-tier1-slice1-image-driver.md),
  [slice 2 install selection](../../../docs/evidence/2026-09-30-tier1-slice2-install-selection.md),
  [slice 3 migration + sequencer](../../../docs/evidence/2026-09-30-tier1-slice3-migration-sequencer.md)
- Operator-facing doc home (named by the approved plan):
  [DEVELOPERS.md](../../../DEVELOPERS.md) "Testing" section

EXPERT review trail: slice 1 BLOCK `47d2830` → BLOCK `d8dbc5d` → PASS
`2666843`; slice 2 BLOCK `470be98` → PASS `bc00cba`. Slice 3 had NOT received
its final EXPERT gate at archival time; the owner runs a fresh FINAL EXPERT
review on the complete exact candidate (`d040c02..<archival>`), so this archive
does not record a slice-3 PASS. Backlog.md tasks `PRIMECLAW-19.1`/`.2`/`.3` are Done;
`PRIMECLAW-19.4` (shared-base extraction) is deferred P2.

Note: the archived EXECUTION_PLAN.md contains a historical promotion quote
reading `/implement-spec .ralph/plans/future/plugin-test-container`; that
bundle's reviewed artifact set now lives beside it in this subfolder, with the
five review reports preserved under `reviews/`.

## Review evidence imported from `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-2666843-expert-pass.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`

# EXPERT review — slice-1 final candidate 2666843 — PASS

> Reviewer: expert-reviewer-blw1-2666843 (rlm child sub-e050b4f4)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated post-restart)
> Exact commit: 2666843426734a82147e5a8fe965b58754c96ac5 (episode/plugin-test-container)
> Packet: agentmsg_eda4e7f9 | Report arrived via agent_message reply; preserved verbatim below
> Prior rounds: 47d2830 BLOCK (B1/B2/B3) and d8dbc5d BLOCK (B3-R) — both preserved in this folder
> Disposition (owner): PASS accepted — slice-1 candidate accepted; advancing to slice 2

---

PASS — 2666843426734a82147e5a8fe965b58754c96ac5

No material finding remains in the complete Slice-1 candidate. I independently reviewed the promoted specification, Slice-1 execution plan, both preserved BLOCK reports, the complete implementation, and relevant existing tests. This PASS covers Slice 1 only. It is not merge authority or evidence that Slices 2–3 are complete.

## Exact candidate and scope

- HEAD and the live remote refs/heads/episode/plugin-test-container both equal the reviewed hash. The tracked worktree was clean before and after verification.
- `git diff main...2666843 --stat`: 7 files, 616 insertions, 1 deletion. The implementation changes are exactly docker/test.Dockerfile, scripts/test-tier1.sh, tests/test_tier1_image.py, DEVELOPERS.md, and docs/evidence/2026-09-29-tier1-slice1-image-driver.md. The other two entries are unchanged specification/plan promotions from ab56c62.
- Commit 2666843 changes only the evidence note (+37/-11). No plugin source, runtime Dockerfile, run-prime-agent-probe.sh, Slice-2 install selection, markers/conftest, test migration, or test-all driver changes are present.

## B3-R resolved

- Evidence note :121–126 now limits the demonstrated claim to unchanged existing plugin/probe code. It explicitly says additive scope does not establish non-causation and leaves the six per-test causes UNRESOLVED.
- I checked the actual load paths: reviewed-plan-extension :215–218/:528–531 uses explicit extensions with automatic discovery disabled; oversight-native :21–23/:44–46 does likewise; native-discovery :278/:294 and :350/:374 installs into temporary agent roots. The note does not establish the default host generation as a cause for these paths. Its hypothesis explicitly excludes explicit-source/temp-install tests (:142–146).
- Container-cure language is now expressly hypothetical (:152–156). The note explicitly states that filesystem/process isolation does not repair unbounded reads (:157–164).
- All required observations remain: 6 failed/307 passed and the six names (:94–102), host generation mismatch (:107–112), owner intervention and the distinct steer-lifecycle probe (:113–117), and the genuine unbounded-read hazards (:133–138). I confirmed the hazards in tests/test_reviewed_plan_extension.py:371 and :393; I did not replay them.
- The preserved unresolved baseline must be compared with later authorized container results. This review establishes neither the historical causes nor that migration fixes the six failures.

## B1 and B2 remain resolved

- Help exits at scripts/test-tier1.sh:34 and dry-run exits at :60, before Docker checks at :65–66. Real execution still checks readiness and propagates build/smoke failure under `set -euo pipefail`; OK follows successful smoke.
- The recording/failing-Docker tests cover zero calls on informational paths, missing CLI, unreachable daemon, failed build, failed smoke, short-circuit order, and a successful positive control.
- DEVELOPERS.md:40–59 warns that unfiltered pytest still includes host-coupled probes and supplies the file-bounded current gate. I inspected all 11 selected files and their relevant boundaries: static checks, mocked external calls, synthetic watchdog processes, Python-only wrapper checks, and the new driver tests. The selection does not launch host Node, Prime Agent, or plugin installation. I did not run the full host suite.
- DEVELOPERS.md:72–80 distinguishes later install/migration work from the delivered toolchain-only smoke. There are no tier markers or conftest pretending that migration has happened.

## Complete Slice-1 acceptance

- The image uses Ubuntu 24.04, NodeSource 22.x, Python 3, and pytest without installing the brain/OpenShell stack. The driver builds and smoke-runs one `docker run --rm` container, with no host mounts or Prime Agent execution.
- Read-only BuildKit inspection of retained build 0b6ilyiui75ai65strs6wciac shows 9/9 steps and 0% cached. Its logs report Node v22.23.3, Python 3.12.3, and pytest 7.4.4. Docker image history matches the current unchanged Dockerfile. The committed evidence records the successful end-to-end smoke; I did not rebuild or start a container.
- Read-only image listing confirms 606MB for prime-claw-test-tier1:latest versus 5.17GB for prime-claw-brain:0.1.0, about 8.5 times smaller.
- Shared-base deferral follows the approved escape hatch: the unchanged runtime image uses the OpenShell base and has no Node installation. Read-only Beads inspection confirms follow-up prime-claw-blw.4 exists and prime-claw-blw.1 records the accepted repairs and pushed 2666843 candidate.

## Independent bounded verification

Using `/opt/homebrew/bin/python3 -B -m pytest -p no:cacheprovider tests/test_tier1_image.py -q` with PYTHONDONTWRITEBYTECODE=1:

- Normal PATH: 17 passed (3.54s).
- PATH=/usr/bin:/bin, Docker confirmed absent: 17 passed (3.33s).
- DOCKER_HOST pointing to a nonexistent socket: 17 passed (3.09s).
- `bash -n scripts/test-tier1.sh`: passed.
- Two no-Docker `--dry-run --rebuild` runs: both exit 0, identical output, expected --no-cache command.
- `git diff --check main...2666843`: passed.

No repository edits, Git mutations, live RPC probes, full host suite, Docker builds/container runs, host-plugin refresh, episode/lifecycle actions, or cleanup were performed. The personal brain was unavailable (connection failed); conclusions rely on the exact bundle, repository evidence, retained build records, and checks above.

## Review evidence imported from `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-47d2830-expert-block.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`

# EXPERT review — slice-1 candidate 47d2830 — BLOCK

> Reviewer: expert-reviewer-blw1-47d2830 (rlm child sub-d5400031, session 01a0f11c-4e60-73b9-a5c9-6e6d9058a688)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter validated)
> Exact commit: 47d28309315133821d857c38fe6eb4bcd14a8643 (episode/plugin-test-container)
> Packet: agentmsg_14120c94 | Report arrived via agent_message reply; preserved verbatim below
> Disposition (owner): BLOCK accepted — all three findings classified in-scope review-rework for slice 1

---

BLOCK — 47d28309315133821d857c38fe6eb4bcd14a8643

Three material findings. This is a Slice-1 review, not a request to implement Slices 2–3 early.

## B1 — P2, confidence 10/10: Tier-0 regression test requires a live Docker daemon

Evidence: scripts/test-tier1.sh:41–42 checks Docker and executes `docker info` before the dry-run branch at :56. tests/test_tier1_image.py:68–74 calls that branch without isolating the environment. This contradicts the file’s “no Docker required” contract and the plan’s tier-0 classification.

Read-only reproduction on this host:
`env PATH=/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 -B -m pytest -p no:cacheprovider tests/test_tier1_image.py -q`
Result: **1 failed / 8 passed**; failure at :72, `error: docker not found on PATH`. With normal PATH and the running daemon: **9 passed**. With Docker available but DOCKER_HOST pointing to a nonexistent socket, `--dry-run` exits 1 with `docker daemon is not reachable`.

Impact / violated invariant: the newly added static host gate fails on the exact no-Docker environment tier 0 promises. Even the advertised print-only operation contacts Docker. This is a new regression independent of the six pre-existing probe failures.

Root-cause seam: execution-only readiness checks run before the informational command exits; the regression test inherits the reviewer/developer’s live environment, concealing this dependency.

Repair direction: keep help/dry-run independent of Docker and add negative-environment coverage that proves they make no Docker calls. Retain readiness and error propagation for real execution. This fixes the dependency without adding a harness.

Constraints / avoid: do not install/start Docker for tier 0, skip the test when Docker is missing, or remove readiness checks from actual runs.

Acceptance tests: (positive) help, dry-run, and dry-run+rebuild print the expected commands without Docker; (negative) put a recording/failing Docker substitute on PATH and prove these informational paths never invoke it; (failure) ordinary execution still fails for a missing CLI, unreachable daemon, failed build, or failed smoke and never prints OK; (replay) repeat dry-run twice with identical output and no external calls. Run the whole new test file with Docker absent and with an unreachable daemon.

Regression risk: accidentally bypassing real-run preflight, swallowing build/run failures, or changing rebuild argument handling. Dependencies: repair driver and regression coverage together; refresh the evidence results afterward.

## B2 — P2, confidence 10/10: Developer guide presents future isolation as current behavior

Evidence: DEVELOPERS.md:52–56 calls plain `pytest tests/ -q` tier 0 with no Node/prime-agent/Docker, and says plugin-dependent tests run in the container and cannot touch host state. At this commit there is no pytest tier configuration or conftest fixture. Existing tests/test_reviewed_plan_extension.py:144–167 still executes host Node; :181–226 executes the host prime-agent. scripts/test-tier1.sh:50–67 only runs toolchain version commands. The committed evidence itself records the full host suite and its hang.

Impact / violated invariant: a developer can follow a newly asserted “safe static” command and launch the same host-coupled probes this project is trying to isolate, or mistake a green smoke run for plugin-suite validation. Documentation must describe the delivered slice and preserve the approved host-probe safety boundary. Slice 3, not Slice 1, owns migration/default selection.

Root-cause seam: the intended end-state tier model was documented in the present tense before the selection and execution boundary exists. “Being rolled out” on tier 1 does not correct the explicit claim about the default command.

Repair direction: distinguish current Slice-1 smoke capability from the planned architecture. Give a clearly bounded, reviewed tier-0-only command for now, and state that unfiltered pytest still includes host-coupled tests until migration. This is a documentation repair, not permission to advance scope.

Constraints / avoid: do not implement markers or migrate probes just to make this paragraph true; do not recommend the unfiltered host suite as a safe gate; do not imply smoke validates plugins.

Acceptance checks: (positive) each current command maps to existing code; (negative) no current-command description claims default pytest is static-only or plugin tests already run in Docker; (failure) smoke failures are not described as suite results; (replay) the documented safe subset remains safe to repeat without host prime-agent. Check command selection by inspection or tier-0-only checks, not a new full host run.

Regression risk: stale transitional instructions after Slice 3. Dependencies: align this correction with B1 and the evidence’s standing host-test restriction; update the text again when migration actually lands.

## B3 — P2, confidence 9/10: Recorded failure analysis does not establish the claimed common root cause

Evidence: docs/evidence/2026-09-29-tier1-slice1-image-driver.md:49–76 labels the host plugin mismatch a “smoking gun”; the commit message says all six failures were root-caused to it and the pipe deadlock. But:
- tests/test_reviewed_plan_extension.py:215–218 and :528–531 disable automatic extensions and explicitly load this checkout’s source.
- tests/test_conversation_oversight_native.py:21–23 and :44–46 use explicit source extensions with automatic extensions disabled.
- tests/test_reviewed_plan_native_discovery.py:278/:294 and :350/:374 install this checkout into a temporary agent root and point PRIME_AGENT_CODING_AGENT_DIR there.
- The steer-lifecycle probe with the unbounded reads (:371, :393) is not among the six reported failed tests.
The host check proves a host-install mismatch exists. It does not connect that mismatch to these six failures. No per-failure assertion/error trace is recorded to establish the missing causal link.

Impact / violated invariant: the acceptance record can wrongly close investigation and suggest container placement alone will fix an installed-runtime/API or other test defect. Evidence must distinguish observation, demonstrated cause, and hypothesis.

Root-cause seam: a separate environment diagnostic and source-level hang hazards were promoted into a blanket explanation without tracing each test’s actual load path.

Repair direction: preserve the reported counts and intervention, but qualify the six causes as unresolved unless existing logs establish them. Separate the confirmed unchanged-source/additive scope fact, the observed host mismatch, and the possible pipe-blocking mechanisms. This correction is actionable from the cited source; it does not require another host investigation.

Constraints / avoid: do not rerun unsafe host probes, refresh the working host plugin, change plugin behavior, or repair existing tests in Slice 1 to support the narrative. Do not present additive-only as universal causal proof.

Acceptance checks: (positive) each asserted root cause has a specific failure trace plus the tested binary/plugin path, or is explicitly a hypothesis; (negative) temp-installed/explicit-source tests are not attributed to default host plugin files without evidence of that path; (failure) unknown causes and the operator intervention remain visible; (replay) later container runs record whether each inherited failure persists rather than assuming the boundary fixes it.

Regression risk: an overcorrection could hide the real, independently observed host mismatch or the genuine unbounded reads. Keep both observations. Dependencies: repair with B2’s current-state documentation; substantive probe repairs remain Slice 3.

## Verified scope and remaining evidence

- `git ls-remote` confirms origin/episode/plugin-test-container points to the exact reviewed commit; the tracked working tree matches it.
- Exact diff: five files, +347/-0. No plugin source, runtime Dockerfile, or run-prime-agent-probe.sh change. The new tests only run help/dry-run/invalid-argument paths, not prime-agent. This supports “no direct plugin/probe code regression”; it does not prove the six historical causes.
- Ubuntu 24.04, NodeSource 22.x, Python/pytest, no brain/OpenShell stack, single `docker run --rm`, and fail-fast shell execution match Slice 1. Shared-base deferral is consistent with the runtime’s OpenShell base and the approved escape hatch.
- Read-only Docker history corroborates the test image’s build instructions. Current `docker image ls` reports **606MB test image versus 5.17GB prime-claw-brain:0.1.0**. This supplies the omitted size comparison; the evidence’s “no runtime image built locally” statement should be updated/qualified rather than repeated. I did not rebuild or execute a container, so I did not independently re-prove clean-cache build or runtime smoke.
- Bash syntax check passed. I ran only the new nonmutating regression file with bytecode and pytest cache disabled. No live Prime Agent probes, file edits, Git mutations, lifecycle actions, or cleanup were performed.
- Personal-brain lookup returned no relevant test-container context. Findings rely on the exact approved bundle, reviewed source, and the read-only checks above.

## Review evidence imported from `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice1-d8dbc5d-expert-block.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`

# EXPERT review — slice-1 rework candidate d8dbc5d — BLOCK (1 finding remains; B1/B2 resolved)

> Reviewer: expert-reviewer-blw1-d8dbc5d (rlm child sub-9f31b642, session 01a0f139-2bb4-762e-bba5-c3c03862cec3)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated)
> Exact commit: d8dbc5db96a6ddafbbaa61e2f450da7c6a62bf75 (episode/plugin-test-container)
> Packet: agentmsg_ef3f8d51 | Report arrived via agent_message reply; preserved verbatim below
> Operational note: review interrupted ~7h by a harness model-stream stall (operator-nudged; reviewer evidence verified intact). See prime-claw-blw ledger.
> Disposition (owner): BLOCK accepted — B3-R classified in-scope slice-1 documentation-only review-rework

---

BLOCK — d8dbc5db96a6ddafbbaa61e2f450da7c6a62bf75

One material finding remains: B3 is only partially repaired. B1 and B2 are resolved. This is a Slice-1 review; no Slice-2/3 implementation is required to address the finding.

## B3-R — P2, confidence 10/10: The evidence still presents additive scope as demonstrated causal exclusion

**Evidence:** docs/evidence/2026-09-29-tier1-slice1-image-driver.md:115–118 labels this “Demonstrated”: “The Slice-1 diff cannot be the cause of the 6 failures … (demonstrated by the additive-only git status above).” The accepted B3 report explicitly prohibited presenting additive-only scope as universal causal proof. The diff establishes no direct changes to the existing plugin/probe code; it does not establish the causes of six historical failures or experimentally exclude every indirect effect. No per-failure trace or comparison supporting that categorical conclusion appears in the note.

The separation into Observations / Demonstrated / Hypotheses is useful, and :134–138 correctly qualifies the host-generation explanation. However, that qualification does not cure the contradictory absolute under Demonstrated. The statement at :144–147 that both failures and hang belong to a class tier 1 “eliminates by construction” should also remain an explicitly unresolved hypothesis, not a promised outcome of moving the tests. Filesystem/process isolation does not itself repair the unbounded reads documented at :125–130.

**Impact / violated invariant:** The acceptance record still overstates what was proved. A later slice can treat an unresolved failure as already excluded or cured rather than compare its actual outcome. This violates the accepted B3 evidence contract: observations, source-scope facts, demonstrated causes, and hypotheses must remain distinct.

**Root-cause seam:** A valid source-diff observation is still promoted into a blanket causal conclusion during evidence summarization. Adding category headings did not narrow the underlying assertion.

**Recommended repair direction and rationale:** Make this a documentation-only correction. Preserve the strong, verified fact that neither Slice-1 commit changes the existing plugin/probe code, but bound the conclusion to that fact. Leave the six per-test causes unresolved unless already-retained failure traces establish them. Distinguish preventing host contamination from fixing test/runtime defects. That provides an honest baseline for Slice 3 without reopening host investigation.

**Constraints / approaches to avoid:** Do not rerun host probes, refresh the host plugin, change plugin behavior, repair existing probe code, or add migration machinery to justify the narrative. Do not erase the observed host mismatch, six failures, owner intervention, or genuine unbounded-read hazards. Do not infer default-host plugin loading from an installed/native test name: all six cited tests use explicit repo extensions or a temporary plugin installation (reviewed-plan-extension :215–218/:528–531; oversight-native :21–23/:44–46; native-discovery :278/:294/:350/:374).

**Concrete acceptance checks:**
- Positive: each demonstrated statement has evidence of the same scope; unchanged source is documented as unchanged source. Each asserted cause has a specific failure trace and tested load path, or is clearly unresolved/hypothetical.
- Negative: no “cannot be caused” conclusion rests solely on additive scope; no default-host-generation attribution contradicts explicit-source/temp-install paths; no claim that container placement itself cures unbounded reads.
- Failure: preserve 6 failed / 307 passed, the operator intervention, and unknown causes when diagnostic evidence is absent.
- Replay: when the authorized container migration runs later, record whether each inherited failure persists. Do not assume that isolation fixes it. No new host replay is needed for this documentation repair.

**Regression risks:** Overcorrecting could conceal the real host mismatch or pipe hazards. Preserve them as observations/mechanisms, not established common causes. **Dependencies:** Repair the Demonstrated conclusion and nearby container-cure language together in this evidence note. B1/B2 code and documentation need no further functional change. No product decision or scope expansion is needed.

## Verified repairs and complete Slice-1 scope

- **Exact candidate:** HEAD and remote refs/heads/episode/plugin-test-container both equal d8dbc5db96a6ddafbbaa61e2f450da7c6a62bf75. Tracked working tree is clean. I read git show for both commits. Repair diff 47d2830..d8dbc5d changes only scripts/test-tier1.sh, tests/test_tier1_image.py, DEVELOPERS.md, and the evidence note. The combined candidate adds docker/test.Dockerfile and changes no other implementation files.
- **B1 resolved:** Help exits at scripts/test-tier1.sh:34; dry-run exits at :60; Docker readiness starts only at :65–66. Real build/run remain under set -euo pipefail, and OK follows successful smoke. The new recording/failing-Docker tests prove zero informational invocations, failure-stage short-circuiting, nonzero failures, and no OK on missing CLI/daemon/build/smoke failure.
- **Independent test results:** tests/test_tier1_image.py passed 17/17 with normal PATH, 17/17 with PATH=/usr/bin:/bin and an absolute Python interpreter, and 17/17 with DOCKER_HOST set to a nonexistent socket. Bytecode and pytest cache writes were disabled. Bash syntax passed. Two no-Docker --dry-run --rebuild executions both exited 0 with identical output and the expected --no-cache command. No tests were rerun after the infrastructure interruption.
- **B2 resolved:** DEVELOPERS.md:40–59 warns that unfiltered pytest still includes host probes and supplies file-level exclusions. I inspected all 11 selected files: they are static checks, mocked-boundary tests, synthetic watchdog processes, the Python-only wrapper test, and the new driver tests. They do not launch host Node/Prime Agent/plugin installation. The note correctly limits smoke to toolchain versions (:78–80). No markers, conftest, .env selector, test-all driver, or test migration was added. I checked the claimed gate by inspection rather than running the full host suite.
- **Image/driver:** Ubuntu 24.04, NodeSource 22.x, Python/pytest, no installed Postgres/gbrain/OpenShell stack; one docker run --rm; no host mounts or Prime Agent execution. Read-only Docker history matches the Dockerfile. BuildKit history independently records the test.Dockerfile build completed on 2026-09-30 06:21:02Z with 9/9 steps and 0 cached steps (ref 0b6ilyiui75ai65strs6wciac). The evidence records node v22.23.3 and successful smoke; I did not launch a new container.
- **B3 size correction resolved:** Current read-only docker image ls confirms 606MB for prime-claw-test-tier1:latest versus 5.17GB for prime-claw-brain:0.1.0.
- **Shared-base escape hatch:** The unchanged runtime Dockerfile derives from the OpenShell sandbox base and installs no Node. Deferring extraction avoids changing runtime behavior. Read-only Beads inspection confirms follow-up prime-claw-blw.4 exists and slice bead .1 has the accepted rework recorded.
- **Watchdog flake plausibility:** Neither commit touches tests/test_embedding_candidate_build.py or its subject bin/prime-claw. The named test uses one-second stall/poll/grace intervals and a two-second process-disappearance check (:139–183); timing sensitivity is plausible. This supports “unchanged code / plausible timing flake,” not independent proof of the historical cause.
- **Boundary:** No Slice-2/3 implementation, plugin source change, runtime Dockerfile change, or run-prime-agent-probe.sh change is present. The evidence retains the historical, pre-restriction full-suite run; the repair records tier-0 checks only. Git alone cannot certify which commands were historically executed. This review ran no live Prime Agent probes, builds, containers, host-plugin apply/check, edits, lifecycle actions, or cleanup.
- Personal-brain keyword/hybrid lookup found no relevant test-container context. Findings rely on the approved bundle, exact source, accepted prior report, and the checks above.

## Review evidence imported from `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice2-470be98-expert-block.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`

# EXPERT review — slice-2 candidate 470be98 — BLOCK (3 findings: stale-source replay, weak probe acceptance, soft probe deadline)

> Reviewer: expert-reviewer-blw2-470be98 (rlm child sub-e46c4fb5)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated)
> Exact commit: 470be987dd33a0a374ab33296499b6c4d89fc994 (episode/plugin-test-container)
> Packet: agentmsg_cb1ff3ff | Report arrived via agent_message reply; preserved verbatim below
> Disposition (owner): BLOCK accepted — all three findings classified in-scope slice-2 review-rework

---

BLOCK — 470be987dd33a0a374ab33296499b6c4d89fc994

Three material findings remain in Slice 2. The observed happy-path installs are corroborated, and the host isolation boundary is intact. The defects concern source replay correctness and the new probe's acceptance/termination behavior. No product decision or Slice-3 implementation is needed to repair them.

## B1 — P2, confidence 10/10: Source mode can silently test stale compiled code

Evidence: scripts/test-tier1.sh:162–170 runs `npm run build` only when at least one of four `dist` directories is absent. If all exist, :172–181 packs and installs them without checking whether they represent the selected checkout. `--rebuild` only disables the Docker image cache; it does not change this behavior.

I independently inspected the selected fork at a1faacd53ac4473a75de1d434afaf50945c2f647. Its scripts/pack-prime-agent-release.mjs:151–157 checks that dist exists, :217–223 copies existing dist, and :338–347 packs it. The staged package scripts retain only postinstall (:182–196), so npm pack does not secretly rebuild the source. A version match is not a freshness check; multiple changes can share version 0.9.8.

Bounded reproduction: an instrumented source-mode fixture supplied four existing dist directories, an old compiled marker, and recording Docker/node/npm substitutes. The pack substitute models the real packer's copy-existing-dist behavior. Run A returned 0/OK without invoking npm build. After changing the source marker to B, replay again returned 0/OK and packed the same old marker. Calls were info → Docker build → pack → Docker run, with no host npm build in either run. This proves the driver's selection branch; the real packer inspection establishes why it matters. It does not claim that the retained happy-path acceptance run used stale code.

Impact / violated invariant: PRIME_AGENT_SOURCE must exercise the chosen fork checkout. After a source edit or branch change, this driver can validate an older implementation while reporting success. That defeats the source-install path's central purpose.

Root cause: directory existence is used as a cache-validity test at the source-to-release boundary. Current tests exercise source dry-run, not a real source-mode replay through this branch.

Repair direction and rationale: ensure every real source run packs fresh artifacts representing the selected checkout, or fail closed when that cannot be established. A simple fresh build before packing fits the approved dumb-driver design better than a new caching system. Preserve host-side packing and container-side installation.

Constraints / avoid: do not use version equality, directory existence, or Docker --rebuild as proof of source freshness. Do not reuse macOS node_modules in Linux, install the fork into the host harness, introduce a general build cache, or migrate Slice-3 tests early.

Concrete acceptance tests:
- Positive: fresh checkout/build artifacts produce the expected package and container version.
- Negative/replay: with all dist directories present, change source without changing package version; the next run must package the changed implementation, not the previous marker. Cover removed/renamed source outputs too.
- Failure: compilation or packing failure must stop before container installation, return nonzero, and never report OK or fall back to previous artifacts.
- Informational replay: source --dry-run must still perform no build, pack, or Docker call.

Regression risks: build latency, assumptions about host build dependencies, stale outputs surviving an incremental build, and accidental execution on informational paths.

Dependencies: repair driver behavior and source-mode regression coverage together; refresh source acceptance evidence. The plan's "Fork pack reproducibility" contract also requires the exact pack command and output hash. The committed note lists filenames but omits artifact hashes. The retained primary tarball currently hashes to 4558b8220361a310a6ceebaab7c006047c5845cad3a782acd7a4efaa0347c5df, and the complete four-file SHA256SUMS exists in the fork's release/tier1/artifacts directory. Record the hashes of the newly accepted artifacts durably with the refreshed evidence.

## B2 — P2, confidence 10/10: --probe returns success without proving that the plugin loaded

Evidence: scripts/test-tier1.sh:187–195 only pipes get_commands into Prime Agent and checks process exit status. It never checks the matching RPC response's success, the required commands, or their installed paths. tests/test_tier1_driver.py:49–54 checks only text and the timeout spelling. The plan explicitly uses the existing live-loader pattern, whose tests/test_handoff_chain_extension.py asserts response success, command presence, and source provenance.

I captured the exact generated --probe command through a recording Docker substitute, then executed its unchanged probe fragment in the actual test image with a synthetic prime-agent executable and networking disabled. All three cases exited 0: (1) no response, (2) a matching get_commands response with success:false, and (3) success:true with commands:[]. No real Prime Agent process ran. The selected fork's rpc-mode.ts also confirms RPC errors are returned as JSON independently of normal process shutdown (:475–489), while get_commands returns its command list (:426–433).

Impact / violated invariant: a loader/API compatibility failure can look green. Copy/check proves installed bytes, not that Prime Agent registered handoff, plan, and implement-spec. The Slice-2 native-command acceptance contract is therefore not enforced by the advertised probe.

Root cause: transport/process completion is treated as semantic RPC success at the install-to-runtime-validation boundary.

Repair direction and rationale: validate the matching get_commands reply and the required native command registrations/provenance before declaring the probe successful. Keep this a small container-side check, not a new test harness. The normal acceptance log already shows the exact expected command names and /root/.prime/agent/extensions paths.

Constraints / avoid: do not grep arbitrary stdout for command names, accept unrelated asynchronous events as the reply, infer load success from apply/check, touch the host plugin, or change plugin behavior merely to make the probe green.

Concrete acceptance tests:
- Positive: one matching success response contains handoff, plan, and implement-spec, each once and from the container's installed extension paths.
- Negative: missing reply, malformed JSON, success:false, empty/partial/duplicate command lists, or wrong source paths must fail nonzero with no final OK.
- Failure: preserve diagnostics and fail on process error or timeout; handle unrelated JSONL events without falsely accepting them.
- Replay: the same valid installed generation passes repeatedly; a fixture that stops registering a command fails the next run.

Regression risks: confusing asynchronous events with the requested response, brittle assumptions about response ordering/version metadata, and introducing unbounded output reads.

Dependencies: repair with new behavioral coverage and refreshed probe evidence. Coordinate with B3 so semantic validation does not introduce another blocking read. The retained successful source probe is valid evidence; this finding concerns the missing negative acceptance behavior, not a claim that that run failed.

## B3 — P2, confidence 10/10: The claimed hard probe deadline is only a cooperative TERM timeout

Evidence: scripts/test-tier1.sh:190–191 calls `timeout 60` with no forced-kill escalation. GNU timeout sends TERM at the deadline and then waits if the child does not terminate. I verified this in the actual test image, networkless and without mounts or Prime Agent: a synthetic process ignored SIGTERM and completed after 1 second; `timeout 0.1` returned only after 1.018 seconds (exit 124), not at its 0.1-second deadline. An indefinitely stuck process with the same signal behavior has no hard bound.

This is relevant to the selected runtime, not just a shell curiosity: fork rpc-mode.ts:185–205 handles SIGTERM through asynchronous shutdown and awaits connection disposal. Container placement does not guarantee that shutdown completes. The existing accepted slice-1 evidence expressly warns that moving a probe does not itself cure hangs.

Impact / violated invariant: --probe can leave the driver and its one ephemeral container waiting indefinitely after the stated 60-second deadline. This violates the new probe's hard-deadline contract and the recorded slice-1 liveness lesson.

Root cause: the probe timeout controls the first termination signal but not the terminal process/container outcome.

Repair direction and rationale: retain a bounded normal deadline and add a finite forced-termination escalation for the owned probe process tree, ensuring the container command exits nonzero and --rm can complete. Use the existing container boundary and standard timeout facilities rather than a new supervisor framework.

Constraints / avoid: do not merely lengthen the timeout, rely on cooperative shutdown, kill host Prime Agent processes, add multiple suite containers, or repair/migrate the unrelated historical host probes in this slice.

Concrete acceptance tests:
- Positive: a normal probe finishes and preserves its successful result.
- Negative/failure: a silent or partial-output child that ignores TERM, plus a descendant holding output open, must terminate within deadline plus a small fixed grace; return nonzero and no OK.
- Replay: repeat that failure and then a good run; no owned container or probe process remains after each run. Scale test deadlines down rather than waiting 60 seconds for each case.

Regression risks: premature termination of normal shutdown, losing useful diagnostics, or incomplete descendant cleanup. Dependencies: coordinate with B2 and test the generated container-side command, not only its textual spelling.

## Verified contracts and evidence

- Exact identity: worktree HEAD, tracking ref, and live `git ls-remote origin refs/heads/episode/plugin-test-container` all equal 470be987dd33a0a374ab33296499b6c4d89fc994. Worktree remained clean. `git diff --check main...HEAD` passed.
- Total scope is correct: .env.example, promoted/corrected .ralph plan/spec, DEVELOPERS.md, docker/test.Dockerfile, scripts/test-tier1.sh, the two new tier-1 infrastructure test files, and the two evidence notes only. No plugin source, runtime Dockerfile, or run-prime-agent-probe.sh changes. pytest.ini, pyproject.toml, tests/conftest.py, and scripts/test-all.sh are absent. No test migration occurred.
- Rebase claim verified: 2666843 is resolvable. The requested `git diff 2666843 b2f6b86 -- docker/ scripts/ tests/ DEVELOPERS.md docs/evidence/2026-09-29-tier1-slice1-image-driver.md` is empty. d0a9883..1a0836d consists of the three stated review-report commits.
- Selection/isolation: .env.example is tracked; .env is ignored and untracked. Validation precedes Docker. Exactly-one selection, missing file, absolute/existing source directory, and pack-script presence checks are present. One mutually exclusive docker run --rm path executes. The install path mounts the repo read-only at /workspace, plus source artifacts read-only when selected. It passes no host home or plugin-root override. Unchanged apply/check therefore operate on /root/.prime/agent inside the container. --smoke preserves toolchain-only behavior.
- Vendor correction is substantively correct and recorded in the Slice-2 deliverable paragraph. bin/prime-claw uses the same installer URL and relevant environment controls. Read-only HTTP checks returned 404 for the public npm package and 200 for install.sh; the installer honors the version and verifies checksums. Minor wording debt remains in the plan's earlier "pinned-registry path" and later "registry install" phrases; these should follow the recorded correction.
- Retained /tmp/tier1-source-run.log and /tmp/tier1-source-run2.log corroborate the initial build, rejected external staging path, corrected file: staging, four artifacts, 273-package container install, version 0.9.8, in-container apply/check, and successful get_commands registrations sourced from /root/.prime/agent/extensions. The current fork hash is a1faacd53 and version 0.9.8. I inspected all four retained tarballs: their versions and internal file:///stage/releases/v0.9.8 dependencies match the note, and their actual SHA256 values match SHA256SUMS.
- /tmp/tier1-pinned-run.log corroborates the vendor download/checksum verification, 190-package install, version 0.9.3, and in-container apply/check success. I did not repeat either networked installation.
- All three retained host checksum captures are byte-identical. All nine managed files still match them, including handoff-chain.ts = debd42d40ba1c9a9ba23607c0e2f25e8505e6ef640cedfb62d8bffbe8d61ceb6. Fresh before/after hashes during this review also match.
- Focused pytest, with bytecode/cache writes disabled: 30 passed normally (4.00s); 30 passed with PATH=/usr/bin:/bin and Docker absent (4.20s); 30 passed with an unreachable DOCKER_HOST (4.41s). Bash 3.2 syntax passed. No-Docker help, smoke dry-run+rebuild, and missing-env fail-fast behaved correctly. Recording/failing-Docker tests meaningfully enforce B1's zero informational Docker calls and real-run failure propagation.
- The documented tier-0 selection collects exactly 174 tests. I did not rerun the full gate or the full host suite, so the historical 174-pass outcome remains recorded evidence, not my own fresh result. Neither slice changes tests/test_embedding_candidate_build.py or its subject bin/prime-claw. The watchdog's one-second intervals support timing sensitivity; unchanged scope alone does not prove a historical failure's cause.
- The image remains 606MB versus the runtime image's 5.17GB. The unchanged slim Dockerfile and permitted shared-base deferral remain consistent with accepted Slice 1.

Review boundaries: no repository edits, Git mutations, host Prime Agent/RPC probes, host plugin changes, episode/lifecycle actions, or external cleanup. Additional checks used temporary synthetic fixtures and two automatically removed, networkless test-image containers, not real Prime Agent sessions. No test container remains. Personal-brain access failed; conclusions use the exact approved packet, repository/runtime source, retained logs/artifacts, and the checks above. This report is not merge authority.

## Review evidence imported from `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice2-bc00cba-expert-pass.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`

# EXPERT review — slice-2 reworked candidate bc00cba — PASS

> Reviewer: expert-reviewer-blw2-bc00cba (rlm child sub-0935580a)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated post-restart)
> Exact commit: bc00cba08b108e61fac4b8c97c25795773b8b1c8 (episode/plugin-test-container)
> Packet: agentmsg_1e2f86e7 | Report arrived via agent_message reply; preserved verbatim below
> Prior rounds: 47d2830 BLOCK, d8dbc5d BLOCK, 2666843 PASS (slice 1); 470be98 BLOCK (slice 2)
> Disposition (owner): PASS accepted — slice-2 candidate accepted; advancing to slice 3

---

PASS — bc00cba08b108e61fac4b8c97c25795773b8b1c8

No material finding remains in this Slice-2 reworked candidate. I read the preserved 470be98 BLOCK report first, then independently checked the approved bundle, complete repair diff, implementation, tests, selected fork's packer/runtime source, and retained evidence. This verdict covers Slices 1–2 only. It is not merge authority or approval of Slice 3.

## Exact identity and scope

- HEAD, the tracking ref, and live `git ls-remote origin refs/heads/episode/plugin-test-container` all equal bc00cba08b108e61fac4b8c97c25795773b8b1c8. The worktree remained clean.
- `git diff 470be98..bc00cba --stat` changes exactly the four authorized files: scripts/test-tier1.sh, tests/test_tier1_driver.py, the Slice-2 evidence note, and .ralph/plans/EXECUTION_PLAN.md. The plan change is only the two sanctioned vendor-installer wording corrections.
- No plugin-source behavior, runtime Dockerfile, host probe wrapper, tier markers, conftest, test migration, or unified test driver changes were added. `git diff --check 470be98..bc00cba` passed.

## B1 resolved — fresh source staging

- scripts/test-tier1.sh:245–283 executes readiness → source staging → image build. Every real source run removes all four pack-consumed dist directories and unconditionally builds before packing. Container execution comes afterward. Build/pack failure exits before image build or installation; there is no fallback or reachable final OK.
- I inspected the actual fork packer: it consumes those four dist trees, wipes its release output directory, and packs the resulting staged content. The selected fork remains clean at a1faacd53ac4473a75de1d434afaf50945c2f647, version 0.9.8.
- The behavioral tests passed for existing stale dist, removed-output cleanup, marker A → B without a version change, and build/pack failures. Source dry-run records zero npm/node/Docker calls. I also ran the real selected-checkout dry-run with Docker absent from PATH; it performed no build or pack.

## B2 resolved — semantic RPC acceptance

- The shipped validator requires one matching id=loader/type=response/command=get_commands reply, success exactly true, and handoff/plan/implement-spec each exactly once with container extension-path provenance.
- The tests execute the exact embedded validator, not a separate imitation. Valid responses and valid responses surrounded by unrelated events pass. Missing replies, malformed JSON, false success, empty/partial/duplicate required commands, host-style source paths, duplicate replies, wrong reply IDs, and events without a matching reply fail. Unknown additional commands do not incorrectly fail a valid result.
- The generated command writes probe stdout/stderr to regular files, waits for the timeout-controlled process to exit, checks its status, then invokes the validator on the captured file. No new probe-output pipe read was introduced. The small base64 transport carries validator source, not live probe output.

## B3 resolved — forced deadline and replay

- The generated command contains GNU timeout with `--kill-after`, defaults 60s + 5s, and supports the documented test scaling. I captured its full argv and confirmed that the 4s + 2s probe step is byte-identical to the retained demonstration.
- I independently replayed the networkless in-image TERM-ignoring parent plus TERM-ignoring descendant fixture twice. Both produced probe exit 137, container rc=1, and no OK. End-to-end wall times were 7.75s and 8.54s including container startup; the latter ran alongside other synthetic controls. A subsequent good replay passed in 1.30s.
- Additional full generated-command controls used synthetic install/version/apply/check/Prime Agent executables inside networkless containers. The positive passed; each prerequisite failure returned nonzero with no final OK.
- Every review container used --rm and no host mounts. Final Docker inspection showed no tier-1 image containers remaining. No real Prime Agent process or session was started by this review.

## Evidence-note verification

- Retained rework source/pinned logs corroborate fresh compilation and packing, versions 0.9.8/0.9.3, in-container apply/check, semantic validator OK, and final driver OK. I did not repeat the networked installations or mutate the source checkout.
- The recorded exact pack command matches the driver. All four current tarball SHA256 values match both the committed table and SHA256SUMS. The primary is 4558b8220361a310a6ceebaab7c006047c5845cad3a782acd7a4efaa0347c5df, also matching the prior review's pre-rework fingerprint. These checks corroborate the retained reproducibility evidence; this review did not itself rebuild the fork.
- The two rework-window host checksum captures are byte-identical. Current managed-file hashes and absence state still match them. Fresh before/after hashes during my review also match.
- The earlier-baseline delta is exactly the removed goal-blocker-control.ts and changed spec-episode.ts. The note honestly separates that earlier delta from the unchanged rework window and attributes it to the operator's announced plugin update/restart. The hashes prove the bounded window, not independent causation of the earlier update.
- The documented tier-0 selection collects exactly 194 tests. Its historical 194-passed/18.52s result remains recorded acceptance evidence, not a fresh full-gate result from this review. I independently reproduced the focused 50-test result below.

## Independent bounded checks

Using the documented host Python with bytecode/cache writes disabled:
- Focused driver + image tests: 50 passed, normal PATH (10.95s).
- Same tests with PATH=/usr/bin:/bin: 50 passed (10.76s), no skips.
- Same tests with an unreachable DOCKER_HOST: 50 passed (9.73s).
- Bash 3.2 syntax check passed.
- No-Docker help, smoke dry-run/rebuild, pinned dry-run/probe, and source dry-run/probe passed. The recording/failing-Docker tests still enforce zero informational calls and real-run failure propagation.

Review boundaries: no repository edits, Git mutations, host RPC probes, full host suite, host-plugin changes, lifecycle actions, or external cleanup. Synthetic fixtures/results were retained outside the repositories at /var/folders/4_/twy0wz3s1mq650wnqzn1b8rr0000gq/T/tier1-review-bc00cba-xowpl1k5. The personal brain was unavailable; conclusions use the exact packet, repository/runtime source, retained artifacts, and checks above.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: episode bootstrap generation healthy. Slice 1 work verified in worktree (test.Dockerfile, test-tier1.sh, test_tier1_image.py, evidence note); episode waiting on host pytest suite (slow due to pre-migration host RPC probes). Shared-base extraction correctly deferred to blw.4 per spec escape hatch. agent_observe.recent_messages fails for sibling sessions (Unknown active session) — worktree evidence used as fallback.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight audit 2026-09-30 (operator asked whether host suite run needed correction): all 5 live-probe test files verified to use guarded isolation (--offline --no-session --no-extensions; 3 also redirect PRIME_AGENT_CODING_AGENT_DIR or use run-prime-agent-probe.sh). No settings/session mutation vectors present. Run is slow (~10min, repeated prime-agent spawns) but safe. Verdict: no mid-flight correction; slice 3 container migration is the durable fix. Operator offered optional standing instruction to skip live RPC probes in host gates for remainder of episode.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~23:20: operator delegated sibling management overnight ('The sibling is yours to manage'). Owner authority overnight: reconcile reports, EXPERT-gate each pushed candidate, advance slices 1->2->3 via handoff_spec_episode per accepted evidence, in-scope revise. WITHHELD pending operator: merge/abandon/cleanup/scope decisions; any consult/pause trigger (blocker, conflicting evidence, product question) parks the episode for morning. Standing instruction delivered to episode: skip live RPC probes in host-side gates for rest of episode (agentmsg_60dadfa6). Watch cb3edf77 armed.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-29 23:50: episode pytest gate DEADLOCKED ~30min. Root cause: test_reviewed_plan_extension.py::test_installed_rpc_characterizes_confirmed_steer_lifecycle_order spawned an RPC probe (node 47683, tsx --mode rpc --offline --provider probe) that went idle and orphaned (PPID 1); pytest blocked in read() on its stdout pipe. Owner killed ONLY the orphan -> pytest unblocked with a truthful test failure. Episode notified (agentmsg_6160029a): treat failure as infra hang, investigate, and per standing instruction skip live RPC probes in future host gates. This hang is exactly the host-coupling class tier 1 eliminates.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 00:05: slice-1 candidate 47d2830 reconciled (commit/push/blw.1-close/files all verified; owner re-ran 9/9 tier-0 green). EXPERT gate in flight: fresh expert-reviewer-blw1-47d2830 (sub-d5400031), model openai-codex/gpt-6-astra, thinking max, packet agentmsg_14120c94. Awaiting PASS/BLOCK. Host note for operator: global plugin install is a generation behind main (goal-heartbeat vs goal-blocker-control) — apply+restart needed at keyboard time, not overnight.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate disposition (slice-1 candidate 47d28309315133821d857c38fe6eb4bcd14a8643): BLOCK accepted. Reviewer expert-reviewer-blw1-47d2830 (sub-d5400031, session 01a0f11c-4e60-73b9-a5c9-6e6d9058a688), model openai-codex/gpt-6-astra, thinking max, packet agentmsg_14120c94. Report preserved at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-47d2830-expert-block.md (main commit b861dfd). Findings B1/B2/B3 all classified in-scope slice-1 review-rework; routing revise via handoff_spec_episode. Reviewer retired after report preservation. Fresh EXPERT gate required on the repaired candidate (47d2830 review invalidated by repair).
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~00:45: slice-1 REWORK candidate d8dbc5db96a6ddafbbaa61e2f450da7c6a62bf75 reconciled. Owner-verified: origin match; diff 47d2830..d8dbc5d scoped to exactly the 4 allowed artifacts; 17/17 test_tier1_image green WITH docker and WITH PATH stripped (B1 negative-env acceptance re-proven by owner); DEVELOPERS.md bounded tier-0 command present (B2); evidence note restructured Observations/Demonstrated/Hypotheses + 606MB-vs-5.17GB correction (B3); blw.1 rework comment present. Fresh EXPERT gate in flight: expert-reviewer-blw1-d8dbc5d (sub-9f31b642), openai-codex/gpt-6-astra @ max, packet agentmsg_ef3f8d51, watch ed787e3d armed. Rework watch eb48f8ca cancelled on reconciliation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~01:45: EXPERT gate #2 (candidate d8dbc5d) PARKED on ambiguous reviewer state. Reviewer expert-reviewer-blw1-d8dbc5d (sub-9f31b642, session 01a0f139-2bb4-762e-bba5-c3c03862cec3, openai-codex/gpt-6-astra @ max, packet agentmsg_ef3f8d51): verified real work (read BLOCK report, ran 17-test suite in both docker/no-docker envs, 11-13 tool calls), then entered a single model generation that has been open 46+ min with zero new persisted messages (session jsonl mtime 45.7min stale, messageCount flat at 26) while isStreaming=true. Cannot distinguish hung provider stream from very long max-thinking composition. Per protocol: NOT confirmed terminal -> no replacement, no nudge (steer-disruption risk), reviewer left intact; gate watch ed787e3d cancelled; pause-and-ask-operator. If the reviewer reply ever arrives it wakes the owner via fast path and the gate resumes. Checkpoint memory recorded. Operator morning options: (a) wait, (b) if reviewer confirmed dead by morning (session gone/stream closed), admit exactly one replacement per the exception, (c) any other instruction.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 morning: gate-2 stall root cause was a HUNG BASH COMMAND (~7h) in the reviewer session, not a model-generation hang. Operator nudged the reviewer session directly ('That bash command hung for like 7 hours'); reviewer resumed immediately (streaming, active). Owner did not double-nudge (steer-disruption risk on a live turn). Gate watch re-armed (expert-gate-watch:blw1-d8dbc5d-resumed). Lesson folded into child-liveness memory: check for hung child subprocesses; isStreaming cannot discriminate hang vs long generation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 morning (cont): reviewer stall reconciled as model/provider stream-layer hang (harness state isStreaming=true, activity=model, no persisted messages 46+min after last toolResult ~01:00 UTC), NOT a hung bash — reviewer verified all 7 command handles exited 0 (longest 4.4s). Operator nudge forced a new turn and unstuck the session. Owner sent harness-level clarification (agentmsg_2f69109f) resolving the reviewer's 'which command hung?' question; review resumed (streaming confirmed). Reviewer verification evidence intact and matches owner runs. Harness bug signal noted for operator: UI showed hung bash while child handles were clean; 7h stuck streaming turn with no watchdog.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate #2 disposition (rework candidate d8dbc5db96a6ddafbbaa61e2f450da7c6a62bf75): BLOCK accepted. Reviewer expert-reviewer-blw1-d8dbc5d (sub-9f31b642, session 01a0f139-2bb4-762e-bba5-c3c03862cec3), openai-codex/gpt-6-astra @ max, packet agentmsg_ef3f8d51. Report preserved at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-d8dbc5d-expert-block.md (main commit 3d988e5). B1/B2 verified resolved; single remaining finding B3-R (evidence note: additive scope still presented as demonstrated causal exclusion; 'eliminates by construction' must become hypothesis). Classified in-scope documentation-only review-rework; routing revise via handoff_spec_episode. Reviewer retired after preservation. Fresh EXPERT gate required on the repaired commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: FULL STOP executed per operator instruction (host plugin update + harness restart). Final state: episode holding at 2666843 (pushed, origin-verified, worktree clean — confirmed by both owner reconciliation and episode state-confirmation). All watches cancelled (none remain); no subagents running (both EXPERT reviewers retired after report preservation). PENDING AFTER RESTART: fresh EXPERT gate on EXACT commit 2666843 (not d8dbc5d — stale); PASS -> slice-2 advance (blw.2) via handoff_spec_episode; BLOCK -> in-scope revise. Merge/abandon authority: operator only. Resume checkpoint memory updated (prime-claw-slice1-expert-block-47d2830-rework-in-flight).
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 post-restart resume: harness restarted for the operator plugin update; oversight state survived (skill package re-supplied, identity intact). Verified: episode present/holding, worktree unchanged at 2666843 (clean, origin in sync). EXPERT gate #3 opened on the complete slice-1 candidate 2666843: fresh reviewer expert-reviewer-blw1-2666843 (sub-e050b4f4), openai-codex/gpt-6-astra @ max, packet agentmsg_eda4e7f9 (delivered once), watch 002ff4ea armed with the updated stall policy (flatline detector + nudge-at-threshold). Awaiting PASS/BLOCK.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate #3 disposition (slice-1 FINAL candidate 2666843426734a82147e5a8fe965b58754c96ac5): PASS accepted. Reviewer expert-reviewer-blw1-2666843 (sub-e050b4f4, session 01a0f31c-15b2-70ef-944b-f7469f9068f4), openai-codex/gpt-6-astra @ max, packet agentmsg_eda4e7f9. Report preserved at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-2666843-expert-pass.md (main commit 1a0836d). All prior findings (B1/B2/B3/B3-R) verified resolved; complete slice-1 acceptance met; independent verification 17/17 in three Docker environments. SLICE 1 ACCEPTED. Advancing to slice 2 (blw.2). Reviewer retired after preservation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: slice-2 candidate 470be987dd33a0a374ab33296499b6c4d89fc994 reconciled. Owner-verified: origin match; diff 9f68beb..470be98 scoped to exactly the expected files (.env.example, EXECUTION_PLAN.md npm-correction, DEVELOPERS.md, slice-2 evidence note, test-tier1.sh, test_tier1_driver.py, test_tier1_image.py); no plugin source, no slice-3 work; owner re-ran 30/30 tier-0 tests green; host-untouched claim spot-verified (live ~/.prime/agent/extensions/handoff-chain.ts sha256 debd42d4... matches the note exactly); .env gitignored; blw.2 closed. Noted: branch was rebased onto origin/main 1a0836d at slice-2 start (slice-1 PASSed commit 2666843 -> content-identical b2f6b86) — final gate must review the final exact commit, not 2666843. Fresh EXPERT gate in flight: expert-reviewer-blw2-470be98 (sub-e46c4fb5), openai-codex/gpt-6-astra @ max, packet agentmsg_cb1ff3ff, watch c2fd9d12.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate disposition (slice-2 candidate 470be987dd33a0a374ab33296499b6c4d89fc994): BLOCK accepted. Reviewer expert-reviewer-blw2-470be98 (sub-e46c4fb5, session 01a0f343-61fc-77d0-b361-307edcd3bc4b), openai-codex/gpt-6-astra @ max, packet agentmsg_cb1ff3ff. Report preserved at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice2-470be98-expert-block.md (main commit 0389d80). Three P2 findings, all classified in-scope slice-2 review-rework: B1 source mode can silently pack stale compiled dist dirs (existence used as freshness); B2 --probe checks process exit not RPC reply content (3 false-positive cases demonstrated); B3 probe deadline is TERM-only cooperative timeout (no -k escalation) — the slice-1 pipe-deadlock lesson resurfacing. Routing revise via handoff_spec_episode. Fresh EXPERT gate required on the repaired commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: SECOND FULL STOP executed per operator instruction (plugin update #2 + harness restart). Final state: episode holding at bc00cba08b108e61fac4b8c97c25795773b8b1c8 (pushed, origin-verified, owner-reconciled: B1/B2/B3 repairs verified in diff, 50/50 owner re-run green, host checksum unchanged). All watches cancelled; no subagents; hold note agentmsg_cbaa2f64 delivered. PENDING AFTER RESTART: fresh EXPERT gate on EXACT commit bc00cba; PASS -> slice-3 advance (blw.3); merge/abandon = operator only. Resume checkpoint memory updated.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 post-restart-#2 resume: oversight state survived (skill re-supplied, kernel state restored). Verified: episode present/idle (new activeSessionId c9cc6537a0e6), worktree unchanged at bc00cba (clean, origin in sync), no watches/subagents. EXPERT gate opened on the reworked slice-2 candidate bc00cba08b108e61fac4b8c97c25795773b8b1c8: fresh reviewer expert-reviewer-blw2-bc00cba (sub-0935580a), openai-codex/gpt-6-astra @ max, packet agentmsg_1e2f86e7 (delivered once), watch armed with stall policy. Awaiting PASS/BLOCK.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate disposition (slice-2 REWORKED candidate bc00cba08b108e61fac4b8c97c25795773b8b1c8): PASS accepted. Reviewer expert-reviewer-blw2-bc00cba (sub-0935580a), openai-codex/gpt-6-astra @ max, packet agentmsg_1e2f86e7. Report preserved at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice2-bc00cba-expert-pass.md (main commit a6a55bc). B1/B2/B3 all verified resolved with independent in-image replays (TERM-ignoring tree killed at deadline+grace, exit 137; validator negatives all fail; fresh-build replay packs current source). Reviewer independently reproduced 50/50 in three Docker environments. SLICE 2 ACCEPTED. Advancing to slice 3 (blw.3 — final slice). Reviewer retired after preservation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~13:50: found and reaped a 16-hour-old LEAKED process from the recorded pre-existing flake: pid 34153, orphaned bash stall-target from test_candidate_progress_watchdog (pytest-tmp/.../test_candidate_progress_watchd2/signal-sync.pid, trap exit-143-on-TERM, sleep loop). Physical confirmation of the flake mechanism: the watchdog under test failed to reap its stall target within the test's 1s/2s windows, the test flaked, and the synthetic fixture leaked onto the host. Harmless (sleep loop) but exactly the host-pollution class tier-1 containers eliminate by construction. Killed with TERM (clean exit 143). Recorded for the slice-3 evidence trail.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~14:35 (slice-3 watch run#8): branch rebased a SECOND time onto current main tip 9b3edd2 (which merged episode/goal-heartbeat-work-control — the h6w.24 plugin work landed on main mid-slice-3). Verified: a6a55bc still an ancestor; tree diff 00feb56->9751447 = main's h6w.24 content (goal-heartbeat-work-control.ts plugin source + tests, incl. test_goal_heartbeat_work_control_extension.py replacing test_goal_blocker_control_extension.py). The episode is migrating the NEW goal-heartbeat test into the tier-1 suite — the plan's merge-reconciliation mechanism working as designed. Slice-3 commit d040c02 exists locally (markers + conftest fixture + migration + test-all.sh + evidence note, 10386B); NOT yet pushed (ahead 17/behind 7 vs origin). Container verification run in progress. FINAL-GATE NOTE: the goal-heartbeat plugin source comes from main via rebase, NOT authored by the episode; the final reviewer must be told the branch was twice-rebased and which content is main's.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Slices 1-3 complete: blw.1 (image+driver, EXPERT PASS 2666843≡b2f6b86), blw.2 (install selection + apply/check, EXPERT PASS bc00cba), blw.3 (markers + session fixture + migration + sequencer, awaiting EXPERT gate on d040c02..7118a44). blw.4 (shared-base extraction) remains deferred P2.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~15:00: slice-3 completion report (7118a44) reconciled — push verified, tier-0 gate owner re-run matches claim (223 passed/144 skipped), stale-assertion repair verified against 376bc2b contract (assert_creation_trace now asserts followUp+queueIfBusy on handoff+execute, matching the reviewed plugin change). TERMINAL-POLICY GAP: promoted bundle (.ralph/plans/SPECIFICATION.md + EXECUTION_PLAN.md) not archived — the execute skill requires archival to .ralph/plans/archive/<bundle>/ + README index update as the episode's readiness claim. Routing in-scope archival repair; final EXPERT gate follows on the archival-complete candidate. Epic stays in_progress until operator merge decision.
---

author: Joe Landers
created: 2026-10-12 01:02
---
TERMINAL-POLICY ARCHIVAL TASK (operator-directed, 2026-09-30; execute pass after this handoff): the plan is finished (slices 1-3 done, blw.1/blw.2/blw.3 closed) but the promoted bundle is still active. Archive it: (1) move .ralph/plans/SPECIFICATION.md + EXECUTION_PLAN.md into new .ralph/plans/archive/plugin-test-container/; (2) move the 5 review reports from .ralph/plans/future/plugin-test-container/reviews/ into the same archive subfolder and remove the emptied future/plugin-test-container/ folder — do NOT touch the other future bundles (phase3a-brain-hosting-completion, universal-agent-project-conversation-poc); (3) update .ralph/plans/archive/README.md with a coherent plugin-test-container index entry: what was delivered (three-tier test architecture + tier-1 container), acceptance-evidence pointers (docs/evidence/2026-09-29-tier1-slice1-image-driver.md, docs/evidence/2026-09-30-tier1-slice2-install-selection.md, docs/evidence/2026-09-30-tier1-slice3-migration-sequencer.md), and the EXPERT review trail (slice 1: BLOCK 47d2830 -> BLOCK d8dbc5d -> PASS 2666843; slice 2: BLOCK 470be98 -> PASS bc00cba); (4) repair relative links (bundle-internal cross-references + inbound links from docs/); (5) re-run the tier-0 gate (python3 -m pytest tests/ -q — must stay green; proves no test reads the moved .ralph/plans paths); (6) record in the slice-3 evidence note why DEVELOPERS.md satisfies the execute skill's docs-conversion step (the approved plan named DEVELOPERS.md as the doc home), or add a docs/ page if judged necessary. CONSTRAINTS: file moves + index + links + evidence-note record only; no test/code behavior changes; no plugin source changes. Commit+push; report the new exact commit hash to the owner sibling (01a0f0d6-b639-74be-ab78-a58b058236c7). After archival, the owner runs a fresh FINAL EXPERT gate on the complete exact candidate.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~15:10: THIRD FULL STOP executed per operator directive (plugin reload). State: HEAD 7118a44 pushed and safe; episode had STAGED the archival plan-file moves (uncommitted, recoverable either way) when the stop landed; stop note agentmsg_3166554a queued (hold at 7118a44, confirm after reload); watch abdc185e cancelled; no subagents. Resume: complete-or-restore the staged archival -> final EXPERT gate on the complete exact candidate -> merge-readiness to operator. Epic stays in_progress until merge decision.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: terminal archival at c53972ff35488d23efdbf975e67006b451281931 RECONCILED. Owner-verified: push; diff = 7 pure renames + archive README index + DEVELOPERS/evidence link repoints ONLY (no test/code/plugin changes); archive bundle has spec+plan+all 5 EXPERT reports; future/plugin-test-container removed; links resolve; owner tier-0 re-run after moves 223 passed/144 skipped (flake did not recur). Terminal-policy requirement satisfied per oversee step 9. Next: FINAL EXPERT gate on the complete exact candidate c53972f.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: FINAL EXPERT gate opened on the complete candidate c53972ff35488d23efdbf975e67006b451281931. Reviewer expert-reviewer-final-c53972f (sub-37c638a0), openai-codex/gpt-6-astra @ max, packet agentmsg_a3b164d1, watch armed. OWNER VERIFICATION of the headline claim completed independently: pytest -m container in the worktree = 37 passed, 330 deselected, 119.74s (one ephemeral container, pinned 0.9.3 from the worktree .env) — the bundle's core purpose (plugin tests running inside the container, host untouched) is owner-proven. Awaiting the final PASS/BLOCK; then the merge-readiness presentation to the operator.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: final-gate reviewer asked about a source-mode evidence discrepancy (note records pre-reconciliation source mode at 34 passed/139s; completion report + archive index claimed 37 passed in both modes). Owner investigated: NO retained post-reconciliation source-mode log exists; retained post-reconciliation container logs are pinned-only (.test-results/20260930-144322-27210/tier1.log, 37 passed, 114.48s). The committed evidence NOTE is accurate (source 34/139s pre-reconciliation; pinned 37/118s post); the overstatement lives in the completion-report summary + archive index entry + owner packet. Answered the reviewer with the precise evidence state and authorized adjudication on the evidence as it stands (no live source rebuild). Likely finding: index-entry/report wording vs evidence (evidence hygiene, same class as slice-1 B3). Repair if BLOCKed: correct index wording or run+record a post-reconciliation source-mode gate — small and in-scope.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate disposition (FINAL candidate c53972ff35488d23efdbf975e67006b451281931): BLOCK accepted. Reviewer expert-reviewer-final-c53972f (sub-37c638a0, session 01a0f47f-27c8-7641-bd1f-a3f94da9d613), openai-codex/gpt-6-astra @ max, packet agentmsg_a3b164d1. Report preserved at docs/evidence/2026-09-30-tier1-final-expert-review-c53972f.md (main commit 8ecf426). Three P2 findings, all in-scope: B1 conftest fixture rmtree(ignore_errors=True) suppresses stale-output removal failures (driver fails closed); B2 session-fixture container teardown never verifies removal (green gate can leak a container); B3 archive index overstates post-reconciliation source-mode evidence (37/both-modes vs evidenced 34-pre/pinned-37-post). Minor hygiene: R-T1-* inventory plan refs point to the deleted active path; blank-line-at-EOF in test_reviewed_plan_native_discovery.py:419. CORRECTION to my earlier ledger note: the reviewer established the 16h leaked process belonged to the resets_and_signal_cleanup_reaps_group scenario (test_embedding_candidate_build.py:224-252), NOT terminates_stall — it corroborates an independent pre-existing watchdog cleanup problem, not exact causation for the named flake. Routing revise via handoff_spec_episode. Fresh FINAL gate required on the repaired commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
FINAL EXPERT GATE on c53972f: BLOCK (3 findings), owner accepted as in-scope review-rework (2026-09-30). Full report preserved at main-repo docs/evidence/2026-09-30-tier1-final-expert-review-c53972f.md (fold into archive reviews/ at merge time). REPAIR TASK for the next execute pass — scope limited to tests/conftest.py, its behavioral tests, the archive index, and inventory/doc hygiene: B1: _stage_fork_release (~conftest.py:143-144) must NOT use shutil.rmtree(ignore_errors=True) for the four pack-consumed dist trees — absence fine, permission/IO/type errors must stop the run BEFORE build/pack/image-build/container creation, matching driver scripts/test-tier1.sh:258-265 fail-closed semantics; add fixture-level behavioral tests (stale-and-removed outputs replay; cleanup-denial e.g. 0555 subdir stops before build/pack; build/pack failure fails closed; missing dist tree stays positive; dry-run-equivalent makes no build/pack/docker call) testing the ACTUAL fixture path. B2: session-fixture finalizer (~conftest.py:458-463) must verify the owned container removal/absence; on removal failure/timeout surface a teardown failure with exact container identity + diagnostics; do NOT silently delete session share evidence while a container still owns it; preserve original setup/test failure if cleanup also fails (surface both); bounded to the one captured container ID (no docker-wide pruning, no name-based guesses, no infinite retries); idempotent already-absent OK when absence is established. Acceptance: positive setup/body/teardown proves container absent; negative removal-nonzero/timeout fails gate + retains diagnostics; setup failure after publication still attempts cleanup of only the captured ID; body-failure + removal-failure preserves both errors; later run does not inherit failed run state; unrelated container never targeted. B3: correct archive index final-acceptance claim (.ralph/plans/archive/README.md plugin-test-container entry) to the verified split — source mode 34 passed/139s BEFORE reconciliation; pinned mode 37 passed/118s AFTER reconciliation; post-reconciliation source-mode gate NOT claimed; align summary lines; mirror the slice-3 evidence note's honest split; do NOT rebuild the live harness source checkout to preserve the inaccurate sentence. Minor hygiene: (a) repoint five R-T1-* plan references in config/requirements-inventory.json (~lines 1139/1161/1183/1204/1235) from deleted .ralph/plans/SPECIFICATION.md to .ralph/plans/archive/plugin-test-container/SPECIFICATION.md; (b) remove new blank line at EOF in tests/test_reviewed_plan_native_discovery.py (git diff --check flags :419); (c) note in slice-3 evidence note that historical checksum files naming the obsolete goal-blocker file are historical record and the current-generation hash check is the fresh evidence for the final review window. CONSTRAINTS: fixture/tests/index/inventory/evidence-note changes only; NO plugin source changes; NO driver behavior changes beyond fixture alignment; NO host probe reruns; host gates tier-0 subset only; NO new harness machinery. Refresh slice-3 evidence note after repair incl. fresh no-leftover-containers check proving the B2 fix. Commit+push; report new exact commit hash to owner sibling 01a0f0d6-b639-74be-ab78-a58b058236c7. This repair invalidates the c53972f review; fresh FINAL EXPERT gate follows on the repaired exact commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: final-candidate repair at 8c44cd16fd2cc64ef4c2ebfd8bf8a6d86e2cc4c2 RECONCILED. Owner-verified: push; diff scope exactly the 6 allowed files; B1 fail-closed _remove_dist_tree (remaining ignore_errors sites verified benign: share cleanup post-teardown-confirmation, ctmp scratch); B2 _remove_session_container bounded rm -f + inspect-absence with identity+diagnostics, share preserved while container may own it; B3 archive index honest split (source 34/139s pre, pinned 37/118s post, no post-reconciliation source claim); 5 R-T1-* refs repointed to archived spec; EOF fixed; diff --check clean; zero leftover containers; owner re-ran 27/27 fixture tests + 250/144 tier-0 green. Fresh FINAL EXPERT gate in flight: expert-reviewer-final-8c44cd1 (sub-ee0f4ca6), openai-codex/gpt-6-astra @ max, packet agentmsg_a1b94bf1, watch 18a241e2->(new) armed. Awaiting PASS/BLOCK.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate #2 disposition (repaired final candidate 8c44cd16fd2cc64ef4c2ebfd8bf8a6d86e2cc4c2): BLOCK accepted. Reviewer expert-reviewer-final-8c44cd1 (sub-ee0f4ca6, session 01a0f4b4-bbf9-724d-82a0-d29ef8a9eef3), openai-codex/gpt-6-astra @ max, packet agentmsg_a1b94bf1. Report preserved at docs/evidence/2026-09-30-tier1-final-expert-review-8c44cd1.md (main commit dfbdbc6). B3 + archival hygiene VERIFIED RESOLVED. Two remaining failure-path defects, both in-scope: B1-R metadata errors silently classified as absent dist tree (Path.is_* predicates suppress OSError into False on Python 3.14 — inaccessible parent/EIO/FIFO treated as absent, staging proceeds); B2-R failed docker inspect accepted as verified absence (rc!=0 conflates daemon-error with absent; share evidence deleted on unknown state). Reviewer also noted the new 27-test file exercises helpers but NOT the full tier1_container session fixture (real-session negative coverage belongs with the repairs). Non-blocking: evidence-note arithmetic wording (222 vs 223). This run's flake was the SIBLING watchdog scenario (resets_and_signal_cleanup_reaps_group), consistent with the prior precision correction. Routing revise round 2 via handoff_spec_episode. Fresh FINAL gate required on the repaired commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
FINAL EXPERT GATE #2 on 8c44cd1: BLOCK (2 failure-path findings remain), owner accepted as in-scope review-rework (2026-09-30). B3 + archival hygiene RESOLVED (verified). Full report at main-repo docs/evidence/2026-09-30-tier1-final-expert-review-8c44cd1.md. ROUND-2 REPAIR TASK — scope limited to tests/conftest.py, its behavioral tests, the slice-3 evidence note (plus possibly scripts/test-tier1.sh OR its equivalence claim — see B1-R): B1-R: _remove_dist_tree (~conftest.py:142-147) uses Path.is_symlink()/is_file()/is_dir() which on host Python 3.14.4 SUPPRESS filesystem OSError into False — three False results get misclassified as absence. Repair with error-preserving metadata semantics (lstat directly is the natural seam): distinguish confirmed absence (FileNotFoundError -> OK) from inspection failure (PermissionError/EIO must RAISE before any build/pack/image-build/container call) and from non-directory special objects (FIFO at the dist path must be explicitly handled or rejected, not treated as absent). ALSO: reviewer found this hosts rm -rf proceeds to npm build when the dist parent is unsearchable (npm then fails on permission) — the driver has the analogous weaker edge, so EITHER align the driver OR correct the evidence notes mirrors-the-driver equivalence claim; do not assert unsupported equivalence. Acceptance: truly-absent/regular-file/directory/symlink (incl. dangling) handled with symlink targets untouched; A->B source replay without version change packs current output and omits deleted outputs; inaccessible parent + injected metadata PermissionError/EIO fail BEFORE any npm/node/docker call; existing FIFO/special object explicitly handled or rejected before build; the WHOLE FIXTURE stops before publication (not only one helper raising); after denied/unknown cleanup, restore access and stage again — failed attempt must not have produced an accepted artifact, successful replay must remove obsolete output. Exercise the actual Python 3.14 environment and the actual fixture staging boundary; apply the source-path error test to the driver too. B2-R: _container_absent (~conftest.py:398-409) returns out.returncode != 0, but docker inspect returns nonzero for more than missing object (daemon connection error is also rc=1). Repair: require a positive, error-distinguishable absence result for the exact captured container ID — distinguish present / absent (no such object) / unknown-error (connection, permission, API, CLI-launch failure, timeout); unknown must FAIL the gate and RETAIN the share; preserve inspect diagnostics; idempotent success only when actual absence is established. Cover: removal failure + inspect daemon/permission/API failure -> pytest nonzero + share preserved; successful rm + failed/unknown inspect -> no bypass; removal timeout, inspect timeout, CLI-launch failure, still-present -> all fail boundedly; setup failure after publication cleans only the captured ID; setup+cleanup and body+cleanup failures preserve both errors; a run following failed cleanup must not inherit or delete the failed runs still-owned state — PROVE THIS THROUGH THE SESSION FIXTURE (instantiate tier1_container in the negative tests; the current 27 tests exercise helpers but not the full session fixture, and the uniqueness check is a source-string assertion — replace with real-session coverage). Minor wording fix (non-blocking): slice-3 evidence note :371 arithmetic — prior post-reconciliation gate was 223 (not 222); the post-repair run had 250 executed (249 passed + 1 failed) — correct the wording. CONSTRAINTS: fixture/tests/evidence-note changes only (plus the driver OR the equivalence-claim correction for B1-R); NO plugin source changes; NO host probe reruns; host gates tier-0 subset only; NO new harness machinery; keep bounded timeouts and exact-ID scope; NO docker pruning/name-guesses/unbounded retries; NEVER traverse a symlink target; preserve the valid missing-tree case. Refresh slice-3 evidence note after repair (incl. fresh no-leftover-containers check). Commit+push; report new exact commit hash to owner sibling 01a0f0d6-b639-74be-ab78-a58b058236c7. This repair invalidates the 8c44cd1 review; fresh FINAL EXPERT gate follows on the repaired exact commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: final-candidate round-2 repair at 82dd08736035ff3dd5c4bd3a71c1ea333ce27dcb RECONCILED. Owner-verified: push; diff = exactly the 4 allowed files (conftest.py, test_tier1_fixture.py, test_tier1_driver.py, slice-3 evidence note); B1-R lstat-based _remove_dist_tree (FileNotFoundError=absence, other lstat OSError raises pre-build, symlinks unlinked without traversal, special objects rejected) — verified in code; B2-R three-state _inspect_container (PRESENT/ABSENT-with-positive-evidence/UNKNOWN-fails-gate-and-retains-share) — verified in code; real-session coverage added (TestSessionFixtureEndToEnd via _fixture_function); behavioral no-inheritance proof (replaces source-string assertion); arithmetic wording fixed (250=249+1=223+27); equivalence claim corrected (wording only, driver unchanged); owner re-ran 80/80 fixture+driver tests + 270/144 tier-0 green; zero leftover containers; diff --check clean. Fresh FINAL EXPERT gate #3 in flight: expert-reviewer-final-82dd087 (sub-eeba16d4), openai-codex/gpt-6-astra @ max, packet agentmsg_12efb222, watch armed. Awaiting PASS/BLOCK.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate #3 disposition (repaired final candidate 82dd08736035ff3dd5c4bd3a71c1ea333ce27dcb): BLOCK accepted. Reviewer expert-reviewer-final-82dd087 (sub-eeba16d4, session 01a0f4eb-875e-7039-83be-41f8ef6d8b9d), openai-codex/gpt-6-astra @ max, packet agentmsg_12efb222. Report preserved at docs/evidence/2026-09-30-tier1-final-expert-review-82dd087.md (main commit b789466). B1-R, B2-R, B3, and all archival hygiene VERIFIED RESOLVED. ONE remaining in-scope finding: B2-R2 — the session share is keyed by recyclable PID (.test-results/share-<pid>, exist_ok=True) while the container name uses PID+epoch, so a PID-reused later session can inherit and delete a failed session's retained share (reproduced through the real fixture: run 1 leaks, run 2 same PID inherits and deletes the witness). Note: this run's flake was the named terminates_stall scenario (hit its 15s timeout; synthetic PIDs absent afterward — consistent with the pre-existing timing flake). Iteration count: 8 review rounds (slice-1 x3, slice-2 x2, final x3). Routing revise round 3 via handoff_spec_episode. OWNER BOUND: if the next final gate is not a clean PASS, I will pause and present the full state to the operator for a decision rather than looping further. Fresh FINAL gate required on the repaired commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
FINAL EXPERT GATE #3 on 82dd087: BLOCK (1 ownership-seam finding), owner accepted as in-scope review-rework (2026-09-30). B1-R, B2-R, B3, archival hygiene all verified RESOLVED. Full report at main-repo docs/evidence/2026-09-30-tier1-final-expert-review-82dd087.md. ROUND-3 REPAIR TASK — scope limited to tests/conftest.py, its behavioral tests, and the slice-3 evidence note: B2-R2 — a later session can inherit and delete a failed sessions still-owned share: the session share is allocated as .test-results/share-<pid> with exist_ok=True (no per-session identity) while the container name uses pid+epoch. On PID reuse (or multiple pytest sessions in one process), a later session reuses the earlier share; its finalizer then deletes the entire share after proving only its OWN captured container absent — destroying a retained failed sessions recovery evidence. REPAIR: give every session an independently unique, exclusively allocated share identity, retained with that sessions captured container; keep cleanup restricted to that exact owned share; never reuse a pre-existing share solely because the PID/path matches; allocation must choose fresh owned state or fail closed on collision WITHOUT using/removing an existing directory. Align share identity with the container identity (e.g. include the epoch/unique run id in the share path, or uniquely-allocated mkdtemp-style share). CONSTRAINTS: preserve same-absolute-path host/container mounts; exact-ID bounded rm->inspect; the three-state UNKNOWN behavior; diagnostics; TIER1_KEEP_SHARE; do NOT delete or adopt an existing share, prune containers, search by names, kill host processes, or add retries to make a later run green; do NOT weaken the B1-R fail-closed source-staging repair. ACCEPTANCE: (positive) ordinary setup/body/verified teardown removes only that sessions share; already-absent replay succeeds; KEEP_SHARE retains its own artifacts; (negative/replay) drive two real fixture sessions with the SAME PID and different epochs — fail run 1 teardown as UNKNOWN/PRESENT, plant a witness, complete run 2 — require DISTINCT shares, no run-1 evidence visible through run 2s share, byte-identical run-1 witness afterward, run-2 docker calls scoped only to cid-2; (collision) same PID + same coarse epoch, plus an already-existing legacy share-<pid> directory — allocation must choose fresh owned state or fail closed without using/removing the existing directory; (failure) after a retained run, make the next setup fail both before and after publication — the old share survives, only the newly captured ID/newly allocated share may be finalized; (replay) a later clean session still succeeds after these failures without touching any retained prior share/container. Then update the no-inheritance claims in the slice-3 evidence note (~:489-497). CONSTRAINTS: fixture/tests/evidence-note changes only; NO plugin source changes; NO driver changes; NO host probe reruns; host gates tier-0 subset only; NO new harness machinery. Refresh the slice-3 evidence note after repair (incl. fresh no-leftover-containers check). Commit+push; report new exact commit hash to owner sibling 01a0f0d6-b639-74be-ab78-a58b058236c7. This repair invalidates the 82dd087 review; fresh FINAL EXPERT gate follows on the repaired exact commit. NOTE for the execute pass: the round-2 test test_failed_run_leaves_no_inheritance_for_the_next_run used DIFFERENT pids (4242/4343) — round-3 acceptance wants SAME pid + different epochs proving distinct shares; adapt it. Existing fakes: _make_fake_session_docker/_begin/_session_fixture_fn in tests/test_tier1_fixture.py.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: final-candidate round-3 repair at 672c77213c26ae36400cec06ec253b4b1d84f80a RECONCILED. Owner-verified: push; diff = exactly the 3 allowed files (conftest.py, test_tier1_fixture.py, slice-3 evidence note); B2-R2 repair verified in code (mkdtemp per-session share, fresh/exclusive/distinct even for identical pid+epoch, pre-existing dirs neither used nor removed, 0700->0755 normalization preserving the same-absolute-path mount, container name aligned with the share token); owner re-ran 84/84 fixture+driver tests + 274/144 tier-0 green; zero leftover containers; diff --check clean. Fresh FINAL EXPERT gate #4 in flight: expert-reviewer-final-672c772 (sub-be358315), openai-codex/gpt-6-astra @ max, packet agentmsg_2c6bbd91, watch armed. OWNER BOUND (recorded): if gate #4 is not a clean PASS, I will PAUSE and present the full state to the operator for a decision rather than looping further.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate #4 disposition (complete candidate 672c77213c26ae36400cec06ec253b4b1d84f80a): PASS accepted. Reviewer expert-reviewer-final-672c772 (sub-be358315, session 01a0f511-c13c-72b3-8885-0db15a809846), openai-codex/gpt-6-astra @ max, packet agentmsg_2c6bbd91. Report preserved at docs/evidence/2026-09-30-tier1-final-expert-review-672c772.md (main commit e2a0343). NO material finding remains. B2-R2 repaired (per-session mkdtemp share identity, container-name aligned; red/green control proves predecessor 82dd087 fails and the candidate passes). All prior repairs intact. Complete candidate scope verified (40 files, no episode-authored plugin source). COMPLETE CANDIDATE CERTIFIED for operator merge review. Owner bound satisfied (clean PASS). Presenting merge-readiness to the operator — merge/abandon/pause/revise is HIS explicit decision only.
---

author: Joe Landers
created: 2026-10-12 01:02
---
MERGED to main at 1442abb (operator-approved). Final candidate 672c772 passed EXPERT gate #4 (9 review rounds: 6 BLOCKs -> 3 PASSes); post-merge re-verification against main's lean-protocol plugin (00ad366) caught 3 stale package==1 assertions in test_reviewed_plan_native_discovery.py — reconciled to package==0 (commit 535f584, matches main's own sibling-file updates; the container suite caught what host-skipped tests missed). Container gate 37/37 + tier-0 host 274/144 green on the merged tree; main tree identical to verified branch tree. Worktree + branch cleaned up. blw.4 (shared-base extraction) remains as deferred P2 follow-up.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed

## plugin-test-container/ — Test tier architecture + tier-1 plugin test container ✅ COMPLETE (2026-09-30)

Delivered the three-tier test architecture and the tier-1 plugin test container
across three owner-reviewed slices: (1) the tier-1 image and driver
(`docker/test.Dockerfile`, `scripts/test-tier1.sh`, `tests/test_tier1_image.py`);
(2) install selection (pinned release via vendor installer, or source via fresh
fork pack), in-container apply/check, a validated probe, and a hard deadline; and
(3) pytest markers (`container` = tier 1, `sandbox` = tier 2, unmarked = tier 0),
the session-scoped `tier1_container` fixture (one container per run,
driver-mirrored setup, exec helpers), migration of all tier-1 suites to
in-container exec, and the `scripts/test-all.sh` sequencer. Acceptance
(verified split, mirroring the slice-3 evidence note): the tier-0 default
`python3 -m pytest tests/ -q` passes with no Docker (223 passed, 144 skipped,
post-reconciliation). Tier-1 in ONE session container: source mode
**34 passed/139s BEFORE the merge reconciliation**; pinned mode
**37 passed/118s AFTER reconciliation**; the post-reconciliation source-mode
gate is NOT claimed. Accepted commits: slice 1 `2666843`, slice 2 `bc00cba`,
slice 3 `d040c02` plus merge-reconciliation `7118a44` (rebased onto main
`9b3edd2`, the goal-heartbeat plugin generation).

- [Archived specification](plugin-test-container/SPECIFICATION.md)
- [Archived execution plan](plugin-test-container/EXECUTION_PLAN.md)
- [EXPERT review reports (BLOCK/PASS trail)](plugin-test-container/reviews/)
- Acceptance evidence:
  [slice 1 image + driver](../../../docs/evidence/2026-09-29-tier1-slice1-image-driver.md),
  [slice 2 install selection](../../../docs/evidence/2026-09-30-tier1-slice2-install-selection.md),
  [slice 3 migration + sequencer](../../../docs/evidence/2026-09-30-tier1-slice3-migration-sequencer.md)
- Operator-facing doc home (named by the approved plan):
  [DEVELOPERS.md](../../../DEVELOPERS.md) "Testing" section

EXPERT review trail: slice 1 BLOCK `47d2830` → BLOCK `d8dbc5d` → PASS
`2666843`; slice 2 BLOCK `470be98` → PASS `bc00cba`. Slice 3 had NOT received
its final EXPERT gate at archival time; the owner runs a fresh FINAL EXPERT
review on the complete exact candidate (`d040c02..<archival>`), so this archive
does not record a slice-3 PASS. Backlog.md tasks `PRIMECLAW-19.1`/`.2`/`.3` are Done;
`PRIMECLAW-19.4` (shared-base extraction) is deferred P2.

Note: the archived EXECUTION_PLAN.md contains a historical promotion quote
reading `/implement-spec .ralph/plans/future/plugin-test-container`; that
bundle's reviewed artifact set now lives beside it in this subfolder, with the
five review reports preserved under `reviews/`.
<!-- SECTION:FINAL_SUMMARY:END -->
