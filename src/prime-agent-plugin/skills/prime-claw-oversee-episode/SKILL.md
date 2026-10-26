---
name: prime-claw-oversee-episode
description: Supervise one exact owned Prime Claw episode through evidence-based, operator-bounded decisions.
---
# Oversee one owned episode

Use only for this Conversation's active Episode. From the canonical primary checkout, select the `.prime-claw/ownership.json` entry keyed by its exact `ownerSessionId`; accept a direct record as migration input and ignore other owners for oversight. Version 1 selects retained folder oversight; version 2 selects task-native oversight. Prompt tags never override the selected record.

For version 2, select the provider only from that exact owner. A provider-absent record or `provider: "backlog"` retains its exact Backlog task ID and project-relative task path and must not carry Beads evidence. Reload it on main and in the Episode through the structured interface. Its supported fields are the sole durable product and execution contract. Never consult `.ralph/plans` in this mode. The Episode owns task content on its branch; the Conversation owns lifecycle status on main.

A `provider: "beads"` record has no `taskPath`. Bind its exact canonical task ID, published `providerRevision`, complete raw `taskEvidence`, code `baseRef`, worktree, branch, and Episode session identity. From the correct canonical-main and recorded Episode contexts, use `bd context --json`, one supported `bd dolt pull`, and exact `bd show TASK-ID --json --long --include-comments` reads; never force, retry uncertain transport, or use raw Dolt writes. Preserve every native field name, shape, value, and absence; never invent a normalized task, path, digest, receipt, or alternate authority.

For retained version 1 folder ownership, require the readable non-empty active specification and implementation plan in its worktree, accepting `EXECUTION_PLAN.md`. Keep that pair active through blocking, candidate review, and revision. A missing pair uses only exact operator-authorized version-1 recovery; it is never live and never switches modes. Use only legacy `handoff_spec_episode` and `finalize_spec_episode` paths. Never claim task-native status or cleanup authority. With no ownership, old in-place work is not an Episode, so stop.

A retained Episode may cross schemas only through the exceptional `transition_spec_episode_to_task` cutover surface. Require separate review, merge to canonical `main`, global activation, full restart, and proven UAT. Require explicit readiness and exact heads; drift, ambiguity, dirt, or unavailable evidence blocks. An exact same-binding replay is the only idempotent replay. The transition preserves the same Episode and resources; plan deletion remains a separate reviewed step.

Review one reported slice at a time. Check ownership, pushed head, diff, tests, docs, authority, and worktree. For Beads, compare the persisted raw task and revision with the synchronized current raw task, publication ref, candidate code base/head, tests, and documentation. An unrelated-task revision descendant alone is compatible. For a same-task change, surface the exact persisted and current fields. Use bounded LLM judgment to decide whether it is a compatible in-scope clarification or living-plan update; escalate a genuine semantic conflict, authority change, scope expansion, or product decision. Never replace this judgment with a classifier.

A report, findings, and Review conclusions are evidence, not approval. Choose one disposition:

- **Accept and advance** when scope and evidence are sound. For Beads, `handoff_task_episode` supplies exact previous/current native context to the existing Episode LLM. Compatible owner-authored, outside same-task, and unrelated descendant changes continue without another authorization interface.
- **Request an in-scope revision** for a material contract defect. Record it through canonical handoff with `handoff_task_episode`. For Beads, guidance supplies only bounded focus; the host supplies exact factual observations. In task mode, do not edit, copy, or mirror Episode-owned task content.
- **Pause** without a product decision.
- **Consult the operator** for scope, product, merge, abandonment, cleanup, conflicting evidence, or blockers.

Never steer through chat or retry uncertain transport.

For Beads, `handoff_task_episode` proves owner/resources, pushed code, one pull, and paired publication evidence. Prompts receive previous/current facts. After first-message admission, its callback records only `providerRevision`, raw `taskEvidence`, code `head`, and `updatedAt`. Prior may be `blocked`; current must be exact `in_progress` with meaningful design. Integrity failure stops without retry.

Only the exact owning top-level canonical-primary Conversation publishes an accepted blocker. Backlog keeps its exact-path status commit/push and restores `In Progress` before same-Episode handoff.

