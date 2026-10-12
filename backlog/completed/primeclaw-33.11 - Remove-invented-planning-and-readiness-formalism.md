---
id: PRIMECLAW-33.11
title: Remove invented planning and readiness formalism
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels:
  - prime-agent-plugin
  - simplification
  - user-stories
dependencies: []
parent_task_id: PRIMECLAW-33
priority: p0
type: bug
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove the unrequested mandatory threat-model, trusted-assumption, failure-model, manual-recovery, complexity-budget, hardening-backlog, promotion-trigger, numeric repair-stop, repeated authority, and over-specified slice-evidence requirements from active Prime Claw workflows, project templates, user stories, docs, and enforcing tests. Restore a proportional readiness test: the operator-approved bundle must be clear and actionable enough to implement without guessing material product decisions and have no unresolved contradiction that actually blocks safe implementation. Retain one narrow guard against the observed recurring failure: Expert review is non-adversarial by default, speculative hardening and reviewer novelty are not product scope, and only concrete material defects against the approved contract may block unless the operator explicitly requests red-team review.

## Legacy notes

Removed the invented mandatory planning/readiness formalism from active specification, planning, implementation-admission, execution, Expert-review, oversight, user-story, and supporting-doc surfaces. Readiness is now proportional: coherent approved outcome/scope, enough decisions and actionable plan to avoid guessing material product choices, and no contradiction/blocker that actually prevents safe implementation. Retained an explicit failure-mode guard: normal Expert review is not adversarial/red-team unless the operator requests it; speculative hardening, alternative architecture, and reviewer-invented invariants are non-blocking and cannot add scope. Simplified the active replace-beads execution plan from admission boilerplate to the actual ordered work. Updated tracked project copies and template-state digests. Validation: 604 passed/1 skipped host static; 108 Node tests passed; focused policy tests 25 then 29 passed; pinned Prime Agent 0.9.8 Tier 1 PASS at .test-results/20261011T213822Z-99215-0eeacede/tier1. Direct container pytest attempt was not a product failure: it refused setup because this new worktree had no .env; the canonical Tier 1 rerun used an isolated selector file and passed.
Independent read-only normal engineering review of exact commit 70f6401: PASS, no concrete material defect. Reviewer confirmed active source uses proportional readiness, Expert/oversight guard is non-adversarial by default with explicit-request-only red-team review and non-blocking speculative additions, tracked copies are byte-identical, manifest hashes match, and 25 focused tests pass.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed mandatory formalism across active surfaces; validated, independently reviewed PASS, merged/pushed as 70f6401, and refreshed the user-global plugin.
<!-- SECTION:FINAL_SUMMARY:END -->
