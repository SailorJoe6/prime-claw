# Orca and Prime Agent integration probe matrix

Status: **evidence frozen** for `prime-claw-h6w.33.1`

This document records reproducible evidence used to freeze the Orca/Prime Agent
boundary for `prime-claw-h6w.33`. It distinguishes installed-build contracts,
runtime observations, and unproven design assumptions. Production lifecycle
implementation is out of scope for this ticket.

All discovery rows now have a passed contract, an explicit product constraint,
or a disabled capability. There are no remaining implementation-defining
assumptions in this matrix.

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

The installed Orca guide advertises `pi` as a known TUI-agent ID. It is not the
Prime Agent provider ID. The live negative probe below confirmed that `pi` tries
to execute a separate `pi` binary. Orca's scheduled-task metadata and native
provider registry instead identify Prime Agent as `prime-agent`.

## Matrix

| ID | Contract | Status | Current conclusion |
|---|---|---|---|
| L1 | Exact repo lookup by path | PASS | `orca repo show --repo path:<absolute-root> --json` returns one stable repo ID. |
| L2 | No-parent worktree creation and identity | PASS | Create returned full worktree ID, `identity.key`, instance ID, host/setup IDs, exact path, branch, head, base ref, `parentWorktreeId: null`, and terminal handle. |
| L3 | Built-in `--agent pi --prompt` | PASS / negative distinction | The launcher tried a separate missing `pi` executable. `pi` is not Orca's Prime Agent provider ID and must not be used for Prime Claw. |
| L4 | `tui-idle` as sole startup proof | **FAIL** | Orca returned `satisfied: true` for the idle fallback shell after `pi` failed. A rendered-screen or process/provider check is also required. |
| L5 | Native `--agent prime-agent --prompt` | PASS / UX only | Orca created one separate linked worktree and one background Prime Agent visual tab without changing the operator's selected workspace. The combined call cannot preserve deterministic bundle promotion before execute, so it is not the final lifecycle sequence. |
| L6 | Explicit `terminal create --command prime-agent` diagnostic | PASS / not preferred | The generic terminal primitive starts Prime Agent, but it is not the desired native provider UX and its prompt receipt lacks provider-aware observation. |
| L7 | Fresh Prime Agent identity visibility | PASS | Prime Agent roster and Orca search resolved the same fresh session ID `01a12300-0f5c-72e8-9fe0-18783b414c07` and exact worktree CWD. |
| L8 | Native Conversation-to-Episode messaging | PASS | `agent_message` delivered to the idle top-level sibling and the sibling returned `NATIVE_ACK H6W33_5233F46C6B` natively. |
| L9 | Native transcript observation | CONSTRAINT | Family roster exposes status/identity, but `get_agent`/`recent_messages` could not hydrate this root sibling. Orca rendered terminal reads and search remained observable. |
| L10 | Exact local cleanup | PASS | Terminal bulk close reported one stopped/closed; terminal list was empty; exact worktree show returned `selector_not_found`; Git worktree and branch were absent; setup deletion removed the scratch repo record. |
| L11 | Prime Agent audit retention | PASS / retained | The supported cleanup removed runtime resources but retained the session JSONL at `/Users/jlanders/.prime/agent/sessions/01a12300-0f5c-72e8-9fe0-18783b414c07.jsonl`. No supported session-delete contract was assumed. |
| L12 | Prompt-free launch plus native first assignment | PASS | A fresh `prime-agent` terminal appeared as the only exact-CWD sibling before any prompt; native `agent_message` delivered the first assignment and returned `NATIVE_FIRST_ACK H6W33_NATIVE_D42A9D76`. |
| L13 | Prepared existing worktree → transient disabled automation → reusable Prime Agent session | PASS | After deterministic worktree mutation and commit, a disabled existing-workspace automation with `provider: prime-agent` and `reuseSession: true` admitted the assignment, retained the visible idle tab, and could be removed without stopping or removing that tab. |
| R1 | Orca/Prime Agent resume across Orca restart | PASS / contract | Orca handles are runtime-scoped and must be re-listed; path-scoped search returns the durable session file/resume command. No live shared-runtime restart is required for the design. |
| R2 | Prime Agent daemon restart/recovery | PASS / contract | Version-matched source/tests preserve durable session ID/file across reopen while routing ID may change; recovery refreshes `activeSessionId`. |
| H1 | Project host/setup picker records | PASS | Ready setup rows, routing environment, stable setup ID, labels, one-vs-many gate, cancellation, and noninteractive behavior are frozen. |
| H2 | Remote worktree plus exact bundle transport | DISABLED | Prime Claw has no ready remote setup, and Orca 1.4.223 exposes no exact local-bundle/patch/file transport into a remote worktree. |
| B1 | Branch selection and naming | PASS / surface distinction | Orca's GUI supports generated names, explicit `branchNameOverride`, new-branch creation, and existing-branch reuse. The installed RPC contract carries `branchNameOverride`; the 1.4.223 CLI wrapper does not expose it. Automated v1 records the CLI-created branch instead of misclassifying this as an Orca product limitation. |
| A1 | Orca automations/orchestration boundary | PASS | A short-lived disabled automation is the supported CLI seam for native-provider launch in an already-prepared worktree. It is removed after successful admission; later Episode supervision uses Prime Agent messaging and never adds Orca Run/Task/Dispatch. |
| D1 | Existing-file versus upstream-template review UX | PASS / explicit user gate | First explain that review will temporarily change the file and foreground its Orca worktree, then wait for the user to say they are ready; cancellation before readiness changes nothing. After approval, hold the overwrite while the focused diff is reviewed, then restore on completion/cancel/error and verify clean. A tab-open receipt is insufficient. Never invoke OS GUI-control/Accessibility APIs for this flow without separate explicit approval. Refuse dirty/non-restorable paths; preserve ambiguous interruption; `git diff --no-index` remains fallback. |
| S1 | Prepared bundle before Episode assignment | PASS / runtime and source | Create the worktree without an agent, deterministically promote and commit the approved bundle, then launch the native provider through a disabled existing-workspace automation. The live agent read state committed before launch; Prime Agent also awaits `session_start` handlers before its first model turn. |
| C1 | `session_compact` oversight reinjection | PASS / design | Post-compaction hook ordering is proven. The target appends one non-turn full-guide message per actual qualifying compact event; no receipt, consumed state, replay redaction, or duplicate-event protocol. |
| F1 | Safe local fallback failure classes | PASS / design | Fallback is limited to definite pre-mutation local Orca unavailability. Any created/ambiguous Orca resource stays Orca-owned and is reconciled by exact identities; never create a duplicate direct fallback. |

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