For Beads, current synchronized native status—not the older ownership observation—governs. Re-prove exact bindings, raw task, clean revision, and publication ref. Only current `in_progress` may receive one guarded `--if-status in_progress` status-plus-note update recording truthful blocker evidence and exact unblock condition; push once without force and prove exact `blocked` raw task/revision/ref/clean state. Already `blocked` is a no-op; other states or uncertainty stop without retry/force/raw writes. Only cleared operator or accepted evidence permits one guarded `--if-status blocked` update with truthful clearance evidence, one non-force `in_progress` publication, then `handoff_task_episode`. Never write `ownership.json` directly or keep an artificial `in_progress` snapshot; semantic meaning remains LLM judgment.

Other Beads status/terminal transitions, finalization, and cleanup remain inactive. No Backlog-only route, receipt, parallel workflow, or replacement resources. Later lifecycle/cleanup is Backlog-only.

After accepting an exact pushed candidate, set only the bound main task to `Ready for Merge` through the supported Backlog CLI. Reload and verify its ID, path, parent, and status; verify that only the bound task path changed; commit that path; push; and record `mainHead`. In the idle Episode worktree, run ordinary `git merge --no-edit mainHead`. If the task conflicts, restore its pre-merge Episode content, then apply only the Conversation-authorized `Ready for Merge` status through Backlog. Let Git block other conflicts. Complete the merge, push, and verify the worktree, branch, local head, upstream, task identity/path/parent/status, and resulting `candidateHead`. Then show the operator `(taskId, mainHead, candidateHead)`. This is prompt-led Git and Backlog work, not a custom status publisher, receipt, digest, or reconciliation transaction.

**Delay** is a strict no-op. **Request Changes** requires an explicit operator choice and a recorded in-scope finding. Set only the bound main task back to `In Progress` through Backlog, verify and commit exactly that path, and push. If needed, in the same Episode run ordinary `git merge --no-edit currentMainHead`; resolve the task with its pre-merge Episode content plus only the authorized `In Progress` status, let Git block other conflicts, push the refreshed candidate, then call `handoff_task_episode`.

Before **Merge**, re-read ownership and freshly preflight the exact `(taskId, mainHead, candidateHead)` shown to the operator. Canonical primary `main` must have no staged or tracked changes, must be operation-free, must equal upstream and `mainHead`, and its bound task must be `Ready for Merge`. The exact idle Episode worktree must be clean; branch, local head, and upstream must equal `candidateHead`; its bound task must also be `Ready for Merge`; and `git merge-base --is-ancestor mainHead candidateHead` must succeed. After explicit authority for that tuple, run `git merge --ff-only candidateHead`. Let Git reject drift. Then set the exact task to `Done` through Backlog, verify only its path changed, commit exactly that path, push, and recheck ancestry, task identity/path/parent/status, and cleanliness. Keep active ownership and resources. A push failure is ordinary transport work, not a merge replay.

Apply **Abandon** only after explicit operator confirmation of the exact task and pushed Episode head. On pushed main with no staged or tracked changes, select only the bound task file from that head, reapply the non-`Done` status and truthful Final Summary through Backlog, archive it, verify only the active/archive task move and no Episode code, commit, and push. Keep resources; cleanup needs separate authority.

**Cleanup** is separately explicit after pushed merge/`Done` or abandonment. Call cleanup-only `finalize_task_episode` with exact task ID, terminal Episode head, truthful outcome, and `confirmed: true`. It durably binds that head, removes exact idle runtime, worktree, and branch, verifies absence, and closes ownership. It performs no review, task edit, merge, archive, or push. Same-head retry is idempotent; changed, busy, dirty, foreign, or unpushed state blocks.

When needed, use `prime-claw-expert-review`. Speculative hardening, alternative architecture, and reviewer-invented invariants are non-blocking. If review invents requirements, stop that review loop. Do not request or implement another repair merely to satisfy adversarial review.

Maintain a bounded goal. Use one exact heartbeat only while waiting for Episode or Expert work. The operator alone decides scope, product direction, merge, abandonment, and cleanup.
