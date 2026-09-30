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
  adds the in-container prime-agent install; slice 3 migrates the coupled
  tests in). Anything needing Node, a prime-agent install, or the plugin runs
  inside a plain-Docker container so the prime-agent under test can never
  touch the host's `~/.prime/agent/`. `scripts/test-tier1.sh` builds the slim
  image (`docker/test.Dockerfile`) and smoke-runs it (`--dry-run` prints the
  plan, `--rebuild` skips cache). The smoke run verifies only the container
  toolchain (Node/Python/pytest versions) — it does NOT install or validate
  the plugin.
- **Tier 2 — host, OpenShell.** `tests/test_runtime_*.py` orchestrate
  sandboxes from the host and stay outside any container.

Requires Docker for tier 1 only.

## Local-state rules

- Never commit credential material.
- `.env` files are local; `.env.example` files are the committed templates.
- beads data lives under `.beads/` and syncs via `bd sync`.
