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
follow-ups, tool continuation, reload, resume, and cancellation.

Add one narrow two-phase `finalize_spec_episode` capability. Its authorize phase
accepts the exact location and `merged`/`abandoned` disposition, obtains explicit
operator UI confirmation, and persists an exact owner/episode receipt without
performing terminal work. After the skill-guided ordinary Git/session/worktree
sequence, its completion phase requires that receipt, validates conservative
terminal facts, appends inactive state, and clears only the matching expectation
without a second confirmation. Ambiguity leaves all state available for repair.
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

B2–B4 remain deliberately incomplete and outside this commit. Preserve the
unstaged B2 import-only change in `episode-finalization.ts` and the unstaged,
unintegrated B4 fake-daemon fixture in `tests/test_reviewed_plan_extension.py`.
The next P0 is B2 lock reliability, followed by B3 bounded scalar grammar and B4
native isolation/cleanup. Do not touch shared handoff scheduling, quiescence,
Slice 2, owner checkout, credentials, or retired leaked sessions.

Slice 2 remains blocked until this exact replacement commit is accepted.

## Slice 2 — Project-customizable oversight and owner-driven continuation

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
   `.prime/agent/extensions/reviewed-plan.ts`. Do not weaken or bypass any
   check in `.prime/agent/extension-support/spec-episode.ts`.
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
- Run the full repository gates:
  - `node --test tests/*.test.mjs`
  - `pytest -q`
  - `git diff --check`
  - relative-link validation used by the existing documentation tests.
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
