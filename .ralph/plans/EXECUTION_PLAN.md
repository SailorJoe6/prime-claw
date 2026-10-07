# Execution Plan — Official lean role protocol completion and compatibility cleanup

> **Status:** Operator-approved scope correction on 2026-10-06. Existing episode
> `01a10774-0155-7316-a329-50ee5f7d17be` remains the sole implementation episode.
> Paused Slice 1 must be simplified before any later slice can begin.
>
> **Superseded review:** the 2026-10-03 plan PASS and both later Slice-1 BLOCK
> reports remain historical evidence, but their hostile same-UID and exhaustive
> crash-consistency assumptions no longer define acceptance.
>
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md), operator-corrected for
> a trusted-local ordinary-failure model and DONE-over-perfect delivery.
>
> **Selected future folder:**
> `.ralph/plans/future/official-lean-compatibility-cleanup`.
>
> **Tracking:** implementation `prime-claw-h6w.30`; incident
> `prime-claw-gv7.1`; systemic correction epic `prime-claw-gv7`.
>
> **Execution shape:** the existing episode completes seven bounded slices only
> as needed, with two separately authorized activation generations. Scope,
> landing, user-global mutation, restart, UAT, finalization, bookkeeping, and
> cleanup retain their separate authority boundaries.

## 1. Outcome

At completion, Prime Claw has one progressive, fail-closed role protocol:

- one concise role-neutral kernel is installed as a managed region in the exact
  user-global AGENTS/CLAUDE context file Prime Agent selects;
- the kernel reaches providers only through `Context.systemPrompt` and remains
  present when project SYSTEM or APPEND files are selected;
- managed role actions fail before provider or lifecycle mutation when the
  kernel, trusted identity, or role-specific activation evidence is absent or
  inconsistent;
- global `prime-claw-oversee-episode` supplies Conversation judgment on demand;
- existing `execute` remains the bounded EPISODE implementation procedure;
- global Python-backed `prime-claw-official-expert-review` performs exact-model,
  exactly-once EXPERT admission or reports a deterministic unavailable result;
- historical user-shaped oversight packages remain filtered at the provider
  context seam;
- the retired detailed work-control overlay remains absent; and
- the final installed generation has no Prime Claw-managed global APPEND block,
  project-local `oversee-episode` skill/link, or standalone expert profile.

The same episode remains active from first implementation through bridge UAT,
compatibility removal, final UAT, and documentation reconciliation. Passing the
bridge does not complete or finalize the episode.

### 1.1 Operator scope correction and complexity budget

The 2026-10-06 operator decision supersedes incompatible later text in this
plan. The product trusts the host, checkout, installer, destination account, and
same-UID user during a local operation. It handles ordinary malformed state,
accidental edits, cooperative concurrency, interrupted commands, and normal
filesystem failure. It does not promise hostile same-UID race resistance or
power-loss consistency at every syscall boundary.

Bias toward **DONE over perfect**. The selected-context manager should remain a
straightforward stdlib installer using ordinary validation, one cooperative
lock, same-directory atomic replacement, and a simple fixed-inventory receipt.
Ambiguous recovery stops and asks the operator. Descriptor chains, continuous
inode authority, exchange/restore protocols, multi-phase journals, and exhaustive
race/crash harnesses exceed the Slice-1 complexity budget.

Review findings outside this model are recorded as advisory hardening candidates
with promotion triggers. They do not block or silently expand scope. One normal
review is sufficient. A third repair/review cycle is forbidden without fresh
operator scope/architecture consultation.

## 2. Planning readiness and repository audit

### 2.1 Readiness decision

Planning is **ready**.

- The selected folder exists and contains one complete `SPECIFICATION.md`.
- The specification has 23 unique normative requirements (`ORP-001` through
  `ORP-023`), explicit non-goals, staged authority gates, rollback requirements,
  and final acceptance criteria.
- The designated Prime Agent Expert returned PASS on the exact reviewed content
  SHA after correcting the two v0.9.8 API overclaims about returned reasoning and
  custom Python kernels.
- The operator selected this exact folder with `/plan`, chose one episode through
  both generations, and left no unresolved product decision for planning.
- `prime-claw-h6w.30` is open and unblocked. It remains the single durable task
  authority; this plan does not create parallel slice Beads.

### 2.2 Audited baseline

Planning audited synchronized `main` at
`68815dd81e90287b16ade078c7118a7cc8aa0d3f`. Implementation records its own exact
promotion parent because `main` may advance after planning.

Current behavior and files are:

- `src/prime-agent-plugin/APPEND_SYSTEM.md` is the 246-word
  `PRIME_CLAW_CONVERSATION_IDENTITY_V1` block.
- `scripts/apply-prime-agent-plugin.sh` and
  `scripts/check-prime-agent-plugin.sh` install/check that block in the selected
  destination's `APPEND_SYSTEM.md` through
  `scripts/manage-prime-agent-append-system.py`.
- `conversation-oversight.ts` keeps a manually duplicated exact block, validates
  it for managed owner/EPISODE calls, filters historical package records, and
  uses `ctx.abort()` from the `context` hook after caught classification errors.
- Ordinary sessions currently tolerate a missing/shadowed block; managed owner
  and bounded EPISODE paths do not.
- At the audited predecessor baseline, `.ralph/skills/oversee-episode/SKILL.md`
  was the 1,547-word combined legacy procedure and
  `.agents/skills/oversee-episode` linked to that directory.
- `.prime/agent/profiles/expert-reviewer.md` contains the exact model, reasoning,
  and rubric, but Prime Agent does not natively discover profile files.
- Plugin source remains inert under `src/prime-agent-plugin/`. There is no
  project-local `.prime/agent/extensions` copy.
- Bare apply/check fail closed. User-global mutation is allowed only with
  `--user-global` from clean synchronized primary `main`; linked worktrees are
  refused.
- Tier 1 is Docker-authoritative. Native Prime Agent probes must use
  `scripts/run-prime-agent-probe.sh`.

The active predecessor documents must be preserved when promotion replaces them:

| File at the planning baseline | SHA256 |
|---|---|
| `.ralph/plans/SPECIFICATION.md` | `09cce8ae0898da292fb34f843b3e99b3a5144898934c7e13408a29e76ae2802a` |
| `.ralph/plans/EXECUTION_PLAN.md` | `cf9a75e45d4ccabb42e3c36feed05ef9678227bc58d9e8514aea99145cabe888` |

The episode-promotion commit replaces active plan files but leaves
`.ralph/plans/archive/` intact. Slice 1 reconstructs these exact predecessor
bytes from the promotion parent, verifies both hashes, and archives them under
`.ralph/plans/archive/official-lean-session-protocol/` before other product
changes.

### 2.3 Concurrent-work audit

At planning time two foreign worktrees exist:

- `episode/project-wide-testing-strategy`, with an active episode session; and
- `episode/phase3a-brain-hosting-completion`, with an idle saved episode.

They remain independent. This plan never edits, rebases, lands, finalizes, or
cleans either branch/worktree. Each activation must obtain a durable checkpoint
and quiescence acknowledgment from affected owners. Compatibility removal is
blocked while any active foreign worktree/session can still exercise the full
legacy skill/profile or stale loaded policy. A foreign owner may converge its
own branch, reach an operator-approved non-resumable pause, or complete its own
terminal flow; this episode cannot force that outcome.

## 3. Architecture decisions resolved by planning

### 3.1 Canonical kernel and generated runtime bytes

Add `src/prime-agent-plugin/ROLE_KERNEL.md` as the sole authored neutral-kernel
source. Use a distinct marker pair and sentinel:

```text
<!-- prime-claw:role-kernel:start -->
PRIME_CLAW_ROLE_KERNEL_V1
...
<!-- prime-claw:role-kernel:end -->
```

Add a deterministic stdlib generator/checker that produces
`extension-support/role-kernel.generated.ts` with the exact markers, bytes, and
SHA256 used by runtime parsing. The generated file is checked in so a missing
runtime Markdown file cannot prevent extension registration. Apply, check,
Tier 0, and Tier 1 all fail when generated bytes do not exactly match the
canonical Markdown. No person maintains two policy copies.

The legacy APPEND markers remain distinct throughout the bridge. Marker-looking
project context counts during integrity parsing and causes managed work to fail
closed rather than being silently deduplicated.

### 3.2 One practical role-protocol manager

Use `scripts/manage-prime-agent-role-protocol.py` as the small stdlib manager for:

- one managed neutral-kernel region in the selected global context file;
- the two managed global skill directories;
- a private ownership manifest with a fixed managed inventory;
- bridge retention and later exact removal of the legacy APPEND region; and
- simple receipt-based manual or guarded restore.

Selection follows Prime Agent priority: `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`,
`CLAUDE.MD`; create `AGENTS.md` only when none exists. Under one cooperative
`agentDir` lock, validate the selected target, reread it, preserve unrelated
bytes/newline form/ordinary metadata, and perform an ordinary same-directory
atomic replacement. Reject malformed markers and obvious symlink, non-regular,
or unreadable targets visible during validation. Detect an ordinary changed
preimage before final replacement and stop.

The receipt records the fixed owned inventory, pre/post hashes, preimages, and
whether the context file was installer-created. Restore only known pre/post
states. Unknown state causes refusal and manual instructions. Never delete a
pre-existing context file; delete an installer-created file only when it still
matches its known created state.

The receipt is diagnostic recovery material, not a tamper-proof authority
against the local owner. Do not implement multi-phase transaction journals,
continuous descriptor/inode authority, hostile same-UID ABA/FIFO defenses, or
power-loss proofs. Preserve such ideas only as advisory hardening candidates.

