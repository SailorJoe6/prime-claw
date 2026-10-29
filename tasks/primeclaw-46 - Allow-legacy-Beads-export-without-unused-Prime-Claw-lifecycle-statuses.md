---
id: PRIMECLAW-46
title: Allow legacy Beads export without unused Prime Claw lifecycle statuses
status: In Planning
assignee: []
created_date: '2026-10-28 22:04'
updated_date: '2026-10-29 15:26'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - src/prime-agent-plugin/extension-support/task-providers.ts
priority: p1
type: bug
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Report and impact
Reported by the Initialize PVA on Prime-Claw conversation during Joe’s live ralph-pva migration. This issue records the supplied observations; they have not been independently reproduced here. Beads → Backlog switch inspection refuses a readable legacy source because it lacks unused Prime Claw custom lifecycle statuses. This blocks migration away from Beads and incorrectly recommends mutating the outgoing source schema.

## Reproduction (reported; do not run against the live project without authority)
Project: /Users/jlanders/gitlab_local/ralph-pva.
Call initialize_prime_claw(action="switch-request", targetProvider="backlog").
Observed failure: "Beads capability check failed: the status mapping is incomplete: in_design:active (custom); in_planning:active (custom); ready_for_merge:wip (custom); done:done (custom)". Suggested workaround is bd config set status.custom.
bd statuses --json reports built-ins only: open(active), in_progress(wip), blocked(wip), deferred(frozen), closed(done, description Completed), pinned(frozen), hooked(wip).

## Reported cause and related semantic seam
Installed extension-support/task-provider-migration.ts captureBeads() lines 529–535 unconditionally calls checkBeadsCapabilities() before source export. extension-support/task-providers.ts lines 867–871 describe that shared gate as target readiness for lifecycle mutation; lines 914–927 require all four custom statuses. Source read/export readiness is therefore coupled to ongoing Beads write readiness. Line numbers refer to the reporter’s installed generation, not necessarily current builder source.
statusFromBeads() lines 769–775 already maps legacy open → In Design and closed → Done. Separately, captureBeads() lines 551–552 reportedly classifies every legacy closed issue as archived. Closed alone does not prove abandonment or justify archival; preserve actual completion, close_reason, and history evidence.

## Required behavior and open design question
Export the outgoing Beads schema as-is, without adding unused statuses. Translate statuses actually present into supported Backlog semantics and preserve original native status/category/context, full history, and provenance.
Joe’s explicit mappings: open → Backlog In Design; closed → Backlog Done, not automatically abandoned/archived.
Deferred → native Backlog drafts was proposed tentatively, not approved. Inspect complete inventory, including deferred/pinned/hooked and any custom statuses, rather than assuming unused statuses have no instances. Resolve unsupported or ambiguous mappings without silent loss.
Keep source readability, complete inventory/history/provenance, identity, clean published revisions, quiescence, ownership continuity, receipt verification, and cutover/deletion proofs. Do not relax destination Beads lifecycle/write checks as a side effect.

## Live state and scope boundaries (reported snapshot)
Previously observed inventory: 406 Beads issues. Existing ordinary backlog/ contains RPVA-1, RPVA-2, and an archived RPVA-2 prefix probe; neither store has been migrated or deleted. Skill/setup publication: 094cbb7 (17 assets, prepare-only accepted override); remaining checkpoints: 2b3cf60. Joe separately authorized parking backlog/config.yml as backlog/config.yml.pre-migration, published as 3f29fb6, to bypass dual-provider discovery. Existing Backlog tasks are unchanged; runtime locks privately excluded, not deleted. A disposable fixture proved discovery/native CLI routing only, not end-to-end migration.
No custom Beads source statuses configured; no switch-confirm issued. This issue does not authorize live ralph-pva mutation, provider switching, check bypass, source deletion, merge, or deployment. Candidate validation must use disposable fixtures; implementation remains a separate approved lifecycle action.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Read-only Beads → Backlog inspection/export accepts a legacy built-in-only source without requiring or configuring unused Prime Claw custom statuses.
- [ ] #2 Preserve all source read/publication, complete inventory/history/provenance, identity, quiescence, ownership continuity, receipt, and cutover/deletion safety proofs; destination Beads write readiness remains enforced where applicable.
- [ ] #3 Legacy open maps to Backlog In Design and closed maps to Done; closed alone does not imply abandonment or archival, and native status/category, close_reason, context, and history remain recoverable.
- [ ] #4 Inspect every status actually present, including deferred/pinned/hooked or custom statuses; deferred-to-drafts stays an explicit unresolved design question until decided, with no silent omission or guessed mapping.
- [ ] #5 Disposable regression fixtures cover built-in-only source inspection, completed closed issues, full mixed-status inventory, and retained safety failures; no live migration is needed for candidate validation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In `task-providers.ts`, separate native Beads executable/version/status-catalog readability from strict lifecycle-write readiness. Add only a narrowly scoped migration-source transport purpose, strict by default. Use it for every outgoing-source capture, confirmation/recheck, and active-Episode workspace proof in `task-provider-migration.ts`. Keep ordinary Beads operations, Beads destinations, and post-cutover destination recovery strict; retain all existing publication, inventory, identity, quiescence, ownership, receipt, rollback, and deletion proofs. Never configure the outgoing source or add a general validation bypass.

