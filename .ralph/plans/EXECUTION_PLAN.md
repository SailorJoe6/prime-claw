# Execution Plan — Conversation-driven episode oversight

> **Status:** revised design approved after native mechanics POC; active episode
> must replace rejected Slice 1 before later slices.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Tracking bead and owner ledger:** `prime-claw-h6w.22`
> **Implementation authority:** native `/implement-spec` was already invoked for
> this exact future folder; authority remains bounded by the revised specification,
> this plan, and retained operator decisions.

## Outcome

Deliver the smallest plugin release that gives every independent top-level
project session an unforgettable default CONVERSATION identity while leaving
ordinary discussion, design, specification, and planning untouched. After native
`/implement-spec`, the exact invoking conversation enters oversight mode for its
owned episode, receives one fresh canonical oversight package on every real
model run, and returns to ordinary conversation after terminal disposition.

The implementation reuses native system-prompt resources, automatic compaction,
existing episode identity, bootstrap, handoff, observation, Git, and cleanup
mechanics. It adds no conversation engine, proactive conversation compaction,
custom CLI, custom `prime-agent-core` runtime, generalized orchestrator, or
lifecycle service.

## Readiness and current baseline

The reviewed specification is complete enough to implement. Its linked
baseline is present in the repository:

- ordinary Prime Agent conversation plus `.ralph/skills/prepare`,
  `.ralph/skills/spec-it-out`, and `.ralph/skills/plan` already cover project
  orientation, discussion-derived specification, review, and planning;
- `.prime/agent/extensions/reviewed-plan.ts` exposes `/plan`,
  `/implement-spec`, `create_spec_episode`, and `handoff_spec_episode`;
- `.prime/agent/extension-support/spec-episode.ts` owns exact episode identity,
  worktree creation, v2 bootstrap admission, quiescence checks, and ordered
  handoff/execute delivery;
- `.prime/agent/extensions/handoff-chain.ts` owns canonical handoff behavior;
- `.ralph/skills/{implement-spec,execute,handoff}/SKILL.md` own existing phase
  policy;
- `docs/future-specification-bundles.md` and `docs/handoff-chain.md` document
  the delivered mechanics; and
- the Node and Python suites cover those contracts.

Do not redesign, wrap, or repeat existing conversational work. Treat it as a
compatibility surface. The active episode and Bead already exist.

The original explicit-flag/profile Slice 1 commits `05fabd7c` and `5a5195d` were
rejected. Native review proved that input-time and `before_agent_start` overlays
cannot cover all Prime Agent 0.9.5 run paths. The later evidence-only POC, recorded
in `prime-claw-h6w.22`, proved the revised mechanics: APPEND_SYSTEM is stable in
the base prompt, exact-session mode markers survive lifecycle changes, `context`
can supply one fresh procedure package universally without an unsolicited turn,
and the first real post-compaction call restores identity and mode. Treat the
rejected commits as negative evidence and replace their design rather than
incrementally preserving it.

## Implementation design fixed by this plan

### Universal identity and exact-session oversight mode

Implement the proven first-release design with these narrow resources:

- install a small managed `APPEND_SYSTEM.md` kernel that defines default
  CONVERSATION capability and explicit EPISODE, EXPERT, and delegated-child
  precedence without embedding detailed procedures;
- add and use `.ralph/skills/oversee-episode/SKILL.md` as the single canonical
  source for active oversight procedure text;
- replace the rejected flag/profile extension with a small project plugin that
  persists append-only active/inactive markers bound to the exact owner session;
- use the existing `.prime/agent/state/spec-episodes/<slug>.json` identity as the
  independent exact-owner expectation rather than adding another database;
- on every real model context while oversight is active, validate kernel, marker,
  expectation, and package, filter any older package representation, and provide
  exactly one freshly read package;
- restore mode on reload and resume from durable state; let native compaction run
  unchanged and require the first real post-compaction call to receive the same
  kernel and package; and
- clear exact ownership expectation and append inactive state at terminal
  disposition while leaving CONVERSATION capability intact.

The kernel is global/default capability, not unique ownership. Multiple root
conversations may coexist. An ordinary fork remains CONVERSATION-capable but its
copied marker cannot match its new UUID. `/implement-spec` explicitly creates an
EPISODE identity. A depth-positive RLM child or explicit EXPERT task remains
bounded and must not receive owner authority even though it can see the universal
identity kernel.

Before promotion, `/implement-spec` must verify exactly one expected kernel, the
restoration plugin, canonical oversight package, and writable durable identity
surfaces. Project or CLI prompt configuration that shadows the installed kernel
is a visible readiness blocker. During active oversight, missing/duplicate
kernel, corrupt marker, disagreement with the spec-episode expectation, or
missing/corrupt package aborts before provider dispatch and reports the exact
repair. Existing apply/check scripts own installation integrity; do not add a
self-checking sentinel chain.

Activation and deactivation are deterministic lifecycle mutations. Activation
must not start an unsolicited model turn and must not be reported durable until
the containing transition and session state are verified persisted. Package
injection must be idempotent across queued work, reports, heartbeats, native
follow-ups, tool continuation, reload, resume, and cancellation. Classification
is read-only: it validates expectation/receipt stable bindings before selecting
missing-marker recovery, and only then may startup append recovery evidence.
Session-file and worktree agreement uses one canonical path-equivalence rule for
expectations, receipts, current markers, and the exact marker proposed for
reconstruction. Canonically equivalent spellings must converge without an
append-then-reject cycle; genuinely different bindings block with no append-only
session mutation.

Add one narrow two-phase `finalize_spec_episode` capability. Its authorize phase
accepts the exact location and `merged`/`abandoned` disposition, obtains explicit
operator UI confirmation, and persists an exact owner/episode receipt without
performing terminal work. After the skill-guided ordinary Git/session/worktree
sequence, its completion phase requires that receipt, validates conservative
terminal facts, appends inactive state, and clears only the matching expectation
without a second confirmation. The shared startup coordinator must recover every
exact checkpoint emitted by that ordered writer, including `completing` plus an
inactive marker plus a still-retained matching expectation after identity-removal
failure. It reuses the lock and terminal-fact validation, does not duplicate the
inactive marker, and converges without a provider call or second confirmation.
Ambiguity leaves all state available for repair.
The capability records an already-made semantic and operator decision; it never
decides completion, merges, abandons, or cleans resources.

### Policy and authority

Add one project-customizable `.ralph/skills/oversee-episode/SKILL.md`. The
identity kernel states only universal precedence and recovery invariants; the
skill owns the detailed semantic procedure only while an episode is active and
is also the canonical active package source. It must return the conversation to
incubation after terminal disposition rather than ending or narrowing its
CONVERSATION identity. Neither
resource duplicates daemon protocol.

Update `handoff_spec_episode` guidance so an exact owning project conversation
may call it after accepting the current exact commit for an `advance` or
in-scope `revise` disposition. The call no longer requires a fresh operator
transport request. Optional guidance may come from accepted, recorded review
findings within the approved specification and plan; it must not infer scope
expansion or unresolved product decisions. Keep all existing host-side owner,
location, identity, quiescence, canonical-prompt, uncertainty, and replay
checks unchanged.

Native `/implement-spec` remains the only implementation-promotion boundary.
The identity kernel, active package, skill, and continuation guidance do not grant merge,
abandonment, destructive-cleanup, scope-expansion, or product-decision
authority.

### EXPERT reviewer profile and exact model admission

Add one project-versioned `.prime/agent/profiles/expert-reviewer.md` resource.
Its YAML frontmatter is the reviewed reviewer-model policy for this project:

```yaml
---
name: expert-reviewer
model: openai-codex/gpt-6-astra
thinking: max
---
```

The Markdown body contains the stable reviewer role: inspect one exact commit
read-only, report structured PASS/BLOCK findings with evidence, do not edit or
steer the subject, and return the result to the owning conversation. For every
BLOCK finding it must also provide the violated invariant, root-cause seam,
recommended repair direction and rationale, constraints/anti-patterns, concrete
acceptance tests, regression risks, and repair dependencies. It recommends one
bounded alternative when a product decision is necessary and self-checks that
the EPISODE can act without repeating the investigation. It does not prescribe
an exact patch.
Changing the configured selector or reasoning level is an operator-reviewed
project-policy change. The plugin does not infer cost authorization or rank
models.

`oversee-episode` applies the profile with the existing RLM APIs:

1. read and validate the current project profile before each EXPERT invocation;
2. call `rlm.find_models` and require an exact selector match rather than taking
   a fuzzy or similarly named result;
3. spawn a fresh reviewer with the exact `model` and `thinking` values;
4. obey the repository's safe RLM protocol: use only a harmless bootstrap in
   `rlm.spawn`, then deliver the profile body and focused exact-commit review
   packet exactly once through `agent_message.send`;
