---
id: PRIMECLAW-10.24
title: Add conversational implementation adapter
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
updated_date: '2026-10-12 01:02'
labels:
  - conversational-routing
  - episode-loop
  - phase4
  - ralph
dependencies:
  - PRIMECLAW-10.23
parent_task_id: PRIMECLAW-10
priority: p2
type: task
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Slice 3 after Slice 2 acceptance: run the focused public-runtime ordering probe, then expose `ralph_implement_spec` with trusted host confirmation and only the approved small same-run authorization gate, or retain native-only behavior if the probe fails.

## Legacy notes

Slice 3 followed the approved probe-or-omit branch. Installed Prime Agent 0.9.5 offline RPC with a credential-free custom stream proved: confirmation resolves, readiness is queued as steer, matching input arrives with source=extension, then agent_end fires before the readiness agent turn. Because the approved pending→active→consumed design must clear on agent_end, it cannot safely authorize the readiness turn without forbidden cross-run lifecycle state. ralph_implement_spec therefore remains unregistered and implementation remains native-only. Regression coverage locks the event order and absence of the tool; no episode resources were created. Validation: reviewed-plan Node 19/19; spec-episode Node 22/22; focused Python 9/9; full pytest 249 passed, 11 warnings; py_compile and git diff --check green. Delivered commit: 272372c9e848c21d48a5968144d2495ea59c4a2e. Independent Slice 3 review found one P1 documentation contradiction (plan still described three delivered adapters); repaired before commit by marking the implementation path conditional/not delivered and making final discovery require the two routing adapters, existing create_spec_episode, and explicit absence of ralph_implement_spec. Reviewer rechecked and returned PASS with no material contradiction.
PROJECT_CONVERSATION acceptance after independent exact-commit review: `272372c9e848c21d48a5968144d2495ea59c4a2e` matches the pushed remote and clean worktree. Reviewed-plan Node 19/19, spec-episode Node 22/22, focused Python 9/9, full repository 249 passed with 11 warnings, and `git diff --check d011968..272372c` passed. Diff review found no material defect. The native-only `ralph_implement_spec` fallback correctly follows the approved probe-or-omit rule and preserves native `/implement-spec` authority.
PROJECT_CONVERSATION accepted exact Slice 3 commit 272372c9e848c21d48a5968144d2495ea59c4a2e after independent verification. Acceptance recorded in active-plan state by administrative commit a25f3b426f8ebe222911d78458f899098e017ff5. Episode remains idle; final integration, archival, Expert review, and merge gate have not started.
Final owner-controlled Expert review of exact candidate `a25f3b426f8ebe222911d78458f899098e017ff5` returned BLOCK: four links in active `.ralph/plans/SPECIFICATION.md` retained future-folder relative depth and were broken. No other material issue was found. Adjudication: produce one bounded final repair that archives the completed SPECIFICATION/EXECUTION_PLAN under `.ralph/plans/archive/conversational-ralph-command-routing/`, keeps/rebases links for that final archive depth, replaces the uncommitted active-root-only regression with archive-link validation, updates archive metadata, validates fully, commits/pushes once, and stops for renewed final Expert review.
Final EXPERT disposition on candidate a25f3b426f8ebe222911d78458f899098e017ff5 was REVISE for broken active-spec relative links after promotion. Bounded repair/archive commit 0f888c477755fb7725a9cc6edba2024d858c1672 archives the accepted plan and specification under .ralph/plans/archive/conversational-ralph-command-routing/, rebases all specification links for final archive depth, adds a focused archived-bundle link regression, and updates the archive index. The incubating conversation-driven-episode-oversight bundle is unchanged. Validation on the repaired candidate: Node suites 13/13, 19/19, 22/22; full pytest 250 passed with 11 warnings; installed-runtime discovery 2/2; git diff --check green. Awaiting renewed owner Expert review; not merged and no episode resources cleaned.
Renewed owner-controlled final Expert reviewed exact candidate `0f888c477755fb7725a9cc6edba2024d858c1672` versus base `49547fe32995edcf6a5ed2a7c34a5a2d6469143e` and returned PASS with no Critical/High/Medium/Low findings and no required repairs. It confirmed native behavior, `ralph_handoff`, `ralph_plan`, intentional absence of `ralph_implement_spec`, lifecycle-probe fallback, archive-link repair, archive metadata, unchanged oversight bundle, exact remote synchronization, and clean worktree. Residual risks are advisory only: model compliance with prompt guidance, runtime-version-specific implementation fallback, and separate explicit merge/cleanup decisions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Meets the matching approved execution-plan slice, including focused and full tests, current operator documentation, one clean pushed commit, and exact evidence recorded on the bead.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed
<!-- SECTION:FINAL_SUMMARY:END -->
