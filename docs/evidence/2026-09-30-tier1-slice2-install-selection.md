# Evidence — Slice 2: prime-agent install selection + plugin apply/check inside the container

Date: 2026-09-30
Bead: prime-claw-blw.2
Branch: episode/plugin-test-container (rebased onto origin/main 1a0836d at slice-2 start;
see the "Rebase onto main" section of the slice-1 evidence note)

## What was delivered

- `.env.example` (committed) + gitignored `.env` selecting EXACTLY ONE of:
  - `PRIME_AGENT_PINNED=<version>` — install a released version via the
    vendor installer (`install.sh`); or
  - `PRIME_AGENT_SOURCE=<abs path>` — host runs the fork's `release:pack`,
    tarballs are staged into the container over a `file:` URL base and
    installed from them.
  The driver fails fast on neither/both selectors, on a missing env file,
  and on a non-absolute/nonexistent/invalid `PRIME_AGENT_SOURCE`.
- `scripts/test-tier1.sh` extended: the default run builds the image
  (cached), then starts ONE ephemeral container (`docker run --rm`) that
  installs prime-agent per `.env`, then runs
  `scripts/apply-prime-agent-plugin.sh` and `scripts/check-prime-agent-plugin.sh`
  INSIDE the container against the container's real `~/.prime/agent/`. The
  repo is bind-mounted read-only at `/workspace:ro` (the plugin source under
  `src/prime-agent-plugin/` is therefore read-only, as the plan requires,
  and the apply/check scripts run unmodified from `/workspace`). Flags:
  `--smoke` (slice-1 toolchain smoke, no `.env` needed), `--probe` (append a
  container-side RPC `get_commands` probe), `--dry-run`, `--rebuild`.
- `tests/test_tier1_driver.py` (new, 13 tier-0 tests): `.env.example`
  completeness, `.env` gitignored, container-contract statics, selector
  fail-fast behavior (neither/both/missing-env/bad-source), dry-run plans
  for both modes (never invoke docker, never execute the fork's pack
  script), and a pinned positive control asserting the exact
  info→build→run docker sequence and the run command's contract.
- `tests/test_tier1_image.py`: slice-1 behavioral driver tests moved to
  `--smoke` (same real execution path: info→build→run), since the default
  run now requires install selection.
- `DEVELOPERS.md` Testing section documents the slice-2 driver contract.
- Plan correction (recorded in `.ralph/plans/EXECUTION_PLAN.md`): the plan
  said pinned mode installs "from npm registry". Observation: `npm view
  prime-agent versions` returns `E404` — `prime-agent` is not on the public
  npm registry; releases are served from the vendor's download base. The
  pinned path therefore uses the vendor installer exactly as
  `bin/prime-claw` does (`PRIME_AGENT_VERSION`, `PRIME_AGENT_INSTALLER_PLAIN=1`,
  `PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL=0`).

## Network policy

Used only at image build and the in-container prime-agent install step
(`npm install -g` of the staged tarball in source mode; `curl install.sh | sh`
in pinned mode). apply/check/probe need no network.

## Acceptance evidence — source mode (PRIME_AGENT_SOURCE=/Users/jlanders/code/prime-agent)

Command: `./scripts/test-tier1.sh --probe` (host: macOS, Docker 29.6.2;
fork at a1faacd53, version 0.9.8). Full log: the driver built the fork's
dist (`npm run build`), ran `release:pack --base-url file:///stage` into
the fork's gitignored `packages/coding-agent/release/tier1` (the pack
script refuses out-dirs outside its release tree — observed on the first
attempt and routed around by staging there), producing:

- prime-agent-0.9.8.tgz, prime-agent-ai-0.9.8.tgz, prime-agent-core-0.9.8.tgz,
  prime-agent-tui-0.9.8.tgz

Container run (`docker run --rm -v <repo>:/workspace:ro
-v <fork>/packages/coding-agent/release/tier1/artifacts:/stage/releases/v0.9.8:ro`):

