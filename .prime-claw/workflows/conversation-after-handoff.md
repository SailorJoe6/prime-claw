---
name: conversation-after-handoff
description: Use after a successful canonical Episode handoff dispatch to compact the owning Conversation's context when utilization strictly exceeds the configured threshold.
threshold_percent: 60
---

## Compact this Conversation before ending the turn

A canonical Episode handoff through `handoff_spec_episode` or
`handoff_task_episode` was just admitted successfully from this Conversation.
That admission is final for this pass: nothing in this workflow reverses it,
repeats it, or dispatches the Episode again.

Compose `focus_hint` yourself from your current context. Keep what you need to
supervise the exact owned Episode to completion: its task or source identity,
the owning owner-session key, episode identifiers, the current supervision
state, pending operator decisions, and where evidence lives. Judge what your
context requires; no fixed hint text or preservation inventory is mandated.

Then call exactly once:

```python
compaction_result = await compact.run(focus_hint)
```

Interpret only the immediate request result:

- `scheduled: true` means compaction was requested for the turn boundary. It is
  not confirmation that compaction completed.
- `scheduled: false` means no compaction was scheduled. Report its bounded
  reason and continue without an automatic retry.
- If the call raises, report that the compaction request failed with a bounded
  reason. Do not paste a traceback or raw provider data.

In every case, end the turn after reporting. Normal heartbeat-driven
supervision of the same owned Episode continues; the existing post-compaction
handler re-primes this Conversation with the exact Episode identity if
compaction runs. Do not wait for compaction events, do not run an Episode
phase, and do not pause supervision for operator input.

## Configuration

`threshold_percent` in this file's frontmatter sets the trigger threshold.
The plugin injects this prompt only when current context utilization strictly
exceeds it. The key may be omitted (default 60), set to 0 or 0% to disable this
automatic compaction, or set within 10-100% inclusive. Ratio forms such as .6
and bare numbers above 1 such as 60 are equivalent to 60%. Invalid values
disable this attempt with a bounded warning; they never fail a handoff.
