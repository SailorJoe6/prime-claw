# Evidence — Slice 3: tier markers, session container fixture, tier-1 migration, dumb sequencer

Date: 2026-09-30
Bead: prime-claw-blw.3 (final slice of epic prime-claw-blw)
Branch: episode/plugin-test-container

## What was delivered

- **`pytest.ini`** — registers the `container` (tier 1) and `sandbox`
  (tier 2) markers; unmarked tests are tier 0.
- **`tests/conftest.py`** — the tier policy lives here:
  - `pytest_collection_modifyitems` auto-marks any test requesting the
    `tier1_container`/`ctmp`/`croot` fixtures as `container`, and skips
    tier-1/tier-2 tests unless pytest was invoked with an explicit `-m`
    mark expression. Plain `pytest tests/ -q` is therefore always the
    tier-0 default with **no Docker dependency** (the fixture is never
    instantiated for skipped tests).
  - `tier1_container` (session-scoped): ONE container per pytest run that
    includes container tests. Mirrors the driver contract
    (`scripts/test-tier1.sh` is the source of truth): same `.env`
    selection semantics (exactly one of `PRIME_AGENT_PINNED` /
    `PRIME_AGENT_SOURCE`, `TIER1_ENV_FILE` override, fail fast on
    neither/both), same fail-fast ladder (docker readiness → source
    staging → image build → container run), same install commands
    (vendor installer for pinned; fresh fork `release:pack` for source),
    then plugin apply + check against the container's own
    `~/.prime/agent/`, once per session. Destroyed at session end
    (`docker rm -f`), plus a per-test scratch cleanup.
  - Exec helper API: `run()` (in-container `timeout --kill-after` hard
    deadline on every command — the slice-1/B3 lesson), `popen()`
    (interactive RPC drivers), `start_daemon()` (in-container fake
    daemon), `read_repo()` (reads from `/workspace`, never the host),
    `read_text`/`write_text`/`exists`/`mkdir_p`/`symlink` (share-aware).
  - `ctmp` (function-scoped): per-test scratch on the session share —
    a directory bind-mounted at the SAME absolute path on host and
    container, so paths embedded in probe sources and daemon protocol
    payloads resolve identically in both.
  - `croot` (function-scoped): per-test scratch on CONTAINER-LOCAL
    storage (see "Findings" below for why this exists).
  - `TIER1_KEEP_SHARE=1` preserves the session share for post-mortem
    debugging (used during this slice's failure investigation).
- **`tests/container/`** — committed container-side helpers (compile-
  checked in tier 0, executed in place via `/workspace`):
  - `fake_daemon.py` — union of the two former host-side fake daemons
    (publication + discovery flavors; `--route` selects the fake route),
    protocol 7 / schema 28, logs every envelope and response as JSONL on
    the share for host-side assertions.
  - `sigterm_orphan_probe.py`, `concurrent_apply_probe.py` —
    self-verifying runners for the two append-manager scenarios whose
    pipe/pass_fds/flock choreography cannot cross a `docker exec`
    boundary; they operate on container-local `/tmp` and print a JSON
    verdict.
- **Migration** — the tier-1 inventory now runs node/prime-agent
  subprocesses INSIDE the container:
  - `test_handoff_chain_extension.py`, `test_reviewed_plan_extension.py`,
    `test_project_conversation_extension.py`,
    `test_goal_blocker_control_extension.py`,
    `test_conversation_oversight_native.py`,
    `test_reviewed_plan_native_discovery.py`,
    `test_prime_agent_plugin_install.py` (converted from unittest to
    pytest style; `subTest` loops became `parametrize`).
  - Tier assignment is per-test: static repo checks in those files stay
    tier 0 and run in the default gate.
  - No tier-1 test code resolves host binaries; a tier-0 static guard
    (`test_container_helpers_static.py`) fails if
    `shutil.which("prime-agent")` / `shutil.which("node")` ever reappears
    in any test file.
- **Node-suite bridges** — every committed `tests/*.test.mjs` suite now
  has a pytest bridge running it in-container. The planning inventory
  flagged only `episode_close_extension.test.mjs` as unbridged; the
  re-audit found `project_conversation_extension.test.mjs` was also
  unbridged. **Decision: both bridges added** (trivial container execs;
  the alternative — documenting them as permanently unbridged — would
  leave real node coverage invisible to the suite). A tier-0 static test
  (`test_every_node_suite_has_a_pytest_bridge`) now fails if any future
  `.test.mjs` suite lands without a bridge.
- **`scripts/test-all.sh`** — dumb sequencer: tier 0 → tier 1 → (tier 2
  only on explicit `--with-sandbox`), fail-fast, prints a tier summary,
  logs to the gitignored `.test-results/` results directory. bash-3.2
  safe. Tier-1 preflight gives a clear message when Docker or `.env` is
  missing instead of per-test fixture errors.
- **`tests/test_runtime_*.py`** — marked `sandbox` (tier 2); they stay
  host-orchestrated and out of default runs, as before.
- **`config/requirements-inventory.json`** — new R-T1-1..R-T1-5 entries
  covering slices 1-3 (image+driver, install selection, markers+policy,
  fixture+migration, sequencer) per the apply/check/validate/test
  discipline; `tests/test_inventory_integrity.py` stays green.
- **DEVELOPERS.md** — Testing section rewritten for the final tier state
  (markers, `.env` setup, per-tier commands, sequencer).

## Findings from the migration (durable lessons)

1. **A host-bound Unix socket is unreachable from the container through
   the macOS gRPC-FUSE/virtiofs share** (connect(2) → EOPNOTSUPP, spiked
   directly). The fake daemons therefore run in-container
   (`tests/container/fake_daemon.py`), binding container-local sockets and
   logging to the share; the host tests reconstruct envelopes/responses
   from the logs via the `ContainerDaemon` shim.
2. **Node `fs.cpSync` fails with EACCES on the share when the copy SOURCE
   is a guest-created file** (its create-write-only-then-chmod pattern;
   the chmod is refused for files whose gRPC-FUSE ownership xattr was
   written by a previous guest-side copy). The plugin's
   `promoteBundle` does exactly such a two-stage copy. Matrix proven
   in-container: host-created source → OK (any parent); guest-created
   source → EACCES (any parent). So git-heavy episode flows
   (worktrees + promoteBundle) run on container-local `/tmp` via the
   `croot` fixture; only plain append/read artifacts stay on the share.
   Plain `chmod`, `cp`, `install`, `rm -rf`, git worktree add/commit all
   work fine on the share — the failure is specific to Node cpSync's
   chmod pattern.
3. **The migration surfaced a stale daemon-trace assertion** (real
   test/plugin drift): `assert_creation_trace` expected the creation-path
   handoff prompt to have no `streamingBehavior` and `queueIfBusy: false`,
   but `376bc2b` ("fix(episodes): queue bootstrap behind preparation",
   the automatic-preparation admission-race fix) deliberately changed the
   creation path to queue the handoff with `streamingBehavior:
   "followUp"`, `queueIfBusy: true` — updating the node suite
   (`spec_episode_extension.test.mjs`) but not this pytest assertion,
   which was invisible because the file was excluded from the host gate.
   The assertion now matches the current reviewed contract; owner
   continuations still use the fail-closed ordinary prompt (default
   `queueHandoffIfBusy=false`, covered by the node suite).

## Acceptance evidence

- **Tier-0 default, no Docker dependency**: `python3 -m pytest tests/ -q`
  → **222 passed, 141 skipped in ~21s**. (222 = the previous 194-test
  bounded gate + 22 static tests from the migrated files + 6 new tier-0
  statics; 141 skipped = 34 container + 107 sandbox-marked runtime
  tests.) Skips happen at collection; the container fixture never starts,
  so no Docker daemon is touched.
- **Full tier-1 suite in ONE container**:
  `python3 -m pytest tests/ -q -m container` (pinned `PRIME_AGENT_PINNED=0.9.3`)
  → **34 passed in 122s**. One session container: cached image build,
  vendor-installer 0.9.3, apply+check, all tests, destroyed at session end
  (`docker ps -aq --filter name=prime-claw-tier1-session` empty after).
- **Source mode** (`PRIME_AGENT_SOURCE=/Users/jlanders/code/prime-agent`,
  fresh `npm run build` + `release:pack` per the B1 contract): see the
  source-mode section below.
- **Sequencer end-to-end**: `scripts/test-all.sh` →
  `tier0: PASS (21s)`, `tier1: PASS (128s)`, `test-all: OK`; logs in
  `.test-results/<timestamp>/`.
- **Host plugin untouched**: sha256 over the 8 managed plugin files +
  `APPEND_SYSTEM.md` under the host's `~/.prime/agent/` identical before
  and after all slice-3 container runs
  (`/tmp/tier1-host-before-slice3.sha256` ==
  `/tmp/tier1-host-after-slice3.sha256`).
- **Inventory integrity**: `tests/test_inventory_integrity.py` green with
  the R-T1-* entries (all `proven_by` paths exist).

## Source mode

`PRIME_AGENT_SOURCE=/Users/jlanders/code/prime-agent` (fork v0.9.8): the
session fixture ran the B1 fresh-build contract (removed the four
pack-consumed dist dirs, `npm run build`, `release:pack`, staged over
`file:///stage`) and the full suite passed in ONE container:
**34 passed in 139s**. During this run the concurrently-executed tier-0
gate showed a single transient failure in
`tests/test_embedding_candidate_build.py::test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero`
— the documented pre-existing timing flake, under fork-build CPU load;
the gate re-run immediately after was green (222 passed). Pinned and
source modes both carry the full migrated suite.

Note: the two `native_discovery` lifecycle tests exercise prime-agent
runtime internals (session `forkFrom`, from the fork-support era). They
pass against both the pinned 0.9.3 vendor release and the fork — the
failures seen during migration were the gRPC-FUSE cpSync issue and the
stale trace assertion, NOT version coupling.

## Container/artifact hygiene

- `docker ps -aq --filter name=prime-claw-tier1-session` empty after every
  session run (fixture teardown `docker rm -f`).
- `.test-results/` (session share, per-run logs) is gitignored; debug
  scratch from the failure investigation was removed.
- The scratch-space patched plugin copy used to extract the EACCES stack
  lived only under `.test-results/` (never the repo, never the host
  plugin) and was deleted with it.

## Merge reconciliation (goal-heartbeat-work-control merge, 9b3edd2)

Mid-slice, `main` advanced through the goal-heartbeat-work-control merge
(`a6a55bc` → `9b3edd2`): the plugin generation changed
(`extensions/goal-blocker-control.ts` deleted,
`extensions/goal-heartbeat-work-control.ts` added; apply/check scripts
updated), `tests/test_goal_blocker_control_extension.py` was deleted and
`tests/test_goal_heartbeat_work_control_extension.py` +
`tests/goal_heartbeat_work_control_extension.test.mjs` were added, and
`tests/test_prime_agent_plugin_install.py` gained the new-generation
FILES list plus generalized obsolete-file cases.

Per the plan's merge-reconciliation watch item, the branch was rebased
onto `9b3edd2` and the inventory re-audited against the assignment RULE
(needs node / prime-agent binary / plugin install → tier 1):

- `test_goal_blocker_control_extension.py`: accepted main's deletion
  (its target extension no longer exists; its assertions about
  `pause_thread_goal`/`resume_thread_goal` are obsolete by design).
- `test_goal_heartbeat_work_control_extension.py` (new, from main): the
  node-suite bridge invoked host node → migrated to the container fixture
  (tier 1); the two source-contract tests stay tier 0.
- `test_prime_agent_plugin_install.py`: the rebase conflict was resolved
  by keeping the container migration and porting main's three semantic
  changes into it (new FILES generation; two-case obsolete-files test;
  new unsafe-obsolete-goal-extension test), preserving the pytest style
  and parametrize conversion.
- The R-T1-4 inventory entry's test list was updated to the new
  generation's file (integrity test caught the stale reference — the
  discipline working as designed).
