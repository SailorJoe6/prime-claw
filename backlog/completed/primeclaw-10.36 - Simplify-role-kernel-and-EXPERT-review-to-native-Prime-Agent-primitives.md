---
id: PRIMECLAW-10.36
title: Simplify role kernel and EXPERT review to native Prime Agent primitives
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies:
  - PRIMECLAW-24
parent_task_id: PRIMECLAW-10
priority: p1
type: feature
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

The current Prime Claw role-kernel and official EXPERT implementation is grossly over-engineered. It duplicates model-facing policy into generated TypeScript, treats prompt bytes and hashes as runtime authority, replaces the EXPERT child system prompt, and builds a private multi-phase review state machine around capabilities Prime Agent already supplies.

Current EXPERT surfaces include a 116-line launcher skill, a 1,222-line Python package, a nested reviewer Markdown file, a 393-line TypeScript admission hook, private phase files, custom submission/settlement/disposition/close/purge operations, and extensive hash/replay bindings. The new private-launch path has not successfully launched in the observed user-global environment; earlier successful EXPERT reviews used predecessor mechanisms.

## Accepted product requirements

1. Accept a normal review request rather than requiring a fixed packet schema. Resolve the repository and commit from clear current context, while allowing the caller to override the repository, commit, model, focus, or supporting paths. A commit may come from a managed EPISODE report, but active-EPISODE ownership, worktree, branch, push-state, or lifecycle provenance is not an admission requirement. If necessary review context remains unclear, the EXPERT asks the caller instead of guessing or failing a custom admission gate.
2. The review model is configurable. Use an operator-specified model when supplied. Otherwise default to `openai-codex/gpt-6-astra`. If unavailable, select a reasonably strong available model suited to the review and report the actual selected model. Request `max` reasoning by default; if a fallback model does not support it, use that model's strongest supported reasoning level. Consult the operator only when no suitable model is available.
3. The reviewer evaluates the exact candidate against its approved specification, execution plan, evidence, and bounded product contract.
4. The reviewer returns ordinary prose with a short conclusion followed by material findings. Each material finding explains its evidence, impact, and a general repair direction. Do not require fixed verdict names, JSON, exact field names, or empty sections.
5. Every finding includes a clear, proportionate repair direction: enough general guidance that the programmer understands the intended fix, but no code and no unnecessarily prescriptive implementation.
6. The owning Conversation treats the review as bounded evidence and decides what to do next; the review does not supply product, merge, or operator authority.
7. Repository snapshot/hash/unchanged verification is not a product requirement and must not be retained merely because the current implementation added it.

## Accepted role-kernel decisions

- `src/prime-agent-plugin/ROLE_KERNEL.md` remains the single canonical source and stays at the plugin root because it is an always-on installation input, not a skill or extension-support module.
- The role kernel is shared advisory orientation. Prime Agent loads it through the managed global `AGENTS.md` block so CONVERSATION, EPISODE, and EXPERT each understand their own responsibility and the other roles they use. For this issue, retain the existing useful role orientation and remove the "trusted plugin state" claims; do not otherwise redesign the full kernel while simplifying EXPERT.
- Roles are skill-based, not authenticated identities. Remove claims that role or ownership authority comes from "trusted plugin state." The plugin may help invoke the right role-specific skill at the right lifecycle moment, but it must not build a parallel role-authentication system.
- Preserve EXPERT in the shared role model as the delegated independent-review role. It receives its role through the review skill and parent task, not private identity state.
- Remove generated role-kernel TypeScript, the generator/synchronization step, runtime SHA bindings, exact prompt scanning, and `assertIdentityKernel()`.
- Do not replace normal Conversation, EPISODE, or EXPERT prompts with the kernel text.

## Accepted EXPERT design

