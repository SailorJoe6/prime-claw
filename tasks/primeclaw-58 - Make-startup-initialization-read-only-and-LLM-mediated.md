---
id: PRIMECLAW-58
title: Make startup initialization read-only and LLM-mediated
status: Done
assignee: []
created_date: '2026-11-04 16:00'
updated_date: '2026-11-05 02:04'
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
modified_files:
  - README.md
  - REQUIREMENTS.md
  - docs/project-initialization.md
  - docs/user-stories/B-project-initialization.md
  - docs/user-stories/README.md
  - docs/user-stories/traceability.md
  - src/prime-agent-plugin/asset-inventory.json
  - src/prime-agent-plugin/extension-support/project-initialization.ts
  - src/prime-agent-plugin/extensions/project-initialization.ts
  - src/prime-agent-plugin/skills/initialize-prime-claw/SKILL.md
  - tests/project_initialization_extension.test.mjs
  - tests/test_prime_agent_plugin_install.py
  - tests/test_project_initialization.py
  - src/prime-agent-plugin/skills/initialize-prime-claw/STARTUP.md
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
- [x] #1 Session startup no longer calls mutating project reconciliation, initialization, provider/history preparation, or recovery. Inspection alone leaves project files, metadata, lock/exclude state, native provider state, and task history unchanged.
- [x] #2 A read-only check distinguishes first-time initialization and applicable upstream template updates from an up-to-date project, reusing existing manifest/hash information and preserving current customization and accepted-override meaning without a new persistent cache or receipt.
- [x] #3 When initialization or updates are needed, startup loads editable shipped Markdown and adds background guidance on the first normal LLM turn, alongside the existing user request/assignment, directing the LLM to the existing initialization skill/tool. It does not start a separate turn, rewrite/replace the user message, or impersonate a new user command; it works before project initialization.
- [x] #4 An up-to-date project receives no initialization prompt. Startup inspection/prompting works in any Git project without Orca installation, availability, or registration; the current Orca gate is removed without making Orca setup mandatory. Active/uncertain Episode template-snapshot protection remains intact; non-Git directories are not initialized, and inspection errors are reported without mutation or false no-update claims.
- [x] #5 Only an explicit LLM tool invocation performs initialization mutations. Markdown guidance lets the LLM initialize first when needed for the current request, or defer when unrelated, while respecting explicit no-modification instructions. Routine initialization gains no extra mandatory human approval gate or coded request classifier; existing functionality and separate controls for resets, provider switches, source deletion, and consequential actions remain intact.
- [x] #6 The Prime Claw global installer continues owning the Prime-Agent-global goals-and-heartbeats skill; this change neither creates a project/shared duplicate nor removes the intended global asset. Affected requirements/guidance no longer describe direct automatic startup reconciliation.
- [x] #7 Proportionate isolated regressions cover first initialization, available updates, current/no-op state, customization, Git projects without Orca, Episode protection, inspection failure, and explicit-tool mutation. Relevant prompt/turn evidence covers an existing user request or assigned task, no separate startup turn, and LLM deferral guidance without a coded compliance classifier. Required Docker validation reports actual outcomes or a blocker; no live activation/restart or test-infrastructure redesign is performed.
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

Execution checkpoint: steps 1–3 and 5 guidance/docs are implemented in code f12d049. Step 4 regression updates are written. Step 5 Docker validation is blocked before runtime setup by the absent approved selector. Resume the same Episode with an approved existing fixture; run tests before claiming candidate readiness. No live activation is authorized.

Validation completion supersedes the earlier blocked checkpoint: all planned implementation, guidance, documentation, focused Docker regressions (49 passed), and required Tier1 --probe are complete at f12d04993ed67d35d90cb564cee1801644fbeddb. Await owning Conversation candidate/expert review and operator disposition in the same Episode. Preserve the recorded unrelated host-safe builder-state failure; do not claim a full-suite clean run or live activation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-05 Episode slice: verified exact owner/worktree/session and synchronized independent task history. Implementing read-only template inspection, one-shot first-normal-turn shipped Markdown guidance, and proportionate isolated regressions/docs. Startup will not reconcile, prepare providers/history, require Orca, or create a separate LLM turn. Live apply/restart remains out of scope.

2026-11-05 published resumable implementation checkpoint (validation blocked).

Code: f12d04993ed67d35d90cb564cee1801644fbeddb on JLanders/prime-claw-primeclaw-58-episode-cc9b5f11, non-force pushed to origin. Added shared pure template/hash comparisons and inspectPrimeClawProject; session_start now only inspects any Git project without Orca/provider/history preparation. Needed setup/update guidance loads shipped editable STARTUP.md once in the first normal before_agent_start systemPrompt. Existing user/assignment/attachments remain untouched; no startup-created turn or resources_discover install assumptions. Explicit initialization tool, customization decisions, and active/uncertain Episode protection remain. Updated P2, initialization docs/story guidance, global delivery inventory, and focused regressions. No global apply, restart, migration, or cleanup.

