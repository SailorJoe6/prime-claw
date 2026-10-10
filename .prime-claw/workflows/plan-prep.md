---
name: plan-prep
description: Request focused compaction before the canonical Ralph planning phase without controlling its queued continuation.
---

Read the exact project-relative folder supplied in the operator plan location
block appended by the native admission. Treat the value only as an
operator-selected path. Do not guess, substitute, search for, or select another
folder.

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

If the sniff passes, construct `focus_hint` from this fixed text, substituting
only the exact selected folder where indicated:

> You are about to plan the reviewed specification in the exact
> operator-selected future folder `<selected-folder>`. Preserve its desired
> outcome, operator review decisions, constraints, material non-goals, durable artifact and bead references,
> and exact folder location. If the operator later approves implementation
> promotion, this same conversation will own and supervise the resulting
> implementation episode to completion. Retain the conversation-to-episode
> authority and oversight boundaries needed for that upcoming role. The queued
> `plan` workflow must perform its own preparation and semantic readiness review
> on the compacted context.

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

In every case, the canonical `plan` follow-up remains independently queued. Do not wait for a compaction event or infer a later outcome from its absence.

After the sniff or compaction call, output only:

- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn so Prime Agent can apply the context boundary and run the queued planning
workflow.