5. verify the returned spawn handle names the requested model and treat
   successful admission as confirmation that the requested reasoning level was
   accepted;
6. require every BLOCK finding to include actionable remediation direction and
   acceptance evidence under the contract above; reject a report that merely
   restates the failure or asks the EPISODE to rediscover the repair seam;
7. preserve the reviewer session identity, exact commit, model selector,
   admitted reasoning level, and final disposition with the review evidence;
   and
8. stop and delete the fresh reviewer after its findings are preserved.

A missing or malformed profile, no exact model match, unsupported reasoning
level, unavailable credentials, or failed spawn blocks a required review. Do not
retry with a different model, inherit the conversation default, or weaken the
gate. Report the exact failure and pause for operator authorization or external
repair. Never inspect credential stores while diagnosing availability.

This is policy executed by the existing skill and RLM APIs. Do not add an EXPERT
registry, model-ranking service, general model router, or new host capability.

## Slice 1 — Unforgettable default CONVERSATION identity and oversight mode

**Working capability:** every standard independent project session receives one
small default CONVERSATION identity kernel. Successful `/implement-spec`
activates exact-session oversight without an unsolicited response. Every later
real active run receives exactly one fresh canonical oversight package across
all native run paths, reload, resume, and native compaction. Forks, episodes,
reviewers, and delegated children retain the correct bounded identity and no
copied ownership.

### Changes

1. Remove the rejected `--project-conversation` flag/profile assignment design
   and its stale documentation claims. Preserve its commits and review evidence
   in Git and `prime-claw-h6w.22`.
2. Add the small managed `APPEND_SYSTEM.md` identity kernel. Define explicit
   precedence for root CONVERSATION, EPISODE, EXPERT, and delegated-child roles.
3. Add `.ralph/skills/oversee-episode/SKILL.md` with the approved owner-reporting,
   one-heartbeat-per-active-generation, evidence reconciliation, owner-ledger,
   authority, review, continuation, terminal, and return-to-conversation policy.
   Use this one file as both the discoverable skill and active package source.
4. Co-locate exact-session oversight-mode registration in the normally discovered
   `reviewed-plan.ts` production entry and remove the redundant entry point:
   - index active/inactive markers and receipts by exact episode generation;
   - migrate exact-owner legacy markers append-only while ignoring foreign copied history;
   - validate the existing spec-episode identity as ownership expectation;
   - read the current canonical `oversee-episode` package;
   - validate raw package delimiters before any whole-file whitespace
     normalization; require exact unindented delimiter lines while preserving
     normal trailing newlines and formatted body text;
   - accept only its closed two-key frontmatter contract (`name` and
     `description`) and reject blank, comment, unknown, nested, or unsupported
     scalar metadata before promotion or provider dispatch;
   - provide one fresh package through the universal context path;
   - remove stale package representations; and
   - abort visibly on active-state disagreement or corrupt resources.
5. Integrate `/implement-spec` readiness and activation only after promotion and
   episode identity are durably established. Add the approved narrow two-phase
   `finalize_spec_episode` authorization/completion capability with one UI
   confirmation, exact durable receipt, conservative terminal validation, and no
   merge or cleanup authority.
6. Extend plugin apply/check manifests for the kernel, load unit, and canonical
   package. Detect project/CLI prompt shadowing at readiness rather than silently
   weakening identity. Serialize APPEND updates, reconcile dead-writer temporary
   files on retry, preflight managed destination types, and require the final
   mixed-generation check without claiming whole-generation atomicity.
7. Replace focused Node and native Python coverage with the proven matrix:
   - multiple independent root conversations;
   - ordinary fork capability without ownership duplication;
   - actual implement-spec EPISODE transition;
   - explicit EXPERT and real RLM child precedence;
   - normal input, custom trigger, native follow-up, heartbeat, agent message,
     tool continuation, queued/cancelled work, reload, and resume;
   - native automatic compaction with restoration on the first real later call;
   - idempotent activation plus authorized terminal receipt/completion, one user
     confirmation, and no unsolicited provider call;
   - current package reload exactly once per call; and
   - visible zero-provider blocking for missing/duplicate kernel, corrupt marker,
     expectation mismatch, and missing/corrupt package.
8. Rewrite current documentation around default CONVERSATION identity,
   temporary oversight mode, resource precedence, readiness, native compaction,
   and bounded-role transitions. Correct the installed-file inventory.
9. Synchronize the active specification and plan with the universal direct-report,
   15-minute per-generation heartbeat, context-pressure checkpoint, and owner-ledger
   policy without copying point-in-time chronology into the specification.

### Verification and checkpoint

- Run focused Node and native offline Python tests using isolated config/session
  roots and fake providers.
- Run all Node and Python suites; keep the baseline-reproducible candidate
  watchdog failure visible and separate if it recurs.
- Run global plugin apply/check and fresh-process readiness probes without
  modifying unrelated global resources.
- Prove the exact pushed candidate contains no shared handoff-baseline repair and
  preserves unrelated execute-skill provenance.
- Update and Dolt-push `prime-claw-h6w.22`, commit one replacement Slice 1
  candidate, push it, and stop for fresh owner and Astra `max` review.

### Replacement Slice 1 implementation evidence

The N1–N7 consolidation completes the exact generation truth table. Only a
positively identified nonempty foreign owner is ignored; unclassifiable markers,
orphan active generations, and old authorized/completing receipts block even
when another episode is active. Completed old tombstones remain replayable but
noncurrent. Stable owner markers exclude mutable routes. Legacy v1 migration
compares every stable field, including the session file, before append-only v2
recovery.

Receipt authorization/completion now holds a crash-released Python/flock lock for
each exact transaction. Authorization snapshots under lock, releases it while the
UI waits, then reacquires and revalidates identity, marker, receipt, target, and
episode facts. A delayed compatible call returns the newer authorized/completing/
completed evidence and a conflict blocks, so stale calls cannot rewind state.
Completing recovery validates the effective kernel and canonical package before
any session-start mutation and then completes without a provider/model tool.
Returned replay text/details are scoped to that exact old episode and explicitly
preserve a later active generation.

The canonical skill uses a deliberately bounded scalar-only frontmatter grammar:
exact delimiters, unique top-level keys, supported quoted/unquoted scalars, exact
name, nonempty description, and nonempty body. Indentation/nesting, sequences,
block/collection syntax, malformed quotes/brackets, and duplicate keys reject.
Native negative cases make zero provider calls and quoted/unquoted valid forms
pass.

Every publish/recovery-capable installed-native fixture now uses owned-worker mode
and installs an in-extension `net.Socket` deny guard before lifecycle mutation.
It asserts the effective fake socket, hard-coded fake route, complete ordered
create/prompt/ack command IDs and steer/follow-up flags, and registers cleanup
finalizers. A separate inner-SDK restart fixture proves shadowed completing state
does not mutate, then provider-free recovery completes once readiness returns.
No user-daemon session is part of the repaired matrix.

Prior R1–R10, run-path, queue cancellation, auto-compaction, multiple-root,
canonical alias/symlink, bounded-child shadow, skill discovery, route refresh,
sequential-cycle, installer, and global probes remain green. Final focused gates
passed 100 Node contracts and 26 Python native/install contracts plus seven
installer subtests. Full gates passed 113 Node tests and 277 Python tests plus
seven subtests with 11 existing warnings. Isolated and user-global apply/check
passed; fresh global inactive, active, and inactive-shadow processes observed
kernel/package `1/0`, `1/1`, and `0/0`. `git diff --check` passed. Shared handoff
scheduling/quiescence code remains unchanged.

### B1 lifecycle classifier/coordinator repair evidence

The operator-stopped checkpoint resumed as one bounded B1 slice after the approved
design merge `6293e6d7aeacb6c7bfba6ae9873a26c7c5988f11`. Preserve the rejected
candidate `dff6dc7d5120c24e5e4a621ad37d6aebdf705a91` and its Astra report at
`/Users/jlanders/.prime/agent/session-artifacts/01a0ba54-da05-76bd-8d22-a0facfdd7f31/sub-c635cfce/slice1-n1-n7-review.md`.

B1 now has one pure lifecycle classifier shared by provider context, promotion
preflight, post-publication activation, current-marker selection, and ordered
session-start reconciliation. It validates every current-owner expectation,
marker, and receipt before selecting ordinary, active, or one exact recovery.
Only a valid nonempty foreign owner is inert. Missing, null, numeric, or empty
owners fail closed. Exact current and legacy stable bindings are checked before
promotion or migration. Completed old generations remain inert; orphan active,
old authorized/completing, inactive-without-completed, and reappearing-expectation
states block even beside another active generation.

