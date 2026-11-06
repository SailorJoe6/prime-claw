---
id: PRIMECLAW-45
title: Migrate prime-claw to Backlog.md v1.55.3
status: In Progress
assignee: []
created_date: '2026-10-28 02:59'
updated_date: '2026-11-06 15:25'
labels: []
dependencies:
  - PRIMECLAW-55
references:
  - 'https://github.com/MrLesk/Backlog.md/releases/tag/v1.55.3'
  - 'https://github.com/MrLesk/Backlog.md/compare/v1.53.0...v1.55.3'
documentation:
  - docs/backlog.md
  - docs/evidence/primeclaw45-upstream-candidate-20261106.md
modified_files:
  - .gitmodules
  - bin/prime-claw
  - deps/backlog
  - docker/runtime.Dockerfile
  - docker/test.Dockerfile
  - docs/README.md
  - docs/backlog.md
  - docs/evidence/primeclaw45-upstream-candidate-20261106.md
  - scripts/build-backlog.sh
  - tests/project_initialization_extension.test.mjs
  - tests/task_providers.test.mjs
  - tests/template_review.test.mjs
  - tests/test_backlog_build.py
  - tests/test_runtime_image.py
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

## Execution checkpoint — slice 1 candidate (2026-11-06)

The exact upstream source/build slice is implemented and published at code d4f8e79a4300ae03d0393f363eb463d114b2f76a on the existing Episode branch. Upstream tag, gitlink/source URL, Backlog Bun1.4.4, host/runtime/Tier-1 pins, runtime source identity, fixtures and current provenance align. Native compiler defaults replace the obsolete target override without an upstream patch or Prime Agent Node change.

Verified evidence: 48 focused pytest cases; 194 Docker fixture cases with the real candidate available (0 failures/skips in the final run); standalone builder and repository build-script compiled smoke; native Git trust/private-proxy regression (1 pass, 4 assertions); supported Tier-1 image smoke; fresh native aarch64-linux Nix package build plus installCheck persistence/failed-write smoke, exact1.55.3 version/help and derivation log. Details/limits: docs/evidence/primeclaw45-upstream-candidate-20261106.md.

This is one slice for owning-Conversation review, not complete PRIMECLAW-45 acceptance. Next implementation remains approved slice2, then lifecycle/migration tests and normative assets, followed by full integrated Tier0/Tier1 acceptance. No AC has been checked. Accepted v1.53.0 remains authoritative; no merge, activation/restart, live migration or resource cleanup is included.

## Accepted slice-1 revision — Bun isolation (2026-11-06)

This checkpoint supersedes the preceding instruction to advance directly to slice2. Revise the reported slice1 code d4f8e79a4300ae03d0393f363eb463d114b2f76a in this same Episode first, then stop for owner review of the tested committed/pushed repair.

Owner accepted one concrete finding from independent Expert openai-codex/gpt-6-astra: docker/runtime.Dockerfile globally upgrades Bun1.3.11 to1.4.4, so gbrain install/standalone compilation and general sandbox bun/bunx use1.4.4 too. The approved plan limits1.4.4 to Backlog build/tests and preserves other runtime/dependency versions. Keeping config/test-artifacts.lock.json at1.3.11 did not isolate the actual gbrain/runtime toolchain. No crash is alleged.

Make the smallest repair that isolates Bun1.4.4 to Backlog build/smoke while preserving Bun1.3.11 for gbrain and general runtime. Add narrow regression assertions that both build paths use their intended pinned tools. Update directly affected docs, evidence, fixtures and native living task content truthfully. Reuse unchanged exact-source/build/Git-trust/fresh-Nix proof where applicable; run checks needed for the repaired surfaces, without inventing a new whole-suite gate at this slice boundary. Full integrated migration/lifecycle/Tier0/Tier1 acceptance remains required later. No new framework, upstream patch, Prime Agent Node change, Expert-branch movement or activation.

Same owner/operation/host/worktree/branch/session and original code basis remain bound. Acceptedv1.53.0 stays authoritative. No slice2, merge, global artifact refresh/restart, live migration or cleanup in this revision pass.

## Slice1 Bun-isolation repair delivered (2026-11-06)

Implemented and directly published code cd9193cba4082229df973d4a557388dfb83e2b62 on the existing Episode branch. This completes the accepted slice1 revision, not slice2: global/gbrain Bun1.3.11 is restored; Backlog alone uses a temporary1.4.4 install/PATH in its install/build/smoke RUN and removes it afterward. A later gbrain RUN asserts1.3.11. The four-path repair includes narrow regression assertions, dependency docs and bounded evidence.

