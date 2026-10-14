---
id: PRIMECLAW-10.33
title: Design probable-hung episode tool detection and owner-scoped recovery
status: In Design
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-14 14:45'
labels:
  - design
  - episode-loop
  - oversight
  - phase4
  - ralph
  - reliability
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem
Episode oversight currently exposes session liveness but not reliable material-progress or active-tool state. A sibling episode can remain `running` while a persistent REPL/tool call is hung, leaving the owner unable to distinguish useful long work from a stall or to interrupt the exact owned tool safely.

## Incident evidence
During the project-wide-testing Slice-1 R1–R6 repair, owner session `01a0fe2e-e0dd-7638-9b4c-0b118182c6e3` supervised episode `01a0fee6-4ed7-725a-8cf9-0ba9fbf056b9` with one 15-minute read-only heartbeat. The episode spent roughly eight hours inside a poorly bounded regex operation in its persistent REPL. `list_agents` stayed `running`/non-streaming with no queue, while HEAD, worktree state, and file set stopped changing. No external process identified the in-kernel work. A single quiescence message queued but could not run. Supported sibling observation could not expose the active tool/start/last-output pairing, and no owner-scoped sibling interrupt existed. Joe manually interrupted the TUI; uncommitted work survived and execution resumed. Repeated unchanged-tick messages also added noise instead of identifying the probable stall.

## Requested outcome
Design a Prime Claw solution that separates progress from liveness, detects probable episode stalls with bounded false-positive controls, produces one useful alert, and defines safe owner handling for the exact owned episode. Determine what can be built through supported public Prime Agent/plugin interfaces. If safe active-tool telemetry or interrupt is not publicly available, record that product constraint and design the best bounded operator-assisted fallback.

## Requirement provenance and scope
Joe explicitly requested this design/tracking Bead. The incident signals and acceptance questions are design inputs, not authorization for a specific architecture. This Bead authorizes design and dependency discovery only. It does not authorize implementation, changes to the active project-wide-testing episode, a Prime Agent source patch/fork/PR, host process killing, deployment, merge, or automated interruption.

## Legacy design

Design from supported Prime Claw plugin and Prime Agent public interfaces only. Begin with a capability/telemetry feasibility audit rather than assuming interrupt support. Model progress as multiple corroborating signals, not `status=running`. Keep detection advisory until confidence and operator-confirmation rules are reviewed. Prefer programmatic telemetry; TUI/Computer Use is an explicit fallback only when available and authorized. Preserve exact owner/episode identity and an audit receipt for every alert or interrupt attempt. Treat expensive regex and other uncertain computations as bounded subprocess work with inspectable handles.

## Legacy notes

Immediate known constraint: current sibling APIs provide `list_agents`, but incident-time `get_agent`/`recent_messages` could return `Unknown active session` for the same active sibling, and no supported owner-scoped sibling current-tool interrupt was available. Confirm this against current public interfaces during design. Prime Agent is upstream and not a development target; an upstream limitation must be reported, not patched here. Existing behavioral mitigations include silent unchanged heartbeat ticks, material-progress tracking, one suspected-stall alert after repeated unchanged intervals, one quiescence question, explicit uncertainty, and manual-interrupt escalation when no supported API exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A reviewed design defines material progress separately from session liveness using supported signals such as last message/tool output, file or commit change, explicit progress notes, and terminal reports.
- [ ] #2 Probable-stall policy uses bounded unchanged intervals, distinguishes genuine long work with progress, emits one alert with suppression, and keeps unchanged heartbeat ticks silent.
- [ ] #3 The design specifies safe public active-tool telemetry: opaque tool class/name, call identity, start time, last-output time, and running/terminal state without exposing raw private command content by default; unsupported fields are documented as constraints.
- [ ] #4 The design either specifies an identity-checked, audited owner-scoped interrupt for the current tool call of its exact owned episode through supported public interfaces, or records that the public interface cannot support it and defines an operator-confirmed fallback. It never proposes a Prime Agent source patch.
- [ ] #5 Safety boundaries prohibit automatic OS kills, broad/private process inspection, foreign-session mutation, credentials/config inspection, synthetic canaries in active production sessions, and unconfirmed interruption except under an already approved bounded contract.
- [ ] #6 Long-running episode guidance requires nonblocking owned handles, progress publication, input bounds/timeouts, and killable subprocesses for potentially unbounded regex/CPU work instead of persistent-REPL execution.
- [ ] #7 An isolated synthetic test plan covers genuine long progress, in-REPL CPU hang, external command hang, queued message during a hang, manual/supported recovery, one-shot alert suppression, false-positive limits, preserved uncommitted work, and cleanup of disposable sessions/worktrees/artifacts.
- [ ] #8 The design identifies dependencies and rollout gates, remains separate from the active testing-framework Slice-1 repair, and receives operator review before any implementation Bead or specification is promoted.
<!-- AC:END -->
