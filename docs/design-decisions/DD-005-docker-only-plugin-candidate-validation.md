# DD-005 — Validate plugin candidates away from the running plugin

- **Status:** accepted
- **Stories:** [US-01–US-02](../user-stories/A-installation.md), [US-27](../user-stories/K-developer-safety.md)

## Observed context

Prime Claw uses its own loaded plugin while developing that plugin. A candidate
placed in project-local discovery beside the installed global copy can prevent
Prime Agent startup. A host process may also retain old extension code while
rereading changed project files, so copy success, `/reload`, elapsed time, or a
fresh probe does not prove which generation is loaded. Configuration-mutating
native probes can touch user-global `settings.json` even when only the session
directory is redirected.

Evidence: the binding boundary in [`AGENTS.md`](../../AGENTS.md),
[`testing-strategy.md`](../testing-strategy.md), “Restored v2 sandbox home” and
“Accepted refresh boundary” in [`lab-global-plugin.md`](../lab-global-plugin.md), and
the separated staging/restart/live proof in
[`prime-claw-v2r1013-plugin-activation-20261010.md`](../evidence/prime-claw-v2r1013-plugin-activation-20261010.md).

## Decision

Keep source inert under `src/prime-agent-plugin/`. Execute plugin source and
run Prime Agent/plugin candidate probes only in disposable Docker Tier 1.
An explicit isolated `PRIME_AGENT_PLUGIN_ROOT` is permitted only for script-only
apply/check diagnostics; it is not a candidate execution or pre-merge validation
environment. Run every native Prime Agent probe through
`scripts/run-prime-agent-probe.sh` inside its otherwise authorized isolated
boundary. Never apply or probe a candidate against the live user-global
installation. A deliberate post-acceptance refresh is a separate
operator-authorized cutover from primary `main`, followed by quiescence, one
coordinated full restart, and resumed-session UAT while rollback resources
remain available.

## Rejected simpler alternative

Host-global candidate testing risks the same agent, settings, sessions, and
plugin generation used to conduct the repair. Project-local candidate copying
is not isolated because Prime Agent discovers both scopes. A fresh process or
successful byte check proves installation, not loaded-generation cutover.

## Regression anchors

- `tests/test_prime_agent_plugin_install.py`
- `tests/test_tier1_driver.py`, `tests/test_tier1_fixture.py`, and
  `tests/test_tier1_network_policy.py`
- `tests/container/sandbox_plugin_install_probe.py`
- the v2r1013 activation evidence above

## Revisit condition

Reconsider only if Prime Agent provides a documented, process-enforced candidate
extension namespace that also isolates settings, session state, discovery, and
loaded code from the running generation. Self-hosted cutover would still need
separate activation proof.
