---
id: PRIMECLAW-67
title: Reopen cold Episodes without reserving a display name
status: In Progress
assignee: []
created_date: '2026-11-22T07:44:00Z'
updated_date: '2026-11-22T07:55:00Z'
labels: []
dependencies: []
references:
  - PRIMECLAW-15
  - PRIMECLAW-57
  - >-
    https://github.com/SailorJoe6/prime-claw/commit/5ffb2e7942ea16bf53f97f88513b14a120d67839
priority: p1
type: bug
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ordinary handoff identifies the exact saved Episode but cold reopen requests a generated name. A different saved root reserving that name prevents publication and both canonical prompts. Reopen by exact saved file, durable ID and worktree without a requested or expected display name; preserve all routing checks and fresh-session naming. Scope is a tested source candidate, not activation or recovery of any live Episode.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Offline Docker fixture with a cold saved Episode and an unrelated saved root reserving the generated name receives exactly one canonical handoff and one execute on the original durable session; no duplicate session, initial assignment replay, or changes to the foreign session.
- [x] #2 Wrong returned durable ID, saved file or CWD, or missing route, still stops; fresh creation still requests and verifies its display name.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Published tested review candidate `5ffb2e7942ea16bf53f97f88513b14a120d67839` on `fix/episode-cold-reopen` (base `7e13fd54924615986cfb49435d45e9fe80cde274`, main untouched). Saved-session reopen now omits the requested/expected display name; exact durable ID/file/worktree/route validation and fresh-session naming remain intact.

Docker-only Tier 1, verified Prime Agent TypeScript `cwd-fix-v0.9.8-r1` (0.9.8), offline runtime with fixture task facts and a no-op model provider. Ordinary handoff reproduced the collision on unchanged base, then on candidate reopened the same cold ID/file/worktree and delivered original assignment, handoff, execute exactly once each, in order. Names, session inventory, and unrelated journal bytes stayed unchanged. Publisher regressions cover wrong ID/file/CWD, missing route, and fresh naming. Candidate focused run: 4 pytest checks passed (including 325 Episode Node tests); one separate Beads journal-identity test failed identically on the base (82/83 ownership Node tests passed on the candidate). Candidate evidence run `20261122T075123Z-61077-8cfb0d90`, baseline `20261122T075131Z-61526-cc2e0b24`.

Held open for Joe's review. Independent Astra review not performed: native RLM did not list an Astra selector under the launching openai-codex provider. This is fixture delivery evidence, not live UAT, activation, or recovery permission. No merge, restart, global install, or optionbacktesting Episode operations.
<!-- SECTION:NOTES:END -->
