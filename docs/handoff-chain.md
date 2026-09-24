# Ralph handoff chain

> **Status:** Phase 4a dogfood automation. Native `/handoff` and the explicit
> `ralph_handoff` conversational tool admit canonical `execute` independently
> from best-effort compaction. An owning project conversation can drive the same
> transition in its exact episode through `handoff_spec_episode`. Phase 4 remains
> manual-first and is not complete.
> **Beads:** `prime-claw-h6w` → `prime-claw-f81` → `prime-claw-f81.2`; conversational adapters `prime-claw-h6w.18`, `prime-claw-h6w.21`

prime-claw has two explicit project-local entry surfaces for a transition that
became predictable during manual driving:

```text
/execute work → /handoff [optional compaction guidance] → best-effort compaction
              → queued canonical /execute work
```

The mechanism is
[`src/prime-agent-plugin/extensions/handoff-chain.ts`](../src/prime-agent-plugin/extensions/handoff-chain.ts).
It automates only this narrow seam. It does not choose work, decide that an
iteration is complete, or implement the episode orchestrator.

## Entry contracts

### Native command

Prime Agent recognizes a native slash command only when it starts the submitted
message after surrounding whitespace is trimmed. All remaining text is passed to
the extension as one argument string.

```text
/handoff
/handoff focus on being ready to implement bead prime-claw-example
```

- `/handoff` authorizes one canonical execute follow-up.
- `/handoff` with no trailing text keeps the default canonical workflow. It does
  not require an operator-supplied focus hint.
- Trailing text is free-form compaction guidance. It cannot select another phase
  or become part of a skill path.
- `I think you should /handoff now` is ordinary conversation. The extension does
  not scan message substrings.

There is no custom target syntax and no `--next` option.

### Conversational tool

A fresh project session also exposes the model-callable `ralph_handoff` tool.
It is a separate, explicit adapter rather than a prose parser or generic command
router:

- call it only when the operator clearly asks to hand off the current Ralph
  implementation pass;
- pass only optional operator-supplied `guidance`; the tool has no command,
  phase, approval, target, or arbitrary routing field;
- ask the operator first when the desired handoff objective would otherwise be
  materially inferred; and
- treat successful admission as terminal for the current implementation turn.

Inline mentions remain ordinary prose. The extension has no input listener that
scans for words such as “handoff.” Successful tool output reports only that the
canonical workflows were admitted; it does not claim that handoff, compaction,
or the following execute pass completed.

### Owner-driven episode tool

The project-conversation extension also exposes `handoff_spec_episode` for the
one remote transition proved necessary by manual oversight. Its input is only:

```json
{"location":".ralph/plans/future/<slug>","guidance":"optional bounded compaction focus"}
```

The exact location selects the ignored durable episode identity. Host code
requires the caller to be that identity's top-level owner and revalidates the
branch, worktree, durable session ID and file, CWD, and session name. The model
cannot supply an active routing ID, worktree, session name, command, phase, or
arbitrary prompt. An inactive exact session is reopened through the existing
identity-checked path and its refreshed active ID is persisted.

The exact owner may initiate this transition without a new operator transport
request after it accepts an exact candidate and selects an approved `advance`, or
after it accepts and durably records findings for an in-scope `revise`. Optional
guidance may carry operator focus or a bounded compaction-focus synthesis of
those accepted records. It cannot carry arbitrary chat, unaccepted findings,
product decisions, or scope expansion, and the tool is not used for `consult`,
`pause`, merge, abandonment, or cleanup. The broader `ralph_handoff` adapter
above remains operator-request-only; this owner-specific rule does not change it.

Before sending either workflow, the host preflights both canonical Markdown
files and obtains the daemon's exact state. Admission fails closed unless the
episode has no active turn, tool, bash process, compaction, RLM child, unfinished
action, steering message, or follow-up. The first daemon prompt is canonical
handoff with `streamingBehavior: "steer"` and `queueIfBusy: false`; only after
that acknowledgement does the host queue canonical execute with
`streamingBehavior: "followUp"` and `queueIfBusy: true`. The second prompt is
the sole follow-up. The daemon's fail-if-busy check is authoritative if activity
starts after the state snapshot.

