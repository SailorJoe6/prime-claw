# Execution Plan — Reviewed future plans and worktree-isolated implementation episodes

> **Status:** implementation complete and ready for archive.
> **Current progress:** Slices 1–3 are complete after owner-review revision. On 2026-09-21 the owner explicitly deferred Slice 4 end-to-end dogfooding to a separate future episode; this episode did not plan, modify, or promote any dogfood bundle and created no additional branch, worktree, or session.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Original planning location:**
> `.ralph/plans/future/worktree-isolated-specification-episodes/`

## 1. Delivery strategy

Deliver the workflow in four vertical slices. Each slice must leave a complete,
testable capability rather than only scaffolding. Each implementation iteration
ends with focused tests, relevant documentation, a commit on the episode branch,
and a push when a remote exists.

The slices preserve the central boundary from the specification:

- project-customizable Markdown decides questions, artifacts, semantic readiness,
  planning behavior, and execution behavior;
- deterministic extension code validates paths, loads canonical Markdown, and
  performs branch/worktree/session mechanics;
- specification review and plan review remain separate operator gates;
- once the command exists, no episode is created until `/implement-spec` is
  explicitly invoked.

### One-time bootstrap for this specification

This feature cannot invoke `/implement-spec` to create the episode that
implements `/implement-spec`, because the command does not exist yet. After the
operator approves this plan, the project conversation therefore performs one
explicitly authorized manual bootstrap:

1. commit and push the reviewed future bundle plus its approved `VISION.md` and
   `LONG_RANGE_PLAN.md` alignment in the canonical checkout;
2. create one implementation branch and sibling worktree from that commit;
3. promote this folder's contents to active `.ralph/plans/` on that branch and
   commit the promotion;
4. fork the complete project conversation into a durable session rooted in that
   worktree; and
5. deliver the canonical execute skill as its first substantive task.

This bootstrap mirrors the intended transition but does not introduce temporary
product code or a second implementation path. It requires explicit operator
approval before creating the branch, worktree, or episode. After Slice 3 lands,
Slice 4 dogfoods the real native command on a separate reviewed future bundle;
the command is not claimed to have created its own implementation episode.

## 2. Current-state audit

The repository currently provides:

- canonical Ralph skills under `.ralph/skills/`;
- `.agents/skills/{design,spec-it-out,plan,execute}` symlinks to those canonical
  skills;
- a native `/handoff` implementation in
  `.prime/agent/extensions/handoff-chain.ts`;
- Node tests with a mocked Prime Agent `ExtensionAPI` in
  `tests/handoff_chain_extension.test.mjs`;
- a Python bridge and real offline RPC command-loading smoke test in
  `tests/test_handoff_chain_extension.py`;
- prior Phase 1 evidence that Prime Agent's daemon create/kill channel supports
  sessions rooted at an explicit CWD; and
- no surviving native `/plan`, `/implement-spec`, or episode-transition code.

The current design, spec-it-out, and plan Markdown still assumes active files at
`.ralph/plans/SPECIFICATION.md` and `.ralph/plans/EXECUTION_PLAN.md`. The current
`.agents/skills/plan` symlink still exposes `/skill:plan`. These are the first
observable gaps.

The current `VISION.md` and `LONG_RANGE_PLAN.md` edits already describe the new
two-review workflow, but remain draft changes until this plan is approved and
implemented.

## 3. Stable implementation choices

These choices apply across the slices:

1. **Canonical skill loading.** Native commands read `.ralph/skills/<phase>/SKILL.md`
   at invocation time. They do not embed a duplicate prompt.
2. **Future-folder arguments.** `/plan` and `/implement-spec` accept exactly one
   project-relative directory below `.ralph/plans/future/`. Missing arguments,
   absolute paths, traversal, nonexistent paths, and resolved paths outside the
   future root fail before model invocation.
3. **Semantic checks stay in Markdown.** Native code does not require filenames
   such as `SPECIFICATION.md`, `REQUIREMENTS.md`, or `EXECUTION_PLAN.md`.
4. **Folder is the promotion unit.** Episode mechanics copy the approved folder's
   complete contents into active `.ralph/plans/` in the episode worktree. They
   replace the previous active plan set without interpreting document names and
   preserve lifecycle directories such as `future/`, `archive/`, and `blocked/`.
5. **Canonical checkout is preserved.** Promotion removes the selected future
   folder only on the episode branch. The canonical checkout keeps the reviewed
   future bundle until the episode is merged.
6. **Simple identity.** The transition records only the owner session ID, episode
   session ID, slug, branch, worktree, and source folder in ignored local state
   under `.prime/agent/state/`. It does not introduce a transaction journal,
   recovery protocol, quarantine, or general workflow database.
7. **First episode task.** The new episode receives its worktree's canonical
   `.ralph/skills/execute/SKILL.md` directly. This work does not add native
   `/execute`.
