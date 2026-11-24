---
id: PRIMECLAW-69
title: Use Git references for independent Backlog handoff evidence
status: In Planning
assignee: []
created_date: '2026-11-24 01:43'
updated_date: '2026-11-24 01:58'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/prime-claw/tasks/tasks/primeclaw-62%20-%20Bound-task-handoff-evidence-and-retain-truthful-delivery-outcomes.md
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/510856f0e8ec7db152f7f34cb8730587234be5bf/tasks/primeclaw-70%20-%20Make-independent-Backlog-Episode-creation-work-for-large-tickets.md
documentation:
  - docs/handoff-chain.md
priority: p0
type: bug
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
The pod-pricing TASK-2 handoff stopped before either Episode prompt (published blocker `377f49d`); no AWS work began and the original Episode/bridge are preserved. Native `backlog task view --json -- TASK-2` succeeded directly, but the corresponding Node `spawnSync` diagnostic hit `ENOBUFS` at about 1,063,667 bytes with its default 1 MiB buffer. PRIMECLAW-62 bounded prompt delivery, not this full-JSON prerequisite. Independent Backlog creation has the same source-verified risk in pre-allocation checks and a separate pre-session read that also puts snapshots into the initial execute prompt; no creation incident is claimed. This task supersedes PRIMECLAW-70 and does not reopen PRIMECLAW-62.

## Outcome
Replace ticket snapshots throughout Prime Claw's Backlog lifecycle for both independent Git history and branch-local stores. Whenever a workflow needs evidence of ticket state at a checkpoint, retain the exact task repository identity, immutable commit ID and repository-relative ticket path at that checkpoint. Read or diff the complete committed content via Git on demand, in bounded pieces as needed. Use each store's existing history and publication rules; do not add another store or change those rules. Git references are factual evidence, not authority, approval, or a frozen revision gate.

Cover creation (pre-allocation and pre-session), initial execute, ordinary handoff, execute-only continuation, oversight, review, block/resume, terminal flows, and Backlog evidence written by ownership transitions or provider cutover. Continue to use native Backlog operations for task authoring and lifecycle changes. Preserve exact identity and publication checks and editable workflow/LLM judgment. Do not depend on capturing full native JSON through the fixed buffer for lifecycle evidence or to create a snapshot. Do not raise that buffer, truncate ticket content, copy full snapshots into ownership/prompts/journals/results/other stores, or substitute mutable working files. Retain handoff-specific runtime facts and explicitly justified non-Git facts separately. Preserve exact Episode resources, same-resource recovery, one initial execute assignment, and first admission → factual callback → one canonical execute follow-up. Report delivery outcomes separately; no automatic resend.

## Compatibility and boundaries
No bulk rewrite or rollout gate. Read existing records compatibly and leave historical records intact. At the next normal operation, use an exact historical commit where verifiable and write only Git references for new evidence. If required prior evidence cannot be resolved, or the exact evidence is wrong or inaccessible from the selected placement, report the gap at the relevant boundary (before prompt delivery where applicable); never guess from HEAD, replay, or allocate replacement resources. Leave Beads evidence behavior unchanged. No original TASK-2 Episode actions, resend, AWS work, upstream changes, or live activation as part of this repair.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Throughout the independent and branch-local Backlog lifecycle, new ticket-state evidence uses only exact Git repository/commit/path references. Complete committed content is readable and diffable in bounded pieces after a branch advances, without new duplicate snapshots or mutable-file fallback.
- [ ] #2 Offline Docker regressions exercise production independent Backlog creation at both checkpoints and continuation with a committed synthetic ticket whose native JSON exceeds 1 MiB. No larger buffer, truncation, or full JSON capture as a snapshot prerequisite. Representative branch-local evidence resolves from the exact code-repository commit.
- [ ] #3 Existing records remain readable without a bulk rewrite. Normal operations use verifiable old commits and write references for new evidence. Missing, wrong, or inaccessible required evidence is reported before the relevant delivery without guessing or retrying.
- [ ] #4 Preserve exact identity, publication and same-resource recovery, separate runtime and delivery facts, one initial assignment, and ordinary first admission → factual callback → one execute follow-up. Verify execute-only and Beads behavior remain unchanged apart from the Backlog evidence representation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Define the reference and reader (AC1, AC3).** In the task-history support layer, share a Backlog-only evidence type with validated repository identity, full commit OID and literal repository-relative ticket path. Use the selected independent task repository (including custom store paths) or the exact branch-local code repository, with existing local-only/publication rules. Validate repository provenance, commit, regular ticket blob and canonical task identity where the evidence is consumed. Provide bounded, resumable reads and diffs of exact committed blobs (including long lines and the tail). Do not capture whole Git output in the synchronous runner, use mutable files as evidence or introduce a second store. Keep previous/current references independent when they represent different checkpoints; do not freeze branch tips or add an approval gate.

