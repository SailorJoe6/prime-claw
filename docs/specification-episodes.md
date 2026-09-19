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

The host constructs the exact tree without a pathname-based private index. It
hashes the three trusted document byte strings as `100644 blob` objects and
rebuilds the recorded base tree with `mktree`; `commit-tree` then creates the
exact commit. `git update-ref <default-ref> <new> <recorded-base>` advances the
local branch with compare-and-swap semantics. The primary checkout index is
reconciled only for the owned paths. This plumbing path intentionally does not
run ordinary `git commit` hooks. Any unrelated primary-index or worktree change
detected before push turns the operation into a recoverable failure, and the
owned commit is not pushed.

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
├── indexes/<disposition-id>.index         # retained success/tree evidence; pre-commit removal retires it
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
- `remove-owned-uncommitted` — only before a commit/ref advance and only for
  regular-file objects proven by immutable create-only descriptor receipts;
  retire and revalidate those files as retained Git-common quarantine evidence.
  Product directories are never removed and checked names are never unlinked.

A failed precondition, matching bytes, or a mutable transaction field never
establishes deletion ownership. Immediately before the first public-name retirement,
recovery durably consumes that authority with a create-only tombstone. Control
operations remain non-symlink-contained beneath the Git common directory.
Directory identity guards later file mutation but grants no deletion authority.
Every target-directory incarnation, concurrent unowned entry, and the shared
`.ralph/plans/future` parent remains in place. Recovery never
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

## Failed gates and same-Slice-2 hardening

The owner and formal Astra EXPERT reviews rejected candidate `ae31587`. Candidate
`14e5cfa` closes those seven narrow reproductions and passed its repository
suites, but its fresh owner/EXPERT gate also returned **REVISE**. The following
mechanisms are meaningful partial progress, not broad proof:

- **Object-bound removal authority (ASTRA-05).** A checked-in Python helper
  opens repository components with `dir_fd` and `O_NOFOLLOW`. Directory identity
  is guard-only and never authorizes deletion. Per-file and final bundle receipts
  bind exact `O_EXCL`-created file objects. Recovery holds the target FD,
  quarantines and revalidates only those files. Pre-quarantine replacements and
  every directory survive, but final-unlink and restoration races remain open
  under ASTRA-10.
- **Mutation-bound control containment (ASTRA-06 / ASTRA-06b).** Durable JSON,
  lock, tombstone, construction-evidence, and cleanup operations descend from
  the real Git common directory through held non-following descriptors. Git no
  longer opens a pathname-based private index: exact trees are constructed from
  trusted document bytes, while the `indexes` child stores only bounded durable
  evidence. The tested consumed/index swaps are contained, but control mkdir,
  fallback cleanup, and lock-incarnation boundaries remain open under ASTRA-11.
- **Coherent replay observations (ASTRA-07).** Historical validation completes
  first. One final reconciliation brackets local state and queries the actual
  remote both before and after that bracket; any change fails closed. It supplies
  every `current_*` field and timestamps only after the last Git query.
  Historical success does not depend on current working-tree inode identity.
- **Narrow success-validation fixes (ASTRA-08 / ASTRA-08b).** The
  verified-success branch runs before generic ownership/path checks. It
  validates the previously reported OIDs and relationships, commit parent,
  exact tree, hashes, receipts, bundle, and remote state. ASTRA-13 identifies
  retained recovery OIDs/schema/receipt relations still missing. Covered failures
  preserve exact transaction and blocker bytes;
  diagnostics go only to the attempt receipt. An outer-catch guard enforces the
  same rule if later diagnostics or blocker handling fail.
- **Regular Git object modes (ASTRA-09).** The helper hashes trusted document
  bytes and recursively rebuilds the recorded base tree with `mktree`, adding
  only exact mode-`100644` blobs. The constructed tree, commit, pre-push commit,
  and replayed commit receive exact path/mode/type/content validation. A
  filesystem symlink swap fails before ref advance or push.

