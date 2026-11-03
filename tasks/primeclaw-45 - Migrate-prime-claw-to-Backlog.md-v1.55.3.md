---
id: PRIMECLAW-45
title: Migrate prime-claw to Backlog.md v1.55.3
status: In Progress
assignee: []
created_date: '2026-10-28 02:59'
updated_date: '2026-11-03 18:12'
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

The historical reversal and migration mapping are explicit:

| v1.53 source state or intent | v1.55.3 representation |
| --- | --- |
| Active task in a non-final status | Open active task in the same non-final status |
| Active task in the configured final status | Closed active task in that final status |
| Record stored under legacy `completed/` | Archived record preserving its final status and history |
| Record stored under `archive/tasks/`, including an old cancellation or soft deletion | Archived record preserving its status and history; migration never silently deletes it |
| Future operator intent to permanently discard a record, clean relationships, and vacate its identity | Explicit archive followed by archived-only `task delete` |

Thus the old archive command’s destructive identity-cleanup meaning moves to explicit `delete` for future operations, while pre-existing archived and completed records are preserved during migration. “Closed” remains a status-derived classification, not a storage directory or a replacement native status.

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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approved scope and specification clarifications

Implement the complete prime-claw compatibility change against Backlog.md v1.55.3, exact upstream tag commit `0cf4fdbc70020327f4366a29d3f405f83d180301`. The following operator decisions supersede the conflicting PRIMECLAW-44 policy and clarify the acceptance criteria:

- Archive retains/reserves identity; only explicit archived-only delete vacates it. Both `completed/` and `archive/tasks/` are archived history, not active closed tasks.
- Existing duplicate IDs, including archive/live collisions formerly allowed by PRIMECLAW-44, refuse before cutover. Report exact conflicts and preserve source and destination baseline unchanged. Repair, renumbering, and automatic `doctor --fix` are outside this task.
- A successful merged Episode remains active `Done` through `finalize_task_episode`; optional archive comes afterward. AC5 does not require immediate archive or an archived-Done finalizer extension. Preserve archived non-Done abandonment plus its exact Final Summary contract.
- Beads imports map source status normally (`closed` -> `Done`), then archive only from explicit source archive/abandonment evidence. Preserve raw source status, closure reason, and abandonment provenance; do not force archived imports to `In Progress` or infer a lost pre-close status.
- Adopt native v1.55.3 dependency eligibility, including archived and draft targets. Retire PRIMECLAW-44's custom exclusions rather than porting its downstream patches.

No Prime Agent or Backlog source changes, removed-command shim, reverse-migration revival, interactive cleanup, new provider framework, reconciliation state machine, semantic classifier, or persistent approval/checkpoint store. Do not implement deterministic task reconciliation, iterative plan revision, or semantic compatibility decisions. Episode and Conversation LLMs own that reasoning; code enforces only concrete identity, integrity, and transport constraints. Add only narrow native read/identity/transport adaptations required below. The implementation candidate must not move the Backlog Expert's separate `latest-stable` branch or activate a host/global artifact.

## Implementation slices

### 1. Establish the exact release and reproducible candidate (AC1, AC9)

In the isolated implementation workspace, retrieve and verify upstream `refs/tags/v1.55.3` resolves to the exact commit above; pin `deps/backlog` to that unmodified source. Do not replay the three v1.53.0 downstream restore/dependency patches: their policy is superseded. Current local `431e95612d6167e418c507ec206d95df43c38c54` and accepted host artifact remain the fallback, not the new source.

