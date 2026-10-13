---
id: PRIMECLAW-33.12
title: Accept case-insensitive role context aliases
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-13 00:50'
labels:
  - prime-agent-plugin
  - simplification
  - user-stories
dependencies: []
parent_task_id: PRIMECLAW-33
priority: p0
type: bug
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User-global activation on the supported macOS host fails after plugin assets update because the final role reconciler treats AGENTS.md and AGENTS.MD case variants as hard-linked aliases. On the case-insensitive filesystem they are one directory entry (same inode, st_nlink=1), not two hard links. Preserve rejection of genuine candidate hard links (st_nlink>1), accept only same-name case variants that resolve to the one link, add regression coverage, rerun Tier 1, then complete apply/check.

## Legacy notes

Root cause confirmed before repair: candidates() probes AGENTS.md and AGENTS.MD separately, and inspect() classified any identical (st_dev, st_ino) pair as a hard link. On the supported case-insensitive APFS host, both spellings resolve to one directory entry with st_nlink=1; a genuine distinct-name hard link reports st_nlink=2. Added failing-first regression coverage for the simulated one-link case alias and the actual host filesystem. Narrow repair skips only same-casefold candidate names with identical identity and both link counts equal to one; distinct-name or multi-link aliases still fail closed. Focused regressions now pass 2/2; full non-container suite passes 606, 1 skipped.
Committed and pushed b921750 to feature branch and main. Primary main and origin/main match. User-global apply and exact check now pass on the real case-insensitive host; role state migrated from bounded schema-1 final to schema 2 without changing the already-current kernel or unrelated context bytes. Direct regressions pass 3/3, including actual APFS case alias and genuine hard-link rejection. Full static suite before the final added hard-link assertion passed 606/1 skipped; focused suite after it passes 3/3. A fresh Tier 1 attempt was aborted after its own bounded failure reported the Docker daemon was not reachable; do not claim that gate for this follow-up until Docker is available.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Case-insensitive filename variants of one context file are treated as one candidate and do not block apply/check.
- [x] #2 Genuine hard-linked distinct context candidates remain rejected before mutation.
- [x] #3 The change is narrowly covered by tests and the pinned Prime Agent 0.9.8 Tier 1 gate passes.
- [x] #4 User-global apply/check from primary main succeeds without deleting or rewriting unrelated context bytes.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed. The case-insensitive role-context alias fix landed on main in b921750. APFS one-link aliases and genuine hard-link rejection are covered; real user-global apply/check passed; a later pinned Prime Agent 0.9.8 Tier 1 gate passed.
<!-- SECTION:FINAL_SUMMARY:END -->
