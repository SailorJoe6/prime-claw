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

## US-10 — Explain and recover blocked planning work

**As an operator facing blocked Ralph artifacts, I want the blocker explained
and the artifacts restored after resolution, so that planning or implementation
can resume without reconstructing state.**

The current blocked-folder workflow remains a migration-compatibility surface
until Episode work and ownership are converted to task identity.

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/project-templates/design.md`
- `src/prime-agent-plugin/skills/project-templates/spec-it-out.md`
- `src/prime-agent-plugin/skills/project-templates/blocked.md` (migration compatibility)

## Design references

- [`backlog.md`](../backlog.md)
- [`future-specification-bundles.md`](../future-specification-bundles.md)
- [`VISION.md`](../../VISION.md)
