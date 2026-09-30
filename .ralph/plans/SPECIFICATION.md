# Plugin-global goal and heartbeat work control

> **Status:** REVIEWED SPECIFICATION — operator approved for planning through `/plan .ralph/plans/future/goal-heartbeat-work-control` on 2026-09-29. This document specifies behavior and acceptance boundaries. Planning approval does not authorize implementation.

## Purpose and reading guide

This specification records a deliberate behavioral reversal. Prime Claw previously used goal completion, heartbeat monitoring, and a fresh goal around long waits. That behavior was replaced by plugin-provided pause/resume tools because pause/resume appeared semantically cleaner. Runtime use exposed failures that are not apparent from reading the current implementation alone, so the earlier ownership pattern is now preferred.

A future implementer is expected to inspect the current repository, installer, Prime Agent APIs, and tests directly. This document does not reproduce those discoverable mechanics. It preserves the context that code inspection cannot supply:

- the policy lineage and what each historical validation did and did not prove;
- the operator-observed runtime failures in the pause/resume design;
- the explicit preference for operational reliability over one semantically continuous goal;
- the decision to make the restored policy general rather than Ralph `/execute`-only; and
- the new safety corrections and global behavior that remain to be validated.

The change concerns generic ownership of active work and waiting. It does not change Ralph episode scope, execution planning, beads, or human authority over native `/goal` commands.

## Decision

Prime Claw will use this lifecycle whenever the required capabilities are present:

```text
bounded goal for active work
        ↓ external work becomes the progress owner
bounded heartbeat for waiting; prior goal is complete
        ↓ terminal result arrives
fresh bounded goal if agent work remains, otherwise final report
```

Prime Claw will remove its model-facing goal pause and resume mechanisms. It will not inject `/goal pause` or `/goal resume` as user messages.

This deliberately prefers a reliable ownership transfer over the superficially neater idea of keeping one project-level goal paused across a wait. The operator previously dogfooded a completion → heartbeat → fresh-goal workflow and found it effective within Ralph `/execute`. The history and limits of that evidence are recorded below; plugin-global use remains to be proven. The current pause/resume replacement introduced the failures described below.

The operator explicitly accepts multiple completed goal records while one larger requested outcome is still unfinished: “working is better than semantically neat.” To avoid falsely claiming achievement, every goal created by this policy must state an epoch objective that is actually true at the ownership-transfer boundary, and user-facing text must distinguish “this active-work epoch is complete” from “the requested outcome is complete.” The policy may not retroactively reinterpret a broader legacy or human-created goal.

The operator also explicitly approved making the useful policy general rather than restoring it only to Ralph `/execute`. Global suitability is a product requirement; it is not historical evidence and must be dogfooded across the compatible session classes named in acceptance.

Prime Agent does not accept unsolicited pull requests, and a confirmed unrelated Prime Agent bug has already required a downstream fork with poor upstream response. This work must not depend on upstream accepting a new goal API, and it must not add another private or patched Prime Agent goal-control API to the fork. Those facts are constraints, not work requested by this specification.

## Design provenance and evidence

The repository's Git history preserves the policy evolution. Future readers should inspect these revisions when planning or reviewing the change:

1. **Completion/heartbeat/fresh-goal baseline — imported at commit `d742c81` and clarified at commit `09f5953` (`docs: enforce small execute work slices`, 2026-09-21).** The original imported `.ralph/skills/execute/SKILL.md` already told an `/execute` agent that, before waiting on a long-running process, it must start the process, mark its current goal complete even though plan work remained, create a heartbeat, and have the heartbeat reinstate the goal after the process finished unless that result completed the goal. It applied the same completion-at-boundary approach to blocked work. Commit `09f5953` retained that lifecycle while rewriting the surrounding instruction around one small execution slice and changed “reinstate your goal” to the more accurate “reinstate an appropriate goal.” Inspect both forms with:

   ```bash
   git show d742c81:.ralph/skills/execute/SKILL.md
   git show 09f5953:.ralph/skills/execute/SKILL.md
   ```

   The operator used this behavior and found that it worked well enough to prevent goal-continuation context churn while preserving a monitored return path. This evidence is operational dogfood, not a claim that every edge case or non-Ralph session was tested.

2. **Pause/resume substitution — commit `3d49762` (`fix: pause goals during long-running execution`, 2026-09-23).** This two-line policy change replaced “complete, then reinstate an appropriate goal” with `pause_thread_goal(...)`, heartbeat monitoring, and `resume_thread_goal()`. The motivation was semantic: one paused goal appeared to represent the unfinished slice more neatly than completing and replacing it. Inspect the before/after policy with:

   ```bash
   git show 3d49762 -- .ralph/skills/execute/SKILL.md
   git show 3d49762^:.ralph/skills/execute/SKILL.md
   ```

   This commit did not establish that agent-injected pause/resume transport was operationally safer.

3. **Move from Ralph-only instruction to plugin-global mechanism — commit `2651573` (`feat: make bounded goal control plugin-global`, 2026-09-28).** Generic goal/heartbeat text was removed from `.ralph/skills/execute/SKILL.md` and placed in the new managed `goal-blocker-control.ts` extension. The move addressed a real scope problem: work/wait control is useful outside `/execute`. It also changed the mechanism from a prompt-only workflow using direct Python `goal.complete()` into model tools that enqueue `/goal` commands as user messages.

