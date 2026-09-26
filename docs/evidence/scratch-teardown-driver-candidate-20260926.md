# Scratch teardown smoke driver candidate — PRE-RUN BLOCK

This is the implementation candidate for the [bounded driver contract](scratch-teardown-driver-contract-20260926.md), not execution approval. The [retained-root wrapper](scratch-probe-expert-pass-c6a5ac4-20260926.md) passed its own separate exact-commit review; that PASS does **not** review this driver. No native Prime Agent CLI, scratch daemon, socket, session, or provider prompt was launched by this candidate work. The active Phase 3a EPISODE remains untouched at its blocked checkpoint.

## Exact bounded behavior proposed for review

- `scripts/validate-prime-agent-scratch-smoke.py` accepts only a canonical private retained `/tmp/pcp.*` root, its exact co-rooted `HOME`, `TMPDIR`, config and sessions, the wrapper's exact seven-key `env -i` allowlist, a system-only `PATH`, socket byte budgets, and a caller-supplied SHA-256 for one absolute executable CLI. Any mismatch blocks before starting or shutting down.
- The default invocation is preflight, not mutation. It requires a valid empty `daemon ps --json`, independent macOS `/usr/sbin/lsof` root/Unix scans and `/bin/ps` PID identities, and no socket, worker descriptor, supervisor registry record, symlink, or unexpected file. Ambiguity blocks both start and shutdown.
- The explicit `--run-smoke` path is **not authorized before fresh review**. If later admitted, it makes one bounded default-socket `daemon start` attempt in a new root project with no session or prompt; a competing start or foreign/unexpected active identity revokes shutdown authority. Otherwise it attempts at most one state-root-scoped top-level `shutdown --force --json`, even if the owned start result was uncertain. No retry, arbitrary PID signal, global root, or root deletion exists.
- A `stopped` classification requires valid start/active identity, valid shutdown JSON with no failures, two quiet independent postflight observations, and captured PID/start identities gone. Malformed/failing/timed-out shutdown remains unresolved even when scans look empty. The retained report records bounded socket/PID metadata and command-output hashes, not raw output or worker authentication tokens.
- Prime Agent v0.9.6 source at `e260085dd8f742e0def3d871860c9a888b114851` establishes the expected public command surface: `cli/daemon-command.ts:680-718` (`daemon start`), `cli/daemon-ps.ts:424-427` (`daemon ps --json` array), and `cli/daemon-ps.ts:533-680` (top-level shutdown result object). Source study is not installed-binary validation.

## Python-only evidence

- `python3 -m unittest discover -s tests -p test_prime_agent_scratch_smoke.py -v`: **17 passed**. Fake runner and injected CLI/lsof/ps outputs cover clean owned teardown, fail-closed preflight, environment/path guards, timeout/malformed starts, competing identities/workers, shutdown failures, postflight listeners/PIDs, descriptor redaction, and unexpected exceptions. Mocked `subprocess.run` verifies that one CLI and one exact isolated environment flow to each command. The fake CLI fixture is never executed.
- `python3 -m unittest discover -s tests -p test_prime_agent_probe_isolation.py -v`: **7 passed**. Wrapper tests invoke only Python fixtures, not the native binary.
- `python3 -m py_compile scripts/validate-prime-agent-scratch-smoke.py tests/test_prime_agent_scratch_smoke.py` and `git diff --check`: passed.

## Review gate and limits

A fresh read-only EXPERT must review the **exact pushed candidate commit** and return a complete actionable PASS/BLOCK before any native use, including read-only driver preflight. A PASS would permit consideration of only one bounded isolated no-prompt default-socket smoke, with the root retained and unresolved outcomes quarantined. It would not approve the separate faux-provider tool-root experiment, a live EPISODE action, handoff, Prime Agent core changes, merge, or Qwen work. If the driver cannot establish a unique empty baseline or safe teardown, stop and consult rather than weaken guards.

The [fresh exact-commit EXPERT review](scratch-smoke-expert-block-85fed9e-20260926.md) returned **BLOCK** on `85fed9e` with five actionable in-scope safety findings. The native preflight and `--run-smoke` remain blocked; this candidate report preserves the pre-review claim, not a later approval.
