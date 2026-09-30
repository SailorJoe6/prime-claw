# Execution Plan — Plugin-global goal and heartbeat work control

> **Status:** REVIEWED EXECUTION PLAN — operator approved on 2026-09-29. Plan approval does not authorize implementation; `/implement-spec .ralph/plans/future/goal-heartbeat-work-control` remains required.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Selected future folder:** `.ralph/plans/future/goal-heartbeat-work-control/`
> **Parent workstream:** `prime-claw-h6w` (Phase 4 episode loop)

## Outcome

Replace Prime Claw's model-facing pause/resume transport with one capability-gated, per-run system-policy contribution. A compatible agent uses bounded goal epochs for active work, exact RLM heartbeats for observable waits, and a fresh goal only when terminal evidence leaves substantive agent work. Human blockers end the compatible epoch without polling the person.

The release must remove `pause_thread_goal`, `resume_thread_goal`, and every managed agent-injected `/goal pause` or `/goal resume`; preserve human native goal commands; survive project `APPEND_SYSTEM.md` shadowing without persistent message copies; and prove both prompt delivery and real lifecycle behavior before it is called active.

Deliver this in six dependency-ordered vertical slices. No slice may modify Prime Agent core, add private-runtime patches, duplicate the policy into Ralph `/execute`, or silently weaken an acceptance criterion when a public seam fails.

## Planning readiness verdict

The reviewed specification is adequate to plan. It records the policy lineage, operator-observed incidents, accepted semantics, compatibility predicate, migration limits, concurrency and failure rules, and reproducible acceptance matrix. The current repository contains every referenced surface.

The only high-risk unknown is whether Prime Agent 0.9.6's supported per-run prompt hook covers the full required run matrix while exposing enough structured capability metadata. Slice 1 is therefore a stop-gate characterization. A failed gate returns evidence to the owning conversation for specification or plan revision; it does not authorize a static prompt duplicate, Prime Agent fork change, persistent custom message, or private API.

## Current-code audit and fixed implementation decisions

### Supported policy carrier

Prime Agent 0.9.6 documents `before_agent_start` as a supported extension hook that can return a replacement `systemPrompt`. Its event contains the chained prompt plus structured `systemPromptOptions`, including `selectedTools` and loaded `skills`. Prime Agent resets to its base prompt between agent runs and applies the returned prompt to the ensuing agent loop, including tool continuations.

Use that hook in one new managed entry point, `src/prime-agent-plugin/extensions/goal-work-control.ts`. It is the sole source of `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` and the canonical policy text. Do not add this policy to `APPEND_SYSTEM.md`: project append discovery can shadow the global file and a static block cannot perform per-run capability gating. Keep the existing CONVERSATION identity block unchanged except for unrelated corrections proven necessary by implementation evidence.

The hook must:

1. inspect the incoming prompt for the V1 sentinel before mutation and fail closed on any pre-existing copy or malformed/colliding managed marker using a visible notification plus `ctx.abort()`; throwing alone is insufficient because the host catches extension-handler errors;
2. normalize `systemPromptOptions.selectedTools ?? ["ipython"]` and require `ipython`;
3. require loaded Python skills `goal` (`importName: "goal"`) and `rlm-heartbeat` (`importName: "rlm_heartbeat"`) from `systemPromptOptions.skills`;
4. when any compatibility signal is absent, leave `event.systemPrompt` unchanged and emit no message, error, tool, or state mutation; treat this as a valid unsupported session configuration rather than a failure;
5. append one deterministic canonical block to `event.systemPrompt` when compatible;
6. emit no user/custom message and retain no per-session copy or mutable policy state; and
7. keep the policy body at or below 4,000 UTF-8 characters excluding its marker delimiters.

A fresh `before_agent_start` evaluation on every run supplies reload-sensitive gating. The implementation must not infer skill availability from rendered prompt prose or filesystem discovery. Non-mutating native probes of `await goal.get()` and `await rlm_heartbeat.list()` establish that structured model visibility corresponds to callable host bridges for the supported generation.