The target object is currently absent locally and the managed fork exposes no v1.55.3 tag. Use the verified upstream repository for this unmodified release and align the submodule URL plus any Docker fetch source; do not assume the fork exposes the object or move/publish an Expert branch. Update `scripts/build-backlog.sh`, `docker/runtime.Dockerfile`, both build/runtime ARG sets in `docker/test.Dockerfile`, `tests/test_backlog_build.py`, runtime source-identity assertions, build stamps/labels, and current provenance together. Require exact HEAD and exact release-tag resolution/ancestry, frozen install, version stamping, standalone compilation, and upstream compiled-binary smoke. Replace the obsolete fixed four-commit fetch expectation with the correct exact release fetch. Use upstream's documented/CI-selected Bun `1.4.4` for the isolated Backlog build/tests, updating the Backlog builder pins and matching assertions rather than assuming existing `1.3.11` compatibility. Keep other dependency/runtime versions unchanged unless an actual compatibility defect requires review; in particular, do not upgrade Prime Agent's Node runtime. Only if changes to the corresponding tooling integration require upstream build-security/updater regressions, use isolated Node `26.12.1` or later and upstream-selected npm `12.2.1` for those tests. Do not require extra Node/npm tooling solely to consume the compiled Backlog release. These are supported-tool selections, not package `engines` requirements.

### 2. Convert provider-history reads and writes to native lifecycle semantics (AC2–4, AC6)

In `extension-support/task-provider-migration.ts`:

- Classify active final-status tasks as closed; classify every record from either archive directory as archived, regardless of status. Keep the existing supported canonical lifecycle ending in `Done`; do not introduce generic lifecycle configuration work.
- Replace `archivedBacklogViews`' clone-and-relocate behavior with native `backlog task view --json -- ID`, which v1.55.3 supports for archived records. Read source/destination records at their actual committed paths. Preserve complete native views, relation context, original paths, and history; never manufacture an active view or silently migrate legacy storage.
- Remove `task complete`, completed-directory preparation, and closed-placement expectations. Closed Beads records remain active `Done`; explicitly archived records receive the normal mapped status before native archive. Re-read the final native record in its real location and retain lossless source evidence in the existing history package/receipt.
- Remove obsolete archived/draft dependency-target exclusions. Keep native missing/ambiguous-ID and relationship safety checks; do not build a parallel graph-policy engine. Before allocation/writes, reuse supported native checks and the existing migration inventory to detect identity conflicts across active tasks, legacy/canonical archives, and drafts. Do not build a parallel identity index, custom allocator, or duplicate corpus-discovery framework. Native ambiguity or any source/destination collision must refuse with exact diagnostics, no automatic repair, no publication/cutover, and unchanged original baseline.
- Preserve the existing one-way Beads->Backlog transaction: source authoritative until exact destination verification and publication, same active version-2 ownership/resources, one destination-native receipt, no dual write/retry/second destination. Update classification/counts/readback/receipt assertions consistently without weakening baseline byte/history preservation or source-deletion ordering.

### 3. Prove lifecycle and migration behavior with the real candidate (AC2–4, AC6–7)

Update `tests/task_provider_migration.test.mjs` and its pytest bridge. Replace old completed-placement, forced-In-Progress archive, artificial active-read, and archive-ID-reuse expectations. Use valid nonduplicate populated baselines to prove native allocation and preservation. Add refusal cases for old archive/live duplicates and other contested IDs, proving no source deletion, baseline mutation, or cutover. Cover both `completed/` and `archive/tasks/` in forward destination-baseline migration; leave intentionally retired reverse-migration suites retired.

Reuse existing upstream archive/read/restore/delete tests. Add only representative integration cases at prime-claw's migration and lifecycle seams for Done and non-Done records, preserving IDs, status, dependencies (including archived/draft targets), parents, documentation, references, and original history. Do not duplicate Backlog's entire lifecycle suite or build an exhaustive cross-product of native behaviors. Prove archived records are read-only until restored, archive/restore keeps allocation reserved, and only delete vacates identity and performs native relationship cleanup. Exercise the existing `tests/spec_episode_extension.test.mjs` merged active-Done cleanup and archived non-Done abandonment contracts; assert the lifecycle instructions keep Done active until cleanup, rather than broadening the finalizer.

Keep task-list consumers as complete, unwindowed JSON identity-set reads, never row-position assumptions. Add/revise representative ordering/windowing regressions only where actual consumers need them. Prove fully specified noninteractive init for supported layouts/custom native configuration; no interactive cleanup dependency.

### 4. Update normative guidance and managed assets (AC5)

