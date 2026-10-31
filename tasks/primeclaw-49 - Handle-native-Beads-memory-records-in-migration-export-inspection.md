---
id: PRIMECLAW-49
title: Handle native Beads memory records in migration export inspection
status: In Design
assignee: []
created_date: '2026-10-30 23:43'
updated_date: '2026-10-31 14:33'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - tests/task_provider_migration.test.mjs
documentation:
  - docs/project-initialization.md
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
- [ ] #1 Canonical switch inspection accepts the native bd 1.3.1 mixed issue/memory export shape without treating valid memory rows as missing-ID issues; the reported 33-issue/19-memory case is represented in regression evidence.
- [ ] #2 Only actual issue records participate in issue-ID and independent issue-inventory comparison. Genuine malformed or duplicate issue IDs and incomplete issue inventories still refuse inspection without migration writes.
- [ ] #3 Full typed export and native memory contents remain preserved in source capture and the existing evidence/digest/receipt path; memory records are not silently dropped, source memories are not deleted, and no credentials or private memory contents enter test fixtures.
- [ ] #4 Focused Docker regression coverage proves mixed-export handling, memory preservation and the native memory-document/index/user-task outputs, proves that zero-memory migrations create no empty memory outputs, retains existing supported issue-only export behavior, and exercises a genuine invalid-issue refusal without adding a broad new harness or matrix.
- [ ] #5 The repair preserves existing read-only inspection, explicit migration confirmation, publication-before-retirement and failure-safety boundaries; it does not mutate Nemo, reopen PRIMECLAW-44, or add unrelated architecture or Prime Agent changes.
- [ ] #6 A confirmed migration creates one native Backlog document per Beads memory in .backlog/docs/ through the supported Backlog CLI, preserving the original memory key and value losslessly without rewriting, curating or treating it as an issue.
- [ ] #7 When at least one memory is imported, one additional Backlog document explains that the memories were migrated from Beads, identifies their source, and contains a working link to each imported memory document; it is created through the supported Backlog CLI.
- [ ] #8 When at least one memory is imported, exactly one user-facing Backlog task for the imported memory collection is created through the supported CLI and links to the index. It asks the user to integrate useful memories into the project documentation or delete unwanted imports; migration does not perform that user curation/deletion.
- [ ] #9 Memory documents, the index and the single user task are verified and published through the existing destination-native process before Beads source retirement; the original issue-ID/inventory checks remain intact and do not miscount these distinct destination outputs.
- [ ] #10 A source export with zero memories produces no memory documents, no origin/index document and no memory-curation user task; supported issue-only migrations continue without empty memory outputs.
<!-- AC:END -->