### Canonical policy contents

The injected block must be a concise operational rendering of specification R3–R9, not a second design document. It must preserve these decisions:

- create an epoch-scoped goal for substantive multi-step agent work, but not for trivial replies or one quick lookup;
- reuse only a compatible active goal whose written objective will be true at the next ownership boundary;
- preserve and report incompatible, paused, budget-limited, human-created broader, or otherwise pending goals instead of completing or replacing them;
- before a pure observable wait, retain an inspectable external identity, create one uniquely labeled `follow_up` heartbeat per independent wait, retain and verify its ID, recheck terminal state, then complete the compatible epoch goal and report the handoff;
- on terminal evidence, delete and verify the exact monitor, make cleanup idempotent, and create a fresh compatible goal only when substantive work remains and no incompatible goal is pending;
- never let a monitor retry/restart work, poll a person, or report unchanged status repeatedly;
- treat recovery or diagnosis beyond bounded evidence capture as a new active-work epoch;
- for human-only blockers, preserve unrelated monitoring, complete only a compatible epoch goal, report one actionable checkpoint, and wait without a heartbeat;
- distinguish epoch completion from requested-outcome completion in user-facing language; and
- never call, simulate, or inject native goal pause/resume commands for autonomous work control.

The policy may use judgment terms defined in the specification, but must fit the fixed size budget. Tests should assert the marker, size, compatibility and collision behavior, and required semantic clauses without freezing incidental whitespace that would obstruct later wording improvements.

### Managed migration

Delete the obsolete builder source `src/prime-agent-plugin/extensions/goal-blocker-control.ts`. Replace it in the apply/check allowlist with `extensions/goal-work-control.ts`. Treat the old installed `extensions/goal-blocker-control.ts` as an obsolete managed destination:

- preflight it with every managed destination before any mutation;
- remove it only when it is an ordinary regular file, never through a symlink or non-regular path;
- make check reject its continued presence;
- preserve unrelated extension files and unmanaged append-system content; and
- fail closed if another source or prompt artifact already carries the V1 sentinel.

Apply does not mutate session goal state or purge queued session inputs. A fresh clean session is the activation surface. Existing paused or budget-limited sessions remain human-owned migration cases documented for native `/goal resume`, `/goal clear`, or abandonment in favor of a new session.

### Test and evidence boundaries

Use three evidence layers and label them accurately:

1. **Pure/unit and isolated installation tests** prove deterministic policy selection, marker uniqueness, obsolete-file safety, and source/installed parity.
2. **Native scripted probes** prove supported hook coverage, provider-level prompt contents, public goal/heartbeat host semantics, session record types, and failure/race handling. They do not by themselves prove that an unconstrained model will follow prose.
3. **Manual model dogfood** proves that the installed policy actually guides a compatible agent through the two required wait transitions. It does not generalize beyond the recorded scenarios.

Store sanitized machine-readable probe artifacts under `docs/evidence/goal-heartbeat-work-control/`, canonical operational truth in `docs/goal-heartbeat-work-control.md`, and the point-in-time synthesis in `reports/reviews/goal-heartbeat-work-control-dogfood.md`. Never copy private transcript text into evidence.

Every native probe that can mutate configuration must use `scripts/run-prime-agent-probe.sh`. Never start a second Prime Agent daemon while another is running. Provider-capture fixtures must be credential-free and must not access browser or Keychain stores.

## Delivery discipline and Beads strategy

After the operator approves this execution plan, create one implementation parent bead under `prime-claw-h6w` and six child beads matching the slices below, linked in a strict dependency chain. Planning alone creates, claims, or starts none of them. Record AC coverage and expected evidence paths on each child. Treat closed beads `prime-claw-1ht` and `prime-claw-5d6` as historical evidence only; do not reopen them. Before each slice, the episode claims only that slice's bead. At the end of the slice it records the exact commit, commands, results, limitations, and next gate, then closes only that completed child.

