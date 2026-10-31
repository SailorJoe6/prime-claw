---
id: PRIMECLAW-50
title: >-
  Beads migration inspection truncates >1 MiB native history and misreports
  ENOBUFS as source evidence failure
status: In Progress
assignee: []
created_date: '2026-10-31 14:47'
updated_date: '2026-10-31 18:42'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/project-initialization.ts
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - PRIMECLAW-44
  - PRIMECLAW-46
  - PRIMECLAW-49
  - /tmp/ralph-pva-history-preflight-20261031/prime-claw-bug-handoff.md
priority: p1
type: bug
ordinal: 135000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Impact and evidence

Read-only Beads → Backlog migration inspection in Ralph PVA is blocked by command-output capture, not demonstrated source corruption. Joe assigned this Conversation ticket creation only. The reporting session verified the reproduction on 2026-10-31; this Conversation read its complete handoff and confirmed the corresponding tracked code, but did not rerun Beads or inspect the private history payload.

In `/Users/jlanders/gitlab_local/ralph-pva`, `initialize_prime_claw(action="switch-request", targetProvider="backlog")` returned `status=blocked`, `code=preflight`. Detail began `bd history playwrite_testing-x9ro.11: [` and ended mid-JSON, with generic advice to repair native source/publication evidence. The historical Slack-repair description is task data, not migration-repair instructions.

The reporter captured the source successfully with:

```text
bd --readonly history playwrite_testing-x9ro.11 --json --limit 0 > /tmp/ralph-pva-history-preflight-20261031/playwrite_testing-x9ro.11-history.json 2> /tmp/ralph-pva-history-preflight-20261031/history.stderr
```

Result: exit 0, empty stderr, 1,305,475 bytes, valid JSON array with 108 records, every `Issue.id` equal to `playwrite_testing-x9ro.11`.

Using the saved file (not another Beads invocation), the reporter reproduced the installed capture options:

```javascript
execFileSync('/bin/cat', [historyFile], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
})
```

Caught metadata: `code=ENOBUFS`, `status=null`, `signal=SIGTERM`, message `spawnSync /bin/cat ENOBUFS`, stdout 1,114,112 bytes, stderr 0 bytes. Original preflight detail was 1,114,150 UTF-8 bytes, consistent with its label plus the truncated stdout. This proves a command-capture limit; it does not prove malformed native history.

## Cause and affected source

Installed diagnostic locations were `~/.prime/agent/extension-support/project-initialization.ts` lines 140–157 and `task-provider-migration.ts`. They are evidence, not an authorized patch target. Corresponding builder source at main `500b386002badc4af9824b8a2e85752f35c5e3f3`:

- `src/prime-agent-plugin/extension-support/project-initialization.ts:140–157`, `ProcessCommandRunner.run`: `execFileSync` has no explicit `maxBuffer`. The catch uses `String(error?.stderr ?? error?.message ?? error)`, so empty stderr masks the useful message; null status becomes 1 and code/signal are lost.
- `src/prime-agent-plugin/extension-support/task-provider-migration.ts:589–590`, `captureBeads`: reads full per-task native history and events with `--limit 0`.
- The same file at line 236, `commandFailure`: prefers trimmed stderr, then stdout, then exit status. It therefore exposes a large truncated historical payload instead of the output-limit cause.

## Required outcome

Capture complete output for all native Beads source reads used by migration, including export, inventory, task views, history, events and provenance, without a fixed per-command size ceiling, subject to available resources, without truncation or silent omission. Merely raising a fixed output-buffer cap is not sufficient. Resource failures must remain explicit and fail safely with source authority intact; this is not a promise of unlimited memory or storage. Preserve all existing tasks, history, configuration and provenance. Per-task full in-memory output capture is an implementation choice, not a universal migration requirement. Choose the smallest sound repair; this specification does not prescribe a new architecture or an implementation plan.

Distinguish command transport/output-limit failures from malformed or incomplete native data. Diagnostics must be bounded and actionable: identify the failed command and available error code/status/signal. A short bounded excerpt of native stderr is permitted to explain ordinary failures; captured stdout and native task/history payloads must never be included. Do not substitute stdout when stderr is empty. Empty stderr and null status must not erase ENOBUFS. Do not recommend trimming history, changing task statuses, or repairing otherwise readable source data to work around this transport bug.

## Preservation and safety boundaries