The normally discovered extension now registers one lifecycle-mutating startup
coordinator. It validates kernel/package readiness before mutation, reconstructs
or migrates at most one selected marker, reclassifies, and invokes completing
recovery only when that generation remains the sole recoverable state. The former
independent finalization startup handler and its separate catch were removed, so
a blocker cannot be swallowed by a later mutator. The stable `OversightMarker`
type no longer declares the mutable route field.

Focused contracts passed 25 conversation lifecycle tests and 25 reviewed-plan
tests. Four installed-runtime discovery tests passed. The new native matrix made
zero provider calls, zero fake-daemon calls, and zero lifecycle mutations for
empty owners across all three record types, old completing plus active beta,
orphan active plus active beta, current-marker stable mismatch, and legacy stable
mismatch; completed-old plus active-current and sole completing recovery remain
valid. Full gates passed 118 Node tests and 278 Python tests plus seven subtests
with 11 existing warnings. User-global apply/check passed, and a fresh builder-rooted
process observed the installed generation with kernel/package `1/0`. `git diff --check`
passed.

### B2 lock reliability evidence

The finalization lock now performs an exact JSON startup handshake for `ready`,
`contended`, and `fatal` states. It validates the immediate parent and existing
lock-object type, uses `O_NOFOLLOW` plus `fstat` in the helper, retries only
confirmed flock contention, and surfaces spawn, Python/`fcntl`, permission, path,
and protocol failures. Acquisition uses a monotonic 10-second default deadline
and accepts an `AbortSignal`; the registered finalization tool passes its native
signal through authorization and completion, while startup recovery remains
bounded by the default deadline.

A native held-lock handle detects unexpected helper exit, races asynchronous
terminal validation against holder loss, checks ownership before every later
durable lifecycle mutation, and uses bounded EOF/SIGTERM/SIGKILL release cleanup.
Timeout and cancellation terminate their invocation-owned helper before returning.
Contenders never unlink the persistent lock object or signal a live holder. The
existing complete transaction reread/revalidation and delayed-winner semantics
remain intact.

Focused finalization plus registered-tool coverage passed 44 tests. It covers
directory, symlink, symlink-parent, regular-file parent, inaccessible path,
missing helper, missing-`fcntl` fatal protocol, stale regular files, live
contention success, timeout, pre-abort and in-flight cancellation, post-cancel
reacquisition, native completing recovery after contention, unexpected holder
loss with zero later writes, cancellation with receipt/identity/marker evidence
preserved, tool-signal plumbing, and SIGTERM/dead-holder release. Full gates
passed 123 Node tests and 278 Python tests plus seven subtests with 11 existing
warnings. User-global apply/check passed. A fresh installed-module process
acquired/released a stale regular lock and rejected a directory lock immediately;
a fresh builder-rooted Prime process observed kernel/package `1/0`.

### B3 bounded frontmatter grammar evidence

The canonical oversight package parser now defines its supported scalar subset
completely without adopting general YAML. Top-level key lines retain the exact
one-space form, unique-key check, and no indentation/nesting/sequence rule.
Nonempty double-quoted values use JSON string syntax; nonempty single-quoted
values do not decode escapes. Unquoted values reject every YAML reserved leading
indicator plus flow delimiters, quotes, mapping/comment forms, tabs, and C0/C1
controls. Raw controls are rejected before quote handling, and decoded JSON
controls are rejected after parsing. Ordinary internal punctuation, Unicode,
URLs, and quoted reserved characters remain supported.

The same package reader gates both promotion and every active context dispatch.
Table-driven unit coverage checks accepted boundaries and all reserved indicator,
comment, malformed quote/escape, raw control, and decoded control families at
both gates. Active rejection aborts without changing the expectation/marker
branch or appending a package. The normally discovered native matrix covers six
invalid packages, including the three exact audit reproductions and a decoded
control, with nonzero exit and zero provider calls; valid quoted and unquoted
packages each produce kernel/package `1/1` and preserve the delivered expectation.
Focused gates passed 26 conversation Node tests and nine conversation Python
tests. Full gates passed 124 Node tests and 279 Python tests plus seven subtests
with 11 existing warnings. User-global apply/check passed. Fresh installed native
probes blocked `? bare` with zero provider calls, admitted a quoted package with
kernel/package `1/1`, and observed an inactive builder-rooted kernel/package
`1/0`. `git diff --check` passed.

### B3-R1 owner revision required

Exact-commit owner review disposition for
`7ec3702e89a9f5b4a8333bac4ced52d8a88f0713` is **REVISE**. The owner reran 26
conversation Node tests and nine conversation Python tests successfully, then an
added negative probe proved the package reader accepts an unknown
`metadata: ignored` scalar and skips both `# comment-only metadata` and blank
metadata lines. The bounded package contract is therefore not closed. The root
cause is that line parsing accepts arbitrary unique scalar keys and explicitly
skips blank/comment lines, while only later reading `name` and `description`.

Authoritative main design commit `2580c05` is reconciled as merge commit
`027e7ae8e3a00f8c5eb1555f1795d00cb62b5241`, preserving the promoted
future-folder deletion and rejected history. The current P0 is the fresh B3-R1
repair and synchronization of the closed contract into the active specification
and plan. Make frontmatter contain exactly one `name`
line and one `description` line between the delimiters. Reject blank, comment,
unknown, duplicate, nested, sequence, and unsupported-scalar metadata lines in
the one shared promotion/active reader. Do not adopt general YAML or aliases and
do not weaken any accepted or rejected scalar boundary from B3. Acceptance must
prove promotion and active unknown-key, comment-line, and blank-line cases make
zero provider calls and no lifecycle/package mutation, while canonical, quoted,
Unicode, URL, internal-punctuation, and all B1/B2/B3 regressions remain green.

#### B3-R1 repair evidence

The shared package reader now requires exactly two frontmatter lines and accepts
only the `name` and `description` keys, each once. It no longer skips blank or
comment lines and cannot accept unknown scalar keys. Both values still pass
through the unchanged bounded B3 scalar parser.

Table-driven Node coverage exercises unknown-key, comment-line, and blank-line
packages through promotion and active dispatch, proving unchanged marker branch
and byte-identical expectation evidence with no package append. Native coverage
runs all three cases through both active and promotion setup, proving nonzero
visible failure, zero provider records, and byte-identical durable expectation;
valid accepted punctuation/Unicode/URL forms still dispatch with kernel/package
`1/1`. Focused gates passed 27 conversation Node tests and nine conversation
Python tests. Full gates passed 125 Node tests and 279 Python tests plus seven
subtests with 11 existing warnings. Independent read-only review returned PASS
for the B3-R1 diff with the B4 path explicitly excluded. User-global apply/check
passed, and fresh installed active/promotion probes rejected all six invalid
cases with zero provider records and accepted both valid cases with
kernel/package `1/1`. The repaired exact commit still requires fresh owner review
before any B4 handoff or Slice 2 work.

### B3-R2 owner/expert revision required

Exact-commit owner/Astra disposition for
`26cef4f78a399da4580b53b08a3bbb499c1e326e` is **REVISE**. The fresh Astra/max
report is
`/Users/jlanders/.prime/agent/session-artifacts/01a0ba54-da05-76bd-8d22-a0facfdd7f31/sub-39e2a007/b3r1-exact-review.md`.
Its actionable P2 proves `packageBody()` trims the whole raw package before
parser validation, so space/tab-indented opening `---` lines normalize to exact.
Independent native active and promotion cases exited zero and reached the fake
provider with kernel/package `1/1`; promotion, activation, or recovery mutation
can therefore occur even though the exact-delimiter contract requires fail-closed
behavior. The closed two-key allowlist itself is correct.

The next P0 after handoff is one fresh B3-R2 repair. First reconcile authoritative
main design commit `d8a3687` while preserving the promoted future-folder
deletion, rejected history, and dirty B4 fixture. Validate the raw opening and
closing delimiter/frontmatter structure before any whole-file whitespace
normalization, retaining one shared reader for every gate; keep post-validation
injected-text formatting separate. Do not generalize YAML, add aliases, comments,
or unknown keys, duplicate validators, fix only one call site, reject normal
trailing newlines or formatted nonempty body indentation, or touch B4.

Acceptance must prove space/tab-indented opening delimiters and other nonexact
opening/closing forms reject at the complete reader, promotion, activation,
active dispatch, and startup recovery with zero provider, episode-creation, and
completion calls; no package append; byte- and branch-identical lifecycle
evidence; no drift on repeated failure; and successful resume after restoring a
canonical package. A canonical two-key package with a normal final newline and
formatted nonempty body, plus all valid quoted, unquoted, Unicode, URL, and
punctuation forms, must remain valid. All B1/B2/B3 regressions must pass.

#### B3-R2 repair evidence

