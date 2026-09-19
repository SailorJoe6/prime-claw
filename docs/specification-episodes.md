# Specification episodes

Prime Claw turns a mature project conversation into one of two explicit
outcomes:

- **future** keeps a named specification bundle for later; and
- **episode** allocates isolated production work on its own branch, Git
  worktree, and durable Prime Agent session.

The complete target contract is in
[the active specification](../.ralph/plans/SPECIFICATION.md). This document
tracks the behavior that has actually shipped. It must not be read as evidence
that later lifecycle slices already exist.

## Slice 1: native interviews and trusted preflight

The project-local extension
`.prime/agent/extensions/specification-episodes.ts` registers two native
commands:

| Command | Starting point |
|---|---|
| `/design` | Material requirements and design discovery are still needed. |
| `/spec-it-out` | The conversation already contains most design context and needs formalization. |

Both commands load their fixed canonical workflow from
`.ralph/skills/<command>/SKILL.md`. The extension does not copy the workflow
prose and command arguments cannot select a file. Optional trailing text is
included only as operator-provided specification context.

The workflows ask necessary questions one at a time. They do not ask for a
disposition until all material questions are resolved and the exact
`SPECIFICATION.md`, `REQUIREMENTS.md`, and `DECISIONS.md` content is ready. The
operator must explicitly choose `future` or `episode`; cancellation performs no
action.

After that choice, the model calls `spec_disposition` exactly once. It does not
construct Git, filesystem, daemon, or session commands from workflow prose.
The tool accepts a closed structured object:

```json
{
  "request_id": "spec-example-0001",
  "confirmed_by_operator": true,
  "decision": {
    "kind": "future",
    "slug": "example"
  },
  "documents": {
    "specification_markdown": "# Specification\n...",
    "requirements_markdown": "# Requirements\n...",
    "decisions_markdown": "# Decisions\n..."
  }
}
```

An `episode` decision additionally requires `decision.branch_name` beginning
with `feature/`, `spec/`, or `poc/`. The schema uses a provider-compatible enum
and trusted runtime cross-field validation rather than a TypeBox union, because
Prime Agent 0.9.5 documents `Type.Union`/`Type.Literal` as incompatible with
Google tool schemas.

### What preflight validates

- explicit operator confirmation;
- exact allowed fields and variant-specific fields;
- safe request ID, lowercase slug, and optional branch name;
- complete non-empty document strings with bounded size;
- a real persisted Prime Agent source session whose header ID and CWD match
  the trusted runtime context;
- the primary canonical checkout rather than a linked worktree;
- a current branch/upstream equal to that upstream remote's configured default;
- Git repository root, common directory, current branch, and checkout status;
- Git branch syntax for an episode request.

All Git inspection uses `pi.exec("git", [arg, ...])`. No shell command string is
constructed.

### Durable receipt and retries

Preflight fingerprints the exact normalized decision and document bundle. It
stores content-free control metadata beneath the repository's local Git common
directory:

```text
<GIT_COMMON_DIR>/prime-claw/
├── disposition-requests/<owner-and-request-hash>.json
└── dispositions/<semantic-disposition-id>.json
```

Receipt creation uses an exclusive same-filesystem link after flushing a private
temporary file. Existing files are never replaced. Exact semantic replay,
including after extension restart or an ordinary dirty/clean checkout-state
change, returns the original receipt snapshot as deduplicated after current
canonical-source checks pass. Reusing one caller request ID with changed input
fails closed. Stable session ID is part of both identities, so separate project
conversations do not share receipts. Corrupt or conflicting immutable evidence
is preserved and reported rather than overwritten.

The registered tool also requests Prime Agent's `sequential` execution mode.
Atomic exclusive creation remains the durable concurrency boundary if calls race
outside that runner contract.

## Slice 2: serialized future incubation

A confirmed `future` disposition now executes a real canonical-checkout
transaction. The tool acquires the atomic project lock at
`<GIT_COMMON_DIR>/prime-claw/locks/project-mutation.lock/` and repeats all
repository, default-branch, upstream, remote-OID, status, containment, and
collision checks while holding it. A held, empty, or corrupt lock is treated as
owned or ambiguous and is never stolen.

A fresh transaction requires all three views to agree before any bundle write:
local `HEAD`, its configured upstream tracking ref, and the actual remote
default ref queried with `git ls-remote`. It also requires an entirely clean
tracked, staged, and untracked checkout. It then exclusively creates only:

```text
.ralph/plans/future/<safe-slug>/
├── SPECIFICATION.md
├── REQUIREMENTS.md
└── DECISIONS.md
```

The host builds the commit through a transaction-private Git index initialized
from the recorded base commit. Only the three literal owned pathspecs enter that
index. `git write-tree` and `git commit-tree` create the exact commit, and
`git update-ref <default-ref> <new> <recorded-base>` advances the local branch
with compare-and-swap semantics. The primary index is then reconciled with only
the owned paths. This plumbing path intentionally does not run ordinary
`git commit` hooks; its contract is deterministic exact-path construction plus
post-commit path/content verification. Any unrelated primary-index or worktree
change detected before push turns the operation into a recoverable failure, and
the owned commit is not pushed.

Push is non-forcing and targets the configured default upstream explicitly.
Its source refspec is the already verified owned commit OID, never moving
`HEAD`, so a concurrent local descendant cannot be published. The tool queries
the actual remote OID before and after push, verifies the commit parent, exact
three-path diff, exact document contents, clean checkout, and remote commit
before reporting `verified-success`. It creates no branch, additional worktree,
daemon resource, or episode session.

### Transaction records and explicit recovery

The immutable Slice 1 intent receipt stays immutable. Slice 2 adds separately
replaceable, fsync-and-rename transaction state:

```text
<GIT_COMMON_DIR>/prime-claw/
├── future-transactions/<disposition-id>.json
├── future-attempts/<owner-and-request-hash>.json
├── future-ownership/<disposition-id>.json # immutable proof of exclusive mkdir
├── future-ownership-consumed/<disposition-id>.json # single-use removal tombstone
├── indexes/<disposition-id>.index         # present only while needed
└── future-mutation-blocked.json            # present after owned partial mutation
```

Receipts contain hashes and paths, never document bodies. They record base,
local, upstream, and remote OIDs; owned/staged/dirty paths; commit identity;
phase; failure; and the next safe action. A partial product mutation creates the
project blocker so a later conversation cannot accidentally push or commit on
top of unresolved work. Independently, every new transaction requires local
`HEAD` to equal both upstream and the queried remote before mutation.

An ordinary retry of interrupted or failed work performs no product mutation
and returns `recovery-required`. Recovery is explicit and operator-confirmed by
reusing the exact disposition input with one of these optional actions:

- `inspect` — reconcile and report current state without product mutation;
- `continue` — continue only after the journal and byte-identical owned bundle
  prove identity; or
- `remove-owned-uncommitted` — only before a commit/ref advance and only with
  an immutable create-only receipt proving this transaction exclusively created
  the directory; unstage and unlink exact byte-identical owned files one by one,
  then remove the directory only if it is empty.

A failed precondition, matching bytes, or a mutable transaction field never
establishes deletion ownership. Immediately before the first destructive unlink,
recovery durably consumes that authority with a create-only tombstone, so the
receipt cannot later delete a replacement at the reused path even if mutable
journal state changes. Both ownership control directories pass the same
non-symlink Git-common-dir containment checks before any receipt write. A
historical ownership receipt cannot authorize
automatic recreation after its directory has been removed, while a
commit-bearing transaction with a missing ownership receipt fails closed.
Concurrent unowned
entries make the final non-recursive owned-directory removal fail and remain
preserved. The shared `.ralph/plans/future` parent is retained because its prior
absence is not exclusive creation proof. Recovery never
resets, rebases, force-pushes, steals a lock, removes mismatched content, or
absorbs unrelated dirt. Once a commit object exists, removal is forbidden. A
rejected push or remote race preserves the exact local commit and requires
explicit reconciliation.

A replayed `verified-success` journal is not trusted by status alone. The tool
validates its phase, commit/base OIDs, exact commit paths and contents, document
hashes, immutable ownership receipt, and actual remote reachability before
returning historical success. The result labels historical cleanliness
separately and reports `checkout_clean`, current status paths, and current
HEAD/upstream/remote observations from the replay. Malformed success state is
preserved and fails closed without clearing recovery blockers.

## Current safety boundary

The `future` path is now a real locked write/commit/push transaction as described
above. The `episode` path remains preflight-only and allocates no branch,
worktree, session, or daemon resource until Slice 3. Its receipt continues to
report `implementation_boundary: slice-1-preflight-only` and no product-resource
mutation.

The legacy `.agents/skills/design` and `.agents/skills/spec-it-out` aliases also
remain temporarily. The approved plan removes them only after both real
disposition paths are proven in Slice 4.

