# Requirements — Worktree-isolated specification episodes

> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)
> **Beads:** `prime-claw-h6w.1`

Priority meanings: **GATE** is required for acceptance; **NICE** may follow only
if it does not weaken a gate.

## Hierarchy and scope

- **R-WE-1 (GATE) — Canonical project context.** A `PROJECT_CONTEXT` is
  physically anchored by the project's canonical/default-branch checkout.
- **R-WE-2 (GATE) — Long-lived conversations.** Multiple durable
  `PROJECT_CONVERSATION` sessions may be rooted in the canonical checkout and
  coordinated by the `UNIVERSAL_AGENT`.
- **R-WE-3 (GATE) — Isolated specification episodes.** Specification-level
  production work uses a dedicated feature branch, Git worktree, and durable
  worktree-rooted Prime Agent session.
- **R-WE-4 (GATE) — Logical owner.** Every episode records the originating
  project conversation as its durable logical coordinator, independent of the
  runtime parent/sibling representation.

## Command and interview behavior

- **R-WE-5 (GATE) — Native entry points.** Project-local native `/design` and
  `/spec-it-out` commands load and inject their canonical workflow markdown
  from `.ralph/skills/` without duplicating it.
- **R-WE-6 (GATE) — One exposed route.** After the native commands are proven,
  duplicate `.agents/skills/design` and `.agents/skills/spec-it-out` exposure is
  removed.
- **R-WE-7 (GATE) — Semantic distinction.** `/design` performs material
  discovery; `/spec-it-out` formalizes substantially developed conversation
  context.
- **R-WE-8 (GATE) — Interview first.** Both workflows resolve all material open
  questions and reach specification-ready state before asking how to dispose of
  the specification.
- **R-WE-9 (GATE) — Explicit disposition.** The operator explicitly chooses
  future incubation or immediate episode creation; the system never infers a
  one-way allocation decision from ambiguous text.

## Future incubation

- **R-WE-10 (GATE) — No premature resources.** Future incubation creates no
  branch, worktree, or episode session.
- **R-WE-11 (GATE) — Named future bundle.** Incubated work is written as a
  non-binding `SPECIFICATION.md`, `REQUIREMENTS.md`, and `DECISIONS.md` bundle
  under `.ralph/plans/future/<idea-slug>/`.
- **R-WE-12 (GATE) — Safe names.** Future names are filesystem-safe,
  collision-resistant, and do not overwrite existing content without explicit
  approval.
- **R-WE-13 (NICE) — Later promotion.** A future bundle can later be promoted
  through the same episode-creation mechanism with its context retained.

## Episode creation

- **R-WE-14 (GATE) — Durable location.** Worktrees use a configurable durable
  root; the intended sandbox defaults are `/sandbox/projects/<project>` for the
  canonical checkout and `/sandbox/worktrees/<project>/<episode>` for episodes.
- **R-WE-15 (GATE) — Safe Git creation.** Branch and worktree creation is
  non-interactive, validates repository state and destinations, and never
  overwrites or deletes existing resources.
- **R-WE-16 (GATE) — Conversation inheritance.** The promoted episode receives
  the relevant source conversation rather than only a generic task summary.
- **R-WE-17 (GATE) — Correct root.** The episode's persisted CWD is the new
  worktree; project-local skills, extensions, settings, and context are
  discovered there.
- **R-WE-18 (GATE) — Returned identity.** Episode creation returns and durably
  records active/stable session IDs, name, session file, model, branch,
  worktree, project, and owner conversation identity.
- **R-WE-19 (GATE) — Coordinator remains live.** Episode creation does not
  replace or strand the owning project conversation; it can observe and message
  the live episode as a sibling or equivalent reachable session.
- **R-WE-20 (GATE) — Exactly-once task admission.** Substantive episode work is
  delivered exactly once despite the known automatic-preparation race.
- **R-WE-21 (GATE) — Prepare and verify.** The episode verifies CWD and branch,
  runs the project `prepare` workflow, and writes its active specification in
  its own checkout before implementation.
- **R-WE-22 (GATE) — Recoverable partial failure.** Failures report created
  resources and safe recovery actions; rollback never removes pre-existing or
  dirty resources.

## Coordination and lifetime

- **R-WE-23 (GATE) — Durable coordination.** Ownership and episode identity
  survive REPL-variable loss, compaction, kernel restart, and session resume.
- **R-WE-24 (GATE) — Full PR lifetime.** The episode remains resumable through
  planning, implementation, PR creation, review fixes, and rebasing.
- **R-WE-25 (GATE) — Bidirectional collaboration.** Owner and episode can
  exchange decisions, progress, review requests, and completion reports.

## Completion and cleanup

- **R-WE-26 (GATE) — Complete archive set.** Completion archives
  `SPECIFICATION.md`, `REQUIREMENTS.md`, `DECISIONS.md`, and
  `EXECUTION_PLAN.md` under a unique `.ralph/plans/archive/<episode-slug>/`.
- **R-WE-27 (GATE) — Archive is a claim, not authorization.** The owner treats
  the archive as the first readiness signal and independently verifies docs,
  beads, tests, CI, PR feedback, push state, and merge readiness.
- **R-WE-28 (GATE) — Owner-controlled merge.** The owning project conversation
  decides whether and when to merge or abandon the episode.
- **R-WE-29 (GATE) — Post-merge cleanup.** Session retirement and worktree
  removal occur only after merge or explicit abandonment and only after dirty-
  state safety checks.

## Concurrency, security, and verification

- **R-WE-30 (GATE) — Concurrent episodes.** Unique identities and atomic shared
  metadata updates permit multiple active episodes without checkout collisions.
- **R-WE-31 (GATE) — Input safety.** Untrusted/model-derived names cannot escape
  configured roots or become unchecked shell fragments.
- **R-WE-32 (GATE) — Credential isolation.** Episode automation preserves the
  OpenShell L7 credential boundary and does not read Keychain or browser secret
  stores.
- **R-WE-33 (GATE) — Evidence-backed tests.** Tests cover command registration,
  canonical markdown loading, interview/disposition ordering, both disposition
  paths, collisions, partial failures, identity persistence, sibling messaging,
  archive readiness, and safe cleanup; one real dogfood run proves the complete
  promoted path.
