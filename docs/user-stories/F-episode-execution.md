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
and unblock condition in the bound task's Implementation Notes, reports through
the existing Episode-to-Conversation channel, and stops without changing
status. Completed candidate work records its plan, notes, acceptance evidence,
references, and Final Summary while leaving status unchanged for Conversation
review.

Retained folder mode continues to move blocked plan documents, update related
Backlog.md tasks, and archive completed plan bundles until final cutover.

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/project-templates/execute.md`
- `src/prime-agent-plugin/skills/project-templates/blocked.md`

## Design references

- [`VISION.md`](../../VISION.md)
- [`handoff-chain.md`](../handoff-chain.md)
