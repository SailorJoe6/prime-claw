---
id: PRIMECLAW-10.39
title: >-
  Compact Conversation context after episode handoff when utilization exceeds
  threshold
status: In Planning
assignee: []
created_date: '2026-10-15 05:15'
updated_date: '2026-10-17 17:36'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
references:
  - PRIMECLAW-10.32
  - PRIMECLAW-10.37
documentation:
  - docs/user-stories/G-oversight-and-review.md
parent_task_id: PRIMECLAW-10
priority: p2
type: feature
ordinal: 124000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Dogfooding shows a supervising Conversation degrades — getting confused and losing track of episode state — once its context utilization climbs past roughly half the window while driving an Episode. Episodes already compact at their own handoff boundary; the Conversation has no managed compaction point of its own and otherwise drifts into native auto-compaction with a generic summary at an arbitrary, often bad, boundary.

The ideal moment is immediately after the Conversation dispatches an episode handoff: its working context has just shipped downstream, it enters heartbeat-driven waiting, compaction runs in dead time, and each supervision leg starts fresh.

## Intended outcome
After every successful canonical Episode handoff dispatch, the plugin checks the owning Conversation's current context utilization. This covers direct handoff_spec_episode and handoff_task_episode calls and successful dispatches inside the task-native Resume and Request Changes actions. Existing authorization for those actions is unchanged. Failed, partial, or uncertain dispatches do not trigger this compaction flow.

If enabled and utilization strictly exceeds the configured threshold, the plugin injects a new managed workflow prompt. The model composes a focus hint using its current context and judgment about what it needs to drive the exact owned Episode to completion, then calls compact.run() once before ending the turn. Compaction runs at the turn boundary; the existing post-compaction handler re-injects the Conversation guide with exact episode identity, and the next heartbeat tick resumes supervision already re-primed. At or below the threshold, or when utilization is unknown, skip the prompt and leave the handoff flow unchanged.

## Threshold configuration and validation
The new project-local managed workflow contains one threshold setting in its frontmatter: threshold_percent, defaulting to 60 when omitted. Do not add a separate enabled key. A value of zero disables this automatic Conversation compaction; it does not change native auto-compaction.

Normalize accepted inputs to a 0–1 internal scale before comparison and minimum-threshold validation:
- Without a percent suffix, values from 0 through 1 inclusive are ratios; values above 1 are on the 0–100 percentage scale. Thus .6, 60, and 60% all mean 60%; bare 1 means 100%.
- A percent suffix always means a percentage, including fractional percentages. Thus .6% means 0.6%, not 60%, and fails the minimum-threshold rule.
- Zero, including 0%, disables the feature. Otherwise the valid normalized range is 10–100% inclusive. Exactly 10% and 100% are valid.
- Negative values, values above 100%, and nonzero values below 10% after normalization are validation errors. Malformed, nonnumeric, and non-finite values are also errors, not an omitted setting. For example, 6, 6%, .06, and 1% are all invalid thresholds.

## Failure behavior and material constraints
- Uniform with existing compaction boundaries: the model executes compact.run(); the plugin only triggers by injecting the prompt. No programmatic plugin-side compaction.
- The prompt gives the compaction objective; the model decides what its current context requires the hint to preserve. Do not supply a fixed focus hint or mandated preservation inventory.
- The prompt and its threshold setting ship in one managed markdown workflow asset installed and updated alongside the other Prime Claw workflow files.
- Conversation compaction is best effort after successful Episode dispatch. Report a bounded reason when the request fails or is not scheduled, then continue normal heartbeat-driven supervision without an automatic retry. A configuration validation error is reported and skips this compaction attempt rather than silently using the default.
- A compaction-side problem must not reverse the admitted Episode handoff, dispatch the Episode again, or pause supervision for operator input. Distinguish a compaction request from confirmed completion.