Authoritative main design commit `d8a3687` was reconciled as merge commit
`3905aa1fbed08d3f30c04917a7b45b780a1427c4`, preserving the promoted future
folder deletion, rejected history, and unrelated dirty B4 fixture. The one shared
package reader now reads the raw UTF-8 file, validates its exact structure and
bounded scalar contract, and only then applies the existing injected-text trim.
No call site gained a separate validator.

Unit coverage exercises space- and tab-indented opening/closing delimiters,
opening/closing suffix whitespace, and a leading blank line at readiness,
implement-spec promotion, activation, repeated active dispatch, expectation
recovery, and completing recovery. It proves zero episode-creation and completion
calls, no package append, byte- and branch-identical lifecycle evidence, stable
repeated failure, and canonical restore/resume. The canonical restore includes a
normal final newline, formatted body indentation, and accepted Unicode, URL, and
internal punctuation. Native active, promotion, and recovery coverage makes zero
provider calls for all 18 invalid mode/form combinations and accepts all three
canonical mode cases with kernel/package `1/1` and byte-identical expectation.

Focused gates passed 55 Node tests and ten Python tests. Full gates passed 128
Node tests and 280 Python tests plus seven subtests with 11 existing warnings.
Independent read-only review returned PASS with the B4 fixture explicitly
excluded. User-global apply/check passed, and fresh installed active, promotion,
and recovery probes reproduced the 18 fail-closed and three valid outcomes.
`git diff --check` passed. The repaired exact commit still requires fresh owner
and Astra review before B4 or Slice 2.

### B3-R2 accepted; B4 is the next P0

Owner/expert disposition for exact
`dc439d479497afa3103bf325820c26089f3d5bfc` is **ACCEPTED**. Owner review
verified exact local/remote identity, the six-path repair scope, 55 focused Node
tests, and ten focused Python tests. Fresh Astra/max exact-commit review returned
PASS with no findings; its report is
`/Users/jlanders/.prime/agent/session-artifacts/01a0ba54-da05-76bd-8d22-a0facfdd7f31/sub-95061e2e/b3r2-exact-review.md`.
Accepted bounded checkpoints are B1 `e225bb4`, B2 `aff3b819`, and the complete
repaired B3 `dc439d4`. Slice 1 remains blocked only on B4 and fresh final
owner/Astra review of the complete candidate.

The next P0 is the already approved B4 native isolation and cleanup repair from
the `dff6dc7` review and owner ledger. Integrate the preserved dirty fake-daemon
fixture. Every checked-in publication/session-start recovery test, including the
separate legacy publication test in `tests/test_reviewed_plan_extension.py`, must
install and verify fake-only transport inside the runtime before any lifecycle
mutation. Alternatively, move a truly live operator-gated path outside the
automated suite with explicit labeling. No unrestricted automated publication
may remain.

For every create, prompt, and acknowledgment command, assert the exact hard-coded
fake destination route, ordered command IDs, and steer/follow-up flags rather
than only the returned identity. Register cleanup for the exact created worktree,
branch, socket/daemon, and fixture state before the first assertion that can fail.
Add intentional post-creation assertion-failure evidence proving cleanup. The
suite must not require a reviewer-supplied guard or contact a user daemon. Retain
all B1/B2/B3 behavior. Shared handoff, Slice 2, owner checkout, credentials,
retired sessions, and stash provenance remain excluded.

#### B4 implementation evidence

The preserved legacy publication fixture is now integrated. Its generated runtime
installs a protocol-7 Unix-socket fake, verifies the exact socket and patched
`net.Socket.connect` before its session-start handler mutates lifecycle state,
and rejects any other transport destination. The main native discovery,
completed-generation, lifecycle-classifier, and completing-recovery probes use
the same pre-event fake-only boundary. No checked-in automated publication or
recovery path relies on an inherited user-daemon route. The subprocess harness
also strips inherited internal worker, recursive-agent, lease, and kernel-owner
routing state before adding only explicit test socket/registry bindings, so the
same gate is portable to a nested reviewer runtime.

Native traces now assert the exact fake active route, ordered create/prompt/ack
sequence, unique command and acknowledgment IDs, protocol/client envelope,
acknowledgment binding, and handoff `steer`/`queueIfBusy: false` followed by
execute `followUp`/`queueIfBusy: true`. Worktree, branch, daemon/socket, session,
and lifecycle-state cleanup is registered before publication or recovery and is
idempotent. A dedicated test creates all resources, intentionally fails an
assertion after creation, and proves exact worktree, branch, socket, and fixture
state removal.

Focused native/legacy coverage passed six tests; the complete reviewed-plan and
native Python files passed 15 tests. The maintained gates passed 128 Node tests
and `pytest -q tests` passed 281 tests plus seven subtests with 11 existing
warnings. User-global
apply/check and `git diff --check` passed. Documentation records the fake-only
native validation boundary. An independent child-runtime review first blocked on
ambient routing and incomplete session-cleanup proof; both remediations landed,
the exact child-runtime six-test gate passed, and the reviewer returned PASS with
no remaining B4 blocker. B1, B2, and repaired B3 behavior remains green, and
shared handoff, Slice 2, owner checkout, credentials, retired sessions, and stash
provenance remain untouched. Exact B4 commit `fe8be5332c721a4c4891a23491c00a50e0f58c7f` received a
final owner **REVISE for evidence/plan accuracy only** disposition; its accepted
implementation and tests remain unchanged.

### B4-R1 evidence/plan accuracy repair

Final owner review of exact
`fe8be5332c721a4c4891a23491c00a50e0f58c7f` returned **REVISE for
evidence/plan accuracy only**. The accepted B4 implementation and tests must not
change. Owner reruns passed the exact B4 gate 15/15 and full Node 128/128. The
maintained Python acceptance command is `pytest -q tests`; it passed 281 tests
plus seven subtests with 11 warnings.

The active plan had still described root `pytest -q` as the Python acceptance
gate. An exact-archive root run instead produced 287 passes plus seven subtests,
36 failures, and ten setup errors. Every failure/error was under historical
`scripts/archive/phase1/tests` and expected nonexistent duplicated
`scripts/archive/phase1/scripts/...` paths. This diagnostic must remain visible;
it is not evidence that the maintained 281-result fulfilled the literal root
command.

B4-R1 reconciled authoritative main `d1c491e` in the candidate merge while
preserving the promoted future-folder deletion, accepted B1-B4 history, and
`stash@{0}`. This repair changes only evidence/plan accuracy: `pytest -q tests`
is the maintained acceptance suite, while root `pytest -q` is the separate known
historical archive diagnostic with the exact outcome above. Fresh post-merge
validation passed `pytest -q tests` with 281 tests plus seven subtests and 11
warnings. The first Node run overlapped that Python run and hit the known
lock-helper timing timeout at 127/128; the exact case then passed 1/1 in
isolation and a serial full rerun passed 128/128. `git diff --check` and the
documentation contracts in the maintained Python suite passed, and the complete
candidate differs from accepted B4 only in this active plan. Do not change
global pytest discovery, repair historical Phase 1 archives, edit B4 implementation/tests/docs
beyond the plan record, or begin Slice 2. Acceptance requires truthful exact
commands and outcomes, maintained Python 281 plus seven and Node 128 remaining
green, diff/docs checks passing, a clean pushed candidate, and fresh complete
Slice 1 owner/Astra review.

### R1/R2 coupled final Slice 1 repair is the next P0

Fresh final Astra review of complete Slice 1 exact
`dd2103a265e7a081a26ec90fab6bf78cff111315` returned **BLOCK**. Reviewer
`openai-codex/gpt-6-astra` at reasoning `max`, child `sub-ab6e60f9`, recorded
the full actionable report at
`/Users/jlanders/.prime/agent/session-artifacts/01a0ba54-da05-76bd-8d22-a0facfdd7f31/sub-ab6e60f9/slice1-final-exact-review.md`.
The installed identity/package design, bounded-role precedence, B3 grammar, B4
fake-only isolation, and ordinary-conversation behavior remain accepted. Repair
R1 and R2 together before any Slice 2 work.

#### R1 — P1: recover the writer's inactive completing checkpoint

The ordered completion writer can durably leave one exact `completing` receipt,
a matching inactive marker, and the retained matching expectation when identity
removal fails after inactive append. Startup currently rejects the expected
inactive marker before considering the completing receipt, so it makes zero
recovery/provider calls and strands a checkpoint that the direct finalization
helper accepts. The shared classifier must recognize every sole exact completing
checkpoint emitted by the writer and route it through the existing transaction
lock plus terminal-fact coordinator. Recovery must use no provider call, second
confirmation, duplicate inactive marker, evidence deletion, or other-generation
mutation. An inactive marker plus expectation without the exact matching
`completing` receipt remains invalid.

