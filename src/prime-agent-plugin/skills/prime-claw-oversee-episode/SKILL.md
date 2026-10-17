---
name: prime-claw-oversee-episode
description: Supervise one exact owned Prime Claw episode through evidence-based, operator-bounded decisions.
---
# Oversee one owned episode

Use only for one active Episode owned by this Conversation. Inspect persisted `.prime-claw/ownership.json` from the canonical primary checkout before prompt tags or reports. Version 1 selects retained folder oversight; version 2 selects task-native oversight. A task tag is only a candidate when ownership does not decide and never overrides the record.

For version 2 task-native ownership, bind the exact Backlog task ID and project-relative task path. Reload the task on canonical main and in the Episode through the structured interface. Its supported fields are the sole durable product and execution contract. Never consult `.ralph/plans` in this mode. The Episode owns task content on its branch; the Conversation owns lifecycle status on main.

For retained version 1 folder ownership, require the readable non-empty active specification and implementation plan in the recorded worktree, accepting `EXECUTION_PLAN.md`. Placement alone is not live Episode identity. Keep that pair active through blocking, candidate review, and revision. A missing pair uses only exact operator-authorized version-1 recovery; it is never live and never switches modes. Use only legacy `handoff_spec_episode` and `finalize_spec_episode` paths. Never claim task-native status or cleanup authority. With no ownership, old in-place work is not an Episode, so stop.

A retained Episode may cross schemas only through the exceptional `transition_spec_episode_to_task` cutover surface. Use it only after the bridge was reviewed, merged to canonical primary `main`, activated user-globally, followed by a full restart, and proven by UAT. Require explicit readiness plus exact main and Episode heads. Drift, ambiguity, dirty state, or unavailable evidence blocks. An exact same-binding replay is the only idempotent replay. The transition preserves the same Episode and resources; plan deletion remains a separate reviewed step.

Review one reported slice at a time. Check ownership, exact pushed head, diff, tests, documentation, task or plan authority, and worktree state. A report and Review conclusions are evidence, not approval. Choose one disposition:

- **Accept and advance** only when scope and evidence are sound.
- **Request an in-scope revision** only for a concrete material contract defect. Record it, then use canonical handoff to the same idle Episode. In task mode, do not edit, copy, or mirror Episode-owned task content.
- **Pause** without a product decision.
- **Consult the operator** for scope, product, merge, abandonment, cleanup, conflicting evidence, or blockers.

Never steer through chat or retry uncertain transport.

The remaining lifecycle and cleanup flow applies only to version 2 task-native ownership. Use ordinary Git and the supported Backlog CLI. Do not create lifecycle receipts, progress objects, task-content digests, or custom replay protocols.

For an accepted pushed blocker, the Conversation may set the exact main task to `Blocked` with Backlog, verify and commit only its bound path, and push. After the operator accepts the unblock condition, set it to `In Progress` the same way and call `handoff_task_episode`. Delay is a strict no-op. Request Changes requires an explicit operator choice and a recorded in-scope finding, followed by the same task handoff. If main advanced, the Episode integrates it with ordinary Git and pushes a new candidate.

Before **Merge**, preflight and show the operator `(taskId, mainHead, candidateHead)`. Canonical primary `main` must have no staged or tracked changes, must be operation-free, and must equal upstream. The exact idle Episode worktree must be clean; branch, local head, and upstream must equal the reviewed candidate; the bound task must remain `In Progress`; and `git merge-base --is-ancestor mainHead candidateHead` must succeed. After explicit authority, run `git merge --ff-only candidateHead`. Let Git reject drift. Then set the exact task to `Done` through Backlog, verify only its path changed, commit exactly that path, push, and recheck ancestry, task identity/path/parent/status, and cleanliness. Keep active ownership and resources. A push failure is ordinary transport work, not a merge replay.

Apply **Abandon** only after explicit operator confirmation of the exact task and pushed Episode head. On pushed main with no staged or tracked changes, select only the bound task file from that head, reapply the non-`Done` status and truthful Final Summary through Backlog, archive it, verify only the active/archive task move and no Episode code, commit, and push. Keep resources; cleanup needs separate authority.

**Cleanup** is separately explicit after pushed merge/`Done` or abandonment. Call cleanup-only `finalize_task_episode` with exact task ID, terminal Episode head, truthful outcome, and `confirmed: true`. It durably binds that head, removes exact idle runtime, worktree, and branch, verifies absence, and closes ownership. It performs no review, task edit, merge, archive, or push. Same-head retry is idempotent; changed, busy, dirty, foreign, or unpushed state blocks.

When needed, use `prime-claw-expert-review`. Speculative hardening, alternative architecture, and reviewer-invented invariants are non-blocking. If review invents requirements, stop that review loop. Do not request or implement another repair merely to satisfy adversarial review.

Maintain a bounded goal. Use one exact heartbeat only while waiting for Episode or Expert work. The operator alone decides scope, product direction, merge, abandonment, and cleanup.
