---
id: PRIMECLAW-10.39
title: >-
  Compact Conversation context after episode handoff when utilization exceeds
  threshold
status: In Design
assignee: []
created_date: '2026-10-15 05:15'
updated_date: '2026-10-17 16:17'
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