Acceptance must use the real writer with one-time failures after the completing
write, inactive append, expectation removal, and completed write, for both
`merged` and `abandoned`. It must retain blockers for authorized-plus-inactive,
completed-plus-reappearing-expectation, stable-binding mismatch, orphan/cross-
generation state, and old completing beside a newer active generation. Lock,
terminal-fact, readiness, and identity failures must preserve retryable evidence.
Repeated startup and completion replay must be monotonic and must not reconfirm,
rewind, duplicate inactive markers, or affect a later active generation.

#### R2 — P2: validate stable expectation/receipt agreement before recovery mutation

With the marker absent, a same-generation expectation and receipt can disagree
on stable identity while classification selects receipt-marker recovery without
a direct comparison. Startup then appends the wrong marker and success message;
later classification blocks, and correcting the original receipt alone cannot
recover because append-only contradictory evidence remains. Classification must
stay read-only and compare every stable expectation/receipt field before
selecting or appending recovery: owner, generation, source, session file, branch,
worktree, session name, identity version, and admission. Mutable active route
remains excluded.

Any stable conflict must produce zero append, message, callback, or provider
calls and byte/branch-identical evidence across replay. Correcting only the
original receipt must then permit exactly one normal recovery. Preserve foreign
history, legacy migration, completed-old/current-active behavior, route refresh,
and all accepted B1-B4 gates. Repair this before broadening R1 recovery so an
invalid receipt can never become durable marker evidence.

#### Coupled R1/R2 repair outcome

The repair generation reconciled authoritative main `5edc73e` in merge commit
`37f66b8` and carried its R1/R2 additions into the promoted active specification
and plan while keeping the future bundle deleted. The shared lifecycle classifier
now validates same-generation expectation/receipt stable bindings before recovery
selection, including a foreign-owner receipt that collides with the exact current
generation; unrelated foreign history remains inert. It compares owner,
generation, source, canonical session file, branch, canonical worktree, session
name, identity version, and admission while excluding the mutable active route.
The expected-generation truth table now selects locked completing recovery for an
exact inactive marker only when the matching receipt is `completing`; all adjacent
inactive, authorized, completed, orphan, mismatch, and cross-generation blockers
remain fail-closed.

Coverage adds byte/branch-identical conflict replay for every stable field,
correction of only the original receipt followed by exactly one recovery, and an
explicit mutable-route positive case. A registered extension test drives the real
completion writer through a one-time identity-removal failure, observes the exact
`completing` plus inactive plus retained-expectation checkpoint, and proves
provider-free recovery without another inactive append or confirmation. The
direct writer matrix injects one-time failure after each durable boundary for
both `merged` and `abandoned`, then proves monotonic completion and replay.

Evidence: the focused lifecycle Node set passed 77/77; the installed/plugin Python
set passed 38 tests plus seven subtests; user-global apply/check passed; the full
Node suite passed 131/131; and maintained `pytest -q tests` passed 281 tests plus
seven subtests with 11 warnings. Type loading, documentation contracts, and
`git diff --check` passed. An independent read-only implementation review checked
the complete source/test/doc diff against the Astra report, reran the 77-test
focused lifecycle set, and returned PASS with no blocking findings. The
separately recorded historical root diagnostic and
sanitized five-failure ambient baseline remain evidence debt, not repair scope.
The implementation awaits one exact pushed candidate and renewed complete Slice 1
owner/Astra review.

### R2-R1 residual path-equivalence repair is the next P0

Renewed final Astra review of exact
`886b71877ed163a7a02ba04bb92b76c36aaeb76b` returned **BLOCK** on one
residual R2 P2 finding, R2-R1. R1 is **CLOSED** and must remain a regression
gate rather than being reopened. Reviewer `openai-codex/gpt-6-astra` at
reasoning `max` recorded the full actionable report at
`/Users/jlanders/.prime/agent/session-artifacts/01a0ba54-da05-76bd-8d22-a0facfdd7f31/sub-4bcc582e/slice1-r12-final-exact-review.md`.

The residual seam is inconsistent path equivalence during marker recovery.
Expectation/receipt preflight accepts canonically equal session-file and
worktree spellings with `resolve()`, such as a redundant `/./` segment, but
`markerFromReceipt()` persists the receipt's raw spelling. The next
marker/expectation check uses raw equality, blocks after the marker and recovery
success message were appended, and leaves correction of only the receipt unable
to recover. Native and Node evidence reproduced the defect independently for
both path fields. Provider dispatch remains zero, but the required no-mutation
contract is violated.

Use one stable-binding path-equivalence rule across expectation/receipt
validation, current-marker validation, and the exact prospective reconstructed
marker. Validate the representation that will be persisted before any append or
success message, or reconstruct one coherent representation accepted by every
reader. Do not require paths to exist or use `realpath`; terminal paths may
legitimately be absent. Do not append then roll back, rewrite the expectation or
receipt, weaken nonpath bindings, include the mutable route, or change the exact
terminal receipt checks. Preserve foreign history, legacy migration, completed-
old/current-active behavior, package/kernel gates, closed R1, accepted B1-B4,
shared handoff behavior, global discovery, and the Slice 2 boundary.

Acceptance covers canonically equal session-file and worktree spellings
independently and together, with variants on either expectation or receipt, for
`authorized` and `completing`, missing and existing markers, and nonexistent
terminal paths. Every supported case must converge once. Any representation
rejected by policy must leave expectation/receipt bytes, branch, success-message
count, recovery callback count, and provider count unchanged across readiness,
context, and repeated registered startup. Genuinely different paths and all
nonpath stable mismatches remain zero-mutation blockers; correcting only the
original receipt permits exactly one recovery. Replay must not duplicate a
marker/message/confirmation, rewind, or affect another generation. Run registered
native equivalents, the closed R1 10-case real-writer matrix, and all lifecycle,
lock, package, route-refresh, legacy, foreign-history, cross-generation, and B4
regressions.

The fresh repair generation must first reconcile authoritative main `56610f4`
while preserving the promoted future-folder deletion, rejected history, accepted
B1-B4, closed R1, and `stash@{0}`. Optional Git default-branch fixture debt is
excluded. A fresh exact candidate requires renewed complete Slice 1 owner/Astra
review. Slice 2 remains blocked.

#### R2-R1 repair outcome

The bounded repair generation reconciled authoritative main `56610f4` in merge
commit `8d2d9d4`, promoted its canonical path-equivalence wording into the active
plan/specification, and kept the promoted future bundle deleted. R1 remains
**CLOSED**.

The lifecycle classifier now projects expectations, receipts, and markers into
one stable-binding shape. One shared comparator keeps owner, generation, source,
branch, session name, identity version, and admission exact; excludes the mutable
active route; and applies lexical `path.resolve()` equivalence only to session
file and worktree without checking existence. Missing-marker recovery constructs
and validates the exact prospective marker against both its receipt and any
current expectation before selection, then carries that already-validated object
to append. Existing-marker readers use the same rule, removing the prior
append-then-reject seam without rewriting durable records.

The acceptance matrix builds expectation, receipt, and current marker
independently. It covers normalized-equal session-file and worktree spelling
variants independently and together, with the variant on either expectation or
receipt, for `authorized` and `completing` states and missing and existing active
markers. Both terminal paths are proven nonexistent. A separate existing
inactive-marker case preserves closed-R1 recovery. Each positive case converges
once and replay adds no marker, recovery message, or callback. The existing
stable-conflict table continues to prove readiness/context/repeated-startup
zero-mutation rejection, correction-only recovery, strict nonpath fields, and
mutable-route exclusion.

Registered isolated Prime Agent runtime coverage exercises receipt-side
session-file and worktree variants for both states, reload replay, provider
counts, marker/message counts, and completed/authorized receipts. It performs no
recovery-time provider call. The closed R1 real-writer 10-case matrix and all
lifecycle, lock, terminal-fact, package, route-refresh, legacy, foreign-history,
cross-generation, and B4 regressions remain green.

Evidence: focused lifecycle Node passed 103/103; focused Python/plugin/native
passed 28/28; the complete maintained Python suite passed 282 tests plus seven
subtests with 11 warnings; and the complete Node suite passed 157/157 when run
serially. A concurrent Node/Python run passed 156/157 with only the already-known
load-sensitive two-second lock-helper timeout; the exact case and full serial
suite passed after Python ended. Global apply/check, final installed-copy check,
TypeScript loading, documentation contracts, and `git diff --check` passed. The
first independent review found a test-construction error that gave all
expectation-side artifacts the same spelling; after independent artifact
construction was added, a fresh read-only re-review returned PASS.

### Complete Slice 1 and README P3 accepted; Slice 2 is the next P0