## Failure and recovery

Validation errors before durable identity creation produce no control state.
After request identity exists, every future attempt has a durable attempt record.
Lock contention, dirt, collisions, commit construction failure, cancellation,
push rejection, remote race, and lock-release ambiguity are distinguished.
Failures after owned file or ref mutation preserve a mutable transaction journal
and a project-wide recovery blocker. They do not claim success.

Only explicit recovery can continue or remove owned uncommitted state. Removal
requires exact document bytes, exact allowed directory entries, unchanged base
`HEAD`, and no unrelated staged or dirty path. Once a commit exists, removal is
forbidden; the operator must inspect and reconcile the preserved commit.

## Known failed gate for `ae31587`

The fresh owner and formal Astra EXPERT reviews rejected candidate `ae31587`.
The original ASTRA-01–04 reproductions are materially improved, but seven new
assertions fail across five findings:

- **ASTRA-05 (P1):** a path-bound creation receipt deletes a byte-identical
  replacement directory before first removal. Future recovery must bind to the
  actual created directory incarnation and preserve rename-and-replace state.
- **ASTRA-06 / ASTRA-06b (P1, two assertions):** a late swap of
  `future-ownership-consumed` redirects a tombstone write, while a static
  `indexes` symlink redirects private-index deletion to an external file. Every
  destructively accessed control child must be revalidated beneath real Git
  common state at the exact read/write/delete boundary.
- **ASTRA-07 (P2/GATE):** replay discards a newer dirty reconciliation and
  returns older clean fields. All `current_*` fields must come from one coherent
  latest observation.
- **ASTRA-08 / ASTRA-08b (P2/GATE, two assertions):** malformed
  `commit_object_sha` is
  accepted, and an early invalid ownership path causes the outer catch to
  overwrite exact corrupt-success evidence. Every recorded identity must be
  validated, and every malformed-success path must preserve the transaction
  journal and blocker while writing diagnostics separately.
- **ASTRA-09 (P2/GATE):** a staging race publishes mode-`120000` symlinks whose
  blob text matches the Markdown. Index, commit, remote, and replay verification
  must enforce approved regular-file tree modes.

The durable authority is specification §5.1–5.2, R-WE-69–78, D-WE-15–16, and
execution-plan §2.4/§6. Formal immutable evidence is:

`/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-ae31587/slice2-ae31587-astra-review.md`

The adjacent owner gate, two runnable counterexample files, and two owner logs
record 0/5 and 0/2. Slice 2 remains in revision; no lifecycle transition or
Slice 3 work is authorized.

## Verification

Run the focused acceptance suite:

```bash
node --experimental-strip-types --test tests/specification_episodes_extension.test.mjs
pytest -q tests/test_specification_episodes_extension.py
```

The Node suite uses temporary repositories, isolated session files, and local
bare remotes. The live dogfood episode branch, worktree, session, and owner
conversation are inspection-only evidence and are never fault, recovery,
retirement, abandonment, or cleanup fixtures. The prior suite covers registration,
canonical loading, structured validation,
both disposition variants, canonical/default-branch source checks, argument-
array Git, exact future commits, actual remote verification, clean success,
tracked/untracked/staged dirt refusal, path collision, request/session isolation,
real OS-process serialization, lock ambiguity, every durable transaction boundary,
commit/push/cancellation faults, remote races, private-index isolation,
explicit continuation/removal recovery, immutable and single-use deletion
authority, stale-receipt path reuse, missing ownership evidence, ownership-
consumption control-path symlinks, concurrent-entry preservation, pinned-commit
push, verified-success corruption, historical-versus-current replay state, no
episode allocation, and corrupt-evidence handling.

Necessary but insufficient evidence for `ae31587`: the repository Node suite
passed 58/58; the five preserved original Astra counterexamples passed 5/5; and
the exact active suite `pytest -q tests` passed 237 tests with 11 warnings. Two
watchdog timing tests each failed once during earlier full-suite attempts and
passed immediately in isolation; the final exact full-suite rerun was green.
Those results do not cover the seven failing assertions above and do not satisfy
the Slice 2 owner gate.
The pytest bridge loads the real extension through the installed Prime Agent
RPC loader and checks the two native command surfaces. Prime Agent 0.9.5 RPC has
no public tool-list or direct tool-invocation command, so schema/execution tests
capture the registered tool through the extension API harness. A real model-
mediated bridge call remains part of the final dogfood acceptance rather than
being claimed by Slice 1.