4. **Resume delivery mitigation — commit `b56b080` (`fix: steer goal resume commands`, 2026-09-28).** Resume changed from follow-up delivery to steering after delayed follow-up delivery produced a stale-resume race. This reduced that particular delay but made both pause and resume self-injected steering user messages. It did not make either operation an atomic in-band goal-state transition.

   The associated closed beads, `prime-claw-1ht` and `prime-claw-5d6`, record what “validated” meant at those stages. The checks proved extension loading, prompt injection, exact delivery-mode source, installation parity, and fresh startup. They did **not** prove that an agent could finish its heartbeat setup and user report after invoking pause, or that a queued resume would still be valid when delivered. The newly observed failures therefore expose a missing behavioral acceptance layer rather than contradicting the recorded test output. A future reader can inspect the records with `bd show prime-claw-1ht` and `bd show prime-claw-5d6`.

5. **Accepted regressions observed after globalization.** The operator subsequently observed two failures that are not recoverable from Git history alone and are therefore recorded here as product evidence:
   - A steering pause interrupts the agent that called it before that agent can reliably create its heartbeat and explain the blocker or wait to the operator.
   - Agents sometimes call resume after the goal has already been completed. A completed goal emits no resumed goal continuation, so the agent can wait for a continuation that will never come. A related asynchronous case occurs when resume was valid when queued but becomes stale before delivery.

### Sanitized operator-observed incident record

These incidents were observed against the Prime Agent 0.9.6 downstream generation with the Prime Claw goal-control generation at or after `b56b080`. They are recorded here because the private session transcripts are not repository artifacts. The ordered facts, rather than transcript access, are the requirement basis.

#### Incident A — pause prevented its own handoff

1. An agent started or identified work that required waiting.
2. Following the installed tool guidance, it called `pause_thread_goal` before creating the heartbeat or finishing its operator report.
3. The tool enqueued `/goal pause` as a steering user message and returned only that it had queued the command.
4. The steering message became the next controlling input before the agent received another reasoning step.
5. The agent therefore did not reliably create the heartbeat and did not tell the operator what it needed, why it was blocked, or what would resume work.

Adjudication: this is a design failure, not merely an agent forgetting a later instruction. The tool guidance itself placed pause before heartbeat creation, and steering user-message semantics intentionally preempt an active run. A model-facing API must not require the caller to perform essential handoff steps after a self-injected steering message.

#### Incident B — queued resume outlived its premise

Two variants were observed:

1. A resume was queued while a paused goal still appeared to require work. Before the queued slash command became the controlling input, the agent continued far enough to reach another boundary where the goal needed to remain inactive. The old resume then arrived against the newer state.
2. An agent attempted or delivered resume after the goal had been marked complete. A completed goal cannot produce the expected goal continuation, so the agent received no continuation and could wait indefinitely for one.

Adjudication: one variant includes an instruction/state-check error, but both expose the same missing guarantee: the tool acknowledges queue admission rather than an atomic state transition, and delivery is not conditional on the goal identity and status still matching. Changing follow-up delivery to steering did not provide that guarantee.

No credential, private transcript content, or unrelated session content is required to apply these findings.

### What is and is not established

| Claim | Evidence status |
|---|---|
| Completion → heartbeat → fresh goal prevented goal-continuation churn during Ralph `/execute` waits | Operator-observed effective baseline, with historical policy preserved at `09f5953` and immediately before `3d49762` |
| The baseline worked in every Prime Agent session type | Not established; global applicability is the enhancement requested here |
| Pause/resume is semantically tidier for one unfinished objective | Accepted motivation for the 2026-09-23 change |
| Agent-injected pause/resume is operationally reliable | Disproven by the recorded self-interruption and stale/completed-resume observations |
| A plugin-global system policy will preserve the baseline without prompt accumulation or project-file shadowing | Proposed and still to be proven by this specification's acceptance tests |
| Direct native pause/resume host APIs would solve the transport problem | Technically plausible but explicitly outside this work because it would enlarge the downstream Prime Agent fork |

Accordingly, “restore” in this specification means return to the previously effective `/execute` control-flow baseline, then validate the new and previously unproven step of making that policy generally available through the plugin.

### Why the earlier baseline is preferred now

The earlier behavior is superior under the APIs Prime Claw can safely use today for four concrete reasons:

1. `await goal.complete()` is an in-band Python host request. The call returns goal state to the same running agent; it does not manufacture a new user turn and therefore does not preempt the agent's heartbeat setup or operator report.
2. Once the goal is complete, it cannot later produce a stale resumed continuation. The heartbeat is the sole continuation owner during the wait.
3. After terminal state, `await goal.create(...)` establishes a new goal synchronously and explicitly. The agent need not assume that a queued slash command ran or wait for an implicit continuation.
4. The tradeoff is visible rather than hidden: the goal timeline has multiple epochs for one requested outcome. The operator explicitly accepts that less tidy representation because it worked better than the pause/resume transport.

