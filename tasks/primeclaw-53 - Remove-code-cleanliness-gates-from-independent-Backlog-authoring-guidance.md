---
id: PRIMECLAW-53
title: Remove code cleanliness gates from independent Backlog authoring guidance
status: In Planning
assignee: []
created_date: '2026-11-02 22:00'
updated_date: '2026-11-02 22:05'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/skills/project-templates/design.md
  - src/prime-agent-plugin/skills/project-templates/spec-it-out.md
priority: p2
type: docs
ordinal: 138000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome and authority
Correct the canonical and globally delivered Markdown authoring templates so an independent Backlog task store can create, revise and publish tasks without requiring its parent code repository to be clean or upstream-equal. Joe explicitly authorized this bounded documentation correction and global template delivery through ADAPT / Adapt-Hand Expert. His exact instruction was: “We need to fix the skill to make it clear there's no such requirement. We need the fix to be in the global template from prime-claw as well as our local skill file. work with Prime-Claw expert to get that into the global template, fix it locally, delete the unnecessary symlink, commit the .gitignore, create the ticket.”

Adapt-Hand Expert owns ADAPT local changes and reports them completed separately. This Prime-Claw task owns only the source/global Markdown fix. ADAPT-1 is not this work item. Completed PRIMECLAW-51 is not reopened and no terminal Episode may be borrowed. Joe has selected the behavior and replacement wording; no further product-definition approval is needed merely because this request is recorded as a task. The request includes bounded implementation, required safe validation and publication/global Markdown delivery, not a broad runtime refresh or restart. Normal lifecycle/resource admission gates remain in force.

## Confirmed defect and scope
Both src/prime-agent-plugin/skills/project-templates/design.md and spec-it-out.md, in Verify and publish exactly once → Backlog, require canonical code HEAD clean and upstream-equal even for an ignored independent ordinary-Git task store. The nearby unqualified Git-index cleanliness language is also ambiguous. Correct these equivalent authoring sections only; inspect other directly equivalent authoring guidance solely to prevent contradiction, not for a broader refactor.

The following replacement is the exact final ADAPT local block, with pre-write timing confirmed by Adapt-Hand Expert and Prime-Claw51. Use the same semantics and wording in both canonical templates:

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

## Delivery and non-goals
Preserve managed asset identities and the existing native independent-store topology. Retain task/store/root identity checks, clean published independent store BEFORE its native write, exact intended task-path changes afterward, task-store index safety, scoped task-only commits, non-force push and direct-remote proof. Code noninterference is not code cleanliness; concurrent unrelated code changes are not proof this task operation modified them. Do not weaken branch-local authoring behavior or implementation/Episode admission requirements.

Validate candidate source changes only in Docker, including mandatory Tier1 probe after changes under src/prime-agent-plugin. Use focused, proportionate docs/contract regression evidence; no new validation framework. Preserve the dirty .prime-claw/templates.json and any unrelated source/index/runtime work. Report qualified test results honestly.

Publish the bounded source correction through the required normal lifecycle and deliver only the corrected global Markdown assets, using safe existing delivery surfaces if they support that scope. Prove exact destination paths and contents/hashes and absence of unrelated global/runtime changes. Do not run a broad global apply that silently refreshes other assets, do not restart, and do not invent a new delivery controller. If supported delivery cannot safely isolate these Markdown assets, report that concrete constraint rather than broadening scope or claiming global activation. Existing running processes are not claimed restarted; report actual Markdown delivery status separately from runtime activation.

No initializer/runtime/symlink-policy change, no dependency or Prime Agent changes, no live migration, no ADAPT task/source/config mutation, and no changes to completed work. The separately reported unnecessary root-symlink behavior is awareness only, outside this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Canonical design.md and spec-it-out.md authoring guidance consistently uses the agreed Backlog block: unrelated staged, unstaged or untracked code changes and code-branch upstream divergence never block independent native task creation, revision or publication, and never cause code commit/stash/reset/cleanup/sync.
- [ ] #2 Independent task-store clean/direct-remote-equal checks are explicitly PRE-WRITE. Post-write checks allow only the intended exact task path, preserving task/store/root identity, task-store index safety, scoped task-only commit, non-force push and direct-remote publication proof.
- [ ] #3 Parent code HEAD/index/worktree are preserved by task-only authoring; this is noninterference, not a cleanliness requirement. Actual branch-local publication behavior and separate implementation/Episode admission gates remain unchanged.
- [ ] #4 Any directly equivalent authoring contradiction is corrected without broad refactoring or runtime/symlink changes. Candidate validation is Docker-only and includes the mandatory Tier1 probe plus focused proportionate contract evidence; limitations are reported truthfully.
- [ ] #5 Exact bounded source paths/commit/publication evidence and global Markdown destination/content evidence are reported. Only these approved Markdown assets are delivered globally, with unrelated runtime assets, dirty project state and running processes preserved; no broad apply or restart occurs. If safe bounded delivery is unavailable, the real blocker and pending delivery are reported, not silently bypassed.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace only the Backlog “Verify and publish exactly once” blocks in `src/prime-agent-plugin/skills/project-templates/design.md` and `spec-it-out.md` with the final block already approved in Description. Scope Git-index/task-path checks to the selected task store. State clean/direct-remote-equal independent store BEFORE native write, exact intended task-path change afterward, and parent code noninterference instead of code cleanliness/upstream equality. Preserve branch-local publication, Beads authoring, implementation/Episode gates and asset identities. Inspect directly equivalent authoring wording only for remaining contradictions; leave customized local assets and unrelated dirty files unchanged.

2. Add only small focused contract assertions in the existing `tests/test_future_plan_skills.py` coverage (or the existing directly equivalent contract test) for both templates: consistent approved block, pre-write versus post-write timing, unrelated staged/unstaged/untracked code and divergence not blocking, no code-repair action, and unchanged branch-local/admission boundary. This is Markdown contract evidence, not proof of a real native authoring run. No runtime code, controller, generic framework, new state or symlink-policy changes.

3. Validate the isolated candidate in Docker, including `scripts/test-tier1.sh --probe` after the source changes and the focused contract tests through the repository’s Docker test interface. Review the bounded diff, preserve unrelated state and publish the source/test candidate with truthful command/results evidence. Do not run candidate host/global apply/check or native host probes, and do not use live ADAPT or Nemo as fixtures. Record actual outcomes and any baseline limitations in the native task; no unrelated fixes to make a suite green.

4. The owning Conversation reviews and publishes the accepted bounded source through the normal lifecycle, then handles the separately requested Markdown-only global delivery from primary main. Exact asset IDs are `project-skill-design` and `project-skill-spec-it-out`; actual destinations are `~/.prime/agent/skills/project-templates/design.md` and `~/.prime/agent/skills/project-templates/spec-it-out.md`. Deliver only those approved files through a safe existing bounded delivery method, preserving managed ownership consistency and unrelated runtime/assets/processes; never broad-apply or restart. Current `manage-prime-agent-delivery.py apply` rewrites every exact target and exposes no per-asset selector, so do not use it as a hidden broad refresh. If no supported bounded method exists, stop global delivery and report that concrete constraint, without building a delivery feature or falsely claiming activation. Report exact source commit/push, actual destination hashes and unrelated-state checks directly to Adapt-Hand Expert; distinguish source publication, Markdown delivery and runtime activation. ADAPT’s completed consumer work is reported context, not this candidate’s test evidence.
<!-- SECTION:PLAN:END -->