8. **No speculative orchestrator.** Conversation-owned monitoring and EXPERT
   review use the separate conversation-oversight design. This feature returns
   the durable episode identity needed by that workflow but does not automate it.

## 4. Slice 1 — Future-folder specification authoring

### Outcome

Both existing authoring skills always produce a reviewable specification bundle
under a newly generated `.ralph/plans/future/<slug>/` folder and never begin
planning or implementation.

### Changes

1. Update `.ralph/skills/design/SKILL.md` while preserving its discovery-first
   interview behavior.
2. Update `.ralph/skills/spec-it-out/SKILL.md` while preserving its
   conversation-first, ask-only-remaining-questions behavior.
3. In both skills, require the LLM to:
   - derive a concise filesystem-safe slug from the work;
   - choose a new future folder without overwriting an existing specification;
   - create every project-required specification artifact inside that folder;
   - avoid newly generated active-plan files at `.ralph/plans/` root;
   - report the exact relative folder path;
   - link every artifact for immediate review;
   - ask the operator to review the saved bundle; and
   - revise the same folder when feedback arrives.
4. Preserve project customizability. The default Prime Claw skills may continue
   to prescribe their preferred documents, but the native workflow must not make
   those filenames universal.
5. Add focused static contract tests, for example
   `tests/test_future_plan_skills.py`, that verify both skills contain the
   mandatory future-folder, path-reporting, review-gate, and no-implementation
   instructions and no longer direct new output to the active root.
6. Finalize the already drafted `VISION.md` and `LONG_RANGE_PLAN.md` changes that
   establish specification authoring and planning as project-conversation work.

### Acceptance

- Invoking either skill in a fixture project results in instructions to create a
  new `.ralph/plans/future/<slug>/` bundle.
- The completion response must identify and link the actual saved files.
- The skills stop at operator review.
- Focused skill-contract tests and `git diff --check` pass.

### Completion evidence

Completed in the first bounded episode iteration. The canonical skills now
create new future folders, keep their artifacts inside those folders, link the
saved files, and stop at operator specification review. Focused contract tests
are in `tests/test_future_plan_skills.py`; operator documentation is in
`docs/future-specification-bundles.md`. The required `VISION.md` and
`LONG_RANGE_PLAN.md` workflow alignment was already present at the episode base
commit and needed no further edit.

### Commit boundary

Commit and push the authoring workflow, its tests, and the aligned vision/roadmap
documentation as one usable capability.

## 5. Slice 2 — Native reviewed planning

### Outcome

The operator can invoke:

```text
/plan .ralph/plans/future/<slug>
```

The native command validates the folder, loads the customizable plan workflow,
and causes planning output to remain in that same folder for a second operator
review.

### Changes

1. Add a project-local extension for Ralph plan commands. Keep shared helpers for
   safe path validation and skill wrapping small and local to this feature.
2. Register native `/plan`.
3. For a valid folder, load `.ralph/skills/plan/SKILL.md` and append the validated
   argument as:

   ```xml
   <operator-plan-location>
   .ralph/plans/future/<slug>
   </operator-plan-location>
   ```

4. For missing or invalid input, emit concise usage and do not call
   `sendUserMessage`.
5. Update `.ralph/skills/plan/SKILL.md` to:
   - consume the operator-plan location;
   - inspect the folder using current project conventions;
   - explain missing or inadequate specification material and stop;
   - create the project-customized execution plan inside the same folder;
   - report and link the produced planning artifacts;
   - ask for operator plan review; and
   - stop without implementation.
6. Remove `.agents/skills/plan` after the native command is covered, leaving one
   `/plan` surface.
7. Add Node extension tests covering registration, canonical Markdown loading,
   exact operator-location wrapping, missing argument, absolute path, traversal,
   resolved symlink escape, nonexistent folder, missing skill, and one-message
   injection.
8. Add a Python bridge that runs the Node suite, asks real offline Prime Agent
   RPC for registered commands, and asserts that the duplicate skill surface is
   absent.
9. Document `/plan` beside `/handoff`, including the customizable-policy versus
   deterministic-loader boundary.

### Acceptance

- Offline RPC reports exactly one project-native `/plan` command.
- Invalid paths never invoke the model.
- A valid future folder injects the current project-local plan Markdown and exact
  validated location once.
- The planning workflow writes to the selected future folder and stops for
  review.
- Focused Node and Python tests pass.

### Completion evidence

Completed in the second bounded episode iteration. The native extension is at
`.prime/agent/extensions/reviewed-plan.ts`; project policy remains in
`.ralph/skills/plan/SKILL.md`; and the duplicate `.agents/skills/plan` surface
is removed. Deterministic command coverage is in
`tests/reviewed_plan_extension.test.mjs`. The Python bridge in
`tests/test_reviewed_plan_extension.py` reruns that suite, checks real offline
Prime Agent RPC registration, verifies the single command surface, and protects
the skill review boundary. Operator documentation is in
`docs/future-specification-bundles.md`.

