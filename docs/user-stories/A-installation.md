# A. Install and maintain the plugin

## US-01 — Safely install an accepted plugin generation

**As a runtime administrator, I want to install or refresh one accepted plugin
generation without accidentally modifying another environment, so that Prime
Agent receives the intended extensions and managed assets.**

The installation contract includes:

- explicit isolated, sandbox, or `--user-global` targeting;
- refusal of bare or ambiguous targets;
- refusal of user-global activation from linked worktrees;
- installation of extensions, support modules, managed skills, workflows, and
  role policy;
- exact post-install checking that detects incomplete or mixed generations;
- a separate coordinated restart requirement after accepted activation.

## US-02 — Preserve unrelated global configuration

**As a runtime administrator, I want the plugin to own only its declared assets,
so that unrelated Prime Agent extensions, skills, and policy remain untouched.**

Global drift requires an explicit `preserve`, `backup-reset`, or
`accept-override` decision. Installation must reject unsafe roots, symlink or
file-type hazards, and collisions between global plugin assets and project-
customizable content.

## Primary implementation surfaces

- `scripts/apply-prime-agent-plugin.sh`
- `scripts/check-prime-agent-plugin.sh`
- `scripts/prime-agent-plugin-target.sh`
- `src/prime-agent-plugin/asset-inventory.json`
- `src/prime-agent-plugin/ROLE_KERNEL.md`

## Design references

- [`lab-global-plugin.md`](../lab-global-plugin.md)
- [`project-initialization.md`](../project-initialization.md)
- [`testing-strategy.md`](../testing-strategy.md)
