# Lab-global prime-claw plugin

> Scope: supported user-global installation for the builder/lab runtime. The
> final sandbox uses the same environment-global placement inside its isolated
> home. Deployment follows the staged transition and restart gate below.

## Source and installed layouts

The builder source is deliberately inert. The bridge generation has one authored
neutral kernel, one machine-readable generation selector, the retained legacy
APPEND block, and nine managed TypeScript files:

```text
src/prime-agent-plugin/
  ROLE_KERNEL.md
  role-protocol.json              # schema 1, generation=bridge
  APPEND_SYSTEM.md                # retained compatibility block
  extensions/
    handoff-chain.ts
    reviewed-plan.ts
  extension-support/
    conversation-oversight.ts
    episode-close.ts
    handoff-prompts.ts
    prep-chain.ts
    reviewed-plan-support.ts
    role-kernel.generated.ts      # generated exact bytes + SHA256
    spec-episode.ts
```

`ROLE_KERNEL.md` is the only authored neutral-kernel policy. Apply, check, Tier
0, and Tier 1 run `scripts/generate-prime-agent-role-kernel.py check`; a stale
checked-in generated file fails before installation. The installed copy keeps
the TypeScript layout under `~/.prime/agent/`. Prime Agent auto-discovers the
two extension entry points; their relative imports resolve through the seven
installed `extension-support/` files.

Do not keep plugin source or a second copy under this repository's or a managed
project's `.prime/agent/extensions/` path. Cross-scope duplicate discovery can
prevent startup. The durable source belongs under `src/prime-agent-plugin/`.
Project-specific Ralph policy remains under each project's `.ralph/` tree.

## Apply or refresh

The zero-argument scripts intentionally fail. Every invocation must select one
of two target modes:

1. **Development/test:** use tier 1 so Prime Agent and the plugin stay inside an
   ephemeral Docker container. The driver and pytest fixture explicitly target
   the container's `/root/.prime/agent`:

   ```bash
   scripts/test-tier1.sh --probe
   python3 -m pytest tests/ -q -m container
   ```

   For a script-only diagnostic that does not run Prime Agent, an explicitly
   isolated destination is also valid:

   ```bash
   PRIME_AGENT_PLUGIN_ROOT=/tmp/prime-agent-plugin-test scripts/apply-prime-agent-plugin.sh
   PRIME_AGENT_PLUGIN_ROOT=/tmp/prime-agent-plugin-test scripts/check-prime-agent-plugin.sh
   ```

2. **Accepted user-global activation:** after the matching plugin mechanics and
   project-local `.ralph/skills` have landed, run from the primary `main`
   checkout only:

   ```bash
   scripts/apply-prime-agent-plugin.sh --user-global
   scripts/check-prime-agent-plugin.sh --user-global
   ```

   `--user-global` is refused from linked Git worktrees and from any branch
   other than `main`. Supplying `PRIME_AGENT_PLUGIN_ROOT` with the flag is an
   error. On a host, spelling `~/.prime/agent` as the explicit root is also
   refused; the conspicuous flag is required. Tier 1 may use that same path
   inside Docker because the container filesystem is the isolation boundary.

Apply copies only the nine allowlisted TypeScript files. Before the first copy,
`scripts/manage-prime-agent-role-protocol.py` selects exactly one global context
candidate in Prime Agent priority order: `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`,
then `CLAUDE.MD`. It creates `AGENTS.md` only when none exists. The manager owns
only its distinct `prime-claw:role-kernel` marker region and introduced
separators. It preserves unrelated bytes, LF/CRLF style, final-newline state,
mode, uid, and gid. It records the selected path and ownership in mode-0600
`$agentDir/.prime-claw/role-protocol-state.json`.

Selection drift, a latent block in an unselected candidate, malformed or
unowned markers, unsafe files/directories, or source/generated disagreement
fails closed before plugin copy. Apply and check do not migrate a selected file
implicitly. First bridge adoption accepts only the byte-exact predecessor
legacy APPEND block from `src/prime-agent-plugin/APPEND_SYSTEM.md`; marker-shaped
stale or disagreeing policy is not provenance and is rejected before the lock
or any shared-file/plugin-copy mutation. Removing the accepted block is not
part of this generation.

The installer treats these former managed paths as retired:

- `extensions/goal-heartbeat-work-control.ts`;
- `extensions/goal-blocker-control.ts`; and
- `extension-support/episode-finalization.ts`.

