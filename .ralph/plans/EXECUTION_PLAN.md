# Execution Plan — Task-native Backlog/Ralph lifecycle

> **Authoritative product contract:** Backlog epic `PRIMECLAW-10.38`
>
> **Final old-style admission bundle:** `.ralph/plans/future/replace-ralph-plans-with-backlog`
>
> This is the last plan stored under `.ralph/plans`. Its accepted implementation
> migrates this plan into `PRIMECLAW-10.38` and deletes `.ralph/plans` in the
> candidate tree. Planning does not authorize implementation.

## Implementation boundary

Replace plan-folder identity with one exact Backlog task across design, planning,
Episode admission, execution, handoff, review, completion, and abandonment. Reuse
the current prep/follow-up chain, Orca/local worktree creation, durable Prime
Agent sessions, exact-owner checks, and uncertainty handling. Do not add a
second tracker abstraction, cross-checkout wrapper, status-sync protocol,
replacement digest, transaction journal, custom merge driver, runtime cutover
hook, or Prime Agent change.

The implementation Episode must use the repository-built Backlog candidate for
development and migration commands. Plugin runtime code may invoke the supported
`backlog` CLI from `PATH`; it must not parse or edit task Markdown directly.
Plugin-source validation remains Docker-only and must not apply or probe the
user-global candidate.

## Final old-style admission prerequisite

This migration is admitted through the existing `/implement-spec` path, but its
branch must already start from truthful task state. After the future bundle is
approved and the implementation-readiness review passes, the owning Conversation
must, before calling `create_spec_episode`:

1. update only `PRIMECLAW-10.38` to `In Progress` through the Backlog CLI;
2. commit only the returned task path on main and verify the commit contains no
   other path;
3. attempt a prompt push when the remote is available, without making push
   success a local creation gate; and
4. call the existing Episode-creation tool so its `baseRef` is that exact status
   commit.

The pre-cutover config does not yet admit `In Planning`. If this final old-style
creation fails before any resource or ownership mutation and the failure is
proven clean, restore its exact pre-admission `To Do` state in a task-only
commit; this is a one-time compatibility rollback, not the new product
behavior. If creation is partial or uncertain, set the task `Blocked` with the
exact recovery condition and do not retry it as a new Episode. The implemented
`/implement-task` path must use the specified `In Planning` clean rollback.

## Ordered implementation slices

### 1. Establish task-native lifecycle and reviewed authoring/planning

- Add focused Backlog CLI support in the plugin for resolving an exact task by
  ID and consuming its supported JSON fields. Keep this as a narrow command
  seam for existing lifecycle code and tests, not a parallel task model or a
  Markdown parser.
- Replace folder validation and public reviewed-plan surfaces in
  `src/prime-agent-plugin/extensions/reviewed-plan.ts` and
  `extension-support/reviewed-plan-support.ts` with task identity:
  `/plan TASK-ID`, `plan_task`, `/implement-task TASK-ID`,
  `create_task_episode`, `handoff_task_episode`, and
  `finalize_task_episode`. Preserve the existing
  prep-turn, focused-compaction, sole-follow-up, ephemeral approval, and
  optional exact Orca host-selection behavior.