2. **Switch creation admission and the first assignment (AC1, AC2, AC4).** Trace `spec-episode.ts` from pre-allocation resolution through `prepareTaskEpisodeWorkspace` and the initial execute message. Split Backlog lifecycle identity/publication facts from full native views in `reviewed-plan-support.ts`, `task-providers.ts` and `task-history-workspace.ts`; leave explicit native task viewing and authoring distinct. Preserve exact ID/path and publication checks without requiring full `task view --json` or a larger buffer. Use bounded facts plus committed status/plan evidence for the existing editable readiness judgment. Validate required evidence in the target task workspace before session assignment; keep the same operation, worktree, session and recovery semantics on failure. Write only the reference for ticket evidence and send one initial execute assignment, not an initial handoff. No replay assignment.

3. **Replace the remaining Backlog writes and consumers (AC1, AC3, AC4).** Switch `preparePublishedBacklogHandoffEvidence` and branch-local handoff in `spec-episode.ts`; keep runtime branch/upstream and delivery facts separate. Keep ordinary first admission → factual callback → one execute, and the existing execute-only path with no extra stage. Update `episode-ownership.ts` and `task-episode-ownership.ts` for reference-based writes/readback, transitions and terminal evidence. In `task-history-workspace.ts` and `task-provider-migration.ts` replace Backlog ticket copies in publication/mutation results and cutover ownership/results with exact references when those checkpoints are committed; keep native edits and required semantic verification, and report pre-commit or failed-publication facts as such. Do not replace transient native migration verification with an approval classifier, or change Beads or the existing cutover/retirement order. Audit `taskEvidence`, previous/current views, `nativeView`, and emitted diffs across journals/results/prompts so no Backlog snapshot is written under a different field. Update editable handoff, execute, oversight, expert review, block/resume and terminal guidance and `docs/handoff-chain.md` to use the bounded Git reader.

4. **Handle legacy evidence only when needed (AC3, AC4).** Keep readers for existing independent revision-plus-view records and branch-local path-only records. Derive historical references only from verifiable checkpoint facts, including the repository and exact path; an old path alone is not proof of a revision. Preserve old records without a bulk rewrite. Advance only new evidence in a normal operation. For required missing, mismatched or inaccessible evidence, name the boundary and reason before delivery where applicable. Do not guess from HEAD or an uncommitted file, reuse a copied view as committed evidence, resend, or allocate replacements. Preserve definite versus uncertain admission, callback, and follow-up outcomes separately.

5. **Prove the change offline in Docker (AC1–AC4).** Extend the production task Episode admission and handoff integration cases (`tests/task_episode_admission_extension.test.mjs`, `tests/spec_episode_extension.test.mjs` and the Tier 1 native-observation harness). Use disposable local Git remotes and a committed synthetic Backlog task; measure native JSON above 1 MiB via streamed/file output in the fixture only. Exercise pre-allocation and pre-session reads, a single bounded initial assignment, ordinary continuation, execute-only, and same-resource recovery without a second allocation or resend. Advance the task branch and verify complete bounded reads/diffs of both commits, with a late-content marker, and assert no full JSON capture prerequisite or new content copies in persisted/delivered evidence. Cover branch-local committed evidence, legacy compatibility, wrong repository/ID/path and missing or inaccessible revisions; assert failure at the relevant boundary. Extend ownership transition, mutation and cutover cases for references and run unchanged Beads and delivery outcome regressions. Run `scripts/test-tier1.sh --probe`; record Docker results against all four criteria. No original TASK-2 action, AWS work, host activation, or upstream work.
<!-- SECTION:PLAN:END -->
