# .ralph/plans/archive — completed plans

Each subfolder holds the available plan set for one finished phase or episode.
Files within a subfolder cross-reference each other by relative filename, so
they are archived together. Older sets contain specification, requirements,
decisions, and execution-plan files; newer project-customized sets may contain a
different reviewed artifact collection.

## worktree-isolated-specification-episodes/ — Reviewed future plans and episode promotion ✅ COMPLETE (2026-09-21)

Delivered the accepted deterministic workflow through three owner-reviewed
slices: future-folder specification authoring, native reviewed
`/plan <future-folder>`, and explicit `/implement-spec <future-folder>` promotion
into a durable worktree-rooted episode. The episode transition includes stable
identity, inherited conversation context, exactly-once execute admission,
preservation-safe uncertain outcomes, collision checks, and opaque bundle
promotion. Operator reference and recovery behavior are documented in
[`docs/future-specification-bundles.md`](../../../docs/future-specification-bundles.md).

- Slice 1: `c0ac19e4984c1332a09af8df5f8a320551796d31`
  (`prime-claw-h6w.12`)
- Slice 2: `0eb00e6360ce607c44ae450e599d977d98703e3a`
  (`prime-claw-h6w.13`)
- Slice 3: `67fc17408479581f164c16fe12a455a0856158df`, corrected by
  `523e9201527a099925c27d995d654adcf391f7c0`
  (`prime-claw-h6w.14`)

The owner explicitly deferred the planned manual end-to-end dogfood to a
separate future episode. This episode did not plan, modify, or promote the
`conversation-driven-episode-oversight` bundle and created no nested episode.
Bead `prime-claw-h6w.15` records that disposition without claiming the dogfood
acceptance run occurred. Final closure validation passed all 43 Node extension
tests and all 245 repository pytest cases.

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
