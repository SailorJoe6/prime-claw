# Orca and Prime Agent integration probe matrix

Status: **in progress** for `prime-claw-h6w.33.1`

This document records reproducible evidence used to freeze the Orca/Prime Agent
boundary for `prime-claw-h6w.33`. It distinguishes installed-build contracts,
runtime observations, and unproven design assumptions. Production lifecycle
implementation is out of scope for this ticket.

## Safety boundary

- Prime Agent is an upstream, read-only investigation surface.
- Probes use fixture-owned Git repositories, Orca setups, worktrees, terminals,
  and unique tokens. They do not modify existing project metadata.
- No daemon restart, configuration mutation, credential access, global plugin
  refresh, or remote transport occurs without separate authority.
- Ambiguous create/remove results are reconciled by exact identity; they are
  never retried blindly.

## Tested versions and authority

| Surface | Observed version | Evidence authority | Result |
|---|---:|---|---|
| Orca CLI/runtime | `1.4.223` | `orca --version`, `orca skills get orca-cli --json`, command `--help`, runtime receipts | authoritative for installed behavior |
| Local Orca source checkout | `v1.4.219` at `e705cac04a1db7e7e2184746e912142d34ca838b` | clean detached checkout | **not** version-matched; do not use as 1.4.223 source-line proof |
| Prime Agent TUI | `0.9.8` | rendered Orca terminal screen | authoritative for probe runtime |
| Prime Agent source | `0.9.8`, build `cwd-fix-v0.9.8-r1`, commit `a1faacd53ac4473a75de1d434afaf50945c2f647` | clean checkout pinned by the installed guard shim | version-matched source authority |

The installed Orca guide advertises `pi` as a known `--agent` ID, but the live
launcher test below failed because it invoked a missing executable named `pi`.
Runtime evidence therefore overrides the advertised capability for this host.

## Matrix

| ID | Contract | Status | Current conclusion |
|---|---|---|---|
| L1 | Exact repo lookup by path | PASS | `orca repo show --repo path:<absolute-root> --json` returns one stable repo ID. |
| L2 | No-parent worktree creation and identity | PASS | Create returned full worktree ID, `identity.key`, instance ID, host/setup IDs, exact path, branch, head, base ref, `parentWorktreeId: null`, and terminal handle. |
| L3 | Built-in `--agent pi --prompt` | **FAIL** | Worktree creation succeeded, but its terminal printed `zsh: command not found: pi`; no Prime Agent session or prompt admission occurred. |
| L4 | `tui-idle` as sole startup proof | **FAIL** | Orca returned `satisfied: true` for the idle fallback shell after `pi` failed. A rendered-screen or process/provider check is also required. |
| L5 | Explicit `terminal create --command prime-agent` | PASS | Prime Agent 0.9.8 started in the exact worktree and rendered a ready prompt with the correct CWD. |
| L6 | Orca terminal prompt admission | PARTIAL | `terminal send` returned `accepted: true` and `input_accepted`, but provider/observation were `unsupported`; rendered output proved the turn and exact response. |
| L7 | Fresh Prime Agent identity visibility | PASS | Prime Agent roster and Orca search resolved the same fresh session ID `01a12300-0f5c-72e8-9fe0-18783b414c07` and exact worktree CWD. |
| L8 | Native Conversation-to-Episode messaging | PASS | `agent_message` delivered to the idle top-level sibling and the sibling returned `NATIVE_ACK H6W33_5233F46C6B` natively. |
| L9 | Native transcript observation | PARTIAL | Family roster exposes status/identity, but `get_agent`/`recent_messages` could not hydrate this root sibling. Orca rendered terminal reads and search remained observable. |
| L10 | Exact local cleanup | PASS | Terminal bulk close reported one stopped/closed; terminal list was empty; exact worktree show returned `selector_not_found`; Git worktree and branch were absent; setup deletion removed the scratch repo record. |
| L11 | Prime Agent audit retention | PASS / retained | The supported cleanup removed runtime resources but retained the session JSONL at `/Users/jlanders/.prime/agent/sessions/01a12300-0f5c-72e8-9fe0-18783b414c07.jsonl`. No supported session-delete contract was assumed. |
| R1 | Orca/Prime Agent resume across Orca restart | PENDING | Requires a separately bounded probe; no daemon restart was authorized in this slice. |
| R2 | Prime Agent daemon restart/recovery | PARTIAL | Source/tests prove durable session ID across worker reopen and require refreshed routing identity; live daemon restart still needs explicit authority. |
| H1 | Project host/setup picker records | PENDING | Read-only inventory exists; stable-label and ambiguity matrix still needs documentation. |
| H2 | Remote worktree plus exact bundle transport | PENDING | Remote placement remains disabled until end-to-end transport and observation/messaging pass. |
| A1 | Orca automations/orchestration boundary | PENDING | Static and runtime responsibility matrix remains to be completed. |
| D1 | Existing-file versus upstream-template review UX | PENDING | Git working/staged diff is documented; arbitrary external-template comparison remains unproven. |
| S1 | `session_start` reconcile before Orca initial prompt | PARTIAL | Source proves awaited startup handlers before daemon create returns, but not lossless ordering when a handler starts an asynchronous turn; built-in Pi launcher cannot exercise the target path. |
| C1 | `session_compact` exactly-once oversight reinjection | PARTIAL | Source proves post-compaction hook ordering after the saved entry/message rebuild; exact next-context visibility and idempotence still need isolated plugin probes. |
| F1 | Safe local fallback failure classes | PARTIAL | Definite pre-session `pi` launcher failure is observable; create/remove transport ambiguity and partial mutation cases remain. |