## Native Prime Agent provider and background-session UX

The operator identified that Orca scheduled tasks already create visible Prime
Agent sessions. Read-only `orca automations list --json` receipts confirmed that
those tasks use `agentId: "prime-agent"`, not `pi`. The installed automation
contract describes Orca prompts run by a chosen provider in a selected existing
workspace or new-per-run worktree.

Two isolated native-provider probes then ran:

```text
orca worktree create \
  --repo path:/Users/jlanders/code/prime-claw \
  --name <unique-name> --no-parent \
  --agent prime-agent \
  --prompt '<unique harmless assignment>' \
  --json
```

The first probe also passed `--activate`. It proved the provider contract but
switched the operator's current Orca view to the new workspace. Removing that
fixture caused Orca to fall back to `main`. This is not the accepted Episode UX;
Prime Claw must never add `--activate` for background Episode creation.

The second probe deliberately omitted `--activate`. Orca returned:

- a distinct linked worktree at
  `/Users/jlanders/code/prime-claw/prime-claw-background-session-probe-011734`;
- branch `refs/heads/JLanders/prime-claw-background-session-probe-011734`;
- `createdWithAgent: "prime-agent"` and `startupAgent: "prime-agent"`;
- one startup terminal, one tab, one pane, and `surface: "background"`;
- terminal metadata with `agentIdentity: "prime-agent"`;
- a visual layout whose active tab was titled from the assignment.

The rendered session showed Prime Agent 0.9.8 at the exact worktree CWD and
completed the assignment with:

```text
PRIME_CLAW_BACKGROUND_READY
```

Fresh path-scoped Orca search resolved durable Prime Agent session
`01a12363-25e1-72de-b560-30f0832e1501`, its retained JSONL, exact CWD, and
resume command. The operator simultaneously confirmed that `main` remained
selected and that the new worktree/session appeared separately in Orca:
"That worked perfectly." This is the accepted Episode creation UX.

Cleanup stopped and closed the single fixture-owned terminal, removed the exact
Orca worktree and Git branch, and verified the path and selector were absent.
The JSONL remains as audit evidence at
`/Users/jlanders/.prime/agent/sessions/01a12363-25e1-72de-b560-30f0832e1501.jsonl`.

