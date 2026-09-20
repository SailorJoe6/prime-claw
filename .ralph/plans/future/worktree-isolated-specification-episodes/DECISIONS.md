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
guard. Recovery consumes file authority durably, retires each exact file from
one held target descriptor into retained Git-common quarantine, and revalidates
it there. Checked names are never unlinked. Every product-directory incarnation
is retained.
Publication names the verified owned commit OID directly. Replayed success is
evidence-validated and separates historical facts from current observations.

**Satisfies:** R-WE-22, R-WE-35, R-WE-36, R-WE-69, R-WE-70, R-WE-71,
R-WE-72, R-WE-73.

**Implementation status at `14e5cfa`: NOT FULLY IMPLEMENTED.** ASTRA-10,
ASTRA-12, and ASTRA-13 contradict the destructive/incarnation/evidence claims.

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
- Removal authority is consumed durably before public-name retirement. Neither later path reuse
  nor a mutable journal reset can reactivate it.
- Recovery validates and quarantines exact owned files through a held target FD.
  It preserves every directory, replacement, concurrent entry, and shared parent.
- Push names the verified commit OID rather than moving `HEAD`; a concurrent
  local descendant remains unpublished.

## D-WE-16 — Revalidate identity, containment, type, and observation at use

**Decision:** Validation that grants authority or supports a current-state claim
must occur at the boundary where that authority or claim is used. Control-state
writes and retirement operations use held directory descriptors, `O_NOFOLLOW`,
and retained quarantine rather than unlink. Commit construction avoids a pathname-based
private index and proves exact regular-file tree modes, paths, and bytes. Success
replay validates every recorded OID/relationship before collecting one coherent
fresh current-state observation.

**Satisfies:** R-WE-35, R-WE-36, R-WE-69, R-WE-72, R-WE-74, R-WE-75,
R-WE-76, R-WE-77, R-WE-78.

**Implementation status at `14e5cfa`: NOT FULLY IMPLEMENTED.** ASTRA-10–15
show that validation still ends before dangerous syscalls, misses control/lock
incarnations and platform semantics, and accepts or overwrites invalid success.

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
  descriptors with non-following opens. Removal retires the exact entry to
  retained quarantine and revalidates it without unlink. Static or swapped
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


## D-WE-17 — Carry object and lock authority through the final syscall

**Decision:** A pathname, random quarantine name, or pre-syscall validation is
never sufficient destructive authority. Product/control deletion remains bound
to an enforced exclusion or to the same object through the final syscall;
otherwise the object is preserved. Restoration uses atomic no-replace semantics
and leaves quarantine evidence on conflict. Control-record replacement uses an
atomic descriptor-relative exchange and retains the prior object. Control
directory and lock creation, create-only owner publication, use, cleanup, and
release remain bound to one incarnation across helper calls. A durable exact
retirement manifest makes partial multi-object cleanup resumable. A
post-publication lock-acquire failure retires the exact lock while authority is
still held. A constrained helper failure can never fall back to recursive raw
pathname cleanup.

**Satisfies:** R-WE-22, R-WE-35, R-WE-69, R-WE-70, R-WE-74, R-WE-79,
R-WE-80.

**Rationale:** ASTRA-10 replaced a validated quarantine leaf at the final unlink
and caused deletion of unowned work; it also proved ordinary restoration can
clobber a new destination. ASTRA-11 proved raw recursive cleanup, pathname mkdir,
and split lock-owner publication can escape or adopt another lock incarnation.
Authority must cover the mutation itself, not only the preceding check.

**Acceptance:** Permanent disposable tests inject replacements at final product,
control, and preflight-probe unlink; at losing-publication/probe final `rmdir`;
at concurrent restoration destination creation; and at control mkdir, lock-owner
publication, helper cleanup, and lock release. Every external sentinel, empty
replacement directory, prior owner record, and replacement lock survives exactly.
A prior descriptor check never authorizes later pathname destruction.

## D-WE-18 — Use a platform-real incarnation model

