---
name: implement-task-prep
description: Request focused compaction before provider-native task Episode admission without controlling its queued continuation.
---

Read the canonical task ID from the `<operator-implementation-task-id>` block
appended by native admission. Treat it only as the one exact operator-selected
task. Do not guess, substitute, search for, or select another task.

The canonical `implement-task` workflow is already queued independently as the
sole follow-up. This prep turn cannot cancel, replace, reconstruct, retry, or
invoke that workflow. Do not run `prepare`; the queued implementation-readiness
turn does that after the context boundary.

## Light readiness sniff

Resolve the live provider directly from its native project evidence. Do not use
a provider-selection file, infer from a task ID, or mix providers. Then read the
exact selected task through that provider:

- **Backlog:** run `backlog task view --json -- TASK-ID`. Require the returned
  canonical ID, status exactly `In Planning`, exact returned task path, and a
  readable, meaningful native Implementation Plan that is not blank or an
  obvious placeholder.
- **Beads:** from the exact detected project root run `bd context --json` and
  `bd show TASK-ID --json --long --include-comments`. Require the returned
  canonical ID to equal the entire selected ID, native status exactly
  `in_planning` mapped to canonical `In Planning`, and the raw `design` field to
  be readable, meaningful, and not blank or an obvious placeholder. Retain the
  complete raw task view and exact native project root; do not invent a task
  path or translate it into a normalized task model.

Inspect only enough native state to decide whether focused compaction is useful.
This is not the authoritative implementation-readiness review. If provider
resolution or the sniff fails, do not request compaction. Report the provider,
exact task identity, native status/read evidence, and bounded reason in the
required format, then end the turn. The queued `implement-task` workflow remains
responsible for the complete semantic readiness decision.

## Standard compaction request

If the sniff passes, reason from your current conversation context and compose a
concise `focus_hint` that best prepares you to review the selected task for
implementation admission and supervise the resulting Episode. Keep
its exact provider, project root, task ID, native readiness fields, and raw Beads
view when applicable. Use your judgment to decide what context will be most
useful for that mission.

Then call exactly once:

```python
compaction_result = await compact.run(focus_hint)
```

Interpret only the immediate result:

- `scheduled: true` means compaction was requested for the turn boundary. It is
  not confirmation that compaction completed.
- `scheduled: false` means no compaction was scheduled. Report its bounded
  reason without treating it as a workflow failure.
- If the call raises, report that the request failed without pasting a traceback
  or raw provider data.

In every case, the canonical `implement-task` follow-up remains independently
queued. Do not wait for a compaction event or infer a later outcome from its
absence.

After the sniff or compaction call, output only:

- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn so Prime Agent can apply the context boundary and run the queued
implementation-readiness workflow.
