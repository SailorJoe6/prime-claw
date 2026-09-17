# Native handoff chain

> **Status:** Phase 4a dogfood automation. The transition is implemented and
> regression-tested, but the wider episode loop remains manual-first and Phase 4
> is not complete.
> **Beads:** `prime-claw-h6w` → `prime-claw-f81` → `prime-claw-f81.2`

prime-claw has one project-local native command for a transition that became
fully predictable during manual driving:

```text
/execute work → /handoff [optional compaction guidance] → focused compaction → next /execute work
```

The implementation is
[`.prime/agent/extensions/handoff-chain.ts`](../.prime/agent/extensions/handoff-chain.ts).
It automates this narrow seam. It does not choose work, decide that an iteration
is complete, or implement the full episode orchestrator.

## Command contract

Prime Agent recognizes a native slash command only when it starts the submitted
message after surrounding whitespace is trimmed. It passes all remaining text
after the command name to the extension as one argument string.

The handoff contract uses those native semantics deliberately:

```text
/handoff
/handoff focus on being ready to implement bead prime-claw-example
```

- `/handoff` always chains to canonical `execute` after successful compaction.
- All trailing text is free-form operator compaction guidance. It cannot select
  another phase or become part of a skill path.
- A message such as `I think you should /handoff now` is ordinary conversation,
  not a native command. The extension does not scan message substrings.

There is no custom target syntax and no `--next` option. Manual dogfooding has
not shown a need for any follow-on phase other than `execute`.

## Why this seam was automated

During real Phase 3 work, `/handoff` was invoked only when another execution
iteration would follow. Terminal close-out did not invoke handoff. That made
handoff-to-execute a repeated, evidence-backed transition rather than a loop we
were predicting in advance.

This preserves the project rule: **drive manually first, codify only what stays
stable, and build the orchestrator last.**

## Runtime flow

1. Prime Agent discovers the extension from the session project's
   `.prime/agent/extensions/` directory and registers native `/handoff`.
2. The handler gets the stable session UUID from
   `ctx.sessionManager.getSessionId()` and adds that UUID to an in-memory set
   of sessions awaiting execute. One loaded extension closure can be shared by
   root and RLM child sessions, so the key is required even for closure state.
3. The extension loads the project's canonical
   `.ralph/skills/handoff/SKILL.md` and injects it as the user message. If the
   command has trailing text, the extension appends it in a separate
   `<operator-compaction-guidance>` block. User text never enters routing state
   or a filesystem path.
4. The canonical handoff skill updates durable state such as living docs and
   beads. It requires the agent to incorporate the operator guidance into the
   focus hint passed to `await compact.run(focus_hint)`.
5. Successful compaction emits `session_compact` through the same extension
   runtime. The hook deletes only that event context's session UUID from the
   pending set before loading and injecting `.ralph/skills/execute/SKILL.md`.
6. Deleting pending state before injection preserves consume-once behavior: a
   later compaction cannot inject execute again.

The canonical workflow prose remains in `.ralph/skills/`; the TypeScript
extension loads it instead of duplicating it.

## State and ownership

| Item | Owner | Lifetime |
|---|---|---|
| `.ralph/skills/handoff/SKILL.md` | Project/operator | Canonical, tracked workflow text |
| `.ralph/skills/execute/SKILL.md` | Project/operator | Canonical, tracked workflow text |
| `.prime/agent/extensions/handoff-chain.ts` | prime-claw | Tracked native transition mechanism |
| In-memory `pendingExecuteBySession` set | Extension code | Loaded extension runtime; keyed by stable Prime Agent session UUID and consumed after compaction |
| `<operator-compaction-guidance>` | Operator | One handoff and compaction boundary |

Prime Agent compaction does not reload extensions, so the set survives the
intended handoff boundary. Two sessions rooted in the same checkout, including
a root and RLM child that share an extension closure, cannot overwrite or
consume each other's pending handoff. The LLM does not create, route, or consume
pending state.

