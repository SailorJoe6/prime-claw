---
id: PRIMECLAW-6
title: 'Phase 2: sandbox runtime foundation (prime-agent in OpenShell)'
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
updated_date: '2026-10-14 02:54'
labels: []
dependencies:
  - PRIMECLAW-1
  - PRIMECLAW-4
  - PRIMECLAW-5
references:
  - >-
    .ralph/plans/archive/phase2-runtime/DECISIONS.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/phase2-runtime/EXECUTION_PLAN.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/phase2-runtime/REQUIREMENTS.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/phase2-runtime/SPECIFICATION.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
priority: p1
type: epic
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stand up the prime-claw container: OpenShell sandbox (deny-by-default egress, no host socket/home/net/PID/IPC), prime-agent daemon inside owning $HOME, L7 credential injection, apply/check/validate/test tooling + requirements-inventory traceability. Blueprint: nemo-setup/openclaw-setup. Done when a prime-agent daemon runs healthily, secured, reproducible.

## Legacy notes

2026-09-11 Slice 1 DONE: bin/prime-claw CLI (status live; create/converge/build/validate/recover/destroy stubbed). status = read-only actual-vs-expected via openshell --output json (gateway pins openshell/flags nemoclaw, sandbox phase+policy rev, provider attached, PG/gbrain/daemon probes; model deferred to validate; image recorded-at-create in config/runtime.json). docs/runbook.md stub. 18 new tests; suite 70/70. Next: Slice 2 image stage.
2026-09-11 Slice 2 DONE: bin/prime-claw build + docker/runtime.Dockerfile. Idempotent (input fingerprint + stamp, --force override), prefers real /templates (git-history fallback). Staging real-path smoke-verified on ~/zbrain; build offline-tested. Suite 80/80. Inventory R2-B-1 met, R2-X-5 in-progress. Next: Slice 3 create+converge (the core; splits 3a/3b if too big).
2026-09-11 Slice 3a DONE: bin/prime-claw create + idempotent runtime stages (policy/provider/sandbox-at-create/prime-agent/brain/spawn) migrated from apply-phase1-*.sh. Provider attached at CREATE; key read in-process only. Suite 93/93. Inventory R2-B-2..5 + R2-X-1 met. Next: Slice 3b = converge + policy consolidation (phase1-sandbox.yaml -> runtime.yaml).
2026-09-11 Slice 3b DONE: bin/prime-claw converge (re-run all stages on existing sandbox, no needless recreate; errors->create if absent; fail-fast). Policy consolidation phase1-sandbox.yaml->runtime.yaml DEFERRED to Slice 6 (Phase 1 tests reference old path). Suite 98/98. Slice 3 complete. Next: Slice 4 validate + version recording (the acceptance gate).
2026-09-11 Slice 4 DONE: bin/prime-claw validate (single green/red acceptance gate, consolidated from validate-phase1-*.py). Live PASS on all 15 checks (real model call via kimi-k3, deny-by-default egress, daemon, REPL, brain+embedding dims=1536, spawn/reap RPC). Version recording -> docs/evidence/validate-<utc>.json (openshell 0.0.116/prime-agent 0.9.3/gbrain 0.49.0/PG 16.15/pgvector 0.6). Two real fixes: deny-probe moved off pypi.org (now a DECLARED endpoint); credentialed call pinned --model (default claude-opus-4-7 disabled -> 404). Suite 105/105. Inventory R2-C-2/R2-C-3/R2-X-5 met. Next: Slice 5 recover + runbook (vpn-flap, gateway-flip, recreate-wipe, cold-daemon, drift).
2026-09-11 Slice 5 DONE: bin/prime-claw recover + docs/runbook.md. LIVE degrade-and-recover proven (cold-daemon -> detect -> recover -> validate PASS; docs/evidence/recover-*.json). Found+fixed 5 real bugs: provider idempotency (import only when provider absent), kernel-bootstrap via node-file, daemon-ensure + stale daemon.sock.lock cleanup, live-daemon detection, stage_prime_agent return 0. Suite 118/118. Inventory R2-C-3/4/5 met. Next: Slice 6 (destroy + retire *-phase1-* scripts + consolidate policy -> policies/runtime.yaml + close-out).
2026-09-11 Slice 6a DONE (commit 600600d): bin/prime-claw destroy (confirm-gated, idempotent, --image opt-in) + Phase 1 consolidation. Retired apply/check/validate-phase1-* + test_phase1_* + phase1-brain.Dockerfile to scripts/archive/phase1/; consolidated policies/phase1-sandbox.yaml -> policies/runtime.yaml; added tests/test_inventory_integrity.py (re-gates 72 proven_by paths); documented R2-X-6 host-PG constraint. Suite 75/75. Live status healthy. NEXT: Slice 6b close-out (archive Phase 2 plan set to .ralph/plans/archive/phase2-runtime/, update archive README, close this bead; unblocks prime-claw-zwg Phase 3).

