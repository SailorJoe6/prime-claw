# Requirements — Worktree-isolated specification episodes

> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)
> **Beads:** `prime-claw-h6w.1`

Priority meanings: **GATE** is required for acceptance; **NICE** may follow only
if it does not weaken a gate.

## Hierarchy and scope

- **R-WE-1 (GATE) — Canonical project context.** A `PROJECT_CONTEXT` is
  physically anchored by the project's canonical/default-branch checkout.
- **R-WE-2 (GATE) — Long-lived conversations.** Multiple durable
  `PROJECT_CONVERSATION` sessions may be rooted in the canonical checkout and
  coordinated by the `UNIVERSAL_AGENT`.
- **R-WE-3 (GATE) — Isolated specification episodes.** Specification-level
  production work uses a dedicated feature branch, Git worktree, and durable
  worktree-rooted Prime Agent session.
- **R-WE-4 (GATE) — Logical owner.** Every episode records the originating
  project conversation as its durable logical coordinator, independent of the
  runtime parent/sibling representation.

## Command and interview behavior

- **R-WE-5 (GATE) — Native entry points.** Project-local native `/design` and
  `/spec-it-out` commands load and inject their canonical workflow markdown
  from `.ralph/skills/` without duplicating it.
- **R-WE-6 (GATE) — One exposed route.** After the native commands are proven,
  duplicate `.agents/skills/design` and `.agents/skills/spec-it-out` exposure is
  removed.
- **R-WE-7 (GATE) — Semantic distinction.** `/design` performs material
  discovery; `/spec-it-out` formalizes substantially developed conversation
  context.
- **R-WE-8 (GATE) — Interview first.** Both workflows resolve all material open
  questions and reach specification-ready state before asking how to dispose of
  the specification.
- **R-WE-9 (GATE) — Explicit disposition.** The operator explicitly chooses
  future incubation or immediate episode creation; the system never infers a
  one-way allocation decision from ambiguous text.
- **R-WE-34 (GATE) — Stable multi-turn automation bridge.** After the skill-
  guided interview and disposition answer, the model invokes one explicit,
  structured, model-callable bridge into trusted host automation. It does not
  reconstruct Git, filesystem, session, or daemon shell commands from prose;
  tests prove the chosen disposition reaches its automation exactly once across
  turns.

## Future incubation

- **R-WE-10 (GATE) — No premature resources.** Future incubation creates no
  branch, worktree, or episode session.
- **R-WE-11 (GATE) — Named future bundle.** Incubated work is written as a
  non-binding `SPECIFICATION.md`, `REQUIREMENTS.md`, and `DECISIONS.md` bundle
  under `.ralph/plans/future/<idea-slug>/`.
- **R-WE-12 (GATE) — Safe names.** Future names are filesystem-safe,
  collision-resistant, and do not overwrite existing content without explicit
  approval.
- **R-WE-13 (NICE) — Later promotion.** A future bundle can later be promoted
  through the same episode-creation mechanism with its complete applicable
  conversation branch retained.
- **R-WE-35 (GATE) — Serialized canonical mutation.** The future-write path
  acquires a project-scoped mutation lock, rechecks repository state under that
  lock, and detects unrelated dirty state before writing, staging, or committing
  in the canonical checkout.
- **R-WE-36 (GATE) — Owned commit and clean success.** Future disposition stages
  only its new bundle, never commits another conversation's changes, and leaves
  the bundle committed and pushed with a clean canonical checkout on success.
  If it cannot, it reports the exact durable/dirty/commit/push state and recovery
  action without claiming success.
- **R-WE-69 (GATE) — Proven retirement ownership.** Recovery may retire only
  regular-file objects whose create-only descriptors and immutable receipts
  prove this transaction created them. Directory identity remains a mutation
  guard but never grants rename, quarantine, or deletion authority. Retirement
  authority is durably single-use; a manifest-bound interrupted retirement
  resumes idempotently, and commit-bearing recovery fails closed.
- **R-WE-70 (GATE) — Race-safe owned removal.** Recovery opens the target once
  without following links, validates every owned file, atomically retires its
  public name into retained Git-common quarantine, and revalidates it there.
  Checked names are never unlinked. Product directories, concurrent replacements,
  unowned entries, and the shared future-plan parent are always retained.
