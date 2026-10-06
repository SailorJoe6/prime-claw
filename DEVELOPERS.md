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

Tests use the isolation tiers in `.ralph/plans/SPECIFICATION.md`. Unmarked
mock/static tests are tier 0. Real Prime Agent/plugin execution is tier 1 under
the `container` marker. The explicit real-stack launcher is tier 2.
`tests/conftest.py` auto-marks every tier-1 fixture user and admits it only for
the exact selector `-m container`; arbitrary, negated, grouped, or compound
marker expressions cannot authorize an environment tier. The plain command is
therefore always the tier-0 default and never contacts Docker:

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

- **Tier 0 — host-safe unit/static.** No Docker, OpenShell, Prime Agent
  execution, plugin install, PostgreSQL, or gbrain. Recording fakes and pure
  local-tool checks belong here. This is the default gate.
- **Tier 1 — slim container.** Anything executing Prime Agent, the plugin, or
  the plugin's Node suites runs inside one run-owned plain-Docker container.
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
  - `PRIME_AGENT_SOURCE=/absolute/path/to/prime-agent` builds in a separate
    disposable container. The checkout is mounted read-only and copied to
    container-local storage; complete before/after inventory equality is
    mandatory. The runtime mounts its run-owned scratch share read/write and
    exposes the validated release subtree separately as read-only `/stage`;
    installation verifies and reads only `/stage`. No source checkout, host
    home, socket, credentials, or live state is exposed. The source path is
    never written to evidence or echoed.

  `scripts/test-tier1.sh` is the standalone driver (`--smoke`, `--probe`,
  `--dry-run`, `--rebuild`). The fixture mirrors its boundary. Builder and
  runtime ownership are independent; the writable share is removed only after
  every possible owner is positively clean and absent. Teardown targets only
  the captured container ID and requires both explicit absence and clean
  remove/inspect command outcomes; ordinary nonzero removal, interruption, or
  timeout remains failure even after positive absence. Invalid final receipt
  types become unknown ownership without skipping runtime cleanup or failed
  evidence publication. Every host Docker wait has a validated deadline,
  process-group TERM→KILL escalation, bounded reap, and pipe-independent output
  capture through `scripts/testing/bounded.py`. A failed/timed-out launch still
  tears down an
  exact recovered cidfile identity; malformed identities never reach removal. See
  [docs/testing-strategy.md](docs/testing-strategy.md).
- **Tier 2 — disposable brain-stack integration.**
  `scripts/test-integration.sh` prepares the exact locked upstream gbrain archive
  and Bun artifact, builds native `linux/arm64` or `linux/amd64`, and runs
  PostgreSQL 16 + pgvector + gbrain as unprivileged image user `tester`.

  ```bash
  scripts/test-integration.sh --dry-run
  scripts/test-integration.sh
  # optional public-source transport cache; never mounted into the container
  INTEGRATION_GBRAIN_MIRROR=/absolute/path/to/gbrain scripts/test-integration.sh
  ```

  The assertion body and synthetic fixture are baked into the image. Runtime uses
  `--network none`, no host mounts or published ports, and no host home, socket,
  credentials, provider environment, private data, or production service. HOME,
  PostgreSQL state, results, and synthetic Git repositories are container-local.
  After the body exits, the launcher stops the container and copies its JSON
  result with `docker cp`.

  The launcher records the tested HEAD/content identity, platform, locked
  versions, immutable image/container IDs, functional result, and cleanup
  outcomes in one `manifest.json`. It removes only exact IDs whose run/contract
  labels match. Cleanup, command, timeout, interrupt, copied-result, or ownership
  failures stay nonzero. The local host and same-UID operator are trusted; hostile
  local races and inode/publication hardening are intentionally outside this
  tier's acceptance boundary. The explicit body filename is not pytest-
  collectable, and direct host invocation fails before side effects.

- **Lifecycle execution — disabled.** The former `sandbox` tests are recording-
  fake host unit tests and now belong to tier 0. No pytest marker or
  `scripts/test-all.sh` option runs real OpenShell lifecycle work. Both
  `--with-sandbox` and `--with-lifecycle` are non-mutating usage errors.

### Whole-suite sequencer

```bash
scripts/test-all.sh          # tier 0 -> tier 1 -> tier 2, sequential/fail-fast
scripts/test-integration.sh  # tier 2 alone
```

The sequencer is deliberately dumb. It runs plain host pytest, exact
`-m container`, then the real integration launcher. It stops at the first
failure, prints a tier summary, and leaves logs in the gitignored
`.test-results/` directory. Plugin development remains Docker-only: never apply,
check, or probe a candidate against the host/user-global Prime Agent install.

## Local-state rules

- Never commit credential material.
- `.env` files are local; `.env.example` files are the committed templates.
- beads data lives under `.beads/` and syncs via `bd sync`.
