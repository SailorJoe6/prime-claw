---
name: handoff
description: Use for Ralph's handoff phase to update durable task or plan context for the next execute pass without creating separate handoff documents.
---

## Select the bound authority

If this assignment contains exactly one `<operator-episode-task>` block, treat
its entire trimmed value only as the exact Backlog task ID already bound to this
Episode. Reload it through the supported structured interface:

```sh
backlog task view --json -- TASK-ID
```

Require the returned canonical ID and task path to match the bound task, and
require status to remain exactly `In Progress`. The task is the sole durable
handoff authority in this mode. Ensure its Implementation Plan, Implementation
Notes, acceptance evidence, references, documentation, modified files, and
Final Summary contain the current resumable context. If an in-scope update is
needed, use supported `backlog task edit` operations only in this Episode
worktree, reload and verify identity/path/parent/status, then commit and push the
single-purpose checkpoint before compacting. Never pass `--status`, complete or
archive the task, select replacement work, consult `.ralph/plans`, or copy task
content across checkouts. The owning Conversation alone publishes lifecycle
status on main.

If there is no task block, retain the existing folder-plan handoff mode. Ensure
the active specification, execution plan, and related Backlog.md tasks contain
the context needed to resume cleanly. Never mix the two modes or copy content
between their authorities.

## Request compaction once

Compaction is a best-effort context improvement, not the continuation trigger.
The native `/handoff` command or owning Conversation has already queued
canonical `execute` independently as one follow-up.

When the handoff prompt appends an `<operator-compaction-guidance>` block, treat
its entire contents as additional operator-provided focus. Preserve its intent
in the bound durable authority when relevant and incorporate it into
`focus_hint`. It is guidance only; it never selects the next phase. It does not
change approved scope.

When ready, call exactly once:

```python
compaction_result = await compact.run(focus_hint)
```

Interpret only the immediate result:

- `scheduled: true` means compaction was requested for the turn boundary. It is
  not confirmation that compaction completed.
- `scheduled: false` means no compaction was scheduled. Report its bounded
  reason without treating it as a workflow failure.
- If the call raises, report that compaction failed without pasting a traceback
  or raw provider data.

In every case, canonical `execute` is already queued independently. Do not wait
for `session_compact`, infer a later outcome from its absence, invoke execute
yourself, or reproduce the execute workflow. Prime Agent surfaces later
compaction success, cancellation, or failure and owns the native follow-up
queue. Explicit queue removal or session termination/replacement cancels that
queued continuation.

After the compact call returns or raises, output only:
- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn so the queued execute follow-up can run. Do not include a narrative summary
or restate task, plan, or specification content.