## Non-goals
- No changes to the existing post-compaction Conversation guide re-injection; it works.
- No changes to native auto-compaction; it remains the high-watermark backstop.
- No trigger points beyond successful canonical Episode handoff dispatches: no heartbeat-tick checks or unrelated terminal actions.
- No change to episode-side handoff compaction, lifecycle authority, or operator decision boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After every successful canonical Episode handoff dispatch, including direct folder/task handoff calls and dispatches inside task-native Resume and Request Changes, utilization strictly above the enabled threshold causes a managed prompt to be injected and one Conversation compaction request before the turn ends.
- [ ] #2 No compaction prompt is injected when the feature is disabled, utilization is at or below the threshold or unknown, or the Episode handoff fails or has partial/uncertain admission; the existing handoff flow and authority remain unchanged.
- [ ] #3 The new project-local managed workflow uses threshold_percent in its frontmatter, defaults to 60 when the key is omitted, and supports zero as disable without a separate enabled key.
- [ ] #4 Threshold normalization accepts .6, 60, and 60% as 60%; bare 1 means 100%; explicit percent-suffixed values retain percentage meaning. Values are normalized to the 0–1 internal scale before comparison.
- [ ] #5 Validation accepts 0 (disabled) and 10–100% inclusive, including both endpoints. It rejects negatives, values above 100%, nonzero thresholds below 10% after normalization, and malformed/nonnumeric/non-finite values. Examples .6%, .06, 6, 6%, and 1% fail validation.
- [ ] #6 The prompt and threshold configuration ship together as one managed workflow markdown asset installed and updated with the other Prime Claw workflow assets.
- [ ] #7 The prompt instructs a single compact.run() call and lets the model compose the focus hint using its current context and judgment about driving the exact owned Episode to completion, without fixed hint text or a mandated preservation inventory.
- [ ] #8 Compaction request failures or unscheduled results are reported with a bounded reason and normal heartbeat-driven supervision continues without an automatic retry. Configuration validation errors are reported and skip the compaction attempt rather than silently defaulting. No compaction-side problem reverses or repeats the admitted handoff or requires an operator wait; requested and confirmed compaction remain distinct.
- [ ] #9 After triggered compaction completes, the Conversation resumes supervising the exact same owned Episode without operator re-identification and without changes to the existing post-compaction guide re-injection.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approach
Implement the approved feature at the successful public handoff return boundaries in `extensions/reviewed-plan.ts`, using one shared support helper and one project-managed workflow. Keep Episode dispatch, lifecycle transactions, and existing `session_compact` re-priming unchanged. The current public APIs support the feature; no Prime Agent patch or additional task dependency is needed.

### 1. Add the workflow and threshold loader
- Add `src/prime-agent-plugin/workflows/conversation-after-handoff.md` with `threshold_percent: 60` and a prompt for the owning Conversation, not the Episode. After the already-admitted handoff, the model composes its own mission-focused hint from current context and calls `compact.run(focus_hint)` exactly once. Do not prescribe hint text or a preservation inventory. Report only the immediate request result: scheduled is not confirmed completion; false or an exception produces a bounded explanation, no automatic retry, and normal heartbeat-driven supervision continues. Do not re-dispatch, wait for compaction events, or run an Episode phase.
- Add `extension-support/conversation-compaction.ts` for loading the project-local workflow, validating/normalizing its threshold, checking usage, and delivering the prompt. Read the threshold and prompt from the same project-local file, with no plugin-template fallback that could bypass a project's customized policy. Reuse `canonicalWorkflowPrompt` wrapping conventions; if necessary, extract a small formatter so validation and delivery use the same file contents rather than two divergent reads.
- Keep the parser local and proportional to this single scalar setting, following the existing managed-frontmatter pattern in `goal-continuation-nudge.ts`. Handle numeric and percent-string values, including ordinary quoted scalar forms; distinguish an omitted key (default 60) from a present invalid value. Reject malformed present frontmatter, duplicate threshold keys, empty/null/boolean/collection values, trailing junk, and non-finite values instead of silently defaulting. Do not introduce a runtime Prime Agent package import merely to parse this field.
- Normalize bare numbers in [0, 1] as ratios and bare numbers above 1 as percentages; percent-suffixed inputs always divide by 100. Zero disables; otherwise require [0.1, 1] inclusive. Reject negative values before normalization. Compare against `ctx.getContextUsage().percent / 100` with strict `>`; absent/null/non-finite usage is unknown and skips the prompt. A missing/unreadable workflow or invalid configuration yields a bounded compaction warning and skips this attempt, not a failed handoff.

### 2. Connect all four successful dispatch paths
- In `reviewed-plan.ts`, invoke the shared helper after the acknowledged `handoff_spec_episode` and `handoff_task_episode` results and after successful `finalize_task_episode` Resume and Request Changes results. Resume exposes `details.handoff`; Request Changes exposes `details.changesReceipt.handoff`, after its internal `changesResume` dispatch. Require the successful admitted handoff result, not merely a published status or completed integration.
- Use the returned exact task/source and Episode identity with the owning Conversation context. Load policy from the Conversation's project, not the Episode worktree. Deliver the workflow through the supported `pi.sendUserMessage(..., { deliverAs: "steer" })` path so the model handles it before ending its turn, consistent with existing prep/handoff tool delivery. Treat prompt injection as an attempt, not proof of compact execution or completion.
- Keep this post-success processing outside lifecycle transaction/retry classification and contain loader, usage, and delivery errors. Preserve successful handoff receipts and add bounded warning evidence when needed; do not turn compaction trouble into `isError`, `TaskEpisodeActionPhaseError`, transport uncertainty, or permission to retry the Episode handoff. Each successful adapter path invokes the helper once; do not also hook nested low-level dispatches and double-inject.
- Leave `spec-episode.ts` authorization, dispatch, partial/uncertain results, and follow-up admission intact. Creation, block, candidate acceptance, delay, merge, abandonment, cleanup, ordinary `/handoff`, and heartbeat ticks do not acquire this trigger. Do not change `conversation-oversight.ts`, native auto-compaction, or Episode-side compaction.

