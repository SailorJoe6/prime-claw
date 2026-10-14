---
id: PRIMECLAW-10.1
title: 'Phase 4a: refine the imported prime-agent phase skills by manual driving'
status: In Design
assignee: []
created_date: '2026-10-12 01:00'
updated_date: '2026-10-14 14:45'
labels: []
dependencies:
  - PRIMECLAW-7
parent_task_id: PRIMECLAW-10
priority: p1
type: feature
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Adapt Ralph's four phase skills to prime-agent-native form. Handoff triggers targeted compaction (compact.run with focus hint) instead of writing for an amnesiac successor. Skills are REPL-aware and deliberate about living-doc status. Pull Joe's existing prime-agent-flavored skills from other repos as the starting point. Done when the four skills exist and Joe has manually driven one real feature through them.

## Legacy notes

Re-scoped to Phase 4a in the slice-based LONG_RANGE_PLAN.md. The 7 imported skills are the starting point; refine by manually driving real features ON the proven runtime (after Phase 3). Supersedes the old 'Phase 1' framing.
2026-09-16 FIRST EVIDENCE-BACKED AUTOMATION SHIPPED: native project-local `/handoff` deterministically loads canonical `.ralph/skills/handoff/SKILL.md`, arms a marker, compacts, then injects canonical execute after `session_compact`. Implemented in commit 1fef26c and live-dogfooded successfully. Documentation/regression hardening is tracked by child PRIMECLAW-10.1.1. Do not mark 4a complete: broader skill refinement through real work continues.
2026-09-16 CHILD COMPLETE: `PRIMECLAW-10.1.1` documented and regression-tested the native handoff chain in pushed commit `aa2d260`; full suite 150 passed. `docs/handoff-chain.md` now records architecture, legacy loop lineage, dogfood evidence, short-session recovery, and current limitations. Follow-up `PRIMECLAW-10.1.2` tracks session-scoped markers and next-target validation. Phase 4a remains open for continued manual skill refinement.
2026-09-17 CHILD COMPLETE: `PRIMECLAW-10.1.2` landed in pushed commit `c1c98a8`. `/handoff` now always resumes canonical execute, treats all trailing text as compaction guidance, and keys in-memory pending state by Prime Agent session UUID with consume-once and legacy-marker cleanup. Full suite: 201 passed. Separate follow-up `PRIMECLAW-10.1.3` tracks real root/RLM-child `pi.sendUserMessage` delivery proof at the Prime Agent shared-runtime boundary; Phase 4a remains open.
<!-- SECTION:DESCRIPTION:END -->
