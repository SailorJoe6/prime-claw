# J. Control long-running agent work

## US-25 — Keep active goals moving without continuation spam

**As any working agent, I want one bounded goal while active and one heartbeat
while waiting on non-human work, so that interrupted work resumes without
endless continuation messages.**

The intended lifecycle is:

- active work → one bounded goal;
- external machine or agent wait → complete the goal and create a heartbeat;
- human wait → no goal and no heartbeat;
- resumed work → remove the heartbeat and create a new bounded goal;
- terminal completion → neither control object remains.

## US-26 — Restore work-control guidance after context transitions

**As a working agent, I want a concise managed reminder when compaction or rapid
continuation makes the work-control contract easy to forget.**

The extension silently injects a non-turn reminder after compaction and appends
a reminder after the configured repeated-continuation pattern. It validates a
small regular configuration file and fails to a no-op on malformed or unsafe
configuration. This is advisory guidance, not an autonomous scheduler or a
second enforcement engine.

## Primary implementation surfaces

- `src/prime-agent-plugin/skills/goals-and-heartbeats/SKILL.md`
- `src/prime-agent-plugin/skills/goals-and-heartbeats/CONTINUATION.md`
- `src/prime-agent-plugin/extensions/goal-continuation-nudge.ts`
- `src/prime-agent-plugin/ROLE_KERNEL.md`

## Design reference

- [`goal-heartbeat-work-control.md`](../goal-heartbeat-work-control.md)
