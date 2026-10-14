---
id: PRIMECLAW-10.28
title: Implement plugin-global goal and heartbeat work control
status: Done
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-14 02:50'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
references:
  - >-
    .ralph/plans/archive/goal-heartbeat-work-control/EXECUTION_PLAN.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/goal-heartbeat-work-control/SPECIFICATION.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
parent_task_id: PRIMECLAW-10
priority: p1
type: epic
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the operator-approved two-checkpoint goal/heartbeat work-control plan in .ralph/plans/SPECIFICATION.md and EXECUTION_PLAN.md: one safety-first candidate with proportionate non-native evidence, then one operator-controlled restart and Joe-observed manual UAT. Prime Agent core remains unchanged.

## Legacy notes

Approved source: .ralph/plans/SPECIFICATION.md and .ralph/plans/EXECUTION_PLAN.md. Episode 01a0f0a2-a3d5-706e-92e6-0448235e8127.

## Migrated bundle authority

Imported from frozen pre-cutover tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Verbatim bytes remain available through the source references below; this task is the durable Backlog authority for the bundle's content and outcome.

## Specification imported from `.ralph/plans/archive/goal-heartbeat-work-control/SPECIFICATION.md`

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
for the current active-work epoch toward the broader requested outcome unless a
compatible active goal already owns that work. Writing the goal does not require
predicting the next wait or human gate. Completing an active-work epoch at an
ownership transfer does not claim that the broader requested outcome is complete. Do not
create goals for trivial answers. Never replace, complete, or reinterpret an
incompatible pending goal merely to make room. Completed epochs are not resumed.

### Observable waits

When the agent actually starts a long-running or background operation such as a
subagent, build or test, download, deployment, or container startup:

1. retain an inspectable operation identity and output/status location;
2. create one `rlm_heartbeat` monitor with exact running, success, failure,
   staleness, cleanup, and resumable-checkpoint conditions;
3. verify its ID and recheck the operation;
4. if already terminal, delete and verify the monitor and handle the result now;
5. otherwise complete the current epoch goal even when requested work remains,
   report the handoff, and end the turn.

A non-terminal heartbeat reports only meaningful change, creates no goal, and
never restarts work. Routine monitors use follow-up delivery. The first terminal
observer captures evidence, deletes and verifies the exact monitor, performs
bounded cleanup, and acts idempotently. If the requested outcome is complete it
creates no goal. If substantive work remains it creates one fresh compatible
goal before continuing. An unrelated pending goal remains untouched.

### Human blockers

For user input, credentials, permission, physical action, product decision, or
another human-only dependency, stop only monitors that cannot produce useful
evidence. Complete the current epoch at the actionable handoff even when the
requested outcome remains unfinished. Report once the exact blocker, external
action, process state, and resumable checkpoint, then stop. Never schedule a
heartbeat merely to poll a person. After the blocker clears, create a fresh goal
before substantive work resumes.

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
not claim more than Joe reports. Full completion and archival occur only after
Checkpoint 2.

The first post-restart UAT passed old-tool absence but failed the ownership
transfer behavior. With goal `7f71dda7-9707-447a-963c-a7029eee8523`, the reloaded
policy did not make clear that an event-driven active-work epoch ends when a
started operation becomes an observable wait even though the broader requested
outcome remains unfinished. The bounded repair changes only canonical policy and
docs, active specification/plan, direct semantic-content tests, and Bead
evidence. It adds the explicit event-driven wait and human-blocker transitions.
Owner accepted exact pushed repair
`486f4af62b7c1088a0ad10eb9ca05a2e0f735401`. Its bounded managed
apply/check gate passed on 2026-09-30 PDT; all eight installed managed TypeScript
files were regular and byte-identical to source, and the obsolete paths were
absent without dangling symlinks. After the operator-controlled restart, renewed
visible Checkpoint 2 UAT passed: obsolete pause/resume tools were absent; an exact
goal transferred to a monitored wait and cleaned up; and an exact human blocker
completed its goal with no heartbeat before Joe supplied the requested unblock
token. Exact receipts are recorded on `prime-claw-h6w.22` and
`prime-claw-h6w.24.2`.

The terminal reconciliation archived this specification and its execution plan
under `.ralph/plans/archive/goal-heartbeat-work-control/`, linked both artifacts
from the archive index, aligned canonical acceptance evidence with Joe's exact
passing UAT, and reran the proportionate non-native gates. This archive is a
readiness claim for owner reconciliation, not merge authority. The mandatory
fresh final exact-candidate EXPERT review remains the owner's next gate. No Prime
Agent/native probe, merge, abandonment, episode-resource cleanup, bookkeeping
finalization, behavior change, or scope expansion occurred.

## Scope boundaries