`src/prime-agent-plugin/role-protocol.json` still declares `bridge` for
Generation A and `final` for Generation B. Shell apply/check does not accept a
phase override. Bridge retains the legacy APPEND block; final removes only its
exact managed region after accepted interim UAT.

### 3.3 Managed Conversation activation

Install `src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md`
into `$agentDir/skills/prime-claw-oversee-episode/`. Keep it between 300 and 600
words and limited to supervision judgment from `ORP-006`.

Add a native activation tool with a unique Prime Claw name. It reads the exact
trusted installed skill path, verifies source/install hash and collision state,
and returns only the guidance plus a public version/hash as an on-demand tool
result. The hidden receipt binds the exact activation tool call and result
message, session, prospective location or active episode, protocol/lifecycle
generation, installed path, version, and hash. It grants no authority by itself.

Tool results are provider-visible only on the following model iteration. The
`context` hook therefore implements a single-use disclosure protocol:

1. an issued receipt permits only its exact validated guidance tool result on
   exactly the first continuation/provider call;
2. immediately before returning that first provider context, the hook records
   the receipt consumed under the same trusted session/lifecycle state;
3. private receipt entries never reach the provider; and
4. stale, mismatched, copied, replayed, or already-consumed guide bodies are
   removed from later contexts.

A failed first provider attempt does not authorize replay. The owner may request
a fresh activation only after the old receipt is definitely consumed/expired and
current state is revalidated. Provider captures must prove exactly one on-demand
`toolResult` disclosure and zero guide text in system, user, custom, or later
tool-result channels.

- Before a future episode promotion, the receipt binds the root Conversation to
  the exact operator-selected future location.
- For an active owner, it binds the exact session and episode generation.
- Handoff and finalization require a current matching active-owner receipt, but
  UAT uses read-only readiness inspection rather than either mutating tool.
- Role, location, episode, lifecycle, protocol, path, skill hash, tool-call ID,
  result identity, or consumption state mismatch makes the receipt invalid.
- A project skill collision or shadowed path blocks managed activation.

This migration episode is created under the accepted predecessor generation, so
its initial `/implement-spec` cannot require a tool that does not exist yet.
After bridge restart, its first owner UAT interaction must activate the new guide
before any oversight decision. All later promotions use the new pre-promotion
receipt.

During Generation A, replace the old project-local skill body with a short
forwarding/deprecation shim that contains no supervision or EXPERT policy and
retain the existing symlink. The external cutover coordinator stops every old
client/runtime before this shim reaches `main`, then lands and installs the
managed global skill before starting the sole new runtime. No loaded session may
read the shim in the landing/install gap.

### 3.4 Managed role and provider guard

Refactor `conversation-oversight.ts` around the generated neutral-kernel bytes
and explicit trusted managed-role state:

- exact active owner;
- bounded EPISODE;
- reservation-bound official EXPERT;
- generic bootstrap/RLM/inline/daemon child with no managed authority; and
- ordinary unmanaged session.

On every `context` event, continue filtering historical package records. Managed
roles require exactly one exact neutral block and consistent trusted identity.
Missing, malformed, reversed, nested, duplicate, stale, or disagreeing blocks
call `ctx.abort()` and prove zero provider calls. Ordinary sessions may continue
when context files were explicitly disabled, but promotion and every managed
role action remain unavailable. Throws are tested only as a fail-open control;
production rejection never relies on a thrown extension handler.

Do not add a production provider-payload rewrite. `before_agent_start` may add
covered role-specific guidance only if later proof requires it, but it is not the
neutral-floor transport and cannot weaken direct-idle coverage.

Provider assertions are role- and channel-specific:

- standard ordinary, Conversation, and EPISODE calls contain exactly one neutral
  kernel in `Context.systemPrompt`, zero historical package/private
  receipt/EXPERT rubric in user or custom messages, and only the single exact
  Conversation guide `toolResult` on its activation continuation; an explicitly
  context-disabled ordinary negative control may contain zero and has no managed
  authority;
- an admitted EXPERT contains exactly one neutral system kernel and exactly one
  bounded rubric+packet in the intended parent `agent_message` turn, which Prime
  Agent converts to provider user-role content; that bounded task appears
  nowhere else and is never treated as an always-on oversight injection; and
- every role contains zero retired work-control overlay and zero legacy
  oversight package.

Tests capture system prompt, provider roles, tool-call/result IDs, host
sender/target identity, and call sequence so a broad zero-content assertion
cannot contradict the two required on-demand disclosures.

### 3.5 Official EXPERT package and trusted two-phase admission

Add the exact managed directory
`src/prime-agent-plugin/skills/prime-claw-official-expert-review/` containing:

- `SKILL.md` with the public call and completion contract;
- `pyproject.toml` with no `prime-agent-runtime` or `agent_message` dependency;
- `src/prime_claw_official_expert_review/` with typed async admission helpers;
- one strict machine-readable reviewer configuration; and
- one canonical rubric migrated from the standalone profile.

`rlm.spawn` has no role field, and a name/prompt/depth/model-visible dictionary
cannot create trusted EXPERT identity. Use a supported two-phase, single-use
protocol without inventing a plugin Python `host_request`:

1. A unique owner-only native reservation tool requires a current Conversation
   activation receipt and active episode. It atomically records a mode-0600
   reservation bound to owner session, episode/protocol generation, unique child
   name, exact configured model, requested reasoning, immutable repository/path,
   commit, packet digest, expiry, and opaque nonce.
2. The Python skill receives that reservation record, calls `rlm.find_models`,
   spawns one generic bootstrap child with explicit model/thinking, verifies the
   actual handle model, and reports the exact child handle/session back to the
   owner. The harmless bootstrap remains a generic child with no review authority.
3. The reservation is handle-bound through a native owner tool before delivery.
   The owner then performs exactly one guarded `agent_message.send` containing
   nonce plus validated rubric/packet.
4. On the child's first review turn, the extension validates trusted host
   sender/target metadata, actual target child session/model, packet digest, and
   one unconsumed handle-bound reservation. Under one lock it consumes the nonce
   and binds that exact child/session as EXPERT before the review provider call.
5. Only a complete report from that exact bound child is acceptable. A native
   owner settlement/readiness path validates sender identity, report digest,
   immutable pre/post repository state, and reservation state before evidence is
   preserved and the settled child is deleted.

Define reservation states and terminal handling for reserved, handle-bound,
consumed/bound, settled, expired, definite pre-delivery failure, uncertain
delivery, child crash, replay, and handle/model/session mismatch. Definite
pre-delivery failure may be explicitly released; uncertain delivery is never
resent and remains blocked for owner adjudication/expiry. Expiry or cleanup
removes authority but never fabricates a report. Copied nonce, child name, prompt,
CWD, depth, or packet prose cannot acquire the role.

The Python package uses `import rlm` and lazy-imported `agent_message`. It records
exact requested reasoning and successful spawn admission but never claims
`RlmSpawnHandle` returned reasoning. The extension uses only supported native
tools, session/host metadata, files, and hooks; Prime Agent v0.9.8 does not allow
extensions to register arbitrary Python host-request methods.

Add a deterministic native status/preflight path so a missing Python import can
return `UNAVAILABLE` before reservation, model, message, or lifecycle mutation.
In default managed-kernel mode, apply/check identify the exact managed-kernel
interpreter, validate the installed package source with that interpreter without
editing the kernel venv, and record that Prime Agent skill sync is pending the
coordinated restart; post-restart runtime preflight then proves the discovered
import and exact version/hash. When `PRIME_AGENT_KERNEL_PYTHON` selects an
external interpreter, apply/check and runtime preflight execute that interpreter
directly and require an already importable exact version/hash; they never inject
a source path or install into it. Missing, stale, or mismatched modules are
visibly unavailable and block required review.

Generation A retains `.prime/agent/profiles/expert-reviewer.md` as migration
evidence only. The global skill plus native reservation/binding protocol is the
sole current authority after bridge UAT.

### 3.6 External cutover coordinator

Use `scripts/coordinate-prime-agent-role-cutover.py` as a bounded,
operator-launched helper for the separately authorized Gate A/B sequence. It is
not an autonomous agent, product orchestrator, or transaction engine. It makes no
review, merge, rollback, or acceptance decision.

The helper performs a dry-run/preflight, records simple durable checkpoints, and
executes only the authorized sequence: verify reviewed refs and runtime identity,
confirm affected clients are quiescent, stop the old runtime, run the approved
landing and apply/check steps, start one expected runtime, and print the ordered
owner/episode/ordinary-session resume checklist.

It records observed local/remote refs, apply receipts, runtime identity, and the
last completed checkpoint. On failure or uncertainty it stops. It automatically
restores only a fixed-inventory surface whose current content matches a known
postimage; all other recovery is an operator-guided normal Git/global restore
from preserved preimages. It never retries an uncertain push or restart.

Focused fake tests cover ordinary failure before shutdown, after shutdown,
before/after confirmed landing, during apply, and during runtime start. They do
not attempt exhaustive signal timing, journal corruption, or every possible
partial transaction state. Real Gate runs remain operator-launched; no active
model restarts itself or verifies its own death.

### 3.7 Evidence locations

Use three stores without duplicating authority:

1. **Raw/run-local:** `.test-results/official-lean-role-protocol/<run-id>/`
   for complete test/probe logs. This remains ignored.
