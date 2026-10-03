# Project-wide testing Slice 1 — pinned provenance and source fail-close

**Bead:** `prime-claw-5v7.2`  
**Branch:** `episode/project-wide-testing-strategy`  
**Promoted bundle:** `b71405c`  
**Delivery commit:** this slice commit; exact SHA is recorded in the Bead receipt after push

## Delivered boundary

Slice 1 gives tier 1 a run-owned evidence tree, immutable image execution,
offline test execution, verified captured-ID teardown, and immediate
source-mode fail-close. It does not implement the source builder, integration
brain stack, lifecycle observer, or later taxonomy moves.

- `scripts/testing/provenance.py` supplies schema-v1 validation, canonical JSON,
  SHA-256 helpers, repository content identity, concurrent run allocation,
  evidence inventory verification, redaction checks, and atomic manifest
  publication.
- `scripts/test-tier1.sh` and `tests/conftest.py` stage and hash an exact
  tracked/nonignored repository snapshot, mount only that snapshot read-only,
  build from an empty run-owned context with `--iidfile`, launch the captured ID
  with `--cidfile`, install the
  pinned release online, disconnect and re-inspect the exact container, and
  run installed artifact identity/apply/check/probe/tests only after the network set is
  empty.
- Teardown targets only the captured container ID. Present or unknown fails;
  run evidence remains available.
- `PRIME_AGENT_SOURCE` fails before checkout or Docker access with guidance to
  `prime-claw-5v7.1`.

## Red-before-green evidence

1. `tests/test_testing_provenance.py` initially failed collection with
   `ModuleNotFoundError: No module named 'scripts.testing'`. The implemented
   module made the focused provenance suite green.
2. The first real smoke run correctly stopped before its offline command, but
   exposed a Docker CLI detail: an empty Go-template range still emits a
   newline. Verification now requires the exact JSON network object `{}`.
3. The first pinned probe rejected an incorrect npm-global identity assumption.
   Prime Agent 0.9.8 is the vendor's compiled install, so the shipped manifest
   now records `prime-agent --version` plus the SHA-256 of the actual resolved
   executable, captured only after network removal.

No source-mode red proof invoked or inspected a real source checkout. Recording
fakes and an owned sentinel directory proved zero Docker/npm/node/check-out
activity and no path disclosure.

## Independent review repairs

The final adversarial review initially blocked delivery. This slice now also:

- validates exact 64-hex cidfile identities before any destructive command and
  recovers a valid partial cidfile after failed or timed-out launch;
- validates selectors and all deadline controls before Docker contact, passes
  the pinned version through an environment mapping, and bounds every host
  Docker wait with process-group TERM→KILL escalation;
- emits failed partial manifests with the known requested selector while
  leaving only unavailable installed/image/network identities null;
- mounts the exact sanitized tracked/nonignored snapshot whose identity is
  recorded, and keeps raw tool output out of durable evidence;
- records the real vendor-binary version and executable hash instead of an
  invented package identity;
- prints success only after verified teardown and atomic manifest publication;
  and
- retains valid collection, teardown, probe-validator, Docker readiness, and
  informational-path regression coverage while removing only the obsolete
  host-mutating source-build tests.

## Real run evidence

Successful post-review smoke manifest:

- run: `20261003T004928Z-32674-899f2646`
- image: `sha256:65245f00920ee6d38b1d9a156c45854ae2d199025efe6af33f7efa1279b634de`
- network: verified absent
- teardown: absent

Successful post-review pinned probe manifest:

- run: `20261003T004945Z-33560-45f237ef`
- requested/installed: `0.9.8` / `0.9.8`
- executable SHA-256: `e9ec0f8bff00369bac4a92de3acb4683e3bdc58615ee812e998f935992aa69f6`
- image: `sha256:cff376edca249e26eebd08cbd4069080645c3e8bb5e8adde9d2b0e28c18572be`
- network: verified absent before identity/apply/check/probe
- teardown: absent

Successful post-review pytest fixture manifest:

- run: `20261003T005014Z-34995-09ae6beb`
- image: `sha256:7b7ce38acda0426a256993f96815e526487e92ca09447eb0ed4443626a349716`
- network: verified absent before all 40 selected container tests
- teardown: absent

The final `scripts/test-all.sh` tier-1 fixture also passed with run
`20261003T005419Z-49224-ac0aeb5f` and verified absent teardown.

Raw manifests and logs remain gitignored under each
`.test-results/<run-id>/tier1/` tree. This note records only sanitized
identities and verdicts.

## Validation

All results below are post-remediation:

- focused Slice-1 suite — **105 passed, 18 subtests passed** in 131.45s;
- full tier 0 (`python3 -m pytest tests/ -q`) — **285 passed, 147 skipped,
  18 subtests passed** in 155.93s;
- standalone smoke — PASS with manifest verification and absent teardown;
- standalone pinned offline RPC probe — PASS with manifest verification and
  absent teardown;
- live container suite — **40 passed, 392 deselected** in 84.86s;
- `scripts/test-all.sh` — tier 0 PASS in 149s, tier 1 PASS in 82s, overall OK;
- inventory/plan checks — **22 passed, 9 skipped**;
- `bash -n`, Python compilation, and `git diff --check` — PASS; and
- independent adversarial implementation review — **PASS**.

## Rollback and remaining work

Rollback may remove additive provenance or launcher mechanics only while source
mode remains fail-closed. Never restore the prior host build/cleanup/pack path.
Slice 2 (`prime-claw-5v7.1`) must add the read-only source snapshot and
disposable builder before source selection can execute again.