Do not build or run the rejected standalone RPC/provider-capture framework,
commit a native evidence matrix, launch a concurrent Prime Agent process, add a
broad runtime version matrix, or repeat a full native suite. Do not move generic
lifecycle text back into Ralph `/execute`. Do not begin orchestrator work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `pause_thread_goal`, `resume_thread_goal`, their extension entry, and all autonomous `/goal pause` / `/goal resume` message transport are absent.
- [x] #2 Removal happens before the new transient extension is installed by the managed apply sequence.
- [x] #3 Direct non-native tests cover each compatibility signal, disabled/mismatched skills, default selected tools, incompatible-plus-marker silent no-op, deterministic single-copy policy, size bound, compatible collision failure, project append coexistence, no event mutation, and no message/tool/command/notification/abort activity on incompatible runs.
- [x] #4 Isolated installer tests cover obsolete regular-file removal, unsafe directory/symlink rejection before mutation, unrelated-file preservation, new allowlist parity, and stale-file check failure.
- [x] #5 Static/source tests prove obsolete source/tool/transport absence and unique sentinel ownership.
- [x] #6 The safe non-native Python suite and Node suites pass, and `git diff --check` passes. No standalone/native Prime Agent process is launched.
- [x] #7 Canonical docs, active plan/spec, and Beads describe exactly these two checkpoints and preserve rejected `3f2072e` as history.
- [x] #8 One clean replacement candidate is committed and pushed for fresh owner review. The duplicate intermediate EXPERT gate is removed; exactly one mandatory final exact-candidate EXPERT review remains after manual UAT and final artifact reconciliation.
- [x] #9 Only after owner acceptance, managed global apply/check succeeds, but the loaded process is explicitly reported as old until restart.
- [x] #10 old pause/resume tools are visibly absent;
- [x] #11 a compatible normal session visibly moves from active-work goal to monitored observable wait and creates a fresh goal only when substantive agent work remains; and
- [x] #12 a human-only blocker produces one visible actionable checkpoint and no heartbeat that merely polls the person.
- [x] #13 Prior task criterion: Checkpoint 1 removes obsolete pause/resume tools and transport before adding the transient capability-gated policy; safe non-native tests pass; one clean candidate is pushed, reviewed, and applied/checked without claiming activation. Checkpoint 2 records Joe-observed manual UAT after one operator-controlled restart. Active docs are archived only after Checkpoint 2 passes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Imported from `.ralph/plans/archive/goal-heartbeat-work-control/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Historical/current status statements are preserved literally; the task status and Final Summary state the migrated outcome.

# Execution Plan — Plugin-global goal and heartbeat work control

## Outcome

Replace unsafe autonomous goal pause/resume transport with one transient,
capability-gated `before_agent_start` policy, migrate the user-global plugin
safely, and validate model/runtime behavior through one operator-controlled
restart and Joe-run manual UAT.

## Fixed decisions

- Target installed Prime Agent `0.9.7`, build `cwd-fix-v0.9.7-r1`, commit
  `c094b9eea32173d7c4dd0c0a444a332ebac8f5d8` only.
- Keep 0.9.6 as incident history. Do not patch, fork, roll back, or change Prime
  Agent source.
- Preserve rejected commit `3f2072e3f6031f688a1dcb437da79f278df2f254`
  in history. Its native run is informative but not acceptance evidence.
- Remove obsolete tools and transport before installing the replacement policy.
- Use the public `before_agent_start` hook. Gate on selected `ipython` and
  model-visible Python skills `goal` / `goal` and `rlm-heartbeat` /
  `rlm_heartbeat`.
- Missing capabilities return a silent no-op before marker validation, including
  when the incompatible base prompt contains a work-control marker or sentinel.
  Pre-existing, duplicate, or malformed markers fail closed only for otherwise
  compatible runs.
- Keep policy contribution transient, deterministic, non-accumulating, and no
  more than 4,000 UTF-8 bytes excluding markers/sentinel.
- Use only proportionate non-native automation plus manual UAT. Never launch a
  second Prime Agent process while the daemon is active.

## Required replacement for rejected `60a2d4b`

Owner review rejected exact commit
`60a2d4bb5f3a0e51620c62ae7bf0f640c0fc5ddb`. Preserve it in history and revise
only the five accepted findings recorded on `prime-claw-h6w.22` and
`prime-claw-h6w.24.1`:

1. Move the compatibility return before collision validation. Add every
   incompatible-plus-marker/sentinel shape as a direct silent-no-op test while
   retaining compatible collision abort tests.
2. Limit manual UAT to visible old-tool, goal/heartbeat wait-transfer, fresh-goal,
   and human-blocker outcomes. Keep hidden gating and non-accumulation in direct
   tests only.
3. Remove the duplicate intermediate EXPERT review. The replacement Checkpoint 1
   candidate receives owner review; the one mandatory final exact-candidate
   EXPERT remains after UAT and final artifact reconciliation.
4. Correct the stale `prime-claw-h6w.24.1` description/evidence without erasing
   its historical comments.
5. Correct `docs/lab-global-plugin.md` to name both obsolete managed files:
   `extensions/goal-blocker-control.ts` and
   `extension-support/episode-finalization.ts`.

Keep the accepted removal-first implementation and proportionate safe test
boundary unchanged. Do not apply/check or launch Prime Agent in this replacement
pass. Produce one clean pushed replacement candidate with exact evidence for
owner review, then stop.

## Required repair after failed post-restart UAT

The first reloaded UAT passed visible old-tool absence but failed the ownership
transfer case. With goal `7f71dda7-9707-447a-963c-a7029eee8523`, the policy did
not make clear that an active-work epoch ends at an actual ownership-transfer
event even when the broader requested outcome remains unfinished. The failure
and operator-corrected semantics are recorded on `prime-claw-h6w.22` and
`prime-claw-h6w.24.2`.

For one bounded repair pass:

- [x] Replace predictive-boundary wording with event-driven semantics. A goal
  owns the current active-work epoch toward the broader requested outcome; epoch
  completion does not claim requested-outcome completion and does not require
  predicting the next gate.
- [x] When the agent actually starts a long-running/background operation, retain
  an inspectable handle/status, create and verify one heartbeat, recheck terminal
  state, and, if still running, complete the current goal and end the turn. The
  terminal heartbeat deletes itself and creates a fresh goal only if agent work
  remains.
- [x] For a human-only blocker, complete the current goal, report one exact
  resumable checkpoint, and create no heartbeat. After unblocking, create a
  fresh goal before substantive work.