- `npm install -g /stage/releases/v0.9.8/prime-agent-0.9.8.tgz` →
  "added 273 packages in 40s" (internal workspace deps resolved via the
  staged `file:` URLs; external deps from the registry — install step only)
- `prime-agent --version` → **0.9.8** — matches the fork's version
- `apply-prime-agent-plugin.sh` → "prime-claw plugin applied:
  /root/.prime/agent"
- `check-prime-agent-plugin.sh` → "prime-claw plugin source is inert and
  global copy is current: /root/.prime/agent" (byte-for-byte `cmp` checks
  inside the script pass against the container's real `$HOME/.prime/agent`)
- Container-side RPC probe (no `--no-extensions`; the container's real
  installed extensions load): request `{"id":"loader","type":"get_commands"}`
  returned `success:true` with the plugin's native commands, each sourced
  from the container install:
  - `handoff` ← `/root/.prime/agent/extensions/handoff-chain.ts`
  - `plan`, `implement-spec` ← `/root/.prime/agent/extensions/reviewed-plan.ts`
  This is the probe pattern that deadlocked the host suite in the slice-1
  incident (see the slice-1 evidence note); inside the throwaway container
  it completed normally under a `timeout 60` deadline.

## Acceptance evidence — pinned mode (PRIME_AGENT_PINNED=0.9.3)

Command: `./scripts/test-tier1.sh` with `.env` containing
`PRIME_AGENT_PINNED=0.9.3` (the version `bin/prime-claw` installs by
default). Observed:

- The vendor installer ran in the container (`PRIME_AGENT_VERSION=0.9.3
  PRIME_AGENT_INSTALLER_PLAIN=1 PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL=0;
  curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh`):
  downloaded `prime-agent-0.9.3.tgz` from the vendor's R2 release bucket,
  verified its checksum ("prime-agent-0.9.3.tgz: OK"), installed ("added 190
  packages in 24s").
- `prime-agent --version` → **0.9.3** — matches the pin.
- `apply-prime-agent-plugin.sh` → "prime-claw plugin applied:
  /root/.prime/agent".
- `check-prime-agent-plugin.sh` → "prime-claw plugin source is inert and
  global copy is current: /root/.prime/agent".
- Driver printed the OK line and exited 0; the ephemeral container was
  destroyed (`--rm`).

## Host untouched

`shasum -a 256` over the 8 managed plugin files + `APPEND_SYSTEM.md` under
the host's `~/.prime/agent/`, taken before and after the container runs:
identical (no diff). The container never mounts the host `$HOME`; its
prime-agent state lives only in the ephemeral container's `/root`.

Checksums were captured to `/tmp/tier1-host-before.sha256`,
`/tmp/tier1-host-after-source.sha256`, and `/tmp/tier1-host-after-pinned.sha256`
(ephemeral capture files); `diff` between before/after-source and
before/after-pinned produced no output (identical). One example line (the
handoff-chain entry point) for spot verification:

```
debd42d40ba1c9a9ba23607c0e2f25e8505e6ef640cedfb62d8bffbe8d61ceb6  extensions/handoff-chain.ts
```

## Tier-0 gate

`tests/test_tier1_image.py` + `tests/test_tier1_driver.py`: 30 passed.
Full tier-0 gate (bounded command in DEVELOPERS.md): `tests/test_tier1_image.py` + `tests/test_tier1_driver.py`: 30 passed.
Full tier-0 gate (bounded command in DEVELOPERS.md): **174 passed in
9.79s**. Observation: one intermediate gate run showed the known
timing-flake `test_embedding_candidate_build.py::test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero`
(also seen during slice-1 rework); it passed standalone (2.18s) and in the
final re-run. The slice-2 diff touches no embedding code — same pre-existing
host flake recorded in the slice-1 evidence note, not a slice-2 regression..