This preference is conditional on the current supported surfaces. It is not a general claim that completion/recreation is intrinsically better than an atomic native pause/resume API.

### New behavior introduced by this specification

This is not a byte-for-byte rollback. The historical `/execute` text said to mark the goal complete and then set up the heartbeat. This specification deliberately strengthens that handoff by requiring heartbeat creation to succeed **before** goal completion, so there is no unmonitored gap. That ordering is a new requirement and must be validated; it is not part of the prior dogfood evidence.

The following are also new or newly generalized and must not be described as already proven:

- delivering the policy outside Ralph `/execute`;
- making the policy resistant to project-local append-system shadowing;
- omitting unusable guidance when either callable skill is unavailable;
- using active-work-epoch wording to reconcile goal completion with an unfinished larger outcome;
- requiring non-interrupting routine heartbeat delivery;
- making terminal handling idempotent when both a heartbeat and a process-completion notice arrive; and
- applying one explicit human-blocker contract outside Ralph execution.

These additions are acceptance targets for the proposed change, not evidence in favor of the historical baseline.

## Current system

### Current managed extension

`src/prime-agent-plugin/extensions/goal-blocker-control.ts` registers two model-facing tools:

- `pause_thread_goal(reason)` calls `pi.sendUserMessage("/goal pause", { deliverAs: "steer" })`.
- `resume_thread_goal()` calls `pi.sendUserMessage("/goal resume", { deliverAs: "steer" })`.

The extension also carries generic `promptGuidelines` about creating goals, creating heartbeats, pausing at a background wait or human blocker, and resuming afterward. Therefore the unsafe transport and the generally useful policy currently have the same owner.

Both `scripts/apply-prime-agent-plugin.sh` and `scripts/check-prime-agent-plugin.sh` list `extensions/goal-blocker-control.ts` as a managed file. The installed default destination is `~/.prime/agent/extensions/goal-blocker-control.ts`.

Ralph's `.ralph/skills/execute/SKILL.md` once carried the generic completion/heartbeat/new-goal lifecycle. That generic text was removed when the plugin-global pause/resume mechanism was introduced. The execute skill now retains Ralph-specific single-slice execution rules rather than serving as the general owner of goal control.

### Why steering is unsafe here

`pi.sendUserMessage(..., { deliverAs: "steer" })` delivers a new user-role instruction to an active agent as soon as the session can steer it. That is correct when a human intentionally interrupts an agent. It is unsafe when the agent injects the message into its own run to change control state.

The observed pause sequence is:

1. The agent recognizes that useful progress now depends on a process, worker, or person.
2. It calls `pause_thread_goal`.
3. The plugin injects `/goal pause` as a steering user message.
4. The steering message takes control before the agent receives the next model step.
5. The agent may never create the heartbeat, explain the wait, state the required human action, or preserve the resume checkpoint.

Changing the delivery lane does not provide a safe control operation. Follow-up delivery can execute too late and become stale; steering can execute too early and self-interrupt the handoff.

### Why resume is unsafe here

The plugin tool reports that resume was queued, not that goal state changed. A queued resume can arrive after its premise is false. Observed failures include:

- resume executing only after the agent reached another boundary at which the goal should remain inactive; and
- an agent attempting to resume a goal that had already been completed.

A completed goal cannot produce the expected goal continuation. The agent can therefore wait for a continuation that will never arrive.

### Relevant prompt-delivery behavior

Prime Agent discovers a project-local `.prime/agent/APPEND_SYSTEM.md` before the user-global `~/.prime/agent/APPEND_SYSTEM.md`; it does not automatically merge both discovered files. Consequently, a policy stored only in the global append file can be shadowed by a project file.

Prime Agent's supported per-run extension hook receives the current base system prompt and can return a modified system prompt for that agent run. A later run begins from the base prompt again rather than the prior modified result. A fixed contribution through that surface therefore costs a fixed number of prompt tokens but does not accumulate copies in conversation history. These facts make per-run system-prompt contribution a known candidate, but this specification sets the behavioral requirements rather than prescribing the final implementation structure.

## Terminology

### Requested outcome

The end result the operator asked for. It can span several active-work and waiting epochs.

### Persistent thread goal

The one host-owned Prime Agent goal read and changed through the Python `goal` skill. This is not a Ralph specification, plan, episode, bead, or project milestone.

### Active-work epoch

A bounded interval during which the agent itself can make useful progress through reasoning and tool use. One persistent thread goal owns the epoch.

The goal objective must be written so this epoch is genuinely complete at either of two boundaries:

1. the requested outcome is complete; or
2. progress has been safely transferred to a named external wait or human handoff with a retained handle or checkpoint.

A suitable objective shape is:

> Advance `<requested outcome>` through the current agent-controlled work epoch, finishing it if possible or establishing the next safe monitored wait or actionable human handoff with a resumable checkpoint.

The exact objective should remain concrete about the work at hand. This shape reconciles epoch completion with the native goal skill's rule that `goal.complete()` means its stated objective has been achieved. It does **not** claim that the larger requested outcome is finished.

### Waiting epoch

