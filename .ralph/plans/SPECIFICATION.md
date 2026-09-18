# Specification — Worktree-isolated specification episodes

> **Status:** implementation in progress; Slice 1 native commands and trusted
> disposition preflight are implemented under `prime-claw-h6w.2`; real future
> and episode mutation paths remain planned.
> **Beads:** `prime-claw-h6w.1` under Phase 4 epic `prime-claw-h6w`.
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)

## 1. Purpose

Prime Claw needs a concrete conversation-to-episode boundary that permits many
specification-level efforts to proceed concurrently without sharing a checkout.
The project-local `/design` and `/spec-it-out` entry points must preserve their
existing interview workflows, defer infrastructure until the work is fully
understood, and then let the operator either incubate the specification or
promote it into an isolated production episode.

A promoted episode is one durable unit:

```text
specification identity
+ feature branch
+ git worktree
+ worktree-rooted Prime Agent session
+ owning project-conversation identity
+ PR lifecycle
```

The originating `PROJECT_CONVERSATION` remains rooted in the project's
canonical/default-branch checkout and coordinates the episode through review,
merge, and cleanup.

## 2. Current state

- `.agents/skills/design` and `.agents/skills/spec-it-out` expose canonical
  workflow text from `.ralph/skills/` as ordinary Prime Agent skills.
- Invoking either skill keeps work in the current session and writes fixed
  active paths under `.ralph/plans/`.
- Prime Agent project-local TypeScript extensions can register native slash
  commands and inject canonical skill markdown. `handoff-chain.ts` proves this
  pattern for `/handoff`.
- `SessionManager.forkFrom(sourceSessionFile, targetCwd)` can persist a new
  session branch with the complete active source conversation and the worktree
  as its CWD, but does not by itself activate that session in the daemon.
- The daemon `create(sessionPath=...)` operation can activate the persisted fork
  as a durable top-level sibling and returns its runtime identity.
- `rlm.create_session(cwd=...)` can create a fresh durable sibling, but it does
  **not** inherit the source transcript and therefore does not satisfy episode
  conversation inheritance by itself.
- Prime Agent sessions can observe and message sibling top-level sessions.
- Git worktrees provide independent checkout and index state while sharing the
  repository's object database and refs.
- The execute workflow archives completed planning documents, but its current
  prose names only `SPECIFICATION.md` and `EXECUTION_PLAN.md`, not the complete
  specification bundle.

## 3. Target hierarchy and filesystem model

```text
UNIVERSAL_AGENT
  └── PROJECT_CONTEXT — canonical/default-branch checkout
        ├── PROJECT_CONVERSATION A — long-lived session, canonical checkout
        │     ├── EPISODE 1 — branch + worktree + durable sibling session
        │     └── EPISODE 2 — branch + worktree + durable sibling session
        └── PROJECT_CONVERSATION B — long-lived session, canonical checkout
```

In the OpenShell runtime, the expected homes are configurable equivalents of:

```text
/sandbox/projects/<project-slug>                 # canonical checkout
/sandbox/worktrees/<project-slug>/<episode-slug> # episode checkout
```

A worktree is not a new `PROJECT_CONTEXT`; it is the isolated physical home of
one episode within the same project.

## 4. Entry-point workflow

### 4.1 Native commands with canonical workflow text

Project-local extension code shall register native `/design` and
`/spec-it-out` commands. The extension shall load the corresponding canonical
`.ralph/skills/<name>/SKILL.md` rather than duplicate workflow prose.

Once the native commands are proven, the duplicate `.agents/skills/design` and
`.agents/skills/spec-it-out` exposure shall be removed so each workflow has one
operator-facing command, following the precedent established by `/handoff`.

### 4.2 Semantic distinction

- `/design` starts when material requirements discovery and design discussion
  are still needed.
- `/spec-it-out` starts when the conversation already contains most of the
  required design context and only remaining questions or formalization are
  needed.

Both commands converge on the same disposition gate.

### 4.3 Complete interview before disposition

The invoked workflow shall finish the interview first. It shall ask necessary
questions one at a time, resolve all material open questions, and reach a state
where it can write a complete `SPECIFICATION.md`, `REQUIREMENTS.md`, and
`DECISIONS.md` bundle. It must not ask whether to allocate a worktree before
that point.

### 4.4 Disposition gate