Final owner/Astra review **ACCEPTED** exact
`b96a9feeb3177c52cdf0ac0d52e6b60f622b74cf`. R1 and R2-R1 are **CLOSED**.
The authoritative design `56610f4` and reconciliation merge `8d2d9d4` are
ancestors of the accepted candidate, and the promoted future bundle remains
absent. The admitted `openai-codex/gpt-6-astra` reviewer at reasoning `max`
returned PASS with no required findings. The immutable report is
`/Users/jlanders/.prime/agent/session-artifacts/01a0ba54-da05-76bd-8d22-a0facfdd7f31/sub-083077d9/slice1-r2r1-final-exact-review.md`.

Owner evidence passed Node 144 and Python 28. Final independent evidence passed
Node 157, the R1 native 10-case matrix, the original R2 native four cases, an
expanded 54-case native path matrix, and apply/check. The review independently
proved shared pre/post-reconstruction path equivalence, zero-mutation genuine
conflicts, receipt-only correction, replay convergence, closed R1, and the
complete Slice 1 regression surface. This acceptance does not authorize merge or
terminal cleanup; those remain operator decisions.

The optional P3 docs-only correction at `docs/README.md:47-48` is **ACCEPTED**
at exact `e5b92cc7b75c39f58414a6f4439730b2e5e8272c`. Only the active plan and
that index changed from accepted Slice 1; `src/`, `tests/`, and the linked
current oversight document remained unchanged. The corrected summary says every
independent project session defaults to CONVERSATION, with temporary exact-
session episode oversight and authority boundaries.

Owner acceptance independently verified exact local/remote identity and a clean
worktree, correct wording, the current-documentation contract 1/1 with nine tests
deselected, local links, and diff checks. No renewed EXPERT review was required
for this nonmaterial optional documentation correction.

The first bounded increment of the existing approved **Slice 2 — Project-
customizable oversight and owner-driven continuation** is **ACCEPTED** at exact
`7c4c41fab3bc4034680e29d7b2148c1efd363f8e`. It adds only the project EXPERT
policy, fail-closed reviewer procedure, focused contracts, and current docs.
The remaining approved owner-driven continuation work is Increment 2B and the
next P0 for a fresh execute generation. Preserve accepted Slice 1/P3/2A,
rejected history, operator-only merge/cleanup/product decisions, shared handoff
mechanics, credentials, retired sessions, and stash provenance. Do not begin 2B
or Slice 3 in this record-only generation.

That coupled repair generation first reconciled authoritative main `5edc73e`
while preserving the promoted-folder deletion, rejected history, accepted B1
`e225bb4`, B2 `aff3b819`, B3 `dc439d4`, and B4 `fe8be53`. The sanitized Python
five-failure ambient baseline remains evidence debt only and not repair scope.
Its exact candidate received the renewed complete owner/Astra review recorded
above. Do not change accepted behavior, global discovery, historical archives,
or begin Slice 2.

Increment 2B is the next P0 and begins only in a fresh execute generation.

## Slice 2 — Project-customizable oversight and owner-driven continuation

### Increment 2A — explicit EXPERT policy and fail-closed admission (**ACCEPTED**)

This bounded increment adds the approved project-versioned
`.prime/agent/profiles/expert-reviewer.md` with exact `name`, `model`, and
`thinking` policy; extends the canonical oversight skill with raw profile
validation, exact discovery, harmless-bootstrap admission, returned-model
verification, one combined role/packet delivery, actionable report validation,
evidence preservation, and exact reviewer retirement; adds focused positive and
negative profile/procedure contracts; and documents the current behavior. It
does not change host extensions, handoff transport, lifecycle state, shared
handoff semantics, or terminal authority. The remaining owner-driven
continuation guidance and extension/tests/docs work in this Slice stay pending.

Target-runtime `rlm.find_models` resolved exactly
`openai-codex/gpt-6-astra`. A real safe-protocol test spawn returned that model
for reviewer `sub-693f7326`; explicit `thinking=max` admission succeeded. The
reviewer initially BLOCKed three contract gaps; after coupled repair, its fresh
read-only re-review returned PASS with no material findings. The preserved
report is `/Users/jlanders/.prime/agent/session-artifacts/01a0cc01-70b0-75d4-8486-3d21b496380c/sub-693f7326/slice2-expert-policy-review.md`, and the exact
reviewer was deleted only after preservation.

Focused EXPERT contracts passed 5/5, focused Python identity/docs contracts
passed 15/15, focused Node oversight passed 58/58, maintained Python passed 287
plus seven subtests with 11 existing warnings, plugin installed-copy and current-
doc link checks passed, and `git diff --check` passed. The first two full Node runs each passed 156/157: the unchanged Slice 1
fatal-lock-helper test timed out instead of surfacing its mocked error; its
immediate isolated rerun passed 1/1 in 345 ms. A final full Node run passed
157/157, including that case in 165 ms. Owner exact-archive verification passed
Python 15/15, exact local/remote identity, a clean worktree, and the bounded five-
path diff. Exact Increment 2A `7c4c41fab3bc4034680e29d7b2148c1efd363f8e`
is accepted. No duplicate intermediate reviewer was required.

### Increment 2B — owner-driven continuation (next P0)

Complete only the remaining existing Slice 2 plan: finish canonical oversight
guidance for exact identity, watch, evidence, disposition, continuation, and
terminal return; change only model-facing `handoff_spec_episode` description,
parameters, and prompt guidelines so the exact owner may `advance` or perform an
in-scope `revise` from accepted recorded findings without a new operator transport
request; never weaken host owner, location, identity, quiescence, canonical-
prompt, uncertainty, or replay checks; add focused skill, reviewed-plan, and
sequential-cycle contracts; and update current oversight, future-bundle, and
handoff docs. Preserve the exact EXPERT policy from 2A, accepted Slice 1/P3,
operator authority, no arbitrary prompt routing, shared handoff mechanics,
credentials, retired sessions, rejected history, and stash provenance.

This generation selected the smallest coherent end-to-end Increment 2B slice:
canonical owner disposition/continuation/terminal-return guidance; model-facing
`handoff_spec_episode` continuation metadata; focused skill, reviewed-plan, and
same-owner sequential-cycle contracts; and the three current documents. The
extension diff is limited to `handoff_spec_episode` `description`,
`promptGuidelines`, and `guidance.description`; `promptSnippet`, schema shape,
execution body, `spec-episode.ts` host enforcement, and shared handoff mechanics
remain unchanged.

Focused Python passed 18/18 and focused reviewed-plan Node passed 26/26. The
sequential contract now completes an old episode, runs fresh native
`/implement-spec` for another reviewed folder in the same owner, and activates
that later episode. Maintained Python passed 290 plus seven subtests with 11
existing warnings; maintained Node passed 157/157. Three-document local-link,
plugin apply/check, and diff checks passed.

The first fresh exact-profile reviewer `sub-fd961d75` was admitted with returned
`openai-codex/gpt-6-astra` and successful explicit `thinking=max`; combined
validated role/task delivery `agentmsg_b8e1ad71-c665-43b8-9928-c1d69c78fb7d`
was delivered once. It began read-only inspection, then terminated aborted with
no `PASS` or `BLOCK`. The incomplete evidence is preserved at
`/Users/jlanders/.prime/agent/session-artifacts/01a0cc01-70b0-75d4-8486-3d21b496380c/sub-fd961d75/slice2b-expert-review-incomplete.md`; the task was not
resent, and the failed exact reviewer was retired.

Operator correction: a technically failed, terminal EXPERT that produced no
review disposition may be replaced under PROJECT_CONVERSATION authority without
new operator approval. A fresh post-handoff generation must first reconcile
authoritative main `4cbc856` while preserving the promoted future-folder
deletion and every current dirty Increment 2B path. It must then admit exactly
one fresh replacement with the identical validated profile, exact review packet,
`openai-codex/gpt-6-astra`, and `thinking=max` through harmless bootstrap and one
combined message. Never resend to the failed reviewer or use fallback. If the
replacement also fails, delivery is ambiguous, or required policy/access is
unavailable, pause for the operator. On a complete `PASS` or actionable `BLOCK`,
resume the paused Increment 2B goal and act only on that disposition; then finish
validation, plan/Bead evidence, one commit/push, and stop for owner review. Do not
begin another Increment 2B slice, Slice 3, merge, or cleanup.

Fresh continuation reconciled authoritative main in merge commit `6eecd54` while
preserving all nine dirty Increment 2B files byte-for-byte, the promoted
future-folder deletion, and `stash@{0}`. Replacement reviewer `sub-89769a48`
used the same validated profile/packet, returned `openai-codex/gpt-6-astra`,
and accepted explicit `thinking=max`; its one message was delivered without
resend or fallback. It returned actionable `BLOCK` B1/B2 against unchanged diff
SHA-256 `29e2896f7196279ab9b7eb8a216c822936dc3700a84fe01ecb9a714efab2239c`.
The complete report is preserved at
`/Users/jlanders/.prime/agent/session-artifacts/01a0cc01-70b0-75d4-8486-3d21b496380c/sub-89769a48/slice2b-increment2b-block-review.md`.

