# Isolated Prime Agent v0.9.8 candidate — blocked artifact identity

Date: 2026-10-10. Bead `prime-claw-lph` remains **in progress**. This is
candidate-only evidence, not a compatible Prime Claw release, installed-runtime
upgrade, active sandbox recovery, merge, or cutover approval.

## Isolation and build

- Worktree `prime-claw-v098-image-candidate`, branch
  `fix/prime-agent-v098-image-candidate`, started from main
  `599449655f922ec9adcf5a9955c39ec28c93f0d4`. The primary main checkout had
  unrelated plugin-source edits and was not used for the candidate build.
- `python3 -m pytest tests/ -q` in the isolated worktree: **671 passed,
  86 skipped, 75 subtests passed**, 11 existing `load_module()` deprecation
  warnings. Focused runtime tests: **73 passed**. These are host-safe/mock tests,
  not release-artifact identity proof.
- `bin/prime-claw --config <isolated nonsecret config> build` used only unique
  tag `prime-claw-brain:pa098-5dfecec826a6`. Started about 19:06:35 UTC and
  ended about 19:07:34 UTC. The immutable Docker image ID is
  `sha256:b2de8a9d26b4775abe35e6a626a78f5f068396e94626bd299928c74a5fd9e8f1`,
  created 19:07:22 UTC. Its `org.prime-claw.prime-agent-required-version` label
  says `0.9.8`; this image bakes PostgreSQL/Bun/gbrain, **not Prime Agent**.
  The existing `prime-claw-brain:0.1.0` tag and active-v2 container retain image
  ID `sha256:0f705bb681dc2898df15911957106c021e09c78eca9a27605608ef455e56e8c7`.
- The worktree has uncommitted candidate code/config/test changes. They are
  **not approved to merge** until the correct TypeScript v0.9.8 artifact and
  install contract are established and verified.

## Hard blocker: a version string is not an artifact identity

The public vendor URL `https://app.primeintellect.ai/prime-agent/install.sh`
currently serves an `install-rust.sh` whose header identifies a Rust keyword
takeover. A disposable candidate-only Docker container with
`PRIME_AGENT_VERSION=0.9.8` downloaded and installed a **Rust** release to
`/sandbox/.local/share/prime-agent` with launcher
`/sandbox/.local/bin/prime-agent`. Its CLI printed `0.9.8`, but the expected
TypeScript `/sandbox/.npm-global/lib/node_modules/prime-agent/dist/core/kernel/bootstrap.js`
was absent. The first smoke returned 127 only because the new launcher was not
on the existing staging PATH; a second isolated smoke included `.local/bin`
and confirmed that the Rust CLI prints `0.9.8` while finding no TypeScript
`bootstrap.js`. Both disposable containers exited and were removed. Public
`npm view prime-agent@0.9.8` returned HTTP 404. **Do not change the PATH to
accept the Rust binary as a Prime Claw-compatible repair.** A revised,
authoritative TypeScript v0.9.8-r1 release artifact/build contract is needed.
No Tier-1 pinned installer run was attempted after this discovery, because the
same mutable URL could admit the wrong runtime by matching only a version.

## Separate active-v2 incident and boundary

A read-only check found the previously active `prime-claw-v2` OpenShell sandbox
in `Error`; its exact Docker container exited 255/no OOM at
2026-10-10T18:38:28Z. The candidate image build began about 28 minutes **after**
that exit. Its cause is unknown and separately tracked as P0 `prime-claw-4lg`.
No candidate command targeted v2: only read-only `docker inspect` and
`openshell sandbox list` observed it. No active `create`, `converge`, `validate`,
stop/start, plugin apply, user-global installation, merge, or cutover occurred.
Do not mutate v2 or v1 while resolving this artifact blocker.

Next: wait for the Prime Agent Expert's authoritative TypeScript v0.9.8-r1
artifact contract. Then repair only Prime Claw's isolated candidate, prove both
artifact identity and expected JS kernel/daemon contract in disposable tests,
and request a separate decision before any active runtime cutover. Keep
`prime-claw-lph` open until its acceptance is truly complete.
