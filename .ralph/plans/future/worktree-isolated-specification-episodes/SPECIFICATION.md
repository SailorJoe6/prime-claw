# Specification — Worktree-isolated specification episodes

> **Status:** incubated draft under operator review. The prior implementation
> and execution plan were discarded. No implementation is active or authorized.
> This specification is being simplified before new requirements, decisions, or
> an execution plan are created.

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
   before the first public-name retirement, recovery writes a create-only consumed-authority
   tombstone. At every control-state read, write, or delete that can grant or use
   destructive authority, it must re-establish that the derived child (including
   `future-ownership-consumed` and `indexes`) is non-symlink-contained beneath
   the real Git common directory. A completed removal, path reuse, static or
   swapped control-child symlink, or mutable journal reset cannot revive or
   redirect authority. Historical proof cannot authorize automatic recreation.
3. **Removal and publication preserve object types.** Security-sensitive
   filesystem operations descend from held directory descriptors with
   `O_NOFOLLOW`. Directory identity is a mutation guard, never deletion
   authority: product directories are always retained. Recovery retires only
   exact `O_EXCL`-created file objects into retained Git-common quarantine,
   revalidates them there, and never unlinks a checked name. Replacements and
   unowned entries survive.
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

This section remains the immutable failed-gate authority. The owner subsequently
verified authority commit `5d4be4a` and authorized one controlled same-Slice-2
implementation handoff. Slice 3 remains unauthorized.

### 5.4 Partial implementation shape in candidate `3fe649b`

The same-Slice-2 revision satisfies the acceptance matrix only when all of the
following hold together:

1. Checked product/control/lock leaves are retired into retained Git-common-dir
   quarantine evidence rather than unlinked, and restoration is atomic
   no-replace. Pre-commit multi-object retirement uses a durable exact manifest
   and deterministic destinations, so interruption resumes idempotently.
2. Control directories descend from held non-following descriptors; their exact
   identities are carried across helper calls, and record replacement atomically
   exchanges and retains the prior object. One helper operation creates a private
   lock, writes its owner create-only, publishes it exclusively, and returns exact
   directory/owner identity for later use and retirement. A post-publication
   acquisition failure retires the still-authoritative lock before descriptor loss.
3. Version-2 identity records use real macOS birth time or Linux `statx` birth
   time and mount/device/inode. Unsupported Linux filesystems reject before any
   control or product write. Ctime is not identity.
4. A successful transaction is projected into an exact version-2 proof with no
   inherited recovery/observation fields. Hash edges cross-bind the directory,
   three file-creation, bundle, and retained exact-tree evidence independently of
   current checkout inodes; the evidence tree/base/modes bind to the commit graph.
5. Historical validation is followed by coherent current observation and a
   final actual-remote reachability proof. The lock is retired, reachability is
   proved again, and blocker retirement is the last fallible mutation.
6. Preservation-only mode begins before durable success replacement, so every
   post-publication or final-cleanup fault keeps exact journal/blocker bytes and
   writes diagnostics separately.

Permanent safe-outcome regressions retain the supplied ASTRA-10–15 boundaries,
and native identity tests execute on macOS plus an actual Linux filesystem.
Owner and formal EXPERT acceptance remain required before Slice 2 closes.
Candidate `3fe649b` passed the recorded repository suites, but the gate below
proves that these mechanisms do not satisfy the broader safety contract.

### 5.5 Failed `3fe649b` gate: ASTRA-16 through ASTRA-24

The authoritative reviewed range is `5d4be4a..3fe649b`. The owner independently
confirmed combined Node 80/80, exact active `pytest -q tests` 252 passed with 11
warnings, static/inventory/diff checks, all 62 report links, and all 1,654
artifact-manifest entries. These are real progress, not approval. Slice 2 remains
open, and this documentation does not authorize implementation or Slice 3.

