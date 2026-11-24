---
type: C4 Component
title: Exact resource cleanup
status: stable
groma:
  id: task-episode-cleanup
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
      symbol: CliTaskEpisodeCleanupAdapter
  group: Episode lifecycle
description: Provides adapters to remove only the verified terminal Episode resources.
---

Cleanup follows a separate terminal outcome. It does not decide whether to merge or abandon work.
