# Execution Plan — Official lean role protocol completion and compatibility cleanup

> **Status:** Sections 1-24 are accepted history. Section 25 remains audit history
> at `3586dcc0cb02f314e7c50f661d956f794637f17c`; the owner-approved Section 26
> correction supersedes only its terminal disposition. Existing episode
> `01a10774-0155-7316-a329-50ee5f7d17be` remains the sole implementation episode,
> and the Section 26 candidate is implemented and fully validated pending
> commit/push/report.
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
  bounded rubric+packet in the one user-role task published from the package's
  canonical private `FINALIZED` launch state after child/session/header lineage
  validation and atomic claim. Inbound `agent_message` content and metadata have
  zero authority; the bounded task appears nowhere else and is never treated as
  an always-on oversight injection; and
- every role contains zero retired work-control overlay and zero legacy
  oversight package.

Tests capture system prompt, provider roles, tool-call/result IDs, canonical
private launch/child/session/header lineage, and call sequence so a broad zero-content assertion
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

## 25. Slice 3 next vertical — discover, spawn, deliver, and first-call admit one EXPERT

The owner accepts the complete non-authoritative reservation foundation through
`5674219bc914682a7e28c96146a68ab1b3e80f5f` / tree
`930a7956545c6d3c9b8006e6cf59f5fa141f77d6`. Build only the next coherent
vertical: exact reviewer discovery/spawn, one guarded immutable-packet delivery,
and child-side admission for the first packet-triggered review provider call.

1. Audit only supported public Prime Agent 0.9.8 metadata and interfaces first.
   Prove whether trusted sender/target, actual child session/model, and a
   pre-provider admission seam are available. If any required fact cannot be
   proven without patching Prime Agent or using an unsupported host request,
   record the product constraint and stop; never simulate authority.
2. Reuse the accepted owner-generation-bound reservation and inert official
   package. Resolve exactly one full configured selector, with no fallback.
3. Spawn with explicit model/thinking and a harmless generic bootstrap under the
   startup-race protocol. Verify returned public model metadata without claiming
   returned reasoning. Bind the exact returned `rlm_child_id`, `name`,
   `session_dir`, and `model` tuple as pending evidence.
4. Only after bind, deliver exactly one canonical immutable packet and digest
   through lazy host-provided `agent_message`. A definite `delivered` or
   `queued` result counts as the one send. An uncertain result is not retried.
5. On the child's first packet-triggered call, admit EXPERT only when trusted
   host sender/target metadata, actual child session/model, bound owner
   generation/nonce/packet digest, unexpired one-use reservation, and exact
   package/kernel all agree. Consume once before provider dispatch.
6. Remove private nonce/receipt fields before provider visibility. Supply one
   neutral system kernel and one bounded rubric plus packet in the intended
   user-role turn. Copied name/prompt/depth/CWD, wrong sender/target/child/model/
   session, stale or duplicate nonce/packet, generic bootstrap, and replay must
   abort with zero review provider calls. Generic children remain ordinary.
7. Use a simple loaded-process shared registry only if native tests prove module
   and session sharing. Extend the Python skill with only the smallest typed
   async orchestration helpers and lazy host imports; keep `pyproject.toml` free
   of host-runtime dependencies.
8. Run focused package, Node, native installed-runtime, and provider tests, then
   complete Tier 0, Docker Tier 1, and the pinned Prime Agent 0.9.8 probe.
   Record exact evidence, independently review the bounded candidate, commit and
   push one candidate, report, and stop.

Explicitly defer report return and settlement, owner PASS/BLOCK disposition,
child deletion, cleanup workflow, durable databases/journals, generalized
capability tokens, delivery retries, adversarial race matrices, Slice 4,
landing, user-global mutation/restart, UAT, finalization, and cleanup.

## BLOCKED — Prime Agent 0.9.8 receiver trust metadata is not public

Section 25 stopped at its required public-interface audit. Prime Agent 0.9.8
(commit `a1faacd53ac4473a75de1d434afaf50945c2f647`) has the authoritative
facts internally, but no supported receiver-side interface exposes the complete
set needed for admission before provider dispatch:

- public `rlm.spawn` returns `rlm_child_id`, `name`, `session_dir`, and the
  actual selected `model` to the parent;
- public `agent_message.send` returns trusted sender/target endpoints only to
  the sender;
- a receiving extension can read its own `ctx.model` and read-only session
  manager identity; but