2. **Owner-private activation evidence:**
   `~/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/official-lean-role-protocol/<generation>/`
   for mode-0600 global-file preimages, installed inventories, provider captures,
   and restart/UAT receipts. Do not commit user-global file contents.
3. **Durable tracked summaries:**
   `docs/evidence/official-lean-role-protocol/` for sanitized bridge/final
   candidate and activation summaries containing hashes and private-artifact
   references, never credentials or unrelated user instructions.

All tracked summaries are complete and committed before an exact candidate is
frozen. They contain no self-referential final commit/tree or later review result.
After freeze, exact candidate/tree, test/reviewer/admission digests, and
activation results live only in Beads/private receipts until a separately
authorized deterministic bookkeeping commit. No tracked byte changes between
exact review and landing.

`prime-claw-h6w.30` records every slice commit, exact candidate/tree, review
identity/disposition, evidence digest, activation decision, rollback point, and
terminal disposition.

## 4. Dependencies and delivery discipline

### 4.1 Strict sequence

```text
operator-corrected specification + plan
  ↓ existing episode resumes through canonical owner handoff
S1  canonical kernel + selected-context installer + predecessor archive
  ↓
S2  managed-role integrity + Conversation activation + forwarding shim
  ↓
S3  official EXPERT package + kernel-mode preflight
  ↓
S4  Generation A integration, evidence, exact review, rollback bundle
  ↓ operator separately authorizes landing/apply/restart
Gate A  bridge activation + interim UAT + explicit acceptance
  ↓ accepted Gate A only
S5  final legacy-removal and restoration mechanism
  ↓
S6  remove compatibility resources + final runtime/docs reconciliation
  ↓
S7  Generation B integration, evidence, exact official EXPERT review,
    rollback bundle
  ↓ operator separately authorizes landing/apply/restart
Gate B  final activation + final UAT + explicit acceptance
  ↓
archive/bookkeeping → finalize exact episode
  ↓ separately authorized physical cleanup only
```

No slice after S4 begins before Gate A acceptance is recorded. No episode
finalization occurs between generations.

### 4.2 Per-slice rules

Each implementation slice is one small end-to-end capability and must:

1. verify episode identity, branch/worktree, corrected specification/plan, and Bead state;
2. inspect current `origin/main` without modifying foreign work;
3. prefer deletion or topology simplification over another defensive layer;
4. add focused proof for retained behavior, not speculative adversarial matrices;
5. update current docs and Beads with concise evidence;
6. run the gates invalidated by the change, including complete Tier 0 and Docker Tier 1 after plugin-source changes;
7. commit and push one reviewable capability with clean branch equality; and
8. stop for owner review.

Potential out-of-model hazards are logged with a concrete promotion trigger. They
are not implemented automatically. After two repair/review cycles on a slice,
stop for operator consultation. If support machinery grows materially faster
than product behavior or introduces a new transaction/recovery protocol, reopen
the architecture and simplify.

Do not close `prime-claw-h6w.30` per slice. Published accepted commits are never
rewritten. Integrate later `main` only through normal history-preserving Git and
rerun gates invalidated by that integration.

### 4.3 Candidate gates

Each Generation A/B candidate requires:

- complete Tier 0 and selected Docker Tier 1;
- the pinned Prime Agent probe and focused tests for changed retained behavior;
- `git diff --check`, a clean candidate, and local/remote equality;
- concise commit/tree, dependency, log, and teardown evidence;
- one independent normal exact-commit review bounded by the approved threat model; and
- owner acceptance before landing.

A reviewer may `BLOCK` only for a concrete retained functional/safety failure.
Plausible out-of-model edge cases are `ADVISORY`; scope questions return to the
operator. No recursive red-team workers or material-finding-free adversarial
review are required.

Generation A continues to use the accepted primary-main admission path and exact
configured reviewer. Generation B uses the installed official EXPERT package.
Unavailable required admission blocks honestly; no fallback model is selected.
The admission mechanism remains exact, but the review rubric is proportional.

## 5. Requirement traceability

| Requirement | Owning slice/gate | Planned proof |
|---|---|---|
| ORP-001 canonical neutral kernel | S1 | canonical Markdown, generated-byte parity, marker tests |
| ORP-002 guarded selected context | S1, S5 | candidate-priority, byte/metadata/concurrency/selection-drift tests |
| ORP-003 system channel only | S1, S2, S4, S7 | provider captures and session-JSONL assertions |
| ORP-004 per-provider integrity | S2 | malformed matrix, explicit abort, zero-provider-call proof |
| ORP-005 explicit context opt-out | S2 | CLI/SDK no-context ordinary-pass and managed-block tests |
| ORP-006 lean Conversation skill | S2 | word/content exclusions, install/hash/collision tests |
| ORP-007 guidance activation | S2, Gate A, Gate B | on-demand output, receipt invalidation, handoff/finalize gates, model UAT |
| ORP-008 bounded `execute` role | S2, S4, S7 | unchanged skill assertions and negative role-authority tests |
| ORP-009 official EXPERT | S3, Gate A, S7 | exact model/send/admission/report and unavailable matrix |
| ORP-010 semantic read-only | S3, S4, S7 | immutable packet plus pre/post HEAD/status evidence |
| ORP-011 role scoping | S2, S3 | root/owner/episode/expert/generic/ordinary matrix |
| ORP-012 historical filtering | S2, S6, S7 | legacy saved-session replay and non-vacuous fixtures |
| ORP-013 retired overlay absent | every candidate | positive/negative provider assertions and installed inventory |
| ORP-014 one fresh complete episode | promotion, all slices | one durable episode identity retained through both gates |
| ORP-015 bridge generation | S1–S4, Gate A | exact bridge candidate, retained legacy files, shim, activation receipt |
| ORP-016 interim UAT | Gate A | owner/episode/ordinary plus shadow/direct-idle matrix and rollback proof |
| ORP-017 compatibility removal | S5–S7 | exact deletion/absence audit after accepted Gate A |
| ORP-018 final UAT/completion | Gate B | final three-context UAT, operator decision, terminal sequence |
| ORP-019 isolated gates | every slice, S4, S7 | focused logs plus full candidate suites/reviews |
| ORP-020 correlatable evidence | S4, S7, both gates | receipts linking commit/tree/install/provider/reviewer/teardown |
| ORP-021 two rollback points | S4/Gate A, S7/Gate B | isolated restoration plus history-preserving source rollback |
| ORP-022 current documentation | S1–S3, S6 | audited current docs/index/runbooks in same commits |
| ORP-023 immutable history | S1, all slices | exact predecessor archive, no historical rewrites |

## 5.1 Active Slice-1 scope-reduction checkpoint

The first candidate `1eba414c2157740afb45dba4661a95d9a6d63785` and second
candidate `f4b858cbd92cf43c86fac49de60d43e9daa9342b` remain rejected historical
evidence. Their BLOCK reports remain useful, but only concrete ordinary-product
hazards survive this scope correction. F1–F9 hostile same-UID and exhaustive
crash-consistency work is not an active repair contract.

Before this plan correction, the six-file uncommitted F1–F9 draft was preserved
at `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/official-lean-scope-reduction-20261006T041523Z/paused-f1-f9-draft.patch`, SHA-256
`15c8399ac44c642484997716a08e85827bcc72bed1f29587cad9531ffee4ba1b`. Manifest SHA-256: `d58d4c1c8a34d84f89d88ab19741e035a82e158133cce0546b0f1557c2fca2a8`. The current episode
must simplify from its preserved state or the smallest useful historical base; it
must not finish the abandoned state machine.

Corrected Slice 1 completed and was owner-accepted on 2026-10-06 at commit
`57d26e582c583a81de370051b129f74f5b13ee45`, tree
`d1739c3a2ffee4512d6741480b72792e3a8d4098`. It replaced the paused manager with a
straightforward cooperative-lock/atomic-replacement implementation and a
fixed-inventory known-state receipt. Transaction journals, descriptor chains,
inode-generation authority, exchange restoration, exhaustive fault hooks, and
the F1–F9 race matrices are absent. The sole bounded review found one in-model
cooperative-lock ordering defect; its narrow repair and exact waiter regression
were owner-verified and every full gate reran green. Incident `prime-claw-gv7.1`
is closed. Systemic epic `prime-claw-gv7` and advisory H1 remain open for
dogfood. Slice 1 is immutable accepted history.

## 5.2 Active Slice-2 vertical checkpoint

The current execute pass delivers only the first small Slice 2 capability:
managed active-owner and bounded-EPISODE provider calls bind to the generated
neutral role-kernel bytes, malformed or missing managed context aborts before
provider dispatch, explicit no-context ordinary sessions remain usable, and
private bounded identity is no longer copied into provider-visible messages.
Existing lifecycle state and historical-package filtering are reused.

This candidate does not add the managed Conversation skill, activation tool,
receipts, lifecycle readiness gates, or project-skill shim. Those remain the next
Slice 2 capability after owner review. Do not begin Slice 3, land, mutate
user-global state, restart, run UAT, finalize, or clean up.

**Candidate evidence (2026-10-06):** focused native/provider migration 11 passed;
Tier 0 291 passed; Docker Tier 1 60 passed; pinned Prime Agent 0.9.8 installed
runtime probe PASS. Evidence and reproducible commands are in
`docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-managed-role-integrity.md`.
The candidate awaits commit, push, and owner review; later Slice 2 activation
work remains untouched.

## 6. Slice 1 — Simplify and complete the neutral-kernel installer

**Dependency:** operator-approved 2026-10-06 scope correction.