### 3. Package the managed asset
- Register `project-workflow-conversation-after-handoff` in `src/prime-agent-plugin/asset-inventory.json`: source `workflows/conversation-after-handoff.md`, plugin-root-exact target at that path, and project-customizable target `.prime-claw/workflows/conversation-after-handoff.md`, internal exposure, lifecycle trigger `conversation-after-handoff`. Register the new support module as plugin-root-exact too; no migration alias is needed.
- The inventory-driven delivery manager and project reconciler already support these targets; do not add parallel apply/check allowlists or redesign reconciliation. Generate/verify the builder's new regular workflow copy and its `.prime-claw/templates.json` entry through isolated candidate reconciliation in Docker, then include only the intended project asset/manifest changes. Preserve existing project customizations and unrelated manifest entries; do not reconcile unrelated source updates into this feature.

### 4. Add focused behavioral and installation coverage
- Extend `tests/reviewed_plan_extension.test.mjs` fixtures with the new workflow, usage reporting, and recorded prompt delivery. Add a dedicated support-module Node suite if useful, bridged through a `tier1_container` pytest test rather than host Node execution.
- Cover default 60, custom thresholds, zero/0% disable, `.6`/60/60% equivalence, bare 1/100/100% equivalence, and inclusive .1/10/10% endpoints. Reject negatives, >100%, `.6%`, `.06`, 6/6%, 1%, just-below-10% inputs, malformed and non-finite settings. Check omitted versus explicitly invalid configuration and customized prompt/threshold loading from the same file.
- For each of the four successful adapter paths, prove exactly one prompt when usage is above threshold and no prompt at/below it, when disabled, or when usage is unknown. Verify failed, partial, and uncertain handoffs never inject; unrelated lifecycle actions never inject. Force config/loading/delivery failures and verify successful original receipts, one Episode dispatch, and unchanged retry classification.
- Extend `tests/project_initialization_extension.test.mjs` for the additional internal workflow (current managed count 16 becomes 17), fresh install, managed upstream update, and preservation of a customized threshold. Retain inventory-derived install/check coverage in `tests/test_prime_agent_plugin_install.py` and builder workflow/manifest checks in `tests/test_project_initialization.py`.
- Add a Docker-only scripted-provider integration proof of the supported steer delivery during a real tool turn, model-side `compact.run` request before turn end, and turn-boundary compaction followed by oversight of the same Episode. Use fake Episode transport, no live worker/resources; use `scripts/run-prime-agent-probe.sh` inside the tier-1 fixture for native probes. Retain existing post-compaction owner/foreign/inactive identity tests and prove they still pass unchanged. Cover scheduled/unscheduled/error reporting with controlled results where real failure injection is needed.

### 5. Update user-facing guidance
Update `docs/handoff-chain.md`, US-21 in `docs/user-stories/G-oversight-and-review.md`, its relevant traceability entry, and `docs/project-initialization.md`. Explain the four trigger paths, strict comparison/unknown skip, single configuration key and normalization examples, zero-disable, valid bounds, and best-effort warnings. Keep existing post-compaction restoration policy and operator authority unchanged. Describe deployment/UAT as a later explicitly approved cutover, not proof supplied by copying files or requesting compaction.

### 6. Validate and return a reviewable candidate
Add failing regressions before fixing behavior, then run focused suites through their Docker bridges. Run `python3 -m pytest tests/ -q` for host-safe/static coverage and `python3 -m pytest tests/ -q -m container` for behavioral/native/delivery coverage; after every plugin-source change, run an allowed tier-1 gate, including final `scripts/test-tier1.sh --probe`. Use the independently verified supported source selector per `docs/prime-agent-installation.md`, an explicit container-local plugin root, offline scripted providers, and no host credentials. Preserve run manifests and report actual results; do not silently skip a failing native proof or switch to an unsupported Prime Agent artifact.

Run `git diff --check`, verify the task's native acceptance criteria against evidence, and keep implementation notes current through supported Backlog edits on the Episode branch without taking Conversation-owned lifecycle status. Commit/push the scoped implementation candidate for independent review. Do not activate/check/probe a candidate user-globally, create a second host Prime Agent instance, or change upstream source. A later operator-approved merge/global refresh, coordinated full restart, and owner/Episode UAT remain separate from this implementation plan; keep resources required by the loaded generation intact until that cutover is proven.
<!-- SECTION:PLAN:END -->
