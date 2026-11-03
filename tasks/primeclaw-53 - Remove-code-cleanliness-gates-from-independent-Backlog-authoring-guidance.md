---
id: PRIMECLAW-53
title: Remove code cleanliness gates from independent Backlog authoring guidance
status: In Progress
assignee: []
created_date: '2026-11-02 22:00'
updated_date: '2026-11-03 21:56'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/skills/project-templates/design.md
  - src/prime-agent-plugin/skills/project-templates/spec-it-out.md
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - tests/spec_episode_extension.test.mjs
documentation:
  - docs/backlog.md
  - docs/evidence/primeclaw53-independent-task-publication.md
modified_files:
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - src/prime-agent-plugin/skills/project-templates/design.md
  - src/prime-agent-plugin/skills/project-templates/spec-it-out.md
  - tests/spec_episode_extension.test.mjs
  - tests/test_future_plan_skills.py
  - docs/backlog.md
  - docs/evidence/primeclaw53-independent-task-publication.md
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
- [x] #1 Canonical design.md and spec-it-out.md authoring guidance consistently uses the agreed Backlog block: unrelated staged, unstaged or untracked code changes and code-branch upstream divergence never block independent native task creation, revision or publication, and never cause code commit/stash/reset/cleanup/sync.
- [x] #2 Independent task-store clean/direct-remote-equal checks are explicitly PRE-WRITE. Post-write checks allow only the intended exact task path, preserving task/store/root identity, task-store index safety, scoped task-only commit, non-force push and direct-remote publication proof.
- [x] #3 Parent code HEAD/index/worktree are preserved by task-only authoring; this is noninterference, not a cleanliness requirement. Actual branch-local publication behavior and separate implementation/Episode admission gates remain unchanged.
- [x] #4 The approved authoring and narrow independent-Backlog lifecycle corrections have proportionate existing-suite regression evidence. Candidate plugin validation is Docker-only, includes mandatory Tier1 --probe, and reports actual outcomes and baseline limits without unrelated repairs.
- [ ] #5 Exact bounded source paths/commit/publication evidence and global Markdown destination/content evidence are reported. Only these approved Markdown assets are delivered globally, with unrelated runtime assets, dirty project state and running processes preserved; no broad apply or restart occurs. If safe bounded delivery is unavailable, the real blocker and pending delivery are reported, not silently bypassed.
- [x] #6 Independent Backlog lifecycle status publication accepts pre-existing staged, unstaged and untracked parent-code changes and parent-code upstream divergence while preserving parent HEAD, index and working files; task-store cleanliness/publication and exact native identity/status/path/plan checks remain enforced.
- [x] #7 A real disposable-Git allocation-failure regression writes tracked ownership and then fails session binding: truthful Blocked status/notes can still be published to the exact independent task, uncertain ownership/resources remain intact, and no duplicate creation, second assignment or automatic cleanup occurs.
- [x] #8 Dirty/unpublished/unsafe independent task history, wrong task/provider/path or expected source state, and failed publication remain honest blockers without force, evidence deletion or false success; existing branch-local Backlog and Beads behavior remains unchanged.
- [x] #9 Code-admission safety is distinct from task-status publication: legitimate code base/placement/cleanliness requirements are checked before ownership allocation, not imposed on task-only failure reporting afterward. No ignore/untrack/stash/reset/delete or automatic ownership-commit workaround, generic state/retry/controller machinery or new semantic approval gate is introduced.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Living implementation plan — accepted in-scope integration revision

Continue this SAME PRIMECLAW-53 Episode: operation 379643c7-e888-4881-9cdc-b19ac70459f9, session 01a1a2e6-5172-7694-a0ed-e867cd7e153f, branch JLanders/prime-claw-primeclaw-53-episode-379643c7. The owning Conversation accepted the initial source evidence, then recorded Joe-approved bounded Request Changes for integration with accepted canonical main. Status remains In Progress; no new Episode, source selection, or expanded scope.

