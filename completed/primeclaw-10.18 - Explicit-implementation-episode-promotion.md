---
id: PRIMECLAW-10.18
title: Explicit implementation episode promotion
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
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Slice 3 only: native `/implement-spec <future-folder>` readiness workflow plus one narrowly scoped structured host capability that safely creates and identifies a worktree-isolated implementation episode, promotes an opaque approved bundle on the episode branch, forks/publishes inherited session context, and delivers canonical execute exactly once. Add focused unit/temp-Git/offline-RPC tests and operator docs. Do not start Slice 4.

## Legacy notes

Owner-review revision complete. Execute admission now persists a minimal identity with `pending` before prompt delivery, transitions to `uncertain` on ambiguous admission and `delivered` only after confirmed admission, and never kills/deletes on uncertain delivery or the post-admission/pre-mark crash window. Replays of pending/uncertain identities return without redelivery. Git cleanup now reports worktree-removal and branch-deletion failures independently; partial cleanup becomes an uncertain preserved-resource result and identity/session artifacts remain. New worktrees are verified clean and promotion always creates the required marker commit with `--allow-empty`, including a no-tree-diff case; canonical uncommitted approved content is still overlaid and committed. Evidence: combined Node suites 34/34 passed; focused Python suite 18/18 passed; git diff --check passed. Slice 4 not started.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Invalid command input never invokes the model; inadequate semantic readiness makes no tool call; a ready arbitrary bundle is promoted in a sibling episode worktree while canonical future files remain; promotion is committed; inherited sibling context/CWD/identity and exactly-once execute delivery are proven; matching replay is idempotent and collisions fail without deletion; offline RPC registers command and tool; tests/diff check pass; commit pushed.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slice 3 owner-review corrections complete: durable admission, observable cleanup, and no-diff marker commits.
<!-- SECTION:FINAL_SUMMARY:END -->
