---
id: PRIMECLAW-10.37.3
title: Implement simplified Conversation and Episode lifecycle with Orca integration
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies:
  - PRIMECLAW-10.37.1
parent_task_id: PRIMECLAW-10.37
priority: p1
type: task
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the accepted simplified Conversation/Episode lifecycle after the discovery ticket freezes the Prime Agent/Orca boundary.

Scope:
- Rename reviewed planning to `/plan-spec`, internal `plan-spec`, and `plan_spec` while preserving compact-first sequencing.
- Replace authenticated Conversation-guide disclosure with normal first load during `/implement-spec` and exactly-once full reinjection after qualifying compactions.
- Remove guide hashes/versions, collision and canonical-file policing, activation/readiness tools, receipts, transcript-pair observation, consumed state, replay redaction, duplicate markers, and related recovery states.
- Start a fresh Episode from the promoted durable bundle and one fixed ordinary execute assignment rather than forking Conversation history or running an initial handoff.
- Use the evidence-backed Orca path as preferred engine; provide visible direct local fallback only for safe pre-mutation unavailability.
- Implement the multi-location picker and stable-ID noninteractive bypass; enable remote placement only if discovery proved exact-bundle transport and session interoperability.
- Reduce ownership to one durable record and preserve only evidence-backed uncertain-mutation handling.
- Preserve Conversation evidence review, bounded revision, handoff/continuation, Expert use, goals-and-heartbeats, operator authority, and narrow deterministic final bookkeeping.

## Legacy notes

Execution started on clean synchronized main at 5994496. Frozen implementation order: A rename native planning to /plan-spec and plan_spec while preserving compact-first prep; B replace per-slug identity plus transcript markers and authenticated guide receipts with one project-level ownership record; C load ordinary full oversight guidance in the post-prep /implement-spec turn and reinject it once per qualifying session_compact for the active owner; D implement ready-setup selection, native picker, stable --host bypass, remote rejection, and strict pre-mutation-only fallback; E replace inherited fork + initial handoff with provisioning record, agentless background Orca worktree, exact promotion commit, disabled reusable prime-agent automation, one fixed execute assignment, session/tab binding, automation removal, and active ownership; F rebase handoff/recovery/finalization on the record and validate focused, Tier 0, Linux-authoritative, Docker Tier 1, plus independent review. .ralph/plans remains untouched because its active files belong to unrelated historical work. No Prime Agent source/global runtime/v0.10 changes.

Implementation/validation checkpoint 2026-10-10: all nine acceptance criteria are implemented. Planning surfaces are `/plan-spec`, `plan-spec`, and `plan_spec` with compact-first admission. Authenticated guide metadata/tools/receipts/markers/redaction are deleted; ordinary oversight guidance loads in the implementation phase and a real Prime Agent 0.9.8 compaction probe proves one full non-turn guide only for the active owner. Episode creation binds and revalidates an exact recursive bundle digest, uses a fresh durable session, and admits one fixed execute assignment with no forked transcript or initial handoff. Preferred Orca creation persists before mutation, selects exact ready setup IDs, rejects cancellation/noninteractive ambiguity/remote placement before mutation, promotes before provider launch, binds exact daemon CWD plus a visible rendered provider-ready tab/pane, removes the temporary disabled automation, and preserves uncertain boundaries without replay or local fallback. Direct local fallback is limited to definitive pre-mutation Orca unavailability and persists the allocated session identity before publication. One `.prime-claw/ownership.json` record now owns lifecycle state; handoff, route refresh, manual uncertain recovery, and no-UI final bookkeeping use it. Operator-only product/scope/merge/abandonment/cleanup authority, Expert review, and bounded goals/heartbeats remain explicit. `.ralph/plans` is unchanged.