Fresh repaired-surface validation: regression assertions fail on the reported candidate, then49focusedpytest pass; nativeDocker production-block fixture passes exactBacklog compiled smoke, gbrain sentinel install/compile1.3.11 and generalbun/bunx1.3.11; a fresh offline no-mount container verifies final tools/symlinks/env and temporary-directory absence. Details/limits and raw hashes: docs/evidence/primeclaw45-upstream-candidate-20261106.md. Prior unchanged source/Gittrust/freshNix/194fixture results are reused rather than reasserted as new repair proof. No full real-gbrain/OpenShell-image acceptance claim.

STOP here for owner review of this tested committed/pushed slice1 repair before starting slice2. No AC checked; task stays In Progress. Same resources/original basis and acceptedv1.53.0 authority remain. Full migration/lifecycle/guidance and integrated Tier0/Tier1 gates still remain later. No merge, activation/global refresh/restart, live migration or cleanup.

## Slice1 accepted; advance to approved slice2 (2026-11-06)

The owning Conversation accepted the exact four-path Bun-isolation repair cd9193cba4082229df973d4a557388dfb83e2b62. Its review resolves the prior Expert finding and supersedes the preceding stop-for-slice1-review checkpoint. Continue this SAME Episode into approved slice2, preserving global/gbrainBun1.3.11 and Backlog-only build/smokeBun1.4.4.

Implement the existing slice2 provider-history lifecycle/read/write adaptation and representative changed-seam tests: activeDone is closed; both legacycompleted/ and canonicalarchive/tasks/ records are archived regardless of status; read archived tasks natively in place; remove taskcomplete/closed-directory placement; map source status truthfully and archive only explicit source archive evidence; adopt native archived/draft dependency eligibility; refuse contested identities before mutation through existing inventory/native checks without repair or a parallel graph/index policy. Preserve complete native evidence/history/baseline bytes and source-authoritative one-way Beads-to-Backlog verification/publication/cutover/deletion ordering and resources. Do not revive reverse migration or patch upstream.

Deliver one tested committed/pushed bounded slice2 candidate for owner review, with prompt separate native task publication. Routine in-scope implementation/test repairs need no fresh permission. Required Docker validation applies after plugin-source changes. Full normative assets and integrated migration/lifecycle/Tier0/Tier1 acceptance remain required later; reuse unchanged exact-source/compiled/Nix/Gittrust/194fixture evidence only within its stated limits. All ACs remain unchecked until their complete behavior is proven.

Same owner/operation/host/worktree/branch/session/original basis. Acceptedv1.53.0 stays authoritative. No merge, activation/global refresh/restart, live migration, cleanup, scope expansion, semantic reconciliation framework or new approval store.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-05 — Episode 08450108 publication-access blocker before implementation slice 1.

Exact Episode/owner/worktree/session binding and native In Progress task were verified at task revision 55530cc9f572adad5f966d6ac00635fe65518fb9 and code base f5287c3647245a6a5e6d3baad64d9cecf1dab81b. No upgrade code, submodule, build, plugin, accepted artifact, or lifecycle changes were made.

Attempted native publication inspection: `git -C .backlog ls-remote origin refs/heads/prime-claw/tasks` failed with `git@github.com: Permission denied (publickey)` / `fatal: Could not read from remote repository`. Both Episode task and code remotes are `git@github-sailorjoe6:SailorJoe6/prime-claw.git`. A bounded `ssh -v -o BatchMode=yes -T git@github-sailorjoe6` diagnostic confirmed the configured SailorJoe6 agent key was offered and rejected. No credential material was obtained, no Keychain/browser store was accessed, no credentials/remotes were changed, and no push/retry/force operation was attempted. Remote synchronization/publication could not be established, so this blocker note is a local-only selected-task commit, not a published update.

The owning Conversation was notified through the existing Episode channel and asked for an existing approved non-Keychain publication route. No reply was received by this checkpoint; roster remained visible but bounded owner observation returned Unknown active session. The accepted v1.53.0 artifact remains authoritative. No acceptance criterion is claimed.

Unblock condition: restore supported authenticated SailorJoe6 Git transport or supply an existing approved transport/environment without credential extraction. Then inspect actual remote/task history, synchronize this same Episode task clone, preserve compatible concurrent edits, publish this exact local task update non-force, and continue the approved first implementation slice in the same Episode. Do not allocate a replacement Episode or replay an uncertain write. Task status remains In Progress for the owning Conversation to decide.

