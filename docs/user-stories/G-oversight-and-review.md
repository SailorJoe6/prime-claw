# G. Supervise and review implementation

## US-19 — Let the owning Conversation supervise without implementing

**As an owning Conversation, I want to verify an Episode's evidence and choose
its next disposition without writing the implementation myself.**

The Conversation first selects the authority mode from exact ownership. A
version-2 Episode is reviewed only against its exact Backlog task ID/path and
supported task fields; `.ralph/plans` is not consulted and the Conversation does
not copy or mirror Episode-owned task content. A retained version-1 Episode
continues to use its exact active specification/plan pair through blockers,
candidate review, and bounded revision; it is not archived while ownership is
active. In either mode the
Conversation reconciles the report against ownership, branch, tree, diff, tests,
documentation, push state, and worktree identity. It may accept and advance,
request an in-scope revision, pause, or consult the operator. Repeated
speculative or adversarial review must stop rather than grow new requirements or
implementation machinery.

When a task-native candidate is accepted with no fixes remaining, the Conversation revalidates the exact ownership, task ID/path, idle clean Episode worktree, pushed branch/head, diff, tests, and review. Delay is a no-op. Request Changes requires an explicit operator decision and a concrete in-scope finding; the same Episode continues through `handoff_task_episode`. If main advanced, the Episode first uses ordinary Git to integrate it and pushes a new review candidate.

Immediately before requesting or applying Merge, the Conversation preflights an explicit `(taskId, mainHead, candidateHead)` tuple. Canonical primary `main` must have no staged or tracked changes, must be free of an in-progress Git operation, and must equal upstream. The candidate branch, worktree `HEAD`, and upstream must all equal the reviewed head, and that head must descend current main. The exact task remains `In Progress` at the bound path. These checks are readable prompt policy, not a custom transaction or receipt.

If the operator explicitly authorizes that tuple, the Conversation runs ordinary `git merge --ff-only candidateHead`; Git reports drift or unsafe ancestry. It then changes the exact task to `Done` through the supported Backlog CLI, verifies that only its path changed, commits exactly that path, pushes, and rechecks main/upstream, ancestry, task identity/path/parent/status, and cleanliness. A failed push is resumed as ordinary transport work, without replaying merge or task mutation. Ownership and resources remain active.

If the operator explicitly confirms abandonment, the Conversation works from clean pushed canonical main, selects only the bound task from the exact pushed Episode head, uses Backlog to preserve the non-`Done` status and record a truthful Final Summary, archives the task, and verifies that the effective diff is only the exact active/archive move. No Episode code enters main. It commits and pushes with ordinary Git. Ownership and resources remain active.

Cleanup is independently explicit. The cleanup-only `finalize_task_episode` call binds the exact task, owner, terminal Episode head, and truthful merged/abandoned outcome; verifies pushed terminal main plus clean idle bound resources; removes only runtime, worktree, and branch; verifies absence; and closes ownership last. It performs no review, status change, merge, abandonment, archive, or push. The durable cleanup head makes same-argument retry idempotent without caller-held receipts.

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
