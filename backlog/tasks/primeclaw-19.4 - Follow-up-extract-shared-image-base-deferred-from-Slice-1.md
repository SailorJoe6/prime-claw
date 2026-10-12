---
id: PRIMECLAW-19.4
title: 'Follow-up: extract shared image base (deferred from Slice 1)'
status: To Do
assignee: []
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-19
priority: p2
type: task
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Per spec escape hatch: runtime image derives FROM the OpenShell sandbox base (ghcr.io/nvidia/openshell-community/sandboxes/base, Ubuntu 24.04) and installs no Node, so there is no non-trivial base layer shared with docker/test.Dockerfile (plain ubuntu:24.04). Dockerfile-level shared-base extraction deferred; lineage is the common Ubuntu 24.04 baseline only. Revisit if both images grow duplicate base tooling.
<!-- SECTION:DESCRIPTION:END -->
