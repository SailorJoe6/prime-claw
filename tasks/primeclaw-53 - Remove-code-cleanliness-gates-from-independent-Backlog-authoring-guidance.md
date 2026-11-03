---
id: PRIMECLAW-53
title: Remove code cleanliness gates from independent Backlog authoring guidance
status: In Planning
assignee: []
created_date: '2026-11-02 22:00'
updated_date: '2026-11-03 19:26'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/skills/project-templates/design.md
  - src/prime-agent-plugin/skills/project-templates/spec-it-out.md
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - tests/spec_episode_extension.test.mjs
priority: p2
type: docs
ordinal: 138000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome and operator scope
Correct independent Backlog task-only publication in both managed authoring guidance and the narrow runtime lifecycle status publisher. Parent code cleanliness/upstream equality is not a prerequisite for a task-only operation; preserving code is the requirement. Joe explicitly expanded this same PRIMECLAW-53 task: “commit your change or roll it back, whichever makes more sense. Then add these fixes to primeclaw-53. Then plan out primeclaw-53 if it isn't already planned.” This supersedes the earlier documentation-only scope and runtime-change exclusion for the specific lifecycle correction below, not for unrelated runtime work.

The original bounded Markdown correction/global delivery authority remains recorded: Joe asked for the correction in Prime Claw's global template and ADAPT's local skill. Adapt-Hand Expert owns the separate ADAPT local/symlink/gitignore/task work; ADAPT-1 is not this task. Completed PRIMECLAW-51 and PRIMECLAW-47 are not reopened. This revision records and plans the additional runtime fix; it does not authorize starting its implementation, another Episode, merge, broad activation, restart, or cleanup.

## Authoring correction
Both `src/prime-agent-plugin/skills/project-templates/design.md` and `spec-it-out.md`, in Verify and publish exactly once → Backlog, incorrectly require the parent code checkout to be clean/upstream-equal for an independent task store. Scope the index/task-path checks to the selected store and use this previously approved replacement block consistently in both templates:

### Backlog

Before mutation, record Git status in the code repository and the selected task
store. Require the selected existing task path and the selected task store's
Git index to be clean; do not apply task-store cleanliness checks to a separate
parent code repository. After creation or revision, reload the exact task
through `backlog task view --json -- TASK-ID` and verify its canonical ID,
`In Design` status, meaningful Description, native Acceptance Criteria, and
returned regular task path. Verify no path other than that exact returned task
path was newly changed in the task store and do not stage unrelated pre-existing
changes.

Preserve the selected store topology. If the selected Backlog store is a
validated ignored independent ordinary-Git clone, whether built-in or custom,
before the native task write require the independent clone to be clean and at
the directly proved `refs/heads/prime-claw/tasks` head. After the native task
write, verify only the exact intended task path changed, commit only that path
inside the clone, push `HEAD:refs/heads/prime-claw/tasks` without force, and prove
the direct remote head. There is no requirement for the parent code repository to be clean
or upstream-equal for task creation, revision, or task-store publication.
Unrelated staged, unstaged, or untracked code changes and code-branch divergence
are not blockers. Preserve the parent code HEAD, index, and worktree as found;
never commit, stash, reset, clean, or otherwise repair code changes to enable a
task-only operation. This does not relax separate implementation or Episode
admission requirements.
Only for an actual branch-local store, keep the existing flow: commit only the
returned task path in the code repository, prove the commit contains no other
path, and attempt one prompt push when a remote is available. A push failure is
transport evidence to report, not permission to undo the valid local
specification, create another task, or begin planning.

## Lifecycle correction and observed failure
In `src/prime-agent-plugin/extension-support/spec-episode.ts`, `commitConversationTaskStatus` applies parent-code cleanliness/upstream-equality checks before and after independent Backlog status publication. Episode allocation writes tracked `.prime-claw/ownership.json`. When session binding fails, automatic Blocked publication encounters that own write and rejects its own recovery with “Independent Backlog Blocked publication requires exact clean upstream-equal code HEAD”. The separate launcher/daemon mismatch caused the launch failure; the publisher's inability to report that failure is this Prime Claw defect.

