# C. Develop a specification

## US-08 — Discover requirements for an unclear idea

**As an operator with an incomplete idea, I want guided one-question-at-a-time
discovery, so that the conversation produces a bounded, reviewable
specification without beginning implementation.**

`/design` creates a new
`.ralph/plans/future/<slug>/SPECIFICATION.md`, keeps it as a living document,
and stops for explicit review.

## US-09 — Turn an existing conversation into a specification

**As an operator who has already discussed most of a design, I want the
conversation synthesized into a durable specification, so that I only need to
answer the remaining material questions.**

`/spec-it-out` produces the same future-bundle specification contract with a
synthesis-first rather than discovery-first posture.

Both specification paths cover the outcome, scope, safety properties, threat,
trust, and failure model, non-goals, manual-recovery boundary, complexity
budget, and acceptance requirements versus optional hardening. Neither plans,
allocates an Episode, or authorizes implementation.

## US-10 — Explain and recover blocked planning work

**As an operator facing blocked Ralph artifacts, I want the blocker explained
and the artifacts restored after resolution, so that planning or implementation
can resume without reconstructing state.**

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/project-templates/design.md`
- `src/prime-agent-plugin/skills/project-templates/spec-it-out.md`
- `src/prime-agent-plugin/skills/project-templates/blocked.md`

## Design references

- [`future-specification-bundles.md`](../future-specification-bundles.md)
- [`VISION.md`](../../VISION.md)
