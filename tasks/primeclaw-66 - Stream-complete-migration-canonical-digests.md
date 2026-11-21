---
id: PRIMECLAW-66
title: Stream complete migration canonical digests
status: Done
assignee: []
created_date: '2026-11-21T22:34:00Z'
updated_date: '2026-11-21T22:50:00Z'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/commit/30bd6c53a349113944bda48a69f8a0f2c5963bb5
modified_files:
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - tests/task_provider_migration.test.mjs
priority: p0
type: bug
ordinal: 150000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prime Claw’s Beads-to-Backlog inspection captures the complete 557-task source correctly but computes its revision with `sha256(canonical(...))`. `canonical` materializes one monolithic string. The current repository history exceeds Node/V8’s maximum string length, so the guarded live inspection stops with `RangeError: Invalid string length` before destination mutation. The same exact snapshot succeeds under Bun and returns revision `capture-sha256:f69a94f4e58674bcc20e007735e09e2344b61ddca419431d50772eca63025b65`.

Outcome: hash the identical canonical byte sequence incrementally so digest semantics remain byte-for-byte stable without constructing a maximum-size string. Apply this to all complete migration digests that aggregate task packages. Preserve the existing `canonical` helper for bounded equality checks. Do not trim source history, alter Beads data, or weaken verification.

Pre-change impact assessment (2026-11-21): Prime Claw `main` is clean and equal to `origin/main` at `ac02ff1dd4033e3e30015d8876f483e4afc520d3`; `.backlog` task history is clean and equal to `origin/prime-claw/tasks` at `7f9ff61`. Requirements-neutral internal reliability fix: migration preservation and fail-closed behavior are unchanged; only canonical SHA-256 construction changes. Changed surfaces: `src/prime-agent-plugin/extension-support/task-provider-migration.ts` and focused tests. Required gates: deterministic canonical-digest equivalence, focused Node tests, direct Docker plugin acceptance, exact full-source Node inspection, `git diff --check`, source/task publication before activation. No unrelated dirty work is present.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Streaming canonical SHA-256 exactly matches the legacy canonical-string SHA-256 for deterministic nested JSON values and key ordering.
- [x] #2 All complete aggregate source, destination, replay, and layout migration digests avoid monolithic canonical strings while bounded equality checks remain unchanged.
- [x] #3 The exact 557-task source inspection succeeds under Node/V8 with revision capture-sha256:f69a94f4e58674bcc20e007735e09e2344b61ddca419431d50772eca63025b65 and no destination mutation.
- [x] #4 Focused host and direct Docker acceptance pass; source and task history are published before user-global activation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an incremental canonical SHA-256 helper that emits the same delimiters, sorted object keys, and JSON primitive encoding as the current `canonical` function without joining the full document.
2. Replace complete aggregate migration digest sites with the streaming helper. Retain bounded `canonical` comparisons unchanged.
3. Add focused equivalence tests against known legacy canonical strings, including nested arrays/objects and deterministic key ordering.
4. Run focused host and Docker tests, then run the exact 557-task inspection under Node and verify the digest remains `f69a94f4e58674bcc20e007735e09e2344b61ddca419431d50772eca63025b65`.
5. Publish source and task history, reactivate the exact generation, restart Prime Agent, and rerun the guarded tool inspection.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause proven with an exact disposable Node 22.22.2 reproduction: `RangeError: Invalid string length` at `Array.join`, called by `canonical`, called by `captureBeads`. The identical snapshot under Bun was valid and produced revision `capture-sha256:f69a94f4e58674bcc20e007735e09e2344b61ddca419431d50772eca63025b65`.

Implemented and published at `30bd6c53a349113944bda48a69f8a0f2c5963bb5`. `canonicalSha256` streams the same canonical delimiters, sorted keys, and JSON primitive bytes directly into SHA-256. All aggregate source, destination, replay, and migration-layout digests now use it. Bounded equality comparisons keep the existing `canonical` helper.

Acceptance on the exact rebased commit:
- deterministic streaming-vs-legacy canonical digest equivalence: passed;
- typed Beads relationship migration: passed;
- true blocking-cycle refusal before mutation: passed;
- focused host suite: 3/3 passed;
- direct Docker suite with pinned Backlog/Beads/Dolt image: 3/3 passed;
- exact 557-task Node/V8 inspection: ready with unchanged revision `capture-sha256:f69a94f4e58674bcc20e007735e09e2344b61ddca419431d50772eca63025b65`, counts 74 open / 483 closed / 0 archived / 557 total, and 0 active owners;
- `git diff --check`: passed;
- source pushed to `origin/main` before activation.

No Beads source data, Backlog destination, or provider authority was mutated during diagnosis or inspection.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published a streaming canonical SHA-256 implementation that preserves exact migration digests without constructing a V8-limit-sized string. The complete 557-task Beads snapshot now inspects successfully under Node/V8 with the exact pre-fix Bun digest `f69a94f4e58674bcc20e007735e09e2344b61ddca419431d50772eca63025b65`. Focused host and Docker acceptance passed 3/3. No source data or destination state changed.
<!-- SECTION:FINAL_SUMMARY:END -->
