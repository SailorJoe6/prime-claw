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
