# Specification — Worktree-isolated specification episodes

> **Status:** implementation in progress; Slice 1 is validated; the same-Slice-2
> revision for ASTRA-05–09 is implemented under `prime-claw-h6w.3` and awaits
> final validation plus fresh owner/EXPERT acceptance; later paths are blocked.
> **Beads:** `prime-claw-h6w.1` under Phase 4 epic `prime-claw-h6w`.
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)

## 1. Purpose

Prime Claw needs a concrete conversation-to-episode boundary that permits many
specification-level efforts to proceed concurrently without sharing a checkout.
The project-local `/design` and `/spec-it-out` entry points must preserve their
existing interview workflows, defer infrastructure until the work is fully
understood, and then let the operator either incubate the specification or
promote it into an isolated production episode.

A promoted episode is one durable unit:

```text
specification identity
+ feature branch
+ git worktree
+ worktree-rooted Prime Agent session
+ owning project-conversation identity
+ PR lifecycle
```

The originating `PROJECT_CONVERSATION` remains rooted in the project's
canonical/default-branch checkout and coordinates the episode through review,
merge, and cleanup.

## 2. Current state

- `.agents/skills/design` and `.agents/skills/spec-it-out` expose canonical
  workflow text from `.ralph/skills/` as ordinary Prime Agent skills.
- Invoking either skill keeps work in the current session and writes fixed
  active paths under `.ralph/plans/`.
- Prime Agent project-local TypeScript extensions can register native slash
  commands and inject canonical skill markdown. `handoff-chain.ts` proves this
  pattern for `/handoff`.
- `SessionManager.forkFrom(sourceSessionFile, targetCwd)` can persist a new
  session branch with the complete active source conversation and the worktree
  as its CWD, but does not by itself activate that session in the daemon.
- The daemon `create(sessionPath=...)` operation can activate the persisted fork
  as a durable top-level sibling and returns its runtime identity.
- `rlm.create_session(cwd=...)` can create a fresh durable sibling, but it does
  **not** inherit the source transcript and therefore does not satisfy episode
  conversation inheritance by itself.
- Prime Agent sessions can observe and message sibling top-level sessions.
- The `future` bridge now serializes canonical-checkout mutation, constructs an
  exact index-free Git tree/commit, pushes and verifies the actual remote, and
  preserves explicit recovery state without allocating episode resources.
- Git worktrees provide independent checkout and index state while sharing the
  repository's object database and refs.
- The execute workflow archives completed planning documents, but its current
  prose names only `SPECIFICATION.md` and `EXECUTION_PLAN.md`, not the complete
  specification bundle.

## 3. Target hierarchy and filesystem model

```text
UNIVERSAL_AGENT
  └── PROJECT_CONTEXT — canonical/default-branch checkout
        ├── PROJECT_CONVERSATION A — long-lived session, canonical checkout
        │     ├── EPISODE 1 — branch + worktree + durable sibling session
        │     └── EPISODE 2 — branch + worktree + durable sibling session
        └── PROJECT_CONVERSATION B — long-lived session, canonical checkout
```

In the OpenShell runtime, the expected homes are configurable equivalents of:

```text
/sandbox/projects/<project-slug>                 # canonical checkout
/sandbox/worktrees/<project-slug>/<episode-slug> # episode checkout
```

A worktree is not a new `PROJECT_CONTEXT`; it is the isolated physical home of
one episode within the same project.

## 4. Entry-point workflow

### 4.1 Native commands with canonical workflow text

Project-local extension code shall register native `/design` and
`/spec-it-out` commands. The extension shall load the corresponding canonical
`.ralph/skills/<name>/SKILL.md` rather than duplicate workflow prose.

Once the native commands are proven, the duplicate `.agents/skills/design` and
`.agents/skills/spec-it-out` exposure shall be removed so each workflow has one
operator-facing command, following the precedent established by `/handoff`.

### 4.2 Semantic distinction

- `/design` starts when material requirements discovery and design discussion
  are still needed.
- `/spec-it-out` starts when the conversation already contains most of the
  required design context and only remaining questions or formalization are
  needed.

Both commands converge on the same disposition gate.

### 4.3 Complete interview before disposition

The invoked workflow shall finish the interview first. It shall ask necessary
questions one at a time, resolve all material open questions, and reach a state
where it can write a complete `SPECIFICATION.md`, `REQUIREMENTS.md`, and
`DECISIONS.md` bundle. It must not ask whether to allocate a worktree before
that point.

