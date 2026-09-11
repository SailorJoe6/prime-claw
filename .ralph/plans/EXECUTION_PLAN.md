# EXECUTION PLAN — Phase 2: Sandbox Runtime Foundation

> Index: [SPECIFICATION.md](SPECIFICATION.md) · [REQUIREMENTS.md](REQUIREMENTS.md) · [DECISIONS.md](DECISIONS.md)
> Status: ACCEPTED (2026-09-11). Operator confirmed slice order (status-first)
> and Slice 6 retirement of the consolidated `*-phase1-*` scripts.
> Governs bead `prime-claw-qcd`. Builds on the archived Phase 1 de-risk gate
> (.ralph/plans/archive/phase1-derisk-gate/). Phase 2 turns the Phase 1 spike
> tooling into ONE reliable, repeatable sandbox lifecycle behind a single
> operator entry point, optimized for the operator-agent's diagnose/recover loop.

## Operating rules for every slice

- **Native OpenShell primitives (D2-1, R2-A-3):** the lifecycle composes
  `openshell sandbox create/exec`, `openshell policy set`, and providers-at-create
  as designed. No docker-compose/entrypoint mapping; no container entrypoint hook.
- **Converge-script-heavy (D2-2):** repeatability lives in an orchestrator over
  ordered, idempotent stages. Each stage is safe to re-run, skips work already
  done, and is individually runnable for targeted diagnosis.
- **Reuse, don't rebuild (D2-5):** Phase 1's proven apply/check/validate
  scripts, the brain Dockerfile, and the policy are the *substance* of each
  stage. Phase 2 consolidates and hardens them under the entry point; it does
  not discard working proofs.
- **Credential isolation (R2-X-1, R2-X-2, R2-X-3):** providers-at-create only;
  placeholders only on disk; no Keychain/browser access; non-secret config
  committable, values never; parameterized per operator; pin the `openshell`
  gateway (17670), never the stale `nemoclaw` registration.
- **Artifact conventions (R2-X-4):** every capability ships with lifecycle code
  under `bin/` + `scripts/runtime/`, acceptance validators, pytest coverage, and
  `config/requirements-inventory.json` entries tracing requirement → validator.
- **Built for the agent's recovery loop (D2-3):** diagnosability and codified
  recovery are first-class, not afterthoughts.
- **Landing:** each slice ends committed, pushed, `bd` current, suite green.

## Approach: consolidate Phase 1 into `bin/prime-claw`

The proven Phase 1 scripts keep their substance but are reorganized under the
lifecycle. Target layout (refined as slices land):

- `bin/prime-claw` — the single entry point (Python 3 stdlib CLI; verbs below).
- `scripts/runtime/` — the stage + verb implementations it orchestrates
  (consolidated from `scripts/apply-phase1-*.sh` / `check-phase1-*.sh`).
- `scripts/lib/` — shared helpers (existing `npm-onload.js`, new shared shell/py).
- `policies/runtime.yaml` — consolidated policy (from `phase1-sandbox.yaml`).
- `docker/runtime.Dockerfile` — the runtime image (from `phase1-brain.Dockerfile`).
- `config/runtime.json` — non-secret, parameterized config (gateway host/paths,
  model IDs, image tag, sandbox name) with env-var overrides (R2-X-2).
- `docs/runbook.md` — failure signature → recovery command (Slice 5).

Phase 1 artifacts stay until their capability is migrated and covered, then are
removed in the final consolidation slice so one obvious path remains.

## Vertical slices

### Slice 1 — `bin/prime-claw` skeleton + `status` (the observable foundation) ✅ DONE (2026-09-11)

Build the entry point and the read-only backbone first, so every later slice is
diagnosable from day one.
- `bin/prime-claw` Python CLI with the verb surface (`create`, `converge`,
  `status`, `validate`, `destroy`, `recover`), argument parsing, `--dry-run`,
  and clear stage/failure output.
- `config/runtime.json` + env-var overrides (non-secret, parameterized).
- `status`: probes and reports actual-vs-expected for each component — selected
  gateway (pins `openshell`, flags `nemoclaw`), sandbox present + image tag,
  policy version, provider attached, PG up, gbrain serving, prime-agent daemon
  healthy, model reachable. Read-only.
- Works against the existing live Phase 1 sandbox (it has real state to read).
- Value: one-command diagnosis of the runtime.
- Tests: `tests/test_runtime_status.py` (CLI parsing, probe shaping, dry-run).
- Inventory: R2-A-1, R2-A-3, R2-A-4, R2-C-1 (partial), R2-X-3.

### Slice 2 — Image stage (reproducible build)

Make the runtime image build reproducible and idempotent.
- Migrate `docker/phase1-brain.Dockerfile` → `docker/runtime.Dockerfile`;
  prefer a real `$ZBRAIN_SRC/templates` (the git-history restore is a fallback
  only); record the image tag + build inputs.
- `bin/prime-claw build` (image stage): builds/tagged the image idempotently
  (skip if the tag already exists and inputs unchanged, unless `--force`).
- Value: the image is a reproducible artifact, not a hand-built one-off.
- Tests: `tests/test_runtime_image.py` (Dockerfile shape, build-arg handling,
  dry-run).