- The new `.test.mjs` suite is bridged (container exec); the
  every-node-suite-has-a-bridge static guard covers it.

Post-rebase acceptance (all on the reconciled branch):

- `python3 -m pytest tests/ -q` (tier-0 default): **223 passed,
  144 skipped in ~21s**, no Docker dependency.
- `python3 -m pytest tests/ -q -m container` (pinned 0.9.3): **37 passed
  in 118s** in ONE session container — now including the
  goal-heartbeat node suite and the new-generation install tests.
- `scripts/test-all.sh`: tier0 PASS (19s), tier1 PASS (115s), OK.
- Host `~/.prime/agent` untouched across every run (sha256 over the
  managed files + APPEND_SYSTEM.md; note the operator updated the host
  plugin to the goal-heartbeat generation mid-session, so the managed
  file set itself changed on the host — the before/after captures across
  each slice-3 run window were identical).

## Docs-conversion step (terminal policy) — satisfied by DEVELOPERS.md

The execute skill's completion policy asks whether the spec has been
converted into `docs/` documentation describing the new project state
before the bundle is archived. For this bundle the approved plan named
**DEVELOPERS.md as the doc home** for the tier model, and slice 3 already
delivered that conversion: DEVELOPERS.md's "Testing" section was rewritten
to document the three tiers, marker-based tier assignment, the auto-mark /
default-skip policy (plain `pytest tests/ -q` is always the Docker-free
tier-0 default), the session container fixture, and `scripts/test-all.sh`.
The evidence trail itself lives in `docs/evidence/` (this note plus the
slice-1 and slice-2 notes), which is the established evidence convention.
No separate `docs/` page is needed; archiving the bundle makes
DEVELOPERS.md's "Testing" section the canonical operator-facing reference,
and its spec pointer was repointed to
`.ralph/plans/archive/plugin-test-container/SPECIFICATION.md` in the
archival commit.

