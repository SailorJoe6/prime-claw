# Execution Plan — Worktree-isolated specification episodes

> **Status:** implementation in progress; Slice 1 is validated. Immutable Slice 2
> candidate `71a1944eef9330308639312a53865de032bc7c14` received owner **REVISE**;
> the formal GPT-6 Astra synthesis delivery failed closed while all three
> specialists independently returned REVISE. Preserve `71a1944` as rejected.
> Transition `dd08e63a-7f96-4be0-b559-4303c6eeb383` authorizes exactly one
> bounded six-class Slice 2 correction. Slice 2 stays open; Slices 3–8 stay blocked.
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
| 2 — concurrency-safe future incubation | `prime-claw-h6w.3` | Candidate `71a1944` rejected; six blocker classes authorized for one bounded correction | Transition `dd08e63a-7f96-4be0-b559-4303c6eeb383`; Slice 3 blocked |
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

Implementation progress: product-file, deterministic control, and tree-evidence
retirement now reconcile from the manifest-bound destination before consulting
or moving a public name. Exact retired objects complete idempotently after
response/barrier loss. Invalid retired objects restore no-replace when the
public name is free; occupied public names preserve and report both locations.
Product and tree conflicts fail. An exact retired control record plus a newer
canonical record remains the R-WE-91 response-loss success case and reports
`canonical_replacement` without moving either object. Prevalidation prevents a restored foreign object from cycling back into
quarantine, while post-rename validation still closes substitution and
hardlink-write races. Source and destination parents are flushed in order after
rename and restore. Disposable fresh-process tests interrupt before each parent
barrier and before validation for directory and dirty-hardlink substitution,
interrupt both restoration barriers, cover exact-owned resume and public-name
conflict, and apply the same model to control and tree evidence. This is focused
ASTRA-17/24 evidence only, not ASTRA-25 or final Slice 2 acceptance. Post-fix
validation passes the exact combined Node suites 93/93 in 1,302.58 seconds,
the focused helper/identity selection 48 passed with 2 platform skips, the
retirement fault selection 11 passed with 1 platform skip, and inventory 2/2.
Independent review first returned REVISE at `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-2f983c02/astra17-24-final-code-audit.md` (SHA-256
`4ba275583c7460080c964bde61c536c1c5f1e21ab731d712ecb906c621fc7924`) for order-insensitive crash traces; persistent pre-exit
traces closed the finding. Final read-only audit PASS is `/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-bd380039/astra17-24-trace-audit.md`
(SHA-256 `2e3d07827dfe8f77f102b2392a8f1b2e9db801eb0299d3450930b774872f3380`).

Final authorized Slice 2 task: transition
`dc0f2b07-726b-4fa3-b6c7-7a4170e7bc7c` resumes `prime-claw-h6w.3` from clean
commit `d190cc4b280516318b66cf31753a1dba98991c21` and implements ASTRA-25 only.
Close every normal/recovery/interruption/removal writer against its exact closed
validator under R-WE-94/D-WE-23, including reopened R-WE-22/R-WE-90 and
D-WE-21/D-WE-22. Enumerate permanent transition closure, repeatedly interrupt
continuation and running-to-removed cleanup, and preserve malformed-success
handling. Preserve all prior remediations and broad same-UID authority. Run the
required Node and plan-active Python suites, update all authority/evidence,
commit and push the combined immutable candidate, prove clean local/upstream/
actual-remote identity, then stop for fresh owner/formal EXPERT review. Do not
claim acceptance or start Slice 3; hazardous fixtures remain disposable.

ASTRA-25 focused implementation evidence is now green. Every mutable writer is
validator-gated before persistence; verified v2 success is exactly validated
before write and after durable reread. Recovery uses valid monotonic or explicit
closed variants for ownership/bundle repair, exact-tree reuse, commit
reconciliation, pushing/readvance, and terminal removal. The registered
17-variant matrix restores every durable image and replays it with a fresh
extension import in a separate Node process. Both repair-only writers are
interrupted at their own persistence boundary and continued from fresh process.
Malformed-success preservation remains strict. Focused ASTRA-25 passes 9/9 in
649.44 seconds. Exact plan-active Python passes 281 with 2 platform skips in
3,079.28 seconds. Scoped final audit PASS is
`/Users/jlanders/.prime/agent/session-artifacts/01a0b638-b392-778e-8c04-c5307740fc42/sub-f9d7bb7d/astra25-fresh-final-audit.md` (SHA-256
`279cdb4d9e507476b13d13e4e288f331f5a7898809d37fab0c6e08db373fdb69`).
The exact combined Node suite now passes 102/102 in 1,905.70 seconds. The exact plan-active Python suite passes 281 with 2 platform skips in 3,079.28
seconds. Final lightweight checks, immutable commit/push, and fresh owner/formal
EXPERT gate remain pending.

Non-blocking post-Slice-2 follow-up `prime-claw-h6w.10` records test-performance
architecture. Baselines are focused ASTRA-25 9/9 about 531 seconds before fresh-
process expansion (649.44 seconds with final fresh-process coverage), combined
Node 93/93 about 1,303 seconds, prior plan-active Python about 2,199 seconds, and
current exact Python 3,079.28 seconds. The follow-up must preserve every safety/
fault assertion and protected-resource isolation while separating deterministic
unit, normal PR/integration, and exhaustive nightly tiers; remove duplicate
nested execution; replace real waits only with faithful injectable clocks or
barriers; parallelize only isolated disposable repositories; retain a documented
complete exhaustive command; measure before/after; update CI/docs; and choose
budgets from evidence. It is not an ASTRA-25 blocker, does not broaden this diff,
and does not authorize Slice 3.