That direct combined call proves the desired background UX, but the final EXPERT
review found that it starts the assignment before Prime Claw can promote an
approved future-plan bundle into active `.ralph/plans`. A provisioning record
does not put uncommitted approved content into the new checkout.

### Promotion-before-launch and transient automation probe

The final sequence probe preserved both requirements:

1. `orca worktree create` created the background worktree without an agent or
   prompt.
2. The deterministic tool wrote and committed a marker standing in for the
   exact approved-bundle promotion.
3. Prime Claw created a disabled, existing-workspace Orca automation with
   `provider: prime-agent`, `reuseSession: true`, and the fixed assignment.
4. `orca automations run` admitted the assignment manually.

The first run returned `PROMOTION_PRECEDES_PROVIDER_READY`, proving the native
provider read state committed before its launch. A second reusable-session run
returned `PERSISTENT_PROMOTION_SESSION_READY` and left one connected visual
terminal with `agentIdentity: "prime-agent"` after the run completed.

A final independent fixture proved that this automation can be only a launch
shim. After `TRANSIENT_LAUNCHER_READY`, `orca automations remove` deleted the
disabled automation and its run history while the same Prime Agent terminal,
tab, pane, and visual layout remained connected and writable. Later supervision
therefore needs no automation: retain the durable Prime Agent session and Orca
worktree/tab identities and use native `agent_message`.

The automation is disabled before its manual run, so it can never fire on its
placeholder schedule. If creation, dispatch, or removal is uncertain, preserve
and reconcile the exact automation, run, worktree, terminal, and durable session
identities; do not create another workspace or assignment. Promotion failure
occurs before provider launch and therefore admits no execute turn.

## Earlier prompt-free assignment diagnostic

A second earlier isolated fixture tested a prompt-free sequence before the
native `prime-agent` provider path was identified:

```text
orca worktree create --repo id:<repo-id> --name <unique-name> \
  --no-parent --setup skip --json
orca terminal create --worktree id:<repo-id>::<worktree-path> \
  --title <title> --command prime-agent --json
orca terminal wait --terminal <handle> --for tui-idle --timeout-ms 90000 --json
orca terminal read --terminal <handle> --screen --json
```

The rendered screen showed Prime Agent 0.9.8, an empty prompt, and the exact
worktree CWD. Before any prompt, `agent_observe.list_agents()` returned exactly
one sibling at that CWD:

- durable session ID: `01a1234d-99d6-7175-a3ed-bdb4250a81c9`;
- routing ID: `3531180990ee`;
- status: idle;
- runtime kind: top-level.

The Conversation then used native `agent_message` as the session's first
assignment. Delivery returned `delivered`, the Episode replied natively, and
both this Conversation and the Orca rendered terminal observed:

```text
NATIVE_FIRST_ACK H6W33_NATIVE_D42A9D76
```

A fresh, path-scoped Orca search resolved the same durable session ID, exact
CWD, retained JSONL, and resume command. This proves that a prompt-free Prime
Agent process is a native messageable root sibling before any assignment. It
remains useful recovery evidence, but it is not the preferred creation UX now
that Orca's native `prime-agent` provider path is proven. Native
`agent_message` still owns later Conversation/Episode supervision after Orca
admits the initial assignment.

Cleanup closed and stopped both fixture-owned terminal surfaces, verified an
empty exact-worktree terminal list, removed the worktree and branch, deleted
the scratch setup/repo, and removed the scratch filesystem. The Prime Agent
JSONL is retained as an audit artifact at `/Users/jlanders/.prime/agent/sessions/01a1234d-99d6-7175-a3ed-bdb4250a81c9.jsonl`
(24793 bytes at cleanup).

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
- The daemon `prompt` command binds the exact active session, calls
  `promptUntilAccepted`, and sends success only after successful preflight
  admission; `queueIfBusy:false` rejects rather than silently queues. A lost
  response remains uncertain and must not be blindly retried
  (`packages/coding-agent/src/modes/daemon/daemon-mode.ts:4465-4560`).

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

### Branch capability correction

The operator correctly reported that Orca's GUI offers generated branch names,
a `Branch name` field, `Create new branch`, and `Reuse branch`. Exact installed
1.4.223 package inspection confirmed `branchNameOverride` in
`out/shared/rpc-contract/worktree-create-params.js` and in the renderer creation
flow. `orca worktree create --help` and `orca agent-context --json` omit that
field from the CLI surface.

