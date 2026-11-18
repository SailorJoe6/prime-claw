---
id: PRIMECLAW-62
title: Bound task handoff evidence and retain truthful delivery outcomes
status: In Design
assignee: []
created_date: '2026-11-18 21:05'
labels: []
dependencies: []
references:
  - REQUIREMENTS.md
documentation:
  - docs/handoff-chain.md
priority: p1
type: bug
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome and authority
Repair future task-native handoff/execute context crossing and delivery reporting in the prime-claw plugin. One new task covers specification, planning, and isolated Episode implementation when semantically ready under the operator's delegated runtime-repair authority (owning Conversation session 01a1ef0e-10fe-77f6-a550-f5120139ec6c; delegation native entry 8b72ca67). Do not reopen PRIMECLAW-61. Planning alone does not authorize unrelated implementation; the existing explicit conditional authority applies only to this bounded repair. Stop before merge, global apply/activation, daemon/full restart, or live UAT.

## Accepted defects and evidence limits
Current source duplicates complete previous/current provider-native task views into both canonical handoff and execute prompts, then echoes them in successful owner output. Backlog includes all comments, so long-running task history creates unbounded context growth. Editable handoff prose asserts execute is already queued even though first admission, callback, and follow-up are ordered but not atomic. Transport errors discard generated correlation and cause/stage facts. These are confirmed source defects, not a proven cause of any historical timeout or compaction sequence. No inspected goal hook deletes or dispatches execute. A future patch cannot establish a missing historical execute receipt or recover an already-returned uncertain chain.

## Required behavior
- Keep future task-native handoff/execute prompts and normal owner tool text/details bounded as raw history grows. Preserve the complete previous/current native evidence, full contract, native envelopes and unknown fields, null values and genuinely absent keys, with meaningful bounded-piece LLM inspection. Do not silently truncate, summarize, classify important fields, or normalize Beads into a Backlog/provider-neutral shape. The native task remains authority; a captured observation is only factual context.
- Preserve exact provider/task/owner/operation/durable session/worktree/branch/host bindings. Editable Markdown and the LLM continue to decide eligibility, compatibility, product and scope. Do not add deterministic semantic policy or frozen revision gates.
- Prefer supported native facilities. A proposed minimal direction is one lossless factual observation in an EXISTING native session custom entry via public pi.appendEntry, exact short native-entry references, and full-object Episode REPL access with bounded reads. This is not mandated architecture. Prove supported durable persistence, exact-entry targeting, and readability from the selected placement with a minimal isolated Docker reproduction BEFORE adopting it. Missing/unreadable/remote-inaccessible evidence is a disclosed blocker/placement limitation; never silently omit evidence, add a parallel store, or fall back to a huge prompt. Consult the owner on a genuine material interface/product constraint rather than patching upstream.
- Preserve first native admission -> factual callback -> ONE canonical execute follow-up. Report actual first/callback/follow-up results and distinct safe stopped cases. A received handoff is not execute admission evidence. Preserve original private-safe transport client/command IDs and stage/cause facts through the existing normal tool result on success/failure/uncertainty where applicable. Include only factual bounded diagnostics; no prompt/task bodies, credentials, or raw exception text. A late reply cannot restart an already-returned chain. No catch/resend, direct execute, reconstructed assignment, generic replay, rollback fiction, or exact-once claim.
- Correct editable phase/work-control Markdown: reminders are advisory, not assignments or acknowledgement requests. Apply mandatory goals/heartbeats quietly. Goals end at the currently admitted phase/report/wait boundary; missing next-phase authority cannot come from compaction or reminders. Preserve useful native compaction and the existing canonical follow-up mechanism. No scheduler, disabling compaction, or hook-driven execute dispatch.

## Validation and delivery
Use proportional existing deterministic network-disconnected Docker fixtures, synthetic data only. Extend existing tests rather than add a framework or massive matrix. Cover at least a 1.7-million-character complete synthetic Backlog previous/current history with early/middle/late sentinels, all native fields, unknown keys, explicit null and absence; one small raw Beads shape case; exact lossless bounded-piece evidence retrieval; and history-independent prompt/owner-output size. Exercise one deliberate native compaction, exactly the existing one canonical execute follow-up, and a substantive post-compaction marker rather than repeated compliance. Distinguish requested/completed compaction and mechanics from real-model semantic proof. Use the real plugin client with a fake JSONL socket for success, delayed/lost result, socket closure, callback failure and follow-up uncertainty, retaining stage facts and proving no resend. Reuse busy-gap and retained-version-1 regressions. After plugin-source changes run mandated Tier 1 candidate validation in Docker. Publish coherent native task/code updates promptly and obtain independent read-only candidate review.

## Boundaries
No new API, durable receipt/command-history/evidence store, replay protocol/state machine, classifier, or upstream Prime Agent edits. A timeout increase alone is not a cure. Optional noncausal valid-response hardening is not required acceptance or a reason to expand scope. Prime Agent is read-only dependency. No host apply/check/probe. No AWS access, authentication or credential inspection. Preserve the separate paused pod-pricing task/Episode exactly: no messages, handoff, execute, replay, registry repair, resource probes, experiments or lifecycle changes there. No terminal disposition or cleanup is authorized. Report historical recovery limits honestly; candidate publication is not activation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Future task-native handoff and execute prompts plus normal owner outputs remain bounded as complete raw task history grows; all previous/current native evidence is exactly retrievable and inspectable in bounded pieces with shape, unknown fields, nulls and absence preserved, and exact identities plus LLM semantic authority unchanged.
- [ ] #2 Any chosen native evidence-reference mechanism first has minimal Docker proof of supported durable persistence, exact entry access and selected-placement readability. Unavailable evidence or unsupported placement stops truthfully without omission, giant-inline fallback, parallel store or upstream patch.
- [ ] #3 The existing ordered first admission, factual callback and one canonical execute follow-up remain intact. Existing tool outputs retain original private-safe correlation, stage and cause facts for actual success/stopped/uncertain outcomes without bodies, credentials, raw exceptions, automatic resend or exact-once/recovery claims.
- [ ] #4 Editable handoff and work-control Markdown no longer claims receipt proves execute queued; reminders are not assignments/ack requests; mandatory goals/heartbeats end at actual admitted phase/wait boundaries while useful native compaction and the sole existing follow-up remain.
- [ ] #5 Existing offline Docker fixtures prove lossless bounded retrieval and prompt/output boundedness using at least incident-scale 1.7M-character synthetic Backlog prior/current history with early/mid/late sentinels and full fields/null/absence plus a small raw Beads case; one deliberate native compaction reaches a substantive marker through exactly one existing canonical follow-up.
- [ ] #6 Real plugin client/fake JSONL socket regressions cover success, delayed/lost result, closure, callback failure and follow-up uncertainty with retained stage facts and no resend. Mandated Tier 1 Docker validation and independent candidate review are reported with exact revisions and limits.
- [ ] #7 Published task/code candidate preserves unrelated work and the paused external Episode, performs no AWS/host activation/restart/merge/upstream mutation, and explicitly states that this future fix does not recover historical uncertain delivery or prove real-model semantic behavior.
<!-- AC:END -->
