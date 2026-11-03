---
id: PRIMECLAW-52
title: Drop Beads deferral state during Backlog migration
status: In Planning
assignee: []
created_date: '2026-11-02 21:52'
updated_date: '2026-11-03 02:18'
labels: []
dependencies: []
references:
  - PRIMECLAW-44
  - PRIMECLAW-46
  - PRIMECLAW-49
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - src/prime-agent-plugin/extension-support/task-providers.ts
priority: p2
type: bug
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome
During one-way Beads→Backlog migration, import a native Beads task whose status is `deferred` as an ordinary `In Design` task. Drop active deferral state and deferral-only structured fields from the destination projection. Do not modify the retiring Beads source to achieve this.

## Product instruction and context
Joe’s instruction, relayed by NemoHermes Upgrade: “Just drop any "deferred" status and related fiedls as part of the migratino.” This supersedes the earlier unapproved proposal that the task must remain frozen or outside ready work. The selected behavior is the normal new/open task default, not a special destination lifecycle or scheduling feature.

NemoHermes Upgrade reports canonical inspection at Nemo housekeeping commit `b8c9be358df4fc5fc67d1aec74feb7c4943572e1` stops with `Beads source lifecycle preflight failed: nemo-setup-5lt status="deferred": unsupported status`. The task is titled `DEFERRED: Decide + enable web search provider`, with `defer_until=2026-08-01T00:00:00Z`. The reported native catalog defines deferred as frozen; the issue inventory is 33 issues (30 closed, one open, one blocked, one deferred), separate from the last-observed 19 memory records. These are reported consultation facts, not a new live inspection or proof of destination memory outputs.

The accepted importer currently projects fixed canonical Beads lifecycle names plus legacy open/closed and rejects deferred during source preflight. No existing runtime mapping override exists; semantic-placement prose does not change that projection. This task is the narrow destination-behavior change, not a repair of malformed source or another memory parser change.

## Required behavior
- Recognize native Beads `deferred` in inspection and destination conversion as the ordinary `In Design` projection. Use the same meaning in destination verification/replay; do not let source classification reject this selected case before projection.
- Do not create a Deferred status, active `defer_until` or other deferral-only destination fields, snooze/auto-wake behavior, special deferral annotations, or forced Draft/Blocked/archive placement. Timed, expired and indefinite source deferral do not change this destination meaning.
- Preserve ordinary title, description, notes, comments, native history and provenance. Native `bd defer --reason` appends ordinary notes; it is not a dedicated field to strip. Do not delete or rewrite ordinary text merely because it contains “deferred”, including the reported title.
- Retain the canonical raw source-capture and receipt/provenance evidence already required for lossless history. Historical deferral values may remain inside that existing raw evidence; do not restore them as active destination fields, scheduling or additional deferral annotations.
- Keep Beads unchanged and authoritative until the existing verified cutover. Never call ready/defer/undefer/status/config edits to normalize source data. Keep safe refusal for other genuinely unmapped statuses and preserve existing identity, relationship, publication, ownership, receipt/replay and guarded-retirement protections.

## Scope and authority
Use the least technology needed for this one supported projection and its focused regression coverage. Update directly affected guidance if it would otherwise contradict the behavior. No generic mapping/override framework, new controller, dependency upgrade, scheduling feature, unrelated importer cleanup, or reopening completed PRIMECLAW-44/46/49. Their accepted guarantees remain context, not unfinished work.

Authoring this task does not approve an implementation plan, implementation, merge, global activation, restart or live migration/source deletion. Candidate validation must use disposable fixtures and the repository’s Docker-only plugin workflow, including the mandatory Tier 1 probe after plugin-source changes. Do not run another live Nemo inspection to bypass the current guard or change Nemo tasks, provider or configuration. Planning and later lifecycle actions require their normal separate authority.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Native Beads deferred tasks pass source lifecycle inspection as nonterminal ordinary work and migrate to existing Backlog In Design tasks; dated (past or future) and indefinite deferral have the same destination meaning.
- [ ] #2 Projected destination task fields contain no active deferral status, defer_until or other deferral-only fields, snooze/auto-wake behavior or additional deferral annotations; no Deferred status, forced Draft/Blocked/archive semantics or generic mapping override is introduced.
- [ ] #3 Ordinary titles, descriptions, notes (including any reason appended by bd defer), comments and native history/provenance are preserved without keyword-based text deletion; existing canonical raw capture/receipt evidence may retain historical deferral values without making them active destination state.
- [ ] #4 Disposable-fixture evidence proves the Beads source stays unchanged: no ready/defer/undefer/status/config mutation is used to normalize it. Existing source-authoritative publication and guarded-retirement requirements remain intact.
- [ ] #5 Destination readback and exact replay agree with the selected In Design projection and stripped active deferral fields; other genuinely unmapped source statuses still fail safely without destination/source mutation.
- [ ] #6 Focused regression evidence covers the reported native deferred/defer_until case and preserves existing issue-versus-memory handling, identity/relationships and receipt/publication safeguards. Required Docker-only plugin validation, including Tier 1 probe, is reported truthfully; no live Nemo migration or user-global deployment is used as candidate validation.
<!-- AC:END -->
