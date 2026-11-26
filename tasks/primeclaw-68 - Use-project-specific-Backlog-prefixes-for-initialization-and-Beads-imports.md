---
id: PRIMECLAW-68
title: Use project-specific Backlog prefixes for initialization and Beads imports
status: In Design
assignee: []
created_date: '2026-11-23 21:28'
updated_date: '2026-11-26 18:12'
labels: []
dependencies: []
type: task
ordinal: 152000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prime Claw currently seeds new Backlog stores with the generic task prefix in initialization and Beads-to-Backlog migration. Select and validate a project-specific Backlog task prefix before either path creates destination records. Make the selected prefix visible in workflow guidance and previews; never silently fall back to TASK. Preserve the configured prefix and all existing IDs when initializing against an existing Backlog store or reconciling an upgrade. Renaming an existing Backlog store belongs to a separate migration skill, not either automatic flow. Preserve the current provider-switch confirmation, source retention and identity verification rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Fresh initialization creates a Backlog store with a valid project-specific prefix and the first task uses it; missing or invalid selection does not silently create TASK IDs.
- [ ] #2 A disposable Beads-to-Backlog switch uses the same resolved destination prefix in preview and destination records; imported relationships resolve and the existing switch recovery and verification contract still holds.
- [ ] #3 Rerunning initialization or upgrade against existing Backlog leaves its prefix and task IDs unchanged.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-11-26 18:12
---
Still open: c54ace0c/eafeee25 added an existing-store prefix rename skill, not prefix selection before fresh initialization or Beads import. Do not rename existing stores in this task.
---
<!-- COMMENTS:END -->