### Commit boundary

Commit and push the native planning gate, updated plan skill, tests, and command
documentation as one usable capability.

## 6. Slice 3 — Explicit implementation promotion

### Outcome

The operator can invoke:

```text
/implement-spec .ralph/plans/future/<slug>
```

The LLM applies project-specific readiness policy. If ready, one structured host
capability creates the worktree-rooted episode, promotes the approved bundle on
its branch, starts execute, and returns its identity to the owner conversation.

### Changes

1. Add `.ralph/skills/implement-spec/SKILL.md` with two explicit outcomes:
   - explain deficiencies and stop without resource creation; or
   - call the structured episode-creation capability once with the validated
     future folder.
2. Register native `/implement-spec` in the plan-command extension. Reuse the
   same deterministic path checks and canonical skill loader as `/plan`, but
   append:

   ```xml
   <operator-implementation-location>
   .ralph/plans/future/<slug>
   </operator-implementation-location>
   ```

3. Register a narrowly scoped structured tool such as `create_spec_episode`.
   Accept only the selected future-folder path. Do not accept arbitrary branch,
   worktree, prompt, or command strings from the model.
4. At the start of this slice, characterize the exact Prime Agent 0.9.5 session
   and daemon APIs needed to preserve the active conversation and publish a
   sibling session. Capture those supported calls in focused tests before
   combining them with Git mutations. Prefer public extension/session APIs; use
   the already proven daemon client channel only where no public extension API
   exists.
5. Implement the transition using small injectable adapters for Git, filesystem,
   session fork/publication, and first-task delivery so the behavior can be
   tested in temporary repositories without touching real project worktrees.
6. Derive stable names from the folder slug:
   - branch: `episode/<slug>`;
   - sibling worktree: `<parent>/<repo>-<slug>-episode`;
   - session display name: `<slug>-episode`.
7. In order, the capability shall:
   - revalidate the future folder;
   - refuse collisions with an existing different branch, worktree, or episode;
   - create the branch and sibling worktree;
   - replace the worktree's active plan set with the complete approved folder
     contents while preserving plan lifecycle directories;
   - remove that source future folder in the episode worktree only;
   - commit the promotion on the episode branch;
   - fork the complete active conversation context;
   - publish the fork as a durable sibling rooted at the new worktree;
   - store the minimal owner/episode identity record in ignored local state;
   - inject the worktree's canonical execute skill exactly once; and
   - return the episode ID, branch, worktree, and session name to the owner.
8. If the same approved transition is requested again, return the matching
   existing episode identity rather than creating a duplicate. A conflicting
   pre-existing resource produces a clear error. Do not add a general rollback
   or recovery framework.
9. Add focused tests for:
   - missing and invalid command arguments without model invocation;
   - canonical implement-spec Markdown injection;
   - semantic rejection causing no tool call;
   - temporary-repository branch/worktree creation;
   - opaque folder promotion without hard-coded artifact names;
   - canonical future-folder preservation;
   - promotion commit contents;
   - inherited session context and worktree CWD;
   - minimal durable identity contents;
   - exactly-once execute delivery;
   - repeated matching invocation returning the existing identity; and
   - ordinary name collisions failing clearly without deleting resources.
10. Extend the offline RPC smoke test to verify `/implement-spec` and the
    structured tool are registered by the project extension.
11. Add operator documentation for the command, naming scheme, resulting
    identity, and the point at which conversation-owned oversight begins.

### Acceptance

- An inadequate bundle receives a detailed LLM explanation and creates no Git or
  session resources.
- A ready arbitrary bundle is promoted without depending on fixed filenames.
- The canonical checkout retains its future folder.
- The episode branch contains the bundle as active plans and a promotion commit.
- The sibling session inherits the active conversation, uses the episode
  worktree as CWD, and receives execute exactly once.
- The owner receives stable episode identity for subsequent observation and
  handoff.
- Focused unit, temporary-Git, and offline RPC integration tests pass.

### Completion evidence

Completed in the third bounded episode iteration. The native command and
one-turn operator-approval guard are registered by
`.prime/agent/extensions/reviewed-plan.ts`; shared deterministic loading lives
in `reviewed-plan-support.ts`; and the trusted host transition is isolated in
`spec-episode.ts`. Custom readiness policy is in
`.ralph/skills/implement-spec/SKILL.md`.