An interval during which an identified process, command, evaluation, deployment, or delegated worker can make progress without further agent action. One agent-owned RLM heartbeat owns monitoring for that wait.

### Agent-owned heartbeat

A recurring prompt created with the Python `rlm_heartbeat` skill. The agent must retain its returned identifier. This specification never refers to the user's `/heartbeat` command when it says “heartbeat.”

### Observable long-running work

Work with a stable identity that the agent can inspect later, such as a `bash()` handle, a delegated child identifier, a job identifier, or an output/status location. Mere uncertainty or a hope that circumstances will change is not observable work.

### Human blocker

A boundary that cannot change through agent monitoring alone and requires a person's action, authentication, permission, physical interaction, host repair, or product decision.

### Agent run

One Prime Agent processing run initiated by a user prompt, queued continuation, heartbeat delivery, or similar session input. An agent run can contain several model/tool iterations. “Once per run” does not mean once after every tool result.

### Goal continuation churn

Repeated goal continuation prompts while the agent cannot make useful progress because an external actor owns the next state change. These prompts consume context and can cause repeated, unactionable status reports.

### Judgment terms used by the policy

- **Substantive multi-step work:** work expected to require several reasoning/tool steps, durable mutations, validation, or continuation across agent runs. A brief explanation or one quick read-only lookup is not substantive.
- **Long-running:** an operation whose useful result is expected after the current agent can no longer make progress and for which holding a tool call or repeatedly invoking goal continuation would reduce responsiveness or consume context. Duration alone is not decisive; a safely awaited short command is not a waiting epoch.
- **Meaningful progress:** new evidence that changes operation state, completion estimate, risk, blocker, or next action. A repeated “still running” result is not meaningful progress.
- **Bounded heartbeat:** one monitor with an exact wait identity, appropriate interval, terminal conditions, staleness/escalation boundary, and self-cleanup rule.
- **Resumable checkpoint:** the authorized outcome and scope, work already completed, exact external/heartbeat identities, decisive evidence, remaining work, current blocker, and next safe action.
- **Exact cleanup:** deletion or release of only resources owned by the named wait, with their identities verified; unrelated monitors or work are preserved.

## Required state model

Ownership is assigned to the **next useful action**, not permanently to the whole requested outcome. One active goal may own agent-actionable work, and each independently running external operation may have one narrowly scoped heartbeat. They may coexist only when the heartbeat monitors an independent operation and does not also prompt the agent to perform the goal's work.

| State | Next-action owner | Required persistent state |
|---|---|---|
| Active work | Agent | One active bounded goal; optional heartbeats only for independent operations |
| Pure observable wait | One or more external processes or workers | No pending goal; one bounded heartbeat per exact independent wait |
| Human blocked | Operator or external authority | No pending goal for the blocked work; no heartbeat that merely polls the person |
| Finished | Nobody | No pending goal and no heartbeat owned by the outcome |

A heartbeat turn that only checks unchanged status does not start an active-work epoch. A terminal heartbeat turn may perform bounded observation and cleanup before deciding whether useful agent work now exists. When one of several parallel waits finishes, it may create a fresh goal only if no incompatible goal is pending; the other exact monitors remain scoped to their own operations and do not become general continuation owners.

## Required behavior

### R1 — Policy availability and scope

The installed Prime Claw plugin must provide this work-control policy as an always-present system-level instruction for every agent run in which the model can actually call both the Python `goal` skill and the Python `rlm_heartbeat` skill.

The policy must not depend on:

- invocation of Ralph `/execute`;
- the model deciding to load an optional reference skill;
- registration or selection of pause/resume tools;
- a machine-specific continual-harness entry; or
- absence of a project-local append-system file.

A **compatible run** has all three supported runtime signals: `ipython` is selected for the run, the structured loaded-skill metadata contains the model-visible `goal` skill, and it contains the model-visible `rlm-heartbeat` skill. Compatibility must be decided from supported structured extension/runtime data, never by parsing rendered prompt prose or merely finding files on disk. A native isolated probe must additionally prove that the non-mutating `await goal.get()` and `await rlm_heartbeat.list()` host calls succeed for the minimum supported generation.

The initial compatibility baseline is the Prime Agent 0.9.6 downstream generation used by this repository. Planning may broaden that range only with equivalent probes. Compatibility is re-evaluated after resource reload. A run that lacks any required signal must not receive instructions telling it to call the unavailable API. If capability is lost during an owned wait, preserve the external identity and fail closed with an actionable report on the next capable turn rather than assuming completion.

The operator has explicitly required general plugin use, not Ralph-only use. The policy applies to ordinary top-level conversations and to bounded sessions that meet the compatibility predicate. Existing episode, expert, or delegated-task scope remains authoritative; this policy changes work/wait ownership, not what the session is allowed to accomplish. Behavioral suitability across those classes is new and remains subject to the acceptance matrix below.

### R2 — Stable prompt behavior

The canonical policy must carry one unique version sentinel, initially `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1`. The sentinel and policy must be deterministic and must appear exactly once in the effective system prompt for each compatible primary provider request. They must not be emitted as a user message or stored as a durable custom conversation message.

