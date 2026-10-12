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

- **Slice 1 — accepted at candidate commit
  `16a826d005a45ffd70befa1da9cf162e77356a28` (2026-10-12).** Branch and
  upstream match, the worktree was clean at acceptance, the runtime reports
  `1.53.0`, and focused tests pass (`37 passed`). Created the long-lived
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
- **Slice 2 — complete in the pending migration commit (2026-10-12).**
  Initialized the visible `backlog/` project with the accepted configuration and
  migrated the complete final source snapshot through direct supported CLI
  calls. Exact destination validation and source-stability evidence are recorded
  below. The migrated counterpart of `prime-claw-rg2` remains open as required.
- **Next, and only next:** Slice 3 — convert active callers and navigational
  references. Do not begin it in the Slice 2 pass.

## Slice 2 moving-source contract (approved 2026-10-12)

- The operator approved migration of the complete current Beads snapshot taken
  immediately before the first Backlog.md write. Ordinary issues added before
  that snapshot are included automatically and are not a blocker or a new
  decision. Current observed values are 120 issues (79 closed and 41
  active/blocked), 85 parent links, 60 blocking links, and 10 nonblocking
  references; the actual migration and validation use the final snapshot's
  exact counts and content.
- The pinned `v1.53.0` host artifact was rebuilt and smoke-tested successfully.
  The exact noninteractive initialization command was probed with
  `--integration-mode none`, visible `backlog/`, prefix `primeclaw`,
  active-branch checking enabled, and remote operations disabled.
- Resume Slice 2 by taking the final read-only Beads snapshot immediately before
  initialization, then migrate it fully through direct supported CLI calls and
  validate exact snapshot equivalence. Commit and push Slice 2, then stop before
  caller conversion.


## Slice 2 parent-order resolution (approved 2026-10-12)

- The first snapshot was intentionally superseded after the operator updated
  only `prime-claw-rg2` to record the approved five-child exception. The
  uncommitted generated destination was discarded, then the final read-only
  Beads snapshot was taken immediately before clean reinitialization. It
  contains 120 ordinary issues (79 closed and 41 active/blocked), 85 parent
  links, 60 blocking links, 10 nonblocking references, and 116 comments; its
  canonical JSONL SHA-256 is
  `3101daa5c0372b7b45da074b64c9ca062b00380f986ab9daa187364c0dcf45a2`.
  Visible `backlog/` initialization uses integration mode `none`, prefix
  `primeclaw`, active-branch checking enabled, remote operations disabled, and
  auto-commit disabled.
- The operator approved the only in-scope as-is resolution now recorded in
  `prime-claw-rg2`: preserve chronological creation order for all ordinary
  tasks, but defer only the five affected children until immediately after
  their required parent exists, then create them through supported
  `task create --parent`. The affected pairs are `prime-claw-5v7.9` under
  `prime-claw-gv7`, plus `prime-claw-f81`, `prime-claw-n20`,
  `prime-claw-j7q`, and `prime-claw-198` under `prime-claw-h6w`.
- Migration completed without modifying the fork or task Markdown. Direct CLI
  task views validate all 120 titles, statuses, priorities, types, assignees,
  labels, descriptions plus labeled legacy sections, 256 conservatively split
  acceptance criteria, final summaries, spec references, comments, and null
  implementation-plan/implementation-notes fields. Backlog.md's supported
  Markdown writer canonically collapsed one redundant blank-line run; all
  source text otherwise compares exactly through the CLI representation.
- Exact translated graph validation passes: 85 parent links, 60 blocking
  dependencies, and 10 nonblocking task references. All 116 comments preserve
  source order, body, and author. The 79 closed tasks are in
  `backlog/completed/`; 41 active/blocked tasks remain in `backlog/tasks/`.
  `python3 -m pytest tests/test_backlog_build.py -q` passes (`2 passed`),
  `git diff --check` passes, and a fresh read-only Beads export still hashes to
  `3101daa5c0372b7b45da074b64c9ca062b00380f986ab9daa187364c0dcf45a2`.
- Stop after committing and pushing Slice 2. Caller conversion remains Slice 3.

## Operator-controlled completion

After the operator authorizes merge and activation, the migrated epic is closed
from primary `main` exactly as required by `prime-claw-rg2`. This is not Episode
implementation work and the Episode must not perform or automate it.