| Finding | Failed invariant | Exact permanent acceptance condition |
|---|---|---|
| ASTRA-16 | Linux device/inode/birthtime/mount identity can collide for a distinct rapid reallocation and fresh helpers accept/retire it | Provide allocation-unique identity or enforceable exclusion across restart, or reject the combination before mutation; retain native rapid unlink/recreate tests using real helper creation and fresh-process snapshot/retirement |
| ASTRA-17 | A late unowned directory or hardlink-dirtied file is relocated into quarantine under file authority | Enforce the object/exclusion boundary or restore conflict-safely without relocating the replacement; preserve both objects and exact locations; permanently inject both substitutions at the native rename boundary |
| ASTRA-18 | A replaced staging leaf can publish a foreign consumed manifest, and `continue` can recreate partially retired files and poison resume | Bind staged/published manifest identity and bytes before retirement; treat consumed state as one-way and permit only inspect/exact resume; test foreign publication and no-mutation continuation at every partial edge |
| ASTRA-19 | Failed cleanup can retire another lock; mutation continues after lock loss; post-helper validation strands a lock; bound quarantine can be replaced | Carry actual lock/control/quarantine authority through every mutation/ref/push/use/cleanup boundary; preserve competitors without freeing their canonical name; permanently test all four boundaries |
| ASTRA-20 | Annotated tags and duplicate/escaped JSON keys pass the closed proof; timestamps need not be calendar-valid | Reject duplicate decoded names before semantic parsing at every depth; validate unpeeled exact Git types/relationships and calendar-valid RFC3339; preserve exact evidence on rejection |
| ASTRA-21 | Missing/changed v2 success discriminator routes into mutable recovery and overwrites journal/blocker | Gate mutable recovery on a complete known mutable schema; route recognizable malformed success to preservation-only handling under replay and every recovery action |
| ASTRA-22 | Blocker approval and retirement can bind different objects, and response loss can remove the active blocker while reporting failure | Pass exact approved blocker identity/hash into a durable idempotent cleanup protocol; reconcile uncertain outcomes without overwriting replacements; test fresh/replay replacement and response loss |
| ASTRA-23 | Preflight accepts a separate-mount layout whose required retirement rename fails with `EXDEV` after manifest publication | Prove actual source/destination mount and rename capability before mutation or reject; retain native nested/two-volume preflight-negative coverage |
| ASTRA-24 | Acknowledged create/exchange/retention paths omit required namespace fsync barriers | Specify and implement ordering/flush barriers for every supported create, exchange, retirement, restore, and failure cleanup; retain syscall-order and restart/fault tests and never equate SIGKILL with power-loss proof |

Stable authority mappings are R-WE-85 through R-WE-93 and D-WE-20 through
D-WE-22. The gate also reopens broad claims for R-WE-69/70/72/73/74/76/78–82/84
and D-WE-17–19. R-WE-71, the reviewed R-WE-75 coherence contract, R-WE-77,
and the reviewed R-WE-83 remote predicate/order remain satisfied.

Authoritative preserved evidence:

- formal report: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/slice2-3fe649b-astra-review.md` (SHA-256 `2a24312e58a3703921fcb04e9151572eee05947bdd703fa459250beff63587dd`)
- owner gate: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/slice2-3fe649b-owner-gate.md`
- artifact manifest: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/artifact-manifest.json`
- invocation tree: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/invocation-tree.json`
- cleanup receipt: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/expert-cleanup-receipt.json`

### 5.6 Authorized ASTRA-16–24 candidate

The bounded revision attempted R-WE-85–93 and D-WE-20–22 mechanisms with protected
same-mount allocation anchors, post-move validation and no-replace restoration,
one-way manifest routing, a long-lived OS-flock broker plus guard/boundary
validation, raw strict JSON with a closed mutable schema and unpeeled Git-type
proof, destination-first blocker reconciliation, actual mount/capability
rejection, and proposed namespace flush
ordering. Permanent tests exercise the formal counterexample boundaries on
macOS and disposable native Linux fixtures. This was implementation evidence,
not acceptance. The fresh `44b92f8` gate below supersedes any broad completion
claim; Slice 2 remains open.

### 5.7 Failed `44b92f8` owner/EXPERT gate: reopened ASTRA-10/11/17/24 and ASTRA-25

The reviewed range `7f97fcc..44b92f8` passed owner baseline verification (Node
93/93; exact active pytest 264 passed, 2 skipped, 11 warnings; syntax, inventory,
and diff checks). Those green suites do not approve the gate. The owner accepted
four independently reproduced blocker groups:

| Finding | Stable authority | Exact permanent acceptance condition |
|---|---|---|
| ASTRA-10 remains open | R-WE-79/R-WE-92; D-WE-17 | Substitute foreign files at every probe/product/control final-unlink edge; no success may delete them after a check-use gap; retain ambiguous probe objects unless authority covers the destructive syscall |
| ASTRA-11 remains open | R-WE-22/R-WE-80/R-WE-92; D-WE-17 | At losing publication and probe/control final `rmdir`, substitute empty foreign directories; preserve both incarnations and do not report clean success from a prior descriptor check |
| ASTRA-17/24 remain open | R-WE-86/R-WE-93; D-WE-20/D-WE-21 | Compose directory and hardlink-dirty replacement with failure before each post-rename barrier/validation/restore edge; fresh-process replay restores unauthorized objects no-replace or preserves and reports both conflict locations; cover analogous control retirement |
| ASTRA-25 new | R-WE-22/R-WE-90/R-WE-94; D-WE-21/D-WE-22/D-WE-23 | Validate every actual persisted writer state immediately and on fresh replay; repeatedly interrupt continuation and replay running-to-removed cleanup; keep transitions monotonic/closed without weakening malformed-success preservation |

Targeted ASTRA-16/20 and narrow ASTRA-23 mechanisms remain material progress.
ASTRA-18/19/22 support bounded cooperating-invocation behavior, but current
unqualified same-UID authority remains unproven. No prose here narrows it. The
owner must separately approve a threat-model change or implementation must meet
the existing wording.

Preserved authority and lifecycle evidence:

- formal report: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-44b92f8/slice2-44b92f8-astra-review.md` (SHA-256 `84c9a0f1fc78ffb0db8ec528dd8765f674d32b9f41207e1d41f1434d7b072e91`)
- owner gate: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-44b92f8/slice2-44b92f8-owner-gate.md` (SHA-256 `5a7f85affeefe13df929795922db64258137f779d417ed823fd1534038211ab0`)
- artifact manifest: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-44b92f8/artifact-manifest.json` (SHA-256 `0db4214eadfc06232423c3921d3f0a22eb0a408d86519d873b25a679c3a65e3a`)
- invocation tree: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-44b92f8/invocation-tree.json` (SHA-256 `e7444764858aeaf68dd169c6fb7fee46ec81717067e880727caa2271a911765f`)
- cleanup receipt: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-44b92f8/expert-cleanup-receipt.json` (SHA-256 `1ffc9bf48db29d0f5d6b195832a029211a77ae6914204f2096f1978049436834`)