For the independent Backlog path only, remove parent-code cleanliness/upstream-equality as task-status publication requirements. Use the existing native task-store preparation/publication surfaces. Before native mutation, require the exact selected independent task store clean and synchronized to its directly proved published task ref. Retain exact provider/root/task/path identity, expected source status and meaningful-plan checks where already required, exact intended task-path changes, task-store index safety, scoped task-only commit, non-force push and direct-remote proof. Preserve parent code HEAD, index and working files as found rather than requiring them clean. Unrelated staged, unstaged or untracked code, code-branch divergence and the allocation's ownership write must not prevent task-only status publication. Concurrent unrelated changes are not proof the task publisher modified code; do not introduce a whole-checkout equality gate or generic snapshot/receipt framework.

Keep code implementation/admission checks separate from task publication. Evaluate their genuine clean/published-code prerequisites before allocation's ownership write, without reapplying an already-invalidated clean-parent requirement inside failure reporting. Preserve existing safe code base/placement, owner/task/resource identity, source lifecycle, branch-local Backlog, Beads and retained-specification rules. Allocation failure must be able to publish the exact truthful Blocked status/note while preserving uncertain ownership and all allocated resources; no fresh creation, second assignment, automatic cleanup or fabricated successful admission. A dirty/unpublished/unsafe task store or failed task publication remains a real blocker and must be reported honestly.

Do not solve this by ignoring, untracking, stashing, resetting, deleting or automatically committing ownership metadata. Joe separately authorized resolving this incident's pending Git change: preserving and committing the exact uncertain record is safer than removing evidence of existing resources. That one-off bookkeeping commit is not the runtime fix or a new runtime auto-commit policy.

## Current evidence and preserved blocker
The six stale metadata baselines were repaired with supported native resets in pushed code commit `5c1358b56732869465a1402beb5fa280635122ea`; skill bytes did not change. Under Joe's new commit-or-rollback instruction, the exact pending uncertain ownership record was committed/pushed as `fe61016a5eab4a41f7d10fe3ca3996d3bb0d3fc8`, without editing its bytes, rewriting historical task evidence, or changing resources.

Retain operation `b0133363-514c-419e-affc-7fc4b1042d90`, owner Conversation `01a1363a-e0f9-7628-aee4-81b03eb1e3fb`, worktree `/Users/jlanders/worktrees/prime-claw/prime-claw-primeclaw-53-episode-b0133363`, branch `JLanders/prime-claw-primeclaw-53-episode-b0133363`, original code base `5c1358b56732869465a1402beb5fa280635122ea` and its exact Orca resources. No Episode session was bound in the recorded failed allocation. The task remains Blocked; this replan does not clear or recover the uncertain allocation.

At the recorded failure, the guarded installed launcher expected `cwd-fix-v0.9.8-r1-10-gf80340d93` / `f80340d93dc3b1c6de3459b54a82f351e136f75e`, but the sole observed daemon was PID3601/build `cwd-fix-v0.9.8-r1`. Runtime drift was corroborated by both runtime owners; its trigger was not established. These are historical observations, not a claim about the current live daemon. TASK-2 Conversation `01a18414-077b-7038-85d3-6d13ece95269` owns runtime recovery and was waiting for Joe's client-closure/coordinated-restart decision. After separately authorized runtime recovery, re-read exact owner/native/Orca/provider/Git state before deciding how to recover this same uncertain operation. No creation retry, ownership edit, new resource or guard bypass follows from planning.

## Validation, delivery and limits
Use the least-tech correction in the existing publisher/caller seams and existing tests. Add focused real disposable-Git lifecycle regression evidence, alongside the existing Markdown contract tests. Candidate plugin validation is Docker-only and includes `scripts/test-tier1.sh --probe` after source changes. Preserve unrelated files/index/task records; do not use live ADAPT or Nemo as fixtures or repair unrelated baseline failures. No new controller, persistent state/state machine, semantic classifier, task reconciliation, iterative plan machinery, approval receipt or retry protocol.

