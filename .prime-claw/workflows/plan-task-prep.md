---
name: plan-task-prep
description: Request focused compaction before task-native Ralph planning without controlling its queued continuation.
---

Read the canonical task ID from the `<operator-plan-task-id>` block appended by
native admission. Treat it only as an operator-selected Backlog task. Do not
guess, substitute, search for, or select another task.

The canonical `plan-task` workflow is already queued independently as the sole
follow-up. This prep turn cannot cancel, replace, reconstruct, retry, or invoke
that workflow. Do not run `prepare`; the queued planning turn does that after
the context boundary.

## Light readiness sniff

Resolve the exact task through the supported structured interface:

```sh
backlog task view --json -- TASK-ID
```

Inspect only enough returned task state to decide whether focused compaction is
useful:

- the returned canonical ID matches the admitted task identity;
- status is exactly `In Design` or `In Planning`; and
- the task Description and other supported specification fields are not all
  empty or obvious placeholders.

This is not the authoritative planning-readiness review. If the lookup fails or
the sniff fails, do not request compaction. Report the bounded reason in the
required format and end the turn. The queued `plan-task` workflow remains
responsible for the complete semantic readiness decision.

## Standard compaction request

If the sniff passes, construct `focus_hint` from this fixed text, substituting
only the returned canonical task ID where indicated:

> You are about to plan the reviewed specification in exact Backlog task
> `<task-id>`. Preserve its desired outcome, operator review decisions,
> constraints, material non-goals, acceptance criteria, references,
> documentation, and exact task identity. If the operator later approves
> implementation admission, this same conversation will own and supervise the
> resulting implementation Episode to completion. Retain the
> Conversation-to-Episode authority and oversight boundaries needed for that
> upcoming role. The queued `plan-task` workflow must perform its own
> preparation and semantic readiness review on the compacted context.

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

In every case, the canonical `plan-task` follow-up remains independently
queued. Do not wait for a compaction event or infer a later outcome from its
absence.

After the sniff or compaction call, output only:

- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn so Prime Agent can apply the context boundary and run the queued planning
workflow.
