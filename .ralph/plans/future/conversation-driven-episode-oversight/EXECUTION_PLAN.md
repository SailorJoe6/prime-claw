# Execution Plan — Conversation-driven episode oversight

> **Status:** future execution plan awaiting operator review.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Tracking bead:** `prime-claw-h6w.22`
> **Implementation authority:** none until the operator separately invokes
> `/implement-spec .ralph/plans/future/conversation-driven-episode-oversight`.

## Outcome

Deliver the smallest plugin release that orients an explicitly launched
`PROJECT_CONVERSATION` with the existing `prepare` skill and leaves its normal
conversation, specification, and planning behavior untouched. Once the operator
uses the existing `/implement-spec` boundary, the role oversees at most one exact
owned episode at a time and returns to ordinary project discussion afterward.

The implementation is concentrated on episode oversight. It reuses the delivered
conversation behavior, phase skills, episode identity, bootstrap, handoff,
observation, Git, and cleanup mechanics. It adds no conversation engine,
generalized orchestrator, or lifecycle service.

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

Do not redesign, wrap, or repeat the existing conversational work. Treat it as a
compatibility surface: the new role may orient it with `prepare` but must not
intercept or narrow it. The implementation bead remains open and unclaimed until
an implementation episode begins.

## Implementation design fixed by this plan

### Explicit role binding

Prime Agent 0.9.5 has system-prompt files and extension hooks but no native
resident-session profile resource that a durable sibling launcher can select.
Its example `.prime/agent/agents/*.md` convention belongs to an optional
subprocess-agent extension and is not automatically applied to daemon siblings.

Implement the first release with these narrow project-plugin resources:

- `.prime/agent/profiles/project-conversation.md` contains the short role
  invariants from the specification, including running the existing project
  `prepare` skill before substantive work;
- `.prime/agent/extensions/project-conversation.ts` registers the explicit
  boolean launch flag `--project-conversation`;
- explicit assignment appends one versioned custom session entry containing
  `role: "PROJECT_CONVERSATION"` and the exact assigned session ID;
- `session_start` restores the assignment only when the stored session ID
  equals `ctx.sessionManager.getSessionId()`;
- `before_agent_start` adds the current profile to the effective system prompt
  for an assigned session; and
- a missing or unreadable assigned profile fails closed instead of silently
  running the session without its role invariants.

Preparation remains existing skill policy, not a new autonomous startup turn.
The profile requires the first substantive agent turn to inspect and follow the
project's `prepare` skill before continuing. The extension must not queue a
separate `session_start` user message or duplicate Prime Agent's preparation
machinery; that would reintroduce the known RLM startup-admission race.

The session-ID binding is required because episode and ordinary session forks
may inherit custom entries. An inherited marker for a different session ID must
not activate the role. A session without the flag or its own matching marker is
ordinary even when its CWD is the project root. The role marker records only the
long-lived conversation role; it must not encode conversational phase state, one
episode location, or become spent when an episode terminates. Do not add role
discovery from CWD, a global
role registry, a rebinding command, or a general preset system.

The extension should read the profile through the project resource path on each
agent-run boundary, or otherwise reload it through the normal extension reload
path, so a supported resource reload does not leave stale role text. Apply the
profile once per agent run, not once per tool or model call. Preserve other
extensions' chained `event.systemPrompt` content.

### Policy and authority

Add one project-customizable `.ralph/skills/oversee-episode/SKILL.md`. The
profile states enduring whole-conversation invariants and points to the skill;
the skill owns the detailed semantic procedure only while an episode is active.
It must return the conversation to incubation after terminal disposition rather
than ending, clearing, or narrowing the `PROJECT_CONVERSATION` role. Neither
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
The role profile, skill, and continuation guidance do not grant merge,
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

The Markdown body contains only the stable reviewer role: inspect one exact
commit read-only, report structured PASS/BLOCK findings with evidence, do not
edit or steer the subject, and return the result to the owning conversation.
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
6. preserve the reviewer session identity, exact commit, model selector,
   admitted reasoning level, and final disposition with the review evidence;
   and
7. stop and delete the fresh reviewer after its findings are preserved.

