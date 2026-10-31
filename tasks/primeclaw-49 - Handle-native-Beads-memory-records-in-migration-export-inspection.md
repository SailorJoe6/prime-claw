---
id: PRIMECLAW-49
title: Handle native Beads memory records in migration export inspection
status: In Progress
assignee: []
created_date: '2026-10-30 23:43'
updated_date: '2026-10-31 16:15'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - tests/task_provider_migration.test.mjs
documentation:
  - docs/project-initialization.md
modified_files:
  - docs/project-initialization.md
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - tests/task_provider_migration.test.mjs
  - tests/test_task_provider_migration.py
priority: p1
type: bug
ordinal: 134000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Observed failure

NemoHermes Upgrade reported a read-only reproduction in `/Users/jlanders/code/nemo-setup` after PRIMECLAW-44 activation. Canonical Beads-to-Backlog switch inspection stops with:

> Beads source export row has no exact canonical task ID

This Conversation has not independently reproduced the Nemo failure. The reporter used Homebrew `bd version 1.3.1` and these exact native commands:

```text
bd --readonly export --all
bd --readonly list --all --limit 0 --include-infra --include-templates --include-gates --include-ephemeral --json
```

The export contains 52 JSONL objects: 33 valid unique issue-ID records and 19 native memory records. All metadata records have the native discriminator `_type: "memory"` and keys exactly `[_type, key, value]`; they legitimately have no issue `id`. The independent native issue inventory contains 33 records, with issue IDs exactly matching the 33 exported issue records. The reporter also found ordinary and `--readonly` export bytes identical during this check. No memory values, credentials or unrelated issue bodies were shared.

The reporter corrected an earlier prose mistake: these 19 rows are **memory**, not config records. There is no demonstrated missing or malformed ISSUE ID.

## Diagnosis and intended outcome

The reported installed reader location is `task-provider-migration.ts`, `completeBeadsExport`, lines 517–537. Line 532 applies `exactTaskId(row.id)` to every export row, treating the native mixed export as a homogeneous issue array. A valid memory row therefore fails before canonical source revision/count inspection returns.

Recognize native issue versus memory records so valid mixed exports can be inspected. Compare the issue subset against the independently captured issue inventory, while preserving the complete typed native export and memory contents in source capture and the existing evidence/digest/receipt path. Do not silently discard memory records merely to make issue validation pass.

Use supported native format and existing capture mechanics for the reader repair and the operator-approved memory import outputs below. Do not introduce heuristic record classifiers, another mapping framework, additional lifecycle receipts or coordination machinery.

## Required memory import outputs

When the source contains at least one memory, a future operator-confirmed Beads-to-Backlog migration must make the imported memories directly available as native Backlog documentation, not merely bury them in migration evidence:

- Create one Backlog document per Beads memory in `.backlog/docs/`, through the supported Backlog CLI. Preserve each memory's original key and value losslessly; importing is not permission to summarize, rewrite or curate its contents. These are Backlog documents, not ordinary project `docs/` files or task records, and must not be authored by direct storage edits.
- Create one additional native Backlog origin/index document through the CLI. Explain that these are memories migrated from Beads and identify their source project/store. Link to every imported memory document so a user can find all of them from the index.
- Create exactly one user-facing Backlog follow-up task for the imported memory collection, through the CLI. Link it to the index and explain that the user must review the memories, integrate useful material properly into the project's documentation, or delete the imported material they do not want. This is a task for the user, not permission for an agent to perform that curation or deletion during migration. Do not create one follow-up task per memory.

If the source contains zero memories, create no memory documents, no origin/index document and no memory-curation follow-up task. Issue-only migrations must not acquire empty documentation or unnecessary user work.

The imported documents, origin/index and user task belong to the destination's normal native publication and verification before source retirement; a partial memory import is not a successful lossless migration. Keep the issue inventory and original issue identity checks distinct from memory documents and this newly authored user task.

These are requirements for the future migration behavior. This specification update does not create any of these outputs in Nemo now and does not authorize a live migration, memory cleanup or implementation.

## Safety, scope and evidence limits

Outgoing Beads remains authoritative and unchanged through inspection. Do not delete memories, strip source/export metadata, relax genuine issue identity or completeness checks, or bypass confirmation/publication/source-retirement protections. Preserve existing supported issue-only export behavior.