After separately accepted source publication, retain the original bounded global Markdown delivery to exactly `~/.prime/agent/skills/project-templates/design.md` (`project-skill-design`) and `spec-it-out.md` (`project-skill-spec-it-out`). Evaluate exact two-file replacement from accepted committed/validated source, with before/after hashes, safe replacement and only genuinely required managed provenance updates. Absence of a per-asset apply selector alone is not a blocker. Do not broad-apply unrelated runtime assets, build a delivery controller or restart. Report source publication, actual Markdown delivery and runtime activation separately. Installing/activating the added runtime code is outside this planning request and the two-file delivery authority.

No Prime Agent source/dependency change, launcher/daemon repair, initializer/symlink policy change, live migration, broad cleanup, unrelated task mutation or reopening completed work. Preserve the existing native independent-store topology, all unrelated customized local skills and prior activation evidence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Canonical design.md and spec-it-out.md authoring guidance consistently uses the agreed Backlog block: unrelated staged, unstaged or untracked code changes and code-branch upstream divergence never block independent native task creation, revision or publication, and never cause code commit/stash/reset/cleanup/sync.
- [ ] #2 Independent task-store clean/direct-remote-equal checks are explicitly PRE-WRITE. Post-write checks allow only the intended exact task path, preserving task/store/root identity, task-store index safety, scoped task-only commit, non-force push and direct-remote publication proof.
- [ ] #3 Parent code HEAD/index/worktree are preserved by task-only authoring; this is noninterference, not a cleanliness requirement. Actual branch-local publication behavior and separate implementation/Episode admission gates remain unchanged.
- [ ] #4 The approved authoring and narrow independent-Backlog lifecycle corrections have proportionate existing-suite regression evidence. Candidate plugin validation is Docker-only, includes mandatory Tier1 --probe, and reports actual outcomes and baseline limits without unrelated repairs.
- [ ] #5 Exact bounded source paths/commit/publication evidence and global Markdown destination/content evidence are reported. Only these approved Markdown assets are delivered globally, with unrelated runtime assets, dirty project state and running processes preserved; no broad apply or restart occurs. If safe bounded delivery is unavailable, the real blocker and pending delivery are reported, not silently bypassed.
- [ ] #6 Independent Backlog lifecycle status publication accepts pre-existing staged, unstaged and untracked parent-code changes and parent-code upstream divergence while preserving parent HEAD, index and working files; task-store cleanliness/publication and exact native identity/status/path/plan checks remain enforced.
- [ ] #7 A real disposable-Git allocation-failure regression writes tracked ownership and then fails session binding: truthful Blocked status/notes can still be published to the exact independent task, uncertain ownership/resources remain intact, and no duplicate creation, second assignment or automatic cleanup occurs.
- [ ] #8 Dirty/unpublished/unsafe independent task history, wrong task/provider/path or expected source state, and failed publication remain honest blockers without force, evidence deletion or false success; existing branch-local Backlog and Beads behavior remains unchanged.
- [ ] #9 Code-admission safety is distinct from task-status publication: legitimate code base/placement/cleanliness requirements are checked before ownership allocation, not imposed on task-only failure reporting afterward. No ignore/untrack/stash/reset/delete or automatic ownership-commit workaround, generic state/retry/controller machinery or new semantic approval gate is introduced.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Revised living plan and authority
This task already had a published four-step Markdown plan. Joe's explicit scope expansion adds the self-dirtying independent-Backlog lifecycle publisher correction, so this replaces the stale docs-only plan. Keep native status Blocked and the existing uncertain allocation intact. Planning is not implementation, runtime recovery or a new allocation.