**Capability delivered:** isolated apply/check installs one neutral role kernel in
the selected global context, retains legacy APPEND, preserves ordinary user
content, and provides simple known-state restore without an adversarial
filesystem transaction engine.

### Preserved incident evidence

Before simplification, preserve the paused F1–F9 draft outside the worktree with
its status and hash. Keep `1eba414`, `f4b858c`, both BLOCK reports, and incident
`prime-claw-gv7.1` as history. Do not continue or selectively finish the F1–F9
state machine merely because code already exists.

### Changes

- Start from the smallest useful implementation already in history, retaining the
  canonical kernel, generator parity, selected-file priority, practical marker
  ownership, ordinary atomic replacement, and concrete unrelated-file deletion
  fix.
- Remove multi-phase journal/recovery, continuous inode/descriptor authority,
  atomic-exchange restoration, hostile ABA/FIFO race defenses, and tests whose
  only purpose is the excluded adversarial model.
- Keep one cooperative lock, validation/reread, changed-preimage check, fixed
  receipt inventory, exact known-state restore, and safe refusal with manual
  recovery instructions.
- Ensure malformed receipt inventory can never nominate or delete an unrelated
  file. Retain obvious symlink/non-regular rejection visible during validation.
- Preserve LF/CRLF, final-newline form, unrelated bytes, and ordinary mode and
  ownership metadata where the platform supports it.
- Retain the bridge `role-protocol.json`, legacy APPEND checks, predecessor
  archive, and current user-facing docs.
- Update evidence and Beads to distinguish retained blockers from advisory
  hardening candidates.

### Acceptance

- Authored and generated kernel bytes match.
- Isolated apply produces one neutral block plus retained legacy APPEND and is
  idempotent.
- Ordinary AGENTS/CLAUDE selection, malformed markers, obvious unsafe target
  types, cooperative lock/edit detection, byte/newline preservation, fixed
  inventory, known-state restore, unknown-state refusal, and created-file cleanup
  pass focused tests.
- A malformed/tampered inventory cannot delete an unrelated file.
- The manager and tests are materially simpler than the paused F1–F9 draft and do
  not retain dead adversarial machinery under new names.
- Complete Tier 0, Docker Tier 1/probe, and one normal reduced-contract review pass.
- Candidate is committed once, pushed, clean, and reported for owner acceptance.

### Rollback

Revert Slice-1 files normally on the episode branch. In isolated installs, use a
known-good receipt only when current files match known pre/post states. Otherwise
preserve the destination and receipt and give manual recovery instructions. Never
delete or rewrite a real user-global context automatically from ambiguous state.
Legacy APPEND remains authoritative, so Slice-1 rollback needs no host activation.

## 7. Slice 2 — Managed role integrity and progressive Conversation activation

**Dependency:** accepted S1.

**Capability delivered:** managed roles require the exact neutral floor and an
active owner must consume the trusted lean Conversation guide once on demand
before lifecycle-changing readiness can pass; ordinary sessions and explicit
context opt-out remain safe.

### Changes

- Refactor kernel assertions to use generated bytes and parse every marker-looking
  occurrence in the assembled system prompt.
- Add explicit managed-role classification for root promotion, active owner,
  bounded EPISODE, generic child, and ordinary session. EXPERT stays generic
  until S3 adds trusted reservation binding.
- Keep historical package filtering at the `context` seam; explicitly abort
  managed missing/malformed state and prove zero provider calls.
- Add the global Conversation skill source, installer allowlist/checks, unique
  native activation tool, tool-call/message-bound issued/consumed receipts,
  single-use guide disclosure, invalidation logic, collision detection,
  read-only readiness inspection, and promotion/handoff/finalization gates.
- Reduce `.ralph/skills/oversee-episode/SKILL.md` to a forwarding/deprecation
  shim with no duplicated policy; retain `.agents/skills/oversee-episode`.
- Keep `execute` unchanged except for tested routing references if required.
- Extend provider captures to distinguish system, user, custom, and tool-result
  channels and to correlate guide tool-call/result IDs across provider calls.
- Cover normal direct, queued, injected, direct idle agent message, custom
  trigger, retry, tool loop, compaction continuation, resume, reload, recovered
  queue, project SYSTEM/APPEND shadow, global+project AGENTS/CLAUDE, CLI
  `--no-context-files`, and SDK override paths.
- Update Conversation oversight, handoff, future-bundle, and work-control docs to
  separate neutral invariants, on-demand judgment, and deterministic gates.

### Bounded implementation checkpoint — active-owner disclosure

Accepted candidate 1 is immutable at
`7107d1143330417333bfe6105b18832129d6439f` / tree
`fc382abb394865bfa122abf45987da5e1848a41d`.

This next candidate deliberately implements only one complete receipt subject:
the exact active owner and its current episode generation. It includes the
managed 300–600 word guide source and guarded install/check path, public
name/version/hash metadata, one sequential activation tool, issued-to-consumed
private in-memory receipt, one intended tool-result disclosure, later-context
redaction, project-name collision rejection, read-only status, and pre-mutation
handoff plus first-finalization gates. The project `oversee-episode` body becomes
a policy-free compatibility shim while its discovery symlink remains. The
Slice-1 role-protocol manager and fixed three-file restore receipt are unchanged.

A session start/shutdown or process replacement discards the receipt and requires
fresh activation. Compaction in the same loaded session may retain the consumed
receipt, but transcript text alone never restores it. Identical replay of an
already inactive finalization remains idempotent.

Deferred within Slice 2: prospective-location activation and the promotion gate,
EXPERT admission, broad resume/reload/retry matrices beyond ordinary failure
proof, and any cutover coordinator work. `create_spec_episode` therefore remains
ungated in this candidate rather than being made unusable without a matching
prospective receipt. No user-global apply, restart, UAT, landing, or cleanup is
part of this implementation pass.

### Acceptance

- Exactly one exact neutral system block reaches every managed provider call;
  marker defects abort explicitly with no provider call.
- Ordinary no-context sessions work, while promotion/owner/EPISODE actions fail
  visibly and do not mutate lifecycle state.
- Activation permits its exact guide `toolResult` on the first continuation only,
  records consumption, filters private receipt state, and removes stale/replayed
  guide bodies from every later call.
- Provider-visible system/user/custom text contains no guide, activation receipt,
  neutral-block copy, or historical oversight package; the exact guide appears
  once only in the intended tool-result channel.
- Read-only readiness proves handoff/finalize gates without invoking either live
  transport.
- Role-negative tests prove no EPISODE, generic child, copied transcript, CWD,
  branch, or depth can gain owner authority.
- The old project skill is only a shim and its symlink remains valid.
- Focused Node/native tests, full Tier 0, and Docker Tier 1/probe pass.

### Rollback

Revert the activation/gate/shim commit together. Never leave the shim without the
managed global skill installer or leave a lifecycle gate without its receipt
producer. No user-global mutation occurs in this slice.

## 8. Slice 3 — Official EXPERT admission and kernel-mode fail-close

**Dependency:** accepted S2.

**Capability delivered:** the managed official EXPERT skill and native
single-use reservation protocol bind exactly one real child to the review role,
or deterministically report unavailable before mutation under both managed and
custom kernel modes.

### Changes

- Add the complete Python-backed skill directory, strict reviewer config, and
  migrated rubric.
- Add owner-only reservation, handle-binding, child-side atomic consumption,
  report settlement, read-only readiness, expiry, and cleanup tools/state.
- Implement exact selector normalization/match, explicit model/thinking spawn,
  returned-model verification, harmless generic bootstrap, packet schema/digest,
  and exactly-once guarded parent delivery.
- Bind EXPERT only when trusted host sender/target metadata, actual child
  session/model, packet digest, and one handle-bound unconsumed nonce all agree
  before the first review provider call.
- Document and test the owner-side complete PASS/BLOCK, immutable commit/path,
  pre/post HEAD/status, report preservation, and settled-child deletion contract.
- Add native status/preflight plus apply/check verification of the interpreter
  that will execute the package. Default managed-kernel check validates source
  importability with the exact interpreter without modifying its venv and marks
  sync pending; the first restarted runtime must verify the actual discovered
  import/hash before reservation.
- For `PRIME_AGENT_KERNEL_PYTHON`, require a normal already-installed import and
  test exact present, missing, stale, mismatched, and host-runtime-missing cases
  without source-path injection or provisioning.
- Install both managed skill directories transactionally and reject symlink,
  non-directory, partial generation, name collision, and import collision.
- Retain the standalone profile unchanged and add exact rubric/config parity
  proof showing it is migration evidence rather than a live authority.
- Update current EXPERT documentation with the public API limitation: spawned
  children are semantically read-only, not capability-sandboxed.

### Acceptance

- Exact configured model succeeds only on one exact discovery result; unavailable,
  ambiguous, expired, unsupported-thinking, handle mismatch, uncertain delivery,
  incomplete report, and mutation evidence all block.
- The record contains returned canonical model, requested reasoning, successful
  spawn admission, child/session identity, commit, packet digest, and delivery
  status without claiming returned reasoning.
- A definite delivered/queued receipt causes one send; uncertainty causes no
  retry and no second reservation consumption.
- The generic bootstrap has no EXPERT authority. Copied name/prompt/depth/CWD,
  nonce replay, wrong sender/target, wrong child/model/session, stale expiry, and
  duplicate packet all fail before review provider dispatch.
- The admitted EXPERT provider call contains one neutral system kernel and one
  bounded parent rubric+packet in the intended user-role turn, nowhere else.
- A report from any session other than the bound child is rejected; consumed,
  settled, expired, crash, and cleanup paths are idempotent and fail closed.
