# F. Implement work inside an Episode

## US-17 — Execute one reviewable vertical slice

**As an Episode implementer, I want to complete the smallest end-to-end slice
per pass, so that every iteration produces bounded, tested, documented,
reviewable progress.**

A task-native execute assignment carries one exact Backlog task ID. The Episode
reloads that canonical task and treats its specification fields, Implementation
Plan, Implementation Notes, acceptance evidence, references, documentation,
modified files, and Final Summary as the durable work contract and record. It
implements one slice, updates task content only through supported Backlog CLI
operations in its own worktree, commits and pushes, reports exact evidence, and
stops for owner review. It never uses `.ralph/plans` as task-native authority.

The Episode owns task content on its branch, while the Conversation owns status
on main. Execute therefore verifies that the bound task remains `In Progress`,
never passes `--status`, never completes or archives the task, and performs no
cross-checkout task copy or dual write. A candidate remains `In Progress` until
the Conversation's separate review and status transitions.

Retained folder Episodes without a task-bound assignment continue to use the
existing specification and execution plan during migration. Both modes remain
inside the operator-approved product contract. Expert or reviewer suggestions
do not become scope, and status-only churn is not progress.

## US-18 — Record blocked or completed state durably

**As an Episode implementer, I want blockers and completion reflected in durable
project artifacts, so that the next actor does not depend on transcript memory.**

In task-native mode, blocked work records the exact blocker, attempts, evidence, and unblock condition in the bound task's Implementation Notes, commits and pushes that Episode branch while status remains `In Progress`, reports through the existing Episode-to-Conversation channel, and stops. The Conversation may then publish `Blocked` on canonical main with the supported Backlog CLI, verify and commit only the exact bound task path, and push. After the operator accepts the unblock condition, the Conversation publishes `In Progress` the same way and resumes the same Episode through `handoff_task_episode`.

Completed candidate work records its plan, notes, acceptance evidence, references, and Final Summary while leaving status unchanged for Conversation review. The Conversation verifies the exact pushed head, worktree, task identity, diff, tests, and review. After acceptance, it sets only the bound main task to `Ready for Merge` through the supported Backlog CLI, verifies and commits only that path, pushes, and records `mainHead`. It then uses ordinary Git in the idle Episode to integrate `mainHead`, preserves Episode-owned task content while applying only the authorized `Ready for Merge` status, pushes and verifies the refreshed `candidateHead`, and shows the operator `(taskId, mainHead, candidateHead)`. Delay changes nothing. Request Changes returns only the main task to `In Progress`, commits and pushes that path, integrates main into the same Episode with ordinary Git as needed while preserving its task content and applying that authorized status, then resumes through ordinary handoff.

After explicit operator Merge authority binds the displayed exact task, current `mainHead`, and refreshed `candidateHead`, the Conversation freshly verifies both task copies are `Ready for Merge` and runs ordinary `git merge --ff-only candidateHead` on pushed canonical main with no staged or tracked changes. Git rejects a stale or diverged candidate. The Conversation then uses the supported Backlog CLI to set only the exact task to `Done`, commits only that task path, pushes, and verifies main/upstream, ancestry, identity, parent, and status. No Episode action independently performs this merge or status change. Ownership and resources remain until a separate Cleanup decision.

After explicit operator abandonment confirmation, the Conversation selects only the bound task file from the exact pushed Episode head, records a truthful non-success Final Summary through Backlog, archives the task with the supported CLI, verifies that the effective diff is only the exact active/archive move and no Episode code entered main, commits, and pushes. Ownership and resources again remain until separately authorized Cleanup.

`finalize_task_episode` is cleanup-only. With separate explicit operator authority it verifies the exact terminal Episode head, pushed terminal main state, and exact idle resources, removes runtime, worktree, and branch, then atomically removes only the unchanged owner entry after verified absence. It performs no review, lifecycle status edit, merge, abandonment, archive, or push. Already absent resources are complete; changed identity or unsafe state blocks. Provider errors return with ordinary ownership retained so the Conversation can inspect and invoke cleanup again. There is no internal retry, cleanup-progress state, or inactive version-2 record.

A persisted active version-1 Episode records blockers in its active execution plan and keeps both files active through blocked, candidate-review, and revision states. It does not archive the pair until ownership is terminal, and it never mutates related Backlog lifecycle state. The separate no-ownership old in-place folder workflow retains its existing blocked-folder and archive transitions.

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/project-templates/execute.md`
- `src/prime-agent-plugin/skills/project-templates/blocked.md`

## Design references

- [`VISION.md`](../../VISION.md)
- [`handoff-chain.md`](../handoff-chain.md)