- the only receiver-side link to trusted inbound sender/target is the internal
  built-in `agent_message` custom-message `details` shape. That schema is not
  exported as a supported extension or Python contract. The public message text
  contains only a sanitized relationship/name header and body.

Therefore prime-claw cannot prove trusted sender/target and bind them to the
actual child session/model at the pre-provider `context` seam without relying on
an unsupported internal request/message shape. Serializing parent claims into
the packet would remain attestation text, not independent host proof. A custom
Python `host_request` is also unsupported because extensions cannot register a
public host handler and unknown request types fail.

**Unblock condition:** a supported Prime Agent public receiver interface must
provide unforgeable inbound sender and target identity together with enough
current child/session identity to bind public spawn metadata and `ctx.model` at
or before the provider-admission seam (or an equivalent supported admission
callback). Re-audit a released public interface before resuming. Do not patch or
fork Prime Agent for this project and do not consume the current internal
custom-message `details` schema.

The accepted non-authoritative reservation foundation remains unchanged at
`5674219bc914682a7e28c96146a68ab1b3e80f5f` / tree
`930a7956545c6d3c9b8006e6cf59f5fa141f77d6`. No feature reviewer was spawned,
no review packet was delivered, no child was admitted, and no review provider
call was made. Experimental local implementation edits were discarded.
Evidence: `docs/evidence/official-lean-role-protocol/2026-10-07-section-25-public-interface-constraint.md`.

## 26. Product correction — private launch record and spawn-context admission

The owner accepts Section 25's narrow finding that inbound agent-message
text/header/sender/target is not a supported authority surface, but rejects
terminal blockage. An independent Prime Agent Expert confirmed a supported
redesign that does not use inbound message metadata. Preserve blocker commit
`3586dcc0cb02f314e7c50f661d956f794637f17c` as audit history and implement only
this launch/first-call admission vertical.

1. Ignore inbound message text, headers, sender, and target completely. Retire
   caller-supplied bind authority.
2. Extend the owner-side Python skill to perform exact one-result public model
   discovery, create one private `PENDING` launch record, call public
   `rlm.spawn` with the explicit selector/thinking and a harmless bootstrap
   containing an unpredictable name, then verify/finalize only from the actual
   returned `session_dir`, `name`, and `model`. Revoke on definite failure. Use
   no selector fallback and make no returned-reasoning claim.
3. Store launch state in a purpose-built plugin-owned, untracked private
   namespace with mode-private directories/files, random nonce, fixed TTL, and
   exact owner/project/session/generation/candidate/packet/package/kernel
   binding. Use ordinary exclusive creation plus atomic rename for
   `PENDING -> FINALIZED -> CLAIMED/consumed`. Do not rely on cross-session
   module state (`moduleCache: false`). Do not create a general database,
   journal, power-loss engine, or hostile-extension defense.
4. At the child's initial spawn `context` hook, wait only a short bounded time
   for `FINALIZED`. Validate the public canonical `sessionDir`, `sessionId`,
   `sessionName`, `sessionFile`, current provider/model, canonical
   `header.parentSession` plus parent header ID, nonce/digest/expiry/package/
   kernel, then atomically claim before provider dispatch.
5. Filter the harmless bootstrap and all private fields. Expose exactly one
   canonical rubric-plus-packet user turn and recheck the current model on every
   admitted provider call. Inbound message content has zero authority.
6. Timeout, stale/replay, copied text, duplicate claim, or any wrong
   child/parent/model/session/name/path/package/kernel must call `ctx.abort()`
   explicitly and prove zero provider calls. A wrong trigger may deny service
   but cannot grant role or alter the packet.
7. Run focused package/state/Node/native-provider tests, complete Tier 0,
   Docker Tier 1, and the pinned Prime Agent 0.9.8 probe. Use at most one exact
   independent review cycle and one bounded in-scope repair under stop-loss.
   Record evidence, commit and push one candidate, report, and stop.

Implementation and validation are complete for this vertical. The one exact
review returned BLOCK on the real 0.9.8 `[custom harness digest, user bootstrap]`
first-turn shape. The sole bounded repair changed trigger cardinality to public
user turns, added that real-shaped success/replay coverage, and added an isolated
native provider seam proving one exact call on success and zero calls on timeout
or mismatch. Final evidence is in
`docs/evidence/official-lean-role-protocol/2026-10-07-section-26-private-launch-admission.md`.

