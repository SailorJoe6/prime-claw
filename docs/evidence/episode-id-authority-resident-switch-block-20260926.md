# Episode ID authority — corrected isolated resident switch (2026-09-26)

**Verdict: BLOCK.** One isolated same-file `switch_session` returned success and `get_state` changed cwd A→B without changing the route, session ID, file, or name. But `list(all:true)` still returned the same route at cwd A. The public surfaces disagree, and effective kernel/tool execution and preservation were not proven. Do not use this fixture to justify a live episode switch.

## Scope and guards

Prime Agent 0.9.6 ran in fresh, scratch-only interactive fixtures through `scripts/run-prime-agent-probe.sh` with isolated temporary config/session roots, offline/no extensions/no skills/no context/prompt templates, and no model prompt or credentials. Each attempt used one wrapper invocation; a fresh scratch-owned public socket was verified by realpath containment, owner descriptor/PID/argv, and a protocol-7 JSONL `daemon_hello` before creating B or sending a switch. The live Phase 3a EPISODE and plugin source were unchanged.

Five scratch attempts were bounded: one fixture typo stopped and cleaned; public hello discovery passed; a B-creation attempt stopped before switch when unsupported `get_children`/`list_schedules` commands could not prove the preflight; a `create(lifecycle:resident)` attempt stopped when the detached ready worker reported lifecycle `draft`; the fifth detached-worker fixture ran the single switch after supported read-only idle checks. Unsupported commands were not counted as successful proof.

## Decisive observation

- Preflight showed empty `get_messages` and `get_queue` results, no streaming/tool/bash/compaction or running RLM children, no unfinished actions, and no fresh scratch schedule artifacts. No hooks, children, or schedules were created for continuity testing.
- `create(lifecycle:resident)` produced a detached ready worker and a unique route but reported lifecycle `draft`; this discrepancy limits the fixture.
- Exactly one `switch_session` requested the **same A session file** with `cwdOverride=B`; the public response said success and `cancelled=false`.
- `get_state` kept the exact active route, session ID, file, and name while changing cwd A→B. The queue and message surfaces stayed empty; the transcript header stayed at A.
- `list(all:true)` still returned that exact active route at cwd A, and separately listed inert synthetic B at cwd B. Whether catalog/header projection explains this is not proven. This mismatch alone blocks a live-switch claim.
- Effective Python kernel/tool cwd after switch, hook/transcript continuity beyond the empty fixture, cron/children preservation, rollback, and recovery remain unproved.

## Cleanup and next gate

The owner independently checked all five scratch roots: their recorded scoped cleanup flags are true; no matching process appeared in a read-only process inventory, and no `*.sock` path remained. The worker verified that stale socket paths had no listener before unlinking only scratch-owned paths. No live process, socket, session, or route was targeted.

Resolve the `list`/`get_state` cwd authority seam, establish an exact supported execution-root proof, and test resident continuity/rollback before considering a live repair. This is a bug-blocker evidence record, not an approved EPISODE candidate or terminal action. Prior blocked socket-path fixture: `eb56970f6b765526d6c7a7b01f70c10f3df2d69e`.

Source scratch artifacts reviewed at this gate: `VERDICT.md` SHA-256 `fe2e6cc98c075807c7098a1df533388e746d1c6ca15f0893c34e8b1d3529ab43`; `evidence.json` SHA-256 `eca2f4d7e04635f2831d16eb95f64eaaa7bb0589cd0da03e740f8a744b59440e`. The report retains material facts without depending on temporary paths.