All 24 report links and all 32 manifest artifacts were owner-verified; post-Astra
quota and full invocation-tree retirement are recorded by the owner gate and
cleanup receipt. `prime-claw-h6w.3` remains in progress. Slice 3 is blocked.

### 5.8 Owner-authorized post-`94ec196` same-Slice-2 revision

Transition `33137bdb-e96e-4337-92df-1cdd860f9fa6` authorizes exactly one bounded
revision of Slice 2 from verified authority commit
`94ec1967966769e7e6f31141e192f411605d182c`. The implementation scope is:

1. close ASTRA-10 checked-name probe cleanup without deleting a late replacement;
2. close ASTRA-11 losing-publication and probe replacement-directory cleanup;
3. close ASTRA-17/24 uncertain post-rename barrier outcomes through durable,
   fresh-resume reconciliation and no-replace restoration/conflict preservation;
4. close ASTRA-25 by making every durable writer transition satisfy its exact
   validator under R-WE-94/D-WE-23, including repeated interrupted recovery and
   running-to-removed replay.

The current broad R-WE-87/R-WE-88/D-WE-21 same-UID authority is preserved and
must not be silently narrowed to cooperating invocations. Scoped lifecycle
caveats remain follow-up evidence, not extra formal blockers unless independently
proved. Destructive, race, restart, and fault validation uses disposable fixtures;
the live episode worktree/session/branch and owner conversation are protected.
After one bounded candidate, update durable evidence and `prime-claw-h6w.3`,
commit and push, prove clean local/upstream/actual-remote identity, and stop for
fresh owner and formal EXPERT review. Slice 3 remains unauthorized.

The first bounded execution task removes ASTRA-10/11 checked-name destruction:
capability probes now link directly into the actual target directory, retain the
anchor and retired witness at exact receipt paths, and never unlink/rmdir a
checked probe name. Losing concurrent directory publication retains its private
allocation and reports that path; TypeScript callers stop instead of silently
discarding retained state. Final-leaf and late-directory substitution tests
preserve both incarnations. This is focused implementation evidence only.

Transition `a40489d7-38c1-4170-8b5e-c6f9c660f8b0` now authorizes exactly one
bounded ASTRA-17/24 task from clean commit `e0cf297a5b047bad8811cb199969af89493d9430`:
reconcile uncertain post-rename barrier outcomes across fresh resume under the
existing broad R-WE-86/R-WE-93 and D-WE-20/D-WE-21 authority. Preserve the
ASTRA-10/11 remediation and all accepted Slice 2 behavior. Do not narrow
same-UID authority to cooperating invocations. ASTRA-25 remains pending and is
not part of this intermediate boundary. Use disposable fixtures, then update
evidence and bead notes, commit and push, prove clean local/upstream/actual-
remote identity, report the partial packet, and stop. Slice 3 remains blocked.