## Final-expert-block repair (c53972f review → this commit)

The FINAL EXPERT gate on `c53972f` returned **BLOCK** with three findings
(full report preserved in the main repository at
`docs/evidence/2026-09-30-tier1-final-expert-review-c53972f.md`, to be
folded into the archive bundle's `reviews/` at merge time). All three are
repaired in this commit; scope was limited to `tests/conftest.py`, the new
behavioral tests, the archive index, the inventory, and this note.

### B1 — fixture source staging is now fail-closed (was P2, 10/10)

`tests/conftest.py:_stage_fork_release` no longer removes the four
pack-consumed dist trees with `shutil.rmtree(ignore_errors=True)`. The new
`_remove_dist_tree` mirrors the driver's `rm -rf` under `set -e`
(`scripts/test-tier1.sh:258-265`): absence is fine; symlinks/plain files
are unlinked (never recursed); directories are removed recursively; any
permission/IO/type error raises, stopping the run BEFORE
build/pack/image-build/container creation. Behavioral coverage in
`tests/test_tier1_fixture.py` exercises the ACTUAL fixture path with
recording npm/node substitutes (never real Docker, never a real build):

- `TestStageForkRelease`: stale outputs removed + current source packed;
  replay after a source change WITHOUT a version change packs the changed
  implementation; cleanup denial (0555 `retired-module/` with an obsolete
  compiled file) stops before build/pack with the stale tree untouched;
  build failure fails closed before pack; pack failure fails closed
  without fallback artifacts; missing dist trees stay a valid positive
  case.
- `TestRemoveDistTree`: absent / plain-file / symlink / permission-denied
  semantics of the removal primitive itself.
- `TestDryRunEquivalent`: a default `pytest tests/ -q` invocation skips
  every fixture user at collection (behavioral, via the real
  `pytest_collection_modifyitems` hook), and the fixture's docker skip
  guards structurally precede the single `_stage_fork_release` call site —
  the fixture-level dry-run-equivalent performs no build/pack/docker call.

### B2 — container teardown is verified and part of the gate (was P2, 10/10)

The session fixture finalizer no longer fire-and-forgets `docker rm -f`.
Teardown now goes through `_remove_session_container`: exactly one forced
removal plus one `docker inspect` absence verification, both scoped to the
one captured container ID — no docker-wide pruning, no name-based guesses,
no retries, bounded timeouts. Semantics:

- removal OK + absence verified → success (and only then is the session
  share removed — share evidence is never deleted while a container may
  still own it);
- removal nonzero + absence verified → idempotent success (already absent);
- removal nonzero/timeout/launch failure without verified absence, a
  still-present container after "successful" removal, or ANY timeout →
  `RuntimeError` with the exact container identity and full diagnostics,
  so the gate can never go green with a leaked container;
- when a setup/test failure is already in flight, the teardown failure is
  attached to it via `add_note` so BOTH surface;
- the session container name is now unique per run
  (`prime-claw-tier1-session-<pid>-<epoch>`), so a later run never
  collides with — or inherits — a failed run's leftover.

`tests/test_tier1_fixture.py::TestSessionTeardown` covers the acceptance
matrix with a recording docker substitute: positive
setup/body/teardown proves absence (`rm -f` then `inspect`, in order);
removal-nonzero and timeout fail the gate and retain identity +
diagnostics + share evidence; unpublished container means zero docker
calls; setup-failure + teardown-failure preserves both errors;
already-absent is idempotent; unrelated containers are never targeted;
`TIER1_KEEP_SHARE=1` still preserves the share. Static guards pin the
unique-name construction and the absence of docker-wide operations.

Fresh no-leftover-containers check (this repair pass ran NO container
workloads — tier-0 gate plus fake-docker behavioral tests only):

```
$ docker ps -a --filter name=prime-claw-tier1-session
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

(empty — no tier-1 session containers remain.)

### B3 — archive index states the verified acceptance split (was P2, 10/10)

`.ralph/plans/archive/README.md` no longer claims the full tier-1 suite
passes "for both install modes (37 passed)". The entry now records the
verified split exactly as this note does: source mode **34 passed/139s
BEFORE the merge reconciliation**, pinned mode **37 passed/118s AFTER
reconciliation**, and the post-reconciliation source-mode gate NOT
claimed. The valid pre-reconciliation 34-test source result is preserved,
not erased.

### Hygiene (from the same review, non-blocking)

- (a) The five R-T1-* `plan` references in
  `config/requirements-inventory.json` now point to the archived spec
  (`.ralph/plans/archive/plugin-test-container/SPECIFICATION.md`); the new
  `tests/test_tier1_fixture.py` is listed under R-T1-3 (default-skip
  policy) and R-T1-4 (session fixture) `proven_by`.
- (b) The new blank line at EOF in
  `tests/test_reviewed_plan_native_discovery.py` is removed
  (`git diff --check` clean).
- (c) The historical slice-3 host checksum captures referenced above
  (`/tmp/tier1-host-{before,after}-slice3.sha256`) name the obsolete
  `goal-blocker-control.ts` generation (8 managed files) and omit the
  current `goal-heartbeat-work-control.ts`; they remain as HISTORICAL
  RECORD of their run windows and are not rewritten. The current-generation
  hash check is the fresh evidence for the final review window — captured
  read-only in this repair pass (repair ran no container workloads, so
  host state is trivially untouched):

```
8faa7537a1f177327177c796287d6d36ab50df624f8c5552906f50ca6437d595  extensions/goal-heartbeat-work-control.ts
debd42d40ba1c9a9ba23607c0e2f25e8505e6ef640cedfb62d8bffbe8d61ceb6  extensions/handoff-chain.ts
1c7c5a9870c3a23c7f1bec8facdab8471e5290ee4a41991e8d5dab7bc5488b22  extensions/reviewed-plan.ts
07d376b1bfad0b0cd4af8d8cd298b2a6e94a35e5f46bea1c69a17031b208a714  extension-support/conversation-oversight.ts
a40953bb802242c4dbeb698627ea1a0886e1ded8a73f3ffe66bec56a952a2732  extension-support/episode-close.ts
a85fde2479c5b3cf5d2f28cfb33eefad413abeed6a16397236df9de322b4cb08  extension-support/handoff-prompts.ts
a4230f9aded32585f778a82ddd3b659deea513507a14d0c742cc656eb58bf107  extension-support/reviewed-plan-support.ts
071fad769058b82e92e2615d6092bf73e052e74025141ad48e149057577296d4  extension-support/spec-episode.ts
fea6c335b95dc688ed9c16b4830db4da63b15af3dd19a5420a75de54601d9b1b  APPEND_SYSTEM.md
```

  Both obsolete files confirmed absent on the host:
  `extensions/goal-blocker-control.ts`,
  `extension-support/episode-finalization.ts`.

### Post-repair tier-0 gate

`python3 -m pytest tests/ -q` → **249 passed, 144 skipped** in ~39s
(249 = the 222-test post-reconciliation gate + 27 new fixture behavioral
tests; skips unchanged). The single failure was again the documented
pre-existing timing flake
`test_embedding_candidate_build.py::test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero`,
green on immediate standalone re-run (1 passed in ~2s) — unchanged
test/subject code, host-only watchdog timing, unrelated to this repair
(the repair touches no sandbox/watchdog code).
