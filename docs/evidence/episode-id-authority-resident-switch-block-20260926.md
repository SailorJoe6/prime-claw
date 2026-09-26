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

## Independent read-only runtime audit — BLOCK

A separate read-only worker (`sub-2cc303b1`, `openai-codex/gpt-6-sol`) reviewed the synthetic evidence and plugin/runtime sources at the 3f624f9 evidence checkpoint. This is an independent investigation, **not** a required final EXPERT review or authorization to change the live EPISODE. It returned **BLOCK**: no supported, proven non-destructive relocation of the exact live route or effective worktree execution root has been established.

- Invariant: exact owned route/ID/file/name, durable header/catalog cwd, worker `get_state.cwd`, and effective extension/tool/Python/bash root must agree with the approved worktree before canonical handoff. Plugin `spec-episode.ts:830–834` checks catalog cwd and `:850–855` checks live worker cwd; `:857–871` checks idle state. None measures effective kernel/tool cwd. The publisher's initial `create.config.cwd=worktree` (`:770–802`) is not a supported recovery operation for an existing route.
- Root-cause seam: installed 0.9.6 `docs/daemon.md:23–27` separates supervisor routing, catalog saved-session scans, and worker-owned runtime/scheduler/kernels; a switch replaces worker root runtime while preserving public active ID. Session-format header cwd is durable metadata. Header/catalog A versus `get_state` B is plausible, but the precise source of `list(all:true).cwd` for the active entry is **not proven**. `get_state.cwd=B` does not attest kernel cwd: `prime-agent-runtime/src/rlm/bash.py:312–325` launches bash with kernel `os.getcwd()`.
- Repair direction: keep both cwd guards until a safe replacement exists. Obtain an upstream supported transactional relocation/rebind API or upstream fix that defines a single authoritative cwd across worker, catalog/header, kernel/tool execution, hooks, children, schedules, and rollback. A prime-claw guard change would also need independent catalog/state and effective execution-root attestation, strict identity/idle checks, and fail-closed disagreement. Do not force catalog metadata, edit raw session state, blindly drop either guard, trust switch success alone, kill/recreate, or retry an unproven live switch.
- Acceptance: a truly resident named, nonempty isolated fixture with hooks and observable child/schedule state must preserve exact route/UUID/file/name. `list`, `get_state`, header/manager/ctx cwd, existing and fresh Python `os.getcwd()`, bash `pwd`, and relative file resolution must agree on B. Verify transcript/hooks, children/schedules or documented safe quiescence, queued/active work, isolation from A and other routes, reconnect/restart/crash behavior, and tested rollback. Risks include stale picker/collision state, silent A-root execution, transcript split, hook/kernel state loss, orphan child/schedule actions, and ambiguous replay.

No live EPISODE, plugin source, or global plugin copy was changed in this audit. The exact owned Slice 1 remains blocked.

Source scratch artifacts reviewed at this gate: `VERDICT.md` SHA-256 `fe2e6cc98c075807c7098a1df533388e746d1c6ca15f0893c34e8b1d3529ab43`; `evidence.json` SHA-256 `eca2f4d7e04635f2831d16eb95f64eaaa7bb0589cd0da03e740f8a744b59440e`. The report retains material facts without depending on temporary paths.
