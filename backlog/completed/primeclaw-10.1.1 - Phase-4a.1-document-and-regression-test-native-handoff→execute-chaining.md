---
id: PRIMECLAW-10.1.1
title: 'Phase 4a.1: document and regression-test native handoff→execute chaining'
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
labels:
  - compaction
  - handoff
  - phase4
  - phase4a
dependencies: []
parent_task_id: PRIMECLAW-10.1
priority: p1
type: task
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document, regression-test, and finish hardening the first evidence-backed automation extracted from manual Ralph driving: the project-local native `/handoff` command that loads the canonical customizable `.ralph/skills/handoff/SKILL.md`, arms a deterministic chain marker, schedules focused compaction through the markdown workflow, and injects the canonical `.ralph/skills/execute/SKILL.md` after `session_compact`. This replaces the narrow execute→handoff→next-execute seam of the legacy shell loop without prematurely porting the whole orchestrator.

## Legacy design

Implemented architecture (commit 1fef26c):
- `.prime/agent/extensions/handoff-chain.ts` registers native `/handoff`.
- Command handler writes ignored `.prime/agent/state/chain-next` (`execute` by default), then loads/injects `.ralph/skills/handoff/SKILL.md` unchanged.
- `.agents/skills/handoff` symlink was removed to avoid `/handoff` versus `/skill:handoff` autocomplete contention.
- `session_compact` consumes/deletes the marker and loads/injects `.ralph/skills/<next>/SKILL.md`.
- Canonical workflow text remains project-customizable under `.ralph/skills`; extension code never duplicates it.

Legacy Ralph lineage studied from `/Users/jlanders/.local/bin/ralph` → `/Users/jlanders/.local/share/ralph/ralph` → `start`:
- The shell `while :` loop chooses design/plan/execute by presence of SPECIFICATION.md and EXECUTION_PLAN.md.
- Each execute pass runs the canonical execute prompt.
- If both planning docs remain, the script immediately runs handoff in the same Claude/Codex session (`--continue` or `exec resume`) and then loops into the next pass.
- The script also owns retries, permissions, interrupt forwarding, logging, container execution, callbacks, and failure classification.
- prime-claw deliberately replaces only the proven transition first: daemon-managed session + focused compaction + injected execute. The full orchestrator remains last.

Observed edge:
- Prime Agent refuses `compact.run()` when there is no history older than `keepRecentTokens` (default 20,000). In that case no `session_compact` event fires and the marker remains pending. Decide whether documentation is enough or code should clear/report this state; do not guess without evidence.

## Legacy notes

POST-COMPACTION HANDOFF (2026-09-16)

Why this exists: Joe manually drove Phase 3 with `/execute` then `/handoff` and observed a 100% invariant: whenever `/handoff` is invoked, another execute phase follows; no handoff is invoked at terminal spec close-out. This was selected as the highest-value first automation under the manual-first/codify-last policy.

Completed implementation/evidence:
- Commit `1fef26c` (already pushed) contains `.prime/agent/extensions/handoff-chain.ts`, removes `.agents/skills/handoff`, and ignores `.prime/agent/state/`.
- Mock extension harness: 22 checks passed (command registration, marker, canonical prompt wrappers, consumption, missing-file warnings, no-marker no-op).
- Real Prime Agent 0.9.5 fixture: native `/handoff` wrote marker, loaded canonical handoff markdown, real compaction occurred, one execute prompt appeared in JSONL, execute wrote proof, marker was consumed. TUI duplicate rendering was a display artifact; JSONL contained one prompt.
- Live dogfood in session `prime-claw implementation` (`01a08d45-2530-7042-9b25-132a01919d01`): handoff injected at 18:15:38; `compact.run` scheduled at 18:17:01; compaction entry `24cbcfb3` at 18:17:49; execute injected at 18:17:50. Execute then correctly paused at an explicit plan gate for slug confirmation; the chain itself succeeded. Joe subsequently reports the plugin works well in ongoing dogfooding.

Immediate next actions after compaction:
1. Claim/show this bead and re-read its parent epic plus VISION/LONG_RANGE_PLAN Phase 4.
2. Inspect current repo state and commit `1fef26c`; do not overwrite concurrent Phase 3 work.
3. Add a focused repo doc (likely `docs/episode-loop.md` or `docs/handoff-chain.md`) and link it from `docs/README.md`.
4. Add narrowly scoped automated tests for the TypeScript extension using Prime Agent's real jiti loader or an equivalent mock ExtensionAPI fixture.
5. Update LONG_RANGE_PLAN Phase 4a with the dogfooded first automation while retaining manual-first/codify-last and keeping Phase 4 incomplete.
6. Run focused/full tests, update this bead and parent notes, commit, pull --rebase, and push.

Authoritative boundaries: `.ralph/skills/*/SKILL.md` remains canonical and user-customizable. Do not create another handoff SKILL.md. Do not globalize the extension yet; project-local dogfooding must continue first.
2026-09-16 PRE-COMPACTION WORKTREE WARNING: shared repo is concurrently dirty from Phase 3 work at HEAD cd8c388. Do not edit or stage `.ralph/plans/EXECUTION_PLAN.md`, `bin/prime-claw`, `config/runtime.json`, `docs/home-embedding-runtime.md`, or `tests/test_embedding_candidate_build.py` unless the Phase 3 owner lands/clears them first. Phase 4a.1 should initially limit edits to new focused docs/tests plus docs index/LRP only after rechecking status and coordinating shared-file overlap.
2026-09-16 IMPLEMENTATION PROGRESS: Added `docs/handoff-chain.md`, linked it from `docs/README.md`, and updated LONG_RANGE_PLAN Phase 4a to identify the native chain as the first codified seam without marking 4a complete. Added `tests/handoff_chain_extension.test.mjs`, which imports the real TypeScript extension using Node's built-in type stripping and exercises it against a mock ExtensionAPI, plus `tests/test_handoff_chain_extension.py` so the suite runs under the repository pytest gate. Focused evidence: 8/8 Node subtests passed; 2/2 pytest tests passed. No Phase 3 files were modified or staged. Full-suite/rebase/push intentionally waits for the concurrent Phase 3a Slice 4A.2 session to commit and push.
2026-09-16 COMPLETE: Documentation and regression hardening landed and pushed in commit `aa2d260`. Added `docs/handoff-chain.md`, docs/LRP links, explicit Node 22.8+ developer prerequisite, 8 real-extension Node behavior subtests, pytest integration, and an offline real Prime Agent RPC loader smoke. Final evidence: `pytest -q tests/` = 150 passed, 9 pre-existing `load_module()` deprecation warnings; focused `pytest -q tests/test_handoff_chain_extension.py` = 3 passed. Local doc links resolve and `git diff --check` is clean. Review discovered the project-CWD marker collision risk and unvalidated target names; durable follow-up is `prime-claw-f81.2`, dependent on this task. The wider Phase 4a remains open/manual-first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Complete when: (1) repository docs explain the native handoff chain, canonical-markdown customization, session-CWD discovery, marker lifecycle, focused compaction, legacy Ralph-loop relationship, and short-session edge; (2) docs index and LONG_RANGE_PLAN Phase 4a reference the shipped evidence without declaring Phase 4 complete; (3) automated repository tests cover command registration, exact canonical markdown loading, missing-skill failure, marker creation/consumption, no-op compaction without marker, and exactly-once execute injection; (4) the duplicate `.agents/skills/handoff` surface remains absent; (5) live dogfood evidence from the prime-claw implementation session is recorded; and (6) all changes are committed and pushed.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documented and regression-tested native handoff chaining; commit aa2d260 pushed; 150 tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