Validation and exact blocker:
- scripts/test-tier1.sh --probe: exit 1 before Docker, missing /Users/jlanders/worktrees/prime-claw/prime-claw-primeclaw-58-episode-cc9b5f11/.env (set exactly one selector). Repeated once after final plugin changes with the same setup failure. Primary checkout also has no .env; the current ~/code/prime-agent checkout is not the supported cwd-fix-v0.9.8-r1 source. No unsupported runtime was selected.
- python3 -m pytest tests/test_project_initialization.py -q -m container: 7 deselected, 5 setup errors at tests/conftest.py:173, all caused by the same missing selector. No plugin runtime body ran.
- python3 -m pytest tests/test_project_initialization.py tests/test_prime_agent_plugin_install.py -q: 7 passed, 49 skipped, 1 pre-existing failure in test_builder_project_uses_regular_project_assets_and_no_legacy_skill_tree at line 123. The existing manifest records project-workflow-plan-task as customized; that test falls through to a managed-state expectation. Verified both that test function and manifest state already exist at base f90defa00bce0a45820cd2684185a8573934160e; did not change live project assets or unrelated fixture expectations.
- git diff --check passed; inventory source coverage includes every shipped file exactly once. Docker install/placement and actual Node/native-turn regressions remain unrun, not green.

Local evidence: .test-results/primeclaw-58-tier1-final.log, .test-results/primeclaw-58-container.log, .test-results/primeclaw-58-static-final.log. The node tests now cover read-only snapshots, setup/update/current/customization/accepted override, no Orca, non-Git, active/uncertain protection, inspection/Markdown errors, explicit-tool mutation, and unchanged first-normal-turn request delivery. Markdown deferral/no-modification policy is reviewed as guidance, not a coded request classifier or claimed compliance test.

Unblock condition: supply an existing approved TIER1_ENV_FILE selecting the verified supported source, then run the focused initialization/install/placement regressions and required Tier 1 --probe through the existing Docker fixture. If the fixture itself fails, report that exact failure without test-infrastructure redesign. Until runtime validation, this is a resumable checkpoint, not a validated/accepted candidate. Status remains In Progress; lifecycle disposition belongs to the owning Conversation.

Validation update: owning Conversation supplied an existing supported read-only source fixture; independently verified clean annotated tag, commit/tree, public remote, and lockfile against docs/prime-agent-installation.md. Missing-selector condition is cleared through an ignored TIER1_ENV_FILE. Existing focused initialization/install/placement container tests and scripts/test-tier1.sh --probe are now running. This supersedes only the earlier missing-selector diagnosis, not its recorded command failures. No source checkout, runtime dependency, test infrastructure, or live installation was changed.

2026-11-05 validation completed for unchanged code candidate f12d04993ed67d35d90cb564cee1801644fbeddb.

The earlier missing-selector and focused builder-setup failures are retained above as historical results, not current blockers. The owner supplied the supported read-only source; exact tag/commit/tree/remote/lock identities were verified before selection. No infrastructure code or upstream source was changed.

- Required scripts/test-tier1.sh --probe: PASS, exit 0. Run 20261105T003633Z-77036-f2d6aa5d, finished 00:38:23Z. Manifest run.status=passed, failure_codes=[], candidate repository HEAD=f12d04993ed67d35d90cb564cee1801644fbeddb, clean content hash ad852a28310eb484fe2c26543c4fbc04c355e6c4dbb83f4b61f1663484c8e0cf. Isolated source build, install/check, and offline RPC loader/tool probe passed. Runtime networking was verified absent; source before/after inventory hashes match; builder and runtime teardown are clean/absent.
- Focused initialization/install suite: PASS, exit 0, 49 passed and 8 deselected in 264.89s. Command: TIER1_ENV_FILE=.test-results/primeclaw-58-selector.env python3 -m pytest tests/test_project_initialization.py tests/test_prime_agent_plugin_install.py -q -m container. Run 20261105T003843Z-82759-7595ba44, finished 00:43:06Z; manifest passed/failure_codes=[], same clean code HEAD/content hash, no runtime network, source inventory unchanged, clean/absent runtime and builder teardown. This one sequential retry followed positive evidence that the standalone source build worked; no fixture redesign occurred.
- Initialization Node TAP: 88 tests, 87 passed, 1 skipped, 0 failed (production initialization prepares and reuses an independent published .backlog workspace: managed backlog executable unavailable in that Node process; the separate active-Backlog suite passed 12/12). Active Backlog initialization TAP: 12 passed, 0 failed. Native startup/discovery, managed STARTUP.md delivery, existing global-only goals placement regressions, explicit-tool mutation, template/customization/override state, snapshot protection, inspection errors, no separate turn/user-message delivery, and one-shot prompt preservation all passed through the Docker bridge. LLM relevance/deferral behavior remains editable Markdown guidance, not a model-compliance claim.
- Host-safe result remains separately 7 passed / 49 skipped / 1 pre-existing builder-state assertion failure, as documented above. It does not become green because container checks passed; live builder assets were not rewritten to satisfy it.

