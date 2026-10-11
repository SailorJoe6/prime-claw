# DD-003 — Qualify only the exact Prime Agent 0.9.8 plugin line

- **Status:** accepted
- **Stories:** [US-01](../user-stories/A-installation.md), [US-27](../user-stories/K-developer-safety.md)

## Observed context

Prime Claw has qualified the TypeScript extension/plugin framework and daemon,
session, compaction, messaging, and provider contracts in the maintained
`cwd-fix-v0.9.8-r1` line. A failed simpler attempt used the mutable public
installer: it selected a different Rust product that also printed `0.9.8`, did
not expose the expected TypeScript kernel/bootstrap, and could not be replaced
by `npm install -g prime-agent@0.9.8`. Version text is therefore not identity.

Evidence and exact source identity:
[`prime-agent-installation.md`](../prime-agent-installation.md),
[`prime-agent-v098-candidate-blocked-20261010.md`](../evidence/prime-agent-v098-candidate-blocked-20261010.md), successful disposable extension-loading evidence in
[`prime-agent-v098-ts-candidate-20261010.md`](../evidence/prime-agent-v098-ts-candidate-20261010.md), and accepted live daemon/runtime evidence in
[`prime-agent-v098-v2-active-acceptance-20261010.md`](../evidence/prime-agent-v098-v2-active-acceptance-20261010.md).

The operator's product boundary states that the 0.10 rewrite removed the plugin
framework Prime Claw needs. This repository retains no primary 0.10 probe or
source citation proving that history. The evidence-backed conclusion needed
here is narrower: no later/Rust line is qualified, and compatibility must not be
claimed without a separate proof.

## Decision

Support exactly the maintained TypeScript `cwd-fix-v0.9.8-r1` source identity
(tag object, commit, tree, lockfile, and build ID), not a loose semver string.
Treat 0.10 or later as a separate compatibility and requalification project.
Do not patch or fork upstream Prime Agent from this repository as a workaround;
solve within Prime Claw's plugin/public-interface boundary or report the
constraint.

## Rejected simpler alternative

A routine “latest” or version-only bump can install an unqualified runtime with
no proven compatible extension host. Making tests pass by editing an upstream
checkout would also move the solution outside this project's supported surface.

## Regression anchors

- `tests/container/test_source_generation_probe.py`
- `tests/test_project_initialization.py::test_first_native_v098_session_discovers_initialized_skills`
- `tests/test_reviewed_plan_extension.py::test_real_v098_fresh_session_is_flushed_before_daemon_publication`
- `tests/test_conversation_oversight_native.py::test_native_actual_compaction_reinjects_one_full_nonturn_guide`
- exact-source Tier-1 provenance and the accepted v0.9.8 runtime evidence above

## Revisit condition

Revisit only through an explicitly approved compatibility project after a later
Prime Agent exposes a supported equivalent plugin/extension API and the full
Docker, daemon, session, command/tool, compaction, and Episode lifecycle suite
is requalified.
