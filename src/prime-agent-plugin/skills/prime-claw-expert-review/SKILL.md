---
name: prime-claw-expert-review
description: Run an independent, read-only Prime Claw review of an exact candidate using native Prime Agent RLM and messaging. Use for direct expert-review requests and when Conversation oversight calls for independent review.
---

# Prime Claw EXPERT review

Run one bounded independent review with Prime Agent's native child-session and
messaging APIs. This is a skill-based review role, not special runtime authority.
The review is evidence for the caller. It does not decide product scope, merge,
abandonment, or cleanup.

## Resolve the request

Accept a normal review request. Resolve these values from clear conversation and
repository context, while honoring explicit caller overrides:

- repository and exact commit;
- applicable specification, execution plan, acceptance contracts, and evidence;
- requested review focus and explicit non-goals; and
- optional model selection.

A managed EPISODE report is one common input, not an admission requirement. Do
not require active-episode ownership, a particular worktree or branch, push
state, a fixed packet object, or repository snapshot hashes. If information
needed for a bounded review is unclear, ask the caller instead of guessing.

## Select and start the reviewer

Use `await rlm.find_models(...)` to resolve an operator-selected model. Without
an override, look for the exact selector `openai-codex/gpt-6-astra`. If it is
unavailable, select a reasonably strong available review model and tell the
caller which model will be used. Consult the operator only if no suitable model
is available.

Request `thinking="max"`. If the selected fallback model does not support that
setting, use its strongest supported reasoning level. Use an ordinary unique
child name that is useful in the native RLM roster; the name grants no authority.

Prime Agent can lose a substantive initial RLM task when automatic preparation
wins the child-start race. Always spawn with a harmless bootstrap and then send
the real task exactly once:

```python
handle = await rlm.spawn(
    "Bootstrap only. Wait for the review task from your parent.",
    name="expert-review-<short-unique-name>",
    model=selected_model,
    thinking="max",
)
await agent_message.send(
    message=review_task,
    receiver_role="child",
    receiver_name=handle.name,
)
```

A returned handle proves publication, not task admission. Do not resend a task
that was delivered merely because the disposable bootstrap later reports a
failure.

## Send a self-contained review task

The one ordinary parent-to-child task must state the resolved repository,
commit, relevant artifact paths or contents, evidence, and focus. It must also
include this review contract:

- Act as the independent EXPERT reviewer. Review read-only and do not edit,
  implement, steer the candidate, mutate lifecycle state, or perform cleanup.
- Review the exact candidate against the approved specification, execution
  plan, acceptance contracts, threat model, trusted assumptions, ordinary
  failure model, explicit non-goals, and complexity budget. Do not expand scope.
- Report only concrete, reproducible, in-contract problems with realistic
  impact. Distinguish implementation defects from optional hardening,
  out-of-model cases, and product questions in ordinary language.
- A clean conclusion does not require eliminating every imaginable edge case.
  Adversarial red-team review requires explicit operator authorization and
  cannot redefine the baseline contract.
- For each material finding, explain the evidence, realistic impact, violated
  requirement or assumption, and a proportionate general repair direction.
  Give enough direction that the implementer need not repeat the investigation,
  but do not provide code or prescribe unnecessary implementation detail.
- Include relevant regression or test considerations. Prefer deletion,
  topology simplification, ordinary failure handling, and evidence-preserving
  manual recovery over bespoke transaction or recovery machinery.
- Return ordinary prose: a short conclusion followed by material findings. Do
  not use a required verdict vocabulary, JSON schema, exact field names, or
  empty sections.
- Send the completed review to the parent with
  `await agent_message.send(message=review, receiver_role="parent")`. If
  necessary context is unclear, ask the parent through the same ordinary
  messaging channel before concluding.

## Observe, clarify, and clean up

Use `agent_observe` or `await rlm.collect(..., timeout_ms=0)` to inspect the
child without inventing a settlement protocol. Answer bounded clarification
questions through `agent_message.send`; do not silently widen the approved
scope. Report the actual model from the returned handle alongside the review.

After the review and any requested clarification are complete, delete the child
with `await rlm.delete_subagent(handle)`. Normal Prime Agent transcripts and
artifacts remain subject to its ordinary lifecycle. Do not create settlement,
disposition, close, purge, receipt, private phase, or repository-unchanged
records.
