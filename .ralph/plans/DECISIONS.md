# Decisions — Worktree-isolated specification episodes

> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)
> **Beads:** `prime-claw-h6w.1`

## D-WE-1 — Canonical checkout anchors the project context

**Decision:** The `PROJECT_CONTEXT` is physically represented by the
canonical/default-branch checkout managed in the universal agent's writable
runtime home. Project conversations are rooted there.

**Satisfies:** R-WE-1, R-WE-2, R-WE-14.

**Rationale:** A stable checkout gives every conversation the same project
instructions, durable stores, and discovery boundary. “Canonical” avoids
hard-coding `main` or `master`.

## D-WE-2 — A promoted specification receives a branch, worktree, and session

**Decision:** Every specification-level effort approved to proceed becomes an
episode with a dedicated feature branch, worktree, and durable Prime Agent
session rooted in that worktree.

**Satisfies:** R-WE-3, R-WE-14, R-WE-15, R-WE-17, R-WE-24, R-WE-30.

**Rationale:** Branches alone do not isolate working files or indexes. Worktrees
allow concurrent episodes without duplicating Git object storage or changing a
session's discovery root in place.

## D-WE-3 — Logical ownership is explicit and survives runtime topology

**Decision:** The originating project conversation is the episode's logical
owner. Store that relationship durably with the complete episode identity;
do not rely on an in-memory Python handle or on Prime Agent calling the session
a child.

**Satisfies:** R-WE-4, R-WE-18, R-WE-19, R-WE-23, R-WE-25, R-WE-28.

**Rationale:** `rlm.create_session` produces reachable top-level siblings and
returns useful IDs, while RLM children have different lifecycle APIs. Product
ownership should remain stable if Prime Agent's internal family representation
changes or a coordinator restarts.

## D-WE-4 — Native commands wrap canonical skills

**Decision:** Implement `/design` and `/spec-it-out` as project-local TypeScript
extension commands that inject the canonical markdown from `.ralph/skills/`.
Remove their `.agents/skills/` aliases only after native-command behavior is
proven.

**Satisfies:** R-WE-5, R-WE-6, R-WE-7.

**Rationale:** `/handoff` already proves this composition: an extension owns
deterministic host behavior and command syntax while `.ralph/skills/` remains
the single source of workflow truth.

## D-WE-5 — Finish the interview before asking for disposition

**Decision:** `/design` and `/spec-it-out` retain different starting semantics
but converge only after all material questions are answered. The operator then
chooses future incubation or immediate episode creation.

**Satisfies:** R-WE-7, R-WE-8, R-WE-9.

**Rationale:** Scope and implementation cost are not known at invocation time.
Deferring the allocation decision prevents premature worktrees without losing a
clear, operator-controlled promotion boundary.

## D-WE-6 — Future work is a named, non-binding specification bundle

**Decision:** Incubated work goes under
`.ralph/plans/future/<idea-slug>/` with specification, requirements, and
decisions documents, and allocates no episode infrastructure.

**Satisfies:** R-WE-10, R-WE-11, R-WE-12, R-WE-13.

**Rationale:** Conversation history is enough for raw ideas; the future folder
preserves ideas worth durable treatment without implying approval to execute.
Named subfolders permit several candidates concurrently.

## D-WE-7 — Promoted episodes inherit conversation and keep the owner alive

**Decision:** Episode creation carries relevant source-conversation context into
a new durable worktree-rooted session while leaving the project conversation
active as coordinator. A generic handoff summary alone does not satisfy the
initial contract.

**Satisfies:** R-WE-16, R-WE-17, R-WE-18, R-WE-19, R-WE-21, R-WE-25.

**Rationale:** The founding Vision explicitly requires past-design awareness at
the conversation-to-episode boundary. The POC demonstrates a full inherited
transcript and live sibling collaboration.

## D-WE-8 — Separate publication from substantive admission

**Decision:** Episode creation must use an exactly-once delivery protocol that
treats session publication and task admission as separate facts. The episode
verifies its root and runs `prepare` before specification work.

**Satisfies:** R-WE-20, R-WE-21, R-WE-22.

**Rationale:** Prime Agent's automatic-preparation race can consume an initial
substantive prompt. The project already mandates harmless bootstrap followed by
one direct task delivery for affected spawns.

## D-WE-9 — Completed planning archives are the readiness claim

**Decision:** The execute workflow archives the complete four-document planning
set in a unique episode directory. The owner uses its presence as the first
readiness check but performs independent acceptance and PR verification before
merge.

**Satisfies:** R-WE-26, R-WE-27, R-WE-28.

**Rationale:** The archive convention already represents “nothing left on this
plan.” Extending it to the complete current spec format makes the state
machine-checkable without trusting an agent's prose report as merge approval.

## D-WE-10 — Cleanup belongs to the owner after terminal disposition

**Decision:** The coordinator retires the session and removes the worktree only
after merge or explicit abandonment, with dirty-state and branch-safety checks.
Failures preserve recoverable state rather than force-delete it.

**Satisfies:** R-WE-22, R-WE-24, R-WE-27, R-WE-28, R-WE-29.

**Rationale:** The episode needs its root through review and rebasing. Removing
an active root would corrupt the lifecycle this feature is intended to protect.

## D-WE-11 — Use a configurable dedicated worktree root

**Decision:** Store episode worktrees outside canonical checkouts beneath a
configurable managed root. The intended OpenShell layout is
`/sandbox/worktrees/<project>/<episode>` beside
`/sandbox/projects/<project>`.

**Satisfies:** R-WE-14, R-WE-15, R-WE-30, R-WE-31.

**Rationale:** Persistent sibling directories avoid nested-repository scans,
remain fully owned within the OpenShell writable home, and can be enumerated and
reaped deterministically.

## D-WE-12 — Deterministic host mechanics, validated inputs, preserved isolation

**Decision:** Trusted automation owns Git/session mechanics and validates all
names and destinations. Model text never becomes an unchecked path or shell
fragment. Existing resources and dirty work are never deleted as generic
rollback, and credential acquisition remains outside the sandbox.

**Satisfies:** R-WE-15, R-WE-22, R-WE-30, R-WE-31, R-WE-32, R-WE-33.

**Rationale:** Project-local extensions run with host authority. The new
convenience must not turn a conversational command into arbitrary shell
execution or weaken the established OpenShell boundary.

## D-WE-13 — Treat the current run as topology evidence, not implementation proof

**Decision:** Record the current branch/worktree/session/sibling facts as the
first manual proof, while explicitly leaving the one-command automation and its
failure semantics for implementation and regression testing.

**Satisfies:** R-WE-18, R-WE-19, R-WE-21, R-WE-33.

**Rationale:** The POC proves that the desired topology works. It does not yet
prove that a public, stable extension interface can perform every step
atomically. Evidence-backed planning distinguishes those claims.