**Decision:** Filesystem identity fields retain their real platform semantics.
Mutable `ctime` is never renamed or treated as immutable birth time. The supported
incarnation model must survive the transaction's own renames while still
rejecting replacement objects. Supported-platform claims require native tests;
unsupported platforms are rejected before product mutation and documented.

**Satisfies:** R-WE-11, R-WE-22, R-WE-36, R-WE-69, R-WE-70, R-WE-73,
R-WE-81.

**Rationale:** ASTRA-12 showed that the Linux no-birthtime branch records ctime as
birthtime, then rejects the same object after the helper's own rename. A label
cannot make mutable metadata an incarnation invariant.

**Acceptance:** Native create, continue, removal, replacement, and restart tests
pass on each supported Linux/Python/filesystem combination and on macOS. The
Linux test must not be only a macOS attribute-hiding simulation.

## D-WE-19 — Treat success as a closed durable proof object

**Decision:** Success is a complete versioned proof graph, not a permissive
status label. Its schema has exact immutable fields and shapes; every retained
OID is validated according to its meaning; directory, file-creation, final
bundle receipts, and retained exact-tree construction evidence are cross-bound
historically to the commit graph. The final accepted remote state
must still prove success-commit reachability before blocker cleanup. Preservation
mode begins before or atomically with durable success publication and governs all
later failures.

**Satisfies:** R-WE-72, R-WE-75, R-WE-76, R-WE-78, R-WE-82, R-WE-83,
R-WE-84.

**Rationale:** ASTRA-13 accepted missing/malformed schema fields, retained
recovery OIDs, and inconsistent/missing receipt relationships. ASTRA-14 cleared
a blocker after its newer stable remote observation disproved durability.
ASTRA-15 overwrote newly persisted corrupt success because preservation began
only for success read at invocation entry.

**Acceptance:** Permanent table-driven regressions reject every accepted
ASTRA-13 mutation without changing journal/blocker bytes; a remote rollback
between historical validation and final observation preserves the blocker; and
faults after success write or during final cleanup preserve exact success bytes
and use separate diagnostics.

## D-WE-20 — Require allocation-unique authority and a proven retirement topology

**Decision:** A metadata tuple is not destructive authority unless the supported
platform proves it allocation-unique for the full helper-restart interval.
Otherwise an enforceable live exclusion is required. Platform admission also
proves the actual source/destination mount and rename capabilities needed by
retirement; unsupported identity or topology combinations reject before any
control or product mutation.

**Satisfies:** R-WE-69, R-WE-70, R-WE-73, R-WE-81, R-WE-85, R-WE-86,
R-WE-92.

**Rationale:** ASTRA-16 reproduced natural Linux inode/birthtime tuple reuse and
fresh-helper acceptance of a distinct allocation. ASTRA-17 showed that a
pre-rename directory substitution or hardlink write can still be relocated.
ASTRA-23 showed that accepted separate mounts can fail with `EXDEV` only after
manifest publication. Rename stability and matching `st_dev` do not prove these
contracts.

**Acceptance:** Native rapid allocation-reuse, final directory/hardlink
substitution, nested-mount, and two-volume tests pass on every supported
combination. Replacement tests compose rename with each source/destination
barrier failure and fresh-process resume; unauthorized objects are restored
no-replace or both conflict locations are retained. Unsupported combinations
reject before durable mutation.

## D-WE-21 — Make recovery and final cleanup one-way durable state machines

**Decision:** Manifest publication, retirement progress, lock use, quarantine,
and blocker cleanup are explicit one-way state machines. Every transition is
bound to the exact approved object and continuous authority through the mutation,
has a durable idempotent outcome, and is reconciled after an uncertain response.
A consumed state forbids continuation. Namespace durability barriers are part of
the transition contract, not an implementation detail.

**Satisfies:** R-WE-22, R-WE-35, R-WE-69, R-WE-70, R-WE-74, R-WE-78,
R-WE-80, R-WE-84, R-WE-87, R-WE-88, R-WE-91, R-WE-93.

