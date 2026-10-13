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

If the operator chooses Delay, the Conversation re-verifies that exact
handshake and idle Episode but changes nothing and sends no transport. Delay is
not abandonment. If the operator explicitly requests changes, the inactive
outcome phases publish only the main task back to `In Progress`, integrate that
commit in the same Episode while preserving task content and parent identity,
push and verify a new exact two-parent candidate, and only then resume through
canonical task handoff. A failed integration can retry from its already-returned
publication without repeating the status transition, admission, allocation, or
assignment.

If the operator explicitly chooses Merge, the decision must name that exact
verified task, current main, and pushed refreshed candidate. The inactive seam
requires clean canonical main and exact upstream state, fast-forwards only to
the reviewed candidate, then immediately changes only the task to `Done` through
Backlog and creates a direct one-path commit. A retry accepts only the exact
pre-merge head, candidate, candidate plus its sole dirty/staged `Done` task, or
one-task `Done` child. It can finish the commit without repeating a successful
fast-forward or lifecycle mutation. It re-proves the Ready publication commit in
main history and verifies candidate ancestry, merged code, content digest, path,
parent identity, and status. A successful local
`Done` commit remains authoritative when push or remote verification fails.
Ownership and the idle Episode resources remain active for separate finalization
or cleanup.

If the operator explicitly confirms abandonment instead, the authority binds the
exact owner, active path, main head and captured non-`Done` status, pushed
Episode head, candidate/main relationship, invariant parent, Episode-content
digest, and Final Summary. It first rejects an archive destination already
tracked at the bound main head, preserving historical bytes across task-ID reuse,
and rejects any active or completed inbound link whose supported archive cleanup
would modify another task. The inactive seam
selects only the task blob, reapplies the Conversation-owned status through
Backlog, verifies a task-only effective
diff, and archives without `Done`. It accepts only exact task-preparation,
archival-move/stage, or direct archival-child recovery states. The verified local
archive remains authoritative when final transport fails. Ownership and every
Episode resource stay active until separately authorized cleanup.

A later Cleanup decision is independently explicit and binds every exact owner,
task, Episode, session, worktree, branch, and optional Orca identity. Before any
deletion, the Conversation must reverify the pushed exact `Done` child or exact
non-`Done` archival child and a clean idle resource set. Cleanup removes runtime,
worktree, and branch only in a verified monotonic sequence. An interrupted
prefix retains active ownership for exact retry; inactive bookkeeping is written
only after all resources are absent. Mixed terminal evidence, failed transport,
identity drift, busy or dirty resources, unsafe gaps, provisioning, and
uncertain ownership fail closed. This internal coordinator remains inactive.

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