The design must therefore distinguish capabilities accurately: Orca supports
branch choice, but the current supported automation CLI cannot request the GUI's
explicit override or reuse mode. Prime Claw v1 records the branch returned by
the CLI. It may expose explicit custom/reused branch selection later when Orca
adds a supported non-GUI surface; it must not call private renderer code or claim
that Orca as a product owns the branch name.

## Startup, compaction, and fallback contract

Prime Agent 0.9.8 awaits `session_start` handlers serially during extension
binding. Interactive startup prompt delivery occurs only after binding. The
target initializer therefore performs deterministic file reconciliation inside
an awaited startup handler and never starts a model turn. Conflict or degraded
results are reported in the same session; automatic startup does not attempt to
turn extension failure into a second approval or recovery protocol.

The selected Episode launch uses Orca's native provider while preserving
promotion and startup ordering:

1. persist a provisioning ownership record for the exact approved folder,
   project-host setup, base ref, and one creation operation before mutation;
2. create the Orca worktree with no agent, prompt, or `--activate`; record the
   returned identity, path, generated branch, and head;
3. deterministically overlay the exact approved folder, promote it into active
   `.ralph/plans`, verify the canonical checkout is unchanged, and commit the
   promotion in the Episode worktree;
4. create a disabled existing-workspace automation with `provider: prime-agent`,
   `reuseSession: true`, and the one fixed execute assignment, then run it
   manually;
5. require successful assignment admission, a connected background visual tab,
   positive rendered readiness at the exact CWD, and exactly one new durable
   root session; persist its session/file and current route;
6. remove the disabled launch automation after successful binding; prove that
   the Prime Agent tab remains connected; transition ownership to active; and
   use native `agent_message` for every later supervision turn.

Prime Agent awaits `session_start` handlers before interactive prompt processing,
so deterministic project reconciliation also completes before the first model
turn. Promotion itself occurs before provider launch and does not depend on the
model. Promotion failure admits no assignment. Any ambiguous worktree,
automation, run, prompt, or removal result is reconciled against the provisioning
record and exact Orca/session identities; it is never retried as a new create or
new assignment. A retained disabled automation is recoverable launch residue,
not a scheduler for Episode continuation.

Prime Agent saves a compaction entry and rebuilds session messages before it
awaits `session_compact`. For each actual qualifying compact event, the target
handler sends one full oversight-guide custom message with `triggerTurn:false`.
That message is a durable post-compaction instruction in the transcript; it is
not a one-provider-call context transform. Ordinary, Episode, foreign-owner,
and no-owner sessions receive none. A later distinct compaction gets one new
message.

This design deliberately does **not** add a hash gate, activation/readiness
receipt, pending/consumed state, replay redaction, or synthetic duplicate-event
journal. Prime Agent emits one post hook for one saved compaction. Candidate
acceptance tests must prove one message per distinct qualifying compaction and
zero for non-qualifying sessions, but must not invent a duplicate-delivery
failure mode unsupported by the runtime contract.

Local fallback is allowed only when Orca is definitely unavailable before any
external mutation, such as missing CLI/runtime or a definitive pre-create
readiness failure. Once worktree creation is admitted, succeeds, or has an
ambiguous transport result, the operation remains Orca-owned. Reconcile by
exact project setup, full worktree ID/path/identity, branch/head, and terminal
list. A terminal-launch failure is recovered inside that worktree or surfaced;
it never triggers a second direct-Git creation. Contact loss or partial host
inventory preserves uncertainty and resources. Prime Claw records Orca's
returned branch instead of enforcing the legacy `episode/<slug>` name; direct
fallback likewise records its actual branch rather than leaking an engine-specific
naming invariant into ownership.

Restart recovery uses durable identities rather than disruptive discovery
restarts: re-enumerate the Orca worktree by identity/path, re-list runtime-scoped
terminal handles, find/resume Prime Agent by durable session ID/file, and refresh
`activeSessionId`. Installed Orca and Prime Agent contracts cover these steps;
shared daemons do not need to be restarted merely to prove the design.

## Placement and transport contract

Read-only inventory found exactly one ready Prime Claw project setup: the local
Git checkout. A paired remote Orca runtime is reachable, but it has no Prime
Claw project setup. Machine names, runtime IDs, and endpoints are intentionally
omitted from this checked-in evidence; the product reads them live for labels
and routing.

