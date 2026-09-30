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

**Current reality (tier rollout in flight, slices 1-3):** until slice 3
lands, tier assignment is by file, not by pytest marker, and plain
`pytest tests/ -q` runs EVERYTHING — including the host-coupled live-RPC
probe tests that spawn real `prime-agent` processes against the developer's
own `~/.prime/agent/`. Those probes are slow and can interfere with a running
harness.

For a fast, host-safe gate today, run the tier-0 subset only:

```bash
python3 -m pytest tests/ -q \
  --ignore-glob='tests/test_runtime_*.py' \
  --ignore=tests/test_handoff_chain_extension.py \
  --ignore=tests/test_reviewed_plan_extension.py \
  --ignore=tests/test_project_conversation_extension.py \
  --ignore=tests/test_goal_blocker_control_extension.py \
  --ignore=tests/test_conversation_oversight_native.py \
  --ignore=tests/test_reviewed_plan_native_discovery.py \
  --ignore=tests/test_prime_agent_plugin_install.py
```

Prove a new test can fail before trusting it: add the assertion, run it
against the pre-fix state, confirm it goes red, then fix.

### Test tiers

Tests are being organized into explicit tiers (see
`.ralph/plans/SPECIFICATION.md`; rollout slices 1-3):

- **Tier 0 — host, no environment.** Static checks: no Node, no prime-agent,
  no Docker, no plugin install. Use the bounded command above until slice 3
  adds markers.
- **Tier 1 — slim container** (slice 1 delivered the image + driver; slice 2
  added the in-container prime-agent install + plugin apply/check; slice 3
  migrates the coupled tests in). Anything needing Node, a prime-agent
  install, or the plugin runs inside a plain-Docker container so the
  prime-agent under test can never touch the host's `~/.prime/agent/`.
  `scripts/test-tier1.sh` builds the slim image (`docker/test.Dockerfile`),
  then runs ONE ephemeral container that installs prime-agent, applies the
  plugin (`scripts/apply-prime-agent-plugin.sh`), and verifies it
  (`scripts/check-prime-agent-plugin.sh`) against the container's own
  `~/.prime/agent/` — with the repo bind-mounted read-only at `/workspace`.

  Install selection lives in a gitignored `.env` at the repo root (copy
  `.env.example`; set EXACTLY ONE selector — the driver fails fast on
  neither/both):

  - `PRIME_AGENT_PINNED=<version>` — install a released version via the
    vendor installer (`install.sh`; the same mechanism `bin/prime-claw`
    uses — prime-agent is not on the public npm registry).
  - `PRIME_AGENT_SOURCE=/absolute/path/to/prime-agent` — build from a local
    fork checkout: the host runs the fork's `release:pack`, the tarballs are
    staged into the container over a `file:` URL base, and the container
    installs from them.

  Flags: `--dry-run` prints the plan (never contacts Docker), `--rebuild`
  skips the build cache, `--smoke` runs only the toolchain smoke report (no
  `.env` needed), `--probe` appends a container-side RPC probe
  (`get_commands`) against the installed plugin. Network is used only at
  image build and the in-container prime-agent install step.
- **Tier 2 — host, OpenShell.** `tests/test_runtime_*.py` orchestrate
  sandboxes from the host and stay outside any container.

Requires Docker for tier 1 only.

## Local-state rules

- Never commit credential material.
- `.env` files are local; `.env.example` files are the committed templates.
- beads data lives under `.beads/` and syncs via `bd sync`.
