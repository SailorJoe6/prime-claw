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
  semantics; conflicts preserve both quarantine objects.
- **R-WE-80 (GATE) — Control and lock incarnation continuity.** Every control
  directory creation, record replacement, lock creation, create-only owner
  publication, use, failure cleanup, and release is bound to the same
  non-following incarnation across helper calls. Record replacement preserves
  the prior object, and post-publication acquisition failure retires an exact
  owned lock before authority is lost. No helper rejection may fall back to raw
  recursive pathname deletion, and no
  split operation may adopt, overwrite, or remove a replacement lock.
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
  hardlink immediately before the real retirement rename.
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
  proof, and hardware/filesystem limits are explicit.

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