The permanent suite
`tests/specification_episodes_astra_regressions.test.mjs` preserves all seven
owner counterexamples and adds same-name file replacement, late `indexes` swap,
table-driven retained-OID validation, exact blocker preservation, post-validation
current-state collection, and local/remote stability brackets. Python helper
regressions inject replacements at the actual file/control quarantine boundary
and prove fail-closed restoration plus consumed evidence. Every fixture uses a
temporary repository, disposable Git common state, and a local bare remote.

Prior formal source evidence:

`/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-ae31587/slice2-ae31587-astra-review.md`

### Failed `14e5cfa` owner/EXPERT gate

The authoritative range `4460d96..14e5cfa` passed Node 73/73, active pytest
241 tests, and static/diff checks. Linked runnable evidence nevertheless proves:

- **ASTRA-10:** final unlink can delete a replacement, and restore can clobber a
  new destination. Acceptance requires syscall-bound deletion or preservation
  plus atomic no-replace restoration for product and control leaves.
- **ASTRA-11:** pathname control mkdir/recursive cleanup and split lock-owner
  publication can escape or adopt a replacement. Acceptance requires one bound
  lock/control incarnation and no less-constrained fallback cleanup.
- **ASTRA-12:** Linux's no-birthtime path treats mutable ctime as birthtime and
  rejects the helper's own renames. Acceptance requires native proof on every
  supported Linux and macOS combination, or pre-mutation platform rejection.
- **ASTRA-13:** incomplete schema, retained recovery OIDs, and inconsistent or
  missing historical receipt relationships still report success. Acceptance
  requires a closed versioned schema and a cross-bound historical receipt graph.
- **ASTRA-14:** a newer stable remote rollback can disprove durability while the
  blocker is cleared. Final accepted remote state must still contain the commit.
- **ASTRA-15:** newly written success is outside the preservation guard. The
  guard must begin at durable success publication and cover all later faults.

Stable contracts are R-WE-79–84 and D-WE-17–19. Candidate `14e5cfa` leaves
R-WE-69/70/72/74/76/78 blocked, R-WE-73 partial, and D-WE-15/16 not fully
implemented. R-WE-71, the original R-WE-75 coherence defect, and R-WE-77 are
satisfied for the reviewed paths.

Authoritative reports:

- `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-14e5cfa/slice2-14e5cfa-astra-review.md` (SHA-256 `6e1a89865c5008e43ef3c7cb857b0d0b4711f887485bb9cc98b5339df77e0362`)
- `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-14e5cfa/slice2-14e5cfa-owner-gate.md`

Slice 2 remains in progress. The owner subsequently authorized the controlled
post-`5d4be4a` same-Slice-2 revision documented below. Slice 3 is not authorized.

## Same-Slice-2 ASTRA-10–15 implementation

The controlled revision after authority commit `5d4be4a` implements narrow
mechanisms for the six accepted blockers without entering Slice 3. Candidate
`3fe649b` later failed its broader ASTRA-16–24 gate, so the descriptions below
are implementation facts, not claims that the safety contract is proven:

- **Final-syscall preservation (R-WE-79, D-WE-17).** Product and control leaves
  are atomically retired from their public name into
  `<git-common-dir>/prime-claw/quarantine/` and retained. No checked pathname is
  unlinked. Failed restoration uses descriptor-relative atomic no-replace; an
  occupied destination and both quarantine objects survive for inspection.
  Pre-commit multi-object retirement uses an exact durable consumed manifest and
  deterministic destinations, so an interrupted retirement resumes idempotently.