### 4.4 Disposition gate

When the work is specification-ready, the workflow shall ask the operator to
choose exactly one disposition:

1. **Incubate for later.** Write a named bundle under
   `.ralph/plans/future/<idea-slug>/`; create no branch, worktree, or episode
   session.
2. **Create an episode now.** Allocate the branch, worktree, and durable
   worktree-rooted session, carry the complete active conversation branch into
   it, and write the active specification bundle there.

Cancellation or failure shall not silently choose either disposition.

### 4.5 Multi-turn disposition bridge

Command invocation, interview, and disposition occur across multiple turns. The
native command may inject the canonical workflow text, but the operator's final
disposition answer must cross a stable, explicit bridge into deterministic,
trusted host automation. The model shall invoke that bridge with structured,
validated inputs; it shall not reconstruct or improvise Git, filesystem, session,
or daemon shell commands from workflow prose. The implementation plan may choose
the precise interface—for example, a model-callable capability registered beside
the native command—but it must define one durable contract for both disposition
paths and test that the final multi-turn answer reaches the intended automation
exactly once.

## 5. Future-plan behavior

The future disposition shall create:

```text
.ralph/plans/future/<idea-slug>/
├── SPECIFICATION.md
├── REQUIREMENTS.md
└── DECISIONS.md
```

Future bundles are durable, explicitly non-binding candidates. They remain in
the `PROJECT_CONVERSATION`; they do not allocate episode resources. A later
promotion path must be able to use a future bundle plus its complete applicable
conversation branch as input to the same episode-creation mechanism.

Because multiple project conversations share the canonical checkout, the trusted
future-write path shall acquire a project-scoped mutation lock before inspecting
or changing it. Under that lock it shall detect unrelated dirty state and refuse
to stage or commit another conversation's changes. It shall add only the new
future-bundle paths, commit and push that bundle durably, and leave the canonical
checkout clean on success. If dirty state, a concurrent update, commit failure,
or push/rebase conflict prevents that outcome, it shall report the exact state
and recovery action instead of claiming success or absorbing unrelated changes.

Names must be deterministic, filesystem-safe, and collision-resistant. Existing
future content must not be overwritten without explicit operator approval.

### 5.1 Astra-derived future-transaction safety invariants

The owner/EXPERT reviews of `6a0d4e4` and `ae31587` established these
non-negotiable invariants for the future path:

1. **Creation proof is object-bound deletion authority.** A failed precondition,
   byte-identical content, expected pathname, or mutable journal claim does not
   prove ownership. Removal requires durable transaction evidence bound to the
   identity of the actual directory exclusively created by that transaction.
   Replacing or renaming that directory invalidates authority even when a new
   directory at the same path has identical bytes. Commit-bearing recovery
   without valid creation evidence fails closed.
2. **Destructive authority is single-use and mutation-bound.** Immediately
   before the first unlink, recovery writes a create-only consumed-authority
   tombstone. At every control-state read, write, or delete that can grant or use
   destructive authority, it must re-establish that the derived child (including
   `future-ownership-consumed` and `indexes`) is non-symlink-contained beneath
   the real Git common directory. A completed removal, path reuse, static or
   swapped control-child symlink, or mutable journal reset cannot revive or
   redirect authority. Historical proof cannot authorize automatic recreation.
3. **Removal and publication preserve object types.** Security-sensitive
   filesystem operations descend from held directory descriptors with
   `O_NOFOLLOW`. Directory identity is a mutation guard, never deletion
   authority: product directories are always retained. Recovery quarantines and
   revalidates only exact `O_EXCL`-created file objects inside the held target,
   then unlinks only randomized names. Replacements and unowned entries survive.
   Commit construction bypasses a pathname-raceable private index and
   builds an exact tree from approved mode-`100644` blobs; mode `120000` can
   never be published.
4. **Publication names immutable identity.** Push uses the already verified
   owned commit OID as its source refspec, never moving `HEAD`. If another local
   writer advances `HEAD`, that descendant is not published and the transaction
   reports the resulting divergence.