- Update `backlog/config.yml` to the final ordered statuses `In Design`,
  `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, `Done`, with
  default `In Design`. During the one-time state migration only, temporarily
  retain `To Do` in the uncommitted working configuration until every existing
  task has a truthful replacement status.
- Rewrite the source `design` and `spec-it-out` project templates to create a
  new `In Design` task or update only an explicitly selected task already in
  `In Design`. Store specification narrative, native acceptance criteria,
  constraints, references, and documentation in supported task fields. Reject
  later states and stop for review without planning or implementation.
- Replace plan-prep/plan-spec policy with task-native planning. Native preflight
  accepts only `In Design` or `In Planning`; the semantic turn reloads the task,
  writes a meaningful native Implementation Plan through the CLI, changes or
  retains `In Planning`, commits only that task path, attempts a prompt push,
  links the task for review, and stops. Later states reject without mutation.
- Cover fresh/existing authoring, exact-ID resolution, status matrices, blank or
  placeholder plans, task-only commits, and non-gating push failure in focused
  Node/Python fixtures.

#### Slice 1 progress — Backlog task-resolution foundation (2026-10-13)

Completed the first bounded increment of slice 1:

- added a narrow `backlog task view --json -- <task-id>` command seam that lets
  Backlog normalize supported IDs and binds the canonical returned ID, current
  status, optional Implementation Plan, and contained regular task path;
- kept Backlog as the task model and Markdown owner; plugin code neither parses
  task Markdown nor introduces a second tracker abstraction;
- added focused fixtures for canonical shorthand resolution, exact argv/CWD,
  supported JSON fields, unsafe selection, command failure, malformed JSON, and
  escaped task paths;
- documented the seam and its intentionally deferred activation boundary; and
- passed focused host-safe policy checks plus source-mode
  `scripts/test-tier1.sh --probe`, with evidence at
  `.test-results/20261013T060350Z-97903-65a8f369/tier1`.

#### Slice 1 progress — staged task-native planning policy (2026-10-13)

Completed the next bounded increment of slice 1:

- added inert `plan-task-prep` and `plan-task` workflow assets under new names,
  leaving the working `/plan-spec` command and folder workflows unchanged;
- encoded exact task/status checks, compact-first sole-follow-up behavior,
  proportional semantic readiness, native Implementation Plan mutation, exact
  task-only commits, non-gating push evidence, and the operator review stop;
- reconciled source and builder-project copies through the asset inventory and
  template manifest without registering any public command;
- made project-asset `migrateFrom` optional in both inventory consumers so a new
  asset with no truthful predecessor does not invent migration provenance;
- added direct inventory-loader, fresh reconciliation, managed-copy, and dynamic
  documentation coverage; and
- passed 19 focused host-safe checks plus source-mode
  `scripts/test-tier1.sh --probe`, with evidence at
  `.test-results/20261013T062411Z-55643-de31915d/tier1`.

#### Slice 1 progress — additive task-native planning activation (2026-10-13)

Completed the next bounded increment of slice 1:

- exposed `/plan TASK-ID` and structured `plan_task({"taskId":"TASK-ID"})`
  while preserving `/plan-spec`, `plan_spec`, and implementation admission;
- resolved operator input through Backlog, admitted only exact `In Design` or
  `In Planning`, and passed the canonical returned task ID into both preloaded
  workflows;
- reused the compact-first two-message chain without changing native ordinary
  delivery, tool `steer` delivery, sole `followUp`, or uncertain-send behavior;
- staged `In Design` and `In Planning` in Backlog configuration while retaining
  `To Do` as the temporary default and selectable pre-migration state;
- updated current planning docs, story traceability, command/tool discovery,
  status matrices, and folder-compatibility regressions; and
- passed 17 focused Node behavior tests, 29 host-safe checks, independent review
  with no material findings, and source-mode `scripts/test-tier1.sh --probe`,
  with final evidence at
  `.test-results/20261013T063848Z-99892-f5ef0597/tier1`.

#### Slice 1 progress — task-native specification authoring (2026-10-13)

Completed the next bounded increment of slice 1:

- converted the managed `design` and `spec-it-out` skills from new future-folder
  artifacts to one new explicit `In Design` task or one exact selected existing
  task already in `In Design`, while preserving their distinct discovery modes;
- made Description, native Acceptance Criteria, References, and Documentation
  the living specification fields and prohibited Implementation Plan, notes,
  final-summary, status, and Episode mutation during authoring;
- rejected later lifecycle states without mutation, required clarification when
  new-versus-existing intent is ambiguous, and made an uncertain create a
  fail-closed no-blind-retry result;
- required canonical reload/path verification, exact task-only commits, prompt
  non-gating pushes, and an explicit operator specification-review stop;
- updated required orientation and operator docs so new authoring is task-native
  while `/plan-spec`, `/implement-spec`, and existing folder Episodes remain a
  bounded compatibility path;
- added a disposable Backlog/Git fixture that executes fresh creation, existing
  revision, native field preservation, exact path binding, task-only commits in
  a dirty worktree, and non-gating push failure; and
- passed 22 focused host-safe checks, independent review with all findings
  repaired, and source-mode `scripts/test-tier1.sh --probe`, with final evidence
  at `.test-results/20261013T065752Z-55162-273d77d8/tier1`.

#### Slice 1 progress — staged task-native Episode-admission policy (2026-10-13)

Completed the next bounded increment of slice 1:

- added inert project-customizable `implement-task-prep` and `implement-task`
  workflow assets without registering `/implement-task` or
  `create_task_episode` before their trusted mechanics exist;
- encoded exact canonical task binding, structural `In Planning` plus meaningful
  plan checks, proportional semantic readiness, and one exact tool-call boundary;
- specified the trusted order as exact main-task `In Progress` commit, durable
  `provisioning` ownership reservation, then branch/worktree/session creation
  from the recorded status-commit SHA;
- preserved best-effort push semantics, clean pre-resource rollback to `In
  Planning`, and partial/uncertain `Blocked` outcomes without fresh replay;
- reconciled source and builder-project copies through the inventory and
  manifest while keeping retained `/implement-spec` assets and behavior live;
- updated project initialization and Episode-promotion documentation and added
  focused policy, non-activation, ordering, and fresh-reconciliation coverage;
  and
- passed 28 focused Node reconciliation tests, 23 host-safe Python checks with
  3 container cases deselected, independent review after repairing one
  provisioning-order defect, and source-mode `scripts/test-tier1.sh --probe`,
  with final evidence at
  `.test-results/20261013T071323Z-8630-3272b5af/tier1`.

#### Slice 2 progress — task-native ownership reservation foundation (2026-10-13)

Completed the first bounded increment of slice 2 without activating public
admission:

- added a strict version-2 ownership identity containing the canonical Backlog
  task ID and project-relative task path while retaining disjoint version-1
  folder identity for existing Episodes;
- added an internal `reserveTaskEpisodeOwnership` boundary that re-resolves the
  exact canonical task, requires committed `In Progress` plus a meaningful
  native plan, and proves HEAD contains only that clean task path;
- made the first task-native write a minimal `provisioning` reservation bound to
  the status-commit SHA, with no branch, worktree name/identity, session, or
  assignment identity and no arbitrary fields that could become shadow
  lifecycle authority;
- blocked every non-terminal ownership replay, preserved existing inactive
  replacement behavior, taught Conversation compaction to retain either
  identity, and made retained folder admission/close reject task-native
  ownership rather than misinterpret it;
- kept `/implement-task`, `create_task_episode`, and task-native allocation
  unregistered and preserved existing `/implement-spec` creation behavior;
- added executable Git fixtures for exact task re-resolution, status/plan gates,
  task-only HEAD commits, post-commit cleanliness, strict schema separation,
  replay rejection, Orca placement binding, and absence of resource identities;
  and
- passed 97 focused Node tests, 18 host-safe Python checks with 10 container
  cases deselected, independent review after repairing strict-field,
  placeholder-plan, and premature-worktree-name defects, and source-mode
  `scripts/test-tier1.sh --probe`, with final evidence at
  `.test-results/20261013T074625Z-51506-443b013a/tier1`.

#### Slice 2 progress — task-native allocation after reservation (2026-10-13)

Completed the next bounded slice-2 increment without activating public
admission:

- added an internal allocator that accepts only the exact version-2 task/owner
  reservation and derives non-authoritative branch/worktree/session labels from
  the canonical task ID;
- made local and exact reserved local-Orca worktrees start from the bound
  task-only status-commit SHA, with no bundle copy, plan promotion, or promotion
  commit;
- bound one durable exact-CWD Prime Agent session, retained the visible Orca tab
  behavior, and injected the exact task ID into one execute assignment;
- made active replay validate worktree, provider, durable session ID/file, and
  exact session CWD, reopening the same session when needed without replaying
  allocation or assignment;
- changed partial provisioning and all post-reservation allocation failures to
  durable `uncertain` ownership that cannot replay as fresh allocation, while
  leaving later Conversation-owned `Blocked` publication unwired;
- kept `/implement-task` and `create_task_episode` unregistered and preserved
  the complete version-1 folder allocator and public compatibility path; and
- passed 106 focused Node tests, 36 host-safe Python checks with 10 container
  cases deselected, independent review after repairing a foreign-session-CWD
  replay defect, and source-mode `scripts/test-tier1.sh --probe`, with final
  evidence at `.test-results/20261013T081542Z-76164-4158db63/tier1`.

#### Slice 2 progress — trusted task-native admission transaction (2026-10-13)

Completed the next bounded slice-2 increment without activating public
admission:

- added an internal transaction that accepts only the exact clean `In Planning`
  task with a meaningful native plan and no non-terminal project ownership;
- changed the task to `In Progress` through supported Backlog CLI, committed
  only its canonical path, and treated push failure as non-gating evidence;
- reserved ownership against that exact status-commit SHA, called the existing
  allocator, and verified strict durable active identity plus unchanged main
  task status, HEAD, and path cleanliness before returning success;
- made a proven clean failure before ownership/resource mutation publish one
  exact task-only rollback commit to `In Planning`;
- made every recorded, partial, uncertain, or missing-active-postcondition
  outcome publish `Blocked` plus a precise `.prime-claw/ownership.json`
  reconciliation condition, retain all evidence/resources, and reject fresh
  replay;
- kept `/implement-task` and `create_task_episode` unregistered and preserved
  the version-1 folder admission path unchanged; and
- passed 113 focused Node tests, 36 host-safe Python checks with 10 container
  cases deselected, independent review with no material findings, and
  source-mode `scripts/test-tier1.sh --probe`, with final evidence at
  `.test-results/20261013T090020Z-68646-c18d94ca/tier1`.

#### Slice 2 repair — canonical primary-main admission boundary (2026-10-13)

Completed the operator-accepted repair without activating public admission:

- `createTaskEpisode` now proves the caller is at the repository root of the
  primary Git worktree on `main` before task lookup or any mutation;
- linked worktrees and a primary checkout on another branch fail before Backlog
  edit, commit, ownership read/write, reservation, or allocation;
- a disposable linked worktree on `main` carries an eligible `In Planning` task
  and no ownership record, and proves unchanged task bytes, HEAD, worktree
  status, primary-checkout state, ownership, reservation count, and allocator
  count; and
- the accepted admission transaction, retained folder compatibility, and
  inactive `/implement-task` / `create_task_episode` surface remain unchanged.

Validation passed 114 focused Node tests, 36 host-safe Python checks with 10
container cases deselected, independent review with no material findings, and
source-mode `scripts/test-tier1.sh --probe`, with final evidence at
`.test-results/20261013T091936Z-61769-1fbb9755/tier1`.

#### Slice 3 progress — task-native execute policy (2026-10-13)

Staged the task-bound Episode execution contract without activating public
admission:

- an execute assignment carrying `<operator-episode-task>` now reloads that
  exact Backlog task and rejects changed identity, path, parent, or non-
  `In Progress` status rather than selecting replacement work;
- the task specification fields, Implementation Plan, Implementation Notes,
  acceptance evidence, references, documentation, modified files, and Final
  Summary are the sole durable authority in task-native mode;
- Episode-owned content changes use supported Backlog CLI operations only in
  the Episode worktree, while lifecycle status stays Conversation-owned on
  main with no `--status`, completion, archive, cross-checkout copy, mirroring,
  or dual write;
- blocked passes must commit and push their exact durable blocker checkpoint
  before reporting, and candidate passes likewise leave status unchanged and
  report a pushed reviewable commit; and
- assignments without a task block retain the complete folder-plan execute
  workflow for existing `/implement-spec` Episodes. Source, tracked project
  asset, and managed-template hashes remain synchronized.

A disposable Backlog fixture proves supported plan/note/criterion/modified-file
updates preserve canonical ID, task path, parent, `In Progress` status, and an
unrelated dirty path while allowing an exact task commit. Independent review
found and the final policy repaired the missing blocked-pass commit/push gate;
repair review found no remaining material defect. Validation passed 40
host-safe Python checks with 9 deselected, 70 focused Node tests,
`git diff --check`, and source-mode `scripts/test-tier1.sh --probe`, with final
evidence at `.test-results/20261013T094041Z-49232-6f8646b6/tier1`.

#### Slice 3 progress — inactive task-native continuation (2026-10-13)

Added the internal task-native handoff transport and dual-mode handoff policy
without registering a public task admission, handoff, or finalization surface:

- `handoffTaskEpisode` accepts only the exact top-level owner in the canonical
  primary `main` checkout with strict active version-2 ownership;
- main and the Episode worktree must resolve the same bound task ID/path, both
  remain `In Progress` with meaningful plans, and the owned Episode worktree
  must be clean with matching Git and optional Orca identity;
- the durable session must match its recorded ID/file and exact owned worktree
  CWD, and the route must be fully quiescent before delivery;
- canonical handoff and its sole execute follow-up both carry the same
  `<operator-episode-task>` binding, guidance appears only in handoff, route
  reopen may refresh only active routing identity, and no resource is created
  or replaced; and
- task-mode handoff uses supported Backlog task fields only, never status or
  `.ralph/plans`, while no-block handoff and `handoffSpecEpisode` retain the
  complete folder workflow. Source/project copies and template hashes match.

The seam rejects `Blocked` until the Conversation has truthfully published a
resumed `In Progress` state and rejects `Ready for Merge` until the constrained
final-integration handshake exists. It also rejects identity/path/plan drift,
non-active ownership, dirty worktrees, foreign session CWD, and noncanonical
caller checkout before delivery. Independent review found no material defect.
Validation passed 41 host-safe Python checks with 11 deselected, 115 focused
Node tests, `git diff --check`, and source-mode
`scripts/test-tier1.sh --probe`, with final evidence at
`.test-results/20261013T100557Z-41220-9a097e6b/tier1`.

#### Completed follow-up repair after b1f49bf (2026-10-13)

Repaired the accepted continuation preflight defect before public activation.
After resolving and matching the exact main task, `handoffTaskEpisode` now runs
path-scoped Git status for only the recorded task path and requires it to match
committed `HEAD` before status/plan acceptance, route reopen, ownership refresh,
handoff, or execute delivery. Unrelated dirty main paths remain allowed.

The regression commits a `Blocked` task, changes only its working-tree bytes to
`In Progress`, proves the committed and working views differ, and verifies zero
reopen, ownership refresh, handoff, or execute delivery. A companion regression
proves unrelated main dirt still permits valid continuation. The repair
preserves the accepted task-native transport, folder compatibility, and
inactive public task surfaces. Independent review found no material defect.
Validation passed 50 focused Node tests, 23 focused host-safe Python checks with
2 deselected, 117 broad Node tests, 41 broad host-safe Python checks with 11
deselected, `git diff --check`, and source-mode
`scripts/test-tier1.sh --probe`; final Docker evidence is at
`.test-results/20261013T102307Z-99098-156da715/tier1`.

Slices 1 through 3 remain open. Public `/implement-task`,
`create_task_episode`, and task-native handoff/finalization remain inactive.
Task-native placement/approval wiring, Conversation-owned Blocked/resume status
publication, oversight/Expert task authority, Ready-for-Merge integration,
operator decision outcomes, finalization/abandonment, retained real-session
evidence, and final lifecycle/default migration remain later increments.
Acceptance criteria #2, #3, #6, #7, and #8 remain unchecked until their
real-session or end-to-end semantic paths are retained; this inactive
continuation slice alone completes no criterion.

#### Slice 3 progress — task-native oversight and Expert authority (2026-10-13)

Converted the managed Conversation and Expert review policies to select one
disjoint durable authority from ownership. Version 2 binds the exact Backlog
task ID/path, supported task fields, parent identity, and candidate commit;
Conversation supervision and independent review never consult `.ralph/plans`,
do not substitute a related task, and do not copy or mirror Episode-owned task
content. Version 1 retains its exact approved specification/plan folder.

The Conversation guide remains judgment-only and preserves the four bounded
dispositions, recorded acceptance evidence, canonical exact-owner handoff,
non-adversarial review boundary, goals/heartbeat discipline, and operator-only
product/merge/abandonment/cleanup authority. The Expert workflow retains native
RLM bootstrap/message/observe/delete mechanics and now sends the selected
exact-task or exact-folder contract to the read-only reviewer. Static policy and
managed-protocol tests cover both modes, and the existing compaction hook still
reinjects the complete guide only for the exact active owner.

This is a policy-only dependency slice. It registers no task-native command or
tool, changes no lifecycle state, and leaves public task admission, handoff, and
finalization inactive. Conversation-owned `Blocked`/resume publication,
`Ready for Merge` integration, operator decision mechanics, retained native
receipts, and final migration remain later work. No acceptance criterion is
newly claimed by this staged policy.

Validation passed 6 focused policy checks, 31 broad host-safe Python checks with
43 container cases deselected, 56 broad Node checks, and `git diff --check`.
The dependency audit endorsed this as the smallest coherent next slice, the
independent bounded diff review found no material defects, and source-mode
`scripts/test-tier1.sh --probe` passed with immutable-image, offline-RPC,
teardown, and manifest evidence at
`.test-results/20261013T103834Z-65715-7dcc0310/tier1`.

#### Slice 3 progress — inactive task placement and ephemeral approval (2026-10-13)

Staged the deterministic task-native compact-first admission seam without
registering `/implement-task` or `create_task_episode`. Before either workflow
message, it resolves the exact `In Planning` task and selects one exact ready
local Orca setup: a sole setup, explicit stable ID, or native picker result.
Zero ready setups, remote placement, noninteractive ambiguity, cancellation,
and other inventory errors fail before queueing. Direct local fallback is
allowed only when the production Orca command is definitively absent and no
explicit setup was requested; malformed or negative inventory fails closed.
Placement selection performs no task, Git, ownership, worktree, session, or
other resource mutation.

Only after placement and both workflow messages succeed does the seam grant one
in-memory approval bound to the owner session, canonical task ID/path and
project root, and exact placement. The prep-turn end exposes it to the semantic
turn; exact identity is required, one consume removes it, and phase end,
session start, or shutdown clears it. The full ordinary oversight guide is
prepended to `implement-task` semantic readiness. Retained folder admission and
all currently registered public surfaces remain unchanged.

This slice connects no approval consumer to the trusted task-creation
transaction and changes no lifecycle state. Conversation-owned `Blocked`/resume
publication, `Ready for Merge` integration, operator outcomes, task-native
close/abandonment, coordinated public activation, retained native receipts, and
final migration remain later work. No acceptance criterion is newly claimed.

Focused validation passed 32 Node tests. Broad validation passed 107 Node tests
and 43 host-safe Python checks with 43 container cases deselected, plus
`git diff --check`. Independent review identified an overbroad production Orca
fallback classification: retained inventory translated malformed and negative
responses into `OrcaUnavailableError`. The accepted repair added a strict
Task-placement inventory path that falls back only for process `ENOENT`, leaves
retained behavior unchanged, and proves malformed/negative responses fail.
Repair rereview found no material defects. Source-mode
`scripts/test-tier1.sh --probe` passed with immutable-image, offline-RPC,
teardown, and manifest evidence at
`.test-results/20261013T110322Z-62776-06322ace/tier1`.

#### Slice 3 progress — inactive task-native Blocked publication and resume (2026-10-13)

Staged Conversation-owned blocker status publication without registering any
public task-native lifecycle surface. The Episode must remain `In Progress`,
commit its exact task evidence after admission, push the exact reported branch
head, and leave its worktree clean. The status seam then proves exact active
version-2 ownership, the owning persisted top-level Conversation, canonical
primary `main`, matching task identity/path and meaningful plans in both
checkouts, committed main task bytes, and the exact local/upstream Episode head.
Only then may it use Backlog to commit the exact main task path from `In
Progress` to `Blocked`. An accepted unblock repeats the same proof and commits
only that path from `Blocked` to `In Progress`; each main push is best effort and
its failure is returned as evidence after the authoritative local commit.
Unrelated main dirt remains allowed and no Episode-owned content crosses
checkouts.

The existing task handoff then revalidates the committed resumed main state and
continues the same ownership, branch, worktree, and session without a new task,
admission, resource, or assignment. The managed blocked skill is now dual-mode:
it selects durable ownership before prompt text, so active version-2 ownership
forces task mode for the exact owner Conversation even without a task block,
while an Episode/foreign owner or mismatched candidate block fails closed.
Only the absence of version-2 ownership and a task block permits the retained
`.ralph/plans/blocked` restoration workflow. Source and tracked skill bytes plus
managed hashes remain aligned.
Public `/implement-task`, `create_task_episode`, task lifecycle/handoff, and
finalization surfaces remain inactive. `Ready for Merge`, operator outcomes,
task-native close/abandonment, coordinated activation, retained native receipts,
and final migration remain later work. No acceptance criterion is newly
claimed.

Initial focused validation passed 70 Node tests and 32 host-safe Python checks
with 3 container cases deselected, plus `git diff --check`. Independent review
then found that a discoverable owner-Conversation invocation without a task block
could incorrectly enter retained folder mode. The accepted repair added the
deterministic ownership-first resolver described above and a behavioral
owner-versus-Episode routing fixture. Repair-focused validation passed 71 Node
tests and the same 32 Python checks. Final broad validation passed 144 Node
tests and 55 host-safe Python checks with 45 container cases deselected, plus
`git diff --check`. Repair rereview found no material defects. Source-mode
`scripts/test-tier1.sh --probe` passed with immutable-image, offline-RPC,
teardown, and manifest evidence at
`.test-results/20261013T112716Z-81931-e0b2a21c/tier1`.

#### Slice 4 progress — inactive Ready-for-Merge integration handshake (2026-10-13)

Staged the final-review handshake without registering a public task-native
surface or implementing operator outcomes. From an accepted exact pushed
candidate, only the exact persisted top-level owner in canonical primary
`main` may publish `Ready for Merge`. The status mutation reuses the existing
ownership and candidate guards, commits only the clean exact task path, and
returns best-effort push failure as evidence after the authoritative local
commit. A supported task-view snapshot binds the accepted task path, parent,
and all Episode-owned fields; lifecycle status, volatile update time, and derived readiness,
dependency-graph, subtask, and acceptance-count projections are excluded from
its digest while their owning supported fields remain bound.

The same active durable Episode must be clean and idle at its exact recorded
worktree/session. It integrates current main without handoff, admission, or
resource creation. Merge conflicts outside the exact task abort. Within the
Episode worktree, the accepted task is restored from the Episode parent and
Backlog reapplies only `Ready for Merge`; the content digest and parent must
remain exact. The resulting commit must have exactly the accepted candidate and
current main as its parents, and its branch is pushed. Conversation verification
then requires main not to have advanced, the exact refreshed local/upstream
head, clean state, both parents and ancestry, unchanged task content/path/parent,
and `Ready for Merge` in both checkouts. Until that succeeds, policy forbids
calling the candidate ready or requesting merge authorization. Ordinary handoff
continues to reject `Ready for Merge`.

The handshake remains deliberately inactive. Delay, requested changes, merge,
`Done`, abandonment, finalization, cleanup, coordinated activation, retained
native receipts, and migration remain later work. No acceptance criterion is
newly claimed; AC #8/#9 still require retained end-to-end and refreshed-candidate
evidence.

Focused validation passed 80 Node tests and 18 host-safe Python checks with 3
container cases deselected, plus `git diff --check`. Final broad validation
passed 153 Node tests and 59 host-safe Python checks with 45 container cases
deselected, plus `git diff --check`. Independent review found no material
defects. Source-mode `scripts/test-tier1.sh --probe` passed with immutable-image,
offline-RPC, teardown, and manifest evidence at
`.test-results/20261013T115543Z-40109-e5bf6466/tier1`.

#### Slice 5 progress — inactive reversible operator outcomes (2026-10-13)

Staged only Delay and Request Changes behind the unregistered task-native review
boundary. Delay takes an explicit operator decision, re-verifies the exact
Ready-for-Merge publication/integration/verification evidence and current idle
Episode, then returns `delayed` without status mutation, merge, push, handoff, or
other transport. It retains main `Ready for Merge`, the exact refreshed
candidate, ownership, branch, worktree, session, and resources; it is never
abandonment.

Request Changes also requires an explicit operator decision and the still-current
verified handshake. Its phases are deliberately separate. The publication phase
commits only the exact main task back to `In Progress` with best-effort push.
The integration phase requires that returned commit, the same active clean idle
Episode and exact previous refreshed upstream head; it merges current main,
restores Episode-owned content, applies only `In Progress` through Backlog,
preserves the content digest/path/parent, creates an exact two-parent commit, and
pushes it. Verification requires current main, exact local/upstream head,
parents/ancestry, task content/hierarchy, and status. Only the resume phase then
calls canonical task handoff. This separation permits retrying integration after
a bounded failure without repeating the status transition or creating an
admission, resource, assignment, branch, worktree, session, or journal.

No merge authorization, merge, `Done`, abandonment, finalization, cleanup,
public activation, or migration mechanic is included. Initial focused
validation passed 76 Node tests and 11 host-safe Python checks. Independent
review found one material retry defect after a merge commit whose Episode push
failed. The accepted repair recognizes only an exact clean existing two-parent
candidate, retries or confirms only its idempotent push, and never repeats the
status transition, merge, admission, resource, or assignment. Repair-focused
validation passed 78 Node tests and 4 policy checks; rereview found no material
defects. Final broad validation passed 163 Node tests and 59 host-safe Python
checks with 45 container cases deselected, plus `git diff --check`. Source-mode
`scripts/test-tier1.sh --probe` passed with immutable-image, offline-RPC,
teardown, and manifest evidence at
`.test-results/20261013T122422Z-16240-2b8e093d/tier1`. No acceptance criterion is
newly claimed; AC #8/#9 still require retained end-to-end, refreshed-candidate,
and operator-outcome receipts.

#### Slice 6 progress — inactive exact Merge and `Done` publication (2026-10-13)

Staged the terminal accepted-candidate outcome without registering a public
surface or merging this live Episode. `mergeTaskEpisodeReadyForMerge` requires
an explicit operator Merge decision bound to the still-current exact task,
verified canonical-main head, and pushed refreshed candidate. It revalidates the
exact owner, active ownership, idle durable Episode and Orca identity, candidate
status/content/path/parent, two-parent ancestry, the Ready publication commit in
verified main history, clean canonical primary `main`, and exact upstream state.
It then fast-forwards only to that candidate; there is no force, rebase, or
substitute merge. Backlog immediately changes only the exact task to `Done`, the
resulting one-path commit must directly parent the candidate, and final checks
prove merged code, task digest/path/parent/status, and retained ownership,
branch, worktree, durable session, and resources. The verified local `Done`
commit is authoritative; push, upstream lookup, or observed-remote mismatch is
returned as best-effort transport evidence.

The journal-free replay boundary accepts only four exact states: original main
plus `Ready for Merge`, the candidate plus `Ready for Merge`, that candidate
with only the bound task dirty or staged as exact `Done`, or one exact task-only
`Done` child. It completes the missing fast-forward, task commit, verification,
or push without duplicating lifecycle mutation. Extra paths, rename/delete or
untracked state, wrong task status/content/hierarchy, stale ancestry, stale
main, or unpushed candidate fail closed. Production porcelain parsing uses raw
NUL-delimited Git output so leading status columns remain intact; a disposable
repository test covers clean, unstaged, staged, mixed staged/unstaged, extra,
untracked, and renamed states.

Independent review found four material defects across successive passes:
post-fast-forward replay, post-`Done` transport verification, the dirty/staged
mutation window plus missing Ready-publication ancestry, and production raw-Git
parsing. Each finding was accepted and repaired with focused recovery and
negative tests. Final rereview found no material defects. Focused validation
passed 101 Node tests and 4 policy checks. Final broad validation passed 186
Node tests and 59 host-safe Python checks with 45 container cases deselected,
plus `git diff --check`. Source-mode `scripts/test-tier1.sh --probe` passed with
immutable-image, offline-RPC, teardown, and manifest evidence at
`.test-results/20261013T130723Z-39269-445a6588/tier1`.

No actual merge or live `Done` transition was performed. No abandonment,
finalization, cleanup, public activation, or migration mechanic is included. No
acceptance criterion is newly claimed; AC #8/#9 still require retained
end-to-end, refreshed-candidate, and operator-outcome receipts.

#### Slice 7 progress — inactive confirmed abandonment (2026-10-13)

Staged the explicit non-success terminal outcome without registering a public
tool or abandoning this live Episode. `abandonTaskEpisode` requires explicit
operator confirmation bound to the exact active owner, project-relative task
path, canonical-main head and captured non-`Done` status, pushed idle Episode
head, candidate/main relationship, invariant parent, Episode-content digest,
and normalized truthful Final Summary. Canonical main/upstream and the Episode
head/upstream must remain exact. Before any main mutation, active and completed
Backlog task records are resolved through supported structured task view and
checked for inbound dependencies or exact task references whose archive cleanup
would rewrite another task. Comparison follows Backlog task-ID identity for
case, optional dependency prefixes, required reference prefixes, dotted numeric
segments, leading zeroes, and surrounding whitespace.

Git selects only the exact Episode task blob; Episode code is never integrated.
Supported Backlog edit reapplies the captured Conversation lifecycle status and
Final Summary. Structured semantic checks and a normalized task-file digest
prove that every Episode-owned field is retained while excluding only path,
lifecycle/update metadata, and the Conversation-owned abandonment summary.
After creating the otherwise-untracked canonical `backlog/archive/tasks`
directory, the supported Backlog archive command moves the task without `Done`.
The effective worktree state must be exactly the active deletion and archive
addition/staged rename; a direct two-path child is committed and verified.
Archived tasks are intentionally not resolvable through `task view`, so
post-archive verification uses the regular archived file, normalized digest,
exact Git paths/parent, clean worktree, and unchanged active ownership/resources
rather than inventing archived-task resolution. Local verified archival state is
authoritative; push or remote-verification failure is returned as transport
evidence. Journal-free replay accepts only exact task preparation, archive
move/stage, or direct archival child and rejects stale, dirty, ambiguous,
mismatched, and cross-path states. Cleanup remains separately authorized.

Actual vendored-CLI fixtures prove missing-directory behavior, archive
visibility semantics, exact byte movement, active dependency and completed
reference preflight, and alias spellings `PRIMECLAW-01`, `primeclaw-1`, and
whitespace-normalized references. A real Git fixture proves task-only blob
selection and archival commit while Episode code remains absent. Independent
review found five material defects across its passes: impossible archived-task
lookup, missing archive directory, path-sensitive digest, inbound-link cleanup,
and alias identity mismatch. All were accepted and repaired; final rereview
found no material findings. Focused validation passed 118 Node tests and 4
policy checks. Final broad validation passed 203 Node tests and 59 host-safe
Python checks with 45 container cases deselected, plus `git diff --check`.
Source-mode Docker Tier-1 passed with immutable-image, offline-RPC, teardown, and
manifest evidence at `.test-results/20261013T140634Z-37005-1a3b77c9/tier1`.

An accepted in-scope follow-up revision remains for the next execute pass. Before
any canonical-main task restore, Backlog edit, or archive mutation, compute the
exact archive destination and fail closed when it already exists from tracked
history. Backlog deliberately reuses archived IDs, and a same-ID/same-title
archive currently succeeds by replacing the historical file, leaving active
`D` plus archive `M` only after mutation. Preserve the already-authorized exact
task-preparation, archive-move/stage, and committed-child recovery states, where
the destination is expected as part of the partial state. Add a clean-Git real
vendored-CLI regression proving collision rejection occurs before mutation,
historical archive bytes remain exact, the active task remains present, and
main remains clean. Keep the repair inside Prime Claw; do not patch Backlog or
add recovery machinery.

The accepted follow-up is now implemented. `TaskEpisodeAbandonmentGit` exposes
an exact tracked-path-at-ref query. The CLI adapter reads raw NUL-delimited
`git ls-tree -z --name-only` output so Git path quoting cannot hide Unicode
archive names. `abandonTaskEpisode` computes the canonical destination and
rejects it when tracked at the bound main head before cleanup preflight, main
state classification, task selection, Backlog edit, or archive. Checking the
bound head preserves the authorized preparation, move/stage, and direct-child
recovery states because their destination was absent from that history.

The real vendored-CLI clean-Git regression archives `PRIMECLAW-1`, commits the
historical bytes, reuses the ID with the same Unicode title `Reusable Café`,
commits the active task, and proves the production guard rejects with historical
bytes unchanged, the active task present, and main clean. Unit evidence proves
the check precedes every mutation and collision runs no select/edit/archive or
commit action. Independent review identified one material `core.quotePath`
Unicode bypass in the initial implementation; raw `-z` parsing repaired it and
final rereview found no material findings. Final validation passed 119 focused
Node tests and 4 policy checks, 204 broad Node tests and 59 host-safe Python
checks with 45 container cases deselected, `git diff --check`, and source-mode
Docker Tier-1 with immutable-image, offline-RPC, teardown, and manifest evidence
at `.test-results/20261013T143741Z-33220-7f0043db/tier1`.

No actual abandonment, status change, archive, finalization, cleanup, public
activation, or migration occurred. No acceptance criterion is newly claimed;
AC #8/#9 still require retained end-to-end and operator-outcome receipts.

#### Slice 8 progress — inactive task-native finalization and cleanup (2026-10-13)

Implemented the internal `finalizeTaskEpisodeCleanup` coordinator without
registering a task-native tool or host cleanup adapter. A separate explicit
Cleanup decision binds the exact task/path, owner Conversation, terminal Episode
head/outcome/commit, durable session and route, worktree/branch, and every
optional local or Orca resource. Before deletion it re-verifies canonical main
and upstream plus either the pushed one-task Merge/`Done` child or the pushed
non-`Done` Abandon/archive child. Abandonment results now retain the verified
archived-file digest for this terminal proof.

Resource inspection accepts only the exact monotonic states: all present,
runtime absent, worktree absent, or all absent. The injected host adapter removes
only the exact idle runtime, worktree, and branch in that order, verifying each
boundary; exact worktree removal may also remove its exact branch. Ownership
remains active across interrupted removal and changes to inactive only after all
resources are absent. Exact prefix retry and inactive replay are idempotent.
Busy, dirty, foreign, mixed-outcome, unpushed, identity-drifted, unsafe-gap,
provisioning, and uncertain states fail closed.

Independent review found two material defects. First, cleanup incorrectly bound
the terminal branch head to the stale allocation-time ownership head; the repair
binds the explicit terminal Episode head, proves it descends from the owned
admission base while resources exist, and uses it for branch/worktree identity.
Second, all-absent abandonment replay required the deliberately deleted Episode
ref; the repair skips only that no-longer-possible ancestry check at stage 3
while retaining all canonical-main terminal proofs. Final rereview found no
material findings.

Final validation passed 132 focused task-native Node tests, 4 retained close
tests, and 4 oversight policy checks; 217 broad Node tests and 59 host-safe
Python checks with 45 container cases deselected; `git diff --check`; and
source-mode Docker Tier-1 with immutable-image, offline-RPC, teardown, and
manifest evidence at `.test-results/20261013T153144Z-87272-78cdefce/tier1`.

No actual finalization, resource deletion, abandonment, merge, status change,
public activation, host-adapter registration, migration, or acceptance-criterion
claim occurred. The live Episode ownership and resources remain unchanged.

The operator accepted checkpoint
`e3266cafb426c291579c6206c5e987e466d4e160`, including the complete inactive
task-native lifecycle mechanics through finalization and cleanup. The next
bounded execute pass is the already-approved coherent task-native public
activation plus its required host cleanup adapter. Preserve retained folder
compatibility until final migration/cutover, exact task/Episode ownership,
operator authority for merge, abandonment, and destructive cleanup, supported
Prime Agent and Backlog interfaces, Docker-only plugin validation, and no
unrelated scope.

#### Slice 9 progress — public task-native activation and production cleanup host (2026-10-13)

Activated the complete guarded task-native surface beside retained folder
compatibility: `/implement-task`, `create_task_episode`,
`handoff_task_episode`, and the single `finalize_task_episode` lifecycle
coordinator. Creation consumes one exact post-preparation approval and its bound
placement once. Ordinary handoff remains disjoint from blocker, final-review,
operator-outcome, abandonment, and cleanup boundaries.

The lifecycle coordinator exposes Block, Resume, Accept Candidate, Delay,
Request Changes, Merge, Abandon, and Cleanup without exposing internal phase
ordering. It returns exact publication, integration, Ready, changes, and
terminal receipts; exact partial receipts resume completed phases without
repeating lifecycle mutations. Delay and Request Changes require explicit
operator decisions, as do Merge and Abandon. Cleanup requires a separate
explicit decision and exact Merge or Abandon terminal evidence. Integration
push errors replay only the existing merge head, unpushed abandonment reuses
its original decision, and admitted or uncertain handoff transport is never
reported as retryable.

Added the production cleanup adapter over supported Prime Agent daemon, Orca
CLI, and Git interfaces. It rejects foreign/duplicate sessions, route/file/CWD
drift, untracked saved-session files, dirty or changed worktrees, moved branch
heads, unsafe resource gaps, malformed/unavailable inventory, and later Orca
terminals. Task-native Orca activation now inventories every retained terminal,
including its fallback/default and primary Prime terminals. Cleanup deletes the
exact idle Prime session first, then uses exact non-force Orca worktree removal
so Orca must prove all bound PTYs stopped; local cleanup rechecks path, head,
branch, and cleanliness at each mutation edge. The owned daemon connection is
closed after every action.

Independent architecture and cleanup reviews found material retry, authority,
session-collision, mutation-edge, daemon-lifetime, and normal Orca-topology
defects. Every finding was repaired and both final rereviews reported no
material findings. Retained `/plan-spec`, `/implement-spec`, `plan_spec`,
`create_spec_episode`, `handoff_spec_episode`, and `finalize_spec_episode`
remain active until explicit final migration/cutover.

Final validation passed 181 focused Node lifecycle/cleanup checks and 4 focused
oversight-policy checks; 228 broad Node tests and 59 host-safe Python checks
with 45 container cases deselected; `git diff --check`; and source-mode Docker
Tier-1 with immutable-image, offline-RPC, teardown, and manifest evidence at
`.test-results/20261013T164613Z-92027-eedd4a14/tier1`.

No live Episode lifecycle transition, merge, abandonment, finalization, cleanup,
resource deletion, plugin activation, migration, or cutover occurred. The task
remains `In Progress`, live ownership/resources are unchanged, and no acceptance
criterion is newly claimed; the recorded real-session receipt gaps remain open.

#### Slice 10 progress — exact managed-asset retirement rehearsal (2026-10-13)

Re-audited ordered step 4 after public task-native activation. The task-native
planning and implementation workflows are already installed beside retained
folder compatibility. Exactly four managed project assets remain coupled to
that compatibility path: `project-workflow-plan-prep`,
`project-workflow-plan-spec`, `project-workflow-implement-prep`, and
`project-workflow-implement-spec`. Removing any of them from the production
inventory now would break retained `/plan-spec` or `/implement-spec` work, so
production assets and version-1 ownership remain unchanged.

Added an isolated cutover-retirement rehearsal to the project-initialization
suite. It creates a copied plugin generation without exactly those four rows and
source files, then proves a real version-1 active ownership snapshot holds every
compatibility workflow and the retained `.ralph/plans` sentinel byte-for-byte.
After the snapshot is released, the rehearsal proves the three unchanged
managed compatibility files are pruned, one customized compatibility workflow
is preserved and released from manifest ownership, every remaining managed
asset is one of the exact ten task-native/shared assets with source-identical
bytes, and retained plan bytes remain unchanged. A fresh project under the
rehearsed generation receives exactly those ten assets and no `.ralph/plans`
tree.

Independent read-only review reported no material findings. Focused validation
passed all 29 project-initialization Node checks, including a one-test isolated
review rerun. The exact curated broad candidate passed 229 Node checks and 59
host-safe Python checks with 45 container cases deselected, plus `git diff
--check`. Source-mode Docker Tier-1 passed with immutable-image, offline-RPC,
verified-teardown, and published-manifest evidence at
`.test-results/20261013T181209Z-47602-ef7f6389/tier1`.

This is preparation evidence only. No production inventory row, source asset,
project template, command, tool, workflow, ownership record, task, bundle,
status, or `.ralph/plans` content was removed or migrated. Final asset
retirement remains coupled to the explicitly authorized migration/cutover.

#### Accepted next dependency — activation-truth documentation and traceability
reconciliation

The operator accepted pushed checkpoint
`bf1b320e8649f252b6bf3031c0563ded17bffc9f`, including the isolated exact
managed-asset retirement rehearsal. The next execute pass is the explicitly
recorded ordered step-4 documentation prerequisite: make the already-active
task-native lifecycle the primary current architecture and operator path, and
label every retained folder procedure clearly as version-1 compatibility.
Reconcile the current architecture, operator, user-story, and traceability
surfaces identified by the recorded audit while keeping those compatibility
procedures operational and documented.

Do not begin the separate no-`To Do` guidance migration, proof-reference
normalization, task/bundle migration, production asset retirement,
`.ralph/plans` deletion, or final cutover. Preserve exact IDs and parents,
operator authority, supported interfaces, Docker-only plugin validation when
applicable, and the no-unrelated-scope boundary.

#### Slice 11 progress — task-native activation truth and retained version-1
compatibility

Reconciled the current architecture, operator workflow, user-story map, and
traceability matrix with the active runtime. `/plan TASK-ID` followed by
`/implement-task TASK-ID`, exact version-2 task ownership, task-bound execution,
`handoff_task_episode`, and guarded `finalize_task_episode` outcomes are now the
primary current lifecycle. Every retained folder procedure in the approved
surfaces is explicitly labeled version-1 compatibility and remains operational:
`/plan-spec`, `plan_spec`, `/implement-spec`, bundle promotion,
`create_spec_episode`, `handoff_spec_episode`, folder blocking/archival, and the
bookkeeping-only `finalize_spec_episode` close.

The traceability rows for US-11 through US-16 and US-24 now distinguish the two
schemas and their observable behavior. Public task-native admission fails closed
on existing non-terminal ownership; only retained version-1
`create_spec_episode` may return its matching Episode. Primary task-native
recovery rolls a proven-clean pre-ownership/resource failure back to `In
Planning`, publishes `Blocked` after recorded/partial/uncertain mutation, and
never duplicates resources. Retained version-1 partial provisioning/allocation
persists exact `uncertain` ownership and cannot replay fresh. Task-native
terminal review publishes `Ready for Merge`, refreshes the same Episode,
verifies the resulting handshake, and waits for explicit operator authority;
cleanup remains separately confirmed and closes ownership last.

Focused static contracts now bind those authority, replay, recovery, and
compatibility claims to their exact documents and traceability rows. Independent
review found and drove repairs for the public replay overstatement, the collapsed
recovery model, and initially weak bag-of-words assertions; final rereview found
no material findings. Validation passed 31 focused host-safe policy checks with
5 container cases deselected, 229 broad Node checks, 62 curated broad host-safe
Python checks with 45 container cases deselected, and `git diff --check`.

This slice changes documentation and host-safe static tests only. It does not
change plugin source or managed assets, so Docker Tier 1 is not required by the
repository validation policy. It does not begin the separate no-`To Do`
guidance migration, proof-reference normalization, task/bundle migration,
production asset retirement, `.ralph/plans` deletion, or final cutover. Existing
IDs, parents, status, ownership/resources, operator authority, and acceptance
evidence remain unchanged.

#### Accepted revision — correct Episode edit scope and lifecycle-receipt
ownership

The owning Conversation requested an in-scope revision of candidate
`d8507d7dd1a5d2d31354aaeecf6c5bffbbba0575` after Conversation and independent
EXPERT review demonstrated two concrete defects against the already
operator-approved contract. First, `docs/future-specification-bundles.md` must
not say
a task-native Episode edits only bound-task content: it implements approved
code, documentation, and tests in its worktree, exclusively owns the bound
task's content there, and leaves lifecycle status to the Conversation. Second,
`docs/conversation-driven-episode-oversight.md` must not place task-native
lifecycle receipts inside strict version-2 ownership: durable ownership stores
identity and resource bindings, while `finalize_task_episode` actions return
exact lifecycle receipts that the owning Conversation retains for later outcomes
and retries. Add focused static assertions for both distinctions.

Revise only those two claims and focused tests, then validate, independently
rereview, commit, push, report, and stop. Preserve every other accepted
activation-truth, retained version-1 compatibility, replay/recovery,
terminal-authority, cleanup, exclusion, task identity/parent/status/acceptance,
and no-unrelated-scope boundary. Do not begin no-`To Do` guidance migration,
proof normalization, task/bundle migration, production retirement,
`.ralph/plans` deletion, or final cutover.

#### Slice 12 progress — correct Episode edit scope and lifecycle-receipt
ownership

Repaired the two accepted documentation defects in candidate
`d8507d7dd1a5d2d31354aaeecf6c5bffbbba0575`.
`docs/future-specification-bundles.md` now states that a task-native Episode
implements approved code, documentation, and tests in its isolated worktree,
exclusively owns the bound task's content there, and leaves lifecycle status on
main to the Conversation. `docs/conversation-driven-episode-oversight.md` now
keeps strict ownership to lifecycle state plus durable owner, authority,
placement, and resource bindings. Ready, phased-progress, and terminal action
receipts are returned by `finalize_task_episode` and retained by the owning
Conversation for later authorized outcomes or bounded retries; they are not
ownership fields or event-journal entries.

A focused static contract protects every part of both distinctions and rejects
the former false claims. Independent read-only rereview reported no material
findings. Validation passed 32 focused host-safe policy tests with 5 container
cases deselected, 63 curated broad host-safe Python tests with 45 container
cases deselected, 218 broad Node tests, and `git diff --check`.

This repair changes only the two approved documentation files, one focused
static test, and durable task/plan evidence. It changes no plugin source or
managed asset, so Docker Tier 1 is not required. All other task-native-primary,
retained version-1 compatibility, replay/recovery, terminal-authority, cleanup,
exclusion, task identity/parent/status/acceptance, and no-unrelated-scope
behavior remains unchanged. The separate no-`To Do` guidance migration, proof
normalization, task/bundle migration, production retirement, `.ralph/plans`
deletion, and final cutover remain unstarted and unauthorized.

#### Accepted next dependency — retire active `To Do` guidance

The owning Conversation accepted pushed checkpoint
`1ef3ce44cc0c5e6855a591af0e612bf8f2dc024c`. The next execute pass must
implement only the next already-approved ordered step-4 prerequisite: re-audit
and remove active guidance that creates or selects `To Do`, including the
operator/project guidance and source/project `prepare` or backlog surfaces named
by the approved plan. Replace it with truthful task-native lifecycle guidance
that uses supported Backlog CLI behavior.

Keep all still-unmigrated tasks and the transitional configuration intact for
the later one-time migration. Do not migrate task statuses or bundles and do not
remove `To Do` from final configuration in this slice. Preserve retained
version-1 compatibility and all accepted activation, recovery, authority,
cleanup, and exclusion behavior. Keep proof-reference normalization,
requirements-inventory deletion gating, production asset retirement,
`.ralph/plans` deletion, and final cutover separate. If managed plugin source
changes, run the required Docker-isolated candidate validation. Independently
review the bounded candidate, commit, push, report, and stop.

#### Slice 13 progress — retire active `To Do` guidance

Re-audited the named operator, project, source/project `prepare`, Backlog, and
current-documentation surfaces. Five active surfaces still selected `To Do`:
`AGENTS.md`, `README.md`, `.agents/skills/prepare/SKILL.md`,
`.agents/skills/backlog/SKILL.md`, and `docs/backlog.md`. The project Backlog
skill and Backlog documentation also had creation examples that omitted status
and therefore inherited the transitional default. The generic source `prepare`
template was already tracker-neutral and required no change.

Replaced those active selection paths with the supported repeatable-status
`In Design` plus `In Planning` discovery command. New ordinary task examples
now pass `--status "In Design"` explicitly. Removed generic claim, completion,
and archive examples that bypassed the accepted task-native phase and
Conversation authority, and replaced them with truthful `/design` or
`/spec-it-out`, `/plan TASK-ID`, `/implement-task TASK-ID`, and owning
Conversation lifecycle guidance. Focused static coverage protects the named
operator/project/source surfaces, explicit authoring status, generic source
`prepare` behavior, and the absence of an active `To Do` selector.

The supported CLI accepted the repeated-status list command and returned a
versioned `task-list`. Focused validation passed 18 host-safe tests with 8
container cases deselected. The curated broad candidate passed 229 Node tests
and 68 host-safe Python tests with 45 container cases deselected, plus
`git diff --check`. Independent read-only review reported no material defects.
No managed plugin source changed, so Docker Tier 1 is not required by repository
policy.

The still-unmigrated tasks and transitional `backlog/config.yml` remain intact;
`To Do` is still the temporary configured default/selectable migration state.
No task status, bundle, production asset, retained version-1 compatibility,
accepted activation/recovery/authority behavior, or acceptance criterion
changed. Proof-reference normalization, requirements-inventory deletion
gating, production asset retirement, `.ralph/plans` deletion, and final cutover
remain separate.

#### Accepted next dependency — normalize proof references and gate inventory

The owning Conversation accepted pushed checkpoint
`4a40a0832d561e380da32099f07d3ea2195e7e65`. The next execute pass must
implement only the next already-approved ordered step-4 prerequisite: first
re-audit the exact tracked `config/requirements-inventory.json` and every
affected live proof reference, then make all live proof paths deletion-safe and
add or repair the inventory test gate that proves they will survive later
deletion of `.ralph/plans`.

Preserve literal old paths only where they are clearly historical evidence,
reports, completed-task prose, or provenance whose rewriting would falsify
history. Convert live proof authority to durable task references or explicit Git
provenance as the approved plan permits. Keep this to one bounded
proof-normalization and inventory-gating slice.

Do not migrate tasks, statuses, or bundles; do not remove `To Do` from
configuration; do not retire production assets or retained version-1
compatibility; do not delete or move `.ralph/plans`; and do not begin final
cutover. Preserve existing IDs, parents,
lifecycle state, ownership/resources, acceptance criteria, and operator
authority. If managed plugin source changes, run the required Docker-isolated
candidate validation. Validate the relevant inventory and static contracts,
independently review the bounded candidate, commit, push, report, and stop.

#### Slice 14 progress — normalize proof authority and gate deletion

Re-audited the exact tracked `config/requirements-inventory.json` before
editing. It contained 62 scalar references, across 21 distinct strings, to
eight `.ralph/plans` files. Seventeen Phase 2 verdicts incorrectly reused the
current active root plan even though their actual source is the archived Phase
2 runtime plan. Fifteen project-wide-testing rows incorrectly reused the final
Slice 8 archive files for claims from Slices 1–7.

Normalized the 17 Phase 2 verdicts to explicit Git provenance at
`.ralph/plans/archive/phase2-runtime/EXECUTION_PLAN.md @ 4a40a0832d561e380da32099f07d3ea2195e7e65`.
The other still-historical plan sources use the same accepted pre-cutover
checkpoint. The 15 project-wide-testing rows now use their exact durable
Backlog authorities: `PRIMECLAW-20` for the aggregate and `PRIMECLAW-20.1`
through `PRIMECLAW-20.8` for the applicable slice, including every source for
composite claims. The resulting inventory has 47 explicit Git references to six
audited files plus the slice-correct task references; no live proof claim
depends on the working-tree plan path.

Removed the remaining deletion-sensitive current proof links from
`DEVELOPERS.md`, `LONG_RANGE_PLAN.md`, `docker/test.Dockerfile`, the three
`docs/derisk` verdict surfaces, and user-story traceability. Current guidance
now uses canonical docs or durable Backlog tasks. Historical Phase 1 spec and
requirements paths remain truthful as explicit `path @ 4a40a0832d561e380da32099f07d3ea2195e7e65`
provenance. Historical reports, completed-task prose, retained version-1
compatibility behavior, and migration descriptions remain unchanged.

Expanded `tests/test_inventory_integrity.py` to scan every inventory string,
reject any unpinned plan reference, require the exact 47-reference/six-file
audited set and common provenance commit, resolve every Git object, enforce the
15 per-row project-wide-testing task mappings, resolve each task to exactly one
canonical tracked Markdown file, and protect the named current proof surfaces.
Initial independent read-only review found the false Phase 2 and testing-slice
source mappings. Both were repaired; its rereview reported no material findings
in the repaired inventory and gate.

Focused inventory and deletion-safety validation passed 7 tests. The curated broad
host-safe suite passed 653 tests plus 75 subtests, with 1 skip, 67 deselections,
and 12 warnings; `git diff --check` passed. An initial unrestricted host-safe
run also exposed two unrelated static-policy failures already present at the
handoff base: the `test_runtime_connect.py` literal-policy check and the missing
pytest bridge for `task_episode_admission_extension.test.mjs`. Their source and
policy files are unchanged by this slice. No managed plugin source changed, so
Docker Tier 1 is not required by repository policy.

No task identity, status, bundle, `backlog/config.yml`, production asset, plugin source,
retained version-1 compatibility behavior, lifecycle state,
ownership/resource, acceptance criterion, or operator authority changed. No
migration, retirement, plan deletion or movement, final cutover, host-global
apply, or live resource cleanup occurred.

#### Post-review repair — align US-17 Episode scope

Corrected the active US-17 traceability row after review of candidate
`88f66e559b70ab7fb2e2cc22244440674e305415`. It now states the accepted three
scope distinctions: a task-native Episode implements approved code,
documentation, and tests in its isolated worktree; it exclusively owns the
bound task's content there; and lifecycle status remains with the Conversation.
The retained version-1 compatibility clause and durable Backlog evidence
references remain unchanged.

Extended the existing focused Episode-scope contract in
`tests/test_oversee_episode_skill.py` to require all three distinctions on the
active traceability surface, reject the former task-content-only claim, and
preserve the compatibility and evidence clauses. Focused scope plus inventory
validation passed 13 host-safe tests and `git diff --check` passed. No proof
mapping, inventory gate, current-proof normalization, historical/version-1
exclusion, task identity/status/acceptance, plugin source, migration,
configuration/default, asset, plan placement, or cutover behavior changed.

### 2. Bind Episode creation and durable ownership to the exact task

- Refactor `extension-support/spec-episode.ts` around exact `taskId` and
  `taskPath`. Remove bundle hashing, copy/promotion, reserved plan directories,
  and plan-promotion commits while retaining the current Orca/local allocation,
  durable session publication, one fixed execute assignment, route recovery,
  and uncertain-mutation safeguards.
- Replace ownership version 1 plan fields (`sourceLocation`, `slug`,
  `bundleDigest`) in `episode-ownership.ts` with the minimal exact task plus
  existing owner/base/worktree/session identity. Update strict parsing, atomic
  writes, Conversation lookup, idempotent close, and display/branch naming;
  derive a safe branch label from the task ID without making it authority.
- Make the trusted post-readiness creation path verify `In Planning` plus a
  meaningful plan, update the exact main task to `In Progress` through the CLI,
  commit only that path, and create the branch from the resulting SHA. A push is
  prompt and best effort, never the branch-creation gate.
- Define and test the recovery boundary: a failure proven to have created no
  ownership/resource returns main to `In Planning`; any recorded, partial, or
  uncertain mutation publishes `Blocked` with its recovery condition, retains
  evidence/resources, and rejects replay as a fresh creation.
- Inject the exact task ID into the Episode execute prompt. Prove the new
  worktree starts at the status commit and one ownership record continues across
  execute, compaction, handoff, route reopen, and revision passes.

### 3. Convert Episode work and Conversation oversight without changing authority

- Rewrite `execute` so the Episode reloads its bound task and changes only task
  content on its branch: in-scope plan refinements, Implementation Notes,
  acceptance evidence/check state, blocker details, references, and Final
  Summary. It never changes lifecycle status and no longer reads, moves, or
  archives plan files.
- Rewrite `blocked` and `handoff` so blockers and resumable context live in the
  same task. The Episode reports through existing messaging; the Conversation
  publishes `Blocked` or resumed `In Progress` on main with exact task-only
  commits and prompt pushes, then continues the same Episode.
- Update `prime-claw-oversee-episode` and Expert-review artifact language to the
  approved task fields. Keep Expert review read-only and findings bounded by
  the approved contract.
- Implement and test the final-review handshake: the candidate task is complete
  but remains `In Progress`; Conversation acceptance publishes
  `Ready for Merge` on main; the same Episode integrates main and resolves the
  expected task-file divergence by retaining all Episode-owned content plus the
  main-owned status; the Conversation verifies that refreshed candidate before
  asking for merge authority.
- Encode the operator outcomes in guidance and fixtures: delay retains
  `Ready for Merge` and all resources; requested changes publish `In Progress`
  and resume the same Episode; verified merge is followed immediately by the
  exact main task `Done` commit/push; ownership and resources remain until the
  separately authorized finalization/cleanup path.
- Document and test confirmed abandonment without a new tool: bind the exact
  Episode head/task path, snapshot main status and invariant ID/parent metadata,
  select only the Episode task blob, reapply captured status through the CLI,
  verify the effective diff imports only Episode-owned task content and no code,
  add the abandonment Final Summary, archive without `Done`, commit/push the
  exact archival state, verify it, and only then perform authorized cleanup.

### 4. Reconcile managed assets, current documentation, and traceability

- Rename or retire old plan-folder workflow assets in
  `asset-inventory.json`; install task-native project-customizable workflows and
  preserve customized assets through the existing project-initialization
  reconciliation rules. Update the builder project's tracked `.agents` and
  `.prime-claw` copies and `.prime-claw/templates.json` from source inventory;
  do not use the installed user-global plugin.
- Update initialization tests so a current project receives task-native assets
  and no `.ralph/plans` tree. Keep active-Episode snapshot protection and safe
  customized-template behavior unchanged.
- Rewrite current architecture and operator guidance in `AGENTS.md`,
  `README.md`, `VISION.md`, `LONG_RANGE_PLAN.md`, `DEVELOPERS.md`,
  `.agents/skills/backlog/SKILL.md`, the source/project `prepare` guidance, and
  the relevant docs for backlog, preparation/handoff, project initialization,
  Conversation oversight, user stories C–I, story traceability, and the docs
  index. Replace live plan links with task IDs and `backlog task view` guidance.
  The Backlog skill must discover and claim work through the new lifecycle and
  must not retain an active `--status "To Do"` selection path; this does not add
  an ordinary-work plugin command.
- Update `config/requirements-inventory.json` and inventory tests so every live
  proof path survives deletion. Keep literal old paths only in clearly
  historical evidence, reports, completed-task prose, or provenance statements
  where rewriting would falsify history; convert broken live links to task
  references or `path @ pre-cutover commit` provenance.

#### Accepted next dependency — one-time Backlog migration without cutover

The next bounded slice uses
`6d11d9c2797cea54ecd07171e8a5b2019d6ee530` as the exact frozen
pre-cutover provenance tree and performs only the reviewed task and historical
bundle migration in step 5. Inventory every tracked `.ralph/plans` file at that
commit. Apply the table and classification rules exactly through the supported
Backlog CLI: preserve every existing ID and `parent_task_id`; reuse or create
only the named epics; retain `PRIMECLAW-7` as the sole Blocked Phase-3a
replacement with children `.3`–`.6`; preserve both supersession directions;
import source-ordered criteria, content, execution history, terminal outcome,
index evidence, and all source paths truthfully; and call `backlog task
complete` only for explicitly successful historical epics. Classify every
existing `To Do` task by meaningful native plan or stronger recorded evidence,
including the recorded special handling for `PRIMECLAW-10.37` and
`PRIMECLAW-7.6`. Remove `To Do` from final configuration only after proving no
active task still uses it. Put no migrated bundle in `backlog/archive/`.

Use no committed migration script, journal, wrapper, dual-write layer, or
alternate tracker. A bounded temporary helper may only issue supported CLI
operations. Add or repair the approved representative migration validation,
independently review the result, commit, push, and report exact mapping, counts,
and provenance.

This migration slice stops before compatibility retirement and cutover. It does
not retire production or version-1 assets, delete or move any tracked
`.ralph/plans` source, disable retained folder compatibility, perform final
cutover, change `PRIMECLAW-10.38` lifecycle status, or claim terminal
acceptance. Accordingly, step 5's final plan-tree deletion and step 6's
plan-absence/cutover assertions remain deferred until separately authorized.

#### Migration execution blocker — completed-record mutation has no supported CLI path

The bounded migration preflight at clean checkpoint
`5ca6d463efa5433192e3bc7a17894a60293f4738` inventoried all 43 tracked
`.ralph/plans` files at frozen tree
`6d11d9c2797cea54ecd07171e8a5b2019d6ee530` and reconciled 16 present
bundle owners: nine existing tasks and seven new epics. The reviewed
`replace-beads` mapping is a no-op because neither candidate source path exists
in the frozen tree; `PRIMECLAW-35` must remain unchanged.

Execution stopped before any migration mutation remained. Seven required reused
owners — `PRIMECLAW-6`, `PRIMECLAW-10.15`, `PRIMECLAW-10.26`,
`PRIMECLAW-10.28`, `PRIMECLAW-19`, `PRIMECLAW-20`, and
`PRIMECLAW-10.34` — already live under `backlog/completed/`. Supported
`backlog task view --json` resolves them, but the supported `backlog task edit`
interface returns `Task not found` because edits resolve only the active corpus.
The repository-built Backlog implementation explicitly states that a completed
record cannot pass through `updateTask`, and its diagnostics recommend direct
file editing for completed records. Direct task-Markdown edits are forbidden by
this repository and contradict this migration's CLI-only contract. `task
demote` is not a valid escape hatch because it assigns a new draft ID and would
violate immutable task identity.

A temporary create attempt for the seven new epics was fully rolled back; the
working tree returned clean before this blocker record. No existing task,
status, parent, config, bundle, asset, or source plan was changed.

The operator selected the supported-capability unblock. Before broader migration
resumes, implement and validate an upstream-quality Backlog operation that
restores one exact completed record to active task storage without changing its
ID, parent, content, or terminal `Done` status. The normal supported `task edit`
flow may then update that same record, and `task complete` must run only after
all intended edits and validation. Land the capability as its own reviewable
checkpoint; do not combine its acceptance with migration mutation. Keep the
implementation and validation in this Episode, but do not open, prepare, or
pursue an upstream issue or pull request. The owning Conversation may assign
that separate transport only after it accepts the capability candidate. Until
the capability checkpoint is accepted, do not resume the migration, infer a
direct-edit exception, move/delete plan files, or change `PRIMECLAW-10.38`
lifecycle status.

#### Supported completed-task restore capability checkpoint

The operator-selected unblock is implemented as an isolated Backlog capability
candidate. Dependency commit
`5d556c1954f7724abd180f6211cf528e9253ad4c` adds
`backlog task restore <taskId>` as a canonical CLI operation. It resolves one
exact local completed identity, holds its task lock, moves the same file back to
active storage with no-clobber hard-link/unlink semantics, and never parses or
serializes the record. The ID, `parent_task_id`, filename, raw bytes, and
terminal status therefore remain unchanged. The restored record is published
coherently into the active ContentStore corpus; normal `task edit` works, and
`task complete` returns it to completed storage only after intended edits and
validation.

The implementation also makes auto-commit staging transactional. Both sides of
the move are prepared in a temporary Git index and published to the real index
in one `update-index` operation. A staging or commit failure conditionally
restores owned index entries and moves the byte-identical file back; ownership
loss reports explicit partial state instead of inviting a blind retry. Core
forces working-copy-only resolution even when an internal caller omits read
options. Independent review found the earlier partial-staging and caller-locality
defects; both were repaired before this checkpoint.

Validation evidence:

- 125 focused/regression tests passed across restore lifecycle, custom-prefix ID
  resolution, ContentStore transitions, and local command boundaries.
- Restore proof covers byte-for-byte identity/content/parent/status preservation,
  occupied-destination no-clobber behavior, restore → normal edit → complete,
  commit-failure rollback that preserves prior staged work, and staging-failure
  rollback that leaves the real index unchanged.
- `bun run check`, `bun run check:types`, and `bun run build` passed.
- The complete native dependency suite recorded 2,892 passes and 8 skips. Its 13
  unrelated failures were triaged: MCP search, Git timeout, bulk move, and
  ContentStore watcher failures cleared on isolated/sequential rerun; the eight
  TUI move failures/errors reproduce unchanged on the untouched dependency base;
  and the branch-loader mock-count assertion also fails on the untouched base in
  this nested submodule path while passing in an external clean worktree.
- The project host-safe suite recorded 653 passes, 1 skip, 65 deselections, and
  75 subtests; its two failures are the already-recorded unrelated static-policy
  baseline failures.
- `git diff --check` passed, and the built candidate exposes the documented
  `task restore` help contract.

This checkpoint changed no migration record. The seven completed owners remain
under `backlog/completed/`; no historical epic, `To Do` classification, config,
asset, lifecycle status, or plan location changed. The owning Conversation has
accepted and pushed the capability at Backlog dependency
`5d556c1954f7724abd180f6211cf528e9253ad4c` and parent
`817a5936607fcb9493630ad14544c744030ebb40`; both were verified clean,
upstream-equal, and linked exactly.

The next execute pass is approved only for the reviewed one-time task and
historical-bundle migration in Step 5. Restore `PRIMECLAW-6`,
`PRIMECLAW-10.15`, `PRIMECLAW-10.26`, `PRIMECLAW-10.28`, `PRIMECLAW-19`,
`PRIMECLAW-20`, and `PRIMECLAW-10.34` through `backlog task restore`; preserve
each exact ID, parent, filename, bytes/content, and `Done` status through the
restore; make only supported CLI edits; validate; and run `backlog task
complete` only after all intended edits. Reconcile the frozen 43 source paths
into the 16 recorded bundle owners, preserve the approved `PRIMECLAW-7` Phase
3a mapping and bidirectional superseded-history references, and leave
`PRIMECLAW-35` unchanged when its source bundle is absent. Do not perform
upstream outreach, asset retirement, `.ralph/plans` deletion, final cutover,
lifecycle status changes, or unrelated cleanup. Commit and push this bounded
migration candidate, report exact evidence, and stop idle for Conversation
review.

#### Bounded historical-bundle migration candidate — completed

The accepted one-time migration used frozen provenance tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530` and
reconciled its 43 tracked `.ralph/plans` paths into 16 owners. The shared
`.ralph/plans/archive/README.md` is recorded as terminal/status evidence; the
other 42 paths are owned exactly once by the groups below. The reviewed
`replace-beads` source paths are absent, so `PRIMECLAW-35` remains unchanged.