- **Control and lock incarnation continuity (R-WE-80, D-WE-17).** Control trees
  are created one component at a time beneath held non-following descriptors,
  and their identities are carried into every later helper operation.
  Control-record replacement uses descriptor-relative atomic exchange and retains
  the prior object instead of overwriting or unlinking it. One helper call creates
  a private lock incarnation, writes its owner with `O_EXCL`, publishes it without
  replacement, and verifies the published object. A post-publication acquisition
  failure retires the exact lock before descriptor authority is lost. Release
  validates the recorded directory and owner identities and retires the entire lock without recursive
  cleanup or deletion. Exact-tree construction evidence stays durable for
  committed/successful transactions; explicit pre-commit removal retires it with
  the owned bundle.
- **Platform-real identity (R-WE-81, D-WE-18).** Version-2 identities use real
  macOS birth time or Linux `statx` birth time plus mount/device/inode. Mutable
  ctime is never retained as incarnation evidence. Repository and Git-common
  filesystems are checked before the first control or product write; a Linux
  filesystem without `STATX_BTIME` is rejected before mutation.
- **Closed success proof (R-WE-82, D-WE-19).** A new success is projected into
  an exact version-2 schema instead of inheriting mutable running/failure fields.
  It contains exact branch, path, hash, receipt, commit/tree/parent, and
  publication shapes. Receipt hashes cross-bind the directory receipt, all
  three create-only file receipts, final bundle identities, and retained
  exact-tree evidence; its base/tree/modes are validated against the commit graph
  without consulting current checkout inodes.
- **Final durability and preservation (R-WE-83–84, D-WE-19).** Replay checks
  historical evidence, then requires the final coherent actual-remote OID to
  reach the success commit. Fresh and replayed success release the project lock,
  repeat the remote proof, and only then retire the blocker as the last fallible
  mutation. Preservation-only mode begins before the durable success replace;
  later faults write only separate attempt diagnostics.

Retained quarantine evidence is intentional. Automatic cleanup is not part of
this slice because portable macOS/Linux APIs cannot condition a final unlink on
an earlier leaf descriptor. Any later cleanup requires separate owner-approved
policy and equivalent object-bound authority.

Permanent coverage lives in
`tests/test_specification_episodes_extension.py`,
`tests/test_specification_episode_fs_identity.py`, and
`tests/specification_episodes_astra_regressions.test.mjs`. Native identity proof
ran on macOS/APFS (Darwin 25.6 arm64, Python 3.14.4) and in a disposable Linux
arm64 Docker volume (Linux 6.12.76, Python 3.12.3, ext2/ext3-reported volume).
The Linux test performs create, three file writes, process restart/snapshot,
manifest-bound retirement, same-byte replacement rejection, and control-record
exchange with retained prior incarnation; the unsupported-birthtime test proves
pre-mutation rejection.

Reproduce the native Linux proof from the repository root with a disposable,
network-isolated container volume (the named local image is the current
OpenShell-compatible test runtime):

```bash
docker run --rm --user 0 --network none --read-only -e TMPDIR=/work \
  --mount type=bind,src="$PWD",dst=/repo,readonly \
  --mount type=volume,dst=/work -w /repo --entrypoint /usr/bin/python3 \
  prime-claw-brain:0.1.0 -c "import runpy; d=runpy.run_path('/repo/tests/test_specification_episode_fs_identity.py'); d['test_native_identity_survives_create_restart_and_retirement'](); d['test_native_identity_rejects_same_byte_replacement_after_restart'](); d['test_native_control_replace_exchanges_and_retains_prior_incarnation']()"
```

## Fresh `3fe649b` gate: REVISE on ASTRA-16–24

Candidate `3fe649b` passed combined Node 80/80 and exact active `pytest -q tests`
252 passed with 11 warnings. The owner independently reproduced nine material
boundaries that those suites do not cover. Slice 2 therefore remains open:

- **ASTRA-16 / R-WE-85:** natural Linux inode/birthtime reuse can alias a
  distinct allocation across fresh helpers.
- **ASTRA-17 / R-WE-86:** a late unowned directory or hardlink-dirtied file can
  be relocated under file retirement authority.
- **ASTRA-18 / R-WE-87:** a foreign manifest staging replacement can be
  published, and `continue` can poison partial retirement resume.
