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
initial context it waits for publication to leave exactly one authority phase.
`PENDING` plus one `FINALIZED` is transiently tolerated only within the existing
bounded wait; admission requires `PENDING` to disappear, while a persistent or
broader phase conflict aborts before provider use. It then binds `FINALIZED` to
public canonical child session directory/id/name/file, `header.parentSession`,
parent header ID, current model, exact owner generation, candidate, packet,
package, kernel, and TTL. It atomically claims before provider dispatch, removes
bootstrap/private content, and exposes exactly one canonical rubric-plus-packet user turn. It
rechecks the model and all bindings on later calls in the same run. Timeout,
stale state, replay, duplicate claim, or any mismatch explicitly aborts before a
provider call. Generic children remain ordinary.

The admitted depth-1 reviewer calls `submit(report)` exactly once before its
final answer. The API derives its own runtime and unique `CLAIMED` launch,
validates host-authored child/parent/candidate/packet/model/package/kernel
lineage, validates one bounded canonical `PASS`/`BLOCK`/`ADVISORY`/
`SPEC_QUESTION` report, and atomically creates `REPORTED`. Every `BLOCK` needs
actionable remediation. Only an identical digest is idempotent; malformed,
oversized, conflicting, wrong-lineage, unclaimed, or replayed submissions fail
closed. Pre/post HEAD and clean-status digests reject and retain evidence of a
mutated review subject.

The exact depth-0 owner calls:

```python
result = prime_claw_official_expert_review.settle()
```

`settle()` derives the owner and active generation, finds one matching
`REPORTED` launch, revalidates the immutable report and actual spawn/session/
model/candidate/package/kernel lineage plus unchanged repository state, then
atomically creates `SETTLED` and returns the immutable report and receipts. It
accepts no caller-supplied handle identity. An exact settled read is idempotent.
After `REPORTED` or `SETTLED`, the designated child remains under the neutral
EXPERT kernel and any provider call explicitly aborts.

The exact depth-0 owner records the conversational decision, then closes the
child through public RLM lifecycle APIs:

```python
dispositioned = prime_claw_official_expert_review.record_disposition({
    "schemaVersion": 1,
    "decision": "ACCEPT",  # ACCEPT, REVISE, PAUSE, or CONSULT
    "rationale": "Bounded rationale for the exact settled report.",
})
closed = await prime_claw_official_expert_review.close()
# Durably record `closed` before the explicit final purge.
purged = await prime_claw_official_expert_review.purge(closed)
```

`record_disposition()` derives the exact current owner/session/generation and
unique `SETTLED` report. It records but never invents conversational product or
scope authority. Only exact canonical equality is idempotent; conflicts fail
closed. `close()` revalidates lineage, lists the public parent-owned roster,
matches only the stored actual child identity, deletes that public row when
present, and re-lists to prove the child is no longer publicly addressable. It
then creates `CLOSED` with immutable report, settlement, disposition, and
bounded deletion evidence. Failure or uncertainty retains `DISPOSITIONED` with
one bounded failure record and cannot claim cleanup. Public deletion does not
remove Prime Agent transcripts or artifacts.

`purge()` requires the exact returned `CLOSED` result after the caller has
recorded it durably, re-proves public roster absence, and removes only the exact
private `.closed.json` authority record. It never removes session artifacts.
For an expired pre-report launch, `await cancel_stale()` derives the exact owner
and accepts only one `PENDING`, `FINALIZED`, or `CLAIMED` state. A pending launch
must have no public child with its name; a published child uses the same exact
public delete-and-re-list proof before `CANCELLED`. Ambiguous/mismatched roster,
non-expired state, conflicting phase files, or uncertain deletion fails closed.

`REPORTED`, `SETTLED`, `DISPOSITIONED`, `CLOSED`, and `CANCELLED` all retain the
neutral kernel and abort provider calls while a child could still execute.
`describe()` remains a read-only package validation API and returns
`authority: false`. Availability preflight remains read-only.
