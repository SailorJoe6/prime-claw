---
id: PRIMECLAW-43.1
title: Migrate this repository task store to the hidden .backlog checkout
status: In Design
assignee: []
created_date: '2026-10-17 16:04'
updated_date: '2026-10-17 16:05'
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
## Outcome

After the provider and task-store infrastructure from `PRIMECLAW-43` is reviewed and available, migrate this repository’s current code-tracked `backlog/` store to Prime Claw’s chosen `.backlog/` standard without losing or duplicating task authority.

The destination is an ignored independent nested checkout of the repository’s ordinary orphan `refs/heads/prime-claw/tasks` branch. Its tree root contains Backlog configuration and store contents. The outer code repository no longer tracks the live task store. Native Backlog commands continue to resolve `.backlog/config.yml` from the project root.

This is a repository cutover task, not the generic provider implementation. It must not begin while `PRIMECLAW-10.38` still has a live Episode or before the required `PRIMECLAW-43` migration machinery has been separately reviewed and activated.

## Migration contract

- Capture an exact pre-cutover inventory of configuration, task IDs, hierarchy, lifecycle states, content digests, and source Git revision.
- Publish the complete store on `refs/heads/prime-claw/tasks` in the existing remote before retiring the code-branch copy.
- Materialize `.backlog/` as the nested task checkout in the primary checkout and every relevant code worktree.
- Add the exact outer ignore rule and prove ordinary code Git remains clean while task Git sees the store.
- Replace live implementation, skill, test, and documentation assumptions that hard-code `backlog/` with provider-resolved paths. Preserve historical evidence paths when they are intentionally provenance rather than live routing.
- Retire the old code-tracked `backlog/` initialization evidence only after the destination is complete and verified. Never leave two live Backlog stores or silently select between them.
- Preserve exact task-native ownership and revision evidence through cutover. Active or uncertain ownership blocks migration.
- A failure before verified cutover leaves the original store authoritative and reports an exact recovery condition.

## Scope boundaries

This task does not change the managed Backlog executable’s upstream direct-init default. Prime Claw initialization and migration recommend `.backlog/`, while valid existing `backlog/` and custom layouts remain supported under the operator choices specified by `PRIMECLAW-43`. This task makes the explicit `.backlog/` choice only for this repository.
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
