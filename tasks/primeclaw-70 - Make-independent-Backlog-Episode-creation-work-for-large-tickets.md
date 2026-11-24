---
id: PRIMECLAW-70
title: Make independent Backlog Episode creation work for large tickets
status: In Design
assignee: []
created_date: '2026-11-24 01:48'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/prime-claw/tasks/tasks/primeclaw-69%20-%20Use-Git-references-for-independent-Backlog-handoff-evidence.md
  - src/prime-agent-plugin/extension-support/reviewed-plan-support.ts
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - src/prime-agent-plugin/extension-support/project-initialization.ts
priority: p1
type: bug
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem
Independent Backlog Episode creation has the same source-verified size risk as the PRIMECLAW-69 continuation incident. The pre-allocation native task read checks identity, status, plan, and publication consistency. A separate pre-session read from the prepared Episode clone checks ID/path, stores a full task snapshot in ownership, and includes prior/current snapshots in the initial execute prompt. Both paths use full `backlog task view --json` via `ProcessCommandRunner.run`, whose `spawnSync` uses Node’s default 1 MiB buffer. The observed ENOBUFS incident was in handoff; no creation incident is claimed.

## Outcome and boundary
Make independent Git-backed Backlog Episode creation work for large published tickets across both the pre-allocation and pre-session reads. Retain exact task identity and native publication verification and preserve the distinction between editable readiness judgment and resource mechanics. Keep initial execute context bounded while the Episode can inspect complete authoritative ticket evidence on demand. Do not treat raising the buffer or truncating ticket content as a fix. Preserve existing historical records and same-resource recovery. PRIMECLAW-69 remains a separate repair for ordinary handoff and execute-only continuation. No Beads or branch-local Backlog behavior change, live Episode action, or activation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Existing independent Backlog creation paths no longer depend on capturing full native task JSON through the fixed-size command buffer at either creation checkpoint; necessary identity and publication facts remain verifiable.
- [ ] #2 An offline Docker regression exercises production creation with a synthetic published ticket whose native JSON exceeds 1 MiB, from pre-allocation checks through one initial execute assignment with bounded context and complete ticket evidence available on demand.
- [ ] #3 Missing or mismatched required evidence stops at the appropriate boundary with accurate facts; same-resource recovery remains intact and does not allocate or send a duplicate.
<!-- AC:END -->
