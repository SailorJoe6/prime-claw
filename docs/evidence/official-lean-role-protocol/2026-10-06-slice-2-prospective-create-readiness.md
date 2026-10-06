# Slice 2 prospective creation readiness evidence — 2026-10-06

## Candidate boundary

Accepted parent: `d31ab61e89247a024948d66e2613d434c89688fd` / tree
`f7ecd504d3f890455b858d53c6099c936fb0bf85`.

This candidate adds only prospective future-location Conversation-guide
activation and a pre-mutation `create_spec_episode` readiness gate. It reuses the
existing private `/implement-spec` approval map. Every successful preparation
admission receives one private UUID bound to the exact owner session and selected
future location. The existing activation receipt binds that preparation UUID,
location, role-kernel SHA, guide path/version/SHA, tool-call ID, and exact result.
Only version and guide SHA remain in tool details; the location, preparation UUID,
and receipt fingerprint are never provider-visible metadata.

The `create_spec_episode` tool verifies a consumed prospective receipt against
the current approval before deleting approval state, calling the episode creator,
or appending oversight. Missing or early preparation, wrong location, changed
preparation UUID, session boundary, ordinary no-context, EPISODE, generic child,
and active-owner subjects fail before the creation dependency is called. A valid
call consumes the one approval; replay cannot reach creation. Existing
active-owner handoff/finalization readiness and already-inactive finalize replay
remain unchanged.

No generalized token framework, durable receipt store, journal, race matrix,
duplicate policy, or cutover coordinator was added. The managed guide remains
byte-identical at SHA256 `23ada4c2dff653dda3f6291c293f09dcc9c83d409f75404a665186e1dacfb563`. The canonical `execute` skill
remains byte-identical at SHA256 `7c720c8c949775b3b705a0f879ad9c754792839967ca4df702825b780bb17e6d`. EXPERT admission,
remaining broad provider-route coverage, Slice 3, landing, user-global mutation,
restart, UAT, finalization, and cleanup remain deferred.

## Focused proof

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> python3 -m pytest \
  tests/test_reviewed_plan_extension.py \
  tests/test_project_conversation_extension.py \
  tests/test_conversation_oversight_native.py \
  -q -m container -p no:cacheprovider
```

Result: **17 passed, 17 deselected** in 72.90s.

- Log: `.test-results/20261006-073440-27144/focused-prospective-create.log`
- SHA256: `0b228a02160104651f4500bf92fe85406c97835cb1db576987b4566efecbef83`

The installed-runtime fixtures that exercise real episode creation were updated
to activate the same guide before creation:

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> python3 -m pytest -q -m container \
  -p no:cacheprovider \
  tests/test_reviewed_plan_native_discovery.py::test_installed_discovery_real_implement_spec_activation_resume_and_absence \
  tests/test_reviewed_plan_native_discovery.py::test_installed_inactive_generation_allows_later_cycle_and_is_inert
```

Result: **2 passed** in 32.25s.

- Log: `.test-results/20261006-073440-27144/focused-native-prospective-create.log`
- SHA256: `e1d74ca07a7120d41404064040fd0c8b83906b2bcdaadf2dad032ffa7addfd2b`

The first complete runs exposed only stale contract fixtures: two static
assertions still described deferred activation/old registration, and two native
providers called creation directly. Each production gate correctly stopped
before daemon mutation. The fixtures were updated to the approved activation
order; no acceptance assertion was weakened.

## Complete validation

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> scripts/test-all.sh
```

Result: **PASS**.

- Tier 0: **287 passed, 172 skipped** in 44.86s.
- Docker Tier 1: **65 passed, 394 deselected** in 191.27s.
- Logs: `.test-results/20261006-073440-27144/`
- `tier0.log` SHA256: `7171d684cc52637ea785eeaf6ff232b52626eeb352a8d3645f550fe276057c03`
- `tier1.log` SHA256: `cebb7c76ef149840f0e92516a40b8a6f478370d0f491475220c54fa0d1b94d3e`

## Pinned installed-runtime proof

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> scripts/test-tier1.sh --probe
```

Result: **PASS** against downloaded and checksum-verified Prime Agent **0.9.8**.
Apply/check accepted the isolated plugin copy, the native RPC probe observed
`handoff`, `plan`, and `implement-spec` exactly once from the container-local
extension root, and the ephemeral container was removed.

- Log: `.test-results/20261006-073440-27144/pinned-0.9.8-probe.log`
- SHA256: `45bb71702b087491ed42b9c8464fa62a8c1f67e5835fa877537f132b71406616`

## Exact-candidate review record

To keep reviewed tracked bytes immutable, the independent reviewer verdict,
reviewer identity/model, frozen patch SHA256, and raw report SHA256 are recorded
in `prime-claw-h6w.30`. The raw report remains under the gitignored test-results
run directory. No tracked mutation is permitted after the frozen review except
an explicitly accepted repair followed by a new exact-candidate review.
