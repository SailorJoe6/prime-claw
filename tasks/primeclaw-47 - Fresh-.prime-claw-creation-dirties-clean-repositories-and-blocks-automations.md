---
id: PRIMECLAW-47
title: Fresh .prime-claw creation dirties clean repositories and blocks automations
status: In Design
assignee: []
created_date: '2026-10-30 15:52'
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
