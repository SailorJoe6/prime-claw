---
name: spec-it-out-legacy
description: Retained folder-based synthesis workflow when the conversation already contains most of a future specification.
---

Use the current conversation to specify the proposed legacy-folder work. Do not
start implementation. If `.prime-claw/legacy-specifications.json` exists, the
shared `design-legacy` guard stops this compatibility authoring path and routes
new or revised work to the selected-provider task UX. Ask only the remaining questions that need operator input,
one at a time. For small details that are already clear, use your best judgment.

Before saving, read the project-local `design-legacy` skill and apply its shared
contract from `## Create the future specification` through
`## Stop for operator review`. That is the single common authority for slug
selection, `.ralph/plans/future/<slug>/SPECIFICATION.md`, proportional product
scope, living-specification updates, review links, and the stop before planning
or implementation. Do not repeat or replace that shared Markdown here.

This compatibility skill authors only the retained future-folder specification.
It does not create or edit a Backlog task, change task status, plan, implement,
create an Episode, or claim lifecycle, finalization, archival, or cleanup
authority.
