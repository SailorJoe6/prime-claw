---
id: PRIMECLAW-74
title: Do not create a redundant repository-root Backlog config during initialization
status: In Design
assignee: []
created_date: '2026-11-25 00:07'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/6b265cca76aec3272bed7f6120d11b14c44d6ca1/archive/tasks/primeclaw-44%20-%20Make-initialization-skill-led-and-support-existing-Backlog-destinations.md
documentation:
  - docs/project-initialization.md
priority: p1
type: bug
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Joe reports that invoking `/skill:initialize-prime-claw` created a root `backlog.config.yaml` even when it was not needed. The known Prime Claw path and PRIMECLAW-44 name `backlog.config.yml`; verify the exact filename, whether it is a regular file or symlink, and which step creates it. Do not assume that the report was the same artifact or that a migration occurred.

For an existing Backlog project where the supported native CLI already resolves the intended store and configuration from the repo root with no root config, ordinary initialization, template upgrades, and repeated reconciliation must leave the root config absent. Preserve the store, settings, IDs and history. Do not delete or rewrite an existing operator config or link as a side effect. PRIMECLAW-44 describes moving the default dedicated `backlog/` store to `.backlog/` with a native root configuration symlink. Keep that case distinct from refreshing a project whose existing store already works without one. Only create a root config when native resolution actually requires it for the intended, authorized setup or relocation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With an existing working `.backlog/` store discovered natively and neither root spelling present, explicit initialization/upgrade and a repeat run create neither `backlog.config.yml` nor `backlog.config.yaml`, whether as a file or symlink. Native task resolution and existing settings, IDs and history remain unchanged.
- [ ] #2 Explain the exact artifact and creating step observed in a disposable reproduction, or report what could not be reproduced. Distinguish ordinary reconciliation from a relocation requiring a root link.
- [ ] #3 Existing required root configs or symlinks and configured custom stores remain intact. Where an authorized relocation actually needs a root config, verify native resolution without changing the intended store or losing history.
<!-- AC:END -->
