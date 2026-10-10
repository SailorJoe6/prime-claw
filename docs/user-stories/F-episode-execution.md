# F. Implement work inside an Episode

## US-17 — Execute one reviewable vertical slice

**As an Episode implementer, I want to complete the smallest end-to-end slice
per pass, so that every iteration produces bounded, tested, documented,
reviewable progress.**

Each execute pass reads the active specification and plan, audits existing work,
implements one slice, updates tests, documentation, Beads, and plan state,
commits and pushes, reports exact evidence, and stops for owner review.

Implementation remains inside the approved threat model, non-goals, and
complexity budget. Optional reviewer hardening does not become scope
implicitly, and status-only churn is not progress.

## US-18 — Record blocked or completed state durably

**As an Episode implementer, I want blockers and completion reflected in durable
project artifacts, so that the next actor does not depend on transcript memory.**

Blocked work records the exact blocker, attempts, and unblock condition, moves
both plan documents to the blocked location, updates Beads, and stops. Completed
work archives the active specification and plan, updates the archive index and
Beads, and reports verification evidence.

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/project-templates/execute.md`
- `src/prime-agent-plugin/skills/project-templates/blocked.md`

## Design references

- [`VISION.md`](../../VISION.md)
- [`handoff-chain.md`](../handoff-chain.md)
