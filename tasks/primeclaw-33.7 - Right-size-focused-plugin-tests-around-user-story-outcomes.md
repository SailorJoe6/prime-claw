---
id: PRIMECLAW-33.7
title: Right-size focused plugin tests around user-story outcomes
status: To Do
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - low-hanging
  - prime-agent-plugin
  - simplification
  - testing
  - user-stories
dependencies:
  - PRIMECLAW-33.3
  - PRIMECLAW-33.12
  - PRIMECLAW-33.9
  - PRIMECLAW-33.4
  - PRIMECLAW-33.5
  - PRIMECLAW-33.6
  - PRIMECLAW-33.11
parent_task_id: PRIMECLAW-33
priority: p2
type: task
ordinal: 113000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Some direct plugin tests assert prose fragments, source cardinality, test names, copy ordinals, and private CLI choreography instead of story outcomes. This blocks harmless simplification. The US-05 review also has one confirmed implementation mismatch. A broad whole-suite cleanup is out of scope.

## Work
Use the story traceability matrix to remove only low-value assertions made redundant by behavioral tests. Align US-05 with DD-001: a clean tracked asset uses the required Orca side-by-side flow and exact restoration; an already-dirty asset is not overwritten and immediately receives native Git-diff fallback; if Orca fails on a clean asset, restore it and then gracefully fall back to native Git diff. Neither fallback may explicitly disable the user's configured Git diff experience. Preserve US-14's existing outcome that the visible Prime Agent tab remains open and usable after its one-time startup helper is removed. Replace partial-install copy-ordinal injection with directly seeded mixed-generation evidence where suitable.

## Legacy design

Retain short semantic authority sentinels where model-facing wording is the only available contract. Preserve Docker isolation and pinned 0.9.8 native discovery. Do not optimize for test LOC at the expense of US-27 or lifecycle ambiguity coverage.

## Legacy notes

Primary scope is `extension-support/template-review.ts`, its command/tool adapter and direct tests, plus direct plugin/lifecycle/install tests made redundant by this epic. DD-001 is authoritative for US-05 semantic priority and its two paths. Preserve repository-wide isolation guards and pinned-runtime gates; this is not authority for general test-tree cleanup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every deleted assertion is redundant with named behavioral evidence or no longer supports a story.
- [ ] #2 A clean US-05 review still produces the required Orca side-by-side comparison and restores exact original bytes.
- [ ] #3 An already-dirty asset remains byte-for-byte untouched and receives native Git comparison.
- [ ] #4 Clean-file Orca failure restores exact original bytes before native Git comparison.
- [ ] #5 Neither fallback passes `--no-ext-diff` or otherwise disables configured diff UX.
- [ ] #6 US-14 still leaves the visible Prime Agent tab open and usable after launch.
- [ ] #7 No whole-suite cleanup or unrelated safety machinery is introduced.
- [ ] #8 Normal Node, host, container, and exact supported-runtime gates pass, and removed test LOC is reported.
<!-- AC:END -->
