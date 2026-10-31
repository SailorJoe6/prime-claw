---
id: PRIMECLAW-49
title: Handle native Beads memory records in migration export inspection
status: In Progress
assignee: []
created_date: '2026-10-30 23:43'
updated_date: '2026-10-31 17:34'
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

### Accepted capture candidate and next bounded slice

Owner accepted capture candidate 958b9752571f64faab3cc8871d90da5bd3ba0110 after independent read-only review found no material capture-slice defect. Continue the approved native plan with lossless CLI-native memory documents, one source/index document and exactly one USER integrate/delete task; zero memories produces none. Extend existing destination publication/readback/digest/single-receipt/pre-retirement/replay proofs, not the lifecycle. Keep memory-bearing confirmation safely refused until those outputs and proofs are complete; use bounded slices as needed.

Accepted nonblocking reporting correction: the earlier statement “before any Backlog command” is too broad for an existing destination. Coexistence may perform harmless read-only capability/task/archive verification before refusal. The actual protection is no live destination data mutation or source retirement. Do not reorder guards solely to forbid those reads.

Preserve honest intermediate-failure reporting and Docker-only tests/probe after source changes. Prefer native behavior and the smallest necessary integrity changes; no new frameworks, ledger/controller/receipt/retry protocol or speculative hardening. No live Nemo migration/edits, user curation/deletion, global deployment/restart, Prime Agent changes or reopening PRIMECLAW-44. Return a published bounded candidate and native task evidence; the owner retains lifecycle decisions.

### Episode slice 2 — native memory output boundary (in progress)

Bound this pass to approved approach steps 2–3: a small pair-specific native CLI importer and immediate exact readback for per-memory Backlog documents, one source/index document, and exactly one In Design USER integrate/delete task. Prove the native helper against public disposable fixtures, including lossless JSON key/value round-trip, linked native output identities, missing/changed output refusal, and zero-memory no-op. Keep the top-level memory-import-not-implemented refusal intact: destination publication/digest/receipt/pre-retirement/replay integration remains the next bounded slice. This supplies decisive native-output evidence without enabling incomplete live migration. No new controller, ledger, receipt or retry protocol. The existing approved plan stays unchanged. Docker-only focused bridges and mandatory tier-1 probe follow source changes; no live migration or lifecycle mutation.

### Episode slice 2 — native-output boundary candidate

Code candidate: 811586364ce92d46366f110bb0815db4a8a829e5. Modified files: `docs/project-initialization.md, src/prime-agent-plugin/extension-support/task-provider-migration.ts, tests/task_provider_migration.test.mjs, tests/test_task_provider_migration.py`.

Implemented small pair-specific `importBeadsMemoryDocuments` and `verifyBacklogMemoryOutputs` helpers. Supported native doc create/update/view creates one document per memory and one source/index document with encoded links to returned native paths. Fixed Markdown wrapper contains readable key/value, complete escaped native-row JSON for lossless round-trip, and exact source project/store/revision/digest provenance. One explicit In Design USER integrate/delete task links the actual index. Structured readback verifies ID/path/title/description/status/documentation and empty assignees. Readback rejects changed/missing docs/index (including exit-0 not-found output) and changed task status/link. Zero-memory input returns no outputs or commands. Imported text is data, not instructions; no curation/deletion occurs. Issue identity/mappings/counts are untouched.

Top-level `memory-import-not-implemented` refusal stays intact. Helpers are proven against disposable native outputs, not yet called by confirmed migration. Publication/digest/single-receipt/pre-retirement/replay integration remains next. AC1–2 remain checked; no additional full-migration criterion claimed. Existing-destination reporting correction stands: harmless read-only capability/task/archive verification may precede refusal; protection is no live destination data mutation or source retirement, not a ban on every Backlog command.

