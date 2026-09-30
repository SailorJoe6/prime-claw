# Goal and heartbeat work control

This document is the operational source of truth for Prime Claw's plugin-global
goal and heartbeat lifecycle policy. The implementation is being delivered in
six reviewed slices. This initial revision records only the Slice 1 carrier
characterization. It does not claim that the production policy, migration, or
lifecycle behavior is installed.

## Intended boundary

The policy belongs to the user-global Prime Claw plugin. It must contribute one
transient system-prompt block to each compatible agent run. It must not depend
on Ralph's `execute` skill, a project `APPEND_SYSTEM.md`, custom conversation
messages, Prime Agent core patches, or private runtime fields.

A compatible run has all three structured resources:

- `ipython` in `event.systemPromptOptions.selectedTools ?? ["ipython"]`;
- a model-visible Python skill named `goal` with import name `goal`; and
- a model-visible Python skill named `rlm-heartbeat` with import name
  `rlm_heartbeat`.

The production policy and fail-closed marker rules are Slice 2 work. Slice 1
uses a temporary sentinel and temporary extensions only.

## Characterized public seam

Prime Agent's public `before_agent_start` extension hook is the selected
carrier. The event exposes the fully assembled `systemPrompt` and the
`systemPromptOptions` that produced it. A handler can return a replacement
`systemPrompt` for that agent run.

The characterization established these properties:

1. Each new run presents the hook with a base prompt containing zero copies of
   the temporary sentinel.
2. A returned prompt remains active for the provider's tool continuation in
   the same agent run.
3. The next run starts from the base prompt, so the contribution does not
   accumulate.
4. `selectedTools` and loaded skill objects provide the required structured
   compatibility signals, including Python skill kind and import name.
5. Resource reload rebuilds those signals. Removing the heartbeat fixture's
   Python package metadata changed it to a Markdown skill and omitted the
   contribution; restoring the metadata and reloading restored the
   contribution.
6. A newly opened process resuming the saved session receives one fresh
   contribution.
7. A project-local `.prime/agent/APPEND_SYSTEM.md` is present in the assembled
   base prompt but does not suppress the later hook contribution.
8. The sentinel is absent from the complete saved session JSONL, including
   user, assistant, tool-result, and custom records.

These are carrier properties, not model-behavior or lifecycle dogfood.

## Reproducible native probe

The probe is `tests/test_goal_work_control_native.py`. It creates all provider,
extension, skill, project, and session fixtures under pytest's temporary root.
It invokes every Prime Agent process through
`scripts/run-prime-agent-probe.sh`, uses offline RPC mode and a deterministic
local provider, and does not use credentials or network access.

The fixture inputs are:

- temporary Python skills `goal` / `goal` and `rlm-heartbeat` /
  `rlm_heartbeat`;
- active tool selection containing `ipython`;
- project append marker `PROJECT_APPEND_SHADOW_FOR_GOAL_CARRIER_PROBE`;
- transient hook sentinel `PRIME_CLAW_GOAL_HEARTBEAT_CARRIER_PROBE_V1`; and
- prompts `FIRST_RUN`, `SECOND_RUN`,
  `MISSING_HEARTBEAT_AFTER_RELOAD`, `RESTORED_AFTER_RELOAD`, and
  `SAVED_SESSION_RESUME`.

The provider capture records the exact system prompt, latest prompt label,
provider-call kind, message-role sequence, append-marker count, and sentinel
count for every request. The hook capture records its exact input prompt, raw
and normalized selected tools, structured skill signals, and compatibility
decision. The test reads the exact session JSONL before pytest removes the
fixture.

Expected provider classifications are:

| Prompt | Provider call | Sentinel copies |
|---|---|---:|
| `FIRST_RUN` | primary | 1 |
| `FIRST_RUN` | tool continuation | 1 |
| `SECOND_RUN` | primary | 1 |
| `MISSING_HEARTBEAT_AFTER_RELOAD` | primary | 0 |
| `RESTORED_AFTER_RELOAD` | primary | 1 |
| `SAVED_SESSION_RESUME` | primary | 1 |

The primary and tool-continuation prompts for `FIRST_RUN` must be byte-for-byte
equal. Every hook input must contain zero sentinel copies. The complete saved
session file must contain zero sentinel copies.

Run the focused check only in an operator-controlled maintenance window with no
active Prime Agent process:

```sh
pytest -q tests/test_goal_work_control_native.py
```

The test checks `prime-agent status --json` first and skips rather than starting
a concurrent standalone instance. This machine-level guard is separate from
the probe wrapper's configuration and session isolation.

## Evidence status

The recorded characterization run on 2026-09-30 used:

- `prime-agent --version`: `0.9.7`;
- downstream build: `cwd-fix-v0.9.7-r1`;
- source commit: `c094b9eea32173d7c4dd0c0a444a332ebac8f5d8`;
- focused command: `pytest -q tests/test_goal_work_control_native.py -vv`;
- result: `1 passed in 10.83s`; and
- Bead: `prime-claw-h6w.24.1`.

The approved specification's operator incidents occurred on the 0.9.6
downstream generation. The current characterization is equivalent evidence for
the installed 0.9.7 successor; it does not retroactively claim that this exact
fixture ran on 0.9.6.

## Characterization limits

Slice 1 intentionally does not:

- change a production extension or installed plugin generation;
- remove the pause/resume tools or their migration artifacts;
- inject the canonical production marker or policy text;
- prove compaction, queued-follow-up, RLM-heartbeat, agent-message, or
  goal-continuation paths;
- call `goal` or `rlm-heartbeat` at runtime;
- prove lifecycle decisions, failure recovery, or model compliance; or
- apply the plugin or start another daemon.

The full installed prompt matrix belongs to Slice 3. Lifecycle success, race,
and failure behavior belongs to Slices 4 and 5. Manual model dogfood belongs to
Slice 6.