The bounded implementation uses each manifest-bound quarantine destination as
the durable reconciliation discriminator for product files, deterministic
control records, and tree evidence. Fresh resume validates the destination
before consulting or moving the public name. An exact retired object completes
idempotently; an invalid retired object restores no-replace when the public name
is absent; a concurrent public occupant preserves both exact locations. Product
and tree-evidence conflicts fail with both locations reported. For deterministic
control retirement only, an exact approved retired object plus a newer canonical
record is response-loss success with `canonical_replacement` reported, preserving
R-WE-91 without moving the newer record. A restored foreign object is
prevalidated and never cycled back into quarantine. Post-rename validation still catches substitution
and dirty-hardlink races. Rename and restoration flush source then destination
parents. Fresh-process disposable tests interrupt before both parent barriers
and before validation, interrupt both restore barriers, and cover directory,
dirty-hardlink, exact-owned, conflict, control, and tree-evidence outcomes.
Post-fix evidence is exact combined Node 93/93, focused helper/identity Python
48 passed with 2 platform skips, retirement fault selection 11 passed with 1
platform skip, and inventory 2/2. Final independent trace audit PASS is
`/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-bd380039/astra17-24-trace-audit.md` (SHA-256 `2e3d07827dfe8f77f102b2392a8f1b2e9db801eb0299d3450930b774872f3380`). This remains intermediate ASTRA-17/24
evidence; ASTRA-25 and owner/formal acceptance remain pending.

Transition `dc0f2b07-726b-4fa3-b6c7-7a4170e7bc7c` authorizes the final bounded
same-Slice-2 revision from clean commit
`d190cc4b280516318b66cf31753a1dba98991c21`. Implement exactly ASTRA-25 writer-
validator transition closure under R-WE-94/D-WE-23, including reopened
R-WE-22/R-WE-90 and D-WE-21/D-WE-22 authority incorporated at `94ec196`.
Preserve ASTRA-10/11, ASTRA-17/24, and all prior accepted Slice 2 behavior; do
not narrow broad same-UID authority. Generate the combined immutable Slice 2
candidate with permanent transition regressions, accurate docs/inventory/bead
evidence, required Node and plan-active Python suites, exact commit/push, and
clean local/upstream/actual-remote identity. Then stop for fresh owner and
formal EXPERT review without claiming acceptance or starting Slice 3. All
fault, restart, race, symlink, mount, inode, crash, and destructive fixtures
remain disposable; live episode and owner resources remain protected.

The authorized ASTRA-25 implementation now centralizes transaction-journal
persistence behind exact validators. Mutable v1 states reject before write if
their closed phase/status schema fails. Verified v2 success runs the complete
historical/live validator before replacement and again after durable reread.
Recovery repairs advance to validator-valid phases; retained exact-tree evidence
is reused and revalidated; reconciled commits carry both OIDs; pushing remains
monotonic; explicit `reconciling-default-ref` removes stale push evidence; and
terminal removal emits exactly one current observation variant.

`FUTURE_TRANSACTION_WRITER_VARIANTS` registers all 17 writer variants. Permanent
disposable tests interrupt normal phases, catch-failed outputs, both receipt
repairs, commit/push/readvance, and running-to-removed response loss. Exact
writer bytes are restored and observed without mutation by
`tests/helpers/specification_episodes_astra25_replay_worker.mjs`, a separate Node
process with a fresh extension import, then continued from another fresh process.
`failed/before-journal` and v2 success receive the same fresh replay treatment.
Focused ASTRA-25 passes 9/9 in 649.44 seconds. The plan-active Python suite passes
281 with 2 platform skips in 3,079.28 seconds. Final scoped audit PASS is
`/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-f9d7bb7d/astra25-fresh-final-audit.md` (SHA-256
`279cdb4d9e507476b13d13e4e288f331f5a7898809d37fab0c6e08db373fdb69`).
The exact combined post-fix Node suite passes 102/102 in 1,905.70 seconds. The exact plan-active Python suite passes 281 with 2 platform skips in 3,079.28
seconds. Immutable commit/push identity, fresh owner verification, and formal
EXPERT review remain pending; no gate acceptance or Slice 3 authorization is
claimed.


