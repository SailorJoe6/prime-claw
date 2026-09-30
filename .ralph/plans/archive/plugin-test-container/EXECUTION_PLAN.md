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