- **R-WE-71 (GATE) — Pinned publication.** Future publication pushes the verified
  owned commit OID, not moving `HEAD`, so a concurrent local descendant cannot
  be published by the transaction.
- **R-WE-72 (GATE) — Verified replay truth.** A replayed `verified-success`
  record validates every recorded OID and required relationship, journal phase,
  commit parent, exact paths, tree types/modes and contents, document hashes,
  object-bound ownership evidence, and actual remote reachability before
  clearing blockers or reporting historical success. Malformed success state is
  preserved and fails closed. All current checkout/status/HEAD/upstream/remote
  fields come from one coherent fresh post-validation observation.
- **R-WE-73 (GATE) — Directory identity is guard-only.** Refining R-WE-69,
  recorded directory identity must match at later file creation and removal
  entry, but can never authorize deletion of a directory. Rename-and-replace
  invalidates file mutation authority and every directory incarnation survives.
- **R-WE-74 (GATE) — Mutation-bound control containment.** Refining R-WE-69,
  every authority-bearing control read/write/retirement descends from the real
  Git common directory through held `dir_fd` handles and `O_NOFOLLOW`; cleanup
  retires exact entries into retained quarantine without unlink. Git tree construction uses no
  pathname-based private index. Static or swapped children cause no external
  access and preserve sentinels and product resources.
- **R-WE-75 (GATE) — Coherent current replay observation.** Refining R-WE-72,
  replay derives every `current_*` field from one fresh observation made after
  historical evidence validation/reconciliation, or fails closed if coherence
  cannot be established.
- **R-WE-76 (GATE) — Complete success identity validation.** Refining R-WE-72,
  every present recorded commit/OID field is syntactically valid and satisfies
  its required equality or lineage relationship. Any malformed or inconsistent
  identity preserves the journal and blocker and rejects success.
- **R-WE-77 (GATE) — Regular-file construction and tree modes.** Refining
  R-WE-36 and R-WE-72, commit construction must not depend on a pathname-
  raceable private index. The exact constructed tree, commit, pushed commit,
  and replayed commit contain only approved regular-file modes for the three
  documents. Path/blob-byte equality cannot make mode `120000` valid.

- **R-WE-78 (GATE) — Preservation-only corrupt-success handling.** Refining
  R-WE-72, every malformed `verified-success` condition, including failures
  detected before normal replay validation, records diagnostics separately and
  leaves the exact transaction journal and recovery blocker unchanged. No outer
  catch or generic failure normalization may overwrite evidence under review.

- **R-WE-79 (GATE) — Syscall-bound leaf destruction and no-clobber restore.**
  Validation must remain bound to the same leaf object through its destructive
  syscall. A checked quarantine pathname is not authority after its descriptor
  closes. Where the platform cannot bind an unlink to that leaf, cleanup must
  retain the retired object instead. Rollback/restoration uses atomic no-replace
  semantics; conflicts preserve both quarantine objects. Permanent acceptance
  substitutes a foreign file at every probe/product/control final-unlink edge;
  success preserves it and reports ambiguity rather than deleting by checked name.
- **R-WE-80 (GATE) — Control and lock incarnation continuity.** Every control
  directory creation, record replacement, lock creation, create-only owner
  publication, use, failure cleanup, and release is bound to the same
  non-following incarnation across helper calls. Record replacement preserves
  the prior object, and post-publication acquisition failure retires an exact
  owned lock before authority is lost. No helper rejection may fall back to raw
  recursive pathname deletion, and no
  split operation may adopt, overwrite, or remove a replacement lock. Losing
  concurrent-directory publication and every probe/control cleanup permanently
  substitute an empty foreign directory at the final `rmdir`; the replacement
  and owned incarnation both survive and success is not reported as clean.
- **R-WE-81 (GATE) — Supported-platform stable incarnation identity.** Filesystem
  incarnation evidence must remain stable across the transaction's own required
  renames on every supported runtime. Mutable Linux `ctime` must not be relabeled
  as birth time. Create, continue, removal, replacement, and restart must pass on
  actual supported Linux/Python/filesystem and macOS combinations; unsupported
  platforms fail before product mutation and are documented explicitly.
