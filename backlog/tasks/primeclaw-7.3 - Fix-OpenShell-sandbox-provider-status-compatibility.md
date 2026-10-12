---
id: PRIMECLAW-7.3
title: Fix OpenShell sandbox provider status compatibility
status: To Do
assignee: []
created_date: '2026-10-12 01:00'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-7
priority: p2
type: bug
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Read-only live status on the installed OpenShell CLI fails because bin/prime-claw calls `openshell sandbox provider list <name> --output json`, but that subcommand supports no --output flag. Manual plain-text provider listing succeeds and the sandbox is healthy. Fix with a version-compatible read-only attachment query/parser, preserve unrelated-provider reconciliation semantics, and add offline coverage. This is independent of R3a-16/Slice 4R.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bin/prime-claw status reports selected/missing/stale managed sandbox attachments on the installed OpenShell CLI without unsupported flags; parser is offline-tested; no credentials or private endpoints are printed.
<!-- AC:END -->
