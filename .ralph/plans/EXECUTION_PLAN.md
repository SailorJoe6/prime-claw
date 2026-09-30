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
- Missing capabilities are a silent no-op. Pre-existing, duplicate, or malformed
  policy markers fail closed.
- Keep policy contribution transient, deterministic, non-accumulating, and no
  more than 4,000 UTF-8 bytes excluding markers/sentinel.
- Use only proportionate non-native automation plus manual UAT. Never launch a
  second Prime Agent process while the daemon is active.

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

- [x] Add direct Node tests for compatible/incompatible capability shapes,
  default selected tools, marker collisions, deterministic bounded content,
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
- [ ] Commit and push one clean candidate.
- [ ] Obtain fresh owner and EXPERT review of the exact candidate; amend and
  re-run checks if required.
- [ ] Run managed `scripts/apply-prime-agent-plugin.sh` and
  `scripts/check-prime-agent-plugin.sh` against the user-global copy.
- [ ] Verify the installed files match the candidate and the old installed entry
  is absent.
- [ ] Stop before restart. Report that PID 22654 (or whichever sole process is
  still loaded) has not loaded the new generation.

## Checkpoint 2 — restart and manual UAT

Bead: `prime-claw-h6w.24.2`.

This checkpoint is operator-controlled. After Checkpoint 1 apply/check:

1. Quiesce work and restart the sole Prime Agent process once using the
   operator's normal service action. Do not start a concurrent instance.
2. In a fresh session, Joe confirms `pause_thread_goal` and
   `resume_thread_goal` are absent.
3. Joe observes a compatible normal session transfer active work from a bounded
   goal to an exact monitored wait, then create a fresh goal only if substantive
   work remains.
4. Joe observes a human-only blocker produce one actionable checkpoint and no
   heartbeat that merely polls the person.
5. Joe confirms an incompatible capability configuration receives no policy.
6. Joe confirms no visible policy accumulation across ordinary turns and saved
   session resume.
7. Record only Joe's observed pass/fail. On pass, finish docs/Beads and archive
   the active plan/spec. On failure, retain the exact observation and repair as
   a newly approved bounded candidate.

## Validation record

### Checkpoint 1 focused tests

Final pre-commit evidence:

- Focused tests:
  `pytest -q tests/test_goal_heartbeat_work_control_extension.py tests/test_prime_agent_plugin_install.py tests/test_execute_skill.py`
  initially passed `19` tests and `9` subtests. The later full safe suite includes
  the added unsafe-obsolete-path cases and the final collision-abort behavior.
- Source-audited safe Python command explicitly included 18 non-native files and
  excluded the five whole files that launch Prime Agent. Result:
  `268 passed, 11 subtests passed` in `18.32s`; 11 existing Python deprecation
  warnings.
- All six mock-based Node extension suites passed `134` tests in `27.1s`.
- `bash -n scripts/apply-prime-agent-plugin.sh scripts/check-prime-agent-plugin.sh`
  and `git diff --check` passed.
- Policy body is 2,503 UTF-8 bytes before template interpolation, below the
  4,000-byte bound; managed plugin source contains one V1 sentinel owner.

No native Prime Agent probe or full native suite ran. The sole daemon remained
untouched.

### Safe-suite boundary

The safe command enumerated every non-native Python file explicitly. It excluded
`test_conversation_oversight_native.py`, `test_handoff_chain_extension.py`,
`test_project_conversation_extension.py`, `test_reviewed_plan_extension.py`, and
`test_reviewed_plan_native_discovery.py` as whole files because each contains at
least one real Prime Agent launch. Do not use `pytest tests` while the sole daemon
is active.

## Current stop boundary

Checkpoint 1 ends after one clean pushed candidate, fresh review, and managed
apply/check. Installation does not imply activation. The episode must stop and
hand the exact restart action plus concise manual checklist to the operator.