- **R-WE-82 (GATE) — Closed versioned success schema and receipt graph.** A
  `verified-success` record has a complete versioned schema with exact immutable
  fields, target/path shapes, and every retained/nested/recovery OID validated
  for its historical meaning. Directory, create-only file, and final bundle
  receipts and retained exact-tree construction evidence are required and
  cross-bound to one internally consistent historical object graph without
  depending on current checkout inodes.
- **R-WE-83 (GATE) — Final-state durability proof.** Before reporting success or
  clearing a blocker, the final accepted actual-remote OID must still contain
  the verified success commit. A stable later rollback or inability to prove
  reachability preserves the journal and blocker and fails closed.
- **R-WE-84 (GATE) — Preservation begins at durable success publication.** The
  invocation enters preservation-only mode before or atomically with writing a
  success journal. Every later fault, including final control cleanup, records
  separate diagnostics and preserves the exact persisted success and blocker
  evidence; generic failure normalization is forbidden.

- **R-WE-85 (GATE) — Allocation-unique live object authority.** Current
  destructive authority must use an allocation identity or enforceable exclusion
  that cannot confuse a recycled inode with the transaction-created object across
  helper restart. Timestamp fields and rename stability are not uniqueness proof.
  Unsupported platform/filesystem combinations reject before control or product
  mutation. Native acceptance rapidly unlinks/recreates a real helper-created
  file, uses fresh helper processes, and proves snapshot and retirement reject
  every distinct allocation even when the recorded tuple collides.
- **R-WE-86 (GATE) — Retirement cannot relocate an unauthorized replacement.**
  File authority must never leave a late directory substitution or hardlink-dirty
  replacement retired under a file destination with its public name absent.
  The final mutation uses enforceable exclusion or conflict-safe no-replace
  restoration that preserves both objects and reports their exact locations.
  Permanent native tests substitute an unowned directory and dirty through a
  hardlink immediately before the real retirement rename, inject failure after
  rename and before each required parent barrier, then use a fresh process to
  restore no-replace or preserve both exact conflict locations.
- **R-WE-87 (GATE) — Object-bound one-way retirement state.** The consumed
  manifest is staged, published, and validated as the exact approved object and
  bytes before the first retirement. Once any consumed/partial state exists,
  public recovery permits only inspection or exact retirement resume; `continue`
  and all file-creation paths reject without mutation. Permanent tests replace
  the manifest staging leaf and attempt continuation after every partial edge.
- **R-WE-88 (GATE) — Continuous lock and control-use authority.** Project lock
  authority remains valid through every product/control mutation, ref advance,
  and push. Loss stops before the next mutation. Failed-acquisition cleanup cannot
  relocate a replacement lock or free another owner's canonical name; failure
  after helper success remains recoverable; every retention destination,
  including quarantine, stays incarnation-bound. Permanent tests cover all four
  ASTRA-19 boundaries and preserve every competing object.
- **R-WE-89 (GATE) — Raw canonical proof and exact Git object types.** Before
  semantic validation, every proof and receipt rejects duplicate decoded JSON
  names at every nesting depth, including escaped-key collisions. Every recorded
  Git identity has the exact unpeeled object type and relationship required by
  its field; annotated tags are not commits. Historical timestamps are
  calendar-valid RFC3339 values. Rejection preserves exact journal/blocker bytes.
- **R-WE-90 (GATE) — Schema-gated recovery routing.** Mutable recovery is entered
  only after a complete known mutable-state schema validates. Recognizable v2
  success evidence with a missing, changed, or conflicting discriminator enters
  preservation-only handling under ordinary replay and every explicit recovery
  action; it cannot be normalized or overwritten.
- **R-WE-91 (GATE) — Exact blocker authority and idempotent final outcome.** The
  blocker object semantically approved for cleanup is the exact identity/hash
  passed into retirement; rereading cannot authorize a replacement. Final
  cleanup has a durable idempotent outcome protocol. A lost response reconciles
  the approved object and either safely preserves/re-establishes the active
  blocker or recognizes completed success without overwriting a new blocker.
  Fresh-success and replay cases cover replacement and response-loss boundaries.