1. **Align both Markdown templates.** Replace only the Backlog Verify and publish exactly once blocks in `src/prime-agent-plugin/skills/project-templates/design.md` and `spec-it-out.md` with the approved Description block. Scope index/path checks to the selected store; distinguish pre-write clean/directly-published task history from post-write intended task delta and parent-code noninterference. Preserve branch-local publication, Beads guidance, separate Episode admission requirements, asset IDs and customized local skills. Inspect directly equivalent authoring wording only to avoid contradiction.

2. **Correct the existing lifecycle publisher, not the ownership store.** In the independent Backlog branch of `commitConversationTaskStatus` in `extension-support/spec-episode.ts`, remove the pre/post parent-code clean/upstream-equal requirements. Reuse `prepareTaskHistoryWorkspace` and `publishTaskHistoryMutation` and their exact native identity, clean synchronized task-store, intended-path, source-state/plan and non-force/direct-remote proofs. Keep code HEAD preservation and ensure this path does not write the code index/worktree; do not substitute an initially-clean check, whole-worktree equality gate, ownership whitelist or generic snapshot framework. Inspect the existing admission/failure caller ordering so genuine code admission checks occur before reservation/ownership writes and failure status publication does not repeat those checks afterward. Change only directly necessary caller/helper code, if any; keep ordinary branch-local Backlog, Beads and retained-specification behavior. Do not alter ownership format, resources, retry/assignment rules or runtime auto-commit policy.

3. **Add focused regressions in existing suites.** Extend `tests/test_future_plan_skills.py` with small assertions for both approved Markdown blocks and their task-store/admission boundaries. Extend the existing `tests/spec_episode_extension.test.mjs` lifecycle tests (and directly necessary existing task-history cases only) using disposable independent task clones and real Git where noninterference/publication is asserted. Cover successful task-only status publication with unrelated staged, unstaged and untracked code and code upstream divergence; prove unchanged parent HEAD/index/file contents and exact published task delta. Reproduce the allocation-write-then-launch-failure path and prove exact Blocked publication, retained uncertain ownership/resources and no duplicate creation/assignment/cleanup. Cover dirty or unpublished task history, wrong identity/source status and publication failure; preserve the existing branch-local/Beads and code-admission safeguards. Test outcomes, not an invented transport/reconciliation/state framework; do not mistake unrelated concurrent code activity for publisher writes.

4. **Validate and report proportionately.** Run `scripts/test-tier1.sh --probe` after plugin-source changes and the existing Docker test entrypoints for the focused Markdown, spec-Episode and any directly affected task-history tests. Inspect the bounded source/test diff and prove intended code/task publication separately. Record exact commands, evidence paths, actual pass/fail/skip results and baseline limits in the native task; no blanket green-suite claim or unrelated repairs. No candidate host/user-global apply/check/probe and no live ADAPT/Nemo fixture.

5. **Preserve recovery and delivery boundaries.** Before implementation can resume, obtain separately verified runtime recovery from the TASK-2 owning Conversation, then inspect current exact PRIMECLAW-53 owner/native/provider/Git/Orca state. The persisted uncertain operation is not fresh-create authority; do not launch, delete or rebind it as part of this plan. The saved ownership evidence committed as `fe61016a5eab4a41f7d10fe3ca3996d3bb0d3fc8` remains unchanged. Report that the operator-expanded task differs from the historical taskEvidence captured at failed allocation; never forge that evidence or infer execution authority from a new plan.

