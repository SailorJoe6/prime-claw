---
id: PRIMECLAW-35
title: Replace Beads with a vendored Backlog.md fork as-is
status: In Progress
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:24'
labels:
  - backlog-md
  - migration
  - vendoring
dependencies: []
priority: p1
type: epic
ordinal: 118000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Purpose
Replace Beads in prime-claw with Backlog.md while preserving the current Prime Claw and Ralph workflows and processes.

## Accepted direction
- Create and maintain the long-lived fork at `https://github.com/SailorJoe6/Backlog.md`, retaining `https://github.com/MrLesk/Backlog.md` as upstream.
- Keep the fork connected to upstream for now. Continue taking useful upstream changes while that remains beneficial.
- Vendor the fork into prime-claw as a Git submodule at `deps/backlog` so the fork remains independently maintainable while prime-claw pins an exact tested revision.
- Pin the submodule to the latest stable upstream release, recording both the semantic tag and its resolved commit. The initial verified pin is `v1.53.0` at `fd20f71493fb4eda44b021aa89f257956f17fb71`. Resolve “latest stable” once when implementation begins and treat that release as the bounded migration target through review and cutover. A stable release published after that snapshot is a separate routine, validated fork-sync and submodule-pin update rather than a reason to restart the in-flight migration.
- Until an explicit decision to break ties with upstream, the dependency policy is to track and use the latest stable Backlog.md release. Each new stable release is synced into the fork and adopted through an intentional, validated submodule-pin update; prereleases and arbitrary branch heads are not dependency targets.
- Upstream currently publishes frequent stable GitHub releases. Verified on 2026-10-11: latest release `v1.53.0`, published 2026-09-24, with source archives and platform binaries.
- Build Backlog.md from the pinned `deps/backlog` source using its supported Bun standalone-binary build (`bun install --frozen-lockfile`, then upstream's `bun run build`, which emits version-stamped `dist/backlog`). Bun is a build-time dependency only; validate the compiled artifact with upstream's compiled-binary smoke path. At cutover, deliberately copy the validated host artifact to `~/.local/bin/backlog`, which is already on the host `PATH`; install the separately targeted sandbox artifact at `/usr/local/bin/backlog` in the runtime image. Do not rely on a global npm package, upstream prebuilt binary, committed platform binary, or runtime Bun dependency.
- Initially install and use Backlog.md as-is. Do not redesign its product model or add prime-claw-specific tracker behavior during this effort.
- Initialize Backlog.md with its visible default `backlog/` project directory; do not hide canonical work state under `.backlog/`.
- Initialize with `--integration-mode none`. Do not let Backlog.md generate or modify `AGENTS.md`, install its own AI workflow instructions, or configure MCP during this migration. Existing project-customizable Ralph skills remain authoritative and call the supported `backlog` CLI directly.
- Configure Backlog.md with `auto_commit: false`, `remote_operations: false`, and `check_active_branches: true`. Backlog.md owns task-file mechanics and local cross-branch awareness; existing Prime Claw/Ralph workflows retain commit, fetch, push, and other Git transport authority.
- Configure supported task statuses as `To Do`, `In Progress`, `Blocked`, and `Done`; priorities as `P0` through `P4`; and task types as Backlog.md's defaults plus `epic` and `decision`. Map Beads `open`, `in_progress`, `blocked`, and `closed` directly to those four statuses, preserve `P0`-`P4`, and preserve existing issue types.
- Migrate prime-claw's issue state through Backlog.md's supported CLI using configured prefix `primeclaw` and CLI-assigned `PRIMECLAW-<number>` IDs.
- Migrate the complete current Beads inventory. The observed implementation snapshot contains 120 issues: 79 closed and 41 active/blocked. These counts are not a frozen historical target: immediately before the first Backlog.md write, re-read Beads and include every issue present. Ordinary issues added before that snapshot are included automatically and do not stop the migration or require a new operator decision. Completed history remains available in Backlog.md's completed-task storage so parent/dependency history is not truncated.
- During migration, the implementing agent performs every issue operation directly through the supported Backlog.md CLI and keeps the old-to-new ID map only as transient working state needed to translate relationships and references. Do not create a migration driver or migration manifest. Update repository references to the new IDs and validate issue counts and translated relationships. Create tasks in ascending Beads `created_at` order, using the former Beads ID as a deterministic tie-breaker. If a child precedes its required parent, defer only that child until immediately after the parent is created so the supported `task create --parent` operation can preserve the relationship; all other tasks retain chronological order. Add blocking and nonblocking translated relationships only after all destination tasks exist.
- Map all 85 Beads `parent-child` links to Backlog.md parent relationships and all 60 `blocks` links to Backlog.md dependencies. Preserve the 10 unsupported nonblocking links (`discovered-from`, `relates-to`, and `related`) as ordinary references to the corresponding new Backlog task IDs. Validate exact equivalence for the parent and blocking graphs and exact preservation of the 10 reference links.
- Map issue content through supported CLI fields: preserve title, labels, and assignee directly; use the Backlog description for the Beads description plus clearly labeled legacy `design` and `notes` subsections; convert acceptance criteria to Backlog checklist criteria; use final summary for closed-item reasons; preserve comment order, body, and author; and map `spec_id` to a task reference. The implementing agent maps acceptance criteria conservatively: split only explicit Markdown bullets and numbered markers, preserve item text verbatim, and keep an ambiguous or otherwise unsplittable prose block as one criterion. Do not sentence-split or semantically rewrite the source. The current corpus has 116 comments across 13 issues; replay each issue's comments sequentially with native `task edit --comment ... --comment-author ...`, preserving order, body, and author. The verified corpus contains no reserved Backlog comment markers or standalone delimiter lines. Original comment timestamps remain intentionally omitted under the accepted chronology rule.
- Do not misuse Backlog's implementation-plan or implementation-notes fields for legacy Beads content because those fields participate in Backlog's own execution lifecycle. Do not copy original timestamps or Beads audit metadata into task bodies; the unchanged Beads data and prior Git history retain that historical metadata if it is ever needed.
- Do not store former Beads IDs on every task and do not retain a permanent crosswalk.
- Perform migration and caller conversion on an isolated branch and worktree. The implementing agent reads Beads without mutating or deleting it, writes only branch-local repository changes, and verifies its source has not changed before final acceptance. No Beads freeze, separate backup, restore mechanism, or no-gap cutover is required.
- Convert existing skills, workflows, instructions, scripts, tests, and documentation to call the supported `backlog` CLI directly instead of Beads, without changing their intended behavior. Do not add a Beads-compatibility shim, dual tracker abstraction, migration driver, or migration manifest; the implementing agent uses the native CLI directly and retains only transient in-session translation state.
- Replace Beads claiming with Backlog.md's supported single edit operation: `backlog task edit <id> --status "In Progress" --assignee <name>`. Backlog.md v1.53.0 has no separate `claim` command or automatic current-identity shortcut; setting both fields in one edit is the as-is claim-equivalent. Do not add a locking wrapper or fork change for Beads-style cross-process compare-and-set semantics during this migration.
- Replace `bd ready` with `backlog task list --status "To Do" --ready --plain` (or the equivalent JSON form when structured output is needed). Backlog.md derives `--ready` from dependency completion and terminal status, so the explicit `To Do` filter is required to exclude work already `In Progress` or explicitly `Blocked`.
- Remove the stale `bd remember` instruction without adding a Backlog.md document, continual-memory, gbrain, or Beads fallback workflow. Durable repository knowledge continues to live in the project's normal tracked documentation.
- Land the generated `backlog/` state and all caller changes together after validation. After cutover, Backlog.md is the sole active tracker for this repository; this is ordinary authority replacement, not a special dual-write protocol. If the candidate is rejected or reverted, the unchanged Beads data and prior Git state remain available naturally.
- Replace every active repository reference that teaches, invokes, tests, generates, installs, or reconciles Beads or `bd` commands. Remove repo-specific Beads hooks/configuration and replace the project Beads skill with Backlog.md guidance. Do not uninstall the host `bd` binary; other repositories may continue using it.
- At cutover, perform one repository-wide search for Beads, `.beads`, `bd` commands, and former issue IDs. Replace operational references and rewrite every navigational issue reference to the corresponding new Backlog.md ID, including references in historical prose. Retain old Beads names, commands, and IDs only where they are factual history or verbatim evidence whose alteration would make the record inaccurate. Do not retain a permanent absence test or allowlist after this one-time audit.
- Merging changes repository authority for newly loaded agents. The operator owns coordination of already-running agent contexts and existing Episode worktrees; this migration does not automate their refresh, rebase, or restart. Use an optimistic activation sequence: merge the validated repository candidate, then install or activate the host binary and rebuilt sandbox runtime. A bounded interval in which newly loaded agents may receive `backlog: command not found` is acceptable and recoverable by retrying after activation; do not add quiescence or no-gap orchestration solely to eliminate that interval.
- Preserve the existing specification, planning, Conversation-to-Episode promotion, execute/handoff, review, and finalization workflows.
- Complete this migration effort when the validated cutover succeeds and dogfooding of the unchanged Backlog.md integration begins. Record dogfood observations and any resulting decisions in separate follow-up work about (a) whether Ralph should later be reshaped around Backlog.md and (b) how the fork should evolve into a prime-claw-specific product. Keep the migrated counterpart of this epic open in the cutover commit; after merge and host CLI activation, use the now-authoritative Backlog.md CLI from primary `main` to write its final summary and mark it `Done`, then commit and push that task-file change directly from primary `main`. That first durable post-merge tracker mutation both closes this migration and begins dogfooding; do not create a separate closure branch or leave it pending for later work.
- Break ties with upstream only if and when evidence shows that independent evolution is the better tradeoff.

## Scope
This effort is an integration and migration, not a new tracker design. It covers fork provenance, vendoring, reproducible installation, Beads-data migration, command/instruction replacement, compatibility validation, documentation, dogfood readiness, and ordinary Git rejection/revert.

## Non-goals
- Designing a new issue tracker.
- Changing Backlog.md behavior beyond changes strictly required to vendor, build, install, or integrate the unchanged product.
- Replacing, collapsing, or redesigning Ralph specifications, plans, phase skills, or Episode lifecycle.
- Pre-designing prime-claw-specific Backlog.md extensions.
- Severing the upstream relationship now.
- Broad gstack/Ralph integration work (`PRIMECLAW-34` remains separate).

## Verified migration constraints
- Backlog.md v1.53.0 accepts only letters in a configured task prefix. `prime-claw` is rejected with `Task prefix must contain only letters (a-z, A-Z).`
- The v1.53.0 CLI exposes neither a general task-import command nor an explicit ID option on `task create`.
- Backlog.md's own managed guidance says not to edit task Markdown directly because the CLI maintains metadata, filenames, relationships, and history.
- A controlled smoke test proved that a manually generated compatible file with legacy ID `PRIME-CLAW-H6W` is discovered, can be edited through the CLI, and can receive a generated child. That demonstrates parser compatibility, but direct file creation remains an unsupported migration interface and is not an acceptable baseline merely to preserve IDs.
- The complete current Beads export contains 120 issue IDs. Every ID begins `prime-claw-`; none matches a numeric `PRIMECLAW-<number>` sequence.
- A second smoke test proved that supported CLI creation with alphabetic prefix `primeclaw` generates `PRIMECLAW-1`. Because the current Beads export contains no `PRIMECLAW-<number>` IDs, CLI-assigned destination IDs are collision-free. The operator accepted transient relationship mapping and rejected durable former-ID references and a permanent crosswalk as unnecessary.

## Open integration questions
- Exact provenance record for the initial `deps/backlog` release tag and resolved commit.
- Exact Docker build-stage wiring and artifact/provenance checks for the accepted upstream source build, host `~/.local/bin/backlog`, and sandbox `/usr/local/bin/backlog` destinations.
- Remaining noninteractive tracked contents under the accepted CLI-only `backlog/` initialization; Git ownership and task vocabulary are fixed.
- One-time cutover inventory of Beads references and former issue IDs across skills, workflows, plugin code, scripts, tests, docs, hooks, and operator runbooks; rewrite all operational and navigational references while preserving only factual history and verbatim evidence.
- Exact low-ceremony branch/worktree cutover commands and final source-stability check; merge-before-activation and a bounded CLI-availability gap are accepted, and no special quiescence, backup, or restore design is needed. Dogfood evaluation begins after this epic completes and belongs to separate follow-up work.

## Legacy design

Treat upstream Backlog.md behavior as the initial product contract. Keep integration mechanics narrow and reversible. Separate source vendoring, installation, data migration, caller conversion, and cutover validation into reviewable slices; this effort ends when dogfooding begins. Do not use this epic to redesign Ralph or Backlog.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A prime-claw-owned long-lived fork exists with recorded upstream provenance and a policy to track and use the latest stable upstream release until an explicit divergence decision.
- [ ] #2 The fork is vendored as a Git submodule pinned to the latest stable upstream release tag and resolved commit, and its source can be reproducibly compiled with Bun into a version-stamped standalone binary installed at host `~/.local/bin/backlog` and sandbox `/usr/local/bin/backlog` without a runtime Bun/npm dependency.
- [ ] #3 The complete current Beads inventory is recreated by the implementing agent through direct supported Backlog.md CLI operations, without a migration driver or manifest, with CLI-assigned `PRIMECLAW-*` IDs, translated active references, and verified preservation of approved content, every parent link, every blocking link, and every nonblocking reference link needed to continue work; no permanent legacy-ID crosswalk is retained. The observed implementation snapshot is 120 issues (79 closed and 41 active/blocked), 85 parent links, 60 blocking links, and 10 nonblocking references. Immediately before the first Backlog.md write, re-read Beads and automatically include any ordinary issue added before that snapshot.
- [ ] #4 Existing Prime Claw and Ralph workflows use the Backlog.md CLI instead of Beads without intentional workflow or authority changes; Backlog.md-generated AI instructions and MCP integration remain disabled. Task claiming uses one supported `task edit` command to set `In Progress` and assignee together, without a compatibility wrapper or fork modification. Ready-work discovery combines `--status "To Do"` with `--ready`, and the obsolete `bd remember` instruction is removed without introducing a new knowledge subsystem.
- [ ] #5 A one-time cutover audit verifies that repository instructions, skills, workflows, generated assets, hooks/configuration, scripts, tests, and documentation no longer teach or invoke Beads for active work; every navigational issue reference uses the new Backlog.md ID, and old Beads text remains only in factual history or verbatim evidence. The host `bd` binary remains installed and no permanent absence test is retained.
- [ ] #6 Integration and lifecycle tests prove current behavior remains intact.
- [ ] #7 The isolated branch/worktree candidate proves a read-only Beads migration and one validated authority cutover; after merge and host CLI activation, the first real Backlog.md mutation on primary `main` adds the migrated epic's final summary, marks it `Done`, and is committed and pushed directly, completing this effort as dogfooding begins. Ordinary Git rejection/revert is sufficient recovery.
- [ ] #8 Product changes to Backlog.md and Ralph-workflow replacement remain separate future decisions based on dogfood evidence.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Ralph
created: 2026-10-12 01:24
---
Slice 3 caller conversion is complete pending commit/push. Active instructions, project skills/workflows, managed templates, docs, and mutable navigational references now use native Backlog.md operations and PRIMECLAW IDs. Tracked repository-specific Beads data, hooks, merge rules, ignores, and Codex hook integration are removed. The required one-time cutover inventory scanned 510 tracked/nonignored files and added no persistent crosswalk, allowlist, or absence test. Validation: focused 12 passed / 3 deselected; full host-safe 612 passed / 66 skipped / 75 subtests; exact Docker-only plugin probe passed with offline checks, teardown, and manifest publication using the verified Prime Agent source identity. The standard initialized-worktree Tier 1 launcher currently rejects the deps/backlog gitlink directory during repository snapshotting; the plugin-only probe used a disposable non-recursive clone with that empty gitlink path absent. Final initialized-worktree gate repair/clearance, complete candidate validation, host activation, and task closure remain Slice 4 or post-merge work as already ordered.
---
<!-- COMMENTS:END -->
