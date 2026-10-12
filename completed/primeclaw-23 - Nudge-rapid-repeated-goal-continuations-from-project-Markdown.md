---
id: PRIMECLAW-23
title: Nudge rapid repeated goal continuations from project Markdown
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p1
type: task
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a plugin lifecycle guard that detects rapid repeated structured goal-continuation messages and injects a project-customizable Markdown reminder without hard-coding model guidance in TypeScript. Update goals-and-heartbeats guidance to avoid trivial goals, add focused tests, and validate in Docker.

## Legacy notes

Implementation complete. Validation: full non-container suite 689 passed, 1 skipped, 79 deselected, 75 subtests; full container suite 77 passed, 2 skipped, 690 deselected; offline Docker Node plugin suites 175/175 passed; focused container installer/protocol/new-extension suite 33 passed; bash -n, py_compile, and git diff --check passed. Independent read-only review PASS after adding session_tree reset and <=16KiB regular non-symlink Markdown loading. scripts/test-tier1.sh --probe remains independently blocked before Docker by existing symlink snapshot mode bug, tracked as prime-claw-c6p; the supported full pytest container path passed. No host/global plugin apply or probe ran.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented, independently reviewed, and fully validated in container and non-container suites
<!-- SECTION:FINAL_SUMMARY:END -->