- [x] Update canonical docs, active specification/plan, direct semantic-content
  tests, and Bead evidence only.
- [x] Run focused direct tests and the existing proportionate safe non-native
  boundary; do not restore native probes or broaden testing.
- [x] Commit and push one clean repair candidate for owner review, then stop.
  Do not apply/check, restart, or begin another UAT in this repair pass.
- [x] Owner accepted exact pushed repair
  `486f4af62b7c1088a0ad10eb9ca05a2e0f735401` for the bounded managed
  apply/check gate. Independent review found no material issue.
- [x] Run managed apply/check for that exact accepted generation, independently
  verify installed regular-file byte parity and obsolete-file absence, record
  the loaded runtime identity, and stop before restart or renewed UAT.

Joe's native `/goal clear` in this exact episode reported no goal. This
supersedes the false/stale paused-goal blocker previously reported by the local
skill result; do not block the repair pass on that stale state.

## Checkpoint 1 — safety-first implementation candidate

Bead: `prime-claw-h6w.24.1`.

### Reconcile the stopped attempt

- [x] Replace the six-slice/native-probe plan and specification with this
  two-checkpoint contract.
- [x] Delete the superseded uncommitted evidence directory and delete the
  rejected native test from the candidate while preserving `3f2072e` in Git
  history.
- [x] Update parent/child Beads to the two-checkpoint sequence and close the four
  superseded slice records with explicit supersession notes.

### Remove unsafe transport, then add the replacement

- [x] Remove `src/prime-agent-plugin/extensions/goal-blocker-control.ts`, so the
  model-facing `pause_thread_goal` and `resume_thread_goal` tools and autonomous
  `sendUserMessage` transport disappear first.
- [x] Remove the old entry from installer/checker allowlists; add it to safe
  obsolete-file migration and stale-file checks.
- [x] Add inert
  `src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts` with one
  transient policy listener, structured capability gating, unique markers,
  collision failure, and no tools/messages/state writes.
- [x] Keep Ralph `/execute` free of generic lifecycle policy.

### Proportionate tests

- [x] Revise direct Node tests so every incompatible capability plus every
  marker/sentinel shape is an unchanged silent no-op with zero notify/abort;
  retain compatible collision abort coverage, default selected tools,
  deterministic bounded content,
  project append coexistence, and no mutation or message/tool registration.
- [x] Add Python static tests for absence of obsolete tools/source/transport and
  unique sentinel ownership.
- [x] Update isolated installer tests for new allowlist parity, obsolete regular
  file removal, unsafe obsolete destination rejection, and unrelated-file
  preservation.
- [x] Run focused tests.
- [x] Run every safe non-native Python test file while excluding whole files
  that launch Prime Agent.
- [x] Run all non-native Node suites and `git diff --check`.

Explicitly do not build/run the standalone RPC/provider-capture framework,
machine-readable native evidence matrix, broad version matrix, repeated full
native suite, or any concurrent Prime Agent process.

### Documentation, review, and landing

- [x] Replace the rejected carrier document with the operational policy,
  migration boundary, evidence limits, and manual checklist.
- [x] Update the lab-global plugin and oversight docs for the new extension and
  absence of pause/resume tools.
- [x] Record exact check results in this plan and `prime-claw-h6w.24.1`.
- [x] Commit and push candidate `60a2d4b`; owner review rejected it with five
  accepted revision findings.
- [x] Commit and push one clean replacement candidate with exact safe evidence.
- [x] Obtain fresh owner review of exact replacement
  `4a6e07a5cf0752b20976c65b2108ae8acd338792`; owner accepted it for the bounded
  managed installation gate. No duplicate intermediate EXPERT review ran.
- [x] Run managed apply/check against the
  user-global copy and verify parity/obsolete-file absence.
- [x] Preserve exactly one mandatory final exact-candidate EXPERT gate after
  manual UAT and final artifact reconciliation. It remains the owning
  conversation's next gate and was not run by this episode.
- [x] Stop before restart. Report that daemon PID 22654 remains the pre-install
  loaded process; installation is not activation and no restart occurred.

## Checkpoint 2 — restart and manual UAT

Bead: `prime-claw-h6w.24.2`.

This checkpoint is operator-controlled. After Checkpoint 1 apply/check:

1. Quiesce work and restart the sole Prime Agent process once using the
   operator's normal service action. Do not start a concurrent instance.
2. In a fresh session, Joe visibly confirms `pause_thread_goal` and
   `resume_thread_goal` are absent.
3. Joe observes a compatible normal session visibly transfer active work from a
   bounded goal to an exact monitored wait, then create a fresh goal only if
   substantive work remains.
4. Joe observes a human-only blocker produce one visible actionable checkpoint
   and no heartbeat that merely polls the person.
5. Hidden capability gating and non-accumulation remain direct-test contracts;
   they are not manual-UAT steps.
6. Record only Joe's observed pass/fail. On pass, finish docs/Beads and archive
   the active plan/spec. On failure, retain the exact observation and repair as
   a newly approved bounded candidate.

First post-restart result: old-tool absence passed. Goal/wait transfer failed
because the policy did not clearly end the active-work epoch at the actual wait
handoff while keeping the broader requested outcome unfinished; the
human-blocker case was not accepted as a pass in that run.

After installation of exact repaired generation
`486f4af62b7c1088a0ad10eb9ca05a2e0f735401` and the operator-controlled restart,
the renewed visible Checkpoint 2 UAT passed all three cases. Joe observed the
obsolete pause/resume tools absent; an exact goal transfer to a monitored
heartbeat wait, followed by terminal cleanup; and an exact human-only blocker
that completed its goal, created no heartbeat, and resumed only after Joe
supplied the requested unblock token. Exact UAT identities and receipts are
durably recorded on `prime-claw-h6w.22` and `prime-claw-h6w.24.2`.

