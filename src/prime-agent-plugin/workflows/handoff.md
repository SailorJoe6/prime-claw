---
name: handoff
description: Use for Ralph's handoff phase to update spec and plan context for the next session without creating separate handoff documents.
---

Prepare durable context for the next execute pass. Compaction is a best-effort context improvement, not the continuation trigger. The native `/handoff` command has already queued canonical `execute` independently as one follow-up.

Before requesting compaction, ensure the active spec, plan, and related beads contain the context needed to resume cleanly. When the native command appends an `<operator-compaction-guidance>` block, treat its entire contents as additional operator-provided focus. Preserve its intent in durable updates when relevant and incorporate it into `focus_hint`. It is guidance only; it never selects the next phase.

When ready, call exactly once:

```python
compaction_result = await compact.run(focus_hint)
```

Interpret only the immediate result:

- `scheduled: true` means compaction was requested for the turn boundary. It is not confirmation that compaction completed.
- `scheduled: false` means no compaction was scheduled. Report its bounded reason without treating it as a workflow failure.
- If the call raises, report that compaction failed without pasting a traceback or raw provider data.

In every case, canonical `execute` is already queued independently. Do not wait for `session_compact`, infer a later outcome from its absence, invoke execute yourself, or reproduce the execute workflow. Prime Agent surfaces later compaction success, cancellation, or failure and owns the native follow-up queue. Explicit queue removal or session termination/replacement cancels that queued continuation.

After the compact call returns or raises, output only:
- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the turn so the queued execute follow-up can run. Do not include a narrative summary or restate plan/spec content.
