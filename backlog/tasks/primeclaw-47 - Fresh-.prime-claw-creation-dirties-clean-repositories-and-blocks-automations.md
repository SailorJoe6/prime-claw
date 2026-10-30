---
id: PRIMECLAW-47
title: Fresh .prime-claw creation dirties clean repositories and blocks automations
status: Ready for Merge
assignee: []
created_date: '2026-10-30 15:52'
updated_date: '2026-10-30 17:27'
labels: []
dependencies: []
references:
  - >-
    /Users/jlanders/.prime/agent/session-artifacts/01a0de4f-2028-714b-9cb7-ce4e1db124c3/orca-release-sync-failure-investigation-2026-10-18.md
priority: p1
type: bug
ordinal: 132000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem and confirmed impact
Prime Claw creates `.prime-claw/` during session_start reconciliation and leaves an otherwise clean Git repository dirty because its manifest/workflows are untracked. Clean-worktree automations then refuse to run.

Operator-confirmed incident: Orca installed-release checkout synchronization last succeeded October 11, 2026. Prime Claw session_start reconciliation created `.prime-claw/` later that day. Scheduled runs 10–16 (October 12–18) were `skipped_precheck` before worker dispatch because the manifest/workflows were untracked. Installed Orca advanced to 1.4.229 while the source checkout remained at v1.4.223. No worker existed to send blocked messages. All managed assets matched their recorded hashes; this was not customized-asset drift.

## Operator-approved fix requirement
ONLY when Prime Claw itself creates a previously absent `.prime-claw/` directory, also add the exact root-anchored `/.prime-claw/` rule to that repository/worktree's Git local exclusions (normally `.git/info/exclude`, resolved through Git correctly for linked worktrees). Preserve existing exclusion content and avoid duplicate rules.

If `.prime-claw/` already exists at the START of the operation, DO NOT change Git exclusions, even if the rule is absent. Do not repair or reassert exclusions on later initialization/reconciliation. This preserves the user's ability to remove the rule and deliberately commit `.prime-claw/` without Prime Claw reinstating it.

Do not modify `.gitignore`. Do not commit anything as part of this behavior. Keep the fix inside Prime Claw; Prime Agent is not an implementation target.

## Mitigation and authority
Immediate local mitigation was explicitly authorized and completed: `/.prime-claw/` was added to `/Users/jlanders/code/orca/orca/.git/info/exclude`; Git status is clean. Do not repeat that mutation.

This request authorizes logging this P1 bug only. It does not authorize implementation, planning promotion, Episode creation, commits, or deployment.

## Evidence
Investigation report: `/Users/jlanders/.prime/agent/session-artifacts/01a0de4f-2028-714b-9cb7-ce4e1db124c3/orca-release-sync-failure-investigation-2026-10-18.md`.
Source conversation: ORCA Expert session `01a0de4f-2028-714b-9cb7-ce4e1db124c3`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Fresh creation: with `.prime-claw/` absent at operation start, when Prime Claw creates it during initialization/reconciliation (including session_start), the Git-resolved local exclude file contains the exact root-anchored `/.prime-claw/` rule and `.prime-claw/` alone does not dirty an otherwise clean worktree.
- [ ] #2 Existing folder without rule: with `.prime-claw/` already present at operation start and no `/.prime-claw/` rule, initialization/reconciliation leaves Git exclusions unchanged and the directory remains available for deliberate tracking.
- [ ] #3 User-removed rule: after fresh creation adds the exclusion, remove it while keeping `.prime-claw/`; subsequent initialization/reconciliation, including session_start, does not restore the rule or otherwise modify exclusions.
- [ ] #4 Existing exclusions preservation: fresh creation preserves all existing comments, patterns, and ordering in the local exclude file, adding only the necessary separated rule without overwriting existing content; cover a missing exclude file and existing content without a final newline.
- [ ] #5 Repeated calls and duplicates: fresh creation with `/.prime-claw/` already excluded does not add a duplicate; repeated initialization/reconciliation calls after creation do not change the exclude content further.
- [ ] #6 Worktree-aware Git paths: acceptance tests cover a normal checkout and a linked worktree whose `.git` is a file; resolve the applicable local exclusion path through Git rather than assuming `<worktree>/.git/info/exclude`, and verify Git honors the rule for that worktree.
- [ ] #7 Root anchoring and boundaries: use `/.prime-claw/`, not an unanchored pattern; do not modify `.gitignore`, the index, tracked files, or create commits as part of exclusion handling, and do not hide unrelated untracked content.
- [ ] #8 Creation-only authority: absence alone does not authorize exclusion edits when Prime Claw does not itself create the directory; an existing directory at operation start always prevents exclusion mutation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Scope and accepted decision
The operator subsequently authorized planning and publication of this exact task; the original logging-only request remains historical context. No implementation is authorized by this plan.