Owner review BLOCKS exact pushed candidate
`f15457d82c3c9e3760272e71600eefbaf4809b17` on one regression only. The Python
launch path normalizes `marker["worktree"]` and Git toplevel before comparison,
so dot-segment or symlink marker paths can pass and lose the accepted Section 24
contract at `5674219bc914682a7e28c96146a68ab1b3e80f5f`. Repair only this: require
the raw marker worktree string to be absolute and exactly equal to its strict
real path; require raw `git rev-parse --show-toplevel` output to equal that same
canonical string before normalization; retain exact lowercase 40/64-hex HEAD.
Add focused Python launch regressions for dot-segment and symlink/noncanonical
marker worktrees, retain nested/non-root rejection, and prove failure before
private state creation and spawn. Do not add another independent review cycle,
broaden transaction machinery, reopen sender metadata, or begin settlement,
cleanup, or Slice 4.

The exact repair is implemented. Raw marker spelling must now be absolute and
equal to its strict real path; raw Git toplevel must equal that canonical string
before normalization; lowercase 40/64-hex HEAD validation is retained. The
focused regressions reject dot-segment, symlink, and nested/non-root paths before
model discovery, state creation, or spawn. Final gates pass: 52 Node; 19 focused
Python with 10 deselected; full Tier 0 295 passed/184 skipped; Docker Tier 1 77
passed/402 deselected; pinned Prime Agent 0.9.8 probe OK. Commit/push the narrow
repair, report, and stop.

Continue to defer report return/settlement, owner PASS/BLOCK disposition, child
deletion, cleanup workflow, Slice 4, landing, global apply/restart/UAT, and
finalization. Never patch Prime Agent or read internal agent-message details.

## 27. Slice 3 — structured review report and exact owner settlement

Accepted base: Section 26 commit
`3efd0cc79717378f9be5f448afe32f6a7c33ed39`, tree
`06e08cbcf7a226409749f29c7e6dd815ee66ff4b`. Advance only this coherent
vertical. Inbound messages/details remain non-authoritative.

1. Extend the managed Python package with a strict depth-1 report API. Derive
   the current runtime/session directory and the unique claimed launch from
   host-authored state; revalidate child, canonical parent, candidate, packet,
   model, package, and kernel lineage. Accept one bounded canonical report with
   verdict `PASS`, `BLOCK`, `ADVISORY`, or `SPEC_QUESTION`; every `BLOCK` must
   contain actionable remediation.
2. Canonicalize and digest the report, then atomically transition the matching
   `CLAIMED` file to `REPORTED`. Return an idempotent receipt only for an exact
   duplicate digest. Conflict, malformed/oversized report, wrong child/session/
   parent/candidate, unclaimed launch, or replay fails closed.
3. Capture exact pre-review candidate HEAD and clean status in the launch
   record. At report and settlement, record and compare post-review HEAD/status.
   Preserve evidence of mutation but reject the report/settlement when the
   reviewed subject changed.
4. Add a strict depth-0 owner-only settlement/read API. Derive current owner and
   active generation rather than accepting identity or model-supplied handle
   fields. Locate exactly one matching `REPORTED` launch, validate its digest,
   actual spawn/child/session/model/candidate/package/kernel lineage, and
   unchanged repository state; atomically transition once to `SETTLED` and
   return the immutable structured report and receipt.
5. Keep `FINALIZED`, `CLAIMED`, `REPORTED`, and `SETTLED` child sessions under
   the neutral EXPERT kernel. After report submission or settlement, every
   provider call explicitly aborts instead of falling back to an ordinary role.
   Update the canonical reviewer to submit exactly once before its final answer.
6. Reuse the narrow private file protocol and atomic transitions. Do not trust
   inbound agent-message metadata, add a database/general journal, defend
   against hostile local code, or build delivery retries. Defer owner product
   disposition persistence beyond the receipt if it expands the vertical, plus
   child deletion, state cleanup, Slice 4, landing, global apply/restart/UAT,
   and finalization.
7. Test focused Python/Node/native provider paths, mutation, duplicate digest,
   conflict, replay, wrong lineage, malformed/oversized report, settlement
   exactness, and post-report/post-settlement abort. Run full Tier 0, Docker
   Tier 1, and pinned Prime Agent 0.9.8 probe. Use one direct owner review only;
   no new independent review cycle. Record evidence, commit/push one candidate,
   report, and stop.

