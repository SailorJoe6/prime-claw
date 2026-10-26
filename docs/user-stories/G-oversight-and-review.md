# G. Supervise and review implementation

## US-19 — Let the owning Conversation supervise without implementing

**As an owning Conversation, I want to verify an Episode's evidence and choose
its next disposition without writing the implementation myself.**

The Conversation first selects the authority mode and provider from the exact
owner record. Provider-absent/Backlog version 2 is reviewed against its exact
task ID/path and supported fields. Beads version 2 has no task path and is
reviewed against its exact persisted/current raw task, provider revision and
publication ref, code base/head, and Episode/worktree/session identity.
Unrelated-task revision descendants alone do not block. Compatible same-task
clarifications and living plans require LLM judgment over exact before/current
fields; genuine semantic, authority, scope, and product conflicts are escalated.
Neither branch consults `.ralph/plans`, normalizes the native task, or copies
Episode-owned content. A retained version-1 Episode continues to use its exact
active specification/plan pair through blockers, candidate review, and bounded
revision; it is not archived while ownership is active. In every mode the
Conversation reconciles the report against ownership, branch, tree, diff, tests,
documentation, push state, and worktree identity. It may accept review evidence,
request an in-scope revision, pause, or consult the operator. Repeated
speculative or adversarial review must stop rather than grow new requirements or
implementation machinery.

When an exact task-native candidate is accepted with no fixes remaining, the Conversation revalidates ownership, provider-native task state, idle clean pushed Episode code, diff, tests, and review. Provider-absent/Backlog uses its exact main task-only `Ready for Merge` commit and ordinary same-Episode integration. Beads has no task-file or status commit: `mainHead` is the current clean pushed canonical code head. The Conversation ordinarily integrates it into the idle Episode when needed, pushes and proves exact descendant `candidateHead`, then freshly proves current native `in_progress`, meaningful design, clean revision/ref, and exact owner/resources before one guarded `--if-status in_progress` status-plus-note publication to `ready_for_merge`. One non-force push and exact local/remote raw status, note, revision, ref, content, and cleanliness proof follow. Both branches show `(taskId, mainHead, candidateHead)`; factual Beads evidence is not another approval field or immutable equality gate.

Delay is a no-op. Request Changes requires an explicit operator decision and a concrete accepted in-scope finding. Backlog publishes its exact main task-only `In Progress` commit and ordinarily refreshes the same Episode when needed by restoring pre-merge Episode task content, applying only the authorized status, letting Git block every other conflict, and pushing the refreshed candidate. Beads freshly proves current `ready_for_merge`, publishes one guarded `--if-status ready_for_merge` update to `in_progress` with truthful finding evidence, pushes once without force, and proves exact native state. Both then continue only through `handoff_task_episode` for the same resources.

Immediately before Merge, the Conversation freshly preflights the operator-authorized exact `(taskId, mainHead, candidateHead)`: canonical main is clean, operation-free, and equals upstream/direct remote/`mainHead`; the idle Episode is clean and branch/local/upstream/direct-remote heads equal `candidateHead`; and `mainHead` is its ancestor. Backlog must hold the exact task at `Ready for Merge` in both checkouts. Beads must freshly prove exact native `ready_for_merge`, meaningful design, stable clean publication revision/ref, and unchanged owner/resources. These are prompt-led facts, not a custom transaction or receipt.

After explicit tuple authority, ordinary `git merge --ff-only candidateHead` runs on canonical main and the code is normally pushed and directly proved before terminal task mutation. Backlog then publishes its exact task-only `Done` commit. Beads instead publishes one guarded `--if-status ready_for_merge` update to `done` with a truthful final note naming the tuple and proven code publication, one non-force push, and exact local/remote raw status/note/revision/ref/content/clean proof. A failure preserves exact state and never authorizes merge replay, lifecycle retry, reset, or force. Ownership and resources remain active.

For provider-absent/Backlog only, if the operator explicitly confirms abandonment, the Conversation works from clean pushed canonical main, selects only the bound task from the exact pushed Episode head, uses Backlog to preserve the non-`Done` status and record a truthful Final Summary, archives the task, and verifies that the effective diff is only the exact active/archive move. No Episode code enters main. It commits and pushes with ordinary Git. Ownership and resources remain active.

Provider-absent/Backlog cleanup is independently explicit. The cleanup-only `finalize_task_episode` call binds the exact task, owner, terminal Episode head, and truthful merged/abandoned outcome; verifies pushed terminal main plus clean idle bound resources; removes only runtime, worktree, and branch; verifies absence; and closes ownership last. It performs no review, status change, merge, abandonment, archive, or push. The durable cleanup head makes same-argument retry idempotent without caller-held receipts.

Beads review conclusions remain evidence, not lifecycle approval. Handoff synchronizes and records factual observations for the existing Episode LLM without a raw-equality gate. The exact owning canonical-primary Conversation alone publishes the guarded Blocked/Resume, `ready_for_merge`, Request Changes back to `in_progress`, and post-code-publication `done` transitions described above. Every mutation uses current native status, one guarded status-plus-note update, one non-force publication, and exact raw task/revision/ref/clean proof. Foreign authority, later unexpected state, or uncertain transport stops without retry. Beads abandonment, finalization, and cleanup remain inactive. No route writes ownership directly, uses Backlog-only commands for Beads, or creates replacement work/resources.

Product, scope, merge, abandonment, remote transport, and destructive cleanup
remain operator decisions.

## US-20 — Obtain an independent expert review

**As an operator or supervising Conversation, I want an independent read-only
review of an exact candidate, so that implementation claims receive
evidence-based challenge without granting the reviewer product authority.**

The EXPERT reviews an exact candidate against its approved native contract.
Backlog binds exact task ID/path and supported fields at the candidate commit.
Beads binds exact raw persisted/current task values, revisions/refs, code
base/head, and Episode identity; it preserves provider-native shapes and uses
semantic judgment for same-task changes. A retained-folder review keeps the
exact approved specification and plan. The EXPERT reports concrete reproducible
material defects with realistic impact, violated approved behavior, and a
proportionate repair direction, answers bounded clarification, identifies its
model, and is cleaned up afterward. Normal review is not adversarial red
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
