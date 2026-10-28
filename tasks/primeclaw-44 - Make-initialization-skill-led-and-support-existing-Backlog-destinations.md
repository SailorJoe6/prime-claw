---
id: PRIMECLAW-44
title: Make initialization skill-led and support existing Backlog destinations
status: In Design
assignee: []
created_date: '2026-10-28 02:55'
labels: []
dependencies: []
references:
  - docs/project-initialization.md
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - src/prime-agent-plugin/extension-support/task-providers.ts
documentation:
  - docs/user-stories/B-project-initialization.md
priority: p1
type: enhancement
ordinal: 129000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome
Make the initialization and Beads-to-Backlog migration experience usable through one agent-guided Markdown skill. Correct the reported setup and migration admission problems without redesigning the existing Beads issue importer.

## Context
Live ralph-pva initialization exposed four issues: the custom initialization slash command exposes an agent-oriented interface to the operator; customized-skill comparisons temporarily overwrite real files; migration rejects an existing Backlog destination rather than preserving it; and source capture requires unused Prime Claw custom lifecycle statuses in the Beads store being retired. The reported project already has Backlog tasks and configuration as well as Beads issues. Their coexistence is expected input to this explicit one-way migration, not ambiguity in the operator's intent.

## Required behavior
- Provide one initialization Markdown skill covering setup, upgrades, comparisons, and migration. The agent uses the underlying initialization tool; the operator need not learn its action arguments. Replace the custom initializer slash-command interface with skill-led guidance. Do not add a separate migration skill.
- Generate a standard Git diff for comparison and let the operator read the patch as text. No specialized viewer is required. Generating or displaying a comparison must not temporarily overwrite, stage, or restore the actual skill or workflow files. Reviewing a patch does not accept an override or reset an asset. Preserve project customizations and do not silently discard existing interrupted-review evidence.
- The migration operation is Beads to Backlog only. An existing ordinary backlog/ or independent .backlog/ is a destination to preserve and merge into, not a reason to reject the migration or ask for separate preservation approval.
- Keep existing Backlog task IDs unchanged. Preserve the existing tasks, including archived records, their contents/history, and the existing Backlog configuration. Migrate the configuration along with the store rather than replacing it with fresh defaults. Perform only the layout adjustments needed to finish with the standard .backlog/ store and standard native root configuration symlink; do not leave an ordinary backlog/ as a second live store.
- Reuse the existing Beads issue migration behavior. Do not redesign how its IDs, fields/statuses, history/provenance, or relationships are migrated, introduce new ID-allocation or deduplication policy, or add a new semantic-placement mechanism. The previously supported legacy open to In Design and closed to Done mappings remain the baseline. The tentative deferred-to-drafts suggestion is not approved new mapping scope.
- Validate the outgoing Beads store for the native reads/export/history required by migration, separately from lifecycle write readiness. Do not require defining unused in_design, in_planning, ready_for_merge, or done statuses in the outgoing source merely to migrate away. Do not reconfigure source status definitions as a prerequisite or workaround.
- Keep the existing explicit migration confirmation and source/destination identity, completeness, publication, quiescence, ownership, and verified-cutover protections. Successful verification precedes source retirement. The change is not permission to bypass genuine dirty, unsafe, incomplete, or unverified state.

## Scope boundaries and evidence
Design and validate these changes with disposable fixtures. The ralph-pva observations are motivating examples, not authority to mutate that project's live stores. In particular, the reported two active Backlog tasks plus an archived prefix-probe record must not be silently removed or renumbered. Do not broaden this work into removing ordinary Beads execution support, changing task lifecycle policy, implementing a viewer, or rewriting Prime Agent. Implementation, merge, global activation, and any live migration require their separate normal authority.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One Markdown initialization skill guides setup, upgrades, textual comparisons, and migration through the agent-facing tool; the custom initializer slash-command interface and a separate migration skill are not required.
- [ ] #2 A comparison produces a readable standard Git patch as text while actual project skill/workflow bytes and Git index remain unchanged; no special viewer, temporary actual-file overwrite, or implicit override acceptance is used.
- [ ] #3 The migration entry point supports only Beads to Backlog; an existing backlog/ or .backlog/ destination is recognized as expected input rather than rejected merely for coexistence with Beads or for containing existing tasks.
- [ ] #4 Existing Backlog task IDs, task contents, archived records, history, and configuration are preserved through import and layout normalization; preservation is a requirement, not an extra approval gate.
- [ ] #5 After a successful confirmed migration, Backlog uses only the standard .backlog/ layout with its standard root configuration symlink; the prior ordinary backlog/ and Beads source do not remain separate live stores.
- [ ] #6 Existing Beads issue import behavior, including IDs, field/status projection, history/provenance, and relationships, is reused without a new ID-allocation, deduplication, or conversion-policy redesign.
- [ ] #7 A legacy Beads source can be inspected and migrated without adding unused Prime Claw custom lifecycle statuses or otherwise changing its status definitions; the migration checks required source-read/export/history capabilities instead of lifecycle write readiness.
- [ ] #8 Existing explicit confirmation and identity, completeness, publication, quiescence, ownership-continuity, destination verification, and source-retirement protections still apply; there is no automatic migration or safety bypass.
- [ ] #9 Disposable regression fixtures cover existing ordinary and hidden Backlog destinations, unchanged existing IDs/configuration/archived records, a legacy Beads source without the unused custom statuses, and non-mutating textual comparison; existing importer regression evidence remains applicable.
- [ ] #10 Operator and agent documentation describe the agreed skill-led flow, text patches, one-way migration into existing Backlog, final layout, and source-read validation; no live ralph-pva migration or deployment is performed as part of this task.
<!-- AC:END -->