Implementation and validation are complete. `launch()` now records exact clean
pre-review repository state; depth-1 `submit()` validates host-derived lineage,
canonicalizes and digests one bounded structured report, records/rejects subject
mutation, and creates `REPORTED`; depth-0 no-argument `settle()` revalidates the
immutable report, actual spawn/session/model/package/kernel lineage, and clean
repository before creating `SETTLED` and returning immutable receipts. Exact
duplicate submission/settled reads are idempotent; conflicts and replays fail
closed. `REPORTED` and `SETTLED` retain the neutral kernel and explicitly abort
provider use.

Final evidence: 43 focused Python passed/8 skipped; 55 Node passed; native
provider coverage passed and reran inside the strict-final full Docker gate;
full Tier 0 311 passed/184 skipped; Docker Tier 1 77 passed/418 deselected;
pinned Prime Agent 0.9.8 probe OK. No independent review
was launched. Evidence is in
`docs/evidence/official-lean-role-protocol/2026-10-07-section-27-report-settlement.md`.
Commit/push one candidate, report for one direct owner review, and stop.

## 28. Slice 3 — final lifecycle closure and bounded stale reconciliation

Accepted base: Section 27 commit
`ee655a8907882a21f693169fbd0369d2d8c2e122`, tree
`60bc9c9985845f54b3ddb1b790f8e10fdda4ad06`. Advance only this final Slice-3
vertical. Keep the purpose-built private-file protocol and public RLM APIs.

1. Add an exact depth-0 owner-only disposition operation. Derive the current
   owner session/file, active episode generation, canonical repository, and one
   unique `SETTLED` report. Accept one bounded explicit disposition plus required
   rationale, canonicalize/digest it, preserve the EXPERT report unchanged, and
   transition to `DISPOSITIONED`. Return an idempotent receipt only for exact
   equality; conflicting disposition or wrong owner/generation fails closed.
   Product/scope authority remains in the Conversation; this API only records
   the supplied decision.
2. Add async close. Revalidate `DISPOSITIONED`, actual spawn/child/session/model/
   candidate/package/kernel/report/settlement/disposition lineage, then call
   public `rlm.list_subagents`. Match only the stored actual child ID. Ambiguous,
   mismatched, or uncertain roster state fails closed. If present, call public
   `rlm.delete_subagent` with the public handle and require a definite deletion
   outcome; re-list when needed to prove absence. Preserve failed/uncertain
   evidence without claiming cleanup. Only definite child absence may transition
   to `CLOSED`, whose immutable receipt retains report, settlement, disposition,
   and deletion evidence.
3. Add explicit purge that accepts only an exact `CLOSED` receipt/digest after
   the caller has durably recorded it. Refuse purge before close, on digest or
   owner/generation mismatch, or without definite child absence. Remove only the
   exact owned private closure files; never delete Prime Agent session artifacts.
4. Add the smallest exact-owner stale cancellation for expired `PENDING`,
   `FINALIZED`, and `CLAIMED`. A pending launch with no published child may
   transition directly to `CANCELLED`. A finalized/claimed published child must
   use the same public roster/delete/definite-absence proof before cancellation.
   Conflicting phase files, non-expired state, wrong owner/generation, ambiguous
   roster, mismatched child, or uncertain deletion fails closed. Do not add a
   generalized recovery transaction engine.
5. Extend the extension state paths and admission gates so `REPORTED`, `SETTLED`,
   `DISPOSITIONED`, `CLOSED`, and `CANCELLED` preserve the neutral EXPERT kernel
   and explicitly abort provider calls whenever a child remains addressable.
   Purged state is allowed only after proven child absence, so it cannot create
   an ordinary-role fallback for a live designated child.
6. Update package capability/status, preflight, reviewer/skill docs, evidence,
   and Slice-3 readiness/expiry/cleanup documentation. Preserve inbound-message
   zero authority and avoid manual artifact deletion, provider/message retries,
   database/general journal machinery, or hostile-local-code defense.
7. Test success, exact duplicate calls, conflicting disposition, wrong owner or
   generation, ambiguous/mismatched roster, definite delete failure, uncertain
   deletion, conflicting/crash phase files, stale no-child pending, stale
   published-child deletion, purge-before-close refusal, exact purge, and no
   role fallback. Run focused Python/Node/native tests, full Tier 0, Docker Tier
   1, and pinned Prime Agent 0.9.8 probe. Use direct owner review only; no new
   independent review cycle. Commit/push one candidate, report, and stop.