Each slice must:

- remain inside its stated scope and update this plan with evidence/status;
- deliver the stated working capability or decisive stop-gate evidence;
- add or update tests and durable documentation in the same commit;
- run focused checks, `pytest -q tests`, and `git diff --check` unless the plan records a pre-existing unrelated failure with evidence;
- produce one clean, single-purpose commit pushed for project-conversation review; and
- stop after reporting the commit, changed files, evidence, limitations, and worktree state.

If a slice changes managed plugin source, run `scripts/apply-prime-agent-plugin.sh` and `scripts/check-prime-agent-plugin.sh` before testing that generation. Do not claim a newly installed generation is active in an already loaded process. Any required daemon restart is an explicit operator handoff, not an agent-created second instance.

### Episode tracking

- Implementation parent: `prime-claw-h6w.24`.
- Slice 1: `prime-claw-h6w.24.1` — in progress in episode `01a0f0a2-a3d5-706e-92e6-0448235e8127`.
- Slice 2: `prime-claw-h6w.24.2` — blocked by Slice 1 acceptance.
- Slice 3: `prime-claw-h6w.24.3` — blocked by Slice 2 acceptance.
- Slice 4: `prime-claw-h6w.24.4` — blocked by Slice 3 acceptance.
- Slice 5: `prime-claw-h6w.24.5` — blocked by Slice 4 acceptance.
- Slice 6: `prime-claw-h6w.24.6` — blocked by Slice 5 acceptance.

## Slice 1 — Characterize the per-run policy carrier

**Working capability:** a reproducible, credential-free native probe proves or disproves the public Prime Agent seam needed to deliver one transient, capability-gated policy without durable conversation messages.

### Changes

- Add a focused native characterization harness, expected at `tests/test_goal_work_control_native.py`, that creates a temporary provider and temporary probe extension rather than altering production plugin behavior.
- Drive it through `scripts/run-prime-agent-probe.sh` and capture the exact provider `systemPrompt`, provider-call kind, structured capability decision, and session records.
- Prove at minimum:
  - `before_agent_start` can append a unique sentinel to a normal first and second agent run;
  - the returned prompt remains present for tool continuation in that run but does not accumulate on the next run;
  - `systemPromptOptions` exposes the normalized selected tools and loaded `goal` / `rlm-heartbeat` skill names needed by the compatibility predicate;
  - project-local `APPEND_SYSTEM.md` shadowing does not suppress hook contribution;
  - reload re-evaluates the structured resources;
  - saved-session resume receives one fresh contribution; and
  - no user or durable custom record contains the sentinel.
- Start `docs/goal-heartbeat-work-control.md` as the canonical operational document with the selected public seam, evidence status, and the explicit limits of this characterization.
- Record exact Prime Agent version/commit, commands, fixture inputs, and provider/session evidence. Do not call this lifecycle dogfood.

### Stop gate

Stop and return evidence for plan/specification review if the hook cannot cover these paths, if structured metadata cannot reliably distinguish the three compatibility signals, if the prompt persists as conversation data, or if project append shadowing suppresses the contribution. Do not fall back to `APPEND_SYSTEM.md`, `promptGuidelines` on dummy tools, custom messages, Prime Agent core changes, or private runtime fields.

### Acceptance evidence

```sh
pytest -q tests/test_goal_work_control_native.py
pytest -q tests
git diff --check
```

The slice covers the carrier prerequisites for specification AC1–8; it does not complete that matrix.

### Current evidence (2026-09-30)

- `tests/test_goal_work_control_native.py` provides the temporary RPC provider,
  hook, Python-skill, reload, project-append, saved-session, and session-record
  fixtures without changing production plugin source.
- One isolated run on Prime Agent 0.9.7 build `cwd-fix-v0.9.7-r1` at
  `c094b9eea32173d7c4dd0c0a444a332ebac8f5d8` passed: `1 passed in 10.83s`.
