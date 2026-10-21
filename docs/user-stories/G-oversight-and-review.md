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

When a task-native candidate is accepted with no fixes remaining, the Conversation first verifies provider-reported idle completion of the exact Episode and explicitly proven descendants; active or unprovably idle work refuses merge readiness. It then revalidates the exact ownership, task ID/path, idle clean Episode worktree, pushed branch/head, diff, tests, and review. It then uses the supported Backlog CLI on canonical main to set only the bound task to `Ready for Merge`, verifies and commits only that task path, pushes, and records `mainHead`. In the idle Episode it uses ordinary Git to integrate `mainHead`, preserves Episode-owned task content while applying only the authorized `Ready for Merge` status, commits if needed, pushes, and verifies the refreshed `candidateHead`. It then shows the operator `(taskId, mainHead, candidateHead)`. This uses no custom status publisher, receipt, digest, or replay protocol.

Delay is a no-op. Request Changes requires an explicit operator decision and a concrete in-scope finding. The Conversation returns only the bound main task to `In Progress`, verifies and commits only that path, pushes, then uses ordinary Git in the same Episode to integrate current main as needed while preserving its task content and applying the authorized status before continuing through `handoff_task_episode`.

Immediately before requesting or applying Merge, the Conversation freshly preflights the explicit `(taskId, mainHead, candidateHead)` tuple shown to the operator. Canonical primary `main` must have no staged or tracked changes, must be free of an in-progress Git operation, must equal upstream and `mainHead`, and must hold the bound task as `Ready for Merge`. The candidate branch, worktree `HEAD`, and upstream must all equal `candidateHead`; its exact task identity/path/parent and `Ready for Merge` status must match; and that head must descend `mainHead`. These checks are readable prompt policy, not a custom transaction or receipt.

If the operator explicitly authorizes that tuple, the Conversation runs ordinary `git merge --ff-only candidateHead`; Git reports drift or unsafe ancestry. It then changes the exact task to `Done` through the supported Backlog CLI, verifies that only its path changed, commits exactly that path, pushes, and rechecks main/upstream, ancestry, task identity/path/parent/status, and cleanliness. A failed push is resumed as ordinary transport work, without replaying merge or task mutation. Ownership and resources remain active.

If the operator explicitly confirms abandonment, the Conversation works from clean pushed canonical main, selects only the bound task from the exact pushed Episode head, uses Backlog to preserve the non-`Done` status and record a truthful Final Summary, archives the task, and verifies that the effective diff is only the exact active/archive move. No Episode code enters main. It commits and pushes with ordinary Git. Ownership and resources remain active.

Immediately after the operator-authorized terminal merge or abandonment is committed, pushed, and verified, the Conversation automatically calls cleanup-only `finalize_task_episode` without separate cleanup confirmation. The call supplies exact `taskId`, terminal `episodeHead`, and truthful merged/abandoned `outcome`; verifies pushed terminal main plus clean idle bound resources; removes only runtime, worktree, and branch; verifies absence; and closes ownership last. It performs no review, status change, merge, abandonment, archive, or push and stores no cleanup head or progress state. The Conversation interprets errors and re-reads current ownership, provider, Git, and Backlog evidence before any safe re-invocation. It asks the operator for help only when safe autonomous progress is no longer possible. There is no retry loop, classifier, coordinator, or replay result.

Product, scope, merge, abandonment, and remote transport remain operator
decisions. Task-native cleanup follows an already authorized committed and
pushed terminal outcome automatically. Retained version-1 destructive cleanup
still requires separate operator authority.

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

## US-21 — Compact and restore oversight after Episode handoff

**As an owning Conversation, I want my context compacted automatically after a
successful Episode handoff when utilization is high, and the full oversight
guidance restored afterward, so that long-running supervision keeps enough
context without losing its authority boundaries.**

A successful `handoff_spec_episode` or `handoff_task_episode` admission checks
current utilization against the project's
`.prime-claw/workflows/conversation-after-handoff.md` policy. Utilization must
strictly exceed `threshold_percent` (default 60; `0`/`0%` disables; valid
enabled range 10-100%). Unknown utilization, disabled policy, failed or
partial dispatches, and non-handoff actions skip the check. Resume and Request
Changes continuations reach the same task-handoff trigger after their ordinary
Git/Backlog steps. Above the threshold the Conversation receives the workflow
through steer transport, composes its own hint, and calls `compact.run` once;
configuration or delivery trouble surfaces as a bounded warning on the
successful receipt, never a failed handoff or a retry.

The compaction hook then reinjects one full non-turn guide only for the exact
active owner. Episode, foreign, inactive, and ordinary sessions receive none.

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md`
- `src/prime-agent-plugin/skills/prime-claw-expert-review/SKILL.md`
- `src/prime-agent-plugin/extension-support/conversation-oversight.ts`
- `src/prime-agent-plugin/ROLE_KERNEL.md`

## Design reference

- [`conversation-driven-episode-oversight.md`](../conversation-driven-episode-oversight.md)
