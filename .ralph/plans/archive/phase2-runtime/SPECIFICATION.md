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