Success reports admission only. The episode's ordered `Status / Evidence / Next
Step` handoff result is the observable compaction-request evidence; execute can
run only after that handoff turn reaches its boundary. A first-send failure
queues no execute. A second-send failure explicitly reports that handoff was
admitted but continuation was not queued. Ambiguous transport outcomes require
owner inspection and are never retried automatically. Existing episode
resources are never deleted to compensate for a remote handoff failure. After
admission the owner creates exactly one new generation watch before yielding.
Terminal finalization cancels episode watches and returns the same conversation
to incubation; a later different reviewed folder starts through a fresh native
`/implement-spec`, not through this continuation tool.

Initial `createSpecEpisode()` also uses the handoff-first transport. The forked
episode inherits the reviewed planning conversation, so canonical handoff
requests focused compaction before the first execute slice starts. A version-2
bootstrap admission journal durably separates the two daemon mutations:
`handoff-pending` precedes the steer; `execute-pending` is persisted after the
handoff acknowledgement and before the sole follow-up; `delivered` follows the
second acknowledgement. Rejections and ambiguous crash windows after handoff
preserve all episode resources and never replay automatically. Version-1
identities remain truthful legacy direct-execute records.

## Runtime flow

1. Prime Agent discovers the extension and registers native `/handoff` plus the
   explicit `ralph_handoff` tool.
2. The command preflights both canonical files:
   `.ralph/skills/handoff/SKILL.md` and `.ralph/skills/execute/SKILL.md`. A
   missing file fails before the extension begins a partial transition.
3. The shared admission helper injects canonical handoff first. Optional guidance
   is appended in the existing `<operator-compaction-guidance>` envelope. For
   `handoff_spec_episode`, the legacy tag may contain the exact owner's bounded
   compaction focus derived from accepted durable findings; it does not imply a
   fresh operator transport request. User text never enters routing state or a
   filesystem path. Native `/handoff` keeps idle
   command delivery unchanged; `ralph_handoff` explicitly uses `deliverAs:
   "steer"` because a tool runs while the agent is streaming.
4. At the same admission boundary, both entry surfaces queue canonical execute
   exactly once with `pi.sendUserMessage(..., { deliverAs: "followUp" })`.
5. The handoff turn updates durable context and calls `compact.run(focus_hint)`
   once. Its immediate result reports only whether compaction was requested.
6. Prime Agent runs requested compaction at the turn boundary when possible,
   then starts the already queued execute follow-up.

There is no `session_compact` execute-admission hook and no pending-session set.
A late or repeated compaction signal therefore has no path to admit another
execute pass.

## Compaction and continuation outcomes

Compaction is a best-effort context improvement, not the continuation trigger.

| Outcome | Native behavior |
|---|---|
| `compact.run()` returns `scheduled: false` | No compaction is attempted; the queued execute turn starts after handoff |
| Requested compaction succeeds | Prime Agent records the compaction, then starts queued execute |
| Requested compaction is cancelled | If the session and queued action remain live, Prime Agent starts queued execute |
| Requested compaction fails or is skipped | Prime Agent reports the outcome and resumes queued work |
| Execute follow-up is explicitly removed | The transition is cancelled; the extension does not reconstruct or retry it |
| Session is terminated or replaced | The queued transition ends with that session |
| A compaction event arrives late or repeats | Nothing additional is admitted |

The handoff skill distinguishes **requested** from **confirmed** compaction. A
`scheduled: true` acknowledgement is not completion evidence. Later success,
cancellation, or failure is surfaced by Prime Agent itself rather than inferred
from the presence or absence of `session_compact`.

### Client interruption

Interruption is a client/runtime action, not a compaction outcome invented by
the extension. Public Prime Agent 0.9.5 evidence distinguishes two boundaries:

- cancellation inside `session_before_compact` aborts only compaction and
  preserves the native follow-up, so execute continues once;
- named TUI `C-c` during a running handoff tool aborts the turn and removes the
  queued execute action; one later submit can finish the interrupted handoff,
  but execute is not reconstructed; and
- ACP `session/cancel`, `session/close`, and session replacement are also
  whole-turn or lifecycle cancellation boundaries; observed runs removed the
  queued execute action and the extension did not retry it.

The extension does not guess which action the operator intended, persist a retry,
or recreate a removed message. Whole-turn interruption, explicit queue removal,
and session lifecycle therefore remain cancellation boundaries.

Prime Agent documents TUI Alt+Up followed by an empty edit as explicit queued
message deletion. This episode could not obtain direct runtime evidence for that
specific gesture: named `M-Up` was not observable through the noninteractive
tmux transport even with fresh `csi-u` negotiation, and ACP/RPC expose no queue
removal method. Treat that as an acceptance-evidence boundary, not as a proven
runtime path or a reason to patch private queue state.

## State and ownership

| Item | Owner | Lifetime |
|---|---|---|
| `.ralph/skills/handoff/SKILL.md` | Project/operator | Canonical tracked workflow |
| `.ralph/skills/execute/SKILL.md` | Project/operator | Canonical tracked workflow |
| `src/prime-agent-plugin/extensions/handoff-chain.ts` | prime-claw | Inert source for native and current-session conversational admission |
| `src/prime-agent-plugin/extension-support/handoff-prompts.ts` | prime-claw | Inert source for shared canonical handoff/execute prompt construction |
| Durable episode identity | Owning project conversation | Exact remote episode authorization and routing validation |
| Native `followUp` action | Prime Agent session | From any entry surface's admission until delivery, removal, or session end |
| `<operator-compaction-guidance>` | Operator, or exact episode owner from accepted durable findings | One handoff turn and optional bounded compaction boundary; the legacy tag is not a routing authority |

Canonical workflow prose remains customizable Markdown. The extension loads it
rather than duplicating it. The LLM does not choose the next phase or create
transition state.

There is intentionally no `.agents/skills/handoff` symlink. Keeping one would
expose both `/handoff` and `/skill:handoff` for the same workflow.

### Legacy cleanup

The older `.prime/agent/state/chain-next` marker had no trustworthy session
owner. The extension deletes that file without consuming it on command,
`session_start`, and `session_shutdown`. It is never allowed to inject a skill.
No new project-local transition marker replaces it.

### Shared-runtime limitation

Prime Agent 0.9.5 may share and rebind the extension runtime captured by
`pi.sendUserMessage` across a root and RLM child. The public event context has no
session-bound send method. Supported top-level session behavior does not prove
root/RLM-child delivery isolation. `handoff_spec_episode` does not use that
captured extension runtime: it targets the exact validated daemon active ID.
The separate current-session limitation remains tracked by `prime-claw-f81.3`.

## Relationship to the legacy Ralph shell loop

The historical Ralph launcher owns a full loop: phase inference, retries,
permissions, signal forwarding, logs, containers, callbacks, and backend failure
classification. This native extension is not a port of those responsibilities.
Prime Agent owns the session and queue. The extension only automates the first
transition that manual dogfooding proved stable.

## Evidence

Prime Agent 0.9.5 disposable RPC probes loaded the revised real extension,
invoked its public native command, and persisted events for the follow-up seam:

- a short session returned `scheduled: false` and started one follow-up turn;
- requested compaction completed and then started one follow-up turn; and
- `session_before_compact` cancellation recorded `aborted: true` and then
  completed one follow-up turn; and
- a bounded synthetic compaction failure was surfaced and then completed one
  follow-up turn.

In every compaction probe, the execute marker had one user `message_start`, one
exact assistant completion, and the final queue state contained no additional
follow-up. Installed runtime source also shows requested-compaction skip/failure
resuming queued work; compaction cancellation and success both return control to
the native session-input pump.

Public client/lifecycle probes add the cancellation boundary:

- TUI session `01a0c573-211f-745c-ad79-474a273f53d6` received named `C-c`
  while its bash tool visibly ran. The tool aborted. One later submit completed
  handoff, but the execute marker remained absent and the runtime queue was
  empty.
- ACP `session/cancel` during the running handoff removed execute; after the
  cancelling state settled, a later prompt completed without an execute marker.
- ACP `session/close` during the running handoff, followed by replacement,
  produced no execute marker in either session and no plugin retry.

These findings justify using the public follow-up queue without a project state
machine while documenting whole-turn cancellation accurately. Direct public
runtime proof of the TUI's explicit Alt+Up empty-edit deletion gesture remains
unsupported in this automation and is not claimed.

Focused regression coverage lives in
[`tests/handoff_chain_extension.test.mjs`](../tests/handoff_chain_extension.test.mjs)
and is bridged through
[`tests/test_handoff_chain_extension.py`](../tests/test_handoff_chain_extension.py).
It covers native and conversational registration, shared preflight, exact
guidance, native delivery compatibility, conversational `steer` followed by the
sole execute `followUp`, absence of prose or compaction admission hooks,
late-signal safety, visible first- and second-send errors, legacy cleanup, and
real offline command-and-tool loading.

Run it with:

```bash
node --experimental-strip-types --test tests/handoff_chain_extension.test.mjs
pytest -q tests/test_handoff_chain_extension.py
```
