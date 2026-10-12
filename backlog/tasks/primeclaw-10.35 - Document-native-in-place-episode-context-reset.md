---
id: PRIMECLAW-10.35
title: Document native in-place episode context reset
status: To Do
assignee: []
created_date: '2026-10-12 01:01'
labels:
  - documentation
  - episode-loop
  - lifecycle
  - phase4
  - prime-agent
  - ralph
  - recovery
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document the proven operator recovery procedure for an EPISODE whose provider-visible conversation branch is unusable while its branch, worktree, uncommitted implementation, durable plan, Bead, and trusted ownership remain valid. No new Prime Claw runtime capability is required: the recovery uses native Prime Agent SessionManager branching plus existing agent stop/send interfaces while retaining the same episode generation and worktree.

## Legacy design

Add an owner runbook to the conversation-driven episode oversight documentation. Cover authorization, exact identity checks, idle/no-queued-work preflight, private rollback snapshot and hashes, dry-run against a copied session, selection of a verified safe ancestor, SessionManager.branchWithSummary with a repository-first summary, stop/reopen sequencing, and postchecks for bounded identity, owner marker, episode ID, session file, branch, worktree, Git diff, and active route. Include rollback and failure handling. State that this is context-branch recovery, not a new episode, handoff, execute, finalization, or worktree recreation. Do not patch Prime Agent upstream or add plugin machinery unless later evidence shows native interfaces are insufficient.

## Legacy notes

Discovery incident: official-lean-compatibility-cleanup episode 01a10774-0155-7316-a329-50ee5f7d17be in /Users/jlanders/code/prime-claw-official-lean-compatibility-cleanup-episode. A one-time operator-authorized recovery used SessionManager.branchWithSummary after an exact dry run, preserving the session/episode ID and bounded identity while starting active route e24204e3df98. Private recovery evidence: /Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/episode-session-replacement-20261006T033506Z. This note records evidence, not acceptance of a future implementation.
OPERATOR CORRECTION: the recovery already succeeded using native Prime Agent features. Reclassify this from feature implementation to documentation/runbook work. The retained requirement is to make the proven procedure repeatable and safe, not to add a new plugin API.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Documentation includes an exact, privacy-safe command/API sequence and checklist proven by the official-lean-compatibility-cleanup incident; explains when to use it and when to stop; distinguishes session context reset from episode replacement; records rollback and verification steps; links the private incident evidence without copying private session content; and is covered by focused documentation assertions if the project maintains them. The Bead and docs must not claim a new runtime feature is needed or implemented.
<!-- AC:END -->
