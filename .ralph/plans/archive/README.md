# .ralph/plans/archive — completed plans

Each subfolder holds the plan set (SPECIFICATION, REQUIREMENTS, DECISIONS,
EXECUTION_PLAN) for one finished phase. Files within a subfolder cross-reference
each other by relative filename, so they are archived together.

## phase1-derisk-gate/ — Phase 1: De-Risk Gate ✅ COMPLETE (2026-09-11)

Proved the three load-bearing unknowns before building anything; all returned
**GO** with committed, re-runnable spikes and evidence. No hard NO-GO occurred.

- **U1** prime-agent in a fresh OpenShell sandbox → `docs/derisk/U1.md`
  (bead `prime-claw-f7k`)
- **U2** gbrain brain stack in-sandbox (image-baked, PG16+pgvector, embedding
  gate) → `docs/derisk/U2.md` (bead `prime-claw-6r8`)
- **U3** episode spawn/reap mechanics → `docs/derisk/U3.md` (bead `prime-claw-tcf`)

Traceability: `config/requirements-inventory.json` (R-U1-1..6, R-U2-1..6,
R-U3-1..3, R-X-1..7 all proven/met). All three beads closed with verdict links.
Phase 2 (`prime-claw-qcd`) unblocked.

Note: EXECUTION_PLAN.md contains a stale pointer reading REQUIREMENTS.md /
SPECIFICATION.md etc. at `.ralph/plans/`; those files now live beside it in this
subfolder.

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
`proven_by` paths). Bead `prime-claw-qcd` closed with links; Phase 3
(`prime-claw-zwg`) unblocked.
