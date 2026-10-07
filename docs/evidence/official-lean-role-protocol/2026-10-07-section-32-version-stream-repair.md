# Section 32 Generation A version-stream repair evidence

Date: 2026-10-07

## Preserved accepted history and pre-mutation blocker

Generation A replacement `ed42db9f20ce7a58689707b188e35028e31abf55` /
tree `7fb098436e13296191ab64ef593c49550c70c162` and its exact configured
`PASS` remain immutable accepted history. Gate A was explicitly authorized, but
owner read-only preflight stopped before shutdown or any other live mutation.

Supported Prime Agent 0.9.8 command
`/Users/jlanders/code/prime-agent/.worktrees/cwd-fix-v0.9.8-r1-source/prime-agent.sh --version`
returns 0 with empty stdout and exact stderr `0.9.8\n`. The accepted coordinator
compared only stripped stdout and returned `runtime entrypoint version mismatch`.
The exact private diagnostic remains at
`/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/gate-a-ed42db9/preflight-version-stream-block.json`,
SHA256 `c0388aa8ede3912106afc3500370494bd37bdbc56880cc9114c91e8ed161be73`.

## Narrow repair

Only `Coordinator.verify_executable` changes. The version command is now observed
with failure allowed so the seam can reject nonzero status explicitly. On return
code zero, exactly one stream must be nonempty. That stream must be the
exact configured version followed by one LF. Both streams,
no stream, CR/blank/multiple/extra lines, surrounding text or whitespace, and
mismatch fail closed. No general output normalization or Prime Agent change is
introduced. All digest, entrypoint, process, status, topology, readiness, and
mutation gates remain unchanged.

Recording-fake coverage includes exact stdout and stderr positives, nonzero,
both-populated, both-empty, extra-content, blank/multiline, and mismatch
negatives. A bounded host test calls only the supported wrapper's `--version`
interface through the coordinator and proves return code 0, empty stdout, and
exact stderr `0.9.8\n`; it does not call status, shutdown, landing, apply, start,
or any user-global operation.

Initial focused command:

```text
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/test_prime_agent_role_cutover.py -q
```

Initial result: **100 passed**.

## Successor proof and final gates

The immutable successor must encode the complete newest-to-oldest rollback chain
`[successor, ed42db9f20ce7a58689707b188e35028e31abf55,
f2f3fcd25dbe3d96f05193261020d26bf79f1213]`, followed by integration merge
`46147ff887569101b7e64a8466cde5887c15cc31` with mainline 2. A no-local isolated
clone must produce baseline `c24ba6c1e76585193d4f34f0b0b0233846780442` /
tree `a9955483816af04a4c68468a8e2ce3d0d0d00a5d`.

A new private successor bundle was rebuilt only from the preserved opaque
preimages, current inert source, candidate postimages, current recovery tools,
and Section 32 topology. The Section 31 bundle remains unchanged.

- source-topology SHA256: `a9b6cabeaa7c326371648a16e75879510b098ea86d2b14017b327950eab8fb9e`;
- bundle manifest SHA256: `ff9a321274b8953f0a1b97bddee9e2f4b7f156990f1370c762c93982ca35ad68`;
- isolated bundle-proof SHA256: `4725e44be01966e0127b0c2c298343e6a7feec3cff80f0a26c1a8ecd80d1ba5f`;
- inventory entries: **21**;
- private directories/files: **0700/0600**.

Preliminary broader focused results are:

- focused host: **160 passed, 54 skipped**, log SHA256
  `b4a74baea5465d7d47c5100719116dcb7aeaac40a2b3cd7826003c6abe51fc13`;
- Node: **165 passed**, log SHA256 `476fd5d0f7ccd8d0b258f64f35cc8a95b458242cc1a359664e975b6db88d8487`; and
- Docker-focused: **3 passed**, log SHA256
  `7c7fd090011b6cc6e11e9e571b09ff5b676bf5ae30118d615699cee36f45cc9a`.

Affected proof-only successor coordinator config and final exact-byte gate hashes
are recorded at freeze, after an exact successor commit exists. This repair pass
does not execute the invalidated ed42 configuration or perform Gate A shutdown,
landing, apply, restart, UAT, S5, compatibility removal, finalization, or cleanup.