## Migrated bundle authority

Imported from frozen pre-cutover tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Verbatim bytes remain available through the source references below; this task is the durable Backlog authority for the bundle's content and outcome.

## Requirements imported from `.ralph/plans/archive/phase2-runtime/REQUIREMENTS.md`

# REQUIREMENTS — Phase 2: Sandbox Runtime Foundation

> Index: [SPECIFICATION.md](SPECIFICATION.md) · [DECISIONS.md](DECISIONS.md)
> Traced in `config/requirements-inventory.json`. Priority: GATE (must hold to
> call Phase 2 done) or NICE (documented, non-blocking).

## R2-A — Entry point & lifecycle

| ID | Priority | Requirement |
|----|----------|-------------|
| R2-A-1 | GATE | A single operator entry point (`bin/prime-claw`) owns the sandbox lifecycle with verbs covering create, converge, status, validate, destroy, recover. |
| R2-A-2 | GATE | `converge` is idempotent: running it on a fresh box, a healthy box, or a degraded box all land in the same known-good state with no manual steps. |
| R2-A-3 | GATE | The lifecycle is built from native OpenShell primitives (providers-at-create, policy, `sandbox create/exec`) used as designed — no forced docker-compose/entrypoint mapping. |
| R2-A-4 | GATE | Lifecycle stages are individually runnable for targeted diagnosis, not only via the orchestrator. |

## R2-B — Component stages (idempotent)

| ID | Priority | Requirement |
|----|----------|-------------|
| R2-B-1 | GATE | Image stage: builds the prime-claw image (brain stack baked at build time per Phase 1 D15) reproducibly from a committed Dockerfile. |
| R2-B-2 | GATE | Sandbox stage: `openshell sandbox create` with providers attached **at create** (not post-hoc), from the built image; converge refreshes policy without needless recreate. |
| R2-B-3 | GATE | prime-agent stage: installs/configures prime-agent + daemon + persistent REPL in-sandbox idempotently. |
| R2-B-4 | GATE | Brain stage: brings up PG16+pgvector + gbrain in-sandbox (initdb-if-absent, agent-owned PGDATA), idempotently. |
| R2-B-5 | GATE | Baseline-layout stage: stages the non-secret runtime layout (`models.json`, npm-onload, spawn target) idempotently — eliminating Phase 1's manual re-staging. |

## R2-C — Diagnosis & recovery

| ID | Priority | Requirement |
|----|----------|-------------|
| R2-C-1 | GATE | `status` reports actual-vs-expected for every component (gateway, sandbox+image, policy version, provider, PG, gbrain, prime-agent daemon, model reachability) in one command. |
| R2-C-2 | GATE | `validate` proves the end-to-end acceptance contract (daemon healthy, deny-by-default egress, credentialed model call, brain serving, spawn/reap). |
| R2-C-3 | GATE | `recover` codifies the known Phase 1 degradations: VPN-flap gateway/container bounce; `active_gateway` flip; recreate-induced `/sandbox` wipe; cold-daemon spawn retry. |
| R2-C-4 | GATE | A `docs/` runbook maps each observed failure signature to its recovery command. |
| R2-C-5 | GATE | A degrade-and-recover cycle is demonstrated: induce a known degradation, run the codified recovery, validator returns green. |

