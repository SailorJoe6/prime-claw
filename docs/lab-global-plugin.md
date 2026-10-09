# Lab-global prime-claw plugin

> Scope: supported user-global installation for the builder/lab runtime. The
> final sandbox uses the same environment-global placement inside its isolated
> home. Deployment follows the staged transition and restart gate below.

## Source and installed layouts

The builder source is deliberately inert. The final generation has one authored
role kernel, one machine-readable final selector, ten managed TypeScript files,
and three exact managed global skill capabilities:

```text
src/prime-agent-plugin/
  ROLE_KERNEL.md
  role-protocol.json              # schema 1, generation=final
  extensions/
    goal-continuation-nudge.ts
    handoff-chain.ts
    reviewed-plan.ts
  extension-support/
    conversation-guide-metadata.ts
    conversation-oversight.ts
    episode-close.ts
    handoff-prompts.ts
    prep-chain.ts
    reviewed-plan-support.ts
    spec-episode.ts
  skills/
    goals-and-heartbeats/          # managed SKILL + continuation policy
    prime-claw-oversee-episode/SKILL.md
    prime-claw-expert-review/SKILL.md
```

`ROLE_KERNEL.md` is the only role-kernel policy source. The role-protocol
installer reads it directly when managing the selected global context block;
there is no generated TypeScript copy or runtime prompt-byte authentication. The
managed global Conversation and EXPERT skills are the plugin-managed
role-specific judgment sources. The goals-and-heartbeats `SKILL.md` and
`CONTINUATION.md` form one managed user-global capability bundle; the
continuation hook loads its reminder from that bundle. The legacy APPEND source, project forwarding skill/link,
standalone reviewer profile, and append-only manager are absent.

The installed copy keeps the TypeScript layout under `~/.prime/agent/`. Prime
Agent auto-discovers the three extension entry points; their relative imports
resolve through the seven installed `extension-support/` files. Do not keep
plugin source or a second copy under this repository's or a managed project's
`.prime/agent/extensions/` path. Cross-scope duplicate discovery can prevent
startup. The durable source belongs under `src/prime-agent-plugin/`.

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

   Final mode intentionally cannot initialize a fresh script-only root: it
   requires an exact owned bridge manifest. Tests that need an isolated direct
   apply seed that predecessor state from the clearly labeled historical
   fixtures before invoking the scripts. Use the Tier 1 driver instead of
   reproducing that test-only setup by hand.

2. **Accepted user-global activation:** do not run apply/check directly. After
   the exact final candidate is accepted and the operator separately authorizes
   Gate B, launch the bounded coordinator from a separate terminal with the
   verified private accepted-bridge bundle, exact operation input, and a private
   mode-0700 state directory:

   ```bash
   python3 scripts/coordinate-prime-agent-role-cutover.py \
     --config /private/path/gate-b-operation.json \
     --state-dir /private/path/gate-b-state \
     --execute --authorization <full-accepted-commit>
   ```

   The coordinator quiesces the old generation, fast-forwards the primary
   `main`, runs user-global apply/check there, records the final installation
   receipt, restarts once, and emits the bounded resume checklist. The direct
   `--user-global` scripts remain guarded implementation details: they refuse
   linked worktrees, non-`main` branches, and explicit host-root overrides.

Apply copies only the allowlisted plugin support files and exact managed skill inventories. Before the first copy,
`scripts/manage-prime-agent-role-protocol.py` selects exactly one global context
candidate in Prime Agent priority order: `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`,
then `CLAUDE.MD`. It creates `AGENTS.md` only when none exists. The manager owns
only its distinct `prime-claw:role-kernel` marker region and introduced
separators. It preserves unrelated bytes, LF/CRLF style, final-newline state,
mode, uid, and gid. It records the selected path and ownership in mode-0600
`$agentDir/.prime-claw/role-protocol-state.json`.

