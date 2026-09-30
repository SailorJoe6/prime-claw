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
- [ ] Preserve exactly one mandatory final exact-candidate EXPERT gate after
  manual UAT and final artifact reconciliation.
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

## Current stop boundary

Checkpoint 1 is installed and checked, but not activated. Daemon PID 22654 still
owns the pre-install loaded generation. Stop before restart. The operator's next
action is to quiesce work and restart that sole daemon once using the normal
service action, then perform only the three visible manual-UAT checks in
Checkpoint 2. Exactly one mandatory final exact-candidate EXPERT review remains
after manual UAT and final artifact reconciliation.
