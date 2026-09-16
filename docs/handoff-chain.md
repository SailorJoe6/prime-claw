# Native handoff chain

> **Status:** Phase 4a dogfood automation. The transition is shipped and tested,
> but the wider episode loop remains manual-first and Phase 4 is not complete.
> **Beads:** `prime-claw-h6w` → `prime-claw-f81` → `prime-claw-f81.1`

prime-claw has one project-local native command for a transition that became
fully predictable during manual driving:

```text
/execute work → /handoff → focused compaction → next /execute work
```

The implementation is
[`.prime/agent/extensions/handoff-chain.ts`](../.prime/agent/extensions/handoff-chain.ts).
It automates this narrow seam. It does not choose work, decide that an iteration
is complete, or implement the full episode orchestrator.

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
2. `/handoff` resolves paths from the command's `ctx.cwd`. It writes the
   code-owned marker `.prime/agent/state/chain-next` (`execute` by default).
3. The extension loads the project's canonical
   `.ralph/skills/handoff/SKILL.md` and injects it as the user message. It does
   not copy workflow prose into TypeScript.
4. The handoff skill updates durable state such as living docs and beads. It
   then calls `compact.run(focus_hint)` with deliberate instructions for the
   next iteration.
5. Successful compaction emits `session_compact`. The extension reads and
   removes the marker *before* it loads
   `.ralph/skills/<next>/SKILL.md` and injects that skill.
6. Removing the marker before injection prevents replay: after a successful
   send, a later compaction cannot inject the same next skill again.

An optional argument changes the next skill, for example `/handoff review`.
The normal Ralph path uses the default, `execute`.

## State and ownership

| Item | Owner | Lifetime |
|---|---|---|
| `.ralph/skills/handoff/SKILL.md` | Project/operator | Canonical, tracked workflow text |
| `.ralph/skills/execute/SKILL.md` | Project/operator | Canonical, tracked workflow text |
| `.prime/agent/extensions/handoff-chain.ts` | prime-claw | Tracked native transition mechanism |
| `.prime/agent/state/chain-next` | Extension code | Transient; ignored by Git and consumed after compaction |
| Handoff focus hint | Handoff author | One compaction boundary |

The LLM does not create, route, or consume the marker. It remains free to edit
the canonical markdown for the project. There is intentionally no
`.agents/skills/handoff` symlink: keeping it would expose both `/handoff` and
`/skill:handoff` for the same workflow.

If the handoff skill is missing, the command removes the new marker and warns.
If the requested next skill is missing, the compaction hook consumes the marker
and warns instead of retrying unpredictably.

### Current concurrency limit

The marker is currently scoped to the project CWD, not to a Prime Agent session.
Two sessions rooted in the same project can overwrite or consume each other's
pending chain. Do not run concurrent handoffs in one checkout. Session-scoped
state is tracked in `prime-claw-f81.2` rather than being designed without
episode-mechanics evidence.

The optional next-skill argument is also not validated yet. Use only a trusted,
plain skill-directory name. Target validation is included in `prime-claw-f81.2`.

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
`session_compact` event is emitted, so the marker remains pending. A later,
unrelated compaction would then consume it and inject the next skill.

Do not hide that state or pretend compaction succeeded:

1. If execution should still continue, retry the focused compaction after the
   session has enough older history.
2. If the chain should be cancelled, remove the pending marker explicitly:

   ```bash
   rm -f .prime/agent/state/chain-next
   ```

The edge is documented rather than automated away because current dogfooding
has not established a better general policy.

## Evidence

Two levels of runtime evidence established the transition before these tests
were added:

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
It imports the real TypeScript extension and checks command registration,
session-CWD resolution, byte-preserving canonical markdown loading, marker
creation and consumption, missing-skill warnings, no-marker behavior, and
one-time next-skill injection. The pytest bridge also asks the installed Prime
Agent RPC loader for its command list and verifies that the real extension
registers exactly one native `/handoff`, without invoking a model.

Run it with:

```bash
pytest -q tests/test_handoff_chain_extension.py
```
