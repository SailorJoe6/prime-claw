# Prime Claw design decisions

This directory preserves only non-obvious decisions whose removal could repeat
an observed failure, a failed simpler design, an external API constraint, or a
safety-boundary violation.

Do not add a record for ordinary implementation choices. A record must name:

1. the affected user stories;
2. concrete observed evidence;
3. the decision and rejected simpler alternative;
4. a regression anchor; and
5. an objective revisit or removal condition.

A record is context, not product authority. User outcomes remain canonical in
[`docs/user-stories/`](../user-stories/), and current acceptance coverage is in
its [traceability matrix](../user-stories/traceability.md).

## Current records

| Record | Decision |
|---|---|
| [DD-001](DD-001-orca-template-review.md) | Use the tracked worktree item for the normal in-product Orca template comparison. |
| [DD-002](DD-002-retained-orca-episode-tab.md) | Launch an Episode through Orca's native provider and retain its visible writable tab after launcher removal. |
| [DD-003](DD-003-prime-agent-v098-plugin-boundary.md) | Support the maintained Prime Agent 0.9.8 TypeScript line; treat 0.10+ as a separate compatibility project. |
| [DD-004](DD-004-no-blind-replay-after-ambiguous-mutation.md) | Reconcile exact identities after ambiguous external mutation; never replay as a new create or assignment. |
| [DD-005](DD-005-docker-only-plugin-candidate-validation.md) | Execute and validate plugin candidates in Docker; allow scratch roots only for script-only apply/check diagnostics. |