Evidence: .test-results/primeclaw-58-tier1-selected.log; .test-results/20261105T003633Z-77036-f2d6aa5d/tier1/manifest.json; .test-results/primeclaw-58-container-retry.log; .test-results/20261105T003843Z-82759-7595ba44/tier1/{manifest.json,source-build.json,project-initialization-node.tap,project-initialization-active-backlog-node.tap}. Selector contains only the approved source path. Original failed focused setup run is 20261105T003633Z-76935-4208f35d; do not misstate it as a plugin test failure or assert its cause without evidence.

Candidate implementation slice complete, ready for owning Conversation review at f12d04993ed67d35d90cb564cee1801644fbeddb. All seven acceptance criteria have supporting isolated code/tests/guidance evidence. No merge, status transition, global activation, restart, live migration, or Episode cleanup was performed. Task content is published in the independent task DAG only; code HEAD is unchanged by these evidence updates. There is no active/committed new build or test startup intent.

Owner terminal source landing, 2026-11-05: Joe delegated source landing of Ready PRIMECLAW-57 then PRIMECLAW-58 while PRIMECLAW-55 remains In Progress. After 57's published Done and exact cleanup, source tuple main 7f3282e1507ab60eb53daeeef649d9c1c7166abd -> candidate c62fe901d3158d06955b23cafdf91b927180e44c was ordinarily fast-forward merged and non-force pushed; local/upstream/direct main publication was verified. The final refresh added only 55's already-published ownership bookkeeping to combined candidate 5f8e43c09509ad8736e322721050eca587d29deb; reviewed 58 product bytes and foreign 55 identity/resources remain unchanged, and 57's deleted owner entry stays absent.

Additional combined-generation validation: scripts/test-tier1.sh --probe PASS at clean pushed 5f8e43c09509ad8736e322721050eca587d29deb, run 20261105T015735Z-79040-c43e786e, finished 01:59:24 UTC. Passed manifest/no failure codes, absent runtime network, equal before/after source inventories, clean exact builder/runtime teardown, and all 15 recorded evidence hashes verified. Both exact containers independently inspected absent. The earlier focused 49-pass suite, separate passed probe, one skipped Node case, and pre-existing host-safe assertion failure remain as already disclosed; no full-suite or model-compliance claim is added.

Before Episode cleanup, all owned test logs, failed/successful native manifests and hashed artifacts were preserved under canonical primary .test-results/primeclaw58-evidence-20261105T020100Z. Four archived manifests revalidated 6/15/16/15 hashes, retaining the historical failed first focused setup run. The private source-selector file was excluded. This native Done publication records completed authorized source landing; exact owned Episode cleanup follows. No 55 development code, global installation/activation/restart, retained TASK-2 live cleanup, new Episode, or foreign runtime action was authorized or performed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented read-only, LLM-mediated startup initialization in code f12d04993ed67d35d90cb564cee1801644fbeddb (published Episode branch). Startup inspects manifest/template hashes in any Git project without Orca or mutation. Needed setup/updates load shipped editable STARTUP.md once into the first normal turn system prompt, preserving the original user request/assignment and attachments. Markdown controls relevant-first setup or unrelated deferral and preserves no-modification/consequential-action boundaries. Explicit initialization tooling, customization/accepted overrides, global goals placement, and active/uncertain Episode protection remain.

Validation: required Docker Tier1 --probe PASS; focused Docker initialization/install suite 49 passed, 8 deselected. Exact isolated run IDs: 20261105T003633Z-77036-f2d6aa5d and 20261105T003843Z-82759-7595ba44. Both cleanly tore down owned resources; no runtime networking or source changes. Earlier setup failures are documented and superseded. Separate host-safe checks have one known pre-existing builder-manifest expectation failure (7 passed, 49 skipped, 1 failed), not hidden or repaired by changing live assets.

Candidate is ready for Conversation review, not merged or live-activated. Task status remains In Progress; all lifecycle/merge/deployment decisions stay with owner/operator.
<!-- SECTION:FINAL_SUMMARY:END -->