5. **Success labels are evidence, not authority.** A replayed
   `verified-success` record validates every recorded OID field and required
   identity relationship, journal phase, commit parent, exact paths, tree entry
   types/modes and contents, document hashes, object-bound ownership evidence,
   and actual remote reachability before clearing a blocker or reporting
   historical success. Every malformed-success condition, including invalid
   paths discovered before ordinary replay validation, enters a preservation-
   only path: the exact transaction journal remains byte-for-byte unchanged,
   diagnostics live separately, blockers remain, and replay fails closed.
6. **Historical and current state stay distinct and coherent.** Historical clean
   success may remain true while the present checkout is dirty or advanced.
   Replay returns one coherent fresh post-validation observation for current
   checkout cleanliness, status paths, HEAD, upstream, and remote; it never
   mixes an older clean snapshot with newer reconciliation evidence.

### 5.2 Failed `ae31587` gate and narrow `14e5cfa` progress

The fresh owner/EXPERT gate for reviewed commit `ae31587` remains immutable
**REVISE** evidence. Candidate `14e5cfa` closes its seven narrow reproductions,
but its own fresh owner/EXPERT gate also returned **REVISE**. The mechanisms
below are meaningful progress, not proof of the broader invariants and not
authorization for Slice 3:

| Finding | Implemented mechanism | Permanent repository acceptance |
|---|---|---|
| ASTRA-05 | Directory identity guards file mutation but never authorizes directory deletion; create-only file receipts bind exact file objects to BigInt incarnation tuples and recovery uses one held target FD | Every directory incarnation survives; directory replacement and same-name byte-identical file replacement fail before file unlink and preserve exact status |
| ASTRA-06 | Tombstone paths are freshly derived beneath the real Git common directory after the final awaited boundary; durable writes reject symlink-resolved parents | A late `future-ownership-consumed` swap creates no external entry and deletes no product path |
| ASTRA-06b | Git no longer writes a pathname-based private index; construction evidence and cleanup use a held, non-following `indexes` descriptor | Static and late-swapped `indexes` symlinks cause no external write/delete and preserve sentinels |
| ASTRA-07 | Historical validation precedes a final observation that brackets local and actual-remote reads and rejects any change | Late local dirt/refs are reported together; a remote change inside the bracket fails closed |
| ASTRA-08 | A closed success validator checks every retained OID, equality/lineage relation, commit parent, private tree, hashes, ownership receipts, bundle, and actual remote state | Malformed and mismatched identities reject success without exposing them as verified facts |
| ASTRA-08b | Verified-success routing occurs before ordinary ownership/path checks; the branch and outer catch both preserve the journal and blocker and write only separate attempt diagnostics | Early invalid ownership paths leave transaction and blocker bytes unchanged |
| ASTRA-09 | Exact-tree construction hashes trusted document bytes directly as mode-`100644` blobs; tree, commit, pre-push, and replay validate type/mode/content | Filesystem symlink swap fails before ref advance/push; remote remains at base with no mode-`120000` entry |

The original evidence remains external and unchanged:

- formal EXPERT report: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-ae31587/slice2-ae31587-astra-review.md`
- owner gate: the adjacent `slice2-ae31587-owner-gate.md`
- adjacent primary and additional runnable counterexamples and their owner logs
  (original result: 0/5 plus 0/2)

The seven counterexamples are preserved in
`tests/specification_episodes_astra_regressions.test.mjs`, with added coverage
for same-name file replacement, late `indexes` swap, every retained OID, and
exact blocker preservation. Passing local validation returns Slice 2 only to
fresh owner/EXPERT acceptance; it does not start Slice 3.


### 5.3 Failed `14e5cfa` gate: ASTRA-10 through ASTRA-15

The authoritative reviewed range is `4460d96..14e5cfa`. Owner checks passed
(Node 73/73, active `pytest -q tests` 241 passed, static/diff checks), but those
suites did not exercise six material boundaries. Slice 2 remains in progress.

| Finding | Failed invariant | Exact acceptance condition |
|---|---|---|
| ASTRA-10 | A checked quarantine leaf can be replaced before final unlink; ordinary restoration can overwrite a newly appeared destination | Bind deletion through the destructive syscall or preserve; restore atomically with no-replace; permanently inject final product/control unlink, concurrent writes, and restoration collisions |
| ASTRA-11 | Pathname control mkdir/recursive cleanup can escape, and split lock creation/owner publication can adopt another lock | Bind control/lock create, create-only owner publication, use, cleanup, and release to one incarnation; never fall back to raw recursive deletion; preserve external sentinels and replacement locks in all three reproduced boundaries |
| ASTRA-12 | Linux no-birthtime fallback relabels mutable ctime and self-invalidates after required renames | Use an incarnation scheme stable across own mutations and replacement-sensitive on actual supported Linux/Python/filesystem plus macOS; otherwise reject before product mutation and document unsupported platforms |
| ASTRA-13 | Success accepts incomplete/malformed schema, retained recovery OIDs, and missing/inconsistent historical receipts | Enforce a closed versioned schema; validate every retained OID and immutable shape; cross-bind directory, file-creation, and bundle receipts; preserve journal/blocker for every supplied mutation |
| ASTRA-14 | A newer stable remote rollback disproves durability, but replay still clears the blocker | Require the final accepted remote OID to contain the success commit before success/blocker cleanup; rollback or unprovable reachability preserves evidence |
| ASTRA-15 | Success written by the current invocation is not preservation-guarded and can be normalized after a later fault | Enter preservation-only mode before/with durable success write; faults after the write or during final cleanup use separate diagnostics and preserve exact journal/blocker bytes |

Stable authority mappings are R-WE-79 through R-WE-84 and D-WE-17 through
D-WE-19. D-WE-15 and D-WE-16 remain decisions but are not fully implemented by
`14e5cfa`. The earlier R-WE-69–78 judgments are split: R-WE-71, the original
R-WE-75 coherence defect, and R-WE-77 are satisfied for reviewed paths;
R-WE-73 is partial; R-WE-69/70/72/74/76/78 remain blocked.

Authoritative evidence:

- EXPERT report: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-14e5cfa/slice2-14e5cfa-astra-review.md` (SHA-256 `6e1a89865c5008e43ef3c7cb857b0d0b4711f887485bb9cc98b5339df77e0362`)
- owner gate: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-14e5cfa/slice2-14e5cfa-owner-gate.md`
- linked runnable final-syscall, control/lock, Linux-identity, state-schema,
  recovery, remote-rollback, and post-success-write evidence beside the reports

This section is documentation authority only. It does not authorize
implementation, `/handoff`, compaction, or Slice 3.

## 6. Episode-creation behavior

For the immediate episode disposition, deterministic automation shall:

1. Verify the source session is a project conversation rooted in a valid Git
   canonical checkout and has a persisted session file.
2. Derive or obtain an operator-approved episode slug and branch name.
3. Verify that neither the target branch nor worktree path would be overwritten.
4. Create the feature branch and durable worktree without using an interactive
   shell prompt.
5. Persist a worktree-rooted fork with
   `SessionManager.forkFrom(sourceSessionFile, worktreePath)`. The fork must
   contain the complete active conversation branch, not a summary or selected
   subset, and record the worktree as its CWD.
6. Activate the persisted fork as a durable top-level sibling through daemon
   `create(sessionPath=<forkedSessionFile>)`. A fresh
   `rlm.create_session(cwd=...)` is not a substitute because it does not inherit
   the transcript.
7. Retain the returned `active_session_id`, stable `session_id`, session name,
   session file, worktree path, branch, source conversation ID, and project
   identity in durable episode metadata.
8. Deliver the task exactly once, accounting for the known automatic-
   preparation admission race. Initial publication and substantive task
   delivery must not be conflated.
9. Have the episode verify its CWD and branch, run `prepare`, and write the
   active specification bundle in its own `.ralph/plans/`.
10. Leave the owning conversation active and able to observe, message, and
    resume coordination with the episode.

Complete active-branch inheritance is the initial acceptance contract and the
behavior proved by this POC. Selective or pre-compacted inheritance may be
explored later only as an explicit refinement with its own requirements and
operator approval; it is not an alternative way to satisfy this specification.

If any step fails, automation must report the exact partial state and either
roll back only resources it created safely or leave an explicit recovery
record. It must never delete an existing branch, worktree, session, or
uncommitted work as generic rollback.

## 7. Episode execution and ownership

The episode owns specification, planning, implementation, tests, documentation,
commits, PR creation, review fixes, and rebasing for its branch. It remains
resumable for the complete PR lifecycle.

The originating project conversation is the logical coordinator. It may:

- retain the episode handle and durable identity;
- inspect bounded sibling status and transcript previews;
- send decisions, review requests, and PR feedback;
- receive progress and completion messages;
- verify merge readiness; and
- decide when to merge, abandon, and clean up.

Logical ownership must not be inferred solely from Prime Agent's runtime family
relationship. It must survive coordinator compaction, kernel restart, and
session resume.

## 8. Completion, archive, and cleanup contract

When implementation is truly complete, the execute workflow shall first ensure
that durable product documentation is current and related beads are closed.
It shall then move the complete active planning set into a unique archive:

```text
.ralph/plans/archive/<episode-slug>/
├── SPECIFICATION.md
├── REQUIREMENTS.md
├── DECISIONS.md
└── EXECUTION_PLAN.md
```

The archive is the episode's machine-checkable claim that it is ready for owner
review, not automatic authorization to merge. The owning conversation shall
verify at least:

- active plan files are absent and the complete archive exists;
- durable documentation reflects the implemented state;
- related beads are closed;
- the worktree is clean and commits are pushed;
- tests and CI pass;
- the PR has no unresolved blocking feedback; and
- the branch is current enough to merge under repository policy.

Only after merge or explicit abandonment may the coordinator retire the episode
session and remove the worktree. Cleanup must not run while the episode still
needs its root, and destructive branch deletion requires the applicable safety
checks.

## 9. Concurrency and shared-state constraints

Worktrees isolate checked-out files and indexes, but episodes still share Git
objects, refs, remotes, and any external project stores. Automation shall use
unique branch/worktree/session identities and rely on Git's normal locking for
Git metadata mutations. Any additional episode registry must use atomic updates
or its own lock.

`PROJECT_CONVERSATION` sessions share the canonical checkout. Their default role
is discussion, incubation, and coordination. Future-plan disposition is the one
specified tracked-file mutation there: it must use the serialized, ownership-
aware commit protocol in §5. Other specification-level tracked-file work must
use an episode.

## 10. Trust and security boundaries

- Branch names, slugs, and paths derived from model or user text must be
  validated; no text may become an unchecked shell fragment or escape the
  configured worktree root.
- Git commands shall use argument arrays or equivalent safe execution, not
  interpolated shell strings.
- Project-local extensions run trusted host code and must fail closed on
  ambiguous repository/session state.
- Worktree creation does not weaken OpenShell credential isolation. No command
  may obtain credentials from Keychain, browser stores, or sandbox disk.
- Existing worktrees and uncommitted changes are never removed automatically as
  error recovery.

## 11. POC evidence and known gap

This specification episode itself is the first manual proof:

- Owning conversation: `PWD in Prime Agent Questions`, session
  `01a0b5fe-e74c-7149-80b9-f328a5b1924f`, rooted at
  `/Users/jlanders/code/prime-claw`.
- Episode: `poc-spec-it-out-episode`, session
  `01a0b638-b392-778e-8c04-c5307740fc42`, active daemon ID
  `a29d878ba19d`.
- Worktree: `/Users/jlanders/code/.prime-worktrees/prime-claw/poc-spec-it-out-episode`.
- Branch: `poc/spec-it-out-worktree-episode`.
- The source session file was forked with
  `SessionManager.forkFrom(sourceSessionFile, worktreePath)`, preserving the
  complete active conversation and changing the persisted CWD to the worktree.
- The fork was activated as a live top-level sibling through daemon
  `create(sessionPath=<forkedSessionFile>)`; the owner then delivered the task
  directly. The episode independently verified its CWD and branch.

The POC proves the desired runtime topology and manual behavior. It also proves
that `rlm.create_session(cwd=...)` is not the inheritance mechanism: that API
creates a fresh sibling without the source transcript. The stable bridge and
its serialized future-incubation path now exist. The remaining integration gap
is the episode path that composes the proven fork and daemon-create operations
with durable ownership registration and exactly-once task delivery, including
partial-failure recovery. That work remains an implementation item rather than
an assumption to hide.

## 12. Acceptance outcomes

Implementation is accepted when automated tests and one real dogfood run show
that both commands preserve canonical workflow text, complete their interview
before the disposition gate, and cross the explicit multi-turn bridge exactly
once. Future incubation must serialize the shared-checkout write, commit and
push only its bundle, allocate no worktree, and leave a clean checkout on
success. Promotion must fork the complete active conversation branch, activate
an isolated durable coordinator-owned sibling, and remain operable through the
simulated PR lifecycle. Cleanup occurs only after the owner verifies completion.
