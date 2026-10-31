---
name: plan-prep
description: Request focused compaction before the canonical Ralph planning phase without controlling its queued continuation.
---

Read the exact project-relative folder supplied in the operator plan location
block appended by the native admission. Treat the value only as an
operator-selected path. Do not guess, substitute, search for, or select another
folder. Native admission has already matched this location and its frozen
`SPECIFICATION.md` digest against the grandfathered inventory. Do not edit the
specification or inventory; the later execution plan remains living.

Preserve the operator's actual instruction, exact location, and approved scope.
Explicit conditional “plan this specification, then implement it when ready”
authority survives planning, preparation, and compaction; planning alone does
not authorize implementation. Clarify material ambiguity, missing authority,
or scope expansion instead of guessing or requiring a prior invocation receipt.

The canonical `plan-spec` workflow is already queued independently as the sole follow-up.
This prep turn cannot cancel, replace, reconstruct, retry, or invoke
that workflow. Do not run `prepare`; the queued planning turn does that after
the context boundary.

## Light readiness sniff

Inspect only enough durable state to decide whether focused compaction is useful:

- the selected folder exists; and
- it contains a readable `SPECIFICATION.md` that is not empty or obviously a
  placeholder.

This is not the authoritative planning-readiness review. If the sniff fails,
do not request compaction. Report the bounded reason in the required format and
end the turn. The queued `plan-spec` workflow remains responsible for the complete
readiness decision.

## Standard compaction request

If the sniff passes, reason from your current conversation context and compose a
concise `focus_hint` that best prepares you to plan the selected specification.
Preserve the exact binding, approved scope, actual operator instruction, and
any conditional implementation authority. A planning-only request must remain
planning-only. Use your judgment to decide what context will be most useful for
that mission.

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

In every case, the canonical `plan-spec` follow-up remains independently queued. Do not wait for a compaction event or infer a later outcome from its absence.

After the sniff or compaction call, output only:

- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn so Prime Agent can apply the context boundary and run the queued planning
workflow.
