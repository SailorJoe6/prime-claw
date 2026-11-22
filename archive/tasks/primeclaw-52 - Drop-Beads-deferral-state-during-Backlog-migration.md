---
id: PRIMECLAW-52
title: Drop Beads deferral state during Backlog migration
status: Done
assignee: []
created_date: '2026-11-02 21:52'
updated_date: '2026-11-03 22:05'
labels: []
dependencies: []
references:
  - PRIMECLAW-44
  - PRIMECLAW-46
  - PRIMECLAW-49
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - src/prime-agent-plugin/extension-support/task-providers.ts
documentation:
  - docs/project-initialization.md
modified_files:
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - tests/task_provider_migration.test.mjs
  - tests/test_task_provider_migration.py
  - docs/project-initialization.md
priority: p2
type: bug
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome
During one-way Beads→Backlog migration, import a native Beads task whose status is `deferred` as an ordinary `In Design` task. Drop active deferral state and deferral-only structured fields from the destination projection. Do not modify the retiring Beads source to achieve this.

## Product instruction and context
Joe’s instruction, relayed by NemoHermes Upgrade: “Just drop any "deferred" status and related fiedls as part of the migratino.” This supersedes the earlier unapproved proposal that the task must remain frozen or outside ready work. The selected behavior is the normal new/open task default, not a special destination lifecycle or scheduling feature.

NemoHermes Upgrade reports canonical inspection at Nemo housekeeping commit `b8c9be358df4fc5fc67d1aec74feb7c4943572e1` stops with `Beads source lifecycle preflight failed: nemo-setup-5lt status="deferred": unsupported status`. The task is titled `DEFERRED: Decide + enable web search provider`, with `defer_until=2026-08-01T00:00:00Z`. The reported native catalog defines deferred as frozen; the issue inventory is 33 issues (30 closed, one open, one blocked, one deferred), separate from the last-observed 19 memory records. These are reported consultation facts, not a new live inspection or proof of destination memory outputs.

The accepted importer currently projects fixed canonical Beads lifecycle names plus legacy open/closed and rejects deferred during source preflight. No existing runtime mapping override exists; semantic-placement prose does not change that projection. This task is the narrow destination-behavior change, not a repair of malformed source or another memory parser change.

## Required behavior
- Recognize native Beads `deferred` in inspection and destination conversion as the ordinary `In Design` projection. Use the same meaning in destination verification/replay; do not let source classification reject this selected case before projection.
- Do not create a Deferred status, active `defer_until` or other deferral-only destination fields, snooze/auto-wake behavior, special deferral annotations, or forced Draft/Blocked/archive placement. Timed, expired and indefinite source deferral do not change this destination meaning.
- Preserve ordinary title, description, notes, comments, native history and provenance. Native `bd defer --reason` appends ordinary notes; it is not a dedicated field to strip. Do not delete or rewrite ordinary text merely because it contains “deferred”, including the reported title.
- Retain the canonical raw source-capture and receipt/provenance evidence already required for lossless history. Historical deferral values may remain inside that existing raw evidence; do not restore them as active destination fields, scheduling or additional deferral annotations.
- Keep Beads unchanged and authoritative until the existing verified cutover. Never call ready/defer/undefer/status/config edits to normalize source data. Keep safe refusal for other genuinely unmapped statuses and preserve existing identity, relationship, publication, ownership, receipt/replay and guarded-retirement protections.

## Scope and authority
Use the least technology needed for this one supported projection and its focused regression coverage. Update directly affected guidance if it would otherwise contradict the behavior. No generic mapping/override framework, new controller, dependency upgrade, scheduling feature, unrelated importer cleanup, or reopening completed PRIMECLAW-44/46/49. Their accepted guarantees remain context, not unfinished work.