Later user turns, queued continuations, heartbeat runs, retries, resource reloads, saved-session resumes, and post-compaction runs must not accumulate copies. Internal summarizer/refinement provider calls that do not run the ordinary agent policy are excluded from this count and must be identified separately in probe output. The canonical injected policy, excluding sentinel delimiters, must not exceed 4,000 UTF-8 characters; a larger policy requires explicit operator approval rather than an assertion that its cost is “materially smaller.”

### R3 — Starting active work

For substantive multi-step work, the agent must create one bounded persistent goal unless a **compatible active goal** already owns the work. A compatible goal has status `active`, covers the same authorized outcome and scope, and has a written objective whose requirements will be true at the next ownership boundary. The policy must not reinterpret a user-created, legacy, or broader goal as an epoch goal while its written objective remains false.

If an incompatible pending goal exists, `goal.create()` cannot replace it and the agent must not complete it merely to make room. The agent must report the mismatch and ask the operator to rescope, complete, resume, or clear it through supported human control as appropriate. An existing `paused` or `budget_limited` goal is not compatible active state; the agent must preserve it and fail closed rather than injecting a native command.

Every new policy-created goal must use the active-work-epoch semantics above and name the concrete requested outcome or next stage. The agent must not:

- create a goal for a trivial answer or one quick lookup;
- create a second goal while another goal is pending;
- treat a completed or errored goal as resumable; or
- set a token budget unless the operator explicitly requested one.

Human use of native `/goal pause`, `/goal resume`, and `/goal clear` remains authoritative and outside this feature.

### R4 — Transferring to an observable wait

When the agent has started observable long-running work and no useful agent action remains until that work changes state, it must transfer ownership in this order:

1. Retain an inspectable process, job, or child identity and the command or operation being monitored.
2. Create one RLM heartbeat for that exact wait with a unique wait label and retain the returned heartbeat identifier beside the external identity.
3. Give the heartbeat all information required by the heartbeat contract in R5.
4. Verify that heartbeat creation succeeded.
5. Recheck the external operation. If it is already terminal, delete and verify removal of the new heartbeat and handle the result in the current epoch instead of entering waiting state.
6. Complete the compatible active-work goal with `await goal.complete()`. This completes the written epoch objective, not necessarily the requested outcome.
7. Tell the operator what is running, what evidence will end the wait, the exact monitor identity, and what will happen next. If `goal.complete()` returned a completion budget report, include it as accounting for the completed epoch without implying that the requested outcome succeeded.
8. End the turn. Do not poll with a sleeping/open tool call and do not continue spending goal continuations.

The overlap between heartbeat and goal in steps 2–5 is intentional. Monitoring must exist before goal continuation stops. The overlap must last only for this handoff.

If there is no compatible pending goal, the agent skips goal completion rather than fabricating it. If heartbeat creation fails, it must preserve the work identity, keep the goal active when possible, and report the monitoring failure instead of silently abandoning the work. If goal completion fails after heartbeat creation, it must retain the heartbeat and external identity for safety, report a control-plane blocker, and not claim that ownership transfer completed. Any later repair must first inspect both exact identities and current goal state.

A short command that can be awaited without context or responsiveness harm does not require this transition. The policy is for waits long enough that keeping the agent run or goal continuation loop active would be wasteful or disruptive.

### R5 — Heartbeat contract

Every heartbeat created by this policy must state:

- the retained handle or identity and how to inspect it;
- what “still running” looks like;
- exact success evidence;
- exact failure evidence;
- a staleness deadline or escalation condition when the work can hang silently;
- cleanup actions for the heartbeat and any temporary resources;
- the resumable checkpoint and the next work decision; and
- that no new goal should be created merely to report unchanged waiting state.

The external identity must remain inspectable for the expected waiting epoch. A transient REPL object alone is insufficient when restart or kernel loss is plausible; record a process/job/deployment/child identifier plus an output or status location appropriate to that wait. Wait-specific evidence defines terminal state: progress output or an ordinary child message is not terminal unless the underlying operation is also known to have ended.

The heartbeat interval must fit the expected duration and operational cost; it must not default blindly when a more appropriate interval is known. Routine monitors use `delivery_mode="follow_up"` so they cannot interrupt an unrelated active turn. Steering requires a documented safety/timeliness reason and dedicated interruption-race acceptance evidence.

While work remains non-terminal, the heartbeat ends its check without creating a new goal. It reports only meaningful progress, changed risk, failure, staleness, or a new blocker—not repeated unchanged status. At the declared staleness boundary it may perform only an already-authorized bounded diagnosis. It then either continues monitoring because concrete progress is evidenced, or deletes the monitor and transfers the diagnosis/recovery decision to a future compatible goal or an actionable external-blocker report. The monitor never starts or retries the external work.

Terminal cleanup means `await rlm_heartbeat.delete(id)` for the exact retained ID followed by verification that the ID is no longer active. Pausing a heartbeat is not terminal cleanup. Deletion failure is a control-plane blocker: preserve the external identity and checkpoint, report it, and do not create a duplicate monitor.

