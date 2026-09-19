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

**Rationale:** The POC used `SessionManager.forkFrom(...)` to persist the
conversation branch and daemon `create(sessionPath=...)` to activate it as a
reachable top-level sibling. `rlm.create_session(cwd=...)` can also create a
sibling, but creates a fresh transcript and is therefore not the episode-
inheritance mechanism. Product ownership must remain stable if Prime Agent's
internal family representation changes or a coordinator restarts.

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
decisions documents, and allocates no episode infrastructure. Because project
conversations share the canonical checkout, the trusted write path serializes
mutation with a project lock, rejects unrelated dirty state, stages only its own
bundle, and commits and pushes it. Success requires a clean checkout; failure
reports the exact state without absorbing another conversation's changes.

**Satisfies:** R-WE-10, R-WE-11, R-WE-12, R-WE-13, R-WE-35, R-WE-36.

**Rationale:** Conversation history is enough for raw ideas; the future folder
preserves ideas worth durable treatment without implying approval to execute.
Named subfolders permit several candidates concurrently. The POC observed
unrelated plan changes appearing in the shared canonical checkout, so ordinary
`git add`/`commit` from one conversation is not an adequate ownership boundary.

## D-WE-7 — Promoted episodes inherit conversation and keep the owner alive

**Decision:** Episode creation forks the complete active conversation branch with
`SessionManager.forkFrom(sourceSessionFile, worktreePath)`, then activates that
persisted session through daemon `create(sessionPath=...)`, while leaving the
project conversation active as coordinator. A generic handoff summary, selected
subset, or fresh sibling does not satisfy the initial contract. Selective or
pre-compacted inheritance is deferred as a possible deliberate refinement, not
an implementation alternative for this gate.

**Satisfies:** R-WE-16, R-WE-17, R-WE-18, R-WE-19, R-WE-21, R-WE-25.

**Rationale:** The founding Vision explicitly requires past-design awareness at
the conversation-to-episode boundary. The POC demonstrates complete active-
branch inheritance and live sibling collaboration. It also distinguishes the
successful fork-plus-daemon path from `rlm.create_session(cwd=...)`, which
creates a fresh session without transcript inheritance.

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

**Rationale:** The POC proves that the desired topology works through
`SessionManager.forkFrom(...)` plus daemon `create(sessionPath=...)`. It does
not yet prove that a public, stable extension-facing interface composes every
step, owns partial-failure recovery, and admits the task exactly once. Evidence-
backed planning distinguishes those claims.

## D-WE-14 — Bridge the multi-turn workflow to trusted automation explicitly

**Decision:** The native command injects canonical interview workflow text, but
its final disposition is executed only through a stable, structured,
model-callable host capability. That capability owns locking, Git, filesystem,
session, daemon, metadata, and recovery mechanics. The planner may choose its
precise extension interface, but the model must not synthesize equivalent shell
commands from prose and the bridge must be testable across turns.

**Satisfies:** R-WE-5, R-WE-8, R-WE-9, R-WE-15, R-WE-20, R-WE-22, R-WE-34,
R-WE-35, R-WE-36.

**Rationale:** Slash-command invocation and final operator disposition are
separated by an open-ended interview. An injected prompt alone cannot retain a
trusted callback. An explicit capability preserves deterministic mechanics and
an exactly-once contract without constraining planning to an unproven API shape.


## D-WE-15 — Derive destructive and publication authority from immutable identity

**Decision:** Future recovery derives deletion authority only from immutable
receipts for regular-file objects created through `O_EXCL` descriptors, never
from a directory pathname or identity. Directory identity remains a mutation
guard. Recovery consumes file authority durably, quarantines each exact file
inside one held target descriptor, revalidates it, and unlinks only that name.
Every product-directory incarnation is retained.
Publication names the verified owned commit OID directly. Replayed success is
evidence-validated and separates historical facts from current observations.

**Satisfies:** R-WE-22, R-WE-35, R-WE-36, R-WE-69, R-WE-70, R-WE-71,
R-WE-72, R-WE-73.

**Rationale:** Mutable labels, matching bytes, path continuity, moving refs, and
check-then-delete windows are observations rather than authority. The Astra
counterexamples against `6a0d4e4` and `ae31587` showed that path-bound creation
receipts can still delete a renamed-and-replaced directory. Destructive
authority must remain attached to the created object through its use boundary.

**Consequences:**

- Failed preconditions never synthesize ownership. Commit-bearing recovery with
  missing or stale object identity stops rather than inferring authority.
- Rename-and-replace invalidates file mutation authority even when bytes match;
  directories are never removed under any receipt.
- Removal authority is consumed durably before unlink. Neither later path reuse
  nor a mutable journal reset can reactivate it.
- Recovery validates and quarantines exact owned files through a held target FD.
  It preserves every directory, replacement, concurrent entry, and shared parent.
- Push names the verified commit OID rather than moving `HEAD`; a concurrent
  local descendant remains unpublished.

## D-WE-16 — Revalidate identity, containment, type, and observation at use

**Decision:** Validation that grants authority or supports a current-state claim
must occur at the boundary where that authority or claim is used. Control-state
writes and destructive operations use held directory descriptors, `O_NOFOLLOW`,
and quarantine-before-unlink. Commit construction avoids a pathname-based
private index and proves exact regular-file tree modes, paths, and bytes. Success
replay validates every recorded OID/relationship before collecting one coherent
fresh current-state observation.

**Satisfies:** R-WE-35, R-WE-36, R-WE-69, R-WE-72, R-WE-74, R-WE-75,
R-WE-76, R-WE-77, R-WE-78.

**Rationale:** The fresh owner gate for `ae31587` reproduced ASTRA-06–09. An
earlier containment check cannot authorize a later write or delete after a
child-path swap; a journal path/hash cannot authorize access through a static
`indexes` symlink; an earlier clean snapshot cannot describe state observed
later; validating one OID cannot authenticate all recorded identities; an outer
catch cannot normalize corrupt success without destroying evidence; and blob
equality cannot prove a regular-file tree entry. These are the same authority-
at-use failure class across filesystem, Git, and result-reporting boundaries.

**Consequences:**

- Security-sensitive product and control operations descend from held directory
  descriptors with non-following opens. Removal quarantines the exact entry,
  revalidates it, and unlinks only the quarantine name. Static or swapped
  children cause no external mutation or product deletion.
- Commit construction hashes trusted bytes and rebuilds the base tree directly;
  it does not expose a pathname-raceable private Git index. Constructed and
  committed entries must be exact `100644 blob` objects; mode `120000` is
  rejected before push and during replay.
- Every present commit/OID field is syntactically and relationally validated.
  All malformed-success paths are preservation-only: the transaction journal
  and blocker remain exact while separate attempt evidence records diagnostics.
- `current_*` fields are derived from one fresh post-validation observation or
  replay fails closed; older snapshots cannot overwrite newer reconciliation.
- Permanent regressions ASTRA-05, ASTRA-06, ASTRA-06b, ASTRA-07, ASTRA-08,
  ASTRA-08b, and ASTRA-09 remain part of Slice 2 acceptance.

**Evidence:** The formal EXPERT report is
`/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-ae31587/slice2-ae31587-astra-review.md`.
The adjacent owner gate, two runnable counterexample files, and two owner logs
preserve the seven failed assertions (0/5 and 0/2).