1. Completed initial candidate: independent Backlog task-only authoring/publication correction, tracked-ownership/session-failure/noninterference regressions, docs and Docker validation at d33648c17865b00a49e6046c9b93811c3ebd891a. Current published Episode code checkpoint is bb9c1868ee33fffea7b9f7907fc70d702f806dd7. Prior test counts/limits remain historical evidence in docs/evidence/primeclaw53-independent-task-publication.md, not validation of an integrated candidate.
2. Next execute: inspect then-current accepted canonical main and integrate it through ordinary Git into this same Episode, including completed PRIMECLAW-48 and any PRIMECLAW-52 checkpoint admitted before continuation. The earlier read-only preview against 716721fe identified two conflict hunks in spec-episode.ts; do not assume that preview is the current merge or that auto-merged tests are valid.
3. Resolve the actual in-scope conflict manually. Preserve PRIMECLAW-53 independent task-only publisher noninterference/HEAD preservation and all existing native task/store/source-state/path/publication safeguards. Do not reintroduce PRIMECLAW-48 assertCode cleanliness/upstream gates within independent task-only status publication, including auto-merged pre-call assertions. Preserve PRIMECLAW-48 legitimate code-admission/base/integration-branch/resource safety and exact independent code-base identity BEFORE ownership reservation. Preserve all other accepted48/52 changes and Beads/branch-local/retained behavior. No whole-file ours/theirs or scope expansion.
4. Before starting a source-image builder, coordinate the startup window with the owning Conversation to avoid the observed shared mutable-tag/image-capture race. Run focused combined lifecycle/noninterference/native identity regression evidence and mandatory Docker scripts/test-tier1.sh --probe against the actual integrated source. Record actual commands/results/artifacts and baseline limits; do not repair unrelated failures or claim green from auto-merge.
5. Independently commit/push the integrated source candidate and exact native living task evidence, verify clean published code/task clones and unchanged lifecycle identity, then stop for renewed owner review. Do not merge the Episode into canonical main or select another implementation slice.
6. AC5 remains pending owner delivery of only the separately approved accepted-source global Markdown assets. No global Markdown/runtime delivery, activation, restart, new resources, ownership/lifecycle mutation, ADAPT/Nemo work or cleanup. Archived child01a1a2e7 was backed up and removed once through supported native session API with Joe approval; do not recreate it, edit session/action history, or treat the old inventory discrepancy as active work.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PRIMECLAW-53 provisioning blocked after operation b0133363-514c-419e-affc-7fc4b1042d90 allocated the retained Orca worktree/branch from 5c1358b56732869465a1402beb5fa280635122ea. Native creation timed out binding a fresh Prime Agent session to its exact Orca tab. Read-only terminal evidence: guarded launcher expects build cwd-fix-v0.9.8-r1-10-gf80340d93 / source f80340d93dc3b1c6de3459b54a82f351e136f75e; running daemon PID3601 reports cwd-fix-v0.9.8-r1 and launcher states Nothing new was started. No exact-CWD Episode session was found and no implementation is claimed. Ownership remains uncertain and the exact worktree, branch and launch evidence are retained; never retry as fresh creation, send another assignment, or delete/rebind ownership manually. Native fallback Blocked publication failed because its clean-parent-code check encountered the newly written ownership registry; this is a task-only native publication with code/ownership preserved. Unblock condition: coordinate with the runtime owner/operator to resolve the launcher-versus-daemon generation mismatch under separate runtime authority, then explicitly review recovery of THIS exact uncertain operation and existing resources before any continuation. No restart/upgrade/launcher bypass is authorized by PRIMECLAW-53. The six stale template metadata entries were separately repaired and pushed in 5c1358b; skill contents unchanged. Source template correction and global Markdown delivery remain pending.

Joe authorized commit-or-rollback of this Conversation’s pending change and explicit expansion of PRIMECLAW-53 with the diagnosed lifecycle publisher correction. Committed/pushed only the existing uncertain ownership record, bytes unchanged, as fe61016a5eab4a41f7d10fe3ca3996d3bb0d3fc8; rollback would discard evidence of retained allocated resources. No source implementation, resource/runtime mutation or ownership rebind occurred. Revised the already-existing native plan and specification/AC for the expanded scope; status remains Blocked, historical persisted taskEvidence remains unchanged, and no fresh planning/admission/allocation or implementation is implied.

Joe confirmed TASK-2 merged/installed/active; passive status corroborated the expected f80340d93 runtime build. At Joe’s explicit direction, the failed PRIMECLAW-53 worktree for operation b0133363-514c-419e-affc-7fc4b1042d90 was removed through Orca and verified absent from disk, Git and Orca; no bound Episode session was found. Joe then explicitly directed removal of this Conversation’s stale ownership entry; only that entry was removed and committed/pushed as b66581303d477e56caaba13b59ed407f4832de87, preserving other owners. The historical failed allocation is no longer live ownership. Joe now asks to implement the expanded nine-criterion specification and revised living plan. Return this exact task to In Planning for managed implementation readiness, not directly to In Progress. No Episode/resources/assignment have been created by this status update. New readiness must use the current published task, code and selected host id:afb6537c-e643-4a5f-b284-f0f627ddcbdf, not the obsolete failed-allocation task snapshot.