Selection drift, a latent block in an unselected candidate, malformed or
unowned markers, unsafe files/directories, fails closed before plugin copy. Apply and check do not migrate a selected file
implicitly. The checked-in `role-protocol.json` is final. Final apply requires
an exact owned bridge or final manifest, verifies the installed managed block
against that ownership record, and replaces only that block with the checked-in
`ROLE_KERNEL.md`. This permits an accepted Markdown policy refresh without
adopting an unowned block. A bridge-to-final apply also removes only the recorded
legacy APPEND region plus Prime Claw-owned separators. The transaction updates
the ownership manifest and records a fixed-inventory receipt whose known
preimages can be restored. It never reads a legacy policy source.

Unrelated APPEND bytes and ordinary metadata are preserved. Malformed,
duplicate, unowned, reappeared, or unknown state is refused. A fresh/unowned
root is intentionally not adopted by final apply. Isolated tests seed the exact
bridge precondition from clearly labeled historical fixtures. Live user-global
final apply remains Gate B and is not performed by source reconciliation.

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

The installer owns two uniquely named role skills beside the TypeScript plugin
files: `skills/prime-claw-oversee-episode/SKILL.md` and
`skills/prime-claw-expert-review/SKILL.md`. It validates real managed `skills/`
and skill directories, leaves unrelated skill entries untouched, installs each
file at mode 0644, checks bytes exactly, and requires a final full check.

During an explicitly selected user-global cutover, apply validates and removes
the exact retired `skills/prime-claw-official-expert-review` four-file layout
and the exact `$PRIME_AGENT_CODING_AGENT_DIR/prime-claw-private/expert-review-launches`
state directory. Symlinked, escaped, wrong-type, or unexpected old skill layouts
fail before cleanup. This is narrow cleanup for the unshipped lab installation,
not a migration framework.

The EXPERT workflow is Markdown plus native Prime Agent APIs. It uses model
discovery, a harmless RLM bootstrap followed by one ordinary parent-to-child
review task, parent/child clarification messages, and normal child deletion. The
child keeps Prime Agent's normal system prompt. There is no Python package,
private reservation/admission state, packet schema, prompt replacement,
structured submission, settlement, disposition, close, or purge protocol.

The predecessor APPEND-only manager is retired. Final apply/check use the
role-protocol manager for the selected context, exact owned legacy removal, and
rollback receipts. The manager follows a trusted-local operating model: it rejects
obvious symlinks, non-regular or unreadable leaves visible during validation,
then serializes cooperating writers with one agent-root `flock`. It rereads each
ordinary byte-and-metadata preimage immediately before same-directory
`os.replace`, preserves mode/uid/gid where supported, fsyncs the new file and its
parent directory, and refuses a changed preimage.

The role kernel is shared orientation installed from `ROLE_KERNEL.md`, not a
runtime identity credential. Provider guards no longer scan, hash, or compare
its bytes. The current bounded implementation still uses its existing
Conversation-guide readiness and Episode lifecycle mechanics; those roles will
be simplified separately rather than extended during the EXPERT cleanup.

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

Final apply can capture a mode-0600 recovery receipt outside `agentDir`:

```bash
python3 scripts/manage-prime-agent-role-protocol.py apply \
  src/prime-agent-plugin/role-protocol.json \
  src/prime-agent-plugin/ROLE_KERNEL.md \
  /path/to/absent-retired-legacy-source \
  /explicit/isolated/owned-bridge-agent-dir \
  --receipt /external/private/final-transition.json

python3 scripts/manage-prime-agent-role-protocol.py restore \
  /external/private/final-transition.json \
  /explicit/isolated/owned-bridge-agent-dir
```

The legacy positional argument is retained only as the dual-mode manager ABI.
Final mode does not read it. Final mode requires the destination's exact owned
bridge manifest, derives the retired block digest and separators from that
manifest, and refuses fresh or unowned state. Docker tests create the bridge
precondition from `tests/fixtures/role-protocol-bridge.json` and the minimal
historical marker fixture
`tests/fixtures/role-protocol-legacy-append.md`; neither fixture is current
policy.

