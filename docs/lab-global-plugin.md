# Lab-global prime-claw plugin

> Scope: supported user-global installation for the builder/lab runtime. The
> final sandbox uses the same environment-global placement inside its isolated
> home. Deployment follows the staged transition and restart gate below.

## Source and installed layouts

The builder source is deliberately inert and contains seven managed TypeScript
files plus one managed APPEND_SYSTEM block:

```text
src/prime-agent-plugin/
  APPEND_SYSTEM.md
  extensions/
    handoff-chain.ts
    reviewed-plan.ts
  extension-support/
    conversation-oversight.ts
    episode-close.ts
    handoff-prompts.ts
    reviewed-plan-support.ts
    spec-episode.ts
```

The installed copy preserves that inner layout under `~/.prime/agent/`. Prime
Agent auto-discovers the two installed extension entry points; their relative
imports resolve through the five installed `extension-support/` files.

Do not keep plugin source or a second copy under this repository's or a managed
project's `.prime/agent/extensions/` path. Cross-scope duplicate discovery can
prevent startup. The durable source belongs under `src/prime-agent-plugin/`.
Project-specific Ralph policy remains under each project's `.ralph/` tree.

## Apply or refresh

The candidate is first validated through the isolated tier-1 Docker gate. After
owner acceptance of an exact deployment checkpoint, run from that candidate
worktree:

```bash
scripts/apply-prime-agent-plugin.sh
scripts/check-prime-agent-plugin.sh
```

Apply copies only the seven allowlisted TypeScript files. It treats these former
managed paths as retired:

- `extensions/goal-heartbeat-work-control.ts`;
- `extensions/goal-blocker-control.ts`; and
- `extension-support/episode-finalization.ts`.

The destination root, managed directories, and every current, redundant, and
retired leaf are type-checked before the first delete or copy. Apply rejects
symlinked or non-directory managed parents, removes only regular stale managed
files, and preserves unrelated global extensions.
Check rejects any stale retired entry and verifies each current installed file
byte-for-byte. The installer no longer reads or preflights
`.ralph/skills/oversee-episode/SKILL.md`.

The APPEND manager preserves unrelated user bytes and file mode, serializes
concurrent writes, rejects malformed markers and unsafe destinations, and
converges byte-for-byte. TypeScript copies remain sequential rather than an
atomic generation swap; the final complete check detects interruption or a mixed
generation before apply reports success.

For an isolated destination:

```bash
PRIME_AGENT_PLUGIN_ROOT=/tmp/prime-agent-plugin-test scripts/apply-prime-agent-plugin.sh
PRIME_AGENT_PLUGIN_ROOT=/tmp/prime-agent-plugin-test scripts/check-prime-agent-plugin.sh
```

## Cutover and rollback

A successful apply/check proves installed bytes, not the loaded generation.
`/reload`, elapsed time, a fresh probe, or container evidence alone is not
cutover proof. Preserve the old oversight skill, discovery link, and reviewer
profile while any old generation may still be loaded.

For cutover:

1. record the accepted candidate commit, installed hashes/check, known-good
   rollback generation, and one exact ordinary saved conversation;
2. let active work become idle or durably checkpointed;
3. perform one coordinated full Prime Agent daemon/harness restart;
4. resume the exact owner, exact episode, and designated ordinary conversation;
5. verify one managed lean block, zero new historical oversight packages, no
   detailed work-control overlay, and intact lifecycle authority; and
6. obtain operator acceptance before removing compatibility resources.

Saved sessions are resumed, never deleted. On failure, retain or restore every
compatibility resource, reapply/check the known-good generation, and repeat the
same quiesce/full-restart discipline.

## Verify runtime discovery

The installed generation should expose:

- native `/handoff`, `/plan`, and `/implement-spec` commands;
- structured `ralph_handoff`, `ralph_plan`, `create_spec_episode`,
  `handoff_spec_episode`, and `finalize_spec_episode` tools;
- exactly one managed `PRIME_CLAW_CONVERSATION_IDENTITY_V1` block containing the
  lean conversation/episode and goal/heartbeat protocol;
- no separate `goal-heartbeat-work-control.ts` entry or
  `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` overlay; and
- lifecycle hooks from `reviewed-plan.ts` that filter historical
  `prime-claw-oversee-episode-package` messages without producing new ones.

`finalize_spec_episode` remains a location-only, no-UI bookkeeping close after
verified terminal work. It grants no Git, merge, abandonment, session, worktree,
branch, cleanup, scope, or product authority. Plugin verification also does not
replace project `.ralph/` readiness.

## Evidence history

On 2026-09-22, the original five-file global installation matched its builder
sources byte-for-byte. A disposable offline RPC session registered all three
commands from the global extension paths and all four structured tools available in that earlier generation.

After the later Prime Agent update exposed fatal cross-scope collision behavior,
the builder source was moved out of `.prime/agent/` and the explicit apply/check
workflow above replaced manual copying. Post-migration, the check script proved
byte parity and a fresh builder-rooted offline RPC process started successfully
with exactly one `/handoff`, `/plan`, and `/implement-spec`, all sourced from the
user-global installation. A session-start probe also confirmed all five expected
structured tools.

On 2026-09-30, managed apply/check installed exact accepted goal/heartbeat repair
`486f4af62b7c1088a0ad10eb9ca05a2e0f735401`. Independent evidence recorded all
eight managed TypeScript files as regular, non-symlink, and byte-identical to
builder source; the obsolete goal-blocker entry was absent and the preserving
`APPEND_SYSTEM.md` check passed. After the sole-daemon restart, visible UAT
confirmed obsolete-tool absence, event-driven goal-to-monitored-wait transfer
with terminal cleanup, and a human-only blocker with no person-polling
heartbeat. Exact receipts are on `prime-claw-h6w.24.2`; canonical behavior is in
[goal-heartbeat-work-control.md](goal-heartbeat-work-control.md).