This change does not promise autonomous recovery across a full Prime Agent host restart. It does require the external identity and checkpoint to survive in session-visible text or another inspectable location. On the first later run, if reload/restart removed the monitor or made the operation uninspectable, fail closed with one actionable recovery report; do not assume success, create a duplicate monitor, or restart work automatically. Ordinary saved-session resume and context compaction must preserve the policy itself and must be covered by prompt-delivery acceptance.

### R6 — Terminal result and fresh-goal decision

The first agent run that observes terminal state owns terminal handling. It must:

1. Capture the terminal result and the evidence that identifies this exact operation.
2. Delete the owned heartbeat using its retained identifier, if it is still active, and verify that exact ID is absent from active monitors.
3. Perform required bounded cleanup.
4. Decide whether the requested outcome is now complete.
5. If the requested outcome is complete, report the final evidence without creating another goal.
6. If substantive agent work remains, create a fresh bounded active-work goal before continuing that work.

A newly created goal must name the next epoch and checkpoint. It must not attempt to resume or wait for continuation from the completed prior goal.

Another prompt or wait may already have created a pending goal before this result is handled. The terminal handler may continue under that existing goal only when its written objective explicitly owns this terminal-result work. If an unrelated or incompatible goal is pending, the handler must record and report this result and its checkpoint, defer substantive follow-up, and leave the unrelated goal unchanged. It must not create a second goal or complete the unrelated goal. When multiple waits become terminal close together, their cleanup remains independent, but their substantive follow-up epochs must be serialized under compatible goals.

Prime Agent can deliver both a process-completion notification and a scheduled heartbeat near the same time. Terminal handling must therefore be idempotent. A later duplicate observer must recognize already-consumed terminal state from the exact heartbeat ID, current goal/checkpoint, or recorded result and must not create a second goal, repeat cleanup, or repeat the same completion report.

Terminal observation and cleanup must not restart or retry failed work. Diagnosis or recovery beyond bounded evidence capture is substantive work and requires a compatible fresh goal. If fresh-goal creation fails, the agent must not proceed as though the next epoch were protected. It must report the control-plane failure and preserve the checkpoint.

### R7 — Human blockers

A human blocker specifically requires a person's credential, permission, physical action, product decision, or other human-only intervention. The agent may first perform only already-authorized, in-scope checks that do not bypass credential or security boundaries. If the blocker remains, it must:

1. Stop only heartbeats or scheduled monitors for the blocked objective that cannot produce useful new evidence without the human action. Preserve unrelated monitoring and safely running work that still has value.
2. Complete a compatible current active-work goal because its written epoch objective has reached the actionable handoff boundary. If no compatible active goal exists, skip completion rather than fabricate it.
3. Report once: the exact blocker, why the agent cannot resolve it internally, the exact external action required, whether any process remains active, and the resumable checkpoint.
4. End the turn and wait for the operator.

The agent must not create a recurring heartbeat merely to poll for a person. A machine condition such as a service outage or rate limit may use a heartbeat only when it has a safe observable check, a bounded expected window, and no human action is required; otherwise report it once as an external blocker without recurring monitoring. After the operator confirms that a human blocker is cleared, the next substantive agent work begins under a fresh bounded goal unless an existing compatible goal explicitly owns it. No completed prior goal is resumed.

### R8 — Actual completion

When the requested outcome itself is complete, the agent must:

- complete a compatible active goal whose written epoch objective has been achieved, while preserving any human-paused or otherwise incompatible goal;
- delete every heartbeat owned by that outcome;
- report the outcome and decisive evidence;
- include any completion budget report returned by `goal.complete()`; and
- stop without creating a replacement goal.

### R9 — Prohibited transport and obsolete tools

Prime Claw must not expose model-facing `pause_thread_goal` or `resume_thread_goal` tools. No managed plugin code may enqueue `/goal pause` or `/goal resume` as a user message through steering, follow-up, or another delivery lane.

The policy must tell the model not to call, simulate, or inject those slash commands for autonomous work/wait control. This prohibition does not remove or alter the native commands available to a human operator.

### R10 — Ralph ownership boundary

This plugin-global policy owns generic goal and heartbeat control. Ralph `/execute` retains only Ralph-specific behavior: selecting one approved slice, maintaining the plan/specification/beads state, updating documentation, validating, committing, and reporting.

The execute skill must not regain a separate or conflicting generic work/wait lifecycle. It may refer to the global policy without copying it.

## Failure behavior and invariants

The implementation and policy must preserve these invariants:

1. **No unmonitored external wait:** an active long-running operation has a retained handle and one monitor before the active goal is completed.
2. **No dual owner for the same next action:** a goal and heartbeat may coexist only for independent work. A heartbeat never drives the agent work already owned by the active goal.
3. **No human polling:** a heartbeat does not exist solely to discover whether a person acted.
4. **No stale resume:** completed epochs are followed only by fresh goals.
5. **No silent control-plane failure:** failures to create/delete a heartbeat or create/complete a goal are reported with the checkpoint intact.
6. **No scope expansion:** a new epoch continues only the authorized requested outcome and any narrower episode/expert/delegated scope.
7. **No duplicate terminal action:** competing completion notice and heartbeat deliveries converge idempotently.
8. **No credential workaround:** this lifecycle does not authorize obtaining credentials from prohibited stores or bypassing authentication boundaries.