#### Fresh `7eac1e7` owner/formal gate — REVISE

Candidate `7eac1e7ccb8e715366377f0d1fd2d523f6660408` is preserved as the rejected
immutable boundary. Transition `ba165904-ac51-4e82-9ec3-46f6693fe67f`
incorporates documentation/authority only and authorizes no implementation.
Owner authority is `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/slice2-7eac1e7-owner-gate.md` (SHA-256
`7fbfd05868f2718d326ebb83b26d035e9b25f5a78106e21da909688f863c2652`);
formal authority is `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/slice2-7eac1e7-formal-review.md` (SHA-256
`93098c2cf8545a38dd863b242366305a2c21043ce886f3a2f3d326a0e56620d9`).
The owner verified all 325 manifest artifacts at `/Users/jlanders/.prime/agent/session-artifacts/01a0b5fe-e74c-7149-80b9-f328a5b1924f/expert-reviews/slice2-7eac1e7/artifact-manifest.json` (SHA-256
`19d0a7e8798128927979fded1d06ed3d958f9baacaf821499bf2ddaf92b7fb21`)
and retired the reviewer tree artifact-first.

| Blocker | Open authority | Required correction/coverage |
|---|---|---|
| ASTRA-25 before-journal continuation mutates before a closed state exists; validator/catch reject `failed/directory-created`, the original mutation-false journal remains, and no blocker exists | R-WE-22/90/94; D-WE-21–23 | Persist a closed initialized continuation before mutation or reject without mutation; COV-01 covers corrected precondition, fresh continuation, interruption, ownership repair, catch, repeat continuation, inspection, terminal paths, and accurate blocker/mutation evidence without validator weakening |
| ASTRA-10/19 broker failed-start and normal-exit raw socket unlink can delete a foreign replacement | R-WE-22/79/88; D-WE-17/21 | Allocation-bound cleanup or ambiguity preservation; substitute files, sockets, and directories at both edges |
| ASTRA-17/24 capability-probe retirement can relocate a foreign directory and leave the public name absent | R-WE-22/86/92/93; D-WE-17/20/21 | Destination-first no-replace restoration and durable reconciliation across directory/dirty-hardlink substitution, both barriers, response loss, restart, and occupied restoration destinations |
| ASTRA-19/24 lock/guard retirement resume depends on process-local movement flags and strands foreign content in deterministic quarantine | R-WE-88/93; D-WE-21 | Destination-first resumable lock/guard retirement across rename/barrier/validation interruptions under live and abandoned supervisors |

Credited corrections remain the original ASTRA-10 probe-unlink and ASTRA-11
final-rmdir fixes, material product/control/tree recovery, exact-tree rewind, and
terminal-observation repair. Historical orphan brokers are evidence only, not a
fifth blocker. `FS-REMOTE-01` is a scoped fetch/push topology follow-up without a
false-success finding. `COV-02` extends required-ID completeness through
R-WE-94. `COV-03` labels old 93/264 totals as rejected baseline rather than
current candidate evidence. `prime-claw-h6w.10` remains non-blocking and may not
weaken exhaustive coverage. Slice 2 remains open; Slice 3 is blocked/unstarted.

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
| R-WE-79, R-WE-80, R-WE-81, R-WE-82, R-WE-83, R-WE-84 | `7eac1e7` gate: original ASTRA-10 probe unlink and ASTRA-11 final-rmdir credited; broker cleanup keeps R-WE-79 open |
| R-WE-85–R-WE-93 | `7eac1e7` gate REVISE: product/control/tree progress credited; before-journal, probe, broker, and lock/guard edges keep R-WE-86/88/90/92/93 open; R-WE-87/88 same-UID scope unresolved |
| R-WE-94 | `7eac1e7` gate REVISE: before-journal continuation mutates before a closed persisted transition and strands stale mutation/blocker evidence; COV-01 required |

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
| D-WE-20 allocation-unique authority and retirement topology | §§2.2, 2.4; product/control/tree progress credited, but `7eac1e7` capability-probe restoration remains open |
| D-WE-21 one-way durable recovery/control lifecycle | §§2.2, 2.4; `7eac1e7` REVISE at before-journal continuation, broker cleanup, probe retirement, and lock/guard resume; same-UID scope unresolved |
| D-WE-22 raw proof validation before routing | §§2.2, 2.4; malformed-success defense credited, but before-journal continuation/catch closure fails at `7eac1e7` |
| D-WE-23 durable writer-validator transition closure | §2.4; `7eac1e7` REVISE; COV-01 transition execution required |

## 8. Completion boundary

Implementation is complete only when all eight slice beads are closed, every
GATE requirement is proven in the inventory, the real dogfood receipt is green,
the complete plan set is archived, and the owner independently verifies
readiness. The episode then reports its pushed commit/PR and waits. The owning
project conversation alone decides merge or abandonment and invokes safe
cleanup afterward.

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
