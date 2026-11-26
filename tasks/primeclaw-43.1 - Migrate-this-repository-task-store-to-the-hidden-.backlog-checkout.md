---
id: PRIMECLAW-43.1
title: Verify and close out the completed builder Backlog cutover
status: In Design
assignee: []
created_date: '2026-10-17 16:04'
updated_date: '2026-11-26 18:12'
labels: []
dependencies: []
references:
  - PRIMECLAW-43
  - PRIMECLAW-10.38
documentation:
  - docs/backlog.md
  - docs/project-initialization.md
parent_task_id: PRIMECLAW-43
priority: p1
type: task
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The repository cutover materially landed at 500b3860. The main checkout ignores .backlog and native Backlog uses the independent published task branch. No migration remains to execute. Review existing evidence for the historical receipt, preservation and relevant worktree checks; distinguish repository-specific proof from generic PRIMECLAW-43 behavior. Do not rerun the cutover or create a root config.

[Previous specification](https://github.com/SailorJoe6/prime-claw/blob/7837f31ed8c8f9716abfa185b6429931b98c14ff/tasks/primeclaw-43.1%20-%20Migrate-this-repository-task-store-to-the-hidden-.backlog-checkout.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Preflight proves `PRIMECLAW-10.38` has reached a terminal decision, no active or uncertain Episode of either ownership version can be affected by the store cutover, the required `PRIMECLAW-43` migration capability is the reviewed active generation, and the primary checkout and remote identity are exact.
- [ ] #2 A durable pre-cutover receipt records the source code HEAD, resolved `backlog/config.yml`, every task ID and path, hierarchy, lifecycle state, content digest, and complete active/completed/archive inventory before mutation.
- [ ] #3 The full Backlog store is published to the ordinary orphan `refs/heads/prime-claw/tasks` branch in the existing repository remote; that branch tree contains root `config.yml` and all task, completed, archive, document, decision, draft, and milestone content, and its checkout at `.backlog/` yields `.backlog/config.yml`.
- [ ] #4 The primary checkout and every relevant code worktree contain an independent `.backlog/` nested checkout bound to the same task branch and remote; ordinary code branch switches do not change task state.
- [ ] #5 The outer code repository ignores `/.backlog/`, reports no task-store changes, and no submodule, linked nested worktree, alternate index, separate hosted repository, or persistent Prime Claw lock is introduced.
- [ ] #6 Live code, managed skills, tests, and documentation use provider-resolved task identity and paths instead of assuming `backlog/`; intentional historical evidence retains its original provenance paths without becoming live routing.
- [ ] #7 The old code-tracked `backlog/` store and its live initialization evidence are retired only after destination task counts, IDs, hierarchy, statuses, content digests, branch revision, and native Backlog reads match the pre-cutover receipt.
- [ ] #8 Cutover publishes one exact task-store revision and updates provider and ownership evidence without duplicate writable authority; simultaneous old and new live store evidence blocks rather than being guessed or reconciled silently.
- [ ] #9 Native Backlog task reads and mutations work from the project root against `.backlog/`, while Prime Claw synchronization proves standard fetch, rebase or merge, commit, push, stale-push rejection, and same-task conflict handling on the task branch.
- [ ] #10 Any failed or uncertain phase preserves the last verified source authority, does not delete or force-overwrite task data, and returns a precise recovery or rollback condition before lifecycle work resumes.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-11-26 18:12
---
Original acceptance checklist retained for the evidence closeout. The current checkout and published branch do not independently prove all historical criteria.
---
<!-- COMMENTS:END -->
