---
id: PRIMECLAW-61
title: Queue task handoffs across busy heartbeat races and define refusal recovery
status: In Planning
assignee: []
created_date: '2026-11-16 03:00'
updated_date: '2026-11-16 03:02'
labels: []
dependencies: []
references:
  - >-
    /Users/jlanders/.prime/agent/session-artifacts/01a1e1d4-dfbc-746f-a0ee-af3912b37535/task-2-refused-handoff/report.md
  - >-
    /Users/jlanders/.prime/agent/session-artifacts/01a1d792-ed7e-7333-a01e-c9ca5e1a6922/task-2-offline-consumer-review/handoff-refusal-investigation/accepted-diagnosis-published-blocker.md
documentation:
  - REQUIREMENTS.md
  - docs/handoff-chain.md
priority: p1
type: bug
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome and accepted context

Prevent an initial canonical task-native Episode handoff from failing solely because a scheduled status-check heartbeat wins the gap between the owner’s idle observation and prompt admission. Establish a small, explicit, editable recovery disposition for a definite first-stage refusal, without weakening the no-replay boundary for uncertain or partial delivery. Continue the same intended Episode resources only through supported canonical operations and later explicit operator recovery authority.

The accepted diagnosis localizes the pod-pricing incident to first handoff admission: task preparation checks exact native identity but does not reserve idle state; deliverOwnedEpisodeHandoff omits the publisher’s existing fifth queueHandoffIfBusy argument, so the first prompt uses queueIfBusy:false without streamingBehavior. Checked-out native source rejects the observed busy prompt before action admission. The workflow chain calls the existing observation callback and sends execute only after first admission succeeds. Installed/source bytes matched when diagnosed. No raw daemon command/action trace or running compiled-build attestation was captured: this is source-plus-runtime localization, not wire-level proof of every event. Task-history preparation precedes delivery; do not claim all preparation had no effects.

## Required behavior

Use the existing supported native followUp + queueIfBusy:true delivery option for the ONE initial task-native canonical handoff request. The narrow candidate is forwarding Boolean(promptIdentity.taskId) as the existing fifth publisher argument. Verify actual caller forwarding and native option semantics, not only a publisher stub. Preserve retained version-1 idle-only behavior. Preserve admitted first prompt -> factual ownership-evidence callback -> ONE canonical execute follow-up. A refusal or uncertainty must be reported honestly without catch/resend, automatic retry, second transport, duplicate execute, or silent partial-failure replay. Two remote sends and a local callback are not atomic or globally exactly-once.

Make the recovery-policy delta explicit in editable governing guidance and related normative docs/templates: distinguish a reviewed definite first-stage refusal before prompt admission from uncertain first admission, callback failure, and second-stage partial/uncertain delivery. A refusal alone does not grant retry authority. For sufficiently established definite first-stage refusal, describe an informed explicit operator decision permitting one later canonical re-invocation with unchanged exact owner/task/operation/session/worktree/branch, current native evidence and original accepted scope/focus. This is an explicit exception to the current blanket refusal boundary, not a new advance, implicit approval, hidden deterministic authority, retry endpoint or replay protocol. Preserve/report evidence gaps; lack of observed actions or empty queues alone is not proof of non-admission. If available public evidence cannot establish a definite refusal, keep the case uncertain and state the precise limit and concrete operator choices without inventing a safe resend. Uncertain/partial cases receive no generic replay permission and no direct execute/chat-steering workaround. Record exact findings and disposition in existing native task fields/history, not a new store. Do not require new routine permission for ordinary successful future handoffs.

## Scope and boundaries

This separate Conversation is authorized to design, plan and implement this repair through its own task-native Episode, publish a reviewed candidate and propose safe recovery. Planning is not a new permission gate. Requirements G1–G5, P12–P16, P19 and S4–S5 govern. No broad recovery framework, receipt store, state machine, classifier or policy engine. Prime Agent may be read to verify supported interfaces but must never be patched/forked or targeted by an unsolicited PR. Preserve unrelated code/task/index/history and other Conversation ownership, especially PRIMECLAW-45. Personal-brain discovery returned 503 upstream_unavailable; repository requirements and saved evidence are the available basis, not proof that the brain has no relevant context.

Absolute live boundary: no pod-pricing code/task/status/store/ownership/resources/session/heartbeat changes; no AWS; no TASK-2 handoff, ordinary handoff, chat steering, replay, replacement Episode, restart/kill, host asset edit, or user-global install/apply/check/probe. The historical refused intent remains blocked and is NOT authorized by this repair. Merge, live activation, coordinated full restart, and any historical recovery require their normal separate explicit operator decisions. Keep resources needed by loaded generations until resumed owner/Episode/ordinary-session UAT proves cutover. Candidate publication is not activation.

## Validation and delivery

Use isolated disposable fixtures only, never live-daemon or real-Episode experiments. Run required Tier-1/probe/container validation after every plugin-source change plus focused changed-seam regressions. Cover the heartbeat winning the observation/admission gap; task caller forwarding; first rejection and uncertainty with no callback/execute/resend; callback failure with no execute; second rejection and uncertainty retaining first admission/evidence with no replay; unchanged version-1 behavior. Review guidance proportionately for the definite/uncertain/partial distinction and explicit operator boundary, without a prose-policy framework. Obtain ONE proportional independent read-only new-delta review; repair concrete in-scope defects without speculative review loops.