Nemo reported no migration, confirmation, destination creation, source deletion, task/store/config write, fix, deployment or restart. Its local task `nemo-setup-qtd` remains blocked without edits. No claim is made that full history capture or the rest of migration is verified. Prime Claw's successful Backlog-only normalization did not exercise this Beads reader.

This bug is Prime Claw work only. It does not reopen the closed PRIMECLAW-44 Episode, authorize changes to Nemo's source or task, or permit Prime Agent development. Candidate plugin changes and regression validation remain Docker-only. Live migration, deployment, coordinated restart and any Nemo retry need their existing separate operator authority. This ticket records the specification only; no implementation plan or execution is authorized.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Canonical switch inspection accepts the native bd 1.3.1 mixed issue/memory export shape without treating valid memory rows as missing-ID issues; the reported 33-issue/19-memory case is represented in regression evidence.
- [x] #2 Only actual issue records participate in issue-ID and independent issue-inventory comparison. Genuine malformed or duplicate issue IDs and incomplete issue inventories still refuse inspection without migration writes.
- [ ] #3 Full typed export and native memory contents remain preserved in source capture and the existing evidence/digest/receipt path; memory records are not silently dropped, source memories are not deleted, and no credentials or private memory contents enter test fixtures.
- [ ] #4 Focused Docker regression coverage proves mixed-export handling, memory preservation and the native memory-document/index/user-task outputs, proves that zero-memory migrations create no empty memory outputs, retains existing supported issue-only export behavior, and exercises a genuine invalid-issue refusal without adding a broad new harness or matrix.
- [ ] #5 The repair preserves existing read-only inspection, explicit migration confirmation, publication-before-retirement and failure-safety boundaries; it does not mutate Nemo, reopen PRIMECLAW-44, or add unrelated architecture or Prime Agent changes.
- [ ] #6 A confirmed migration creates one native Backlog document per Beads memory in .backlog/docs/ through the supported Backlog CLI, preserving the original memory key and value losslessly without rewriting, curating or treating it as an issue.
- [ ] #7 When at least one memory is imported, one additional Backlog document explains that the memories were migrated from Beads, identifies their source, and contains a working link to each imported memory document; it is created through the supported Backlog CLI.
- [ ] #8 When at least one memory is imported, exactly one user-facing Backlog task for the imported memory collection is created through the supported CLI and links to the index. It asks the user to integrate useful memories into the project documentation or delete unwanted imports; migration does not perform that user curation/deletion.
- [ ] #9 Memory documents, the index and the single user task are verified and published through the existing destination-native process before Beads source retirement; the original issue-ID/inventory checks remain intact and do not miscount these distinct destination outputs.
- [ ] #10 A source export with zero memories produces no memory documents, no origin/index document and no memory-curation user task; supported issue-only migrations continue without empty memory outputs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation approach

Keep the current Beads-to-Backlog operation and native CLI boundary. Use native record types and existing capture/publication proofs, not a new migration framework. The existing Backlog candidate already supports document content updates; no new dependency or Prime Agent changes are needed. The Nemo report is independent evidence, not a reproduction performed by this Conversation.

1. **Capture the mixed native export without weakening issue checks.** In `task-provider-migration.ts`, make `completeBeadsExport` recognize native `_type: "memory"` rows separately from issues. Compare only issue IDs against the complete independent issue inventory; retain strict malformed/duplicate/missing issue refusal. Preserve every typed row and its original export line. In `captureBeads`, run task show/history/events/provenance and lifecycle/relationship validation only for issues. Retain memory keys, values and raw export evidence separately in the existing source snapshot, digest and recapture checks so a memory-only change invalidates the inspected source revision. Task counts and ownership mappings remain issue-only. Do not silently drop unsupported or malformed native content, classify records heuristically, or change the retiring Beads store/configuration.

