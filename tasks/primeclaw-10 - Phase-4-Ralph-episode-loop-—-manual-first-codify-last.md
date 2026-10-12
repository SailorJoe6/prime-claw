---
id: PRIMECLAW-10
title: 'Phase 4: Ralph episode loop — manual-first, codify-last'
status: To Do
assignee: []
created_date: '2026-10-12 01:00'
updated_date: '2026-10-12 01:16'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
priority: p1
type: epic
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the Ralph inheritance described in VISION.md and LONG_RANGE_PLAN.md Phase 4: a manually driven, prime-agent-native design → plan → execute → handoff episode loop running on the proven sandbox runtime. Preserve the three-horizon context model: tight sweet-spot context within an iteration, episode-scoped REPL state across compactions, and product-lifetime truth in living project docs plus the brain. Automation must follow observed, repeatable manual practice; do not design the orchestrator up front.

## Legacy design

Source of truth:
- VISION.md: conversation → episode transition and handoff → focused-compaction insight.
- LONG_RANGE_PLAN.md Phase 4: 4a phase skills, 4b episode mechanics, 4c /spec-it-out boundary, 4d upgrade command.

Build order and policy:
1. Manual-first, codify-last. Drive real work using the canonical .ralph/skills markdown.
2. Automate only stable, repeated transitions supported by dogfooding evidence.
3. Keep canonical customizable workflow text in .ralph/skills; Prime Agent extensions load it rather than duplicate it.
4. Handoff updates living docs/Backlog.md tasks, schedules focused compaction, and then continues with the next observed phase.
5. Learn REPL-vs-living-doc boundaries and what crosses conversation→episode through real runs.
6. Episode children must be CWD-scoped, spawnable/reapable, and past-design-aware.

Current evidence:
- Joe manually drove Phase 3 with the Ralph skills.
- A 100%-repeatable handoff→compaction→execute transition was identified and implemented as a project-local native /handoff extension.
- Dogfooding in the prime-claw implementation session proved actual compaction and automatic execute injection; execution then correctly stopped at an explicit plan confirmation gate.

## Legacy notes

HANDOFF / RESUME CONTEXT (2026-09-16): This epic was created after successful dogfooding of the first stable Phase 4 automation. Existing Backlog.md tasks PRIMECLAW-10.1 (4a), PRIMECLAW-10.2 (4b), PRIMECLAW-10.3 (4c), and PRIMECLAW-10.4 (4d) are the planned child workstreams and retain their dependency chain. Immediate work is the 4a child for documenting and regression-testing native /handoff→focused-compaction→/execute chaining. Phase 3 PRIMECLAW-7 remains the runtime dependency and is still in progress.
2026-09-16 LEGACY LOOP LINEAGE: `/Users/jlanders/.local/bin/ralph` delegates to `~/.local/share/ralph/ralph`, whose `start` script runs an infinite phase loop. It selects design/plan/execute from planning-doc presence; after every non-terminal execute pass it runs handoff in the same Claude/Codex session, then returns to the next execute pass. It also owns process/retry/permission/container/logging concerns. prime-claw must not port that whole shell orchestrator yet: the native handoff chain is the first narrow, dogfooding-proven replacement seam. Detailed continuation is in child PRIMECLAW-10.1.1.
Planning complete in commit 7b797db on branch poc/spec-it-out-worktree-episode. `.ralph/plans/EXECUTION_PLAN.md` defines eight dependency-ordered vertical slices with complete R-WE-1..36 and D-WE-1..14 coverage. Implementation beads PRIMECLAW-10.6 through PRIMECLAW-10.13 were created in a strict dependency chain. No implementation started.
Delivered in commit `0a940c6` (`feat: add specification disposition preflight`) on branch `poc/spec-it-out-worktree-episode`. Next dependency-unblocked slice is `PRIMECLAW-10.7`; it has not been started.
Delivered Slice 2 in commit `6a0d4e4` (`feat: add safe future specification incubation`) on branch `poc/spec-it-out-worktree-episode`. Exact final evidence: focused Node suite 50/50; plan-required active project suite `pytest -q tests` 237 passed, 11 warnings. Next dependency-unblocked slice is `PRIMECLAW-10.8`; it has not been started.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase 4 is complete when: (1) the canonical phase skills have been refined through real manual use; (2) a brainstorm conversation transitions via /spec-it-out into a CWD-scoped episode; (3) the episode completes design→plan→execute→handoff iterations on the sandboxed runtime and ships a real feature; (4) focused compaction and invocation-tier REPL behavior are documented and tested; (5) the context-crossing decision is documented; (6) the episode child is cleanly reaped; and (7) the upgrade-this-to-prime-agent command is dogfooded on Ralph and another project.
<!-- AC:END -->