- Rename the capability to one plugin-managed Markdown orchestration skill: `prime-claw-expert-review`. Remove the retired `prime-claw-official-expert-review` name and references because the workflow no longer carries special runtime authority. During an explicitly approved user-global cutover, install the new skill and narrowly remove the old installed directory only after verifying it matches the previously plugin-managed layout; never leave both workflows installed. Also remove the known unshipped private lifecycle state directory at `$PRIME_AGENT_CODING_AGENT_DIR/prime-claw-private/expert-review-launches` (normally `~/.prime/agent/prime-claw-private/expert-review-launches`) with exact-root and symlink safety checks. This is direct cleanup for Joe's single test installation, not a compatibility migration framework.
- Simplify that skill to use Prime Agent public primitives: `rlm.find_models`, safe `rlm.spawn` bootstrap, `agent_message.send`, observation/collection, and normal child cleanup. The reviewer sends its prose review through ordinary parent messaging; after any clarification is complete, the caller deletes the child. Retain no custom settlement, disposition, or purge record.
- The child uses Prime Agent's normal system prompt. Review role, rubric, and exact candidate packet arrive once as the ordinary parent-to-child review task after bootstrap.
- Merge the useful reviewer rubric into the same `prime-claw-expert-review/SKILL.md`; remove the separate nested `reviewer.md`. Preserve its scope discipline, evidence and realistic-impact threshold, actionable-but-non-code remediation guidance, regression/test considerations where applicable, and preference for deletion or ordinary recovery over bespoke machinery. Remove its fixed verdict enum, exact JSON schema, `submit()` requirement, and all lifecycle-protocol language.
- Remove the custom Python review lifecycle package, `pyproject.toml`, private phase files, `expert-review-reservation.ts`, custom prompt/context rewriting, and custom `submit`, `settle`, `record_disposition`, `close`, `purge`, and `cancel_stale` APIs.
- Remove package, kernel, owner-generation, repository-status, and private-state hashes that exist only to reconcile the duplicated lifecycle.
- The Conversation oversight skill must explicitly name and load `prime-claw-expert-review` when the existing policy says project policy requires it or material risk warrants independent review. Preserve the current autonomous invocation guidance and its existing scope/repair-cycle safeguards; do not add new cost or overengineering trigger language without usage evidence. The EXPERT skill description must clearly route direct review requests to it. No dedicated launch tool or lifecycle hook is required.
- Accept a normal review request and resolve explicit review values from context; do not require callers to construct a fixed packet object. Support optional caller overrides for repository, commit, model, focus, and supporting paths. If necessary context is unclear, the EXPERT asks the caller through ordinary parent/child messaging rather than guessing or invoking a private admission protocol.
- Do not require the commit to come from an active owned EPISODE or rebuild managed candidate-provenance validation around the review workflow. Generic direct review and managed-episode review use the same simple mechanism.

## Scope boundary

This issue simplifies EXPERT now. It does not implement the later Conversation and EPISODE simplification, but it must not preserve or extend their current trusted-state model. The accepted architectural direction is that CONVERSATION and EPISODE will also become skill-based, with the plugin limited to helping invoke the appropriate skills at lifecycle boundaries. Their project expectation file, owner markers, bounded identity, and one-use guide machinery will be removed or simplified in separate focused work.

## Legacy design

Use Prime Agent's native session hierarchy and messaging rather than rebuilding them in plugin-private state. Keep role behavior in Markdown skills and shared orientation in the role kernel. Use the plugin only where it helps invoke the appropriate skills at lifecycle boundaries; do not treat plugin-private state as role authentication. Prefer deletion over compatibility shims. Preserve the repository rule that plugin candidates are validated only in Docker and are not applied user-globally until explicit acceptance and coordinated restart authorization.

Implementation should be split into reviewable commits where practical: (1) single-source advisory role kernel cleanup; (2) native Markdown-only EXPERT workflow and explicit Conversation routing; (3) deletion of retired Python/TypeScript/private-state surfaces and tests. Do not add a replacement hash, state machine, prompt override, or launch tool.

## Legacy notes

Related accepted work is tracked separately: `prime-claw-ajt` removes dead `.prime/agent/state/chain-next` migration cleanup; `prime-claw-444` makes `skills/goals-and-heartbeats/SKILL.md` and `CONTINUATION.md` one plugin-managed user-level capability bundle. Do not duplicate those changes here.

Decision source: operator lifecycle review in Prime Agent session `01a11eba-0f08-75ac-b5d7-a578bac19b26`, 2026-10-09. The model default is `gpt-6-astra`; an earlier `gpt-5.6-astra` mention was explicitly corrected as a typo.

Accepted clarification: the official EXPERT workflow may review any exact caller-supplied repository and commit. Requiring a currently owned EPISODE was rejected as unnecessary process; managed EPISODE output is only one common source.

Accepted input policy: no rigid review-packet schema. Resolve clear context, accept optional overrides, and let the EXPERT ask the caller through ordinary messaging when necessary context is unclear.

Accepted output policy: no fixed verdict vocabulary. The EXPERT may state its conclusion in ordinary prose rather than choosing PASS/BLOCK/ADVISORY/SPEC_QUESTION.

Accepted report shape: short prose conclusion followed by material findings. Findings explain evidence, impact, and general repair direction. No JSON, exact field names, empty sections, or fixed verdict enum.

Accepted file layout: merge the useful `reviewer.md` judgment guidance into the single orchestration `SKILL.md`, then delete the separate rubric file. Remove lifecycle protocol and fixed-report machinery while retaining scope discipline and actionable remediation quality.

