---
id: PRIMECLAW-62
title: Preserve typed Beads relationships during provider migration
status: In Planning
assignee: []
created_date: '2026-11-21T21:48:00Z'
updated_date: '2026-11-21T21:48:00Z'
labels: []
dependencies: []
priority: p0
type: bug
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prime Claw’s Beads-to-Backlog inspection currently flattens every Beads relationship type into a hard Backlog dependency. Valid bidirectional `relates-to` edges and directional `discovered-from` provenance therefore appear as dependency cycles and block migration. Deleting those native relationships would violate M1–M3 because the source must be read as-is and all meaning/history must be preserved.

Outcome: classify the already-captured typed Beads relationships by native meaning. Project only actual `blocks` edges into Backlog dependencies, keep parent hierarchy in the native Backlog parent field, and retain every other typed relationship losslessly in the exact source package plus a readable destination-native comment guided by the confirmed semantic-placement prose. Never rewrite the retiring Beads source to satisfy migration.

Pre-change impact assessment (2026-11-21): `main` is clean and equal to `origin/main` at `5e52159927063ec01176305059c4632d45e5e848`; `.backlog` task history is clean and equal to `origin/prime-claw/tasks` at `eb7bfe0`. The newly initialized `deps/backlog` submodule is at its recorded commit and does not dirty main. Requirements: P5 and M1–M3, especially read-as-is retirement and preservation of all relationships without invented destination behavior. Changed surfaces: `src/prime-agent-plugin/extension-support/task-provider-migration.ts` and focused migration tests; requirement text is unchanged. Required gates: focused Node migration tests and Docker-only tier 1/plugin probe. Preserve unrelated repository and task history.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Inspection accepts valid bidirectional `relates-to` and `discovered-from` relationships when the true blocking graph and parent hierarchy are acyclic.
- [ ] #2 Only Beads `blocks` edges become native Backlog dependencies; parent relationships remain native parents; non-equivalent typed edges remain exact in migration provenance and readable in destination-native comments with semantic-placement context.
- [ ] #3 Self targets, missing targets, true `blocks` cycles, and parent cycles still fail closed before destination mutation.
- [ ] #4 Focused migration tests and Docker-only Prime Claw tier 1/plugin probe pass; the task, source commit, and task history are published before live activation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Introduce a small typed Beads relationship reader over the existing native/export dependency array. Preserve every raw relationship in the already-captured source package.
2. Derive native Backlog dependency IDs only from relationship type `blocks`. Validate targets for every relationship, detect cycles only in the projected blocking graph, and continue using the separate parent-hierarchy sorter for parent cycles.
3. During import, write only projected blockers through `--depends-on`. For each non-parent, non-blocking typed edge, append one readable destination-native migration comment naming its type and mapped target together with the confirmed semantic-placement prose. Verify both the exact package and native projections on readback.
4. Add focused fixtures for bidirectional `relates-to`, `discovered-from` back-links, missing/self targets, genuine blocking cycles, and final Backlog projection/readable evidence. Run focused Node migration tests and Docker-only tier 1/plugin probe. Publish source and task history before any user-global activation.
<!-- SECTION:PLAN:END -->