Source authority must remain intact whenever complete capture cannot be proven. Preserve stable source identity/revision, complete inventory/history/provenance, quiescence, active ownership continuity, destination verification/publication, receipt and cutover/deletion protections. Do not add outgoing source-publication requirements or unused lifecycle statuses merely to read retiring data. Do not invent an extra preservation-approval gate.

Ralph initialization is complete; migration has NOT run. No `switch-confirm`, source repair/retirement, or successfully inspected exact source revision exists for this attempt. Prior inventory (406 issues: 349 closed, 42 open, 10 in_progress, 5 blocked) is historical, not fresh completeness evidence. `.beads/issues.jsonl` is stale and non-authoritative. Prior setup/report checkpoints `094cbb7` and `4a31c26` are not claims about current HEAD.

Preserve existing Backlog RPVA-1, RPVA-2, and the distinct archived RPVA-2 prefix probe, plus configuration parked at `backlog/config.yml.pre-migration` by `3f29fb6`. Do not restore, reset, renumber, or discard them. Intended destination remains independent `.backlog/` with the root native configuration symlink and consolidation of existing records/config/history. Preserve mappings: legacy open → In Design; ordinary closed → Done/completed, not automatic archive; retain raw status, close reasons and relationships.

PRIMECLAW-46's outgoing-status defect was consolidated into PRIMECLAW-44; Joe reported it cleared. PRIMECLAW-49 concerns native memory records. This is a distinct subsequent output-buffer failure, not either source-schema defect.

Ticket creation authorizes no implementation, live Ralph command/retry/migration, store/config mutation, global installation, Prime Agent patch, merge or cleanup. Future candidate work must use synthetic disposable fixtures and Docker-only plugin validation. Actual cutover still needs exact revision/counts/ownership, semantic placement, a bounded maintenance window, quiesced writers and explicit one-way migration/source-deletion confirmation. Do not paste private history or bulk-read the reporter's log; the metadata and synthetic reproduction are sufficient.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Complete output capture for all native Beads source reads used by migration (including export, inventory, task views, history, events and provenance) has no fixed per-command size ceiling, subject to available resources, and never truncates or silently omits data; merely raising a fixed buffer cap is insufficient. A synthetic case representing the reported 1,305,475-byte, 108-record history verifies complete retention; resource failure remains explicit and safe.
- [ ] #2 Output-limit/transport failures remain distinct from invalid JSON or incomplete native data; ENOBUFS is identifiable even with empty stderr and null status, with available command/code/status/signal metadata retained.
- [ ] #3 Failure diagnostics have a bounded size and display command/error metadata with an optional short bounded native stderr excerpt, but never captured stdout or native task/history payloads, including when stderr is empty. They do not advise repairing readable source data for a command-capture failure; ordinary command errors remain actionable.
- [ ] #4 When complete capture is not proven, inspection fails safely without destination writes or source mutation/retirement; existing preservation, identity, stable capture, quiescence, ownership, publication, receipt and explicit cutover/deletion safeguards remain intact.
- [ ] #5 Disposable synthetic Docker regression coverage exercises >1 MiB valid history/events, ENOBUFS with empty stderr/null status, ordinary command errors and genuinely malformed native JSON, without live Ralph access or global plugin changes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation approach

Keep the existing synchronous `CommandRunner.run` and native snapshot/package flow. Replace fixed pipe-buffer capture with private temporary-file/file-descriptor capture for migration commands; successful results still return complete strings for the existing parsers. This removes the per-command capture ceiling without an async migration rewrite. Memory/string and temporary-storage exhaustion remain resource failures, not a promise of unlimited capacity. Do not add a migration framework, persistent spool registry, retry loop, new state machine, or preservation-approval gate. Do not implement deterministic machinery for task reconciliation, iterative plan changes, or semantic judgments that the Episode or Conversation can perform. Semantic decisions stay with the Conversation/Episode.

1. **Repair capture at the existing runner seam.** In `extension-support/project-initialization.ts`, implement file-backed capture with one small helper at the existing runner seam. Do not add a parallel runner framework, runner registry, command-routing framework, or configurable capture-policy system. Redirect child stdout and stderr to private files rather than `execFileSync` pipes, wait for completion, and read complete successful stdout. Keep other runner consumers compatible and avoid changing unrelated command behavior. Wire both `inspectTaskProviderMigration` and `migrateTaskProvider` in `extension-support/task-provider-migration.ts` to use this path throughout source capture and recapture, including export, independent inventory, task views, histories, events, provenance and identity/version/catalog reads. Close descriptors and remove only this invocation's temporary files in `finally`, on success and failure. File creation, child execution and output-read failures must fail closed; never parse or certify a partial captured result. No fixed `maxBuffer` increase, output clipping, history pagination/omission, or source-data workaround.

