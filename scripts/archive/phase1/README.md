# Phase 1 (de-risk gate) scripts — RETIRED

These `apply-` / `check-` / `validate-` scripts, their tests, and the Phase 1
brain Dockerfile were the **Phase 1 de-risk spike** path. As of **Phase 2 Slice 6**
they are **subsumed by the single runtime entry point `bin/prime-claw`**
(verbs: status, create, converge, build, validate, recover, destroy).

They are **kept for historical traceability** (the requirements-inventory
`proven_by` references and the `docs/derisk/U*.md` verdict docs cite them) but
are **no longer the supported path**. Do not run them against a live sandbox;
use `bin/prime-claw` instead.

The Phase 1 policy `policies/phase1-sandbox.yaml` was consolidated and renamed to
**`policies/runtime.yaml`** (the single runtime policy referenced by
`config/runtime.json`).

See:
- `bin/prime-claw` — the runtime entry point
- `docs/runbook.md` — operations runbook
- `.ralph/plans/archive/phase1-derisk-gate/` — the Phase 1 plan set
