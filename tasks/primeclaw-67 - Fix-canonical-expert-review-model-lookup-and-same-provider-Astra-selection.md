---
id: PRIMECLAW-67
title: Fix canonical expert-review model lookup and same-provider Astra selection
status: In Planning
assignee: []
created_date: '2026-11-22T03:41:00Z'
updated_date: '2026-11-22T03:43:00Z'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/skills/prime-claw-expert-review/SKILL.md
priority: p0
type: bug
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome and authority
Promote the installed expert-review model-selection bug fix into canonical plugin source. Joe explicitly decided: "That change to global expert review was a bug fix, not a local customization. It needs to be committed as a critical bug fix." The launching Conversation delegated this exact new source fix through normal design, planning, readiness, isolated Episode implementation and independent review. This is implementation authority within this exact scope, not a planning-only request. No additional product decision is open. Final merge remains a separate exact-candidate operator decision.

## Required behavior
Change src/prime-agent-plugin/skills/prime-claw-expert-review/SKILL.md to use `prime-agent model list [search]` for requested-model/family lookup; quote multi-word provider+family searches, e.g. `prime-agent model list "openai-codex astra"`. Honor the exact operator-named provider/model-id. For latest-in-family requests choose the newest matching model on the actual parent provider. With no override prefer latest same-provider Astra, and state actual provider/model before review.
CLI catalog presence does not prove RLM launch eligibility. Before a different-model RLM child launch, require the exact CLI-selected selector in `await rlm.find_models(...)`. Report a discovery gap if absent and the actual launch error if launch fails; do not infer causes, change provider, or silently replace an explicitly requested model. When no model was requested and no same-provider Astra is selectable, ask before choosing another independent-review model.
Preserve all other review criteria and read-only/lifecycle boundaries, max/strongest-supported thinking, bootstrap-only spawn followed by one real task message, explicit review reply, and same-provider authentication routing.

## Scope and evidence
Source only: inert managed skill Markdown plus proportional focused contract regression coverage; documentation only if needed for actual consistency. Current main 1b7ebc5fa500719b4d14cef3278677879cce37ad has skill SHA256 62baf066197c4c9c477bb6388521b112b7db6651f6bba99f60b6865c159e0742. Installed selected fix at /Users/jlanders/.prime/agent/skills/prime-claw-expert-review/SKILL.md has SHA256 cfd5e243c2a491cb741fa7ee699b314fae9e98cbd12946af48cc0bcff7c3618b; read as semantic evidence, preserve compatible intervening changes rather than blindly replacing the whole file.
Run focused regression tests and fresh Docker Tier 1 --probe (or documented container suite) for the changed plugin inputs. Record exact source/input/model/test results and failures separately. Source publication is not running-generation proof.

## Boundaries
Owning Conversation is 01a20155-e0e9-7185-96a8-998c0dca989c, distinct from the existing PRIMECLAW-64 owner/Episode. Do not reopen Done PRIMECLAW-64 or mutate any foreign owner/resources, including 54/59. Preserve the installed bug fix without reset, accepted override, metadata acceptance or host/global writes. No host/global apply/check/probe/install/restart; no repository-local extension copy. No upstream Prime Agent patch/fork/PR/config/catalog endpoint or alternate launch framework, registry, enforcement code or state machine. The parent owner will separately coordinate accepted-main activation, restart, UAT and its cleanup. Deliver a coherent committed/pushed, independently reviewed source candidate with native progress; stop at the exact Ready for Merge tuple, not a merge or deployment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Canonical expert-review skill uses CLI provider+family lookup, exact requested selectors or newest same-provider family, latest same-provider Astra by default, and states the actual model/provider.
- [ ] #2 Different-model RLM launches require the exact CLI-selected native find_models result; catalog/discovery/launch distinctions and actual failure reporting are clear, with no silent requested-model/provider fallback and consultation before a non-Astra default.
- [ ] #3 Existing max/strongest-supported reasoning, bootstrap-first/one-task delivery, explicit reply, review criteria, read-only and lifecycle boundaries remain intact.
- [ ] #4 Proportional focused regression coverage and a fresh Docker Tier 1 probe or documented container suite pass for the changed exact inputs, or failures are truthfully reported without live installation.
- [ ] #5 The isolated Episode publishes coherent source commits and native evidence for independent read-only review; installed bytes, foreign tasks/owners/resources and deployment remain untouched.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In the separately admitted PRIMECLAW-67 Episode, reread the current canonical skill and installed semantic evidence. Replace only the obsolete model-selection guidance with CLI `prime-agent model list [search]` lookup (quoted provider/family search), exact requested provider/model-id or newest requested same-provider family, latest same-provider Astra default, and disclosure of the actual choice. Preserve compatible intervening skill content; do not modify installed bytes or deployment metadata.
2. Separate CLI catalog lookup from native RLM eligibility: require the exact CLI-selected selector in `await rlm.find_models(...)` before a different-model child launch. Distinguish missing discovery from an actual launch error; forbid provider fallback or silent explicit-model replacement, and ask before a non-Astra default. Preserve strongest supported reasoning, bootstrap-only spawn, one real task delivery, explicit reply, normal read-only review, and lifecycle boundaries. Adjust nearby wording/example comments only where needed to avoid contradicting these rules; add no runtime enforcement or alternate launch mechanism.
3. Update the obsolete assertions in tests/test_expert_review_skill.py and add proportional Markdown contract checks for CLI lookup/quoted search, exact-versus-latest selection, parent-provider retention, CLI/discovery/launch separation, no silent substitution, and consultation. Keep existing review/authority/delivery coverage. Run the focused suite and fresh scripts/test-tier1.sh --probe (or the documented container suite) against the final changed inputs. Record exact commands, source/input hashes, outcomes and real failures separately; never run candidate host/global plugin operations. These static checks guard shipped guidance, not runtime model availability.
4. Commit and push coherent Episode source changes and native progress/evidence promptly. Report exact candidate/base/task revisions, changed files, tests and remaining limits to the owner. The owner obtains independent normal read-only same-provider Astra review using the selected-model discovery rules; accepted concrete in-scope findings return to the same Episode through its normal continuation. Stop at the reviewed pushed Ready for Merge tuple. No merge, live refresh/restart/UAT, foreign-resource mutation or cleanup is included. No new task dependency or general documentation change is needed unless the bounded source edit reveals an actual consistency defect.
<!-- SECTION:PLAN:END -->
