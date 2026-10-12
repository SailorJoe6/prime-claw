---
id: PRIMECLAW-24
title: Fix tier-1 provenance snapshot mode drift for skill symlinks
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p1
type: bug
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
scripts/test-tier1.sh fails before Docker in both source and pinned modes because scripts/testing/provenance.py reports captured repository mode changed for .agents/skills/blocked, a tracked symlink to .ralph/skills/blocked. Reproduce on current main, correct snapshot preservation/verification without weakening path safety, and restore the canonical --probe validation path.

## Legacy notes

Resolved 2026-10-09. Root cause: tier-1 sets umask 077; Darwin applies umask to newly created symlink permission bits, so a tracked 0755 skill link was copied as 0700 and rejected even though symlink type and target were unchanged. Repository manifests now canonicalize symlink mode as 0777; snapshot and source-builder verification authenticate symlink type and target rather than non-portable permission bits. Regular-file mode/inode/digest checks and all no-follow/path-safety checks remain strict. Regression covers source link creation under umask 022 and snapshot creation under umask 077. Validation: focused provenance/source-builder suite 81 passed, 60 subtests; maintained host suite 654 passed, 1 skipped, 75 deselected, 75 subtests; canonical pinned 0.9.8 scripts/test-tier1.sh --probe passed with offline RPC probe, teardown, and manifest publication; git diff check, Python compile, and shell syntax passed.
Final exact maintained Tier 0 also passed: 654 passed, 76 skipped, 11 warnings, 75 subtests in 60.00s. An independent read-only review of the full combined diff reported no material correctness or security findings; its focused validation passed 90 tests, 29 skipped, and 60 subtests.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Portable symlink provenance fixed and canonical Tier 1 restored
<!-- SECTION:FINAL_SUMMARY:END -->
