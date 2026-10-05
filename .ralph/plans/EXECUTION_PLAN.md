# Execution Plan — Official lean role protocol completion and compatibility cleanup

> **Status:** Independently reviewed and operator-approved for implementation by
> `/implement-spec` on 2026-10-03. The first readiness pass correctly stopped
> before episode creation pending final review and a durable planning commit; a
> separate explicit `/implement-spec` replay is required.
>
> **Plan review:** Prime Agent Expert PASS on exact content SHA256
> `f3089ed84f774e95cffc8a18e82940804bdf05c750f0f19435986a17d99fdb9e` against specification SHA256
> `c7de8047f09a2f26c45260b5b7ebe41b010c39a0208d4f23df7bbcbf18f25eec`. The only later plan changes are status/review and
> terminal replay-gate bookkeeping plus the specification status-hash reference
> below.
>
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md), current SHA256
> `632c848c820b8979b634e33d13b741eefc8cb4cf505c91caf74096c1a63b2f6d`. The only change from independently reviewed content SHA256
> `0428a99c18e5823bea8e863d94b084598c46476bb8126286052484683cb3f7f6` is the
> status line recording the subsequent `/plan` and `/implement-spec` decisions.
>
> **Selected future folder:**
> `.ralph/plans/future/official-lean-compatibility-cleanup`.
>
> **Tracking:** `prime-claw-h6w.30`.
>
> **Execution shape:** one fresh `/implement-spec` episode, seven bounded
> implementation slices, two separately authorized main/user-global activation
> generations, one interim acceptance gate, one final acceptance gate, then
> finalization and separately authorized physical cleanup.

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
- `.ralph/skills/oversee-episode/SKILL.md` is the 1,547-word combined legacy
  procedure. `.agents/skills/oversee-episode` is a symlink to that same
  directory.
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

### 3.2 One guarded role-protocol manager

Add `scripts/manage-prime-agent-role-protocol.py` as the final shared-state
manager. It uses stdlib only and owns these exact surfaces:

- the sole managed neutral-kernel region in the selected user-global context
  file;
- the exact two managed global skill directories;
- a private `$agentDir/.prime-claw/role-protocol-state.json` ownership manifest;
- bridge retention and final removal of the exact legacy APPEND region; and
- recovery from an externally retained installation/preimage receipt.

Selection uses Prime Agent's exact priority: `AGENTS.md`, `AGENTS.MD`,
`CLAUDE.md`, `CLAUDE.MD`; `AGENTS.md` is created only when none exists. The
manager locks at the destination `agentDir`, opens parents and files with
no-follow/regular-file checks, rereads after locking, writes temp files in the
same directory, preserves mode/uid/gid/newline/final-newline and unrelated
bytes, fsyncs, and atomically replaces. It records whether the selected context
file was installer-created. Selection drift blocks apply/check; it is never
silently repaired.

A tracked `src/prime-agent-plugin/role-protocol.json` declares exactly one
source generation: `bridge` in Generation A and `final` in Generation B. Shell
apply/check does not accept a phase override that could activate the wrong
behavior. Bridge installs the neutral context and both skills while retaining
and checking the legacy APPEND block. Final installs the same neutral context
and skills while removing only the exact legacy APPEND region.

The existing append manager remains available during bridge rollback. Final
source may remove it only after the new manager proves exact legacy removal and
receipt-driven restoration. Installer-created empty files are deleted only when
the manifest proves ownership and no unrelated bytes remain.

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

Implement `scripts/coordinate-prime-agent-role-cutover.py` as a bounded,
operator-launched one-shot transaction driver for Gate A and Gate B. It is not an
autonomous agent or product orchestrator and makes no discretionary review,
merge, rollback, or acceptance decision. It may execute only the operator-
preauthorized phase table, including exact in-transaction compensation, from
journaled facts and mutation receipts. The operator starts it from a separate
terminal before quiescence with exact reviewed generation, candidate, prelanding
main, primary checkout, owner/episode/ordinary session IDs, expected Prime Agent
executable path/build/version, and private receipt directory.