Update `docs/backlog.md`, provider migration/initialization and Episode-finalization guidance, repository skills, inert canonical templates, and their managed project/test mirrors. Use final-status edit for closure, optional post-cleanup archive, native archived view, restore-before-edit, and explicit archived-only permanent delete. `archive/tasks/` is canonical storage; mention `completed/` only as preserved legacy archive input. Explain native archived/draft dependencies, reserved archived IDs, and collision refusal. Remove actionable `task complete`/`task_complete` guidance, not historical evidence of the old behavior.

Keep PRIMECLAW-44's evidence historical and intact; clearly supersede its policy in current normative docs and record the new exact source/provenance. Update relevant user-story/acceptance traceability. Use supported isolated asset generation/checks; preserve unrelated customization, including the preexisting dirty `.prime-claw/templates.json`. Do not apply candidate assets to the host/user-global plugin or claim live mirrors have been activated.

### 5. Validate the integrated candidate and report evidence (AC8–9)

Run the existing focused native Backlog lifecycle/dependency/archived-folder and Git trust regressions plus the supported build/compiled smoke against the exact candidate; add new coverage only at changed prime-claw integration seams. Run prime-claw Tier 0 (`python3 -m pytest tests/ -q`) and Tier 1 (`python3 -m pytest tests/ -q -m container`), including the real migration and lifecycle bridges. After every plugin-source change, run the required Docker Tier-1 validation (`scripts/test-tier1.sh --probe` or the container suite); no host/global apply/check or candidate Prime Agent probe. Use `scripts/run-prime-agent-probe.sh` for isolated native probes.

Git trust/private-proxy smoke: from the isolated exact upstream source, run `bun test --timeout=10000 src/test/git-certificate-trust.test.ts` with the supported upstream Bun/Git environment. Its local TLS proxy must receive exactly one request and return the expected HTTP 502/nonzero Git exit; this proves native Git trust/proxy handling, not a successful external fetch. Use the committed public test fixtures and loopback TLS only, never live credentials, TLS bypass, or host credential stores. Keep updater/build-security helper regressions conditional on changes to their corresponding tooling integration; they are not acceptance gates for unchanged upstream tooling. Do not run the mutating `update-nix` generator or rewrite its lock merely to validate.

Nix: use a supported isolated native builder (`x86_64-linux`, `aarch64-linux`, or `aarch64-darwin`) with flakes, network trust and normal Nix permissions. Run `nix build .#backlog-md --print-build-logs`, verify `./result/bin/backlog --version` is exactly `1.55.3`, run its help, and verify the existing native package build/persistence smoke. Retain exact derivation/build logs proving the flake's existing installCheck ran `scripts/smoke-compiled-build.ts`: it creates, reads/lists, edits and rereads a persisted temporary task and proves a failed write exits nonzero, while exercising the actual patched dependency build. Cached success alone does not prove fresh smoke execution. The development-tools check, full `nix flake check`, and development-shell CA-preservation assertion are conditional on changes to those tooling/packaging surfaces, not additional acceptance gates for consuming the unchanged upstream release. Preserve caller trust settings. Reuse native entry points, not a new Nix framework. This checkout supplies no Nix harness/builder: execution evidence is an explicit implementation prerequisite; lack of a supported runner is a blocker, not permission to waive AC8 or substitute a Docker-only Bun smoke.

Record exact source, build/toolchain and image identities, commands, pass/fail counts, and evidence paths in a bounded repository evidence note and the living task plan/notes. A skipped, unavailable, or failing required smoke is not acceptance. Stop before activation on any compatibility/provenance/build/validation failure; keep accepted v1.53.0 authoritative. Do not weaken a required gate or add unrelated fixes to call the upgrade successful.

## Completion boundary

Deliver a reviewable, committed/pushed prime-claw candidate with complete compatibility/provenance/validation evidence; no additional planning follow-up task. A later explicit operator decision owns merge, accepted host-artifact deployment, user-global refresh, coordinated restart/UAT, and any real data migration or repair. This planning request itself authorizes none of those actions and creates no Episode.
<!-- SECTION:PLAN:END -->