| Bundle group | Source paths | Owner | Status | Storage path | Checked criteria |
|---|---:|---|---|---|---:|
| `active-root` | 2 | `PRIMECLAW-10.38` | `In Progress` | `backlog/tasks/primeclaw-10.38 - Replace-.ralph-plans-with-task-native-Backlog-Ralph-lifecycle.md` | 0/19 |
| `archive/compaction-first-phase-transitions` | 2 | `PRIMECLAW-39` | `Done` | `backlog/completed/primeclaw-39 - Historical-Compaction-first-phase-transitions.md` | 5/5 |
| `archive/conversation-driven-episode-oversight` | 2 | `PRIMECLAW-10.26` | `Done` | `backlog/completed/primeclaw-10.26 - Implement-conversation-driven-episode-oversight-plugin.md` | 13/13 |
| `archive/conversational-ralph-command-routing` | 2 | `PRIMECLAW-38` | `Done` | `backlog/completed/primeclaw-38 - Historical-Conversational-Ralph-command-routing.md` | 9/9 |
| `archive/goal-heartbeat-work-control` | 2 | `PRIMECLAW-10.28` | `Done` | `backlog/completed/primeclaw-10.28 - Implement-plugin-global-goal-and-heartbeat-work-control.md` | 13/13 |
| `archive/handoff-continuation-resilience` | 2 | `PRIMECLAW-10.15` | `Done` | `backlog/completed/primeclaw-10.15 - POC-conversation-owned-episode-for-resilient-conversational-handoff.md` | 9/9 |
| `archive/official-lean-compatibility-cleanup` | 2 | `PRIMECLAW-10.34` | `Done` | `backlog/completed/primeclaw-10.34 - Complete-official-lean-role-protocol-and-remove-compatibility.md` | 20/20 |
| `archive/official-lean-session-protocol` | 2 | `PRIMECLAW-40` | `Done` | `backlog/completed/primeclaw-40 - Historical-Official-lean-session-protocol.md` | 16/16 |
| `archive/phase1-derisk-gate` | 4 | `PRIMECLAW-36` | `Done` | `backlog/completed/primeclaw-36 - Historical-Phase-1-de-risk-gate.md` | 22/22 |
| `archive/phase2-runtime` | 4 | `PRIMECLAW-6` | `Done` | `backlog/completed/primeclaw-6 - Phase-2-sandbox-runtime-foundation-prime-agent-in-OpenShell.md` | 20/20 |
| `archive/phase3a-bufd-superseded-incomplete` | 4 | `PRIMECLAW-41` | `Done` | `backlog/completed/primeclaw-41 - Historical-Superseded-incomplete-Phase-3a-brain-hosting-BUFD.md` | 10/17 |
| `archive/plugin-test-container` | 7 | `PRIMECLAW-19` | `Done` | `backlog/completed/primeclaw-19 - Test-tier-architecture-tier-1-plugin-test-container.md` | 7/7 |
| `archive/project-wide-testing-strategy` | 2 | `PRIMECLAW-20` | `Done` | `backlog/completed/primeclaw-20 - Project-wide-testing-strategy-specification-planning-only.md` | 5/5 |
| `archive/worktree-isolated-specification-episodes` | 2 | `PRIMECLAW-37` | `Done` | `backlog/completed/primeclaw-37 - Historical-Reviewed-future-plans-and-worktree-isolated-specification-episodes.md` | 21/21 |
| `future/delivery-manager-episode-supervision` | 1 | `PRIMECLAW-42` | `In Design` | `backlog/tasks/primeclaw-42 - Design-delivery-manager-episode-supervision.md` | 0/17 |
| `future/phase3a-brain-hosting-completion` | 2 | `PRIMECLAW-7` | `Blocked` | `backlog/tasks/primeclaw-7 - Phase-3-tracer-bullet-end-to-end-working-claw.md` | 0/5 |