Defer Slice 4, landing, user-global apply/restart/UAT, finalization, bookkeeping,
and physical project cleanup.
Implementation is complete on the accepted Section 27 base. The package now
records exact owner `ACCEPT`/`REVISE`/`PAUSE`/`CONSULT` dispositions, closes the
stored actual child only through public roster/delete/re-list proof, retains
bounded failure evidence without claiming cleanup, cancels only exact expired
pre-report states after absence proof, and purges only an exact durably recorded
`CLOSED` result after re-proving public absence. Public deletion is documented as
registry/addressability removal, not physical artifact deletion. The extension
keeps all five terminal phases neutral and aborts every provider call. Focused
evidence: 58 Python passed/50 skipped, 59 Node passed, and 2 native container
passed. Final gates pass: full Tier 0 325 passed/184 skipped; Docker Tier 1 77 passed/
432 deselected; pinned Prime Agent 0.9.8 probe OK with expected package SHA256
`ef3f353d8120ea85393c650d6fa0b5076df1773fee3eecb137a80bd89c0622d0`.
Evidence is in `docs/evidence/official-lean-role-protocol/2026-10-07-section-28-lifecycle-closure.md`.
Commit/push one candidate, report for direct owner review, and stop.

## 29. Owner-review repair — pending/finalized crash overlap and public exports

Base candidate: `1fed99101f3dee95bf6863a3c9298d8c05d96718`, tree
`7c28ffe42d9b7018899cd252460287c91c30604d`. The lifecycle design is otherwise
directionally accepted. Make only this narrow repair:

1. Change the extension admission wait so `PENDING` plus exactly one
   `FINALIZED` is tolerated only as a transient publication overlap within the
   existing deadline. Wait for `PENDING` to disappear before admitting.
2. At or before the deadline, require exactly one authority phase and no
   `PENDING`. Persistent `PENDING`+`FINALIZED`, or any other multiple authority
   phases, must call `ctx.abort()` and dispatch zero provider calls. Preserve all
   current terminal-phase and conflicting-phase refusals.
3. Add Node tests for transient overlap resolution and persistent overlap
   refusal. Extend the Docker-authoritative native provider matrix to prove the
   same success/refusal boundary and zero provider call on persistent overlap.
4. Add Python `__all__` entries for `record_disposition`, `close`,
   `cancel_stale`, `purge`, `DISPOSITION_DECISIONS`, and
   `DISPOSITION_LIMIT_BYTES`, while retaining the existing intended launch,
   submit, settle, description, package, and protocol constants. Assert the
   exact public surface.
5. Update evidence/status minimally. Run focused Python/Node/native tests, full
   Tier 0, Docker Tier 1, and pinned Prime Agent 0.9.8 probe. Do not launch an
   independent review cycle. Commit/push one repair candidate, report for direct
   owner review, and stop.

Do not broaden lifecycle architecture, redesign deletion, start Slice 4, land,
activate/restart/UAT, finalize, perform bookkeeping, or physically clean up
project/session resources.
Section 29 implementation is complete on the blocked Section 28 candidate.
Focused evidence passes: 61 Node, 51 Python/50 skipped, and 2 Docker-native.
The native matrix proves one provider call only after transient overlap resolution
and zero calls for persistent overlap. Package SHA256 is
`92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff`.
Final gates pass: full Tier 0 326 passed/184 skipped; Docker Tier 1 77 passed/
433 deselected; pinned Prime Agent 0.9.8 probe OK with expected package SHA256.
Evidence is in `docs/evidence/official-lean-role-protocol/2026-10-07-section-29-publication-overlap-repair.md`.
Commit/push one repair candidate, report for direct owner review, and stop.

## 30. Current pass — Generation A bridge integration and immutable freeze

**Accepted dependency:** repaired Slice 3 commit
`6bceeea133f767d72739a8d88df2639ab75bba96`, tree
`6421f9acc11a4c5e755e37dfa3060c2821bf5326`.

Execute Section 9 only, with these pass boundaries:

1. Fetch `origin/main`. If its tip advanced, merge that exact tip normally into
   the published episode branch, record first/second parent order, and never
   rebase accepted history.