- Custom-kernel missing/stale package returns deterministic `UNAVAILABLE` before
  reservation/RLM/message/lifecycle activity.
- `pyproject.toml` contains neither host runtime module as a dependency, and no
  unsupported plugin-defined Python host request is introduced.
- Focused Python/package/native tests, full Tier 0, and Docker Tier 1/probe pass.

### Rollback

Revert the EXPERT package, reservation state/tools, preflight, and installer
allowlist together. Retain the standalone profile and predecessor safety until a
later accepted generation; do not substitute a fallback reviewer.

## 9. Slice 4 — Freeze and review Generation A bridge candidate

**Dependency:** accepted S3.

**Capability delivered:** one exact, reviewable bridge candidate plus an
operator-launched cutover coordinator can install the complete replacement while
retaining every compatibility resource required by old source history.

### Changes and pre-freeze evidence

- Fetch `origin/main` first. If it advanced, merge the exact main tip normally
  into the episode branch and record parent order. Do not rebase
  published/accepted history.
- Implement and recording-fake-test the external coordinator from Section 3.6,
  including resident client/launcher inventory, executable/build mapping,
  `shutdown --force --json`, zero-stale-process gates, exact landing/apply/check,
  single-runtime start/status, practical checkpoint recovery, and ordered resume checklist.
- Reconcile all S1–S3 docs/tests, requirement traceability, managed inventories,
  recovery runbook, provider assertions, and coordinator operator instructions.
- Audit that bridge source contains: neutral context kernel, both global skills,
  exact runtime/activation/reservation/admission gates, legacy APPEND source and
  block, project forwarding shim/link, standalone profile, and historical
  filtering.
- Create the private Generation A preactivation bundle containing exact selected
  global-context and APPEND preimages, mode/uid/gid/newline/final-newline,
  installed plugin/skill inventory, selected-file decision, current known-good
  generation, source topology, restore tool/hash, and manifest digest.
- Prove source rollback plus receipt-driven global restoration against an
  isolated copy. Do not mutate user-global state.
- Commit the sanitized non-self-referential bridge readiness/rollback summary
  under `docs/evidence/official-lean-role-protocol/` after integration and before
  candidate freeze. It may contain run schemas and pre-freeze hashes but no
  future final commit/tree or review result. Rerun all gates and commit every
  tracked reconciliation before freeze.

### Exact freeze and review

- Freeze one immutable candidate commit/tree and run the complete gates in
  Section 4.3. No tracked byte changes after this point.
- The owning Conversation remains in the still-accepted primary-main checkout,
  verifies the unmodified legacy skill/profile hashes from Section 4.3, loads
  that full skill there, admits a fresh reviewer, and sends the immutable
  episode-worktree candidate packet. Record primary source CWD/commit/hashes,
  exact model/session/delivery, and pre/post subject state.
- Preserve exact candidate/tree, test digests, review report/disposition, and
  post-freeze hashes in private receipts and `prime-claw-h6w.30`, not in the
  candidate tree.

### Acceptance

- Complete Tier 0, complete selected Tier 1, tier-1 RPC probe, focused native
  captures, coordinator fakes, diff check, teardown, and independent review all
  PASS at one exact commit/tree.
- The bridge can be applied and restored exactly in isolation.
- No compatibility resource is deleted, no user-global file is changed, and no
  tracked mutation follows exact review.
- Owner accepts the exact candidate before presenting a landing/activation
  decision to the operator.

### Rollback

Candidate rejection stays on the episode branch and returns through canonical
handoff for an in-scope revision. It never mutates main or host-global state.

## 10. Gate A — Separately authorized bridge landing, activation, and interim UAT

### 10.1 Authority and external-coordinator preflight

S4 acceptance does not authorize this gate. Obtain explicit operator authority
for the exact candidate and one invocation of the external cutover coordinator.
That authority includes only the practical known-state handling in Section 10.4
while it remains part of this one operation. A second
coordinator invocation, or any additional `main`/user-global mutation after the
transaction stops, requires separate explicit operator authority. The operator
starts the authorized transaction from a separate terminal before quiescence
with the reviewed inputs and private checkpoint/evidence directory.

The coordinator must:

1. checkpoint this owner, the exact cleanup episode, Project-Wide Testing, Phase
   3a, and every affected active turn/test;
2. inventory every daemon, worker, TUI, client, launcher, wrapper, executable
   realpath/build/version, and daemon socket;
3. require operator-confirmed exit of every resident client/launcher that could
   recover an old daemon, cancel only non-surviving watches, and prove zero stale
   launcher before continuing;
4. require clean synchronized primary `main`, exact remote main, no other
   landing, and accepted candidate topology suitable for fast-forward;
5. verify the private preactivation bundle and isolated restore proof;
6. identify one operator-approved ordinary saved conversation and record its
   session ID/name/CWD and successful baseline turn; and
7. precompute the history-preserving source revert for the actual topology:
   merge-mainline revert for an integration merge, otherwise a verified range
   revert to prelanding main. Never reset.

Any drift, live client, unacknowledged foreign owner, running tool, missing
preimage, wrong executable/build, or ambiguous rollback stops the gate. The
owning model does not land, apply, stop, start, or verify its own runtime.

### 10.2 Coordinator landing, installation, and restart sequence

After authorization and zero stale clients, the external coordinator records
checkpoints and performs this sequence:

1. shut down every old agent/background service with supported
   `prime-agent shutdown --force --json` and prove old daemons, workers, and
   sockets are absent;
2. fast-forward primary `main` to the exact accepted candidate, push, and verify
   local/remote equality and clean status;
3. from that primary checkout only run
   `scripts/apply-prime-agent-plugin.sh --user-global` and then
   `scripts/check-prime-agent-plugin.sh --user-global`;
4. verify selected global context, both skills, legacy APPEND, installed
   extension files, ownership manifest, and hashes, then record an
   **installation/apply receipt** only;
5. prove zero stale launcher again, start exactly one daemon/runtime from the
   recorded executable/build, and verify `prime-agent status --json`; and
6. emit the ordered resume checklist for the exact owner, unchanged episode, and
   designated ordinary session.

A pre-restart Conversation activation receipt is impossible and forbidden. The
new tool is not loaded yet, and no model turn occurs inside the cutover gap.
Duplicate/mismatched runtime or auto-recovered old client triggers rollback.
`/reload`, a second daemon, elapsed time, or copy success is not cutover proof.

### 10.3 Interim UAT

On the sole restarted runtime:

1. resume this exact owning Conversation first;
2. as its first managed interaction, call the new activation tool and consume
   the exact global guide on its one allowed continuation before any oversight
   decision;
3. use only the read-only managed-role readiness tool to prove handoff and
   finalization would be gated correctly; do **not** invoke live handoff or
   finalization during UAT;
4. resume the unchanged cleanup episode second and prove its bounded EPISODE role
   without starting S5;
5. exercise official EXPERT reservation/binding/admission exactly or prove its
   specified fail-closed unavailable result, preserving the complete evidence;
6. resume the designated ordinary saved conversation third and complete a real
   ordinary turn; and
7. execute isolated/nondestructive fixtures for nested CWD, linked worktree,
   unrelated repository, project SYSTEM, project APPEND, direct idle agent
   message, queued message, resume, retry, and compaction.

Provider captures must match the Section 3.4 matrix:

- standard ordinary/Conversation/EPISODE: one neutral system kernel, zero
  historical package/private receipt/EXPERT rubric in user/custom, and one exact
  guide `toolResult` only on the activation continuation; the explicit
  no-context ordinary negative control has zero kernel and no managed authority;
- admitted EXPERT: one neutral system kernel plus exactly one bounded
  rubric+packet in the intended parent-message user-role turn, nowhere else; and
- every role: zero retired work-control overlay and zero legacy oversight
  package.

Verify isolated rollback to the exact accepted pre-bridge generation. Record all
identities, provider counts, hashes, elapsed time, and failures in the private
receipt and Bead. No tracked candidate file changes.

Ask the operator to explicitly accept or reject interim UAT. Only after explicit
acceptance may the owner invoke canonical `handoff_spec_episode` once to begin S5.
That post-acceptance handoff is not part of UAT.

### 10.4 Practical failure recovery

On failure or uncertainty, stop forward progress and preserve source state,
preimages, receipts, compatibility resources, and evidence. Do not infer that a
landing, push, global write, or restart completed.

- Before shutdown, record the failure and leave the accepted generation running.
- After shutdown but before landing, restart only the proven unchanged accepted generation.
- After a proven landing but before global apply, use normal history-preserving Git recovery only with separately confirmed local/remote refs.
- After apply begins, restore only fixed-inventory surfaces whose current contents match a known installed postimage; otherwise stop for manual operator recovery.
- After runtime start or during UAT, follow the same known-state rule, then recover owner, episode, and ordinary sessions in order.

One authorized coordinator invocation does not authorize retrying an uncertain
mutation. Record the observed phase and return to the operator. A detailed
write-ahead transaction journal and automatic compensation of ambiguous states
are explicitly unnecessary.

## 11. Slice 5 — Practical final legacy removal and restore

**Dependency:** explicit accepted Gate A UAT.

**Capability delivered:** final mode can remove only Prime Claw's exact managed
legacy APPEND region and restore a known accepted bridge preimage in isolated
tests, without deleting repository compatibility resources yet.

### Changes