Validation: Node 102/102 passed; host Tier 0 660 passed, 1 skipped, 63 deselected, 75 subtests; Linux-authoritative container 61 passed, 2 skipped, 661 deselected; isolated native compaction and four-probe lifecycle sequences passed; pinned Prime Agent 0.9.8 Tier-1 offline apply/check/RPC probe passed with clean teardown at `.test-results/20261010T200742Z-60943-8eed4107/tier1`; `git diff --check` and script/Python syntax checks passed. A read-only implementation audit found exact-bundle, pre-publication identity, rendered-tab readiness, and remote-only inventory gaps; all were repaired and re-review returned PASS. Automatic uncertain-state continuation was explicitly rejected as outside the accepted minimal/manual-recovery boundary. Final exact-commit managed EXPERT review remains before closure.

Final independent review repair checkpoint 2026-10-10: GPT-6 Astra reviewed exact candidate 94545e9 and requested three narrow in-contract changes. Fixed all three: (1) fresh local SessionManager allocation now calls the supported `flushNow()` before the durable ownership checkpoint and daemon reopen; a real pinned 0.9.8 extension proof verifies the file exists at allocation and reopen preserves ID/file. (2) explicit `--host id:<setup-id>` now fails before ownership or resource mutation when Orca inventory is unavailable, while selector-free definitive pre-mutation unavailability retains automatic local fallback. (3) active reuse now refreshes, persists, and returns an already-live replacement `activeSessionId` without reopen, execute, handoff, or fresh allocation. Added Node regressions for explicit-host fail-closed and live-route refresh. Also made all Docker-native Prime Agent probes use unique config, session, TMPDIR-derived daemon socket, and supervisor registry roots; cleanup uses supported public `shutdown --force --json` inside that exact isolated environment and waits for the exact socket family to exit. This removes order-dependent stale-supervisor guard races without touching the host/global daemon.

Exact repaired-tree validation: Node 104/104; host Tier 0 660 passed, 1 skipped, 64 deselected, 75 subtests; Linux-authoritative container 62 passed, 2 skipped, 661 deselected; ordered native lifecycle sequence 6/6; pinned Prime Agent 0.9.8 Tier-1 offline apply/check/RPC passed with network absent and teardown verified at `.test-results/20261010T210948Z-88407-db8564ec/tier1`; shell/Python syntax and `git diff --check` passed; `.ralph/plans` remains unchanged. Exact repaired-commit Astra verification is the remaining pre-closure gate.

Exact-commit independent verification: GPT-6 Astra re-reviewed repaired commit 3863f02 against 94545e9 and returned PASS with no material in-contract blockers. The reviewer independently reproduced real 0.9.8 flush/reopen success, verified explicit-host pre-mutation refusal and live-route persistence without replay, ran the Episode Node suite 24/24 in network-disabled Docker, and confirmed the Docker-only TMPDIR/socket/registry cleanup uses supported pinned interfaces without host/global changes. No optional hardening or scope expansion is required.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Planning names are consistent and compact-first behavior remains proven.
- [ ] #2 Guide authentication/disclosure/receipt/redaction/readiness machinery and duplicate lifecycle state are removed with regression coverage.
- [ ] #3 `/implement-spec` loads normal oversight guidance and each qualifying compaction reinjects it exactly once only for the active owner.
- [ ] #4 Episode creation uses a fresh session, exact durable bundle, and one fixed execute assignment with no inherited Conversation transcript or initial handoff.
- [ ] #5 Preferred Orca creation, safe local fallback, uncertain mutation preservation, picker, stable-ID bypass, cancellation, and noninteractive behavior match the evidence-backed parent design.
- [ ] #6 Remote placement is enabled only if the discovery acceptance gate passed; selected remote failure never falls back locally.
- [ ] #7 One minimal ownership record supports exact owner/location/session/workspace/engine binding and terminal bookkeeping.
- [ ] #8 Handoff/continuation, Expert review, bounded goals/heartbeats, operator-only decisions, and finalization work end to end.
- [ ] #9 Focused tests, Tier 0, relevant Linux-authoritative coverage, and Docker Tier 1 pass.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented and validated simplified v0.9.8 Conversation/Episode lifecycle; exact commit 3863f02 independently reviewed PASS
<!-- SECTION:FINAL_SUMMARY:END -->
