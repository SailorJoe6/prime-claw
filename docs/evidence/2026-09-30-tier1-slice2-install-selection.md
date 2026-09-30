# Evidence — Slice 2: prime-agent install selection + plugin apply/check inside the container

Date: 2026-09-30 (reworked 2026-09-30 after EXPERT BLOCK on 470be98)
Bead: prime-claw-blw.2
Branch: episode/plugin-test-container

**Status: this note describes the REWORKED slice-2 driver.** The original
commit `470be98` was reviewed by EXPERT and BLOCKed (three findings:
stale-source replay, weak probe acceptance, soft probe deadline — report at
`.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice2-470be98-expert-block.md`
in the main repo). The rework repairs exactly those three findings against
the slice-2 artifacts only (`scripts/test-tier1.sh`,
`tests/test_tier1_driver.py`, this note) plus the sanctioned
`EXECUTION_PLAN.md` wording sweep. A fresh EXPERT gate applies to the rework
commit; the `470be98` verdict is invalidated.

## What was delivered (current behavior)

- `.env.example` (committed) + gitignored `.env` selecting EXACTLY ONE of:
  - `PRIME_AGENT_PINNED=<version>` — install a released version via the
    vendor installer (`install.sh`); or
  - `PRIME_AGENT_SOURCE=<abs path>` — every real run rebuilds the fork's
    dist FRESH, packs via the fork's `release:pack`, and stages the
    tarballs into the container over a `file:` URL base.
  The driver fails fast on neither/both selectors, on a missing env file,
  and on a non-absolute/nonexistent/invalid `PRIME_AGENT_SOURCE`.
- `scripts/test-tier1.sh`: real runs execute as a fail-fast ladder —
  docker readiness probe → **source staging (fresh build + pack)** →
  docker image build (cached) → one ephemeral `docker run --rm` that
  installs prime-agent per `.env`, then runs
  `scripts/apply-prime-agent-plugin.sh` and
  `scripts/check-prime-agent-plugin.sh` INSIDE the container against the
  container's real `~/.prime/agent/`. A fork build/pack failure stops
  before the image build and before any container install. The repo is
  bind-mounted read-only at `/workspace:ro`. Flags: `--smoke` (toolchain
  only, no `.env` needed), `--probe`, `--dry-run`, `--rebuild`.
- `tests/test_tier1_driver.py`: 20 tier-0 tests (selection fail-fast,
  container-contract statics, B1 freshness behavior, B2 validator fixtures,
  B3 generated-command contract). `tests/test_tier1_image.py` keeps the
  slice-1 behavioral coverage on `--smoke` (17 tests).
- `DEVELOPERS.md` Testing section documents the driver contract.

## B1 repair — source mode packs FRESH artifacts on every real run

- The driver removes the four pack-consumed dist dirs
  (`packages/{coding-agent,agent,ai,tui}/dist` — the fork build, tsgo +
  asset copies, does NOT clean dist, so removed/renamed source outputs
  would linger) and then runs `npm run build` in the fork, UNCONDITIONALLY,
  on every real source-mode run. Freshness is never inferred from version
  equality, directory existence, or `--rebuild`.
- Fail closed: `set -e` aborts on build/pack failure before the image
  build and before any container install; the final OK line is unreachable
  on failure; `release:pack` wipes its out-dir (`rmSync`) before writing,
  so a failed run can never leave the driver to "fall back" to previous
  artifacts on a later invocation.
- `--dry-run` still performs no build, no pack, and no docker call
  (regression-tested with recording npm/node/docker substitutes).
- Tier-0 behavioral coverage (recording substitutes; no real docker/fork):
  - all dist dirs present + stale leftover file + stale marker → run still
    rebuilds, stale file removed by the driver, packed tarball carries the
    CURRENT source marker;
  - replay: source changed WITHOUT a version change → next run rebuilds
    and packs the changed implementation (`MARKER-A` → `MARKER-B`, same
    version 0.9.8);
  - build failure → nonzero, no pack, docker log shows only the readiness
    `info` probe (no image build, no container run), no OK;
  - pack failure → nonzero, same fail-fast ladder, no OK.

