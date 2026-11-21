---
id: PRIMECLAW-65
title: Preserve typed Beads relationships during provider migration
status: Done
assignee: []
created_date: '2026-11-21T21:48:00Z'
updated_date: '2026-11-21T22:06:00Z'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/commit/ac02ff1dd4033e3e30015d8876f483e4afc520d3
modified_files:
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - tests/task_provider_migration.test.mjs
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
- [x] #1 Inspection accepts valid bidirectional `relates-to` and `discovered-from` relationships when the true blocking graph and parent hierarchy are acyclic.
- [x] #2 Only Beads `blocks` edges become native Backlog dependencies; parent relationships remain native parents; non-equivalent typed edges remain exact in migration provenance and readable in destination-native comments with semantic-placement context.
- [x] #3 Self targets, missing targets, true `blocks` cycles, and parent cycles still fail closed before destination mutation.
- [x] #4 Focused migration tests and Docker-only Prime Claw tier 1/plugin probe pass; the task, source commit, and task history are published before live activation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Introduce a small typed Beads relationship reader over the existing native/export dependency array. Preserve every raw relationship in the already-captured source package.
2. Derive native Backlog dependency IDs only from relationship type `blocks`. Validate targets for every relationship, detect cycles only in the projected blocking graph, and continue using the separate parent-hierarchy sorter for parent cycles.
3. During import, write only projected blockers through `--depends-on`. For each non-parent, non-blocking typed edge, append one readable destination-native migration comment naming its type and mapped target together with the confirmed semantic-placement prose. Verify both the exact package and native projections on readback.
4. Add focused fixtures for bidirectional `relates-to`, `discovered-from` back-links, missing/self targets, genuine blocking cycles, and final Backlog projection/readable evidence. Run focused Node migration tests and Docker-only tier 1/plugin probe. Publish source and task history before any user-global activation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented and published at `ac02ff1dd4033e3e30015d8876f483e4afc520d3`.

The migration now reads every typed Beads relationship, validates every target, projects only `blocks` edges to Backlog dependencies, keeps parent hierarchy separate, and writes non-equivalent typed edges as deterministic destination comments with marker `prime-claw-task-provider-migration-relationships-v1`. The exact raw relationship set remains in the retiring-source capture and is verified during readback.

Acceptance evidence on the exact published commit:
- Host focused Node acceptance: 2/2 passed (`typed Beads relationships preserve meaning without false dependency cycles`; `true Beads blocking cycles still fail before destination mutation`).
- Direct Docker-only focused acceptance: 2/2 passed against read-only commit checkout in image `sha256:ff3f1436381cfce42697fdf8a0b2013f43c50c4348893c1d157670c31b93f723` with pinned Backlog 1.55.3, Beads 1.3.1, and Dolt 2.5.0.
- `git diff --check origin/main..HEAD`: passed before publication.

Broader Docker fixture attempts were also recorded but stopped before candidate tests because of independent infrastructure defects: source-builder `/output` permissions; pinned installer provenance/version ambiguity; and the current installer leaving `prime-agent --version` unavailable to the fixture after successful installation. The direct Docker acceptance bypassed only that unrelated bootstrap and exercised the exact changed migration logic with the pinned native tools.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published the typed-relationship migration fix at `ac02ff1dd4033e3e30015d8876f483e4afc520d3`. Valid bidirectional `relates-to` and `discovered-from` relationships no longer create false dependency cycles. Only `blocks` projects to native Backlog dependencies; parent hierarchy remains native; other typed relationships remain exact in capture and readable in deterministic destination comments. True malformed blocking cycles still fail before destination mutation. Exact post-rebase host and Docker focused acceptance both passed 2/2.
<!-- SECTION:FINAL_SUMMARY:END -->