The destination root, managed directories, and every current, redundant, and
retired leaf are type-checked before the first delete or copy. Apply rejects
symlinked or non-directory managed parents, removes only regular stale managed
files, and preserves unrelated installed extensions. Check rejects any stale
retired entry and verifies each current installed file byte-for-byte. Apply
forwards its explicit target mode to that required full check, so an interrupted
or mixed sequential generation cannot report success.

The installer no longer reads, preflights, or globally copies
`.ralph/skills/oversee-episode/SKILL.md`. The skill, discovery link, and reviewer
profile remain project-local loaded-generation compatibility resources through
the accepted cutover gate. The plugin provides no fallback when a required
project phase skill is missing.

The predecessor APPEND-only manager remains in source for bridge rollback. New
apply/check use the role-protocol manager for both selected context and retained
APPEND ownership. The destination, state directory, lock, candidates, APPEND,
manifest, transaction journal, temporary files, and receipt parent/leaf are
opened through descriptor-bound no-follow directory authorities. After
`flock`, the lock pathname must still name the exact flocked device/inode; the
same binding is checked at every mutation boundary so replacing the lock cannot
create split-brain writers. Each commit and each final success seam revalidates
the destination and state-directory identities, all four context candidates,
the target's bytes/mode/uid/gid/device/inode, and any external receipt identity.
A late chmod/chown, inode replacement, candidate creation or removal, parent
swap, symlink, FIFO, or special file is preserved and fails closed instead of
being overwritten or followed.

Writes serialize under one agent-root lock. Before a shared replacement the
manager durably records exact preimages, staged postimage identities, the exact
three-file inventory, destination/selection binding, candidate-set snapshots,
and transaction phase in mode-0600
`$agentDir/.prime-claw/role-protocol-transaction.json`. Replacement, file and
directory fsync, final installed-state validation, and receipt publication are
inside that transaction. Receipt success always publishes mode 0600 and
includes an external-parent directory fsync; interrupted recovery repeats that
durability barrier before deleting the only journal. A recognized interruption
is replayed to the exact safe side; an unknown mixed state retains an explicit
uncertainty journal and is never guessed away. Pre-journal staging errors clean
their temps, and restart recovery reconciles only unreferenced, exact-pattern
dead-writer temporary files.

### Selected-context recovery receipts

The manager can capture a mode-0600 receipt outside `agentDir` before an isolated
apply and restore only when every managed postimage still matches:

```bash
python3 scripts/manage-prime-agent-role-protocol.py apply \
  src/prime-agent-plugin/role-protocol.json \
  src/prime-agent-plugin/ROLE_KERNEL.md \
  src/prime-agent-plugin/APPEND_SYSTEM.md \
  /explicit/isolated/agent-dir \
  --receipt /external/private/bridge-preimage.json

python3 scripts/manage-prime-agent-role-protocol.py restore \
  /external/private/bridge-preimage.json \
  /explicit/isolated/agent-dir
```

Receipt schema 2 is validated completely before mutation: exact top-level
schema, destination device/inode, selected-context priority, manifest binding,
unique `context`/`append`/`manifest` inventory, exact relative paths, candidate
pre/postimages, regular-file types, base64, digests, mode/uid/gid, and
file identities must all agree. The receipt must be a mode-0600 regular file
outside `agentDir`, reached through a no-follow parent chain.

Restore first validates every receipt field and every current state. It then
uses its own durable transaction to recreate exact preimage bytes and metadata.
An installer-created `AGENTS.md` or `APPEND_SYSTEM.md` is deleted only when the
receipt proves it was absent and its exact current postimage is unchanged.
Malformed inventories, unrelated in-root targets, corrupt late preimages,
operator edits, or unknown partial states block before destructive recovery.
A completed restore is replay-safe; an interrupted one resumes from its exact
recorded phase. Gate activation will retain receipts in the owner-private
evidence location through the external cutover coordinator; Slice 1 does not
apply or restore the host generation.

## Cutover and rollback

A successful apply/check proves installed bytes, not the loaded generation.
`/reload`, elapsed time, a fresh process, or container evidence alone is not
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

Candidate discovery is proved only by tier-1 Docker. After an accepted
user-global refresh from primary `main` and the coordinated restart above, use
the resumed sessions for cutover UAT; do not substitute a linked-worktree or
host candidate probe. The accepted installed generation should expose:

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