Authoring this task does not approve an implementation plan, implementation, merge, global activation, restart or live migration/source deletion. Candidate validation must use disposable fixtures and the repository’s Docker-only plugin workflow, including the mandatory Tier 1 probe after plugin-source changes. Do not run another live Nemo inspection to bypass the current guard or change Nemo tasks, provider or configuration. Planning and later lifecycle actions require their normal separate authority.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Native Beads deferred tasks pass source lifecycle inspection as nonterminal ordinary work and migrate to existing Backlog In Design tasks; dated (past or future) and indefinite deferral have the same destination meaning.
- [x] #2 Projected destination task fields contain no active deferral status, defer_until or other deferral-only fields, snooze/auto-wake behavior or additional deferral annotations; no Deferred status, forced Draft/Blocked/archive semantics or generic mapping override is introduced.
- [x] #3 Ordinary titles, descriptions, notes (including any reason appended by bd defer), comments and native history/provenance are preserved without keyword-based text deletion; existing canonical raw capture/receipt evidence may retain historical deferral values without making them active destination state.
- [x] #4 Disposable-fixture evidence proves the Beads source stays unchanged: no ready/defer/undefer/status/config mutation is used to normalize it. Existing source-authoritative publication and guarded-retirement requirements remain intact.
- [x] #5 Destination readback and exact replay agree with the selected In Design projection and stripped active deferral fields; other genuinely unmapped source statuses still fail safely without destination/source mutation.
- [x] #6 Focused regression evidence covers the reported native deferred/defer_until case and preserves existing issue-versus-memory handling, identity/relationships and receipt/publication safeguards. Required Docker-only plugin validation, including Tier 1 probe, is reported truthfully; no live Nemo migration or user-global deployment is used as candidate validation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Execution status (2026-11-03): all four steps below are implemented and validated in this one bounded candidate slice. No source normalization, general Beads lifecycle-map change, new deferral field/state, or out-of-scope deployment was needed. Awaiting owning Conversation review; task lifecycle remains In Progress.

1. Extend `statusFromBeads` in `src/prime-agent-plugin/extension-support/task-provider-migration.ts` with the single native `deferred` → existing Backlog `In Design` projection. Its existing callers already cover source lifecycle preflight, destination status assignment, and destination lifecycle verification/replay; retain them unless a regression exposes a necessary change. Past, future or absent `defer_until` must not change the projection. Keep the general Beads runtime lifecycle map and issue-versus-memory handling unchanged; do not introduce date-based classification, a mapping override/framework or new migration state.
2. The existing destination-field projection already excludes active `defer_until`, and `backlogSourcePackage` already retains raw history. Preserve and test those behaviors; do not add a recursive field scrubber, content-cleanup pass or new provenance format. Do not introduce active deferral fields, scheduling/auto-wake, special status/placement or deferral annotations. Preserve ordinary title, description, notes (including `bd defer --reason` text), comments, identity and relationships. Keep historical structured deferral values in the existing raw native/export/history/events/provenance evidence, not active destination fields. Do not normalize or otherwise mutate the retiring Beads source.
3. Extend `tests/task_provider_migration.test.mjs` with existing disposable native Beads/Backlog fixtures for past-dated, future-dated and indefinite deferred tasks, including the reported `DEFERRED:` title and `defer_until` shape. Assert successful nonterminal inspection, ordinary `In Design` destination records in `tasks/`, no active deferral fields or extra annotations, and preserved ordinary content plus complete raw historical evidence. Exercise destination readback and exact replay through the existing guarded-retirement/refusal seams; prove the same destination identities are reused and source export/history/config and authority remain unchanged before verified cutover, with no ready/defer/undefer/status/config normalization commands. Remove only `deferred` from the unsupported-status rejection set; retain `pinned`, `hooked`, `finished`, `paused`, archive-integrity and no-write refusal assertions.
4. Run focused deferral/status/archive tests and the full migration suite through the Docker-backed `tests/test_task_provider_migration.py` bridge; adjust its test selection only if needed to include new coverage. Keep native export, issue/memory, identity/relationship, publication, receipt/replay and guarded-retirement regressions passing. After plugin-source changes run `scripts/test-tier1.sh --probe`, report actual results and limits on this task, and update directly affected migration guidance only if it would contradict the change. No dependency upgrade, unrelated importer cleanup, reopening PRIMECLAW-44/46/49, live Nemo inspection/mutation/migration/source deletion, user-global candidate apply/check/probe, activation, restart or merge is part of candidate validation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-03 Episode slice: verified exact owner/session/worktree, independent Backlog authority, and unchanged published task evidence. Implementing the approved migration-only deferred -> In Design projection with disposable native regression coverage. No live Nemo inspection/mutation, source normalization, lifecycle status change, or user-global activation is authorized or used.