Before editing each reused completed owner, `backlog task restore` moved the
exact completed file to active storage without changing its bytes, ID, parent,
filename, or `Done` status. These pre-edit byte receipts were verified after
each restore:

| Owner | Parent | Filename | Bytes | SHA-256 before and immediately after restore |
|---|---|---|---:|---|
| `PRIMECLAW-6` | `null` | `primeclaw-6 - Phase-2-sandbox-runtime-foundation-prime-agent-in-OpenShell.md` | 4758 | `79168c7f1fbd4339c4dafed49b3fdb224d21bc55d7762fca597fe57dd10f33ed` |
| `PRIMECLAW-10.15` | `PRIMECLAW-10` | `primeclaw-10.15 - POC-conversation-owned-episode-for-resilient-conversational-handoff.md` | 34126 | `ae4e0d7ce36ecd75a49134959c4fe1a72271110147938d0b96e5a7606bed7a16` |
| `PRIMECLAW-10.26` | `PRIMECLAW-10` | `primeclaw-10.26 - Implement-conversation-driven-episode-oversight-plugin.md` | 484000 | `f4cf57d8770280b78a51fb4364546e6513b09ddd3d9bb0a0c76c3d3c0721af24` |
| `PRIMECLAW-10.28` | `PRIMECLAW-10` | `primeclaw-10.28 - Implement-plugin-global-goal-and-heartbeat-work-control.md` | 13708 | `81c2822934ceb858f22829ec176ef032ef1c61ee61c3da79cc880560556ce339` |
| `PRIMECLAW-19` | `null` | `primeclaw-19 - Test-tier-architecture-tier-1-plugin-test-container.md` | 42404 | `bc414298280d29e4842ca30d37ee95464d36cab1f0d66b41ae91244d8fca7fed` |
| `PRIMECLAW-20` | `null` | `primeclaw-20 - Project-wide-testing-strategy-specification-planning-only.md` | 3335 | `fecd81ce8f13e7cec1fc1d4945574fe8284772f305bcea629504b50708c250bb` |
| `PRIMECLAW-10.34` | `PRIMECLAW-10` | `primeclaw-10.34 - Complete-official-lean-role-protocol-and-remove-compatibility.md` | 195925 | `ac40110fdb8000115645e12ef1c390464152ff33e3ce0dd34cd02fa210fc1437` |