2. Implement the smallest inert, operator-launched external cutover coordinator
   from Section 3.6. Use recording fakes to cover resident client/launcher
   inventory, executable/build mapping, `shutdown --force --json` order,
   zero-stale-process checks, exact landing/apply/check, single-runtime
   start/status, practical checkpoint recovery, and ordered resume. Do not touch
   real processes, `main`, or user-global state.
3. Reconcile S1-S3 documentation, requirement traceability, managed inventories,
   recovery runbook, provider assertions, and coordinator instructions. Audit
   the complete Generation A bridge inventory while retaining every
   compatibility resource.
4. Create the private preactivation/rollback bundle specified by Section 9:
   exact selected global-context and APPEND preimages with mode/uid/gid/newline
   metadata; installed plugin/skill inventory; selected-file decision; current
   known-good generation; source topology; restore tool/hash; and manifest
   digest. Exclude credentials and unrelated private data. Prove apply and
   restore only against isolated copies.
5. Before freeze, commit the sanitized non-self-referential readiness/rollback
   evidence under `docs/evidence/official-lean-role-protocol/`. It may record
   pre-freeze inputs and hashes but no future candidate identity or review
   result.
6. Run complete Tier 0, selected Docker Tier 1, pinned probe, focused native and
   coordinator-fake tests, diff check, and teardown. Commit all tracked
   reconciliation before freeze. Freeze and push one immutable candidate
   commit/tree. Make no tracked change afterward.
7. Report the exact candidate/tree, parent order, gate/evidence digests, bridge
   inventory, rollback-bundle manifest digest, and review packet to the owning
   Conversation, then stop. Do not launch the independent review here. The owner
   will perform it from the accepted primary-main checkout after verifying
   legacy skill/profile hashes and pre/post subject state.

Do not start Gate A, land, apply user-global state, stop/restart the live runtime,
run UAT, remove compatibility, finalize, or clean up.
### Section 30 pre-freeze checkpoint

Generation A integration is complete before final gates. `origin/main`
`c24ba6c1e76585193d4f34f0b0b0233846780442` was merged normally at
`46147ff887569101b7e64a8466cde5887c15cc31`, with accepted episode history as
first parent and exact main as second parent. The inert coordinator, fixed-surface
private bundle/restore helper, fresh live-receipt wrapper option, recording fakes,
provider assertions, central ORP traceability, current docs/runbook, bridge
inventory regression, sanitized readiness evidence, and isolated candidate ->
known-good -> exact restore proof are present. Focused host 76/54 skipped, Node
76, and Docker-native 3 pass. No live process, primary `main`, or user-global
mutation occurred. Run complete gates, freeze/commit/push one immutable
candidate, report it to the owner, and stop without independent review or Gate A.

## 31. Owner-review repair — Generation A coordinator and bundle seams

**Blocked historical candidate:**
`f2f3fcd25dbe3d96f05193261020d26bf79f1213`, tree
`8b4fef1936766c7383a577317ac6d2436f4e72e5`.

**Accepted report:** exact configured Astra/max `BLOCK`, SHA256
`4ed03385fc1d54cdecdbbacf5ea720d00b70a9af10b99b1466f7592df50d95e1`.
Preserve that candidate, freeze, report, and prior evidence as history.

### 31.1 Coordinator B1 — exact pre-shutdown observation

- Reconcile every observed declared process against its declared role and
  supported entrypoint form, including compiled launcher and interpreter/Node
  entrypoints.
- Require client, TUI, launcher, and wrapper absence before shutdown. Allow only
  the explicitly approved old daemon/worker set until shutdown.
- Bind actual status/build/socket/executable observations, including exact build
  identity rather than version-only equivalence.
- Failed commands, malformed or unknown status/process data, undeclared live
  roles, and any mapping mismatch stop before the first mutation.
- Bound observation to declared/relevant entrypoints; do not substring-scan or
  inspect unrelated programs.

Required cases include a declared live TUI refusal, a supported Node entrypoint
success, and wrong same-version build refusal before shutdown.

### 31.2 Coordinator B2 — one start plus bounded readiness

After exactly one recorded start, use only a short bounded read-only status/
child observation loop. Never invoke start again. Admit readiness only for one
exact expected runtime identity. Stop truthfully for wrong identity, duplicate
runtime, child exit, malformed status, or deadline. Cover delayed readiness that
succeeds after multiple observations with exactly one start, plus every failure
case above.

