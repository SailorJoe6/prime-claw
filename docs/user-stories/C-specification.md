# C. Develop a specification

## US-08 — Discover requirements for an unclear idea

**As an operator with an incomplete idea, I want guided one-question-at-a-time
discovery, so that the conversation produces a bounded, reviewable
specification without beginning implementation.**

`/skill:design` keeps its discovery-first posture. It uses the repository's sole
valid live task provider to create exactly one native task with explicit
`In Design` status or revise one exact operator-selected native task that is
already `In Design`.

## US-09 — Turn an existing conversation into a specification

**As an operator who has already discussed most of a design, I want the
conversation synthesized into a durable specification, so that I only need to
answer the remaining material questions.**

`/skill:spec-it-out` uses the same exact-task contract with a synthesis-first posture.
It asks only the material questions that remain.

Both paths store the living product contract in supported provider-native
fields. Backlog uses Description, native Acceptance Criteria, References, and
Documentation and publishes only the exact task path. Beads uses raw
`description` and acceptance criteria, preserves material references and
documentation losslessly in ordinary specification prose, and publishes one
guarded native mutation with exact raw identity/status/field, revision/ref, and
clean-working-set proof. New tasks spell out native `In Design`; uncertain
creation never permits a second create. Both reject `In Planning`, `In Progress`,
`Blocked`, `Ready for Merge`, and `Done` before mutation, stop for operator
review, and neither writes an implementation plan, allocates an Episode, or
authorizes implementation.

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