2. Retain the full native status catalog/category context and source version in the existing snapshot, drift checks, and verified provenance. Before any destination writes, validate the complete inventory against migration-local projections: open/in_design → In Design; in_planning → In Planning; in_progress → In Progress; blocked → Blocked; ready_for_merge → Ready for Merge; done and ordinary closed → Done/completed. Use the same projections for counts, native writes, and status plus physical-placement verification. Archive only with exact existing prior-archive/Prime Claw abandonment evidence; preserve raw close_reason/history. Report exact task IDs and statuses for deferred/pinned/hooked, unknown semantics, or genuinely ambiguous archive evidence, and stop before destination creation. Deferred-to-drafts remains undecided; do not implement that mapping or guess from status categories or reason keywords.

3. Extend `tests/task_provider_migration.test.mjs` and `tests/task_providers.test.mjs` using disposable native fixtures. Cover built-in-only and partial-custom sources without source mutation, complete mixed-status preflight refusal, completed closed versus positively evidenced archive/abandonment, exact catalog/history preservation, active-source and repeated source proofs, and confirmed end-to-end migration. Retain existing safety/refusal coverage and strict write/destination capability rejection. Correct the fixture assumption that every closed issue is archived.

4. Run the focused provider/migration regressions and mandatory Docker tier 1 (`scripts/test-tier1.sh --probe`); no host plugin probes. Update only relevant migration guidance in `docs/project-initialization.md` / `docs/backlog.md` and the task with results. Keep this a local source-read/projection repair: no generic mapping framework, deterministic reconciliation/semantic-decision engine, new persistent workflow state, existing-destination work, global activation, or live migration. Commit and push the candidate through the separately admitted implementation Episode; merge remains a separate operator decision.
<!-- SECTION:PLAN:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Prime-Claw Expert
created: 2026-10-28 22:10
---
## Investigation and recommended fix (Prime-Claw Expert, 2026-10-28)

**Investigation complete; defect remains unfixed.** Scope was diagnosis and recommendation only. No plugin source/test changes, implementation admission, global refresh, live ralph-pva access, or migration. The issue remains In Design. Findings below are independently confirmed against builder main `b5fefa71788b845f9c568e914b0c915850e7f6d4`; installed-generation behavior was supplied by the original reporter. Personal-brain keyword/hybrid lookup returned no relevant migration context, so conclusions use current repository evidence and isolated Docker reproduction. An independent read-only child review agreed with the trace.

### Root cause hypothesis, now confirmed
A readable outgoing Beads store is required to satisfy Prime Claw's *future lifecycle mutation* contract. The wrong capability gate is shared by source export and transport, rather than being limited to ordinary Beads lifecycle work and Beads destinations.

- `src/prime-agent-plugin/extension-support/task-provider-migration.ts:535` calls `checkBeadsCapabilities()` before capture/export. Removing that line alone cannot fix the issue: lines 536–539 call ordinary/explicit transport, which both reach the same strict check at `task-providers.ts:1088–1101`.
- `task-providers.ts:873–937` combines executable/version + native statuses-JSON readability with a requirement for *every* canonical destination lifecycle name/category (`915–927`). A source with built-ins only fails before export even if it uses no missing custom status.
- Source active-Episode proof also uses strict explicit transport (`task-provider-migration.ts:682–686`). Capture/recheck and exact same-destination recovery paths repeatedly enter it (`604–608`, `1732–1755`, `2041`, `2052–2053`, `2060–2069`, `2098–2102`, `2110–2114`). An initial-inspection-only bypass would fail later.
- History check: both the strict source call and unconditional closed-as-archived classification already existed in migration introduction `4d624486d4e4dbad10878a7b6a348bbef1bcf944`. This is an original migration assumption, not evidence of a recent Beads regression.

