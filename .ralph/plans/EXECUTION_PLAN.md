# Execution plan — `prime-claw-rg2`

Execute bead `prime-claw-rg2` in an isolated Episode worktree. Reload it before
each implementation pass with `bd show prime-claw-rg2`. The bead is the sole
product scope, requirements, non-goals, and acceptance contract.

## Ordered implementation work

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

Complete this work in practical reviewable increments. The Episode may choose
smaller steps when useful; this file does not require a fixed evidence format or
extra process artifacts. If a material product decision is missing, stop and ask
the operator rather than guessing.

Normal review checks the candidate against `prime-claw-rg2`. It is not an
adversarial or red-team exercise. Reviewer suggestions, speculative hardening,
alternative architecture, and newly imagined invariants do not change scope or
block completion. Only a concrete material defect against the bead's accepted
behavior requires repair.

## Progress

- **Slice 1 — complete (2026-10-12).** Created the long-lived
  `SailorJoe6/Backlog.md` fork connected to `MrLesk/Backlog.md`, resolved the
  bounded latest stable release as `v1.53.0`, and pinned `deps/backlog` to
  `fd20f71493fb4eda44b021aa89f257956f17fb71`. The host artifact passed
  upstream's `scripts/smoke-compiled-build.ts`. `bin/prime-claw build --force`
  completed after Docker Desktop recovery; the Linux arm64 artifact passed the
  same upstream smoke during that build, and the published runtime image
  returned `1.53.0` from `/usr/local/bin/backlog --version`. Focused tests
  passed (`37 passed`), and the host-safe suite passed (`607 passed, 1 skipped,
  65 deselected, 75 subtests`). Build and provenance usage are documented in
  `docs/backlog.md`.
- **Next:** Slice 2 — initialize Backlog.md with the accepted configuration and
  migrate the complete issue inventory through direct supported CLI calls.

## Operator-controlled completion

After the operator authorizes merge and activation, the migrated epic is closed
from primary `main` exactly as required by `prime-claw-rg2`. This is not Episode
implementation work and the Episode must not perform or automate it.