Fix only Prime Claw-created, previously absent `.prime-claw/` directories. If the directory existed at operation start, never modify Git exclusions. The operator explicitly chose: if resolving or updating the exclude file fails, continue directory creation/reconciliation and surface a warning that the worktree may remain dirty. Do not retry that exclusion change on later calls while the directory exists.

## Implementation
1. In `extension-support/project-initialization.ts`, place the creation-only exclusion handling at the directory-creation boundary, before the reconciliation lock can make a fresh directory appear pre-existing. Cover the existing direct root creators in `episode-ownership.ts` and `legacy-specification-inventory.ts` with the same creation-only behavior, without changing their ownership or lifecycle rules. If a shared helper is needed, keep it independent of those modules to avoid their existing import chain; register any new shipped source in `asset-inventory.json`. Preserve existing active-Episode skip and path-collision behavior. Only the call that actually creates a directory absent at operation start may add the exclusion; no reconciliation-time repair for existing directories. Keep this ephemeral within the operation: no markers, persistent state machine, retry loop, provider reconciliation machinery, or changes to Prime Agent. Do not add deterministic task reconciliation, iterative plan-update machinery, or code that substitutes for Episode/Conversation semantic judgment.
2. Resolve Git's applicable local exclusion file using `git -C <root> rev-parse --git-path info/exclude`, resolving relative output against that root. Do not assume `.git` is a directory or construct a linked-worktree private exclude path. Preserve the file's existing bytes, comments, patterns, and ordering; append the exact `/.prime-claw/` line only when absent, adding a separator newline when needed. Create a missing exclude file/parent as needed. Never edit `.gitignore`, stage files, or make commits as part of this runtime behavior. Keep Git-owned linked-worktree sharing semantics.
3. Surface any exclusion failure as an observable warning through the existing command/tool and startup notification paths, using only the minimal local callback or result change needed. Do not build a general warning framework. Exclusion errors must not fail initialization or prevent asset creation. Include a concise cause and manual remediation using the Git-resolved exclude path when available. Do not claim the repository is clean after a failed exclusion write, and do not reinstate the rule on subsequent calls.

## Acceptance and validation
4. Extend the existing Docker-executed initialization suite (`tests/project_initialization_extension.test.mjs`, invoked by `tests/test_project_initialization.py`) with real disposable Git repositories and linked worktrees. Cover all eight native acceptance criteria: fresh creation, an existing directory without the rule, user removal followed by later initialization/session_start, preserved comments/patterns and missing/newline-less exclude files, no duplicates or repeated-call changes, Git-resolved worktree paths, root anchoring without hiding unrelated files, and no exclusion mutation without actual creation. Use `git check-ignore` and porcelain status to prove behavior, isolating any other generated assets so the assertion is specifically about `.prime-claw/`. Assert `.gitignore`, index, and HEAD are unchanged by runtime handling. Add failure-path coverage proving an exclusion-write/resolution error warns but asset creation continues, with no later retry once the directory exists; assert the startup warning is visible. Add focused ownership/inventory first-creation regression cases for the paths changed in step 1; do not broaden into an ownership refactor. Preserve existing skip/collision/reconciliation tests.
5. Update `docs/project-initialization.md` and the relevant initialization user story/traceability to describe the creation-only local default, deliberate user opt-in to tracking by removing the exclusion, no repair for existing directories, shared linked-worktree exclusion behavior, and warn-and-continue failure handling. Clarify that Git exclusions do not untrack already tracked files. Run `scripts/test-tier1.sh --probe` after plugin-source changes, including the focused initialization and any affected suites in Docker. Do not apply or probe a candidate against the host/user-global installation. Record actual tests and remaining acceptance results in this same native task during the later implementation Episode; planning does not mark criteria complete.

No new product dependency, task-store migration, live Orca mutation, deployment, or Episode allocation is required by this plan. Implementation requires a separate explicit `/implement-task PRIMECLAW-47` command.
<!-- SECTION:PLAN:END -->
