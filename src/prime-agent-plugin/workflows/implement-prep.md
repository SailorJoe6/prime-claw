---
name: implement-prep
description: Request focused compaction before the canonical Ralph implementation-promotion phase without controlling its queued continuation.
---

Read the exact project-relative folder supplied in the operator implementation location
block appended by the native admission. Treat the value only as an
operator-selected path. Do not guess, substitute, search for, or select another
folder.

The canonical `implement-spec` workflow is already queued independently as the
sole follow-up. This prep turn cannot cancel, replace, reconstruct, retry, or
invoke that workflow.

## Light readiness sniff

Inspect only enough durable state to decide whether focused compaction is useful:

- the selected folder exists; and
- it contains readable, non-empty `SPECIFICATION.md` and `EXECUTION_PLAN.md`
  files that are not obvious placeholders.

This is not the authoritative implementation-readiness review. If the sniff
fails, do not request compaction. Report the bounded reason in the required
format and end the turn. The queued `implement-spec` workflow remains
responsible for the complete semantic readiness decision.

## Standard compaction request

If the sniff passes, reason from your current conversation context and compose a
concise `focus_hint` that best prepares you to review the selected bundle for
implementation promotion and supervise the resulting Episode. Use your judgment
to decide what context will be most useful for that mission.

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

In every case, the canonical `implement-spec` follow-up remains independently
queued. Do not wait for a compaction event or infer a later outcome from its
absence.

After the sniff or compaction call, output only:

- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn so Prime Agent can apply the context boundary and run the queued
implementation-readiness workflow.