2026-11-06 — Same Episode 08450108 resumed approved slice 1 after owner clearance in comments 7–8. Earlier SSH/server-publication and Docker sign-in notes are historical. Native task remains In Progress; no lifecycle mutation. Direct task publication was verified at 2183db12ee5d01b185c0fc1549ddbcfa9f29fcae, including original da6cdaa notes and 8b9468b clearance; Docker engine read exits 0.

Upstream refs/tags/v1.55.3 and the isolated shallow source HEAD both resolve exactly to 0cf4fdbc70020327f4366a29d3f405f83d180301, with unmodified tracked source. Slice 1 aligns the upstream submodule URL/gitlink, build/runtime/test pins and current provenance; Backlog builder Bun is 1.4.4 and Prime Agent Node is unchanged. Upstream scripts/build.ts rejects the former BACKLOG_BUILD_TARGET setting without a verified executable path; native-platform compilation uses the pinned installed Bun instead, without a cross-target download or upstream patch.

Validation is in progress, not acceptance. The approved disposable official Nix container is running the native exact-source package build with no host mounts, credentials, privileged flags or caller trust changes. Existing build/compiled persistence/failed-write smoke and Git trust checks must still pass. No AC is checked and no full upgrade claim is made. This execute pass will deliver only one bounded, tested, committed/pushed candidate slice for owner review. Accepted v1.53.0 remains authoritative; migration compatibility and other approved slices remain unfinished. No merge, activation/restart, live migration, resource replacement or destructive cleanup.

Slice-1 completed build checks (2026-11-06): 48 focused pytest cases passed (one existing import-loader warning). Exact upstream Docker builder image sha256:453a366de89900503aaa2c4a27659c824e71e117fd024434d5bb639160b4531c built successfully on linux/arm64 with Bun1.4.4. Frozen standalone build and upstream compiled smoke passed. The repository scripts/build-backlog.sh then passed in that immutable image with network disabled and only the script mounted read-only; both compiled outputs had SHA-256 7b7392ce39def4fc96edc1903109ed9564dc25eb8bd79d3924378cb568ed590d. Native Git certificate/private HTTPS proxy regression passed: 1 test, 4 assertions, exactly one loopback request and expected HTTP502/nonzero Git exit. No live/private proxy or credentials used. Read-only diff audit found no concrete slice-1 defect, with no test/acceptance claim of its own.

Bounded evidence and commands are being recorded in docs/evidence/primeclaw45-upstream-candidate-20261106.md; completed raw logs are retained locally under .test-results/primeclaw45-slice1-08450108/. Fresh Nix package build/installCheck and the supported Tier-1 image smoke are still running. This is not full migration, full Tier-0/Tier-1, host activation, or AC completion. Code remains uncommitted pending final slice validation/evidence; accepted v1.53.0 stays authoritative. The initial notes push encountered a concurrent PRIMECLAW-56-only commit; exact remote diff was inspected, the unchanged selected ticket was verified, and an explicit ordinary merge preserved both commits before non-force publication f3c4bb62c67e2bc48a32663baaf43dba21083ce9. No same-task conflict, reset, force, or discarded history.

Slice-1 delivery: code d4f8e79a4300ae03d0393f363eb463d114b2f76a was committed once and pushed non-force to refs/heads/JLanders/prime-claw-primeclaw-45-episode-08450108; direct remote read matched, and the code worktree/index are clean and tracking that branch. Same owner/operation/host/worktree/session and original code basis preserved. No primary-main switch/rebase or live asset update.

Fresh Nix result is now PASS, not access preflight: official disposable image nixos/nix@sha256:f159a58f390677f41e8e900a74b6e2f9c7f27b364122ae6acf7a652ce6c551c0 ran nix build .#backlog-md --print-build-logs from exact0cf4fdbc70020327f4366a29d3f405f83d180301. Log shows fresh local /nix/store/bpk502glsl0y3bb585w0rgbi71w60ahj-backlog-1.55.3.drv, package build, installCheckPhase and compiled smoke pass; output /nix/store/gxz1m712a3b6rlw8dibmazcxpngv17k6-backlog-1.55.3. Version exactly1.55.3 and help succeeded. Existing smoke asserts persisted task create/read/list/edit/reread and a failed filesystem write exits nonzero, plus browser/MCP. Full log SHA256 89a59234a446e230c682a33c94623c589a4abbb9d962e8e63790e0797c344a62; native derivation log retained. No host mounts, credentials, privileges, caller-trust changes, update-nix or new framework.

