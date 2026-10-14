---
name: prime-claw-oversee-episode
description: Supervise one exact owned Prime Claw episode through evidence-based, operator-bounded decisions.
---
# Oversee one owned episode

Use only for one active Episode owned by this Conversation. Inspect persisted
`.prime-claw/ownership.json` from the canonical primary checkout before prompt
tags or reports, and keep modes disjoint. Version 1 selects retained folder
oversight; version 2 selects task-native oversight. A task tag is only a
candidate when ownership does not decide and never overrides a record.

For retained version 1 folder ownership, require readable, non-empty active
`SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files in the recorded Episode
worktree, accepting the retained `EXECUTION_PLAN.md` spelling. Placement alone
is not live Episode identity. Keep that pair active through blocking, candidate
review, and revision. A missing pair uses only exact operator-authorized
version-1 recovery; it is never live and never switches modes. Use only legacy
`handoff_spec_episode` and `finalize_spec_episode` paths, and never claim
or mutate task-native Backlog status, completion, archival, finalization, or
cleanup authority. With no ownership, active legacy files on canonical main are
old in-place work, not an Episode, so this owned-Episode skill must stop.

For version 2 task-native ownership, bind the exact Backlog task ID and
project-relative task path. Reload both through the structured interface; those
fields are the sole durable product and execution contract. Never consult
`.ralph/plans` in this mode. The Episode owns task content on its branch; the
Conversation owns lifecycle status on main.

A retained Episode may cross from version 1 to version 2 only through the
exceptional `transition_spec_episode_to_task` cutover surface. Use it only after
the bridge candidate was independently reviewed, merged to canonical primary
`main`, activated user-globally from that checkout, followed by a full Prime
Agent restart, and proven by UAT. Require the operator's explicit readiness
confirmation plus the exact retained source, canonical task ID, reviewed pushed
Episode head, and activated pushed main head. The host must prove the exact
owner, top-level Conversation, `In Progress` task and complete plan, clean and
pushed Git ancestry, active plan identity, idle durable session, and unchanged
worktree/branch/Orca resources before atomically replacing only version-1
authority fields with the version-2 task binding. Any drift or unavailable
evidence blocks. An exact same-binding replay is the only idempotent replay.
The transition does not delete the active pair, create or reassign resources,
change task status, hand off, merge, finalize, or clean anything. After it
succeeds, version-2 task authority applies; later plan deletion remains a
separate reviewed step.

Review one reported slice at a time. Check ownership, candidate, diff, tests,
worktree, and mode-specific identity/content/evidence. A report is evidence,
not approval.

Choose one disposition:

- **Accept and advance** only when scope and evidence are sound.
- **Request an in-scope revision** only for a concrete contract defect. Record it before continuation. In task mode, use exact task handoff; do not edit, copy, or mirror Episode-owned task content.
- **Pause** without a product decision.
- **Consult the operator** for scope, product, merge, abandonment, destructive cleanup, conflicting evidence, or blockers.

Never steer through chat. Continue only by canonical handoff to the idle Episode. Do not retry uncertain transport.

The remaining outcome and cleanup flow applies only to version 2 task-native ownership.

For an accepted task candidate with no fixes, never hand off or request merge from that head. The handshake must publish `Ready for Merge`, integrate main in the Episode, preserve task content and parent identity, push a two-parent candidate, and verify head, ancestry, digest, hierarchy, and status. Only then request the operator's merge decision.

On that candidate, **Delay** needs an explicit operator choice and is a strict no-op, never abandonment. Apply **Request Changes** only after the operator explicitly chooses it. Publish exact-task-only `In Progress`, preserve content and identity while integrating, push, verify, then hand off. Retry failed integration from its returned receipt without repeating status.

Apply **Merge** only when the operator explicitly authorizes the exact verified task, main, and candidate. Fast-forward only to that candidate; never force or rebase. On retry, accept only exact prior main, candidate, dirty `Done` task, or task-only child. Immediately publish `Done` through Backlog and commit only the task. The local `Done` commit is authoritative. Verify code, content, path, parent, and status. Keep active ownership and Episode resources.

Apply **Abandon** only after explicit operator confirmation binds exact owner, task path, main head/status, Episode head, candidate/main relationship, parent, and Episode task digest. Reject any archive destination tracked at the bound main head and any inbound task links before mutation. Select only that task blob. Reapply captured status through Backlog, add the truthful Final Summary, prove no Episode code entered main, archive without `Done`, and commit/push the exact move. Retry only exact task-preparation, archival-move, or archival-child states; an unpushed child requires its returned terminal evidence. Keep active ownership and every resource; cleanup needs separate authority.

Use `finalize_task_episode` as the sole task-native lifecycle coordinator. Retain every returned Ready, phased-progress, and terminal receipt exactly. Apply **Cleanup** through that tool only after separate explicit operator authority binds the exact task and returned Merge or Abandon terminal evidence. The host rebinds owner, Episode, and all resources, reverifies pushed terminal evidence, then removes exact idle runtime, worktree, and branch. Keep ownership active through interruption; close only after all resources are absent.

When required, use `prime-claw-expert-review`. Review conclusions are evidence. Only a concrete material contract defect blocks. Speculative hardening, alternative architecture, and reviewer-invented invariants are non-blocking. If review invents requirements, stop that review loop and consult. Do not request or implement another repair merely to satisfy adversarial review.

Maintain a bounded goal. Use one exact heartbeat only while waiting for Episode or Expert work. The operator alone decides scope, product direction, merge, abandonment, and cleanup.