Validation (sequential Docker-only; exact supported source selector TIER1_ENV_FILE=/var/folders/4_/twy0wz3s1mq650wnqzn1b8rr0000gq/T/primeclaw49-tier1-selector-vv2sz1do/selection.env):
- `python3 -m pytest tests/test_task_provider_migration.py -q -m container -k "retiring_beads_source_boundary or populated_backlog_migration"`: **2 passed, 7 deselected in 515.11s**. Log `/tmp/primeclaw49-memory-outputs-focused3.log`; evidence `.test-results/20261031T165013Z-91364-b112d782/tier1/retiring-beads-source-boundary-node.tap` (14 native cases/subtests), `populated-backlog-migration-node.tap` (9 pass).
- Public native fixture covers multiline/Unicode/whitespace/frontmatter/backtick/control values, complete record/provenance JSON, working links and one USER task. One public synthetic NUL package exercises the same real native destination writer because process argv cannot contain NUL; do not claim native Beads captured that synthetic package.
- `scripts/test-tier1.sh --probe` with same selector: **exit0**; offline checks passed, teardown verified, manifest published. Log `/tmp/primeclaw49-memory-outputs-probe1.log`; evidence `.test-results/20261031T165854Z-17828-5c9ecb6b/tier1`.
- `git diff --check`: clean.
- Intermediate focused1/focused2 each returned **1 failed, 1 passed** (populated Backlog passed both). First, a fixture value starting `---` parsed as flags; fixed with supported `--key key -- value`. Second, a fixture SQL UPDATE did not change exported memory content; removed that assumption, used native remember argv for non-NUL controls plus synthetic NUL. No importer integrity check weakened. Logs `/tmp/primeclaw49-memory-outputs-focused1.log`, `/tmp/primeclaw49-memory-outputs-focused2.log`; evidence `.test-results/20261031T163319Z-41380-8a2d6bce/tier1`, `.test-results/20261031T164138Z-67543-3c5b182a/tier1`.
- Publication preparation initially tried pull/rebase with unstaged slice files; Git refused without changes. Committed the bounded slice, then pull/rebase succeeded with branch already current.

Next: integrate returned outputs with existing destination publication/readback/digest/single receipt/pre-retirement/replay proofs and optional user-task count; reuse native identities on exact-source same-destination replay. Keep confirmation refused until all proofs/regressions pass. No new ledger/controller/receipt/retry protocol. No live migration/source retirement, Nemo reads/edits, curation/deletion, global deployment/restart, Prime Agent development or reopening PRIMECLAW-44. Status remains In Progress; full approved plan retained. Stop after publishing this bounded candidate.

### Accepted slice 2 review finding — narrow path-verification revision

Candidate 811586364ce92d46366f110bb0815db4a8a829e5 requires one in-scope repair before acceptance. Independent read-only review found that `verifyBacklogMemoryOutputs` rereads by document ID/body but ignores captured paths used by the index and USER task. In a disposable Docker reproduction, supported `backlog doc update <id> --path relocated --content=<unchanged body>` removed the original memory document path while the index still linked to it; verification incorrectly accepted. Moving the index also accepted although the USER task still pointed at its missing path. This demonstrates a material defect against approved plan step2 working links and step3 actual index path. Review report `/tmp/primeclaw49-memory-outputs-review.md`; reproduction `/tmp/primeclaw49-memory-outputs-review-repro.log` (154.71s; not a suite rerun).

Next pass is limited to this accepted finding and its actual repair diff: in the existing readback, verify every captured memory/index path resolves to the same native document and body, refusing missing/moved/mismatched paths through the existing error boundary. Prefer supported native behavior, otherwise the smallest read-only integrity check. Add one focused native-move regression covering both memory document and index. No automatic link repair, ledger/controller/classifier/receipt/retry protocol, speculative hardening or broad review gauntlet.

Preserve lossless content, exact native identities, zero-memory no-op, one USER task and accepted capture. Keep top-level memory-import-not-implemented refusal intact and defer publication/digest/single-receipt/pre-retirement/replay integration. Record truthful evidence; run proportionate affected Docker tests and mandatory tier1 --probe after source changes, publish one clean bounded code repair and task-only evidence, report the owner, then stop. No live migration/Nemo edits, curation/deletion, deployment/restart/global apply, Prime Agent development, reopening PRIMECLAW-44, lifecycle status change or merge. Status remains In Progress; AC1–2 only checked. Earlier slice2 green tests did not detect this demonstrated path defect; do not describe the candidate as accepted or working-link readback as complete until the repair is proven.

### Episode slice 2 — bounded captured-path repair candidate

