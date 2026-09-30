# Plugin-global goal and heartbeat work control

## Decision

Prime Claw must give every compatible agent run one transient system-level
policy that assigns useful agent action to a bounded persistent goal and assigns
an observable external wait to one exact agent-owned heartbeat. The policy is
plugin-global, not Ralph-specific. It replaces autonomous pause/resume transport
and the model-facing `pause_thread_goal` / `resume_thread_goal` tools.

Implementation targets installed Prime Agent `0.9.7`, build
`cwd-fix-v0.9.7-r1`, source commit
`c094b9eea32173d7c4dd0c0a444a332ebac8f5d8`. Prime Agent `0.9.6` is incident
history only. This episode must not patch, fork, roll back, or otherwise change
Prime Agent source.

## Provenance and rejected approach

On the earlier 0.9.6 generation, the operator observed a queued pause steer
interrupt the work that needed to establish monitoring, and later observed a
queued resume outlive its premise. Those incidents make injected native goal
commands unsafe for autonomous work control.

Commit `3f2072e3f6031f688a1dcb437da79f278df2f254` attempted a standalone native
RPC/provider-capture characterization. It remains in history but is rejected.
Its run was informative, not acceptance evidence, because it overlapped the
sole Prime Agent daemon. Do not restore or extend its provider-capture framework,
machine-readable native evidence matrix, broad version matrix, or repeated full
native suite.

## Runtime delivery contract

One inert managed extension,
`src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts`, uses the
public `before_agent_start` hook. It may return a replacement `systemPrompt` for
the current run only. It must not register a tool, send a conversation message,
write session state, or modify Prime Agent.

A compatible run has all three supported structured signals:

1. selected `ipython` capability (including Prime Agent's default selected tool
   set when the field is omitted);
2. a model-visible Python skill named `goal` with import name `goal`; and
3. a model-visible Python skill named `rlm-heartbeat` with import name
   `rlm_heartbeat`.

Missing, disabled, or mismatched capabilities produce a silent no-op before
any marker or collision validation. An incompatible run leaves the event
unchanged and emits no notification, abort, error, tool, message, or state
mutation even when its base prompt contains a work-control marker or sentinel.
Capability is evaluated per run from structured event data, never rendered
prompt prose or filesystem discovery.

For a compatible run only, the deterministic policy has sentinel
`PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1`, explicit start/end markers, and no
more than 4,000 UTF-8 bytes excluding markers and sentinel. It appears once.
Any pre-existing marker or sentinel, including partial, duplicate, or malformed
shapes, is a collision and fails closed. A project `APPEND_SYSTEM.md` cannot
suppress the later contribution.

## Ownership model

Ownership follows the next useful action:

| State | Next-action owner | Required control |
|---|---|---|
| Active work | Agent | One compatible bounded goal |
| Observable wait | Exact external operation | One bounded heartbeat for each independent wait |
| Human blocked | Operator/external authority | No person-polling heartbeat; compatible epoch ends at actionable handoff |
| Finished | Nobody | No outcome-owned goal or heartbeat |

A goal and heartbeat may overlap only during the short transfer that establishes
and verifies monitoring before goal completion, or when they own independent
work.

### Active work

For substantive multi-step work, inspect goal state and create one bounded goal
unless a compatible active goal already owns the same authorized outcome. Do
not create goals for trivial answers. Never replace, complete, or reinterpret an
incompatible pending goal merely to make room. Completed epochs are not resumed.

### Observable waits

Before yielding to an observable long-running operation:

1. retain an inspectable operation identity and output/status location;
2. create one `rlm_heartbeat` monitor with exact running, success, failure,
   staleness, cleanup, and resumable-checkpoint conditions;
3. verify its ID and recheck the operation;
4. if already terminal, delete and verify the monitor and handle the result now;
5. otherwise complete the compatible epoch goal, report the handoff, and end
   the turn.

A non-terminal heartbeat reports only meaningful change, creates no goal, and
never restarts work. Routine monitors use follow-up delivery. The first terminal
observer captures evidence, deletes and verifies the exact monitor, performs
bounded cleanup, and acts idempotently. If the requested outcome is complete it
creates no goal. If substantive work remains it creates one fresh compatible
goal before continuing. An unrelated pending goal remains untouched.

