---
id: PRIMECLAW-58
title: Make startup initialization read-only and LLM-mediated
status: In Design
assignee: []
created_date: '2026-11-04 16:00'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extensions/project-initialization.ts
  - src/prime-agent-plugin/extension-support/project-initialization.ts
  - src/prime-agent-plugin/skills/initialize-prime-claw/SKILL.md
  - src/prime-agent-plugin/asset-inventory.json
  - tests/project_initialization_extension.test.mjs
documentation:
  - REQUIREMENTS.md
  - docs/project-initialization.md
priority: p1
type: bug
ordinal: 143000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome
Stop running project initialization automatically on Prime Agent session startup. Startup may inspect whether initialization or a project-template update is needed, but must not perform the mutation. When work is needed, load and inject an editable Markdown prompt directing the LLM to use the existing initialization skill and `initialize_prime_claw(action="reconcile")` tool. An up-to-date project should remain quiet.

Joe confirmed this behavior and requested specification only. This task does not authorize planning, implementation, an Episode, global installation, or restart.

## Current behavior and diagnosis
`extensions/project-initialization.ts` registers the existing LLM-facing `initialize_prime_claw` tool. Its `session_start` hook also directly calls `reconcilePrimeClawProject` for eligible Orca-registered Git projects. Notifications are conditional on the result, so routine reconciliation can be silent even though the initialization routine ran.

The reconciler already reads the project template manifest and compares current, installed/baseline, and upstream content hashes. These comparisons avoid rewriting unchanged files and preserve customization. However, they are inside the mutating reconciliation routine: it also acquires a mutation lock, creates/updates/migrates/retires assets, handles reset recovery, writes metadata, and performs task-provider/history preparation. There is no separate read-only needs-initialization/update check today. Calling reconciliation and inspecting its result afterward is not a read-only startup check.

## Required behavior
- Keep the existing LLM-facing initialization tool and explicit setup/upgrade behavior. Startup must not call its mutating reconciliation path directly or indirectly.
- Reuse the existing asset/manifest comparisons where practical to inspect first-time initialization and available project-skill/workflow updates without writing project files, metadata, locks, exclusions, provider state, or task history. Do not simulate inspection by running reconciliation with mutations hidden or redirected.
- If the project needs initialization or applicable updates, load the startup instruction from shipped, editable Markdown and inject it into the session. Make this prompt available before the project has been initialized; it must not depend on first installing a project-local skill. Supply the relevant project and inspection facts, and tell the LLM to use the existing initialization skill/tool. Do not embed a second copy of the workflow policy in TypeScript.
- The LLM's explicit initialization-tool invocation is the mutation boundary. This is not a new mandatory human approval dialog for routine setup/update. Preserve existing separate operator decisions for customized-content replacement, reset, provider migration/source deletion, unpublished local-only history, and other consequential actions; a startup reminder grants none of those.
- Inject no initialization prompt when no work is needed. Respect existing customization and accepted-override semantics: an accepted local difference alone is not an upstream update to overwrite. Preserve the original user request/assignment and normal session flow; do not silently manufacture an extra initialization turn or consume the initial task.
- Preserve the current project-eligibility boundary and active/uncertain Episode snapshot protection. This change is not a blanket expansion into every unrelated directory or permission to update an active Episode's templates. If inspection cannot determine the state, report the actual problem without silently mutating or claiming the project is current.

## Global skill placement is separate and retained
The Prime Claw global installer must continue installing `goals-and-heartbeats` at Prime Agent's global `~/.prime/agent/skills/goals-and-heartbeats/` location, not a project-local directory or the cross-agent `~/.agents/skills/` location. The published placement correction is commit `742fbcf`; this startup change must not remove that intended global installation or treat project initialization as its installer.

## Scope and limits
Keep this to separating inspection from mutation, replacing the startup reconcile call with conditional Markdown guidance, and updating directly affected guidance, requirements, and regression coverage. Prefer a small reuse/extraction of the existing comparisons over a new installer, generic dry-run framework, policy engine, persistent update cache/receipt, startup coordinator, retry loop, or authorization protocol. Do not redesign provider migration, task-native admission, retained legacy lifecycle, or global deployment.

Candidate plugin validation must remain Docker-isolated. Prove the relevant startup and explicit-tool behavior with proportionate tests; do not use live projects or user-global assets as fixtures. If the existing Docker fixture is blocked, report that fact rather than expanding this ticket into test-infrastructure repair or claiming validation succeeded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Session startup no longer calls mutating project reconciliation, initialization, provider/history preparation, or recovery. Inspection alone leaves project files, metadata, lock/exclude state, native provider state, and task history unchanged.
- [ ] #2 A read-only check distinguishes first-time initialization and applicable upstream template updates from an up-to-date project, reusing existing manifest/hash information and preserving current customization and accepted-override meaning without a new persistent cache or receipt.
- [ ] #3 When initialization or updates are needed, startup loads editable shipped Markdown and injects guidance into the existing session directing the LLM to the existing initialize-prime-claw skill and initialize_prime_claw action=reconcile tool; the prompt works before project initialization and preserves the original user request/assignment.
- [ ] #4 An up-to-date project receives no initialization prompt. Existing project eligibility and active/uncertain Episode template-snapshot protection remain intact; inspection errors are reported without mutation or false no-update claims.
- [ ] #5 Only an explicit LLM tool invocation performs initialization mutations. Existing setup/upgrade functionality remains usable, routine initialization gains no mandatory extra human approval gate, and startup guidance does not authorize content resets, provider switches, source deletion, or other separately controlled actions.
- [ ] #6 The Prime Claw global installer continues owning the Prime-Agent-global goals-and-heartbeats skill; this change neither creates a project/shared duplicate nor removes the intended global asset. Affected requirements/guidance no longer describe direct automatic startup reconciliation.
- [ ] #7 Proportionate isolated regressions cover first initialization, available updates, current/no-op state, preserved customization, Episode protection, inspection failure, and explicit-tool mutation. Required Docker validation reports actual outcomes or a concrete blocker; no live activation/restart or test-infrastructure redesign is performed.
<!-- AC:END -->
