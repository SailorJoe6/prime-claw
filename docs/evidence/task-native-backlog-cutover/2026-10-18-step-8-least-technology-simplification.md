# Step 8 — least-technology task-native lifecycle inventory

## Scope

This slice removes the custom task-native review/outcome state machine while preserving the user-visible contract: exact task selection, one reusable Episode, Conversation-owned lifecycle decisions, explicit operator authority for merge/abandonment/cleanup, generic version-1 compatibility, and no Prime Agent patch.

## Before

At checkpoint `282238ab06b87932cbb2900e999af5e19cc83dd4`:

| Surface | Lines | Machinery |
|---|---:|---|
| `extension-support/spec-episode.ts` | 3,893 | Task status publisher; Ready publication/integration/verification; Delay and Request Changes phases; custom fast-forward/Done recovery; custom abandonment import/archive recovery; task-content digests; terminal evidence; receipt-bound cleanup |
| `extensions/reviewed-plan.ts` | 1,033 | One eight-action `finalize_task_episode` coordinator with resume/ready/changes progress objects and terminal receipts |
| `tests/spec_episode_extension.test.mjs` | 2,782 | Lifecycle phase, digest, partial-state, receipt, custom merge, and custom archive tests |
| `tests/reviewed_plan_extension.test.mjs` | 526 | Multi-action coordinator and receipt/replay tests |

The removed production surface included more than twenty task-specific review, merge, abandonment, and receipt types/functions. It duplicated behavior already supplied by Git, Backlog, and the Conversation prompt.

## After

| Responsibility | Mechanism |
|---|---|
| Exact task selection and planning | Existing structured Backlog lookup and reviewed planning workflows |
| One reusable Episode | Existing version-2 ownership reservation/allocation and durable worktree/session identity |
| Continuation | Existing `handoff_task_episode` exact-owner transport |
| Blocked/resumed status | Conversation instructions plus supported `backlog task edit`, exact task-only commit, and push |
| Delay / Request Changes | No-op or recorded in-scope guidance followed by existing handoff |
| Merge | Fresh exact `(taskId, mainHead, candidateHead)` preflight; ordinary `git merge --ff-only`; supported Backlog `Done`; exact task-only commit; push |
| Abandonment | Explicit operator confirmation; exact task-only Git selection; supported Backlog Final Summary/archive; exact move commit; push |
| Cleanup | Cleanup-only `finalize_task_episode(taskId, episodeHead, outcome, confirmed)`; durable `cleanupHead`; exact idle runtime/worktree/branch removal; ownership closes last |
| Version-1 compatibility | Existing folder admission, handoff, blocked recovery, bridge, and bookkeeping finalization unchanged |

The public task-native tool surface is now creation, continuation, and cleanup. It has no Ready receipt, progress receipt, terminal evidence, content digest, custom merge transaction, or custom archive recovery protocol.

## Kept code boundaries

- strict version-1/version-2 ownership parsing and atomic writes;
- exact task reservation before resource creation;
- local/Orca worktree and durable session allocation;
- exact owner/worktree/session validation for handoff;
- the production cleanup adapter, because session, Orca worktree, branch, and ownership removal require a stable host boundary;
- the version-1 bundle digest, which remains legacy bundle identity and is not a task-review digest.

## Protected and excluded state

- No Prime Agent source checkout is modified.
- No ignore/config workaround is introduced.
- No tracked `.ralph/plans` path is recreated.
- The canonical-main untracked `.ralph/plans/archive/replace-beads/` pair remains outside this candidate and must retain hashes:
  - `EXECUTION_PLAN.md`: `68f6a8cfd297f3c5bd46d5a4551cedaca4707ef865b351af790459e684339f13`
  - `SPECIFICATION.md`: `1d587130ff368ba190ab8b987267bce73bee5c5342ef23b56da7814b15e4cfad`

## Validation evidence

- Focused host-safe policy/workflow checks: `49 passed, 5 skipped`.
- Isolated Docker behavior suites for reviewed-plan registration and Episode cleanup: `2 passed` at `.test-results/20261017T224746Z-48221-ff5a38af/tier1`.
- Broad host-safe suite: `663 passed, 1 skipped, 65 deselected, 75 subtests passed`; only the four pre-existing unrelated topology/template-pin/vendor-pin failures remained.
- Docker Tier 1 source-mode offline probe: passed immutable-image launch, network absence, plugin checks, RPC discovery, teardown, and manifest publication at `.test-results/20261017T224940Z-52575-28e2f8e3/tier1`.
- `git diff --check`: passed.
- Candidate scale before task-record evidence: 481 additions and 4,315 deletions across 22 tracked implementation, test, and documentation files. The production coordinator deletion dominates the reduction.

Focused behavior covers the cleanup-only schema, explicit cleanup confirmation, durable same-head binding, branch-only partial-cleanup resume, ordered exact-resource removal, inactive replay, unsafe-resource rejection, unchanged task admission/handoff, and retained version-1 paths.

## Independent review repair — canonical-main untracked state

Independent GPT-6 Astra review of exact candidate `a2842dbe5066cc47158f8de34a64d94d0e44e228` found one material defect: the cleanup Git guard treated every untracked path as dirty. A real cleanup therefore rejected the required untracked `.prime-claw/ownership.json` and this repository's explicitly protected untracked `.ralph/plans/archive/replace-beads/` pair before removing any resources.

The repair changes only canonical-main cleanliness semantics. `CliTaskEpisodeCleanupGit` now rejects staged and tracked changes with `git status --porcelain=v1 --untracked-files=no` while allowing untracked state. Episode-worktree cleanup remains strict and still rejects every untracked or tracked change. The Conversation prompt and user stories use the same staged/tracked distinction for merge and abandonment preflight. No ignore rule, path-specific exception, receipt, digest, or lifecycle coordinator was added.

A real-Git regression writes a valid active version-2 ownership record, creates the protected untracked archive pair, and proves the canonical-main guard accepts them. It then proves unstaged tracked drift and staged drift both fail closed. Post-repair focused host checks passed 49 with 5 skips. The isolated reviewed-plan and Episode suites passed at `.test-results/20261017T225626Z-67704-a2ecdbca/tier1`.
Final Docker Tier 1 source-mode probing passed immutable-image launch, network absence, plugin checks, RPC discovery, teardown, and manifest publication at `.test-results/20261017T225826Z-72047-42eaff0a/tier1`.