## R2-X — Cross-cutting (carried from Phase 1)

| ID | Priority | Requirement |
|----|----------|-------------|
| R2-X-1 | GATE | Credential isolation: providers only; no Keychain/browser access; no credential values in repo/logs/artifacts; non-secret gateway config committable (R-X-5/D14). |
| R2-X-2 | GATE | Configurable inference/credential shape (provider/endpoint/baseUrl/credential parameterized) so another operator can re-point without code edits (R-X-7/D14). |
| R2-X-3 | GATE | Single-gateway discipline: the runtime pins the `openshell` gateway (17670); never the stale `nemoclaw` registration. |
| R2-X-4 | GATE | Traceability: `config/requirements-inventory.json` traces every Phase 2 requirement to validator(s); pytest covers the lifecycle tooling. |
| R2-X-5 | GATE | Reproducibility: the runtime is re-validatable later (recorded versions for OpenShell, prime-agent, image, PG/pgvector, gbrain). |
| R2-X-6 | NICE | Host exposure of sandboxed Postgres on localhost:5433 (OpenShell service-forwarding equivalent) — documented constraint if not done. |

## Specification imported from `.ralph/plans/archive/phase2-runtime/SPECIFICATION.md`

# SPECIFICATION — Phase 2: Sandbox Runtime Foundation

> Status: ACCEPTED — 2026-09-11 design interview. Entry point: `bin/prime-claw`
> CLI with lifecycle verbs (operator: "build what you'd prefer to use"). Scope
> confirmed by the operator.
> Indexes: [REQUIREMENTS.md](REQUIREMENTS.md) · [DECISIONS.md](DECISIONS.md)
> Governs: LONG_RANGE_PLAN.md Phase 2 (bead `prime-claw-qcd`). Builds on the
> archived Phase 1 de-risk gate (.ralph/plans/archive/phase1-derisk-gate/).
> The spec defines *what* the runtime foundation is and its acceptance
> criteria; it deliberately does not sequence the build — that is planning's job.

## What this phase is

Phase 1 proved the three load-bearing unknowns (U1 prime-agent in sandbox, U2
brain stack in sandbox, U3 episode spawn/reap) — all GO. But it proved them
with **spike tooling**: five separate `apply-phase1-*.sh` scripts run in a
hand-known order, manual re-staging after a recreate (`models.json`, the spawn
project, the in-sandbox prime-agent install), and recovery knowledge that lives
in conversation, not in the repo.

Phase 2 turns that spike into the **prime-claw runtime foundation**: a single,
reliable, repeatable lifecycle for the prime-claw OpenShell sandbox, built from
**native OpenShell primitives** (providers-at-create, policy, `sandbox
create/exec`) used the way they are meant to be used — not a forced mapping of
docker-compose/entrypoint patterns onto OpenShell.

Two explicit drivers from the design interview:

- **Repeatable above all.** Like ZBrain and Ralph-PVA, the process is scripted
  and stable: a fresh bring-up and a re-converge are the same command, run as
  many times as needed, always landing in the same known-good state.
- **This is for the operator-agent, not for Joe.** When something breaks, Joe
  comes to the agent. So the foundation optimizes for the *agent's* ability to
  diagnose, recover, and re-converge fast: one obvious entry point, idempotent
  stages, self-describing state, and a runbook that encodes the recovery moves
  Phase 1 had to discover by hand.

## Current state (what is true today)