2. **Create the approved readable Backlog documents through native commands.** During confirmed `migrateBeadsToBacklog`, use `backlog doc create <title> --plain` followed by `backlog doc update <docId> --content <body>` for each memory. Use returned native identities; do not derive task IDs from memory keys or write provider files directly. Use a fixed Markdown heading/provenance wrapper, readable original content and an escaped JSON representation of the complete native memory record for exact key/value round-trip. This preserves leading/trailing whitespace, Unicode and control characters without letting a leading source YAML block become document metadata; do not summarize or normalize memories. Add one native origin/index document explaining the source Beads project/store and linking every imported memory document. Treat imported text as document data, not instructions to execute. Verify actual ID/body/provenance and link targets with `backlog doc view <docId> --plain` (raw Markdown, not JSON). Missing-document output can exit successfully, so exit status alone is not proof. Parse only native returned IDs/paths and URL-encode filenames in relative Markdown links. Use direct argv strings (`--content=<body>`) rather than shell interpolation; a native argument-size failure blocks migration without truncation or an editor/storage bypass. Do not place these imports in ordinary project `docs/`.

3. **Create exactly one USER curation task, only when memories exist.** Use supported `backlog task create` with explicit `In Design`, a clear user-review title/description and `--doc <actual-index-path>`, then verify its native JSON task view. Explain that the user must integrate useful material properly into project documentation or delete unwanted imports. Do not assign that curation to an agent, perform it during migration, or create one task per memory. If there are zero memories, skip all memory documents, the index and this task.

4. **Extend the current destination proofs, not the lifecycle.** Include the documents, index and user task in the existing destination data publication, exact native readback, destination digest and single receipt evidence. Adjust destination task-count verification for the one optional user task without adding documents or that task to source issue counts/mappings. Re-read these outputs at the existing post-receipt and pre-cutover checks; missing/changed/unpublished outputs must block source retirement. Preserve unrelated destination records/docs/configuration/history and the existing active-Episode identity/ownership proofs. Reuse the approved native outputs under the existing exact-source same-destination replay path so it does not duplicate the index or user task; use their source provenance and native identities, not a new receipt, ledger, controller or retry protocol. Leave uncertain/partial outcomes as the existing operation's blocker; do not automatically retry transport or create another destination.

5. **Add focused regressions to the existing Docker migration suite.** Extend `tests/task_provider_migration.test.mjs` and its existing Python container bridge, without a new harness or broad matrix (extend one existing container selector to cover the focused new tests):
   - A public synthetic 33-issue/19-memory export matching the reported native shape passes issue-inventory inspection; memory rows are never sent to issue show/history commands. Retain an issue-only case and genuine malformed/duplicate/incomplete issue refusal.
   - A small disposable native Beads fixture with public multiline/Unicode/whitespace/frontmatter-like memory text proves lossless source capture, a memory-only digest change, and confirmed native document/index/single-user-task creation with working links and published readback. Exercise zero memories through an existing issue-only migration and assert no memory outputs.
   - Extend existing publication/receipt refusal and same-destination replay coverage to show missing or changed memory outputs prevent source deletion and a compatible replay does not duplicate the imports/user task. Preserve the current active-Episode/source-authority assertions; use no Nemo/private memory values.
   Run `python3 -m pytest tests/test_task_provider_migration.py -q -m container -k "retiring_beads_source_boundary or populated_backlog_migration"` with those selectors extended only as needed for the focused new cases and mandatory `scripts/test-tier1.sh --probe` after plugin-source changes. Record actual focused results and any remaining failures; do not claim unrelated historical full-suite failures are fixed.

6. **Document and publish the bounded change.** Update `docs/project-initialization.md` and relevant managed initialization guidance to explain typed exports, destination memory docs/index, the USER curation task, zero-memory behavior and publication-before-retirement. Keep the normal single migration confirmation/maintenance window and source authority until all destination proofs succeed. Publish code, tests and docs through the later Episode's normal review path; no live migration, Nemo retry, global apply or coordinated restart is authorized by this plan.

## Scope limit

Prefer supported provider-native behavior, then concise LLM instructions for semantic judgment, then only the narrow deterministic integrity/transport changes required above. Do not add deterministic task reconciliation, plan-change machinery, another mapping framework, new persistent coordination state or speculative hardening. PRIMECLAW-44 stays closed. Planning is not implementation approval; a separate explicit `/implement-task PRIMECLAW-49` is required.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Episode slice 1 — mixed-export capture (in progress)

Bound this pass to Implementation approach step 1 plus focused Docker regressions and documentation. Separate native memory rows from the complete issue inventory; preserve raw memory rows/lines in snapshot/digest evidence and prove a memory-only change invalidates the inspected revision. Keep malformed/duplicate/incomplete issue refusal. Native Backlog memory docs/index/one USER curation task and their publication/replay verification remain for a later slice. Until those outputs exist, confirmation with memories must refuse before destination preparation/writes; inspection alone never authorizes dropping memories or retiring source.

