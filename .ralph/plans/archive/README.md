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