Code candidate: 2f914a6fed4d6cfc32de063a067f55874a026593. Changed files: `src/prime-agent-plugin/extension-support/task-provider-migration.ts`, `tests/task_provider_migration.test.mjs`, `docs/project-initialization.md` (29 insertions, 3 deletions). This repairs the accepted material path-verification defect only; no migration integration is enabled. The earlier independent report remains valid against 811586364ce92d46366f110bb0815db4a8a829e5.

Existing `verifyBacklogMemoryOutputs` now compares every captured memory/index path's complete Markdown with exact native ID readback, accounting only for the native view command's added newline. Missing/moved/unreadable/different targets refuse through the existing native identity/body mismatch boundary. Supported native `doc view` resolves by ID/current path; plain list exposes no usable exact path read. A small read-only file comparison is therefore the narrow fallback. No output writes, automatic link repair, new ledger/controller/classifier/receipt/retry protocol or dependency changes. One focused native-move subtest moves memory and index using supported `doc update --path relocated --content=<unchanged body>`, proves unchanged native ID/body and stale links, asserts refusal, restores using native commands, then proves readback succeeds again.

Actual validation (sequential Docker-only, TIER1_ENV_FILE=/var/folders/4_/twy0wz3s1mq650wnqzn1b8rr0000gq/T/primeclaw49-tier1-selector-vv2sz1do/selection.env selecting supported read-only dependency source):
- Affected command `python3 -m pytest tests/test_task_provider_migration.py -q -m container -k retiring_beads_source_boundary` first returned **1 failed, 8 deselected in 257.40s**, before reaching the defect: the fixture wrapper trimmed an exact trailing newline. Corrected only the assertion to use raw stdout; plugin source stayed unchanged. Log `/tmp/primeclaw49-path-repair-red.log`; evidence `.test-results/20261031T171722Z-80955-7c6712dc/tier1`.
- Corrected pre-fix red command returned **1 failed, 8 deselected in 263.38s** with `Missing expected exception.` after supported native move. This reproduces the demonstrated defect, not a Nemo run. Log `/tmp/primeclaw49-path-repair-red2.log`; evidence `.test-results/20261031T172155Z-94687-a3f96a3a/tier1`.
- Final affected green command returned **1 passed, 8 deselected in 266.76s**; native TAP **15 pass, 0 fail**, including both moves plus existing lossless capture/output, corruption/refusal, one USER and zero-memory cases. Log `/tmp/primeclaw49-path-repair-green.log`; TAP `.test-results/20261031T172640Z-9512-0e79dcb4/tier1/retiring-beads-source-boundary-node.tap`.
- Mandatory final `scripts/test-tier1.sh --probe`: **exit 0**, checks/network isolation/teardown/manifest verified. Log `/tmp/primeclaw49-path-repair-probe.log`; evidence `.test-results/20261031T173113Z-23619-1248e58c/tier1`.
- `git diff --check`: clean. No populated migration/full-suite rerun claimed for this narrow readback repair. Full helper report `/tmp/primeclaw49-path-repair-report.md`.

Lossless raw-row JSON/readable content/native identities, accepted issue-only capture checks, zero-memory no-op, exactly one In Design USER task and top-level `memory-import-not-implemented` refusal are preserved. Publication/digest/single-receipt/pre-retirement/replay integration remains deferred pending separate accepted continuation. No live migration/Nemo access, curation/deletion, host/global apply/check/probe, deployment/restart, Prime Agent development, reopening44, lifecycle/status change or merge. Task remains In Progress; AC1–2 only checked. Stop after publishing this bounded repair and exact native task evidence for owner review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bounded slices1–2 only: accepted typed capture at 958b975; native memory document/index/one USER task helper at 8115863, now revised at 2f914a6fed4d6cfc32de063a067f55874a026593 to refuse missing/moved/mismatched captured paths through exact native readback. The focused native-move red reproduced the defect; final Docker boundary passed 1 passed/8 deselected (15 native TAP pass), and mandatory tier1 probe exit0. Candidate awaits owner review. Confirmed migration remains disabled by memory-import-not-implemented; publication/digest/single-receipt/pre-retirement/replay integration remains pending. Full task not complete, In Progress, AC1–2 only checked.
<!-- SECTION:FINAL_SUMMARY:END -->