The coordinator has explicit preflight/dry-run and execute modes and uses a
write-ahead journal outside the runtime being restarted. The journal records
preflight, shutdown start/completion, local landing, push start and independently
observed local/remote refs, per-surface apply touch-intent/completion, runtime
start, and UAT handoff. It must:

- inventory all resident Prime Agent daemon, worker, TUI, client, launcher, and
  wrapper processes plus executable realpath/build/version and daemon socket;
- require durable checkpoints and operator-confirmed exit of every client/TUI or
  launcher capable of recovering an old daemon;
- prove zero stale launcher/client remains before shutdown and again before
  starting the new runtime;
- use the supported `prime-agent shutdown --force --json` boundary, verify all
  old daemon/workers and sockets are gone, and never accept a surviving or
  auto-recovered old process;
- verify candidate/main topology, perform only the preauthorized landing, run
  apply/check, and preserve installation plus per-surface mutation receipts and
  exact rollback inputs;
- start exactly one expected Prime Agent daemon/runtime from the recorded
  executable/build, verify `prime-agent status --json`, and block on duplicate or
  mismatched runtime; and
- emit the exact ordered resume checklist: owner first, unchanged episode
  second, designated ordinary session third. Post-restart model UAT produces
  guidance/EXPERT activation receipts; the coordinator produces none.

Recording-fake tests cover every transition and specifically failure before
shutdown, after shutdown/before landing, after proven local landing/before push,
uncertain push, and partial per-surface apply. They also cover stale-client
recovery attempts, wrong executable/build, a second daemon, shutdown/start
failure, journal corruption, and the separately authorized recovery handoff.
Real Gate runs are operator-launched; no active model attempts to restart itself
or verify its own death.

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
reviewed specification + reviewed plan
  ↓ explicit /implement-spec (one fresh episode)
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

Every implementation slice is one execute/handoff iteration and must:

1. verify exact episode identity, promotion parent, branch/worktree, approved
   specification and plan, and current `prime-claw-h6w.30` state;
2. inspect latest `origin/main` and concurrent work without modifying foreign
   branches or sessions;
3. add a failing focused test or other explicit red proof before the production
   change when feasible;
4. implement only the named vertical capability and keep rollback local;
5. update current documentation and the Bead in the same slice;
6. run `git diff --check`, focused tests, full Tier 0, and at least one complete
   Docker Tier-1 path after every plugin-source change; use only
   `scripts/run-prime-agent-probe.sh` for native Prime Agent probes;
7. write raw logs and a sanitized durable evidence summary;
8. commit a reviewable capability, synchronize safely with its own remote branch,
   push, and verify the branch is clean/up to date; and
9. stop for owning-Conversation review. Only accepted work advances through
   canonical handoff.

Do not close `prime-claw-h6w.30` per slice. Record slice status in its notes and
close it only after accepted final UAT, terminal bookkeeping, and documentation
reconciliation.

Published/accepted commits are never rebased, amended, reset, or force-pushed.
If `main` advances, integrate it with a normal history-preserving merge at the
candidate-freeze slice, preserve parent order in evidence, and rerun the complete
candidate gates.

### 4.3 Candidate gates

Both Generation A and Generation B exact candidates require:

- complete Tier 0: `python3 -m pytest tests/ -q`;
- complete selected Tier 1: `python3 -m pytest tests/ -q -m container`;
- `scripts/test-tier1.sh --probe`;
- focused native provider-capture and Python-skill tests through the isolated
  wrapper/container paths;
- `git diff --check` and clean candidate status;
- exact commit and tree hashes, main topology, dependency revision, elapsed
  times, raw-log paths, and teardown evidence;
- one independent semantic read-only exact-commit review; and
- owner acceptance before any landing request.

Generation A uses one exact preactivation route: the owning Conversation in the
still-accepted primary `main` checkout loads the unmodified legacy skill SHA256
`2e20d8fc7794cf97e9bfd21eaa6e68c7d6514439c6e62dfb024723b8de41a32f` and profile SHA256 `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`, admits a fresh
reviewer from that primary-main CWD, and sends the immutable episode-worktree
candidate packet. Record source checkout/commit/CWD, both hashes, exact model,
reviewer session, packet/delivery, and pre/post subject state. The profile alone
is never treated as executable admission. Generation B must use the installed
`prime-claw-official-expert-review` plus native reservation/binding protocol and
preserve its complete admission/report record. Any unavailable required reviewer
blocks; no fallback model is allowed.

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

