# G. Supervise and review implementation

## US-19 — Let the owning Conversation supervise without implementing

**As an owning Conversation, I want to verify an Episode's evidence and choose
its next disposition without writing the implementation myself.**

The Conversation first selects the authority mode from exact ownership. A
version-2 Episode is reviewed only against its exact Backlog task ID/path and
supported task fields; `.ralph/plans` is not consulted and the Conversation does
not copy or mirror Episode-owned task content. A retained version-1 Episode
continues to use its exact specification/plan folder. In either mode the
Conversation reconciles the report against ownership, branch, tree, diff, tests,
documentation, push state, and worktree identity. It may accept and advance,
request an in-scope revision, pause, or consult the operator. Repeated
speculative or adversarial review must stop rather than grow new requirements or
implementation machinery.

When a task-native candidate is accepted with no fixes remaining, the
Conversation does not ask for merge authority from that stale candidate. The
inactive review handshake first commits only the exact main task as `Ready for
Merge`, then integrates current main in the same idle owned Episode worktree.
It restores the accepted Episode task, reapplies only the Conversation-owned
status through Backlog, preserves task content and parent identity, creates and
pushes one exact two-parent refreshed candidate, and verifies that candidate is
still based on current main. Only a successful verification permits an operator
merge request. Ordinary handoff is not used at this status.

Product, scope, merge, abandonment, remote transport, and destructive cleanup
remain operator decisions.

## US-20 — Obtain an independent expert review

**As an operator or supervising Conversation, I want an independent read-only
review of an exact candidate, so that implementation claims receive
evidence-based challenge without granting the reviewer product authority.**

The EXPERT reviews an exact candidate against its approved contract. A
task-native review binds the exact task ID/path at the candidate commit and uses
only supported task fields as its contract; a retained-folder review keeps the
exact approved specification and plan. The EXPERT reports concrete reproducible
material defects, answers bounded clarification, identifies its model, and is
cleaned up afterward. Normal review is not adversarial red
teaming unless the operator explicitly requests it. Speculative hardening and
reviewer-invented requirements are non-blocking. Its report is evidence, not
authority.

## US-21 — Restore oversight after compaction

**As an owning Conversation, I want the full oversight guidance restored after
compaction, so that long-running supervision does not lose its authority
boundaries.**

The compaction hook reinjects one full non-turn guide only for the exact active
owner. Episode, foreign, inactive, and ordinary sessions receive none.

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md`
- `src/prime-agent-plugin/skills/prime-claw-expert-review/SKILL.md`
- `src/prime-agent-plugin/extension-support/conversation-oversight.ts`
- `src/prime-agent-plugin/ROLE_KERNEL.md`

## Design reference

- [`conversation-driven-episode-oversight.md`](../conversation-driven-episode-oversight.md)
