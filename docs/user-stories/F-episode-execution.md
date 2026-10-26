# F. Implement work inside an Episode

## US-17 — Execute one reviewable vertical slice

**As an Episode implementer, I want to complete the smallest end-to-end slice
per pass, so that every iteration produces bounded, tested, documented,
reviewable progress.**

A task-native execute assignment carries one exact selected-provider task ID.
Backlog reloads its canonical task/path and supported specification, plan, notes,
evidence, references, documentation, modified-file, and summary fields. Beads
binds the exact raw task, published revision, code base/head, and native
`design`/notes plus every other provider field without normalization. The
Episode implements one slice, keeps only owner-authored native content current
through supported provider commands, publishes exact evidence, commits and
pushes its code branch, and stops for owner review. It never uses `.ralph/plans`
as task-native authority.

Backlog ownership preserves two compatible topologies. Provider-absent or
explicit Backlog without revision/evidence remains branch-local. Explicit
Backlog with `providerRevision` and `taskEvidence` uses a clean ignored nested
clone: task content commits and non-force pushes only on
`refs/heads/prime-claw/tasks`, code commits remain separate, allocation prepares
the Episode clone before execute starts, and handoff records current published
task evidence only after admission. All later Backlog status, blocker, readiness,
completion, and archive references use the ownership-selected topology; they do
not migrate a grandfathered store.

The Episode owns task content and code in its branch, while the Conversation
owns lifecycle status. Execute requires current native `In Progress`, never
changes status, completes, archives, or performs cross-checkout task copies or
dual writes. A candidate remains `In Progress` until the Conversation's separate
review and status transitions.

Retained folder Episodes without a task-bound assignment continue to use the
existing specification and execution plan during migration. Their promoted
specification must keep the accepted inventory digest and is never revised or
rebaselined; the execution plan remains living and records accepted in-scope
execution and review facts. Both modes remain
inside the operator-approved product contract. Expert or reviewer suggestions
do not become scope, and status-only churn is not progress.

## US-18 — Record blocked or completed state durably

**As an Episode implementer, I want blockers and completion reflected in durable
project artifacts, so that the next actor does not depend on transcript memory.**

In task-native mode, blocked work records the exact blocker, attempts, evidence, and unblock condition in provider-native notes/content, publishes those owner-authored facts, commits and pushes any Episode code branch change while status remains `In Progress`, reports through the existing Episode-to-Conversation channel, and stops. For Backlog, the Conversation then preserves the exact task-path status commit/push transaction. For Beads, only the exact owning canonical-primary Conversation may use one synchronized guarded `in_progress` to `blocked` status-plus-note update and one non-force publication with exact raw revision/ref/clean proof. After the operator or accepted evidence clears the recorded condition, one fresh guarded `blocked` to `in_progress` update records truthful clearance evidence and publishes once. Current native state governs; later states and uncertain operations write nothing and are not retried. Both providers resume the same Episode through `handoff_task_episode`, which records only factual current Beads observations after handoff admission.

Completed candidate work records current provider-native plan/design, notes, acceptance evidence, references, and summary while leaving lifecycle status unchanged for Conversation review. After acceptance, provider-absent/Backlog keeps its exact task-only main `Ready for Merge` commit and ordinary same-Episode integration. Beads instead treats `mainHead` as the current clean pushed canonical code head, integrates it into the idle Episode when needed, pushes and proves exact descendant `candidateHead`, then publishes one guarded `in_progress`→`ready_for_merge` native status-plus-note update with exact raw/revision/ref/content/clean proof. Both show the operator `(taskId, mainHead, candidateHead)`; Beads native observations are factual evidence, not another approval field. Delay changes nothing. Explicit Request Changes makes the provider-native return to `In Progress`: Backlog task-only commit/push followed by ordinary same-Episode main integration that restores pre-merge Episode task content, applies only authorized `In Progress`, lets Git block every other conflict, and pushes the refreshed candidate; or one guarded Beads `ready_for_merge`→`in_progress` publication with truthful finding evidence. Both then hand off the same Episode.

After explicit operator Merge authority binds the displayed exact `(taskId, mainHead, candidateHead)`, the Conversation freshly proves canonical main, the clean pushed idle Episode, ancestry, exact ownership/resources, and provider-native Ready for Merge state. It runs ordinary `git merge --ff-only candidateHead` and normally pushes canonical main. Backlog then publishes its exact task-only `Done` commit. Beads only after code publication makes one guarded `ready_for_merge`→`done` status-plus-note update with truthful tuple/code outcome and exact local/remote raw revision/ref/content/clean proof. No Episode action independently performs lifecycle status or merge work. Drift/failure preserves evidence and never authorizes force, replay, or a new transaction. Ownership and resources remain until a separately supported Cleanup decision.

After explicit operator abandonment confirmation, Backlog preserves its exact task-only non-success summary/archive/push flow. Beads instead proves the exact task, pushed Episode head, resources, code heads/ancestry, and current clean publication; writes built-in native `closed` plus the exact task/head/no-merge `close_reason` once with supported `bd close`; pushes once without force; and proves complete raw task/comments/history, revision, and remote ref. Completed Beads work remains custom `done`; `closed` is not canonical `Done`, and abandoned code never merges.

`finalize_task_episode` is cleanup-only. With separate explicit authority it verifies pushed Backlog Done/archive or current published Beads `done`/exact-reason `closed` evidence, code inclusion/exclusion, ancestry, direct remotes, and exact idle resources. It binds `cleanupHead` and current factual Beads evidence before removing only runtime, linked worktree, and local branch, then marks ownership inactive last. Shared Beads store/server/history and unrelated owners survive. Same-head partial replay is idempotent; unsafe or unbound missing state fails closed.

A persisted active version-1 Episode records blockers in its active execution plan and keeps both files active through blocked, candidate-review, and revision states. It does not archive the pair until ownership is terminal, and it never mutates related Backlog lifecycle state. The separate no-ownership old in-place folder workflow retains its existing blocked-folder and archive transitions.

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/project-templates/execute.md`
- `src/prime-agent-plugin/skills/project-templates/blocked.md`

## Design references

- [`VISION.md`](../../VISION.md)
- [`handoff-chain.md`](../handoff-chain.md)