- **R-WE-92 (GATE) — Retirement-topology capability preflight.** Before any
  control or product mutation, preflight proves the actual source/destination
  mount relation and required rename capability for every supported retirement
  path, including nested mounts. Unsupported layouts reject before mutation.
  Native two-volume coverage proves a separate-Git-dir layout cannot reach a
  post-manifest `EXDEV` failure.
- **R-WE-93 (GATE) — Namespace durability contract.** Supported filesystems have
  an explicit file/directory ordering and flush contract for every acknowledged
  create, exchange, retirement, restoration, and failure-cleanup edge. Each
  durable progress claim includes all required source/destination directory
  barriers. Syscall-order and restart/fault tests cover metadata persistence and
  unsupported flush behavior; SIGKILL evidence is never described as power-loss
  proof, and hardware/filesystem limits are explicit. Permanent acceptance
  composes directory and dirty-hardlink replacement with failure at every
  rename-to-validation-to-restore barrier, including analogous control retirement,
  and proves fresh-process reconciliation never strands an unauthorized object.

- **R-WE-94 (GATE) — Writer-validator transition closure.** Every durable state
  emitted by every normal, recovery, interruption, and removal writer must satisfy
  the exact validator for that state at the instant it is persisted and on fresh
  replay. Phase/evidence movement is monotonic or uses an explicit closed
  transition variant; recovery cannot retain later-phase fields while rewinding
  to an earlier phase. Permanent acceptance enumerates every persisted writer
  output, interrupts every recovery transition, repeats continuation, and replays
  running-to-removed cleanup. Legitimate writer closure must not be obtained by
  loosening malformed-success preservation or admitting unknown mutable evidence.

**Latest gate evidence:** Immutable candidate
`7eac1e7ccb8e715366377f0d1fd2d523f6660408` received fresh owner and formal
EXPERT **REVISE**. Transition `ba165904-ac51-4e82-9ec3-46f6693fe67f`
incorporates authority only and authorizes no implementation. The owner gate is
`/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/slice2-7eac1e7-owner-gate.md` (SHA-256
`7fbfd05868f2718d326ebb83b26d035e9b25f5a78106e21da909688f863c2652`); the
formal report is `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/slice2-7eac1e7-formal-review.md` (SHA-256
`93098c2cf8545a38dd863b242366305a2c21043ce886f3a2f3d326a0e56620d9`). The
verified 325-artifact manifest is `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/artifact-manifest.json` (SHA-256
`19d0a7e8798128927979fded1d06ed3d958f9baacaf821499bf2ddaf92b7fb21`);
all artifacts were owner-rehashed and the reviewer tree was retired artifact-first.

The independently reproduced blockers keep the following authority open:

- ASTRA-25 / R-WE-22, R-WE-90, R-WE-94: before-journal continuation mutates the
  product directory and ownership receipt, then both validator and catch reject
  `failed/directory-created`; the original mutation-false journal remains and no
  blocker exists.
- ASTRA-10/19 / R-WE-22, R-WE-79, R-WE-88: broker failed-start and normal-exit
  cleanup use raw socket-path unlink and can delete a foreign replacement.
- ASTRA-17/24 / R-WE-22, R-WE-86, R-WE-92, R-WE-93: capability-probe
  retirement can relocate a foreign directory into quarantine without restoring
  a free public name.
- ASTRA-19/24 / R-WE-88, R-WE-93: fresh lock/guard retirement resume depends on
  process-local movement flags and can strand foreign content in deterministic
  quarantine.

Credit remains due to the fixed original ASTRA-10 probe unlink and ASTRA-11
final-rmdir cases, material product/control/tree recovery, and the exact-tree
rewind and terminal-observation fixes. `FS-REMOTE-01` is a scoped topology
follow-up, not a fifth blocker. `COV-01` is required ASTRA-25 transition coverage;
`COV-02` and `COV-03` require completeness and evidence-label corrections.
Historical orphan brokers are retained evidence only, not a separate candidate
blocker. `prime-claw-h6w.10` remains non-blocking. Broad same-UID authority is
not narrowed. Slice 2 stays open and Slice 3 is not authorized.


