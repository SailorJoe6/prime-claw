# Goal and heartbeat work control

Prime Claw supplies one plugin-global policy for deciding whether useful work is
owned by a persistent goal or an agent-owned heartbeat. The policy is generic;
Ralph `/execute` owns only plan execution and does not duplicate it.

## Supported runtime boundary

The implementation targets the installed Prime Agent `0.9.7` downstream build
`cwd-fix-v0.9.7-r1` at
`c094b9eea32173d7c4dd0c0a444a332ebac8f5d8`. Prime Agent `0.9.6` appears only
in the incident history below. Prime Claw does not patch or roll back Prime
Agent.

`src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts` uses the
public `before_agent_start` hook. It returns a replacement system prompt for the
current run only. It does not register a tool, send a message, or write session
state. A project `APPEND_SYSTEM.md` is already part of the base prompt and
cannot suppress the later contribution.

A run is compatible only when structured runtime data shows all three:

- `ipython` is selected (or Prime Agent supplies its documented default tool
  set);
- the model-visible Python skill `goal` has import name `goal`; and
- the model-visible Python skill `rlm-heartbeat` has import name
  `rlm_heartbeat`.

Missing or disabled capabilities are a silent no-op. The extension does not
infer capability by parsing rendered prose or checking files. Compatibility is
re-evaluated for every run, including after resource reload.

The deterministic block is bounded to 4,000 UTF-8 bytes excluding markers. It
contains exactly one `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` sentinel. Any
pre-existing start marker, end marker, or sentinel is a collision and fails
closed rather than accumulating or accepting malformed policy state.

## Ownership model

Ownership follows the next useful action:

| State | Owner | Persistent control |
|---|---|---|
| Active agent work | Agent | One compatible bounded goal |
| Observable external wait | Exact process, job, deployment, or worker | One bounded heartbeat per independent wait |
| Human-only blocker | Operator or external authority | Current epoch goal completes at the actionable handoff; no person-polling heartbeat |
| Finished | Nobody | No outcome-owned goal or heartbeat remains |

A goal may overlap a heartbeat only during the short safe transfer that creates
and verifies monitoring before completing the active-work goal, or when each
owns independent work.

### Active work

For substantive multi-step work, inspect current goal state and create one
bounded goal for the current active-work epoch unless a compatible active goal
already owns the same authorized work. The epoch advances the broader requested
outcome, but completing it does not claim that outcome is complete. Goal creation
does not require predicting the next gate or ownership boundary. Do not create
goals for quick answers. Never complete, replace, or reinterpret an incompatible
pending goal merely to make room.

### Observable waits

When the agent actually starts a long-running or background operation such as a
subagent, build or test, download, deployment, or container startup:

1. Retain an inspectable handle and output or status location.
2. Create one `rlm_heartbeat` monitor with exact running, success, failure,
   staleness, cleanup, and resumable-checkpoint conditions.
3. Verify the heartbeat ID and recheck the operation.
4. If it is already terminal, delete and verify the monitor and handle the
   result now.
5. If it is still running, complete the current epoch goal even when requested
   work remains, report the handoff, and end the turn.

A non-terminal check reports only meaningful change, creates no goal, and never
restarts work. Routine monitors use follow-up delivery. The first terminal
observer captures evidence, deletes and verifies the exact monitor, performs
bounded cleanup, and acts idempotently. It creates a fresh goal only when
substantive agent work remains. A completed epoch is never resumed.

### Human blockers

When blocked or waiting for user input, credentials, permission, physical
action, a product decision, or another human-only dependency, stop only monitors
that cannot produce useful evidence. Complete the current epoch goal even when
the requested outcome remains unfinished. Report the exact blocker, external
action, process state, and one resumable checkpoint, then stop without creating
a heartbeat merely to poll the person. After the blocker clears, create a fresh
goal before substantive work resumes.

Prime Claw never injects, simulates, or calls native `/goal pause` or
`/goal resume` for autonomous work control. Human use of Prime Agent's native
goal commands remains authoritative.

## Migration and activation

The obsolete model-facing `pause_thread_goal` and `resume_thread_goal` tools and
`src/prime-agent-plugin/extensions/goal-blocker-control.ts` are removed. Apply
removes the formerly managed installed file
`extensions/goal-blocker-control.ts` only when destination preflight confirms
all managed paths are safe regular files or absent. Check rejects a stale old
file. Unrelated global extensions and unmanaged `APPEND_SYSTEM.md` bytes are
preserved.

Apply/check are safe to test under an isolated `PRIME_AGENT_PLUGIN_ROOT`. For
the managed user-global installation run:

```sh
scripts/apply-prime-agent-plugin.sh
scripts/check-prime-agent-plugin.sh
```

Installation is not activation. The already loaded Prime Agent process may
retain its old extension generation. Do not use `/reload` as an activation
claim. The operator must restart Prime Agent once work is quiescent and perform
the manual checks below in a fresh session.

Apply does not mutate stored goal state or purge already queued old-generation
messages. A legacy paused or budget-limited goal requires human recovery with
native goal controls or a fresh clean session.

## Acceptance evidence

Proportionate automated coverage is intentionally non-native:

- direct Node tests cover capability gating before collision validation,
  incompatible-plus-marker unchanged no-op with zero notification/abort,
  default tool selection, deterministic bounded content, compatible marker
  collisions, transient behavior, no message/state mutation, and project-append
  coexistence;
- Python static tests prove the obsolete tools, source entry, and autonomous
  slash-command transport are absent;
- isolated installer tests prove safe obsolete-file migration, unsafe-path
  rejection, unrelated-file preservation, convergence, and check behavior;
- the safe non-native Python suite and `git diff --check` provide regression
  coverage.

The prior native provider-capture run on rejected commit
`3f2072e3f6031f688a1dcb437da79f278df2f254` was informative but violated the
machine's single-instance rule and is not acceptance evidence. Its standalone
RPC framework and machine-readable evidence matrix were removed. No concurrent
Prime Agent process, broad version matrix, or repeated native suite is required.

The operator-controlled restart and visible manual UAT completed on 2026-09-30
against the installed generation from accepted repair
`486f4af62b7c1088a0ad10eb9ca05a2e0f735401`:

1. Joe confirmed `pause_thread_goal` and `resume_thread_goal` were absent.
2. Goal `1cac0599-adbd-4ed1-9e84-24d854a277e5` transferred an observable PID
   `46498` wait to heartbeat `6c244df4-97ab-4c95-8e8d-0521215322e6`. The goal
   completed while the broader UAT remained unfinished; a nonterminal check did
   not create a goal or restart work; terminal handling observed exit 0, deleted
   and verified absence of the heartbeat, and removed the marker.
3. Human-blocker goal `4c5fcf18-3f69-4f8c-99de-d68bbef7f721` completed with an
   empty heartbeat inventory and one resumable checkpoint. Joe supplied the
   requested `human-blocker-uat-cleared` token before fresh substantive work.

The exact visible receipts are durable on `prime-claw-h6w.24.2`. Hidden
capability gating and non-accumulation remain direct-test contracts, not claims
from manual observation.

## Incident lineage

On Prime Agent `0.9.6`, operator-observed queued pause/resume transport produced
two unsafe outcomes: a pause steer interrupted the very work that needed to
create monitoring, and a queued resume outlived its premise and arrived after
later work had already completed. Those incidents motivated the no-steering,
fresh-goal design. They do not establish behavior on `0.9.7` and are retained
only as design provenance.