2. **Preserve failure metadata and render safe diagnostics.** Extend the runner result with backward-compatible optional native error code, original nullable exit status and signal (retain the existing numeric status convention for callers). Preserve these values for spawn/capture/resource failures and nonzero exits; empty stderr must not hide `ENOBUFS`. In migration `runRequired`/`commandFailure`, distinguish command/capture failure (including resource failure) from invalid native data using the existing failure paths, preserved metadata and simple diagnostic formatting. Do not build a generalized error taxonomy or classification framework. Use a bounded safe command label and available metadata plus an optional short bounded stderr excerpt; never fall back to captured stdout, dump an error's output/cause object, or print payload-bearing command arguments. Bound the complete rendered diagnostic, not just stderr. Make migration JSON parse errors identify the command/data kind without echoing input or raw parser messages that can quote private history. Update inspection/migration error advice so command transport/resource failures advise resolving that failure, not repairing readable source data; genuinely invalid/incomplete native data remains a distinct actionable failure.

3. **Add focused synthetic Docker regressions.** Extend `tests/task_provider_migration.test.mjs` and, where needed, `tests/project_initialization_extension.test.mjs` through their existing Docker pytest bridges; do not create a new test harness. Exercise the production capture runner, not only fake string-returning runners: generate valid 108-record history representing the reported 1,305,475-byte case, retain a tail sentinel, and compare full output/record content. Cover large history and events with reusable synthetic data, and use small shared-path/routing assertions to prove that export, inventory, show and provenance use the same uncapped path. Reuse existing migration fixtures for lossless destination retention. Do not generate 108 real Beads revisions, build separate integration fixtures for every command/error combination, or expand this into a duplicated test matrix. Add a larger-than-baseline case and multibyte content to catch incorrect byte handling. Finite stress tests are not proof of no fixed ceiling: also review source capture for finite pipe-buffer limits or byte cutoffs. Existing fixture helpers use capped `execFileSync`; oversized fixture reads/assertions must use the repaired production path or known fixture bytes instead. Inject `ENOBUFS` with empty stderr/null native status and signal, ordinary nonzero command failures with short/oversized/empty stderr, and temporary-storage/output-read resource failures; assert bounded actionable metadata, private stdout/tail sentinels absent from diagnostics, cleanup on handled success/failure, and no destination writes or source/ownership mutation when initial capture fails. A real malformed native JSON case must fail as invalid data without exposing its payload. Keep existing migration preservation, stable recapture, exact revision/inventory, ownership continuity, receipt, publication and cutover/deletion tests intact.

4. **Validate and document only this repair.** Update `docs/project-initialization.md` to explain complete migration capture subject to available resources, private temporary-file cleanup, and bounded transport-versus-data diagnostics. Run the focused Docker suites and required tier-1 probe after plugin-source changes; record results in this task's native Implementation Notes:
   - `python3 -m pytest tests/test_task_provider_migration.py::test_task_provider_migration_node_suite tests/test_project_initialization.py::test_project_initialization_node_suite tests/test_beads_retiring_source_capture.py -q -m container`
   - `scripts/test-tier1.sh --probe`
   - Before candidate review, `python3 -m pytest tests/ -q -m container` for shared-runner and lifecycle regression coverage.
   The probe alone does not run migration regressions. Inject resource failures deterministically; do not exhaust real host/container resources. Reuse current native migration fixtures to verify that retained history/events/provenance arrive losslessly in destination packages. Check existing shared-runner behavior if its interface changes. No live Ralph reads/retries/migration, private payload access, Prime Agent edits, user-global apply/check/probes, new lifecycle statuses, outgoing publication requirement, concurrency-gate repair, or automatic migration confirmation. Existing task/config/provenance preservation and explicit one-way cutover authority remain unchanged.

## Execution and review boundary

Implement only after separate operator `/implement-task PRIMECLAW-50` approval. Use disposable synthetic projects and Docker candidate validation. PRIMECLAW-49 covers native memory records independently; do not fold that work or the unrelated hard-coded lifecycle gates into this bug. Recheck the current main baseline at implementation time and preserve compatible upstream changes. Leave source authority intact on every unproven capture. Publish the candidate and task evidence through the normal Episode review flow; global activation and any real source deletion require their own existing operator authority.
<!-- SECTION:PLAN:END -->
