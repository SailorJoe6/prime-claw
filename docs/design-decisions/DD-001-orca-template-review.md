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

There are three paths:

1. **Clean tracked asset; Orca works — normal UX.** Explain the temporary
   overwrite and focus change, wait for explicit readiness, place the upstream
   bytes at the tracked path, and open the exact path with Orca's focused diff.
   Hold the overwrite until the operator confirms the side-by-side comparison
   is visible and completes or cancels. Then restore and verify the exact
   original bytes.
2. **Already-dirty asset — immediate fallback.** Do not overwrite the user's
   dirty file. Compare that file with the upstream file using native Git diff.
3. **Clean asset; Orca fails — graceful fallback.** Restore and verify the exact
   original bytes, then compare the restored worktree file with the upstream
   file using native Git diff.

Both Git fallback paths must avoid `--no-ext-diff` or any other option that
explicitly disables a custom Git diff experience configured by the user.
Interrupted temporary-overwrite state continues to require an explicit
`restore` or `keep` decision.

## Rejected alternatives

- Native Git patch output as the normal UX: less readable than the required Orca
  side-by-side view.
- Overwriting an already-dirty file: risks destroying the user's work.
- Hard-failing after Orca fails on a clean file: loses useful graceful
  degradation after the original bytes can be restored safely.
- Passing `--no-ext-diff`: suppresses a Git diff experience the user may have
  configured.

## Current implementation gap

`template-review.ts` currently rejects dirty assets before offering a fallback.
After an Orca error on a clean asset, it runs `git diff --no-ext-diff -- <path>`
before restoration. The focused implementation task must add the dirty-file
fallback and make both fallback paths compare the preserved/restored worktree
file with upstream without disabling configured external diff behavior.

## Regression anchors

- `tests/template_review.test.mjs`
- `tests/project_initialization_extension.test.mjs`
- the retained D1 visible-diff probe above

## Revisit condition

The clean-file temporary overwrite may be removed if Orca gains supported
arbitrary-file side-by-side comparison with equivalent visible readiness. The
side-by-side UX itself remains a product requirement unless the operator changes
US-05.