- The `prime-claw` OpenShell sandbox exists and runs the
  `prime-claw-brain:0.1.0` image (Ubuntu noble, `sandbox` user, PG 16.15 +
  pgvector 0.6.0, gbrain 0.49.0.0 compiled Bun binary). prime-agent 0.9.3 +
  daemon + persistent REPL proven in-sandbox. Credential bridge to the AI
  Gateway proven (`ANTHROPIC_API_KEY` placeholder + `models.json` baseUrl,
  default model `anthropic.kimi-k3`).
- OpenShell primitives verified: provider env is injected at **create**, not
  per-exec (post-hoc attach needs a restart); the L7 policy keys credentialed
  endpoints **per calling binary** (gbrain/Bun needed explicit binding);
  `openshell policy set --wait` hot-reloads policy.
- The spike tooling is real and committed but fragmented:
  `scripts/apply-phase1-{sandbox,prime-agent,providers,brain,spawn}.sh`,
  `check-phase1-*.sh`, `validate-phase1-*.py`, `policies/runtime.yaml`,
  `docker/phase1-brain.Dockerfile`.
- Known sharp edges Phase 1 hit that the foundation must engineer out:
  - **Recreate wipes `/sandbox`** (prime-agent install, brain PGDATA,
    `models.json`, spawn project all lost). Today recovery = re-run several
    scripts by hand.
  - `active_gateway` can flip to the stale `nemoclaw` registration; the
    foundation must pin/select the `openshell` gateway (17670).
  - VPN flaps kill the gateway daemon + container; recovery is manual
    (`brew services start openshell`, then re-apply).
  - Cold-daemon `create` can transiently fail; session names must be unique
    per parent; spawn/reap uses the `DaemonClient` RPC, not a public CLI.
  - The zbrain `templates/` upstream break (Joe is fixing zbrain itself; the
    image build prefers a real `$ZBRAIN_SRC/templates`).

## What must change / be proven

### R1 — One operator entry point

