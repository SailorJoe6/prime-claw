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
  execution, plugin install, PostgreSQL, or gbrain. Pure checks and ordinary
  recording fakes belong here. This is the default gate.
- **Tier 1 — slim container.** Anything executing Prime Agent, the plugin,
  environment-sensitive POSIX/Node/Git/socket/probe-wrapper behavior, or the
  launcher/fixture recording-fake safety suites runs inside one run-owned
  plain-Docker container. The non-default `tests/unit_env_*_body.py` files are
  reachable only through the five guarded bridges in
  `tests/test_unit_env_bridges.py`; plain pytest cannot collect their 56
  environment-sensitive test functions.
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

- **Lifecycle control boundary — inert by default.**
  `tests/lifecycle/support.py` generates one non-default `pct-<12hex>`
  workspace plus `pct-<12hex>-t` target and `pct-<12hex>-s` sentinel names.
  Both sandbox names are guarded locally against OpenShell v0.0.116's
  19-character maximum before any adapter call. The run also owns its image,
  labels, deadline, and recursively sanitized mode-0600 JSONL evidence. Failure
  evidence retains the configured-production before/after snapshot hashes when
  the snapshots are available. The destructive boundary
  accepts only exact captured identities after ownership-label and policy
  revalidation; unknown state or refusal stops cleanup and retains evidence.
- **Lifecycle collection — four explicit gates.** The sole live item has the
  exact registered node ID
  `tests/test_lifecycle_destroy.py::test_destroy_only_generated_target`, both
  `lifecycle` and `macos_host` markers, the `lifecycle_scope` fixture, pytest
  `--run-lifecycle`, and the sequencer admission environment set only by
  `scripts/test-all.sh --with-lifecycle`. Mismatch is a collection error.
  Plain pytest, direct `--run-lifecycle`, arbitrary marker expressions, plain
  `test-all`, and deprecated `--with-sandbox` cannot run the observer.

### Host-observer exception registry

Host observers are exceptional because their subject is the real hosting
stack. Every enabled body is individually listed. Recording fakes prove the
control contract but cannot prove OpenShell workspace ownership or the product
host destroy path.

| Observer body | Seam | Marker / fixture | Ownership rule | Status |
|---|---|---|---|---|
| `tests/test_lifecycle_destroy.py::test_destroy_only_generated_target` | `tests/lifecycle/live.py`: OpenShell host control plane + Docker fixture + guarded product proxy | `lifecycle` + `macos_host` / `lifecycle_scope`; exact sequencer + pytest opt-in | Generated non-default workspace and exact `pc-test=true`, `pc-run=<full-id>` labels; captured immutable image ID; exact revalidated finalizer only | Enabled only by `scripts/test-all.sh --with-lifecycle` |
| _none_ | other macOS-only hosting behavior | separate reviewed entry required | Generated exact-owned scope only | Registry empty |

The enabled observer uses a pinned test-only base and tracked no-egress policy,
creates no providers/remotes/credentials, and runs product `destroy --yes`
against only the generated target. A generated OpenShell proxy accepts and
records only the product target get/delete calls with explicit gateway and
workspace. A names-only, read-only configured-production snapshot is hashed
before and after; no policy, annotations, provider data, endpoint, credential,
brain content, or operator-local overlay is retrieved or persisted. Target,
sentinel, workspace, and image cleanup remains exact and non-retrying.

### Whole-suite sequencer

```bash
scripts/test-all.sh                   # tier 0 -> tier 1 -> tier 2
scripts/test-all.sh --with-lifecycle  # tiers 0 -> 1 -> 2 -> one exact host observer
scripts/test-integration.sh           # tier 2 alone
```

The sequencer is deliberately dumb. It runs plain host pytest, exact
`-m container`, then the real integration launcher. Exact `--with-lifecycle`
adds only the registered observer after all three pass. It clears inherited
`PYTEST_ADDOPTS` and `PRIME_CLAW_LIFECYCLE_SEQUENCER` from interpreter checks
and tiers 0–2, then sets sequencer admission only for the exact final child. It
is never retried. `--with-sandbox`, unknown, or ambiguous arguments fail with
exit 64 before any
command or result directory. The sequencer stops at the first failure, prints a
tier summary, and leaves logs and sanitized lifecycle evidence in the gitignored
`.test-results/` directory. Plugin development remains Docker-only: never apply,
check, or probe a candidate against the host/user-global Prime Agent install.

## Local-state rules

- Never commit credential material.
- `.env` files are local; `.env.example` files are the committed templates.
- beads data lives under `.beads/` and syncs via `bd sync`.
