# Slice 3 official EXPERT prerequisite — 2026-10-06

## Boundary and accepted base

Accepted base: `e8b047c1493e6718c2f3062f19c77bc0b23ce8e9` / tree
`881b455a121b4cd53dd01005c5f84e31c7c9d555`.

This candidate adds only the first Slice 3 prerequisite from active plan Section
22. It does not add reviewer discovery, spawn, reservation, nonce/expiry state,
handle binding, child admission, message delivery, report settlement, cleanup
tools, provider identity, or any EXPERT authority.

## Managed package and exact parity

`src/prime-agent-plugin/skills/prime-claw-official-expert-review/` is a standard
Prime Agent Python-backed skill with exactly four files:

- `SKILL.md`;
- `pyproject.toml` with zero runtime dependencies;
- `src/prime_claw_official_expert_review/__init__.py`; and
- `src/prime_claw_official_expert_review/reviewer.md`.

The managed reviewer definition is byte-identical to the retained standalone
`.prime/agent/profiles/expert-reviewer.md`. Both have SHA256 `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`.
The package strictly validates the closed three-field configuration
`expert-reviewer` / `openai-codex/gpt-6-astra` / `max`, the exact complete
reviewer bytes, and a non-empty rubric before returning a definition-only
record with `authority: false`.

Runtime package asset hashes:

- `__init__.py`: `89d6914b6ddfe489efc667be0ffe8a778a22b5cd5790380238b7cd955fab1826`;
- `reviewer.md`: `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`;
- canonical package manifest SHA256: `a282b48718145d3aa396abc146bdca6a3f75b748c27023bbf874609386c09828`.

The package imports only stdlib `hashlib`, `json`, `pathlib`, and `typing`. It has
no Prime Agent runtime dependency, `agent_message`, host request, or side-effect
entry point. The repository root `pyproject.toml` is unchanged.

## Exact-interpreter preflight

`scripts/check-prime-agent-expert-runtime.py` is read-only. It removes
`PYTHONPATH`, disables user-site and bytecode writes, and runs one bounded probe
with the exact selected interpreter.

- Default managed mode follows `PRIME_AGENT_KERNEL_VENV`, then Prime Agent's
  primary/fallback kernel-venv locations. An exact installed package is
  `AVAILABLE`. Otherwise the same interpreter imports the candidate normally
  from the skill's `src` working directory; exact source returns
  `SYNC_PENDING`. No venv or package is created or changed.
- Configured mode follows the lexical absolute `PRIME_AGENT_KERNEL_PYTHON` path
  without dereferencing a virtualenv executable symlink. It finds and hashes
  the normally installed package before import, then imports only exact bytes
  and validates `describe()`. Missing interpreter/package, stale code, stale
  definition, mismatch, invalid output, failure, or timeout returns one
  deterministic `UNAVAILABLE` JSON result and nonzero status.

The container matrix proves managed `SYNC_PENDING`, configured absent/missing,
exact `AVAILABLE`, stale module, mismatched reviewer, invalid source, and no
import of a sentinel `rlm` module. Source bytes remain unchanged.

## Installer/check ownership

Apply/check now own both managed skill directories. The EXPERT inventory covers
its root, `src`, package directory, and four exact regular leaves. Apply performs
source and exact-interpreter preflight before destination mutation; rejects
symlinked/non-directory parents, unsafe leaves, or unexpected entries; copies
mode-0644 bytes; and invokes the complete final check. Check compares all four
files byte-for-byte and repeats read-only interpreter preflight. This extends the
existing practical sequential generation check and known-state refusal without
adding a journal, rollback engine, or new receipt schema.

Container install tests prove complete copy/check, convergence, source
independence from the compatibility skill, stale package rejection, unexpected
entries at all three EXPERT directory levels, managed-directory symlink refusal,
and configured-interpreter `UNAVAILABLE` before any destination mutation.

## Focused validation

```text
python3 -m pytest -q -m "not container" -p no:cacheprovider \
  tests/test_official_expert_review_skill.py \
  tests/test_prime_agent_plugin_install.py::test_source_is_outside_project_extension_discovery
```

Result: **5 passed**.

- Log: `.test-results/20261006-093834-slice3-expert-prerequisite/focused-static.log`
- SHA256: `0e96d7ca7406320840ee2e704cbada03e2fe4b6d6aea1d667b4f685b07e7e24d`

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> python3 -m pytest -q -m container \
  -p no:cacheprovider tests/test_official_expert_review_runtime.py \
  tests/test_prime_agent_plugin_install.py
```

Result: **41 passed, 1 deselected**.

- Log: `.test-results/20261006-093834-slice3-expert-prerequisite/focused-docker.log`
- SHA256: `ee7051ddbea02d17e5ea0e38311e6b639c8702d8c6f4d3ec28da29593f06837d`

Complete Tier 0, Docker Tier 1, and pinned-runtime evidence is appended only
after those gates pass. This candidate remains inert; later EXPERT admission and
reservation mechanics are not implied by package availability.


## Complete validation and disposition

```text
python3 -m pytest tests/ -q
```

Result: **291 passed, 183 skipped** in 46.51s.

- Log: `.test-results/20261006-093834-slice3-expert-prerequisite/full-tier0.log`
- SHA256: `0fc99353d25e7c259617cba17f065e65905826001a54df3a51deeeeea76c9530`

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> python3 -m pytest -q -m container \
  -p no:cacheprovider tests
```

Result: **76 passed, 398 deselected** in 166.94s.

- Log: `.test-results/20261006-093834-slice3-expert-prerequisite/full-tier1.log`
- SHA256: `5b780d8534eed21aacfb6596ff7cdb876c4ab138918c828a4679ee0538d4924f`

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> scripts/test-tier1.sh --probe
```

Result: **PASS** against downloaded and checksum-verified Prime Agent **0.9.8**.
The apply and final check each reported the exact package SHA256
`a282b48718145d3aa396abc146bdca6a3f75b748c27023bbf874609386c09828` with managed `SYNC_PENDING`; the native RPC probe observed
`handoff`, `plan`, and `implement-spec` exactly once; the ephemeral container
was destroyed.

- Log: `.test-results/20261006-093834-slice3-expert-prerequisite/pinned-0.9.8-probe.log`
- SHA256: `42737cf01af5d7b3c378abfde62e005231ad5fae9863c73f45db5842f7fae485`

`git diff --check`, Python syntax checks, and shell syntax checks passed. The
standalone profile remains byte-identical at SHA256 `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`; the
managed Conversation guide remains `23ada4c2dff653dda3f6291c293f09dcc9c83d409f75404a665186e1dacfb563`; canonical `execute`
remains `7c720c8c949775b3b705a0f879ad9c754792839967ca4df702825b780bb17e6d`.

Two earlier complete-Tier-1 attempts failed before candidate setup because the
pinned release host first did not resolve and then timed out during download.
The successful complete run above supersedes those external setup failures. A
manually composed `-m "not container"` command also selected two sandbox-marked
runtime-converge tests and reproduced the already-open `prime-claw-5v7.10`
isolation incident; it is not acceptance evidence, prompted no live inspection
or recovery, and the correct repository Tier 0 command above is green.

The bounded Section 22 prerequisite is complete at this candidate. The package
remains definition-only and generic children remain ordinary. Reviewer spawn,
reservation, nonce/expiry, handle binding, child admission, message delivery,
report settlement, cleanup tools, provider identity, later Slice 3 admission
mechanics, Slice 4, landing, user-global mutation, restart, UAT, finalization,
and cleanup remain deferred.