A single, discoverable command owns the sandbox lifecycle. Proposed shape
(exact mechanics are planning's job): `bin/prime-claw <verb>` with verbs for
the full lifecycle — e.g. `create`, `converge`, `status`, `validate`,
`destroy`, and `recover`. `converge` on a fresh box and `converge` on a
degraded box both land in the same known-good state. No manual re-staging
steps exist outside this entry point.

### R2 — Idempotent, ordered stages under the hood

The lifecycle decomposes into ordered, idempotent stages (image build; sandbox
create-with-providers; prime-agent install; brain bring-up; policy apply;
baseline layout staging; validation). Each stage is safe to re-run and skips
work already done. The entry point orchestrates them; the stages remain
individually runnable for targeted diagnosis.

### R3 — Self-describing, diagnosable state

`status` reports the actual vs expected state of every component (gateway
selected, sandbox present + image, policy version, provider attached, PG up,
gbrain serving, prime-agent daemon healthy, model reachable) so a broken
runtime is diagnosable from one command. Failure output names the failing
stage and the recovery verb.

### R4 — Recovery is codified, not tribal

The recovery moves Phase 1 discovered by hand become first-class:
`recover` handles the known degradations (VPN-flap gateway/container bounce,
`active_gateway` flip, recreate-induced `/sandbox` wipe, cold-daemon spawn
retry) without the operator re-deriving them. A runbook in `docs/` maps each
observed failure signature to its command.

### R5 — Credential isolation preserved (hard rule, carried from Phase 1)

Credentials enter only via OpenShell providers at create; real values never on
sandbox disk; no macOS Keychain / browser credential-store access; no
credential material in the repo, logs, or artifacts. Non-secret gateway config
(host, paths, model IDs) is committable; credential *values* are not (D14/R-X-5).
The setup stays **configurable** (parameterized provider/endpoint/baseUrl/credential
shape) so another operator can point at the gateway with their own key (R-X-7).

### R6 — Traceability + coverage (carried convention)

The apply/check/validate/test convention continues:
`config/requirements-inventory.json` traces every Phase 2 requirement to its
validator(s); `tests/test_*.py` covers the lifecycle tooling. The runtime is
re-validatable later to decide whether a decision still holds after the
substrate (OpenShell, prime-agent, images) changes.

## When the work is done (end state)

- From a clean checkout, one command (`bin/prime-claw create` or `converge`)
  brings a fresh OpenShell sandbox to the fully-running prime-claw runtime with
  no manual steps, and is safely re-runnable.
- `bin/prime-claw status` accurately reports component health;
  `bin/prime-claw validate` proves the acceptance contract end-to-end.
- The known Phase 1 failure signatures each have a codified `recover` path and
  a runbook entry; a simulated degrade-and-recover cycle is demonstrated.
- `config/requirements-inventory.json` traces all Phase 2 requirements;
  pytest covers the lifecycle tooling; bead `prime-claw-qcd` closes with links.
- Credential isolation and configurability hold throughout (R5).

## Explicit non-goals

- **No NemoClaw dependency** — reference architecture only; the sibling's
  isolated Hermes stack (`:8080`, brew-free PATH) is untouched and out of scope.
- **No zbrain source changes** — Joe owns the zbrain `templates/` fix; the image
  build consumes a real zbrain checkout, it does not patch zbrain.
- **No Phase 3+ concerns** — no conversation loop, no information-architecture
  routing, no episode-loop automation. Phase 2 is the runtime foundation only.
- **No hardcoding to Joe's values** — the gateway endpoint/credential shape is
  parameterized (R5); another operator can re-point it.
- **No host exposure of sandboxed services as a gate criterion** (nice-to-have
  only, as in Phase 1 U2-5).

## Hard rules (carried from AGENTS.md + Phase 1, binding)

- Credential isolation (R5): providers only; never Keychain/browser stores;
  no credential values in repo/logs/artifacts.
- OpenShell primitives used natively — no forced docker-compose/entrypoint mapping.
- Non-interactive shell flags everywhere (`-y`, `-f`, `BatchMode=yes`, ...).
- Landing the plane: work is not done until committed, `bd` updated, and pushed.
- Single-gateway discipline: the runtime pins the `openshell` gateway (17670);
  never select the stale `nemoclaw` registration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 R2-A-1: A single operator entry point (`bin/prime-claw`) owns the sandbox lifecycle with verbs covering create, converge, status, validate, destroy, recover.
- [x] #2 R2-A-2: `converge` is idempotent: running it on a fresh box, a healthy box, or a degraded box all land in the same known-good state with no manual steps.
- [x] #3 R2-A-3: The lifecycle is built from native OpenShell primitives (providers-at-create, policy, `sandbox create/exec`) used as designed — no forced docker-compose/entrypoint mapping.
- [x] #4 R2-A-4: Lifecycle stages are individually runnable for targeted diagnosis, not only via the orchestrator.
- [x] #5 R2-B-1: Image stage: builds the prime-claw image (brain stack baked at build time per Phase 1 D15) reproducibly from a committed Dockerfile.
- [x] #6 R2-B-2: Sandbox stage: `openshell sandbox create` with providers attached **at create** (not post-hoc), from the built image; converge refreshes policy without needless recreate.
- [x] #7 R2-B-3: prime-agent stage: installs/configures prime-agent + daemon + persistent REPL in-sandbox idempotently.
- [x] #8 R2-B-4: Brain stage: brings up PG16+pgvector + gbrain in-sandbox (initdb-if-absent, agent-owned PGDATA), idempotently.
- [x] #9 R2-B-5: Baseline-layout stage: stages the non-secret runtime layout (`models.json`, npm-onload, spawn target) idempotently — eliminating Phase 1's manual re-staging.
- [x] #10 R2-C-1: `status` reports actual-vs-expected for every component (gateway, sandbox+image, policy version, provider, PG, gbrain, prime-agent daemon, model reachability) in one command.
- [x] #11 R2-C-2: `validate` proves the end-to-end acceptance contract (daemon healthy, deny-by-default egress, credentialed model call, brain serving, spawn/reap).
- [x] #12 R2-C-3: `recover` codifies the known Phase 1 degradations: VPN-flap gateway/container bounce; `active_gateway` flip; recreate-induced `/sandbox` wipe; cold-daemon spawn retry.
- [x] #13 R2-C-4: A `docs/` runbook maps each observed failure signature to its recovery command.
- [x] #14 R2-C-5: A degrade-and-recover cycle is demonstrated: induce a known degradation, run the codified recovery, validator returns green.
- [x] #15 R2-X-1: Credential isolation: providers only; no Keychain/browser access; no credential values in repo/logs/artifacts; non-secret gateway config committable (R-X-5/D14).
- [x] #16 R2-X-2: Configurable inference/credential shape (provider/endpoint/baseUrl/credential parameterized) so another operator can re-point without code edits (R-X-7/D14).
- [x] #17 R2-X-3: Single-gateway discipline: the runtime pins the `openshell` gateway (17670); never the stale `nemoclaw` registration.
- [x] #18 R2-X-4: Traceability: `config/requirements-inventory.json` traces every Phase 2 requirement to validator(s); pytest covers the lifecycle tooling.
- [x] #19 R2-X-5: Reproducibility: the runtime is re-validatable later (recorded versions for OpenShell, prime-agent, image, PG/pgvector, gbrain).
- [x] #20 R2-X-6: Host exposure of sandboxed Postgres on localhost:5433 (OpenShell service-forwarding equivalent) — documented constraint if not done.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Imported from `.ralph/plans/archive/phase2-runtime/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Historical/current status statements are preserved literally; the task status and Final Summary state the migrated outcome.

# EXECUTION PLAN — Phase 2: Sandbox Runtime Foundation

> **PHASE 2 COMPLETE (2026-09-11).** All six slices landed; this plan set is archived to `.ralph/plans/archive/phase2-runtime/`. Runtime reference: `docs/sandbox-runtime.md`; operations: `docs/runbook.md`. Unblocks Phase 3 (`prime-claw-zwg`).

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
- `policies/runtime.yaml` — consolidated policy (from `runtime.yaml`).
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

### Slice 2 — Image stage (reproducible build) ✅ DONE (2026-09-11)

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

### Slice 3 — Create + converge (the repeatable core) ✅ DONE (2026-09-11) — 3a create + runtime stages; 3b converge. Policy consolidation runtime.yaml→runtime.yaml deferred to Slice 6 (Phase 1 tests still reference the old path; retire it there with the Phase 1 scripts).

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
- Consolidate `policies/runtime.yaml` → `policies/runtime.yaml`.
- Value: one command from fresh (or degraded) to fully-running, no manual steps.
- Tests: `tests/test_runtime_converge.py` (stage idempotency, ordering, dry-run).
- Inventory: R2-A-2, R2-B-2..5, R2-X-1, R2-X-2.

### Slice 4 — Validate + version recording (the acceptance gate) ✅ DONE (2026-09-11, live PASS)

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

### Slice 5 — Recover + runbook (the operability slice) ✅ DONE (2026-09-11, live degrade-and-recover PASS)

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

### Slice 6 — Destroy + consolidation + close-out  ✅ DONE (6a destroy+consolidation; 6b close-out)

Safe teardown, remove the superseded Phase 1 scripts, finish the record.
- [x] `bin/prime-claw destroy [--yes] [--image]`: safe, confirmed teardown — non-destructive by default (prints plan, exits 0), `--yes` mutates, idempotent (absent = no-op), `--image` also removes the recorded image + clears the build stamp. Tests: `tests/test_runtime_destroy.py`.
- [x] Retired the superseded Phase 1 `apply/check/validate` scripts + `test_phase1_*` + `phase1-brain.Dockerfile` to `scripts/archive/phase1/` (with a README); consolidated `policies/phase1-sandbox.yaml` → **`policies/runtime.yaml`**; added `tests/test_inventory_integrity.py` to re-gate `proven_by` paths.
- [x] Final inventory trace (all R2-* to validators; `tests/test_inventory_integrity.py`),
  spec converted to `docs/sandbox-runtime.md`, LONG_RANGE_PLAN Phase 2 marked done,
  plan set archived, bead `prime-claw-qcd` closed (unblocks `prime-claw-zwg`).
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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One-time Backlog migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`.

Tracked source paths:
- `.ralph/plans/archive/phase2-runtime/DECISIONS.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/phase2-runtime/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/phase2-runtime/REQUIREMENTS.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/phase2-runtime/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530` (shared terminal/status evidence)

Every listed source remains tracked in this bounded migration slice. Git history preserves verbatim bytes. This task imports the bundle's specification/requirements into Description and native criteria, execution plan into Implementation Plan, durable history into these notes, and terminal outcome into Final Summary. Existing task ID and `parent_task_id` are preserved. No bundle is placed under `backlog/archive/`.

Related durable Backlog tasks: .

### Shared archive-index outcome

## phase2-runtime/ — Phase 2: Sandbox Runtime Foundation ✅ COMPLETE (2026-09-11)

Built one reliable, repeatable OpenShell sandbox lifecycle behind a single
operator entry point, `bin/prime-claw`, over native OpenShell primitives. All
six vertical slices landed with offline tests + docs, committed and pushed.

- **Entry point** `bin/prime-claw` (Python 3, stdlib only) with verbs:
  `status` · `build` · `create` · `converge` · `validate` · `recover` · `destroy`.
- **Reference**: `docs/sandbox-runtime.md`; **operations**: `docs/runbook.md`.
- **Evidence**: `docs/evidence/validate-<utc>.json`,
  `docs/evidence/recover-<utc>.json` (live degrade-and-recover proven).
- **Consolidation**: the superseded Phase 1 apply/check/validate scripts retired
  to `scripts/archive/phase1/`; the runtime policy consolidated to
  `policies/runtime.yaml`.

Traceability: `config/requirements-inventory.json` (R2-A-1..4, R2-B-1..5,
R2-C-1..5, R2-X-1..6 all met; `tests/test_inventory_integrity.py` re-gates the
`proven_by` paths). Backlog.md task `PRIMECLAW-6` is Done with links; Phase 3
(`PRIMECLAW-7`) unblocked.

## Decisions imported from `.ralph/plans/archive/phase2-runtime/DECISIONS.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`

# DECISIONS — Phase 2: Sandbox Runtime Foundation

> Index: [SPECIFICATION.md](SPECIFICATION.md) · [REQUIREMENTS.md](REQUIREMENTS.md)
> Each decision traces to the requirement(s) it implements. Phase 1 decisions
> (D1–D15) are archived at .ralph/plans/archive/phase1-derisk-gate/DECISIONS.md;
> numbering restarts for Phase 2.

## D2-1 — One entry point, thin orchestration over native OpenShell primitives
Implements: R2-A-1, R2-A-2, R2-A-3.
Decision: a single `bin/prime-claw` command orchestrates the lifecycle. It does
NOT re-implement OpenShell — it composes `openshell sandbox create/exec`,
`openshell policy set`, and provider attachment as they are meant to be used.
Rejected: forcing a docker-compose/entrypoint mapping onto OpenShell (the
interview explicitly ruled this out — "use the OpenShell primitives the way they
are meant to be used"). Rejected: keeping five hand-ordered apply scripts (that
is the Phase 1 spike shape, not a repeatable foundation).

## D2-2 — Repeatability lives in a converge-orchestrated set of idempotent stages
Implements: R2-A-2, R2-B-1..5.
Decision: repeatability is achieved by an orchestrator over ordered, idempotent
stages (image → sandbox+providers → prime-agent → brain → baseline layout →
validate), each safe to re-run and individually invocable. This mirrors the
ZBrain/Ralph-PVA "scripted and stable" property the operator cited, adapted to
OpenShell's create-time credential injection. Bias toward converge-script-heavy
rather than baking runtime bootstrap into a container entrypoint, because
OpenShell injects provider env at create and boots from an image you `exec`
into — there is no container entrypoint hook to hang bootstrap on.

## D2-3 — The foundation is built for the operator-agent's recovery loop
Implements: R2-C-1..5.
Decision: because Joe comes to the agent when something breaks, diagnosability
and codified recovery are first-class requirements, not afterthoughts. `status`
gives one-command actual-vs-expected; `recover` encodes the Phase 1-discovered
degradations; a runbook maps failure signature → command. Self-describing state
is preferred over implicit knowledge.

## D2-4 — Credential isolation + configurability carried unchanged from Phase 1
Implements: R2-X-1, R2-X-2, R2-X-3.
Decision: the Phase 1 credential model (D11/D12/D14, R-X-5/R-X-7) carries into
the foundation verbatim: providers-at-create, placeholders only on disk, no
Keychain/browser access, non-secret config committable, parameterized so another
operator can re-point. The runtime pins the `openshell` gateway (17670) and
never the stale `nemoclaw` registration.

## D2-5 — Reuse Phase 1 artifacts as the stage implementations; do not rebuild blindly
Implements: R2-B-1..5, R2-X-4, R2-X-5.
Decision: the Phase 1 spike scripts (apply/check/validate), the brain
Dockerfile, and the policy are the *proven* substance of each stage. Phase 2
refactors them under the single entry point and makes them idempotent and
self-describing — it does not discard working proofs. The `phase1-` naming and
scattered layout are expected to be consolidated under the lifecycle.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Phase 2 sandbox runtime foundation COMPLETE (2026-09-11). Built bin/prime-claw lifecycle (status/build/create/converge/validate/recover/destroy) over native OpenShell primitives; live degrade-and-recover proven (docs/evidence/recover-20260911T221546Z.json). Reference: docs/sandbox-runtime.md; operations: docs/runbook.md. Final commits: 600600d (Slice 6a destroy+consolidation), 1125694 (Slice 6b close-out). Plan set archived to .ralph/plans/archive/phase2-runtime/. Unblocks prime-claw-zwg (Phase 3).

## phase2-runtime/ — Phase 2: Sandbox Runtime Foundation ✅ COMPLETE (2026-09-11)

Built one reliable, repeatable OpenShell sandbox lifecycle behind a single
operator entry point, `bin/prime-claw`, over native OpenShell primitives. All
six vertical slices landed with offline tests + docs, committed and pushed.

- **Entry point** `bin/prime-claw` (Python 3, stdlib only) with verbs:
  `status` · `build` · `create` · `converge` · `validate` · `recover` · `destroy`.
- **Reference**: `docs/sandbox-runtime.md`; **operations**: `docs/runbook.md`.
- **Evidence**: `docs/evidence/validate-<utc>.json`,
  `docs/evidence/recover-<utc>.json` (live degrade-and-recover proven).
- **Consolidation**: the superseded Phase 1 apply/check/validate scripts retired
  to `scripts/archive/phase1/`; the runtime policy consolidated to
  `policies/runtime.yaml`.

Traceability: `config/requirements-inventory.json` (R2-A-1..4, R2-B-1..5,
R2-C-1..5, R2-X-1..6 all met; `tests/test_inventory_integrity.py` re-gates the
`proven_by` paths). Backlog.md task `PRIMECLAW-6` is Done with links; Phase 3
(`PRIMECLAW-7`) unblocked.
<!-- SECTION:FINAL_SUMMARY:END -->
