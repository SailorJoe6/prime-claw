# prime-claw — Vision

> Status: DRAFT — founding vision, written at project initiation.
> Source: a design conversation between Joe and prime-agent, 2026-09-08.
> The *why* behind this vision (decisions + rejected alternatives) is in
> [docs/founding-decisions.md](docs/founding-decisions.md).

## What prime-claw is

prime-claw is a **persistent virtual personal assistant**, built on the
prime-agent harness. It is not a tool and not a loop. It is an always-on
agent hierarchy that mirrors how its operator actually works: one universal mind at the top, long-lived project
contexts, conversation threads that incubate ideas, and Ralph-style build
episodes that spin up when a conversation decides to ship.

prime-claw is a claw for any **thought worker who runs multiple
parallel projects**. It helps that person create by becoming a **factory**
for whatever their work produces — a software factory, a content factory, a
business factory, or anything else that fits its agentic capabilities. The hierarchy below (universal → project →
conversation → episode) is domain-agnostic; "a project" is any long-running
effort with its own context, and "an episode" is any focused burst of
production within it.

prime-claw is the successor to three prior projects, unified and re-based
on prime-agent:

| Prior project | What it contributed | Why it falls short |
|---|---|---|
| **zbrain** | a basic claw built on gbrain + gstack-browser in an always-on container, cron schedules, crude channel scraping | generic chassis; no prime-agent core. (Also a *fork* of upstream gbrain/gstack whose deltas — OpenClaw-only harness support, hard-coded taxonomy, walk-up config — are now largely obsolete upstream.) |
| **ralph-pva** | first-iteration PVA on the zbrain chassis; the "home it can call its own" pattern with a symlinked brain repo | built on the zbrain runtime, not prime-agent |
| **openclaw-setup** / **nemo-setup** | the sandboxing blueprint: NemoClaw orchestration → OpenShell security boundary → agent in a Docker sandbox, with the apply/check/validate/test engineering discipline and requirements traceability | orchestrates OpenClaw/Hermes, not prime-agent |

prime-claw keeps the sandboxing discipline and the PVA ambition, and
replaces the harness at the heart with prime-agent.

## Why prime-agent

Claude Code and Codex CLI are good, valid harnesses — and yesterday's news
for this purpose. prime-agent is genuinely different in ways that make the
hierarchy below possible natively rather than approximated:

- **Daemon-managed sessions.** All sessions live under the prime-agent
  daemon. A "long-lived conversation thread" is a real, resumable,
  observable, messageable session — not a metaphor. A thread can go quiet
  for weeks and come back.
- **CWD-aware spawn.** A session inherits a working directory at creation.
  A project's context boundary is made physical: spawn with CWD = the
  project's git folder and its beads, living docs, and repo are in scope by
  construction.
- **A persistent Python REPL as control plane.** State lives in kernel
  variables across turns and across compaction. Files are for sharing and
  durability, not working memory.
- **Targeted compaction.** `compact.run(instructions)` compacts with a
  focus hint, and the REPL survives compaction untouched. This is the
  mechanism that replaces Ralph's "clear context and restart" with
  something surgical.
- **Native recursion.** `rlm()` spawns child agents that return at
  admission. Fan-out/fan-in and episode spawning are first-class.
- **Heartbeats and schedules.** An always-on agent that checks channels and
  kicks off work is native, not a cron job with delusions of grandeur.
- **Continual harness.** Persistent, refinable prompt notes, memories,
  skills, and subagent specs — the agent edits its own operating
  instructions as it learns. Local (session-scoped) by default, global
  (cross-session) on request.

## Relationship to gbrain and gstack

prime-claw's brain is **gbrain**, and its web-scraping layer is **gstack
browse** — consumed from **upstream**, not from zbrain's forks.

- **gbrain.** prime-agent is the **mode-(a) harness-as-controller**: the claw
  that owns, drives, and maintains the gbrain (its CLI, database, collection
  channels, and signal sweep). gbrain also supports a **mode-(b)
  agent-as-participant** relationship (an agent connects to an existing brain
  over MCP to be informed); prime-claw prioritizes (a) but supports both.
  Because no upstream harness adapter exists for prime-agent yet, prime-claw
  intends to **contribute one upstream** — forking gbrain only to author the
  PR, then retiring the fork once it merges. This makes prime-claw a
  participant in the gbrain ecosystem, not merely a consumer of a fork.
