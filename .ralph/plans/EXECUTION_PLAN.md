# Execution Plan — Worktree-isolated specification episodes

> **Status:** implementation in progress; Slice 1 is validated; candidate
> `44b92f8` failed its fresh owner/formal EXPERT gate. ASTRA-10/11 remediation
> is pushed at `e0cf297a5b047bad8811cb199969af89493d9430`. Owner transition
> `a40489d7-38c1-4170-8b5e-c6f9c660f8b0` authorizes exactly the next bounded
> ASTRA-17/24 same-Slice-2 task from that clean boundary. Slice 2 remains open;
> ASTRA-25 and Slices 3–8 remain blocked.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)
> **Parent bead:** `prime-claw-h6w`
> **Episode branch:** `poc/spec-it-out-worktree-episode`
>
> Eight dependency-ordered vertical slices implement the conversation-to-episode
> boundary. Every slice ends with a usable capability, focused and full green
> tests, current documentation and requirement traceability, an updated bead,
> and a commit pushed from this episode worktree. This plan does not authorize
> implementation outside this branch/worktree or automatic merge/cleanup.

## 0. Execution progress

| Slice | Bead | Status | Evidence |
|---|---|---|---|
| 1 — native interviews and trusted preflight | `prime-claw-h6w.2` | Implemented and validated | `.prime/agent/extensions/specification-episodes.ts`; `docs/specification-episodes.md`; focused Node/RPC tests; active project suite `pytest -q tests` (236 passed at Slice 1) |
| 2 — concurrency-safe future incubation | `prime-claw-h6w.3` | Owner-authorized bounded revision from `94ec196` | Transition `33137bdb-e96e-4337-92df-1cdd860f9fa6` closes ASTRA-10/11/17/24/25 only; fresh owner/EXPERT review follows one pushed candidate |
| 3–8 | `prime-claw-h6w.4`–`.9` | Not started | Dependency-ordered below |

Slice 1 evidence names the exact active-suite command. It does not claim a
literal repository-root `pytest -q` run: owner review observed that command
collecting archived Phase 1 tests whose archived relative script paths are no
longer present (242 passed, 36 failed, 10 collection/setup errors). That is a
pre-existing archived-test collection condition, not a Slice 1 implementation
failure or cleanup task.

Slice 1 intentionally leaves the two legacy skill aliases in place until both
real disposition paths are proven in Slice 4. Its receipt is preflight-only and
makes no project checkout, Git ref/worktree, remote, daemon, or session
mutation.

## 1. Planning audit

The repository has the workflow and runtime primitives but not the specified
boundary:

- `.ralph/skills/design/SKILL.md` and
  `.ralph/skills/spec-it-out/SKILL.md` are canonical prose, currently exposed
  only through duplicate `.agents/skills/*` symlinks. They do not yet contain
  the completed-interview disposition gate.
- `.prime/agent/extensions/handoff-chain.ts` proves native project command
  registration, canonical markdown loading, per-session extension state, and
  real Prime Agent RPC-loader tests. Its memory-only state is intentionally not
  durable enough for episode ownership or crash recovery.
- Prime Agent 0.9.5 publicly exposes `pi.registerTool(...)`, an
  `ExtensionContext` with a read-only `sessionManager`, `pi.exec(command,
  args[])`, `SessionManager.forkFrom(...)`, `DaemonClient`, and
  `defaultDaemonSocketPath`. The installed `forkFrom` implementation copies the
  persisted session and changes its header CWD while retaining source lineage.
- The POC proved the required live path: `SessionManager.forkFrom(sourceFile,
  worktree)` followed by daemon `create({sessionPath})`. It also proved that
  `rlm.create_session(cwd=...)` creates a fresh transcript and is not a valid
  substitute.
- `.ralph/skills/execute/SKILL.md` still archives only two planning files. It
  must archive the complete four-file set.
- `config/requirements-inventory.json` has no R-WE entries yet. Existing Node
  tests plus pytest bridges are the pattern for extension, loader, and
  traceability coverage.

No product or scope question remains open. D-WE-14 deliberately leaves the
precise bridge interface to planning, and the audited Prime Agent tool API gives
us a supported choice.

## 2. Chosen implementation architecture

### 2.1 One extension, two commands, two trusted tools

Create `.prime/agent/extensions/specification-episodes.ts`, with testable helper
modules under `.prime/agent/extensions/lib/specification-episodes/` if the main
file becomes large.

The extension registers:

- native `/design` and `/spec-it-out`, each loading its byte-for-byte canonical
  `.ralph/skills/<name>/SKILL.md` and never accepting a skill/path selector;
- model-callable `spec_disposition`, with a discriminated `future | episode`
  schema containing validated slug/branch choices and the exact three-document
  bundle; and
- model-callable `episode_manage`, with narrow `status | readiness | authorize |
  cleanup | recover` actions over an existing registered episode ID.

The canonical skills own interview prose and tell the model when it may invoke
`spec_disposition`. The tools never conduct the interview or infer approval.
They accept structured values only; no argument is a shell command or arbitrary
filesystem destination. The tools execute host mechanics with argument arrays
and return a durable receipt.

### 2.2 Durable, idempotent local control state

Resolve the repository's absolute Git common directory with argument-based Git
calls. Keep runtime-only control state beneath:

```text
<GIT_COMMON_DIR>/prime-claw/
├── locks/project-mutation.lock/
├── dispositions/<disposition-id>.json
├── future-ownership/<disposition-id>.json
├── episodes/<episode-id>.json
└── tasks/<episode-id>.json
```

This location is shared by the canonical checkout and all of its worktrees,
survives session/kernel/extension restarts, does not dirty any checkout, and is
local to the runtime whose sessions/worktrees it describes. Writes use an
atomic create-or-rename protocol. Product directories are never deletion
authority and are always retained; only exact transaction-created leaf objects
may ever be considered for removal. Candidate `14e5cfa` does not yet bind that
authority through final unlink (ASTRA-10). A project lock must bind atomic
directory creation, create-only owner publication, use, cleanup, and release to
one incarnation; `14e5cfa` does not yet meet that contract (ASTRA-11).
Stale-lock recovery remains explicit.

The host derives a disposition ID from the stable owner session ID,
disposition, normalized slug, and SHA-256 fingerprint of the exact bundle. A
repeat with the same identity and fingerprint returns the existing receipt; a
collision with different content fails closed. Journals record phase, created
resources, ownership evidence, last verified state, and recovery instructions.

Episode states are monotonic:

