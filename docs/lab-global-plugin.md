# Lab-global prime-claw plugin

> Scope: supported user-global installation for the builder/lab runtime. The
> final sandbox uses the same environment-global placement inside its isolated
> home. Deployment follows the staged transition and restart gate below.

## Source and installed layouts

The builder source is deliberately inert. The bridge generation has one authored
neutral kernel, one machine-readable generation selector, the retained legacy
APPEND block, eleven managed TypeScript files and two exact managed global skill inventories:

```text
src/prime-agent-plugin/
  ROLE_KERNEL.md
  role-protocol.json              # schema 1, generation=bridge
  APPEND_SYSTEM.md                # retained compatibility block
  extensions/
    handoff-chain.ts
    reviewed-plan.ts
  extension-support/
    conversation-guide-metadata.ts
    conversation-oversight.ts
    episode-close.ts
    expert-review-reservation.ts
    handoff-prompts.ts
    prep-chain.ts
    reviewed-plan-support.ts
    role-kernel.generated.ts      # generated exact bytes + SHA256
    spec-episode.ts
  skills/
    prime-claw-oversee-episode/SKILL.md
    prime-claw-official-expert-review/  # SKILL, pyproject, package, reviewer
```

`ROLE_KERNEL.md` is the only authored neutral-kernel policy. Apply, check, Tier
0, and Tier 1 run `scripts/generate-prime-agent-role-kernel.py check`; a stale
checked-in generated file fails before installation. The installed copy keeps
the TypeScript layout under `~/.prime/agent/`. Prime Agent auto-discovers the
two extension entry points; their relative imports resolve through the nine
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

Apply copies only the eleven allowlisted TypeScript files and the two exact managed skill inventories. Before the first copy,
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

The installer owns two uniquely named global skills beside the TypeScript
plugin files: `skills/prime-claw-oversee-episode/SKILL.md` and the complete
`skills/prime-claw-official-expert-review/` Python-backed package. It validates
real managed `skills/`, skill, `src/`, and package directories; refuses extra
entries in either exact managed inventory; installs mode 0644 bytes; and
requires an exact final check. Before any destination mutation,
`check-prime-agent-expert-runtime.py` selects the same managed-kernel interpreter
Prime Agent will use. It accepts an exact normal installed package import or
validates the source package with that interpreter and reports `SYNC_PENDING`
without changing the environment. If `PRIME_AGENT_KERNEL_PYTHON` is set, only an
already-installed exact package/hash is `AVAILABLE`; missing, stale, mismatched,
or unusable state is deterministically `UNAVAILABLE` before plugin mutation.

This ordinary plugin-file ownership does not widen the role-protocol manager's
fixed context/legacy-APPEND/manifest receipt. The project
`.ralph/skills/oversee-episode/SKILL.md` is only a policy-free compatibility shim;
its `.agents` discovery symlink remains for transition diagnostics. The
standalone reviewer profile remains byte-identical migration evidence. The EXPERT package now owns the supported launch sequence. The retired native
reserve/bind/status/cancel tools grant no compatibility path. `launch(packet)`
derives the exact active owner and marker worktree from host-authored session
state, requires one exact model result, creates mode-private untracked `PENDING`
state, calls public `rlm.spawn` with an unpredictable harmless bootstrap name,
and atomically publishes `FINALIZED` only from the actual return. The child
waits for transient `PENDING`+`FINALIZED` publication overlap to resolve, admits
only after exactly one authority phase remains, and aborts a persistent or
broader phase conflict before provider use. It then binds that state to public
canonical session/model/parent-header facts and atomically claims before exposing
one rubric-plus-packet provider turn. Inbound message content and metadata are
ignored. Mismatch, timeout, replay, or duplicate claim explicitly aborts before
provider use. The child submits one bounded
structured report; the owner settles it and records one explicit conversational
disposition. Public roster/delete/re-list operations must prove the stored
actual child is no longer addressable before `CLOSED` or stale `CANCELLED`.
Failed or uncertain deletion retains recoverable private state. Exact explicit
purge removes only a durably recorded `CLOSED` private record and never session
artifacts. All terminal phases preserve neutral-kernel/provider-abort behavior.

The predecessor APPEND-only manager remains in source for bridge rollback. New
apply/check use the role-protocol manager for both selected context and retained
APPEND ownership. The manager follows a trusted-local operating model: it rejects
obvious symlinks, non-regular or unreadable leaves visible during validation,
then serializes cooperating writers with one agent-root `flock`. It rereads each
ordinary byte-and-metadata preimage immediately before same-directory
`os.replace`, preserves mode/uid/gid where supported, fsyncs the new file and its
parent directory, and refuses a changed preimage.

The first Slice 2 provider guard imports the generated role-kernel bytes rather
than trusting the retained legacy APPEND body. Ordinary explicit no-context
sessions remain ordinary; promotion, active-owner, and bounded-EPISODE paths
require the exact neutral block. The accepted first Slice 2 candidate stopped at
that provider guard. The accepted next candidate added one active-owner
Conversation-guide disclosure and gated handoff plus first finalization. The
current bounded candidate reuses the existing `/implement-spec` preparation
state to admit the same disclosure for one exact prospective future folder and
requires its consumed private readiness before `create_spec_episode` can invoke
any episode mutation.

This is intentionally not a hostile-filesystem transaction engine. The manager
does not maintain a multi-phase journal, continuous descriptor/inode authority,
atomic-exchange rollback, or syscall-by-syscall crash protocol. An in-process
ordinary write failure attempts rollback only from exact known pre/post states.
An abrupt interruption can require guarded manual recovery; unknown state is left
untouched. The supported wrapper accepts `--role-receipt /absolute/private/path` so the
separately authorized coordinator can require a fresh destination-bound live
receipt. A receipt produced by an isolated proof is never valid authority for the
real user-global root. A
non-cooperating same-UID process can race individual checks; that is outside the
approved local-product threat model.