## Episode creation

- **R-WE-14 (GATE) — Durable location.** Worktrees use a configurable durable
  root; the intended sandbox defaults are `/sandbox/projects/<project>` for the
  canonical checkout and `/sandbox/worktrees/<project>/<episode>` for episodes.
- **R-WE-15 (GATE) — Safe Git creation.** Branch and worktree creation is
  non-interactive, validates repository state and destinations, and never
  overwrites or deletes existing resources.
- **R-WE-16 (GATE) — Exact conversation inheritance.** The first implementation
  forks the complete active source conversation branch into the promoted
  episode. A generic handoff summary, selected subset, or fresh session does not
  satisfy this gate. Selective or compacted inheritance is a possible later
  refinement only, with separate requirements and operator approval.
- **R-WE-17 (GATE) — Correct root.** The episode's persisted CWD is the new
  worktree; project-local skills, extensions, settings, and context are
  discovered there.
- **R-WE-18 (GATE) — Returned identity.** Episode creation returns and durably
  records active/stable session IDs, name, session file, model, branch,
  worktree, project, and owner conversation identity.
- **R-WE-19 (GATE) — Coordinator remains live.** Episode creation does not
  replace or strand the owning project conversation; it can observe and message
  the live episode as a sibling or equivalent reachable session.
- **R-WE-20 (GATE) — Exactly-once task admission.** Substantive episode work is
  delivered exactly once despite the known automatic-preparation race.
- **R-WE-21 (GATE) — Prepare and verify.** The episode verifies CWD and branch,
  runs the project `prepare` workflow, and writes its active specification in
  its own checkout before implementation.
- **R-WE-22 (GATE) — Recoverable partial failure.** Failures report created
  resources and safe recovery actions; rollback never removes pre-existing or
  dirty resources.

## Coordination and lifetime

- **R-WE-23 (GATE) — Durable coordination.** Ownership and episode identity
  survive REPL-variable loss, compaction, kernel restart, and session resume.
- **R-WE-24 (GATE) — Full PR lifetime.** The episode remains resumable through
  planning, implementation, PR creation, review fixes, and rebasing.
- **R-WE-25 (GATE) — Bidirectional collaboration.** Owner and episode can
  exchange decisions, progress, review requests, and completion reports.

## Completion and cleanup

- **R-WE-26 (GATE) — Complete archive set.** Completion archives
  `SPECIFICATION.md`, `REQUIREMENTS.md`, `DECISIONS.md`, and
  `EXECUTION_PLAN.md` under a unique `.ralph/plans/archive/<episode-slug>/`.
- **R-WE-27 (GATE) — Archive is a claim, not authorization.** The owner treats
  the archive as the first readiness signal and independently verifies docs,
  beads, tests, CI, PR feedback, push state, and merge readiness.
- **R-WE-28 (GATE) — Owner-controlled merge.** The owning project conversation
  decides whether and when to merge or abandon the episode.
- **R-WE-29 (GATE) — Post-merge cleanup.** Session retirement and worktree
  removal occur only after merge or explicit abandonment and only after dirty-
  state safety checks.

## Concurrency, security, and verification

- **R-WE-30 (GATE) — Concurrent episodes.** Unique identities and atomic shared
  metadata updates permit multiple active episodes without checkout collisions.
- **R-WE-31 (GATE) — Input safety.** Untrusted/model-derived names cannot escape
  configured roots or become unchecked shell fragments.
- **R-WE-32 (GATE) — Credential isolation.** Episode automation preserves the
  OpenShell L7 credential boundary and does not read Keychain or browser secret
  stores.
- **R-WE-33 (GATE) — Evidence-backed tests.** Tests cover command registration,
  canonical markdown loading, interview/disposition ordering, the multi-turn
  automation bridge, complete-branch transcript inheritance, both disposition
  paths, shared-checkout locking and dirty-state ownership, collisions, partial
  failures, identity persistence, sibling messaging, archive readiness, and safe
  cleanup; one real dogfood run proves the complete promoted path.

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