### Related findings in the same failing path
1. **Completed legacy closed issues are silently projected into archive.** Capture labels every `closed` as `archived` (`551–552`). The writer then invokes `backlog task archive` (`1619–1620`) instead of `statusFromBeads()` (`769–775`), making the existing `closed → Done` fallback unreachable for a consistent source. Tasks are initially created In Progress (`1399`), then archived. The verifier skips status projection checks for archived tasks (`1653–1655`). Exact source bytes survive in provenance, but that does not correct native destination semantics.
2. **Actual unmapped source statuses are not caught during inspection.** `deferred`, `pinned`, and `hooked` have no mapping in `statusFromBeads()`. Capture counts them as open and inspection can report ready; confirm later throws at `1622`, after destination preparation/task creation. This must become a source-inventory projection decision before destination mutation, not a missing-unused-status error.
3. **Source status definitions are not retained by capture.** The strict gate reads statuses, then discards the catalog. Current snapshot/digest is based on task packages (`551–574`); the destination source package retains export/native view/history/events/provenance but no raw native status definition/category catalog (`1271–1285`). A source-read split must retain this meaning instead of merely deleting the gate.
4. **Do not erase real abandonment on round trips.** Prime Claw itself deliberately closes abandoned Episodes with an exact reason (`spec-episode.ts:2442–2443`, terminal verification `2577–2584`). Prior Backlog archives also become Beads `closed` with `prime_claw_migration` source metadata containing `classification: archived` and a generated close reason (`task-provider-migration.ts:952–958`, `984–985`). Ordinary closed means Done by default; only positive, exact archive/abandonment evidence can justify archive placement. A generic nonempty close_reason, a word match, or category `done` alone is not sufficient. Ambiguity needs a bounded operator decision, not a heuristic classifier.

### Reproduction and verification evidence
Used an existing tier-1 image by immutable identity:
`sha256:f0ef02d2f9e42e8489b49eaee7d1ebbdb0cbf4ffb251094cea6a1a406685eacd`
Image labels: Backlog 1.53.0 at `5d556c1954f7724abd180f6211cf528e9253ad4c`; Beads 1.3.1; Dolt 2.5.0. Container had `--network none`, read-only repo/probe mounts, isolated HOME/PRIME_AGENT_PLUGIN_ROOT, and only disposable in-container repositories plus local bare remotes. No host home, credentials, live provider stores, or global plugin mount. Both containers were removed and absence was checked.

The temporary Node probe reused only the repository helper from `tests/task_provider_migration.test.mjs:40–60`, imported unchanged builder modules, and created a native `bd init --server` source with no custom statuses. It published seven issues: open, in_progress, blocked, deferred, pinned, hooked, and ordinary closed with reason `Completed and verified successfully`. Procedure/results:
- Native inspection rejected the built-in-only source with the exact four-custom-status error. No .backlog destination was created.
- A diagnostic runner supplied valid custom-status rows for the *first* statuses read only; the second read still used the unchanged built-in-only source. Inspection failed with `Beads publication proof failed (capability)`, proving the nested gate. Native reread confirmed the source still had no custom statuses.
- A configured control was then used only inside that disposable fixture to reach capture. Inspection returned ready with `{open:6, closed:0, archived:1, total:7}`, despite a positively completed ordinary closed issue and three unsupported destination statuses. No destination was created by these inspections. This control is not a recommended live workaround.
- Probe output: **1 test passed, 0 failed**, 19.7 seconds Node duration. These assertions confirm current defects; they do not demonstrate a fix. Temporary probe SHA-256: `53006a1a75b2eded2ad2a4a8d8ab40c88142398cdcde245aaf57a4e5245b6ff3`.
- Existing strict capability controls also ran in a second offline container: `node --experimental-strip-types --test --test-name-pattern 'beads capabilities' /workspace/tests/task_providers.test.mjs`. **4 passed, 0 failed**. Controls prove current missing-custom, wrong-category, and unsupported-schema rejection still works; no candidate was implemented or validated.