**Rationale:** ASTRA-18 published foreign manifest bytes and let continuation
poison partial retirement. ASTRA-19 found lock/quarantine authority gaps at
cleanup, use, and post-helper boundaries. ASTRA-22 separated blocker approval
from retirement and exposed response loss. ASTRA-24 found missing namespace
flush barriers on acknowledged transitions.

**Acceptance:** Permanent tests cover foreign manifest publication, every
partial-state recovery action, lock loss before each product/ref/push boundary,
failed cleanup replacement, post-helper failure, quarantine replacement, blocker
replacement and response loss, plus syscall-order/restart durability traces.
Retirement traces inject failure at every post-rename/pre-validation barrier and
prove fresh-process reconciliation
for both product and analogous control retirement.

## D-WE-22 — Validate raw success evidence before routing or semantic use

**Decision:** Evidence is parsed with duplicate-key rejection before any routing.
Known mutable recovery and recognizable success evidence have disjoint exact
schemas. Git identities are validated as unpeeled exact object types and required
relationships; timestamps are calendar-valid. Malformed recognizable success
always enters preservation-only handling under every action.

**Satisfies:** R-WE-72, R-WE-76, R-WE-78, R-WE-82, R-WE-84, R-WE-89,
R-WE-90.

**Rationale:** ASTRA-20 accepted annotated tags and duplicate/escaped raw keys.
ASTRA-21 showed that corrupting the success discriminator routes a v2 proof into
legacy mutable normalization.

**Acceptance:** Raw duplicate-key, escaped-collision, annotated-tag, invalid-time,
and success-discriminator matrices all reject while preserving exact journal and
blocker bytes under ordinary replay and every recovery action.

## D-WE-23 — Close every durable writer-to-validator transition

**Decision:** The durable transaction schema is a state-machine interface shared
by writers and readers, not only an input filter. Every writer projects an exact
schema-valid state for its phase/status, and every recovery transition is
monotonic or names an explicit closed variant. A writer may not rewind phase while
retaining later-phase evidence, and cleanup may not emit a terminal status that
its own replay validator rejects.

**Satisfies:** R-WE-22, R-WE-90, R-WE-94.

**Rationale:** ASTRA-25 showed two product-generated contradictions: interrupted
continuation rewrites `building-exact-tree` while retaining constructed-tree
fields, and running-to-removed cleanup can omit the observation variant required
for `recovered-clean`. Both become unknown to the same validator that guards
recovery, without foreign evidence edits.

**Acceptance:** A generated transition-closure matrix enumerates every persisted
writer output and validates it immediately and through fresh replay. Permanent
fault tests interrupt each continuation phase, repeat continuation, and replay
running-to-removed cleanup. Malformed recognizable success remains
preservation-only; validator relaxation is not an accepted fix.

**Evidence and implementation status:** Candidate `44b92f8` implemented proposed
D-WE-20–22 mechanisms but its fresh owner/formal gate returned **REVISE**. ASTRA-10
and ASTRA-11 regress at new probe/publication cleanup sites; ASTRA-17/24 remain
open across post-rename barrier failure and fresh replay; ASTRA-25 establishes
D-WE-23 because product writers emit states rejected by their own validator.
D-WE-17, D-WE-20, D-WE-21, and D-WE-22 therefore remain partial/unmet at the
specified edges. The authoritative report is
`/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-44b92f8/slice2-44b92f8-astra-review.md`
(SHA-256 `84c9a0f1fc78ffb0db8ec528dd8765f674d32b9f41207e1d41f1434d7b072e91`),
with owner gate, artifact manifest, invocation tree, and cleanup receipt beside
it.