### Selected-context recovery receipts

An isolated apply can capture a mode-0600 diagnostic receipt outside `agentDir`:

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

The simple schema-1 receipt has a fixed inventory of exactly the selected context,
`APPEND_SYSTEM.md`, and `.prime-claw/role-protocol-state.json`. Before any restore
mutation, the manager validates the complete schema, exact paths, unique labels,
base64/digests, ordinary metadata, selected-context/manifest relationship, and
creation ownership. Every current destination must match its recorded preimage or
postimage. An unknown file, marker drift, malformed inventory, contradictory
ownership, or unrelated nominated path refuses the whole restore before mutation.

Restore writes exact recorded bytes and ordinary metadata, and deletes a missing
preimage only at its fixed managed path from an exact known postimage. In
particular, a receipt cannot nominate an unrelated file for deletion, and a
pre-existing context is not deleted by an accidentally contradictory creation
record. A partially restored set made only of recorded states is safely
repeatable. The receipt is recovery material, not a tamper-proof attestation
against the trusted local owner.

Plausible excluded hazards remain advisory hardening: parent or leaf replacement
between individual validation and mutation syscalls, same-UID receipt
substitution, hard exits at every rename/fsync boundary, and power-loss durability.
Promote one only after repeatable dogfood failure, a near miss or user report, a
changed trust boundary, or a separately approved hard requirement. Slice 1 does
not apply or restore the host generation.

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


## Generation A coordinator and preactivation bundle

Slice 4 adds two inert, operator-launched helpers:

- `scripts/coordinate-prime-agent-role-cutover.py` performs read-only preflight
  by default. A real mutation requires both `--execute` and the full accepted
  candidate commit as `--authorization`, plus the exact operation input. It
  records a mode-0600 checkpoint under an operator-selected mode-0700 private
  directory. It never reviews, accepts, retries an uncertain mutation, resumes a
  session, or starts Gate A on its own.
- `scripts/manage-prime-agent-cutover-bundle.py` creates and verifies the private
  preactivation bundle. It captures only the selected global-context and APPEND
  preimages, their known candidate postimages, the fixed managed plugin/skill
  and ownership-manifest surface, selected-file decision, known-good generation,
  source topology, and exact recovery tool hashes. It does not traverse
  settings, sessions, provider/OAuth state, `.env` files, or unrelated agent
  entries. Exact opaque preimages remain private and are never committed.

The coordinator input must record the exact accepted commit/tree, synchronized
primary `main`, expected remote ref, explicit history-preserving revert recipe,
bundle manifest digest, launcher realpath/version/build/socket, complete
resident client/launcher/process inventory, and ordered owner/episode/ordinary
session checkpoints. Preflight stops on a linked worktree, dirty or diverged
main, non-fast-forward candidate, bundle mismatch, unacknowledged resident
launcher, executable/build mismatch, or ambiguous rollback.

The separately authorized execute path records an intent checkpoint before each
uncertain boundary: shutdown, landing/push, user-global apply, and runtime start.
It uses exact `prime-agent shutdown --force --json`, proves zero stale process and
socket state, fast-forwards and verifies local/remote equality, calls apply then
check with a fresh live role receipt, proves zero stale launchers again, starts
one recorded daemon, validates the real Prime Agent 0.9.8 `status --json` array,
and emits only the ordered resume checklist. It never retries an uncertain push,
apply, or start.

Recovery follows the last recorded intent/confirmation:

- before shutdown request, leave the accepted generation running;
- after shutdown request, inspect status/process/socket evidence before deciding
  whether the old runtime is running;
- after confirmed shutdown, only the unchanged accepted runtime is eligible to
  restart;
- after landing request, inspect local and remote refs without retrying;
- after apply request, restore only fixed surfaces whose current state is an
  exact recorded preimage/postimage, otherwise stop for manual recovery;
- after start request, inspect status and never start a second runtime; and
- after one proven runtime, recover owner, episode, then ordinary conversation.

Bundle apply/restore proof is always performed against an explicit isolated
agent root. `restore-installed` and `restore` classify the whole fixed inventory
before any write, accept replayed preimages, reject third states with zero
partial mutation, and preserve unrelated sentinels. Real Gate A still requires
fresh operator authority and a fresh live destination-bound receipt.

## Verify runtime discovery

Candidate discovery is proved only by tier-1 Docker. After an accepted
user-global refresh from primary `main` and the coordinated restart above, use
the resumed sessions for cutover UAT; do not substitute a linked-worktree or
host candidate probe. The accepted installed generation should expose:

- native `/handoff`, `/plan`, and `/implement-spec` commands;
- structured `ralph_handoff`, `ralph_plan`,
  `prime_claw_activate_conversation_guide`,
  `prime_claw_conversation_guide_status`, `create_spec_episode`,
  `handoff_spec_episode`, and `finalize_spec_episode` tools;
- exactly one managed `PRIME_CLAW_ROLE_KERNEL_V1` block from the selected global
  AGENTS/CLAUDE context, byte-identical to the generated neutral kernel;
- no neutral-kernel copy in provider-visible user or custom messages, and no
  provider-visible bounded EPISODE identity package;
- no separate `goal-heartbeat-work-control.ts` entry or
  `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` overlay; and
- lifecycle hooks from `reviewed-plan.ts` that filter historical oversight and
  private identity records, require the exact neutral kernel for managed owner or
  EPISODE calls, and explicitly abort malformed managed context before provider
  dispatch.

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
