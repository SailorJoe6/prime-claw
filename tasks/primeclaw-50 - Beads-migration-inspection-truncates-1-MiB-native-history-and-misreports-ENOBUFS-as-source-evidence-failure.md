---
id: PRIMECLAW-50
title: >-
  Beads migration inspection truncates >1 MiB native history and misreports
  ENOBUFS as source evidence failure
status: In Design
assignee: []
created_date: '2026-10-31 14:47'
updated_date: '2026-10-31 17:42'
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
