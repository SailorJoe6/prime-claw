# .ralph/plans/archive — completed and superseded plans

Each subfolder preserves an available plan set for a finished phase or episode,
or a clearly marked incomplete, superseded artifact. Files within a subfolder
cross-reference each other by relative filename, so they are archived together.
Older sets contain specification, requirements, decisions, and execution-plan
files; newer project-customized sets may contain a different reviewed artifact
collection.

## official-lean-session-protocol/ — Accepted predecessor lean protocol ✅ HISTORICAL (2026-10-04)

These two files are the exact active plan/spec blobs replaced by promotion commit
`6fcc4bf03b2beb09802ea9fed66a3c956be1d687`. They were recovered only from its
sole parent `001cd228f6fca8ddd708bfde06823b0641bcfdf0`; their historical status text
and references are intentionally unchanged.

- [Archived specification](official-lean-session-protocol/SPECIFICATION.md) —
  SHA256 `09cce8ae0898da292fb34f843b3e99b3a5144898934c7e13408a29e76ae2802a`.
- [Archived execution plan](official-lean-session-protocol/EXECUTION_PLAN.md) —
  SHA256 `cf9a75e45d4ccabb42e3c36feed05ef9678227bc58d9e8514aea99145cabe888`.
- Accepted cutover commit:
  `d2ee807ee2f0f066dac1a6b0f1d1c661f2fe1fd4`.
- Terminal main/bookkeeping checkpoint:
  `62ee095cc9cfc7e88a884edec03024edf87953f0`.

This archive preserves predecessor lineage only. The active official lean
compatibility-cleanup specification and plan govern the replacement protocol.
Nothing here authorizes landing, activation, rollback, or cleanup.

## compaction-first-phase-transitions/ — Compaction-first phase transitions ✅ COMPLETE (2026-10-02)

Delivered project-local compaction-first transitions for reviewed `/plan` and
`/implement-spec` flows. Each command now admits a minimal prep turn, requests
best-effort compaction, and queues exactly one canonical phase turn while
preserving existing location, readiness, approval, and replay boundaries.

- Slice 1 accepted at `200be5744003ac47cecd2d79a337df3e4c4aeebc`
  (`prime-claw-h6w.26`).
- Slice 2 accepted at documentation replacement
  `c4de0a89c84aa02f1035f0f3f6ed4bc838223949`, with runtime predecessor
  `94e4488ade82e1a2a8ce74cf956993870759d1f3` (`prime-claw-h6w.27`).
- [Archived specification](compaction-first-phase-transitions/SPECIFICATION.md)
- [Archived execution plan](compaction-first-phase-transitions/EXECUTION_PLAN.md)
- [Prep-chain operator contract](../../../docs/prep-chain.md)

Joe explicitly deferred the planned human-operated `/plan` + `/implement-spec`
dogfood to P1/BLOCKED Bead `prime-claw-h6w.28`, pending separate merge
authorization and deliberate activation from primary `main`. That disposition
matches the `prime-claw-h6w.15` precedent and is not completed dogfood evidence.
This archive does not claim merge readiness, host-global activation, merge,
episode cleanup, or any product-scope change.

Post-acceptance integration rebased the six reviewed commits onto `origin/main`
`eca48f8b284c990a8e030062ef70192313781b7f`. The original review hashes remain
acceptance provenance; their patch-equivalent rebased hashes are recorded in the
archived execution plan. The rebased archive commit is
`445ca79b38ccccc79ca857eaaa8d3bf1d575bb34`.

## plugin-test-container/ — Test tier architecture + tier-1 plugin test container ✅ COMPLETE (2026-09-30)

Delivered the three-tier test architecture and the tier-1 plugin test container
across three owner-reviewed slices: (1) the tier-1 image and driver
(`docker/test.Dockerfile`, `scripts/test-tier1.sh`, `tests/test_tier1_image.py`);
(2) install selection (pinned release via vendor installer, or source via fresh
fork pack), in-container apply/check, a validated probe, and a hard deadline; and
(3) pytest markers (`container` = tier 1, `sandbox` = tier 2, unmarked = tier 0),
the session-scoped `tier1_container` fixture (one container per run,
driver-mirrored setup, exec helpers), migration of all tier-1 suites to
in-container exec, and the `scripts/test-all.sh` sequencer. Acceptance
(verified split, mirroring the slice-3 evidence note): the tier-0 default
`python3 -m pytest tests/ -q` passes with no Docker (223 passed, 144 skipped,
post-reconciliation). Tier-1 in ONE session container: source mode
**34 passed/139s BEFORE the merge reconciliation**; pinned mode
**37 passed/118s AFTER reconciliation**; the post-reconciliation source-mode
gate is NOT claimed. Accepted commits: slice 1 `2666843`, slice 2 `bc00cba`,
slice 3 `d040c02` plus merge-reconciliation `7118a44` (rebased onto main
`9b3edd2`, the goal-heartbeat plugin generation).

- [Archived specification](plugin-test-container/SPECIFICATION.md)
- [Archived execution plan](plugin-test-container/EXECUTION_PLAN.md)
- [EXPERT review reports (BLOCK/PASS trail)](plugin-test-container/reviews/)
- Acceptance evidence:
  [slice 1 image + driver](../../../docs/evidence/2026-09-29-tier1-slice1-image-driver.md),
  [slice 2 install selection](../../../docs/evidence/2026-09-30-tier1-slice2-install-selection.md),
  [slice 3 migration + sequencer](../../../docs/evidence/2026-09-30-tier1-slice3-migration-sequencer.md)
- Operator-facing doc home (named by the approved plan):
  [DEVELOPERS.md](../../../DEVELOPERS.md) "Testing" section

