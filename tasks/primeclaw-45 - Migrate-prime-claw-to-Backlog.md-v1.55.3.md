---
id: PRIMECLAW-45
title: Migrate prime-claw to Backlog.md v1.55.3
status: In Design
assignee: []
created_date: '2026-10-28 02:59'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/releases/tag/v1.55.3'
  - 'https://github.com/MrLesk/Backlog.md/compare/v1.53.0...v1.55.3'
documentation:
  - docs/backlog.md
priority: p1
type: task
ordinal: 130000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md v1.55.3 is upstream’s current stable release, verified by agreement between the non-prerelease GitHub release and npm `latest` at exact upstream commit `0cf4fdbc70020327f4366a29d3f405f83d180301`. Prime-claw remains built and documented against v1.53.0, and a read-only compatibility review found that advancing the dependency without adapting prime-claw would break provider migration and make task-history evidence inaccurate.

The migration must align prime-claw’s supported CLI/MCP behavior, provider-history conversion, shipped agent guidance, fixtures, distribution pins, and provenance with the v1.55.3 lifecycle. In that lifecycle, a task becomes closed by reaching the configured final status while remaining active; archive is a reversible, read-only off-board state that preserves identity, status, dependencies, and references; restore returns it to the board; delete is the explicit archived-only identity-vacating operation. Legacy `completed/` and canonical `archive/tasks/` records are both archived corpus members until `doctor --fix` migrates legacy storage.

Current incompatibilities include the removed `backlog task complete` call in provider migration, classification of legacy completed records as closed instead of archived, and migration evidence that temporarily relocates archived files into active directories before native viewing. Public docs, installed skills, templates, and tests also teach the obsolete completion flow and old storage path, while build/runtime/submodule/provenance surfaces remain pinned to v1.53.0.

Scope includes the complete prime-claw compatibility change and the managed Backlog candidate/version advance needed to ship it. Preserve the existing single-provider, exact-history, source-authoritative migration guarantees and the Docker-only plugin validation boundary. Do not patch Prime Agent, modify upstream Backlog.md source, move the Backlog.md Expert repository’s separate `latest-stable` branch, weaken migration proof, or introduce a compatibility shim for the removed completion command. Ordering and pagination need only remain correct for prime-claw’s actual identity-set reads; interactive `cleanup` is not part of prime-claw’s workflow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every managed Backlog build, runtime image, submodule/provenance record, fixture, and version assertion consistently identifies a reviewed v1.55.3-compatible candidate whose history contains upstream tag commit `0cf4fdbc70020327f4366a29d3f405f83d180301`.
- [ ] #2 No prime-claw runtime path or shipped instruction treats `backlog task complete` or MCP `task_complete` as available; a migrated closed source task becomes an active task in the configured final status, while only an archived source record becomes archived.
- [ ] #3 Provider inspection, conversion counts, destination state, and receipts classify both legacy `completed/` records and canonical `archive/tasks/` records as archived, and classify closed only from active tasks in the configured final status.
- [ ] #4 Exact source and destination evidence for archived tasks is captured through the native archived-task read surface without moving, copying, or presenting the record as active, including coverage for both legacy and canonical archive storage.
- [ ] #5 Shipped documentation, customizable skills, canonical templates, and their installed mirrors consistently describe final-status edit followed by archive, restore-before-edit, archived-only permanent delete, and `archive/tasks/`; `completed/` appears only as legacy migration input.
- [ ] #6 Migration and lifecycle tests prove identity, status, dependency, parent, documentation, and reference preservation across archive/restore and truthful identity cleanup on delete, including archived tasks whose status is and is not the configured final status.
- [ ] #7 Prime-claw’s task-list consumers remain correct under v1.55.3 default ordering and pagination semantics without depending on implicit row position, and fully specified noninteractive initialization remains successful.
- [ ] #8 The candidate passes the repository’s required migration/lifecycle suites, Tier 0 and Tier 1 Docker validation, Git certificate/private-proxy smoke coverage, and Nix task persistence/build smoke coverage.
- [ ] #9 Failure at any compatibility, provenance, build, or validation gate leaves the currently accepted v1.53.0 artifact authoritative and does not activate or publish a partial v1.55.3 upgrade.
<!-- AC:END -->
