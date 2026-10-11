# Lab-global prime-claw plugin

> Scope: the supported Prime Agent `0.9.8` plugin installed in a user-global
> agent directory or the isolated restored sandbox home.

## Source and delivery authority

Plugin source is inert under `src/prime-agent-plugin/`. The schema-2
`asset-inventory.json` is the single delivery authority. Each shipped source
appears once and declares one or more explicit policies:

- `plugin-root-exact`: exact installed plugin bytes;
- `plugin-root-managed`: Markdown whose local drift needs an explicit decision;
- `user-skill-exact`: the user-level goals skill;
- `selected-context-block`: `ROLE_KERNEL.md` inside one global context file; and
- `project-customizable`: project templates that become operator-owned after
  customization.

`scripts/manage-prime-agent-delivery.py` interprets this authority for both
apply and check. It records digest-bound ownership in
`.prime-claw/delivery-state.json`. A bounded predecessor hash set supports the
accepted schema-1 upgrade; it does not authorize unknown or changed deletion.

The final-only role reconciler reads the unique `selected-context-block` source.
It selects the first ordinary context in this order:

1. `AGENTS.md`
2. `AGENTS.MD`
3. `CLAUDE.md`
4. `CLAUDE.MD`

It preserves unrelated bytes, requires unique role markers, rejects symlinks,
non-regular files, hard-linked aliases, latent blocks in unselected contexts,
and unknown ownership drift. Apply uses same-directory atomic replacement and a
root-local lock. Compact mode-`0600` state lives at
`.prime-claw/role-protocol-state.json`. Check requires exact source bytes and
state. The reconciler has no bridge generation, legacy APPEND migration,
receipt replay, restore command, or cutover transaction engine.

## Supported runtime

Prime Agent `0.9.8` is the supported plugin runtime. Prime Agent `0.10` removed
the extension interface required by these stories. Candidate development and
pre-merge validation are Docker-only.

Never place candidate source under this repository's `.prime/agent/extensions`.
Prime Agent can discover both project and user scopes and fail startup on a
duplicate extension.

## Apply or refresh

Bare apply and check fail closed. Supported targets are:

```bash
# Docker or script-only isolated diagnostics
PRIME_AGENT_PLUGIN_ROOT=/explicit/isolated/root scripts/apply-prime-agent-plugin.sh
PRIME_AGENT_PLUGIN_ROOT=/explicit/isolated/root scripts/check-prime-agent-plugin.sh

# Restored sandbox home, from inside that container only
scripts/apply-prime-agent-plugin.sh --sandbox-home
scripts/check-prime-agent-plugin.sh --sandbox-home

# Deliberate accepted host refresh, primary main checkout only
scripts/apply-prime-agent-plugin.sh --user-global
scripts/check-prime-agent-plugin.sh --user-global
```

`--user-global` is refused from linked worktrees or non-`main` branches. An
explicit root that resolves to the host user-global target is also refused.
`--sandbox-home` requires Docker `HOME=/sandbox`, the exact mounted `.prime`
link, and an image-owned `.agents` directory.

Apply performs all read-only delivery, selected-context, and retired-package
preflights before mutation. It reconciles the role block, removes only hash-proven bounded predecessor
plugin files, applies manifest assets, and runs the exact checker. Installation is sequential rather than a generation-directory swap;
the final check is therefore mandatory and rejects incomplete generations.

A drift-managed Markdown asset supports:

- `preserve` (default): report unresolved drift and fail;
- `backup-reset`: validate a private backup path before any mutation, save the
  old bytes, then install current source; and
- `accept-override`: retain the current bytes as the accepted local version.

Unknown, changed, symlinked, non-regular, or escaped retired paths fail closed.

## Restored v2 sandbox home

The accepted v2 replacement mounts one retained volume at `/sandbox/home-root`
and links selected persistent state into `/sandbox`. Image-provided `.agents`,
`.uv`, `.venv`, `.cache`, and `.local` remain real image directories. Retained
fallback copies remain in mounted `home-root`; this repository does not remove
them.

The guarded sandbox deployer:

```bash
python3 scripts/deploy-prime-agent-plugin-sandbox.py   --sandbox <name> --sandbox-id <id> --image-id <sha256:id>   --volume <name> --policy-sha256 <sha256>
```

stages a content-hashed bundle, validates the exact Ready sandbox, image,
mounts, policy, and home topology, then runs container-local apply and check. It
does not restart Prime Agent, refresh brains, copy credentials, or clean retained
resources. `--check-only` performs no plugin mutation.

## Candidate validation

After every plugin-source change run a Docker gate, normally:

```bash
scripts/test-tier1.sh --probe
```

Tier 1 builds an immutable image, disconnects network before plugin execution,
performs apply/check and optional native discovery, verifies teardown, and
publishes evidence under `.test-results/`. Native Prime Agent probes must use
`scripts/run-prime-agent-probe.sh` so settings and sessions are isolated.

## Accepted refresh boundary

A deliberate post-acceptance user-global or sandbox refresh remains an operator
action. Let active work quiesce, apply and check from the authorized target,
then perform one coordinated full Prime Agent restart. Copy success, elapsed
time, `/reload`, or a fresh process alone does not prove loaded-generation
cutover. Resumed owner, episode, and ordinary-session UAT provide that proof.

Retained sandboxes, volumes, checkpoints, receipts, and preimage evidence are
historical operator resources. Code retirement does not authorize deleting or
altering them. Cleanup requires a separate explicit decision.

## Runtime discovery

A healthy loaded generation exposes the expected extension commands and tools
exactly once. Use the Docker offline RPC probe for candidate proof. For an
accepted live generation, use only separately authorized supported checks; do
not start a second Prime Agent instance on the host.

## Evidence history

Dated bridge, cutover, recovery, and activation records under `docs/evidence/`
remain historical evidence. They are intentionally not current executable
instructions. The accepted container activation record is
[`prime-claw-v2r1013-plugin-activation-20261010.md`](evidence/prime-claw-v2r1013-plugin-activation-20261010.md).
