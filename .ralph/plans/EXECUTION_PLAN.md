# Execution Plan — Worktree-isolated specification episodes

> **Status:** implementation in progress; Slice 1 (`prime-claw-h6w.2`) is
> implemented and validated; Slices 2–8 remain open.
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
| 1 — native interviews and trusted preflight | `prime-claw-h6w.2` | Implemented and validated | `.prime/agent/extensions/specification-episodes.ts`; `docs/specification-episodes.md`; focused Node/RPC tests; active project suite `pytest -q tests` (236 passed) |
| 2–8 | `prime-claw-h6w.3`–`.9` | Not started | Dependency-ordered below |

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
├── episodes/<episode-id>.json
└── tasks/<episode-id>.json
```

This location is shared by the canonical checkout and all of its worktrees,
survives session/kernel/extension restarts, does not dirty any checkout, and is
local to the runtime whose sessions/worktrees it describes. Writes use an
atomic create-or-rename protocol. A project-scoped lock uses atomic directory
creation, includes diagnostic owner/time metadata, and is never silently
stolen. Stale-lock recovery is explicit.

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
4. stages those exact pathspecs and proves the staged set equals the allowlist;
5. commits with the disposition ID in the receipt, then pushes the checked
   default branch to its configured upstream; and
6. rechecks that the canonical checkout is clean before reporting success.

A rejected push, remote race, commit failure, or crash records the exact local
commit/files/status. It does not absorb, reset, rebase, or commit another
conversation's work. `recover` may continue or safely remove only byte-identical
uncommitted files created by that transaction; otherwise it stops for the
operator.

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

## 8. Completion boundary

Implementation is complete only when all eight slice beads are closed, every
GATE requirement is proven in the inventory, the real dogfood receipt is green,
the complete plan set is archived, and the owner independently verifies
readiness. The episode then reports its pushed commit/PR and waits. The owning
project conversation alone decides merge or abandonment and invokes safe
cleanup afterward.