## Plugin installation and migration requirements

1. Managed source must have one canonical owner for the global policy and its V1 sentinel.
2. The obsolete source `src/prime-agent-plugin/extensions/goal-blocker-control.ts` must be removed. Apply must install the new policy generation and remove the formerly managed installed file `extensions/goal-blocker-control.ts`.
3. Apply must reject unsafe non-regular destinations before deletion or replacement, consistent with the existing installer safety model.
4. Check must reject a missing, duplicated, or stale managed policy generation and must reject the obsolete `extensions/goal-blocker-control.ts` when it remains installed. Unrelated extensions are not deleted; a marker collision fails closed for operator resolution.
5. Unrelated global extensions and unrelated managed system-prompt content must remain untouched.
6. The builder checkout must not contain a live copy under `.prime/agent/extensions/`; source remains inert until the apply script installs it globally.
7. Apply/check remain convergent under `PRIME_AGENT_PLUGIN_ROOT` so tests never need to mutate the real user-global installation.
8. Apply does not mutate existing session goal state or purge queued session inputs. Legacy paused or budget-limited goals and queued old-generation commands require documented human recovery or a fresh session.
9. After real installation, a restart is required to load the new extension generation, and a fresh clean Prime Agent session must verify it before the generation is called active. Restart alone must not be claimed to clear legacy session inputs unless a probe proves that separately.

## Documentation requirements

Repository documentation must explain, without relying on this conversation:

- the policy lineage, exact Git revisions, operator-observed incidents, and limits of prior evidence;
- the persistent goal and agent-owned heartbeat facilities this policy uses;
- the active-work, observable-wait, human-blocked, and finished states;
- why epoch goals are completed and replaced rather than paused and resumed;
- why agent-injected goal slash commands are prohibited;
- the deliberate heartbeat-before-completion safety correction relative to historical ordering;
- the heartbeat identity/instruction contract and follow-up delivery default;
- capability gating, tested Prime Agent generation, and unproven global-scope expansion;
- concurrent waits and duplicate terminal-notice handling;
- legacy-session, installation, check, restart, and fail-closed recovery behavior; and
- the intentional distinction between completing an epoch goal and completing the requested outcome.

## Acceptance criteria

The change is accepted only when all of the following are proven with reproducible artifacts.

### Policy delivery and compatibility

1. A native provider-capture probe records the exact `systemPrompt` for a compatible Prime Agent 0.9.6 downstream run and finds `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` exactly once in every ordinary primary provider request.
2. The probe matrix covers a first user turn, second user turn, resource reload, saved-session resume, post-compaction continuation, queued follow-up, RLM-heartbeat turn, agent-message turn, and goal-continuation turn. Internal summarizer/refinement calls are labeled and excluded rather than silently mixed into counts.
3. Session records contain zero user or durable custom messages carrying the policy sentinel or full policy text.
4. A project-local `.prime/agent/APPEND_SYSTEM.md` does not suppress the policy.
5. Separate probes remove each compatibility signal in turn—selected `ipython`, loaded `goal`, and loaded `rlm-heartbeat`—and show that unusable guidance is omitted. A compatible probe also proves non-mutating `await goal.get()` and `await rlm_heartbeat.list()` calls succeed.
6. Resource reload re-evaluates compatibility rather than retaining a stale decision.
7. A bounded session with all capabilities receives one policy copy without changing its episode, expert, or delegated-task scope.
8. The canonical injected policy is deterministic and no more than 4,000 UTF-8 characters excluding sentinel delimiters.

### Tool, transport, artifact, and migration behavior

9. No Prime-Claw-managed runtime registers `pause_thread_goal` or `resume_thread_goal`.
10. No managed plugin source sends `/goal pause` or `/goal resume` as a user message.
11. `src/prime-agent-plugin/extensions/goal-blocker-control.ts` and the installed managed path `extensions/goal-blocker-control.ts` are absent after migration. Apply removes only the safe regular-file managed destination; check rejects its reintroduction.
12. Exactly one new managed policy source owns the V1 sentinel. Tests use isolated plugin roots when asserting absence or uniqueness; unrelated external extensions are not deleted or rewritten. A sentinel collision outside the managed source fails closed with an actionable diagnostic.
13. Human-entered native `/goal pause`, `/goal resume`, and `/goal clear` behavior is unchanged.
14. Migration documentation states that apply does not mutate stored session goal state or guarantee removal of already queued session inputs. Activation testing uses a fresh clean session. Legacy sessions with `paused` or `budget_limited` goals require explicit human recovery through native goal controls or a new clean session; the agent never injects those commands.

### Lifecycle behavior