`tests/reviewed_plan_extension.test.mjs` covers registration, safe command
arguments, canonical policy injection, and approval consumption.
`tests/spec_episode_extension.test.mjs` covers opaque and uncommitted bundle
promotion in temporary Git repositories, lifecycle preservation, promotion
commits, context pairing, stable/active identity, active and inactive replay,
collisions, protocol-7 envelopes, response binding, exactly-once delivery, and
uncertain-mutation preservation. The Python bridge uses installed offline Prime
Agent RPC to prove command/tool registration and performs bounded real
`SessionManager.forkFrom` plus daemon create/state/messages/kill integration.
Operator behavior and recovery safety are documented in
`docs/future-specification-bundles.md`.

Owner-review revision made execute admission durable before delivery with
`pending` / `uncertain` / `delivered` states and replay suppression. It also
made partial Git cleanup observable and preservation-safe, verified a clean new
worktree, and made the promotion marker commit succeed with `--allow-empty` when
the promoted tree already matches `HEAD`. Focused regressions cover uncertain
delivery despite available kill, the post-admission/pre-mark crash window,
independent worktree-removal and branch-deletion failures, and both no-diff and
uncommitted approved bundles.

### Commit boundary

Commit and push the complete explicit promotion boundary, tests, and operator
documentation as one end-to-end capability. Do not land a command that can leave
a deliberately half-created episode as its normal successful outcome.

## 7. Slice 4 — Manual end-to-end dogfood and documentation closure

> **Owner disposition (2026-09-21): DEFERRED OUTSIDE THIS EPISODE.** The owner
> decided that end-to-end dogfooding will start as a separate episode when
> ready. The briefly selected `conversation-driven-episode-oversight` bundle
> remained untouched: it was not planned, modified, or promoted. No additional
> branch, worktree, or episode was created. Bead `prime-claw-h6w.15` records
> this disposition without claiming that the acceptance run occurred.

### Outcome

A real reviewed future bundle traverses the complete workflow and produces a
worktree-rooted episode that completes a bounded implementation slice under its
own execute/handoff loop.

### Changes

1. Run the complete focused automated suite and the normal repository test suite.
2. In the canonical project conversation:
   - create or select a real future specification;
   - review it;
   - invoke native `/plan <future-folder>`;
   - review the in-place execution plan;
   - invoke `/implement-spec <future-folder>`;
   - verify the returned branch, worktree, session, and owner association; and
   - observe the initial execute task.
3. In the episode, complete one bounded implementation iteration and exercise
   native `/handoff` if another iteration is required.
4. Verify that active plans exist only in the episode branch, the canonical
   future bundle remains until merge, and the owner conversation can observe and
   direct the episode using the returned identity.
5. Record concise evidence and any learned constraints in the relevant command
   documentation. Update `VISION.md` or `LONG_RANGE_PLAN.md` only if dogfood
   disproves an assumption.
6. Finish normal review, merge or explicit abandonment, and session/worktree
   cleanup. Do not add automatic orchestration in response to one manual run.

### Acceptance

- The two human review gates are observable in a real workflow.
- No branch, worktree, or episode is created during specification or planning.
- `/implement-spec` alone crosses the implementation boundary.
- The episode starts at execute, remains owner-observable, and can use the
  existing handoff chain.
- Tests, documentation, Git history, and cleanup evidence agree with the actual
  behavior.

### Commit boundary

Commit and push only evidence-backed fixes or documentation learned during the
dogfood run. The dogfood episode itself follows its approved plan and normal
merge decision.

### Owner disposition and episode closure evidence

The dogfood run did not occur in this episode. The owner deferred it to a
separate future episode and accepted closure around Slices 1–3. The candidate
future bundle remained byte-for-byte outside this episode's diff, and no nested
branch, worktree, or session was allocated.

Final archive validation on 2026-09-21 passed:

- `node --experimental-strip-types --test tests/*extension*.test.mjs` — 43/43;
- `pytest -q tests` — 245 passed, 11 existing deprecation warnings; and
- `git diff --check` — clean.

## 8. Validation matrix

Every implementation slice runs its focused checks plus the applicable project
suite. The final acceptance run includes:

```text
node --experimental-strip-types --test tests/*extension*.test.mjs
pytest -q tests

git diff --check
```

If repository test naming makes the Node glob unsuitable, run each checked-in
Node test file explicitly and record the exact commands in the episode plan.
Tests that allocate branches or worktrees must use temporary Git repositories.
They must not create auxiliary resources in the canonical Prime Claw repository.

## 9. Explicit non-goals

This plan does not add:

- fixed universal specification or plan filenames;
- a native `/execute` command;
- automatic semantic approval in TypeScript;
- a general transaction, rollback, crash-recovery, or quarantine subsystem;
- parallel-operator locking or distributed concurrency control;
- automatic EXPERT adjudication or a complete episode orchestrator; or
- branch/worktree allocation before explicit `/implement-spec` approval.

## 10. Review gate

The operator approved this plan and authorized its one-time manual bootstrap.
Each bounded execute iteration still completes only one vertical-slice objective
and returns to the owning project conversation for review before another slice.
