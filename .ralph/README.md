# .ralph — prime-claw planning & skills layout

This directory holds the Ralph-style planning layout prime-claw uses, with
prime-agent-native skills.

- `skills/<phase>/SKILL.md` — the seven phase skills, imported verbatim from
  `~/gitlab_local/ralph-pva/.ralph/skills` (Joe's hand-built prime-agent set)
  as the Phase 1 starting point. They will diverge as prime-claw validates
  them by manual driving.
- `plans/` — created on demand by the design/plan skills. The design and
  spec-it-out skills produce `SPECIFICATION.md` + `REQUIREMENTS.md` +
  `DECISIONS.md`; the plan skill produces `EXECUTION_PLAN.md`; finished work
  archives to `plans/archive/`; blocked work to `plans/blocked/`.

Provenance note: these skills are already prime-agent-native — handoff
triggers targeted compaction, execute manages goals/heartbeats/subagents and
the blocked→goal-complete→pause-heartbeat protocol. They are the reference
implementation for the conversation→episode work in LONG_RANGE_PLAN.md.
