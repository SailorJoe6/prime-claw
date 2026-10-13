---
id: PRIMECLAW-10.37.4
title: >-
  Preserve customized project templates during read-only diff review and
  simplify hash state
status: To Do
assignee: []
created_date: '2026-10-13 14:34'
labels:
  - project-initialization
  - templates
  - safety
dependencies: []
references:
  - PRIMECLAW-10.37.2
parent_task_id: PRIMECLAW-10.37
priority: p1
type: bug
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

Prime Claw currently documents and implements customized-template review by temporarily overwriting the project-level Markdown file with the globally installed canonical template, opening an Orca working-tree diff, and restoring the project file afterward. That workaround is unsafe: as soon as a discoverable skill or lifecycle workflow is overwritten, running or newly started agents can consume different instructions. Cancellation, failure, or interruption can also leave the project copy changed.

The project manifest also stores multiple per-asset hashes (`baselineSha256`, `installedSha256`, `availableUpstreamSha256`, and `acceptedOverrideSha256`). The intended customization detector needs one canonical baseline SHA per managed Markdown asset, not parallel hash state.

## Required behavior

Project initialization may calculate SHA-256 directly from the currently globally installed canonical template bytes. Each project stores exactly one SHA per managed Markdown asset: the canonical text hash against which that project file was last installed or safely upgraded.

On reconciliation, hash the current project file and compare it with that saved canonical baseline. If they differ, treat the project file as customized and preserve its bytes exactly. Do not overwrite, stage, commit, rename, hold, or restore it for comparison.

When comparison is requested, create a read-only Git diff between the current globally installed canonical template text and the current project-level customized text, then present that comparison through a supported Orca diff viewer. The comparison mechanism must not depend on manufacturing a working-tree modification. A terminal diff may remain a read-only fallback.

Migrate existing multi-hash manifests to the one-hash representation without losing customization or silently changing any project Markdown. Remove the temporary-overwrite review contract from code, tests, skills, workflows, and documentation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each managed project Markdown asset stores exactly one SHA-256 value in `.prime-claw/templates.json`, representing the globally installed canonical text against which the project copy was last installed or safely upgraded; the former baseline/installed/available-upstream/accepted-override hash multiplicity is removed.
- [ ] #2 Reconciliation computes the current project-file hash and compares it with that one saved canonical SHA before any write. A mismatch is classified as customization and preserves the project file byte-for-byte.
- [ ] #3 Customized-template comparison is read-only: it compares the current globally installed canonical bytes with the current project bytes using Git and presents the result through a supported Orca diff viewer without overwriting, staging, committing, renaming, holding, or restoring the project path.
- [ ] #4 Cancellation, viewer failure, process interruption, and repeated initialization leave customized project Markdown byte-identical and create no temporary working-tree mutation for agents to observe.
- [ ] #5 Existing multi-hash project manifests migrate deterministically to the one-hash schema without overwriting customized files; ambiguous legacy state fails closed and reports the affected asset.
- [ ] #6 Explicit reset, if retained, remains a separately authorized content replacement and is not used to manufacture a comparison. Comparison alone never grants reset or override authority.
- [ ] #7 Tests cover discoverable skills and internal workflows, unchanged managed updates, customized preservation, manifest migration, Orca comparison success/cancel/error/interruption, and the read-only terminal fallback.
- [ ] #8 All active documentation and managed guidance remove the temporary overwrite/hold/restore review requirement and state that customized project assets remain untouched during comparison.
<!-- AC:END -->
