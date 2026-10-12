---
id: PRIMECLAW-10.1.2
title: >-
  Phase 4a.2: treat /handoff arguments as compaction guidance and isolate
  session state
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
updated_date: '2026-10-12 01:02'
labels:
  - compaction
  - handoff
  - phase4
  - phase4a
dependencies:
  - PRIMECLAW-10.1.1
parent_task_id: PRIMECLAW-10.1
priority: p1
type: bug
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correct the native `/handoff` command contract and harden its state. Prime Agent recognizes the command only when `/handoff` is the first non-whitespace text in the submitted message; that standard slash-command behavior is expected. It passes all text after `/handoff` to the handler as one free-form `args` string. The current extension incorrectly treats that string as a next-skill name, writes it to `chain-next`, and later tries to load `.ralph/skills/<args>/SKILL.md`. Thus `/handoff and focus on bead xyz` loses the guidance and breaks execute injection. Required product behavior: the next skill is always `execute`; any trailing text is operator-provided compaction guidance. Also isolate pending state per Prime Agent session so sessions sharing a checkout cannot overwrite or consume one another's handoff.

## Legacy design

Binding command contract:
1. `/handoff` must continue to load the canonical project-customizable `.ralph/skills/handoff/SKILL.md` and chain to canonical `.ralph/skills/execute/SKILL.md` after successful compaction.
2. The next phase is fixed to `execute`. Remove custom next-skill targeting entirely. Do not add `--next`, positional target syntax, target allowlists, or any path derived from user arguments.
3. Treat the complete trimmed text after `/handoff` as optional natural-language compaction guidance. Inject it into the handoff user message as clearly delimited operator guidance alongside, but not inside or instead of, the canonical handoff markdown. With no trailing text, behavior remains the existing default handoff.
4. Update the canonical handoff workflow only as needed to require that supplied guidance shape the `compact.run(...)` focus hint and the durable handoff context. Keep workflow prose canonical in `.ralph/skills`; do not duplicate the handoff procedure in TypeScript.
5. Inline prose such as `I think you should /handoff now` remains an ordinary message because native slash commands only execute at the start of a submission. Document this; do not add substring scanning or an input hook.
6. Replace the project-wide pending marker with stable session-scoped, code-owned state that survives that session's compaction and cannot cross sessions. Inspect ExtensionAPI contexts for a real session identifier/state facility; do not invent identity from CWD, path, or process ID.
7. Define cleanup for stale legacy `.prime/agent/state/chain-next` state and retain consume-once semantics.

Example required behavior:
- `/handoff` → canonical handoff → focused compaction → canonical execute.
- `/handoff and focus on being ready to implement bead xyzpdq` → canonical handoff plus the exact guidance `and focus on being ready to implement bead xyzpdq` → compaction focus reflects that guidance → canonical execute.
- No input can select another follow-on skill.

## Legacy notes

2026-09-16 ROOT-CAUSE CONFIRMATION: Verified against installed Prime Agent 0.9.5. Interactive input is outer-trimmed, then `parseSlashCommand` requires `text.startsWith("/")`; its regex captures the entire remainder after the command as `args`, and `_executeExtensionCommand` passes those args unchanged to the registered handler. Current `handoff-chain.ts` does `const next = args.trim() || "execute"`, persists that value, then uses it as `.ralph/skills/<next>/SKILL.md` after compaction. Therefore natural-language trailing guidance currently breaks the chain and is not delivered to the handoff agent. Joe explicitly decided there is no need for alternate targets now and likely never will: fixed `execute` plus optional natural-language compaction guidance is the required solution. Do not begin implementation until this bead is claimed in a future execution slice.

2026-09-17 IMPLEMENTED: `/handoff` now fixes the follow-on phase to canonical `execute`; complete trimmed trailing text is appended outside the canonical skill wrapper as `<operator-compaction-guidance>`, and the canonical handoff skill requires it in `await compact.run(focus_hint)`. Pending state moved from the CWD-wide file to an in-memory set keyed by documented `ctx.sessionManager.getSessionId()`; one shared extension closure is tested with two session IDs, consume-once semantics, lifecycle cleanup, and legacy `.prime/agent/state/chain-next` deletion. The old custom-target test was removed. Focused gate: `pytest -q tests/test_handoff_chain_extension.py` = 4 passed. Full gate after implementation: `pytest -q tests/` = 201 passed, 11 pre-existing `load_module()` deprecation warnings. Source review found a separate Prime Agent 0.9.5 shared-runtime `pi.sendUserMessage` routing risk for concurrent root/RLM-child delivery; follow-up `prime-claw-f81.3` records the required real integration proof or harness fix and depends on this bead.

2026-09-17 COMPLETE: Landed and pushed commit `c1c98a8` with fixed execute routing, exact free-form guidance injection, canonical compact focus instructions, session-UUID-keyed in-memory pending state, legacy-marker cleanup, docs, and regressions. Final gates: focused 4 passed; full repository 201 passed with 11 pre-existing deprecation warnings; `git diff --check` clean. The real Prime Agent RPC loader smoke is included in the focused gate. Concurrent Slice 4R files were explicitly excluded from the commit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Complete when: (1) `/handoff` with no arguments performs canonical handoff, compacts, and injects canonical execute once; (2) every character after `/handoff`, after outer trimming, is treated as free-form operator compaction guidance and is present in the injected handoff message; (3) supplied guidance is demonstrably incorporated into the handoff skill's `compact.run(...)` focus instructions rather than interpreted as a skill/path; (4) execute is the only follow-on skill and tests prove arguments cannot select or construct another skill path; (5) inline `/handoff` text that does not start the message is documented as ordinary conversation, with no substring-trigger behavior added; (6) two sessions sharing one CWD cannot overwrite or consume each other's pending chain; (7) state is consumed once by the intended session and stale legacy-marker behavior is documented/tested; (8) tests replace the old custom-target expectation with free-form guidance cases, including spaces and punctuation; and (9) the real Prime Agent loader smoke and full repository suite pass.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed /handoff guidance semantics and session-scoped pending state; commit c1c98a8 pushed; 201 tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
