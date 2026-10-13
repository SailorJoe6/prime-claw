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