- **ASTRA-19 / R-WE-88:** lock authority is not continuous through cleanup/use,
  post-helper failure can strand a lock, and quarantine replacement is adopted.
- **ASTRA-20 / R-WE-89:** annotated tags and raw duplicate/escaped JSON keys can
  pass the proof path.
- **ASTRA-21 / R-WE-90:** corrupt success discriminators can route v2 evidence
  into mutable normalization.
- **ASTRA-22 / R-WE-91:** blocker approval/retirement can bind different objects,
  and response loss can remove the active blocker while reporting failure.
- **ASTRA-23 / R-WE-92:** preflight accepts a cross-mount topology whose required
  retirement rename fails with `EXDEV` after manifest publication.
- **ASTRA-24 / R-WE-93:** acknowledged namespace transitions omit required
  directory durability barriers.

D-WE-20–22 define the next design authority: allocation-unique/exclusion-based
retirement with topology preflight; continuous one-way durable recovery/control
state machines; and raw canonical proof validation before routing. They are not
implemented. No implementation, handoff, compaction, or Slice 3 work is
currently authorized.

Preserved authority and evidence:

- formal report: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/slice2-3fe649b-astra-review.md` (SHA-256 `2a24312e58a3703921fcb04e9151572eee05947bdd703fa459250beff63587dd`)
- owner gate: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/slice2-3fe649b-owner-gate.md`
- artifact manifest, invocation tree, and cleanup receipt in the same `slice2-3fe649b` directory

## Same-Slice-2 ASTRA-16–24 implementation candidate

The owner-authorized revision after authority commit `1834f6b` implements the
accepted R-WE-85–93 / D-WE-20–22 mechanisms without entering Slice 3:

- Product files are created from protected same-mount hardlink anchors in Git
  common state. Fresh helpers validate the public name against the still-live
  allocation. Retirement moves first, validates the moved object against its
  anchor and approved bytes, and restores a directory or dirty replacement with
  atomic no-replace semantics before returning failure.
- Consumption-manifest publication checks the exact staged and published inode
  and bytes before retirement. The extension rechecks consumed-state absence at
  every product, tree, ref, index, and push boundary while the project exclusion
  broker remains held. Only inspection or exact idempotent retirement resume is
  admitted after consumption becomes durable.
- Replicated helper supervisors inherit one OS `flock` on the exact Git-common
  directory for the full mutation interval. Either supervisor retains authority
  if the other disappears. Both monitor the owning process, so an owner crash
  releases kernel authority while leaving ambiguous lock evidence intact;
  explicit same-disposition/session recovery retires only that exact abandoned
  lock before reacquiring.
  A normal contender cannot acquire
  even while both visible lock names are displaced. The extension also validates
  the sibling guard, owner, broker liveness, and lock at every mutation and
  release boundary. Failed caller-handle publication and release reconcile the
  exact token. Every quarantine consumer receives a bound directory incarnation.
- Durable evidence is parsed with recursive duplicate decoded-key rejection.
  Success-like evidence is recognized before discriminators are trusted.
  Mutable routing requires closed phase/status variants, accumulated evidence,
  complete typed fields, exact nested observations, and disjoint status
  invariants; unknown or success-only residue is
  preservation-only. Verified commits,
  trees, parents, and publications require unpeeled exact Git types and
  calendar-valid RFC3339 timestamps.
- Blocker cleanup carries the single approved bytes/hash/identity into a
  deterministic retirement outcome. Retrying checks that destination first, so
  a newly published canonical blocker is neither moved nor adopted.
- Before creating control directories, preflight compares the nearest actual
  product, quarantine, and anchor mounts. Disposable allocation-bound probes run
  in the production directions (anchor to product, then product to quarantine),
  verify hardlink and descriptor-relative no-replace rename behavior, and remove
  every probe name before admission. Cross-mount, nested-mount, and unsupported
  capability layouts reject fail-closed.
