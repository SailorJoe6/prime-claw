# K. Develop Prime Claw safely

## US-27 — Develop Prime Claw without damaging the running Prime Claw

**As a Prime Claw developer using an active Prime Claw environment to develop
the plugin, I need candidate builds and tests isolated from the live
installation, so that broken or incomplete changes cannot damage the agent,
sessions, configuration, credentials, or machine supporting the development
work.**

This is a self-hosting safety story: Prime Claw is used to develop Prime Claw.
A candidate must therefore be exercised outside the loaded user-global
generation and outside any project-local extension scope that could create
duplicate plugin discovery.

### Acceptance criteria

- Plugin source remains inert in the builder checkout.
- Candidate apply, check, and runtime probes use disposable Docker or an
  explicitly isolated scratch root.
- Candidate code cannot mutate the live user-global plugin, Prime Agent
  settings, or session state.
- Test configuration and session roots are isolated from the developer's real
  roots.
- Failure and interruption behavior can be exercised without leaving live
  resources or changing active work.
- Fixtures clean up the containers, sessions, workers, files, and other
  resources they create.
- Validation records enough provenance to identify the candidate and runtime
  that were tested.
- Linked worktrees cannot activate a user-global candidate.

Docker fixtures, fake adapters, temporary roots, and saved Tier-1 evidence are
implementation mechanisms for these acceptance criteria. They are not separate
user stories.

## Supported Prime Agent compatibility boundary

Prime Agent `0.9.8` is not pinned merely to make tests reproducible. It is the
supported upstream contract that retains the plugin framework and APIs Prime
Claw currently requires. Prime Agent `0.10` is an unsupported rewrite that
removed that plugin framework and broke the API contract used by this plugin.

Therefore candidate validation must exercise the supported `0.9.8` runtime.
Supporting a later Prime Agent line requires deliberate compatibility work and
requalification; it is not an automatic version bump and not a separate user
story.

## Primary implementation surfaces

- `AGENTS.md`
- `scripts/test-tier1.sh`
- `scripts/run-prime-agent-probe.sh`
- `scripts/apply-prime-agent-plugin.sh`
- `scripts/check-prime-agent-plugin.sh`
- `tests/conftest.py`
- `tests/test_prime_agent_plugin_install.py`

## Design references

- [`testing-strategy.md`](../testing-strategy.md)
- [`prime-agent-installation.md`](../prime-agent-installation.md)
- [`lab-global-plugin.md`](../lab-global-plugin.md)