- The final test refuses to start its standalone probe while any Prime Agent
  process is active. In the active episode it reports `1 skipped` rather than
  violating the machine-level single-instance rule.
- The safe Python suite passes `263` tests and `7` subtests; the Node suite
  passes `127` tests; `python3 -m py_compile` and `git diff --check` pass.
- `docs/goal-heartbeat-work-control.md` records the public seam, fixture inputs,
  exact evidence, current 0.9.7 baseline, and characterization limits.
- Review remains open on whether the successful isolated run plus the guarded
  safe suite is sufficient, or whether an operator-controlled maintenance
  window must repeat the probe and complete an all-Python run before acceptance.

### Explicit non-goals

No production extension, no tool removal, no installer mutation, no global apply, and no lifecycle claim.

## Slice 2 — Replace pause/resume tools with the canonical policy generation

**Depends on:** Slice 1 gate passed and was accepted by the project conversation.

**Working capability:** the managed plugin source and isolated installed copy expose one capability-gated goal/heartbeat policy and no Prime-Claw pause/resume tools or transport.

### Changes

- Add `src/prime-agent-plugin/extensions/goal-work-control.ts` with the characterized hook, compatibility normalization, collision handling, canonical marker, size-bounded policy, and no persistent message/state.
- Remove `src/prime-agent-plugin/extensions/goal-blocker-control.ts`.
- Replace the obsolete entry in `scripts/apply-prime-agent-plugin.sh` and `scripts/check-prime-agent-plugin.sh`; add safe old-file preflight/removal and stale-file rejection while preserving unrelated extensions.
- Replace `tests/test_goal_blocker_control_extension.py` with `tests/test_goal_work_control_extension.py` for native loading/provider evidence, and add `tests/goal_work_control_extension.test.mjs` for direct hook event/result, capability, collision, and no-message assertions.
- Update `tests/test_prime_agent_plugin_install.py` for the new allowlist, exact old-path removal, unsafe destination rejection before any mutation, installed parity, marker uniqueness, and unrelated-file preservation.
- Keep `.ralph/skills/execute/SKILL.md` free of the generic lifecycle and retain `tests/test_execute_skill.py` as the ownership-boundary regression.
- Update `.ralph/README.md`, `docs/lab-global-plugin.md`, `docs/conversation-driven-episode-oversight.md`, and `docs/goal-heartbeat-work-control.md` with the new source, removed tools, migration boundary, policy lineage, incident rationale, and epoch/requested-outcome distinction.
- Run isolated apply/check first, then apply/check the complete user-global managed copy exactly once for this source generation. Report that a loaded process may still be old; do not call it active yet.

### Acceptance evidence

- Compatible unit events produce one exact V1 policy block; each missing capability produces zero.
- Duplicate or foreign marker input aborts with an actionable collision error.
- The policy body is deterministic and within 4,000 UTF-8 characters.
- No managed source registers the old tools or sends native pause/resume slash commands.
- Isolated apply/check converges, removes only the safe obsolete old file, rejects unsafe old destinations, and leaves unrelated files/append content byte-for-byte unchanged.
- Focused and active suites pass:

  ```sh
  node --experimental-strip-types --test tests/goal_work_control_extension.test.mjs
  pytest -q tests/test_goal_work_control_extension.py tests/test_prime_agent_plugin_install.py tests/test_execute_skill.py
  PRIME_AGENT_PLUGIN_ROOT="$(mktemp -d)" scripts/apply-prime-agent-plugin.sh
  scripts/apply-prime-agent-plugin.sh
  scripts/check-prime-agent-plugin.sh
  pytest -q tests
  git diff --check
  ```

  The implementation may use a safer managed temporary-directory helper instead of the illustrative raw `mktemp` command, but must preserve the isolated-root evidence.

This slice completes source-level AC8–14 and AC27–31. AC32 remains blocked on a fresh process.

### Restart handoff

