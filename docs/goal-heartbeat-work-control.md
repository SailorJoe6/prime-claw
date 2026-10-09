# Goal and heartbeat work control

Prime Claw's selected global role kernel provides only neutral role and authority
invariants. The managed global Conversation guide provides detailed judgment for
managed Conversation work. Ordinary project work uses the plugin-managed user-level
`goals-and-heartbeats` skill; Ralph `/execute` applies the same generic ownership
rules while implementing plans. No project APPEND source or second plugin-authored
work-control policy remains.

## Supported runtime boundary

The final role-protocol manager requires the recorded legacy APPEND region to be
absent. Managed owner and EPISODE provider calls are guarded by the exact
generated neutral role kernel in the selected global context. There is no
separate `before_agent_start` policy overlay, capability gate,
`PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` block, tool, or autonomous
slash-command transport.

The narrow `goal-continuation-nudge.ts` extension is reinforcement, not a second
policy. It observes structured `goal_context` continuation messages, deduplicates
by goal identity and continuation count, and measures a per-session rapid-repeat
streak. Only when the managed plugin Markdown threshold is reached does it append
the exact body of `skills/goals-and-heartbeats/CONTINUATION.md` to the provider
context. The same managed Markdown frontmatter owns the minimum streak and
elapsed-time window. TypeScript contains no model-facing goal or heartbeat advice,
does not inspect assistant prose, delay continuation delivery, create a timer, or
mutate the stored transcript. Session start, tree navigation, and shutdown clear
transient streak state. Missing, invalid, symlinked, nonregular, or oversized
managed policy is a safe no-op.

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
absent from the twelve-file managed TypeScript source set. The older
`extensions/goal-blocker-control.ts` is also absent. Apply/check treat both as
retired managed destinations:

- every current and retired destination is checked before the first mutation;
- apply removes a stale regular installed copy and rejects directories or symlinks;
- check rejects any surviving stale or unsafe copy; and
- unrelated installed extensions and unmanaged APPEND_SYSTEM bytes are preserved.

The project-local `oversee-episode` skill, its discovery link, the standalone
reviewer profile, the legacy APPEND source, and the append-only manager are
absent. The managed global Conversation and EXPERT skills retain their exact
role-specific authority. The goals-and-heartbeats `SKILL.md` and `CONTINUATION.md` are one plugin-owned,
user-level capability bundle. The lifecycle hook only routes that managed reminder
at a repeated continuation signal.

Final apply/check intentionally require exact owned bridge state; they are not a
fresh-root diagnostic. Docker Tier 1 seeds that historical predecessor state in
an isolated container before testing the transition. Bare commands fail closed.
Do not invoke user-global apply/check directly.

Installation is not activation. `/reload`, elapsed time, copy success, a fresh
process, or container evidence alone cannot prove the loaded generation changed.
After the exact final candidate is accepted and Gate B is separately authorized,
launch the bounded cutover coordinator once from a separate terminal with the
verified private accepted-bridge bundle, exact operation input, private state
directory, and full accepted-commit authorization. It proves quiescence,
fast-forwards primary `main`, runs guarded user-global apply/check, retains the
installation receipt, performs one full restart, and emits the exact
owner/episode/ordinary resume checklist.

On failure, follow the coordinator's last proven checkpoint. Restore exact bridge
preimages from the verified private bundle or installation receipt and repeat the
full quiesce/restart discipline only under renewed operator authority. Never retry
an uncertain coordinator result or improvise direct host apply/check. Saved
sessions are resumed, never deleted.

## Automated evidence

Coverage proves:

- the neutral kernel and managed Conversation guide contain their separated
  invariant and goal/heartbeat contracts;
- the managed plugin has exactly twelve TypeScript files and no retired source,
  overlay sentinel, pause/resume tool, or autonomous slash-command transport;
- the rapid-repeat nudge uses structured goal identity, deduplicates repeated
  provider calls, resets across goal/user/session boundaries, and loads its
  threshold and exact reminder from managed plugin Markdown;
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
