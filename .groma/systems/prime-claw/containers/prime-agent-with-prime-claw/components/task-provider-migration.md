---
type: C4 Component
title: Task provider migration
status: stable
groma:
  id: task-provider-migration
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/task-provider-migration.ts
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/beads-backlog-current.ts
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/migration-backlog-web.ts
    - scanner: javascript
      file: src/prime-agent-plugin/extension-support/vendor/yaml/yaml.cjs
  group: Project and task setup
description: Inspects and, on explicit approval, transfers Beads history to Backlog.
---

Verifies destination evidence before the authority switch. Native task projections, review UI support, and the bundled YAML parser support the same migration boundary.