- Every acknowledged directory creation, hardlink publication, exchange,
  retirement, restoration, and cleanup flushes the affected file/directory and
  both namespace parents. Tests prove syscall ordering and restart behavior;
  they do not claim physical power-loss testing.

Permanent coverage is in
`tests/specification_episodes_astra_regressions.test.mjs`,
`tests/test_specification_episodes_extension.py`,
`tests/test_specification_episode_fs_identity.py`, and isolated ASTRA-11/22
workers. Native Linux coverage uses a network-isolated, read-only-source
container with disposable volumes and proves rapid allocation churn, fresh
helper validation, two-mount preflight rejection, late directory/hardlink
substitution, manifest replacement, blocker reconciliation, and durability
barriers. The live episode resources are never fault fixtures.

This remains a candidate until fresh owner and formal EXPERT acceptance. Slice 2
stays `in_progress`; Slice 3 remains blocked.

## Verification

Run the focused acceptance suite:

```bash
node --experimental-strip-types --test tests/specification_episodes_extension.test.mjs tests/specification_episodes_astra_regressions.test.mjs
pytest -q tests/test_specification_episodes_extension.py
```

The Node suites use temporary repositories, isolated session files, and local
bare remotes. The live dogfood episode branch, worktree, session, and owner
conversation are inspection-only evidence and are never fault, recovery,
retirement, abandonment, or cleanup fixtures. Together they cover registration,
canonical loading, structured validation,
both disposition variants, canonical/default-branch source checks, argument-
array Git, exact future commits, actual remote verification, clean success,
tracked/untracked/staged dirt refusal, path collision, request/session isolation,
real OS-process serialization, lock ambiguity, every durable transaction boundary,
commit/push/cancellation faults, remote races, index-free exact-tree isolation,
explicit continuation/removal recovery, immutable and single-use deletion
authority, stale-receipt path reuse, missing ownership evidence, ownership-
consumption control-path symlinks, concurrent-entry preservation, pinned-commit
push, verified-success corruption, historical-versus-current replay state, no
episode allocation, and corrupt-evidence handling.

The rejected `ae31587` evidence (Node 58/58, original Astra 5/5, and
`pytest -q tests` 237 passed) remains historical only. The current revision must
pass the combined existing/permanent-Astra Node suites, the exact active command
`pytest -q tests`, `git diff --check`, and fresh owner/EXPERT review. Local test
counts below are updated only from final completed commands.

Current candidate evidence:

- combined existing plus permanent ASTRA Node suites: **93/93 passed** in
  1,355.90 seconds;
- exact active `pytest -q tests`: **264 passed, 2 skipped, 11 warnings** in
  2,199.29 seconds;
- focused non-bridge Python: **261 passed, 2 skipped**;
- native Linux arm64/Python 3.12 identity, allocation churn, broker lifecycle,
  blocker reconciliation, durability, and capability checks: PASS;
- native Linux nested quarantine and anchor mount rejection: PASS;
- three consecutive real two-process serialization reruns after concurrent
  control-directory publication reconciliation: PASS;
- syntax, inventory integrity, JSON, and `git diff --check`: PASS.

The independent postfix audit's exact-schema counterexamples are closed in the
appended scoped PASS at
`astra16-24-final-postfix-audit.md` (SHA-256
`f424873a10e063b0b3feecf9069628c79827af40d15a7fda855fe0cac1913d8c`). Its
strict arbitrary-same-UID interpretation remains an explicit owner/formal review
question; this candidate does not silently narrow R-WE-87/R-WE-88/D-WE-21.
The pytest bridge loads the real extension through the installed Prime Agent
RPC loader and checks the two native command surfaces. Prime Agent 0.9.5 RPC has
no public tool-list or direct tool-invocation command, so schema/execution tests
capture the registered tool through the extension API harness. A real model-
mediated bridge call remains part of the final dogfood acceptance rather than
being claimed by Slice 1.