Transition `a40489d7-38c1-4170-8b5e-c6f9c660f8b0` now provides focused D-WE-20/21
implementation evidence for ASTRA-17/24: deterministic destinations are durable
state discriminators; fresh resume validates destination-first, completes exact
retirement idempotently, restores invalid objects no-replace, or preserves and
reports both conflict locations. Product, control, and tree-evidence paths flush
source then destination parents after rename and restore, with disposable
fresh-process fault coverage at each post-rename/pre-validation and restore
barrier. Transition `dc0f2b07-726b-4fa3-b6c7-7a4170e7bc7c` adds focused D-WE-23
evidence: validator-gated mutable persistence, v2 pre-write and durable-reread
validation, explicit monotonic/closed recovery variants, and a registered
17-variant fresh-process transition matrix. Every normal, catch-failed,
repair-only, removal, readvance, and success image is validated immediately and
on separate-process replay. Malformed recognizable success remains
preservation-only. The scoped final ASTRA-25 audit is PASS, but this is not the
fresh owner/formal Slice 2 gate. Broad same-UID authority remains unresolved and
is not narrowed. Slice 2 stays open and Slice 3 is not authorized.

### Gate adjudication for candidate `7eac1e7`

The fresh owner/formal gate supersedes the scoped implementation audit and
returns **REVISE**. Transition `ba165904-ac51-4e82-9ec3-46f6693fe67f` records
this authority without authorizing implementation. D-WE-17 remains open at raw
broker socket cleanup and capability-probe retirement. D-WE-20 remains open at
probe restoration. D-WE-21 remains open at before-journal continuation and
fresh lock/guard retirement. D-WE-22/D-WE-23 remain open because validator
rejection occurs only after product/receipt mutation and catch cannot produce an
accurate durable state or blocker. The exact-tree rewind, terminal observation,
and product/control/tree reconciliation corrections remain credited but cannot
establish the broader decisions.

Authority is `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/slice2-7eac1e7-owner-gate.md` (SHA-256
`7fbfd05868f2718d326ebb83b26d035e9b25f5a78106e21da909688f863c2652`) and
`/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/slice2-7eac1e7-formal-review.md` (SHA-256
`93098c2cf8545a38dd863b242366305a2c21043ce886f3a2f3d326a0e56620d9`).
`FS-REMOTE-01` is scoped follow-up rather than false-success evidence. `COV-01`
is required D-WE-23 acceptance coverage; `COV-02/COV-03` correct traceability
and evidence labels. Historical orphan brokers are evidence only. Performance
bead `prime-claw-h6w.10` stays non-blocking. Slice 3 is not authorized.

### Transition c3ab817d — bounded ASTRA-guided Luna experiment

Owner authorization permits one same-Slice-2 correction generation from clean
documentation boundary `d9ce607148dec9c0828f3c32999dc0143f038c0d`, targeting only
ASTRA-10/17/19/24/25 and COV-01/02/03. It does not authorize Slice 3 or broaden
`prime-claw-h6w.10`; all hazardous work uses disposable fixtures.

### Transition `c3ab817d` correction candidate evidence

The bounded same-Slice-2 correction generation now has integrated implementation
evidence, but not owner or formal gate acceptance. Before-journal continuation
projects a closed `journal-created` state with complete immutable fields before
any product mutation. Fresh processes prove product-generated failure, corrected
precondition, interrupted journal and directory writers, catch, repeated
continuation, ownership receipt, target and blocker evidence, terminal success,
and inspection. Malformed-success behavior remains unchanged.

Broker supervisors no longer unlink AF_UNIX socket pathnames during failed-start
or normal-exit cleanup. Because pathname deletion cannot be allocation-bound,
stale names are preserved as evidence; random per-acquisition tokens prevent
reuse. Disposable tests substitute files, sockets, and directories at both
broker roles and both cleanup edges. Existing destination-first product, control, and tree retirement matrices remain
unchanged and pass their stated fresh-process barrier/restoration coverage. They
do not cover capability-probe or lock/guard fresh restoration; the broader claim
is withdrawn by the `71a1944` owner gate. Inventory completeness now
includes R-WE-85 through R-WE-94; rejected/current evidence labels remain
separate.

Candidate validation before commit:

- combined Node suites: **104/104 passed** in **2,407.28 seconds**;
- exact `PYTHONDONTWRITEBYTECODE=1 pytest -q -p no:cacheprovider tests`:
  **283 passed, 2 skipped, 11 warnings** in **3,736.27 seconds**;