## Local probe L1–L11

### Fixture

- Token: `H6W33_5233F46C6B`
- Scratch source commit: `82f0c2e8926bb99505eb49a1473622034783c4df`
- Scratch Orca repo/setup ID: `e0ce3f39-2833-4066-bb3b-151742729d48`
- Worktree ID: `e0ce3f39-2833-4066-bb3b-151742729d48::/Users/jlanders/code/source/h6w33-pi-5233f46c6b`
- Worktree identity: `wt2:local:0f1910aa-3861-44e6-b115-07772537cfd6`
- Prime Agent session: `01a12300-0f5c-72e8-9fe0-18783b414c07`
- Agent terminal: `term_2dd5f0c1-32d7-4644-88b2-51533c929224`

Representative commands (fixture paths and IDs are intentionally explicit in
recorded receipts; replace them with fresh values when reproducing):

```text
orca repo add --path <scratch-git-root> --json
orca worktree create \
  --repo id:<scratch-repo-id> \
  --name <unique-name> --no-parent --setup skip \
  --agent pi --prompt '<unique harmless prompt>' --json
orca terminal read --terminal <startup-handle> --screen --json
orca terminal wait --terminal <startup-handle> --for tui-idle --timeout-ms 90000 --json
```

Observed failure:

```text
zsh: command not found: pi
```

The wait still returned:

```json
{"condition":"tui-idle","satisfied":true,"status":"running","exitCode":null}
```

Fallback diagnostic path used to test the underlying supported terminal
primitive, not yet accepted as the final product design:

```text
orca terminal close --terminal <failed-handle> --tab --json
orca terminal create \
  --worktree id:<repo-id>::<worktree-path> \
  --title h6w33-prime-agent --command prime-agent --json
orca terminal wait --terminal <new-handle> --for tui-idle --timeout-ms 90000 --json
orca terminal read --terminal <new-handle> --screen --json
orca terminal send \
  --terminal <new-handle> --text '<unique harmless prompt>' \
  --enter --wait-submit 20 --json
```

The explicit terminal rendered Prime Agent 0.9.8, the exact worktree CWD, the
unique prompt, and:

```text
PROBE_ACK H6W33_5233F46C6B CWD=/Users/jlanders/code/source/h6w33-pi-5233f46c6b
```

The send receipt proved only input acceptance:

```json
{
  "accepted": true,
  "stages": ["input_accepted"],
  "provider": "unsupported",
  "observation": "unsupported"
}
```

Therefore Prime Claw must not equate `accepted: true` or `tui-idle` with a
started/completed Prime Agent turn. On this version, rendered terminal evidence,
native Prime Agent messaging, or another positive session observation is
required.

### Identity and messaging

`agent_observe.list_agents()` exposed the new session as a top-level sibling at
the exact worktree CWD. A native message sent to the idle session returned a
`deliveryStatus: delivered` receipt. The new session used its own
`agent_message` skill to reply to sibling `simplify prime-claw`:

```text
NATIVE_ACK H6W33_5233F46C6B
```

The reply arrived in this Conversation and was also visible on the Orca
rendered screen. A fresh path-scoped search:

```text
orca search 'H6W33_5233F46C6B' \
  --scope conversation --path '/Users/jlanders/code/source/h6w33-pi-5233f46c6b' --fresh --json
```

returned agent `prime-agent`, session `01a12300-0f5c-72e8-9fe0-18783b414c07`, the exact
CWD, the matching evidence snippet, source JSONL path, and a `prime-agent
--resume` command.

`agent_observe.get_agent` and `recent_messages` returned `Unknown active
session` for the root sibling, including around the native follow-up. Roster
visibility and bidirectional messaging are proven; direct transcript hydration
for this topology is not.

### Cleanup accounting

```text
orca terminal close --worktree id:<repo-id>::<worktree-path> --all --json
orca terminal list --worktree id:<repo-id>::<worktree-path> --json
orca worktree rm --worktree id:<repo-id>::<worktree-path> --json
orca worktree show --worktree id:<repo-id>::<worktree-path> --json
orca project setup-delete --setup <scratch-setup-id> --json
orca repo show --repo path:<scratch-git-root> --json
```

Verified final state:

- one terminal stopped and closed; exact terminal list empty;
- exact worktree selector absent;
- worktree directory absent;
- fixture Git lists only its main worktree and no probe branch;
- scratch setup/repo absent from Orca;
- scratch filesystem root removed;
- Prime Agent session JSONL intentionally retained as an audit artifact:
  `/Users/jlanders/.prime/agent/sessions/01a12300-0f5c-72e8-9fe0-18783b414c07.jsonl` (26725 bytes at cleanup).

## Version-matched Prime Agent source contracts

The installed `prime-agent` guard shim is pinned to the clean 0.9.8 checkout at
`/Users/jlanders/code/prime-agent/.worktrees/cwd-fix-v0.9.8-r1-source`.
The following are source contracts, not substitutes for the remaining runtime
probes:

- `SessionManager.create` constructs a new manager and `newSession()` gives it a
  fresh UUIDv7/path and one fresh header. It inherits no transcript
  (`packages/coding-agent/src/core/session-manager.ts:1741-1759,1806-1861,2639-2642`).
- `SessionManager.forkFrom` creates a new header with `parentSession` and copies
  every source entry except the old header and `git_state`; it deliberately
  inherits Conversation history (`session-manager.ts:2698-2760`).
- Daemon create without `sessionPath` selects the fresh primitive; create with a
  path opens that saved file (`packages/coding-agent/src/modes/daemon/daemon-mode.ts:1896-1907`).
- Daemon publication separates transient `activeSessionId` from durable
  `sessionId`/`sessionFile`, name, and CWD. Correct callers validate all fields
  (`daemon-session-list.ts:31-53,376-391`; `daemon-mode.ts:4208-4211`).
- Extension binding awaits all `session_start` handlers before create returns
  (`agent-session.ts:10461-10478`; `daemon-mode.ts:1625-1706`). This does not
  guarantee idle state: a handler can return while a turn streams. The native
  `rlm.create_session` sequence sends its ordinary prompt only after create,
  but that follow-up has no source-level lossless ordering guarantee against
  startup-triggered work (`daemon-mode.ts:2721-2803`).
- Core saves the compaction entry, rebuilds messages, then awaits
  `session_compact`, and only afterward syncs kernel state
  (`agent-session.ts:8941-8994`; `extensions/types.ts:524-531,563-568,1005-1017`).
  Prime Claw still needs an isolated proof for exact next-context visibility and
  exactly-once behavior.
- All depth-zero root sessions share sibling scope. Saved inactive roots remain
  in the family catalog, and messaging can wake them with steer/queue semantics
  (`packages/coding-agent/src/core/agent-messages.ts:229-299`; `daemon-mode.ts:5848-5918,6183-6235,6272-6353`).
  L7–L9 above confirm the relevant Orca-created runtime path.
- Reopening a saved file preserves durable `sessionId`; worker/update recovery
  can change routing IDs. Recovery must key on `sessionId` plus `sessionFile`,
  then refresh `activeSessionId` (`session-manager.ts:1767-1799,2644-2669`;
  `packages/coding-agent/test/daemon-supervisor-process.test.ts:1089-1167`; `packages/coding-agent/src/package-manager-cli.ts:1093-1116`).

Current Prime Claw instead calls `SessionManager.forkFrom`, daemon-publishes the
copied file, and queues initial handoff because preparation may already be
running (`src/prime-agent-plugin/extension-support/spec-episode.ts:558-825,920-1102`).
That is evidence about the current implementation, not the accepted target.

## Installed Orca contract notes

- Parentage and Git base are separate. `--no-parent` does not choose a base.
- Prefer `result.agentTerminalHandle`; fall back to
  `result.startupTerminal.handle`, then reconcile through exact terminal list.
- Terminal handles are runtime-scoped. After restart or a stale-handle error,
  re-list and use only the replacement handle.
- `terminal send --wait-submit` can prove `turn_started` only for supported
  providers. Ambiguous send recovery uses its returned request ID and
  `--retry-request`; never resend as a new request.
- Worktree create/remove exposes no documented idempotency key. After ambiguous
  transport, reconcile by exact full ID/path/identity and preserve uncertainty
  if a unique result cannot be proven.
- Exact workspace bulk close can report `unverifiable`; that is not proof that
  processes exited.
- `worktree rm` attempts branch deletion but retains pre-existing or unproven
  unmerged branches. Verify worktree, filesystem, and branch state separately.

## Current design impact

1. Do **not** implement the parent design by blindly calling
   `worktree create --agent pi --prompt` on this host. Installed documentation
   advertises it, but the launcher command is not installed.
2. The supported Orca terminal primitive can launch `prime-agent`, establish the
   correct CWD, and support rendered observation.
3. A fresh Prime Agent session is a native root sibling. Bidirectional native
   messaging works and supplies stronger admission evidence than Orca's current
   unsupported-provider receipt.
4. Direct Prime Agent transcript hydration of that root sibling is not proven;
   supervision must retain Orca terminal/search observation unless later probes
   establish a better supported interface.
5. No final launch design is frozen until remaining `.33.1` probes decide
   restart/resume, initial-prompt ordering, remote transport, and failure
   reconciliation.
