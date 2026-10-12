---
id: PRIMECLAW-10.27
title: Avoid source-mode package re-import during episode creation
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p1
type: bug
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
create_spec_episode fails in the current source-mode Prime Agent generation because Prime Claw dynamically imports @earendil-works/pi-coding-agent from a Jiti-loaded extension. The nested model-registry import of @earendil-works/pi-ai/mcp is rewritten to index.ts/mcp. Fix only Prime Claw: reuse the actual SessionManager constructor already supplied by ctx.sessionManager, validate forkFrom, remove the dynamic package import, preserve full owner-session fork semantics and fail-closed cleanup. Do not patch Prime Agent or maintain a fork.

## Legacy notes

2026-09-30 ACCEPTED: after the managed plugin restart and a fresh native /implement-spec approval, create_spec_episode succeeded through the plugin-only runtime SessionManager path. Stable episode 01a0f0a2-a3d5-706e-92e6-0448235e8127, branch episode/goal-heartbeat-work-control, worktree /Users/jlanders/code/prime-claw-goal-heartbeat-work-control-episode, session goal-heartbeat-work-control-episode. Initial canonical handoff is active and execute is independently queued. No Prime Agent source change or fork was made. Shipped commit a2d256d remains the accepted fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Focused tests prove runtime-constructor forkFrom works and no dynamic coding-agent import remains; existing episode tests and full active suite pass; managed global plugin apply/check pass; commit is pushed; after the required single-daemon restart, /implement-spec replay admits the approved goal-heartbeat episode.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prime Claw-only fix a2d256d verified by successful source-mode episode admission
<!-- SECTION:FINAL_SUMMARY:END -->