```text
received → validated → branch-created → worktree-created → fork-persisted
→ activated → task-admitted → active → ready-for-review
→ merge-authorized | abandon-authorized → cleaned
```

Failure or uncertain transport outcomes are terminal diagnostic states until an
explicit `recover` action proves what happened. Automation never guesses by
repeating a mutation.

### 2.3 Canonical checkout and worktree rules

The disposition tool first proves that its source is a persisted project
conversation in the repository's primary/canonical checkout and that this
checkout is on the configured remote default branch. It discovers the primary
worktree and common Git directory through Git, not path-string assumptions.

The managed worktree root is configurable. In OpenShell it defaults to
`/sandbox/worktrees/<project-slug>` for canonical projects under
`/sandbox/projects`; development/test fixtures set it explicitly (the POC host
layout remains a valid configured root). Every resolved destination must remain
beneath that root.

Slugs and branch names use a documented allowlist and length limits. The tool
rejects traversal, shell metacharacters, absolute paths, ref collisions,
existing destinations, symlink escapes, non-canonical source checkouts, and
ambiguous remotes. Git operations use `pi.exec("git", [arg, ...])` or an
equivalent non-shell process API.

### 2.4 Future-write transaction

Under the project lock, the future path:

1. re-resolves canonical checkout, HEAD/upstream, and status;
2. fails before writing if any unrelated tracked or untracked dirt exists;
3. creates only `.ralph/plans/future/<slug>/{SPECIFICATION,REQUIREMENTS,DECISIONS}.md`
   with exclusive collision checks;
4. constructs the exact tree directly from the recorded base with `hash-object`
   and `mktree`, using only mode-`100644` blobs, so no pathname-raceable Git
   index participates; it writes a create-only construction-evidence receipt;
5. creates the exact commit with Git plumbing, compare-and-swap advances the
   checked default ref, then reconciles only owned paths into the primary index;
6. queries the actual remote OID, pushes the pinned owned commit OID (never
   moving `HEAD`) without force only from the recorded remote base, and verifies
   the resulting remote OID; and
7. rechecks exact commit paths/content and a clean canonical checkout before
   reporting success; replay separately validates complete historical success
   evidence and reports current cleanliness/HEAD/upstream/remote observations.

The exact-tree/CAS path prevents a non-cooperative primary-index writer from
entering the future commit and removes private-index path races entirely. It
intentionally does not invoke ordinary
`git commit` hooks; exact construction and post-commit verification are the
trusted host contract. A rejected push, remote race, commit failure, or crash
records the exact local commit/files/status. It does not absorb, reset, rebase,
or commit another conversation's work. An ordinary retry only reports recovery
state. An explicitly operator-approved `recovery_action` may inspect, continue,
or retire only exact uncommitted regular-file objects after immutable create-only
file and bundle receipts prove their incarnations. A checked-in Python helper
uses `dir_fd`, `O_NOFOLLOW`, held directory descriptors, and retained randomized
quarantine evidence. Directory identity guards later file mutation but never
grants destructive authority: every product directory is retained. The helper
writes the tombstone in the genuine held control directory, retires and
revalidates exact owned files from one held target FD into Git-common quarantine,
and never unlinks a checked name. Path reuse cannot redirect destructive cleanup.
Otherwise recovery stops for the operator.

#### Astra safety evidence retained in Slice 2

| Review insight | Required mechanism | Permanent regression |
|---|---|---|
| ASTRA-01: failed preconditions and matching bytes can masquerade as ownership | Delete only objects proven by create-only file descriptors/receipts; never delete product directories; commit-bearing recovery fails closed | Pre-existing identical bundle survives removal; missing receipt fails closed |
| Follow-up: a valid old receipt can outlive successful removal and path reuse | Create-only consumed-authority tombstone written before public-name retirement; live-status gate; no automatic recreation | Byte-identical replacement survives repeated removal even after mutable journal reset |
| Follow-up: tombstone control path can itself escape through a child symlink | Derive ownership and consumption directories with validated Git-common-dir containment | Static child-symlink test proves no external write and no bundle mutation |
| ASTRA-02: recursive cleanup has a check/delete race | Per-file descriptor-bound retirement into retained Git-common quarantine; never unlink checked names; retain target/shared parents | Concurrent entries and every directory incarnation survive; ASTRA-10 final-boundary cases remain permanent |
| ASTRA-03: `HEAD` can advance after commit verification | Push `<owned-commit-oid>:<default-ref>` rather than `HEAD:<default-ref>` | Remote receives owned commit and excludes concurrent local descendant |
| ASTRA-04a: a mutable success label can bypass missing evidence | Validate phase/OIDs, parent, exact commit bundle, hashes, ownership receipt, and actual remote before clearing blockers | Malformed `verified-success` journal is preserved and rejected |
| ASTRA-04b: replay can confuse historical cleanliness with current dirt | Return separately named historical facts and fresh checkout/status/HEAD/upstream/remote observations | Dirty replay reports current `checkout_clean: false` while retaining historical success |

The five original Astra counterexamples must run against the current extension,
not only the pinned reviewed blob. The adjacent follow-up regressions above are
part of the same Slice 2 acceptance boundary and cannot be deferred.

#### Implemented response to the failed `ae31587` gate

Reviewed commit `ae31587` remains rejected evidence. The controlled same-Slice-2
iteration implemented the full acceptance matrix without entering Slice 3:

| Finding | Implemented mechanism | Permanent regression |
|---|---|---|
| ASTRA-05 | Immutable BigInt filesystem-incarnation identities bind the created directory and exact three files; recovery revalidates them at the destructive boundary | Directory and same-name file replacements preserve the replacement and exact status |
| ASTRA-06 | The consumption child is freshly revalidated after the final await; durable JSON writes reject parents that resolve through symlinks | Late consumption-child swap creates no external entry and no product deletion |
| ASTRA-06b | Index observation and deletion freshly derive `indexes` beneath real Git common state before access | Static and late-swapped `indexes` symlinks preserve external sentinels and product state |
| ASTRA-07 | One latest successful reconciliation supplies every current status/ref/remote field | Injected concurrent dirt appears and current cleanliness is false |
| ASTRA-08 | All retained OIDs, equality/lineage relations, parent/tree/hash/bundle/remote evidence are validated before success | Table-driven malformed and mismatched identities preserve evidence and reject success |
| ASTRA-08b | Verified-success has a preservation-only branch plus outer-catch guard | Early invalid ownership path preserves exact transaction and blocker bytes; diagnostics remain separate |
| ASTRA-09 | Index-free exact-tree construction plus commit/replay validation requires exact `100644 blob` entries and bytes | Filesystem symlink swap fails before publication; remote stays at base with no `120000` entry |