All task mutations used supported Backlog CLI operations. Each successful
historical owner was validated before `backlog task complete` returned it to
`backlog/completed/`. `PRIMECLAW-41` is intentionally completed-but-partial
with 10/17 source-supported criteria; it links bidirectionally with the sole
live Blocked Phase 3a replacement, `PRIMECLAW-7`. Historical predecessor
`PRIMECLAW-40` links bidirectionally with replacement `PRIMECLAW-10.34`.
`PRIMECLAW-42` remains `In Design`. `PRIMECLAW-10.38` remains `In Progress`
under `PRIMECLAW-10` with 0/19 criteria checked.

Validation evidence:

- an in-memory audit proved the frozen inventory is exactly 43 unique paths,
  the 16 non-index groups map to 16 exact task owners, every source path and
  frozen commit appears in owner provenance, imported specifications,
  requirements, plans, decisions, and nested reviews survive normalized
  Backlog serialization, and the archive index outcome is present for every
  historical bundle;
- identity/storage checks proved the seven restored owners retain their exact
  IDs, parents, filenames, `Done` status, and completed storage after edits;
- hierarchy checks proved `PRIMECLAW-7.3` through `.7.6` retain parent
  `PRIMECLAW-7` and their pre-migration statuses;
- `git diff --quiet 7df23e5c811afbb49ebf877734870730206dcb48 -- <PRIMECLAW-35 path>`
  passed, proving the absent-source no-op;
