---
id: PRIMECLAW-74
title: Do not create a redundant repository-root Backlog config during initialization
status: In Planning
assignee: []
created_date: '2026-11-25 00:07'
updated_date: '2026-11-25 01:25'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/6b265cca76aec3272bed7f6120d11b14c44d6ca1/archive/tasks/primeclaw-44%20-%20Make-initialization-skill-led-and-support-existing-Backlog-destinations.md
  - src/prime-agent-plugin/extension-support/task-history-workspace.ts
documentation:
  - docs/project-initialization.md
priority: p1
type: bug
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Joe reports that invoking `/skill:initialize-prime-claw` created a root `backlog.config.yaml` even when it was not needed. The known Prime Claw path and PRIMECLAW-44 name `backlog.config.yml`; verify the exact filename, whether it is a regular file or symlink, and which step creates it. Do not assume that the report was the same artifact or that a migration occurred.

`backlog/` and `.backlog/` are both standard Backlog store directories. Neither needs a `backlog.config.yml` symlink at the repository root. Initialization, template upgrades, repeated reconciliation, and an otherwise authorized move from `backlog/` to `.backlog/` must not create a root Backlog config for either standard location. Preserve native task resolution, settings, IDs, and history. This supersedes the root-symlink instruction in historical PRIMECLAW-44 for the standard-to-standard move; it does not itself authorize any move.

A repository-root `backlog.config.yml` symlink is only needed when it selects a non-standard store directory. Retain existing custom store locations and required configs. Do not delete or rewrite an existing operator config or symlink as a side effect.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 For both standard directories (`backlog/` and `.backlog/`), explicit initialization, template upgrades, and a repeat run do not create either root config spelling as a file or symlink. Where the workflow performs an authorized `backlog/` to `.backlog/` move, it does not create a root config either. Verify native task resolution, settings, IDs and history.
- [ ] #2 Explain the exact artifact and creating step observed in a disposable reproduction, or report what could not be reproduced.
- [ ] #3 A non-standard store selected by an existing required root config or symlink remains selected and unchanged. Do not generate a root symlink unless native Backlog needs it to select a non-standard store, or remove or rewrite existing operator config as a side effect.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Establish a before-fix baseline in a disposable Docker fixture with the supported Backlog CLI and local-only Git remotes. Start with one store and neither root spelling present; exercise explicit reconciliation, including the existing-store preparation path and the otherwise-authorized relocation path separately. Inspect both `backlog.config.yml` and `backlog.config.yaml` with lstat after each step; record the type, link target if any, and the exact writer, or report what could not be reproduced. Planning smoke check: native Backlog created `PCFIX-1` under each standard layout without either root spelling; it did not exercise the initializer. Source inspection found an explicit `.yml` symlink write in `prepareExistingBacklogTaskHistoryWorkspace`; this is a lead, not confirmation of Joe's `.yaml` report.
2. Fix only the initialization/reconciliation paths that generate a redundant root config. For `backlog/` and `.backlog/`, use native store discovery and keep effective settings in the store, including when an already-authorized standard relocation needs its store-local directory setting adjusted. Do not authorize a relocation or change discovery precedence. Retain required nonstandard selection. Do not unlink, overwrite, or silently retarget an existing operator root file or symlink; if a proposed relocation cannot preserve it and native selection together, leave it untouched and report the conflict. Update initialization guidance and existing assertions that require a new root alias for standard layouts.
3. Verify in disposable Docker tests: initial reconciliation, template upgrade, and repeat with each standard layout; an otherwise-authorized default-to-hidden move; and nonstandard selection by an existing regular root config and by a symlink. Assert root-artifact absence where initially absent for standard layouts, unchanged operator bytes/link targets in preservation cases, and native resolution of the same IDs, effective settings, and archived records. Verify retained Git task history where the layout changes and no second live store is left behind. Run focused initialization/task-history regressions and the required Docker Tier 1 check; record the reproduction outcome separately from passing regression coverage. Do not initialize or move a live project for validation.
<!-- SECTION:PLAN:END -->