Immutable source evidence remains external:

- formal EXPERT report: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-ae31587/slice2-ae31587-astra-review.md`
- adjacent owner gate, two runnable counterexample files, and owner logs
  (original result: 0/5 plus 0/2)

The seven prior counterexamples remain permanent. Candidate `14e5cfa` passed
combined Node suites (73/73), exact active `pytest -q tests` (241 passed, 11
warnings), and static/diff checks. A preliminary implementation audit approved
those inspected paths, but the later authoritative owner/formal EXPERT gate
independently reproduced ASTRA-10–15 and returned **REVISE**. Broad claims that
R-WE-69–78 or D-WE-15–16 were collectively proven are withdrawn.

Accepted authority for, and status of, the post-`5d4be4a` same-Slice-2 revision:

| Finding | Requirements / decision | Required permanent acceptance |
|---|---|---|
| ASTRA-10 final unlink/restoration clobber | R-WE-69/70/79; D-WE-17 | Final product/control unlink cannot delete a replacement; concurrent restore destination is never overwritten; conflict preserves quarantine evidence |
| ASTRA-11 control/lock incarnation escape | R-WE-35/74/80; D-WE-17 | Control mkdir, helper failure cleanup, lock owner publication/use/release remain one incarnation; external sentinels, prior owner, and replacement lock survive |
| ASTRA-12 Linux self-invalidating identity | R-WE-73/81; D-WE-18 | Native supported Linux and macOS create/continue/remove/replacement/restart pass with stable semantics, or unsupported runtime rejects before mutation |
| ASTRA-13 incomplete success proof | R-WE-72/76/78/82; D-WE-19 | Exact versioned schema, all retained OIDs, and cross-bound historical receipts reject every supplied corruption while preserving evidence |
| ASTRA-14 contradicted remote durability | R-WE-72/83; D-WE-19 | Final accepted remote OID still contains the success commit before blocker cleanup; stable rollback fails closed |
| ASTRA-15 newly persisted success overwrite | R-WE-78/84; D-WE-19 | Preservation begins with durable success write; all later injected failures preserve exact journal/blocker and write diagnostics separately |

Implemented narrow response in the controlled post-`5d4be4a` revision (later gate-blocked by ASTRA-16–24):

| Authority | Mechanism | Permanent evidence |
|---|---|---|
| R-WE-79 / D-WE-17 | Rename-to-retained-quarantine replaces final unlink; restoration is descriptor-relative no-replace; exact consumed manifest makes partial retirement resumable | Product/control final-boundary, recovery collision, and partial-resume tests |
| R-WE-80 / D-WE-17 | Control-directory identities cross helper calls; exchange-and-retain record replacement; atomic lock+owner publication; exact post-publication failure retirement; identity-bound release | Real-directory/symlink parent swaps, record replacement, helper rejection, post-publication failure, and lock replacement/release tests |
| R-WE-81 / D-WE-18 | v2 macOS birthtime or Linux `statx` btime+mount/device/inode; pre-mutation capability check | macOS suite, unsupported-btime negative case, native Linux create/restart/remove/replacement run |
| R-WE-82 / D-WE-19 | Exact v2 success proof plus receipt and retained-tree-evidence hash/OID graph; mutable failure fields projected out | Table-driven schema/OID/path and directory/file/bundle/tree-evidence corruption cases |
| R-WE-83 / D-WE-19 | Final coherent actual-remote OID must reach commit; proof repeated after lock retirement | Stable post-history remote rollback regression |
| R-WE-84 / D-WE-19 | Preservation flag set before durable success replace; attempt-only diagnostics; blocker retirement last | Post-success-write and pre-final-cleanup fault regressions |

Latest candidate validation evidence:

- exact combined Node suites: **80/80 passed**;
- focused native Python/helper safety cases: **17 passed**;
- durable mutation-boundary matrix: **11/11 passed**;
- native Linux arm64/Python 3.12 `statx` create/restart/manifest-retirement/replacement/control-exchange proof: **PASS**;
- independent postfix audit after all four findings were fixed: **PASS**;
- exact active `pytest -q tests`: **252 passed, 11 warnings** in 1163.71s.

These baseline checks and the internal postfix audit do not approve the candidate;
the later owner/formal ASTRA-16–24 gate below is authoritative and returned
**REVISE**.

Authoritative reports:

- `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-14e5cfa/slice2-14e5cfa-astra-review.md` (SHA-256 `6e1a89865c5008e43ef3c7cb857b0d0b4711f887485bb9cc98b5339df77e0362`)
- `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-14e5cfa/slice2-14e5cfa-owner-gate.md`
- fresh implementation audit: `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-7d8b40a9/final-audit.md` (REVISE; SHA-256 `8b7d5437f2c83eb71e69b2c35f9bad7a94e9e919e2807f7465b36ade0d6025b0`)
- postfix re-audit after all four fixes: `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-60e46749/postfix-audit.md` (PASS; SHA-256 `87c9cbe1f654d0709e00956217eac33178710b90e09f260cba2986c525425316`)

The PROJECT_CONVERSATION verified `5d4be4a` and admitted a controlled native
handoff for this same-Slice-2 revision. Candidate `3fe649b` completed the matrix
above and passed its baseline suites, but the fresh gate below proves the broad
claims incomplete. Slice 3 remains unstarted.

#### Failed `3fe649b` owner/EXPERT gate: ASTRA-16–24

| Finding | Stable authority | Required permanent acceptance |
|---|---|---|
| ASTRA-16 Linux allocation reuse | R-WE-69/70/73/81/85; D-WE-18/20 | Allocation-unique authority or live exclusion across restart; native rapid reuse with real helper creation and fresh-process validation/retirement; unsupported combinations reject pre-mutation |
| ASTRA-17 unauthorized retirement relocation | R-WE-22/69/70/73/86; D-WE-17/20 | Late directory and hardlink-dirty replacements remain at their public locations or are conflict-restored with both exact locations reported |
| ASTRA-18 foreign manifest and continuation poisoning | R-WE-22/69/70/74/80/87; D-WE-17/21 | Exact staged/published manifest identity+bytes; consumed state permits inspect/exact resume only; foreign publication and every partial continuation are no-mutation failures |
| ASTRA-19 lock/control use-boundary loss | R-WE-22/35/74/80/88; D-WE-17/21 | Continuous authority before every product/ref/push boundary; exact cleanup, post-helper recovery, and bound quarantine preserve canonical competitors |
| ASTRA-20 raw proof/type gaps | R-WE-72/76/78/82/89; D-WE-19/22 | Reject annotated tags, raw duplicate/escaped keys at every depth, and invalid timestamps while preserving exact evidence |
| ASTRA-21 corrupt success discriminator | R-WE-72/78/82/84/90; D-WE-19/22 | Complete-schema routing; recognizable malformed success is preservation-only under replay and all recovery actions |
| ASTRA-22 blocker authority/response loss | R-WE-72/74/78/80/84/91; D-WE-19/21 | Retire the exact approved blocker under a durable idempotent outcome protocol; reconcile response loss without overwriting a replacement |
| ASTRA-23 unsupported retirement topology | R-WE-22/81/92; D-WE-18/20 | Prove actual source/destination rename capability before mutation or reject; native nested/two-volume coverage never reaches post-manifest `EXDEV` |
| ASTRA-24 namespace durability | R-WE-22/69/80/93; D-WE-17/21 | Explicit supported-filesystem ordering and all directory flush barriers; syscall-order/restart coverage; no power-loss claims from SIGKILL |

The gate reopens broad acceptance claims for R-WE-69/70/72/73/74/76/78–82/84
and D-WE-17–19. R-WE-71, reviewed R-WE-75, R-WE-77, and the reviewed R-WE-83
remote predicate/order remain satisfied. D-WE-20–22 are accepted authority only,
not implementation.

Preserved authoritative evidence:

- formal report: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/slice2-3fe649b-astra-review.md` (SHA-256 `2a24312e58a3703921fcb04e9151572eee05947bdd703fa459250beff63587dd`)
- owner gate: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/slice2-3fe649b-owner-gate.md`
- artifact manifest: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/artifact-manifest.json`
- invocation tree: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/invocation-tree.json`
- cleanup receipt: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-3fe649b/expert-cleanup-receipt.json`