## 6. Slice 1 — Canonical kernel, safe selected-context installation, and lineage

**Revision status (2026-10-05):** candidate
`1eba414c2157740afb45dba4661a95d9a6d63785` remains the immutable rejected
candidate. The owning Conversation accepted five in-scope repairs on
`prime-claw-h6w.30`: (R1) descriptor-bound no-follow safety across every
managed parent/file and apply/check/restore; (R2) durable phase-aware apply and
recovery across replace/fsync/receipt/final-check failures without discarded
rollback uncertainty; (R3) complete pre-mutation receipt schema/inventory/
destination/selection/manifest/pre/postimage validation; (R4) commit-time
metadata, inode/identity, candidate-selection, lock, and receipt revalidation
that preserves external changes; and (R5) adoption of only the exact accepted
predecessor legacy APPEND block. This repaired candidate implements all five,
adds positive, negative, fault-injection, concurrency, durability, restore, and
replay proofs, and received PASS from the bounded independent repair rereview.
Exact final gates are 291 Tier-0 passes, 12 native-Linux manager scenarios,
62 Docker container passes, and a pinned Prime Agent 0.9.8 runtime-probe PASS.
It remains unaccepted pending fresh exact-candidate owner review. Exact original
EXPERT report SHA256 is
`409e6a838d5da82b387fb45f6e2696892af405a636b9afc5be6ccd9d6ddacb83`;
full chronology is on `prime-claw-h6w.30`. Do not enter Slice 2 or Gate A.

**Dependency:** implementation promotion only.

**Capability delivered:** an isolated apply/check can install exactly one neutral
role kernel into Prime Agent's selected global context file while retaining the
accepted legacy APPEND block and preserving predecessor plan history.

### Changes

- Record promotion parent, promoted bundle hash, owner/episode identity, and
  current main/remote topology.
- Restore the predecessor active plan/spec bytes from the promotion parent,
  verify the two planned SHA256 values, and archive them under
  `.ralph/plans/archive/official-lean-session-protocol/`. Stop if the parent or
  bytes differ; never reconstruct from chat.
- Add `ROLE_KERNEL.md`, its deterministic generator/checker, generated TypeScript
  constants, and exact parity tests.
- Add bridge `role-protocol.json` and the guarded role-protocol manager with
  selected-file priority, locking, ownership manifest, atomic write, and receipt
  restore primitives.
- Extend apply/check to preflight every managed file/directory before mutation,
  install/check the neutral context region, and retain/check legacy APPEND.
- Add fixture matrices for AGENTS/CLAUDE priority/case combinations, none/both,
  selected-file drift, unsafe paths, concurrent edits, LF/CRLF, no final newline,
  mode/uid/gid, unrelated bytes, malformed markers, idempotence, orphan temps,
  rollback, and installer-created empty-file cleanup.
- Update `docs/lab-global-plugin.md`, recovery guidance, and current indexes for
  the bridge installer and selected-context ownership model.

### Acceptance

- The authored Markdown and generated runtime block match byte-for-byte and by
  digest.
- Isolated apply produces one neutral context block and one retained legacy
  APPEND block; repeated apply is byte-stable.
- Check rejects every unsafe/malformed/drifted shape before plugin copy.
- Restore from a captured receipt reproduces exact preimages and metadata in an
  isolated destination.
- Existing unrelated plugin files and global instructions remain exact.
- Focused installer tests, full Tier 0, and Docker Tier 1/probe pass.
- The predecessor archive matches the two recorded SHA256 values.

### Rollback

Revert only S1 files on the episode branch. In scratch installs, use the captured
receipt restore; never delete or rewrite a real user-global context. Legacy APPEND
remains authoritative, so S1 rollback does not require host activation.

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
  single-runtime start/status, journal recovery, and ordered resume checklist.
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
That authority includes the exact journal-phase-aware compensating actions in
Section 10.4 only while they remain part of this one transaction. A second
coordinator invocation, or any additional `main`/user-global mutation after the
transaction stops, requires separate explicit operator authority. The operator
starts the authorized transaction from a separate terminal before quiescence
with the exact reviewed inputs and private journal directory.

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

