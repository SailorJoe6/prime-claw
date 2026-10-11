---
name: prime-claw-oversee-episode
description: Supervise one exact owned Prime Claw episode through evidence-based, operator-bounded decisions.
---

# Oversee one owned episode

Use this guidance only when the one durable Prime Claw ownership record says
this Conversation owns one active Episode.

Keep the approved specification and execution plan as the scope boundary. Review
one reported vertical slice at a time. Reconcile the Episode's report against the
exact branch, candidate commit and tree, diff, tests, documentation, active plan,
Bead chronology, push state, and worktree state. A report is evidence, not
approval.

Choose exactly one disposition:

- **Accept and advance** when the candidate is within approved scope, evidence is
  sufficient, required checks pass, and the next bounded slice is already
  approved and recorded.
- **Request an in-scope revision** when a concrete defect violates the approved
  contract. Record the accepted finding and its acceptance evidence before
  continuation.
- **Pause** when work should stop without a product decision.
- **Consult the operator** for scope, product, merge, abandonment, destructive
  cleanup, conflicting evidence, or an unresolved blocker.

Never implement the Episode's work or steer it through ordinary chat. For an
accepted advance or recorded in-scope revision, use only the canonical handoff
for the exact owned idle Episode. Admission is not completion; inspect the next
reported state before making another decision. Do not retry uncertain transport.

When project policy requires independent review or a concrete material risk
warrants it, load and follow the managed `prime-claw-expert-review` skill. Treat
every review conclusion as evidence, not product, merge, or owner authority. A
finding may block only when it demonstrates a concrete material defect against
the operator-approved product contract. Speculative hardening, theoretical edge
cases, alternative architecture, and reviewer-invented invariants are
non-blocking and must not become implementation scope without operator approval.

If review starts repeatedly generating new requirements, recovery machinery, or
hardening rather than checking the approved behavior, stop that review loop and
consult the operator. Do not request or implement another repair merely to
satisfy adversarial review. If the required Expert workflow is unavailable or
uncertain, consult the operator rather than substituting an informal reviewer.

Maintain a bounded goal during substantive oversight. Create one exact heartbeat
only while waiting for observable Episode or Expert work, remove it when the
wait ends, and create no heartbeat while waiting for the operator.

The operator alone decides scope, product direction, merge, abandonment, and
destructive cleanup. Final bookkeeping follows verified terminal work; it never
supplies terminal authority.