The PROJECT_CONVERSATION verified authority commit `1834f6b` and authorized
transition `eca063c9-561e-4a5b-868c-65a0e13059ec`: implement ASTRA-16–24 under
R-WE-85–93 and D-WE-20–22 in one bounded same-Slice-2 candidate while preserving
all prior accepted Slice 2 requirements. The live episode worktree/session and
owning conversation are protected dogfood. Destructive, concurrency, retirement,
cross-mount, inode-reuse, crash, and fault tests use only disposable fixtures or
isolated containers. After evidence, Bead update, commit, and push, prove local,
upstream, and actual-remote identity plus a clean worktree, then stop for fresh
owner and EXPERT review. Slice 3 remains unauthorized.

Candidate response (later rejected by the `44b92f8` gate):

| Authority | Candidate mechanism | Permanent evidence |
|---|---|---|
| R-WE-85/86; D-WE-20 | Same-mount hardlink allocation anchors; move-then-validate retirement; atomic no-replace restoration | Native rapid allocation churn plus late directory and hardlink-dirty substitution |
| R-WE-87; D-WE-21 | Staged/published manifest allocation+byte validation; consumed-state gate; idempotent resume | Foreign manifest substitution, partial resume, and public continuation rejection |
| R-WE-88; D-WE-21 | Replicated owner-monitored OS-flock supervisors on the bound Git-common directory, sibling guard, per-boundary authority validation, exact release reconciliation, bound quarantine | Lock+guard displacement exclusion, post-validation failure, single-supervisor loss, owner-crash exact recovery, lost-release response, replacement cleanup, and quarantine substitution |
| R-WE-89/90; D-WE-22 | Recursive duplicate-key rejection; success-first closed routing; unpeeled Git types; calendar timestamps | Duplicate/escaped keys, annotated tag, invalid-time, and missing/changed discriminator matrices |
| R-WE-91; D-WE-21 | Single approved blocker evidence and destination-first deterministic retirement reconciliation | Replacement-after-approval and fresh/replay lost-response-plus-new-canonical tests |
| R-WE-92; D-WE-20 | Actual product/quarantine/anchor mount comparison plus ephemeral production-direction hardlink and no-replace rename probes | Native Linux two-volume, nested quarantine/anchor mount, and capability-negative coverage |
| R-WE-93; D-WE-21 | File/new-directory and both-parent namespace flush ordering on every acknowledged edge | macOS/Linux syscall-order and restart/fault tests; no physical power-loss claim |

The candidate was not accepted. Its fresh owner/formal gate returned **REVISE**.

#### Failed `44b92f8` owner/EXPERT gate

| Blocker group | Stable authority | Next permanent acceptance |
|---|---|---|
| ASTRA-10 checked-name probe unlink | R-WE-79/R-WE-92; D-WE-17 | Substitute every final probe/product/control unlink target; preserve foreign content and retain ambiguous owned probes rather than destruct by checked pathname |
| ASTRA-11 late directory replacement | R-WE-22/R-WE-80/R-WE-92; D-WE-17 | Substitute empty directories at losing-publication and probe/control final `rmdir`; both incarnations survive and prior checks grant no cleanup authority |
| ASTRA-17/24 post-rename barrier uncertainty | R-WE-86/R-WE-93; D-WE-20/D-WE-21 | Combine directory/hardlink-dirty replacement with every post-rename barrier failure and fresh-process resume; restore no-replace or preserve/report both conflicts; include analogous control retirement |
| ASTRA-25 writer/schema contradiction | R-WE-22/R-WE-90/R-WE-94; D-WE-21/D-WE-22/D-WE-23 | Enumerate every persisted writer state; validate immediately/fresh replay; repeatedly interrupt continuation and replay running-to-removed cleanup without weakening malformed-success preservation |

Targeted ASTRA-16/20 and narrow ASTRA-23 mechanisms are retained progress, not
broad acceptance. ASTRA-18/19/22 support cooperating invocations only; current
unqualified same-UID wording remains unresolved and is not narrowed here.

Authoritative evidence:

