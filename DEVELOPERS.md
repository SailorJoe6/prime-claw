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

### Test tiers

- **Tier 0 — host, no environment.** Static checks: no Node, no
  prime-agent, no Docker, no plugin install. This is the default gate.
- **Tier 1 — slim container.** Anything needing Node, a prime-agent
  install, or the plugin runs inside a plain-Docker container, so the
  prime-agent under test can never touch the host's `~/.prime/agent/`.
  One container per pytest run: the session fixture in
  `tests/conftest.py` builds the image (`docker/test.Dockerfile`), starts
  one container with the repo bind-mounted read-only at `/workspace`,
  installs prime-agent per `.env`, applies + checks the plugin against
  the container's own `~/.prime/agent/`, hands tests an exec helper, and
  destroys the container at session end. Test scratch lives on a
  same-path session share under the gitignored `.test-results/` so files
  and paths are identical on both sides; fake daemons run in-container
  (`tests/container/`) because a host-bound Unix socket is unreachable
  from the container through the macOS virtiofs mount.

  ```bash
  python3 -m pytest tests/ -q -m container   # tier 1 (requires Docker + .env)
  ```

  Install selection lives in a gitignored `.env` at the repo root (copy
  `.env.example`; set EXACTLY ONE selector — the driver and the session
  fixture fail fast on neither/both):

  - `PRIME_AGENT_PINNED=<version>` — install a released version via the
    vendor installer (`install.sh`; the same mechanism `bin/prime-claw`
    uses — prime-agent is not on the public npm registry).
  - `PRIME_AGENT_SOURCE=/absolute/path/to/prime-agent` — build from a
    local fork checkout: the host runs the fork's `release:pack` from a
    FRESH build (the four pack-consumed dist dirs are removed first), the
    tarballs are staged into the container over a `file:` URL base, and
    the container installs from them.

  `scripts/test-tier1.sh` remains the standalone tier-1 driver (image
  build + one ephemeral install/apply/check container, `--smoke`,
  `--probe` with a validated `get_commands` reply under a hard
  `timeout --kill-after` deadline, `--dry-run`, `--rebuild`). The pytest
  session fixture mirrors its contract; the driver is the source of
  truth. Network is used only at image build and the in-container
  prime-agent install step.
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