B1 found that the canonical procedure omitted the mandatory fresh final
exact-candidate EXPERT gate and review renewal after material repairs. B2 found
that its blanket report-failure escalation omitted the newly approved single
replacement for a confirmed terminal technical failure with no disposition.
Both were accepted as coupled in-scope policy-projection gaps. The repaired skill
and current oversight document now require a fresh exact-candidate final PASS,
reject intermediate/wrong-commit/incomplete/BLOCK evidence, invalidate prior
review after material repair, keep pause/abandonment available without a merge-
readiness claim, and keep PASS non-authoritative. They also durably consume at
most one same-profile/same-packet/model/reasoning replacement, with no allowance
reset across context refresh, no resend or BLOCK-shopping, and operator pause on
ambiguity, unavailable policy/access, or replacement failure.

The two new focused contracts failed before the repair, then passed. Repaired
focused Python passed 20/20; reviewed-plan Node passed 26/26; maintained Python
passed 292 plus seven subtests with 11 existing warnings; maintained Node passed
157/157. Three-document local-link, plugin apply/check, and diff checks passed.
Because B1/B2 changed the candidate materially, a renewed exact-profile review
was required. Initial renewed reviewer `sub-ea7630a8` used the exact
Astra/max policy and received combined packet `agentmsg_f5fe6364-681f-453b-990a-e891ef47ff4e` once, began
read-only inspection, then terminated with no usable disposition. The incomplete
attempt is preserved at `/Users/jlanders/.prime/agent/session-artifacts/01a0cc01-70b0-75d4-8486-3d21b496380c/sub-ea7630a8/slice2b-repaired-review-incomplete.md` and the exact reviewer is retired;
no resend occurred. This consumes the first attempt for the renewed packet.
The one authorized same-profile/model/reasoning/packet replacement
`sub-4cc31409` received combined packet
`agentmsg_af87181e-691f-4973-a7f7-38ac4063f904` once and returned `PASS` against unchanged repaired
diff SHA-256 `d12b7c2da09ddcacef2b3da4cedc8ab20d9563fb4a69312ab02564bf31b3eba7`.
It verified both B1/B2 repairs, the full bounded Increment 2B diff, metadata-only
host boundary, and focused evidence with no material finding. The complete report
is preserved at `/Users/jlanders/.prime/agent/session-artifacts/01a0cc01-70b0-75d4-8486-3d21b496380c/sub-4cc31409/slice2b-repaired-pass-review.md`. This PASS is review evidence only and grants
no merge authority. Final diff/installed-copy checks, one candidate commit/push,
and owner review remain; do not begin Slice 3, merge, or cleanup.

Owner review of exact pushed candidate
`b1db65a1084c907d537e14a0c5e4dee8bc249b82` returned `REVISE` on one bounded
2B-R1 protocol-ordering defect; all other accepted 2B semantics and evidence
stand. `handoff_spec_episode` is terminal routing, so the current instruction to
create the intended-generation watch after successful admission can leave the
continuation unmonitored because the owner cannot continue after that terminal
action.

**2B-R1 implementation status:** authoritative main `e646f0a` is reconciled by
merge `8d1ed8695770440f4516bf207f6d546b6d7d5d24`, preserving this owner
disposition, accepted history, exact reviewer artifacts, promoted future-folder
deletion, and `stash@{0}`. The authoritative specification wording was promoted
to the active specification while the future bundle remains deleted.

The canonical skill now cancels the old generation watch at the accepted idle
boundary, pre-arms exactly one non-steering intended-generation watch
immediately before terminal `handoff_spec_episode`, cancels it only on definite
no-admission failure, and retains it across success, partial admission, or
ambiguity until reconciliation. It explicitly rejects after-success creation,
duplicate watches, and uncertainty retry. The three current docs state the same
ordering without changing host checks or shared handoff mechanics. Focused
contracts cover every ordering branch and failed 2/2 before repair, then passed
2/2 after repair. Accepted profile/replacement/final-review/continuation
semantics remain unchanged.

Validation is green: the new focused ordering/doc contracts failed 2/2 before
repair and passed 2/2 after; the complete focused Python set passed 20/20;
reviewed-plan Node passed 26/26; maintained Python passed 292 plus seven subtests
with 11 existing deprecation warnings; maintained Node passed 157/157; plugin
apply/check and `git diff --check` passed.

Initial renewed reviewer `sub-c318f244` received packet
`agentmsg_d11f2099-0bd2-44e3-b6f3-0adc276ac51c` once, asked whether read-only Git inspection was
allowed, and terminated without `PASS`/`BLOCK`; no resend or steer occurred. Its
incomplete evidence is `/Users/jlanders/.prime/agent/session-artifacts/01a0cc01-70b0-75d4-8486-3d21b496380c/sub-c318f244/slice2b-r1-review-incomplete.md`. The one authorized same-profile,
same-model/reasoning, same-packet replacement `sub-abed98b9`
received packet `agentmsg_debd82e0-947b-4fde-9c81-1027f8cd4ef6` once. After one narrow clarification
that read-only inspection was permitted but mutation remained forbidden, it
returned `PASS` on unchanged six-file snapshot SHA-256 `f2f3f01f672a7f9006acb3adc0363c5e4dcd600e0064b031cd8c756c997a42f6` with
no material finding. The complete report is `/Users/jlanders/.prime/agent/session-artifacts/01a0cc01-70b0-75d4-8486-3d21b496380c/sub-abed98b9/slice2b-r1-pass-review.md`. PASS is evidence
only, not merge authority or live activation proof.

Owner accepted exact pushed 2B-R1
`8b9f5b6fd048e582efbcaefd2693830e3008eac0`. The repaired watch ordering and
all previously accepted Increment 2B semantics now stand; this acceptance does
not authorize Slice 3, terminal merge, cleanup, or another 2B increment.

**Shared probe-isolation integration:** accepted origin/main exact
`624f85612d3172ad559b369502ddbc5fae4d7be4` was integrated by a normal
non-rewriting merge whose parents preserve accepted 2B-R1 exact
`8b9f5b6fd048e582efbcaefd2693830e3008eac0` and the upstream fix. The upstream
delta is exactly `AGENTS.md`, `scripts/run-prime-agent-probe.sh`, and
`tests/test_prime_agent_probe_isolation.py`; it prevents config-mutating native
probes from reaching user-global settings.

Validation is green: targeted isolation passed 2/2; maintained Python passed
294 plus seven subtests with 11 existing deprecation warnings; maintained Node
passed 157/157; plugin-copy integrity and `git diff --check` passed. Exact path
and semantic audits confirm no oversight skill, plugin source, host extension,
current oversight docs, shared-handoff mechanics, or 2B-R1 behavior changed.
The merge used no rebase, force, or history rewrite. Next amend only this durable
evidence into the local merge candidate, push that one candidate, and stop for
owner review. Do not begin Slice 3, terminal merge, cleanup, another increment,
or unrelated work.

**Working capability:** the active exact-session owner has one canonical procedure for
watching, reviewing, revising, continuing, and finally presenting its exact
episode. Every EXPERT review uses the explicit project profile and exact
operator-authorized model rather than an inherited default, while existing host
capabilities enforce deterministic transport and identity safety.

### Changes

1. Add `.prime/agent/profiles/expert-reviewer.md` with the reviewed exact model
   selector, reasoning level, and stable read-only exact-commit review role.
2. Extend and validate the Slice 1 `.ralph/skills/oversee-episode/SKILL.md`
   with EXPERT and owner-driven continuation guidance for:
   - retaining the exact returned identity and current work generation;
   - creating and cancelling one bounded agent-owned heartbeat per admitted
     generation;
   - reconciling session, branch, exact commit, diff, tests, docs, plans,
     beads, and worktree evidence;
   - choosing `advance`, `revise`, `consult`, or `pause`;
   - recording durable findings in the owning specification, plan, bead,
     code/tests, or linked immutable review report;
   - loading and validating the EXPERT profile, resolving only its exact model
     selector, and spawning a fresh read-only reviewer at the configured reasoning
     level with the repository's safe RLM admission protocol;
   - recording reviewer identity, exact commit, admitted model/reasoning policy,
     and disposition, with fail-closed operator escalation on unavailability;
   - requiring each BLOCK finding to give a recommended repair direction,
     constraints, acceptance tests, regression risks, and repair dependencies
     without dictating exact code;
   - calling `handoff_spec_episode` only for the exact owned, idle episode and
     accepted in-scope continuation;
   - renewing final EXPERT review after material repairs;
   - presenting merge, revision, pause, or abandonment to the operator before
     terminal Git/session cleanup; and
   - cancelling episode-specific observation, clearing exact oversight state,
     and returning the same conversation to discussion/specification incubation.
