# Goal and heartbeat work control

Prime Claw's one managed lean session block in
`src/prime-agent-plugin/APPEND_SYSTEM.md` owns the model-facing goal and heartbeat
rules. Ralph `/execute` applies those generic rules while implementing plans; it
does not install a second policy.

## Supported runtime boundary

The APPEND_SYSTEM block is installed with the managed Prime Claw plugin and is
validated byte-for-byte by the conversation lifecycle extension whenever trusted
active state requires it. There is no separate `before_agent_start` overlay,
capability gate, `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` block, tool, message,
or autonomous slash-command transport.

The block states the bounded control contract directly:

- substantive active work maintains one compatible goal so interrupted work can resume;
- before waiting on an exact observable process or agent, establish its heartbeat
  and complete the active-work goal;
- after a terminal observation, remove the heartbeat and create a fresh goal only
  if substantive work remains;
- waiting on a person completes the current goal and creates no heartbeat; and
- completed work retains neither object.

## Ownership model

Ownership follows the next useful action:

| State | Owner | Persistent control |
|---|---|---|
| Active agent work | Agent | One compatible bounded goal |
| Observable external wait | Exact process, job, deployment, or worker | One bounded heartbeat per independent wait |
| Human-only blocker | Operator or external authority | No polling heartbeat; close the active-work epoch at the actionable handoff |
| Finished | Nobody | No outcome-owned goal or heartbeat remains |

A goal and heartbeat may overlap only during the short transfer that verifies
monitoring before completing the active-work goal, or when each owns independent
work. A nonterminal observation reports only meaningful change and never restarts
work. Terminal handling captures evidence, deletes the exact monitor, performs
bounded cleanup, and proceeds idempotently.

Prime Claw never injects, simulates, or calls native `/goal pause` or
`/goal resume`. Human use of Prime Agent's native goal commands remains
authoritative.

## Retired extension migration

`src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts` is retired and
absent from the eight-file managed source set. The older
`extensions/goal-blocker-control.ts` is also absent. Apply/check treat both as
retired managed destinations:

- every current and retired destination is checked before the first mutation;
- apply removes a stale regular installed copy and rejects directories or symlinks;
- check rejects any surviving stale or unsafe copy; and
- unrelated installed extensions and unmanaged APPEND_SYSTEM bytes are preserved.

The installer no longer reads or validates the project-local `oversee-episode`
skill. That skill, its discovery link, and its reviewer profile remain temporary
loaded-generation compatibility resources until accepted cutover evidence.

Apply/check are safe to test under an explicitly isolated
`PRIME_AGENT_PLUGIN_ROOT`; all Prime Agent/plugin execution remains Docker tier
1. Bare commands fail closed. Only an accepted deployment checkpoint may be
installed user-globally, from the primary `main` checkout with explicit
`--user-global`:

```sh
scripts/apply-prime-agent-plugin.sh --user-global
scripts/check-prime-agent-plugin.sh --user-global
```

`--user-global` is refused from linked worktrees.

Installation is not activation. `/reload`, elapsed time, copy success, a fresh
process, or container evidence alone cannot prove the loaded generation changed.
Quiesce active work, perform one coordinated full Prime Agent daemon/harness
restart, and resume the exact owner, exact episode, and preidentified ordinary
project conversation. The operator accepts that UAT before compatibility
cleanup. On failure, retain or restore compatibility resources, reapply the
known-good plugin generation, and repeat the same full-restart discipline. Saved
sessions are resumed, never deleted.

## Automated evidence

Coverage proves:

- the managed block contains the required goal/heartbeat rules and stays within
  its 250-word bound;
- the managed plugin has exactly eight TypeScript files and no retired source,
  overlay sentinel, pause/resume tool, or autonomous slash-command transport;
- installer migration removes a stale regular retired entry, rejects unsafe
  destination types before mutation, preserves unrelated files, and converges;
- provider contexts contain one managed lean block and no separate detailed
  work-control overlay; and
- lifecycle tests cover active work, waits, reload/resume, and post-compaction
  operation without the old oversight skill.

## Historical evidence and incident lineage

The operator-controlled restart and visible manual UAT completed on 2026-09-30
against accepted repair `486f4af62b7c1088a0ad10eb9ca05a2e0f735401`. It proved
the then-current no-steering goal/heartbeat semantics and remains durable on
`prime-claw-h6w.24.2`; it does not replace this transition's restart gate.

On Prime Agent `0.9.6`, queued pause/resume transport interrupted active work and
later delivered after its premise expired. Those incidents motivated the
no-steering, fresh-goal design. They are design provenance, not claims about the
current managed generation. Prime Claw does not patch or roll back Prime Agent.
