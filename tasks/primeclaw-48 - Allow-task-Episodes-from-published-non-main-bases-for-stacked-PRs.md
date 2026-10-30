---
id: PRIMECLAW-48
title: Allow task Episodes from published non-main bases for stacked PRs
status: In Design
assignee: []
created_date: '2026-10-30 23:31'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md
  - src/prime-agent-plugin/workflows/implement-task.md
priority: p1
type: bug
ordinal: 133000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Observed failure

Direct report from Conversation Prime-Agent-Pi (`01a18414-077b-7038-85d3-6d13ece95269`), not a new reproduction: in `/Users/jlanders/code/prime-agent`, the owning primary checkout was clean and pushed on `fix/daemon-cwd-session-recovery`, at code HEAD/upstream `a1faacd53ac4473a75de1d434afaf50945c2f647`. This was the reviewed TypeScript baseline.

Joe invoked `/implement-task TASK-2` for “Prevent orphaned RLM settlement after child finalization errors”. Backlog was the sole valid provider, with an ignored independent ordinary-Git `.backlog` clone, origin `https://github.com/SailorJoe6/prime-agent.git`, task ref `refs/heads/prime-claw/tasks`, and task path `.backlog/tasks/task-2 - Prevent-orphaned-RLM-settlement-after-child-finalization-errors.md`. The task was `In Planning`, with a meaningful 642-word plan, seven unchecked acceptance criteria and no blocking dependencies. Its complete specification/plan had been read and judged ready; task HEAD, FETCH_HEAD and direct published revision agreed at `61b5bfe5870e2d04ff092d6280db894f104c1997`.

The canonical readiness workflow completed preparation and called `create_task_episode` exactly once with `{"taskId":"TASK-2"}`. It returned:

> Task Episode creation failed: Task-native Episode creation must run from the canonical primary main checkout

Afterward, the task remained field-for-field unchanged in `In Planning`; the task clone remained clean and published at the same revision; no `.prime-claw/ownership.json` existed; and the worktree inventory contained only the original primary and existing cwd-fix/upstream-assessment trees, with no new Episode tree. Code stayed clean and unchanged. No implementation, status change, assignment/handoff, branch switch, bypass or creation retry was attempted. These are observed native/Git/filesystem facts, not proof about unseen resources.

Local main was `08ff1b2e2794ea9e8f4a08d12bc95408a66e1074` (v0.9.7), four commits behind the selected baseline (`main...HEAD` = `0/4`); origin/main was independently newer/different. Switching to main would change the approved implementation basis. No switch, merge, pull or reset workaround was authorized.

Joe's feedback: '"The tool requires the canonical primary main checkout" bad design. it blocks stacking PRs and other such fun'

## Source evidence and diagnosis

Prime Claw source inspected at `24b519c3c967269dd3867bf06a9e92a2f125012d`: `src/prime-agent-plugin/extension-support/spec-episode.ts:3145-3153` rejects `git.branch(projectRoot) !== "main"` alongside primary-checkout identity checks. Beads admission repeats this at `2913-2921`. This confirms a literal branch-name restriction; equating primary ownership with main is the inferred design defect, not a newly reproduced runtime trace.

Downstream assumptions also need coherent treatment: task blocked handling (`977-984`), handoff (`1776-1782`), cleanup (`2671-2673`), and terminal publication/ancestry checks (`2547-2605`, including Beads direct-remote `main`). Managed oversight at `src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md:41-49` hardcodes main for readiness, merge and abandonment. `src/prime-agent-plugin/workflows/implement-task.md:90` also assumes canonical main. Removing only the admission check is insufficient.

## Intended outcome and boundaries

Allow an explicitly operator-selected, clean, published feature/stack base in the primary owning checkout. Bind the exact admitted base commit and intended integration branch so continuation, review, merge and cleanup use the correct target. Main may remain the default, not a universal admission gate. Preserve task/provider/publication/owner/resource identity, isolated Episode resources, and explicit operator merge/abandonment authority.

Use native Git/provider behavior and the smallest explicit binding needed. Do not introduce a branch classifier, reconciler, coordinator, new state machine or lifecycle receipts. This bug concerns task-native admission and affected downstream target assumptions, not blanket permission for arbitrary checkout admission. Preserve legacy compatibility and the distinct post-acceptance primary-main `--user-global` activation policy. No Prime Agent source changes, release/Rust/fork proposals, or changes to foreign TASK-2 are in scope. This ticket authorizes specification review only, not planning, implementation or real Episode reproduction.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An explicitly selected clean, published non-main base in the primary owning checkout can admit an otherwise-ready task Episode without changing the selected baseline; main remains a supported default.
- [ ] #2 The exact base commit and intended integration branch remain unambiguous for the same owner/task/Episode through continuation, blocked handling, review and terminal cleanup; merge and publication target that integration branch rather than a hardcoded main.
- [ ] #3 Admission never silently switches the primary checkout to main, discards stacked commits or substitutes another implementation basis. Existing unsafe-state, provider/publication, owner and resource identity rejections remain effective, with isolation preserved.
- [ ] #4 Merge and abandonment still require explicit operator authority. Task status/publication and terminal ancestry checks remain correct for the selected target; unrelated tasks and resources are not changed.
- [ ] #5 Focused disposable regression evidence covers clean published non-main acceptance with isolation/identity and invalid admission leaving task/resources unchanged. Review affected managed instructions for consistent target handling; do not require a new broad test harness or matrix.
- [ ] #6 The change stays within Prime Claw, preserves legacy compatibility and does not loosen the separate primary-main user-global activation policy or introduce unnecessary coordination/state machinery.
<!-- AC:END -->
