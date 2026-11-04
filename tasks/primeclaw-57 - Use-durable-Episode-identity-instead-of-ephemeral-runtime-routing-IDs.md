---
id: PRIMECLAW-57
title: Use durable Episode identity instead of ephemeral runtime routing IDs
status: In Design
assignee: []
created_date: '2026-11-04 14:05'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - PRIMECLAW-15
  - >-
    https://github.com/SailorJoe6/prime-agent-pi/commit/f80340d93dc3b1c6de3459b54a82f351e136f75e
priority: p1
type: bug
ordinal: 142000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Bug and requested outcome
Joe identified this as a P1 bug in the Prime Claw plugin. The plugin must distinguish permanent Episode/session identity from the current runtime handle used to address that session. A runtime handle can change across restart or reopen; that change alone must not invalidate an otherwise matching owned Episode.

## Confirmed failure
Terminal cleanup of prime-agent-pi TASK-2 is blocked after its implementation was merged and its native task published Done. The permanent Episode ID, canonical session file, owned worktree and branch still match; the Episode is idle with no queued or unfinished work and no remaining explicit descendants. Both independent Backlog stores are clean at the published terminal revision.

The saved episodeActiveSessionId is 896939f5d2d9, while the current route is f91e6a03b5fa. The permanent Episode ID remains 01a19de1-b1f5-70af-8429-44fb6499a02a. In task-episode-cleanup.ts, sessionTree() rejects the changed activeSessionId even after locating the same durable root, throwing: "Task Episode cleanup found a changed Prime Agent routing identity" before resource removal.

The affected operation is be707607-90c2-4bb3-8bf7-86ce534bfdda. Its merged Episode head is f80340d93dc3b1c6de3459b54a82f351e136f75e; terminal Backlog publication is 00e9342db8fd90a264b2c43ae21738fcbc8ad8d0. Main is clean and published at 94589ebb002679a028435759ce3bfffdc7ff6127. Cleanup refusal was verified again after removing the earlier code-cleanliness blocker. Ownership, session, worktree, branches and task stores remain intact.

Read-only review found the same guard in installed and current plugin source, with no supported terminal-cleanup recovery. Existing create/handoff rebinding and provider-migration continuity are not valid cleanup workarounds. PRIMECLAW-15 addressed mutable names, not this runtime-handle dependency.

## Scope and constraints
Fix this in Prime Claw, using supported public Prime Agent interfaces. Base durable ownership on permanent identity and resolve current routing as runtime information. Check related plugin Episode lookup/continuation/recovery uses for the same mistaken assumption; cleanup is the confirmed regression, not evidence that all paths are broken. Preserve exact-owner, exact-resource, terminal-publication and idle checks, including unrelated owners and shared task stores. Do not substitute manual ownership edits, replacement Episodes, duplicate assignments or a new recovery framework.

This request logs the bug only. It authorizes no planning, implementation, live activation/restart, ownership edits, or use of the retained TASK-2 resources as a test fixture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Changing only the runtime routing handle does not invalidate an Episode whose permanent identity and owned resources still match; plugin routing uses the current handle without treating it as a permanent ownership key.
- [ ] #2 After an authorized, published terminal outcome, cleanup of the same idle durable Episode succeeds despite a changed runtime handle, without manual ownership edits, replacement Episode creation or another implementation assignment.
- [ ] #3 Missing, ambiguous or foreign permanent identity, genuinely changed owned resources, and active or unprovably idle work still prevent unsafe removal; a stale or reused runtime handle cannot select another session or unrelated resources.
- [ ] #4 Focused deterministic isolated regression coverage reproduces the observed same-permanent-ID/different-runtime-handle cleanup failure and proves the correction while preserving relevant wrong-identity and busy-resource behavior.
- [ ] #5 Related Prime Claw Episode identity/routing uses are checked for the same assumption and corrected where affected, through supported Prime Agent interfaces rather than Prime Agent source patches.
<!-- AC:END -->
