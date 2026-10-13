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

Slice 1 remains open. Public `/plan`/`plan_task`, compatible lifecycle statuses,
task-native authoring, and `/implement-task` are later increments. No acceptance
criterion is checked by these foundations alone.

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