Supported scripts/test-tier1.sh --smoke also passed with immutable image sha256:13b357723400a656eb48c8fb94712f252193f95f6412ca949a3d8e304e304ced, network absent, verified teardown and native manifest. This is image/toolchain smoke, not full plugin acceptance. Final changed-fixture run in that Docker image passed all194 cases with0 skipped after supplying the image candidate at the existing test's expected disposable path; the earlier run's single missing-artifact skip is explicitly retained as historical evidence, not treated as passed. The48 focused pytest checks, standalone/repository compiled smokes and1-test/4-assertion Git trust proof were already published above.

Evidence: docs/evidence/primeclaw45-upstream-candidate-20261106.md; raw local command/log receipts under .test-results/primeclaw45-slice1-08450108/. The independent read-only slice audit found no concrete defect and is not owner acceptance. Full migration/lifecycle behavior, normative guidance/asset conversion and complete Tier0/Tier1 suites remain unfinished; no AC or whole-upgrade success claim. Stop here for owner review of this one bounded slice. Task lifecycle remains In Progress and accepted v1.53.0 stays authoritative.

Accepted review and bounded revision handoff (2026-11-06). Owner reviewed exact published d4f8e79a4300ae03d0393f363eb463d114b2f76a and accepted the Bun-isolation defect described in the appended living-plan checkpoint. Source: /Users/jlanders/.prime/agent/session-artifacts/01a1a90b-0fba-7778-b1e5-0087bdaf8fec/primeclaw45-slice1-review/accepted-review.md. Existing upstream/tag cleanliness, raw-log hashes, compiled smokes/matching binaries, native Git trust and fresh Nix installCheck persistence/failed-write evidence were otherwise corroborated. Owner independently reran48focusedpytest and194Dockerfixture cases, all passed with0Docker skips. These results do not prove runtime tool isolation and do not waive the accepted repair or later full-upgrade gates.

This handoff revalidated the exact active version2 independent-Backlog ownership and matching Episode session file. Canonical owner checkout remains on main. Code remains clean and directly published at d4f8e79a4300ae03d0393f363eb463d114b2f76a on the recorded Episode branch. Episode task clone is clean at directly published b1bac9f2b005532c01a652854c8a4c575d39dffd; this compatible history includes the original2b6d3d6 selected-task checkpoint plus unrelated56-only advances. Current native45 identity/path/parent/status and approved contract are unchanged. No lifecycle mutation, code implementation change, resource replacement, new initial assignment or extra execute delivery occurs in handoff. Next queued execute is the slice1 Bun-isolation revision only; stop for owner review before slice2.

2026-11-06 — Accepted slice1 Bun-isolation repair is implemented locally in docker/runtime.Dockerfile, with narrow regression assertions and directly affected docs/evidence. General sandbox bun/bunx and gbrain install/compile retain1.3.11; only the Backlog build/smoke RUN installs/exports1.4.4 under /opt/backlog-bun and removes it before later layers. No image-wide Backlog PATH/BUN_INSTALL change, upstream patch, Prime Agent Node change or runtime/dependency upgrade.

Regression proof: the new/adjusted assertions failed on reported d4f8e79 (2fail/2pass); after repair the focused build/runtime/Tier1-image pytest selection passes49 cases, with one existing import-loader warning. A disposable Docker fixture is running the exact changed production blocks with exact upstream Backlog source and a gbrain-version sentinel fixture. This verifies intended tool selection, not full real-gbrain/OpenShell acceptance. Read-only implementation assistance is checking the diff separately; no owner acceptance is claimed. Raw repair receipts: .test-results/primeclaw45-slice1-bun-isolation-08450108/. Unchanged prior nativeNix/Git-trust/source proof remains applicable without a redundant rerun. No code commit yet; waiting for repaired-surface validation before one bounded code commit/push and owner review, before slice2. Status remains In Progress,AC0/9; acceptedv1.53.0 remains authoritative.

2026-11-06 — Slice1 Bun-isolation repair validation PASS.49focusedpytest cases passed after regression-red2fail/2pass. Disposable native linux/arm64 Docker execution of verbatim production shared-Bun, Backlog and gbrain blocks passed; exact Backlog1.55.3 frozen install/native compile/upstream compiled smoke ran with1.4.4. A sentinel gbrain package postinstall and compiled CLI both proved1.3.11, and a later layer plus fresh --network none/no-mount container proved general bun/bunx1.3.11, original global symlinks/BUN_INSTALL, absent /opt/backlog-bun and /opt/backlog, exactBacklog1.55.3/help. This is changed-block/sentinel execution proof, not full real-gbrain/OpenShell image acceptance.