- formal report: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-44b92f8/slice2-44b92f8-astra-review.md` (SHA-256 `84c9a0f1fc78ffb0db8ec528dd8765f674d32b9f41207e1d41f1434d7b072e91`)
- owner gate: `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-44b92f8/slice2-44b92f8-owner-gate.md` (SHA-256 `5a7f85affeefe13df929795922db64258137f779d417ed823fd1534038211ab0`)
- artifact manifest, invocation tree, and cleanup receipt beside the reports; hashes are recorded in the specification and product documentation

The owner verified all 24 report links and all 32 manifest artifacts, recorded
post-Astra quota, retired the full invocation tree, and kept the evidence.

#### Authorized post-`94ec196` same-Slice-2 revision

Owner transition `33137bdb-e96e-4337-92df-1cdd860f9fa6` authorizes one bounded
candidate from `94ec1967966769e7e6f31141e192f411605d182c`. Implement only the
four owner-adjudicated blocker groups: ASTRA-10 checked-name probe cleanup;
ASTRA-11 late replacement-directory cleanup; ASTRA-17/24 durable uncertain
post-rename reconciliation across fresh resume; and ASTRA-25 complete
writer-validator transition closure under R-WE-94/D-WE-23. Preserve the broad
R-WE-87/R-WE-88/D-WE-21 same-UID authority. Do not convert scoped lifecycle
follow-ups into formal blockers unless independently proven.

Protect the live worktree/session/branch and owner conversation. Use disposable
fixtures for destructive, race, restart, and fault tests. The completion boundary
is one evidence-backed candidate with current plans/inventory/docs and bead,
committed and pushed, exact clean local/upstream/actual-remote identity, then a
stop for fresh owner and formal EXPERT review. Slice 3 remains unauthorized.

Execution progress: the focused ASTRA-10/11 task removes all helper
checked-name probe unlink/rmdir paths, retains exact witness/staging resources,
surfaces them through helper and durable preflight receipts, and adds disposable
substitution coverage for retired/product/anchor leaves plus losing/probe
directories. Focused Python coverage passes 38 tests with 2 platform skips; the
clean full extension suite passes 57/57 in 1,199.95 seconds. An earlier loaded
run's two failures both passed in isolation and in the clean full rerun.
ASTRA-17/24 and ASTRA-25 remain; no combined candidate or acceptance claim
exists yet.

Next authorized task: transition `a40489d7-38c1-4170-8b5e-c6f9c660f8b0`
resumes `prime-claw-h6w.3` from clean commit
`e0cf297a5b047bad8811cb199969af89493d9430` and implements ASTRA-17/24 only.
Reconcile every uncertain post-rename barrier outcome across fresh resume under
broad R-WE-86/R-WE-93 and D-WE-20/D-WE-21. Preserve ASTRA-10/11 and all
accepted Slice 2 behavior; do not narrow same-UID authority. Fault, restart,
race, mount, symlink, and destructive coverage uses disposable fixtures. This
is an intermediate boundary: ASTRA-25 stays pending, Slice 3 stays blocked, and
the task stops after durable evidence, bead update, commit/push, and exact
clean local/upstream/actual-remote identity.

### 2.5 Promoted episode transaction

The episode path derives a unique branch/worktree/session name, creates the
branch and worktree non-interactively, and calls the public
`SessionManager.forkFrom(sourceSessionFile, worktreePath)`. Before activation,
a validator compares the source and fork active branches (excluding the new
header and target Git-state relink) and proves complete inheritance, parent
lineage, and target CWD. Summary-only, subset, or fresh-session creation is not
an accepted fallback.

The extension then connects through `DaemonClient` and activates that exact
fork via `create({sessionPath, name})`. It records stable and active session IDs,
session file, model, owner session/file, project, branch, worktree, bundle hash,
and every created-resource identity in the episode registry. The owner session
remains untouched and live.

Publication and task admission are separate journal phases. The task envelope
is persisted before activation. After publication, automation submits one
marked task through daemon prompt admission with a stable message/admission ID,
queueing behind automatic preparation when necessary. It never puts the
substantive task in session creation. The task requires the episode to verify
CWD/branch, run `prepare`, and write the exact active three-file bundle in its
worktree. A positive admission receipt marks it admitted. An uncertain result
is inspected by marker in the target transcript before any recovery; blind
resend is forbidden.

### 2.6 Ownership, readiness, and cleanup

The local episode record, not a Python handle or runtime family label, is the
coordination authority. `episode_manage status` re-resolves current daemon and
Git state, including active-session-ID churn, without rewriting identity.
Normal Prime Agent sibling messaging remains the collaboration transport.

Readiness is a check, not merge authority. It validates the unique four-file
archive, absent active plan files, related bead closure, durable docs, clean and
pushed branch, focused/full tests and CI, blocking PR feedback, and branch
currency. Remote-provider checks use a small GitHub/GitLab adapter with
argument-array CLI execution and already-provisioned auth; unsupported or
unavailable providers fail closed and require a recorded operator verification.
No code reads Keychain, browser stores, or credential files.

Only an explicit owner `merge-authorized` or `abandon-authorized` state enables
cleanup. Cleanup re-verifies identities and dirty state, retires the active
session, and removes only the registered clean worktree. Branch deletion is a
separate opt-in action with merged/abandonment checks. Saved transcripts remain
available unless a later explicit retention policy says otherwise.

## 3. Rules for every execution slice

1. Claim only that slice's bead. Keep the parent epic and plan current.
2. Start with a failing acceptance assertion where practical. Test real
   extension code, not a prose or mock-only duplicate.
3. Preserve OpenShell L7 credential isolation. Never read Keychain, browser
   stores, host auth files, or secret values. Redact paths/content in evidence
   where needed.
4. Add security and fault-injection tests in the first slice that introduces a
   mutation. Never defer containment, ownership, concurrency, or recovery to
   final hardening.
5. Use temp repositories, local bare remotes, isolated session directories, and
   a disposable daemon for destructive tests. Never point tests at the
   operator's canonical checkout, active sessions, or real remotes.
6. Update `docs/specification-episodes.md`, the relevant canonical skill, and
   `config/requirements-inventory.json` as behavior lands. Evidence is a
   redacted artifact, not a knowledge source.
7. Run the focused Node/pytest bridge, `git diff --check`, inventory integrity,
   and `pytest -q tests` before closing the slice.
8. End with one cohesive commit. Then `git pull --rebase`, `bd dolt push`,
   `git push`, and verify the branch is clean and up to date. If any gate or
   push fails, do not mark the slice complete.
9. Stop and ask the owner before changing the approved scope, inheritance
   contract, trust boundary, merge authority, or cleanup rules. Ordinary
   in-plan mutations do not need repeated permission.

## 4. Vertical slices

### Slice 1 — Native interviews reach a trusted disposition preflight

**Bead:** `prime-claw-h6w.2`

**Capability delivered:** An operator can invoke native `/design` or
`/spec-it-out`, run the correct canonical interview, make an explicit
disposition choice, and receive a deterministic trusted preflight receipt. No
Git, filesystem, or session mutation occurs yet.

- Add `specification-episodes.ts` and shared helpers for canonical skill loading,
  schema validation, source-session/repository inspection, bundle hashing, lock
  and atomic receipt primitives.
- Update both canonical skills with their distinct starting semantics, the
  interview-first rule, the exact three-document bundle contract, the explicit
  disposition question, and the single `spec_disposition` call. The tool refuses
  ambiguous or absent disposition.
- Register `spec_disposition` with a closed TypeBox-compatible schema, a
  provider-portable enum discriminator plus trusted cross-field validation,
  and sequential execution. Avoid `Type.Union`/`Type.Literal`, which Prime
  Agent 0.9.5 documents as incompatible with Google tool schemas. Initially
  implement `preflight` receipts behind both variants so the complete
  cross-turn bridge is testable without project mutation.
- Test command registration through the real Prime Agent RPC loader, byte-for-
  byte canonical markdown loading, multi-turn tool availability, schema/name/
  containment failures, cancellation as a no-op, session-key isolation, atomic
  receipt persistence, and same-input dedup versus changed-input collision.
- Keep `.agents/skills/design` and `.agents/skills/spec-it-out` temporarily;
  removal waits until both real disposition paths pass in Slice 4.

**Primary files:** extension + helper modules; both canonical skills;
`tests/specification_episodes_extension.test.mjs`;
`tests/test_specification_episodes_extension.py`;
`docs/specification-episodes.md`; requirement inventory.

**Proves:** R-WE-5, R-WE-7, R-WE-8, R-WE-9, R-WE-34 (bridge and preflight);
foundations for R-WE-31–33.

### Slice 2 — Concurrent project conversations can safely incubate future work

**Bead:** `prime-claw-h6w.3` (depends on `.2`)

**Capability delivered:** The `future` disposition writes, commits, and pushes
one non-binding three-file bundle from the shared canonical checkout, allocates
no episode resource, and leaves a clean checkout on success.

- Implement the locked future-write transaction and exact owned-path staging.
- Add explicit receipts for pre-existing dirt, lock contention, name/path
  collision, write/commit/push failure, remote race, and verified success.
- Preserve source conversation/session identity and bundle fingerprint in the
  future receipt so later promotion can prove ownership and context lineage.
- Integration-test with temp canonical clones and a local bare remote. Run two
  competing processes against the same checkout; assert serialization, no
  cross-staging, no lost bundle, and no branch/worktree/session allocation.
- Fault-inject every state change. Prove recovery removes or continues only
  byte-identical resources owned by the recorded transaction.

**Proves:** R-WE-1, R-WE-2, R-WE-10, R-WE-11, R-WE-12, R-WE-35, R-WE-36;
future-path portions of R-WE-31–33.

### Slice 3 — Promotion allocates a durable isolated sibling with full context

**Bead:** `prime-claw-h6w.4` (depends on `.3`)

**Capability delivered:** The `episode` disposition safely creates a unique
feature branch/worktree, persists a complete-conversation fork, activates that
exact fork as a daemon sibling, and durably links it to the still-live owner.

- Add configurable managed-worktree-root resolution and canonical-checkout,
  remote-default, ref, destination, and symlink-containment validation.
- Use public `SessionManager.forkFrom(...)`; add a compatibility/loader test for
  the exact public export used by Prime Agent 0.9.5.
- Compare source/target active branches before activation and fail if any
  conversation entry is missing, summarized, substituted, or rooted at the
  wrong CWD.
- Activate with `DaemonClient.request({type: "create", sessionPath, name})`,
  parse and validate the response, and persist complete owner/episode identity
  in the atomic registry.
- Test two concurrent allocations against shared refs and registry state,
  existing branch/path/session collisions, daemon unavailable/already-active
  responses, and a fault at each journal boundary. Preserve ambiguous or dirty
  partial state rather than applying generic deletion.

**Proves:** R-WE-3, R-WE-4, R-WE-14–19, R-WE-22, R-WE-23, R-WE-30;
episode-allocation portions of R-WE-31–33.

### Slice 4 — The prepared episode receives its task exactly once

**Bead:** `prime-claw-h6w.5` (depends on `.4`)

**Capability delivered:** The newly published sibling runs project preparation
and owns the exact active specification bundle in its worktree, with one
substantive admission despite automatic-preparation ordering, duplicate calls,
or coordinator restart.

- Persist the task envelope before activation and separate `activated` from
  `task-admitted` in the journal.
- Send one marked daemon prompt after publication with stable admission/message
  identity and safe queue semantics. Never use a substantive initial create
  prompt and never substitute `rlm.create_session`.
- On uncertain delivery, inspect the target transcript/daemon receipt for the
  marker before explicit recovery. Same disposition calls return the prior
  receipt; they do not emit another task.
- The admitted task requires target-side CWD/branch verification, `prepare`, and
  exact writes of `SPECIFICATION.md`, `REQUIREMENTS.md`, and `DECISIONS.md`.
- Exercise real ordering with a disposable daemon/automatic-preparation fixture,
  duplicate disposition attempts, process restart between each phase, and
  failure before/after admission acknowledgment.
- Once both real paths and loader tests pass, remove only the two duplicate
  `.agents/skills/design` and `.agents/skills/spec-it-out` symlinks. Assert the
  native commands are the sole operator-facing routes.

**Proves:** R-WE-6, R-WE-20, R-WE-21; completes R-WE-16, R-WE-17,
R-WE-19, R-WE-22, and R-WE-34; admission portions of R-WE-31–33.

### Slice 5 — Durable coordination spans the PR lifetime

**Bead:** `prime-claw-h6w.6` (depends on `.5`)

**Capability delivered:** After loss of Python handles, compaction, extension
reload, or coordinator restart, the owner can resolve and coordinate the same
episode through planning, implementation, push, PR review fixes, and rebasing.

- Implement `episode_manage status` and bounded `recover` over durable episode
  IDs. Reconcile stable session identity with current daemon activity without
  silently rebinding to a different session/worktree.
- Expose the exact identity/phase/next-safe-action receipt needed by normal
  Prime Agent observation and sibling messaging; do not duplicate message
  transport in the registry.
- Test owner-to-episode and episode-to-owner messages, stable identity after
  active-ID churn, compaction/kernel/extension restart, plan and implementation
  commits, remote push, simulated PR-open/review-fix/rebase transitions, and
  explicit refusal to clean up while review remains live.

**Proves:** R-WE-24, R-WE-25; reinforces R-WE-4, R-WE-18, R-WE-19,
R-WE-23, R-WE-30, and R-WE-33.

### Slice 6 — Four-file archive becomes a verified readiness claim

**Bead:** `prime-claw-h6w.7` (depends on `.6`)

**Capability delivered:** A completed episode archives the full planning set,
and its owner can run a deterministic readiness check that never grants merge
authority by itself.

- Update `.ralph/skills/execute/SKILL.md` to move all four active files into one
  unique `.ralph/plans/archive/<episode-slug>/` and update the archive index only
  after docs/tests/beads are current.
- Implement `episode_manage readiness` checks for archive completeness and
  uniqueness, absent active files, configured related beads closed, durable
  docs, clean/pushed branch, tests/CI, blocking PR feedback, and branch currency.
- Add provider adapters for GitHub/GitLab command-line status checks using
  existing injected auth only. Unsupported/unavailable providers remain
  unverified, never green by assumption.
- Test every failed predicate, duplicate/incomplete archives, stale branches,
  unresolved feedback, failed CI, and proof that archive/readiness cannot set
  merge or abandonment authorization.

**Proves:** R-WE-26, R-WE-27, R-WE-28; readiness portions of R-WE-32–33.

### Slice 7 — The owner can safely retire a terminal episode

**Bead:** `prime-claw-h6w.8` (depends on `.7`)

**Capability delivered:** After explicit verified merge or abandonment, the
owner can retire the registered session and remove only its clean, identity-
matched worktree; interrupted cleanup resumes safely.

- Implement owner-bound `authorize` actions with immutable actor/session,
  terminal disposition, timestamp, branch/PR evidence, and an explicit cleanup
  plan.
- Revalidate authorization, worktree registration, target containment, clean
  status, session/worktree identity, and merge/abandon conditions immediately
  before each mutation.
- Journal session retirement and worktree removal separately. Treat missing
  already-removed owned resources as recoverable idempotence, but reject
  mismatches and all unregistered/pre-existing/dirty resources.
- Keep branch deletion separate and off by default; require merged reachability
  or explicit abandonment plus its own confirmation/safety gate.
- Fault-inject every cleanup boundary and test dirty work, unmerged branches,
  wrong owner, wrong session/path, still-open review, symlink replacement,
  partial prior cleanup, and concurrent cleanup calls.

**Proves:** R-WE-29; completes cleanup/recovery aspects of R-WE-22,
R-WE-24, R-WE-27, R-WE-28, R-WE-31, and R-WE-33.

### Slice 8 — Promote incubated work and dogfood the complete lifecycle

**Bead:** `prime-claw-h6w.9` (depends on `.8`)

**Capability delivered:** A future bundle can become an episode through the
same mechanism, and one real disposable project completes both disposition
paths and the entire promoted lifecycle on the actual Prime Agent daemon.

- Add future promotion as an episode disposition that verifies the stored
  bundle fingerprint and originating conversation identity, then forks the
  complete current applicable branch of that owner conversation. It never
  constructs a fresh summary-only session from the files.
- Build a disposable local bare remote plus canonical default-branch clone under
  an isolated test root. Install the project extension/skills as the product
  would discover them; do not point dogfood at the operator's main checkout.
- Dogfood future: native interview → explicit future choice → locked
  three-file commit/push → clean canonical checkout → later promotion.
- Dogfood episode: native interview → explicit episode choice → durable bridge
  → branch/worktree → complete transcript fork → daemon sibling → preparation
  and exact spec write → plan/implementation commits → pushed simulated PR,
  review fix, and rebase → four-file archive/readiness → explicit owner
  merge/abandon decision → safe cleanup.
- Capture redacted versioned evidence with identities/hashes/statuses but no
  credentials or unrelated transcript. Run the full repository suite and the
  complete R-WE inventory gate. Update `VISION.md`, `LONG_RANGE_PLAN.md`, and
  durable reference/operations docs only to reflect behavior actually proven.

**Proves:** R-WE-13 (NICE) and final end-to-end acceptance for R-WE-1–36,
especially R-WE-32 and R-WE-33.

## 5. Test and evidence strategy

### Fast extension tests

`tests/specification_episodes_extension.test.mjs` imports the real TypeScript
extension under Node's type stripping and uses mock ExtensionAPI, Git process,
filesystem, daemon, and clock adapters. It covers schemas, command/skill
loading, receipts/state transitions, fault boundaries, no-shell invocation,
and deterministic recovery. Pytest invokes it through
`tests/test_specification_episodes_extension.py`.

### Real loader and process integration

The pytest bridge asks installed Prime Agent RPC for commands and tools. Temp
Git repositories and local bare remotes exercise actual worktree/ref/status/
commit/push behavior and competing OS processes. Tests set isolated Git identity
and session directories; they do not use the developer's repository, daemon, or
credentials.

### Session/daemon acceptance

Focused integration tests start a disposable daemon/socket and saved source
session. They prove fork branch equivalence, changed target CWD, parent lineage,
activation of the exact session file, owner survival, queued admission across
preparation, transcript marker uniqueness, restart reconciliation, and safe
retirement. Tests skip only with an explicit missing-prerequisite reason; CI
acceptance cannot silently pass by skipping a GATE requirement.

### Dogfood evidence

Slice 8 records a redacted JSON receipt under `docs/evidence/` and explains it
in `docs/specification-episodes.md`. The evidence records versions, bundle and
transcript-branch hashes, state transitions, Git refs, test/CI outcomes, and
cleanup results. It never records credentials, raw unrelated conversation, or
private transcript text.

## 6. Failure and recovery matrix

| Failure boundary | Required outcome |
|---|---|
| Invalid source, slug, branch, or root | Fail before mutation; validation receipt only |
| Lock held or ownership ambiguous | Fail closed; report owner/time/recovery; never steal automatically |
| Canonical checkout dirty | No write/stage/commit; exact paths/status reported |
| Future write/commit/push interrupted | Journal exact owned files/commit and clean/dirty/ahead state; explicit recover only |
| Pre-existing byte-identical future bundle | Collision only; no immutable ownership receipt exists, so recovery cannot delete it |
| Owned directory is renamed/replaced before first file removal | Guard identity fails closed; no directory incarnation is ever deleted |
| Removed target path is later reused | Consumed authority stays single-use; preserve replacement even if mutable journal state changes |
| Concurrent entry appears during owned removal | Exact-entry-set validation fails before unlink and preserves the directory and entry |
| Static or late-swapped control child redirects access | Revalidate every destructive control read/write/delete at use; no external access or product deletion |
| Local HEAD advances before push | Push the pinned owned commit OID, never moving `HEAD`; unrelated descendant remains unpublished |
| Reconciliation observes newer dirt or Git state | Derive all `current_*` fields from one coherent latest observation or fail closed |
| Success journal has malformed/inconsistent identity | Validate every OID/relationship; preserve exact journal and blocker; separate diagnostics |
| Constructed tree/commit contains non-regular mode | Index-free builder emits only exact `100644 blob` entries; reject any mismatch before push and during replay |
| Branch or worktree collision | Preserve existing resource; create nothing at that identity |
| Failure after creating an owned resource | Journal it; remove only when identity and pristine state prove safe, otherwise preserve |
| Fork mismatch or incomplete branch | Do not activate; preserve fork evidence and recovery state |
| Daemon unavailable/create uncertain | Preserve session file/worktree; reconcile daemon roster before any retry |
| Task admission uncertain | Search stable task marker/receipt first; never blind resend |
| Owner handle/kernel lost | Resolve from atomic registry and live daemon/Git state |
| Readiness predicate unavailable | Remain not-ready; request explicit verified evidence |
| Cleanup target dirty/mismatched/live | Refuse mutation and preserve all resources |
| Cleanup interrupted | Resume from journal after revalidation; never restart destructively |

## 7. Requirement-to-slice coverage

| Requirement | Slice(s) |
|---|---|
| R-WE-1, R-WE-2 | 2 |
| R-WE-3, R-WE-4 | 3, reinforced 5 |
| R-WE-5, R-WE-7, R-WE-8, R-WE-9 | 1 |
| R-WE-6 | 4, after both native paths pass |
| R-WE-10, R-WE-11, R-WE-12 | 2 |
| R-WE-13 | 8 |
| R-WE-14, R-WE-15 | 3 |
| R-WE-16 | 3–4, end-to-end 8 |
| R-WE-17, R-WE-18, R-WE-19 | 3–4 |
| R-WE-20, R-WE-21 | 4 |
| R-WE-22 | 2–4 and 7 |
| R-WE-23 | 3 and 5 |
| R-WE-24, R-WE-25 | 5 |
| R-WE-26, R-WE-27, R-WE-28 | 6–7 |
| R-WE-29 | 7 |
| R-WE-30 | 2–3, reinforced 5 |
| R-WE-31 | 1–4 and 7 |
| R-WE-32 | every mutating slice; final proof 8 |
| R-WE-33 | every slice; final dogfood 8 |
| R-WE-34 | 1 and 4 |
| R-WE-35, R-WE-36 | 2 |
| R-WE-69, R-WE-70, R-WE-71, R-WE-72 | 2 |
| R-WE-73, R-WE-74, R-WE-75, R-WE-76, R-WE-77, R-WE-78 | 2 revision gate |
| R-WE-79, R-WE-80, R-WE-81, R-WE-82, R-WE-83, R-WE-84 | partial mechanisms in `3fe649b`; owner adjudication in §2.4 |
| R-WE-85–R-WE-93 | `44b92f8` gate REVISE: targeted progress retained; R-WE-86/90/92/93 unmet and R-WE-87/88 threat scope unresolved |
| R-WE-94 | ASTRA-25 writer-validator transition closure; not implemented |

A generated inventory assertion must show every R-WE ID exactly once in the
requirements source and at least one `proven_by` path after its owning slice.
Slice 8 is not allowed to compensate for missing security, recovery, or
concurrency coverage in earlier slices.

### Decision preservation check

| Decision | Plan location |
|---|---|
| D-WE-1 canonical checkout | §§2.3–2.4; Slice 2 |
| D-WE-2 branch + worktree + session | §2.5; Slice 3 |
| D-WE-3 explicit durable owner | §§2.2, 2.6; Slices 3 and 5 |
| D-WE-4 native commands wrap canonical skills | §2.1; Slices 1 and 4 |
| D-WE-5 interview before disposition | §2.1; Slice 1 |
| D-WE-6 named locked future bundle | §2.4; Slice 2 |
| D-WE-7 complete conversation fork | §2.5; Slices 3–4 |
| D-WE-8 publication before task admission | §2.5; Slice 4 |
| D-WE-9 four-file readiness claim | §2.6; Slice 6 |
| D-WE-10 owner-only terminal cleanup | §2.6; Slice 7 |
| D-WE-11 configurable dedicated worktree root | §2.3; Slice 3 |
| D-WE-12 validated trusted host mechanics | §§2.1–2.6; all mutating slices |
| D-WE-13 POC is evidence, not integration proof | audit; Slices 3–4 and 8 |
| D-WE-14 explicit model-to-host bridge | §§2.1–2.2; Slices 1 and 4 |
| D-WE-15 object-bound destructive/publication authority | §§2.2, 2.4, 6; Slice 2 |
| D-WE-16 revalidate identity/containment/type/observation at use | §§2.2, 2.4, 6; not fully implemented at `14e5cfa` |
| D-WE-17 final-syscall object/control/lock authority | §§2.2, 2.4; post-`5d4be4a` same-Slice-2 candidate |
| D-WE-18 platform-real incarnation model | §§2.2, 2.4; post-`5d4be4a` same-Slice-2 candidate |
| D-WE-19 closed durable success proof | §§2.2, 2.4; partial at `3fe649b` |
| D-WE-20 allocation-unique authority and retirement topology | §§2.2, 2.4; partial, ASTRA-17/24 barrier recovery unmet |
| D-WE-21 one-way durable recovery/control lifecycle | §§2.2, 2.4; unmet at ASTRA-17/24/25; same-UID threat scope unresolved |
| D-WE-22 raw proof validation before routing | §§2.2, 2.4; raw proof supported, writer/schema closure unmet at ASTRA-25 |
| D-WE-23 durable writer-validator transition closure | §2.4; authority accepted, not implemented |

## 8. Completion boundary

Implementation is complete only when all eight slice beads are closed, every
GATE requirement is proven in the inventory, the real dogfood receipt is green,
the complete plan set is archived, and the owner independently verifies
readiness. The episode then reports its pushed commit/PR and waits. The owning
project conversation alone decides merge or abandonment and invokes safe
cleanup afterward.
