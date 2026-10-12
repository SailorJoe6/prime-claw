---
id: PRIMECLAW-10.32
title: Post-merge operator dogfood for compaction-first phase transitions
status: Blocked
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - dogfood
  - episode-loop
  - phase4
  - post-merge
  - ralph
dependencies: []
references:
  - PRIMECLAW-10.31
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run the deferred human-operated end-to-end acceptance for compaction-first `/plan` and `/implement-spec` after the accepted feature is merged and deliberately activated from primary `main`. This is the explicit follow-up disposition for episode `01a0fe1c-da17-7265-aee6-e6f82e8b5bf1` and terminal checkpoint `90482d8fd454003319030d0f0f0304d1af66b983`. Start only after operator-authorized landing to `main`; never activate the candidate from a linked worktree. In a real operator-driven Prime Agent flow, use a real disposable reviewed specification and observe `/plan`, then use the resulting real reviewed plan and observe `/implement-spec`. At each boundary, capture the prep report, truthful compaction outcome (`scheduled: true` or truthful `scheduled: false`), exactly one canonical phase turn, queue drain, and absence of duplicate phase execution. Preserve normal exact-location and approval gates. Record cleanup/disposition for any disposable episode created. Do not substitute controlled-provider/native probes for the human-operated evidence.

## Legacy notes

Owner disposition 2026-10-02: Joe explicitly chose to defer the outstanding post-candidate operator dogfood from the compaction-first implementation episode into separately tracked post-merge work. This is a deferral, not completed dogfood evidence. Accepted implementation: Slice 1 `200be5744003ac47cecd2d79a337df3e4c4aeebc`; Slice 2 accepted replacement `c4de0a89c84aa02f1035f0f3f6ed4bc838223949`; terminal reconciliation `90482d8fd454003319030d0f0f0304d1af66b983`. Blocked until a separate operator-authorized merge and deliberate post-merge activation occur.
Blocked on a future explicit operator authorization to merge the accepted branch and on deliberate post-merge activation from primary main. This is a human/product gate, so no synthetic dependency is invented.
ARCHIVE BACKLINK — accepted predecessor episode artifacts are now archived at .ralph/plans/archive/compaction-first-phase-transitions/ in pushed commit b1953ac556328df1e627dc9d578da53df64f5058. This Bead remains P1/BLOCKED pending separate explicit merge authorization and deliberate activation from primary main. The archive is not dogfood evidence and does not change this Bead's acceptance criteria or authorize activation.
Integration branch now points to rebased reconciled tip `41fbaba4f1d13c974cc2ab1b4b1511bece752e50` on main base `eca48f8b284c990a8e030062ef70192313781b7f`; the dogfood task remains BLOCKED pending separate merge authorization and post-merge activation.
LANDED — Operator authorized direct main push. `origin/main` fast-forwarded from `eca48f8b284c990a8e030062ef70192313781b7f` to `41fbaba4f1d13c974cc2ab1b4b1511bece752e50` using SSH remote `git@github-sailorjoe6:SailorJoe6/prime-claw.git`; SSH authentication explicitly verified as GitHub user `SailorJoe6`. Local `main`, `origin/main`, live remote main, and episode branch now equal `41fbaba4f1d13c974cc2ab1b4b1511bece752e50`. The three pre-existing local modifications on main (`.beads/interactions.jsonl`, `.ralph/skills/implement-spec/SKILL.md`, `src/prime-agent-plugin/APPEND_SYSTEM.md`) were hash-verified unchanged. No PR, merge commit, host-global activation, branch deletion, worktree cleanup, or dogfood execution occurred. The merge prerequisite is now satisfied; this P1 remains BLOCKED only on deliberate post-merge activation from primary main and Joe’s human-operated dogfood.
CLEANUP VERIFIED — After direct fast-forward landing and follow-up main push, operator explicitly authorized cleanup. Prime Agent active route `a9f3d8fcd9ae` was stopped successfully; saved episode session `01a0fe1c-da17-7265-aee6-e6f82e8b5bf1` is archived/inactive with zero unfinished actions and retained as audit history. Clean worktree `/Users/jlanders/code/prime-claw-compaction-first-phase-transitions-episode` was removed without force. Local and live remote branch `episode/compaction-first-phase-transitions` were deleted only after ancestor checks against main. Main remains clean/synchronized at `92887a40a0b83de2c89971b432e4853c49ab3ab5`. Other episode worktrees were untouched. Plugin identity state remains absent. `prime-claw-h6w.28` remains P1/BLOCKED for deliberate post-merge activation and human dogfood.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Accepted feature is merged to primary `main`; user-global plugin activation, if used, is performed deliberately from primary `main` only. Joe runs real `/plan` and `/implement-spec` flows. Evidence shows one prep turn and one canonical phase turn at each boundary, truthful compaction status, exact location/approval behavior, no duplicate execution, and clean queue. Any created test bundle/episode is safely disposed. Results are documented and linked back to the archived compaction-first specification.
<!-- AC:END -->
