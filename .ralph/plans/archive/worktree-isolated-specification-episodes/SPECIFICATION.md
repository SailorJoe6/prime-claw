# Specification — Reviewed future plans and worktree-isolated implementation episodes

> **Status:** accepted implementation complete; archived after Slices 1–3.
> The operator separately reviewed this specification and its execution plan,
> then authorized the documented one-time bootstrap into this episode branch.
> On 2026-09-21 the operator accepted Slices 1–3 and deferred the manual
> end-to-end dogfood/cleanup proof to a separate future episode.

## 1. Purpose

Prime Claw shall preserve a strict human approval boundary between defining work
and implementing it. AI-generated specifications and execution plans must not
flow directly into implementation merely because the agent that wrote them
believes they are complete.

The Ralph workflow will span two agent roles:

- the long-lived `PROJECT_CONVERSATION` develops the specification and execution
  plan with the operator, stores them in a future-plan folder, and keeps revising
  them until the operator approves them;
- a temporary worktree-rooted `EPISODE` implements the approved work through
  Ralph execute/handoff iterations and remains available through review, merge,
  or explicit abandonment.

The transition between those roles is an explicit operator command:

```text
/implement-spec .ralph/plans/future/<slug>
```

## 2. Definitions

**PROJECT_CONTEXT** — The project scope represented by its canonical checkout.
Project conversations are rooted in this checkout; episode sessions are rooted
in dedicated worktrees.

**PROJECT_CONVERSATION** — A long-lived Prime Agent session through which the
operator discusses, specifies, plans, approves, and coordinates work for one
project. It remains active while an episode performs implementation.

**Future-plan folder** — A project-customizable collection of specification and
planning artifacts stored under:

```text
.ralph/plans/future/<slug>/
```

The folder is the unit reviewed and later promoted. Prime Claw does not define a
universal set of filenames inside it.

**Active plans location** — The `.ralph/plans/` root in an episode worktree.
Ralph phase skills interpret the project-customized artifacts placed there.

**EPISODE** — A durable Prime Agent sibling session rooted in a dedicated Git
worktree and branch. It implements one operator-approved future-plan folder and
is logically owned by the originating project conversation.

## 3. Ralph customization boundary

Ralph workflow policy remains editable project-local Markdown:

```text
.ralph/skills/design/SKILL.md
.ralph/skills/spec-it-out/SKILL.md
.ralph/skills/plan/SKILL.md
.ralph/skills/execute/SKILL.md
.ralph/skills/handoff/SKILL.md
.ralph/skills/implement-spec/SKILL.md
```

These files may define:

- questions and interview depth;
- artifact names, formats, and contents;
- what constitutes a complete specification or plan;
- planning and execution practices;
- review expectations; and
- completion behavior.

Native extension code must not duplicate this prose or hard-code one project's
artifact names. Its responsibility is limited to stable mechanics such as:

- registering native slash commands;
- validating command syntax and path containment;
- loading the correct project-local skill Markdown;
- passing validated operator arguments into that Markdown;
- creating branches, worktrees, and sessions;
- preserving episode identity and ownership; and
- delivering deterministic phase transitions exactly once.

The existing native `/handoff` command is the reference pattern: code performs
the proven handoff/compaction transition while loading customizable handoff and
execute instructions from `.ralph/skills/`.

## 4. End-to-end workflow

```text
PROJECT_CONVERSATION
  → /design or /spec-it-out
  → draft future-plan folder
  → operator reviews and requests revisions
  → /plan .ralph/plans/future/<slug>
  → execution plan is written into the same future-plan folder
  → operator reviews and requests revisions
  → /implement-spec .ralph/plans/future/<slug>
  → branch + worktree + inherited EPISODE session
  → future-plan contents become active plans inside the worktree only
  → customizable execute workflow begins
  → bounded execute/handoff iterations
  → owner review, merge or abandonment, and cleanup
```

Specification authoring and planning do not allocate episode infrastructure.
Implementation cannot begin until the operator explicitly invokes
`/implement-spec`.

## 5. Specification workflows

The existing `/design` and `/spec-it-out` workflows retain their customizable
semantic distinction:

- `/design` is used when substantial discovery and design discussion remain;
- `/spec-it-out` is used when the conversation already contains most of the
  design and only clarification or formalization remains.