When the work is specification-ready, the workflow shall ask the operator to
choose exactly one disposition:

1. **Incubate for later.** Write a named bundle under
   `.ralph/plans/future/<idea-slug>/`; create no branch, worktree, or episode
   session.
2. **Create an episode now.** Allocate the branch, worktree, and durable
   worktree-rooted session, carry the complete active conversation branch into
   it, and write the active specification bundle there.

Cancellation or failure shall not silently choose either disposition.

### 4.5 Multi-turn disposition bridge

Command invocation, interview, and disposition occur across multiple turns. The
native command may inject the canonical workflow text, but the operator's final
disposition answer must cross a stable, explicit bridge into deterministic,
trusted host automation. The model shall invoke that bridge with structured,
validated inputs; it shall not reconstruct or improvise Git, filesystem, session,
or daemon shell commands from workflow prose. The implementation plan may choose
the precise interface—for example, a model-callable capability registered beside
the native command—but it must define one durable contract for both disposition
paths and test that the final multi-turn answer reaches the intended automation
exactly once.

## 5. Future-plan behavior

The future disposition shall create:

```text
.ralph/plans/future/<idea-slug>/
├── SPECIFICATION.md
├── REQUIREMENTS.md
└── DECISIONS.md
```

Future bundles are durable, explicitly non-binding candidates. They remain in
the `PROJECT_CONVERSATION`; they do not allocate episode resources. A later
promotion path must be able to use a future bundle plus its complete applicable
conversation branch as input to the same episode-creation mechanism.

Because multiple project conversations share the canonical checkout, the trusted
future-write path shall acquire a project-scoped mutation lock before inspecting
or changing it. Under that lock it shall detect unrelated dirty state and refuse
to stage or commit another conversation's changes. It shall add only the new
future-bundle paths, commit and push that bundle durably, and leave the canonical
checkout clean on success. If dirty state, a concurrent update, commit failure,
or push/rebase conflict prevents that outcome, it shall report the exact state
and recovery action instead of claiming success or absorbing unrelated changes.

Names must be deterministic, filesystem-safe, and collision-resistant. Existing
future content must not be overwritten without explicit operator approval.

## 6. Episode-creation behavior

For the immediate episode disposition, deterministic automation shall:

1. Verify the source session is a project conversation rooted in a valid Git
   canonical checkout and has a persisted session file.
2. Derive or obtain an operator-approved episode slug and branch name.
3. Verify that neither the target branch nor worktree path would be overwritten.
4. Create the feature branch and durable worktree without using an interactive
   shell prompt.
5. Persist a worktree-rooted fork with
   `SessionManager.forkFrom(sourceSessionFile, worktreePath)`. The fork must
   contain the complete active conversation branch, not a summary or selected
   subset, and record the worktree as its CWD.
6. Activate the persisted fork as a durable top-level sibling through daemon
   `create(sessionPath=<forkedSessionFile>)`. A fresh
   `rlm.create_session(cwd=...)` is not a substitute because it does not inherit
   the transcript.
7. Retain the returned `active_session_id`, stable `session_id`, session name,
   session file, worktree path, branch, source conversation ID, and project
   identity in durable episode metadata.
8. Deliver the task exactly once, accounting for the known automatic-
   preparation admission race. Initial publication and substantive task
   delivery must not be conflated.
9. Have the episode verify its CWD and branch, run `prepare`, and write the
   active specification bundle in its own `.ralph/plans/`.
10. Leave the owning conversation active and able to observe, message, and
    resume coordination with the episode.

Complete active-branch inheritance is the initial acceptance contract and the
behavior proved by this POC. Selective or pre-compacted inheritance may be
explored later only as an explicit refinement with its own requirements and
operator approval; it is not an alternative way to satisfy this specification.

If any step fails, automation must report the exact partial state and either
roll back only resources it created safely or leave an explicit recovery
record. It must never delete an existing branch, worktree, session, or
uncommitted work as generic rollback.

## 7. Episode execution and ownership

The episode owns specification, planning, implementation, tests, documentation,
commits, PR creation, review fixes, and rebasing for its branch. It remains
resumable for the complete PR lifecycle.

The originating project conversation is the logical coordinator. It may:

- retain the episode handle and durable identity;
- inspect bounded sibling status and transcript previews;
- send decisions, review requests, and PR feedback;
- receive progress and completion messages;
- verify merge readiness; and
- decide when to merge, abandon, and clean up.