- Extend the practical manager with exact-marker legacy removal and the same fixed-inventory known-state receipt rules used by Slice 1.
- Cover unrelated prefix/suffix, LF/CRLF, final-newline form, malformed/duplicate markers, absent/already-removed replay, and unknown-state refusal.
- Preserve ordinary metadata where supported and reject obvious unsafe target types at validation.
- Keep `role-protocol.json` in bridge mode and do not run final mode against the host.
- Update concise manual recovery instructions.

Do not add hostile same-UID race defenses, continuous inode authority, or an
exhaustive restore-state matrix.

### Acceptance

- Isolated final apply removes only the managed legacy region and preserves unrelated content.
- Known-state restoration recreates the accepted bridge preimage; unknown state refuses safely.
- Bridge default behavior remains unchanged.
- Focused practical tests, complete Tier 0, and Docker Tier 1/probe pass.

### Rollback

Revert Slice 5 normally. The active host remains the accepted bridge generation,
so no user-global or restart rollback is required.

## 12. Slice 6 — Remove compatibility and reconcile the final source tree

**Dependency:** accepted S5 and a fresh foreign-worktree/session audit proving no
active stale consumer.

**Capability delivered:** the episode branch reaches the complete clean target
state while the installed host remains on the accepted bridge until Gate B.

### Changes

- Change `role-protocol.json` from `bridge` to `final`; apply/check now require
  neutral context and both global skills while requiring the managed legacy
  APPEND region to be absent.
- Remove `src/prime-agent-plugin/APPEND_SYSTEM.md` and retire the append-specific
  manager only after final manager coverage is non-vacuous.
- Remove the project forwarding skill directory and
  `.agents/skills/oversee-episode` together, with broken-link absence tests.
- Remove `.prime/agent/profiles/expert-reviewer.md` only after exact
  config/rubric parity tests use the official skill authority.
- Remove bridge-only legacy prompt-shape tolerance after the drain audit, while
  retaining historical `prime-claw-oversee-episode-package` and bounded-record
  provider filtering with self-contained fixtures.
- Replace old skill/profile tests with tests against managed global sources,
  installed copies, activation/admission behavior, and final absence.
- Update `docs/conversation-driven-episode-oversight.md`,
  `docs/goal-heartbeat-work-control.md`, `docs/lab-global-plugin.md`,
  `docs/README.md`, handoff/future-bundle docs, installer help, and recovery
  guidance to describe only the final architecture. Historical archives and
  evidence remain untouched.
- Run a repository reference audit that classifies every remaining old name as
  required historical evidence/filtering or a blocker; do not mass-rewrite.

### Acceptance

- Final isolated apply/check installs one neutral context and both global skills,
  removes only managed legacy APPEND, and leaves no project skill/link/profile or
  `APPEND_SYSTEM.md` source.
- No duplicate current policy/rubric copy or broken symlink remains.
- Historical saved-session replay remains filtered and the retired overlay stays
  absent.
- Current docs, tests, help, and installed inventory describe the final state.
- Focused final-absence/replay tests, full Tier 0, and Docker Tier 1/probe pass.

### Rollback

Revert S6 and return to bridge source with all compatibility files intact. The
host is still bridge, so no activation rollback occurs. If the foreign-consumer
audit becomes stale, stop rather than force another branch to converge.

## 13. Slice 7 — Freeze and review Generation B final candidate

**Dependency:** accepted S6.

**Capability delivered:** one immutable final candidate, operator cutover inputs,
and bridge rollback bundle are ready for separately authorized removal activation.

### Changes and pre-freeze evidence

- Fetch and normally integrate exact latest `main` first if necessary; preserve
  reviewed history and record topology.
- Re-audit every ORP requirement, final installed inventory, current docs,
  historical references, provider filters, coordinator behavior, and foreign
  worktree/session state against that integrated tree.
- Create a private Generation B preactivation bundle whose baseline is the exact
  accepted bridge generation, including selected-context, APPEND, ownership
  manifest, managed skill and installed-state preimages; source topology;
  restore-manager hash; and manifest digest.
- Prove final→bridge source rollback plus exact global restoration in isolation.
- Commit a sanitized non-self-referential final readiness/rollback summary after
  integration and before freeze. It may not claim a future commit/tree or review
  result. Rerun all gates and commit every tracked reconciliation before freeze.

### Exact freeze and official review

- Freeze one immutable candidate commit/tree and execute Section 4.3 completely.
  No tracked byte changes after this point.
- From the bridge-activated owner, reserve and bind one exact reviewer through
  the native protocol, then invoke installed
  `prime-claw-official-expert-review` against the immutable candidate.
- Preserve exact reservation/nonce state, actual child/session/model, requested
  reasoning, spawn admission, packet digest, single delivery, bound EXPERT
  provider capture, complete PASS/BLOCK, pre/post HEAD/status, report settlement,
  and child cleanup.
- Record exact candidate/tree, post-freeze test/review hashes, and disposition in
  private receipts and `prime-claw-h6w.30`, not the candidate tree.

### Acceptance

- All complete gates PASS at one exact commit/tree.
- The official reviewer returns PASS; `UNAVAILABLE`, uncertain delivery,
  incomplete report, wrong child/sender/target, repository mutation, replay, or
  fallback blocks.
- No active foreign worktree/session can exercise stale compatibility behavior.
- Final apply and bridge restoration pass in isolation.
- No tracked mutation follows review, and the owner accepts the exact candidate
  before presenting Gate B authority.

### Rollback

Candidate rejection returns to the same episode through canonical handoff. No
main or host-global mutation occurs.

## 14. Gate B — Separately authorized final landing, activation, and UAT

### 14.1 External-coordinator preflight and operation

Obtain explicit operator authority for the exact S7 candidate and one exact Gate
B coordinator invocation. That authority includes only the practical known-state
handling in Section 14.3 inside this one operation. A second
coordinator invocation, or any additional `main`/user-global mutation after the
transaction stops, requires separate explicit operator authority. The operator
launches the transaction from a separate terminal before quiescence. Repeat the
full Gate A process/executable/build inventory, foreign-owner checkpoint,
zero-stale-client gate, clean-primary-main topology, ordinary-session selection,
preimage, and rollback checks. Require the same cleanup episode identity and
accepted Gate A receipt.

The coordinator then:

1. shuts down every old agent/service and proves all old daemons, workers,
   sockets, clients, TUIs, and launchers are absent;
2. fast-forwards primary `main` to the accepted final candidate and pushes;
3. runs user-global apply/check from clean synchronized primary `main` only;
4. verifies exactly one neutral context block, both managed skills, no managed
   legacy APPEND region, no old project skill/link/profile, and exact installed
   final generation, then records an **installation/apply receipt** only;
5. proves zero stale launcher again, starts exactly one expected daemon/runtime,
   and verifies status/build; and
6. emits the owner→unchanged episode→ordinary resume checklist.

No model runs in the gap and no pre-restart guidance activation receipt is
claimed.

### 14.2 Final UAT

On the sole restarted runtime:

1. resume the exact owner and perform a fresh single-use Conversation guidance
   activation before any oversight decision;
2. use read-only readiness inspection to prove handoff/finalization gates without
   invoking either live mutation;
3. resume the unchanged cleanup episode and verify bounded completion without
   granting Conversation authority;
4. exercise official EXPERT exact reservation/binding/admission or its specified
   fail-closed unavailable behavior;
5. resume the designated ordinary conversation; and
6. run nondestructive project SYSTEM/APPEND, linked/nested/unrelated CWD,
   direct-idle, queued, compaction, resume, and retry fixtures.

Provider captures must match the same role/channel matrix as Gate A: one neutral
system kernel for every managed role and standard ordinary call; the explicit
no-context ordinary negative control has zero kernel and no managed authority;
one exact guide tool result appears only on the owner activation continuation;
one exact bounded EXPERT rubric+packet appears only in the intended
admitted-EXPERT parent-message turn; and private receipts, historical oversight
packages, and retired overlays appear nowhere.

Also prove no missing-skill/profile/startup/lifecycle error, no managed legacy
APPEND or old project skill/link/profile, clean synchronized primary `main`, and
exact bridge rollback readiness.

Record private receipts and Bead evidence without mutating the reviewed candidate
or tracked docs. Ask the operator to accept or reject the completed target state.
Live finalization is forbidden during UAT.

### 14.3 Practical failure recovery

Use the same known-state recovery rule as Gate A. Preserve the accepted bridge,
fixed-inventory preimages, episode, and evidence. Before apply, recover Git only
from confirmed refs using normal history. After apply begins, automatically
restore a surface only when its current bytes match the known final-generation
postimage; otherwise stop for manual operator recovery. Restart and resume only a
proven generation.

Do not retry an uncertain coordinator boundary, finalize, or physically clean.
No exhaustive phase journal or autonomous mixed-state recovery is required.

## 15. Accepted completion, deterministic bookkeeping, and cleanup boundary

Only after explicit final UAT acceptance:

1. record the accepted final commit/tree, installed generation, provider/UAT
   receipts, rollback point, and operator decision in private evidence and
   `prime-claw-h6w.30`;
2. prepare (but do not apply) one deterministic main-only bookkeeping diff that
   archives the completed active specification/plan under
   `.ralph/plans/archive/official-lean-compatibility-cleanup/`, adds the final
   sanitized post-freeze evidence summaries, and updates current indexes/Bead
   references without changing installed plugin source or user-global bytes;
3. present the exact diff, proposed commit, focused checks, and history-preserving
   revert to the operator and obtain distinct explicit authority for that named
   bookkeeping mutation. Final UAT acceptance alone does not authorize it;
