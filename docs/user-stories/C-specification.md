# C. Develop a specification

## US-08 — Discover requirements for an unclear idea

**As an operator with an incomplete idea, I want guided one-question-at-a-time
discovery, so that the conversation produces a bounded, reviewable
specification without beginning implementation.**

`/design` keeps its discovery-first posture. It either creates exactly one new
Backlog task with explicit `In Design` status or revises one exact
operator-selected task that is already `In Design`.

## US-09 — Turn an existing conversation into a specification

**As an operator who has already discussed most of a design, I want the
conversation synthesized into a durable specification, so that I only need to
answer the remaining material questions.**

`/spec-it-out` uses the same exact-task contract with a synthesis-first posture.
It asks only the material questions that remain.

Both paths store the living product contract in supported Backlog fields:
Description, native Acceptance Criteria, References, and Documentation. They
reject `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, and `Done`
without mutation. New tasks spell out `In Design` rather than relying on the
temporary project default. After a verified task-only commit and prompt push
attempt, both stop for operator review. Neither writes an Implementation Plan,
allocates an Episode, or authorizes implementation.

The specification captures the outcome, scope, required behavior, material
constraints, and observable acceptance at a level proportional to the work. It
does not require boilerplate risk or process sections when those are not
material. Revisions remain on the same exact `In Design` task.

Retained repositories can explicitly choose the separately named
`design-legacy` or `spec-it-out-legacy` skills. They preserve current-main
future-folder authoring under `.ralph/plans/future/<slug>/SPECIFICATION.md` and
stop for operator review without creating or mutating a Backlog task. The
synthesis skill references the discovery skill's common folder-persistence and
review contract rather than carrying a second copy.

## US-10 — Explain and recover blocked planning work

**As an operator facing blocked Ralph artifacts, I want the blocker explained
and the artifacts restored after resolution, so that planning or implementation
can resume without reconstructing state.**

Retained version-1 compatibility keeps persisted active Episodes' blockers in their active execution
plan and keep the exact plan pair in place. For an older already-blocked
snapshot, missing active files are not live identity: after an explicit operator
unblock decision, the blocked skill calls `restore_blocked_spec_episode` for
the exact owned future-folder location. The host restores only the readable,
non-empty pair from the persisted record's worktree and revalidates that same
active Episode before continuation. It never falls through to task mode or
creates another Episode. The no-ownership old in-place blocked-folder workflow
remains separate.

Primary version-2 task Episodes use exact-task ownership: the Episode records
blocker evidence in its bound task while the Conversation alone publishes
`Blocked` and resumed `In Progress` lifecycle status. Neither schema
reconstructs work in a new artifact.

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/project-templates/design.md`
- `src/prime-agent-plugin/skills/project-templates/spec-it-out.md`
- `src/prime-agent-plugin/skills/project-templates/design-legacy.md` (retained compatibility)
- `src/prime-agent-plugin/skills/project-templates/spec-it-out-legacy.md` (retained compatibility)
- `src/prime-agent-plugin/skills/project-templates/blocked.md` (migration compatibility)
- `src/prime-agent-plugin/extensions/reviewed-plan.ts` (`restore_blocked_spec_episode`)
- `src/prime-agent-plugin/extension-support/legacy-workflow.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts`

## Design references

- [`backlog.md`](../backlog.md)
- [`future-specification-bundles.md`](../future-specification-bundles.md)
- [`VISION.md`](../../VISION.md)