Their canonical Markdown under `.ralph/skills/` shall be updated so that each
workflow:

1. derives a concise, filesystem-safe slug from the work being specified;
2. creates a new `.ralph/plans/future/<slug>/` folder for that specification;
3. writes every artifact produced by that project-customized workflow inside
   that future folder and never writes a newly generated specification artifact
   directly under the active `.ralph/plans/` root;
4. reports the exact future-folder path to the operator;
5. links every produced artifact for immediate operator review;
6. explicitly asks the operator to review the saved specification;
7. applies requested revisions in that same future folder; and
8. stops without creating a branch, worktree, episode, or execution plan.

Creating a future folder is mandatory for both workflows; it is not a disposition
choice. The LLM chooses the slug as part of the customizable workflow rather than
having native code impose a naming scheme. The workflow Markdown, not native
code, defines which artifacts must be created.
The existing `.agents/skills/design` and `.agents/skills/spec-it-out` symlinks
continue to expose their canonical `.ralph/skills/` definitions unless they are
separately promoted to native commands in future work.

## 6. Native `/plan <future-folder>` command

`/plan` shall become a native project-local slash command following the
`/handoff` loader pattern. The duplicate `.agents/skills/plan` exposure shall be
removed after the native command is available.

The command accepts one argument:

```text
/plan .ralph/plans/future/<slug>
```

### 6.1 Deterministic command behavior

The command handler shall:

1. require the folder argument;
2. resolve it relative to the project root;
3. verify that it is contained under `.ralph/plans/future/`;
4. verify that it is an existing directory;
5. load `.ralph/skills/plan/SKILL.md` from the current project; and
6. append the validated folder in a distinct operator-input block before
   injecting the combined prompt exactly once.

A suitable prompt envelope is:

```xml
<operator-plan-location>
.ralph/plans/future/<slug>
</operator-plan-location>
```

If the argument is missing or mechanically invalid, the command stops before
model invocation and shows concise usage:

```text
Usage: /plan .ralph/plans/future/<slug>
```

The handler may list existing future-plan folders. It must not guess which folder
the operator intended.

### 6.2 Customizable plan behavior

The canonical plan Markdown shall be updated to:

1. read the supplied operator-plan location;
2. inspect that folder according to the project's current specification
   conventions;
3. explain to the operator when required or adequate specification material is
   missing;
4. stop without planning when the available material is insufficient;
5. run the project-customized planning workflow when sufficient;
6. write all planning output into the same future-plan folder;
7. link the resulting artifacts for the operator;
8. explicitly ask the operator to review them; and
9. stop without starting implementation.

Native code does not define specification or plan filenames. Invoking `/plan`
means the operator is ready to plan from that folder; it does not authorize
implementation.

## 7. Native `/implement-spec <future-folder>` command

`/implement-spec` is the explicit approval and promotion boundary:

```text
/implement-spec .ralph/plans/future/<slug>
```

Invoking it means the operator approves the project-customized specification and
plan bundle for implementation.

The feature consists of a native command, a customizable
`.ralph/skills/implement-spec/SKILL.md`, and a structured host capability for the
mechanical episode transition.

### 7.1 Deterministic command behavior

The native handler performs the same mechanical argument checks as `/plan`:

- the argument is required;
- the path is relative to the project;
- it remains under `.ralph/plans/future/`; and
- it names an existing directory.

If the argument is absent or invalid, the handler stops before model invocation
and shows:

```text
Usage: /implement-spec .ralph/plans/future/<slug>
```

For a valid folder, the handler loads
`.ralph/skills/implement-spec/SKILL.md`, appends the validated location in a
distinct operator-input block, and injects the combined prompt exactly once:

```xml
<operator-implementation-location>
.ralph/plans/future/<slug>
</operator-implementation-location>
```

### 7.2 Customizable readiness review

The implement-spec Markdown shall instruct the LLM to:

1. inspect the supplied future-plan folder;
2. apply the project's current definition of a complete, internally consistent,
   and implementation-ready specification and plan;
3. give the operator a detailed, useful explanation of missing, contradictory,
   or inadequate material;
4. stop without allocating episode resources when the bundle is not ready; and
5. call the structured episode-creation capability when the bundle is ready.

This keeps semantic readiness policy in customizable Markdown and uses the LLM's
reasoning rather than hard-coded artifact names.

