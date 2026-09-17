# Phase 3a Slice 4R — Explicit operator brain repository

**Date:** 2026-09-17  
**Requirement:** R3a-16  
**Decision:** D3a-N  
**Bead:** `prime-claw-zwg.2`  
**Verdict:** **PASS**

## Contract proved

Prime-claw has no tracked or code-fallback brain repository. Repository identity is accepted
only from `PRIME_CLAW_BRAIN_REPO` or the canonical ignored
`.prime-claw/runtime.local.json`. The environment has precedence. Values must use a validated
GitHub `owner/repository` slug without a URL or `.git` suffix.

`status`, `create`, `converge`, `validate`, `recover`, `embedding-build`, and the direct clone
stage share one setup gate. Missing or malformed repository settings fail before profile,
provider, sandbox, network, or database boundaries. `status` reports the setup problem without
probing runtime components. Non-repository operations (`build`, `destroy`, and
`embedding-preflight`) remain available.

The same gate validates branch, sandbox clone path, GitHub host, retry count, and retry delay
before lifecycle mutation.
Clone shell arguments are quoted, repository/host inputs have narrow grammars, and the cleanup
command uses `rm -rf --` only with a normalized absolute path of at least two components.

## Portability and provenance

- Removed `brain_repo` from `config/runtime.json` and removed the fallback from
  `bin/prime-claw`.
- Base/custom config cannot forge `_local_override_keys` or `_local_config_path`; `load_config`
  derives both after reading an overlay and rejects reserved internal overlay keys.
- A repository value in a noncanonical overlay is not accepted. The only local-file source for
  repository identity is `.prime-claw/runtime.local.json`.
- The operator proving-instance value was added to that ignored file at mode `0600`. Existing
  private embedding configuration was preserved and is not recorded here.
- Active runtime code, tracked runtime config, and generic tests contain no operator repository
  identity.

## Independent review

A read-only independent reviewer challenged provenance, shell interpolation, and retry validation.
The resulting fixes prevent forged local-config provenance, validate and quote every clone setting,
and reject fractional/nonfinite/out-of-range retry values at the common pre-mutation gate. Final
review reported no unresolved medium- or high-severity finding.

## Reproduction

```text
pytest -q tests/test_brain_repo_config.py
# 50 passed, 1 warning

pytest -q tests
# 228 passed, 11 warnings

bin/prime-claw --dry-run create
# exit 0; ignored-local repository selection honored; no private endpoint emitted

git diff --check
# clean
```

The focused tests cover missing, malformed, local, and environment repository selection;
environment precedence; forged provenance; noncanonical overlays; reserved internal keys;
fail-before-boundary behavior for every repository-dependent verb; safe clone and bounded retry
setting validation; and clone/fetch command construction.

No sandbox, provider, network, database, canonical index, or candidate index was mutated during
Slice 4R acceptance.
