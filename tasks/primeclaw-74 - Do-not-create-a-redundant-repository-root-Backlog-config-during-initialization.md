---
id: PRIMECLAW-74
title: Do not create a redundant repository-root Backlog config during initialization
status: In Planning
assignee: []
created_date: '2026-11-25 00:07'
updated_date: '2026-11-25 01:54'
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
1. Reuse the existing disposable Docker initialization fixtures and supported Backlog CLI. Start with the existing-store path that writes a `.yml` symlink; test authorized relocation separately if needed to isolate the write. Inspect both spellings with `lstat`; record the filename, artifact type, target if a symlink, and actual writer, or what could not be reproduced. The native CLI smoke test already found both standard layouts without root config; it did not exercise the initializer or confirm the reported `.yaml` artifact. Do not test against a live project.
2. Prefer removing or narrowly guarding the existing redundant write over adding a replacement path. Let native Backlog discover `backlog/` and `.backlog/`. Reuse the existing relocation/config handling; adjust a store-local setting only if the supported CLI needs it after an otherwise-authorized move. Preserve custom selection and existing operator configs/links; if a move would break them, leave them untouched and report the conflict. Update only the guidance and assertions that require the redundant alias. Do not add a resolver, config abstraction, cleanup migration, persistent state, or state machine. Keep semantic decisions in editable workflow guidance and the LLM; do not add deterministic machinery for task reconciliation, iterative plan revisions, or other Conversation/Episode judgment.
3. Extend existing Docker cases rather than building a new harness or cross-product matrix: exercise initialization, template upgrade, and repeat for both standard layouts, one otherwise-authorized standard move, and existing nonstandard selection via file and via symlink. Check absence of either root artifact when initially absent for standard layouts, unchanged operator bytes/link targets, and native resolution of the same settings, task IDs, and archived records. For the move, verify retained Git task history and no second live store. Run the affected regressions and required Docker Tier 1. Report reproduction separately from regression results.
<!-- SECTION:PLAN:END -->