4. after authority, commit/push only that deterministic diff, run its checks, and
   verify clean synchronized primary `main`, Dolt/Beads state, archive hashes,
   installed final generation, and exact idle episode identity;
5. retain the logical future-folder `sourceLocation`, durable expectation,
   oversight marker, episode session/worktree/branch, and every identity record
   unchanged until `finalize_spec_episode` succeeds;
6. use read-only readiness one final time, then call `finalize_spec_episode` once
   with `.ralph/plans/future/official-lean-compatibility-cleanup`; verify exact
   expectation/oversight closure while ordinary Conversation capability remains;
   and
7. close `prime-claw-h6w.30` only after finalization and all accepted
   documentation/bookkeeping are durable.

The bookkeeping commit has its own rollback proof and cannot conceal candidate
or UAT drift. Finalization is not physical cleanup. Deleting the saved episode,
worktree, local branch, or remote branch requires a separate explicit operator
decision. Use supported Prime Agent session deletion and normal Git/worktree
operations, preserve a cleanup receipt, and verify absence. No cleanup is
inferred from final UAT or bookkeeping acceptance.

## 16. Plan-wide stop conditions and rollback rules

Stop and return to the owner/operator for real contract failures: specification
drift, missing trusted identity, practical unsafe path or unknown receipt state,
provider-channel leakage, required test failure, unavailable required reviewer,
unconfirmed Git/global mutation, incomplete restart/UAT, or inability to restore
a known accepted generation.

Also stop for a **process** failure when a third repair cycle is proposed, support
machinery grows materially faster than delivered behavior, a new custom
transaction/recovery protocol appears, or an EXPERT finding would expand the
approved threat model. These conditions trigger simplification or a product
decision, not more automatic hardening.

Never resolve a stop by patching Prime Agent, weakening a retained assertion,
choosing a fallback reviewer, force-pushing, resetting accepted history, deleting
foreign resources, or retrying uncertainty. Preserve evidence and ask the
operator when automatic recovery is not clearly safe.

## 17. Explicit non-goals

- No Prime Agent source modification, fork, or unsolicited upstream pull request.
- No capability-sandbox claim for EXPERT children.
- No redesign of episode creation, execute, handoff, or finalization.
- No autonomous orchestrator, monolithic oversight package, or provider-payload repair hook.
- No hostile same-UID filesystem race, ABA/FIFO swap, continuous inode authority, or tamper-proof local receipt guarantee.
- No proof of durability at every syscall/power-loss boundary or automatic recovery of every mixed state.
- No implementation of an advisory edge case until dogfood, a user report, near miss, changed boundary, or approved hard requirement promotes it.
- No Project-Wide Testing, Phase 3a, `prime-claw-h6w.29`, credential, Keychain, browser-store, or premature host-global work.
- No rewrite of archives, accepted commits, Beads chronology, or historical evidence.

## 18. Existing-episode continuation gate

The episode already exists and remains bound to this specification. Do not create
or replace it. Corrected Slice 1 is immutable owner-accepted history at
`57d26e582c583a81de370051b129f74f5b13ee45` / tree
`d1739c3a2ffee4512d6741480b72792e3a8d4098`; incident `prime-claw-gv7.1` is
closed. The systemic epic and advisory H1 remain open without expanding this
implementation contract.

Each canonical owner handoff may authorize one smallest end-to-end Slice 2
candidate. The execute pass audits current deterministic surfaces, implements one
bounded capability, updates tests/docs/Beads, runs proportional gates, commits
and pushes once, reports, and stops. The current candidate is limited to generated
neutral-kernel enforcement and private managed-role context as recorded in
Section 5.2. It must not begin activation receipts or Slice 3, land, mutate
user-global state, restart Prime Agent, run UAT, finalize, or clean up.

## 19. Authorized continuation after Slice 2 stop-loss

The owner independently accepted the cycle-2 duplicate-ID disclosure finding and
authorized one bounded repair pass. Change only `applyGuideDisclosure` and its
filter/validation tests as needed to require one occurrence of the issued ID in
assistant calls and one in all tool results, verify activation names and exact
bound result bytes, and authorize only that validated record. Add the two alias
regressions named in the specification. Rerun invalidated focused checks, complete
Tier 0, Docker Tier 1, and the pinned Prime Agent 0.9.8 probe. Compare the repair
only with the accepted finding; do not run a third independent/adversarial review
or accept another finding. Commit and push one candidate, report it, and stop.
Do not begin prospective-location/create gating, EXPERT admission, later Slice 2
work, Slice 3, landing, global mutation, restart, UAT, finalization, or cleanup.

### 19.1 Implementation result

The authorized duplicate-ID repair is complete. Focused Docker tests passed
17/17, complete Tier 0 passed 287 tests with 172 skipped, Docker Tier 1 passed
65 tests with 394 deselected, and the pinned Prime Agent 0.9.8 probe passed.
Exact commands, log hashes, and the accepted-finding disposition are recorded in
`docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-conversation-guide-activation.md`.
This commit is the single reviewable candidate for the authorized pass. No third
independent review or later-slice work was performed.

## 20. Prospective future-location activation and create readiness gate

The owner accepted `d31ab61e89247a024948d66e2613d434c89688fd` / tree
`f7ecd504d3f890455b858d53c6099c936fb0bf85`. Implement one next Slice 2
candidate only:

1. Audit the existing `/implement-spec` preparation/admission lifecycle and the
   exact pre-mutation boundary in `create_spec_episode`.
2. Extend the existing guide activation subject/receipt minimally so prospective
   readiness binds owner session, exact selected future location, current role
   kernel and guide generation, and current preparation lifecycle.
3. Require the matching consumed readiness before episode identity, worktree,
   branch, session, or oversight-marker mutation.
4. Preserve accepted active-owner handoff/finalization behavior, inactive
   finalize replay, the byte-identical managed guide, and unchanged `execute`.
5. Add focused proof for ordinary no-context failure; wrong, missing, or stale
   location/preparation; EPISODE, generic child, and active-owner misuse; valid
   one-time prospective disclosure/consumption/create; private non-replayable
   receipt state; and abort before any mutation.
6. Update plan/evidence/Bead, run proportional focused checks plus complete Tier
   0, Docker Tier 1, and pinned-runtime probe, then commit/push one candidate,
   report, and stop.

Do not introduce a generalized token framework, durable receipt database,
transaction journal, adversarial race matrix, duplicate policy authority, or
cutover coordinator. If broader provider-route coverage is not required for this
coherent capability, defer it to one final bounded Slice 2 pass. Do not begin
Slice 3, land, mutate user-global state, restart, run UAT, finalize, or clean up.

### 20.1 Implementation result

The prospective subject reuses the existing `/implement-spec` approval map and
adds one private UUID per successful admission. The existing activation receipt
now distinguishes active and prospective subjects; prospective readiness binds
the exact owner session, future location, preparation UUID, role-kernel SHA, and
managed guide generation. `create_spec_episode` verifies the consumed exact
prospective subject before deleting approval state, invoking creation, or
appending oversight. Focused Docker passed 17 tests, installed-runtime creation
fixtures passed 2 tests, complete Tier 0 passed 287 tests with 172 skipped,
Docker Tier 1 passed 65 tests with 394 deselected, and the pinned Prime Agent
0.9.8 probe passed. Exact commands and hashes are in
`docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-prospective-create-readiness.md`.
The managed guide and canonical `execute` skill are byte-identical to the
accepted parent. Remaining provider-route coverage stays deferred to one final
bounded Slice 2 pass.

## 21. Final bounded Slice 2 coverage reconciliation

The owner accepted `29b8932e3e576d0068194e44a5494af98474d8bf` / tree
`a5a16cacce0fad56f546a565475cefe519761b0a`. Complete one coverage-only
candidate:

1. Build a concise route-to-proof map for the Section 7 route and acceptance
   list from existing static, Node, native installed-runtime, and provider
   capture tests.
2. Collapse routes that exercise the same `context` restoration/filtering seam
   into documented equivalence classes rather than a combinatorial matrix.
3. Add only the smallest representative proof for material gaps, prioritizing
   queued/injected/direct-idle agent-message continuation; tool loop and retry;
   compaction/resume/reload/recovered queue; project SYSTEM/APPEND and
   global/project AGENTS/CLAUDE shadows; CLI `--no-context-files`; and SDK
   override.
4. Reuse existing assertions for one exact system kernel, no guide/private
   identity in user/custom channels, one intended guide tool result, later
   omission, and managed abort before provider dispatch.
5. Do not change production code unless a representative test exposes a concrete
   in-contract defect. Record and repair only that seam under delegated triage;
   do not broaden architecture.
6. Update docs/evidence/Bead and mark Slice 2 complete only if the approved
   acceptance contract is covered. Run focused checks, complete Tier 0, Docker
   Tier 1, and pinned-runtime probe. Freeze one commit. Use at most one exact
   independent review only if production code changed; otherwise owner/test
   evidence is sufficient. Commit/push, report, and stop.

Do not begin official EXPERT admission or Slice 3. Do not land, mutate
user-global state, restart, run UAT, finalize, or clean up.

### 21.1 Completion result