### 31.3 Coordinator B3 — concrete rollback topology

Replace the syntactic `git revert` prefix check and placeholder recipe with one
fully concrete history-preserving recipe. Validate its exact commit arguments,
integration merge, parent order/mainline, prelanding HEAD, candidate ancestry,
and resulting accepted baseline using a scratch-only inverse application or an
equivalently bounded Git topology proof. Reject placeholders, missing/wrong
commits, wrong mainline, non-resolving results, reset, rebase, force, and
automatic live compensation. No live rollback runs in this pass.

### 31.4 Bundle B4 — original-path no-follow validation

Before any `resolve()`, use `lstat` to reject visible or dangling symlinks and
non-regular selected-context/destination/bundle-root/fixed managed parent or leaf
components at the originally supplied paths. Preserve supported real isolated
roots, fixed managed inventory, and case-insensitive macOS naming behavior. Do
not add descriptor-chain, inode-generation, ABA, or hostile-race machinery.
Cover visible and dangling links for every affected input/output class.

### 31.5 Bundle B5 — metadata-complete restoration

Treat ordinary mode/uid/gid as part of preimage equality. When bytes already
match but metadata differs, restore metadata or fail; never report
`alreadyRestored`. Classify the complete fixed set before mutation, preserve
unknown-content all-or-refuse, and make replay return `alreadyRestored: true`
only when bytes and all required metadata already match. Cover unchanged-byte
mode drift, metadata application failure with truthful state, normal restore,
and replay.

### 31.6 Evidence, gates, and stop boundary

- Add only the exact focused positive/negative/failure/replay tests above.
- Regenerate only affected private bundle manifest, isolated proof, and
  sanitized non-self-referential readiness evidence. Do not rewrite the old
  candidate/report/freeze evidence.
- Run focused coordinator/bundle tests, affected Docker-native checks, complete
  Tier 0, complete selected Docker Tier 1, pinned Prime Agent 0.9.8 probe,
  `git diff --check`, remote equality, and teardown.
- Freeze and push one new immutable candidate commit/tree with no tracked
  mutation afterward. Report exact hashes/evidence to the owning Conversation
  and stop.
- Do not launch the renewed independent review. The owner will re-admit one fresh
  exact configured reviewer because bytes changed.

No Gate A, landing, primary-main or user-global mutation, live runtime shutdown/
restart, UAT, compatibility removal, finalization, bookkeeping close, or cleanup
is authorized.

### Section 31 implementation checkpoint

The five accepted findings are repaired through only the two existing seams.
Coordinator preflight now binds compiled or Node CLI artifacts, exact status
identity, declared roles, and targeted Prime Agent PIDs; all observation defects
stop before operational mutation or scratch proof. One start is followed by a
short attempt/deadline-bounded read-only status/child loop. Rollback input is an
explicit complete linear chain plus the integration merge/mainline and accepted
baseline, proven by generated inverses in a temporary no-local clone.

The bundle helper now checks original supplied paths and every fixed managed
component with `lstat` before resolution, rejects visible/dangling links and
nonregular leaves, and treats bytes plus mode/uid/gid as restored equality.
Metadata-only repair, failure, fixed-set all-or-refuse, and replay are explicit.
No descriptor-chain or race framework was added.

Focused results: 77 coordinator/bundle tests pass; the broader focused host set
passes 137/54 skipped; full Node passes 165; affected Docker-native passes 3.
The replacement private bundle manifest is
`527f88a8897f5f2abe92a5ad9745a17db869c5e3440c351f841908d01aebcce2`
and its isolated bundle-proof SHA256 is
`5eb527a2f2b77edca7033c856794b6f9c53466a9dc0b0545bcbf85c7b3f69983`.
The previous candidate/freeze/report remain untouched. Preliminary complete
Tier 0 passes 404/185 skipped and Docker Tier 1 passes 78/511 deselected. Re-run
all gates on the exact staged evidence bytes, complete prospective rollback
proof plus pinned probe/diff/remote/teardown, then freeze/push/report one
replacement candidate. Do not run renewed review or any Gate A/live/global
action.

## 32. Gate A preflight repair — exact version stream admission

**Accepted historical candidate:**
`ed42db9f20ce7a58689707b188e35028e31abf55`, tree
`7fb098436e13296191ab64ef593c49550c70c162`, exact configured `PASS`.