After the commit is pushed and global check passes, stop. If the current Prime Agent generation was already loaded, report the exact operator action: quiesce relevant sessions, restart the single existing Prime Agent daemon/process, then resume the same episode for Slice 3. Do not launch a concurrent daemon or claim that restart clears queued legacy session inputs.

### Explicit non-goals

No lifecycle state machine, no changes to native human `/goal` commands, no Prime Agent core/fork change, no legacy session-state mutation, and no claim that prompt text alone proves agent behavior.

## Slice 3 — Prove installed prompt delivery and capability gating

**Depends on:** Slice 2 accepted, the new global copy passes check, and the operator has provided a fresh-process boundary when required.

**Working capability:** the freshly loaded installed generation supplies exactly one policy copy on every required compatible run path, omits it on incompatible paths, and leaves conversation history free of policy copies.

### Changes

- Extend the native provider-capture harness to exercise the complete specification matrix against the checked installed generation:
  - first user turn and second user turn;
  - resource reload;
  - saved-session resume;
  - post-compaction continuation;
  - queued follow-up;
  - RLM-heartbeat turn;
  - agent-message turn; and
  - goal-continuation turn.
- Label ordinary primary provider calls separately from internal summarizer/refinement calls. Count the sentinel only in the exact provider `systemPrompt` for the former.
- Add negative matrix cases for missing `ipython`, missing `goal`, missing `rlm-heartbeat`, capability removal on reload, and a project `APPEND_SYSTEM.md` shadow.
- Use non-mutating `await goal.get()` and `await rlm_heartbeat.list()` in a compatible run to prove the model-visible skills reach callable host bridges.
- Exercise a bounded EPISODE/EXPERT/delegated fixture and prove the work-control policy appears once without changing its narrower identity package or authority.
- Verify fresh discovery exposes no old tools, preserves the native human goal commands, and loads the new entry from the checked global path.
- Record a sanitized prompt-delivery evidence section in `reports/reviews/goal-heartbeat-work-control-dogfood.md`; update the canonical operational doc with supported-generation and recovery facts only.

### Acceptance evidence

The evidence bundle contains exact command lines, runtime version, provider-call classifications, per-call sentinel counts, session-record scans, active tool/skill decisions, loaded extension path, and apply/check results. It proves AC1–7, AC9–14, and AC32.

Run focused native tests, `pytest -q tests`, `scripts/check-prime-agent-plugin.sh`, and `git diff --check`. A test must fail if it silently drops a matrix row or mixes summarizer calls into primary-call counts.

### Stop gate

Any missing run path, accumulating prompt, stale reload decision, host-call mismatch, identity-scope change, or old tool registration blocks rollout. Preserve the evidence and return to plan review. A required production-source repair is a separately reviewed slice that repeats apply/check and the restart boundary; do not patch source and quietly continue this evidence slice.

### Explicit non-goals

No wait-transition claims, no migration of live legacy sessions, and no use of provider payload rewriting after Prime Agent's system prompt as a substitute for the supported hook.

## Slice 4 — Prove lifecycle happy paths and ownership races

**Depends on:** Slice 3 accepted.

**Working capability:** deterministic scripted fixtures reproduce the specified successful goal/heartbeat ownership transitions and duplicate-delivery boundaries using public Prime Agent skills and inspectable session evidence.

### Changes

- Add a scripted native lifecycle harness using credential-free providers and public `ipython` calls to the real `goal` and `rlm_heartbeat` skills. Use controlled external jobs with stable process/status/output identities; do not poll them with an open or sleeping agent turn.
- Persist sanitized machine-readable ordered evidence for:
  1. external identity retained → uniquely labeled `follow_up` heartbeat created/listed → immediate terminal recheck → compatible epoch goal completed → handoff report;
  2. operation terminal before handoff, causing exact monitor deletion/verification and current-epoch handling;
  3. a non-terminal heartbeat that creates no goal, performs no restart, and emits no unchanged-status churn;
  4. terminal completion with no remaining work and no fresh goal;
  5. terminal completion with substantive work and exactly one fresh compatible goal;
  6. an unrelated pending goal causing checkpoint/defer rather than second-goal creation or unrelated completion;
  7. two near-simultaneous waits plus competing native terminal notice/heartbeat delivery converging on at-most-once cleanup/report/goal creation; and
  8. a synthetic human blocker with no polling monitor and a later synthetic operator-clear input before fresh work.
