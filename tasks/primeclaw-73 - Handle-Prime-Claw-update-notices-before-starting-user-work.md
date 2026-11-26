---
id: PRIMECLAW-73
title: Handle Prime Claw update notices before starting user work
status: In Design
assignee: []
created_date: '2026-11-25 00:07'
updated_date: '2026-11-26 18:12'
labels: []
dependencies:
  - PRIMECLAW-74
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/6b265cca76aec3272bed7f6120d11b14c44d6ca1/archive/tasks/primeclaw-58%20-%20Make-startup-initialization-read-only-and-LLM-mediated.md
documentation:
  - docs/project-initialization.md
priority: p1
type: bug
ordinal: 157000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Joe reports that after a plugin upgrade with project skill and workflow changes, sessions did not reconcile the local assets until he explicitly invoked `/skill:initialize-prime-claw`. This session saw `update-available` and moved on. The shipped startup guidance currently allows deferral for requests that do not depend on the update; that behavior does not meet the requested order. Follow-up to PRIMECLAW-58, not a request for the startup hook to mutate the project.

When a session receives an applicable update notice, it must handle it before doing any work on the pending user request or assignment, even for a quick unrelated request. Use the existing initialization skill for safe upgrades without waiting for Joe to invoke it. Keep startup detection read-only and preserve customized assets, explicit no-mutation instructions, and existing decisions that require operator authority. Preserve the original request.

Report the outcome to the user before starting their task. On success, say what local skills/workflows changed, that changes are in the worktree for review but not staged or committed, and offer to show diffs. Say the requested task has not started and the session is ready to start it; stop at that user-visible boundary rather than silently starting in the same response. If blocked or failed, report what changed, what did not, and what needs attention. Say the task has not started and do not claim readiness.

After PRIMECLAW-74 removes the unwanted write, align REQUIREMENTS.md P2 and US-06 in docs/user-stories/B-project-initialization.md with this policy. Startup inspection stays read-only; applicable upgrade reconciliation and user-visible reporting precede task work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A pending request, including an unrelated quick question, does not run ahead of an applicable update notice. The agent uses the existing initialization skill for safe reconciliation without a manual slash command; startup inspection itself makes no writes.
- [ ] #2 Before task work starts, a successful upgrade report identifies the changed local assets, says the changes are reviewable in the worktree and not staged or committed, offers diffs, and explicitly says the task has not started and the agent is ready to start.
- [ ] #3 A blocked, failed, or explicitly disallowed upgrade surfaces the actual outcome and any decision needed before task work; no false success/readiness, bypass of customization protections, or Git staging/commit.
<!-- AC:END -->