- targeted ASTRA-25 fresh-process continuation: **1/1 passed**;
- targeted ASTRA-25 writer/terminal matrix: **3/3 passed**;
- targeted broker replacement matrix: **3/3 passed**;
- targeted retirement/topology matrix: **9 passed, 1 platform skip**;
- COV-02 inventory traceability: **1/1 passed**.

Slice 2 remains open pending clean commit/push identity, fresh
PROJECT_CONVERSATION owner verification, and fresh independent Astra review.
Slice 3 remains blocked and unstarted. `prime-claw-h6w.10` remains non-blocking.

Independent read-only audit **PASS**: `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-6e71cf2b/slice2-c3ab817d-independent-audit.md`
(SHA-256 `632887bf75d602037d8a92f32a41da442a19c4c5f74af41f4442c17683da8411`). The audit found no blocking static,
schema-closure, preservation, traceability, or scope-expansion defect. It did not
rerun long suites or grant owner/formal acceptance. Residual risks are intentional
stale unique-token broker names, platform-specific skipped coverage, and the
existing process-interruption versus power-loss boundary.

### Fresh owner gate for immutable candidate `71a1944` — REVISE

Candidate `71a1944eef9330308639312a53865de032bc7c14` is preserved as an
immutable rejected boundary. The authoritative owner gate is `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-71a1944/slice2-71a1944-owner-gate.md`
(SHA-256 `6efb5d4d7a191e0e9a92662e3a6084d99ae6da9da81cfeb41d426b625e283d7a`).
The formal GPT-6 Astra parent did not deliver its required synthesis after the
single permitted same-identity finalize-only recovery, so the lifecycle failed
closed rather than being mislabeled complete. That record is `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-71a1944/formal-review-delivery-failure.md`
(SHA-256 `539f27ed85cbdbae8c81acb3e6b5456a1e0f0eac97741b70438c902308c0dfe3`).
All three specialist reports independently returned **REVISE**:

- retirement: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-71a1944/retirement-review.md` (SHA-256
  `2b5a8505909ce86c0eeace404df8100e39e39ce8346ce3b627c75d0aa77cf3ca`);
- state: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-71a1944/state-review.md` (SHA-256
  `bbc3632b0fcee98d518b1dc84e4105da64b2beb8f2c9da00f3680aa5997314a2`);
