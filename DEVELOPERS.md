# prime-claw Developer Guide

For contributors working on the prime-claw builder repo.

## Prerequisites

- Git, Bash, standard Unix utilities
- Python 3 + pytest (for the script/test layer)
- Node.js 22.8 or newer (required by prime-agent and extension tests)
- beads CLI (`bd`)
- prime-agent (the harness this project builds on)
- Optional: gbrain CLI (for brain/source work)
- Optional: Docker/Podman (for sandbox runtime work, later phases)

## Layout

- `VISION.md` / `LONG_RANGE_PLAN.md` — founding vision and long-range plan
- `docs/` — design docs; `docs/lineage/` — distilled prior-art notes
- `scripts/` — `apply-*` (mutate), `check-*` (readiness), `validate-*`
  (acceptance), `run-*` (smoke), plus helpers
- `tests/` — pytest coverage for scripts and contracts
- `config/` — manifests, including requirements inventory
- `templates/` — prime-agent skill and config templates

## Engineering discipline

Every capability follows the apply/check/validate/test pattern proven in
openclaw-setup:

1. A design doc in `docs/` states the requirement and decision.
2. `scripts/apply-*.sh` performs the mutation (idempotent where possible).
3. `scripts/check-*.sh` is a non-mutating readiness gate (exit 0 = ready).
4. `scripts/validate-*.py` proves live acceptance.
5. `tests/test_*.py` gives regression coverage.
6. `config/requirements-inventory.json` records the requirement and its
   coverage tier, so every requirement is traceable to a test.

## Testing

Tests are organized into three tiers (see `.ralph/plans/archive/plugin-test-container/SPECIFICATION.md`
"Test tiers"). Tier assignment is by **pytest marker** (`pytest.ini`):
unmarked tests are tier 0, `container` tests are tier 1, `sandbox` tests
are tier 2. `tests/conftest.py` auto-marks any test that requests the
`tier1_container`/`ctmp` fixtures as `container`, and skips tier-1/tier-2
tests unless an explicit `-m` mark expression selects them — so the plain
command is always the tier-0 default with no Docker dependency:

```bash
python3 -m pytest tests/ -q          # tier 0 (host, no environment)
```

Prove a new test can fail before trusting it: add the assertion, run it
against the pre-fix state, confirm it goes red, then fix.

Plugin development and all pre-merge Prime Agent/plugin execution are tier 1
only. Do not apply, check, or probe a candidate against the host user-global
`~/.prime/agent`. Both plugin scripts fail without an explicit target:

- tier 1 supplies `PRIME_AGENT_PLUGIN_ROOT=/root/.prime/agent` inside its
  ephemeral container;
- script-only diagnostics may supply another explicit isolated
  `PRIME_AGENT_PLUGIN_ROOT`;
- `--user-global` is a deliberate post-acceptance operation from the primary
  `main` checkout and is refused from linked worktrees.

### Test tiers

- **Tier 0 — host, no environment.** Static checks: no Node, no
  prime-agent, no Docker, no plugin install. This is the default gate.
- **Tier 1 — slim container.** Anything needing Node, a Prime Agent
  install, or the plugin runs inside one run-owned plain-Docker container.
  A sanitized run-owned snapshot of tracked and nonignored inputs is mounted
  read-only at `/workspace`; ignored local state is never mounted. A fresh
  scratch share is the only writable host mount; the durable evidence root,
  build context, iidfile, and cidfile are never container-writable. Each direct
  driver or pytest run
  allocates `.test-results/<run-id>/tier1/`, builds from an empty context,
  captures the immutable image ID with `--iidfile`, and launches that exact
  ID with a run-owned `--cidfile`.

  ```bash
  python3 -m pytest tests/ -q -m container   # tier 1 (requires Docker + .env)
  ```

  Copy `.env.example` to the ignored `.env` and set exactly one selector:

  - `PRIME_AGENT_PINNED=<version>` is executable. The vendor install is the
    only online container phase. The fixture then disconnects every captured
    network and verifies the set is empty before version/artifact identity,
    plugin apply/check, probes, or tests run.
  - `PRIME_AGENT_SOURCE=/absolute/path/to/prime-agent` is intentionally
    fail-closed in Slice 1. It exits before stat/read/build/cleanup/pack or
    Docker access and never echoes the checkout path. The disposable source
    builder is Slice 2 (`prime-claw-5v7.1`).

  `scripts/test-tier1.sh` is the standalone driver (`--smoke`, `--probe`,
  `--dry-run`, `--rebuild`). The fixture mirrors its boundary. Teardown targets
  only the captured container ID and requires both explicit absence and clean
  remove/inspect command outcomes; interruption/timeout remains failure even
  after positive absence. Every host Docker wait has a validated deadline,
  process-group TERM→KILL escalation, bounded reap, and pipe-independent output
  capture through `scripts/testing/bounded.py`. A failed/timed-out launch still
  tears down an
  exact recovered cidfile identity; malformed identities never reach removal. See
  [docs/testing-strategy.md](docs/testing-strategy.md).
- **Tier 2 — host, OpenShell.** `tests/test_runtime_*.py` orchestrate
  sandboxes from the host and stay outside any container. They run only
  on explicit request:

  ```bash
  python3 -m pytest tests/ -q -m sandbox     # tier 2 (explicit only)
  ```

### Whole-suite sequencer

```bash
scripts/test-all.sh                    # tier 0 + tier 1 (fail-fast)
scripts/test-all.sh --with-sandbox     # + tier 2
```

The sequencer is deliberately dumb: it runs each tier with plain pytest,
stops at the first failing tier, prints a tier summary, and leaves logs
in the gitignored `.test-results/` directory.

## Local-state rules

- Never commit credential material.
- `.env` files are local; `.env.example` files are the committed templates.
- beads data lives under `.beads/` and syncs via `bd sync`.
