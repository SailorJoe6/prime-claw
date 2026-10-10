# G. Supervise and review implementation

## US-19 — Let the owning Conversation supervise without implementing

**As an owning Conversation, I want to verify an Episode's evidence and choose
its next disposition without writing the implementation myself.**

The Conversation reconciles the Episode report against branch, tree, diff,
tests, documentation, plan, Beads, push state, and worktree identity. It may
accept and advance, request a recorded in-scope revision, pause, or consult the
operator. Two unsuccessful repair cycles trigger reassessment rather than
unbounded patching.

Product, scope, merge, abandonment, remote transport, and destructive cleanup
remain operator decisions.

## US-20 — Obtain an independent expert review

**As an operator or supervising Conversation, I want an independent read-only
review of an exact candidate, so that implementation claims receive
evidence-based challenge without granting the reviewer product authority.**

The EXPERT reviews an exact candidate against its approved contract, reports
concrete reproducible findings, answers bounded clarification, identifies its
model, and is cleaned up afterward. Its report is evidence, not authority.

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