Prime Claw must enumerate `setupState == ready` rows across local and paired
runtimes and retain each row's routing environment. It must not delegate
ambiguity handling to `orca worktree create --project`: installed Orca 1.4.223
selects the first candidate when no host is supplied.

Selection contract:

1. Zero ready rows: no creation; report setup readiness.
2. One ready row: select it without prompting.
3. Multiple ready rows: show the native picker. Cancellation creates nothing.
   A noninteractive caller must provide the stable bypass or fail.
4. Picker labels combine project display name, environment/machine label,
   platform when available, and path. These are display-only values.
5. The stable selection is the project-host-setup `id`. Prime Claw's accepted
   `--host id:<setup-id>` syntax maps internally to Orca
   `--project-host-setup <setup-id>` plus the exact remote runtime route when
   applicable.

Orca worktree creation accepts a Git base ref and prompt but no patch, bundle,
source-worktree snapshot, file copy, or file upload. Setup clone/import
provisions a checkout; it does not transport a selected local specification
bundle. A remote worktree can start only from Git state already available to
that remote setup. Prompt prose naming paths is not exact bundle transport.
Therefore remote Episode placement is disabled in v1. Enabling it later needs a
separately approved transport contract and end-to-end native session evidence;
it is not an implementation choice left to `.33.3`.

## Frozen responsibility boundary

| Owner | Prime Claw use |
|---|---|
| Orca worktrees and terminals | Git checkout placement, local/remote execution host, PTY/process hosting, rendered observation, human ADE tabs, exact workspace cleanup/reconciliation. |
| Orca search | Host-scoped session discovery and durable Prime Agent session-file/resume evidence. It is not a cross-host identity registry. |
| Orca orchestration | Reserved for explicit supervised worker DAGs, inboxes, gates, and settlement. Prime Claw's normal one-Conversation/one-Episode lifecycle does not create a Run/Task/Dispatch layer. |
| Orca automations | User schedules plus one narrow lifecycle exception: a disabled, manually-run, existing-workspace automation launches the native reusable Prime Agent session after promotion, then is removed. It never drives continuation or replaces Prime Agent heartbeats. |
| Prime Agent fresh session | Durable agent transcript/context, kernel, queue, native schedules, and session identity inside the Orca-hosted process. |
| Prime Agent `agent_message`/`agent_observe` | Direct Conversation↔Episode sibling messaging and roster state. Delivery is not completion; direct root-sibling transcript hydration is not relied on. |
| Prime Agent RLM | Recursive in-session delegation only. It does not provide Git/worktree isolation. |
| Prime Agent goals/heartbeats | Agent-owned progress/wakeup inside a session. They are not schedulers for workspace lifecycle. |
| Prime Claw deterministic tools | Exact-folder approval binding, semantic-to-mechanical transition, ownership record, safe retries/reconciliation, and operator-bounded final bookkeeping. They do not duplicate Orca state or general orchestration. |

### Review UX constraint

Orca 1.4.223 exposes only source-control-oriented file review:

```text
orca file diff <path> [--staged] [--worktree <selector>] [--focus] [--json]
orca file open-changed [--mode edit|diff|both] [--worktree <selector>] [--focus] [--json]
```

It has no arbitrary two-file, external-path, or alternate-base compare command.
The accepted normal workflow uses Git's existing committed customized version as
the restore source and treats operator review as a bounded live state:

1. tell the user that the review will temporarily replace the tracked file and
   foreground its Orca worktree; wait for an explicit ready response, and make
   no mutation or focus change if the user cancels;
2. after readiness, require the target to be a clean tracked regular file with
   no staged or unstaged changes;
3. temporarily write the upstream template into that same worktree path;
4. call `orca file diff <path> --worktree <exact-selector> --focus`; the user's
   confirmation that the comparison is visible is the readiness proof, while an
   `opened: true` receipt alone is insufficient;
5. keep the temporary overwrite unchanged while the operator reviews; do not
   restore merely because the open command returned;
6. wait for the operator to explicitly complete or cancel review; and
7. in finally-equivalent cleanup run `git restore --worktree -- <path>`, then
   verify both the worktree and index are clean for that path. This workflow
   uses Orca's supported file command and conversational confirmation only; it
   must not invoke macOS Accessibility, Orca Computer Use, or another OS GUI
   control surface without a separate explicit user request.