- Inspect persisted session entries to prove zero host goal-continuation records for a completed epoch between handoff and terminal evidence.
- Keep scripted-provider claims narrow: this proves public host semantics, ordering, records, and harness observability, not free-form model compliance.
- Update the evidence report and canonical doc with exact observed public behavior.

### Acceptance evidence

The bundle for specification AC15–23 includes ordered goal-state results, heartbeat create/list/delete results with exact IDs and labels, external terminal evidence, relevant session-record types, cleanup verification, and the resulting new-goal or explicit no-goal decision.

Run the focused lifecycle harness, the complete active project suite, global plugin check, and `git diff --check`. Any unsupported race is a review blocker, not permission to add a runtime coordinator or private state mutation.

### Explicit non-goals

No failure/recovery matrix, production orchestration engine, durable wait registry, automatic retry service, or claim that a scripted provider proves model compliance.

## Slice 5 — Prove failure and recovery behavior

**Depends on:** Slice 4 accepted.

**Working capability:** deterministic failure fixtures show that control-plane faults preserve exact ownership evidence, fail closed, and never restart or duplicate work.

### Changes

- Extend the public-surface lifecycle harness with separately classified failure cases for:
  1. heartbeat creation failure;
  2. exact heartbeat deletion failure;
  3. compatible epoch-goal completion failure after monitor creation;
  4. fresh-goal creation failure after terminal cleanup;
  5. capability loss on resource reload;
  6. stale-timeout escalation;
  7. terminal external failure;
  8. paused, budget-limited, completed, errored, and human-created broader goal incompatibility; and
  9. resource reload or full process restart with recoverable exact identity, or the required first-later-turn fail-closed result when monitor/identity recovery is unavailable.
- Use supported public operations or explicit test doubles at the skill boundary. Do not monkey-patch Prime Agent private session fields.
- For every case capture the exact external identity/checkpoint, goal state, heartbeat state/ID when available, visible degraded-state report, absence of automatic retry/restart, and absence of duplicate monitor or goal creation.
- Document the measured restart/reload boundary without broadening it into an autonomous host-restart promise.
- Update machine-readable evidence, the point-in-time review report, and canonical operations guidance.

### Acceptance evidence

This slice completes specification AC24–26 and the failure clauses attached to AC15–23. Focused failure tests, `pytest -q tests`, global plugin check, and `git diff --check` pass.

If a public surface cannot induce or observe a required case, stop with the exact gap and return to the owning conversation. Do not substitute static policy-text assertions for runtime evidence or add an unreviewed recovery coordinator.

### Explicit non-goals

No happy-path reimplementation, private host mutation, automatic recovery service, cross-session monitor database, or silent downgrade of a failure criterion.

## Slice 6 — Manual lifecycle dogfood and rollout closure

**Depends on:** Slice 5 accepted.

**Working capability:** a real compatible model under the freshly installed policy completes both required ownership transitions without pause/resume transport, goal-continuation churn, duplicate cleanup, or semantic overclaiming.

### Changes

- Run two bounded, non-destructive manual scenarios in fresh clean sessions:
  1. active epoch goal → controlled observable wait → exact heartbeat cleanup → requested outcome complete → no new goal; and
  2. active epoch goal → controlled observable wait → exact heartbeat cleanup → one fresh epoch goal → substantive follow-up → requested outcome complete.