Final `check` proves the managed APPEND region is absent. Replay preserves an
already-absent APPEND file instead of recreating it. `restore` with the receipt
recreates the exact accepted bridge context, APPEND, manifest bytes, and ordinary
metadata. If any fixed-inventory path matches neither recorded preimage nor
postimage, stop and preserve the root and receipt for manual recovery.

The schema-1 receipt has a fixed inventory of exactly the selected context,
`APPEND_SYSTEM.md`, and `.prime-claw/role-protocol-state.json`. Before any restore
mutation, the manager validates the complete schema, exact paths, unique labels,
base64/digests, ordinary metadata, selected-context/manifest relationship, and
creation ownership. Every current destination must match its recorded preimage
or postimage. An unknown file, marker drift, malformed inventory, contradictory
ownership, or unrelated nominated path refuses the whole restore before
mutation.

Restore writes exact recorded bytes and ordinary metadata, and deletes a missing
preimage only at its fixed managed path from an exact known postimage. A receipt
cannot nominate an unrelated file for deletion, and a pre-existing context is
not deleted by a contradictory creation record. A partially restored set made
only of recorded states is safely repeatable. The receipt is recovery material,
not a tamper-proof attestation against the trusted local owner.

Plausible excluded hazards remain advisory hardening: parent or leaf replacement
between individual validation and mutation syscalls, same-UID receipt
substitution, hard exits at every rename/fsync boundary, and power-loss
durability. Promote one only after repeatable dogfood failure, a near miss or
user report, a changed trust boundary, or a separately approved hard requirement.

## Cutover and rollback

A successful apply/check proves installed bytes, not the loaded generation.
`/reload`, elapsed time, a fresh process, or container evidence alone is not
cutover proof. Source compatibility resources were retained through Gate A and
are now absent from the final source tree. Keep the installed bridge generation
and the verified private accepted-bridge bundle intact until the exact final
candidate is accepted and Gate B is separately authorized.

For Gate B:

1. verify the private bridge bundle, its exact rollback preimages, the accepted
   candidate commit/tree, the clean synchronized primary `main`, and the selected
   owner/episode/ordinary checkpoints;
2. let active work become idle or durably checkpointed, then launch the authorized
   coordinator once from a separate terminal;
3. let that coordinator prove quiescence, fast-forward primary `main`, run final
   user-global apply/check, retain the exact installation receipt, and perform one
   coordinated full Prime Agent daemon/harness restart;
4. resume the exact owner, exact episode, and designated ordinary conversation;
5. verify final absence, one managed lean block, zero new historical oversight
   packages, no detailed work-control overlay, and intact lifecycle authority;
   and
6. obtain operator acceptance before discarding the private bundle, rollback
   receipt, or physically cleaning retained resources.

Saved sessions are resumed, never deleted. On failure, follow the coordinator's
last proven checkpoint and use the verified private bundle or final installation
receipt to restore the exact accepted bridge preimages. Reapply/check that
known-good bridge generation and repeat the full quiesce/restart discipline only
under renewed operator authority. Do not improvise direct host apply/check or
retry an uncertain coordinator result.


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
primary `main`, expected remote ref, bundle manifest digest, ordered
owner/episode/ordinary checkpoints, and one canonical CLI entrypoint. A compiled
entrypoint is `[launcher]`; a Node entrypoint is `[interpreter, entrypoint]`.
Both realpaths and artifact digests are bound, every CLI command uses the whole
prefix, and `status --json` must report the entrypoint path, exact build, socket,
and declared old-daemon PID. The version command uses a version-only lossless capture and must return zero,
with exactly one raw stream equal to the configured version encoded as UTF-8 plus
one LF byte and the other raw stream equal to `b""`. CRLF, bare CR, no LF,
non-UTF-8 bytes, both/empty streams, whitespace, blank or extra lines, mismatch,
nonzero exit, and timeout fail closed before status, shutdown, landing, apply, or
start. General text-mode Git, status, process, and bundle commands remain
unchanged.

