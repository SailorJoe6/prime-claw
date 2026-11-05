---
id: PRIMECLAW-58
title: Make startup initialization read-only and LLM-mediated
status: In Planning
assignee: []
created_date: '2026-11-04 16:00'
updated_date: '2026-11-05 00:21'
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
- If the project needs initialization or applicable updates, load the startup instruction from shipped, editable Markdown and inject it as background guidance on the LLM's first normal turn, alongside any existing user request or assigned task. Do not start a separate startup LLM turn, rewrite or replace the user's message, or present the reminder as a new user command. Make the prompt available before the project has been initialized; it must not depend on first installing a project-local skill. Supply the relevant project and inspection facts, and direct the LLM to the existing initialization skill/tool. Keep the guidance in Markdown, not a second policy copy in TypeScript.
- The Markdown guidance must preserve the current request's priority. The LLM may run initialization first when it is needed to fulfill that work; otherwise it may defer initialization rather than interrupt unrelated work. In particular, a quick unrelated question must not automatically cause project mutations. Respect explicit instructions not to modify the project. This timing/relevance decision belongs to ordinary LLM judgment, not a deterministic request classifier, new queue, or authorization mechanism.
- The LLM's explicit initialization-tool invocation is the mutation boundary. This is not a new mandatory human approval dialog for routine setup/update. Preserve existing separate operator decisions for customized-content replacement, reset, provider migration/source deletion, unpublished local-only history, and other consequential actions; a startup reminder grants none of those.
- Inject no initialization prompt when no work is needed. Respect existing customization and accepted-override semantics: an accepted local difference alone is not an upstream update to overwrite. Preserve the original user request/assignment and normal session flow; do not silently manufacture an extra initialization turn or consume the initial task.
- This is a Prime Claw plugin for Prime Agent, not an Orca-specific feature. Inspect any Git project where Prime Agent starts with the plugin, without requiring Orca installation, availability, or project registration. Remove the current Orca-registration prerequisite from startup inspection/prompting; optional Orca integration remains separate and must not prevent this workflow. Preserve active/uncertain Episode snapshot protection, and do not initialize arbitrary non-Git directories or update an active Episode's templates. If inspection cannot determine the state, report the actual problem without silently mutating or claiming the project is current.

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
- [ ] #3 When initialization or updates are needed, startup loads editable shipped Markdown and adds background guidance on the first normal LLM turn, alongside the existing user request/assignment, directing the LLM to the existing initialization skill/tool. It does not start a separate turn, rewrite/replace the user message, or impersonate a new user command; it works before project initialization.
- [ ] #4 An up-to-date project receives no initialization prompt. Startup inspection/prompting works in any Git project without Orca installation, availability, or registration; the current Orca gate is removed without making Orca setup mandatory. Active/uncertain Episode template-snapshot protection remains intact; non-Git directories are not initialized, and inspection errors are reported without mutation or false no-update claims.
- [ ] #5 Only an explicit LLM tool invocation performs initialization mutations. Markdown guidance lets the LLM initialize first when needed for the current request, or defer when unrelated, while respecting explicit no-modification instructions. Routine initialization gains no extra mandatory human approval gate or coded request classifier; existing functionality and separate controls for resets, provider switches, source deletion, and consequential actions remain intact.
- [ ] #6 The Prime Claw global installer continues owning the Prime-Agent-global goals-and-heartbeats skill; this change neither creates a project/shared duplicate nor removes the intended global asset. Affected requirements/guidance no longer describe direct automatic startup reconciliation.
- [ ] #7 Proportionate isolated regressions cover first initialization, available updates, current/no-op state, customization, Git projects without Orca, Episode protection, inspection failure, and explicit-tool mutation. Relevant prompt/turn evidence covers an existing user request or assigned task, no separate startup turn, and LLM deferral guidance without a coded compliance classifier. Required Docker validation reports actual outcomes or a blocker; no live activation/restart or test-infrastructure redesign is performed.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Planning only. Implementation requires a separate operator request; this plan allocates no Episode and authorizes no live activation or restart. No new runtime/package dependency or prerequisite task is needed. Do not add deterministic machinery for task reconciliation, iterative plan changes, authorization, or deciding whether initialization is relevant to the user's request. Those decisions remain in editable Markdown and LLM judgment.