3. Change only the model-facing `handoff_spec_episode` description, parameter
   text, and prompt guidelines in
   `src/prime-agent-plugin/extensions/reviewed-plan.ts`. Do not weaken or bypass any
   check in `src/prime-agent-plugin/extension-support/spec-episode.ts`.
4. Add `tests/test_oversee_episode_skill.py` for the skill's authority,
   observation, evidence, review, continuation, cleanup, return-to-incubation,
   and sequential-cycle boundaries. It must also prove that the checked-in
   EXPERT profile names an exact selector and reasoning level; the skill requires
   exact discovery, explicit spawn arguments, bootstrap-then-message delivery,
   model/reasoning evidence, and fail-closed behavior with no fallback language.
5. Update `tests/reviewed_plan_extension.test.mjs` and
   `tests/test_reviewed_plan_extension.py` to prove the new owner-driven
   guidance, reject stale wording that requires a new operator request or
   restricts all optional guidance to operator-authored prose, and show that the
   same owner session can later arm a different reviewed future folder through a
   new native `/implement-spec` run rather than becoming lifetime-locked to the
   first episode.
6. Update `docs/conversation-driven-episode-oversight.md`,
   `docs/future-specification-bundles.md`, and `docs/handoff-chain.md` with the
   existing conversation compatibility, exact episode-continuation authority,
   watch lifecycle, explicit EXPERT model policy and unavailability behavior, return
   to pre-episode incubation, and unchanged host failure semantics.

### Verification and checkpoint

- Run the focused identity, package, skill, and reviewed-plan tests.
- Resolve the checked-in selector to exactly `openai-codex/gpt-6-astra` in the
  target runtime and prove a test spawn accepts `thinking=max`; do not perform a
  substitute spawn if this check fails.
- Run all Node extension tests to prove `/handoff`, `/plan`,
  `/implement-spec`, bootstrap admission, legacy identity handling, and
  at-most-once continuation remain unchanged.
- Run the relevant Python contract tests.
- Append the exact evidence and commit to `prime-claw-h6w.22`.
- Commit and push the slice. Suggested commit:
  `feat: add conversation-owned episode oversight`.

Slice 3 begins only after both code slices are pushed and their focused suites
are green.

## Slice 3 — Isolated live dogfood and acceptance record

**Working capability:** a fresh default CONVERSATION project
conversation takes one already reviewed disposable bundle through admission,
observation, exact-commit review, owner-driven continuation, final EXPERT review,
explicit operator disposition, and conservative cleanup, then remains available
for ordinary project conversation without touching the canonical checkout.

### Setup and operator gate

1. Create a disposable local Git repository with a local bare remote. Copy only
   the candidate plugin resources, canonical Ralph skills, and one minimal
   already reviewed two-generation future bundle into it. Do not copy
   credentials, host-global state, private transcripts, or unrelated repository
   data.
2. Launch two fresh durable sessions in the fixture root without a role flag;
   verify each receives one default identity kernel, retains distinct UUID-bound
   state, and follows the existing `prepare` skill without a separate
   extension-generated startup turn.
3. Confirm ordinary project discussion and the existing phase skills remain
   available, without re-dogfooding their already delivered authoring and
   planning behavior.
4. Stop for the operator to issue the fixture's native
   `/implement-spec <future-folder>` command. Neither the role nor this execution
   plan substitutes for that operator gate, and the test must not call
   `create_spec_episode` directly.

### Dogfood flow

1. Retain the returned episode identity and observe bootstrap with one bounded
   heartbeat. Record that handoff-first admission and work completion remain
   distinct claims.
2. Reconcile the first exact pushed commit and obtain focused independent review.
3. Accept or revise it on evidence, update the fixture's durable review record,
   and invoke `handoff_spec_episode` without another operator transport request.
4. Cancel the completed generation's watch and create one new bounded watch for
   the admitted continuation.
5. Reconcile the complete exact candidate and obtain a fresh final EXPERT review
   using the checked-in exact selector and reasoning level. Record the admitted
   model and reasoning policy against the reviewed commit. Repair and renew
   review if any material finding remains; pause rather than substituting another
   model if required review is unavailable.
6. Present the exact candidate to the operator for `approve merge`,
   `request revision`, `pause`, or `abandon`. Perform only the chosen terminal
   action. Verify session stop and owned worktree cleanup; preserve anything
   dirty, ambiguous, or uncertain.
7. Confirm no fixture heartbeat, episode session, worktree, or branch was removed
   unless it belonged to this run, and confirm the canonical prime-claw checkout
   was untouched. Keep the owning project-conversation session alive.
8. In that same assigned conversation, return to ordinary project discussion
   and verify the existing phase skills remain visible and a different reviewed
   future folder could later be passed through a fresh `/implement-spec` gate.
   Do not manufacture a second specification, plan, or episode merely to retest
   capabilities outside this feature's implementation scope.

### Durable evidence and checkpoint

- Write a concise, sanitized point-in-time record at
  `reports/reviews/conversation-driven-episode-oversight-dogfood.md`. Include
  session/episode identities, exact commits, admission receipts, watch start and
  cancellation, test results, EXPERT session/model/reasoning evidence, review
  dispositions, operator decision, cleanup verification, return to ordinary
  conversation without a stale episode lock, and any observed friction. Do not
  treat the report as canonical policy or ingest it into a brain.
- Link the evidence from `docs/conversation-driven-episode-oversight.md` and
  update the living specification only if the run changes a durable product
  requirement.
- Run the maintained repository gates:
  - `node --test tests/*.test.mjs`
  - `pytest -q tests`
  - `git diff --check`
  - relative-link validation used by the existing documentation tests.

Do not call a root-level `pytest -q` result a passing maintained gate. Root
collection also discovers historical `scripts/archive/phase1/tests`, whose
archived path assumptions are independently broken; if that broader diagnostic
is run, record its result separately from the maintained `tests/` acceptance
suite rather than hiding or conflating it.
- Append final evidence to `prime-claw-h6w.22`; close it only when all acceptance
  criteria pass.
- Commit and push the evidence/docs slice. Suggested commit:
  `test: dogfood conversation episode oversight`.

This slice requires live operator interaction at the native promotion and final
disposition gates. If the operator is unavailable, pause rather than simulating
approval.

## Final review and delivery gate

After Slice 3, the owning project conversation must:

1. verify the exact outer feature-branch candidate and all three pushed slice
   commits;
2. confirm the selected specification and this plan still describe the shipped
   behavior;
3. obtain a fresh independent EXPERT review of the complete exact commit using
   the reviewed project profile, and record the exact admitted model and
   reasoning level;
4. adjudicate every finding and renew review after any material repair;
5. run the full Node and Python suites again if the candidate changes; and
6. present the exact merge candidate to the operator.

Only explicit operator approval permits merge. After the chosen terminal action,
follow the existing conservative session/worktree cleanup procedure and verify
`git status`, branch state, remote synchronization, and Beads synchronization.

## Dependencies

- Slice 1 depends only on the delivered Prime Agent extension/session APIs.
- Slice 2 depends on Slice 1 and the existing exact-owner continuation
  capability.
- Slice 3 depends on Slices 1 and 2 and requires only the operator's native
  fixture promotion and final disposition gates; it does not repeat existing
  specification or planning acceptance work.
- Final delivery depends on a passing fresh EXPERT review of the complete exact
  candidate.

No dependency requires an upstream Prime Agent change.

## Explicit non-goals

Do not add or design:

- a conversation, specification-authoring, specification-review, planning, or
  plan-review controller;
- wrappers or replacements for `/prepare`, `/design`, `/spec-it-out`, `/plan`,
  or `/implement-spec`;
- implicit role inference from CWD;
- a universal-agent orchestrator or general sibling launcher;
- a role registry, rebinding framework, or general preset system;
- host enforcement of one-active-episode policy;
- lifecycle databases, generalized state machines, event buses, leases,
  schedulers, or notification services;
- conversational implementation promotion;
- generic remote commands or free-form prompt routing;
- dedicated reviewer, merge, abandonment, cleanup, or status services;
- automatic strongest-model ranking, implicit default-model fallback, or a
  general model router;
- a product-wide hard-coded GPT-6 Astra default outside this project-customizable
  reviewed profile;
- automatic replay after uncertain admission;
- automatic merge, abandonment, cleanup, scope expansion, or product decisions;
  or
- changes to native `/handoff`, `/plan`, or `/implement-spec` authority.

Any additional mechanism needs evidence from Slice 3 or later dogfood and a
separately reviewed specification change.