Accepted completion behavior: review and clarification use ordinary parent/child messages, then the caller deletes the reviewer. No settlement, disposition, purge, or retained reviewer lifecycle.

Accepted invocation policy: preserve the current Conversation guidance (`project policy requires it or material risk warrants an independent review`) and existing safeguards. Do not strengthen it with new cost/overuse wording absent usage evidence.

Accepted reasoning policy: request `max` by default; if the fallback model does not support it, use its strongest supported reasoning level.

Accepted naming: rename the simplified skill to `prime-claw-expert-review`; remove the retired `prime-claw-official-expert-review` name because the workflow no longer has privileged runtime authority.

Accepted cutover cleanup: install the renamed skill and remove only the verified, previously plugin-managed old skill directory. Do not leave both workflows installed.

Accepted private-state cleanup: during approved cutover, safely delete the exact old `prime-claw-private/expert-review-launches` directory. This is an unshipped single-machine cleanup, not a compatibility migration system.

Architectural direction clarified by the operator: all roles are skill-based. The shared kernel orients CONVERSATION, EPISODE, and EXPERT; the plugin only helps invoke the right skills at lifecycle moments. Remove `trusted plugin state` role-authentication language and machinery progressively. This issue completes EXPERT; Conversation and Episode simplification follow separately.

VISION/LONG_RANGE_PLAN alignment: Prime Claw's goal is a persistent native Prime Agent hierarchy, with project-customizable Markdown policy, manual proof first, and plugin code only for transitions/mechanics proven deterministic. For this issue, keep the role kernel's useful cross-role orientation and remove trusted-plugin-state claims; do not redesign the whole kernel as part of EXPERT simplification.
Implementation checkpoint 2026-10-09: accepted h6w.32 source work is complete in the working tree. Replaced the Python/private-state official EXPERT system with one Markdown-only `prime-claw-expert-review` skill using native model discovery, safe bootstrap-then-message RLM spawn, ordinary clarification/return messaging, observation/collection, and normal child deletion. Merged the bounded review rubric; removed fixed packets/verdicts/JSON, lifecycle APIs, reservation hook, prompt replacement, role-kernel generator/runtime authentication, package preflight, and obsolete tests. ROLE_KERNEL.md now gives skill-based cross-role orientation. Conversation oversight routes to the renamed skill. Apply/check install the new skill and safely clean the verified retired skill layout; approved user-global cutover also deletes the exact old private state root. No host/user-global candidate apply occurred.