**Pre-mutation blocker:** supported Prime Agent 0.9.8 wrapper
`/Users/jlanders/code/prime-agent/.worktrees/cwd-fix-v0.9.8-r1-source/prime-agent.sh --version`
returns 0, empty stdout, and exact `0.9.8` on stderr. Current coordinator reads
stdout only and refuses it. Private diagnostic SHA256:
`c0388aa8ede3912106afc3500370494bd37bdbc56880cc9114c91e8ed161be73`.
No shutdown, landing, apply, restart, or other Gate A mutation occurred.

### 32.1 Narrow implementation

1. Change only coordinator executable version verification.
2. Require return code zero.
3. Treat stdout and stderr as raw candidate streams. Exactly one must be
   populated and the other empty.
4. The populated stream must equal the configured version as exactly one line.
   Reject both populated, both empty, extra text, blank-leading/trailing lines,
   multiline content, and mismatch.
5. Keep every other artifact digest, entrypoint, role, status, topology,
   readiness, and mutation gate unchanged. Do not create a reusable/general
   output-normalization layer and do not patch Prime Agent.

### 32.2 Exact tests and real interface proof

Add focused recording cases for:

- exact stdout success with empty stderr;
- exact stderr success with empty stdout;
- both streams populated;
- both streams empty;
- stdout or stderr extra content;
- multiline and blank-line variants;
- version mismatch; and
- nonzero return code even when one stream contains the expected version.

Add one bounded read-only real probe of the supported Prime Agent 0.9.8 wrapper
that asserts return code 0, empty stdout, exact single-line stderr `0.9.8`, and
successful coordinator version admission without invoking status, shutdown,
landing, apply, start, or user-global mutation.

### 32.3 Evidence, topology, gates, and stop

- Preserve ed42, its PASS, and the owner diagnostic unchanged.
- Update only affected documentation/traceability and regenerate affected
  private bundle, readiness, and coordinator-config/proof evidence.
- Prove successor rollback as the exact linear chain
  `[successor, ed42db9f20ce7a58689707b188e35028e31abf55,
  f2f3fcd25dbe3d96f05193261020d26bf79f1213]`, then merge
  `46147ff887569101b7e64a8466cde5887c15cc31` with mainline 2, yielding baseline
  `c24ba6c1e76585193d4f34f0b0b0233846780442` / tree
  `a9955483816af04a4c68468a8e2ce3d0d0d00a5d` in a no-local isolated clone.
- Run focused host/real-wrapper/Docker-native checks, full Node, complete Tier 0,
  selected Docker Tier 1, pinned Prime Agent 0.9.8 probe, diff/remote equality,
  and teardown.
- Freeze/push one clean immutable successor, report it to the owner, and stop.
  The owner must admit one fresh exact configured review because bytes changed.

Do not touch primary `main`, the owner's private local-edit backup, invalidated
ed42 config/state, live processes, user-global state, UAT, S5, compatibility
removal, finalization, bookkeeping close, or physical cleanup.

### Section 32 implementation checkpoint

The exact version seam now captures nonzero status, uses a ten-second bound, and
admits only the configured version followed by one LF on exactly one raw stream.
It rejects both/empty streams, no-LF and CRLF forms, whitespace, extra/blank/
multiple lines, mismatch, and nonzero output before status or operational work.
The real supported 0.9.8 wrapper test calls only `--version` and proves empty
stdout plus exact stderr `0.9.8\n`.

Focused seam coverage passes 100. Preliminary broader focused host passes
160/54 skipped, Node passes 165, and Docker-focused passes 3. Two independent
read-only audits confirmed the bounded code/test surface and private evidence
plan; their tightening findings are incorporated. The new private bundle
manifest is `ff9a321274b8953f0a1b97bddee9e2f4b7f156990f1370c762c93982ca35ad68` and isolated bundle proof is
`4725e44be01966e0127b0c2c298343e6a7feec3cff80f0a26c1a8ecd80d1ba5f`; Section 31 and Gate A diagnostic artifacts remain
unchanged.

Next, stage the exact successor bytes, prove the complete prospective rollback
chain through ed42 then f2f3 and integration merge mainline 2, run complete exact
Tier 0/Docker/pinned/diff/remote/teardown gates, freeze/push one candidate,
create exact successor-bound proof-only config/rollback/freeze receipts, report
the owner, and stop for fresh exact review. Do not run Gate A or any live/global
mutation.
