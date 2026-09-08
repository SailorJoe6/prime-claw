# prime-claw — Vision

> Status: DRAFT — founding vision, written at project initiation.
> Source: a design conversation between Joe and prime-agent, 2026-09-08.

## What prime-claw is

prime-claw is a **persistent personal engineering org**, built on the
prime-agent harness. It is not a tool and not a loop. It is an always-on
agent hierarchy that mirrors how its operator (a serial creator of new
things) actually works: one universal mind at the top, long-lived project
contexts, conversation threads that incubate ideas, and Ralph-style build
episodes that spin up when a conversation decides to ship.

prime-claw is the successor to three prior projects, unified and re-based
on prime-agent:

| Prior project | What it contributed | Why it falls short |
|---|---|---|
| **zbrain** | gbrain + gstack-browser in an always-on container, cron schedules, crude channel scraping | generic chassis; no prime-agent core |
| **ralph-pva** | first-iteration PVA on the zbrain chassis; the "home it can call its own" pattern with a symlinked brain repo | built on the zbrain runtime, not prime-agent |
| **openclaw-setup** / **nemo-setup** | the sandboxing blueprint: NemoClaw orchestration → OpenShell security boundary → agent in a Docker sandbox, with the apply/check/validate/test engineering discipline and requirements traceability | orchestrates OpenClaw/Hermes, which are letting Joe down; not prime-agent |

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

## The hierarchy

prime-claw is organized as four nested tiers. Each tier has a natural home
in prime-agent and a natural scope of concern.

```
OPERATOR (Joe — serial creator, many projects at once)
  └── UNIVERSAL AGENT — always on, gbrain-equipped, knows the whole universe
        └── PROJECT CONTEXT — one per software project (git folder + beads + gbrain source)
              └── CONVERSATION — a long-lived thread inside a project
                    └── EPISODE — a Ralph-style build loop, spawned on demand
```

- **Universal agent.** Top of the hierarchy. Always on. Has gbrain (the
  universal/default source) and knows of every project. Never implements.
  Reaches out to check incoming channels on a schedule. Plans and executes
  on extremely long-horizon tasks.
- **Project context.** One per project. Physical form: a git-tracked
  folder, its own beads issues, its own documentation, registered as a
  gbrain source. The boundary between the universal agent and a project is
  "a github/gitlab-tracked project folder."
- **Conversation.** A long-lived prime-agent session whose CWD is the
  project root. Conversational context clarity comes from CWD scoping.
  Within a project, any one conversation further constrains its focus to
  one aspect of the project. Some conversations stay pure brainstorm for
  weeks. Some become builds.
- **Episode.** A short-lived prime-agent child agent that runs a Ralph-style
  design → plan → execute → handoff cycle for one feature, holds
  invocation-tier state in its own REPL, updates the project's living docs,
  and is reaped when done.

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

## The conversation → episode transition

The trigger is well established and inherited from Ralph: **the moment the
operator invokes `/spec-it-out` inside any brainstorming conversation.**

What the episode inherits: the full conversation, within the confines of
the spec-it-out skill. After the specification and planning phases
complete, those living docs constrain the context for execution. Whatever
remains to be figured out will be figured out by manually driving the
skills first. Automated loops are the last thing to build, after the rest
is validated by manual driving.

The hard problem at this boundary is *what context crosses*: too little and
the episode is past-design-blind; too much and the context-rot problem is
recreated one level up. This is learned by doing, not designed in advance.

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

The *contents* of that home (which folders, how the brain links in, daemon
config) are a secondary design concern, deferred until the builder repo
exists and the phase skills are proven.

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
