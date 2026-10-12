---
id: PRIMECLAW-10.5
title: POC worktree-isolated specification episode
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
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prototype the conversation-to-episode boundary discussed with the operator: update VISION.md and LONG_RANGE_PLAN.md at their existing level of detail, create an isolated Git worktree/branch for a specification episode, and establish a durable worktree-rooted Prime Agent session carrying the current conversation context. Record evidence and any gaps in the future custom /spec-it-out behavior.

## Legacy notes

POC episode established. Owner sibling: PWD in Prime Agent Questions (session 01a0b5fe-e74c-7149-80b9-f328a5b1924f, /Users/jlanders/code/prime-claw). Episode: poc-spec-it-out-episode (session 01a0b638-b392-778e-8c04-c5307740fc42, active a29d878ba19d), branch poc/spec-it-out-worktree-episode, CWD /Users/jlanders/code/.prime-worktrees/prime-claw/poc-spec-it-out-episode. Full conversation inherited; sibling owner delivered task directly. Active specification bundle written at .ralph/plans/{SPECIFICATION,REQUIREMENTS,DECISIONS}.md. Implementation intentionally not started. Known gap: automate transcript fork + sibling activation + durable ownership + exactly-once delivery through a stable extension path and test failure recovery.

Owner review applied in commit 1566862 (pushed): corrected proven SessionManager.forkFrom + daemon create(sessionPath) mechanism versus fresh rlm.create_session; made complete active-branch transcript inheritance a gate; specified serialized ownership-safe future-plan commits in the shared canonical checkout; and required a stable structured multi-turn bridge into trusted host automation. Document checks: 36 unique requirements, all traced; bundle links present; git diff --check passed. Planning and implementation remain unstarted pending separate instruction.
Planning complete in commit 7b797db on branch poc/spec-it-out-worktree-episode. `.ralph/plans/EXECUTION_PLAN.md` defines eight dependency-ordered vertical slices with complete R-WE-1..36 and D-WE-1..14 coverage. Implementation beads prime-claw-h6w.2 through prime-claw-h6w.9 were created in a strict dependency chain. No implementation started.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 VISION.md and LONG_RANGE_PLAN.md capture canonical checkout/project conversation/worktree episode semantics; a separate branch and worktree exist; a durable Prime Agent session is rooted in the worktree and has the relevant conversation context; evidence and limitations are documented.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
POC completed: architecture docs updated, worktree-rooted sibling episode proven, specification bundle committed and pushed; feature implementation intentionally deferred.
<!-- SECTION:FINAL_SUMMARY:END -->
