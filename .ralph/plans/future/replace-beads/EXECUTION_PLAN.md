# Execution plan — `prime-claw-rg2`

Execute bead `prime-claw-rg2` in an isolated Episode worktree. Reload it before
each implementation pass with `bd show prime-claw-rg2`. The bead is the sole
product scope, requirements, non-goals, and acceptance contract. This file adds
only the minimum execution controls required to admit the Episode.

## Strict execution limits

- **Threat and failure model:** limited to an incorrect migrated task state, an
  incorrect built artifact, a changed Beads source, or a missed active Beads
  reference. Check only the explicit acceptance criteria in `prime-claw-rg2`.
- **Trusted assumptions:** Beads remains read-only, the supported Backlog.md CLI
  and ordinary Git work as documented, and the operator controls merge,
  activation, and existing contexts or worktrees.
- **Recovery:** if an accepted command or check fails, stop that slice and leave
  the candidate unmerged. The unchanged Beads source and ordinary Git rejection
  or revert are the complete recovery boundary.
- **Complexity budget:** no shim, adapter, driver, manifest, dual-write system,
  extra safeguard, recovery machinery, or new framework. Simplify or stop if
  any support machinery starts growing beyond the direct migration work.
- **No scope growth:** no red teaming, adversarial analysis, speculative risk
  analysis, optional hardening, new invariants, broad cleanup, or audits beyond
  the one-time cutover search required by `prime-claw-rg2`. Do not inspect,
  coordinate, refresh, or modify operator-owned contexts or worktrees.

## Ordered implementation slices

1. **Vendor and build.** Resolve the bounded latest stable release, pin the fork
   submodule, build the accepted host and sandbox artifacts, and report the tag,
   commit, and existing smoke-check output.
2. **Initialize and migrate.** Initialize the accepted configuration, recreate
   every issue through the native CLI, and run the exact count, content,
   comment, relationship, and reference checks required by the bead.
3. **Convert callers.** Replace active repository Beads usage and navigational
   IDs, remove repository-specific Beads integration, and perform only the
   bead's required one-time cutover search.
4. **Validate the candidate.** Run the final Beads source-stability check,
   migration checks, builds, existing relevant lifecycle tests, and required
   Docker-only plugin gates; then commit and push the candidate for review.

Each slice depends on the prior slice. Report its diff plus ordinary command and
test output; do not create a new evidence system or extra evidence documents.
There are no optional hardening deliverables, and reviewers must not seek or
propose them. A suggestion stays out of scope. Only the operator may create
separate future work after a named acceptance failure or post-completion dogfood
evidence.

After two failed repair/review attempts for the same acceptance failure, stop
and consult the operator instead of adding machinery or widening scope. Only the
operator may change scope, product behavior, architecture, merge, activation,
or acceptance requirements.

## Operator-controlled completion

After the operator authorizes merge and activation, the migrated epic is closed
from primary `main` exactly as required by `prime-claw-rg2`. This is not Episode
implementation work and the Episode must not perform or automate it.
