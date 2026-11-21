---
id: PRIMECLAW-64
title: Activate Backlog.md v1.55.3 and reconcile managed workflows
status: In Design
assignee: []
created_date: '2026-11-21 20:38'
labels: []
dependencies:
  - PRIMECLAW-45
references:
  - PRIMECLAW-45
  - 'https://github.com/MrLesk/Backlog.md/releases/tag/v1.55.3'
documentation:
  - docs/backlog.md
  - docs/project-initialization.md
  - docs/evidence/primeclaw45-integrated-compatibility-20261115.md
priority: p1
type: task
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome and authority

Complete the post-merge Backlog.md v1.55.3 rollout for prime-claw. Joe explicitly authorized this through the Backlog.md Expert: “Do it — or ask the Prime-Claw agent to do it.” The Expert delegated creation of this separate task, planning, and implementation if ready, including supported host/plugin activation, one coordinated full Prime Agent restart, and live UAT. Preserve that conditional authority across phases; do not ask again solely because a phase ended. Product/scope changes, new source merges, destructive data repair, and customized-asset replacement retain their normal explicit decisions.

PRIMECLAW-45 is merged, active Done, and cleaned up. It explicitly excluded activation and must not be reopened. Its compatibility implementation pins unmodified upstream v1.55.3 commit `0cf4fdbc70020327f4366a29d3f405f83d180301`. Initial read-only checks for this task show canonical main `5e52159927063ec01176305059c4632d45e5e848`, that exact submodule HEAD, and both `deps/backlog/dist/backlog` and the global `~/.local/bin/backlog` still reporting 1.53.0. Source publication is not artifact activation. Backlog Expert retains its separate v1.53.0 latest-stable pointer until it receives verified activation/UAT evidence; that pointer is not this task's mutation surface.

## Required rollout behavior

Build the merged exact v1.55.3 source using the supported pinned toolchain and existing build/compiled smoke interfaces. Establish the exact source, artifact identity/hash, version, installation destination, and supported command resolution. Preserve the accepted fallback until the reviewed replacement is proven; report failed or uncertain writes by inspecting actual state rather than blindly retrying. Do not print or obtain credentials, alter upstream source, or patch Prime Agent.

Activate the accepted Backlog artifact and coherent prime-claw user-global plugin generation through their supported installation paths, from canonical primary main at the deployment boundary. Candidate plugin development/testing remains Docker-only; no candidate host apply/check or second Prime Agent daemon. If narrow rollout tooling/docs changes are needed, deliver them through the normal isolated Episode, validation, review, and operator-controlled merge before deploying merged source. An Episode must not activate a candidate globally. Preserve unrelated global files/configuration and avoid project/global duplicate plugin discovery.

A global binary swap alone is insufficient. Inventory the relevant installed global guidance and discoverable prime-claw-managed project workflow assets using supported project/asset evidence. Bound discovery to known managed/registered project contexts; do not crawl or mutate arbitrary home-directory repositories. Distinguish ordinary Backlog projects, initialized prime-claw projects, customization/override conflicts, active or uncertain Episode snapshots, and unrelated projects. Establish and document the supported project-upgrade/reconciliation boundary. Reconcile safe untouched assets only in the selected prime-claw project through the existing initializer; preserve customized/unknown bytes, index state, task history, and live-generation resources. Coordinate other projects through their actual owners or report exact operator actions, not silent cross-project writes. Do not accept/reset overrides or overwrite customized assets without a separate explicit content decision.

Account for removed `task complete`/`task_complete`, legacy `completed/` versus canonical `archive/tasks/`, status-derived closure, archive identity reservation/read-only behavior, ordering/pagination, and unattended inputs. Legacy completed storage remains readable and does not imply a universal data rewrite. Use supported non-mutating native doctor inspection for each affected project that can be safely inspected; report unavailable evidence rather than assuming health. Never run `doctor --fix`, renumber/delete/relocate records, switch providers, or migrate real data under this rollout authority. Preserve the accepted archived-draft physical-byte/history/collision policy; unavailable archived-draft native view alone is not a new blocker.

Before coordinated restart, safely account for running/queued/unfinished work and explicitly owned descendants through actual owner/session evidence. Do not force-stop foreign work or infer ownership from CWD. Preserve every resource the old loaded generation may read. Coordinate the one full restart with Joe/the owning maintenance coordinator through supported public interfaces; do not use `/reload`, copy success, a fresh probe, or elapsed time as cutover proof. Existing schedules stay unchanged unless separately authorized.

After restart, prove exact installed artifact and plugin generation through successful live UAT in resumed owning Conversation, its exact Episode where applicable, and a designated ordinary project session. Exercise representative real native task/history and workflow behavior at the actual installed boundary without modifying unrelated production tasks/projects. Report any unsupported interface or unsafe active stale workflow as a blocker, not completed rollout. Inactive projects with unresolved customization must be explicitly identified as requiring owner/operator upgrade, not represented as upgraded. Document acceptance scope and any real deployment limitations.

Send the Backlog.md Expert exact published source/build/install/restart/UAT evidence and the affected-project/operator-action inventory. Only that Expert advances its own latest-stable pointer after verification.

## Non-goals

No new project manager/framework, parallel task authority, custom allocator/parser/index, global compliance database, broad refactor, upstream/Prime Agent patch, new sandbox rollout, mass repository mutation, blanket doctor fix, schedule changes, or reopening/completing PRIMECLAW-45 again. Reuse its unchanged compatibility/build/test evidence within stated limits, with fresh validation for changed and activated surfaces. Keep failed and incomplete histories distinct from passing proof. The native task remains the specification and living plan, not a new .ralph bundle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A separate published native task carries the rollout authority and boundaries while PRIMECLAW-45 remains active Done; canonical source and pre-activation artifact state are verified.
- [ ] #2 The supported build and compiled smoke produce a version-1.55.3 artifact from exact unmodified upstream 0cf4fdbc70020327f4366a29d3f405f83d180301, with exact source/toolchain/artifact identities and preserved fallback evidence.
- [ ] #3 Installed global guidance and known managed-project workflows are inventoried for removed commands, lifecycle/storage semantics, complete identity-set reads, and unattended input; the supported upgrade boundary, safe selected-project reconciliation, preserved customizations/snapshots, and exact deferred owner/operator actions are documented.
- [ ] #4 Plain Backlog projects are not presumed to need data conversion; supported non-mutating doctor evidence or exact inspection limits are reported per affected project, with no doctor --fix, provider switch, silent cross-project mutation, or destructive history repair.
- [ ] #5 Accepted merged source is installed through supported canonical-primary user-global/artifact paths, preserving unrelated global state and all old-generation live resources; no candidate host install or second daemon is used.
- [ ] #6 One safely coordinated full restart is followed by successful resumed-owner, applicable exact-Episode, and designated ordinary-session live UAT that proves the actual installed Backlog version/plugin generation and representative native workflow/history behavior; installation or a fresh probe alone is not cutover proof.
- [ ] #7 The Backlog.md Expert receives exact activation/UAT and project-impact evidence before it decides to advance its separate latest-stable pointer; failures, unresolved customizations, required operator actions, and acceptance limits remain explicit.
<!-- AC:END -->