Fixture image sha256:dc4621d1da3a86a91eab16636ba9edc48f503b8077135e3c807935b177d49e39; base verifiedsha256:453a366de89900503aaa2c4a27659c824e71e117fd024434d5bb639160b4531c; new fixture Backlog SHA25625fb5ca6a447331345407e4489b4153ffd7d7c722d62d0fd09ae3aaf934f9020. Read-only helper audit found no concrete defect, static-only. Initial fixture FROM rawsha invocation refused before any build step; retained failure, then inspected exact local base tag and corrected only fixture FROM. No product failure or credential/dependency change inferred. Exact commands, raw logs, fixture source and hashes: docs/evidence/primeclaw45-upstream-candidate-20261106.md and .test-results/primeclaw45-slice1-bun-isolation-08450108/. Prior unchanged freshNix/Git-trust/source and194Dockerfixture evidence is reused truthfully, not rerun or treated as proof of the original candidate's isolation. Backlog's source-local Bun peer is also1.4.4; no claim that a nested build must use one absolute executable path.

Ready to publish one bounded four-path code repair for owner review: docker/runtime.Dockerfile, tests/test_backlog_build.py, docs/backlog.md, docs/evidence/primeclaw45-upstream-candidate-20261106.md. No plugin-source change; no slice2 or additional whole-suite gate at this boundary. Full integrated migration/lifecycle/Tier0/Tier1 gates remain later. Status stays In Progress,AC0/9; acceptedv1.53.0 remains authoritative. No merge, activation/global refresh/restart, live migration or cleanup.

Slice1 repair publication (2026-11-06): code cd9193cba4082229df973d4a557388dfb83e2b62 is one four-path commit directly published non-force to refs/heads/JLanders/prime-claw-primeclaw-45-episode-08450108; fresh ls-remote and own upstream match and code/index are clean. Task-only evidence checkpoints9feb0f6 and8b4bdb1 were promptly and separately published during execution. Compatible unrelated56-only descendants were inspected and fast-forwarded; selected45 had no outside change. Original d4f8e79 and all historical source/build evidence remain intact. Same owner/operation/host/worktree/branch/session and original base retained; no branch switch/rebase or ownership mutation.

All repair build/test handles are finished. Read-only audit helper has been deleted and the bounded build heartbeat cancelled. No queued next implementation or slice2 is requested. This content-only task checkpoint is the review handoff; the owning Conversation controls lifecycle and later continuation. No acceptance status, live activation or cleanup has occurred.

Owner acceptance and same-Episode slice2 handoff (2026-11-06). Accepted review artifact: /Users/jlanders/.prime/agent/session-artifacts/01a1a90b-0fba-7778-b1e5-0087bdaf8fec/primeclaw45-slice1-review/accepted-bun-isolation-repair.md. Owner reviewed exact four-file repair cd9193c against d4f8e79 and the complete native task updates; prior Expert Bun-isolation defect is resolved. Owner independently reran49focusedpytest, all pass; fresh offline/no-mount immutable fixture dc4621d1 passes gbraincompiled1.3.11, generalbun/bunx1.3.11, original BUN_INSTALL/symlinks, absent temporary source/tool and exactBacklog1.55.3/version/help/hash. Production sharedBun/Backlog/gbrain blocks match the executed fixture verbatim and raw hashes match committed evidence. No full real-gbrain/OpenShell or integrated acceptance is inferred.

Handoff verified exact active version2 independent-Backlog owner and Episode session/root; primary remains main. Code cd9193cba4082229df973d4a557388dfb83e2b62 is clean/directly published and own upstream matches. Episode task clone is clean/directly published at1fad78986806e38f7bf3cb0194e0c5bcfd0f4dda; selected45 content matches the bound observation and is unchanged from the published repair report, while compatible unrelated task history is retained. Native45 stays In Progress, parentnull,AC0/9. This is content-only continuation context, not a status or ownership edit. No slice2 implementation code or additional initial/execute assignment is made in handoff; the owning Conversation already queues canonical execute independently.

