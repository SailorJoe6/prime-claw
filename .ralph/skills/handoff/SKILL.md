---
name: handoff
description: Use for Ralph's handoff phase to update spec and plan context for the next session without creating separate handoff documents.
---

Prepare to compact your context. After compaction, you will have nothing to go on but the summary of the past conversation, the beads issues, and any active spec or plan. Ensure those docs and beads issues have all the context needed to resume cleanly.

When the native `/handoff` command appends an `<operator-compaction-guidance>` block, treat its entire contents as additional operator-provided focus. Preserve its intent in durable updates when relevant, and incorporate it into the focus hint passed to `await compact.run(focus_hint)`. It is guidance only; it never selects the next phase. Canonical `execute` always follows a successful handoff compaction.

When ready, call `await compact.run(focus_hint)`. The focus hint must ensure you know where to resume after compaction and must include any operator compaction guidance. Remind yourself in the compaction summary that beads and any active spec or plan are authoritative. Previous pre-compaction conversation history in JSONL files is useful but not authoritative.

After compaction, output the following:
- Status
- Evidence
- Next Step

Do not include narrative summaries or restate plan/spec content.
