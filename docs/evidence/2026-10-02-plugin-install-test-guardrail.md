# Plugin install/test guardrail repair — 2026-10-02

Tracking: `prime-claw-4mw`.

## Incident and root cause

An unmerged linked-worktree plugin generation was installed into the operator's
shared `~/.prime/agent` because the zero-argument apply/check scripts silently
selected that destination while `AGENTS.md` still required the bare host
workflow. The TypeScript mechanics then loaded in a sibling checkout whose
project-local `.ralph/skills` did not include the matching new prompt policy.
The plugin correctly failed closed; the defect was deployment and test
isolation, not missing-skill fallback behavior.

## Repair

- `scripts/prime-agent-plugin-target.sh` centralizes fail-closed target
  selection for apply and check.
- Bare apply/check now require an explicit `PRIME_AGENT_PLUGIN_ROOT` or the
  conspicuous `--user-global` mode before any destination access.
- Host explicit roots that resolve to `~/.prime/agent` cannot bypass the flag.
  Docker tier 1 may deliberately target the same path inside the container.
- `--user-global` requires the primary Git worktree on branch `main`; linked
  worktrees and other branches are refused. Apply forwards the selected mode
  to its final check.
- The tier-1 driver and session fixture explicitly select
  `/root/.prime/agent`. They do not inherit host `HOME`.
- Prompt policy remains project-local and missing skills remain fail-closed.
  No compaction product behavior or TypeScript prompt fallback changed.

## Regression coverage

`tests/test_prime_agent_plugin_install.py` proves:

- bare apply and bare check fail with zero destination mutation;
- explicit isolated roots still install and check byte-identically;
- deliberate primary-main `--user-global` succeeds only inside tier 1;
- a synthetic linked worktree with a candidate-only local skill cannot mutate
  a sibling shared generation, while its isolated activation succeeds.

Tier-0 driver/fixture tests pin the explicit container destination and absence
of host-HOME inheritance. Existing missing-skill tests continue to protect the
product's fail-closed policy.

## Red-before-green evidence

Before the repair, the new tier-0 driver/fixture assertions failed because no
explicit container target existed. A Docker red run using the pinned 0.9.8
selector stopped earlier on the separately tracked tier-1 pinned-installer PATH
bug (`prime-claw-blw.5`: installer succeeded, then `prime-agent` was not on
PATH). Validation therefore used the supported source selector through the
same tier-1 Docker boundary; it did not fall back to host plugin execution.

## Validation

Pre-commit focused evidence:

- `python3 -m pytest -q tests/test_tier1_driver.py tests/test_tier1_fixture.py`
  — **85 passed**.
- `TIER1_ENV_FILE=<source-selector> python3 -m pytest -q
  tests/test_prime_agent_plugin_install.py -m container` — **20 passed,
  1 deselected**.
- `TIER1_ENV_FILE=<source-selector> scripts/test-tier1.sh --probe` — **PASS**;
  explicit-root apply/check succeeded and the semantic probe found `handoff`,
  `plan`, and `implement-spec` exactly once from the container extension root.
- A plain tier-0 run reached **274 passed, 147 skipped** plus one unrelated
  timing-sensitive watchdog failure; that exact watchdog passed immediately on
  focused rerun (**1 passed**).

The complete tier-1 and `scripts/test-all.sh` acceptance runs occur against the
exact immutable candidate commit from a clean detached validation checkout, so
their final exact results and candidate SHA are recorded on `prime-claw-4mw`
rather than guessed inside the commit being tested. The dirty primary checkout's
operator-owned `APPEND_SYSTEM.md` prompt edit and another conversation's two
planning files are excluded from both the commit and clean validation tree.
