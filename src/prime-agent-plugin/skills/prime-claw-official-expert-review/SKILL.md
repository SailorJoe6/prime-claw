---
name: prime-claw-official-expert-review
description: Launch one exact official Prime Claw EXPERT child through private one-use state and public Prime Agent RLM/session interfaces.
---

# Prime Claw official EXPERT review

Use this skill only as the exact active Conversation owner after one pushed
candidate and its immutable review packet are ready. The Python package owns the
race-sensitive launch sequence. Do not call `rlm.spawn` separately and do not
send the packet through `agent_message`.

```python
packet = {
    "schemaVersion": 1,
    "kind": "prime-claw-official-expert-review-packet",
    "repositoryPath": "/canonical/episode/worktree",
    "commitOid": "<exact pushed candidate OID>",
    "specificationPath": ".ralph/plans/SPECIFICATION.md",
    "executionPlanPath": ".ralph/plans/EXECUTION_PLAN.md",
    "evidencePaths": ["docs/evidence/<candidate>.md"],
    "focus": "Review the exact approved scope and candidate.",
}
handle = await prime_claw_official_expert_review.launch(packet)
```

`launch()` validates the canonical reviewer package, derives the depth-0 owner
and active episode generation from public host-authored session state, verifies
the marker worktree and exact `HEAD`, and requires exactly one exact configured
model result. It creates one mode-private `PENDING` record, calls public
`rlm.spawn` itself with the exact selector/thinking and a harmless unpredictable
bootstrap name, then finalizes only from the actual returned name, session
directory, child id, and model. A definite failure revokes `PENDING`. There is
no model fallback and the returned handle does not prove requested reasoning.

The extension ignores all inbound message text and metadata. At the child's
initial context it binds the private `FINALIZED` record to public canonical
child session directory/id/name/file, `header.parentSession`, parent header ID,
current model, exact owner generation, candidate, packet, package, kernel, and
TTL. It atomically claims before provider dispatch, removes bootstrap/private
content, and exposes exactly one canonical rubric-plus-packet user turn. It
rechecks the model and all bindings on later calls in the same run. Timeout,
stale state, replay, duplicate claim, or any mismatch explicitly aborts before a
provider call. Generic children remain ordinary.

`describe()` remains a read-only package validation API and returns
`authority: false`. Availability preflight remains read-only. Report return and
settlement, owner PASS/BLOCK disposition, child deletion, and cleanup are not
part of this skill generation.
