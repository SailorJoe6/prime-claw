---
id: PRIMECLAW-10.17
title: Native reviewed plan command
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Slice 2 of the reviewed worktree-isolated specification episode: add a native /plan <future-folder> command with safe deterministic folder validation and canonical plan-skill loading; update the plan workflow; remove the duplicate skill surface; add Node and Python/offline-RPC tests; document behavior; do not start Slice 3.

## Legacy notes

Completed Slice 2 only. Added native `/plan .ralph/plans/future/<slug>` in `.prime/agent/extensions/reviewed-plan.ts` with deterministic safe-slug, relative-path, existing-directory, containment, and realpath/symlink validation. Valid input loads current `.ralph/skills/plan/SKILL.md` and appends the validated location exactly once; invalid input never invokes the model. Updated canonical plan policy to write and revise planning artifacts in the selected future folder and stop for operator review. Removed duplicate `.agents/skills/plan`. Added Node tests plus Python/offline-RPC bridge and expanded operator docs. Evidence: Node 9/9 passed; focused episode Python 15/15 passed; git diff --check passed. Slice 3 not started.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Offline RPC reports exactly one project-native /plan command; invalid paths never call sendUserMessage; valid future folder injects current canonical plan Markdown and the exact validated operator location once; plan workflow writes to the same folder and stops for operator review; focused Node/Python tests and git diff --check pass; commit is pushed.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slice 2 native reviewed planning gate, policy, tests, and documentation complete.
<!-- SECTION:FINAL_SUMMARY:END -->
