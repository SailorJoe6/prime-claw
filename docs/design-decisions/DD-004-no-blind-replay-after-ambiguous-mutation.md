# DD-004 — Never blindly replay an ambiguous external mutation

- **Status:** accepted
- **Stories:** [US-14–US-16](../user-stories/E-episode-promotion.md), [US-23](../user-stories/H-handoff-and-continuation.md), [US-24](../user-stories/I-episode-finalization.md)

## Observed context

Orca worktree create/remove has no documented idempotency key. Prime Agent
prompt admission can succeed while its response is lost. Terminal routes can
change across restarts while durable sessions remain. Reissuing a create or
assignment after an ambiguous response can therefore duplicate a worktree,
session, or execute turn.

Evidence: version-matched Prime Agent prompt behavior and installed Orca notes
in [`2026-10-09-orca-prime-agent-integration-probes.md`](../evidence/2026-10-09-orca-prime-agent-integration-probes.md), especially the lost-response and
worktree-idempotency findings; probe matrix F1.

## Decision

Persist intent and exact identities before or immediately after each durable
boundary. After timeout, disconnect, or lost response, reconcile the recorded
worktree/path/identity, automation/run/request, durable session/file, and
current route. Preserve `uncertain` when uniqueness cannot be proved. Never
reissue the operation as a new create or new assignment. Direct local fallback
is allowed only after definitive pre-mutation local Orca unavailability.

## Rejected simpler alternative

“Retry once” is not harmless when the remote side may have committed the first
request. Transport failure is not proof of non-mutation.

## Regression anchors

- `tests/spec_episode_extension.test.mjs` (uncertain creation/replay and route refresh)
- `tests/episode_close_extension.test.mjs`
- `tests/reviewed_plan_extension.test.mjs`
- the retained F1 and startup/recovery probes above

## Revisit condition

A specific operation may simplify only when its upstream API provides and Prime
Claw verifies a durable idempotency key or an atomic read-after-write result
that proves replay cannot duplicate the effect. Do not remove uncertainty from
other operations by analogy.
