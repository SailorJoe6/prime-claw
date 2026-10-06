# Slice 6 lifecycle fail-closed guardrails — 2026-10-06

## Scope and safety result

Slice 6 adds only an inert lifecycle control boundary. It created no live
OpenShell adapter or observer body, loaded no credentials, and did not refresh
the user-global plugin. During acceptance, a pre-existing tier-0 orchestration
test gap was found: orchestration tests omitted the newer `brain-query` stage and one failure-path
test omitted the GitHub-provider stage. The first plain run likely invoked
those stages against the configured OpenShell state; the exact run later
exposed the brain-query call when the sandbox reported `Error`. No Slice-6 lifecycle adapter made the call. The tests now stub the
stage, and an explicit OpenShell sentinel proves the host suite makes zero
OpenShell calls. The existing sandbox was not inspected or changed further. `scripts/test-all.sh --with-lifecycle` and `--with-sandbox` remain
exit-64 non-mutating errors.

The implementation surface is:

- `tests/lifecycle/support.py`: generated run/workspace/resource identities,
  exact inspection and ownership capture, normalized mode-0600 JSONL evidence,
  and exact revalidated teardown;
- `tests/lifecycle/minimal-policy.json`: inert deny-network, no-provider,
  no-credential policy identity;
- `tests/conftest.py`: `--run-lifecycle`, exact marker/fixture pairing, and
  skip-before-fixture behavior;
- `tests/lifecycle/control_body.py`: recording fake only, direct-host guarded
  and non-default-collectable; and
- `tests/test_lifecycle_guards.py`: tier-0 collection and architecture guards;
  and
- `tests/test_runtime_converge.py`: complete recording-fake stage stubs so
  tier-0 create/converge ordering and failure paths cannot fall through to live
  OpenShell.

## Source-candidate evidence

Focused host guard:

```text
python3 -m pytest -q -p no:cacheprovider \
  tests/test_lifecycle_guards.py \
  tests/test_tier1_fixture.py::TestCollectionPolicy \
  tests/test_container_helpers_static.py \
  tests/test_test_all.py::test_lifecycle_enabling_flags_are_non_mutating_usage_errors
26 passed, 7 subtests passed
```

After correcting one isolated package-import defect, the Docker-only recording
fake bridge passed:

```text
TIER1_ENV_FILE=<temporary pinned 0.9.8 selector> \
  python3 -m pytest -q -p no:cacheprovider -m container \
  tests/test_unit_env_bridges.py::test_lifecycle_recording_fake_unit_env
1 passed in 24.42s
```

- Final-source outer log: `.test-results/slice6-final-source-tier1-recording-fake.log`
- Outer log SHA-256: `809df73c4f38694bbd7d7c3af6f022f2c30a7b46d15712015b70c0f37547de99`
- Final-source tier-1 manifest: `.test-results/20261006T140754Z-50715-58f8320c/tier1/manifest.json`
- Manifest SHA-256: `37648df29588096e64ef1e0ddb78e4baaac837811fe7230e45859834c1285415`
- Manifest result: passed; network verified absent; teardown clean and exact
  container state verified absent.

The first Docker invocation failed before fixture setup because no install
selector existed. The next isolated run exposed the package-import defect. A
later unchanged retry coincided with Docker Desktop stopping during pinned
installation; after restart, the exact captured container was verified by ID,
run-specific name, and run-specific mounts, removed once, and verified absent.
The final unchanged retry passed. None of these runs had a lifecycle adapter or
made a lifecycle control-plane call.

## Proven refusal matrix

The recording fake proves zero mutating calls for default/forbidden identity,
preflight collision, unknown inspection, malformed response, incompatible CLI/
server capability, daemon failure, missing opt-in, and ownership label/policy
mismatch. It also proves:

- generated non-default workspace plus unique target, sentinel, and image;
- every adapter request carries the explicit gateway and workspace;
- sandbox creation disables automatic providers;
- creation is ordered and requires successful read-only preflight;
- teardown order is target, sentinel, workspace, image;
- unowned or mismatched resources cannot authorize delete;
- unknown/refused cleanup is one exact attempt with no retry and retained
  evidence; and
- no default/operator identity, broad selector, `--all`, or prune operation is
  allowed; and
- the `macos_host` observer registry remains empty and always skipped, even with
  lifecycle opt-in.

## Exact-commit acceptance

The first exact-commit tier-0 run exposed the missing `brain-query` stubs and
stopped before tier 1. The amended candidate must pass the sequential gate with
both Docker and OpenShell host sentinels, then one bounded final review.