### Fresh owner/formal gate for immutable candidate `7eac1e7`

The candidate is immutable, clean, and pushed, but the fresh owner gate and
formal EXPERT review both returned **REVISE**. Transition
`ba165904-ac51-4e82-9ec3-46f6693fe67f` incorporates this authority only; it
permits no implementation. Preserve `7eac1e7ccb8e715366377f0d1fd2d523f6660408`
as the rejected boundary. Authoritative evidence:

- owner gate: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/slice2-7eac1e7-owner-gate.md` (SHA-256 `7fbfd05868f2718d326ebb83b26d035e9b25f5a78106e21da909688f863c2652`)
- formal review: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/slice2-7eac1e7-formal-review.md` (SHA-256 `93098c2cf8545a38dd863b242366305a2c21043ce886f3a2f3d326a0e56620d9`)
- verified manifest: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/artifact-manifest.json` (SHA-256 `19d0a7e8798128927979fded1d06ed3d958f9baacaf821499bf2ddaf92b7fb21`); the owner independently rehashed all 325 artifacts and the reviewer tree was retired artifact-first

Four independently reproduced blocker classes remain:

1. **ASTRA-25 / R-WE-22, R-WE-90, R-WE-94 / D-WE-21–23.** A valid
   `failed/before-journal` continuation skips durable initialization, creates the
   product directory and immutable ownership receipt, then validator and catch
   reject `failed/directory-created`. The original byte-identical journal still
   claims mutation false and no blocker exists. Correction must initialize and
   persist a closed continuation state before mutation or reject without mutation;
   coverage must include corrected precondition, fresh continuation,
   interruption, ownership repair, catch, repeat continuation, inspection, and
   accurate blocker/mutation evidence without weakening malformed-success rules.
2. **ASTRA-10/19 / R-WE-22, R-WE-79, R-WE-88 / D-WE-17, D-WE-21.** Broker
   failed-start and normal-exit cleanup use raw socket-path unlink and can delete
   a foreign replacement. Cleanup must be allocation-bound or preserve ambiguity,
   with file/socket/directory substitutions at both edges.
3. **ASTRA-17/24 / R-WE-22, R-WE-86, R-WE-92, R-WE-93 / D-WE-17,
   D-WE-20, D-WE-21.** Capability-probe retirement can move a foreign directory
   to quarantine and leave the public name absent. It needs destination-first,
   no-replace restoration and durable reconciliation across substitution,
   barriers, response loss, restart, and occupied destinations.
4. **ASTRA-19/24 / R-WE-88, R-WE-93 / D-WE-21.** Lock/guard retirement
   restoration depends on process-local movement flags. Fresh resume can reject
   while foreign content remains displaced in deterministic quarantine. Locks
   and guards need destination-first resumable retirement across every
   rename/barrier/validation interruption under live and abandoned supervisors.

The gate credits the original ASTRA-10 probe-unlink and ASTRA-11 final-rmdir
fixes, material product/control/tree recovery, and ASTRA-25 exact-tree rewind and
terminal-observation repair. `FS-REMOTE-01` is a scoped fetch/push-topology
follow-up. `COV-01` is required ASTRA-25 transition coverage. `COV-02` extends
required-ID completeness through R-WE-94, and `COV-03` corrects baseline/current
evidence labels. Historical orphan brokers are evidence only, not a separate
candidate blocker. `prime-claw-h6w.10` remains non-blocking and must preserve
exhaustive coverage. Slice 2 remains open; Slice 3 remains blocked and unstarted.

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

### Authorized same-Slice-2 ASTRA-guided Luna experiment

Transition `c3ab817d-bde3-4dba-b318-cbf77a105d00` authorizes one bounded
correction generation from documentation boundary
`d9ce607148dec9c0828f3c32999dc0143f038c0d`, preserving rejected immutable
candidate `7eac1e7ccb8e715366377f0d1fd2d523f6660408`. Scope is ASTRA-10,
ASTRA-17, ASTRA-19, ASTRA-24, ASTRA-25, plus COV-01/02/03 only. No Slice 3.
Implementation must preserve all credited corrections and prior Slice 2 behavior,
use disposable fixtures, run required Node/Python/inventory/static checks, and
stop after one clean pushed candidate for fresh owner and independent Astra
review. `prime-claw-h6w.10` remains non-blocking; FS-REMOTE-01 remains scoped.

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