- **gstack browse.** Web scraping reuses the host-side gstack browse plus the
  container **proxy-shim / host-bridge** pair (a zbrain-local invention, never
  upstreamed) that keeps credentials out of the container. prime-claw ports
  that shim against stock upstream gstack browse.

These choices are validated by a de-risk spike before Phase 3 commits to them
(see LONG_RANGE_PLAN.md Phase 3 / Slice-0).

## The hierarchy

prime-claw is organized as four nested tiers. Each tier has a natural home
in prime-agent and a natural scope of concern.

```
OPERATOR (a thought worker running many parallel projects)
  └── UNIVERSAL AGENT — always on, gbrain-equipped, knows the whole universe
        └── PROJECT CONTEXT — one per project (git folder + beads + gbrain source)
              └── CONVERSATION — a long-lived thread inside a project
                    └── EPISODE — a Ralph-style build loop, spawned on demand
```

- **Universal agent.** Top of the hierarchy. Always on. Has gbrain (the
  universal/default source) and knows of every project. Never implements.
  Reaches out to check incoming channels on a schedule, manages the canonical
  checkouts that physically anchor project contexts, and plans and executes on
  extremely long-horizon tasks.
- **Project context.** One per project. Physical form: the canonical/default-
  branch checkout of a git-tracked project in the universal agent's runtime
  home, with its own beads issues, documentation, and registered gbrain source.
  The boundary between the universal agent and a project is "a
  github/gitlab-tracked project folder."
- **Conversation.** A long-lived prime-agent session whose CWD is the
  project's canonical checkout. Conversational context clarity comes from CWD
  scoping. A project can have many sibling conversations, each focused on one
  aspect of the project. Some conversations stay pure brainstorm for weeks.
  When work becomes concrete, the conversation develops its specification and
  execution plan under `.ralph/plans/future/`, with separate operator review of
  each, before implementation resources are allocated.
- **Episode.** A temporary prime-agent session, logically owned by the project
  conversation that created it, with its own feature branch and git worktree.
  It begins only after the operator explicitly promotes an approved
  specification-and-plan bundle. The episode runs Ralph-style execute → handoff
  iterations, holds invocation-tier state in its own REPL, updates the project's
  living docs, stays available through the PR and review lifecycle, and is
  reaped after merge or explicit abandonment.

### Communication channels map onto the hierarchy

The hierarchy uses real, well-known UX primitives. Two confirmed mappings:

- **Telegram:** each *group* is one project (correlated to its own git
  folder, beads, docs, gbrain source). Each *conversation* in the group is
  a separate agent session started with the project root as CWD.
- **Slack:** each *channel* is a project. Each *top-level comment* in the
  channel is a new conversation thread in prime-agent; responses appear in
  Slack conversation threading.

These are confirmations of the hierarchy using familiar primitives, not
load-bearing implementation details. The channel layer is swappable.

## The three-horizon context model

The central design primitive. Different kinds of context have different
optimal storage, and the mistake of both naive-Ralph (everything in files)
and naive-prime-agent (everything in the REPL/context) is collapsing them
into one tier. prime-claw assigns storage per horizon:

| Horizon | Timescale | Where truth lives | Mechanism |
|---|---|---|---|
| **Sweet-spot** | within one iteration | tight context window | targeted compaction with focus hints |
| **Invocation** | one episode | episode agent's REPL | persists through compaction, dies with episode |
| **Product lifetime** | months/years | living project docs (requirements + design-decision lineage) + gbrain source | durable records; every future episode is past-design-aware |

The durable product-lifetime records are critical feedforward: they ensure
all requirements are covered by regression tests and all future design
decisions are past-design-aware. This is the pattern already proven in
openclaw-setup's `requirements-inventory.json` +
`requirements-traceability.md` discipline, generalized to the whole product
lifetime.

The REPL's ability to keep state live through compaction — *or not* — is a
real flexibility gain: it lets prime-claw be selective about what earns a
place in living docs, targeting exactly these three horizons.

A companion design doc, [docs/information-architecture.md](docs/information-architecture.md),
governs the orthogonal question: when something becomes durable, *which
store* owns it (brain vs. docs vs. harness vs. beads vs. reports). Horizons
govern context lifetime; the information architecture governs durable-store
routing.

## The conversation → episode transition