- `python3 -m pytest tests/test_backlog_workflow.py tests/test_backlog_build.py -q`
  passed: 7 tests.

This candidate does not classify remaining `To Do` work, change configuration
or existing lifecycle statuses, delete or move `.ralph/plans`, retire assets,
perform final cutover, initiate upstream outreach, or do unrelated cleanup.
Those actions remain deferred for separate Conversation authority.

#### Accepted review correction — deferred dogfood criteria remain unchecked

Conversation accepts one material in-scope finding against migration candidate
`2ddd6dc45bbf47665354b6983e930daaa23e8f86`: two completed historical epics
incorrectly marked explicitly deferred manual dogfood criteria as complete.

The next execute pass must repair only that checked-state evidence through
supported Backlog CLI operations:

1. Restore `PRIMECLAW-39`, verify exact ID, parent, filename, bytes, and `Done`
   status through restore, uncheck criteria 1, 2, and 5 while retaining criteria
   3 and 4 checked, validate the truthful 2/5 state, then complete it back to
   its exact completed path.
2. Restore `PRIMECLAW-37`, verify the same identity and storage invariants,
   uncheck deferred Slice 4 criteria 17–21 while retaining criteria 1–16
   checked, validate the truthful 16/21 state, then complete it back to its
   exact completed path.
