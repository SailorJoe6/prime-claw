# Slice 3 official EXPERT reservation foundation — 2026-10-07

## Scope

This candidate follows accepted prerequisite commit
`e319e39949e1eb1c6b6b680d996ffb15ea664264` / tree
`03a88ac106d7fed83f48f0e157366e7d13258c7f` and implements only active plan
Section 23. It adds one owner-scoped, single-review, in-memory reservation and
four native mechanics:

- `prime_claw_reserve_expert_review`;
- `prime_claw_bind_expert_review`;
- `prime_claw_expert_review_status`; and
- `prime_claw_cancel_expert_review`.

No live reviewer spawn, `agent_message` delivery, child provider-role admission,
review execution, report settlement, cleanup workflow, durable store, journal,
cross-process recovery, generalized token framework, retry protocol, or
provider-visible EXPERT authority was added.

## Trusted gates and record

Reserve and bind first require:

1. `assertExactActiveConversationOwner(ctx)`, including rejection of an exact
   EPISODE bounded identity;
2. a consumed exact managed Conversation-guide receipt;
3. a fresh deterministic official-package result of `AVAILABLE`; and
4. exact subject validation before the first `Map.set`.

The native TypeScript package probe hashes the same two managed source assets,
uses the same exact configured/managed interpreter semantics as
`scripts/check-prime-agent-expert-runtime.py`, hashes installed package bytes
before import, validates `describe()`, and reports `AVAILABLE`, `SYNC_PENDING`,
or deterministic `UNAVAILABLE`. Docker runs both implementations side by side
for managed source-only, missing interpreter, configured package absent,
installed exact, stale installed bytes, mismatched reviewer bytes, and invalid
source cases. `SYNC_PENDING` and `UNAVAILABLE` stop reserve/bind before
reservation mutation.

One closure-local `Map` holds at most one record per owner session. Every record
also stores a digest of all stable active `OversightMarker` fields, so a later
episode owned by the same Conversation cannot read, bind, or cancel an older
generation. A fully re-gated reserve may replace stale-generation or expired
state. The record contains:

- a cryptographically random 32-byte base64url nonce;
- fixed 15-minute creation/expiry timestamps;
- canonical exact repository root and current 40- or 64-hex commit OID;
- immutable packet SHA256;
- exact `openai-codex/gpt-6-astra` selector and `max` thinking request;
- exact package SHA256; and
- after one bind only, the public spawn return tuple `rlm_child_id`, `name`,
  `session_dir`, and `model`.

Bind rechecks the exact owner generation, consumed guide, `AVAILABLE` package,
unchanged package hash, nonce, expiry, and returned model text. Its phase is
`bound-pending`; its evidence is `caller-supplied-unverified`; and
`authority` remains `false`. The tuple does not prove model selection, reasoning,
handle, session directory, child identity, or EXPERT admission.

Status derives a generation-matched view only and never mutates. Expiry is a
read-only derived phase. Cancel deletes only the current generation and is
idempotent. Session start and shutdown deletion are idempotent. Generic children
and EPISODE sessions remain ordinary/non-EXPERT.

## Independent review

The first review returned `BLOCK`: session-only scoping could expose episode A's
record after the same owner moved to episode B. The repair added the full stable
oversight-generation digest and an A-to-B regression proving that B cannot read,
bind, or cancel A and can create a newly gated reservation. Re-review returned
`PASS` with no remaining actionable correctness, security, lifecycle, API,
authority-leakage, test-gap, or scope finding.

- Report: `.test-results/20261007-024947-slice3-reservation-foundation/independent-review.md`
- SHA256: `7059961f1d40315c7b2803df6a9889350e6ada34897fceecf2da13bb10ac4bd2`

## Focused validation

```text
node --test tests/reviewed_plan_extension.test.mjs
python3 -m pytest -q -p no:cacheprovider \
  tests/test_official_expert_review_skill.py \
  tests/test_prime_agent_plugin_install.py \
  tests/test_reviewed_plan_extension.py
```

Result: **45 Node tests passed**; **17 Python tests passed, 48 skipped**.

- Log: `.test-results/20261007-024947-slice3-reservation-foundation/focused-host.log`
- SHA256: `74b2e0335034797026f8a5cabe31991c96f421d70b5936f1ad96cf44437ff6d4`

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> python3 -m pytest -q -m container \
  -p no:cacheprovider \
  tests/test_official_expert_review_runtime.py \
  tests/test_reviewed_plan_extension.py::test_reviewed_plan_node_suite \
  tests/test_reviewed_plan_extension.py::test_prime_agent_rpc_loads_native_commands_and_structured_tool \
  tests/test_prime_agent_plugin_install.py
```

Result: **43 passed, 1 deselected**.

- Log: `.test-results/20261007-024947-slice3-reservation-foundation/focused-docker-repair.log`
- SHA256: `d89ec0834bdda5bc3aa0cca7b968da6be7e927af8747aef3a1838f5edd50e538`

## Complete validation

```text
python3 -m pytest tests/ -q
```

Result: **292 passed, 183 skipped**.

- Log: `.test-results/20261007-024947-slice3-reservation-foundation/full-tier0.log`
- SHA256: `acbbdec41c90fc0ccc268679b6e7f057b89763e588f5504c9be0515dcff8eaac`

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> python3 -m pytest -q -m container \
  -p no:cacheprovider tests
```

Result: **76 passed, 399 deselected**.

- Log: `.test-results/20261007-024947-slice3-reservation-foundation/full-tier1.log`
- SHA256: `286754f4454028df2d393c6a26ab2c9e1f3f3d18f63461980b8b1e45262ee340`

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> scripts/test-tier1.sh --probe
```

Result: **PASS** against downloaded/checksum-verified Prime Agent **0.9.8**.
The installer/check reported exact managed package SHA256
`a282b48718145d3aa396abc146bdca6a3f75b748c27023bbf874609386c09828`
with expected `SYNC_PENDING`; native RPC found `handoff`, `plan`, and
`implement-spec` exactly once; the ephemeral container was destroyed.

- Log: `.test-results/20261007-024947-slice3-reservation-foundation/pinned-0.9.8-probe.log`
- SHA256: `1c37ec70d39e94c658f8c9ed9e29acfd7d739ef5b48661593b89411ed23926e1`

The standalone reviewer profile remains `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`, the managed
Conversation guide remains `23ada4c2dff653dda3f6291c293f09dcc9c83d409f75404a665186e1dacfb563`, canonical `execute` remains
`7c720c8c949775b3b705a0f879ad9c754792839967ca4df702825b780bb17e6d`, and the inert package `__init__.py` remains
`89d6914b6ddfe489efc667be0ffe8a778a22b5cd5790380238b7cd955fab1826`. `git diff --check`, shell syntax, and Python syntax checks
passed.

## Disposition

The Section 23 reservation foundation is complete at this candidate. Live spawn,
trusted child-side admission/verification, message delivery, review execution,
report settlement, cleanup, Slice 4, landing, user-global mutation/restart, UAT,
finalization, and cleanup remain deferred.
