# `.ralph` — retained runtime configuration

This builder repository uses Backlog tasks as its specification, planning,
progress, blocker, and outcome authority. Its repository-local `.ralph/plans`
tree was removed after the tracked content was migrated and pinned to durable
Backlog owners and Git provenance.

Project skills and lifecycle workflows live outside `.ralph`:

- regular customizable skills live under `.agents/skills/`;
- lifecycle-only workflows live under `.prime-claw/workflows/`; and
- the retired `.ralph/skills/` layout is migrated by project initialization.

The generic Prime Claw plugin still supports `.ralph/plans` for initialized
projects that retain version-1 folder workflows. That compatibility does not
make this builder repository's `.ralph` directory a planning authority.