Validation: focused Node suites 54/54 passed; final maintained Tier 0 `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/ -q -p no:cacheprovider` passed 653 with 76 skipped, 11 warnings, and 75 subtests; focused cleanup/skill tests passed 5/5; `git diff --check`, bash syntax, and Python compilation passed. An isolated scratch-root role bridge plus apply/check passed and removed the old skill while installing the new one. Required Docker `scripts/test-tier1.sh --probe` first confirmed the missing repository `.env`; a supported temporary pinned 0.9.8 selector then reproduced existing blocker prime-claw-c6p before Docker/candidate execution: `ProvenanceError: captured repository mode changed: .agents/skills/blocked`. h6w.32 therefore remains blocked only on c6p for Acceptance 10 Docker validation. No candidate Docker failure is known.
Final validation 2026-10-09: dependency prime-claw-c6p was repaired without weakening symlink target/path safety. Maintained host gate passed 654 tests, 1 skipped, 75 container tests deselected, 75 subtests, 11 warnings. Canonical `TIER1_ENV_FILE=<temporary pinned 0.9.8 selector> scripts/test-tier1.sh --probe` passed fully: immutable image, network absence, plugin checks, offline RPC probe, teardown, and evidence manifest publication. Focused provenance/source-builder gate passed 81 tests and 60 subtests. `git diff --check`, relevant Python compilation, and shell syntax passed. No host/user-global candidate apply or probe occurred; live cutover remains a separate operator-approved action.
Final exact maintained Tier 0 also passed: 654 passed, 76 skipped, 11 warnings, 75 subtests in 60.00s. An independent read-only review of the full combined diff reported no material correctness or security findings; its focused validation passed 90 tests, 29 skipped, and 60 subtests.
Reopened 2026-10-09 after the first explicitly approved user-global refresh exposed a missed real-upgrade regression. `apply-prime-agent-plugin.sh --user-global` stopped before plugin copying with `final removal cannot change the managed role kernel`: the retained bridge-era manager forbids the checked-in final ROLE_KERNEL.md from differing from the exact owned installed bridge block. That contradicts this issue's accepted Markdown-source-of-truth/direct installer behavior. Installed plugin bytes were not advanced; no restart/reload occurred. Narrow repair: retain exact ownership-manifest/preimage validation, allow replacement of only the owned managed block with the accepted kernel, update manifest/receipt atomically, cover bridge→final and final→final kernel refresh, rerun Tier 0/Tier 1, then retry apply/check without restarting.
Upgrade-path repair validation: focused role-cutover/plugin/kernel suite 124 passed, 29 skipped; exact maintained Tier 0 passed 654, 76 skipped, 75 subtests; canonical pinned 0.9.8 Docker `scripts/test-tier1.sh --probe` passed including offline RPC probe, teardown, and manifest publication. Regression proves owned bridge→final and final→final kernel replacement, final check, exact receipt restore, and preservation of existing unowned/drift/path-safety failures. No restart or reload occurred.
Final receipt-aware repair validation: Linux-authoritative role-protocol matrix passed 11/11 in 125.41s; exact maintained Tier 0 passed 654, 76 skipped, 75 subtests; canonical pinned 0.9.8 Tier 1 Docker probe passed with offline RPC, teardown, and evidence publication. Receipt validation proves the context preimage matches owned manifest state, only the managed block bytes may change, metadata is preserved, bridge APPEND removal is exact, final-to-final APPEND is unchanged, manifest transition is bounded, and tampered receipts remain fail-closed.
Approved user-global installation completed after the upgrade-path repair. Applied from clean primary main at commit 19251c4 with external mode-0600 role receipt `/Users/jlanders/.prime-claw-private/receipts/43075b9-role-refresh.json`. The apply's embedded check and a separate `scripts/check-prime-agent-plugin.sh --user-global` both passed, reporting generation final, selected context AGENTS.md, and current inert plugin source. No Prime Agent restart or reload was performed; the operator will handle activation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `ROLE_KERNEL.md` is the only role-kernel policy source; no generated TypeScript or generation script remains.
- [ ] #2 The installer/check path manages the global AGENTS role-kernel block directly from `ROLE_KERNEL.md`.
- [ ] #3 Runtime code does not hash, scan, compare, or authenticate system-prompt kernel bytes, managed actions no longer depend on `assertIdentityKernel()`, and the kernel does not claim roles or ownership derive from trusted plugin state. It presents CONVERSATION, EPISODE, and EXPERT as skill-based responsibilities.
- [ ] #4 Official EXPERT review is driven by one self-contained Markdown `SKILL.md` using public Prime Agent RLM and agent messaging APIs. The useful review rubric is merged into that file; no separate nested reviewer profile remains.
- [ ] #5 Model selection supports explicit override, defaults to `openai-codex/gpt-6-astra`, falls back to a reasonably strong available review model, requests `max` reasoning or the fallback model's strongest supported level, and reports the actual model.
- [ ] #6 The workflow accepts a normal review request, resolves clear repository/commit/scope context, supports optional overrides, and requires no fixed caller packet schema. The reviewer receives the resolved context and returns a short prose conclusion followed by material findings that explain evidence, impact, and proportionate non-code repair direction, without JSON, exact field names, empty sections, or a fixed verdict enum; when necessary context is unclear, it asks the caller through ordinary messaging.
- [ ] #7 Conversation oversight explicitly routes required independent review to `prime-claw-expert-review` by name.
- [ ] #8 The reviewer returns its review through ordinary parent messaging and the caller deletes the child after any clarification is complete. The private EXPERT Python package, pyproject, nested lifecycle APIs, settlement/disposition/purge records, private phase-file protocol, TypeScript reservation/admission hook, whole-system-prompt replacement, and associated obsolete tests/install inventory are removed.
- [ ] #9 No active-EPISODE ownership/provenance gate or repository-unchanged snapshot/hash requirement is introduced or retained; exact managed EPISODE output is one possible review input, not an admission requirement.
- [ ] #10 Focused tests, maintained tier-0 checks, and Docker-only plugin validation pass. No host/user-global candidate apply or probe occurs.
- [ ] #11 The source/apply/check inventory installs `prime-claw-expert-review`; an approved user-global cutover verifies and removes only the known plugin-managed old `prime-claw-official-expert-review` directory, so the two workflows cannot coexist.
- [ ] #12 The approved cutover safely removes the exact old private EXPERT state directory under the coding-agent root, with boundary/symlink checks, because the system is unshipped and only Joe's test installation needs cleanup; no generic migration framework is added.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Validated lifecycle simplification installed user-globally; activation left to operator
<!-- SECTION:FINAL_SUMMARY:END -->