2026-11-03 candidate evidence:
- Code change: migration-only statusFromBeads accepts native deferred as existing In Design. Existing preflight, destination conversion and verification/replay callers share this projection. Existing explicit destination field projection/raw source package are unchanged.
- New native disposable fixture: past 2026-08-01T00:00:00Z (reported DEFERRED: title), future 2099-08-01T00:00:00Z and indefinite deferral, including ordinary bd defer --reason notes. Inspection counts all six fixture issues as nonterminal; destination tasks stay in tasks/ with In Design, no deferral/due-date fields or extra annotations. Title/description/design/notes/comments and raw export line/native view/history/events/provenance remain exact.
- Guarded retirement is intentionally refused twice after published destination readback. The explicit exact-source replay reuses every destination mapping and receipt identity, with unchanged imported bytes. Source authority files, export, history/events/provenance, catalog, Git HEAD and lack of source remotes remain unchanged. Migration runner makes no ready/defer/undefer/update/config normalization writes. Only deferred was removed from unsupported-status offenders; pinned/hooked/finished/paused and archive refusal checks remain.
- Docker bridge: python3 -m pytest tests/test_task_provider_migration.py -q -m container -k "task_provider_migration_node_suite or beads_status_archive_preflight_node_suite" => 2 passed, 7 deselected (1909.33s). Full Node suite: 51 passed, 12 skipped, 0 failed (63 including subtests); focused status/archive rerun: 3 passed, 0 failed. Full suite retains issue/memory, identity/relationship, source/publication, receipt/replay and retirement regressions. Existing 12 skipped reverse-migration/legacy cases were not enabled or claimed as tested.
- Docker Tier 1: scripts/test-tier1.sh --probe => exit 0, offline apply/check/RPC tool/skill discovery passed. Both run manifests report passed, runtime network absent, clean verified container teardown. Supported source identity independently checked: https://github.com/SailorJoe6/prime-agent.git; annotated cwd-fix-v0.9.8-r1 object 8ca4d5c39b7c738f71b5c86422ea46394c3d0558; commit a1faacd53ac4473a75de1d434afaf50945c2f647; tree 5301c70d9c9d74e474ccaf258fdd3c8de982c52f; package-lock SHA-256 3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74. Source selector supplied via ignored .test-results/primeclaw-52.env, built only inside disposable Docker.
- Evidence paths (Episode worktree): .test-results/primeclaw-52-migration.log; .test-results/20261103T184600Z-85405-c849e5a1/tier1/{manifest.json,task-provider-migration-node.tap,beads-status-archive-preflight-node.tap}; .test-results/primeclaw-52-probe.log; .test-results/20261103T184419Z-79089-4563b7e9/tier1/manifest.json. Probe snapshot captured the final one-line plugin source; later edits were only docs/test coverage.
- Host-safe bridge/static checks: python3 -m pytest tests/test_task_provider_migration.py -q => 2 passed, 7 container tests correctly skipped; git diff --check clean.
- Scope limits: no live Nemo inspection/mutation/migration, no real source retirement, user-global apply/check/probe, dependency change, activation/restart, lifecycle status edit, merge, ownership mutation or cleanup. Fixture setup uses native defer only before the migration boundary; the importer never does.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the approved migration-only native deferred -> ordinary In Design projection. Active deferral state is not projected; ordinary content and complete historical raw evidence remain intact. Added past/future/indefinite native fixture coverage, published readback and exact replay/source-preservation assertions, retained unsupported/archive refusals, and updated migration guidance plus focused Docker selection. Full migration suite, focused rerun, Tier 1 offline probe, and host-safe checks passed. Candidate is ready for owning Conversation review, not merged or activated. Task remains In Progress.
<!-- SECTION:FINAL_SUMMARY:END -->
