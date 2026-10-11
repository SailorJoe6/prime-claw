# DD-001 — Use the tracked worktree item for Orca template review

- **Status:** accepted
- **Stories:** [US-04–US-05](../user-stories/B-project-initialization.md)

## Observed context

Orca 1.4.223 can focus a source-control diff for a tracked worktree path, but it
has no supported arbitrary two-file, external-path, or alternate-base compare
command. A live probe visibly rendered the committed customized file against a
temporary upstream overwrite and proved the overwrite stayed held until review
completed. The same investigation exposed two UX failures: `--focus` changed
the visible worktree without advance notice, and an attempted GUI observation
triggered a macOS Accessibility permission prompt.

Evidence: probe matrix D1 and “Review UX constraint” in
[`2026-10-09-orca-prime-agent-integration-probes.md`](../evidence/2026-10-09-orca-prime-agent-integration-probes.md).

## Decision

The normal flow explains the temporary overwrite and focus change, waits for an
explicit ready response, requires a clean tracked regular file, writes upstream
bytes at that same path, opens `orca file diff ... --focus`, and holds the file
until the operator confirms the comparison is visible and completes or cancels.
Cleanup restores the exact committed bytes and clean index. Ambiguous later
edits are preserved for explicit `restore` or `keep` recovery. Do not use OS
GUI/Accessibility control without a separate operator request.

A terminal Git diff is an honest fallback when Orca is unavailable; it is not
the intended side-by-side product experience. The current tracked-file fallback
is sufficient because the upstream bytes are already held at that path.

## Rejected simpler alternative

A temporary second file cannot use Orca's supported in-product diff. Restoring
as soon as the open receipt returns fails because lazy rendering may not have
read the held bytes. Treating `opened: true` as visible also failed the live
review criterion.

## Regression anchors

- `tests/template_review.test.mjs`
- `tests/project_initialization_extension.test.mjs` (adapter fallback)
- the retained D1 visible-diff probe above

## Revisit condition

Reconsider the temporary-overwrite state machine when Orca offers a supported
arbitrary two-file/alternate-base comparison with positive visible readiness
and no OS-level GUI permission. Re-run real visual acceptance on an Orca diff
API change.