## Terminal candidate after passing UAT

Complete one bounded terminal reconciliation pass only:

- [x] Reconcile canonical docs, direct tests, active artifacts, and directly
  relevant Beads with the accepted behavior and recorded passing UAT.
- [x] Run the proportionate final non-native checks without launching Prime
  Agent, a native probe, or a broad/native suite.
- [x] Archive the exact active specification/plan bundle under
  `.ralph/plans/archive/goal-heartbeat-work-control/`, update the archive index,
  and verify its relative links.
- [x] Prepare and push one complete terminal candidate with exact
  Git/path/link evidence, then stop for owner reconciliation. The exact pushed
  commit is recorded on the directly relevant Beads after push.
- [x] Do not run the mandatory fresh final exact-candidate EXPERT review, merge,
  abandon, remove the worktree/session/branch, or finalize episode bookkeeping.

## Validation record

### Checkpoint 1 focused tests

Rejected candidate `60a2d4b` evidence remains in its commit and Bead history.
Replacement-candidate pre-commit evidence:

- Focused direct Node suite passed `8/8`, including the 25-case cross product of
  five incompatible capability shapes and five marker/sentinel shapes. Every
  incompatible case returned unchanged with zero notify/abort; compatible
  collisions retained abort/error coverage.
- Focused Python/plugin/install/execute command passed `20` tests plus `11`
  subtests in `6.02s`.
- Source-audited safe Python command explicitly included 18 non-native files and
  excluded the five whole files that launch Prime Agent. Result:
  `268 passed, 11 subtests passed` in `18.13s`; 11 existing Python deprecation
  warnings.
- All six mock-based Node extension suites passed `135` tests in `27.6s`.
- `bash -n scripts/apply-prime-agent-plugin.sh scripts/check-prime-agent-plugin.sh`
  and `git diff --check` passed.
- Policy body remains below the 4,000-byte bound; managed plugin source retains
  one V1 sentinel owner.

No native Prime Agent probe, full native suite, managed apply/check, or new
Prime Agent process ran during candidate construction. The sole daemon remained
untouched through candidate acceptance.

### Post-restart UAT repair candidate evidence

The event-driven semantic repair changed only the approved policy, direct tests,
canonical docs, active plan/spec, and Bead evidence. Validation used no native
Prime Agent probe, managed apply/check, restart, or manual UAT:

- Focused Node policy suite: `8/8` passed.
- Focused Python command: `21 passed, 11 subtests passed` in `6.35s`.
- Explicit safe non-native Python command: `269 passed, 11 subtests passed` in
  `19.20s`, with 11 existing deprecation warnings. PID 19132 was transferred to
  heartbeat `bf646472-9987-4ddc-ae80-d5b7729a4afb`; the terminal observer
  captured exit 0 and deleted and verified absence of that exact monitor.
- All six mock-based Node extension suites: `135/135` passed in `28.77s`. PID
  21675 was transferred to heartbeat
  `3b1c28da-e41b-4987-8f55-46eb47f4472c`; the terminal observer captured exit 0
  and deleted and verified absence of that exact monitor.
- `bash -n scripts/apply-prime-agent-plugin.sh
  scripts/check-prime-agent-plugin.sh`, `git diff --check`, the 4,000-byte policy
  bound (`2,828` characters / `2,975` UTF-8 bytes), and unique sentinel
  ownership all passed.

### Event-driven repair managed installation evidence

On 2026-09-30 PDT, with exact owner-accepted repair
`486f4af62b7c1088a0ad10eb9ca05a2e0f735401` at HEAD and no
source/script difference from that commit:

- `scripts/apply-prime-agent-plugin.sh` exited `0` in `0.64s`. It reported
  the inert source/global copy current, applied to
  `/Users/jlanders/.prime/agent`, and explicitly required a restart before
  treating the generation as active. Its mandatory final check passed.
- `scripts/check-prime-agent-plugin.sh` independently exited `0` in `0.23s`
  and reported the inert source/global copy current.
- `python3 scripts/manage-prime-agent-append-system.py check` with the canonical
  source and installed `/Users/jlanders/.prime/agent/APPEND_SYSTEM.md`
  independently exited `0` in `0.19s`.
- A separate Python `Path.lstat()` / `read_bytes()` / `hashlib.sha256()` audit
  passed. Each of the eight installed paths is a mode-`0644` regular file, not
  a symlink, and is byte-identical to inert source:

  | Absolute managed installed path | Bytes | SHA-256 |
  | --- | ---: | --- |
  | `/Users/jlanders/.prime/agent/extensions/goal-heartbeat-work-control.ts` | 4878 | `8faa7537a1f177327177c796287d6d36ab50df624f8c5552906f50ca6437d595` |
  | `/Users/jlanders/.prime/agent/extensions/handoff-chain.ts` | 4449 | `debd42d40ba1c9a9ba23607c0e2f25e8505e6ef640cedfb62d8bffbe8d61ceb6` |
  | `/Users/jlanders/.prime/agent/extensions/reviewed-plan.ts` | 15324 | `1c7c5a9870c3a23c7f1bec8facdab8471e5290ee4a41991e8d5dab7bc5488b22` |
  | `/Users/jlanders/.prime/agent/extension-support/conversation-oversight.ts` | 25901 | `07d376b1bfad0b0cd4af8d8cd298b2a6e94a35e5f46bea1c69a17031b208a714` |
  | `/Users/jlanders/.prime/agent/extension-support/episode-close.ts` | 2864 | `a40953bb802242c4dbeb698627ea1a0886e1ded8a73f3ffe66bec56a952a2732` |
  | `/Users/jlanders/.prime/agent/extension-support/handoff-prompts.ts` | 645 | `a85fde2479c5b3cf5d2f28cfb33eefad413abeed6a16397236df9de322b4cb08` |
  | `/Users/jlanders/.prime/agent/extension-support/reviewed-plan-support.ts` | 1995 | `a4230f9aded32585f778a82ddd3b659deea513507a14d0c742cc656eb58bf107` |
  | `/Users/jlanders/.prime/agent/extension-support/spec-episode.ts` | 44367 | `5342c12e6b7d0ab87d3955491cc8864175444551791d1f1deabe1597cfc63558` |