2026-11-06 — Approved slice2 implementation started in SAME Episode after accepted Bun-isolation repair. Production migration adaptation removes archivedBacklogViews clone/relocate behavior and task complete/closed-directory setup, reads native task archives at actual paths, classifies legacycompleted as archive, maps status normally before explicit archive, allows source relationships to archived targets and reuses the existing physical/native inventory before destination preparation to refuse contested IDs. Native draft File path is checked before evidence normalization. Transaction/publication/receipt/cutover/source-deletion order and active resources are unchanged. No upstream/toolchain/host artifact change.

Independent test assistance is adapting representative real-candidate migration seams in tests/task_provider_migration.test.mjs and bridge. Required Docker Tier1 --probe was started through the supported driver with isolated container-local installation from the canonical Prime Agent source; no host/global candidate apply/check/probe. Raw commands/logs will remain under .test-results/primeclaw45-slice2-08450108/. No tests or slice2 acceptance claimed yet.

Read-only native API audit identifies a concrete limit: v1.55.3 task view supports archived tasks in completed/ and archive/tasks/, while draft view supports active drafts only; there is no native archived-draft view. No clone/relocate fallback or synthetic active evidence will be retained to bypass that limit. An archived-draft baseline therefore needs a supported public native read surface before whole-upgrade acceptance can be claimed. This does not waive preservation or authorize an upstream/Prime Agent patch. Representative task-archive and active-draft seams remain in progress; full integrated lifecycle/guidance/acceptance gates still remain later. Status In Progress,AC0/9; acceptedv1.53.0 remains authoritative. No merge/activation/restart/live migration/cleanup.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Prime Claw owning Conversation 01a197be-7eeb-773f-98ef-7544560ced45
created: 2026-11-03 18:14
---
Implementation admission blocked before Episode session start (2026-11-03). Operation f63a69a7-3e66-4b20-b258-2a599c4160e1 published In Progress at task revision d9c42d9d91949996aa06a9902daaadc306853e4c and allocated Orca worktree prime-claw-primeclaw-45-episode-f63a69a7 on branch JLanders/prime-claw-primeclaw-45-episode-f63a69a7 at code base fe61016a5eab4a41f7d10fe3ca3996d3bb0d3fc8. It then refused task-history preparation because concurrent PRIMECLAW-48 edits made the primary nested task checkout dirty. Its automatic Blocked publication also failed when the task-history head advanced to 57243318215e0d843385a9dd7c06ec253e0eadc4.

Read-only recovery inspection confirmed the same owned Orca worktree exists clean at the original code base; the ownership entry is uncertain and has no Episode session identity, the worktree has no .backlog task clone, and Orca shows only a shell terminal. The primary task checkout is now clean and published at 57243318215e0d843385a9dd7c06ec253e0eadc4; PRIMECLAW-45's native content is unchanged from the admitted In Progress observation. No fresh creation, handoff, second assignment, source edit, activation, or destructive cleanup was attempted.

Unblock condition: recover this exact recorded operation and its existing resources through a supported owner-recovery path; prove the prepared Episode task workspace and exact durable session/assignment identity before continuation. Do not retry as fresh creation, manually edit ownership.json, discard resources, or replace the Episode. If no supported recovery path exists, the operator must decide the bounded recovery action. The approved specification and Implementation Plan remain unchanged.
---

author: Prime Claw owning Conversation 01a197be-7eeb-773f-98ef-7544560ced45
created: 2026-11-03 18:22
---
Blocked on PRIMECLAW-55: fix task-scoped Episode initiation during unrelated ticket edits/published task-history advances and provide bounded recovery of the existing partial PRIMECLAW-45 operation. Preserve the approved upgrade specification/plan and existing uncertain ownership/resources; do not retry fresh creation.
---

author: Backlog.md Expert Conversation 01a13199-736d-7469-9af6-a884cc1e85f9
created: 2026-11-04 19:38
---
Workflow-state correction authorized by the operator (2026-11-04): restore `In Planning` because the failed admission never established the durable Episode session identity and assignment required to begin implementation. `PRIMECLAW-55` remains the native dependency and therefore remains the computed readiness blocker. Existing partial-resource and recovery evidence is preserved; this correction does not retry creation, discard resources, or change the approved specification or plan. `PRIMECLAW-60` records the clarified requirement that dependencies represent prerequisite blocking and `Needs Operator` is reserved for actual operator intervention.
---

