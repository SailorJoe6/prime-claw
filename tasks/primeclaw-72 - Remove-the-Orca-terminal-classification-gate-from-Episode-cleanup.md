---
id: PRIMECLAW-72
title: Remove the Orca terminal classification gate from Episode cleanup
status: In Design
assignee: []
created_date: '2026-11-24T22:03:00Z'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
  - >-
    https://github.com/SailorJoe6/prime-claw/commit/110e200e5754b2bdb517db3c2c4846cdb7a86c16
priority: p2
type: bug
ordinal: 156000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During merged PRIMECLAW-69 cleanup on main 110e200e, finalize_task_episode refused with “Task Episode cleanup found a foreign primary Orca terminal identity.” Direct Orca show and inventory matched the recorded terminal handle and Episode worktree and reported agentIdentity=prime-agent. The cause of the discrepancy was not established. Cleanup only completed after Joe manually removed the terminal and asked to finish.

Joe explicitly does not want terminal classification as an Episode cleanup feature. Remove the label-based refusal in task-episode-cleanup.ts rather than adding a classifier, relabeling step, manual terminal removal, or a new approval path. Keep cleanup scoped to the exact owned resources and preserve unrelated resources.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Authorized cleanup of a finished Episode with the recorded Orca terminal still present does not depend on Orca’s agentIdentity label and does not require manual terminal removal.
- [ ] #2 An offline regression covers an exact owned terminal with missing or different classification; actual resource identity mismatches remain protected.
<!-- AC:END -->
