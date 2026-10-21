---
name: prime-claw-oversee-episode
description: Supervise one exact owned Prime Claw episode through evidence-based, operator-bounded decisions.
---
# Oversee one owned episode

Use only for this Conversation's active Episode. From the canonical primary checkout, select the `.prime-claw/ownership.json` entry keyed by its exact `ownerSessionId`; accept a direct record as migration input and ignore other owners for oversight. Version 1 selects retained folder oversight; version 2 selects task-native oversight. Prompt tags never override the selected record.

For version 2 task-native ownership, bind the exact Backlog task ID and project-relative task path. Reload it on main and in the Episode through the structured interface. Its supported fields are the sole durable product and execution contract. Never consult `.ralph/plans` in this mode. The Episode owns task content on its branch; the Conversation owns lifecycle status on main.

For retained version 1 folder ownership, require the readable non-empty active specification and implementation plan in its worktree, accepting `EXECUTION_PLAN.md`. Keep that pair active through blocking, candidate review, and revision. A missing pair uses only exact operator-authorized version-1 recovery; it is never live and never switches modes. Use only legacy `handoff_spec_episode` and `finalize_spec_episode` paths. Never claim task-native status or cleanup authority. With no ownership, old in-place work is not an Episode, so stop.

A retained Episode may cross schemas only through the exceptional `transition_spec_episode_to_task` cutover surface. Require separate review, merge to canonical `main`, global activation, full restart, and proven UAT. Require explicit readiness and exact heads; drift, ambiguity, dirt, or unavailable evidence blocks. An exact same-binding replay is the only idempotent replay. The transition preserves the same Episode and resources; plan deletion remains a separate reviewed step.

Review one reported slice at a time. Check ownership, pushed head, diff, tests, docs, authority, and worktree. A report and Review conclusions are evidence, not approval. Choose one disposition:

- **Accept and advance** only when scope and evidence are sound.
- **Request an in-scope revision** only for a concrete material contract defect. Record it, then use canonical handoff to the same idle Episode. In task mode, do not edit, copy, or mirror Episode-owned task content.
- **Pause** without a product decision.
- **Consult the operator** for scope, product, merge, abandonment, conflicting evidence, blockers, or cleanup outside task-native authority.

Never steer through chat or retry uncertain transport.

The remaining lifecycle and cleanup flow applies only to version 2 task-native ownership. Use ordinary Git and the supported Backlog CLI. Do not create lifecycle receipts or replay protocols.

Before merge readiness, verify provider-reported idle completion of the Episode and explicitly proven descendants through Prime Agent list/state responses. Active or unprovable-idle sessions block readiness and merge; cleanup independently rechecks before mutation.

For an accepted pushed blocker, set the exact main task to `Blocked`, commit only its path, and push. After accepted unblock, publish `In Progress` likewise and call `handoff_task_episode`.

After exact pushed-candidate acceptance, set only the bound main task to `Ready for Merge` through the supported Backlog CLI. Reload ID/path/parent/status; verify that only the bound task path changed; commit it; push; record `mainHead`. In the idle Episode worktree, run `git merge --no-edit mainHead`. On task conflict, restore its pre-merge Episode content and apply only the Conversation-authorized `Ready for Merge` status through Backlog. Let Git block other conflicts. Finish, push, verify worktree/branch/head/upstream and task identity/path/parent/status; record `candidateHead`. Show the operator `(taskId, mainHead, candidateHead)`.

**Delay** is a strict no-op. **Request Changes** requires explicit operator choice and a recorded in-scope finding. Set only the bound main task back to `In Progress` through Backlog; verify/commit only its path; push. If needed, run `git merge --no-edit currentMainHead` in the same Episode. Preserve pre-merge Episode content plus only the authorized `In Progress` status for task conflicts; let Git block others. Push, then call `handoff_task_episode`.

Before **Merge**, re-read ownership and freshly preflight the exact `(taskId, mainHead, candidateHead)`. Recheck provider-reported idle completion. Canonical primary `main` must be operation-free, have no staged or tracked changes, equal upstream and `mainHead`, and hold the bound `Ready for Merge` task. The Episode must be clean; branch/head/upstream must equal `candidateHead`; its bound task must also be `Ready for Merge`; `git merge-base --is-ancestor mainHead candidateHead` must succeed. With explicit authority for that tuple, run `git merge --ff-only candidateHead`. Let Git reject drift. Then set the exact task to `Done` through Backlog, verify/commit only its path, push, and recheck ancestry, task identity/path/parent/status, and cleanliness. Push failure: transport, not merge replay.

Apply **Abandon** only after explicit operator confirmation of the exact task and pushed head. On pushed clean main, select only that head's bound task file, reapply its non-`Done` status and truthful Final Summary through Backlog, archive, verify only the task move and no Episode code, commit, and push.

**Cleanup** follows automatically and immediately after the already operator-authorized terminal outcome is committed, pushed, and verified. No second cleanup confirmation. Call cleanup-only `finalize_task_episode` with exact `taskId`, terminal `episodeHead`, and truthful `merged`/`abandoned` `outcome`. It removes exact idle runtime, worktree, and branch, including explicit descendants and upstream; verifies absence; deletes only this owner's entry. No lifecycle edits/push.

On error/interruption, the Conversation interprets provider evidence; re-read current ownership, Prime Agent, provider, and Git state. Exact absence counts as cleaned. Re-invoke only when current evidence proves safe progress; changed, busy, dirty, foreign, or unpushed state blocks. Consult the operator only when safe progress is impossible. No hook, watcher, worker, retry loop, classifier, coordinator, receipt, or new state.

When needed, use `prime-claw-expert-review`. Speculative hardening, alternative architecture, and reviewer-invented invariants are non-blocking. If review invents requirements, stop that review loop. Do not request or implement another repair merely to satisfy adversarial review.

Maintain a bounded goal. Use one exact heartbeat only while waiting for Episode or Expert work. The operator alone decides scope, product direction, merge, and abandonment; task-native cleanup needs no second decision.