author: Prime Claw owning Conversation 01a1a90b-0fba-7778-b1e5-0087bdaf8fec
created: 2026-11-05 15:58
---
Readiness preflight by owning Conversation 01a1a90b-0fba-7778-b1e5-0087bdaf8fec (2026-11-05): the operator explicitly requested implementation of PRIMECLAW-45. Native status is In Planning, dependency55 is Done, and the approved specification/plan are published. Historical failed45 resources were removed by the separately authorized workaround recorded in PRIMECLAW-56 and commit10e8f69871f770cd5956963eb49acddddb5657dd; current Git/Orca/ownership inspection shows no45 allocation to recover. Other owner's active56 resources and pending ownership bytes remain untouched.

Nix prerequisite access is available through a disposable official container with no host mounts, credentials, privileged flags or caller trust-setting changes. Exact image: nixos/nix@sha256:f159a58f390677f41e8e900a74b6e2f9c7f27b364122ae6acf7a652ce6c551c0 (linux/arm64). Both commands exited0: docker run --rm IMAGE nix --extra-experimental-features "nix-command flakes" eval --raw --impure --expr builtins.currentSystem (aarch64-linux); docker run --rm IMAGE nix --extra-experimental-features "nix-command flakes" flake metadata --json github:MrLesk/Backlog.md/0cf4fdbc70020327f4366a29d3f405f83d180301 (exact revision resolved, source unpacked into native Nix store). This is access preflight ONLY, not package/build/persistence acceptance. The Episode must still run the approved native nix build, exact binary version/help, and fresh installCheck persistence/failed-write smoke and retain logs. Reuse native entry points; no new Nix framework or waived gate. No global activation, accepted artifact replacement, live migration, merge, restart or destructive cleanup is authorized by implementation. Selected placement remains id:afb6537c-e643-4a5f-b284-f0f627ddcbdf; starting code basis main at f5287c3647245a6a5e6d3baad64d9cecf1dab81b.
---

author: Prime Claw owning Conversation 01a1a90b-0fba-7778-b1e5-0087bdaf8fec
created: 2026-11-05 16:04
---
Owner reviewed the first Episode report: before slice1, native Git SSH reads failed with publickey; no implementation changes or status edits occurred. The same approved SSH remote now succeeds without any credential, Keychain, SSH-config, Git-config or remote changes. Owner observed git -C .backlog ls-remote origin refs/heads/prime-claw/tasks exit0 and the identical read against the exact Episode .backlog clone exit0, both returning published55530cc9f572adad5f966d6ac00635fe65518fb9. GIT_TRACE confirms native /usr/bin/ssh targets git@github-sailorjoe6 and SailorJoe6/prime-claw.git for both. The earlier failures are real; their cause remains unknown. No alternate transport or credential extraction is needed from these current facts. Native task remains In Progress; no Blocked transition was published. This compatible execution observation does not change approved scope, plan, ownership or resources. Continue the same Episode under existing implementation authority through canonical handoff; do not replay initial creation/assignment, change remotes/credentials, or waive publication proof. A later failed or uncertain write requires actual-state inspection rather than blind retry.
---

author: Prime Claw owning Conversation 01a1a90b-0fba-7778-b1e5-0087bdaf8fec
created: 2026-11-05 16:08
---
Owner transport follow-up (2026-11-05): read-only SSH ls-remote succeeds, but normal writes remain blocked. Initial task-note push and one separately reviewed non-force attempt after inspecting unchanged refs both received remote: fatal error in commit_refs_rules. Fresh direct reads after each refusal still show refs/heads/prime-claw/tasks at55530cc9f572adad5f966d6ac00635fe65518fb9. GitHub public status reported All Systems Operational with no incident; this does not explain the repository-specific failure. No rules, credentials, remotes or trust settings were changed.

Local402073242017591e9928495853e2509c75665473 contains the exact45 transport note after other owner's reviewed59-only ee47f33981b02c8b2cae9b40309b90b813962a64. That owner explicitly confirmed its publication authority and observed the same server error. Preserve both commits unchanged; do not replay edits, force/reset or bypass repository rules. This blocker note is local-only until normal publication is restored. Published task status remains In Progress; no Blocked publication is claimed. The same Episode remains idle before implementation changes. Unblock condition: operator-cleared normal repository publication access, followed by inspection of current local/remote history and successful ordinary non-force publication/readback before canonical same-Episode continuation. No new Episode, initial assignment, credential extraction, deployment or activation is authorized.
---