6. **Accepted source and two-file Markdown delivery.** After separately authorized implementation/review/acceptance and ordinary source publication, the owning Conversation handles only the two previously authorized global Markdown destinations and asset IDs in Description. Evaluate direct exact two-file replacement from committed/validated accepted source with before/after hashes, safe replacement and only truly required provenance updates; do not treat missing per-asset CLI selection as a blocker by itself. Preserve all unrelated global/project/runtime files and processes. Do not run broad `manage-prime-agent-delivery.py apply`, add a delivery controller, install the new runtime code, or restart under this authority. Report any concrete managed-contract constraint and actual source/Markdown/runtime status honestly to Joe and Adapt-Hand Expert.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PRIMECLAW-53 provisioning blocked after operation b0133363-514c-419e-affc-7fc4b1042d90 allocated the retained Orca worktree/branch from 5c1358b56732869465a1402beb5fa280635122ea. Native creation timed out binding a fresh Prime Agent session to its exact Orca tab. Read-only terminal evidence: guarded launcher expects build cwd-fix-v0.9.8-r1-10-gf80340d93 / source f80340d93dc3b1c6de3459b54a82f351e136f75e; running daemon PID3601 reports cwd-fix-v0.9.8-r1 and launcher states Nothing new was started. No exact-CWD Episode session was found and no implementation is claimed. Ownership remains uncertain and the exact worktree, branch and launch evidence are retained; never retry as fresh creation, send another assignment, or delete/rebind ownership manually. Native fallback Blocked publication failed because its clean-parent-code check encountered the newly written ownership registry; this is a task-only native publication with code/ownership preserved. Unblock condition: coordinate with the runtime owner/operator to resolve the launcher-versus-daemon generation mismatch under separate runtime authority, then explicitly review recovery of THIS exact uncertain operation and existing resources before any continuation. No restart/upgrade/launcher bypass is authorized by PRIMECLAW-53. The six stale template metadata entries were separately repaired and pushed in 5c1358b; skill contents unchanged. Source template correction and global Markdown delivery remain pending.

Joe authorized commit-or-rollback of this Conversation’s pending change and explicit expansion of PRIMECLAW-53 with the diagnosed lifecycle publisher correction. Committed/pushed only the existing uncertain ownership record, bytes unchanged, as fe61016a5eab4a41f7d10fe3ca3996d3bb0d3fc8; rollback would discard evidence of retained allocated resources. No source implementation, resource/runtime mutation or ownership rebind occurred. Revised the already-existing native plan and specification/AC for the expanded scope; status remains Blocked, historical persisted taskEvidence remains unchanged, and no fresh planning/admission/allocation or implementation is implied.

Joe confirmed TASK-2 merged/installed/active; passive status corroborated the expected f80340d93 runtime build. At Joe’s explicit direction, the failed PRIMECLAW-53 worktree for operation b0133363-514c-419e-affc-7fc4b1042d90 was removed through Orca and verified absent from disk, Git and Orca; no bound Episode session was found. Joe then explicitly directed removal of this Conversation’s stale ownership entry; only that entry was removed and committed/pushed as b66581303d477e56caaba13b59ed407f4832de87, preserving other owners. The historical failed allocation is no longer live ownership. Joe now asks to implement the expanded nine-criterion specification and revised living plan. Return this exact task to In Planning for managed implementation readiness, not directly to In Progress. No Episode/resources/assignment have been created by this status update. New readiness must use the current published task, code and selected host id:afb6537c-e643-4a5f-b284-f0f627ddcbdf, not the obsolete failed-allocation task snapshot.

The new managed readiness review found the expanded nine-AC task implementation-ready. Native creation published In Progress in dd9296695b3bf2de79487fa63f12f12fb5a345c5 but then failed before ownership or resource mutation because an unrelated concurrent PRIMECLAW-55 edit hit the installed whole-store task-read gate. Its automatic rollback read failed on the same unrelated edit. Fresh checks found no PRIMECLAW-53 ownership entry or Episode worktree/resources; code main remained clean at 532bc0de5d3b5dbb2ae3c55aff8967403abf1bdc. Restore only this exact task to In Planning, preserving its complete specification, nine AC and living plan. No implementation or resource recovery is claimed. Further creation attempts are paused for bounded author coordination around the known PRIMECLAW-55 tooling defect; unrelated task edits are not a product-level blocker. Existing expanded implementation authority and selected host id:afb6537c-e643-4a5f-b284-f0f627ddcbdf remain unchanged.
<!-- SECTION:NOTES:END -->
