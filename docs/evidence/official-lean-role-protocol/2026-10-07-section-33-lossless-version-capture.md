# Section 33 lossless version-capture repair evidence

Date: 2026-10-07

## Preserved blocker and final stop-loss authority

Immutable Section 32 successor `47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4` /
tree `a4667c0047a9ea6f3379790d024c3df44754f00c` remains published history. Its
fresh exact Astra/max review returned `BLOCK`. Preserve owner report SHA256
`039a66d0ad404d5592913d9476dfef77c6e309dbc16b5dd9a23e3593f6008262` and
reviewer real-`LocalRunner` matrix SHA256
`bf8d9d182c028b77608745237aa286cf416aaf704a35bbd26ea94a0a77a337de`.

The accepted root cause is Python universal-newline conversion: general
`LocalRunner.run(..., text=True)` converted raw CRLF and bare CR to LF before
`Coordinator.verify_executable`. Section 32 recording fakes returned decoded
strings and could not expose that production-adapter defect. The owner authorized
one final narrow repair only; no Gate A or live authority transported with it.

## Version-only lossless adapter

`LocalRunner.run_version` is the sole new production seam. It captures stdout and
stderr as bytes and retains the ten-second timeout. General `LocalRunner.run`
keeps its prior text contract for Git, status, process, and bundle commands.

The verifier admits only return code zero, exactly one populated raw stream equal
to `runtime.version.encode("utf-8") + b"\n"`, and the other stream equal to
`b""`. It rejects nonzero status, both or neither stream, no LF, CRLF, bare CR,
whitespace, extra/blank/multiple lines, mismatch, non-UTF-8 bytes, timeout, and
all other non-exact byte sequences. It does not strip, split lines, remove CR,
concatenate streams, use regex/substring matching, or add a shared normalizer.
Prime Agent source is unchanged.

Production-adapter tests use bounded temporary subprocess emitters. Exact LF on
stdout and stderr passes on first observation and replay. CRLF and bare CR on
both streams retain their raw bytes and fail on first observation and replay.
The matrix also covers ambiguity, empty output, no LF, whitespace, extra and
blank lines, mismatch, non-UTF-8 bytes, nonzero status, downstream-command
absence, bounded timeout, and child reaping. The supported Prime Agent 0.9.8
wrapper is invoked only with `--version`; its raw contract remains return code 0,
empty stdout, and stderr hex `302e392e380a` (`b"0.9.8\n"`).

Focused command:

```text
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/test_prime_agent_role_cutover.py -q
```

Result after accepted audit tightening: **120 passed**. Log SHA256:
`42e94e5c1bef9944808d63a379940c889954cf08284b60adac72a27f27afc371`.
Two independent read-only recovery audits found no code blocker. The evidence
audit required malformed-output replay and an explicit timeout duration/attempt
bound; both are incorporated in the passing result.

## Private recovery and raw-byte proof

All opaque preimages were reconstructed only from the preserved Section 32
private bundle. No user-global state was read. The new sibling bundle uses the
current inert source, preserved candidate postimages, Section 33 topology, and
exact recovery tools.

- source-topology SHA256: `35a2307c7edad520c6c9fb0b47d37eaaf4bd78e0cfe34b9f8bae92fd8bf1c487`;
- bundle manifest SHA256: `f48241bbc2e9019bfc8606d63d526e2fdf72b17cd538d93bede6d54ee4556f93`;
- isolated bundle proof SHA256: `afd6eb29f86093a7efb8e50d7872a3f6639a8affd8ca4ce3229f34e7c51f7232`;
- raw real-adapter proof SHA256: `37fd6704ac622c7b7dfa1e8b516ac6380709023a42695934fe16430a2e18c3c2`;
- installed inventory entries: **21**.

The raw proof records hex, byte length, and SHA256 for LF, CRLF, and bare-CR
stdout/stderr on first observation and replay. It also records one bounded
0.2-second timeout attempt, elapsed duration under three seconds, child reaping,
and the supported wrapper's exact raw stderr bytes.

## Rollback and terminal boundary

The final successor must prove newest-to-oldest linear reverts `[successor,
47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4,
ed42db9f20ce7a58689707b188e35028e31abf55,
f2f3fcd25dbe3d96f05193261020d26bf79f1213]`, then integration merge
`46147ff887569101b7e64a8466cde5887c15cc31` with mainline 2. A no-local clone
must produce baseline `c24ba6c1e76585193d4f34f0b0b0233846780442` / tree
`a9955483816af04a4c68468a8e2ce3d0d0d00a5d`.

This repair performs no old-config execution, Gate A mutation, shutdown,
landing, apply, restart, primary-main or user-global change, UAT, S5,
compatibility removal, finalization, bookkeeping close, or physical cleanup.
The immutable successor stops for the one allowed final fresh exact owner review.

## Preliminary broader gates and Docker recovery

- focused host: **180 passed, 54 skipped**, log SHA256
  `b797653a684099b6ea2f553e9be644457fbddb299419de13bd6e8582742c339f`;
- Node: **165 passed**, log SHA256
  `601e4b055859112921aef6ea2e7e624ba67188f1f8705ce7bd25e0849c04bbf4`;
- Docker-focused: **3 passed**, log SHA256
  `0db6430140b7cf910aee40bb3407e2255c6f48bb5083ccd676a39f260af6e893`.

The initial Docker attempt failed before container creation because the daemon
was unresponsive. The owner Conversation hard-restarted Docker Desktop; an
independent health check returned `29.6.2`. The recovered worktree had no `.env`,
so the passing retry used an isolated mode-0600 `TIER1_ENV_FILE` containing only
`PRIME_AGENT_PINNED=0.9.8`. It contained no credentials and changed no tracked
configuration.
