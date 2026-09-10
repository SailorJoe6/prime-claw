# Founding Decisions

> Status: FOUNDING RECORD — captures not just *what* was decided at prime-claw's
> inception but *why*, including the alternatives that were considered and
> rejected. Written at the close of the original ideation session so that any
> future session (or reader) inherits the reasoning, not just the conclusions.
>
> This doc is the durable store for the session's decisions. The raw
> conversation transcript is preserved separately (see "Original session" at
> the end).

## Origin

prime-claw was ideated and launched in a single long prime-agent conversation
on 2026-09-08 (transcript spans to 2026-09-10). The session began rooted in
the Ralph repo (`~/.local/share/ralph`) — where the operator and the agent
were discussing Ralph's design→plan→execute loops — and grew into the decision
to build something new. The repo `~/code/prime-claw` was created mid-session,
the work moved there, and the session was re-rooted.

## The decision to build something new

The conversation started as "how might we use Ralph loops in the context of
prime-agent." It became a new project when the operator concluded that
prime-agent is genuinely different from Claude Code / Codex CLI ("yesterday's
news" by comparison) and is the first substrate where the intended hierarchy
works natively rather than approximately.

**prime-claw is its own project, not a Ralph enhancement.** Ralph becomes the
*episode discipline* inside prime-claw, not the thing itself.

### Positioning (a deliberate correction)

Early drafts framed prime-claw as a "persistent personal **engineering org**."
The operator corrected this to **persistent virtual personal assistant (PVA)**,
and then widened the audience: outward-facing, prime-claw is a claw for **any
thought worker who runs multiple parallel projects**, becoming a **factory**
for whatever their work produces — software, content, business, anything that
fits its agentic capabilities.

Two lessons were recorded about the docs themselves:

- **Outward-facing means general, not self-describing.** The docs must read as
  a general-purpose product for anyone, *without* narrating that they are
  outward-facing and without leaning on the original operator as the example.
  Generalize the substance; don't add the label.
- **Internal/historical docs keep accurate attribution.** Lineage docs and
  provenance lines still name the operator where that is historical record,
  not product framing.

## The hierarchy

prime-claw is a four-tier agent hierarchy:

```
OPERATOR (a thought worker running many parallel projects)
  └── UNIVERSAL AGENT — always on, gbrain-equipped, knows the whole universe
        └── PROJECT CONTEXT — one per project (git folder + beads + gbrain source)
              └── CONVERSATION — a long-lived thread inside a project
                    └── EPISODE — a Ralph-style build loop, spawned on demand
```

Key reasoning:

- The **universal agent** is always on, has gbrain (universal/default source),
  knows of every project, and never implements. It exists to plan and execute
  extremely long-horizon work and to check incoming channels on a schedule.
- The hierarchy was initially under-modeled as two tiers; the operator corrected
  it. The distinctive feature is that a **conversation** is a long-lived tier
  in its own right (mirroring how the operator runs OpenClaw: Telegram groups =
  projects, threads = long-lived conversations), and an **episode** is a
  temporary discipline a conversation can *enter and exit*, not a tool you
  invoke once.
- Communication channels map onto the hierarchy with familiar UX primitives
  (Telegram groups/threads, Slack channels/top-level comments). The channel
  layer is swappable; the hierarchy is the invariant.

## The three-horizon context model

The central design primitive. Different kinds of context have different
optimal storage, and the mistake of both naive-Ralph (everything in files) and
naive-prime-agent (everything in the REPL/context) is collapsing them into one
tier.

| Horizon | Timescale | Where truth lives | Mechanism |
|---|---|---|---|
| Sweet-spot | within one iteration | tight context window | targeted compaction with focus hints |
| Invocation | one episode | episode agent's REPL | persists through compaction, dies with episode |
| Product lifetime | months/years | living docs (requirements + decision lineage) + gbrain source | durable records; every future episode is past-design-aware |

### Reasoning that shaped it (from the operator's critique)

- **Auto-compaction is not ideal.** It burns context until the window is nearly
  full, then compacts — so most long-run work happens in the degraded "context
  rot" region. Ralph's per-iteration context clear pins every iteration to the
  sweet spot. Target: well-timed, *focused* compaction as the replacement for
  Ralph's clear-and-restart.
- **Compaction summaries can carry stale decisions** because an LLM decides
  what survives. Ralph's answer is a living document maintained *outside* the
  context window: update the doc, clear, re-read. The handoff→compaction
  insight (below) is prime-claw's answer.
- **The REPL-persisting-through-compaction is a real flexibility gain** — it
  lets prime-claw be *selective* about what earns living-doc status, targeting
  exactly the three horizons. This cuts both ways: it is a core primitive to
  build from, and a reason to be deliberate rather than default-persistent.

### The handoff → compaction insight

Ralph's handoff writes docs for an amnesiac successor. In prime-claw, handoff
becomes: **update the living docs, then compact with a focus hint** saying
what the next iteration needs. The compaction summary stops being the LLM's
guess and becomes the handoff author's deliberate curation — directly
addressing the stale-decision problem. The imported `handoff` skill already
does this.

## The information architecture (routing across many stores)

Distinct from the brain's internal schema, the IA is the **routing layer** that
answers: when the agent learns something durable, *which store owns it?*

The full treatment is [docs/information-architecture.md](information-architecture.md).
The founding decisions embedded in it:

- **There are two routing tables at two levels of abstraction.** High-level
  (store selection: brain vs. docs vs. harness vs. beads vs. reports) is
  generalizable and belongs in this repo. Low-level (entity schema *inside*
  the brain) is the operator's own gbrain hierarchy and must **NOT** be encoded
  here — every operator builds their own. Encoding one operator's taxonomy into
  a general tool would repeat the "engineering org" framing mistake at the
  data layer.
- **Six routing principles** were adopted: exactly one canonical authority per
  fact; stores typed by kind of truth (non-overlapping); recall-before-write;
  proposal-first with a receipt; the report guard (synthesized outputs never
  re-enter as knowledge); scoped + deferred harness writes.
- **Mnemosyne is an open candidate store**, gated on a test: a new store earns
  a place only if you can name the class of durable fact whose canonical home
  is that store and no other. Otherwise it fragments the knowledge base.
- **The binding prime-claw routing table is deliberately deferred** until
  manual driving reveals what episodes actually produce. The ralph-pva table
  is a reference instance, not the contract.

## The build order (risk-ordered slices)

The first long-range plan was myopically focused on the Ralph skills. It was
rewritten around the proven nemo-setup / openclaw-setup slice shape: each slice
delivers a working, verifiable capability and retires named risk, in strict
dependency order, de-risk gate first, highest-risk integration early.

Order rationale (operator's words): *"run skills manually, codify last" is
about how to orchestrate the loops — but first we need somewhere to run them.*
So **runtime precedes episode work.**

1. De-risk gate (may halt/pivot): prime-agent-in-OpenShell; gbrain source
   isolation; clean episode spawn/reap around the RLM race.
2. Sandbox runtime foundation (prime-agent daemon secured inside OpenShell).
3. Tracer bullet: end-to-end working claw (sandboxed prime-agent + gbrain +
   routing layer persists a fact). Highest risk, done early, thin but whole.
4. The episode loop (Ralph inheritance), manual-first, on the proven runtime.
5. Communication channels.
6. The orchestrator (universal agent), LAST.

## Manual-first, codify-last

A recurring operator principle, applied throughout: build the phase skills,
drive them by hand across real work, let the REPL-vs-living-doc lines emerge
from felt friction, and codify the automated loop only after the manual path
is validated. This mirrors how Ralph itself was built (skills first, then the
loop). Do not over-engineer the orchestration up front.

### Corollary: the RLM spawn protocol may be unnecessary

The safe two-message RLM spawn protocol (spawn with a harmless bootstrap, then
send the real task) exists because of a plugin that auto-injected `/prepare`
into every spawned session, racing the real task. If episodes are driven
manually, a spawned episode may simply start with an instruction like "run the
prepare skill, then do X." Decide from evidence, not up front.

## prime-agent's relevant capabilities (and honest limits)

Discussed candidly during ideation; recorded so future design doesn't
over-claim:

- **Native and load-bearing:** daemon-managed sessions (resumable, observable,
  messageable — a long-lived thread is real); CWD-aware spawn (project
  boundary made physical); persistent Python REPL (survives compaction);
  targeted compaction (`compact.run(instructions)`); native recursion
  (`rlm()`); heartbeats/schedules; the continual harness (`refine`, local by
  default, global on request).
- **Conceded as not unique:** fan-out/fan-in subagents (every harness has
  them); skills-as-modules vs. skills-as-CLIs (a modest edge, and it cuts both
  ways in a loop that *clears* state between iterations).
- **Corrected over-claim:** gbrain access is the operator's provision, not a
  prime-agent capability — any harness pointed at the same MCP servers gets it.

## Sandboxing and security posture

The runtime home is a Docker container where the prime-agent daemon owns its
`$HOME` and can run amok without endangering the host. The NVIDIA OpenShell
sandbox (via NemoClaw) is the proven blueprint: deny-by-default egress,
credentials injected at L7 (never touching sandbox disk), no host socket/home/
network/PID/IPC. Credential isolation is a hard rule: never access macOS
Keychain or browser credential stores.

## Lineage

prime-claw synthesizes four prior projects (see docs/lineage/):

- **zbrain** — the always-on claw chassis (gbrain + gstack-browser + cron +
  channel scraping); contributed per-project brains with no cross-contamination.
- **ralph-pva** — the first-iteration PVA and the "home it can call its own"
  pattern (symlinked brain repo, progressive disclosure); also the source of
  the seven imported phase skills and the memorize-skill routing architecture.
- **nemo-setup** — the NemoClaw/OpenShell sandboxing blueprint (Hermes agent,
  L7 credential injection) and the slice-based build order.
- **openclaw-setup** — the furthest-developed builder repo; the
  apply/check/validate/test discipline, requirements traceability, the Telegram
  channel decision, and the documented prime-agent RLM race workaround.

prime-claw keeps the sandboxing discipline and the PVA ambition, and puts
prime-agent at the core.

## The builder repo vs. the claw

This repository is the **builder repo** — scripts, docs, plans, tooling to
construct the prime-claw sandbox. It is not the claw itself; the claw's runtime
home is the product this repo builds. (The interior design of that home —
which folders, how the brain links in — is a deferred secondary concern.)

## Facts captured for operational continuity

- **Remote:** `git@github-sailorjoe6:SailorJoe6/prime-claw.git`. The
  `github-sailorjoe6` SSH host alias selects the personal key; bare
  `github.com` maps to the work (JLandersZen) key, which is why the first push
  bounced. prime-claw lives on **GitHub**, not GitLab (unlike several prior
  forks).
- **gbrain source:** `prime-claw` is registered as an isolated source (searched
  only when explicitly named) — the correct project-source scoping.
- **Skills exposure:** `.agents/skills/<phase>` symlinks to
  `../../.ralph/skills/<phase>`; `.ralph/skills/` is the single source of
  truth. All seven phases are symlinked (including `blocked`).
- **Session CWD is a spawn-time binding.** `os.chdir` moves the kernel's
  working directory but does NOT re-point the harness's skill-resolution root;
  `/reload` re-reads from the original spawn root. A session rooted in one
  project keeps loading that project's skills. (This is why continuing in a
  *new* session rooted at prime-claw is the clean path.)

## Original session

This project was ideated and launched in the prime-agent session named
**prime-claw** (session id `01a08280-3390-77da-b221-eb109497e65d`).

Transcript: `~/.prime/agent/sessions/01a08280-3390-77da-b221-eb109497e65d.jsonl`

The transcript persists on disk (append-only JSONL) but is NOT auto-loaded into
new sessions' context. It is the authoritative record of the reasoning,
rejected alternatives, and dead-ends behind this doc. Future sessions should
treat this Founding Decisions doc as the curated summary, and consult the
transcript only when the *why* here is insufficiently specific.
