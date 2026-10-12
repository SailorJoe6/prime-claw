# Execution plan — `PRIMECLAW-35`

Execute Backlog.md task `PRIMECLAW-35` in an isolated Episode worktree. Reload
it before each implementation pass with `backlog task view PRIMECLAW-35
--plain`. The task is the sole product scope, requirements, non-goals, and
acceptance contract.

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

Normal review checks the candidate against Backlog.md task `PRIMECLAW-35`. It is not an
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
- **Slice 2 — accepted at candidate commit
  `4e024dee684d26450d2ae36ee06d7909b1659b99` (2026-10-12).** Branch and
  upstream match, the worktree was clean at acceptance, the final Beads source
  hash matches `3101daa5c0372b7b45da074b64c9ca062b00380f986ab9daa187364c0dcf45a2`,
  destination counts are 120 total / 79 completed / 41 active, exact validation
  reports 85 parent links, 60 blocking links, 10 nonblocking references, 116
  comments, and 256 acceptance criteria, and focused tests pass (`2 passed`).
  `PRIMECLAW-35` remains open as required.
- **Slice 3 — complete in the pending caller-conversion commit (2026-10-12).**
  Active repository callers and navigational task references now use native
  Backlog.md operations and `PRIMECLAW-*` IDs. Repository-specific Beads data,
  hooks, generated Codex hook integration, merge rules, and project guidance
  are removed. The required one-time cutover inventory and proportional tests
  are recorded below. `PRIMECLAW-35` remains In Progress for Slice 4.
- **Next, and only next:** Slice 4 — run final candidate validation. Do not
  activate host artifacts, close `PRIMECLAW-35`, or add scope in Slice 3.

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
  only `PRIMECLAW-35` to record the approved five-child exception. The
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
  `PRIMECLAW-35`: preserve chronological creation order for all ordinary
  tasks, but defer only the five affected children until immediately after
  their required parent exists, then create them through supported
  `task create --parent`. The affected pairs are `PRIMECLAW-22.1` under
  `PRIMECLAW-22`, plus `PRIMECLAW-10.1`, `PRIMECLAW-10.4`,
  `PRIMECLAW-10.3`, and `PRIMECLAW-10.2` under `PRIMECLAW-10`.
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

## Slice 3 caller conversion and one-time cutover audit (2026-10-12)

- Performed the required repository-wide cutover inventory once across 510
  tracked/nonignored files. It found 266 files containing candidate Beads,
  `.beads`, `bd` command, or former-ID text. The transient Slice 2 ID mapping
  resolved genuine issue IDs; similarly shaped runtime names and image tags
  were not treated as task references. No audit allowlist, crosswalk, migration
  driver, or permanent absence test was added.
- Replaced the project Beads skill with direct Backlog.md guidance. Ready work
  uses `backlog task list --status "To Do" --ready --plain`; claiming uses one
  `backlog task edit <id> --status "In Progress" --assignee <name>` operation.
  Execute, prepare, blocked, and handoff project assets plus their managed source
  templates now use Backlog.md without changing lifecycle authority.
- Removed tracked `.beads/`, Beads merge rules and ignores, and Beads-generated
  Codex hooks. Updated repository instructions, current/future planning
  material, current architectural docs, and active Backlog.md task content.
  Active task mutations used the supported CLI. Navigational references in
  current docs and mutable historical indexes use translated `PRIMECLAW-*` IDs. Old names, commands, and IDs remain only in
  factual migration history, immutable archived plans/evidence/reports, and
  verbatim migrated completed-task/comment history.
- Added native workflow documentation to `docs/backlog.md` and positive
  regression coverage in `tests/test_backlog_workflow.py`; no lasting absence
  assertion was introduced. Focused validation passes (`12 passed, 3
  deselected`); the full host-safe suite passes (`612 passed, 66 skipped, 11 warnings, 75 subtests`); and
  `git diff --check` passes. The Docker-only plugin probe passed in a
  disposable non-recursive clone after the standard initialized-worktree limitation below was isolated.
- The standard initialized-worktree Tier 1 launcher currently fails before
  Docker execution because its repository snapshot code treats the initialized
  `deps/backlog` gitlink directory as an unsupported non-file input. Slice 3
  does not redesign the provenance subsystem. Its required plugin-only probe passed from a disposable non-recursive clone with the empty gitlink path
  absent. Slice 4 must repair or otherwise clear the standard initialized-
  worktree gate before final candidate acceptance.
- Stop after committing and pushing Slice 3. Final Beads source stability,
  complete migration equivalence, builds, lifecycle suites, and final Docker
  candidate gates remain ordered Slice 4 work. Host activation and final task
  closure remain operator-controlled post-merge work.

## Operator-controlled completion

After the operator authorizes merge and activation, the migrated epic is closed
from primary `main` exactly as required by `PRIMECLAW-35`. This is not Episode
implementation work and the Episode must not perform or automate it.
