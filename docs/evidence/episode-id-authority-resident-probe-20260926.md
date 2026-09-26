# Episode ID authority — isolated resident probe (2026-09-26)

**Verdict: BLOCK.** One operator-approved isolated interactive-root test stopped before the B fixture or any `switch_session` call. This is a harness socket-path mismatch, not evidence for or against a resident same-file switch.

## Scope and setup

- Target: Prime Agent 0.9.6 synthetic interactive root only, under one `scripts/run-prime-agent-probe.sh` invocation with temporary config and session roots.
- Offline flags disabled extensions, skills, context files, and prompt templates. No model prompt or credential access occurred.
- The live Phase 3a EPISODE, plugin source, and raw episode identity were not changed.
- Gate: verify a scratch-owned public JSONL `daemon_hello` before creating synthetic session B or attempting one same-file switch.

## Observation

- The harness watched its nominated `public.sock` for 29 seconds. The isolated Prime Agent process instead created `prime-agent-503/daemon.sock` under the same scratch TMPDIR.
- No public JSONL hello was verified. The recorded postflight fields are `public_hello_received=false`, `B_created=false`, and `switch_attempted=false`.
- A scratch-only owner descriptor linked the synthetic supervisor process to the unexpected socket. The worker sent SIGTERM to that disposable process. Read-only postflight checks found **0** scratch-owned processes and **no** remaining scratch socket.

## Interpretation and next gate

This test establishes only a path-selection error in the probe. It does not establish resident ID/file/route preservation, cwd/tool-root correction, transcript or hook continuity, scheduler/child behavior, or rollback safety. `prime-claw-4qz` and Phase 3a Slice 1 remain blocked. A second corrected run needs separate operator approval. If approved, discover the public socket within the scratch root by validated owner descriptor and process identity, verify the JSONL hello before B creation, then apply the same strict single-switch and cleanup gates. A passing fixture would still not authorize a live switch.

## Source evidence

The original scratch artifacts were reviewed at the owner checkpoint, but are not portable. SHA-256: `VERDICT.md` `043f0fe8863041577e1fc9762e0dc58c4ac3cd94f96603409f146c9e0e87fbe6`; `evidence.json` `fa65792ae1e7019c71c76d0c03bcb199bcecc7823b60d215c84202f86b918729`. This report retains their material findings without copying ephemeral absolute paths.
