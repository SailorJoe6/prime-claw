---
id: PRIMECLAW-57
title: Use durable Episode identity instead of ephemeral runtime routing IDs
status: In Progress
assignee: []
created_date: '2026-11-04 14:05'
updated_date: '2026-11-04 15:57'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - PRIMECLAW-15
  - >-
    https://github.com/SailorJoe6/prime-agent-pi/commit/f80340d93dc3b1c6de3459b54a82f351e136f75e
documentation:
  - docs/conversation-driven-episode-oversight.md
modified_files:
  - src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
  - tests/spec_episode_extension.test.mjs
  - docs/conversation-driven-episode-oversight.md
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the cleanup failure in the existing isolated session/Git fixtures in tests/spec_episode_extension.test.mjs: retain the permanent Episode ID, canonical session file and owned worktree/branch, but give the live idle session a different runtime handle from the ownership record.
2. Correct task-episode-cleanup.ts so durable identity selects the owned session and cleanup addresses its verified current runtime handle. Keep current roster/state and pre-removal checks, explicit descendant handling, exact resource checks, terminal publication requirements, and busy/unknown-idle refusal. Do not hand-edit ownership or reopen, replace, or reassign an Episode to make cleanup work.
3. Check the related Episode lookup, continuation/reopen and migration-continuity uses in spec-episode.ts and relevant ownership/cleanup callers for the same historical-handle-as-identity mistake. Correct only affected uses. Add focused regressions proving changed-handle cleanup succeeds while stale/reused handles cannot select a foreign session, missing/ambiguous/changed durable identity is refused, and busy or unprovably idle resources stay intact. Reuse existing coverage where it already proves these outcomes.
4. Run the focused regressions and related Episode suites inside the existing isolated Docker test environment, plus the required scripts/test-tier1.sh --probe after plugin-source changes. Record the actual results and related-path audit in the native task notes, add only explanatory comments/docs needed for changed behavior, and commit/push the bounded candidate for review. No live activation/restart, Prime Agent source change, or use/removal of retained TASK-2 resources is included.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-04 bounded slice: verified exact owner/Episode/worktree and clean independent task history at b0ff73537bc995aa06f3cf96cd915da373091d9d. The isolated Docker regression changes only the live route in the existing local cleanup fixture while ownership retains its saved route. It fails with "Task Episode cleanup found a changed Prime Agent routing identity" before removal (local artifact: .test-results/primeclaw57/red.log). Root cause: sessionTree already matches permanent ID, canonical file and CWD, then incorrectly requires its current runtime handle to equal the historical ownership observation. Implement a narrow cleanup correction and focused identity/busy regressions; audit related lookup/continuation/migration paths read-only. No live activation, ownership edit or retained TASK-2 resource use.

2026-11-04 recovery handoff (same Episode; Docker restart clearance supplied by owner):
- Owner reports Docker Desktop restarted and docker info succeeds (29.8.2); prior stalled shell/Docker PIDs are absent. This clears the former infrastructure blocker. Do not reuse dead Bash handles or count pre-restart logs/status as fresh validation.
- Owner preserved the exact existing three-file partial diff without edits in published recovery checkpoint ee9e89ce605582b9a8ab289cbb39bdaa878f2876 on the same Episode branch. It is untested recovery state, not a completed/reviewed candidate. Current code and independent task checkouts are clean; task remains In Progress. Exact durable Episode ID/file, owner, operation, worktree and branch are unchanged; ordinary handoff reopened that same session on a refreshed runtime route.
- Partial implementation: task-episode-cleanup.ts removes the historical-route equality rejection and no longer treats a reused old route alone as an absent-root identity collision. Durable ID/file/CWD, current-roster/state checks, pre-removal identity checks, explicit descendants, terminal publication and exact resource boundaries remain. tests/spec_episode_extension.test.mjs adds route-reuse, wrong/missing/ambiguous durable identity and busy/unknown-idle cases, and changes the end-to-end local cleanup fixture to a replacement route. docs/conversation-driven-episode-oversight.md explains the distinction. Fresh isolated tests are still required.
- Saved read-only related-path audit (findings to judge proportionately, not new authority): normal durableSession/reopenIfNeeded/handoff in spec-episode.ts already resolves durable ID/file and refreshes route. Two same-assumption candidates remain for the approved audit step: task-episode-ownership.ts around lines 709-711 rejects an exact existing version-2 legacy-to-task bridge replay when the separately verified current route differs from the persisted route; task-provider-migration.ts around lines 2792-2797 compares post-cutover verified current route against the route observed at cutover and may roll ownership back on route-only change. Existing tests cover initial replacement, not subsequent route changes. Inspect current code and native fixtures before deciding minimal in-scope corrections. Do not broaden old-route-still-live ambiguity guards without concrete evidence.
- Next execute: run prepare, reread exact ownership and this native task, inspect ee9e89c, then start fresh focused Docker regressions and required scripts/test-tier1.sh --probe nonblocking with explicit bounded timeouts. Inspect completed outputs, repair concrete in-scope failures, complete approved native plan/audit proportionately, publish task evidence separately from code, and report tested bounded candidate to owner. No live plugin apply/check/activation, Prime Agent source patch, replacement Episode/assignment, retained TASK-2 fixture use, merge or cleanup. Requirements and acceptance remain unchanged; no green validation or task completion is claimed.

2026-11-04 fresh post-restart validation (cleanup-only bounded slice, not whole-task completion):
- Exact bound owner/session/worktree and published independent native history were revalidated. Recovery code checkpoint ee9e89c is unchanged except two focused missing-root descendant cases added to the new regression and doc line wrapping. No historical Bash handle was reused.
- Fresh offline Docker direct cleanup/transport regressions pass: 62 tests, 62 passed, zero failed (22 top-level cases; timeout 60s inside Docker, outer bounded deadline 75s). Includes current-route removal, saved old-route foreign reuse preservation, missing/ambiguous/wrong durable ID/file/CWD, current-state mismatch, busy/unknown-idle refusal, explicit descendants and relevant Orca/Git resource checks. Command and exact immutable image ID are in .test-results/primeclaw57-fresh-20261104T155309Z/commands.json (cleanup-expanded); output cleanup-expanded.log and cleanup-expanded.status.json. This uses synthetic isolated resources only.
- Required scripts/test-tier1.sh --probe was freshly attempted with explicit source-builder/check/probe deadlines. It failed during the source builder before a Prime Agent runtime or plugin was installed. Fresh evidence: .test-results/primeclaw57-fresh-20261104T155309Z/20261104T155320Z-19366-e03e8688/tier1/manifest.json and source-build.json; builder-failed, clean exact builder teardown, before/after upstream checkout inventory unchanged at a1faacd53ac4473a75de1d434afaf50945c2f647. No green probe result is claimed. A disposable Docker diagnostic of the same native build commands is running; no source/dependency/selector change.
- Fresh four-suite Episode/ownership/admission/migration run hit its inner 200s deadline and reports integration-branch and ownership-shape errors outside the cleanup diff. A matching disposable base-commit comparison is running to classify those failures. Full suite success is not claimed. Task acceptance, plan and lifecycle stay unchanged. Related bridge-replay and provider-migration route-only findings remain open; this slice does not claim those repaired.
<!-- SECTION:NOTES:END -->