### 7.3 Deterministic episode transition

After semantic readiness succeeds, trusted host code shall:

1. revalidate the approved future-folder location;
2. derive a stable episode slug and feature branch from that folder;
3. create the feature branch and dedicated worktree;
4. move the complete future-folder contents into the active `.ralph/plans/`
   location inside the new worktree only;
5. commit that promotion on the episode branch;
6. fork the complete active project conversation into a durable session rooted
   in the new worktree;
7. activate the fork as a sibling EPISODE;
8. durably associate the episode identity, branch, worktree, and originating
   project conversation;
9. load the episode worktree's customizable
   `.ralph/skills/execute/SKILL.md` and deliver it as the first substantive task
   exactly once; and
10. return enough episode identity to the owning project conversation to begin
    oversight.

The command moves no planning files in the canonical checkout. The canonical
future folder remains present until the episode branch is merged.

## 8. Episode execution and oversight

The EPISODE runs the approved project-customized execute workflow in its own
branch and worktree. It performs bounded work iterations, keeps its active plans
and project records current, and uses the native `/handoff` transition when
another execute iteration is approved.

The originating `PROJECT_CONVERSATION` remains active as logical owner. After
the episode's first task is admitted, it begins the project-configured oversight
workflow. That workflow may include:

- receiving explicit episode progress and completion messages;
- activity-scoped monitoring while admitted episode work is running;
- independent owner review of exact episode output;
- fresh EXPERT review at project-defined gates;
- revision instructions;
- native `/handoff` commands for approved next iterations;
- operator escalation when required;
- merge or abandonment decisions; and
- terminal episode and worktree cleanup.

Oversight policy belongs to the separately incubated
`conversation-driven-episode-oversight` design and project-customizable workflow
text. The worktree/session creation mechanism must expose the identity needed by
that policy but must not hard-code the policy itself.

## 9. Command and policy boundaries

| Concern | Owner |
|---|---|
| Design and specification questions | `.ralph/skills/design/SKILL.md` or `spec-it-out/SKILL.md` |
| Specification artifact names and contents | Project-customizable skill Markdown |
| Planning method and artifacts | `.ralph/skills/plan/SKILL.md` |
| Implementation-readiness checks | `.ralph/skills/implement-spec/SKILL.md` |
| Execution behavior | `.ralph/skills/execute/SKILL.md` |
| Handoff preparation | `.ralph/skills/handoff/SKILL.md` |
| Native command registration and safe argument handling | Project-local extension code |
| Branch, worktree, and session creation | Trusted host capability |
| Episode identity and ownership mechanics | Trusted host capability |
| Oversight and EXPERT policy | Conversation-oversight workflow and project policy |

## 10. Scope

This specification includes:

- updating the canonical design and spec-it-out Markdown for future-folder
  authoring and operator review;
- implementing native `/plan <future-folder>` as a loader for customizable plan
  Markdown;
- updating plan Markdown for future-folder planning and operator review;
- implementing native `/implement-spec <future-folder>`;
- adding customizable implement-spec Markdown;
- implementing the mechanical branch/worktree/session promotion capability;
- activating the approved bundle in the episode worktree only;
- injecting the episode's customizable execute workflow once; and
- returning control and identity to the owning conversation for oversight.

This specification does not standardize project-specific specification or plan
filenames, document schemas, planning methods, execution methods, or EXPERT
review policy.

A native `/execute` loader is not required for this work. The initial episode
execution prompt and the existing `/handoff` chain may load canonical execute
Markdown directly.

## 11. Documentation alignment

Implementation of this specification must update `VISION.md` and
`LONG_RANGE_PLAN.md` to replace the obsolete immediate future-versus-episode
choice with the reviewed two-gate workflow:

```text
specification draft
  → operator specification review
  → future-folder planning
  → operator plan review
  → explicit /implement-spec promotion
  → worktree-rooted execution episode
```

The updated architecture must also state that the overall Ralph workflow spans
the project conversation and episode:

- specification and planning occur in the project conversation;
- implementation and handoff iterations occur in the episode.

## 12. Review gate

The operator completed the specification and plan review gates. Because this
feature implements `/implement-spec` itself, the approved one-time bootstrap in
the execution plan created this worktree-rooted episode. Future bundles must use
the native reviewed transitions once those slices land.
