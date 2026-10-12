---
id: PRIMECLAW-10.25
title: Add owner-driven remote episode handoff admission
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
labels:
  - episode-loop
  - follow-up
  - oversight
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p0
type: task
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the missing deterministic owner-to-episode transition. The existing episode publisher has `deliverExecute()` but no counterpart that delivers canonical handoff and queues canonical execute. Because `agent_message.send()` is ordinary model input, the operator currently has to enter `/handoff` in the episode TUI. Add one narrow `deliverHandoff()`-style host operation for the exact owned episode so the PROJECT_CONVERSATION can drive initial context focusing and between-slice continuation without human transport work.

## Legacy design

Build the smallest counterpart to `deliverExecute()`. Share canonical handoff admission mechanics where practical, retain Markdown as workflow policy, and reuse existing owner/episode identity. This is P0 and the first implementation item after the active conversational-routing episode reaches terminal disposition; do not expand that active episode.

## Legacy notes

Operator designated this as the highest-priority next item after the active conversational-routing episode. The active manual POC proved the gap: the operator had to enter native /handoff in the episode TUI because the owner conversation lacked deterministic remote handoff admission.
Operator reaffirmed that this missing control primitive is the most important next work because it removes manual TUI monitoring and handoff delivery from the oversight loop.
Conversational-routing predecessor merged to main at `0f888c477755fb7725a9cc6edba2024d858c1672`; exact candidate passed renewed final Expert review and clean detached validation. Its episode session is inactive, worktree/branches/identity are retired, so this P0 owner-driven `deliverHandoff()` work is now the highest-priority next implementation item.
Delivered owner-driven remote episode handoff in `24faed80a4396c9f33f09311570388879de55b88` on pushed branch `feature/owner-driven-remote-handoff`. Added narrow `handoff_spec_episode(location, guidance?)`, shared canonical handoff/execute prompt construction, exact owner and durable identity validation, inactive-session reopen with refreshed routing identity, fail-closed live daemon quiescence checks, handoff `steer` with `queueIfBusy:false`, and exactly one execute `followUp`. First-send, partial second-send, and uncertain mutation failures are visible and never trigger resource cleanup or automatic retry. Initial `createSpecEpisode()` deliberately remains direct `deliverExecute()` because bootstrap has no completed slice and a two-mutation creation path would require new durable partial-state/cleanup semantics. Validation: Node 66/66; full pytest 250 passed with 11 warnings; git diff check clean; all new documentation links resolve. Independent read-only review returned PASS with no required repairs.
Reopened after operator corrected a compaction-era design regression. Original session evidence at `/Users/jlanders/.prime/agent/sessions/01a0ba54-da05-76bd-8d22-a0facfdd7f31.jsonl` records that the missing `deliverHandoff()` caused BOTH failures: initial episode creation skipped context-focusing handoff, and the owner could not drive later slices. Intended startup is fork/publish → canonical handoff steer → focused compaction request → exactly one canonical execute follow-up. Commit `24faed80a4396c9f33f09311570388879de55b88` solved only between-slice continuation and incorrectly retained direct bootstrap `deliverExecute()`. Repair must adapt durable exactly-once initial-admission state and must not merely replace the prompt or add generic routing.
Corrected the missing handoff-first bootstrap requirement in `dca84909645b0eaa5120c3bd280783253c3dc16f` on pushed branch `fix/handoff-first-episode-bootstrap`. New `createSpecEpisode()` flow is publish → durable v2 `handoff-pending` → canonical handoff steer → durable `execute-pending` checkpoint → exactly one canonical execute follow-up → `delivered`. Nonterminal stages record definite/uncertain first/second mutation outcomes, preserve all resources after handoff may have been admitted, and never replay automatically. Version-1 `executeAdmission` identities remain truthful legacy direct-execute records; delivered v1 episodes remain eligible for later owner handoff, unresolved v1 episodes fail closed. Recovered source of truth: current session JSONL lines 1426–1449 explicitly states the missing primitive caused both initial context and later-slice failures. Validation: Node 72/72, full pytest 250 passed with 11 warnings, diff/link checks clean. Independent review initially BLOCKed one stale replay paragraph; repaired and renewed review PASS with no further repairs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The owner can invoke one narrow operation for its exact idle episode; the operation preflights canonical handoff and execute, delivers handoff first, queues execute exactly once as the sole follow-up, and produces observable evidence that handoff requested compaction before execute continued. Use it for owner-driven slice transitions and explicitly decide whether episode creation should use it instead of initial `deliverExecute()`. Cover the successful path and visible first/second-send failure while reusing existing episode identity and validation. Do not add a generic remote command router, copied workflow prose, nonces, leases, or a new authorization subsystem.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed handoff-first bootstrap correction in dca84909645b0eaa5120c3bd280783253c3dc16f
<!-- SECTION:FINAL_SUMMARY:END -->