A missing or malformed profile, no exact model match, unsupported reasoning
level, unavailable credentials, or failed spawn blocks a required review. Do not
retry with a different model, inherit the conversation default, or weaken the
gate. Report the exact failure and pause for operator authorization or external
repair. Never inspect credential stores while diagnosing availability.

This is policy executed by the existing skill and RLM APIs. Do not add an EXPERT
registry, model-ranking service, general model router, or new host capability.

## Slice 1 — Launchable, identity-bound project-conversation role

**Working capability:** a user can launch Prime Agent explicitly with
`--project-conversation`; it begins with the existing project `prepare`
orientation, and the effective system prompt retains only the small role
invariants across reload and resume. An unassigned session or inherited fork
remains ordinary, while existing discussion, `/spec-it-out`, `/plan`, and
`/implement-spec` entry paths remain unchanged.

### Changes

1. Add `.prime/agent/profiles/project-conversation.md` with only the stable
   invariants enumerated by the specification.
2. Add `.prime/agent/extensions/project-conversation.ts` implementing the
   explicit flag, versioned session-local marker, exact-session restoration,
   fail-closed profile loading, and chained `before_agent_start` prompt overlay.
3. Add focused behavioral coverage in
   `tests/project_conversation_extension.test.mjs` for:
   - extension factory and flag registration;
   - no implicit activation from project CWD;
   - explicit first-launch assignment, profile inclusion exactly once per agent
     run, and a first-turn requirement to follow the existing `prepare` skill;
   - no autonomous `session_start` message or duplicate preparation turn;
   - same-session resume and extension reload;
   - rejection of a marker inherited by a different fork/session ID;
   - coexistence with an earlier system-prompt overlay;
   - no command or active-tool narrowing by the role extension;
   - role persistence independent of any one episode identity; and
   - missing-profile failure without silent role loss.
4. Add a narrow source/resource contract test in
   `tests/test_project_conversation_extension.py` so packaging or path changes
   cannot omit the profile or turn it into an ordinary prompt template.
5. Add `docs/conversation-driven-episode-oversight.md` describing explicit
   launch, startup preparation, identity binding, system-prompt behavior, the
   existing conversational compatibility surface, and the separation between
   the profile, temporary episode-policy skill, and trusted mechanics. Link it
   from `docs/README.md`.

### Verification and checkpoint

- Run the new Node and Python tests plus the existing reviewed-plan and episode
  extension tests.
- Start a disposable session with the flag, observe the role marker and
  effective prompt through the extension test harness, then verify a simulated
  fork does not activate it.
- Append the exact test results and commit to `prime-claw-h6w.22`.
- Commit as one reviewable slice and push the episode branch. Suggested commit:
  `feat: add explicit project conversation role`.

Slice 2 depends on this role boundary. Do not combine its oversight procedure
into the profile merely to reduce file count.

## Slice 2 — Project-customizable oversight and owner-driven continuation

**Working capability:** the assigned owner has one canonical procedure for
watching, reviewing, revising, continuing, and finally presenting its exact
episode. Every EXPERT review uses the explicit project profile and exact
operator-authorized model rather than an inherited default, while existing host
capabilities enforce deterministic transport and identity safety.

### Changes

1. Add `.prime/agent/profiles/expert-reviewer.md` with the reviewed exact model
   selector, reasoning level, and stable read-only exact-commit review role.
2. Add `.ralph/skills/oversee-episode/SKILL.md` with progressive-disclosure
   guidance for:
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
   - calling `handoff_spec_episode` only for the exact owned, idle episode and
     accepted in-scope continuation;
   - renewing final EXPERT review after material repairs;
   - presenting merge, revision, pause, or abandonment to the operator before
     terminal Git/session cleanup; and
   - cancelling episode-specific observation and returning the still-assigned
     conversation to discussion/specification incubation after terminal work.
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

- Run the focused profile, skill, and reviewed-plan tests.
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

**Working capability:** a fresh explicitly assigned and prepared project
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
2. Launch a fresh durable session in the fixture root with
   `--project-conversation`; verify explicit identity binding and that the first
   substantive turn follows the existing `prepare` skill without a separate
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