The new managed readiness review found the expanded nine-AC task implementation-ready. Native creation published In Progress in dd9296695b3bf2de79487fa63f12f12fb5a345c5 but then failed before ownership or resource mutation because an unrelated concurrent PRIMECLAW-55 edit hit the installed whole-store task-read gate. Its automatic rollback read failed on the same unrelated edit. Fresh checks found no PRIMECLAW-53 ownership entry or Episode worktree/resources; code main remained clean at 532bc0de5d3b5dbb2ae3c55aff8967403abf1bdc. Restore only this exact task to In Planning, preserving its complete specification, nine AC and living plan. No implementation or resource recovery is claimed. Further creation attempts are paused for bounded author coordination around the known PRIMECLAW-55 tooling defect; unrelated task edits are not a product-level blocker. Existing expanded implementation authority and selected host id:afb6537c-e643-4a5f-b284-f0f627ddcbdf remain unchanged.

Implementation started in the exact active 379643c7 Episode. Audit found parent-code operation/clean/upstream checks inside commitConversationTaskStatus both before and after independent task publication. Source now removes those publisher checks, keeps code HEAD preservation and native task-history helpers, and applies code admission checks in createTaskEpisode before reservation writes ownership. Both canonical authoring blocks now match the approved Description block; docs/backlog.md explains the separation. Focused regression authoring and Docker validation are in progress. No acceptance/test pass, source commit, global delivery, runtime activation or lifecycle change is claimed yet. Personal-brain lookup returned no relevant independent-Backlog record; current task and repository requirements supply this bounded contract.

Candidate source published: d33648c17865b00a49e6046c9b93811c3ebd891a on JLanders/prime-claw-primeclaw-53-episode-379643c7; exact direct remote branch head proved equal, git pull --rebase found already up to date, push reported everything up-to-date, code checkout clean. Seven bounded files: both canonical templates, spec-episode.ts, existing spec-Episode/Markdown tests, docs/backlog.md and docs/evidence/primeclaw53-independent-task-publication.md. Task-only publication did not alter code HEAD/index/worktree.

Validation: scripts/test-tier1.sh --probe passed using the independently verified documented cwd-fix-v0.9.8-r1 source (a1faacd53ac4473a75de1d434afaf50945c2f647), Docker-only, offline product checks, verified teardown. Manifest .test-results/20261103T193459Z-10144-7a477a75/tier1/manifest.json. Focused bridge run initially 3 passed/1 failed; sole Episode-suite failure was new test injection matching git push instead of actual git -C <store> push. Fixed only that test seam. Corrected complete Episode suite .test-results/primeclaw-53-spec-episode.tap: 231 passed, 0 failed/skipped. Backlog admission, Beads admission and task-history bridges passed; task-history Node had 80 passed. Prior-runtime red check .test-results/primeclaw-53-regression-before.tap: both key new tests failed as expected with original clean-parent rejection, including failed Blocked publication after tracked ownership and session-binding error. Focused Markdown tests .test-results/primeclaw-53-markdown-focused.log: 4 passed. Full Markdown .test-results/primeclaw-53-markdown.log: 34 passed/3 failed; the same three failed names reproduced in a disposable git archive of b89111f (log primeclaw-53-markdown-baseline.log). No baseline fixture/local-asset repairs or all-suite-green claim.

AC1-4 and AC6-9 record source-candidate evidence, not merge/deployment. AC5 remains open: exact bounded global Markdown delivery still belongs to owner after accepted source. Template source SHA-256: design.md a601f4e8cda5fe58de169bbb6940eaa906fc7fe1451d59371f48eb0fffcf8df3; spec-it-out.md 8a271b29a70ed90d9669818d9ca971bf849e8ffa86a9c02b73bcd12282ff0793. No user-global file was written; no runtime apply/check/probe/activation/restart, lifecycle change, merge, cleanup, ownership edit or ADAPT/Nemo mutation occurred. Session transport and some ownership observations are test seams; this is not live Orca/daemon UAT. Historical provisioning blockers were not retried or repaired by this source slice.

