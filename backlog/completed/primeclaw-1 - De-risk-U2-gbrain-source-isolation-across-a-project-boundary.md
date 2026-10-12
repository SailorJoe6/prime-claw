---
id: PRIMECLAW-1
title: 'De-risk U2: gbrain source isolation across a project boundary'
status: Done
assignee: []
created_date: '2026-10-12 01:00'
labels: []
dependencies: []
priority: p1
type: task
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase 1 (de-risk gate) unknown U2 — RE-SCOPED by the 2026-09-10 design interview (.ralph/plans/DECISIONS.md D4). Do NOT test gbrain source-isolation semantics (already known: isolated vs federated source registration). Instead prove the gbrain brain stack runs inside the fresh OpenShell sandbox: gbrain CLI installs/operates in-sandbox, brain repo folder available in-sandbox, Postgres 16 + pgvector runs in-sandbox, gbrain serves search/query against it. Host localhost:5433 exposure is a non-blocking nice-to-have (R-U2-5). Long-run context: this sandbox replaces brain-daemon-ralph-pva. Spec: .ralph/plans/SPECIFICATION.md; requirements R-U2-1..5 in .ralph/plans/REQUIREMENTS.md; slice 4 in .ralph/plans/EXECUTION_PLAN.md.

## Legacy notes

Now Phase 1 (de-risk gate) unknown U2 in LONG_RANGE_PLAN.md. Verify gbrain universal default + per-project named sources isolate context with no bleed. Documented go/no-go required before Phase 2.
2026-09-10: Description corrected to the re-scoped U2 (brain stack in sandbox, not gbrain semantics). EXECUTION_PLAN.md slice 4. Postgres 16 MUST include pgvector (matches brain-daemon-ralph-pva).
2026-09-11 U2 GO (incl. R-U2-6 embedding). Brain stack baked into custom image prime-claw-brain:0.1.0 (D15). PG 16.15+pgvector 0.6.0 owned by sandbox user; gbrain 0.49.0.0 serves search/query+embeddings from in-sandbox PG. Embedding via AI Gateway L7 placeholder (key never on disk). ROOT CAUSE recorded: gbrain runs as a Bun binary; Bun fetch identity must be bound in policy binaries (bun+gbrain added). Provider env injected at create, not per-exec. Evidence: docs/derisk/evidence/phase1-brain-20260911T181331Z.json. Validator 6/6 PASS.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed
<!-- SECTION:FINAL_SUMMARY:END -->