### Human blockers

For a credential, permission, physical action, product decision, or other
human-only dependency, stop only monitors that cannot produce useful evidence.
Complete a compatible current epoch at the actionable handoff. Report once the
exact blocker, external action, process state, and resumable checkpoint, then
stop. Never schedule a heartbeat merely to poll a person. After operator
confirmation, substantive work starts under a fresh compatible goal.

The model must never inject, simulate, or call native `/goal pause` or
`/goal resume` for autonomous control. Human native goal commands remain
unchanged and authoritative.

Narrower episode, expert, delegated-task, security, and credential boundaries
remain authoritative. Any goal or heartbeat control-plane failure preserves the
external identity and checkpoint and is reported without claiming success.

## Migration and installation

The source `extensions/goal-blocker-control.ts` is removed. Apply must remove its
formerly managed installed copy only after all managed destinations pass the
existing regular-file-or-absent safety preflight. Check must reject a stale old
file. Apply/check must install and compare the new extension, preserve unrelated
global extensions and unmanaged append-system bytes, remain convergent under an
isolated `PRIME_AGENT_PLUGIN_ROOT`, and leave the builder source inert.

Apply does not activate a new generation in an already loaded process, mutate
stored goal state, or purge queued old-generation inputs. After apply/check, the
episode stops before restart. The operator controls the single restart. Legacy
paused or budget-limited goals require human recovery or a fresh clean session.

## Acceptance contract

### Checkpoint 1 — one safety-first candidate

The candidate is accepted for restart review when all are true:

1. `pause_thread_goal`, `resume_thread_goal`, their extension entry, and all
   autonomous `/goal pause` / `/goal resume` message transport are absent.
2. Removal happens before the new transient extension is installed by the
   managed apply sequence.
3. Direct non-native tests cover each compatibility signal, disabled/mismatched
   skills, default selected tools, incompatible-plus-marker silent no-op,
   deterministic single-copy policy, size bound, compatible collision failure,
   project append coexistence, no event mutation, and no
   message/tool/command/notification/abort activity on incompatible runs.
4. Isolated installer tests cover obsolete regular-file removal, unsafe
   directory/symlink rejection before mutation, unrelated-file preservation,
   new allowlist parity, and stale-file check failure.
5. Static/source tests prove obsolete source/tool/transport absence and unique
   sentinel ownership.
6. The safe non-native Python suite and Node suites pass, and
   `git diff --check` passes. No standalone/native Prime Agent process is
   launched.
7. Canonical docs, active plan/spec, and Beads describe exactly these two
   checkpoints and preserve rejected `3f2072e` as history.
8. One clean replacement candidate is committed and pushed for fresh owner
   review. The duplicate intermediate EXPERT gate is removed; exactly one
   mandatory final exact-candidate EXPERT review remains after manual UAT and
   final artifact reconciliation.
9. Only after owner acceptance, managed global apply/check succeeds, but the
   loaded process is explicitly reported as old until restart.

### Checkpoint 2 — operator restart and Joe-observed UAT

After the candidate and apply/check, stop with the exact restart action and a
short checklist. In one fresh post-restart session Joe observes and records
pass/fail for:

1. old pause/resume tools are visibly absent;
2. a compatible normal session visibly moves from active-work goal to monitored
   observable wait and creates a fresh goal only when substantive agent work
   remains; and
3. a human-only blocker produces one visible actionable checkpoint and no
   heartbeat that merely polls the person.

Hidden capability gating and non-accumulation remain direct-test contracts, not
manual-UAT steps. Manual observation is the behavioral acceptance evidence. Do
not claim more
than Joe reports. Full completion and archival occur only after Checkpoint 2.

## Scope boundaries

Do not build or run the rejected standalone RPC/provider-capture framework,
commit a native evidence matrix, launch a concurrent Prime Agent process, add a
broad runtime version matrix, or repeat a full native suite. Do not move generic
lifecycle text back into Ralph `/execute`. Do not begin orchestrator work.
