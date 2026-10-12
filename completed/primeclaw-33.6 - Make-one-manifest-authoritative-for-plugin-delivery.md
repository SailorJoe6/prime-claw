---
id: PRIMECLAW-33.6
title: Make one manifest authoritative for plugin delivery
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - assets
  - installer
  - prime-agent-plugin
  - simplification
  - user-stories
dependencies:
  - PRIMECLAW-33.2
parent_task_id: PRIMECLAW-33
priority: p2
type: task
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Asset truth is duplicated across `asset-inventory.json`, apply/check allowlists, global special cases, retired-file lists, and tests. The duplication itself risks copying, checking, or retiring different generations.

## Work
Define one machine-readable delivery authority that drives apply, check, reconcile, destination class, ownership/customization policy, and retirement of previously owned files. Model plugin-root, user-skill, selected-context marked block, and project-template destinations explicitly. Persist or otherwise derive the prior owned-file set so retired paths do not become a permanent tombstone list.

## Legacy design

The manifest is data, not a second installer. Apply and check share interpretation. Keep global drift decisions and project customization semantics, but remove descriptive fields that do not drive behavior unless they remain useful documentation.

## Legacy notes

Implemented schema-2 asset-inventory.json as the single delivery authority for all 29 ordinary shipped sources plus the gate-retained role protocol selector. Apply/check now share manage-prime-agent-delivery.py, persist digest-bound ownership, retain distinct exact/drift/user/selected-context/project policies, and safely retire global and project assets. Immediate schema-1 predecessor cleanup is bounded by historical SHA-256 evidence; changed, unsafe, symlinked, or unknown paths fail before mutation. Check validates managed bases and full current/prior parent chains. Backup-reset validates backup ancestry before role/delivery mutation. Cutover inventory derives current topology from the manifest, retains exact historical migration absence evidence, and bundles an integrity-covered manifest snapshot so the copied restore tool remains self-contained. Bridge/final role protocol and retired EXPERT cleanup remain gate-retained for tqm.8/.9. Validation: focused Docker 35/35; schema upgrades 4/4; backup preflight 1/1; current/prior symlink checks 2/2; consolidated retirement suite 10/10; static affected suites 125/125 and cutover 120/120; pinned Prime Agent 0.9.8 Tier1 PASS at .test-results/20261011T185440Z-15608-2d2f9c75/tier1; independent release review PASS. Line accounting: production source -105, tests +104, net source/test -1; docs +8.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every shipped asset is represented exactly once.
- [ ] #2 Apply and check consume the same authority.
- [ ] #3 Formerly owned files are detected/pruned without an ever-growing hard-coded obsolete list.
- [ ] #4 User-level goals skill, selected role block, global skills, and customizable project assets retain distinct policies.
- [ ] #5 Mixed/incomplete generations still fail exact checking.
- [ ] #6 Net source/test reduction is reported.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Manifest-authoritative delivery implemented and independently validated
<!-- SECTION:FINAL_SUMMARY:END -->
