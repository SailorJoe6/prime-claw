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

In task-native mode, blocked work records the exact blocker, attempts, evidence,
and unblock condition in the bound task's Implementation Notes, commits and
pushes that Episode branch while status remains `In Progress`, reports through
the existing Episode-to-Conversation channel, and stops. The staged
Conversation seam verifies the exact owner, active ownership, canonical primary
`main`, committed main task bytes, exact pushed Episode head, post-admission task
evidence, and unchanged Episode status before committing only main's task path
as `Blocked`. A later accepted unblock commits only that main task path back to
`In Progress`; the existing exact handoff then resumes the same worktree and
session without admission or resource creation. Main push failure is returned as
evidence but does not invalidate a successful local status commit. Completed
candidate work records its plan, notes, acceptance evidence, references, and
Final Summary while leaving status unchanged for Conversation review. After
acceptance, the separate inactive review-integration seam—not ordinary execute
or handoff—merges current main in the same idle Episode worktree, preserves that
accepted task content, applies main's `Ready for Merge` status through Backlog,
and pushes a refreshed candidate for Conversation verification. If the operator
then requests changes, the Conversation alone reverses main to `In Progress`;
the same Episode receives that status only through constrained integration and
is resumed only after the new pushed candidate verifies. Delay does not wake or
change the Episode. If the operator instead authorizes the exact verified merge,
the Conversation fast-forwards clean canonical main only to that pushed
candidate, immediately publishes only the exact task as `Done`, and verifies
merged code plus task content, path, parent, and status. The Episode does not
perform this merge or status change. Its ownership and all idle resources remain
until separate finalization or cleanup authority.

If the operator instead confirms abandonment, the separate inactive Conversation
seam first rejects an archive destination already tracked at the bound main head,
then imports only the pushed Episode task content into the exact bound main task,
restores main's captured non-`Done` lifecycle status, writes a truthful
abandonment Final Summary, proves that no Episode code entered main, and archives
the task. The Episode performs none of these lifecycle operations and all of its
resources remain retained for separately authorized cleanup.

Retained folder mode continues to move blocked plan documents, update related
Backlog.md tasks, and archive completed plan bundles until final cutover.

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/project-templates/execute.md`
- `src/prime-agent-plugin/skills/project-templates/blocked.md`

## Design references

- [`VISION.md`](../../VISION.md)
- [`handoff-chain.md`](../handoff-chain.md)