The boundary begins when the operator invokes `/design` or `/spec-it-out`
inside a project conversation. `/design` is for work that still needs
requirements discovery; `/spec-it-out` is for work whose design is already
substantially present in the conversation. Their exact questions and artifacts
remain project-customizable Markdown under `.ralph/skills/`.

Both workflows write their output into a new named folder under
`.ralph/plans/future/`, link the resulting artifacts, and ask the operator to
review them. They do not allocate an episode. The operator may request as many
specification revisions as needed.

When the specification is ready for planning, the operator invokes
`/plan .ralph/plans/future/<slug>`. Native command code validates and passes the
folder to the project-customizable plan skill. Planning output remains in the
same future folder, and the project conversation again stops for operator
review. Specification approval authorizes planning; it does not authorize
implementation.

Only the explicit
`/implement-spec .ralph/plans/future/<slug>` command crosses the episode
boundary. Its customizable skill verifies that the project-required
specification and planning material is ready. Trusted host mechanics then create
a feature branch and isolated worktree, promote the approved folder contents to
the active `.ralph/plans/` location inside that worktree only, carry the active
conversation into a durable worktree-rooted episode session, and record the
originating conversation as logical owner. The episode starts the customizable
execute workflow; specification and planning do not repeat inside it.

The episode remains available through bounded execute/handoff iterations,
implementation, PR review, updates, and rebasing. Archiving its completed active
plans is the episode's claim that it is ready for owner review; the owning
conversation verifies the work, decides whether to merge or abandon, and reaps
the session and worktree only after that terminal disposition.

The hard problem at this boundary remains *what context crosses*: too little
and the episode is past-design-blind; too much and the context-rot problem is
recreated one level up. This is learned by doing, not designed in advance.
Automated orchestration remains last, after the manually driven boundary is
validated.


## The handoff → compaction insight

Today's Ralph handoff writes docs for an amnesiac successor. In prime-claw,
handoff becomes: **update the living docs, then compact with a focus hint
that says what the next iteration needs.** The compaction summary stops
being the LLM's guess and becomes the handoff author's deliberate curation.
This directly addresses the stale-decision problem of auto-compaction.

## Runtime home

The claw's runtime home is a Docker container where the prime-agent daemon
has full control of its own `$HOME` — free to `cd` into any child folder
and launch agents with their CWD scoped appropriately, free to run amok
without wreaking chaos on the underlying system. The NVIDIA OpenShell
sandbox (via NemoClaw) is the proven blueprint for this security boundary:
deny-by-default egress, credentials injected at L7 and never touching
sandbox disk, no host socket/home/network/PID/IPC exposure.

The contents of that home are a deliberate product surface, not an implicit
copy of the operator's host home. In particular, a sandboxed claw cannot assume
that host-global Prime Agent skills exist inside it. The eventual runtime must
preserve clear conceptual boundaries between capabilities shipped by
prime-claw, capabilities selected or developed by an operator for their claw,
and skills carried by an individual project. Making those capabilities
available and durable across convergence or recreation must remain explicit,
reproducible, and compatible with the credential-isolation boundary.

The general packaging, conflict, compatibility, and persistence model remains
intentionally unresolved. Manual use should supply evidence rather than freezing
a general skill-pack mechanism prematurely. The Ralph workflow now has one
narrow placement decision for that manual proof: during the host-side POC the
universal-agent emulator installs the prime-claw plugin project-locally before
launching a project conversation; the final sandbox copies that plugin from the
builder project into Prime Agent's global plugin location. In both stages, each
managed project keeps its own `.ralph/plans/` and customizable
`.ralph/skills/` tree, which the universal agent initializes from templates and
asks the operator to verify when required files are missing.

## The builder repo

**This repository is the builder repo** — the scripts, docs, plans, and
tooling used to construct and iterate on the prime-claw sandboxed setup.
It is analogous to openclaw-setup and nemo-setup. It is not the claw
itself; the claw's runtime home is the product this repo builds.

## What prime-claw explicitly is not

- Not an enhancement to Ralph. Ralph becomes the episode discipline inside
  prime-claw, not the thing itself.
- Not a port of OpenClaw or Hermes. Those harnesses are the prior
  generation; prime-claw is built on prime-agent because prime-agent is
  uniquely suited to the hierarchy.
- Not (yet) an automated loop. Manual-first: build the phase skills, drive
  them by hand, codify the loop only after the manual path is validated.