author: Prime Claw owning Conversation 01a1a90b-0fba-7778-b1e5-0087bdaf8fec
created: 2026-11-05 20:49
---
Owner accepted the publication-access report and verified its clearance on2026-11-05. All pending primary task commits were preserved in ordinary shared-history merge f8c839c2c03fc9632accfc66c065936be774fb86 and publication7f9f10fda9c54b0321fc8bbc0e9e7bf2997f42de. The Episode's original notes-only checkpoint da6cdaa24405c23a48a9581d526ee21390370b20 was preserved through ordinary merge b2f888c0ed51f1b776023ab70746cfbdb56cc1b8; one normal non-force push succeeded and a direct remote read proved the exact published task ref. No credentials, SSH/Git remotes or repository rules were changed. The earlier notes/comments remain historical evidence, not current unpublished-history claims.

Implementation is now Blocked by a different, directly reproduced prerequisite failure: `docker ps --format ...` exits1 with "Sign in to continue using Docker Desktop. Membership in the [zendesk] organization is required. Sign in enforced by your administrators (via registry.json)." Required Docker-only plugin validation and the approved disposable Docker-based native Nix runner cannot run through this engine. No upgrade code edits or acceptance claims have been made. Accepted v1.53.0 remains authoritative; the same active Episode/resources are preserved and idle.

Unblock condition: operator-managed Docker Desktop sign-in with the required organization membership (or administrator-approved restoration of normal Docker access), followed by a successful read-only engine check. Do not alter registry.json, disable organization enforcement, obtain credentials from Keychain/browser stores, bypass the policy, or switch placement. Once normal access is restored, the owner can publish In Progress and continue the same Episode through canonical handoff under the existing implementation authority. No replacement Episode, merge, deployment/global activation/restart, live migration or destructive cleanup is authorized.
---

author: Prime Claw owning Conversation 01a1a90b-0fba-7778-b1e5-0087bdaf8fec
created: 2026-11-06 14:31
---
Operator cleared the recorded Docker prerequisite with "Docker is signed in now" and then "Fixed it". Owning Conversation rechecked on2026-11-06: the earlier check still returned organization-enforced sign-in, but the latest native `docker ps --format ...` now exits0 and lists the running local containers. Normal access is restored on the existing desktop-linux context; no Docker registry policy, credential material, SSH/Git remote, placement, or repository rule was changed by this Conversation.

The selected native task, approved specification/Implementation Plan, owner01a1a90b-0fba-7778-b1e5-0087bdaf8fec, operation08450108-16d7-4655-9ea3-aefb6c8ac1c4, Episode01a1ac6f-be96-76eb-aaf7-0ec75a7a4d05, original code basef5287c3647245a6a5e6d3baad64d9cecf1dab81b, main integration target, branch/worktree and selected host id:afb6537c-e643-4a5f-b284-f0f627ddcbdf are preserved. Native runtime roster shows this Episode idle with no pending queue; code/task workspaces have no Episode implementation changes. Prior GitHub publication and all preserved checkpoint history were already proven restored at8d69c26a22747b64894e73811897903170dd74f6. This exact-task status/clearance update resumes In Progress under the existing implementation authority, followed by canonical handoff into the same Episode, not creation or a replayed initial assignment.

The disposable Nix access preflight is not acceptance: full native package build/installCheck persistence and failed-write smoke, Git trust coverage, and required Docker Tier0/Tier1 validation still must pass as specified. Accepted v1.53.0 stays authoritative. No scope expansion, upstream patches, merge, deployment/global activation/restart, live migration or destructive cleanup is authorized.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Owner accepted slice1 Bun-isolation repair cd9193cba4082229df973d4a557388dfb83e2b62 after exact-delta/native-contract review and independent49pytest plus offline immutable Docker fixture checks. The prior Expert finding is resolved; preserve global/gbrainBun1.3.11 and isolated Backlog build/smokeBun1.4.4. Evidence: docs/evidence/primeclaw45-upstream-candidate-20261106.md. No full real-gbrain/OpenShell or integrated acceptance claim.

Next: SAME Episode executes the approved slice2 native provider-history lifecycle/read/write adaptation with representative seam tests and required Docker validation, then publishes one bounded tested code/task candidate for owner review. The preceding stop-for-slice1-review is superseded. Native In Progress,AC0/9; remaining normative assets/full integrated migration/lifecycle/Tier0/Tier1 gates still required. Prior unchanged source/compiled/Nix/Gittrust/194fixture evidence reused within its limits.

Acceptedv1.53.0 remains authoritative. No merge, activation/global refresh/restart, live migration, cleanup, upstream patch, scope expansion, semantic framework or new approval store.
<!-- SECTION:FINAL_SUMMARY:END -->