- `/Users/jlanders/.prime/agent/extensions/goal-blocker-control.ts`,
  `/Users/jlanders/.prime/agent/extension-support/episode-finalization.ts`, and
  `/Users/jlanders/.prime/agent/extensions/project-conversation.ts` are absent;
  none exists as a dangling symlink.
- `/Users/jlanders/.prime/agent/APPEND_SYSTEM.md` is a regular file, not a
  symlink. Its sole managed block is byte-identical to
  `src/prime-agent-plugin/APPEND_SYSTEM.md`: 1,114 bytes, SHA-256
  `1edfae19b113187332c031ee7e0ac92943a1e9e08cd84fe34af1e980b3300a7a`. The
  complete installed
  file is 1,118 bytes with SHA-256
  `fea6c335b95dc688ed9c16b4830db4da63b15af3dd19a5420a75de54601d9b1b`;
  the two unmanaged prefix bytes and two
  unmanaged suffix bytes were preserved. Marker counts are exactly one start
  and one end.
- No Prime Agent process or native probe was launched. Loaded daemon PID
  `14672` (started 2026-09-30 09:15:41 PDT),
  daemon-node PID `14714` (09:15:42 PDT), and
  conversation PID `38255` still use build
  `cwd-fix-v0.9.7-r1`, package version `0.9.7`,
  checkout commit `c094b9eea32173d7c4dd0c0a444a332ebac8f5d8`. The daemon predates the
  installed goal-policy write at 10:12:30 PDT, so this pass does **not** claim
  that the loaded runtime activated repair `486f4af62b7c1088a0ad10eb9ca05a2e0f735401`.

### Checkpoint 1 managed installation evidence

On 2026-09-29 PDT, with accepted commit
`4a6e07a5cf0752b20976c65b2108ae8acd338792` at HEAD:

- `scripts/apply-prime-agent-plugin.sh` exited 0, installed to
  `/Users/jlanders/.prime/agent`, ran its final check, and explicitly required a
  restart before treating the generation as active.
- `scripts/check-prime-agent-plugin.sh` exited 0 independently and reported the
  inert source/global copy current.
- Independent byte comparison found all eight installed regular files exactly
  equal to inert source:

  | Managed installed path | Bytes | SHA-256 |
  | --- | ---: | --- |
  | `extensions/goal-heartbeat-work-control.ts` | 4487 | `bdea90e1ecd5610c3ea90b77ac682e2b1b91149ba6b2a12f880577a87f10a7db` |
  | `extensions/handoff-chain.ts` | 4449 | `debd42d40ba1c9a9ba23607c0e2f25e8505e6ef640cedfb62d8bffbe8d61ceb6` |
  | `extensions/reviewed-plan.ts` | 15324 | `1c7c5a9870c3a23c7f1bec8facdab8471e5290ee4a41991e8d5dab7bc5488b22` |
  | `extension-support/conversation-oversight.ts` | 25901 | `07d376b1bfad0b0cd4af8d8cd298b2a6e94a35e5f46bea1c69a17031b208a714` |
  | `extension-support/episode-close.ts` | 2864 | `a40953bb802242c4dbeb698627ea1a0886e1ded8a73f3ffe66bec56a952a2732` |
  | `extension-support/handoff-prompts.ts` | 645 | `a85fde2479c5b3cf5d2f28cfb33eefad413abeed6a16397236df9de322b4cb08` |
  | `extension-support/reviewed-plan-support.ts` | 1995 | `a4230f9aded32585f778a82ddd3b659deea513507a14d0c742cc656eb58bf107` |
  | `extension-support/spec-episode.ts` | 44367 | `5342c12e6b7d0ab87d3955491cc8864175444551791d1f1deabe1597cfc63558` |

- `extensions/goal-blocker-control.ts`,
  `extension-support/episode-finalization.ts`, and legacy
  `extensions/project-conversation.ts` are absent with no dangling symlink.
- Managed `APPEND_SYSTEM.md` validation passed; its canonical source block is
  1,115 bytes with SHA-256
  `0b65110b71b6de6b14244f4006cd6ac3f98a3308fab9e0b131389778a83b57c3`.
- No Prime Agent process or native probe was launched. Daemon PID 22654 (started
  2026-09-29 20:00:28 PDT) and daemon-node PID 22731 still point at build
  `cwd-fix-v0.9.7-r1`, package version `0.9.7`, checkout commit
  `c094b9eea32173d7c4dd0c0a444a332ebac8f5d8`; conversation PID 12874 remains a
  child of PID 22654. Because the daemon predates the 23:51:05 PDT installed-file
  write, this pass does not claim it loaded the installed generation.

### Safe-suite boundary