### Recommended fix (bounded; not an approved implementation plan)
1. **Separate source native-read capability from lifecycle-write readiness.** Extract native executable/version and well-formed statuses-catalog reads from the strict composition. Keep `checkBeadsCapabilities()` strict for normal lifecycle work. Give transport a narrowly named migration-source purpose/path, strict by default, that reuses all existing authority, per-project server, database/version, working-set, exact revision/ref, remote, and isolated publication checks. Do not add a general skipValidation flag or configure outgoing statuses.
2. **Use source-read purpose everywhere the outgoing Beads source is proved.** That includes capture, ordinary/explicit source transport, active source Episode workspace proof, confirmation recapture, and all later source digest/publication rechecks. Keep destination-Beads import/data proof, receipt refresh, destination worktree proof, same-destination recovery, and post-cutover selected-target readiness strict (`1188`, `1246`, `1264`, `1698`, `2016`). Ordinary provider resolution/mutations stay strict; do not add global open/closed lifecycle aliases.
3. **Bind actual status meaning to the source snapshot.** Retain the complete raw native statuses response (names, categories, descriptions/custom context) alongside source version, include it in source digest/rechecks, and preserve it in verified destination-native provenance. Missing *unused* canonical definitions are irrelevant to export. Validate mappings for task statuses actually present; a category such as active cannot distinguish In Design from In Planning.
4. **Compute one migration-local projection before destination writes, then use it for counts, writer, and verifier.** Supported mappings include open/in_design → In Design; in_planning → In Planning; in_progress → In Progress; blocked → Blocked; ready_for_merge → Ready for Merge; done and ordinary legacy closed → Done/completed. Preserve raw status/reason/history. Archive only with exact positively evidenced prior archive/Prime Claw abandonment, or an explicit task-specific operator decision. Verify both native destination status and physical task/completed/archive placement; never skip lifecycle verification merely because a source classification says archived.
5. **Fail early only for real unresolved projections.** Inspect the complete inventory and report exact task IDs/statuses for deferred/pinned/hooked or unknown/custom semantics that lack a reviewed destination projection. Repeat the check at confirmation before destination creation. Do not silently coerce them. Deferred → Backlog draft remains proposed, not settled; no decision is needed when the actual inventory contains none. Do not invent a generic mapping framework or broaden this into existing-destination/dual-provider-discovery work.
6. **Keep every existing non-lifecycle source safety proof.** In particular, retain export-filter rejection and exact exported-ID equality with independent readonly SQL inventory (`496–526`), exact show/history/events/provenance reads, code/provider publication, quiescence, source drift detection, ownership/runtime continuity, receipt/destination verification, rollback, and source deletion only after exact cutover proofs.

### Regression coverage to add during separately authorized implementation
- Native built-in-only source: inspection succeeds without source config/task changes or destination creation; confirmed disposable Beads → Backlog migration proves all mappings/provenance before source deletion. Include partial/missing unused custom definitions and category-context preservation.
- Completed closed issue versus positively evidenced abandonment/prior migrated Backlog archive. Assert Done/completed versus archive placement and exact raw reason/status/history preservation. Preserve existing roundtrip behavior only where supported by positive evidence.
- Each known canonical migration status plus open/closed. Actual deferred/pinned/hooked/unknown statuses must get reviewed projections or block preflight with exact IDs before destination mutation. Do not assume zero instances.
- Built-in-only active-source Episode transport and repeated pre-cutover source checks, deletion refusal, and exact same-destination recovery. Keep immutable Episode identity and existing rollback/publication tests.
- Existing strict write/destination missing-status, wrong-category, and unsupported-schema controls remain rejecting. Filtered/omitted inventory, malformed native reads, dirty/unpublished/foreign source, revision races, receipt drift, and late ownership/runtime failures remain refusing.

Existing coverage gap: `beadsSource()` always configures every custom status (`tests/task_provider_migration.test.mjs:123–145`, especially `126`), models completion using custom done (`134`), and uses closed only for an explicitly abandoned fixture (`136`). Inspection/confirmation tests therefore encode one archive count and skip ordinary native task checks for it (`434–479`). They cannot catch an unmodified legacy source or ordinary closed completion. Update those assumptions, not just the source gate.

**Next boundary:** review the recommendation and unresolved mappings, then use the normal task planning/implementation lifecycle. No live retry, migration, global activation, or deployment is authorized by this investigation.
---
<!-- COMMENTS:END -->