After authorization and zero stale clients, the external coordinator journals
and performs this exact sequence:

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

### 10.4 Journal-phase-aware failure recovery

On failure or uncertainty, stop forward progress, retain every compatibility
resource/evidence item, and read only the durable journal plus exact mutation
receipts. Never infer a completed landing, push, or global write.

Apply this table inside the authorized transaction:

1. **Before shutdown:** perform no source revert, global restore, apply/check, or
   restart. Record the failure; the accepted generation never stopped.
2. **After shutdown but before a proven local landing:** perform no source revert
   or global restore. Prove source/global state is still the accepted predecessor,
   start exactly that unchanged generation, and resume/verify owner, episode, and
   ordinary recovery.
3. **After a proven local landing but before apply starts:** inspect journaled
   local refs and independently fetch/observe the remote ref. Apply the
   precomputed topology-aware normal revert only because landing is proven. If
   push is proven complete, publish the revert normally. If the remote is proven
   still at prelanding main, publish the history-preserving candidate+revert
   recovery only as the authorized compensation. If push outcome is uncertain,
   never retry or infer remote state; resolve it read-only to one exact ref or
   stop for separate operator authority. Do not touch global surfaces. Verify
   accepted source/global state, then restart and recover all three sessions.
4. **After apply begins:** first establish the proven source/remote state as in
   step 3. Restore only global surfaces whose write-ahead touch-intent or
   completion receipt proves they may have changed, using their exact preimages;
   do not rewrite untouched surfaces. Then run the accepted predecessor
   generation's apply/check and verify exact bytes/metadata. Restart and recover
   all three sessions.
5. **After runtime start or during UAT:** use step 4 because apply is proven,
   then recover owner, episode, and ordinary in order.

Every recovery journal records failure phase, observed refs, revert identity when
applicable, touched-surface receipts, restoration, restart, and three-session
recovery. If the transaction cannot prove the state needed for its authorized
compensation, it stops without mutation. A second coordinator invocation or any
later main/user-global repair needs separate explicit operator authority. Never
retry an uncertain boundary or begin S5.

## 11. Slice 5 — Exact final legacy-removal and restoration mechanism

**Dependency:** explicit accepted Gate A UAT.

**Capability delivered:** the bridge source gains a tested final-mode operation
that can remove only Prime Claw's managed legacy APPEND region and restore it
exactly, without yet deleting repository compatibility resources.

### Changes

- Extend the role-protocol manager with final-mode legacy APPEND removal,
  exact separator ownership, installer-created-empty-file cleanup, and
  receipt-driven restoration.
- Add red/failure tests for unrelated prefix/suffix, CRLF/LF, no final newline,
  mode/uid/gid, duplicate/malformed legacy markers, concurrent change, symlink,
  non-regular path, absent block, already-removed replay, and restore mismatch.
- Add final-mode dry-run/check output that names selected context, legacy APPEND
  disposition, both skill hashes, and ownership manifest without printing user
  content.
- Keep `role-protocol.json` in bridge mode, keep all compatibility files, and do
  not run final mode against the host. This slice proves the removal path in
  isolated destinations only.
- Update recovery/operator docs for Generation B preimages and bridge restoration.

### Acceptance

- An isolated final apply removes only the exact legacy region, preserves all
  unrelated bytes/metadata, and converges.
- Isolated restoration recreates the exact accepted bridge generation.
- Bridge default behavior remains unchanged after the slice.
- Focused removal/restore tests, full Tier 0, and Docker Tier 1/probe pass.

### Rollback

Revert S5 as one unit. The active host remains the accepted bridge generation,
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
B coordinator invocation. That authority includes the exact journal-phase-aware
compensating actions in Section 14.3 only inside this one transaction. A second
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

### 14.3 Journal-phase-aware failure recovery

On failure or uncertainty, stop forward progress and use only the durable journal
and exact mutation receipts. Preserve the episode and every evidence item.

Apply this table inside the authorized transaction:

1. **Before shutdown:** perform no source revert, global restore, apply/check, or
   restart; the accepted bridge generation remains active.