The safe command enumerated every non-native Python file explicitly. It excluded
`test_conversation_oversight_native.py`, `test_handoff_chain_extension.py`,
`test_project_conversation_extension.py`, `test_reviewed_plan_extension.py`, and
`test_reviewed_plan_native_discovery.py` as whole files because each contains at
least one real Prime Agent launch. Do not use `pytest tests` while the sole daemon
is active.

### Terminal reconciliation evidence

- Canonical acceptance evidence now records the exact passing visible UAT
  receipts from `prime-claw-h6w.24.2`; no approved runtime behavior changed.
- `node --experimental-strip-types --test
  tests/goal_heartbeat_work_control_extension.test.mjs` passed `8/8`.
- `pytest -q tests/test_goal_heartbeat_work_control_extension.py
  tests/test_prime_agent_plugin_install.py tests/test_execute_skill.py` passed
  `21` tests plus `11` subtests in `6.38s`; the final post-archive combined
  focused command exited 0 in `7.08s`.
- `bash -n scripts/apply-prime-agent-plugin.sh
  scripts/check-prime-agent-plugin.sh`, final managed plugin check, and
  `git diff --check` passed. The policy is `2,828` characters / `2,975` UTF-8
  bytes and owns one sentinel.
- The exact active bundle moved to
  `.ralph/plans/archive/goal-heartbeat-work-control/`. The archive index links
  both artifacts and the canonical operating contract; all three relative
  targets resolve to regular files. `src/`, `scripts/`, and `tests/` have no
  diff from accepted repair `486f4af62b7c1088a0ad10eb9ca05a2e0f735401`.
- No Prime Agent/native probe, broad/native suite, fresh final EXPERT review,
  merge, abandonment, cleanup, or episode-bookkeeping close ran.

## Current stop boundary

