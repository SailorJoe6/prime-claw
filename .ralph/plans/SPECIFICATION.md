# Repository-local `.ralph/plans` cutover with generic legacy workflow preservation

The authoritative specification is Backlog epic `PRIMECLAW-10.38`.

Read it through the supported project interface:

```bash
backlog task view PRIMECLAW-10.38 --plain
```

This repository is moving its own `.ralph/plans` data to the task-native workflow. The generic plugin continues to support the legacy workflow for other initialized repositories. Tracker migration and specification authority are orthogonal; the exact coexistence, routing, compatibility, and cutover requirements live only in `PRIMECLAW-10.38`.

This thin wrapper is superseded as specification authority by `PRIMECLAW-10.38`. It remains only to keep this repository's current active version-1 Episode identity live through bridge candidate review and revision. It defines no independent or additional scope. Revise the Backlog task through the supported CLI instead of duplicating its specification here.
