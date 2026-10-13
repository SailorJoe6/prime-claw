---
name: prime-claw-oversee-episode
description: Supervise one exact owned Prime Claw episode through evidence-based, operator-bounded decisions.
---

# Oversee one owned episode

Use this guidance only when the one durable Prime Claw ownership record says
this Conversation owns one active Episode.

## Select the durable authority

Keep the authority mode in the ownership record. Never mix modes or copy content
between them.

- For version 2 task-native ownership, bind supervision to the exact Backlog
  task ID and project-relative task path. Reload that task through the supported
  structured interface in the canonical main checkout and the Episode
  worktree. The task Description, Acceptance Criteria, constraints, references,
  documentation, Implementation Plan, Implementation Notes, modified files,
  and Final Summary are the sole durable product and execution contract. Never
  consult `.ralph/plans` in this mode. The Episode owns task content on its
  branch; the Conversation owns lifecycle status on main.
- For retained version 1 folder ownership, keep the approved specification and
  execution plan as the scope boundary. Do not substitute a Backlog task for
  that exact folder authority.

Review one reported vertical slice at a time. Reconcile the report against the
exact ownership identity, branch, candidate commit and tree, diff, tests,
documentation, push state, and worktree state. In task-native mode also verify
the exact task ID, path, parent identity, branch content, acceptance evidence,
and meaningful plan, notes, and summary. An Episode report is evidence, not
approval.

Choose exactly one disposition:

- **Accept and advance** when the candidate is within approved scope, evidence is
  sufficient, required checks pass, and the next bounded slice is already
  approved.
- **Request an in-scope revision** when a concrete defect violates the approved
  contract. Record the acceptance decision and evidence in Conversation context
  before continuation. In task-native mode, send the accepted bounded finding
  through the exact task handoff; do not edit, copy, or mirror Episode-owned
  task content from the Conversation checkout.
- **Pause** when work should stop without a product decision.
- **Consult the operator** for scope, product, merge, abandonment, destructive
  cleanup, conflicting evidence, or an unresolved blocker.

Never implement the Episode's work or steer it through ordinary chat. For an
accepted advance or revision, use only the canonical handoff for the exact
owned idle Episode and its current authority mode. Admission is not completion;
inspect the next report before deciding again. Do not retry uncertain transport.

When project policy requires independent review or a concrete material risk
warrants it, load and follow the managed `prime-claw-expert-review` skill. Treat
every review conclusion as evidence, not product, merge, or owner authority. A
finding may block only when it demonstrates a concrete material defect against
the operator-approved product contract. Speculative hardening, theoretical edge
cases, alternative architecture, and reviewer-invented invariants are
non-blocking and must not become scope without operator approval.

If review starts generating new requirements or hardening, stop that review loop
and consult the operator. Do not request or implement another repair merely to
satisfy adversarial review. If the required Expert workflow is unavailable or
uncertain, consult the operator rather than substituting an informal reviewer.

Maintain a bounded goal during substantive oversight. Create one exact heartbeat
only while waiting for observable Episode or Expert work, remove it when the
wait ends, and create no heartbeat while waiting for the operator.

The operator alone decides scope, product direction, merge, abandonment, and
destructive cleanup. Final bookkeeping follows verified terminal work; it never
supplies terminal authority.