- In each scenario capture the written epoch objective, external identity/status path, heartbeat label/ID and `follow_up` mode, creation/list/deletion evidence, pre-completion terminal recheck, goal states, session record types, operator-facing wording, and final no-goal state.
- Confirm the agent calls no obsolete tool, injects no native pause/resume command, does not wait for a continuation from a completed goal, and labels epoch completion without claiming the larger outcome early.
- Re-run the synthetic human-blocker fixture. Manual operator participation in that fixture is optional under the specification; the two real wait transitions are mandatory.
- Finalize `reports/reviews/goal-heartbeat-work-control-dogfood.md` as point-in-time evidence. Keep durable policy and operations truth in `docs/goal-heartbeat-work-control.md` and link it from `docs/README.md` if that index convention applies.
- Reconcile `.ralph/README.md`, `docs/lab-global-plugin.md`, `docs/conversation-driven-episode-oversight.md`, the future plan, and all slice beads with the evidence. Preserve the historical commits and incident record rather than rewriting them as if the new global behavior had always existed.

### Acceptance evidence

- The report contains both AC33 traces and explicitly maps every AC1–33 criterion to a focused test, native probe, manual trace, or documentation artifact.
- `scripts/check-prime-agent-plugin.sh` passes against the real global installation.
- Focused suites and `pytest -q tests` pass; `git diff --check` passes.
- One final clean commit containing evidence/documentation reconciliation is pushed for owner review.

Do not archive the specification and plan or claim implementation acceptance until the owning conversation completes its independent review and operator gate.

### Explicit non-goals

No orchestrator, no generalized wait service, no wider Prime Agent version claim, no automatic legacy-session repair, and no change to human authority over goal commands.

## Dependency and acceptance map

| Slice | Depends on | Primary specification coverage |
|---|---|---|
| 1. Carrier characterization | reviewed plan | Public-seam prerequisites for AC1–8; planning stop gate |
| 2. Production policy and migration | Slice 1 accepted | AC8–14, AC27–31; source/install/docs |
| 3. Installed prompt matrix | Slice 2 + fresh-process boundary | AC1–7, AC9–14, AC32 |
| 4. Lifecycle happy paths and races | Slice 3 accepted | AC15–23 and required success evidence |
| 5. Failure and recovery matrix | Slice 4 accepted | AC24–26 and failure clauses in AC15–23 |
| 6. Manual dogfood and closure | Slice 5 accepted | AC28–29, AC33, final AC1–33 traceability |

The dependency chain is strict. If a characterization, installed-runtime, or lifecycle gate fails, stop with evidence and return to the owning conversation. Do not start the next slice merely because its code could be written.

## Cross-slice regression commands

Use repository-native environments and exact focused commands established by the implementation. The expected common floor is:

```sh
node --experimental-strip-types --test tests/goal_work_control_extension.test.mjs
pytest -q tests/test_goal_work_control_extension.py
pytest -q tests/test_goal_work_control_native.py
pytest -q tests/test_prime_agent_plugin_install.py tests/test_execute_skill.py
pytest -q tests
scripts/check-prime-agent-plugin.sh
git diff --check
```

Run `scripts/apply-prime-agent-plugin.sh` only for a source generation that has passed focused pre-apply tests. Use `scripts/run-prime-agent-probe.sh` for configuration-mutating native probes. Root `pytest -q` is not the supported gate because retired tests under archived Phase 1 paths are intentionally outside `tests/`; record any newly discovered active-suite failure precisely.

## Overall non-goals

- No Prime Agent core or downstream-fork expansion.
- No private session API, hidden field mutation, or provider-payload monkey patch.
- No static duplicate in global/project `APPEND_SYSTEM.md`, Ralph `/execute`, a dummy tool, or a discoverable skill.
- No model-facing pause/resume replacement tool and no agent-injected native goal slash command.
- No durable wait registry, retry coordinator, restart daemon, or general orchestration service.
- No change to native human `/goal pause`, `/goal resume`, or `/goal clear` semantics.
- No automatic mutation or recovery of existing paused, budget-limited, or queued legacy session state.
- No credential lookup, browser-store access, or concurrent Prime Agent daemon.
- No implementation, branch, worktree, or episode creation during this planning phase.