## B2 repair — `--probe` proves the plugin loaded

- Probe stdout/stderr are captured to FILES inside the container
  (`probe.jsonl` / `probe.err`), then validated by a small stdlib-only
  Python validator embedded in the driver as a heredoc (transported into
  the container base64-encoded, decoded to `/tmp/tier1-probe/validate.py`,
  run with the image's python3 against the captured file — file input, no
  pipe reads). The tests extract the exact heredoc and exercise it on the
  host, so the tested code is the shipped code.
- Validation contract: every non-empty stdout line must be a JSON object
  (malformed → fail); exactly one object may match
  `id=loader, type=response, command=get_commands` (missing or duplicated
  → fail; unrelated async JSONL events are skipped, never accepted as the
  reply); `success` must be true; `data.commands` must contain `handoff`,
  `plan`, `implement-spec` each EXACTLY ONCE, every one with
  `sourceInfo.path` under `/root/.prime/agent/extensions/` ending `.ts`.
- The required command set matches the plugin generation under test on this
  branch: `handoff` (handoff-chain.ts) and `plan` + `implement-spec`
  (reviewed-plan.ts; verified by `grep registerCommand`).
- Fixture matrix (host-run against the extracted validator, all asserted
  in tests): valid reply → OK; valid reply with unrelated async events
  before/after → OK; events alone / empty file / malformed JSON /
  `success:false` / empty, partial, or duplicated command lists / wrong
  (host-style) source path / duplicated replies / mismatched reply id →
  all fail nonzero with `probe validation FAILED`, no OK.

## B3 repair — hard probe deadline

- The probe runs under `timeout --kill-after=$PROBE_KILL_GRACE
  $PROBE_DEADLINE` (defaults 60s + 5s; `TIER1_PROBE_DEADLINE` /
  `TIER1_PROBE_KILL_GRACE` scale it down in tests). GNU timeout without
  `--foreground` places the probe in its own process group and signals the
  WHOLE group; `--kill-after` escalates TERM to an unblockable KILL after
  the fixed grace, so a TERM-ignoring probe tree terminates within
  deadline + grace, the container command exits nonzero, and the ephemeral
  `--rm` container teardown reaps anything left.
- B2 coordination: validation reads a completed FILE, never a pipe held by
  a potentially surviving descendant (slice-1 pipe-deadlock lesson).

## Acceptance evidence — reworked driver, real runs (2026-09-30)

### Source mode (`PRIME_AGENT_SOURCE=/Users/jlanders/code/prime-agent`, fork a1faacd53, v0.9.8)

Command: `./scripts/test-tier1.sh --probe` (log:
`/tmp/tier1-rework-source-run.log`). Observed, in order:

- `tier-1 driver: fresh fork build (rm dist dirs; npm run build in
  /Users/jlanders/code/prime-agent)` — the unconditional rebuild ran even
  though dist was fully built from the earlier session.