Exact ownership/task-store binding verified at code base 500b386002badc4af9824b8a2e85752f35c5e3f3 and task revision be072fdd01757c5b82458920153cb75b559ef43c. No live migration, Nemo mutation, global apply or restart is part of this pass.

### Episode slice 1 — published capture candidate

Code candidate: 958b9752571f64faab3cc8871d90da5bd3ba0110. Files: `docs/project-initialization.md, src/prime-agent-plugin/extension-support/task-provider-migration.ts, tests/task_provider_migration.test.mjs, tests/test_task_provider_migration.py`.

Implemented native `_type: "issue"` / `_type: "memory"` discrimination with supported older untagged issues. Only issues enter canonical ID/inventory, history/events/provenance, lifecycle/relationship and count checks. Memory rows and original line bytes are retained separately in capture/digest and the existing source-package evidence. Native memory-only value and raw-line changes change the exact capture revision. Unknown types, malformed memories, invalid/duplicate/missing issue IDs and incomplete issue inventories still refuse. Confirmed migration with memories explicitly refuses `memory-import-not-implemented` before any Backlog command/preparation/write or source deletion. This refusal is a temporary slice boundary, not completion of the full migration contract.

Validation (Docker-only, verified supported TypeScript dependency source selector via TIER1_ENV_FILE):
- Pre-fix red: `python3 -m pytest tests/test_task_provider_migration.py -q -m container -k retiring_beads_source_boundary` reproduced the reported missing canonical task ID using public synthetic 33-issue/19-memory rows. Log `/tmp/primeclaw49-capture-red.log`; evidence `.test-results/20261031T154926Z-98321-574f86c1/tier1`. This is not a Nemo reproduction.
- Final retiring-source boundary command above: **1 passed, 8 deselected**; 13 native Node cases/subtests including typed 33/19, malformed rows, native Unicode/whitespace/frontmatter-like memory capture, value/raw-line digest changes, issue-only reads, and fail-closed confirmation. Log `/tmp/primeclaw49-capture-green4.log`; evidence `.test-results/20261031T160849Z-60859-7046532f/tier1`.
- Populated Backlog selector passed on identical final plugin source: 9 native Node tests; TAP `.test-results/20261031T160024Z-34258-2d43cb43/tier1/populated-backlog-migration-node.tap`. The combined command `python3 -m pytest tests/test_task_provider_migration.py -q -m container -k "retiring_beads_source_boundary or populated_backlog_migration"` was **1 failed, 1 passed** at that point due to an incorrect test assumption about restoring native history; the final boundary rerun fixed that fixture and passed. Do not describe the combined invocation as fully green.
- Final mandatory `scripts/test-tier1.sh --probe`: **exit 0**, offline checks passed, teardown verified, manifest published. Log `/tmp/primeclaw49-capture-probe2.log`; evidence `.test-results/20261031T161252Z-72259-f88ddf14/tier1`.
- `git diff --check`: clean. Intermediate runs exposed a concurrent disposable-builder setup failure, a native issue-tag classifier omission (fixed), and an invalid fixture assumption that restoring a memory value restores its native history/revision (corrected by reconfirming current exact source). No integrity rule was weakened.

Remaining: implement approved native Backlog memory documents, source/index and exactly one USER curation task, then destination readback/publication/digest/receipt/pre-cutover/replay verification and zero-memory output assertions. Keep the early memory-import refusal until those outputs are complete. AC 1–2 checked for this capture slice; remaining criteria are not claimed. No live migration, Nemo mutation, global apply, restart, merge, source retirement or user memory curation occurred. Status remains In Progress. The implementation plan remains the full approved plan, with this note recording its bounded progress.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slice 1 only: typed Beads issue/memory capture and strict issue inventory checks are implemented at code 958b9752571f64faab3cc8871d90da5bd3ba0110. Focused Docker boundary and populated Backlog tests plus the final tier-1 probe passed as recorded in Implementation Notes. Memory-bearing confirmation remains blocked before destination writes until native memory docs/index/one USER task and publication/replay proofs are implemented. The full task is not complete.
<!-- SECTION:FINAL_SUMMARY:END -->