EXPERT review trail: slice 1 BLOCK `47d2830` → BLOCK `d8dbc5d` → PASS
`2666843`; slice 2 BLOCK `470be98` → PASS `bc00cba`. Slice 3 had NOT received
its final EXPERT gate at archival time; the owner runs a fresh FINAL EXPERT
review on the complete exact candidate (`d040c02..<archival>`), so this archive
does not record a slice-3 PASS. Beads `prime-claw-blw.1`/`.2`/`.3` are closed;
`prime-claw-blw.4` (shared-base extraction) is deferred P2.

Note: the archived EXECUTION_PLAN.md contains a historical promotion quote
reading `/implement-spec .ralph/plans/future/plugin-test-container`; that
bundle's reviewed artifact set now lives beside it in this subfolder, with the
five review reports preserved under `reviews/`.

## goal-heartbeat-work-control/ — Plugin-global goal and heartbeat work control ✅ COMPLETE (2026-09-30)

Delivered transient, capability-gated, event-driven goal/heartbeat ownership for
compatible Prime Agent sessions while removing the unsafe model-facing
pause/resume transport. The accepted repair is
`486f4af62b7c1088a0ad10eb9ca05a2e0f735401`; managed installation evidence is
`3a526ec68a13783d11acb609b3d485a577b26a91`. Joe's renewed visible UAT passed
obsolete-tool absence, exact goal-to-monitored-wait transfer and cleanup, and an
exact human-only blocker with no polling heartbeat. Exact receipts are on
`prime-claw-h6w.24.2`.

- [Archived specification](goal-heartbeat-work-control/SPECIFICATION.md)
- [Archived execution plan](goal-heartbeat-work-control/EXECUTION_PLAN.md)
- [Canonical operating contract](../../../docs/goal-heartbeat-work-control.md)

This archive is the episode's terminal readiness claim for owner reconciliation.
The mandatory fresh exact-candidate EXPERT review has not run; this archive does
not authorize merge, abandonment, resource cleanup, or episode bookkeeping
finalization.

## phase3a-bufd-superseded-incomplete/ — Phase 3a brain-hosting BUFD bundle ⚠️ INCOMPLETE / SUPERSEDED (2026-09-25)

These four files were moved together from `.ralph/plans/blocked/` to preserve
the earlier BUFD design and execution history. They are **not** a completed or
accepted Phase 3a implementation, and this archive does not resolve the blocked
Qwen migration or authorize Slice 4B. The private brain-source repair remains
unpublished due to sandbox Git transport failure; the candidate remains partial
and there has been no cutover. Bead `prime-claw-zwg.5` tracks the live blocker.
The replacement, outcome-first specification is a draft for operator review at
`.ralph/plans/future/phase3a-brain-hosting-completion/SPECIFICATION.md`.
It has no execution plan or implementation approval yet.

## conversation-driven-episode-oversight/ — Conversation-owned implementation episodes ✅ COMPLETE (2026-09-25)

Delivered default CONVERSATION identity, exact-owner EPISODE oversight, owner-driven
handoff and independent review, and one conversational terminal decision with a
no-UI bookkeeping close. The operator approved the reviewed feature at
`248f944f70acdbe19d3a93c6781ebcdb2eea22d2`; it was fast-forwarded to
`main`, the episode was stopped and cleaned up, and Bead `prime-claw-h6w.22`
was closed. The completed specification and plan were archived after that merge
because the final candidate had left them active at `.ralph/plans/`.
Bead `prime-claw-mu1` tracks the open prevention requirement; this archive
corrects the delivered artifact state, not the missing merge-readiness check.

## conversational-ralph-command-routing/ — Conversational routing for Ralph native commands ✅ COMPLETE (2026-09-22)

Delivered explicit `ralph_handoff` and `ralph_plan` tools that converge on the
canonical native workflows while preserving `/handoff`, `/plan`, and
`/implement-spec`. Handoff uses `steer` followed by the sole `followUp`; planning
queues canonical planning once and grants no implementation authority. Installed
Prime Agent 0.9.5 lifecycle evidence selected the approved native-only fallback
for implementation, so `ralph_implement_spec` is intentionally absent.

Accepted slice commits are `86b24b5dfecac312a46cfbab2190236b73af430b`,
`d011968d4f505d8df52ebd552e49d654cdf45b74`, and
`272372c9e848c21d48a5968144d2495ea59c4a2e`; acceptance state is recorded by
`a25f3b426f8ebe222911d78458f899098e017ff5`. Final validation covered all three
Node suites, the full Python suite, installed-runtime discovery, archive-link
resolution, and a clean diff. The unrelated `conversation-driven-episode-oversight`
bundle remains incubating and unchanged. Merge and resource cleanup remain
separate explicit operator decisions.

## handoff-continuation-resilience/ — Compaction-independent handoff continuation ✅ COMPLETE (2026-09-21)

Changed native `/handoff` to preflight both canonical workflows, admit handoff,
and queue canonical execute once as a native `followUp`. Compaction remains a
best-effort context improvement and no longer owns execute admission. Late or
repeated compaction signals have no path to start another execute pass.

Disposable Prime Agent 0.9.5 evidence covered no-compaction, compaction success,
compaction cancellation, bounded compaction failure, real TUI interruption, ACP
cancel, and ACP close/replacement. The integrated implementation commit is
`f89f121f2eba21d06d0bf89c220d38d0c32cc1ae`. Final validation passed 9 focused
Node tests, 4 Python bridge/loader tests, all 247 active repository tests, and
`git diff --check`. Two fresh exact-commit EXPERT reviews returned
`FINAL EXPERT PASS`, after which the operator explicitly approved merge. Bead
`prime-claw-h6w.11` holds the manual oversight and evidence record.

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