- coverage: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-71a1944/coverage-review.md` (SHA-256
  `ce197d0df398336da76e29b7564b18e578ab728a983e15e771440045d8d17a68`).

Remaining blockers are exact and unchanged by the green candidate suites:

1. **ASTRA-17/24:** capability-probe retirement can relocate a foreign
   directory or dirty hardlink to quarantine and leave the public name absent
   across interruption/fresh retry. The product/control/tree matrices do not
   cover this mutation class. Analogous raw `preserve_entry` callers can also
   relocate foreign directories while reporting success.
2. **ASTRA-19/24:** lock and guard retirement still relies on process-local
   `lock_moved`/`guard_moved`. Six real replicated-supervisor rename/barrier
   cases stranded foreign replacements after fresh resume; all twelve disposable
   supervisors were released and reaped.
3. **ASTRA-19:** broker unlink removal is credited, but raw pathname
   `os.chmod(path, 0o600)` can mutate replacement files, directories, sockets,
   and an external sentinel through a replacement symlink.
4. **ASTRA-25:** interruption after durable `recovered-clean` publication but
   before approved-blocker retirement leaves a blocker that terminal replay
   never clears, wedging later disposition identities.
5. **ASTRA-25:** terminal journal pre-write failure after product retirement
   produces a schema-invalid catch projection. Explicit retry can recover; this
   is not classified as permanent data loss.
6. **Coverage/traceability:** the prior probe/lock/guard restoration claim was
   unsupported and is corrected above. COV-02 still omits R-WE-22 and couples
   structural completeness to rejection of truthful older `blocked`/`reopened`
   statuses. COV-01 is materially improved but must not be described as proving
   every fresh-process transition.

Credited improvements remain the genuine before-journal fresh-process correction,
broker unlink removal, corrected historical 93/264 labels, synchronized
appendices, explicit Slice 3 block, and R-WE-85–94 membership coverage. Green
104/104 Node and 283-pass Python totals are candidate evidence, not acceptance.
Broad same-UID authority remains unresolved and is not narrowed.

`prime-claw-h6w.3` remains in progress. Slice 3 remains blocked and unstarted.
This rejection does not authorize another correction generation; the owner must
separately apply the consecutive-revision escalation rule and select the next
boundary. `prime-claw-h6w.10` remains non-blocking and unchanged.

### Owner-authorized bounded correction generation `dd08e63a`

Owner authorization `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-71a1944/next-correction-authorization.md` (SHA-256
`5fc1ffda38e8e27f944b9fe54552f123d4c0225c47f110df1199b085e561bcb0`)
permits exactly one further same-Slice-2 correction generation from clean pushed
authority boundary `aafaf59127a5dfb82ef066968d6cad3994ae75cc`. Rejected candidate
`71a1944eef9330308639312a53865de032bc7c14` remains immutable. This authority is
limited to the six recorded blocker classes and does not authorize Slice 3,
`prime-claw-h6w.10`, model-policy changes, broad same-UID scope narrowing, or an
acceptance claim.

Implementation invariants, derived before editing:

1. **Probe/raw retention:** an unauthorized same-UID replacement may not remain
   displaced merely because validation detects it after rename. Durable
   destination-first evidence must support fresh idempotent reconciliation,
   no-replace restoration to a free public name, and both-location preservation
   on conflict for capability probes and all three raw `preserve_entry` callers.
2. **Lock/guard retirement:** deterministic destinations and durable evidence,
   never process-local movement flags, govern fresh recovery across rename,
   both parent barriers, response loss, live and abandoned replicated
   supervisors, and occupied restoration destinations.
3. **Broker permissions:** metadata changes must be bound to the allocated
   socket object. No pathname `chmod`, stat-then-chmod, or other check/use
   sequence may affect substituted files, directories, sockets, or symlink
   targets.
4. **Terminal blocker replay:** every `recovered-clean` return first reconciles
   the exact approved blocker idempotently and never retires a foreign blocker;
   repeated recovery must permit a later different disposition.
5. **Terminal pre-write closure:** failure after product retirement/ownership
   consumption but before terminal publication must yield an exact-validator
   valid durable state and usable fresh recovery action without relaxing schema
   validation or discarding terminal evidence.
6. **Coverage/traceability:** permanent fresh-process matrices must truthfully
   cover probe, raw retention, lock/guard, broker metadata, and terminal state
   cases. Completeness includes R-WE-22 and must permit truthful historical
   `blocked`/`reopened` statuses. Unsupported green claims remain removed until
   evidence exists.

Run blocker-specific disposable tests first. After all six classes and a
read-only independent audit are green, run exactly one combined Node suite and
one `pytest -q tests` suite nonblocking without resource contention. Then run
inventory/syntax/JSON/diff/process/Git checks, commit and push one clean immutable
candidate, prove local/upstream/actual-remote identity, and stop for fresh owner
verification and fresh GPT-6 Astra review.

### `dd08e63a` correction audit PASS; integrated validation pending

The one owner-authorized bounded correction generation now has focused and
independent read-only evidence for all six named classes. The implementation:

- binds raw/probe retention evidence to the original parent and encoded object
  authority, validates all terminal tuples before orphan suppression, rejects
  isolated and composed same-namespace authority substitutions, and reconciles
  retirement/restoration barriers and response loss;
- reconciles lock/guard retirement from deterministic destinations across
  fresh processes, free/occupied restoration names, live/abandoned supervisors,
  restoration barriers, and lost completed-release responses;
- creates broker sockets with child-local `umask(0o177)` at bind time and never
  applies pathname `chmod`;
- persists exact terminal approved-blocker identity/hash, retires only that
  blocker on replay, preserves foreign replacements, and keeps pre-write
  terminal failure validator-closed; and
- includes R-WE-22 in exact Slice 2 structural membership without rejecting
  truthful historical `blocked` or `reopened` statuses.

Focused evidence is **23/23 passed** for the authorized Python blocker matrix,
with the terminal Node matrix **3/3 passed** and the foreign-blocker replay
**1/1 passed**. The independent audit sequence is preserved as evidence:

- initial REVISE: `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-381edcaa/slice2-dd08-independent-audit.md`
  (SHA-256 `eb2f8107257f3fa997f49219a3a3a3cfc2da7d6dd02b96bf98c35df82f32a4a4`);
- first re-audit REVISE: `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-381edcaa/slice2-dd08-independent-reaudit.md`
  (SHA-256 `793f7495f1deb68feaced83f9083d134fc6b1fcfff71c5c1b0327e5b786dd3ab`);
- second re-audit REVISE: `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-381edcaa/slice2-dd08-independent-reaudit-2.md`
  (SHA-256 `b10d0243768dd52ed5ae4a9caef71f74492b5ea7fe24004ceb284232d7347e04`);
- final re-audit **PASS**: `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-381edcaa/slice2-dd08-independent-reaudit-3.md`
  (SHA-256 `27eb003e1f85cf1b28f10e6b3b0b9f17381d8dfb3f1e5ee47f3c2dff128dc241`).

This PASS covers only the named authorized correction. R-WE-85/R-WE-87 remain
truthfully partial/unproven, the integrated suites are still pending, and no
owner/formal acceptance or Slice 3 authority is implied.

### Integrated Node slot consumed with two focused regressions

The one authorized combined Node run completed **103/105 passed** with **2
failed** in **2,413.11 seconds**. The failures were the ASTRA-21 mutable-schema
valid fixture and the corrupt-durable-receipt error-routing case. The Python
suite did not start.

The narrow correction separates retained allocation identity from content:
pending evidence still validates both commitments, while terminal hardlinks
validate allocation identity so intentional later mutation of a public receipt
reaches the canonical corrupt-receipt check. The valid ASTRA-21 recovered-state
fixture now includes the required approved blocker hash and identity. Focused
post-failure evidence is **1/1** for each named Node regression and **5/5** for
the retained-authority attack matrix.

A fresh read-only delta audit is pending. The integrated slot has been consumed;
no combined rerun or Python suite is authorized yet. Slice 2 remains open and
Slice 3 remains blocked.

### Replacement integrated validation authorization `dacf7b62`

The owner authorized exactly one replacement nonconcurrent combined Node run
and, only after a fully green Node result and helper reconciliation, exactly one
nonconcurrent `pytest -q tests` run. The authorization artifact is
`/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/authorizations/slice2-dd08-replacement-integrated-validation-dacf7b62-96c9-4e0d-90da-54bf097da1d0.md`
(SHA-256 `11679b81d8ac10d9ccbc81ed5c0721ccd932004d5ff7dfe1803e49f5da3a28ef`).
It grants validation slots only: no Slice 2 acceptance, Slice 3, model-policy,
`prime-claw-h6w.10`, or scope authority.

### Replacement Node validation failed at concurrent probe terminalization

Owner authorization `dacf7b62-96c9-4e0d-90da-54bf097da1d0` was consumed by the
replacement combined Node run. It completed **104/105 passed**, **1 failed** in
**2,403.27 seconds**. The sole failure was `two OS processes serialize future
bundles without cross-commit or lost work`. One process completed the
capability-probe anchor-to-terminal rename while the other attempted the same
idempotent terminalization; the loser received `ENOENT` reported against the
`retention-complete-capability-probe-*` destination. The corrected ASTRA-21 and
corrupt-receipt regressions both passed in this integrated run.

Python did not start. No further material correction or integrated validation
is authorized. Historical helper PIDs `37261` and `98315` remain untouched;
there are no new run-owned helpers. Slice 2 remains open and Slice 3 remains
blocked pending a new owner decision.

### Bounded terminalization-race correction `42665219`

Owner authorization `42665219-968c-44a7-a399-c997b940bcbb` permits only the
retained anchor-to-complete response-race correction and focused evidence. Its
artifact is `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/authorizations/slice2-dd08-retention-terminalization-race-42665219-968c-44a7-a399-c997b940bcbb.md`
(SHA-256 `228646c869f5b6a2a3c8e8e8fe481b89d8031948b694596f5abd1490307a8180`).

The exact-target terminalization now treats only `ENOENT`/`EEXIST` uncertainty
with an existing terminal marker as a request to re-enter closed reconciliation.
The existing completed-marker and retained-target identity/topology checks decide
the outcome; absent, replaced, mixed, or non-exact topology still fails closed.

Focused evidence is green:

- sole named two-process Node regression: **1/1 passed** in **62.51 seconds**;
- deterministic two-reconciler terminal response proof: **1/1 passed**;
- directly related forged-marker, composed-authority, and orphan-authority
  security regressions: **3/3 passed**.

A fresh read-only audit is pending. No integrated rerun, full Python suite,
commit/push, acceptance, or Slice 3 authority is implied.

### Terminalization-race audit REVISE and exact mixed-topology closure

The first bounded race audit returned REVISE at
`/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-381edcaa/slice2-dd08-terminalization-race-audit.md`
(SHA-256 `86a8de800d5c754d2f69a25638acb3771b64d60c5aa2cefb133dc486af7d20bf`).
Normal two-reconciler `ENOENT` replay was credited, but an exact duplicate
complete hardlink could coexist with the pending anchor and make `EEXIST`
appear terminal.

Completed topology now requires the corresponding pending anchor to be absent.
Exact `anchor + complete + retained target` coexistence preserves every name and
fails closed. Minimum focused evidence is **4/4 passed**: mixed-topology failure,
normal two-reconciler success, forged terminal marker/exact response loss, and
the composed authority/terminal attack. Fresh read-only re-audit is pending;
no integrated or full Python validation is authorized.

### Terminalization-race re-audit PASS

The bounded re-audit passed at `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-381edcaa/slice2-dd08-terminalization-race-reaudit.md`
(SHA-256 `c2aa2e4c6ceac611961438ffde9a0d022d5a57be0132956986181a2649c77205`).
It confirms exact winner/loser `ENOENT` replay, rejects pending-plus-complete
mixed topology without mutation, and preserves fail-closed handling for missing,
replaced, public-conflict, and other non-exact states. The replacement integrated
result remains **104/105 Node**, with Python not started. A new owner decision is
required for any integrated Node or Python slot; Slice 2 remains open and Slice 3
remains blocked.

### Post-race integrated validation authorization `daec55ba`

Owner authorization `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/authorizations/slice2-dd08-post-race-integrated-validation-daec55ba-f127-448a-8ae8-a509c65a74ce.md`
(SHA-256 `16f9bdc18bb375bfefcf7992f3a57ffe83b0f9afb8e0dbab9bb435e2a7e13be1`)
grants exactly one combined Node run and, only after a complete green Node result
and helper reconciliation, exactly one `pytest -q tests` run. The PASS reviewer
report remains preserved and hash-verified at `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-381edcaa/slice2-dd08-terminalization-race-reaudit.md`; its exact
read-only invocation tree `sub-381edcaa` was retired after artifact preservation.
This is validation authority only and does not accept Slice 2 or authorize Slice 3.

### Post-race integrated validation green

Under owner authorization `daec55ba-f127-448a-8ae8-a509c65a74ce`, the final
nonconcurrent validation sequence completed successfully:

- combined Node: **105/105 passed**, **0 failed**, in **2,253.27 seconds**;
- `pytest -q tests`: **301 passed, 2 skipped, 11 warnings** in **3,353.47
  seconds**.

All run-owned helpers were reconciled. Only protected historical PID-1 helpers
`37261` and `98315` remain and were not touched. These results clear the
integrated evidence gate for candidate production only. Slice 2 still requires
fresh owner verification and fresh GPT-6 Astra review; Slice 3 remains blocked.
