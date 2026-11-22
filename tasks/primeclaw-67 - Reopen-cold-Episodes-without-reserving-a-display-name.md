---
id: PRIMECLAW-67
title: Reopen cold Episodes without reserving a display name
status: In Design
assignee: []
created_date: '2026-11-22T07:44:00Z'
labels: []
dependencies: []
references:
  - PRIMECLAW-15
  - PRIMECLAW-57
priority: p1
type: bug
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ordinary handoff identifies the exact saved Episode but cold reopen requests a generated name. A different saved root reserving that name prevents publication and both canonical prompts. Reopen by exact saved file, durable ID and worktree without a requested or expected display name; preserve all routing checks and fresh-session naming. Scope is a tested source candidate, not activation or recovery of any live Episode.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Offline Docker fixture with a cold saved Episode and an unrelated saved root reserving the generated name receives exactly one canonical handoff and one execute on the original durable session; no duplicate session, initial assignment replay, or changes to the foreign session.
- [ ] #2 Wrong returned durable ID, saved file or CWD, or missing route, still stops; fresh creation still requests and verifies its display name.
<!-- AC:END -->