1. Separate inspection from mutation in `extension-support/project-initialization.ts`.
   - Reuse/extract the existing inventory, manifest, and content-hash comparisons into a small read-only assessment of missing setup, applicable template updates, current state, and concrete inspection problems. Keep managed/customized/accepted-override meaning consistent with explicit reconciliation; an accepted override against unchanged upstream is not an update.
   - Limit inspection to template/update facts, existing Git-root discovery, and active/uncertain Episode protection, without Orca lookup/registration. Surface encountered blockers; do not build a legacy, recovery, or provider-readiness audit. Do not migrate, repair, recover, acquire a mutation lock, write metadata/exclusions, or invoke provider/task-history preparation. Do not implement inspection by calling reconcile or add a generic dry-run framework.

2. Ship the editable startup guidance before project initialization.
   - Add internal Markdown alongside the global initializer (for example, `skills/initialize-prime-claw/STARTUP.md`) with an existing `plugin-root-managed` delivery target in `asset-inventory.json`, not a new project-local or discoverable skill. Use existing delivery/drift handling.
   - Direct the LLM to read `initialize-prime-claw` and invoke `initialize_prime_claw(action="reconcile")` when initialization is needed for the current work; otherwise allow deferral. Preserve the user request/assignment and explicit no-modification instructions. Preserve separate reset/override/migration/deletion/local-only-history decisions without adding routine human confirmation. Align the initializer's setup wording with this LLM-mediated entry; keep this policy in Markdown, not a TypeScript request classifier.

3. Replace the automatic startup reconcile in `extensions/project-initialization.ts`.
   - Make `session_start` perform only the read-only assessment for the nearest Git project, with no Orca prerequisite. Keep only session-local pending guidance; report real inspection errors and protected Episode state without mutation or a false current-state claim. Current projects remain quiet; non-Git directories are not initialized.
   - On the first normal `before_agent_start`, load the Markdown and add labeled background guidance plus project/inspection facts through the supported system-prompt result, preserving the existing system prompt and leaving the user prompt/attachments untouched. Consume the pending guidance once; do not enqueue a user message, manufacture a turn, or add persistent reminder state.
   - Remove the startup-created-skill assumptions in `pendingSkillPaths`/`resources_discover`. Keep the global initializer available without project setup and retain the existing explicit tool's mutation path, customization behavior, and Episode protection. Orca unavailability must not prevent initialization.

4. Update the existing isolated regressions, not a new test framework.
   - Extend `tests/project_initialization_extension.test.mjs` and its Docker bridge in `tests/test_project_initialization.py`: fresh setup, missing/new/changed templates, current project, customization/accepted overrides, no Orca, non-Git directory, active/uncertain Episode, and an inspection failure. Assert startup/first-turn inspection does not alter fixture files, manifests, lock/exclude state, code index, or provider/history state and never calls the mutation seams; explicit tool invocation still performs setup/update.
   - Exercise the first normal turn with an existing user request and assigned-task text: guidance coexists with the unchanged request/system context, no separate turn or replacement user message is sent, and a current project gets no guidance. Review the delivered Markdown for deferral/no-modification policy; do not encode LLM compliance as a classifier. Update startup-mutates/Orca-gated expectations rather than preserving those bugs.
   - Add coverage for the shipped startup Markdown to the existing container install checks. Run the existing global-only `goals-and-heartbeats` placement regressions unchanged; do not duplicate that coverage.

5. Update affected guidance and validate the candidate.
   - Update `docs/project-initialization.md`, `REQUIREMENTS.md` P2, and directly affected README/story guidance to describe read-only startup, first-normal-turn guidance, any-Git-project scope, LLM deferral, and explicit mutation. Retain the global goals skill and consequential-action boundaries.
   - Run the focused initialization/install regressions through the existing Docker fixture and required Tier 1 validation (`scripts/test-tier1.sh --probe`) after plugin changes. Record actual results and any concrete fixture blocker in the native task; do not repair unrelated test infrastructure or claim green from setup failures. Publish the bounded candidate and its evidence through the normal implementation workflow. No host/global candidate apply, live migration, restart, or cleanup is part of this task.
<!-- SECTION:PLAN:END -->