The route map and equivalence rationale are recorded in
`docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-coverage-reconciliation.md`. Representative native coverage now identifies direct,
custom, injected heartbeat, direct-idle and queued agent message, queued
follow-up, recovered queue, provider retry, tool loop, compaction, installed
resume/reload/restart, prompt-source shadows, explicit no-context, and SDK
override behavior. Shared provider assertions cover the neutral kernel, guide,
private bounded identity, historical package, retired overlay, and guide receipt
fields/correlation. Focused native passed 5 tests; focused static/Node passed 27
with 25 deselected; complete Tier 0 passed 287 with 174 skipped; Docker Tier 1
passed 67 with 394 deselected; the pinned Prime Agent 0.9.8 probe passed.
Production code, the managed guide, and `execute` are unchanged. Under the
owner-approved test/docs-only rule, no independent patch review was required.
Slice 2 is complete at this candidate. Slice 3, landing, activation/restart, UAT,
finalization, and cleanup remain separately gated.

## 22. Slice 3 first candidate — official EXPERT package and exact preflight only

Accepted base: `e8b047c1493e6718c2f3062f19c77bc0b23ce8e9` / tree
`881b455a121b4cd53dd01005c5f84e31c7c9d555`.

1. Add the managed official EXPERT Python-backed skill/package with strict,
   deterministic reviewer configuration and rubric parity to the unchanged
   standalone expert profile. Preserve that profile as migration evidence.
2. Add read-only availability/preflight for the exact interpreter that would
   execute the package. In default managed-kernel mode, validate source
   importability with that exact runtime interpreter without environment
   mutation and report sync pending where applicable. Under
   `PRIME_AGENT_KERNEL_PYTHON`, accept only a normal already-installed exact
   package/hash import; return deterministic UNAVAILABLE for missing, stale,
   mismatched, or unusable interpreter/package before any other activity.
3. Use only public Prime Agent/Python interfaces. Do not add host runtime modules
   to `pyproject.toml`, source-path injection, host requests, or provisioning.
4. Extend the practical installer/check inventory to own both managed skill
   directories. Preserve preflight-before-copy, exact copy/final check, and
   known-state refusal. Do not introduce a transaction journal, rollback engine,
   or adversarial Slice 1 machinery.
5. Keep the package inert. Do not add spawn, reservation, nonce/expiry, handle
   binding, child admission, delivery, settlement, cleanup tools, provider
   identity, or generic-child EXPERT authority.
6. Run focused package/interpreter/installer coverage, complete Tier 0, Docker
   Tier 1, and pinned-runtime probe. Update evidence/checkpoint, commit/push one
   candidate, report, and stop.

Do not begin later EXPERT admission/reservation mechanics, Slice 4, landing,
user-global mutation, restart, UAT, finalization, or cleanup.

### 22.1 Prerequisite candidate checkpoint

The managed definition-only package, strict standalone-profile byte parity,
exact-interpreter read-only preflight, and complete two-skill installer/check
inventory are implemented. Focused static coverage passed 5 tests and focused
Docker coverage passed 41 with 1 deselected. Evidence and reproducible commands
are in `docs/evidence/official-lean-role-protocol/2026-10-06-slice-3-expert-prerequisite.md`. Complete Tier 0 passed 291 tests with 183 skipped; Docker Tier 1 passed 76
with 398 deselected; and the downloaded/checksum-verified Prime Agent 0.9.8
probe passed with managed `SYNC_PENDING`. This bounded prerequisite is complete
at the candidate and may be committed/reported. Admission, reservation,
transport, role authority, Slice 4, and operational cutover remain excluded.

## 23. Slice 3 second candidate — owner-scoped reservation foundation only

Accepted base: `e319e39949e1eb1c6b6b680d996ffb15ea664264` / tree
`03a88ac106d7fed83f48f0e157366e7d13258c7f`.

1. Add one simple in-memory/session-lifecycle review-reservation record per
   exact active owner. Gate reserve and bind to trusted active-owner state,
   consumed Conversation-guide readiness, and deterministic EXPERT package
   `AVAILABLE`; `SYNC_PENDING` or `UNAVAILABLE` stops before mutation.
2. A reservation contains one cryptographically random opaque nonce, practical
   bounded expiry, exact immutable repository path and commit OID, packet
   digest, requested full selector, and requested thinking level.
3. Add native owner-only reserve, bind, read-only status, and cancel mechanics.
   Status never mutates. Cancel, expiry, and session shutdown are idempotent and
   cannot grant authority.
4. Permit at most one transition from reserved to a record of the exact returned
   child handle/session/model metadata. Treat all caller-supplied spawn metadata
   as pending evidence only. Do not call it verified admission, returned-model
   proof, reasoning proof, or child role authority; those require the later
   trusted child-side seam.
5. If meaningful bind cannot be represented safely without child admission,
   stop at reserve/status/cancel and document that boundary instead of faking
   verification.
6. Keep generic children ordinary. Preserve the inert EXPERT package API and
   use only supported plugin/public interfaces.
7. Run focused state/tool/package tests plus complete Tier 0, Docker Tier 1, and
   pinned-runtime probe. Update evidence/checkpoint, commit/push one candidate,
   report, and stop.

Do not add live reviewer spawn, agent-message delivery, child provider-role
admission, review execution, report settlement, cleanup workflow, durable
database, journal, cross-process recovery, generalized token framework,
hostile-concurrency model, spawn orchestration, message retry, report protocol,
or provider-visible EXPERT authority. Do not begin Slice 4, landing, user-global
mutation/restart, UAT, finalization, or cleanup.

**Section 23 checkpoint — complete at candidate.** The four native mechanics are
implemented with exact active-owner/consumed-guide/fresh-`AVAILABLE` gates, a
15-minute cryptographic-nonce reservation bound to the complete stable oversight
generation and immutable repository/commit/packet/selector/thinking/package
subject, one public-spawn-tuple `bound-pending` transition, read-only status,
and idempotent cancel/expiry/session boundaries. Bind data remains
`caller-supplied-unverified` with `authority: false`. The independent review's
same-session A-to-B lifecycle BLOCK was repaired and re-review passed. Focused
host passed 45 Node plus 17 Python tests; focused Docker passed 43; complete
Tier 0 passed 292, Docker Tier 1 passed 76, and the pinned Prime Agent 0.9.8
probe passed. Evidence is in
`docs/evidence/official-lean-role-protocol/2026-10-07-slice-3-expert-reservation-foundation.md`.
All live spawn/admission/delivery/execution/settlement/cleanup and later phases
remain excluded.

## 24. Section 23 repair — bind review subject to the active episode worktree

Candidate `038d1cbaeb5f00614c4b4f40784cdb9119e72862` / tree
`affdc7c242d6f7ec511a960181d250ba6a1bdea0` is **not accepted**. Repair only the
repository-subject seam:

1. Derive the review target exclusively from the exact active-owner oversight
   marker's `worktree`, never from owning Conversation `ctx.cwd`, caller input,
   branch, session name, or copied prompt.
2. Require the marker worktree real path to exist and equal
   `git -C <worktree> rev-parse --show-toplevel` after canonicalization.
3. Require that worktree's current HEAD to equal the requested exact lowercase
   40- or 64-hex candidate commit OID; store that canonical episode worktree
   path and exact OID.
4. Refuse owner-CWD HEAD, wrong worktree HEAD, missing/noncanonical worktree, or
   any disagreement before reservation mutation.
5. Preserve exact owner-generation, consumed-guide, fresh package `AVAILABLE`,
   nonce/TTL, one `bound-pending` caller-supplied-unverified/`authority:false`
   transition, read-only status, idempotent cancel/expiry/session boundaries,
   and same-session episode A-to-B isolation.
6. Add a topology regression where owner CWD differs from marker worktree and
   prove only marker-worktree HEAD can reserve, including all specified negative
   cases.
7. Re-run invalidated focused tests, complete Tier 0, Docker Tier 1, and pinned
   Prime Agent probe. Freeze and independently exact-review only the repaired
   candidate, commit/push one repair, report, and stop.

Do not accept or investigate another finding in this pass. Add no live spawn,
delivery, child admission, review/report workflow, Slice 4, host activation,
finalization, or cleanup.

**Section 24 implementation checkpoint.** Reserve now receives the exact active
owner marker worktree from `assertExactActiveConversationOwner`, canonicalizes
and requires that path, proves its Git top-level equals the same real path, and
compares that worktree HEAD to the requested exact OID before mutation. The
record stores the canonical marker-worktree path. Owner `ctx.cwd` is no longer a
subject input. A native topology regression uses distinct owner and episode Git
repositories and covers owner-HEAD mismatch, stale worktree HEAD, missing
worktree, symlink/noncanonical worktree, nested/non-root worktree, successful
exact worktree reserve, and no mutation on refusal. Focused/full gates and exact
review remain pending.

**Section 24 validation checkpoint.** The bounded repair is implemented and the
required topology negatives prove refusal before mutation. Focused host passed
46 Node and 17 Python tests; focused Docker passed 43; complete Tier 0 passed
292; complete Docker Tier 1 passed 76; and the pinned Prime Agent 0.9.8 probe
passed. Evidence is
`docs/evidence/official-lean-role-protocol/2026-10-07-section-24-repository-subject-repair.md`.
Freeze this exact tracked patch and require bounded independent `PASS`; after
PASS, commit and push it unchanged and record the exact review/patch/commit
receipts on `prime-claw-h6w.30`. No other finding may be accepted in this pass.

**Section 24 review-repair checkpoint.** The first exact review identified one
in-scope lexical canonicalization gap: `resolve()` erased raw dot/relative or
trailing syntax before comparison. The repair now requires the raw marker path
to be absolute and byte-equal to `realpath`, requires raw trimmed Git top-level
output to equal that canonical string, and adds a dot-segment refusal/no-state
regression. All focused, complete, Docker, and pinned gates were rerun green.
Refreeze and re-review this exact repair before unchanged commit/push.
