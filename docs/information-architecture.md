# Information Architecture

> Status: DRAFT — architectural principle captured at initiation; the binding
> prime-claw routing table is intentionally deferred (see "Open: the prime-claw
> routing table" at the end).
> Reference instance: the ralph-pva `memorize` skill
> (`~/gitlab_local/ralph-pva/.agents/skills/memorize/`).

## The problem

An agent that can persist has **too many places to put things**. A claw like
prime-claw juggles several genuinely different stores at once:

- a **brain** (gbrain) holding domain knowledge
- **tracked repository docs** holding shared project/tool knowledge
- the **agent harness** (prime-agent's continual harness, via `refine`)
  holding agent behavior
- **beads** holding issue/task state
- **reports** holding synthesized outputs

and could add more (Mnemosyne is a candidate — see below).

Without routing guidance, an agent does the pathological thing: it dumps
everything into whichever store is most convenient (usually the harness
memory, because it is one function call), and the knowledge base fragments
across silos that each hold a partial, duplicated, contradictory copy. The
information architecture exists to prevent that. Its whole job is to answer
one question:

> When the agent learns something durable, **which store owns it?**

## Two routing tables, two levels of abstraction

There are **two** distinct routing tables, and they belong in different
places. Confusing them is the central design error this document exists to
prevent.

### High-level: store selection (this repo)

Chooses **between** stores: does this durable candidate belong in the brain,
the tracked docs, the harness, beads, or a report? This table is
**generalizable** — it depends on the *shape* of the stores (a brain, a doc
tree, an agent harness, an issue tracker, an output folder), not on the
operator's domain. It is the architecture this repo encodes, and it is what
any thought-worker's claw needs regardless of what it manufactures.

### Low-level: entity schema (NOT this repo)

Once the high-level table routes a candidate to **the brain**, a second
table decides *which entity type* it becomes (a person, a project, a
resource, ...). That is the operator's **own gbrain hierarchy** — customized
to their domain (ralph-pva's is a personal Life OS / GTD-PARA taxonomy).

**The operator's entity schema must NOT be encoded in prime-claw.** Every
operator sets up their own gbrain to their own liking. Encoding one
operator's taxonomy into this repo would bake a single person's domain model
into a tool meant for anyone — the same mistake as framing the product
around one operator. prime-claw specifies *that* a brain is a store and
*how* the high-level router reaches it; it never specifies what lives inside.

## The six routing principles (generalizable)

These hold for any claw, independent of domain or of which stores exist:

1. **Exactly one canonical authority per fact.** Classify authority first;
   choose one canonical destination. Never dual-write a fact to two stores to
   make it "more visible." If a fact canonical in one store must also drive
   behavior in another, the second entry is a narrow *pointer/policy*, and it
   is deleted when the lesson matures into tracked policy.
2. **Stores are typed by the kind of truth they hold, and the types do not
   overlap.** Life/domain truth → brain. Shared project/tool truth → tracked
   docs. Agent behavior → harness. Ephemeral output → reports. Nothing fits →
   beads, reluctantly. No durable value → *do nothing*.
3. **Recall before write, always.** Search the canonical store; classify the
   candidate `new` / `known` / `stale` / `failed`; read the exact match before
   proposing an update. `known` → skip. `stale` → show the exact diff.
   `failed` → do not silently treat as new. This keeps stores free of
   near-duplicates.
4. **Proposal-first, with a receipt.** Extract candidates → classify → recall
   → propose dispositions *without mutating* → obtain approval → apply →
   issue a receipt (`created`/`updated`/`skipped`/`scheduled`/`failed` +
   canonical location + what was verified). Never report a batch as
   successful when only part succeeded.
5. **The report guard.** A synthesized report is an *output*, never a
   knowledge *input*. Never memorize or ingest a report as a whole; persist
   it under `reports/` and route only the independently durable facts out of
   it, citing underlying sources. This stops an agent from poisoning its own
   knowledge base with its own summaries.
6. **Harness writes are scoped and deferred.** Harness refinement defaults to
   local (session) scope; global is reserved for stable cross-session
   behavior or explicitly project-qualified facts. A `scheduled` result is
   deferred acceptance, not persistence — verify on the next turn before
   claiming it applied.

## Reference instance: the ralph-pva high-level routing table

This is the **ralph-pva instantiation** of the store-selection table — a
worked example, *not* prime-claw's binding contract.

| Candidate | Canonical destination |
|---|---|
| User life fact, preference, task, event, person, project, durable artifact | `brain/<entity-type>/` (the brain is authoritative) |
| Raw channel capture awaiting review | `inbox/<channel>/` |
| Human-promoted source awaiting ingest | `brain/sources/<channel>/` |
| Ralph-generated point-in-time synthesis | `reports/<domain>/`; do not memorize wholesale |
| Tool/API knowledge | relevant skill `references/` file |
| System architecture | relevant `docs/` file |
| Stable repository behavior or editing convention | the Prime-visible project instruction/skill location |
| Evidence-backed runtime behavior, reusable procedure, recurring delegation role | Prime continual harness via `refine` |
| Temporary session progress, blocker, coordination state | local continual harness via `refine` |
| Transient operational insight with genuinely no better home | beads, as a last resort |
| No durable value | do nothing |

Note what is *not* in this table: any brain entity type. The table routes
**to** the brain; it does not say what the candidate becomes **inside** it.
That boundary is the whole point of the two-level split.

### The candidate record (store-agnostic data model)

Any claw with memory needs a single candidate shape with a
`canonical_store` discriminator and a recall/approval lifecycle:

```yaml
candidate: <durable statement>
type: fact | action | preference | artifact | policy | tool-lesson | procedure | delegation
canonical_store: brain | inbox | sources | reports | repo | harness | beads | none
recall_status: new | known | stale | failed
harness_kind: memory | prompt | skill | subagent | null   # when store = harness
harness_scope: local | global | null
user_approved: bool
```

## Candidate store: Mnemosyne

[Mnemosyne](https://github.com/mnemosyne-oss/mnemosyne) is zero-cloud,
SQLite-backed AI memory that works everywhere — a candidate additional store.
Its appeal is portability across machines. But adding a store makes the
routing problem *worse*, not better, unless it earns a canonical niche.

**The test:** a new store earns a place only if you can name the class of
durable fact whose canonical home is that store *and no other*. If Mnemosyne
has such a class (plausibly: portable agent memory that must travel with the
claw, while gbrain remains the rich indexed store), it joins the high-level
table. If not, adding it fragments the knowledge base. This is a routing
decision to make deliberately, not a store to add opportunistically.

## Relationship to the three-horizon context model

The information architecture is **orthogonal** to prime-claw's three-horizon
model (see VISION.md). They answer different questions:

- **Three-horizon model** — how long does *context* live (sweet-spot /
  invocation / product-lifetime)?
- **Information architecture** — when something becomes durable, *which
  store* owns it?

A claw needs both. Horizons govern context lifetime; the IA governs
durable-store routing. They compose: the product-lifetime horizon is served
by durable stores (brain, docs), and the IA decides *which* durable store.

## Open: the prime-claw routing table

**The binding prime-claw routing table is not written yet — deliberately.**
The ralph-pva table above is a reference instance, not prime-claw's
contract. prime-claw's correct routing depends on mechanics that manual
driving (LONG_RANGE_PLAN.md Phase 1+) exists to reveal: what an episode
produces, what the REPL holds versus what must be persisted, and where the
conversation → episode boundary writes. The binding table will be derived
from that evidence, not designed in advance.

Do not treat the ralph-pva instantiation as prime-claw's routing contract
until this section is replaced by a table derived from manual driving.
