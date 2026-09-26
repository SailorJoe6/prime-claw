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

## In-scope B1–B5 revision (unreviewed; PRE-RUN BLOCK remains)

The `85fed9e` EXPERT BLOCK is retained verbatim in the linked report. The
separate `fix/episode-id-authority` revision addresses those five findings; it
is **not** EPISODE work and does not authorize installed-CLI preflight or smoke.

- B1: retain partial daemon/owner facts when a later scan fails. Parse paired
  native `owner.json`/`scope.json`, require the expected PID, `ps:` process
  start, socket and agent scope (including the native 12-hex socket-hash
  descriptor directory), zero `sessionCount`, and no tracked workers
  before allowing one destructive shutdown. Incomplete scans revoke authority.
- B2: bounded explicit filesystem enumeration propagates traversal/stat/read
  errors; owner/worker JSON has bounded, redacted native-shape validation;
  lsof accepts named and legitimate unnamed file descriptors but rejects
  unknown/malformed records. Invalid scans cannot prove an empty namespace.
- B3: every observation runs an independent `/bin/ps` health check even when
  candidate discovery is empty; both postflight scans include every captured
  PID and its process-start identity, and a persistent/reused PID blocks stopped.
- B4: the executable must be a canonical physical path. Opened device/inode
  and SHA-256 are checked against the admitted CLI before each call; retained
  events record safe exact argv, helper cwd, executable path/hash, while
  `--cwd` explicitly names the scratch project. There is a **non-atomic
  check-to-exec gap** on macOS Python 3.9; this does not claim atomic binding.
- B5: command stdout/stderr are pumped with a live per-stream byte cap and
  bounded timeout; only the direct spawned CLI child handle is killed on
  timeout/overflow, never an arbitrary daemon PID. Invocation/result parsing,
  both postflight scans, and report evidence have independent fail-closed
  boundaries. The report is capped, exclusive, mode 0600, and fsynced; an
  evidence-write failure explicitly requires retained-root manual quarantine.

Fake-only acceptance runs mock all Popen/run/check_output calls by default;
only an explicit in-test Popen fake is permitted. During development an obsolete
`subprocess.run` mock missed the new Popen path once: the only process executed
was the test-owned `/tmp/prime-claw-fake-cli-*/prime-agent` script containing
`#!/bin/sh` and `exit 99`; the first test invocation exited 99 and stopped
before system lsof/ps cases. No installed Prime Agent CLI, daemon, provider,
network, credential store, or active EPISODE was invoked. The suite now includes
`test_unmocked_subprocess_guard_regression` and injection-only OS scans.

These are source/fake-test claims only. A fresh exact-pushed-commit independent
EXPERT gate is still required; the prior wrapper-only PASS is not driver PASS.

Revision fake acceptance evidence (before the next exact-commit review):
`python3 -B -m unittest discover -s tests -p test_prime_agent_scratch_smoke.py -v`
passes **37** tests; the wrapper suite command
`python3 -B -m unittest discover -s tests -p test_prime_agent_probe_isolation.py -v`
passes **7** Python-owned tests.
`python3 -m py_compile` of driver and driver test plus `git diff --check`
pass. The earlier 17-test candidate claims above refer to the blocked commit,
not this revision. The modified code/test/doc remain unreviewed until the exact
pushed SHA is supplied to the independent EXPERT.

Exact pushed `168343436b05f9c584eb701f9dfc57a573302c05` received [EXPERT BLOCK R1–R4](scratch-smoke-expert-block-1683434-20260926.md). **PRE-RUN BLOCK continues**; no installed-CLI preflight or `--run-smoke` is authorized on this candidate.

## R1–R4 repair candidate after exact-commit BLOCK (unreviewed; PRE-RUN BLOCK)

The immutable [EXPERT BLOCK on `1683434`](scratch-smoke-expert-block-1683434-20260926.md)
remains authoritative. This is a separate delegated `fix/episode-id-authority`
scratch-driver revision. It is not live Phase 3a EPISODE work. Neither the earlier
wrapper PASS nor this source/fake evidence authorizes even read-only installed-CLI
preflight. A fresh exact-pushed-commit EXPERT review is still required.

- **R1/R3:** explicit pinned-v0.9.6 socket-hash inventory recognizes and bounds
  `supervisor-config`, `command-journal.jsonl`, and the empty native
  `snapshot-cache/<generation>` tree separately from worker descriptors and
  worker journals. Supervisor config version, socket, agent/cwd/session scope,
  journal record shapes, generation/owner identity and unknown paths fail closed.
  Native worker v1/v2 descriptors now require lifecycle enum, durable
  `createCommand.type="create"`, version-specific nested fields, exact native
  worker socket/recovery/orphan paths, scoped optional paths, and stable PID/start.
  Malformed worker journals and orphan journal scope remain adverse. Worker
  metadata still vetoes active shutdown; valid stale records only support quiet
  postflight after absent process identities.
- **R2/R4:** both postflight observations are collected before fallible quiet
  and captured-PID reconciliation. Classification exceptions retain a bounded
  unresolved report rather than escaping. Direct CLI child containment starts
  immediately after `Popen`; selector setup/register/select/read and timeout/
  overflow errors only signal that exact child handle. All reap waits carry a
  finite timeout, with `child_unresolved` and `capture_failed` in redacted
  command evidence. An unreaped direct start CLI child revokes shutdown
  authority even if later discovery looks empty. Failed report serialization/fsync explicitly raises a
  retained-root quarantine error; a partially written, uncommitted report on
  fsync failure is **not** a returned `stopped` verdict.

Fake-only tests retain the fail-fast `Popen`/`run`/`check_output` guards before
any runner call. A Python-only native-shaped filesystem/start/stop fake proves
one shutdown and two quiet snapshots with retained supervisor state. Negative
injections cover wrong-scope/malformed metadata, unknown files, unsupported
worker versions/lifecycle/create fields, traversal/read failures after partial
owner facts, quiet/PID classification errors, selector lifecycle failures,
kill/refusal-to-reap, redaction and same-root replay. No installed Prime Agent
CLI, daemon, socket, provider, credential, network, native experiment, or live
EPISODE action was used. Remaining uncertainty: this remains a model of the
read-only pinned source, not a verified native run; review must establish exact
commit safety before any installed-binary command.

Revision checks: `python3 -B -m unittest discover -s tests -p test_prime_agent_scratch_smoke.py -q` **45 passed**;
`python3 -B -m unittest discover -s tests -p test_prime_agent_probe_isolation.py -q` **7 passed**;
`python3 -B -m py_compile` on driver/tests and `git diff --check` passed.