3. Update only the affected count/evidence claims in `PRIMECLAW-10.38` and this
   execution plan. Re-run the existing focused Backlog checks and `git diff
   --check`, commit and push the exact repair candidate, and stop idle for
   Conversation review.

Do not run new dogfood, change lifecycle status, alter any other mapping or
content, retire assets, delete `.ralph/plans`, perform cutover, or do unrelated
cleanup.

### 5. Perform the one-time task and bundle migration through Backlog CLI

Freeze the committed Episode base SHA as the pre-cutover provenance commit and
inventory tracked files from that tree, not unrelated dirty or untracked files
in another checkout. Do not commit a runtime migration script or journal. Use a
bounded temporary REPL/helper only to issue supported Backlog CLI operations,
then validate the resulting tracked state.

Apply this reviewed mapping; preserve existing task IDs and every existing
`parent_task_id`:

| Legacy bundle | Destination |
|---|---|
| active root `replace-beads` pair, plus any byte-identical `archive/replace-beads` copy present in the bound tree | deduplicate as one bundle; reuse existing epic `PRIMECLAW-35` and record every present source path |
| `archive/phase2-runtime` | reuse `PRIMECLAW-6`, promote type to epic |
| `archive/handoff-continuation-resilience` | reuse `PRIMECLAW-10.15`, promote to epic |
| `archive/conversation-driven-episode-oversight` | reuse `PRIMECLAW-10.26`, promote to epic |
| `archive/goal-heartbeat-work-control` | reuse `PRIMECLAW-10.28`, promote to epic |
| `archive/plugin-test-container` and its review files | reuse existing epic `PRIMECLAW-19` |
| `archive/project-wide-testing-strategy` | reuse `PRIMECLAW-20`, promote to epic |
| `archive/official-lean-compatibility-cleanup` | reuse `PRIMECLAW-10.34`, promote to epic |
| this migration bundle | reuse existing epic `PRIMECLAW-10.38` |
| `archive/phase1-derisk-gate` | create one Done historical epic; reference `PRIMECLAW-1`, `-4`, `-5` |
| `archive/worktree-isolated-specification-episodes` | create one Done historical epic; reference `PRIMECLAW-10.16`–`.18` and plausible predecessor lineage `.5`–`.7` |
| `archive/conversational-ralph-command-routing` | create one Done historical epic; reference `PRIMECLAW-10.22`–`.25` |
| `archive/compaction-first-phase-transitions` | create one Done historical epic; reference `PRIMECLAW-10.30`, `.31`, and separately blocked dogfood `.32` |
| `archive/official-lean-session-protocol` | create one Done historical epic with bidirectional replacement reference to `PRIMECLAW-10.34` |
| `archive/phase3a-bufd-superseded-incomplete` | create one Done completed-but-partial historical epic with evidence-based checked/unchecked criteria and a superseded Final Summary; link it bidirectionally with replacement epic `PRIMECLAW-7` |
| `future/phase3a-brain-hosting-completion` | reuse exact owner `PRIMECLAW-7`, promote it to epic, retain truthful `Blocked`, and reference existing children `.3`, `.4`, `.5`, `.6` without changing their parents |
| `future/delivery-manager-episode-supervision` | create one `In Design` epic; reference superseding role work `PRIMECLAW-10.36` without treating it as owner |