15. An ordered lifecycle probe demonstrates: retain inspectable external identity → create uniquely labeled follow-up heartbeat → retain and verify heartbeat ID → recheck external state → complete compatible epoch goal → report handoff → end turn.
16. If the external operation becomes terminal before handoff ends, the probe shows deletion verification and current-epoch result handling instead of entry into waiting state.
17. Between epoch-goal completion and terminal evidence, session records contain zero newly delivered host goal-continuation entries for that completed epoch.
18. A non-terminal heartbeat check creates no goal, does not restart work, and emits no duplicate unchanged-status report.
19. Terminal success that completes the requested outcome deletes and verifies the exact heartbeat, reports final evidence, and creates no goal.
20. A terminal result that leaves substantive work creates exactly one fresh compatible goal before that work continues.
21. If an unrelated goal is already pending, terminal cleanup records the checkpoint but neither creates another goal nor completes the unrelated goal. Two near-simultaneous wait completions serialize substantive follow-up under compatible goals.
22. Competing heartbeat and native terminal-notice deliveries perform heartbeat deletion, cleanup, user reporting, and fresh-goal creation at most once for the same wait identity.
23. A human-blocker fixture shows no polling heartbeat, completion only of a compatible epoch goal, one actionable report, and fresh-goal creation only after a later operator-clear input. A synthetic later operator message is acceptable for deterministic regression coverage; manual dogfood is still required before rollout is claimed.
24. Failure probes cover heartbeat creation, heartbeat deletion, epoch-goal completion, fresh-goal creation, capability loss on reload, stale timeout, and terminal failure. Each preserves the external identity/checkpoint, reports a clear degraded state, and never silently restarts or duplicates work.
25. A restart/reload recovery probe documents whether the exact monitor and external identity remain inspectable. If either cannot be recovered, the first later compatible run fails closed as specified rather than assuming success.
26. A completed, errored, paused, budget-limited, human-created broader, or otherwise incompatible goal is never treated as a resumable epoch goal and is never completed while its written objective is false.

### Project boundaries, documentation, and installation

27. Regression coverage keeps the generic lifecycle out of `.ralph/skills/execute/SKILL.md` while preserving Ralph-specific single-slice behavior.
28. Documentation records the policy lineage (`d742c81`, `09f5953`, `3d49762`, `2651573`, and `b56b080`), operator-observed incidents, accepted reliability-over-semantic-continuity decision, and the distinction between epoch completion and requested-outcome completion.
29. `.ralph/README.md`, `docs/lab-global-plugin.md`, and `docs/conversation-driven-episode-oversight.md` no longer claim that `/execute` or the obsolete extension owns the current generic protocol.
30. Apply/check tests prove safe obsolete-file removal, source/installed parity, project-source inertness, canonical-marker uniqueness, and no mutation outside managed paths.
31. The complete managed plugin apply/check workflow passes against an isolated `PRIME_AGENT_PLUGIN_ROOT`.
32. After applying to the real user-global installation, `scripts/check-prime-agent-plugin.sh` passes and a fresh builder-rooted Prime Agent startup probe confirms the new generation before activation is claimed.
33. Manual dogfood captures ordered evidence for both transitions:
    - active goal → monitored wait → verified cleanup → no remaining work; and
    - active goal → monitored wait → verified cleanup → one fresh goal → completed requested outcome.

For criteria 15–25 and 33, the evidence bundle must include ordered goal-state results, heartbeat create/list/delete results with exact IDs, external terminal evidence, relevant session-record types, and the resulting fresh-goal state or explicit no-goal decision.

## Relevant repository surfaces

The future execution plan should inspect at least:

- `src/prime-agent-plugin/extensions/goal-blocker-control.ts`
- `src/prime-agent-plugin/APPEND_SYSTEM.md`
- `scripts/apply-prime-agent-plugin.sh`
- `scripts/check-prime-agent-plugin.sh`
- `tests/test_goal_blocker_control_extension.py`
- `tests/test_prime_agent_plugin_install.py`
- `.ralph/skills/execute/SKILL.md`
- `tests/test_execute_skill.py`
- `.ralph/README.md`
- `docs/lab-global-plugin.md`
- `docs/conversation-driven-episode-oversight.md`
- `scripts/run-prime-agent-probe.sh`

Historical intent and prior validation claims are also available through `bd show prime-claw-1ht` and `bd show prime-claw-5d6`. Git revisions `d742c81`, `09f5953`, `3d49762`, `2651573`, and `b56b080` provide the exact policy lineage. Repository history proves what instructions and tests existed; the sanitized operator incident record in this specification supplies the runtime observations that history cannot.

Tests or probes that start Prime Agent or mutate configuration must follow the repository's native probe-isolation and installed-generation rules.

## Planning boundary

The execution plan may choose the supported plugin mechanism that best satisfies these requirements. It must compare at least:

- per-run system-prompt contribution through a supported extension hook; and
- management of a static user-global append-system block.

The comparison must account for project-file shadowing, capability detection, non-accumulation, stable prompt caching, installation ownership, and testability. The static global block is not presumed viable: current Prime Agent discovery gives a project append file precedence over the global append file and a static block cannot by itself perform per-run capability gating. It may be selected only if the plan demonstrates supported mechanisms that satisfy both requirements. A discoverable reference skill may supplement the policy, but it cannot be the sole carrier because invocation would be optional.

The plan must not solve this by modifying Prime Agent core, monkey-patching private session methods, or adding a second hidden copy of the policy to Ralph `/execute`.