Logical ownership must not be inferred solely from Prime Agent's runtime family
relationship. It must survive coordinator compaction, kernel restart, and
session resume.

## 8. Completion, archive, and cleanup contract

When implementation is truly complete, the execute workflow shall first ensure
that durable product documentation is current and related beads are closed.
It shall then move the complete active planning set into a unique archive:

```text
.ralph/plans/archive/<episode-slug>/
├── SPECIFICATION.md
├── REQUIREMENTS.md
├── DECISIONS.md
└── EXECUTION_PLAN.md
```

The archive is the episode's machine-checkable claim that it is ready for owner
review, not automatic authorization to merge. The owning conversation shall
verify at least:

- active plan files are absent and the complete archive exists;
- durable documentation reflects the implemented state;
- related beads are closed;
- the worktree is clean and commits are pushed;
- tests and CI pass;
- the PR has no unresolved blocking feedback; and
- the branch is current enough to merge under repository policy.

Only after merge or explicit abandonment may the coordinator retire the episode
session and remove the worktree. Cleanup must not run while the episode still
needs its root, and destructive branch deletion requires the applicable safety
checks.

## 9. Concurrency and shared-state constraints

Worktrees isolate checked-out files and indexes, but episodes still share Git
objects, refs, remotes, and any external project stores. Automation shall use
unique branch/worktree/session identities and rely on Git's normal locking for
Git metadata mutations. Any additional episode registry must use atomic updates
or its own lock.

`PROJECT_CONVERSATION` sessions share the canonical checkout. Their default role
is discussion, incubation, and coordination. Future-plan disposition is the one
specified tracked-file mutation there: it must use the serialized, ownership-
aware commit protocol in §5. Other specification-level tracked-file work must
use an episode.

## 10. Trust and security boundaries

- Branch names, slugs, and paths derived from model or user text must be
  validated; no text may become an unchecked shell fragment or escape the
  configured worktree root.
- Git commands shall use argument arrays or equivalent safe execution, not
  interpolated shell strings.
- Project-local extensions run trusted host code and must fail closed on
  ambiguous repository/session state.
- Worktree creation does not weaken OpenShell credential isolation. No command
  may obtain credentials from Keychain, browser stores, or sandbox disk.
- Existing worktrees and uncommitted changes are never removed automatically as
  error recovery.

## 11. POC evidence and known gap

This specification episode itself is the first manual proof:

- Owning conversation: `PWD in Prime Agent Questions`, session
  `01a0b5fe-e74c-7149-80b9-f328a5b1924f`, rooted at
  `/Users/jlanders/code/prime-claw`.
- Episode: `poc-spec-it-out-episode`, session
  `01a0b638-b392-778e-8c04-c5307740fc42`, active daemon ID
  `a29d878ba19d`.
- Worktree: `/Users/jlanders/code/.prime-worktrees/prime-claw/poc-spec-it-out-episode`.
- Branch: `poc/spec-it-out-worktree-episode`.
- The source session file was forked with
  `SessionManager.forkFrom(sourceSessionFile, worktreePath)`, preserving the
  complete active conversation and changing the persisted CWD to the worktree.
- The fork was activated as a live top-level sibling through daemon
  `create(sessionPath=<forkedSessionFile>)`; the owner then delivered the task
  directly. The episode independently verified its CWD and branch.

The POC proves the desired runtime topology and manual behavior. It also proves
that `rlm.create_session(cwd=...)` is not the inheritance mechanism: that API
creates a fresh sibling without the source transcript. The remaining gap is a
stable extension-facing bridge that composes the proven fork and daemon-create
operations with durable ownership registration and exactly-once task delivery,
including partial-failure recovery. That integration is an implementation item
to resolve and regression-test rather than an assumption to hide.

## 12. Acceptance outcomes

Implementation is accepted when automated tests and one real dogfood run show
that both commands preserve canonical workflow text, complete their interview
before the disposition gate, and cross the explicit multi-turn bridge exactly
once. Future incubation must serialize the shared-checkout write, commit and
push only its bundle, allocate no worktree, and leave a clean checkout on
success. Promotion must fork the complete active conversation branch, activate
an isolated durable coordinator-owned sibling, and remain operable through the
simulated PR lifecycle. Cleanup occurs only after the owner verifies completion.