Process observation is bounded to exact `pgrep -x prime-agent` results and the
explicitly declared PIDs, followed by targeted `ps -p`. It never parses an
unrelated process listing. Exactly one declared old daemon and only approved old
workers may be present. Declared client, TUI, launcher, and wrapper roles must be
absent. The daemon status row is authoritative; a worker is recorded honestly by
its approved parent/entrypoint relationship because the public status API does
not publish per-worker build rows. Failed, malformed, duplicate, unknown, or
mismatched observations stop before shutdown, landing, apply, start, or the
scratch rollback proof.

Rollback input is topology, not arbitrary shell text: an ordered explicit list
of every linear commit from candidate back to the integration merge, the exact
merge and ordered parents, mainline 2, accepted prelanding commit/tree, and a
fixed commit message. Preflight resolves every commit, proves the complete
first-parent chain, and applies the generated no-commit inverses in a temporary
`git clone --no-local`. The resulting tree must equal the accepted prelanding
tree. Placeholder ranges, omitted/wrong commits, wrong mainline, reset, rebase,
force-push, and automatic live compensation are not representable or accepted.

The separately authorized execute path records an intent checkpoint before each
uncertain boundary: shutdown, landing/push, user-global apply, and runtime start.
It uses exact `prime-agent shutdown --force --json`, proves zero stale process and
socket state, fast-forwards and verifies local/remote equality, calls apply then
check with a fresh live role receipt, and proves zero stale processes again. It
then starts exactly once. A deadline- and attempt-bounded loop performs only
read-only status/child observations. Empty or exact expected-socket unreachable
state may wait; wrong identity, duplicates, child exit, malformed/failed status,
or deadline stop truthfully without another start. Only one exact current row
emits the ordered resume checklist.

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
agent root. Before resolving paths, the helper uses `lstat` on the originally
supplied context, destination, bundle root, real inventory roots, and every fixed
managed parent/leaf component. Visible or dangling links and nonregular leaves
fail closed; it does not add descriptor-chain, ABA, or hostile-race machinery.
`restore-installed` and `restore` classify the whole fixed inventory before any
write, reject third states with zero partial mutation, and preserve unrelated
sentinels. Restored equality includes bytes plus ordinary mode/uid/gid. Equal
bytes with metadata drift trigger metadata repair or failure; only complete
bytes-and-metadata replay reports `alreadyRestored`. Real Gate A still requires
fresh operator authority and a fresh live destination-bound receipt.

## Verify runtime discovery

Candidate discovery is proved only by Tier 1 Docker. After the separately
authorized Gate B coordinator has run final apply/check from primary `main` and
performed the coordinated restart above, use the resumed sessions for cutover
UAT; do not substitute a linked-worktree or host candidate probe. The accepted
installed generation should expose:

- native `/handoff`, `/plan`, and `/implement-spec` commands;
- structured `ralph_handoff`, `ralph_plan`,
  `prime_claw_activate_conversation_guide`,
  `prime_claw_conversation_guide_status`, `create_spec_episode`,
  `handoff_spec_episode`, and `finalize_spec_episode` tools;
- exactly one managed `PRIME_CLAW_ROLE_KERNEL_V1` block from the selected global
  AGENTS/CLAUDE context, sourced directly from `ROLE_KERNEL.md`;
- no neutral-kernel copy in provider-visible user or custom messages, and no
  provider-visible bounded EPISODE identity package;
- no retired `goal-heartbeat-work-control.ts` entry or
  `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` overlay;
- the narrow `goal-continuation-nudge.ts` context hook, which reads the managed
  `skills/goals-and-heartbeats/CONTINUATION.md` plugin asset and contains no
  model-facing work-control prose of its own; and
- lifecycle hooks from `reviewed-plan.ts` that filter historical oversight and
  private identity records and explicitly abort malformed lifecycle context
  before provider dispatch; they do not authenticate role-kernel prompt bytes.

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