Treat `.ralph/plans/archive/README.md` as shared evidence for every affected
bundle: import its material terminal/status outcome into the corresponding task
and include the index path in provenance rather than silently discarding it.
Account for every tracked file under `.ralph/plans` at the bound pre-cutover
commit as mapped bundle content, shared evidence/provenance, nested review
evidence, or the intentional `PRIMECLAW-10.38` compatibility pointer.

For each bundle, merge specification/requirements into Description and native
acceptance criteria, the execution plan into Implementation Plan, durable
execution history into Implementation Notes, and terminal outcome into Final
Summary. Import true criteria in source order, retain legacy criterion IDs in
text, and set checked state only where source evidence supports it. Record the
pre-cutover commit and every source path; rely on Git history for verbatim
bytes. Add references rather than guessing hierarchy when ownership is not
one-to-one.

Migrate all existing `To Do` tasks after the new statuses are available:
meaningful native plan → `In Planning`; otherwise → `In Design`, unless stronger
recorded evidence establishes another state. Explicitly treat
`PRIMECLAW-10.37` as `Done` because its three implementation children and landed
product evidence are complete. For `PRIMECLAW-7.6`, verify the recorded accepted
candidate/branch at cutover: use `Ready for Merge` only if that exact pending
merge state remains true; otherwise use `Blocked` with the exact recovery
condition rather than pretending it is unstarted. Preserve the existing blocked
Phase 3 tasks. Remove `To Do` from final config only after proving no active task
still uses it.

Move successful historical epics to `backlog/completed/` only through
`backlog task complete`; keep current `Done` work on the active board unless it
is part of this explicit one-time history cleanup. Put no existing bundle in
`backlog/archive/`. Finally import this plan and implementation evidence into
`PRIMECLAW-10.38`, then delete the entire tracked `.ralph/plans` tree.

### 6. Prove the cutover and leave a reviewable candidate

- Add representative disposable-repository fixtures for status migration,
  one-epic-per-bundle mapping, ordered and checked legacy criteria, immutable
  IDs/parents, provenance, completed history, partial/superseded Phase 3a,
  ambiguous references, and absence of soft-deleted legacy work.
- Run focused Node and Python suites for reviewed task planning, Episode
  admission and failure recovery, ownership, multi-pass handoff, blocked/resume,
  final review/integration, delay/change/merge/Done, abandonment, finalization,
  project initialization, inventory, role policy, and user-story traces.
- Run `git diff --check`, the host-safe repository suite, and the required
  Docker-isolated plugin gate (`scripts/test-tier1.sh --probe`; run
  `scripts/test-all.sh` when the environment supports the full accepted gate).
  Never run a user-global candidate apply/check or unwrapped native mutation
  probe.
- Verify task parsing and counts through Backlog CLI; zero live `To Do`; final
  status order/default; all preexisting IDs and parents unchanged; one epic per
  unique bundle; required bidirectional references; no migrated bundle under
  `backlog/archive/`; and no `.ralph/plans` path in the candidate tree.
- Run a final tracked search. No live command, tool, skill, workflow, template,
  test, or current doc may treat `.ralph/plans`, `/plan-spec`,
  `/implement-spec`, `plan_spec`, or plan-folder ownership as authority.
  Remaining literals must be explicitly historical or pre-cutover provenance.
- Update `PRIMECLAW-10.38` on the Episode branch with Implementation Notes,
  acceptance evidence/check state, references, and Final Summary while leaving
  status unchanged. Commit and push reviewable slices. The Episode reports the
  exact candidate for Conversation review; it does not mark status, merge,
  finalize, clean resources, or apply the plugin globally.

## Completion evidence

The candidate is ready for Conversation review only when the task-native flows
work end to end, the migration assertions and required Docker gate pass, the
candidate task contains enough evidence to understand the result, the branch is
clean and pushed, and `.ralph/plans` is absent. The owning Conversation then
uses the `Ready for Merge` integration handshake and asks the operator for the
separate merge decision.
