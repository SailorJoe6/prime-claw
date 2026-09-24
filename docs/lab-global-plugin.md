# Lab-global prime-claw plugin

> Scope: manual POC on Joe's personal DGX Spark only. The final sandbox uses the
> same environment-global placement inside its isolated home.

## Source and installed layouts

The builder source is deliberately inert. It lives outside Prime Agent's
project extension discovery path:

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

The installed copy preserves the inner relative layout under
`~/.prime/agent/`:

```text
APPEND_SYSTEM.md  # managed block; unrelated content is preserved
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

Prime Agent auto-discovers the installed extension entry points. Their relative
imports resolve through the installed `extension-support/` files.

Do not keep plugin source or a second copy under this repository's or a managed
project's `.prime/agent/extensions/` path. After a Prime Agent update, loading
the same extension at project and user scope was observed to prevent startup.
The old duplicate-command behavior is therefore not a safe compatibility mode.
Renaming the directory to `extensions-bak` is only an emergency recovery step;
the durable source belongs under `src/prime-agent-plugin/`.

Project-specific Ralph policy continues to live under each project's `.ralph/`
tree. Do not copy the plugin into each managed project.

## Apply or refresh

From the prime-claw builder repository, run:

```bash
scripts/apply-prime-agent-plugin.sh
scripts/check-prime-agent-plugin.sh
```

The apply script copies only the seven allowlisted Prime Claw TypeScript files. It
removes the one formerly managed obsolete `episode-finalization.ts` support file
with the same destination-type safety checks, and does not remove or overwrite
unrelated global extensions. The check script verifies that
all seven installed TypeScript files match the inert builder source byte-for-byte and that
this repository has no project-local plugin tree. The same workflow merges and
checks one managed CONVERSATION identity block in global `APPEND_SYSTEM.md`
without overwriting unrelated user append content. APPEND updates hold a
same-directory advisory lock across read/validate/write, reject unsafe symlink or
malformed-marker destinations, preserve unmanaged bytes and file mode, fsync a
unique temporary file, and atomically replace the destination. Under the same
lock, a later run removes only exact-pattern orphan temps whose writer PID is no
longer alive; live-writer temps are preserved. SIGTERM/retry is tested, while an
uncatchable interruption is reconciled on the next run rather than promised
away. Repeated and concurrent applies converge byte-for-byte.

TypeScript files are applied sequentially, not as one atomic generation swap.
All destination types are preflighted before mutation and apply runs the required
full check before reporting success, so a partial/mixed generation is detected
and must not be activated. The canonical project-local
`.ralph/skills/oversee-episode/SKILL.md` is preflighted but not globally copied.

For an isolated test destination, set `PRIME_AGENT_PLUGIN_ROOT` to the directory
that should contain `extensions/` and `extension-support/`:

```bash
PRIME_AGENT_PLUGIN_ROOT=/tmp/prime-agent-plugin-test   scripts/apply-prime-agent-plugin.sh
PRIME_AGENT_PLUGIN_ROOT=/tmp/prime-agent-plugin-test   scripts/check-prime-agent-plugin.sh
```

Refresh the global installation after every source change and before testing a
new plugin generation. Copying the complete managed set avoids mixed-version
entry points and support code.

Do not rely on `/reload` to replace an already loaded plugin generation. Let
affected work quiesce, restart the Prime Agent process or session, and verify
with a fresh process before treating the refreshed global copy as active.

## Verify runtime discovery

After `scripts/check-prime-agent-plugin.sh` passes, start a fresh Prime Agent
process from the builder or another repository and inspect its registered
commands and tools.

Expected native commands:

- `/handoff`
- `/plan`
- `/implement-spec`

Expected default identity resource:

- exactly one managed `PRIME_CLAW_CONVERSATION_IDENTITY_V1` block in `APPEND_SYSTEM.md`
- no explicit CONVERSATION launch flag
- oversight hooks registered by the normally discovered `reviewed-plan.ts` entry

Expected structured tools:

- `ralph_handoff`
- `ralph_plan`
- `create_spec_episode`
- `handoff_spec_episode`
- `finalize_spec_episode` — location-only, no-UI episode bookkeeping close after verified terminal work

Each command source path must resolve under `~/.prime/agent/extensions/`.
Starting from the builder repository is an important collision check: the
builder's source path must remain inert and must not register a second scope.
Plugin verification does not prove a project is ready for Ralph. The project's
`.ralph/` policy and direct skill exposure are separate `PROJECT_CONTEXT`
preparation concerns.

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
