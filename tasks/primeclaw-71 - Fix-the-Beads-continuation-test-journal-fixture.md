---
id: PRIMECLAW-71
title: Fix the Beads continuation test journal fixture
status: In Design
assignee: []
created_date: '2026-11-24T20:04:00Z'
labels: []
dependencies: []
references:
  - tests/task_episode_ownership_extension.test.mjs
  - src/prime-agent-plugin/extension-support/task-handoff-observation.ts
priority: p2
type: bug
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Docker test `registered Beads continuation delivers current raw/code/session facts without old design or code-publication approval` in `tests/task_episode_ownership_extension.test.mjs` fails before it sends a handoff. Its disposable `evidenceAdvancementFixture` writes `{"episode":"active"}` as the first row of `episode.jsonl`. The production journal check expects a `type: "session"` header with the exact Episode ID and worktree (`cwd`), so it returns `selected Episode journal identity does not match`. The test also currently reads inline observation tags; check its success assertions against the current journal-reference transport once the fixture reaches delivery.

Reproduced in offline Docker with `node --experimental-strip-types --test --test-name-pattern="registered Beads continuation delivers current" /workspace/tests/task_episode_ownership_extension.test.mjs` on both `57918f84fa99d3035c18061e35379f5e2b1c5db1` and `110e200e5754b2bdb517db3c2c4846cdb7a86c16`. This is a test-fixture failure, not an observed incident in live Beads. Keep the production identity guard intact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The targeted offline Docker test passes and exercises actual handoff delivery with complete raw Beads facts through the current observation contract.
- [ ] #2 Invalid Episode journal identity still refuses delivery; do not weaken or bypass the production identity check.
<!-- AC:END -->