There is intentionally no `.agents/skills/handoff` symlink. Keeping it would
expose both `/handoff` and `/skill:handoff` for the same workflow.

If the canonical handoff skill is missing, the command removes the current
session's pending entry and warns. If canonical execute is missing after
compaction, the hook first consumes the entry and then warns instead of retrying
unpredictably.

### Stale-state cleanup

The Phase 4a.1 `.prime/agent/state/chain-next` marker had no session owner. The
current extension deletes that legacy file without consuming it whenever the
command or a relevant session lifecycle event runs. It is never allowed to
inject a skill.

Current pending state is memory-only. `session_shutdown` and `session_start`
clear the affected session UUID, and an extension reload or process restart
creates an empty set. The chain therefore fails closed across quit, reload,
session replacement, or a crash. Pending state is intended to survive the
handoff's compaction, not an extension reload or a later resumed session.

### Shared-runtime delivery follow-up

The pending-state map is safe when a root and RLM child share one loaded
extension closure. Prime Agent 0.9.5 also shares and rebinds the captured
extension runtime used by `pi.sendUserMessage`; the public event context has no
session-bound send method. A real concurrent root/RLM-child integration test is
therefore still required before Phase 4b depends on handoffs in both sessions.
That harness-level delivery proof or fix is tracked separately in
`prime-claw-f81.3`.

## Relationship to the legacy Ralph shell loop

The historical Ralph launcher delegates to a `start` shell script whose
`while :` loop:

- infers design, plan, or execute from the planning documents;
- runs one phase prompt;
- after a non-terminal execute pass, resumes the same Claude or Codex session
  with the handoff prompt; and
- returns to the next loop pass.

That script also owns retries, permissions, signal forwarding, logs, container
execution, callbacks, and backend-specific failure classification. The native
extension is not a port of those responsibilities. Prime Agent already owns the
session, and targeted compaction replaces Ralph's clear-and-restart boundary.
The extension only replaces the first transition that manual dogfooding proved
stable.

## Short-session edge and recovery

In Prime Agent 0.9.5, `compact.run()` does not compact when there is no history
older than its `keepRecentTokens` window (20,000 tokens by default). No
`session_compact` event is emitted, so that session's in-memory entry remains
pending while the extension runtime stays loaded.

Do not hide that state or pretend compaction succeeded:

1. If execution should still continue, retry the focused compaction after the
   session has enough older history.
2. If the chain should be cancelled, run `/reload`. Reload replaces the
   extension runtime and therefore clears pending in-memory state.

A later unrelated session cannot consume the entry because pending state is
keyed by session UUID.

## Evidence

Two levels of runtime evidence established the original transition before these
regressions were added:

- A disposable Prime Agent 0.9.5 fixture registered native `/handoff`, wrote the
  marker, performed real compaction, injected one execute prompt in the JSONL,
  ran the execute proof, and consumed the marker. Duplicate text visible in the
  TUI was rendering only; the session log held one injected prompt.
- The real `prime-claw implementation` session
  (`01a08d45-2530-7042-9b25-132a01919d01`) recorded handoff injection at
  18:15:38, `compact.run()` scheduling at 18:17:01, compaction entry `24cbcfb3`
  at 18:17:49, and execute injection at 18:17:50 on 2026-09-16. Execution then
  stopped correctly at an explicit operator-confirmation gate in the plan.

Regression coverage lives in
[`tests/handoff_chain_extension.test.mjs`](../tests/handoff_chain_extension.test.mjs)
and is included in pytest through
[`tests/test_handoff_chain_extension.py`](../tests/test_handoff_chain_extension.py).
It imports the real TypeScript extension and covers command registration,
canonical markdown loading, free-form guidance, fixed execute routing,
per-session isolation in a shared CWD, consume-once behavior, stale-state
cleanup, and missing-skill warnings. The pytest bridge also asks the installed
Prime Agent RPC loader for its command list and verifies that the real extension
registers exactly one native `/handoff`, without invoking a model.

Run it with:

```bash
pytest -q tests/test_handoff_chain_extension.py
```