Owning Conversation reviewed exact source candidate d33648c17865b00a49e6046c9b93811c3ebd891a and accepted its in-scope source evidence. Independent EXPERT openai-codex/gpt-6-astra/max found no material defect. Its focused offline Docker reproduction also proved an eligible existing independent store preserves parent HEAD/index/files/.gitignore/root configuration while dirty and divergent, with exact task-only direct publication; evidence is retained in the owner review transcript/artifacts. Mandatory Docker probe, corrected Episode 231/231, other affected bridges and focused Markdown evidence were verified; three broad Markdown failures reproduce on the clean base and are not claimed fixed. Publish Ready for Merge for the source candidate only. AC5 remains unchecked pending separately authorized accepted-source two-file global Markdown delivery; no runtime installation/activation/restart is authorized or claimed. Operator merge-tuple approval has not been requested or granted. Final merge readiness currently requires resolving the primary main checkout’s uncommitted unchanged admission ownership record and derived project-skill-prepare installed-hash observation without adopting foreign edits; do not force, stash/reset, ignore metadata or alter ownership evidence.

Joe explicitly approved unblocking this SAME PRIMECLAW-53 Episode after coordinated48 merge. Request Changes is bounded in-scope integration, not a new task or scope. Read-only merge preview of accepted48 main716721fe with53candidatebb9c1868 found two conflict hunks in ONE file, extension-support/spec-episode.ts: independent status publication parent-code assertions versus53HEAD-only noninterference, and genuine code-admission helper ordering. Existing tests auto-merged, which is not validation. Integrate then-current accepted main in the same Episode; preserve53 independent task-only noninterference/native task-store safeguards, including removing any auto-merged assertCode cleanliness gates inside that independent publisher, while preserving48 legitimate code-admission/integration-branch/exact-base/resource checks before ownership reservation, plus Beads/branch-local/retained and52behavior. Validate combined runtime/lifecycle regressions and mandatory Docker Tier1 --probe, serialize source-builder setup against other jobs, report honest baseline limits, publish a clean candidate and stop for renewed review. Separately, Joe authorized backed-up supported removal of exact already-deleted archived descendant01a1a2e7-287a-7613-a22f-f59481ab7ecd; completed once via delete_saved_session(methodtrash), native/file absence and unchanged Episode/ownership verified. Private backup retains full transcript and RLM metadata; do not recreate or edit action history. No global Markdown delivery, runtime activation/restart, new resources, unrelated scope or cleanup in this revision. Original Description/nine ACs/six-step contract remain authoritative; AC5 remains owner-delivery pending.

Canonical handoff checkpoint: reconciled persisted and freshly synchronized exact PRIMECLAW-53 native evidence at f5aa982a59926f45b5769d06342ce132c5bfa10d. The owner-authored in-scope integration revision is compatible with the original Description/nine-AC contract and is the next working basis. Updated the living plan for the already-authorized SAME-Episode integration, keeping status In Progress, AC5 pending and all specification/acceptance/native identity fields unchanged. Code checkpoint remains bb9c1868ee33fffea7b9f7907fc70d702f806dd7; no merge, source edit, test/builder launch or resource action occurred during handoff. Canonical main observed at dd693cdc3b5653c95b1e7c4327522b544f5ff066 during handoff is factual context, not a frozen approval revision; execute must inspect the then-current accepted target and coordinate source-builder startup with the owner.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented and published the bounded PRIMECLAW-53 source candidate at d33648c17865b00a49e6046c9b93811c3ebd891a. Independent Backlog authoring and lifecycle task-only publication no longer require clean/upstream-equal parent code. Exact task-history/native publication safeguards remain; code admission is checked separately before reservation. Real disposable-Git tests prove tracked ownership plus failed session binding can publish truthful Blocked evidence while preserving uncertain resources.

Validation: Docker Tier1 --probe passed; corrected Episode suite 231 passed; Backlog admission, Beads admission and task-history bridges passed; focused Markdown 4 passed. Three broad Markdown fixture failures reproduced at the clean base and remain unchanged. See docs/evidence/primeclaw53-independent-task-publication.md for exact commands and limits.

Owner review and accepted-source two-file global Markdown delivery remain pending. AC5 is intentionally unchecked. No global install/runtime activation, lifecycle change, merge or cleanup is claimed.

Current disposition: initial source candidate evidence accepted; bounded Request Changes now requires integrating then-current accepted main, preserving the53 task-only publisher boundary together with accepted48 code-admission/base/resource safeguards and any admitted52checkpoint. Renewed combined validation and owner review remain pending. Initial validation results above do not prove the integrated candidate. AC5 remains pending owner global Markdown delivery; no runtime activation/restart or cleanup is authorized by this revision.
<!-- SECTION:FINAL_SUMMARY:END -->
