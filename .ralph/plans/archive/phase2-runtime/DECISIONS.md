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