2. **After shutdown but before a proven local landing:** perform no source revert
   or global restore. Prove source/global state is still the accepted bridge,
   restart exactly that generation, and resume/verify owner, episode, and
   ordinary recovery.
3. **After a proven local landing but before apply starts:** independently
   establish local and remote refs. Apply the precomputed topology-aware normal
   revert to bridge only because landing is proven. Publish it when candidate
   push is proven; when remote is proven at prelanding bridge, publish only the
   authorized history-preserving candidate+revert recovery. An uncertain push is
   never retried or inferred: resolve it read-only to an exact ref or stop for
   separate authority. Do not touch global surfaces. Verify bridge source/global
   state, restart, and recover all three sessions.
4. **After apply begins:** first establish/recover source and remote state as in
   step 3. Restore only selected-context, APPEND, ownership-manifest, managed-
   skill, or installed-state surfaces whose write-ahead touch-intent/completion
   receipts prove possible mutation, using exact bridge preimages. Do not rewrite
   untouched surfaces. Run bridge apply/check and verify exact bytes/metadata,
   then restart and recover all three sessions.
5. **After runtime start or during UAT:** use step 4 and verify exact owner,
   episode, and ordinary recovery in order.

Record failure phase, observed refs, revert identity when applicable,
touched-surface receipts, restoration, restart, and recovery. If the state needed
for authorized compensation cannot be proven, stop without mutation. A second
coordinator invocation or later main/user-global repair needs separate explicit
operator authority. Do not finalize, physically clean, or retry an uncertain
boundary.

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

Stop and return to the owning Conversation/operator when any of these occurs:

- specification/plan drift or an unreviewed product decision;
- Prime Agent public behavior disagrees with the reviewed source-backed contract;
- missing/duplicate/corrupt/disagreeing owner, episode, role, activation, or
  kernel identity;
- unsafe global file/skill path, selection drift, concurrent edit, or incomplete
  preimage;
- required custom-kernel module unavailable or official reviewer unavailable;
- provider evidence cannot prove system-only delivery and zero user/custom leak;
- a candidate fails complete Tier 0/Tier 1/probe or independent review;
- primary main or candidate topology changes after review;
- any affected foreign owner cannot safely quiesce for restart;
- any active foreign worktree/session can still consume stale compatibility at
  S6/S7/Gate B;
- user-global apply/check, restart, or resumed-session UAT is incomplete or
  uncertain; or
- rollback cannot reproduce the exact prior accepted generation.

Never resolve a stop by patching Prime Agent, weakening an assertion, choosing a
fallback reviewer, silently provisioning an external Python interpreter,
normalizing user files, force-pushing, resetting accepted history, deleting
foreign resources, or retrying an uncertain mutation.

## 17. Explicit non-goals

- No Prime Agent source modification, fork maintenance, or unsolicited upstream
  pull request.
- No capability sandbox claim for EXPERT children.
- No redesign of `execute`, episode creation, canonical handoff, or finalization.
- No autonomous orchestrator, fixed heartbeat schedule, monolithic always-on
  oversight package, or provider-payload repair hook.
- No solution for `prime-claw-h6w.29` probable-hung detection.
- No Project-Wide Testing or Phase 3a implementation, landing, finalization, or
  cleanup.
- No credential access, browser/Keychain inspection, user-global candidate probe,
  or host configuration mutation before explicit activation authority.
- No rewrite of archived plans/specifications, historical evidence, accepted
  commits, Beads chronology, or prior activation/cleanup receipts.

## 18. Implementation-promotion replay gate

The operator accepted this plan with `/implement-spec` on 2026-10-03. That first
readiness pass correctly created no episode because final expert review and a
durable planning commit were still pending. This planning commit records those
resolved prerequisites but does not itself promote the bundle.

After this exact bundle is committed, pushed, and verified on synchronized
`main`, the only implementation promotion is a fresh explicit replay:

```text
/implement-spec .ralph/plans/future/official-lean-compatibility-cleanup
```

The replay must perform its own current-state readiness review and create one
fresh isolated episode. Do not reuse the finalized/deleted official-lean
transition episode.