This archived bundle and its pushed Git commit are the episode's terminal
readiness claim. Stop for owner reconciliation. The owning conversation must
obtain the mandatory fresh final exact-candidate EXPERT PASS before it can ask
the operator for a merge decision. Archival and passing UAT do not authorize
merge, abandonment, resource cleanup, or episode bookkeeping finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One-time Backlog migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`.

Tracked source paths:
- `.ralph/plans/archive/goal-heartbeat-work-control/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/goal-heartbeat-work-control/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530` (shared terminal/status evidence)

Every listed source remains tracked in this bounded migration slice. Git history preserves verbatim bytes. This task imports the bundle's specification/requirements into Description and native criteria, execution plan into Implementation Plan, durable history into these notes, and terminal outcome into Final Summary. Existing task ID and `parent_task_id` are preserved. No bundle is placed under `backlog/archive/`.

Related durable Backlog tasks: .

### Shared archive-index outcome

## goal-heartbeat-work-control/ — Plugin-global goal and heartbeat work control ✅ COMPLETE (2026-09-30)

Delivered transient, capability-gated, event-driven goal/heartbeat ownership for
compatible Prime Agent sessions while removing the unsafe model-facing
pause/resume transport. The accepted repair is
`486f4af62b7c1088a0ad10eb9ca05a2e0f735401`; managed installation evidence is
`3a526ec68a13783d11acb609b3d485a577b26a91`. Joe's renewed visible UAT passed
obsolete-tool absence, exact goal-to-monitored-wait transfer and cleanup, and an
exact human-only blocker with no polling heartbeat. Exact receipts are on
`PRIMECLAW-10.28.2`.

- [Archived specification](goal-heartbeat-work-control/SPECIFICATION.md)
- [Archived execution plan](goal-heartbeat-work-control/EXECUTION_PLAN.md)
- [Canonical operating contract](../../../docs/goal-heartbeat-work-control.md)

This archive is the episode's terminal readiness claim for owner reconciliation.
The mandatory fresh exact-candidate EXPERT review has not run; this archive does
not authorize merge, abandonment, resource cleanup, or episode bookkeeping
finalization.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Joe Landers
created: 2026-10-12 01:02
---
Operator decision (2026-09-30): simplify goal/heartbeat delivery and use operator-run manual user acceptance testing for model/runtime behavior instead of building the large native Prime Agent provider-capture and machine-readable evidence framework. Reorder risk reduction so the obsolete Prime Claw pause_thread_goal/resume_thread_goal tools, goal-blocker-control extension, installer entry, and autonomous pause/resume transport are removed first. Deleting files is not claimed active until the managed global copy is applied and the sole existing Prime Agent runtime is restarted; do not launch another instance. Build against the currently installed Prime Agent 0.9.7 downstream generation cwd-fix-v0.9.7-r1 at c094b9e; preserve 0.9.6 only as incident history and never roll back or modify Prime Agent source.

Keep only proportionate automated evidence: direct non-native unit tests for the before_agent_start contribution, capability gating, marker/collision behavior, no message/state persistence, and policy size/content; isolated installer/apply/check tests proving safe obsolete-file removal and unrelated-file preservation; static/source tests proving the two old tools and native pause/resume injection are absent; and the existing safe non-native suite/diff checks. Do not build or require the Slice 1 standalone RPC carrier framework, committed provider-capture artifacts, a broad version matrix, repeated full native suites, or any concurrent Prime Agent process.

After apply/check and one operator-controlled restart, Joe will perform manual UAT in the fresh installed generation. The concise checklist must verify: old tools are absent; a compatible normal session follows active-work goal -> monitored observable wait -> fresh goal only when substantive work remains; a human-only blocker gets one actionable checkpoint with no person-polling heartbeat; incompatible capability configurations receive no work-control policy; and the policy does not visibly accumulate across ordinary turns/resume. Record Joe's observed pass/fail as the behavioral acceptance evidence. Update the active specification, execution plan, canonical docs, and Beads to replace the superseded six-slice/native-probe gates with this smaller safety-first sequence. Stop the current 3f2072e Slice 1 repair at a safe checkpoint; do not continue its evidence-framework work or begin the reordered implementation until the owner admits the revised generation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Managed apply/check completed for exact owner-accepted event-driven repair 486f4af62b7c1088a0ad10eb9ca05a2e0f735401 on 2026-09-30 PDT. Commands: scripts/apply-prime-agent-plugin.sh exit 0 (0.64s, mandatory final check passed); scripts/check-prime-agent-plugin.sh exit 0 (0.23s); explicit APPEND_SYSTEM managed-block check exit 0 (0.19s). Independent lstat/byte/hash audit: all 8 installed TypeScript paths under /Users/jlanders/.prime/agent are mode-0644 regular non-symlink files byte-identical to inert source. Updated goal-heartbeat-work-control.ts is 4,878 bytes, SHA-256 8faa7537a1f177327177c796287d6d36ab50df624f8c5552906f50ca6437d595; complete path/hash table is in active EXECUTION_PLAN.md. Obsolete goal-blocker-control.ts, episode-finalization.ts, and project-conversation.ts are absent with no dangling symlink. Installed APPEND_SYSTEM.md managed block equals source (1,114 bytes, SHA-256 1edfae19b113187332c031ee7e0ac92943a1e9e08cd84fe34af1e980b3300a7a). No Prime Agent/native probe launched. Loaded daemon PID 14672, daemon-node 14714, conversation 38255 use build cwd-fix-v0.9.7-r1, version 0.9.7, commit c094b9eea32173d7c4dd0c0a444a332ebac8f5d8; daemon start 09:15:41 PDT predates installed policy write 10:12:30 PDT, so installation is not claimed active. Stop before restart/UAT. Next operator action: quiesce work; restart sole daemon once via normal service action without a concurrent daemon; open fresh builder-rooted session; run only visible Checkpoint 2 UAT.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Durable managed-install evidence pushed in commit 3a526ec68a13783d11acb609b3d485a577b26a91 on branch episode/goal-heartbeat-work-control. This records exact commands/results, all installed paths/sizes/SHA-256 hashes, APPEND_SYSTEM parity, obsolete-path absence, loaded runtime identity, and the operator restart action. Final post-commit scripts/check-prime-agent-plugin.sh also exited 0. bd sync is unavailable in this bd build (unknown command); authoritative Bead changes were pushed with bd dolt push. No restart or renewed UAT occurred.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Terminal reconciliation prepared after passing visible Checkpoint 2 UAT. Canonical docs now record the exact UAT receipts without changing approved behavior. The completed active SPECIFICATION.md and EXECUTION_PLAN.md moved together to .ralph/plans/archive/goal-heartbeat-work-control/; the archive README links both files plus docs/goal-heartbeat-work-control.md, and all three relative targets resolve. Final post-archive non-native evidence: direct Node policy suite 8/8; focused Python plugin/install/execute suite 21 passed plus 11 subtests in 6.38s (combined 7.08s); shell syntax, managed plugin check, and git diff --check passed. src/, scripts/, and tests/ have no diff from accepted repair 486f4af62b7c1088a0ad10eb9ca05a2e0f735401. No Prime Agent/native probe, broad/native suite, final EXPERT review, merge, abandonment, cleanup, or episode bookkeeping close ran. The archived bundle is a readiness claim only; exact terminal Git commit will be appended after push. Next gate is owner reconciliation followed by the mandatory fresh exact-candidate EXPERT review.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Terminal candidate pushed: bdd7d8ba32e4c8bbe85f4b9110dd5f005f369a52 on episode/goal-heartbeat-work-control. Git detects exact active-to-archive renames: EXECUTION_PLAN.md R083 and SPECIFICATION.md R089 into .ralph/plans/archive/goal-heartbeat-work-control/. The commit also updates .ralph/plans/archive/README.md, docs/goal-heartbeat-work-control.md, and docs/lab-global-plugin.md. Archive index links resolve to both archived files and the canonical operating contract. Final gates: Node 8/8; focused Python 21 plus 11 subtests; shell syntax, installed plugin check, link check, and git diff check passed. All related Beads are closed. No final EXPERT review, merge, abandonment, resource cleanup, or episode bookkeeping finalization occurred. Stop for owner reconciliation and the mandatory fresh exact-candidate EXPERT gate.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Mandatory fresh final exact-candidate EXPERT gate PASSED for commit `bdd7d8ba32e4c8bbe85f4b9110dd5f005f369a52`.

Reviewer evidence: child `sub-cc0b042c`; reviewer session `01a0f3d5-4402-7741-9677-91b6201c91d5`; model `openai-codex/gpt-6-astra`; explicitly admitted reasoning `max`; exact profile `.prime/agent/profiles/expert-reviewer.md` passed strict raw-frontmatter validation; combined task was delivered exactly once. Full immutable report: `/Users/jlanders/.prime/agent/session-artifacts/01a0e8b6-669c-7334-863e-c451e9aee112/sub-cc0b042c/goal-heartbeat-final-expert-report.md`; SHA-256 `4ec5d66b597d7eae9fd28ec793ff64b87eb1bd575a615f5fe7211a1071758139`; 16,459 bytes. Disposition: PASS — no material finding remains for exact candidate. Independent reviewer checks included Node 8/8, focused Python 21 plus 11 subtests, 112 incompatible/collision pure-mock cases plus 7 compatible collisions/replay/resource change, shell syntax, both diff checks, exact remote HEAD, archive links/active-path absence, actual installed eight-file and APPEND byte/type/hash parity, and no src/scripts/tests diff from accepted repair `486f4af62b7c1088a0ad10eb9ca05a2e0f735401`. No Prime Agent/native probe or mutation ran.

Owner adjudication: ACCEPT PASS. The sole P3 note is non-blocking measurement-label precision in the archived plan: the full ASCII policy block is 2,975 characters/bytes; the test-defined marker/sentinel-stripped body is 2,830 including retained newlines, while the archive's `2,828 characters / 2,975 bytes` wording conflates boundary conventions. Both spans are below the 4,000-byte ceiling; behavior, acceptance, and safety are unaffected. Do not churn the already reviewed exact candidate for this wording-only clarification; preserve this ledger note for future documentation cleanup. Any material candidate change would invalidate this PASS.

Terminal review heartbeat `35e6b393-ac08-4e87-a3cc-f74208153188` was cancelled after preserving the report, absence was verified, and the exact reviewer was retired. This PASS is review evidence only. Candidate is now ready for Joe's explicit merge, revise, pause, or abandon decision. No merge, cleanup, or episode-bookkeeping finalization has occurred.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Operator terminal decision: MERGE AND INSTALL exact accepted episode candidate `bdd7d8ba32e4c8bbe85f4b9110dd5f005f369a52`.

Git integration and validation: merged the episode into current `main` with conflict-free merge commit `9b3edd27e86d4a25a629e9ea8956ef51791ec3ac` (parents `a6a55bc9cd2129d6c6a8aecbd0e6f2a58856e43c` and `bdd7d8ba32e4c8bbe85f4b9110dd5f005f369a52`). Pushed normally to `origin/main`; root `main` and `origin/main` both resolve to `9b3edd2`. Merged-tree gate passed: all six non-native Node suites `136/136`; documented 18-file safe non-native Python suite `269 passed`, `11 subtests passed`, 11 existing warnings; shell syntax and both-parent diff checks passed.

Managed installation: `scripts/apply-prime-agent-plugin.sh` exited 0 and explicitly requires restart before treating the merged generation as newly loaded; independent `scripts/check-prime-agent-plugin.sh` exited 0, including final post-cleanup replay. All eight installed managed TypeScript files are byte-identical to merged `main`; goal policy SHA-256 remains `8faa7537a1f177327177c796287d6d36ab50df624f8c5552906f50ca6437d595`; merged `spec-episode.ts` SHA-256 is `071fad769058b82e92e2615d6092bf73e052e74025141ad48e149057577296d4`. All three obsolete paths remain absent.

Terminal resources: exact episode session `01a0f0a2-a3d5-706e-92e6-0448235e8127` / active route `8d74bc098e97` was idle, queue-free, and attachment-free after documented `prime-agent stop`; it is now archived with zero attached clients and its saved session retained as audit evidence. Episode and temporary merge worktrees were clean then removed. Local episode and integration branches were deleted; remote `episode/goal-heartbeat-work-control` was deleted; worktree inventory and refs were verified. The retained root future bundle was byte-identical to promotion commit `e4f5899`, backed up at `/Users/jlanders/.prime/agent/session-artifacts/01a0e8b6-669c-7334-863e-c451e9aee112/goal-heartbeat-terminal-backup`, then removed; final archived specification/plan remain tracked under `.ralph/plans/archive/goal-heartbeat-work-control/`. No episode heartbeat remains.

Unrelated pre-existing root `.beads/interactions.jsonl` dirt was preserved byte-for-byte as a Git binary patch (SHA-256 `06a6eec6bfcca7cfb6b9769744dfad07c458d38c76d3eb2643106ad2416cd1ef`) and was not included in the merge. Terminal Git/session/worktree/branch/install work is verified. The only remaining lifecycle action is the exact no-UI `finalize_spec_episode(.ralph/plans/future/goal-heartbeat-work-control)` bookkeeping close; no Git or resource work will be replayed.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Exact no-UI bookkeeping close completed successfully for `.ralph/plans/future/goal-heartbeat-work-control`. The tool confirmed oversight inactive while ordinary CONVERSATION capability remains. This call performed no Git, merge, abandonment, session, worktree, branch, or cleanup action; all such terminal work was completed and verified before the call. Exact replay is not needed.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implementation, managed installation, visible UAT, canonical docs, direct tests, and required plan archival are complete. Terminal candidate is ready for owner reconciliation; fresh final EXPERT and operator merge decision remain separate.

## goal-heartbeat-work-control/ — Plugin-global goal and heartbeat work control ✅ COMPLETE (2026-09-30)

Delivered transient, capability-gated, event-driven goal/heartbeat ownership for
compatible Prime Agent sessions while removing the unsafe model-facing
pause/resume transport. The accepted repair is
`486f4af62b7c1088a0ad10eb9ca05a2e0f735401`; managed installation evidence is
`3a526ec68a13783d11acb609b3d485a577b26a91`. Joe's renewed visible UAT passed
obsolete-tool absence, exact goal-to-monitored-wait transfer and cleanup, and an
exact human-only blocker with no polling heartbeat. Exact receipts are on
`PRIMECLAW-10.28.2`.

- [Archived specification](goal-heartbeat-work-control/SPECIFICATION.md)
- [Archived execution plan](goal-heartbeat-work-control/EXECUTION_PLAN.md)
- [Canonical operating contract](../../../docs/goal-heartbeat-work-control.md)

This archive is the episode's terminal readiness claim for owner reconciliation.
The mandatory fresh exact-candidate EXPERT review has not run; this archive does
not authorize merge, abandonment, resource cleanup, or episode bookkeeping
finalization.
<!-- SECTION:FINAL_SUMMARY:END -->
