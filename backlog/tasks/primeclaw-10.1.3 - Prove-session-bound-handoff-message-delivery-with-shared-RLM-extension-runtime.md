---
id: PRIMECLAW-10.1.3
title: Prove session-bound handoff message delivery with shared RLM extension runtime
status: In Design
assignee: []
created_date: '2026-10-12 01:00'
updated_date: '2026-10-14 14:45'
labels:
  - handoff
  - phase4
  - phase4a
  - rlm
dependencies:
  - PRIMECLAW-10.1.2
parent_task_id: PRIMECLAW-10.1
priority: p1
type: bug
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase 4a.2 scopes pending handoff state by `ctx.sessionManager.getSessionId()`, including when one extension closure is shared. A Prime Agent 0.9.5 source review found a separate delivery risk for Phase 4b: RLM child creation reuses the parent `ResourceLoader`, loaded extension objects, and `ExtensionRuntime`, while each session runner rebinds the runtime's captured `pi.sendUserMessage` handler. The state map cannot cross-talk, but a handoff or post-compaction execute message could still be delivered through the most recently bound session runtime. Prove or fix this before episode mechanics depend on concurrent root/RLM-child handoffs.

## Legacy design

Build a real Prime Agent integration fixture with one root session and one RLM child sharing the normal ResourceLoader/runtime. Invoke native `/handoff` with distinct guidance in each session and compact each independently. Inspect both session JSONLs to identify exactly where the handoff and execute messages land. If delivery is already session-bound, preserve the fixture as regression evidence. If it cross-routes, fix Prime Agent at the supported extension API boundary—prefer a session-bound send method on event/command context or per-runner runtime binding—and upstream the fix; do not patch private fields or infer destinations from CWD. The project extension must continue using public APIs only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Complete when: (1) a reproducible root-plus-RLM-child test uses the normal shared-loader path; (2) distinct guidance and execute injection each appear exactly once in the intended session JSONL and never in the other; (3) any reproduced Prime Agent routing defect is fixed at a supported API boundary with upstream regression coverage; (4) prime-claw records the minimum supported Prime Agent version if a harness fix is required; and (5) docs distinguish pending-state isolation from message-delivery isolation with evidence.
<!-- AC:END -->