Deliver native task/code publication evidence, own Episode identity, actual tests/review and limits, exact merge tuple and a bounded proposed activation/recovery sequence. Do not merge or activate. Historical TASK-2’s accepted code ba702b54cdba7a1c3d31f4cb530a3f3c1f7d5e27, Blocked task publication 092555eafe4dffb5c4ebf2d2d81b22402d9857f2, owner 01a1d792-ed7e-7333-a01e-c9ca5e1a6922 and existing resources stay untouched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The real task-native handoff caller forwards the existing busy-safe option: a heartbeat that starts after idle observation permits one initial canonical followUp/queueIfBusy:true handoff request, one admitted observation callback, then one execute follow-up; version-1 retains idle-only behavior.
- [ ] #2 Focused disposable-fixture regressions prove first refusal/uncertainty causes no callback, execute or resend; callback failure causes no execute; second refusal/uncertainty preserves first admission/evidence without replay. Claims remain per-invocation, not atomic/global exactly-once.
- [ ] #3 Editable governing recovery guidance explicitly permits only a separately operator-authorized canonical re-invocation after an evidence-supported definite first-stage refusal on the same exact resources; no absence-only proof, inferred authority, relabeled advance, automatic retry, new recovery endpoint/store or chat steering.
- [ ] #4 Uncertain first admission, callback failure, and partial/uncertain second delivery remain distinct stopped cases with precise native-evidence limits and operator choices, not generic replay permission. Historical TASK-2 remains untouched and unresumed by this change.
- [ ] #5 Required Docker Tier-1/probe/container checks and warranted focused regressions pass; one proportional independent new-delta review covers code, governing policy and failure ordering, with actual evidence limits reported.
- [ ] #6 The task and code are separately committed/published through their native histories; the exact own Episode and reviewed merge tuple plus proposed explicit activation/recovery sequence are reported without merge, user-global activation, restart or live recovery.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep this repair bound to PRIMECLAW-61 and its own task-native Episode from primary main. Use the accepted diagnosis in References; confirm only the changed caller/transport seam and supported public prompt options. Do not reinvestigate or touch the historical TASK-2/pod-pricing operation or another owner’s PRIMECLAW-45 resources.
2. In src/prime-agent-plugin/extension-support/spec-episode.ts, forward Boolean(promptIdentity.taskId) as the existing fifth deliverHandoff argument from deliverOwnedEpisodeHandoff. Keep the native publisher’s existing first-request followUp + queueIfBusy:true option for task-native calls, retained version-1 false/default behavior, and strict first admission -> factual callback -> one execute ordering. Do not add catch/resend, a second assignment, a recovery API/store/classifier, or an atomic/global exactly-once claim.
3. Extend the existing disposable-fixture tests at the actual task caller and publisher/workflow-chain seams. Reproduce heartbeat busy state appearing after the idle observation but before first admission and assert one busy-safe initial request, one callback, one execute. Assert unchanged version-1 options. Cover first reject/uncertain (no callback/execute/resend), callback failure (no execute), and second reject/uncertain (preserve first admission/evidence and stop without replay). Inspect supported native option semantics read-only; no live daemon/real-Episode experiment or upstream change.
4. Update governing editable oversight guidance and corresponding shipped workflow/template/docs references, including docs/handoff-chain.md and the relevant REQUIREMENTS.md clarification if needed. State the explicit exception to blanket refusal policy: only reviewed evidence establishing definite first-stage refusal, followed by a separately explicit informed operator decision, permits one canonical re-invocation on unchanged exact owner/task/operation/session/worktree/branch and accepted scope/focus. Empty queues or no observed action alone do not prove refusal. Distinguish uncertain first admission, callback failure, and second-stage partial/uncertain delivery; preserve evidence and stop with precise limits/operator choices and no generic replay, direct execute or chat steering. Keep historical TASK-2 blocked and untouched; do not infer authorization from this repair or routine future success. Use existing native task fields/history, not new persistent machinery. Inspect adjacent normative guidance for contradictory blanket instructions and fix only this bounded task-native delta; version-1 policy remains unchanged.
5. Run scripts/test-tier1.sh --probe (Docker-only) after every plugin-source change, plus warranted focused regression commands through the repository’s isolated test environment. Preserve actual logs and limitations. Perform one proportional independent read-only new-delta review covering code/options, ordering/failure tests, and definite/uncertain/partial recovery language. Repair concrete in-scope defects and revalidate; do not add speculative formalism or review loops.
6. Keep the living plan/notes and truthful completed criteria in this native task; the Episode owns content and this Conversation owns lifecycle status. Commit/push task edits selected-file-only on refs/heads/prime-claw/tasks, code separately on the own Episode branch, preserving unrelated state. Report reviewed exact code/task publication, own Episode identity, tests/review and limits, and exact merge tuple plus bounded activation/recovery proposal. Stop for the supervising operator’s merge/activation/recovery decision: no merge, global apply/check/probe, host asset edit, restart/kill, AWS or live recovery. Keep loaded-generation resources until separately authorized coordinated restart and resumed owner/Episode/ordinary-session UAT prove cutover.
<!-- SECTION:PLAN:END -->
