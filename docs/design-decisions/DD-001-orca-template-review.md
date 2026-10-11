# DD-001 — Preserve side-by-side template comparison as the primary UX

- **Status:** accepted; clarified by operator on 2026-10-11
- **Stories:** [US-04–US-05](../user-stories/B-project-initialization.md)

## Semantic priority

US-05 exists so the operator can compare a customized asset with its new
upstream version. The required product experience is the comparison itself:
an in-product, focused Orca side-by-side view. Preserve, accept, or reset are
downstream decisions enabled by that comparison. They must not be presented as
a menu that makes comparison optional.

## Observed constraint

Orca 1.4.223 can focus a source-control diff for one tracked worktree path, but
it cannot compare two arbitrary files. A live probe proved that Orca can visibly
render the committed customized version beside a temporary upstream overwrite
and keep it visible until review completes.

Evidence: probe matrix D1 and “Review UX constraint” in
[`2026-10-09-orca-prime-agent-integration-probes.md`](../evidence/2026-10-09-orca-prime-agent-integration-probes.md).

## Decision

There are exactly two paths:

1. **Clean tracked asset — normal UX.** Explain the temporary overwrite and
   focus change, wait for explicit readiness, place the upstream bytes at the
   tracked path, and open the exact path with Orca's focused diff. Hold the
   overwrite until the operator confirms the side-by-side comparison is visible
   and completes or cancels. Then restore and verify the exact original bytes.
2. **Already-dirty asset — fallback only.** Do not overwrite the user's dirty
   file. Compare that file with the upstream file using native Git diff. Do not
   pass `--no-ext-diff` or another option that explicitly disables a custom Git
   diff experience configured by the user.

If Orca fails on the clean-file path, restore the original file and report the
failure. Do not silently replace the required side-by-side UX with terminal
patch output. Interrupted temporary-overwrite state continues to require an
explicit `restore` or `keep` decision.

## Rejected alternatives

- Native Git patch output as the normal UX: less readable than the required Orca
  side-by-side view.
- Overwriting an already-dirty file: risks destroying the user's work.
- Falling back merely because Orca failed on a clean file: silently weakens the
  promised UX.
- Passing `--no-ext-diff`: suppresses a Git diff experience the user may have
  configured.

## Current implementation gap

`template-review.ts` currently rejects dirty assets before offering a fallback.
It also falls back after an Orca error on a clean asset and invokes
`git diff --no-ext-diff -- <path>`. That is the opposite trigger and explicitly
disables configured external diff behavior. The focused implementation task
must align these branches with this decision without expanding the scope beyond
US-05.

## Regression anchors

- `tests/template_review.test.mjs`
- `tests/project_initialization_extension.test.mjs`
- the retained D1 visible-diff probe above

## Revisit condition

The clean-file temporary overwrite may be removed if Orca gains supported
arbitrary-file side-by-side comparison with equivalent visible readiness. The
side-by-side UX itself remains a product requirement unless the operator changes
US-05.