- Inventory: R2-B-1, R2-X-5.

### Slice 3 — Create + converge (the repeatable core)

The heart of Phase 2: sandbox create-with-providers, prime-agent, brain, and
baseline layout as idempotent stages orchestrated by `converge`.
- Migrate `apply-phase1-{sandbox,providers,prime-agent,brain,spawn}.sh` into
  `scripts/runtime/` stages, made idempotent (each checks-then-acts).
- `bin/prime-claw create` — fresh bring-up: image stage → `sandbox create` with
  providers attached **at create** → prime-agent → brain → baseline layout
  (`models.json`, npm-onload, spawn target — eliminating Phase 1's manual
  re-staging) → policy apply.
- `bin/prime-claw converge` — re-run all stages against an existing sandbox;
  refreshes policy without needless recreate; lands in the same known-good state.
- Consolidate `policies/phase1-sandbox.yaml` → `policies/runtime.yaml`.
- Value: one command from fresh (or degraded) to fully-running, no manual steps.
- Tests: `tests/test_runtime_converge.py` (stage idempotency, ordering, dry-run).
- Inventory: R2-A-2, R2-B-2..5, R2-X-1, R2-X-2.

### Slice 4 — Validate + version recording (the acceptance gate)

End-to-end acceptance as a first-class verb, with recorded versions.
- `bin/prime-claw validate` orchestrates the acceptance suite (consolidated from
  `validate-phase1-*.py`): sandbox present, deny-by-default egress, daemon
  healthy, persistent REPL, credentialed model call, brain serving
  (search/query + embedding), spawn/reap.
- Records versions (OpenShell, prime-agent, image, PG/pgvector, gbrain) into the
  evidence output so the runtime is re-validatable after substrate changes.
- Value: a single green/red acceptance gate for the whole runtime.
- Tests: `tests/test_runtime_validate.py`.
- Inventory: R2-C-2, R2-X-5.

### Slice 5 — Recover + runbook (the operability slice)

Codify the Phase 1-discovered recovery moves; prove degrade-and-recover.
- `bin/prime-claw recover [--signature S]`: detects/handles the known
  degradations — VPN-flap gateway/container bounce (`brew services start
  openshell` + re-converge), `active_gateway` flip (re-pin `openshell`),
  recreate-induced `/sandbox` wipe (re-run the create stages), cold-daemon spawn
  retry (socket-wait + retry).
- `docs/runbook.md`: each observed failure signature → its recovery command.
- Demonstrate a degrade-and-recover cycle: induce a known degradation, run
  `recover`, `validate` returns green.
- Value: recovery is codified, not tribal.
- Tests: `tests/test_runtime_recover.py`.
- Inventory: R2-C-3, R2-C-4, R2-C-5.

### Slice 6 — Destroy + consolidation + close-out

Safe teardown, remove the superseded Phase 1 scripts, finish the record.
- `bin/prime-claw destroy [--yes]`: safe, confirmed teardown of the sandbox (and,
  optionally, the image) — non-destructive by default, explicit confirm to mutate.
- Remove the consolidated `*-phase1-*` scripts/tests/policies/docker now covered
  by the lifecycle; keep one obvious path. Update `docs/derisk/` references.
- Final inventory trace (all R2-* to validators), LONG_RANGE_PLAN Phase 2
  checkboxes, close bead `prime-claw-qcd` with links.
- Value: teardown is safe and the repo carries one obvious runtime path.
- Tests: `tests/test_runtime_destroy.py`.
- Inventory: R2-A-1 (destroy), R2-X-4, R2-X-6 (host-PG-exposure decision documented).

## Requirement coverage check

| Requirement | Slice |
|-------------|-------|
| R2-A-1 entry point | 1 (skeleton) + 6 (destroy) |
| R2-A-2 converge idempotent | 3 |
| R2-A-3 native primitives | 1, 3 |
| R2-A-4 stages individually runnable | 1, 3 |
| R2-B-1 image stage | 2 |
| R2-B-2 sandbox+providers at create | 3 |
| R2-B-3 prime-agent stage | 3 |
| R2-B-4 brain stage | 3 |
| R2-B-5 baseline-layout stage | 3 |
| R2-C-1 status | 1 |
| R2-C-2 validate | 4 |
| R2-C-3 recover codified | 5 |
| R2-C-4 runbook | 5 |
| R2-C-5 degrade-and-recover demo | 5 |
| R2-X-1 credential isolation | 3 (and held throughout) |
| R2-X-2 configurable | 1, 3 |
| R2-X-3 single-gateway | 1, 5 |
| R2-X-4 traceability+coverage | every slice + 6 |
| R2-X-5 reproducibility/versions | 2, 4 |
| R2-X-6 host PG exposure (NICE) | 6 (documented decision) |

## Dependency order & sizing

Slices are dependency-ordered (1→6): status first so everything after is
diagnosable; image before create; create/converge before validate; validate
before recover (recover proves itself by returning validate to green); destroy
+ consolidation last. Each slice is sized to land in a focused session with
tests + docs + commit + push. Slice 3 (create+converge) is the largest; if it
overruns a context window it splits into 3a (create) and 3b (converge/brain).