The corrected lifetime fixture was
`prime-claw-template-review-lifetime-0150`, worktree identity
`wt2:local:8fa4e493-4152-42f7-a97b-0c15406c103c`, prepared commit `bcc5974`.
A focused Orca view visibly rendered
`CUSTOMIZED_COMMITTED_VERSION` versus `UPSTREAM_TEMPLATE_VERSION` while a
separate check returned `REVIEW_DIFF_STILL_HELD`; only after that observation
did completion cleanup return `REVIEW_COMPLETE_RESTORED_CLEAN`. The same
fixture returned `REVIEW_CANCELLED_RESTORED_CLEAN` for cancellation and
`REVIEW_ERROR_RESTORED_CLEAN` after an injected selector failure. Its guard
accepted the clean tracked regular file but rejected a pre-dirty tracked file
and a tracked symlink. The worktree, terminal, path, and fixture branch were
then removed.

The probe also exposed a UX/safety defect in its own procedure. `--focus`
foregrounded the disposable worktree without advance notice, and an attempted
`orca computer get-app-state --restore-window` observation triggered a macOS
Accessibility-control permission prompt. The operator rejected both surprises.
The product contract therefore requires the readiness gate above and forbids
Computer Use or OS accessibility control in this flow without separate explicit
approval. The runtime probe did not grant that permission, and cleanup confirmed
that no disposable worktree, terminal, path, or branch remained.

No byte backup, staging, or commit is needed. If the file is already dirty,
untracked, a symlink, or otherwise not safely restorable from Git, refuse this
workflow. `git diff --no-index` remains an honest terminal fallback when a
two-file comparison is still useful. An interruption can leave the known
upstream template as an ordinary visible working-tree change. Recovery must not
auto-restore or overwrite uncertain later edits: preserve the path, report the
suspected interrupted review, show the committed customized version and current
content, and require an explicit restore/keep decision. The fixture detected
this state as `INTERRUPTED_REVIEW_DETECTED_PRESERVE_AND_REQUIRE_DECISION`, then
proved an explicit restore returned `INTERRUPTED_REVIEW_MANUALLY_RESTORED_CLEAN`.

## Independent final review

The first independent read-only EXPERT review used
`openai-codex/gpt-6-astra` at maximum reasoning against the earlier candidate.
After the operator corrected the launcher and GUI behavior, a second review
found two material conflicts: the combined create-and-prompt path ran execute
before deterministic bundle promotion, and parent design §27 still prescribed a
superseded ordinary-daemon first assignment. The promotion-before-launch
transient-automation proof and the corrected single provider-admission contract
address those findings. The final review found one remaining lifetime gap: the
first diff fixture restored before proving lazy-loaded content remained visible.
The focused lifetime fixture and explicit user-ready/complete/cancel gate above
resolve it. No other material in-contract finding remained, so this matrix is
frozen for implementation.

## Current design impact

1. Create the Orca worktree without an agent, prompt, or activation; promote
   and commit the exact approved bundle; then use one disabled, manually-run,
   reusable existing-workspace automation to launch `prime-agent` and admit the
   fixed assignment. Remove the automation after binding without stopping the
   visible background session.
2. Store durable Prime Agent session ID/file and Orca worktree identity. Treat
   terminal handles and `activeSessionId` as refreshable routes.
3. Use Orca terminal/search observation alongside Prime Agent roster and native
   messaging; do not depend on direct root-sibling transcript hydration.
4. Disable remote Episode placement in v1. There is no ready remote Prime Claw
   setup or exact approved-bundle transport contract.
5. Keep later Episode supervision on native Prime Agent messaging plus
   goals/heartbeats. Do not add Orca orchestration or retain an automation after
   native session launch succeeds.
6. Before any template overwrite or foreground switch, explain the visible
   effect and wait for the user to say they are ready. Then review a clean
   tracked customized template through the focused Orca working-tree diff,
   hold it until explicit completion/cancel, and verify `git restore`. Use no
   OS GUI-control/Accessibility API without separate approval; retain
   `git diff --no-index` only as a terminal fallback.
7. Record the CLI-generated branch while accurately documenting that Orca's GUI
   and internal RPC support explicit branch override/reuse that the current CLI
   does not expose.
8. Implement startup reconcile as an awaited no-turn handler and compaction
   reinjection as one durable non-turn guide message per qualifying compaction,
   without authorization hashes, receipts, consumed state, or replay redaction.
9. Permit direct local fallback only for definitive pre-mutation Orca
   unavailability. Preserve and reconcile every admitted or ambiguous Orca
   mutation instead of creating a duplicate workspace.