- Exact pack command (run by the driver, satisfying the plan's "Fork pack
  reproducibility" contract):
  `node /Users/jlanders/code/prime-agent/scripts/pack-prime-agent-release.mjs --base-url file:///stage --out-dir /Users/jlanders/code/prime-agent/packages/coding-agent/release/tier1`
- Four artifacts created. SHA256 hashes (fork
  `release/tier1/artifacts/SHA256SUMS`, recorded durably here):

  | artifact | sha256 |
  |---|---|
  | prime-agent-0.9.8.tgz | 4558b8220361a310a6ceebaab7c006047c5845cad3a782acd7a4efaa0347c5df |
  | prime-agent-ai-0.9.8.tgz | 77b829f819db08d4932d7dd310d86d5681a2afe9b9ed41705bfdd693c6528b66 |
  | prime-agent-core-0.9.8.tgz | d94eea2a1c65ea9e37a99dd37d04acb9630ceb6a9e54a8c000af3b87ff78657c |
  | prime-agent-tui-0.9.8.tgz | 1f2b344faf10ed7d5b94b5678fbc52b0e537e9dea23b555c5727d5c47e0bfe00 |

  Reproducibility observation: the source checkout is unchanged since the
  `470be98` run, and the fresh rebuild+pack reproduced BYTE-IDENTICAL
  artifacts (the primary tarball hash matches the value the EXPERT quoted
  from the retained pre-rework artifacts).
- Container: `npm install -g /stage/releases/v0.9.8/prime-agent-0.9.8.tgz`
  → "added 273 packages in 24s"; `prime-agent --version` → **0.9.8**;
  apply → "prime-claw plugin applied: /root/.prime/agent"; check →
  "prime-claw plugin source is inert and global copy is current:
  /root/.prime/agent".
- Probe: `tier-1 probe validation OK: handoff, plan, implement-spec each
  registered exactly once from /root/.prime/agent/extensions/` — printed
  by the in-container validator after parsing the captured reply.
- Driver printed the OK line and exited 0.

### Pinned mode (`PRIME_AGENT_PINNED=0.9.3`)

Command: `./scripts/test-tier1.sh --probe` (log:
`/tmp/tier1-rework-pinned-run.log`). Vendor installer fetched and
checksum-verified `prime-agent-0.9.3.tgz` from the vendor R2 bucket ("added
190 packages in 20s"); `prime-agent --version` → **0.9.3**; apply/check
green in-container; probe: the same validator OK line.

### B3 deadline demonstration (real image, networkless, no mounts)

The exact probe step was captured argv-faithfully from the driver (fake
docker recording full argv, `TIER1_PROBE_DEADLINE=4`,
`TIER1_PROBE_KILL_GRACE=2`) and executed UNCHANGED in the real
`prime-claw-test-tier1` image with `docker run --rm -i --network none`:

- **Negative**: a synthetic `prime-agent` that ignores SIGTERM and spawns a
  TERM-ignoring descendant holding the output file open → `Killed`
  (exit 137 = 128+SIGKILL), driver-side message `tier-1 probe FAILED
  (exit 137; deadline 4s + kill grace 2s)`, container exited **rc=1**, no
  OK, total wall time **7.7s** including container startup (probe
  terminated within the 4s + 2s deadline+grace).
- **Positive control**: a well-behaved stub emitting a valid reply →
  validator OK, `POSITIVE CONTROL OK`, rc=0.
- After both runs: `docker ps -aq --filter ancestor=prime-claw-test-tier1`
  → empty (no owned container or probe process remains).

### Host untouched

`shasum -a 256` over the 8 managed plugin files + `APPEND_SYSTEM.md` under
the host's `~/.prime/agent/`, captured immediately before and after ALL
rework runs (source, pinned, both demos): identical
(`/tmp/tier1-host-before-rework.sha256` ==
`/tmp/tier1-host-after-rework.sha256`). Containers bind-mount only the repo
read-only and never the host home.

Note: versus the ORIGINAL pre-slice-2 baseline captured earlier the same
day, two managed files differ (`goal-blocker-control.ts` removed,
`spec-episode.ts` changed). That delta matches the operator's announced
host plugin update + restart between sessions (in-session message: "We
have another update to the plugin so I'm going to restart"), not container
writes — the rework-window captures bracketing every container run are
byte-identical.

### Tier-0 gate

- `tests/test_tier1_image.py` + `tests/test_tier1_driver.py`: **50 passed**.
- Full tier-0 gate (bounded command in DEVELOPERS.md): **194 passed in
  18.52s** (174 pre-rework baseline + 20 net new/changed rework tests).

## History

- `470be98` (superseded): initial slice-2 implementation. Its install-path
  evidence (vendor installer behavior, file: staging, apply/check greens,
  happy-path probe reply, host untouchedness) was corroborated by the
  EXPERT and remains valid; its behavioral claims about source freshness,
  probe acceptance, and the probe deadline were BLOCKed and are repaired
  here. Full BLOCK report:
  `.ralph/plans/archive/plugin-test-container/reviews/2026-09-30-slice2-470be98-expert-block.md`.
