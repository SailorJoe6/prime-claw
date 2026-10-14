---
id: PRIMECLAW-10.34
title: Complete official lean role protocol and remove compatibility
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-14 02:52'
labels:
  - compatibility-cleanup
  - design
  - episode-loop
  - phase4
  - ralph
dependencies: []
references:
  - >-
    .ralph/plans/archive/official-lean-compatibility-cleanup/EXECUTION_PLAN.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/official-lean-compatibility-cleanup/SPECIFICATION.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - PRIMECLAW-40
parent_task_id: PRIMECLAW-10
priority: p1
type: epic
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem
The accepted lean cutover stopped repeated user-shaped oversight injection, but its compatibility-cleanup premise is incomplete. User-global APPEND can be shadowed by project APPEND; deleting the old Conversation skill would remove progressive supervision guidance; and the standalone expert profile is not a native Prime Agent admission mechanism.

## Outcome
One fresh episode completes the protocol end to end: install a role-neutral kernel in Prime Agent's selected global context file, install lean global Conversation and official Python-backed EXPERT skills, prove the bridge generation with restart/UAT, then remove the legacy APPEND block, project forwarding skill/link, standalone profile, and transition-only resources before final restart/UAT.

## Scope boundary
This Bead tracks specification through terminal disposition but does not itself authorize planning, episode creation, landing, user-global mutation, restart, acceptance, finalization, or physical cleanup. Prime Agent remains an upstream dependency. Project-Wide Testing and probable hung-tool recovery remain independent.

## Legacy design

Use one canonical role-neutral kernel managed as a guarded marker region in the exact selected user-global AGENTS/CLAUDE context file. Preserve unrelated user bytes and fail closed on unsafe files, selection drift, context opt-out, or marker disagreement. Route Conversation judgment to global `prime-claw-oversee-episode`, retain `execute` for EPISODE work, and migrate exact reviewer configuration/admission into global Python-backed `prime-claw-official-expert-review`. Keep lifecycle and role authority deterministic. The one episode first activates and UATs a bridge generation with legacy resources retained, then removes compatibility and passes final UAT before finalization.

## Legacy notes

FUTURE SPECIFICATION CREATED — OPERATOR REVIEW REQUIRED
Exact folder: `.ralph/plans/future/official-lean-compatibility-cleanup`
Specification: `.ralph/plans/future/official-lean-compatibility-cleanup/SPECIFICATION.md`
SHA256: `9cc4843ab78a192605bc750384a9985caad42ac2cbd17afe584fb5b0c6a171bf`
This is specification only. It does not authorize planning, implementation, episode creation, landing, restart, or deletion. Key landing blocker: no active foreign episode/worktree may retain and exercise the compatibility resources; Project-Wide Testing remains independent and must reach a safe reviewed state rather than being modified by this cleanup.
ARCHITECTURAL CORRECTION EVIDENCE — SPECIFICATION NOT YET EDITED
Consulted designated saved session `Prime Agent Expert` (`01a0e47b-77dd-755e-9f2b-883d4053c4d3`) and independently inspected Prime Agent v0.9.8 / downstream cwd-fix-v0.9.8-r1 read-only.

Finding: `.prime/agent/profiles/expert-reviewer.md` is a Prime-Claw convention, not a native Prime Agent resource. APPEND_SYSTEM merely naming that relative path would not load, validate, or instantiate it and is CWD-brittle. The old `oversee-episode` skill was the only implementation of profile parsing and exact EXPERT admission.

Recommended correction, pending operator approval: migrate the canonical reviewer configuration/rubric into a uniquely named plugin-managed global Python-backed skill under `$destination_root/skills/prime-claw-official-expert-review/`; have lean APPEND_SYSTEM name that skill; deterministically perform exact `rlm.find_models` match, harmless-bootstrap `rlm.spawn` with explicit model/thinking, handle-model verification, and one guarded `agent_message.send`; fail closed on missing capability, unavailable model, unsupported thinking, collision, or uncertain delivery. Preserve an admission receipt and validate the complete PASS/BLOCK report. RLM provides no read-only child capability, so read-only remains semantic and requires exact immutable commit packets plus owner-side pre/post HEAD/status checks. Remove the old standalone profile only after migration parity is proven; do not retire its behavior.

Prime Claw's guarded direct-copy installer may manage the global skill directory directly; a package manifest is not required. Python-skill activation requires a recycled kernel (`/reload` can technically do this), while Prime Claw deployment policy still requires the reviewed user-global apply/check and coordinated full restart. No specification, plan, source, or deployment change was made during this consultation.
SECOND ARCHITECTURAL CORRECTION EVIDENCE — CONVERSATION GUIDANCE MUST BE MIGRATED, NOT DELETED
Designated `Prime Agent Expert` confirmed the layered progressive-disclosure design. The current `.agents/skills/oversee-episode` is a symlink to the same 1,547-word `.ralph/skills/oversee-episode/SKILL.md`; deleting both without a replacement removes the Conversation role's operational guidance rather than merely ending plugin injection.

Recommended target: tiny <=250-word identity/authority/routing kernel; plugin-managed user-global Markdown skill `prime-claw-oversee-episode` containing roughly 300-600 words of supervision judgment; existing `execute` for EPISODE implementation; plugin-managed Python-backed `prime-claw-official-expert-review` for exact EXPERT admission/rubric; deterministic plugin code for identity/lifecycle/handoff/finalization/history filtering.

Migration: add/install unique global Conversation skill and route the kernel to it; reduce the old project-local skill to a short forwarding/deprecation shim for one bridge generation while retaining its discovery link; verify fresh/reloaded owner sessions in builder, linked worktree, nested/unrelated repo see and read the managed global skill without its body appearing in every provider request; remove old file/link only in a later cleanup after stale catalogs reload. Never maintain two policy copies.

Additional Prime Agent v0.9.8 constraint: exact-CWD project `.prime/agent/APPEND_SYSTEM.md` replaces the user-global APPEND fallback, so 'always-on global APPEND' is not literally guaranteed. The reviewed specification must either constrain/block project overrides or use a supported deterministic system-prompt injection/dedupe hook for only the tiny kernel. Do not inject the skill body. A plain Markdown skill read is observable but not deterministic; if required, add a small activation receipt/hash gate before canonical handoff admission.

No specification, source, plan, deployment, or restart change was made during this consultation.
OPERATOR DIRECTION — CONDITIONALLY APPROVED PENDING EXPERT REVIEW
Joe agrees with the target architecture provided the Prime Agent Expert finds no material contradiction: the managed extension, not global APPEND discovery, will ensure exactly one tiny identity/routing kernel in the effective system-prompt channel; global role skills provide progressive guidance; target-state installer stops installing Prime Claw's managed block into user-global APPEND_SYSTEM while preserving unrelated user content. Migration remains staged: retain the global block while the new hook is proved and dedupes it, coordinate restart/UAT, then remove only the managed global block in a later cleanup. This is a design decision only; specification revision, planning, implementation, deployment, restart, and cleanup remain unauthorized until the pending expert response is reviewed.
PRIME AGENT EXPERT REVIEW — CONDITIONAL APPEND REMOVAL NOT YET APPROVED
The supported `before_agent_start.systemPrompt` channel is system-role and materially different from the retired custom-message injection. It composes normal direct, queued, injected, tool-loop, retry, and post-compaction turns. However, current Prime Agent v0.9.8 skips that hook for direct idle `agent_message` and idle `sendCustomMessage(...,{triggerTurn:true})`; handler exceptions are fail-open unless `context` explicitly calls `ctx.abort()`; and role gating must distinguish root Conversation capability, active owner, EPISODE, EXPERT, generic RLM child, and ordinary sessions.

Therefore the conditionally approved target cannot yet remove the global APPEND fallback. A context guard can abort uncovered turns but cannot add the missing kernel, making this an availability blocker. The review also requires stable marker parsing, exact bytes, explicit context abort with zero provider calls, no reliance on extension order, and provider-boundary tests proving zero user/custom-message injection.

A follow-up is evaluating the globally merged `$agentDir/AGENTS.md`/`CLAUDE.md` context surface as a possible base-system fallback that is not shadowed by project APPEND and covers skipped-hook paths. If unsuitable, the bounded current-API alternative is retaining global APPEND and rejecting project APPEND for managed owner sessions. No specification/source/deployment change has occurred.
PRIME AGENT EXPERT FOLLOW-UP — GLOBAL CONTEXT IS THE SUPPORTED NON-SHADOWED NEUTRAL FLOOR
Source-backed review confirms the selected user-global context file under active `agentDir` is the best current Prime-Claw-side base for a role-neutral identity/routing kernel. Prime Agent loads exactly one global candidate in priority order `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`, `CLAUDE.MD`, then appends ancestor/project contexts independently of project SYSTEM/APPEND selection. Its content is assembled directly into the base system prompt, never a user/custom message, and covers direct idle agent_message/customTrigger gaps, resume, retries, tool loops, nested/worktree CWD, and project APPEND shadowing.

Installer must patch only the selected global file with a guarded uniquely marked region; never create AGENTS when selected CLAUDE exists; preserve unrelated bytes/mode/ownership/newline style; block symlink/unreadable/malformed/duplicate/concurrent edits and selection drift; remove only the exact owned region. `--no-context-files` or SDK overrides make managed role work unavailable and must fail closed rather than defeat opt-out.

The block must be role-neutral: define possible CONVERSATION/EPISODE/EXPERT/no-role assignments, trusted-plugin identity authority, strict role boundaries, missing/conflicting identity blocking, and routing to unique managed skills/tools. No exact owner/episode/model/lifecycle state. Optional `before_agent_start` may add role-specific end-position guidance on covered turns; direct-idle gaps receive only the neutral floor, so deterministic plugin gates/activation receipts remain authoritative.

Staged migration uses distinct markers: Generation A installs neutral global-context block plus guard/skills while retaining exact legacy Conversation APPEND; Generation B removes only managed legacy APPEND while tolerating already-loaded legacy prompts; final drain/reload removes tolerance. Provider tests must prove kernel lives only in systemPrompt and never messages. No specification/source/deployment change has occurred; operator review of this modified target remains pending.
OPERATOR PROCESS DECISION — ONE EPISODE THROUGH FINAL COMPATIBILITY CLEANUP
Joe rejects splitting the role-guidance migration and compatibility removal into separate implementation episodes. The repeated finalize/close/new-episode cycle feels like stopping in the middle of unfinished business. The revised specification should define one complete end state and one fresh episode that remains active through replacement installation, bridge activation, interim review/landing/apply/restart/UAT gates, compatibility removal, final review/landing/apply/restart/UAT, acceptance, finalization, and separately authorized terminal resource cleanup.

Safety is preserved inside the one episode through vertical slices and explicit irreversible gates, not by ending the episode after Generation A. Legacy APPEND/project skill/profile resources remain until the replacement generation passes its required UAT. Generation B cleanup proceeds only after that recorded gate. Each landed generation has its own exact candidate, evidence, rollback input, operator landing/activation authority, and resumed-session UAT. The episode is not finalized between generations and is complete only at the clean target state. No specification edit, plan, implementation, deployment, or restart has yet occurred.
IN-PLACE SPECIFICATION OVERHAUL DRAFTED AND EXPERT BLOCKERS CORRECTED
Specification: `.ralph/plans/future/official-lean-compatibility-cleanup/SPECIFICATION.md`
Current SHA256: `0428a99c18e5823bea8e863d94b084598c46476bb8126286052484683cb3f7f6`
The document now defines one episode through selected-global-context neutral kernel, global Conversation/EXPERT skills, bridge activation/UAT, compatibility removal, and final activation/UAT. It remains specification-only.

Designated Prime Agent Expert reviewed prior draft SHA `9d4c88892ea1fbd4a0a0f8e5f7327aeb46efcfc6ef63e4ac4ecded90aa9469e2` and BLOCKed two impossible/incomplete claims. Current draft corrects both: `RlmSpawnHandle` returns model but not reasoning, so evidence now records exact returned model, exact requested reasoning, and successful spawn admission as reasoning-validation evidence; and custom `PRIME_AGENT_KERNEL_PYTHON` mode now requires exact import verification or deterministic UNAVAILABLE without silent provisioning. Runtime host modules are explicitly excluded from pyproject dependencies. No plan, episode, implementation, landing, deployment, restart, or cleanup has occurred.
SPECIFICATION OVERHAUL COMMITTED AND PUSHED
Commit: `788d5943d0e806fd5a6947be702a193299a5c84f`
Specification SHA256: `0428a99c18e5823bea8e863d94b084598c46476bb8126286052484683cb3f7f6`
Independent Prime Agent Expert final rereview: PASS on exact SHA `0428a99c18e5823bea8e863d94b084598c46476bb8126286052484683cb3f7f6`; no material blocker remained.
The commit contains only the specification file. Two unrelated `.beads/interactions.jsonl` rows for `PRIMECLAW-20.2` remain intentionally uncommitted in the primary checkout at the explicit request of the Project-Wide Testing owner, who will reconcile them after its candidate disposition. No planning, episode creation, implementation, landing of runtime code, user-global mutation, restart, or cleanup occurred.
PLANNING COMPLETE — REVIEWED BUNDLE AWAITS IMPLEMENT-SPEC REPLAY
Selected folder: .ralph/plans/future/official-lean-compatibility-cleanup
Specification reviewed input SHA256: c7de8047f09a2f26c45260b5b7ebe41b010c39a0208d4f23df7bbcbf18f25eec
Execution-plan reviewed content SHA256: f3089ed84f774e95cffc8a18e82940804bdf05c750f0f19435986a17d99fdb9e
Prime Agent Expert session: 01a0e47b-77dd-755e-9f2b-883d4053c4d3
Final rereview: PASS; no material blocker, unsupported Prime Agent v0.9.8 API claim, or execution contradiction remains.
Final status-only specification SHA256: 632c848c820b8979b634e33d13b741eefc8cb4cf505c91caf74096c1a63b2f6d
Final status/review/replay-bookkeeping execution-plan SHA256: 46b9076facbc02afd285a68b2fd0cc1487b976b867ef619a43cc82dbd8aeb4ed
Operator invoked /implement-spec on 2026-10-03, recording implementation approval. The readiness pass correctly created no episode because final review and durable commit were pending. After this bundle is committed/pushed and synchronized, a fresh explicit /implement-spec replay is required. No branch, worktree, episode, implementation, landing, user-global mutation, restart, finalization, or cleanup occurred.
PLANNING BUNDLE COMMITTED AND PUSHED
Commit: 001cd22 (plan: approve official lean compatibility cleanup)
Primary main and origin/main verified equal and clean after push.
The reviewed future bundle is now durable and ready for a fresh explicit /implement-spec replay. No episode or implementation resource was created by the blocked first readiness pass or this planning commit.
SLICE 1 IMPLEMENTATION CANDIDATE — AWAITING OWNING-CONVERSATION REVIEW
Episode: 01a10774-0155-7316-a329-50ee5f7d17be
Branch: episode/official-lean-compatibility-cleanup
Delivered canonical ROLE_KERNEL.md + generated exact-byte constants, bridge role-protocol.json, guarded selected-global-context/legacy-APPEND manager with manifest and receipt restore, shell apply/check integration, exact predecessor archive, tests, docs, and sanitized evidence.
Kernel SHA256: fd370726c28097b4201f538958e32ddc0af8abdb7c72d675412df0c698bb328e
Evidence: docs/evidence/official-lean-role-protocol/2026-10-04-slice-1-kernel-installer-lineage.md
Validation: Tier 0 291 passed/164 skipped; focused Linux matrix 7 passed; full Docker tier 1 57 passed/398 deselected; scripts/test-tier1.sh --probe PASS on pinned Prime Agent 0.9.8. Raw ignored manifest SHA256 c8df1543224dd0b29497d6a1af77d18140b1780374e7a9ff8beb0face804c62d.
No user-global apply, restart, landing, provider call, Gate A action, compatibility removal, or later-slice work occurred. Exact commit will be appended after push; owner acceptance remains required.
SLICE 1 COMMITTED — OWNING-CONVERSATION REVIEW REQUIRED
Commit: 1eba414c2157740afb45dba4661a95d9a6d63785
Tree: 4476add0646c69a07481831c1fb913929ec5b6b9
This is one reviewable Slice 1 candidate only. It is not owner acceptance and grants no Slice 2, landing, user-global apply, restart, UAT, finalization, or cleanup authority.
SLICE 1 OWNER REVIEW — EXPERT BLOCK ACCEPTED; IN-SCOPE REVISION REQUIRED
Exact candidate: 1eba414c2157740afb45dba4661a95d9a6d63785
Tree: 4476add0646c69a07481831c1fb913929ec5b6b9
Reviewer session: 01a10883-7599-7758-bf4e-b1339fbedb52
Model: openai-codex/gpt-6-astra
Reasoning request admitted at spawn: max
Disposition: BLOCK (four P1, one P2); owning Conversation independently accepts all five as material and inside approved Slice 1 scope.
Private report: /Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/sub-35873339/slice1-review-1eba414c/REPORT.md
Report SHA256: 409e6a838d5da82b387fb45f6e2696892af405a636b9afc5be6ccd9d6ddacb83
Subject pre/post state: clean exact candidate/tree; origin episode branch equal; no source/ref, user-global, lifecycle, restart, or episode mutation by reviewer.
Independent reruns: Tier 0 291 passed/164 skipped; full Docker Tier 1 57 passed/398 deselected; tier1 --probe PASS; current green tests are insufficient for the reproduced failure seams.

Accepted findings and required repair direction:
R1 P1 — Parent-path no-follow is incomplete. Descriptor-bind the validated destination boundary and use consistent no-follow/regular checks for managed parents, leaves, lock, temps, check, apply, and receipt restore. Reject symlinked/swapped ancestors and state/receipt parents before any inside/outside mutation; retain case-alias compatibility.
R2 P1 — Apply can publish files without a usable recovery transaction after replace/fsync, interruption, receipt-finalization, or final-check failure. Introduce durable phase-aware recovery evidence for unchanged/committed/interrupted files; include receipt publication and final verification in success; never discard rollback errors or adopt unowned markers.
R3 P1 — Restore validates receipt lazily and accepts arbitrary in-root targets. Fully validate exact unique managed inventory, destination/selection/manifest binding, all encodings/digests/types/metadata, and all pre/postimages before mutation, then restore through the recoverable transaction. Owner independently reproduced deletion of an unrelated in-root file from a structurally accepted tampered receipt.
R4 P1 — Commit-time concurrency checks compare bytes only and omit metadata, inode/identity, and candidate-selection set. Carry and revalidate the complete relevant filesystem snapshot through commit; preserve external chmod/chown/inode/candidate changes and avoid latent installation on late conflict.
R5 P2 — First bridge adoption replaces any well-formed legacy marker block. Adopt only the exact accepted predecessor legacy block; disagreeing/stale content must fail before shared-file or plugin-copy mutation.

Acceptance tests must cover positive normal/adoption/recovery paths; negative symlink/ancestor/receipt-inventory/legacy mismatch paths; injected faults at every replace/fsync/receipt/final-check boundary; metadata/inode/candidate concurrency; repeated recovery/refusal; and zero mutation of outside, unrelated, or externally changed state. Repair these findings together without extending into Slice 2, Gate A, host-global apply, restart, UAT, or compatibility removal. Exact repaired candidate must be committed/pushed, fully revalidated, and independently rereviewed before acceptance.
SLICE 1 REVISION TRANSPORT PAUSED — OPERATOR ACTION NEEDED
Canonical `handoff_spec_episode` for the accepted five-finding revision was admitted on 2026-10-04 and the episode updated `.ralph/plans/EXECUTION_PLAN.md` with the exact accepted revision scope, but no revision completion/progress report followed. After four 15-minute observations, trusted roster showed the exact episode idle/inactive with no queued input. The required quiescence query (`You seem done with your work. Are you complete or waiting for some process?`) received definite no-admission: `Cannot admit a session action while queued session input is suspended.` Episode worktree remains at committed candidate `1eba414c`; only the plan status edit is uncommitted. Owner did not retry handoff, resend execute, alter the worktree, or infer completion. The revision heartbeat was cancelled because continuation now waits for explicit operator/session recovery; probable-hung recovery remains independently scoped under `PRIMECLAW-10.33`.
SLICE 1 REPAIRED CANDIDATE — FINAL GATES AND INDEPENDENT REPAIR REREVIEW PASS; OWNER ACCEPTANCE STILL REQUIRED
Rejected candidate 1eba414c2157740afb45dba4661a95d9a6d63785 and original EXPERT report SHA256 409e6a838d5da82b387fb45f6e2696892af405a636b9afc5be6ccd9d6ddacb83 remain immutable.
Implemented only accepted R1-R5: descriptor-bound no-follow authority; phase-aware fsync-backed apply/restore journal; complete pre-mutation receipt validation; exact commit/final-success bytes/metadata/inode/candidate/lock/receipt revalidation; byte-exact predecessor APPEND adoption. Recovery is bound to the journal's exact staged receipt. Prepared/applied receipt publication covers synchronous errors and hard exits; old-valid, same-byte-new-inode, metadata, and active-lock substitutions preserve uncertainty or stop mutation.
Validation: native-Linux manager matrix 12/12; focused plugin integration 28 passed/1 deselected; exact final Tier 0 291 passed/169 skipped; exact final Docker 62 passed/398 deselected; scripts/test-tier1.sh --probe PASS with pinned Prime Agent 0.9.8. Independent bounded repair rereview PASS with no repository edits.
Evidence: docs/evidence/official-lean-role-protocol/2026-10-04-slice-1-kernel-installer-lineage.md
Raw ignored repair manifest SHA256: 10423248bbb380e5169961fa05b2d697e7a29b66b6f22508efa0504dc062795e
This is not owner acceptance and grants no Slice 2, Gate A, landing, user-global apply, restart, UAT, finalization, or cleanup authority. The exact repaired commit/tree will be reported to the owning Conversation immediately after the single commit is pushed.
FINAL RAW REPAIR MANIFEST (supersedes pre-docs hash): SHA256 0f8092175c9bb83bbf0ebe223f7d8be0312e8e37ac2bfef336247f902ea66d24. Post-docs exact Tier 0: 291 passed/169 skipped in 55.57 seconds.
SLICE 1 REPAIRED CANDIDATE COMMITTED AND PUSHED — FRESH OWNER/EXPERT REVIEW REQUIRED
Commit: f4b858cbd92cf43c86fac49de60d43e9daa9342b
Tree: 59ce698d33bd8778829914bd2d50fdbdd1248e65
Parent (immutable rejected candidate): 1eba414c2157740afb45dba4661a95d9a6d63785
Remote: origin/episode/official-lean-compatibility-cleanup equals the exact commit.
Final raw manifest SHA256: 0f8092175c9bb83bbf0ebe223f7d8be0312e8e37ac2bfef336247f902ea66d24
The episode stops here. No Slice 2, Gate A, landing, host-global apply, restart, UAT, finalization, or cleanup authority is inferred.
SLICE 1 REPAIRED CANDIDATE — FRESH EXPERT BLOCK ACCEPTED; SECOND IN-SCOPE REVISION REQUIRED
Candidate: f4b858cbd92cf43c86fac49de60d43e9daa9342b
Tree: 59ce698d33bd8778829914bd2d50fdbdd1248e65
Parent/rejected predecessor: 1eba414c2157740afb45dba4661a95d9a6d63785
Reviewer session: 01a10a4d-dd6f-745b-b873-dced14bb69e3
Model: openai-codex/gpt-6-astra
Reasoning request admitted at spawn: max
Disposition: BLOCK (seven P1, two P2). Owning Conversation accepts all nine findings as material and inside approved Slice 1 R1-R4 safety scope. R5 exact predecessor APPEND adoption is independently CLOSED.
Complete report: /Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/sub-1ffe792e/slice1-review-f4b858cbd/REPORT.md
Report SHA256: 15f7fb824428cafb17ad1a08148c3499eaae682f3eef650b65f7f7f9e00d77b5
Artifact manifest: /Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/sub-1ffe792e/slice1-review-f4b858cbd/artifact-manifest.json
Artifact manifest SHA256: 21887f57c179e5d679f3479d18b16682380c689f444a0c73917c495aa6a87ebe
Subject pre/post: exact clean candidate/tree; local, tracking, and independently queried remote equal; no source/ref, Bead, lifecycle, user-global, credential, restart, or episode mutation by reviewer.
Independent reruns: Tier 0 291 passed/169 skipped; Docker Tier 1 62 passed/398 deselected; pinned Prime Agent 0.9.8 probe PASS; diff/parity/archive/evidence hashes PASS. Existing gates do not cover the reproduced failures.

Accepted findings:
F1 P1 — Recovery classifies entries once, then overwrites a later concurrent edit during restore/rollback. Retain and revalidate exact source/target authority at each mutation; unknown changes survive with actionable uncertainty.
F2 P1 — Apply drops complete receipt authority across lock acquisition and adopts/overwrites a newly created, chmodded, or same-byte-replaced receipt. Revalidate retained parent/leaf identity, metadata, schema, and current-state contract under the canonical lock before mutation.
F3 P1 — Interrupted restore recovery mutates before validating the exact journal-bound receipt and can accept a same-byte replacement or report malformed data after partial changes. Every entrypoint must validate legal journal-bound receipt phase/identity/metadata/schema before driving recovery and durably journal terminal publication.
F4 P1 — Internally contradictory creation ownership/preimage fields can delete a pre-existing context file. Validate creation ownership, candidate preimages, manifest installerCreated, selection, and pre/postimage transitions as one exact contract before staging/deletion.
F5 P1 — A hard exit while publishing rolled_back receipt strands a known successful rollback. Extend staged durable receipt publication and replay recognition symmetrically to rollback/restore terminal states without trusting arbitrary labels or deleting uncertainty.
F6 P1 — Recovery can skip the affected destination-parent directory fsync after final unlink/rename yet discard the journal. Complete all file and containing-directory durability barriers before success or journal disposal; fsync of another directory is insufficient.
F7 P1 — A staged source rebound to a symlink can be renamed over the original context before later rejection. Bind and revalidate exact staged source type/inode/bytes/metadata at publication for every managed artifact and cleanup path.
F8 P2 — Restore/replay/check can certify stale final authority after late metadata or `.prime-claw` parent rebinding. Share complete final exact-state validation after terminal publication and before success/journal disposal, preserving external edits.
F9 P2 — A regular-to-FIFO swap can block indefinitely before post-open type validation. Use nonblocking no-follow open followed by descriptor type/identity validation for all snapshot paths.

Repair R1-R4 symmetrically across apply, rollback, restore, replay, and check. Add the report's positive/negative/failure/replay cases, using its exact reproducers as red acceptance tests. Preserve R5, kernel/generated bytes, archive lineage, bridge generation, upstream boundary, Docker-only gates, immutable rejected history, unrelated/external changes, and uncertain journals. Do not enter Slice 2, Gate A, landing, host-global apply, restart, UAT, compatibility removal, finalization, or cleanup. The next exact candidate must be committed/pushed, fully reconciled, and pass another fresh independent exact-commit review before acceptance.
EPISODE SESSION REPLACEMENT BLOCKER — EXISTING WORKTREE MUST BE PRESERVED
The operator reported repeated upstream provider cybersecurity false positives after sibling compaction and requested a new episode in the existing worktree. Read-only source inspection confirms the installed public episode interface cannot perform that transition safely: existing identity reuse reopens only the exact durable episode session; fresh creation rejects an existing episode branch/worktree/session; no supported operation rebinds a new session identity to the retained worktree. A manually started/forked session would lack the exact trusted EPISODE binding, and hand-editing identity/daemon state is prohibited. The owner therefore did not stop/delete the existing episode, mutate its identity, remove/recreate the worktree, call finalization, or create a duplicate episode. Current uncommitted F1-F9 repair remains intact in the existing worktree at baseline f4b858c. Safe options require operator choice: preserve this episode/worktree and change/recover its model channel, or abandon/checkpoint/archive it and create a fresh episode in a fresh supported worktree. Implementing a supported retain-worktree session-replacement feature would be separate reviewed Prime Claw scope.
EPISODE CHANNEL RECOVERY ATTEMPT — NO SESSION REPLACEMENT PERFORMED
The operator used a zero-retention context compaction on the exact existing episode to remove provider-poisoning context. The owner abandoned the contemplated manual in-place session migration before any session, identity, JSONL, worktree, branch, or plugin state mutation. Read-only checks show the exact episode identity/worktree and uncommitted repair remain intact at baseline f4b858c. A minimal post-compaction status message was not admitted because queued session input was still suspended; it was not retried. Treat recovery as pending verification. The same-worktree episode-session replacement gap remains a later product requirement, not an action taken in this pass.
EPISODE CHANNEL RECOVERED IN PLACE — WORKTREE AND IDENTITY RETAINED
Operator-authorized recovery replaced only the provider-visible conversation branch of episode 01a10774-0155-7316-a329-50ee5f7d17be; it did not delete/recreate the episode or worktree. The idle route 99f6d070e211 was stopped. Prime Agent public SessionManager.branchWithSummary was dry-run against an exact private copy, then applied to the same durable session ID from verified safe ancestor 70da9610. The later provider-poisoned branch is not on the resumed active path; bounded EPISODE identity, owner marker, episode ID, session file, branch, worktree, identity JSON, uncommitted F1-F9 bytes, HEAD/tree/remote, and git diff all remain exact. New active route: e24204e3df98. Private migration evidence: /Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/episode-session-replacement-20261006T033506Z; manifest SHA256 aa4bcc51938a05c707f5c22733e5952fa2aac349becdad6138e1d6f3d1240e78. No handoff/execute, later gate, source edit, user-global mutation, restart, or cleanup was performed. Follow-up product requirement is Bead PRIMECLAW-10.35; it is separate scope.
OWNER SCOPE REVIEW PAUSE — NO FURTHER SLICE 1 WORK AUTHORIZED PENDING OPERATOR DECISION
The operator questioned whether repeated adversarial findings have over-engineered Slice 1 relative to the original neutral-kernel compatibility goal. The owner sent a high-level safe-checkpoint pause to the recovered episode and cancelled monitoring. Current scale evidence: manager grew from 669 lines at initial candidate 1eba414 to 1,830 at rejected f4b858c and 2,859 uncommitted; the container probe is 2,106 lines; full Slice 1 delta is about 6,777 insertions. The original ORP-002 requires byte/metadata preservation, safe paths, atomic writes, concurrent-change rejection, receipts, and rollback, but does not define a hostile same-user race/power-loss threat model. Repeated EXPERT review interpreted those clauses as universal syscall-level guarantees. No scope reduction, revert, acceptance, commit, or later gate is authorized yet. Await explicit operator decision on a bounded threat model and revised Slice 1 acceptance contract.
OPERATOR SCOPE DECISION — STOP F1–F9 STATE-MACHINE EXPANSION IMMEDIATELY
The operator explicitly accepted the owner's scope assessment and ordered: “Stop extending the current F1–F9 state machine immediately.” The episode received a delivered stop/preserve instruction. No further edits, tests, review-driven syscall hardening, commit, push, or later gate is authorized under the current Slice 1 contract. Preserve the exact uncommitted worktree and immutable rejected candidates/reports as evidence. Before any implementation resumes, the owner and operator must approve a revised specification/plan with a bounded local-operator threat model and simplified acceptance criteria. This is a pause/scope decision, not candidate acceptance, abandonment, merge, activation, finalization, or cleanup.
PAUSE VERIFIED
Episode route e24204e3df98 is idle with taskState needs_input, zero queued actions, no streaming/compaction/bash/tool work, and no RLM children. Worktree remains on f4b858cbd92cf43c86fac49de60d43e9daa9342b / tree 59ce698d33bd8778829914bd2d50fdbdd1248e65 with origin equal. Exactly six expected files are modified and uncommitted. Current binary diff SHA256: 15c8399ac44c642484997716a08e85827bcc72bed1f29587cad9531ffee4ba1b. No heartbeat remains while the operator decides the revised scope.
OPERATOR-APPROVED DONE-OVER-PERFECT CORRECTION — 2026-10-06
Primary main commit `c24ba6c1e76585193d4f34f0b0b0233846780442` rewrites the official-lean specification and plan around a trusted-local ordinary-failure model. Specification SHA256 `59532032aa2c4750050d88e4c004b276a2f9a2736c6631ff80b596147d2e047f`; future plan SHA256 `70444d8d0fa1051d981020bcf6f314a875390a5ca5411b1c265d83a7aa9c33a8`. The contract now treats hostile same-UID races, exhaustive crash/power-loss boundaries, continuous inode authority, and autonomous mixed-state recovery as advisory hardening unless promoted by dogfood, a user report/near miss, changed boundary, or separately approved hard requirement. It requires simple locking/validation/atomic replacement/fixed-inventory receipt/manual refusal, proportional one-pass review, a two-cycle stop-loss, and DONE over perfect.

Before changing the active episode plan/spec, the exact paused six-file F1–F9 draft was preserved at `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/official-lean-scope-reduction-20261006T041523Z`. Patch SHA256 `15c8399ac44c642484997716a08e85827bcc72bed1f29587cad9531ffee4ba1b`; manifest SHA256 `d58d4c1c8a34d84f89d88ab19741e035a82e158133cce0546b0f1557c2fca2a8`; reverse apply check passed against the paused worktree. Active episode specification SHA256 `59532032aa2c4750050d88e4c004b276a2f9a2736c6631ff80b596147d2e047f`; active plan SHA256 `e06f3deaa1eb50b96a7e0a3d7484b77f314984e6bf0fe3422f246518dd1ae223`. The code draft remains uncommitted for the episode to simplify; no owner code implementation, Slice 2, activation, landing, global mutation, or restart occurred.
REDUCED SLICE 1 CANDIDATE READY FOR OWNER REVIEW — 2026-10-06

Operator-corrected trusted-local Slice 1 is implemented on the existing episode. Final uncommitted patch SHA256 `c1a4e11834a359ceb2d442d9329c86b8d73d1f5076be142f8a66091a1904951b` against `f4b858cbd92cf43c86fac49de60d43e9daa9342b`; eight tracked files. The manager is 1294 lines versus the paused 2,859-line F1–F9 draft; the practical probe is 556 lines versus 2,106. Multi-phase journal/recovery, continuous descriptor/inode authority, exchange publication, and exhaustive crash/race machinery are removed. Fixed-inventory receipt validation retains the unrelated-file deletion fix, known-state restore/manual refusal, selection, metadata/newline preservation, ordinary atomic replacement, and the legacy APPEND bridge.

The sole bounded reduced-contract review examined patch SHA256 `ce9efae1c6ff52a1b6367aa7501f3bd2c2177aa78fa053dfd438390124dc03c9` and returned one in-model BLOCK, report SHA256 `ed310237272b1ac1c30f1d677428ab88b436268064f07869a6c0a8545b0b4ab1`: mutable destination preflight preceded the cooperative lock. The exact repair moves mutable validation under `flock`, removes the shell wrapper's unlocked preflight, and adds a writer-A-intermediate/writer-B-waits regression. No second review was run. Its receipt/interruption wording advisory is recorded in current docs.

Final gates after repair: focused Linux matrix 10 passed; Tier 0 291 passed, 167 skipped, 11 warnings (45.50s), log SHA256 `3991669f5f79889aaf02d76650e2db25542c3d2647dd077fde9ae0dfdcaa8f80`; Docker Tier 1 60 passed, 398 deselected, 11 warnings (153.88s), log SHA256 `a0dac3c10f4225ae22274919f1b0ebacef2b1211b5cbbb2dfeb6a92b32d900a2`; pinned Prime Agent 0.9.8 installed-runtime probe PASS, log SHA256 `4efbafd62d5e4c4f47c630d164d852d7612f1da0fe2be75287019f84c1eeaa0a`. Final gate logs: `.test-results/20261005-220305-46696`. Preserved final patch: `/Users/jlanders/.prime/agent/session-artifacts/01a10774-0155-7316-a329-50ee5f7d17be/reduced-slice1-final-review/candidate-after-block-repair.patch`.

No Slice 2, landing, user-global mutation, restart, UAT, finalization, bookkeeping, or cleanup occurred. Candidate commit/push is the remaining episode action before owner acceptance.
REDUCED SLICE 1 COMMITTED — 2026-10-06
Commit `57d26e582c583a81de370051b129f74f5b13ee45`; tree `d1739c3a2ffee4512d6741480b72792e3a8d4098`; parent `f4b858cbd92cf43c86fac49de60d43e9daa9342b`; exact commit patch SHA256 `c1a4e11834a359ceb2d442d9329c86b8d73d1f5076be142f8a66091a1904951b` matches the fully gated post-review repair patch. Branch push and synchronization verification follow. This is a candidate for owning-Conversation acceptance only; it grants no landing, activation, Slice 2, restart, UAT, finalization, bookkeeping, or cleanup authority.
PUSH VERIFIED — 2026-10-06
Local HEAD, tree, upstream, and independently read remote branch are `57d26e582c583a81de370051b129f74f5b13ee45` / `d1739c3a2ffee4512d6741480b72792e3a8d4098`. Worktree is clean and branch is synchronized. `bd sync` is unavailable in this installed bd CLI (`unknown command`); direct Beads updates above succeeded in the shared store. Slice 1 candidate awaits owning-Conversation review.
OWNER ACCEPT — CORRECTED SLICE 1 — 2026-10-06
Accepted exact commit `57d26e582c583a81de370051b129f74f5b13ee45`, tree `d1739c3a2ffee4512d6741480b72792e3a8d4098`, parent `f4b858cbd92cf43c86fac49de60d43e9daa9342b`, commit patch SHA256 `c1a4e11834a359ceb2d442d9329c86b8d73d1f5076be142f8a66091a1904951b` under the trusted-local ordinary-failure DONE-over-perfect contract.

Reconciliation: local HEAD, upstream, and independently read remote branch all equal the candidate; worktree is clean. The same episode `01a10774-0155-7316-a329-50ee5f7d17be` remained active and no Slice 2, landing, user-global apply, restart, UAT, finalization, bookkeeping, or cleanup occurred.

The sole independent review of pre-repair patch `ce9efae1c6ff52a1b6367aa7501f3bd2c2177aa78fa053dfd438390124dc03c9` returned one valid in-model BLOCK: mutable destination preflight preceded the cooperative lock. Report SHA256 `ed310237272b1ac1c30f1d677428ab88b436268064f07869a6c0a8545b0b4ab1`. Owner compared the final commit directly with the reviewed patch: the repair only removes the wrapper's unlocked preflight, moves mutable destination validation and restored-receipt current-state validation behind `flock`, adds the exact writer-A-intermediate/writer-B-waits regression, and narrows interruption wording. Final full patch matches preserved post-repair artifact SHA256 `c1a4e11834a359ceb2d442d9329c86b8d73d1f5076be142f8a66091a1904951b`. No second adversarial review was required; the owner verified the bounded repair and found no remaining in-contract blocker.

Final evidence: focused practical Linux matrix 10 passed; Tier 0 291 passed/167 skipped log SHA256 `3991669f5f79889aaf02d76650e2db25542c3d2647dd077fde9ae0dfdcaa8f80`; Docker Tier 1 60 passed/398 deselected log SHA256 `a0dac3c10f4225ae22274919f1b0ebacef2b1211b5cbbb2dfeb6a92b32d900a2`; pinned Prime Agent 0.9.8 probe PASS log SHA256 `4efbafd62d5e4c4f47c630d164d852d7612f1da0fe2be75287019f84c1eeaa0a`.

The review advisory about wrapper receipts and abrupt interruption is not a Slice-1 blocker. Current docs truthfully require Gate A coordinator preimages/manual recovery. It is retained on `PRIMECLAW-22` with evidence-based promotion triggers. Slice 1 is accepted; only canonical handoff may begin Slice 2.
SLICE 2 CANDIDATE 1 — MANAGED ROLE INTEGRITY — 2026-10-06

Bounded first Slice 2 capability implemented against accepted Slice 1 `57d26e582c583a81de370051b129f74f5b13ee45` / tree `d1739c3a2ffee4512d6741480b72792e3a8d4098`. Exact uncommitted patch SHA256 `cc279b0bd5fee30e9d60d74a4fa78a01613f19ae24e0ccc0327341c071d238ac`; preserved at `/Users/jlanders/.prime/agent/session-artifacts/01a10774-0155-7316-a329-50ee5f7d17be/slice2-managed-role-integrity/candidate.patch`.

Delivered: `conversation-oversight.ts` now imports exact generated `PRIME_CLAW_ROLE_KERNEL_V1` bytes; managed promotion, active owner, and bounded EPISODE paths reject missing/duplicate/stale/reversed/nested/marker-shaped variants; ordinary explicit no-context sessions remain ordinary; the provider context seam keeps `ctx.abort()` fail-close behavior; private bounded identity and historical bounded packages are filtered instead of emitting a provider-visible EPISODE package; provider captures prove the neutral kernel is system-only.

Deliberate boundary: no managed Conversation skill, activation tool/receipt, lifecycle readiness gates, project-skill shim, EXPERT admission, Slice 3, landing, user-global mutation, restart, UAT, finalization, or cleanup. Those remain later authorized capabilities.

Evidence: focused Docker migration 11 passed/7 deselected (46.11s); Tier 0 291 passed/167 skipped (46.13s), SHA256 `836f2a4d1f7575fccaf63171c5462327e272cdb3393486864a06f95ca048df35`; Docker Tier 1 60 passed/398 deselected (117.44s), SHA256 `135c730d41f649dbc3608341097dfcfda29a021c6e1320880f8428b95c34a139`; pinned Prime Agent 0.9.8 installed-runtime probe PASS, SHA256 `5c27c8dfc691e534f69608c8fe4ab434acf65cfd386749532f15eb10ebe3fc59`. Evidence doc: `docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-managed-role-integrity.md`. Full logs: `.test-results/20261005-223346-16242`. Candidate is ready to commit/push once, then awaits owning-Conversation review.
SLICE 2 PATCH HASH CORRECTION — 2026-10-06
The earlier precommit `git diff` hash `cc279b0bd5fee30e9d60d74a4fa78a01613f19ae24e0ccc0327341c071d238ac` omitted the then-untracked evidence document and is not the complete candidate patch. Exact commit `7107d1143330417333bfe6105b18832129d6439f`, tree `fc382abb394865bfa122abf45987da5e1848a41d`, has complete commit patch SHA256 `968eb860d530b4c06582cfa8b0e22240a8eaceaf5cddb78cc89c3a0a207443a6`. `/Users/jlanders/.prime/agent/session-artifacts/01a10774-0155-7316-a329-50ee5f7d17be/slice2-managed-role-integrity/candidate.patch` has been replaced with those exact complete commit bytes. All source/test gate evidence is unchanged.
SLICE 2 CANDIDATE 1 PUSH VERIFIED — 2026-10-06
Local HEAD, upstream, and independently read remote branch equal `7107d1143330417333bfe6105b18832129d6439f`; tree `fc382abb394865bfa122abf45987da5e1848a41d`; complete commit patch SHA256 `968eb860d530b4c06582cfa8b0e22240a8eaceaf5cddb78cc89c3a0a207443a6`. Worktree is clean and branch is synchronized. Candidate awaits owning-Conversation review. No later Slice 2 activation capability or external activation action occurred.
OWNER ACCEPT — SLICE 2 CANDIDATE 1 MANAGED-ROLE INTEGRITY — 2026-10-06
Accepted exact commit `7107d1143330417333bfe6105b18832129d6439f`, tree `fc382abb394865bfa122abf45987da5e1848a41d`, parent `57d26e582c583a81de370051b129f74f5b13ee45`, patch SHA256 `968eb860d530b4c06582cfa8b0e22240a8eaceaf5cddb78cc89c3a0a207443a6`. Local HEAD/upstream/live remote match and worktree is clean.

Scope is the first bounded Slice-2 capability only. Managed promotion, active-owner, and exact-session bounded EPISODE paths now require one exact generated `PRIME_CLAW_ROLE_KERNEL_V1`; malformed/missing/duplicate/stale/reversed/nested marker shapes fail through explicit `ctx.abort()` before provider dispatch. Ordinary explicit no-context sessions remain ordinary. Historical oversight and private bounded-identity packages are filtered from provider messages; the neutral kernel remains system-only. The implementation reuses existing lifecycle state/context hooks and adds no new state machine or policy copy.

Evidence reconciled: focused Docker migration 11 passed/7 deselected; Tier 0 291 passed/167 skipped log SHA256 `836f2a4d1f7575fccaf63171c5462327e272cdb3393486864a06f95ca048df35`; Docker Tier 1 60 passed/398 deselected log SHA256 `135c730d41f649dbc3608341097dfcfda29a021c6e1320880f8428b95c34a139`; pinned Prime Agent 0.9.8 probe PASS log SHA256 `5c27c8dfc691e534f69608c8fe4ab434acf65cfd386749532f15eb10ebe3fc59`. Preserved candidate patch hash matches the commit patch.

No managed Conversation skill/activation receipt/readiness gate/shim, Slice 3, landing, user-global mutation, restart, UAT, finalization, bookkeeping, or cleanup occurred. Candidate 1 is accepted; canonical handoff may implement the next smallest Slice-2 capability only.
SLICE 2 ACTIVE-OWNER GUIDE CANDIDATE — IMPLEMENTATION CHECKPOINT — 2026-10-06

Accepted parent remains `7107d1143330417333bfe6105b18832129d6439f` / tree `fc382abb394865bfa122abf45987da5e1848a41d`. This bounded candidate installs the sole 335-word global `prime-claw-oversee-episode` guide, exact public metadata, guarded apply/check ownership, active-owner single-use tool-result activation, private issued-to-consumed session/lifecycle receipt, later-context redaction, read-only readiness, and pre-mutation handoff/first-finalization gates. The project skill is now a policy-free shim; execute and the Slice 1 fixed three-file manager receipt are unchanged.

Prospective-location activation and create gate, EXPERT admission, broad timing/race matrices, cutover, landing, user-global mutation, restart, UAT, finalization, and cleanup remain deferred. Focused static contracts: 14 passed. Focused Docker installer/native/Node capability: 7 passed; corrected tool-error-semantics retry: 2 passed. Full gates and exact review remain pending.
INDEPENDENT REVIEW CYCLE 1 — BLOCK ACCEPTED — 2026-10-06

Reviewer `guide-candidate-reviewer` (`sub-f9d2fd87`, `openai-codex/gpt-5.6-sol`) verified patch SHA256 `f40bb0b1e1f5ccbf88c9cbe3896171391e0fcbf9b15dfbcca20e34952c42591c` and found the frozen artifact omitted the three untracked required additions. This was an artifact-generation defect, not an implementation defect. Accepted repair: regenerated from the same parent with explicit additions for the evidence receipt, metadata module, and managed guide. Strict clean-parent apply check passes; all three applied files are byte-identical. Repaired cycle-2 patch SHA256: `3d994cd7ede7a045549f08e92e45f66420640146e8bcc0cf282e3e00d6de0a14`. Production bytes are unchanged. This is the second and final bounded review cycle.
INDEPENDENT REVIEW CYCLE 2 — BLOCK / STOP-LOSS — 2026-10-06

Reviewer `guide-candidate-reviewer` (`sub-f9d2fd87`, `openai-codex/gpt-5.6-sol`) verified repaired self-contained patch SHA256 `3d994cd7ede7a045549f08e92e45f66420640146e8bcc0cf282e3e00d6de0a14`, reconstructed the three additions byte-identically, confirmed guide SHA256 `23ada4c2dff653dda3f6291c293f09dcc9c83d409f75404a665186e1dacfb563`, and changed nothing. BLOCK: `applyGuideDisclosure` validates only activation-named results, but `filterGuideMessages` permits all guide-bearing results with the allowed tool-call ID. A valid pair plus same-ID/different-name duplicate result can disclose twice rather than abort. Repair direction: require exact uniqueness of the issued ID across all assistant call items and tool-result messages before consumption, then authorize one exact validated record; test duplicate result and assistant-call aliases plus retained normal pairing/disclosure. This is the second repair/review cycle. Per Specification lines 136-140 and Execution Plan lines 465-469, implementation is paused for operator scope/architecture consultation. No repair, commit, or push was performed; HEAD remains accepted parent `7107d1143330417333bfe6105b18832129d6439f`.
OWNER TWO-CYCLE STOP-LOSS CONSULT — 2026-10-06
The episode correctly stopped uncommitted/unpushed after two review cycles. Owner independently confirmed cycle-2 finding: `applyGuideDisclosure` counts only activation-named records, while `filterGuideMessages` permits every guide-bearing tool result sharing the allowed call ID. A valid bound result plus a same-ID/different-name duplicate can therefore disclose the guide twice. This violates the explicitly retained single-use disclosure and collision-detection contract, but the repair is narrow and does not justify broader receipt/race machinery.

Owner recommendation pending operator decision: authorize one exceptional bounded repair only. Require the issued ID to appear exactly once across all assistant call items and exactly once across all tool-result messages, authorize only that exact validated result record, add the two named alias regressions, rerun invalidated focused/complete gates, commit/push, and stop. Do not launch a third independent/adversarial review; the owning Conversation should compare the exact repair diff and tests against this finding. No other finding, scope expansion, Slice 3, activation, landing, global mutation, restart, or cleanup is authorized. Alternative: backlog the duplicate-ID case and pause this candidate, accepting that the explicit single-use invariant is not fully met. Await operator choice.
OPERATOR DELEGATION AND OWNER DISPOSITION AUTHORITY — 2026-10-06
The operator explicitly delegated finding triage for the remainder of this episode to the owning Conversation. The owner may authorize repair of independently confirmed, non-speculative defects inside the approved product contract; backlog plausible edge cases until dogfood/user evidence or a hard requirement justifies them; and overrule findings that are out of scope or disproportionate. The owner is directed to keep the same episode moving until the original specification intent is delivered and to prevent drift away from that intent.

This authority does not convert reviewer suggestions into requirements and does not authorize scope expansion beyond the approved product intent. The two-cycle stop-loss now requires owner reassessment and a recorded disposition; operator consultation is reserved for a genuine new product/scope decision, not every valid in-scope repair.

OWNER DISPOSITION — GUIDE DUPLICATE-ID FINDING: confirmed in-contract and proportionate. Authorize one bounded repair: require the issued ID exactly once across all assistant tool calls and all tool-result messages, authorize only the exact validated result, add same-ID/different-name call/result regressions, rerun invalidated focused and complete gates, commit/push, report, and stop. No third independent/adversarial review. No other repair, scope expansion, Slice 3, landing, user-global mutation, restart, UAT, finalization, bookkeeping, or cleanup is authorized by this disposition.
OWNER AUTHORIZATION AFTER TWO-CYCLE STOP — 2026-10-06

Owner independently confirmed and accepted the cycle-2 in-contract finding and authorized one exceptional bounded repair pass. Scope: before consumption, require the issued tool-call ID exactly once across all assistant tool-call items and exactly once across all tool-result messages regardless of name; require the unique call/result to use the activation tool name and match exact bound text/details; authorize only that exact validated result. Add same-ID/different-name assistant-call and result alias regressions; preserve valid one-time disclosure, later omission, pairing, and abort-before-dispatch. Rerun invalidated focused tests, complete Tier 0, Docker Tier 1, and pinned 0.9.8 probe. No third independent/adversarial review and no additional finding. Commit/push one candidate, report, stop. All later Slice 2/3, landing, user-global mutation, restart, UAT, finalization, and cleanup remain excluded.
AUTHORIZED DUPLICATE-ID REPAIR COMPLETE — 2026-10-06

Implemented only the accepted cycle-2 finding: issued ID uniqueness now spans all assistant tool-call items and all tool-result messages regardless of name; the one call/result must use the activation tool name; the result must match exact bound text and exact two-field version/hash details; only that validated result object is authorized. Added same-ID/different-name assistant-call and tool-result alias regressions; both abort and invalidate readiness. Focused Docker: 17 passed, 17 deselected in 103.77s, log SHA256 `f8c8669bc74938aaa26fd263605de8266d9e299ede51e5d899a0fc5f877db9e2`. Complete Tier 0: 287 passed, 172 skipped, SHA256 `d9d5246c10e3ef326907f7e637f515eeb619e19516fb486c09f1d0cea98cdd44`. Docker Tier 1: 65 passed, 394 deselected, SHA256 `57d76a5e8b6a8e31b3d405250c9dfe63fe10d406f3f92d2210d2e84218587bb0`. Pinned Prime Agent 0.9.8 probe PASS, SHA256 `51b2e08fb4c99c733f25998f5c0cdb2e7dd6ad412b8eb13fd5be9b62ccaebeb1`. Logs `.test-results/20261006-070101-29790/`. No third independent/adversarial review ran. No later Slice 2/3, landing, global mutation, restart, UAT, finalization, or cleanup.
CANDIDATE COMMITTED — 2026-10-06

Owner-authorized Slice 2 active-owner Conversation guide candidate committed as `d31ab61e89247a024948d66e2613d434c89688fd` / tree `f7ecd504d3f890455b858d53c6099c936fb0bf85`. Parent remains accepted candidate 1 `7107d1143330417333bfe6105b18832129d6439f`. Validation and deferred boundaries are recorded in the evidence document. This is the one candidate for the authorized pass; stop after push/report.
OWNER ACCEPT — SLICE 2 ACTIVE-OWNER GUIDE CAPABILITY — 2026-10-06
Accepted exact commit `d31ab61e89247a024948d66e2613d434c89688fd`, tree `f7ecd504d3f890455b858d53c6099c936fb0bf85`, parent `7107d1143330417333bfe6105b18832129d6439f`, complete binary patch SHA256 `2e68ef93cc476162d85a94757a8d5a89b6e4ae4e1db52e90fa3084be1a9630ec`. Local HEAD, upstream, fetched origin, and reported ls-remote agree; worktree and diff-check are clean.

Owner review confirms the authorized duplicate-ID repair exactly resolves the accepted in-contract defect. Before consumption, the issued ID is counted across all assistant tool-call items and all tool-result messages regardless of name; exactly one call and result must name `prime_claw_activate_conversation_guide`, match the bound result text and exact version/hash details, and only that validated result object is disclosed. Same-ID/different-name call and result regressions both abort, invalidate readiness, and preserve zero provider dispatch. No third independent review or additional finding was introduced.

Capability accepted: exact managed 356-word Conversation guide install/check; one active-owner lifecycle-bound in-memory issued/consumed receipt; one intended tool-result disclosure with later omission; read-only readiness; pre-mutation handoff and first-finalization gates; policy-free project shim. Existing neutral-kernel/private-identity behavior remains intact. Prospective-location activation and `create_spec_episode` gating remain later Slice 2 work.

Evidence reconciled: focused Docker 17 passed/17 deselected SHA256 `f8c8669bc74938aaa26fd263605de8266d9e299ede51e5d899a0fc5f877db9e2`; Tier 0 287 passed/172 skipped SHA256 `d9d5246c10e3ef326907f7e637f515eeb619e19516fb486c09f1d0cea98cdd44`; Docker Tier 1 65 passed/394 deselected SHA256 `57d76a5e8b6a8e31b3d405250c9dfe63fe10d406f3f92d2210d2e84218587bb0`; pinned Prime Agent 0.9.8 probe PASS SHA256 `51b2e08fb4c99c733f25998f5c0cdb2e7dd6ad412b8eb13fd5be9b62ccaebeb1`; managed guide SHA256 `23ada4c2dff653dda3f6291c293f09dcc9c83d409f75404a665186e1dacfb563`.

No Slice 3, landing, user-global apply/restart, UAT, finalization, bookkeeping, or cleanup occurred. Candidate is accepted for canonical continuation to the next smallest prospective Slice-2 capability.
OWNER ACCEPTANCE AND NEXT SLICE-2 AUTHORITY — 2026-10-06

Owner accepted active-owner guide candidate `d31ab61e89247a024948d66e2613d434c89688fd` / tree `f7ecd504d3f890455b858d53c6099c936fb0bf85`. Next candidate only: prospective future-location guide activation plus pre-mutation `create_spec_episode` readiness. Reuse existing `/implement-spec` preparation/admission as trusted intent; minimally bind owner session, exact future location, current kernel/guide generation, and current preparation lifecycle. Require consumed matching readiness before any identity/worktree/branch/session/marker mutation. Preserve active-owner handoff/finalization and inactive finalize replay; keep guide bytes and `execute` unchanged. Prove ordinary no-context, wrong/missing/stale subject, EPISODE/generic child/active-owner misuse, valid one-time prospective flow, private non-replayable receipt, and abort-before-mutation. Run focused/full/pinned gates, commit/push one candidate, report, stop. Defer broader route coverage if not required. No Slice 3, landing, global mutation, restart, UAT, finalization, or cleanup.
PROSPECTIVE CREATE READINESS CANDIDATE VALIDATED — 2026-10-06

Implemented the next bounded Slice 2 capability on accepted parent `d31ab61e89247a024948d66e2613d434c89688fd`: reuse the current `/implement-spec` approval map; assign one private UUID per admitted preparation; extend the existing guide subject/receipt to bind owner session, exact future location, preparation UUID, role-kernel SHA, and guide generation; and require the consumed exact prospective receipt before approval deletion, episode creator invocation, or oversight append. Missing/early/stale/wrong preparation, ordinary no-context, EPISODE, generic child, and active-owner subjects stop before creation. Valid creation is one-time and replay cannot reach the creator. Active-owner handoff/finalization and inactive finalize replay remain unchanged. Guide SHA `23ada4c2dff653dda3f6291c293f09dcc9c83d409f75404a665186e1dacfb563` and execute SHA `7c720c8c949775b3b705a0f879ad9c754792839967ca4df702825b780bb17e6d` are unchanged.

Focused Docker 17 passed/17 deselected, SHA256 `0b228a02160104651f4500bf92fe85406c97835cb1db576987b4566efecbef83`. Installed-runtime prospective flow 2 passed, SHA256 `e1d74ca07a7120d41404064040fd0c8b83906b2bcdaadf2dad032ffa7addfd2b`. Complete Tier 0 287 passed/172 skipped, SHA256 `7171d684cc52637ea785eeaf6ff232b52626eeb352a8d3645f550fe276057c03`. Docker Tier 1 65 passed/394 deselected, SHA256 `cebb7c76ef149840f0e92516a40b8a6f478370d0f491475220c54fa0d1b94d3e`. Pinned Prime Agent 0.9.8 probe PASS, SHA256 `45bb71702b087491ed42b9c8464fa62a8c1f67e5835fa877537f132b71406616`. Logs `.test-results/20261006-073440-27144/`. Evidence: `docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-prospective-create-readiness.md`. Next: freeze exact patch and perform one independent read-only review; no tracked mutation after PASS. No broader provider-route pass, EXPERT admission, Slice 3, landing, global mutation, restart, UAT, finalization, or cleanup.
INDEPENDENT EXACT-CANDIDATE REVIEW PASS — 2026-10-06

Reviewer `prospective-create-reviewer` (`sub-5e20fcfb`), actual model `openai-codex/gpt-5.6-sol`, returned PASS on frozen full-index patch SHA256 `e2a5ee2754480462d53329fa6b436d717ce00e5501b14e2d6fb394e5505581a7` over accepted parent `d31ab61e89247a024948d66e2613d434c89688fd`. Reviewer verified byte identity, private exact session/location/per-admission-UUID/kernel/guide/call/result binding, pre-creator and pre-marker gate order, negative role/location/preparation paths, one-time approval consumption, preserved active handoff/first-finalize and inactive finalize replay, all evidence hashes, and unchanged guide/execute bytes. No finding and no mutation. Raw report `.test-results/20261006-073440-27144/independent-review.txt`, SHA256 `09483b7c2b0759cce24019e28b915aa618fe50468c9d5b208d5c42316c93bd32`. Root independently regenerated the patch after PASS; SHA256 and bytes remained exact. Candidate is cleared for the single commit/push.
PROSPECTIVE CREATE READINESS CANDIDATE COMMITTED — 2026-10-06

Exact PASS-reviewed candidate committed as `29b8932e3e576d0068194e44a5494af98474d8bf` / tree `a5a16cacce0fad56f546a565475cefe519761b0a`, parent `d31ab61e89247a024948d66e2613d434c89688fd`, frozen patch SHA256 `e2a5ee2754480462d53329fa6b436d717ce00e5501b14e2d6fb394e5505581a7`. This is the one candidate for the authorized pass. Stop after push/report; no remaining provider-route pass, EXPERT admission, Slice 3, landing, global mutation, restart, UAT, finalization, or cleanup.
OWNER ACCEPT — SLICE 2 PROSPECTIVE CREATE READINESS — 2026-10-06
Accepted exact commit `29b8932e3e576d0068194e44a5494af98474d8bf`, tree `a5a16cacce0fad56f546a565475cefe519761b0a`, parent `d31ab61e89247a024948d66e2613d434c89688fd`, frozen complete binary patch SHA256 `e2a5ee2754480462d53329fa6b436d717ce00e5501b14e2d6fb394e5505581a7`. Local HEAD/upstream/fetched origin/ls-remote agree; worktree and diff-check are clean.

Owner review confirms one bounded capability: every admitted `/implement-spec` preparation receives a private UUID; the existing guide receipt distinguishes prospective from active subjects and binds exact owner session, normalized selected future location, preparation UUID, role-kernel SHA, guide path/version/SHA, tool-call ID, and result bytes. `create_spec_episode` checks exact current approval plus consumed prospective readiness before approval deletion, creator invocation, or oversight append. Missing/early/stale/wrong preparation, ordinary no-context, EPISODE, depth-positive generic child, and active-owner misuse cannot reach creation. Valid creation consumes approval before its creator and cannot replay. No generalized receipt framework or durable state was added.

Evidence reconciled: focused Docker 17 passed/17 deselected SHA256 `0b228a02160104651f4500bf92fe85406c97835cb1db576987b4566efecbef83`; installed-runtime prospective flow 2 passed SHA256 `e1d74ca07a7120d41404064040fd0c8b83906b2bcdaadf2dad032ffa7addfd2b`; Tier 0 287 passed/172 skipped SHA256 `7171d684cc52637ea785eeaf6ff232b52626eeb352a8d3645f550fe276057c03`; Docker Tier 1 65 passed/394 deselected SHA256 `cebb7c76ef149840f0e92516a40b8a6f478370d0f491475220c54fa0d1b94d3e`; pinned 0.9.8 probe PASS SHA256 `45bb71702b087491ed42b9c8464fa62a8c1f67e5835fa877537f132b71406616`; independent exact-patch PASS report SHA256 `09483b7c2b0759cce24019e28b915aa618fe50468c9d5b208d5c42316c93bd32`. Managed guide and execute remain byte-identical.

No Slice 3, landing, user-global mutation/restart, UAT, finalization, bookkeeping, or cleanup occurred. Candidate is accepted. Remaining Slice 2 work is a bounded provider-route coverage reconciliation, not a new policy/mechanism mandate.
OWNER ACCEPTANCE AND FINAL SLICE-2 COVERAGE AUTHORITY — 2026-10-06

Owner accepted prospective create-readiness candidate `29b8932e3e576d0068194e44a5494af98474d8bf` / tree `a5a16cacce0fad56f546a565475cefe519761b0a`. Next candidate is the final bounded Slice 2 coverage reconciliation only. Map existing static/Node/native/provider proof to the Section 7 route and acceptance list; collapse common `context` seam routes into equivalence classes; add only smallest representative tests for material gaps, prioritizing queued/injected/direct-idle continuation, tool loop/retry, compaction/resume/reload/recovered queue, project SYSTEM/APPEND and global/project AGENTS/CLAUDE shadows, CLI no-context, and SDK override. Reuse one-kernel, no user/custom guide/private identity, one intended guide toolResult/later omission, and abort-before-provider assertions. No production change absent a concrete in-contract defect; if found, record/repair only that seam under delegated triage. Mark Slice 2 complete only with actual approved coverage. Run focused/full/pinned gates, freeze one commit, independent review only if production changes, commit/push, report, stop. No EXPERT/Slice 3, landing, global mutation, restart, UAT, finalization, or cleanup.
FINAL SLICE-2 COVERAGE RECONCILIATION IMPLEMENTED — 2026-10-06

Accepted base `29b8932e3e576d0068194e44a5494af98474d8bf` / tree `a5a16cacce0fad56f546a565475cefe519761b0a`. Test/docs-only candidate; production code unchanged. Route equivalence map now covers fresh direct/custom/injected/idle/queued agent-message/follow-up/tool routes; real provider retry after single guide disclosure; compaction/resume/reload/recovered queue/restart; project SYSTEM/APPEND plus global/project AGENTS/CLAUDE; CLI no-context; preserving/replacing SDK override; managed abort and ordinary negative; private channel filtering; lifecycle readiness and shim/install resources. New representatives tag exact native routes, restore one queued action, prove guide omission on real retry with call/result ID correlation and zero receipt fields, prove selected global CLAUDE survives project SYSTEM+APPEND+AGENTS, prove preserving SDK override dispatch and replacing override zero-provider abort, and extend shared assertions to bounded identity. Focused native 5 passed (SHA256 `48e96061c5e8ba4ee22d96d9d7ada016cdd24c39396a1ff20dbd26b5c85d2218`); focused static/Node 27 passed/25 deselected (SHA256 `c3ca4f18b67006fb88ccf7663e3782ae438a41e928e318e18845fccd785ead11`). Evidence `docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-coverage-reconciliation.md`. Full Tier0/Docker Tier1/pinned probe pending; do not mark Slice 2 complete until green.
SLICE 2 COMPLETE — FINAL COVERAGE RECONCILIATION GREEN — 2026-10-06

All Section 7 routes/acceptance bullets are mapped in `docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-coverage-reconciliation.md` using common `context` seam equivalence classes and distinct representatives for ingress, restoration, prompt assembly/override, guide retry/receipt, managed negatives, lifecycle gates, and compatibility resources. Test/docs-only; no production change. Focused native 5 passed (`48e96061c5e8ba4ee22d96d9d7ada016cdd24c39396a1ff20dbd26b5c85d2218`); static/Node 27 passed/25 deselected (`c3ca4f18b67006fb88ccf7663e3782ae438a41e928e318e18845fccd785ead11`); Tier 0 287 passed/174 skipped (`d86968ba8b9f6960562d65366dd5d02af37875b523a2f49a2238f981fb7e348c`); Docker Tier 1 67 passed/394 deselected (`2f7ed32dfc1dbfc7718d19a829263b5d1b86aabeea5bbb2daa35b89273b62582`); pinned Prime Agent 0.9.8 probe PASS (`790a1581f0ddcb6fc8ec5a7c7729884557561c66a4cae74ed262de84d365cb2f`). Guide SHA `23ada4c2dff653dda3f6291c293f09dcc9c83d409f75404a665186e1dacfb563` and execute SHA `7c720c8c949775b3b705a0f879ad9c754792839967ca4df702825b780bb17e6d` unchanged. Owner-approved rule requires no independent exact-patch review because production did not change. Slice 2 is complete. Do not start Slice 3, land, mutate user-global state, restart, run UAT, finalize, or clean up in this pass.
FINAL SLICE-2 COVERAGE CANDIDATE FROZEN — 2026-10-06

Exact six-path test/docs-only patch over accepted base `29b8932e3e576d0068194e44a5494af98474d8bf` has SHA256 `8c3628440dae3e99764dbfcb6b59a2dd4738ae73967517e3a0c12942dcd3bc9b` and reconstructs byte-identically in a detached verification worktree. Paths: .ralph/plans/EXECUTION_PLAN.md, .ralph/plans/SPECIFICATION.md, docs/conversation-driven-episode-oversight.md, docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-coverage-reconciliation.md, tests/provider_context_assertions.py, tests/test_conversation_oversight_native.py. No `src/` or `scripts/` path changed. Full/pinned gates are green. Per owner-approved rule, no independent patch review is required for this no-production-change candidate. Cleared for one commit/push.
SLICE 2 COVERAGE CANDIDATE COMMITTED — 2026-10-06

Committed exact frozen test/docs-only candidate as `e8b047c1493e6718c2f3062f19c77bc0b23ce8e9` / tree `881b455a121b4cd53dd01005c5f84e31c7c9d555`, parent `29b8932e3e576d0068194e44a5494af98474d8bf`, patch SHA256 `8c3628440dae3e99764dbfcb6b59a2dd4738ae73967517e3a0c12942dcd3bc9b`. Slice 2 is complete at this candidate. Stop after push/report; no Slice 3, landing, global mutation, restart, UAT, finalization, or cleanup.
OWNER ACCEPT — SLICE 2 COMPLETE ROUTE COVERAGE — 2026-10-06
Accepted exact commit `e8b047c1493e6718c2f3062f19c77bc0b23ce8e9`, tree `881b455a121b4cd53dd01005c5f84e31c7c9d555`, parent `29b8932e3e576d0068194e44a5494af98474d8bf`, complete binary patch SHA256 `8c3628440dae3e99764dbfcb6b59a2dd4738ae73967517e3a0c12942dcd3bc9b`. Local HEAD/upstream/fetched origin/ls-remote agree; worktree and diff-check are clean. Exact six-path delta is tests/docs only; no production or installer path changed.

Owner review accepts the Section 7 equivalence-class mapping. Distinct native proof covers direct/custom/heartbeat/idle and queued agent-message ingress, queued follow-up/cancellation/recovered queue, automatic provider retry, tool loop, compaction, installed resume/reload/restart, combined project SYSTEM/APPEND plus global/project AGENTS/CLAUDE assembly, CLI no-context, and preserving/replacing SDK overrides. The transient-failure guide test proves one intended correlated disclosure, retry/later redaction, readiness retention, and absence of private receipt fields. Shared provider assertions plus the existing exact custom-type Node test cover unintended managed text/private identity exposure. No combinatorial matrix or production repair was added.

Evidence reconciled: focused native 5 passed SHA256 `48e96061c5e8ba4ee22d96d9d7ada016cdd24c39396a1ff20dbd26b5c85d2218`; focused static/Node 27 passed/25 deselected SHA256 `c3ca4f18b67006fb88ccf7663e3782ae438a41e928e318e18845fccd785ead11`; Tier 0 287 passed/174 skipped SHA256 `d86968ba8b9f6960562d65366dd5d02af37875b523a2f49a2238f981fb7e348c`; Docker Tier 1 67 passed/394 deselected SHA256 `2f7ed32dfc1dbfc7718d19a829263b5d1b86aabeea5bbb2daa35b89273b62582`; pinned 0.9.8 probe PASS SHA256 `790a1581f0ddcb6fc8ec5a7c7729884557561c66a4cae74ed262de84d365cb2f`. Guide and execute bytes remain unchanged. Test/docs-only candidate appropriately required no independent patch review.

Slice 2 is owner-accepted complete. Slice 3 may begin only through the next canonical handoff. No landing, user-global mutation/restart, UAT, finalization, bookkeeping, or cleanup occurred.
OWNER ACCEPTANCE AND SLICE-3 FIRST-CANDIDATE AUTHORITY — 2026-10-06

Owner accepted Slice 2 complete at `e8b047c1493e6718c2f3062f19c77bc0b23ce8e9` / tree `881b455a121b4cd53dd01005c5f84e31c7c9d555`. Next candidate is only the managed official EXPERT Python-backed skill/package, exact strict config/rubric parity to the unchanged standalone profile, installer/check ownership for both managed skill directories, and deterministic read-only exact-interpreter availability/preflight. Default managed-kernel mode validates source importability with the exact runtime interpreter without mutation and reports sync pending when appropriate. `PRIME_AGENT_KERNEL_PYTHON` requires an already-installed exact package/hash and returns deterministic UNAVAILABLE for missing/stale/mismatched interpreter/package before any reservation/RLM/message/lifecycle activity. Public interfaces only; no pyproject host-runtime dependency, host requests, source-path injection, or provisioning. Practical preflight/copy/final-check/known-state refusal only; no journal or rollback engine. Package stays inert; generic children gain no EXPERT authority. Run focused/full/pinned gates, evidence, one commit/push, report, stop. No spawn/reservation/nonce/expiry/handle binding/child admission/delivery/settlement/cleanup/provider identity, Slice 4, landing, global mutation, restart, UAT, finalization, or cleanup.
SLICE 3 EXPERT PREREQUISITE IMPLEMENTED; COMPLETE GATES PENDING — 2026-10-06

Accepted base `e8b047c1493e6718c2f3062f19c77bc0b23ce8e9` / tree `881b455a121b4cd53dd01005c5f84e31c7c9d555`. Added inert managed `prime-claw-official-expert-review` Python package/skill with zero dependencies and exact standalone profile bytes SHA256 `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`; strict config/rubric validation; package manifest SHA `a282b48718145d3aa396abc146bdca6a3f75b748c27023bbf874609386c09828`; read-only exact-interpreter preflight with managed AVAILABLE/SYNC_PENDING and configured exact-installed-only/UNAVAILABLE; hash-before-import for stale configured code; complete second-skill apply/check inventory and known-state refusal. No spawn/reservation/nonce/expiry/handle/admission/message/settlement/cleanup/provider identity or authority. Focused static 5 passed (`0e96d7ca7406320840ee2e704cbada03e2fe4b6d6aea1d667b4f685b07e7e24d`); focused Docker 41 passed/1 deselected (`ee7051ddbea02d17e5ea0e38311e6b639c8702d8c6f4d3ec28da29593f06837d`). Evidence `docs/evidence/official-lean-role-protocol/2026-10-06-slice-3-expert-prerequisite.md`. Complete Tier0/Tier1/pinned probe pending.
SLICE 3 EXPERT PREREQUISITE COMPLETE AT GREEN CANDIDATE — 2026-10-07

Bounded Section 22 prerequisite complete. Inert managed Python package/skill, exact unchanged standalone profile parity `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`, package manifest `a282b48718145d3aa396abc146bdca6a3f75b748c27023bbf874609386c09828`, read-only exact-interpreter managed AVAILABLE/SYNC_PENDING and configured exact-installed-only/UNAVAILABLE, hash-before-import, two-skill installer ownership, known-state refusal, and dedicated test preflight venv are implemented. Focused static 5 passed `0e96d7ca7406320840ee2e704cbada03e2fe4b6d6aea1d667b4f685b07e7e24d`; focused Docker 41 passed/1 deselected `ee7051ddbea02d17e5ea0e38311e6b639c8702d8c6f4d3ec28da29593f06837d`; authoritative Tier 0 291 passed/183 skipped `0fc99353d25e7c259617cba17f065e65905826001a54df3a51deeeeea76c9530`; complete Docker Tier 1 76 passed/398 deselected `5b780d8534eed21aacfb6596ff7cdb876c4ab138918c828a4679ee0538d4924f`; pinned Prime Agent 0.9.8 probe PASS `42737cf01af5d7b3c378abfde62e005231ad5fae9863c73f45db5842f7fae485`. Evidence `docs/evidence/official-lean-role-protocol/2026-10-06-slice-3-expert-prerequisite.md`. Two earlier Tier1 setup failures were external DNS/download failures and later superseded. A wrong manual selector reproduced open incident `PRIMECLAW-20.9`; correct Tier0 is green. No spawn/reservation/nonce/expiry/handle/admission/message/settlement/cleanup/provider identity/authority. Do not begin later admission, Slice 4, landing, global mutation, restart, UAT, finalization, or cleanup.
SLICE 3 EXPERT PREREQUISITE CANDIDATE FROZEN — 2026-10-07

Exact 18-path patch over accepted base `e8b047c1493e6718c2f3062f19c77bc0b23ce8e9` has SHA256 `7902640428e5462ef6db07cee3b36e1d194435ef0f2035c58dbc41ece490c938` and reconstructs byte-identically in a detached verification worktree. It changes only plan/docs/evidence, practical installer/preflight/test infrastructure, the inert managed EXPERT skill/package, and focused tests. No root pyproject, extension/extension-support, admission/reservation/message/lifecycle/provider-identity path changed. All focused/full/pinned gates are green. Cleared for one commit/push and owner report; then stop.
SLICE 3 EXPERT PREREQUISITE COMMITTED — 2026-10-07

Committed frozen candidate as `e319e39949e1eb1c6b6b680d996ffb15ea664264` / tree `03a88ac106d7fed83f48f0e157366e7d13258c7f`, parent `e8b047c1493e6718c2f3062f19c77bc0b23ce8e9`, patch SHA256 `7902640428e5462ef6db07cee3b36e1d194435ef0f2035c58dbc41ece490c938`. This completes only plan Section 22. Stop after push/report; later EXPERT admission/reservation and all operational gates remain deferred.
OWNER ACCEPT — SLICE 3 INERT OFFICIAL EXPERT PACKAGE/PREFLIGHT — 2026-10-07
Accepted exact commit `e319e39949e1eb1c6b6b680d996ffb15ea664264`, tree `03a88ac106d7fed83f48f0e157366e7d13258c7f`, parent `e8b047c1493e6718c2f3062f19c77bc0b23ce8e9`, frozen complete binary patch SHA256 `7902640428e5462ef6db07cee3b36e1d194435ef0f2035c58dbc41ece490c938`. Local HEAD/upstream/fetched origin/ls-remote agree; worktree and diff-check are clean.

Owner review confirms the bounded prerequisite only. The Python-backed package has zero runtime dependencies, validates the exact three-field `expert-reviewer` / `openai-codex/gpt-6-astra` / `max` definition and complete standalone-profile bytes, and exposes definition-only `describe()` with `authority: false`. It contains no spawn, reservation, messaging, lifecycle, host request, or child authority. Package manifest SHA256 is `a282b48718145d3aa396abc146bdca6a3f75b748c27023bbf874609386c09828`; standalone/profile definition SHA256 is `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`.

The read-only preflight invokes the exact selected interpreter with PYTHONPATH removed, user site/bytecode disabled, and bounded output/timeout. Configured `PRIME_AGENT_KERNEL_PYTHON` accepts only a normally installed exact package/hash and returns deterministic UNAVAILABLE otherwise; managed mode accepts exact installed bytes or source-validates with the exact interpreter and reports SYNC_PENDING without provisioning. Stale configured bytes are hashed before import. Apply/check owns four exact regular EXPERT skill leaves and uses existing practical preflight/copy/final-check refusal; no journal or rollback schema was added.

Evidence reconciled: focused static 5 passed SHA256 `0e96d7ca7406320840ee2e704cbada03e2fe4b6d6aea1d667b4f685b07e7e24d`; focused Docker 41 passed/1 deselected SHA256 `ee7051ddbea02d17e5ea0e38311e6b639c8702d8c6f4d3ec28da29593f06837d`; Tier 0 291 passed/183 skipped SHA256 `0fc99353d25e7c259617cba17f065e65905826001a54df3a51deeeeea76c9530`; Docker Tier 1 76 passed/398 deselected SHA256 `5b780d8534eed21aacfb6596ff7cdb876c4ab138918c828a4679ee0538d4924f`; pinned 0.9.8 probe PASS SHA256 `42737cf01af5d7b3c378abfde62e005231ad5fae9863c73f45db5842f7fae485`. Earlier DNS/download failures occurred before candidate setup and are superseded, not product failures. The wrong manual marker recurrence remains tracked by existing incident `PRIMECLAW-20.9` and did not alter acceptance.

Later reservation/admission/transport remains Slice 3. No Slice 4, landing, user-global mutation/restart, UAT, finalization, bookkeeping, or cleanup occurred.
OWNER ACCEPTANCE AND SLICE-3 RESERVATION-FOUNDATION AUTHORITY — 2026-10-07

Owner accepted inert EXPERT package/preflight prerequisite at `e319e39949e1eb1c6b6b680d996ffb15ea664264` / tree `03a88ac106d7fed83f48f0e157366e7d13258c7f`. Next candidate only: exact-active-owner single-review in-memory/session-lifecycle reservation with consumed guide readiness and deterministic package AVAILABLE gate; SYNC_PENDING/UNAVAILABLE stops before mutation; one random opaque nonce, bounded expiry, immutable repo path+commit+packet digest+selector+thinking; native reserve/bind/read-only-status/cancel; one reserved→exact returned child handle/session/model metadata transition, but caller spawn metadata remains pending evidence and grants no admission/verification/authority. If safe bind requires child-side seam, stop at reserve/status/cancel. Cancel/expiry/shutdown idempotent; generic children ordinary; inert package API preserved. No live spawn/message/delivery/child provider admission/review/report settlement/cleanup, database/journal/cross-process recovery/token framework/hostile concurrency/orchestration/retry/report protocol/provider-visible authority. Run focused/full/pinned gates, evidence, one commit/push, report, stop. No Slice 4, landing, global mutation/restart, UAT, finalization, cleanup.
SECTION 23 EXPERT RESERVATION FOUNDATION COMPLETE AT GREEN CANDIDATE — 2026-10-07

Accepted base `e319e39949e1eb1c6b6b680d996ffb15ea664264` / tree `03a88ac106d7fed83f48f0e157366e7d13258c7f`. Added native owner-only reserve/bind/read-only-status/cancel with exact active Conversation owner, consumed guide, and fresh official-package AVAILABLE gates. SYNC_PENDING/UNAVAILABLE stop before mutation. One in-memory record per owner is also bound to a digest of every stable active oversight field, preventing same-session episode A state from being read/bound/cancelled in episode B; fully re-gated B reserve may replace stale generation state. Record has random 32-byte nonce, 15-minute expiry, canonical repo/current 40-or-64-hex OID, packet SHA256, exact selector/thinking/package hash. One bind records public rlm_child_id/name/session_dir/model only as bound-pending caller-supplied-unverified authority:false evidence. Status/expiry read-only; cancel/start/shutdown idempotent. Package API unchanged/inert; no live spawn/message/admission/review/settlement/cleanup/persistence/provider authority.

Independent review first BLOCKed session-only cross-generation scoping; repaired with full generation fingerprint and A→B regression; re-review PASS. Evidence `docs/evidence/official-lean-role-protocol/2026-10-07-slice-3-expert-reservation-foundation.md`. Focused host 45 Node + 17 Python pass SHA256 `74b2e0335034797026f8a5cabe31991c96f421d70b5936f1ad96cf44437ff6d4`; focused Docker 43 pass/1 deselected `d89ec0834bdda5bc3aa0cca7b968da6be7e927af8747aef3a1838f5edd50e538`; independent PASS `7059961f1d40315c7b2803df6a9889350e6ada34897fceecf2da13bb10ac4bd2`; Tier0 292 pass/183 skip `acbbdec41c90fc0ccc268679b6e7f057b89763e588f5504c9be0515dcff8eaac`; Docker Tier1 76 pass/399 deselected `286754f4454028df2d393c6a26ab2c9e1f3f3d18f63461980b8b1e45262ee340`; pinned Prime Agent 0.9.8 probe PASS `1c37ec70d39e94c658f8c9ed9e29acfd7d739ef5b48661593b89411ed23926e1`. Stop after one commit/push/report. No live admission/delivery, Slice4, landing, global mutation/restart, UAT, finalization, cleanup.
SECTION 23 CANDIDATE FROZEN — 2026-10-07

Exact 17-path patch over accepted base `e319e39949e1eb1c6b6b680d996ffb15ea664264` has SHA256 `b479a96d97fcfcdd757b32bcc5383c99840ae79b7b91b520185372803aedc23e` and reconstructs byte-identically in a detached verification worktree. It changes only active plan/spec, operator docs/evidence, installer inventories, owner assertion/reservation native support and registration, package-preflight parity tests, tool/lifecycle tests, and static inventories. The inert EXPERT package files, standalone profile, managed guide, and execute skill are byte-unchanged. Focused/full/pinned gates and repaired independent PASS are green. Cleared for one commit/push/report, then stop.
SECTION 23 RESERVATION FOUNDATION COMMITTED — 2026-10-07

Committed frozen candidate as `038d1cbaeb5f00614c4b4f40784cdb9119e72862` / tree `affdc7c242d6f7ec511a960181d250ba6a1bdea0`, parent `e319e39949e1eb1c6b6b680d996ffb15ea664264`, patch SHA256 `b479a96d97fcfcdd757b32bcc5383c99840ae79b7b91b520185372803aedc23e`. This completes only the owner-scoped reservation foundation. Stop after push/report; live reviewer spawn, child-side admission/verification, delivery, review execution, settlement, cleanup, Slice4, and operational gates remain deferred.
OWNER BOUNDED REVISION — SLICE 3 RESERVATION SUBJECT ROOT — 2026-10-07
Candidate `038d1cbaeb5f00614c4b4f40784cdb9119e72862` / tree `affdc7c242d6f7ec511a960181d250ba6a1bdea0` is not accepted yet. Owner confirmed one in-contract blocker: `defaultRepositoryIdentity(ctx)` resolves and requires the owning Conversation’s `ctx.cwd`/HEAD. The owner Conversation runs from the primary checkout, while the immutable review subject is the exact active episode marker’s worktree and candidate HEAD. ORP-009/010 require the packet/reservation to bind the reviewed repository/worktree path and candidate commit. The current tool therefore cannot reserve the real episode candidate under the intended topology.

Authorize one narrow repair only: derive the target from the exact active owner marker’s canonical `worktree`, require that real path to be an exact Git toplevel, require its current HEAD to equal the requested 40/64-hex candidate OID, and store that episode worktree path/OID in the reservation. Do not infer from owner CWD/branch/name or accept an arbitrary caller path. Preserve owner-generation, guide, package AVAILABLE, nonce/TTL, bound-pending non-authority, and A→B leak repair. Add a regression with owner CWD distinct from marker.worktree proving reserve accepts only the worktree HEAD, plus wrong owner-HEAD/worktree-HEAD/path refusal and no mutation. Re-run invalidated focused and complete gates, exact review of this repair, commit/push one revised candidate, and stop. No other finding or scope expansion is authorized.
OWNER-REQUIRED SECTION 23 REPOSITORY-SUBJECT REPAIR — 2026-10-07

Candidate `038d1cbaeb5f00614c4b4f40784cdb9119e72862` is not accepted. Exact blocker: reserve derives repo/HEAD from owner Conversation ctx.cwd, but official review subject is trusted active marker.worktree + candidate commit. Repair only this seam: canonicalize marker worktree, require it exists and equals its own git show-toplevel, require its HEAD equals requested exact 40/64-hex OID, store that worktree path/OID; accept no caller path and infer from no owner cwd/branch/session/prompt. Add distinct owner-CWD vs worktree topology regression plus wrong owner HEAD/worktree HEAD/noncanonical path refusal before mutation. Preserve all other gates/state/unverified semantics/A→B isolation. Re-run focused/full/pinned, freeze and independently exact-review repaired candidate, one commit/push/report, stop. No other finding, spawn/delivery/admission/report/Slice4/activation/cleanup.
SECTION 24 REPOSITORY-SUBJECT REPAIR IMPLEMENTED, VALIDATION PENDING — Reserve now derives only from trusted exact active marker.worktree, requires canonical existence, requires that real path to equal its own Git show-toplevel, requires its HEAD to equal the requested lowercase 40/64-hex OID, and stores canonical worktree path/OID. No caller path or owner ctx.cwd subject input remains. Added real distinct owner/episode Git topology regression covering owner HEAD mismatch, stale worktree HEAD, success, missing path, symlink/noncanonical path, nested/non-root path, and no nonce/state mutation on failures. All other generation/guide/package/nonce/TTL/bind/status/cancel semantics preserved. Focused/full/pinned gates and exact repaired-candidate review remain pending.
SECTION 24 REPAIR VALIDATED, READY FOR EXACT REVIEW — 2026-10-07

Marker-worktree-only subject repair and real two-repository topology regression complete. Focused host: 46 Node + 17 Python pass (`193b86dceb800ef53c7befb0e987a300173fd7c19b211f62d44b555108d5faf5`). Focused Docker: 43 pass/1 deselected (`52c9d9b9339e790f676ae5d940a3757ea03f06e2533762ca3a4c077a1eb1f2da`). Tier0: 292 pass/183 skip (`f9bb56648993f4f398ad7da7dfb03ef86a732a357b82d0e901daf8e7180849d2`). Docker Tier1: 76 pass/399 deselected (`c5dde0878d17ddf25ab2e209540eb9bb3ff38435301bb4ece4a1ebce73e7dd6a`). Pinned Prime Agent 0.9.8 probe PASS (`6c99b00b94c27700a90d75c590d2b37f3f2674c18f6ddcd7089c5cd6b5b7ba70`). Freeze exact tracked patch over rejected candidate 038d1cb and obtain independent review bounded only to repository-subject repair; no other finding accepted.
SECTION 24 EXACT REPAIR FROZEN — Patch over rejected base 038d1cbaeb5f00614c4b4f40784cdb9119e72862 has SHA256 `9b3a47ff1e783a49078e10d4b8b88fc8a595a17a02ce7cd7ddb99d1ce3e60aff` across exactly 8 intended paths and reconstructs byte-identically in a detached base worktree. All focused/full/pinned gates green. Submit only this exact patch for bounded repository-subject review; do not accept/investigate another finding and do not modify tracked files after PASS before commit.
SECTION 24 EXACT REVIEW BLOCK REPAIRED — Reviewer found `resolve(markerWorktree)` erased lexical dot/relative/trailing syntax before canonical comparison. Repair now requires raw marker worktree to be absolute and byte-equal to realpath, and requires trimmed git show-toplevel output to byte-equal that canonical string. Added `${worktree}/.` exact identity/marker regression proving refusal, unchanged nonce count, and status none. Focused Node 46/46 passes. Re-running all required focused/full/pinned gates before a new freeze and exact re-review; no other finding accepted.
SECTION 24 REPAIRED EXACT PATCH REFROZEN — 2026-10-07

After the accepted in-scope lexical canonicalization BLOCK, every required gate reran green. Exact 8-path patch over rejected base 038d1cbaeb5f00614c4b4f40784cdb9119e72862 now has SHA256 `a5da4559df1d3ebc3c3594909afcb4a794d1cf3b1e68bd2fee7239bfc11fac93` and reconstructs byte-identically. No tracked changes permitted after re-review PASS before commit. Review only the original repository-subject seam plus the raw-path remediation; no unrelated finding accepted.
SECTION 24 EXACT RE-REVIEW PASS — Frozen patch SHA256 `a5da4559df1d3ebc3c3594909afcb4a794d1cf3b1e68bd2fee7239bfc11fac93` received independent PASS after lexical-path repair. Review artifact `.test-results/20261007-031152-section24-repository-subject-repair/independent-review-r2.md` SHA256 `9f499da6fb872cb6e8560d6491b53d0f679284a1378df69b7d4212f05d34b2e6`. Reviewer independently ran focused Node 46/46 and confirmed raw absolute/realpath equality, exact raw Git top-level equality, dot-segment refusal before nonce/state mutation, owner-confirmed subject contract, and preserved Section23 invariants. Commit/push this exact tracked patch unchanged, then report and stop.
SECTION 24 REPOSITORY-SUBJECT REPAIR COMMITTED — `5674219bc914682a7e28c96146a68ab1b3e80f5f` / tree `930a7956545c6d3c9b8006e6cf59f5fa141f77d6`, parent rejected candidate `038d1cbaeb5f00614c4b4f40784cdb9119e72862`, exact reviewed patch SHA256 `a5da4559df1d3ebc3c3594909afcb4a794d1cf3b1e68bd2fee7239bfc11fac93`. Independent PASS artifact `.test-results/20261007-031152-section24-repository-subject-repair/independent-review-r2.md` SHA256 `9f499da6fb872cb6e8560d6491b53d0f679284a1378df69b7d4212f05d34b2e6`. Repair only marker-worktree canonical/Git-root/HEAD subject seam and tests/docs; all other Section23 semantics preserved. Push/remote verification pending.
SECTION 24 REPAIR PUSHED AND VERIFIED — Local HEAD, upstream, fetched origin, and ls-remote all equal `5674219bc914682a7e28c96146a68ab1b3e80f5f`; tree `930a7956545c6d3c9b8006e6cf59f5fa141f77d6`; worktree clean. Exact PASS-reviewed patch `a5da4559df1d3ebc3c3594909afcb4a794d1cf3b1e68bd2fee7239bfc11fac93` committed unchanged. This repairs only repository-subject derivation. Stop after owner report; no live spawn/delivery/admission/review workflow, Slice4, activation, finalization, or cleanup.
OWNER ACCEPT — SLICE 3 OFFICIAL EXPERT RESERVATION FOUNDATION — 2026-10-07
Accepted final state commit `5674219bc914682a7e28c96146a68ab1b3e80f5f`, tree `930a7956545c6d3c9b8006e6cf59f5fa141f77d6`, over accepted prerequisite parent `e319e39949e1eb1c6b6b680d996ffb15ea664264`. Combined foundation binary patch SHA256 `98839bda4ba546411835ea0313119f61dd396d3070bd5ca941dfc306aa85514b`; original foundation commit `038d1cbaeb5f00614c4b4f40784cdb9119e72862` patch SHA256 `b479a96d97fcfcdd757b32bcc5383c99840ae79b7b91b520185372803aedc23e`; bounded topology repair patch SHA256 `a5da4559df1d3ebc3c3594909afcb4a794d1cf3b1e68bd2fee7239bfc11fac93`. Local HEAD/upstream/fetched origin/ls-remote agree; worktree and diff-check are clean.

Owner review accepts the non-authoritative reservation foundation. Reserve/bind require exact active owner, consumed Conversation guide, fresh exact package AVAILABLE, exact selector/thinking, candidate OID, packet digest, and one generation-scoped in-memory nonce/TTL. Binding records the public spawn-return tuple only as `bound-pending`, `caller-supplied-unverified`, `authority:false`; no child or model is trusted yet. Status is read-only; cancel/expiry/session boundaries are idempotent. Same-session episode A→B cannot read, bind, or cancel A state, and a gated B reserve replaces stale A.

The owner-confirmed subject blocker is resolved: reservation derives only the exact active marker worktree, requires the raw marker path to be absolute and byte-equal to its real path, requires raw Git top-level output to equal that canonical path, resolves HEAD only there, and requires it to equal the requested 40/64-hex OID. The owner CWD/HEAD, arbitrary caller path, stale worktree HEAD, missing/dot-segment/symlink/non-root path all fail before nonce/state mutation. Exact repair independent re-review PASS SHA256 `9f499da6fb872cb6e8560d6491b53d0f679284a1378df69b7d4212f05d34b2e6`.

Post-repair evidence reconciled: focused host 46 Node plus 17 Python passed/49 skipped SHA256 `193b86dceb800ef53c7befb0e987a300173fd7c19b211f62d44b555108d5faf5`; focused Docker 43 passed/1 deselected SHA256 `98c29db507f12059054b6ee75393a3068d28ffaabe131566bbdabb95bdd18e98`; Tier 0 292 passed/183 skipped SHA256 `02854fba6e6b3e99c4131c07ad5ad3762711febf672e2e5bff0cab85c04e10cb`; Docker Tier 1 76 passed/399 deselected SHA256 `ae7bbb98d6351becd2775116a626324feef785b61dfe3fe1113fd9a8c1b5e435`; pinned 0.9.8 probe PASS SHA256 `4acef9ec21e7305d50d7d34869d9cecc4e11a0954b53be429b430a4bcb5da0a2`.

Live spawn/delivery/child admission, trusted returned-model verification, review execution, report settlement, and cleanup remain later Slice 3. No Slice 4, landing, user-global mutation/restart, UAT, finalization, bookkeeping, or cleanup occurred.
OWNER ACCEPTED RESERVATION FOUNDATION; NEXT VERTICAL AUTHORIZED — 2026-10-07

Accepted through `5674219bc914682a7e28c96146a68ab1b3e80f5f` / tree `930a7956545c6d3c9b8006e6cf59f5fa141f77d6`. Next and only slice: exact reviewer discovery/spawn, one guarded immutable-packet delivery, and child first packet-triggered call admission. Audit supported Prime Agent 0.9.8 public metadata/interfaces first; inability to prove trusted sender/target, actual child session/model, or pre-provider admission without upstream patch/unsupported request is a product constraint and stop. One exact configured selector/no fallback; explicit model/thinking; harmless bootstrap; verify returned model metadata without reasoning claim; bind public tuple pending; one lazy agent_message send only after bind; delivered/queued counts, uncertain never retried. Admission requires all trusted reservation/owner/sender-target/child/session/model/package/kernel/digest/nonce/expiry/use bindings; consume before provider; strip private fields; neutral system kernel plus bounded rubric/packet user turn; all mismatch/bootstrap/replay abort with zero review provider calls and generic children ordinary. Shared loaded-process registry only if native tests prove sharing. Minimal typed async Python helpers/lazy imports; no host deps. Defer report/settlement, owner disposition, deletion/cleanup, persistence/token framework/retry/race matrix, Slice4/landing/global activation/UAT/finalization.
SECTION 25 BLOCKED — SUPPORTED PRIME AGENT 0.9.8 RECEIVER TRUST METADATA IS INCOMPLETE — 2026-10-07

Audit of exact upstream commit `a1faacd53ac4473a75de1d434afaf50945c2f647` reached PRODUCT CONSTRAINT. Parent-side public RLM spawn proves child id/name/session_dir/model and sender-side agent_message receipt has daemon-authoritative endpoints. A receiving extension can publicly read its own ctx.model/session identity and can act at the pre-provider context seam. But the only receiver link to authoritative inbound sender/target is the internal built-in agent_message custom-message `details` schema, which is not exported as a supported extension/Python contract; public message text has only sanitized relationship/name plus body. agent_observe omits model/private details, and extensions cannot register a public Python host handler. Therefore trusted sender/target cannot be independently bound to actual child session/model before provider dispatch without unsupported internal request/message data or an upstream change. Serialized packet claims are not authority.

Disposition: all experimental plugin changes reverted. Active plan/spec moved to `.ralph/plans/blocked/`. Evidence: `docs/evidence/official-lean-role-protocol/2026-10-07-section-25-public-interface-constraint.md`. Accepted reservation foundation remains `5674219bc914682a7e28c96146a68ab1b3e80f5f` / tree `930a7956545c6d3c9b8006e6cf59f5fa141f77d6`. No feature reviewer spawn, packet delivery, admission, or provider call occurred.

Unblock only after a released supported public Prime Agent interface exposes unforgeable receiver sender/target plus sufficient current child/session identity at/before provider admission, or an equivalent supported admission callback. Re-audit that release. Do not patch/fork Prime Agent or consume the current internal custom-message details schema.
SECTION 25 PRODUCT CONSTRAINT RECORDED AND VALIDATED — Exact upstream 0.9.8 audit evidence is staged in `docs/evidence/official-lean-role-protocol/2026-10-07-section-25-public-interface-constraint.md`; active spec/plan moved to exact `.ralph/plans/blocked/{SPECIFICATION,EXECUTION_PLAN}.md`. Independent read-only auditor agreed PRODUCT CONSTRAINT. Plugin/source diff is empty. Focused static guard: 5 passed. `git diff --cached --check` clean. Unblock condition is a released supported receiver trust/admission interface; no upstream patch or internal message-details dependency permitted.
SECTION 25 BLOCKER COMMITTED — `3586dcc0cb02f314e7c50f661d956f794637f17c` / tree `fbffa90a2712504faa37a7b7594ee24dabcabe92`. Three-path docs-only commit: active plan/spec moved to blocked with exact product constraint and unblock condition; source audit evidence added. No plugin/runtime implementation diff. Push and remote verification pending.
SECTION 25 BLOCKER PUSHED AND VERIFIED — Local HEAD/upstream/fetched origin/ls-remote all `3586dcc0cb02f314e7c50f661d956f794637f17c`; tree `fbffa90a2712504faa37a7b7594ee24dabcabe92`; worktree clean; Bead status blocked. Accepted foundation remains `5674219bc914682a7e28c96146a68ab1b3e80f5f`. No implementation or feature spawn/delivery/admission/provider call. Resume only on the recorded supported-public-interface unblock condition.
OWNER PRODUCT DECISION — SECTION 25 SUPPORTED REDESIGN; EPISODE UNBLOCKED — 2026-10-07
The blocker audit at commit `3586dcc0cb02f314e7c50f661d956f794637f17c` is accepted as accurate for the originally specified inbound sender/target requirement: Prime Agent 0.9.8 exposes daemon-authoritative agent-message endpoints only through an unexported internal details schema. That internal shape, unsupported host requests, and a Prime Agent patch/fork remain prohibited.

The terminal blocked disposition is overruled because an independent Prime Agent expert confirmed a supported redesign. Inbound message text/header/sender/target carry zero role authority. Exact admission instead binds: the parent’s public authoritative `rlm.spawn` result; the child’s public host-authored session directory/id/name/file/header.parentSession and current model; canonical parent session-file/header identity; and one private one-use Prime Claw reservation/packet. The packet/rubric comes from private plugin-owned state, never inbound text. Copied/spoofed text cannot grant authority.

Because Prime Agent 0.9.8 uses jiti with moduleCache false, shared module state is not a supported cross-session channel. Authorize one purpose-built private filesystem protocol under an untracked plugin-owned canonical state namespace, with private directory/file modes, one random nonce, owner/project/session/generation scoping, fixed TTL, and atomic PENDING -> FINALIZED -> CLAIMED/consumed transitions using ordinary exclusive create/rename. This is not authority for a general database, journal, arbitrary token framework, hostile-local-code defense, or power-loss transaction engine. Malicious local extensions remain outside the trusted-local threat model.

The owner-side Python helper must own the race-sensitive sequence: exact model discovery; create nonce-bearing PENDING state keyed by an unpredictable requested child name and exact owner/reservation; call public `rlm.spawn` itself with explicit selector/thinking and harmless bootstrap; atomically FINALIZE from the returned session_dir/name/model; revoke on definite failure. Do not accept model-supplied handle fields as authoritative; retire/replace the interim caller-supplied bind path. The child pre-provider hook waits only a bounded time for FINALIZED, validates exact public self identity, canonical parent lineage/header ID, model, package/kernel, nonce/packet digest and expiry, atomically claims before provider dispatch, strips private fields, and injects exactly one rubric+packet user turn. Mismatch/timeout/replay calls explicit `ctx.abort()` and proves zero provider calls. The initial spawn turn is the trigger; no agent-message sender identity or retry is needed.

Move the active SPECIFICATION/EXECUTION_PLAN back from `.ralph/plans/blocked/`, record this correction, and continue the same episode. Keep report return/settlement, owner disposition, child deletion, later cleanup, Slice 4, landing, host activation/restart/UAT/finalization out of the next pass. Independent audits: inbound API constraint PASS from designated Prime Agent Expert; supported redesign verdict SUPPORTED REDESIGN with the caveats above.
PRODUCT CORRECTION / RESUME AUTHORIZED — Owner accepts the Section25 inbound-message trust constraint but rejects terminal blockage after independent Prime Agent Expert confirmation of a supported redesign. Restored active spec/plan; blocker commit `3586dcc0cb02f314e7c50f661d956f794637f17c` remains audit history. Implement only Section26 private launch record + child initial spawn-context admission. Inbound message content/metadata has zero authority; never read internal agent-message details. Owner Python skill owns exact discovery, private PENDING record, explicit spawn, returned-tuple FINALIZED or definite-failure revoke. Plugin-owned untracked mode-private nonce/TTL exact bindings and exclusive-create/atomic-rename PENDING->FINALIZED->CLAIMED; no shared module state or general DB/journal. Child validates public canonical session/model/file/name/parent lineage, claims before provider, filters bootstrap/private fields, exposes one rubric+packet turn, rechecks model each call; every mismatch/replay/timeout calls ctx.abort and proves zero provider calls. Focused/full/Docker/pinned gates; at most one exact review plus one bounded repair; one commit/push/report/stop. Settlement/disposition/deletion/cleanup/Slice4/landing/global activation/UAT/finalization deferred.
SECTION 26 PRIVATE LAUNCH/FIRST-CALL CANDIDATE FULLY VALIDATED — 2026-10-07
Implemented owner-only public model discovery, private PENDING->FINALIZED->CLAIMED launch state, public rlm.spawn actual-return binding, canonical child/parent/model/generation/candidate/package/kernel admission, explicit abort, and one canonical rubric-plus-packet provider turn with zero inbound agent-message authority. The one exact independent review BLOCKed the real Prime Agent 0.9.8 [custom harness digest, user bootstrap] shape; the sole bounded repair now counts public user-turn boundaries, filters custom/control history, and adds an isolated native provider seam. Final evidence: Node 52 passed; focused Python 16 passed/8 deselected; native provider seam 1 passed; raw Tier 0 397 passed/2 known unrelated sandbox-converge failures/76 deselected; clean Tier 0 with those two deselected 397 passed/79 deselected; Docker Tier 1 77 passed/399 deselected; pinned Prime Agent 0.9.8 probe OK. Evidence: docs/evidence/official-lean-role-protocol/2026-10-07-section-26-private-launch-admission.md. Candidate is staged for one commit/push/report. Settlement, owner PASS/BLOCK disposition, child deletion/cleanup, Slice 4, landing, global activation/restart/UAT, and finalization remain deferred.
SECTION 26 CANDIDATE COMMITTED AND PUSHED — 2026-10-07
Commit `f15457d82c3c9e3760272e71600eefbaf4809b17`; tree `d110b0957d1c1d819d791c72cfbddd75e8d4f517`; parent preserved audit commit `3586dcc0cb02f314e7c50f661d956f794637f17c`. Local HEAD, upstream, fetched origin, and independently queried remote branch all match; worktree is clean. This is the single Section 26 candidate for owning-Conversation review. No review settlement, owner PASS/BLOCK disposition, child deletion/cleanup, Slice 4, landing, user-global apply/restart/UAT, or finalization occurred. `bd sync` is unavailable in the installed CLI (`unknown command`); direct durable Beads updates succeeded.
OWNER BLOCK — SECTION 26 CANONICAL WORKTREE REGRESSION — 2026-10-07
Candidate `f15457d82c3c9e3760272e71600eefbaf4809b17`, tree `d110b0957d1c1d819d791c72cfbddd75e8d4f517`, synchronized/clean, binary patch SHA256 `57fd372ac8cc8c6facd9fc71e200d81873cf5bce15dc5a1adbe1f063d87fbd24`. The supported child-self-identity/private-state design and native initial-turn repair are otherwise directionally accepted, and the two raw Tier 0 sandbox-converge failures are unrelated external baseline failures rather than candidate failures.

One in-contract blocker remains. The new Python `launch()` path retires the native reserve tool but does not preserve accepted Section 24 repository-subject semantics. `_git_identity(Path(marker["worktree"]))` resolves the marker path and resolves `git rev-parse --show-toplevel` before comparison. A marker worktree containing dot segments or a symlink can therefore normalize to the candidate root and pass, even though accepted commit `5674219bc914682a7e28c96146a68ab1b3e80f5f` requires the raw marker path to be absolute and byte-equal to its real path and the raw Git top-level output to equal that canonical path before nonce/state mutation. The JS foundation tests that proved these negatives were removed with the retired tools, and the Python launch tests do not replace them.

Required bounded repair only: in the Python owner launch path, require the raw marker worktree string to be absolute and exactly equal to its strict real path; require raw `git rev-parse --show-toplevel` output to equal that same canonical string without normalizing it first; preserve exact HEAD equality. Add focused Python launch regressions for dot-segment and symlink/noncanonical marker worktrees (and retain nested/non-root rejection) that prove failure before private state creation, discovery/spawn as appropriate. Do not reopen the admission architecture, add a review cycle, or touch deferred report settlement/cleanup/Slice 4. Re-run focused package tests and affected full gates, amend via a new commit, push, report, stop.
OWNER REVIEW BLOCK — SECTION 26 CANONICAL REPOSITORY SUBJECT REGRESSION — 2026-10-07
Owner BLOCKS pushed candidate `f15457d82c3c9e3760272e71600eefbaf4809b17` on one exact regression only. Python launch normalizes marker worktree and Git toplevel before comparison, permitting dot-segment or symlink/noncanonical marker paths and losing accepted Section 24 contract `5674219bc914682a7e28c96146a68ab1b3e80f5f`. Authorized repair only: raw marker worktree must be absolute and byte-equal to strict real path; raw `git rev-parse --show-toplevel` must equal that canonical string before normalization; retain lowercase 40/64-hex HEAD. Add dot-segment and symlink/noncanonical marker regressions, retain nested/non-root rejection, prove failure before state creation/spawn, run focused plus affected full Tier 0/Docker/pinned probe, commit/push/report/stop. No second independent review, transaction expansion, sender metadata, settlement, cleanup, or Slice 4.
SECTION 26 OWNER-REVIEW CANONICAL-WORKTREE REPAIR VALIDATED — 2026-10-07
Repaired only the BLOCK on candidate `f15457d82c3c9e3760272e71600eefbaf4809b17`: raw marker worktree must be absolute and exactly equal its strict real path; raw Git toplevel must equal that same canonical string before normalization; lowercase 40/64-hex HEAD validation remains. Added dot-segment, symlink/noncanonical, and nested/non-root regressions proving failure before model discovery, private-state creation, or spawn. No second independent review or broader architecture/transaction/sender change. Gates: 52 Node passed; 19 focused Python passed/10 deselected; full Tier 0 295 passed/184 skipped; Docker Tier 1 77 passed/402 deselected; pinned Prime Agent 0.9.8 probe OK. Evidence updated at `docs/evidence/official-lean-role-protocol/2026-10-07-section-26-private-launch-admission.md`. Repair awaits commit/push/report; settlement, cleanup, Slice 4, landing, activation/restart/UAT, and finalization remain deferred.
SECTION 26 OWNER-REVIEW CANONICAL-WORKTREE REPAIR COMMITTED/PUSHED — 2026-10-07
Repair commit `3efd0cc79717378f9be5f448afe32f6a7c33ed39`; tree `06e08cbcf7a226409749f29c7e6dd815ee66ff4b`; exact parent is blocked candidate `f15457d82c3c9e3760272e71600eefbaf4809b17`. Local HEAD, upstream, fetched origin, and independent ls-remote all match; worktree clean. Required gates remain green: 52 Node; 19 focused Python/10 deselected; full Tier 0 295 passed/184 skipped; Docker Tier 1 77 passed/402 deselected; pinned Prime Agent 0.9.8 probe OK. `bd sync` remains unavailable (`unknown command`); direct durable Beads updates succeeded. Report to owner and stop; settlement, owner PASS/BLOCK disposition, review-child cleanup, Slice 4, landing, activation/restart/UAT, and finalization remain deferred.
OWNER ACCEPT — SECTION 26 PRIVATE LAUNCH/FIRST-CALL ADMISSION — 2026-10-07
Accepted final state commit `3efd0cc79717378f9be5f448afe32f6a7c33ed39`, tree `06e08cbcf7a226409749f29c7e6dd815ee66ff4b`, over Section 25 audit parent `3586dcc0cb02f314e7c50f661d956f794637f17c`. Combined binary patch SHA256 `2968083ee689eb6b47f121553b547d279a6ee552f6e9633abcf4ad88d9f7deeb`; owner-review repair patch SHA256 `e6fe3f2160c6a07b157362173b41c0bb6de486ae1b966e6120eb11663b298ac4`. Local HEAD/upstream/fetched origin/ls-remote agree; worktree and diff-check are clean.

Accepted behavior: inbound message text/header/sender/target and internal agent-message details have zero authority; caller reserve/bind tools are retired; the owner Python helper performs exact model discovery, private PENDING creation, public spawn, and finalization from actual returned identity; the child binds canonical public self identity, parent lineage, current model, owner generation, candidate/packet/package/kernel, claims before provider dispatch, filters custom/control/bootstrap state, and emits one canonical rubric-plus-packet provider user turn. Every refusal explicitly aborts and generic children remain ordinary. One exact independent review found the real `[custom,user]` first-turn defect; its single bounded repair is accepted.

The owner-review blocker is resolved without broadening scope: raw marker worktree must be absolute and byte-equal to strict real path; raw Git toplevel must equal it before normalization; exact lowercase 40/64-hex HEAD remains required. Dot-segment, symlink, and nested/non-root regressions prove rejection before discovery/state/spawn.

Final evidence reconciled: Node 52 passed; focused Python 19 passed/10 deselected; Tier 0 295 passed/184 skipped with SHA256 `04e0042f23dda75db9ef52a7f5a555dfc6b86cb999e39d2d666cba4fa8eebc5a`; Docker Tier 1 77 passed/402 deselected with SHA256 `3e87db61ca4ef65dfd653d42c0b81e28a73a70468832e37d73067d3b90eb3687`; pinned 0.9.8 probe OK with SHA256 `c82f10e16e19f5cec155f7403e0f7aae05317c23c57de9db6aefde7d5dad36d2`.

Report return/settlement, owner disposition persistence, child deletion/cleanup, Slice 4, landing, global apply/restart/UAT/finalization remain later boundaries. No second independent review was required.
SECTION 26 ACCEPTED; SECTION 27 REPORT/SETTLEMENT VERTICAL AUTHORIZED — 2026-10-07
Owner accepts Section 26 through `3efd0cc79717378f9be5f448afe32f6a7c33ed39` / tree `06e08cbcf7a226409749f29c7e6dd815ee66ff4b`. Next and only authorized vertical: strict depth-1 structured report submission from the already-admitted child plus exact depth-0 owner settlement/read. Derive identity from host-authored runtime/private state; zero inbound message/details authority. One bounded canonical PASS/BLOCK/ADVISORY/SPEC_QUESTION report; actionable remediation for every BLOCK; digest and atomic CLAIMED->REPORTED, exact duplicate idempotence only. Bind pre-review clean HEAD/status and reject while preserving post-review mutation evidence. Owner settlement derives owner/generation, validates exact report/spawn/child/session/model/candidate/package/kernel lineage and unchanged repository, transitions once REPORTED->SETTLED, and returns immutable report/receipt. FINALIZED/CLAIMED/REPORTED/SETTLED keep the child neutral and post-report/post-settlement provider calls abort. Reuse private files/atomic transitions; no metadata trust, database/journal, hostile-local-code defense, or retry framework. Defer product disposition persistence beyond receipt if larger, deletion/cleanup, Slice 4, landing, activation/restart/UAT/finalization. Run focused Python/Node/native mutation/replay plus full Tier0/Docker/pinned probe; one direct owner review only, no independent review; commit/push/report/stop.
SECTION 27 STRUCTURED REPORT/OWNER SETTLEMENT CANDIDATE FULLY VALIDATED — 2026-10-07
Accepted base remains Section 26 `3efd0cc79717378f9be5f448afe32f6a7c33ed39` / tree `06e08cbcf7a226409749f29c7e6dd815ee66ff4b`. Implemented only Section 27: clean pre-review repository snapshot at launch; strict no-identity-input depth-1 `submit(report)` with host-derived claimed lineage, bounded canonical PASS/BLOCK/ADVISORY/SPEC_QUESTION report, actionable BLOCK remediation, digest-exact idempotence, CLAIMED->REPORTED, and mutation evidence/rejection; no-argument depth-0 `settle()` with derived owner/generation, exact report/spawn/child/session/model/candidate/package/kernel validation, unchanged repository check, REPORTED->SETTLED, immutable receipts, and idempotent settled read. REPORTED/SETTLED remain neutral and provider calls explicitly abort. Canonical reviewer submits exactly once. No inbound metadata authority, database/journal, hostile-local-code defense, retries, Prime Agent patch, independent review, or deferred cleanup/lifecycle work. Gates: 25 focused Python passed/8 skipped; 55 Node passed; 2 native container passed; full Tier0 301 passed/184 skipped; Docker Tier1 77 passed/408 deselected; pinned Prime Agent 0.9.8 probe OK. Evidence: `docs/evidence/official-lean-role-protocol/2026-10-07-section-27-report-settlement.md`. Candidate awaits single commit/push and direct owning-Conversation review.
SECTION 27 EXACT FINAL BYTES FULLY GATED — 2026-10-07
Supersedes the earlier pre-final gate counts. Final inspection added complete private-state publication via fsynced temp + exclusive hard-link before prior-phase removal, a total 12 KiB report-limit regression, five claimed-lineage tamper cases, and two settlement digest/spawn-lineage cases. Final gates on exact bytes: focused Python/static compatibility 40 passed/8 skipped; Node 55 passed; full Tier0 308 passed/184 skipped; full Docker Tier1 77 passed/415 deselected (including native provider seams); pinned Prime Agent 0.9.8 probe OK with expected package SHA256 `059a3f1e291f42d8b6d823bce3fff2c683a46f7567071d14b06038abbfeca2c0`. Final log hashes are recorded in the Section 27 evidence doc. No independent review. Candidate awaits one commit/push and direct owning-Conversation review.
SECTION 27 STRICT-FINAL EXACT BYTES FULLY GATED — 2026-10-07
Final strictness adds exact current owner-session-file matching at settlement plus full idempotent SETTLED read revalidation of report/receipt digests, timestamps, repository evidence, and complete result equality. Added one receipt-tamper case, exact-owner-file mismatch, and settled-result tamper coverage. Exact final gates: focused Python/static compatibility 43 passed/8 skipped; Node 55 passed; full Tier0 311 passed/184 skipped; full Docker Tier1 77 passed/418 deselected including native provider seams; pinned Prime Agent 0.9.8 probe OK; expected package SHA256 `68ad970184e108a377743d51047c2be1e9ac73f3c45c4b84dc633589c051af5c`. No independent review. Candidate is ready for one commit/push and direct owning-Conversation review.
SECTION 27 CANDIDATE COMMITTED/PUSHED — 2026-10-07
Commit `ee655a8907882a21f693169fbd0369d2d8c2e122`; tree `60bc9c9985845f54b3ddb1b790f8e10fdda4ad06`; parent accepted Section 26 `3efd0cc79717378f9be5f448afe32f6a7c33ed39`; commit patch SHA256 `4b489b7c11c58f1321935f2f62eb9a451dd584e73b729e965954590e00afb973`. Local HEAD, upstream, fetched origin, and independent ls-remote match; worktree clean. Strict-final gates: 43 focused Python/8 skipped; 55 Node; full Tier0 311/184 skipped; Docker Tier1 77/418 deselected including native provider; pinned Prime Agent 0.9.8 probe OK; package SHA256 `68ad970184e108a377743d51047c2be1e9ac73f3c45c4b84dc633589c051af5c`. No independent review cycle. Candidate awaits one direct owning-Conversation review. `bd sync` remains unavailable (`unknown command`); direct shared-store updates succeeded. No product disposition persistence, child deletion/state cleanup, Slice 4, landing, activation/restart/UAT/finalization, bookkeeping, or physical cleanup occurred.
OWNER ACCEPT — SECTION 27 STRUCTURED REPORT AND EXACT OWNER SETTLEMENT — 2026-10-07
Accepted commit `ee655a8907882a21f693169fbd0369d2d8c2e122`, tree `60bc9c9985845f54b3ddb1b790f8e10fdda4ad06`, over accepted Section 26 `3efd0cc79717378f9be5f448afe32f6a7c33ed39`. Verified binary patch SHA256 is `db492a0b55343f12cc4b2f5cb9fca0b2332c302bc141b7df7df8600acfc3d55c` (the episode chat report’s `4b489b7c...` was a stale pre-final value and is not accepted evidence). Local HEAD/upstream/fetched origin/ls-remote agree; worktree and diff-check are clean.

Accepted behavior: launch refuses dirty candidates before discovery/state/spawn and records exact clean pre-review HEAD/status. The admitted depth-1 child derives and revalidates its claimed runtime/lineage and may submit one bounded canonical PASS/BLOCK/ADVISORY/SPEC_QUESTION report; every BLOCK has remediation. Exclusive fsynced transitions preserve complete REPORTED/SETTLED evidence, identical digest is idempotent, and conflicts, wrong lineage, malformed/oversized report, replay, or mutation fail closed. Depth-0 settle derives exact current owner/session/generation/repository, validates report/receipt and spawn/child/model/candidate/package/kernel bindings, compares unchanged repository state, and returns immutable receipts. Mutated evidence remains preserved and rejected. REPORTED/SETTLED children retain the neutral kernel and every later provider call aborts. Inbound messages remain zero authority.

Evidence reconciled: focused Python/static 43 passed/8 skipped SHA256 `5b5e9be638a26f9a5026ba83d1b71c78956e0ab2aa207d48ecadba60037f7548`; Node 55 passed SHA256 `126c25ce8073fea69a514bca47c3aee6c033eb2e9546ebc06c73abcb13de39ca`; native 0.9.8 provider 2 passed SHA256 `82c1e43c67a733137d3b6a577e66c56a07e60ec3f55815c4cdc91d969193bb12`; Tier 0 311 passed/184 skipped SHA256 `19f5e3f821c70b1cfa24668ba69b46813f614f0d779a00dd757ae7a21244c045`; Docker Tier 1 77 passed/418 deselected SHA256 `0bf9d6891fb50cf479835efe1603ff64fe0def64bebb46abbd3365755cf56749`; pinned 0.9.8 probe OK SHA256 `3d6c4342abc857da5e969d28114c2497560381dba69630610e2ef97ac46419d7`; managed package SHA256 `68ad970184e108a377743d51047c2be1e9ac73f3c45c4b84dc633589c051af5c`.

Owner disposition persistence, settled-child deletion, stale/crash reconciliation, private state cleanup, Slice 4, landing, global apply/restart/UAT/finalization remain later boundaries.
SECTION 27 ACCEPTED; SECTION 28 FINAL SLICE-3 CLOSURE AUTHORIZED — 2026-10-07
Owner accepts Section 27 through `ee655a8907882a21f693169fbd0369d2d8c2e122` / tree `60bc9c9985845f54b3ddb1b790f8e10fdda4ad06`. Next and only authorized vertical: exact depth-0 owner disposition persistence, definite settled-child deletion through public `rlm.list_subagents`/`rlm.delete_subagent`, bounded stale PENDING/FINALIZED/CLAIMED cancellation, immutable CLOSED/CANCELLED receipts, and explicit exact post-recording purge. Derive owner/session/generation and use stored actual child identity; disposition records but never invents conversational product authority. Exact-equality idempotence only. Ambiguous/mismatched roster, failed/uncertain deletion, conflicting phases, wrong lineage, non-expired cancellation, and purge-before-close fail closed. Preserve report/settlement/disposition/deletion evidence; never delete Prime Agent session artifacts or remove authority state before definite child absence. REPORTED/SETTLED/DISPOSITIONED/CLOSED/CANCELLED keep any addressable child neutral and provider calls abort. No inbound metadata trust, retries, database/general journal, hostile-local-code defense, Slice 4, landing, activation/restart/UAT/finalization/bookkeeping/physical cleanup. Run focused Python/Node/native and full Tier0/Docker/pinned probe; direct owner review only, no independent cycle; commit/push/report/stop.
SECTION 28 IMPLEMENTED; FOCUSED GATES PASS — 2026-10-07
Final Slice-3 lifecycle closure now includes exact depth-0 `record_disposition`, async public-roster `close`, exact `purge`, and bounded expired-launch `cancel_stale`; DISPOSITIONED/CLOSED/CANCELLED extend the private state protocol. Public deletion validates stored actual child ID plus session lineage, validates delete return, and re-lists; it claims registry/addressability absence only, never physical artifact deletion. Failure/uncertainty retains source state plus one bounded failure record. Pending cancellation refuses a same-name public child; published stale phases use exact delete/re-list proof. All terminal phases retain neutral kernel/provider abort; conflicting phases fail closed. Package capability/hash: `private-review-lifecycle-closure` / `ef3f353d8120ea85393c650d6fa0b5076df1773fee3eecb137a80bd89c0622d0`. Focused exact bytes: 58 Python passed/50 skipped; 59 Node passed; 2 native container passed. Full Tier0/Docker/pinned gates remain. No independent review cycle, Slice4, activation/restart/UAT/finalization/bookkeeping/physical cleanup.
SECTION 28 FULLY VALIDATED — 2026-10-07
Final Slice-3 lifecycle closure exact bytes pass all gates. Focused: 58 Python passed/50 skipped; 59 Node passed; 2 native container passed. Full Tier0: 325 passed/184 skipped. Docker Tier1: 77 passed/432 deselected. Pinned Prime Agent 0.9.8 probe OK. Package capability/hash: `private-review-lifecycle-closure` / `ef3f353d8120ea85393c650d6fa0b5076df1773fee3eecb137a80bd89c0622d0`. Evidence: `docs/evidence/official-lean-role-protocol/2026-10-07-section-28-lifecycle-closure.md`. Public delete proof is explicitly registry/addressability absence, not physical artifact deletion. Failure/uncertainty remains recoverable and cannot claim cleanup. No independent review cycle, Slice4, landing, activation/restart/UAT/finalization/bookkeeping/physical project cleanup. Candidate ready for one commit/push and direct owning-Conversation review.
SECTION 28 CANDIDATE COMMITTED/PUSHED — 2026-10-07
Commit `1fed99101f3dee95bf6863a3c9298d8c05d96718`; tree `7c28ffe42d9b7018899cd252460287c91c30604d`; parent accepted Section 27 `ee655a8907882a21f693169fbd0369d2d8c2e122`; patch SHA256 `6125b40ed108379161d1ced81b2ad5dde32bda0b66ec73795d27044670c9e74e`. Local HEAD, upstream, fetched origin, and independent ls-remote match; worktree clean. Gates: focused Python 58 passed/50 skipped; Node 59; native container 2; full Tier0 325/184 skipped; Docker Tier1 77/432 deselected; pinned Prime Agent 0.9.8 probe OK; package SHA256 `ef3f353d8120ea85393c650d6fa0b5076df1773fee3eecb137a80bd89c0622d0`. No independent review cycle. Candidate awaits one direct owning-Conversation review. `bd sync` remains unavailable (`unknown command`); direct shared-store updates succeeded. No Slice4, landing, user-global apply/restart/UAT, finalization, bookkeeping, or physical cleanup occurred.
OWNER BLOCK — SECTION 28 PENDING/FINALIZED CRASH WINDOW — 2026-10-07
Candidate `1fed99101f3dee95bf6863a3c9298d8c05d96718`, tree `7c28ffe42d9b7018899cd252460287c91c30604d`, synchronized/clean. Verified binary patch SHA256 is `b2d5366742f1cca8e4f4d2cf5c2460dd5315abbddf39a77800a7b17db0d023c1` (episode chat’s `6125b40e...` is stale and not accepted evidence).

One in-contract blocker remains. Python launch finalization publishes `.finalized.json` and only then unlinks `.pending.json`. The extension context hook builds `readyPaths` without PENDING and stops waiting as soon as FINALIZED exists. If the process crashes, or the child runs during the ordinary publication overlap, PENDING+FINALIZED is not counted as a conflict and the reviewer can be admitted from an ambiguous two-phase state. This contradicts the Section 28 stated crash/conflicting-phase fail-close contract.

Required bounded repair: treat PENDING plus exactly one ready FINALIZED as a transient publication overlap only while boundedly waiting for PENDING to disappear; admit only after exactly one authority phase remains. If PENDING+FINALIZED persists to the existing deadline, or any other multiple authority phases exist, explicitly abort with zero provider calls. Add native/Node coverage for transient overlap resolving successfully and persistent crash-window overlap failing closed. Preserve existing conflict cases. Also add `record_disposition`, `close`, `cancel_stale`, `purge`, disposition constants, and limits to the package’s explicit `__all__` public export list, with a focused assertion. No other architecture or cleanup change; no new independent review. Re-run focused/affected full gates, commit/push repair, report, stop.
SECTION 28 OWNER REVIEW BLOCK; NARROW REPAIR AUTHORIZED — 2026-10-07
Candidate `1fed99101f3dee95bf6863a3c9298d8c05d96718` / tree `7c28ffe42d9b7018899cd252460287c91c30604d` is blocked only on: (1) extension admission can ignore a persistent PENDING+FINALIZED crash overlap because ready-phase counting omits PENDING; tolerate that pair only transiently within the existing deadline, admit only after PENDING disappears and exactly one authority phase remains, and abort with zero provider calls on persistent overlap or any other multiple phases; add Node/native transient-success and persistent-refusal coverage while preserving conflict tests; (2) export/assert Section 28 public functions `record_disposition`, `close`, `cancel_stale`, `purge` and disposition decisions/limit through Python `__all__`. Rest of lifecycle directionally accepted. No architecture/deletion redesign, independent review, Slice4, landing, activation/restart/UAT/finalization/bookkeeping/physical cleanup. Run focused/full Tier0/Docker/pinned probe, commit/push one repair, report, stop.
SECTION 29 NARROW REPAIR IMPLEMENTED; FOCUSED GATES PASS — 2026-10-07
Against blocked Section 28 candidate `1fed99101f3dee95bf6863a3c9298d8c05d96718`, extension admission now tolerates only PENDING+one FINALIZED transiently within the existing deadline, admits only after PENDING disappears and exactly one ready authority phase remains, and aborts persistent/broader conflicts before provider use. Python exact `__all__` now exports/asserts record_disposition, close, cancel_stale, purge, DISPOSITION_DECISIONS, and DISPOSITION_LIMIT_BYTES plus intended prior names. Focused: Node 61 passed; Python 51 passed/50 skipped; Docker-native 2 passed, with resolving overlap one provider call and persistent overlap zero calls. Package SHA256 `92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff`. Full gates remain. No architecture/deletion redesign, independent review, Slice4, landing, activation/restart/UAT/finalization/bookkeeping/physical cleanup.
SECTION 29 NARROW REPAIR FULLY VALIDATED — 2026-10-07
Blocked-base repair exact implementation bytes pass all gates. Focused: Node 61; Python 51/50 skipped; Docker-native 2, proving resolving PENDING+FINALIZED admits once only after PENDING disappears and persistent overlap yields zero provider calls. Full Tier0 326/184 skipped. Docker Tier1 77/433 deselected. Pinned Prime Agent 0.9.8 probe OK. Exact public `__all__` assertion includes lifecycle functions/constants and intended prior names. Package SHA256 `92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff`. Evidence: `docs/evidence/official-lean-role-protocol/2026-10-07-section-29-publication-overlap-repair.md`. Ready for one commit/push and direct owner review. No architecture/deletion redesign, independent review, Slice4, landing, activation/restart/UAT/finalization/bookkeeping/physical cleanup.
SECTION 29 REPAIR CANDIDATE COMMITTED/PUSHED — 2026-10-07
Commit `6bceeea133f767d72739a8d88df2639ab75bba96`; tree `6421f9acc11a4c5e755e37dfa3060c2821bf5326`; parent blocked Section 28 `1fed99101f3dee95bf6863a3c9298d8c05d96718`; exact `git show --format= --binary HEAD` patch SHA256 `9d710c712ff75394877824dd4f1a7f38d0e6744b29cab7118ffca458c9d4bbf4` (33,078 bytes). Local HEAD, upstream, fetched origin, and independent ls-remote match; worktree clean. Gates: focused Node 61; Python 51/50 skipped; Docker-native 2; full Tier0 326/184 skipped; Docker Tier1 77/433 deselected; pinned Prime Agent 0.9.8 probe OK. Package SHA256 `92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff`. Persistent PENDING+FINALIZED aborts with zero provider calls; resolving overlap admits only after PENDING disappears; exact Python public surface asserted. `bd sync` remains unavailable (`unknown command`); direct shared-store updates succeeded. Awaiting direct owning-Conversation review. No architecture/deletion redesign, independent review, Slice4, landing, activation/restart/UAT/finalization/bookkeeping/physical cleanup.
OWNER ACCEPT — SECTION 28/29 LIFECYCLE CLOSURE; SLICE 3 COMPLETE — 2026-10-07
Accepted final state commit `6bceeea133f767d72739a8d88df2639ab75bba96`, tree `6421f9acc11a4c5e755e37dfa3060c2821bf5326`, over accepted Section 27 `ee655a8907882a21f693169fbd0369d2d8c2e122`. Combined lifecycle-closure binary patch SHA256 `ca4845768ef986c9097ac2078b1c2cb66ad4f452f25966d4b889ae3e6d26d8aa`; exact repair commit patch SHA256 `9d710c712ff75394877824dd4f1a7f38d0e6744b29cab7118ffca458c9d4bbf4` (33,078 bytes). Local HEAD/upstream/fetched origin/ls-remote agree; worktree and diff-check are clean.

Accepted Section 28 behavior: exact depth-0 owner disposition records bounded ACCEPT/REVISE/PAUSE/CONSULT plus rationale without rewriting the EXPERT report; close validates full lineage, uses public RLM roster/delete/re-list, and creates CLOSED only after proven registry/addressability absence; uncertain/malformed/mismatched deletion retains recoverable DISPOSITIONED with failure evidence and no automatic retry; stale cancellation handles exactly one expired owned PENDING/FINALIZED/CLAIMED launch with definite absence proof; purge requires the exact recorded CLOSED result and re-proves absence before removing only private authority state. Prime Agent transcripts/artifacts are not physically deleted. Terminal phases remain neutral and abort provider calls.

The owner crash-window blocker is resolved: PENDING participates in authority-phase counting. PENDING+FINALIZED may overlap only during the bounded publication wait and is never admissible; admission occurs only after PENDING disappears and exactly one ready phase remains. Persistent overlap and every other phase conflict explicitly abort with zero provider calls. The managed package explicitly exports all lifecycle functions/constants.

Final repair evidence reconciled: Node 61 passed SHA256 `cb8b2b3a75bb2b82ead7f572544d55d9f5ddff4c2e1afcaadf7f391071a66edf`; focused Python 51 passed/50 skipped SHA256 `6b97a433d61af81af380eb292b68a0da26a29620078dcdcb6086eda41c0b20e4`; native 0.9.8 provider 2 passed SHA256 `27f134b63b949b2870e1a62c75c4643e37b069ef1ee6a533b4054c9ba3a090a3`; Tier 0 326 passed/184 skipped SHA256 `9082e6cfc80f0beee289bc57f8dce61a6105331939d7414cba4053d26d3e5b97`; Docker Tier 1 77 passed/433 deselected SHA256 `1653f39648c1938926d9580464b47419d412cf671aed429e2856994d2a0120fc`; pinned 0.9.8 probe OK SHA256 `60402b89fd10d9169d04bff3ac550ad804f0b87414caff258d6023075a34c3e4`; package SHA256 `92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff`.

Slice 3 official EXPERT admission, review settlement, disposition, expiry, and cleanup lifecycle is complete. Slice 4 freeze/review, landing, global apply/restart/UAT, later compatibility removal, finalization, bookkeeping, and physical cleanup remain separately gated.
SLICE 3 ACCEPTED; SLICE 4 GENERATION A INTEGRATION/FREEZE AUTHORIZED — 2026-10-07
Owner accepts repaired lifecycle through `6bceeea133f767d72739a8d88df2639ab75bba96` / tree `6421f9acc11a4c5e755e37dfa3060c2821bf5326`; Slice3 complete. Next pass executes only plan Section9/30: fetch origin/main and normally merge exact advanced tip without rebasing accepted history; implement the smallest inert external cutover coordinator and recording-fake tests for process inventory/build mapping/shutdown order/zero-stale gates/exact landing-apply-check/single-runtime start-status/checkpoint recovery/resume; reconcile S1-S3 docs, traceability, inventories, recovery, provider assertions, instructions; audit full Generation A bridge inventory without deletion; build credential-safe private preactivation/rollback bundle with exact preimages/metadata/inventory/decision/known-good generation/topology/restore hash/manifest and prove only in isolation; commit sanitized non-self-referential readiness evidence before freeze; run complete Tier0, selected Docker Tier1, pinned probe, focused native/coordinator fakes, diff check, teardown; freeze/push one immutable commit/tree with no tracked changes afterward; report exact packet/evidence and stop. Independent review is owner-run from primary main after hash/state verification. No GateA, landing, main/user-global mutation, live stop/restart, UAT, compatibility removal, finalization, or cleanup.
SLICE 4 GENERATION A PRE-FREEZE GATES PASS — 2026-10-07
Fetched origin/main c24ba6c1e76585193d4f34f0b0b0233846780442 and normally merged it at 46147ff887569101b7e64a8466cde5887c15cc31, tree 12150bc9fef7b62248f60c000c79f71496d8ea18; parent order accepted S3 6bceeea133f767d72739a8d88df2639ab75bba96 first, exact main c24ba6c1e76585193d4f34f0b0b0233846780442 second; no rebase. Implemented inert operator-launched coordinator, fresh live role-receipt wrapper option, fixed-surface credential-safe private bundle/restore tool, recording fakes, provider/traceability/docs/runbook reconciliation, and bridge inventory regression. Private bundle manifest SHA256 394602e721d80f8f125d9dca15b51a5aef054e703d3382c1c3f8f5436cf61674; isolated apply/restore proof summary SHA256 434ecdc8efa8949a1b21bdbaaa8fff9884d1d3e41c1e299c41349311755d7ae1; pre-freeze gate receipt SHA256 4267aee0bf19aaa5c0965340286676c11d773b8c12c00c42b384081edebf37f6. Focused host 76/54 skipped; Node 76; Docker-native 3; Tier0 343/185 skipped; Docker Tier1 78/450 deselected; pinned Prime Agent 0.9.8 OK package SHA256 92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff. Remote main unchanged; diff check and teardown pass; zero test containers/pycache/Slice4 children. No independent review, GateA, landing, primary-main or user-global mutation, live stop/restart, UAT, compatibility removal, finalization, or cleanup. Ready to freeze one immutable candidate commit/tree and push/report.
SLICE 4 EXACT-BYTE RERUN PASS / FREEZE — 2026-10-07
A staged whitespace check caught and removed one trailing blank line before freeze. All complete gates reran on the exact staged bytes: Tier0 343 passed/185 skipped log SHA256 fdd0c9a97c644792ac015b213e7e2331338f6214f6d26562aaab2700526d6a92; Docker Tier1 78 passed/450 deselected log SHA256 70cfba7c9b470696b4b8a7a19a1a0c406776b57353462df8053cb2a278fcf12a; pinned 0.9.8 probe OK log SHA256 30f2e2b2cfc275a29d07b93afdde4c004a3309ea8e7d50df8887b660f6a32b0b. Final private gate receipt SHA256 dbdea28dd741e40aca096933b42a480497bd6078e9ded6e10cdc7cd1347cc3e8. Staged diff check passes; unstaged diff empty; remote main remains c24ba6c1e76585193d4f34f0b0b0233846780442; zero tier1 test containers, pycache, isolated scratch, or Slice4 subagents. Freeze begins now; no tracked mutation is permitted after the candidate commit.
SLICE 4 GENERATION A IMMUTABLE CANDIDATE PUSHED — 2026-10-07
Candidate `f2f3fcd25dbe3d96f05193261020d26bf79f1213`; tree `8b4fef1936766c7383a577317ac6d2436f4e72e5`; parent integration merge `46147ff887569101b7e64a8466cde5887c15cc31`. Integration merge tree `12150bc9fef7b62248f60c000c79f71496d8ea18`; parent order accepted S3 `6bceeea133f767d72739a8d88df2639ab75bba96` first, exact origin/main `c24ba6c1e76585193d4f34f0b0b0233846780442` second. Candidate-commit binary patch SHA256 `9384dc90526f80bca9028b79aa7c357de1c0cd5ed0314671a8cf417ecdd80121` (130,798 bytes); accepted-S3-to-candidate combined patch SHA256 `bf94c0c5432b715b97c6572ceb86fd2d89f4c7794b40e0361d971609824564e1` (162,067 bytes). Local/upstream/fetched origin/ls-remote match; worktree clean; origin/main remains `c24ba6c1e76585193d4f34f0b0b0233846780442`. Exact-byte final gates: Tier0 343/185 skipped SHA256 `fdd0c9a97c644792ac015b213e7e2331338f6214f6d26562aaab2700526d6a92`; Docker Tier1 78/450 deselected SHA256 `70cfba7c9b470696b4b8a7a19a1a0c406776b57353462df8053cb2a278fcf12a`; pinned 0.9.8 OK SHA256 `30f2e2b2cfc275a29d07b93afdde4c004a3309ea8e7d50df8887b660f6a32b0b`; focused Docker 3 SHA256 `5f3ca41944b6602c30cc64d8c8bb3d2821cf36237a781bd6eb676571d4465928`. Package SHA256 `92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff`. Private bundle manifest `394602e721d80f8f125d9dca15b51a5aef054e703d3382c1c3f8f5436cf61674`; isolated proof `434ecdc8efa8949a1b21bdbaaa8fff9884d1d3e41c1e299c41349311755d7ae1`; prefreeze receipt `dbdea28dd741e40aca096933b42a480497bd6078e9ded6e10cdc7cd1347cc3e8`; freeze receipt `1da551c1c6e9b53e59f6e665db5fce0f116c919fe9803f567135c827f1c263ed`; owner review packet `ebb2e97c0fe70de1df75e86b4010cea8eb2dcf6ce65851295e9d6df015486593`. Review inputs from primary main: legacy skill `2e20d8fc7794cf97e9bfd21eaa6e68c7d6514439c6e62dfb024723b8de41a32f`, legacy profile `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`; candidate managed guide `23ada4c2dff653dda3f6291c293f09dcc9c83d409f75404a665186e1dacfb563`, candidate profile/reviewer `49e2f48421902721b25751380a2173cd8a44ad1c6c4655e7a9a4a8e583983ce6`. No tracked changes after freeze. No episode review, Gate A, landing to main, user-global mutation, live stop/restart, UAT, compatibility removal, finalization, or cleanup. Awaiting owner exact configured review from primary main.
OWNER BLOCK — GENERATION A EXACT REVIEW — 2026-10-07
Frozen candidate `f2f3fcd25dbe3d96f05193261020d26bf79f1213`, tree `8b4fef1936766c7383a577317ac6d2436f4e72e5`, remote-synchronized and clean before/after review. Exact reviewer `sub-8964658b`, session `01a1155b-4d48-7694-aac8-d72ed9716da4`, returned model `openai-codex/gpt-6-astra`, explicit thinking `max`; one task delivery was definitively queued and never replayed. Primary-main source HEAD was exact `c24ba6c1e76585193d4f34f0b0b0233846780442`; legacy skill hash `2e20d8fc7794cf97e9bfd21eaa6e68c7d6514439c6e62dfb024723b8de41a32f`; committed legacy profile hash `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`. A pre-existing local profile overlay SHA256 `14f5115b66340cdb125ab323d170575e49fc0e7845f2bd0b925f98d95a326627` was privately backed up, exact committed bytes exposed for admission, and the overlay restored byte-for-byte/mode-exact immediately after delivery. Candidate pre/post status SHA256 is empty `e3b0c442...`.

Complete actionable BLOCK report preserved at `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/generation-a-owner-review-f2f3fcd/generation-a-f2f3fcd-review.md`, SHA256 `4ed03385fc1d54cdecdbbacf5ea720d00b70a9af10b99b1466f7592df50d95e1`; reviewer artifact original `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/sub-8964658b/generation-a-f2f3fcd-review.md`. Synthetic ordinary-failure evidence SHA256 `51419aff2b4cea108ff720e1207ed9cd9d47f82c106cd1983649e9f1746b38d1`; script SHA256 `a774081ef3364c23994c342527f04f9e7db815f4202aaeb8e0e0d08c138e3c89`. Reviewer made no subject changes and was deleted only after evidence preservation/post-state proof.

Owner accepts all five findings as concrete in-contract ordinary-operation defects, not scope expansion:
B1 coordinator preflight trusts declarations/configured build and misses live declared clients, supported Node entrypoints, observed status/build/socket failure/mismatch. Repair bounded observed role/process/status/build reconciliation before shutdown; no broad process supervisor.
B2 coordinator starts once then reads status once, racing ordinary asynchronous readiness after landing/apply. Add one short bounded read-only observation phase, never a second start/retry; fail on wrong/duplicate/exited/malformed/deadline.
B3 rollback accepts a syntactic `git revert` prefix and placeholders rather than the exact merge/post-merge topology. Validate one concrete resolvable history-preserving recipe against observed prelanding/candidate/integration parents, scratch-only or equivalently bounded; no reset/rebase/automatic compensation.
B4 bundle resolves supplied paths before lstat, allowing visible input/destination/root/managed-parent symlinks and writes through them. Check original bounded path components/leaves before following while preserving real isolated roots and macOS naming behavior; no descriptor-chain/race framework.
B5 restore classifies byte equality as complete and skips recorded mode/uid/gid repair, so apply can change unchanged bytes from 0600 to 0644 and restore falsely reports alreadyRestored. Include required ordinary metadata in restored-state equality and repair it or fail; retain fixed inventory and all-or-refuse unknown content.

Repair B1-B3 together in coordinator/fakes and B4-B5 together in bundle/isolated recovery proof. Regenerate only affected private manifest/proofs/readiness evidence and gates, then freeze/push a new immutable candidate. No Gate A/live/global mutation. Because tracked bytes change, the owner must run one fresh exact configured final review; the episode must not launch it.
GENERATION A OWNER REVIEW BLOCK / SECTION 31 REPAIR AUTHORIZED — 2026-10-07
Preserve immutable candidate `f2f3fcd25dbe3d96f05193261020d26bf79f1213` / tree `8b4fef1936766c7383a577317ac6d2436f4e72e5`, old freeze, and exact Astra/max BLOCK report SHA256 `4ed03385fc1d54cdecdbbacf5ea720d00b70a9af10b99b1466f7592df50d95e1` as history. Owner accepts all five findings as in-scope ordinary-operation defects. Next pass repairs only existing coordinator B1-B3 and bundle B4-B5 seams: exact declared-role/supported-entrypoint pre-shutdown observation and actual identity binding; one start plus bounded read-only readiness with truthful wrong/duplicate/exit/malformed/deadline failure; concrete resolvable history-preserving rollback recipe/topology proof; original supplied-path lstat/no-follow rejection for visible/dangling symlinks/nonregular fixed components without hostile-race machinery; metadata-complete mode/uid/gid restoration and replay semantics. Add exact report cases (live TUI, Node entrypoint, same-version wrong build, delayed readiness one-start, malformed status, placeholder/wrong rollback/mainline, visible/dangling links, unchanged-byte mode drift, metadata failure, replay). Regenerate only affected private manifest/proof/readiness evidence; complete all gates; freeze/push one new immutable candidate; report and stop. Owner runs one fresh exact configured review. No episode review, GateA, landing, main/global/live mutation, UAT, compatibility removal, finalization, or cleanup.
SECTION 31 REPAIR IMPLEMENTED / PRELIMINARY COMPLETE GATES PASS — 2026-10-07
Preserved blocked Generation A candidate f2f3fcd25dbe3d96f05193261020d26bf79f1213 / tree 8b4fef1936766c7383a577317ac6d2436f4e72e5 and exact Astra/max BLOCK report SHA256 4ed03385fc1d54cdecdbbacf5ea720d00b70a9af10b99b1466f7592df50d95e1. Coordinator B1-B3 and bundle B4-B5 repaired within existing seams. Three independent read-only re-audits PASS. Focused coordinator/bundle 77 passed; broader host 137 passed/54 skipped; Node 165; Docker-focused 3. Replacement private bundle manifest 527f88a8897f5f2abe92a5ad9745a17db869c5e3440c351f841908d01aebcce2; isolated bundle proof 5eb527a2f2b77edca7033c856794b6f9c53466a9dc0b0545bcbf85c7b3f69983; no user-global reread/mutation. Preliminary Tier0 404 passed/185 skipped log SHA256 87ad0c92bedf02822c8b6f5371e3618f3a4d4879615d7dfcc10f668ef3281575; Docker Tier1 78 passed/511 deselected log SHA256 91b9a54bb4c4a6466132032ff450ddfb709bf8e87a2e93e905550cf72d387e59. Evidence reconciled; next: stage exact bytes, prospective no-local-clone rollback proof, exact-byte full gates + pinned probe, teardown, freeze/push/report. No review, GateA, landing, main/global/live mutation, UAT, compatibility removal, finalization, or cleanup.
SECTION 31 EXACT-BYTE GATES PASS / REPLACEMENT FREEZE — 2026-10-07
Staged replacement tree `7fb098436e13296191ab64ef593c49550c70c162` with no unstaged diff. Exact staged patch SHA256 `0dacc9058c39bdd6008c1ac8fda6e51750ae94eba6b1c68b5fe90d74c32fc63c` (135,550 bytes). Three independent re-audits PASS. Exact-byte gates: focused host 137/54 skipped SHA256 `0dee0d4a3bac58a9943f1230efbbd3916cc3a9e4d908031cc15cc574d4cc4ec2`; Node 165 SHA256 `c7524bb7ac471646da8b4837fd2053f0f81440c251a2f4a8ce02a1ef5b0fcdf7`; Docker-focused 3 SHA256 `1ed98f74a169092c9d7021eb0d61ba354f29afc368911ed3748c3ec165577144`; Tier0 404/185 skipped SHA256 `0b8129b34dce92ceced555095914635c1eb506922582a5cb60a4afd93c47a9f1`; Docker Tier1 78/511 deselected SHA256 `2ab3635d144b7e271f4eb2f7d8bb18b53b2b50713c72ad70847a8eafa975c68d`; pinned Prime Agent 0.9.8 OK SHA256 `fc70ca38e622ef9f5798c4c03737b56120c5e2d0dab7cd7a442681e1980a11aa`, package `92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff`. Private replacement bundle manifest `527f88a8897f5f2abe92a5ad9745a17db869c5e3440c351f841908d01aebcce2`; bundle proof `5eb527a2f2b77edca7033c856794b6f9c53466a9dc0b0545bcbf85c7b3f69983`; prospective no-local-clone rollback proof `7bd9549d3d02c47e944d8e8834a264e163ddf8117c5998df52be00c943924360` resulting exact baseline tree `a9955483816af04a4c68468a8e2ce3d0d0d00a5d`; gate receipt `0917e27cb2766e72be91190962b9e4808893ee27fa72bcdaa81182a13c339c61`. Teardown/diff/remote main pass; old candidate/report preserved. Freeze begins now; no tracked post-freeze mutation. No renewed review, GateA, landing/main/global/live mutation, UAT, compatibility removal, finalization, or cleanup.
SECTION 31 IMMUTABLE REPLACEMENT CANDIDATE PUSHED — 2026-10-07
Candidate `ed42db9f20ce7a58689707b188e35028e31abf55` / tree `7fb098436e13296191ab64ef593c49550c70c162` / parent `f2f3fcd25dbe3d96f05193261020d26bf79f1213`; local/upstream/fetched origin/ls-remote equal and worktree clean. Preserve historical blocked candidate f2f3fcd25dbe3d96f05193261020d26bf79f1213 / tree 8b4fef1936766c7383a577317ac6d2436f4e72e5 and report SHA256 4ed03385fc1d54cdecdbbacf5ea720d00b70a9af10b99b1466f7592df50d95e1. Candidate patch SHA256 `0dacc9058c39bdd6008c1ac8fda6e51750ae94eba6b1c68b5fe90d74c32fc63c` (135,550 bytes); accepted-S3 combined patch `e4ffb18eb8e0dc43ed1dfba787187e00eed959808f856e151fd80fdc3f1b307b` (240,782 bytes). Exact rollback proof SHA256 `ec4b46bdcba40b7eeb57a6551ea1c39fae8f2bbd89f1855bae3d940a85894eb9`: revert ed42db9f20ce7a58689707b188e35028e31abf55, revert f2f3fcd25dbe3d96f05193261020d26bf79f1213, revert -m 2 46147ff887569101b7e64a8466cde5887c15cc31, fixed commit; isolated no-local clone produced accepted baseline tree a9955483816af04a4c68468a8e2ce3d0d0d00a5d and clean rollback commit. Gates: focused 137/54 skipped `0dee0d4a3bac58a9943f1230efbbd3916cc3a9e4d908031cc15cc574d4cc4ec2`; Node 165 `c7524bb7ac471646da8b4837fd2053f0f81440c251a2f4a8ce02a1ef5b0fcdf7`; Docker-focused 3 `1ed98f74a169092c9d7021eb0d61ba354f29afc368911ed3748c3ec165577144`; Tier0 404/185 skipped `0b8129b34dce92ceced555095914635c1eb506922582a5cb60a4afd93c47a9f1`; Docker Tier1 78/511 deselected `2ab3635d144b7e271f4eb2f7d8bb18b53b2b50713c72ad70847a8eafa975c68d`; pinned 0.9.8 OK `fc70ca38e622ef9f5798c4c03737b56120c5e2d0dab7cd7a442681e1980a11aa` package 92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff. Private bundle manifest `527f88a8897f5f2abe92a5ad9745a17db869c5e3440c351f841908d01aebcce2`; bundle proof `5eb527a2f2b77edca7033c856794b6f9c53466a9dc0b0545bcbf85c7b3f69983`; prospective topology proof `7bd9549d3d02c47e944d8e8834a264e163ddf8117c5998df52be00c943924360`; gate receipt `0917e27cb2766e72be91190962b9e4808893ee27fa72bcdaa81182a13c339c61`; freeze receipt `a2ce5fbc99e09acb0933a9bbf56918acf09b23b705b70523eb7c8f3becfa0afc`; renewed-review packet `4e69fe02af86d9980c31b98006489942fb346448f826d37a76453a4c7ee68fa4`. Three independent re-audits PASS. No tracked post-freeze mutation, renewed review, GateA, landing/main/global/live mutation, UAT, compatibility removal, finalization, or cleanup. Awaiting owner-admitted fresh exact configured review.
OWNER ACCEPT — GENERATION A REPLACEMENT FREEZE — 2026-10-07
Accepted exact candidate `ed42db9f20ce7a58689707b188e35028e31abf55`, tree `7fb098436e13296191ab64ef593c49550c70c162`, branch `episode/official-lean-compatibility-cleanup`. Local HEAD/upstream/fetched origin/ls-remote agree; pre/post review status SHA256 empty `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; no tracked post-freeze mutation.

Fresh exact reviewer `sub-63f3aefb`, session `01a1159f-a749-7600-8cfa-f4cdf57350aa`, public returned model `openai-codex/gpt-6-astra`, explicit admitted thinking request `max`. One immutable task packet was queued exactly once; one bounded factual path/identity clarification followed without changing/resending the packet. Primary-main HEAD was exact `c24ba6c1e76585193d4f34f0b0b0233846780442`; legacy skill/profile committed hashes matched `2e20d8fc...` / `d9f8b149...`. Pre-existing local profile overlay SHA256 `14f5115b...` was backed up, exact committed profile exposed for admission, and overlay restored byte/mode-exact immediately after delivery.

Reviewer PASS: no material finding remains in the approved trusted-local ordinary-failure contract; B1-B5 independently verified repaired. Complete report preserved at `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/generation-a-owner-review-ed42db9/generation-a-ed42db9-review.md`, SHA256 `cdde0a8c69f0d5f8663de764aa135d7a8930528d21dde016ca1fe2f3c3430517`; original `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/sub-63f3aefb/generation-a-ed42db9-review.md`. Independent verification artifact SHA256 `658ef4888a904eead1f43790e28c141a4af246ab8bf9a614edbcd7f8bd0e55ff`; scratch rollback result SHA256 `cea9489cf9742db42064330a0df47f011f9a52bd250652a612f54b4fe83fe91b`. Reviewer independently ran Tier 0 404/185 skipped, focused 81/41 skipped, bundle verify, exact rollback baseline reproduction, diff check; recorded Docker/native/probe hashes matched. Subject remained unchanged. Reviewer was deleted only after report preservation/post-state proof.

Owner accepts Slice 4 Generation A immutable candidate. This acceptance does not authorize Gate A. Exact operator authority remains required for one coordinator invocation covering checkpoint/quiescence, clean synchronized main fast-forward/push, user-global apply/check, shutdown/single restart, and ordered interim UAT. Primary main currently has three pre-existing local modifications (`.agents/skills/goals-and-heartbeats/SKILL.md`, `.beads/interactions.jsonl`, `.prime/agent/profiles/expert-reviewer.md`) and therefore does not yet satisfy Gate A clean-main preflight; preserve them and obtain operator handling/transaction authority rather than mutating them implicitly.
PRE-GATE-A LOCAL EDIT ORDERING — 2026-10-07
At operator request, three conventional commits were created locally but never pushed, then rewound before Gate A so Generation A can land first through the reviewed coordinator. Main is restored to exact `c24ba6c1e76585193d4f34f0b0b0233846780442` = `origin/main`; the three edits remain byte-exact as unstaged changes. Private backup: `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/pre-gate-a-local-edits-reorder`, manifest SHA256 `9c399564596dc7bb184e430120166f6bb7ec7daa68160643c6e34fbc34fafb39`. Files: goals-and-heartbeats guidance, Beads interaction history, and legacy expert profile wording. Do not include them in Gate A preflight source. Preserve privately/temporarily clear them for clean-main coordinator landing, then reconcile and commit after landing under separate post-transaction authority. The profile wording must be applied coherently to the new managed reviewer/profile copies and pinned hashes/tests, not committed as one-file parity drift.
GATE A AUTHORITY + ORDINARY UAT BASELINE — 2026-10-07
Operator explicitly authorized continuation and one Gate A coordinator invocation for exact accepted Generation A candidate `ed42db9f20ce7a58689707b188e35028e31abf55` / tree `7fb098436e13296191ab64ef593c49550c70c162`. Authority covers the reviewed Section 10 transaction only: checkpoint/quiescence; preserve and temporarily clear the three primary-main local edits for clean preflight; supported shutdown; exact fast-forward/push; primary-main user-global apply/check; one restart; ordered interim UAT; and practical known-state recovery within that one operation. It does not authorize S5, Generation B, final UAT acceptance, finalization, bookkeeping close, or physical cleanup. The owning model must not mutate or stop its own runtime; live execute remains external-terminal launched.

Designated ordinary saved conversation: `gate-a-ordinary-uat`, session `01a116b2-603f-741f-ae4e-8c30af5bdd4c`, active route at baseline `9c3596a52b38`, cwd `/Users/jlanders/code/prime-claw`, model `openai-codex/gpt-5.6-sol`. One harmless read-only VISION.md task completed successfully before restart. Baseline receipt `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/gate-a-ordinary-uat-baseline/receipt.json`, SHA256 `8c8c6784ea1b6dbd48cab3810c145c05d37764a3079334c27c3bb015cba432b4`. Primary HEAD/origin remain exact c24ba6c and only the three previously recorded local edits remain; no mutation from baseline task.
GATE A QUIESCENCE CHECKPOINT — 2026-10-07
Session `01a10774-0155-7316-a329-50ee5f7d17be` / `official-lean-compatibility-cleanup-episode` is saved and quiescent at immutable replacement candidate `ed42db9f20ce7a58689707b188e35028e31abf55` / tree `7fb098436e13296191ab64ef593c49550c70c162` on branch `episode/official-lean-compatibility-cleanup`, worktree `/Users/jlanders/code/prime-claw-official-lean-compatibility-cleanup-episode`. Local/upstream are synchronized and the worktree is clean. Active goal is complete; zero heartbeats, active subagents, or running Bash handles. All focused/full/Docker/pinned gates and test-resource teardown were completed before freeze; owner review packet was delivered. No restart blocker known. No new implementation or tests started during quiescence.
GATE A PREFLIGHT BLOCK — REAL PRIME AGENT 0.9.8 VERSION STREAM — 2026-10-07
Preparation stopped before any live mutation. Exact accepted candidate `ed42db9f20ce7a58689707b188e35028e31abf55` / tree `7fb098436e13296191ab64ef593c49550c70c162` coordinator SHA256 `2a97be525a1d8b8f074c322e20e32494fbf6fbec6904923516b4f37cc7d38cea` cannot pass `verify_executable` against the installed supported runtime. `/Users/jlanders/code/prime-agent/.worktrees/cwd-fix-v0.9.8-r1-source/prime-agent.sh --version` exits 0 and emits exact `0.9.8` to stderr with empty stdout; coordinator compares `result.stdout.strip()` only and stops `runtime entrypoint version mismatch`. Exact private diagnostic `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/gate-a-ed42db9/preflight-version-stream-block.json`, SHA256 `c0388aa8ede3912106afc3500370494bd37bdbc56880cc9114c91e8ed161be73`. Main remains clean c24ba6c = origin/main; episode remains clean/synchronized ed42db9; runtime PID 3107 remains current; no shutdown, landing, push, global apply, restart, or live checkpoint occurred.

Accepted in-scope repair: in the existing executable-verification seam, accept the exact expected single-line version from exactly one of stdout/stderr only when return code is zero and the other stream is empty. Fail nonzero, both populated, both empty, multiline/extra content, or mismatch. Add focused positive stdout/stderr and negative ambiguity/extra/mismatch/nonzero tests plus a real supported Prime Agent 0.9.8 probe proving the actual stream. Regenerate affected readiness/private bundle/config evidence, rerun required gates, freeze/push a successor candidate preserving ed42db9 as history, and stop for one fresh exact owner review. No Prime Agent patch, general output-normalization layer, live mutation, S5, UAT, or cleanup. The prepared ed42 config/state is invalidated and must never be executed.
GATE A PREFLIGHT VERSION-STREAM BLOCK / SECTION 32 AUTHORIZED — 2026-10-07
Preserve accepted ed42db9f20ce7a58689707b188e35028e31abf55 / tree 7fb098436e13296191ab64ef593c49550c70c162 and exact configured PASS as history. Gate A was explicitly authorized, but owner read-only preflight stopped before any mutation: supported Prime Agent 0.9.8 `/Users/jlanders/code/prime-agent/.worktrees/cwd-fix-v0.9.8-r1-source/prime-agent.sh --version` exits 0 with exact `0.9.8` on stderr and empty stdout, while coordinator checks stdout only. Preserve private diagnostic `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/gate-a-ed42db9/preflight-version-stream-block.json`, SHA256 c0388aa8ede3912106afc3500370494bd37bdbc56880cc9114c91e8ed161be73. Repair only executable-version verification: accept exact expected single-line version from exactly one stream on rc0, other empty; reject nonzero, both/none, extra/multiline, mismatch. Add exact fake matrix and real supported-wrapper stderr probe; update affected docs/traceability/private bundle-readiness-config evidence. Successor rollback chain must be [successor, ed42db9f20ce7a58689707b188e35028e31abf55, f2f3fcd25dbe3d96f05193261020d26bf79f1213], then merge 46147ff887569101b7e64a8466cde5887c15cc31 -m2, yielding c24ba6c/tree a995548 in isolation. Complete exact gates, freeze/push/report successor, stop for fresh exact owner review. Do not patch Prime Agent, generalize normalization, touch main/private backup/invalidated config/live/global/UAT/S5/compatibility/finalization/cleanup.
SECTION 32 IMPLEMENTED / PRELIMINARY GATES PASS — 2026-10-07
Narrow coordinator seam now uses rc-aware, timeout-bounded exact one-stream admission and requires raw `0.9.8\n`; no helper/normalizer or Prime Agent patch. Focused matrix and real wrapper test pass (100 seam tests); broader focused host 160/54 skipped SHA256 b4a74baea5465d7d47c5100719116dcb7aeaac40a2b3cd7826003c6abe51fc13; Node 165 SHA256 476fd5d0f7ccd8d0b258f64f35cc8a95b458242cc1a359664e975b6db88d8487; Docker-focused 3 SHA256 7c7fd090011b6cc6e11e9e571b09ff5b676bf5ae30118d615699cee36f45cc9a. Two read-only audits completed and tightening findings incorporated. New private source topology SHA256 a9b6cabeaa7c326371648a16e75879510b098ea86d2b14017b327950eab8fb9e, manifest ff9a321274b8953f0a1b97bddee9e2f4b7f156990f1370c762c93982ca35ad68, isolated bundle proof 4725e44be01966e0127b0c2c298343e6a7feec3cff80f0a26c1a8ecd80d1ba5f; Section31 bundle and Gate A diagnostic unchanged. Next: exact stage/prospective chain [successor,ed42,f2f3,merge -m2], final complete gates, freeze/push, successor-bound proof-only config/receipts, owner report, stop. No invalidated config/live/global/main/UAT/S5/cleanup action.
SECTION 32 EXACT-BYTE GATES PASS / SUCCESSOR FREEZE — 2026-10-07
Staged tree `a4667c0047a9ea6f3379790d024c3df44754f00c`, patch SHA256 `33f9009aea9ceca82d64e9212aa8ae25f8a9dd67e87b391e4c68c9a1b9ddf54c` (33,676 bytes), no unstaged diff. Exact gates: focused host 160/54 skipped `f26592ee6e3941fc0f649e7c4ca6c4ed3b96e953c31485e9ae4fb81af1607525`; Node 165 `59aa00b9e4b9ec7b6a1e529557fc00e23c2b36b680d3efbf439854e70ed2342b`; Docker-focused 3 `28d2b7121de8c78676b049ed780f2fd88920fa525bc2b1823f2fdfe2c06660f9`; Tier0 427/185 skipped `86f1f7aa2bd02c65c4533d910dd0ad9c42e6589023f6e3f54f42e138ccaa0262`; Docker Tier1 78/534 deselected `521e7e1b3c3e2aed43863610f140a330176739f581f25d08c4f4237a2b6d4d3b`; pinned 0.9.8 OK `5001c47a11f48aacacf378a9dc5f916aea3a1dff33b837bef94cc92a652c32aa`, package 92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff. Private manifest `ff9a321274b8953f0a1b97bddee9e2f4b7f156990f1370c762c93982ca35ad68`; bundle proof `4725e44be01966e0127b0c2c298343e6a7feec3cff80f0a26c1a8ecd80d1ba5f`; real-version proof `9c5b692c8f933f5f92e0755ce2df2cd5aefa1ec7f2693fb1bd1aed57f9451519`; prospective full-chain proof `bffe5ea1d0494c4a2e94610aee2ee6fd26ccdcaf7b909f70c27a5a78928a2b5f` yielding baseline tree a9955483816af04a4c68468a8e2ce3d0d0d00a5d; gate receipt `7777c6591424da9fbd518710b225cd8312284d98e51343786d4fe4e49dd5d4f8`. Two read-only audits PASS. Preserve ed42/PASS and diagnostic `c0388aa8ede3912106afc3500370494bd37bdbc56880cc9114c91e8ed161be73`. Teardown/diff/remote pass. Freeze begins; no tracked post-freeze mutation. No invalidated config/live/global/main/UAT/S5/cleanup action.
SECTION 32 IMMUTABLE SUCCESSOR PUSHED — 2026-10-07
Candidate `47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4` / tree `a4667c0047a9ea6f3379790d024c3df44754f00c` / parent ed42db9f20ce7a58689707b188e35028e31abf55; local/upstream/fetched origin/ls-remote equal and clean. Preserve ed42/tree 7fb0984 exact configured PASS and Gate A preflight diagnostic `c0388aa8ede3912106afc3500370494bd37bdbc56880cc9114c91e8ed161be73`. Candidate patch `33f9009aea9ceca82d64e9212aa8ae25f8a9dd67e87b391e4c68c9a1b9ddf54c` (33,676 bytes); accepted-S3 combined `120a27a7123db25ce5806d51fcc536d721af42ad08dfd94e75637288b05d72c2` (258,977 bytes). Exact rollback proof `e23f3c89127a3e87b4e29784b3ff0c2abf8fb2ba29a9a20255d5b915d12a5ad2` reverts successor, ed42, f2f3, then merge 46147ff -m2 and produces baseline tree a995548. Proof-only successor coordinator config `de3d191dd2dfb90bbe7500451386ed8f5b24ccb6876dea90ddd5b9d737a8b1d9` grants no execute authority. Exact gates: focused 160/54 skipped `f26592ee6e3941fc0f649e7c4ca6c4ed3b96e953c31485e9ae4fb81af1607525`; Node 165 `59aa00b9e4b9ec7b6a1e529557fc00e23c2b36b680d3efbf439854e70ed2342b`; Docker-focused 3 `28d2b7121de8c78676b049ed780f2fd88920fa525bc2b1823f2fdfe2c06660f9`; Tier0 427/185 skipped `86f1f7aa2bd02c65c4533d910dd0ad9c42e6589023f6e3f54f42e138ccaa0262`; Docker Tier1 78/534 deselected `521e7e1b3c3e2aed43863610f140a330176739f581f25d08c4f4237a2b6d4d3b`; pinned 0.9.8 OK `5001c47a11f48aacacf378a9dc5f916aea3a1dff33b837bef94cc92a652c32aa`. Private manifest `ff9a321274b8953f0a1b97bddee9e2f4b7f156990f1370c762c93982ca35ad68`; bundle proof `4725e44be01966e0127b0c2c298343e6a7feec3cff80f0a26c1a8ecd80d1ba5f`; real-version proof `9c5b692c8f933f5f92e0755ce2df2cd5aefa1ec7f2693fb1bd1aed57f9451519`; prospective topology `bffe5ea1d0494c4a2e94610aee2ee6fd26ccdcaf7b909f70c27a5a78928a2b5f`; gate receipt `7777c6591424da9fbd518710b225cd8312284d98e51343786d4fe4e49dd5d4f8`; freeze receipt `357e9c82d58f4f9dc61133f0854ca0a70b49593e24a2bd77419af595c9f9a633`; owner packet `816d99d4965a99708470e4f0898f40d957c8cd6631d420c7dcd9fc30ea106a67`. No tracked post-freeze mutation, invalidated config execution, Gate A/live/global/main/UAT/S5/compatibility/finalization/cleanup. Awaiting fresh exact owner review.
OWNER BLOCK + STOP-LOSS REASSESSMENT — SUCCESSOR 47D2D49 — 2026-10-07
Fresh exact Astra/max reviewer `sub-bedef000`, session `01a116d4-1d81-758e-8ba8-bf6fc7bbc16e`, returned BLOCK on immutable `47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4` / tree `a4667c0047a9ea6f3379790d024c3df44754f00c`. Complete report preserved `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/generation-a-owner-review-47d2d49/generation-a-47d2d49-review.md`, SHA256 `039a66d0ad404d5592913d9476dfef77c6e309dbc16b5dd9a23e3593f6008262`. Independent real-LocalRunner matrix SHA256 `bf8d9d182c028b77608745237aa286cf416aaf704a35bbd26ea94a0a77a337de`. Pre/post subject status empty and HEAD/tree/upstream/ls-remote unchanged; primary main remains clean c24ba6c = origin/main. Reviewer deleted only after evidence preservation.

Finding accepted as an in-scope contract/evidence defect: `LocalRunner.run(... text=True ...)` performs universal-newline conversion before `verify_executable`, so raw CRLF and bare CR become LF and are falsely admitted despite Section 32 explicitly claiming raw LF-only rejection. Recording fakes bypass the production adapter. Supported 0.9.8 stderr-LF path is operational and all B1-B5/bridge/bundle/authority/rollback work remains retained.

Two-cycle stop-loss reassessment: authorize exactly one final narrow repair, not another broad hardening cycle. Preserve raw stdout/stderr bytes only for the executable-version observation seam (or equivalently lossless version-specific capture); keep 10s timeout, rc0, one populated raw stream equal to exact configured UTF-8 version plus one LF, other raw stream empty. Do not alter general `LocalRunner` text contracts used by Git/status/process/bundle commands, normalize/strip/split/regex/concatenate, patch Prime Agent, or expand transaction/process scope. Add production-adapter positives for stdout/stderr LF and negatives for CRLF/bare-CR on both streams plus all existing failures/replay/timeout; update exact evidence. Freeze successor preserving 47d/ed42/f2f3 history and rollback chain. One final fresh exact review is allowed, focused on this delta and retained invariants. No Gate A authority transports and no live mutation.
SECTION 33 FINAL STOP-LOSS REPAIR AUTHORIZED — 2026-10-07
Fresh exact Astra/max review BLOCKED immutable 47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4 / tree a4667c0047a9ea6f3379790d024c3df44754f00c. Preserve owner report SHA256 039a66d0ad404d5592913d9476dfef77c6e309dbc16b5dd9a23e3593f6008262 and reviewer real-LocalRunner matrix SHA256 bf8d9d182c028b77608745237aa286cf416aaf704a35bbd26ea94a0a77a337de. Root cause: text=True universal-newline normalization converts raw CRLF/bare CR to LF before verify_executable. Owner stop-loss authorizes exactly one final narrow repair: version-specific lossless raw-byte capture with existing 10s bound; general LocalRunner.run text contract unchanged. Admit only rc0, exactly one raw stream == UTF-8 expected version + one LF, other raw stream empty. Reject nonzero, both/empty, no-LF, CRLF, bare CR, whitespace, extra/blank/multiple lines, mismatch, timeout, undecodable/non-exact bytes. No strip/splitlines/CR removal/concatenation/regex/general normalizer/Prime Agent patch/scope broadening. Exercise actual adapter LF positives and CRLF/bare-CR negatives both streams, real 0.9.8 raw stderr, downstream absence, first-call/replay/timeout. Final rollback chain [successor,47d2d49,ed42db9,f2f3fcd], merge 46147ff -m2 -> c24/tree a995548. Update affected docs/traceability/private proofs/gates, freeze/push, stop for one allowed final review. No main/private-overlay/old-config/live/global/GateA/UAT/S5/finalization/cleanup.
SECTION 33 IMPLEMENTATION / AUDIT CHECKPOINT — 2026-10-08
Version-only raw-byte LocalRunner seam implemented; general text runner unchanged. Production adapter covers LF/CRLF/bare-CR both streams, ambiguity/empty/no-LF/whitespace/extra/mismatch/non-UTF8/nonzero, downstream absence, first/replay, timeout/reaping, and supported 0.9.8 raw stderr. Post-audit focused suite 120 PASS, log 42e94e5c1bef9944808d63a379940c889954cf08284b60adac72a27f27afc371. Byte audit PASS; evidence findings incorporated. Private source topology 35a2307c7edad520c6c9fb0b47d37eaaf4bd78e0cfe34b9f8bae92fd8bf1c487; bundle f48241bbc2e9019bfc8606d63d526e2fdf72b17cd538d93bede6d54ee4556f93; bundle proof afd6eb29f86093a7efb8e50d7872a3f6639a8affd8ca4ce3229f34e7c51f7232; raw proof 37fd6704ac622c7b7dfa1e8b516ac6380709023a42695934fe16430a2e18c3c2. No GateA/live/global/main/old-config/UAT/S5/finalization/cleanup.
BLOCKED — Section 33 Docker validation infrastructure unavailable. Code/audits/focused 120/host 180+54 skipped/Node 165 pass. Docker-focused fixture failed before tests because docker info timed out after 30s. A second health probe hung. Non-destructive `docker desktop restart` failed with context deadline exceeded and backend/build/virtualization processes still running. Force-killing shared Docker processes is not authorized. No GateA/live/global/main/old-config/UAT/S5/finalization/cleanup action. Unblock: operator restores Docker Desktop externally and confirms docker info succeeds; move plan/spec from .ralph/plans/blocked back to active and rerun only failed Docker-focused gate.
SECTION 33 UNBLOCKED — owner Conversation explicitly hard-restarted Docker Desktop; independent `docker info --format {{json .ServerVersion}}` exited 0 with `"29.6.2"`. Active spec/plan restored from `.ralph/plans/blocked/`. Resume only the exact failed Docker-focused preliminary gate, then existing bounded freeze workflow. No new scope or Gate A/live authority.
BLOCKED — Section 33 exact Docker Tier1 infrastructure failure after worker interruption. Completed log SHA256 bf7fd91dfb248f82ec6ad1c52f10b3a36292acaff08090e1925baea357e42332: 71 passed, 554 deselected, 5 failed, 3 errors in 828.12s; all shown failures/errors are bounded docker exec timeouts after Docker Desktop recovery, not assertion failures. No matching host pytest remains. Exact container ID from log is 22c33944671aade2aabb184c8a17d0fcb890dfc9489ff315e78721d4ed9efe71 and share is .test-results/share-51153-1791426469-22drfs28, but bounded 15s docker info, exact inspect, and ps all timed out, so ownership/daemon health cannot be safely reconciled and neither resource was removed. Per recovery authority, no Docker restart and no duplicate Tier1. Staged tree 44fe596d885728847bf7a8ec0429a2261cd9473c preserved; Tier0 PASS preserved. Unblock: owner restores Docker health, then exact inspect must prove the leftover belongs to this run before removing only it/share and rerunning Tier1 once.
Docker health restored after second owner-authorized hard restart. Exact exited run-owned container 22c33944671aade2aabb184c8a17d0fcb890dfc9489ff315e78721d4ed9efe71 inspected: name prime-claw-tier1-session-51153-1791426469-22drfs28, read-only worktree mount, exact share mount .test-results/share-51153-1791426469-22drfs28. Bounded docker rm succeeded; bounded inspect proves absence; bounded health rc0 version 29.6.2; exact empty share removed. Starting the one authorized exact Tier1 rerun; old failure log preserved.
BLOCKED — the single authorized exact Docker Tier1 rerun failed during fixture setup before any test ran. `docker run` emitted exact container f250390b0add4ad3408f4a81e1bf01d78f1416ce2b0d4ef33c2c02b8c660faa5 but did not return within 60s; 78 setup errors, 554 deselected, log SHA256 fae21d6cd71fd2bdd437773a12e4d287092785b0ed3c8cf78401a14417b6d0ec. Bounded inspect proved state=created/running=false, name prime-claw-tier1-session-38913-1791428303-lx2e3ngw, exact read-only worktree and share mounts. Bounded rm succeeded, inspect proves absence, docker info remains rc0 version 29.6.2, and the exact share is absent. No further rerun is authorized. Original failure log preserved at SHA256 bf7fd91dfb248f82ec6ad1c52f10b3a36292acaff08090e1925baea357e42332. Staged successor tree 44fe596d885728847bf7a8ec0429a2261cd9473c and passed Tier0 remain unchanged. Owner decision required for another Docker Tier1 attempt or alternate gate disposition; no Gate A/new scope.
OWNER DISPOSITION PROVED — no third Docker Tier1. Machine inventory SHA256 2245332dd887f0cd9e7b52b8db03f14c408608fa92206b7cae4fdfb510ffae79; 78 selected container IDs exact ordered match; 45 bounded plugin/container/Docker/installer/selected-test files byte-identical to accepted predecessor 47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4; forbidden delta empty. Predecessor exact Tier1 PASS 78 passed, log SHA256 521e7e1b3c3e2aed43863610f140a330176739f581f25d08c4f4237a2b6d4d3b. Current logs preserved and explicitly infrastructure-only, not PASS: bf7fd91d... (71 pass then docker exec timeouts), fae21d6c... (docker-run setup timeout before tests). Staged tree 44fe596d885728847bf7a8ec0429a2261cd9473c unchanged; proceeding to freeze.
SECTION 33 IMMUTABLE SUCCESSOR FROZEN AND PUSHED — candidate f2e98e2d6e8bc51e9172b8b697735215917b6513, tree 44fe596d885728847bf7a8ec0429a2261cd9473c, parent 47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4; local/upstream/fetched-origin/ls-remote exact and clean. Owner Docker disposition inventory SHA256 2245332dd887f0cd9e7b52b8db03f14c408608fa92206b7cae4fdfb510ffae79: 78 selected IDs exact; 45 bounded surface files byte-identical; forbidden delta empty; current Docker logs are explicitly infrastructure failures, not candidate PASS. Gate receipt 36c0b8a0842ed9f34888d90d480f9a503ffed52823eb45548a866f6fe4fb58f8; exact rollback proof fd1e5cd8d7b10a2bb7de0435c05dd2865258d78eaf580cf45f046a14507fbf70; freeze receipt 91848e405c2b89554f4248b81a1c5d228896f0d2a8cd7cfa1f21b10b2325e4d6; owner packet 2e6eac92d495f04a4203613a2401a1e09e1b138596b0091000ead91011df8fdf. Awaiting one final exact owner review which must explicitly assess the Tier1 disposition. No Gate A/live action/finalization.
GATE A BRIDGE UAT ACCEPTED — owner guide/identity worked; exact episode resumed cleanly without injected legacy or retired work-control packages; saved ordinary session completed only harmless read-only VISION.md task without mutation. Next execute authority is the smallest practical Slice 5 only: isolated exact legacy compatibility removal/known-state restore path plus removal of operator-rejected managed-directory unexpected-entry purity gates from apply/check and their direct tests. No cache exceptions, new integrity machinery, or generalized defenses. Retain expected-file comparisons, managed package hash/import validation, role generation/lock checks, and ordinary safety. Do not begin Slice 6 or host final-mode apply/Gate B/finalization/physical cleanup. Report one reviewable vertical slice.
SLICE 5 IMPLEMENTED — one bounded reviewable vertical slice. Added isolated final-mode exact legacy APPEND removal plus fixed-inventory known-state restore to accepted bridge; tracked role-protocol.json remains bridge and no host final-mode apply/Gate B/Slice 6/finalization/cleanup occurred. Removed only operator-rejected unexpected-entry purity scans from apply/check and their direct tests; retained expected-file comparisons, EXPERT package hash/import validation, generation/lock checks, obsolete-file checks, and ordinary safety. Evidence: docs/evidence/official-lean-role-protocol/2026-10-08-slice-5-practical-legacy-removal.md. Final focused Docker manager 11 passed SHA256 a82c2bb251c0425b15d3bc1353809f26955b0393acb2d9f6822b2dafd601195d; complete Tier0 447 passed/182 skipped SHA256 fee608fb20a0915f35400397dd0338d5803013cca9c72ac5b7bad7f71b4600c7; complete Docker Tier1 75 passed/554 deselected SHA256 7bdb894011c18fb85558233a062d15491572ea738c84360e008bc89682305195; pinned 0.9.8 probe PASS/container destroyed SHA256 1c94d584518c8a2786be0c9fcfdbca7220cc1a0809d50d3de3bd05a371b076e4; independent exact diff review PASS. Ready for owner review; do not begin Slice 6.
SLICE 5 COMMITTED AND PUSHED — commit 98ed8d14e028622d07a120fbd4af730bd4171e38, tree 2b83d87a5adfab4c3f6e274b3149df54c588631e, parent f2e98e2d6e8bc51e9172b8b697735215917b6513. Local/upstream/fetched origin/ls-remote all exact and worktree clean. Staged patch SHA256 242302c7965f14213874d5357617a7d1c49f4073f1efc147c266c4017eb042b2. Gate/evidence hashes remain: focused manager a82c2bb251c0425b15d3bc1353809f26955b0393acb2d9f6822b2dafd601195d; final Tier0 fee608fb20a0915f35400397dd0338d5803013cca9c72ac5b7bad7f71b4600c7; complete Tier1 7bdb894011c18fb85558233a062d15491572ea738c84360e008bc89682305195; pinned probe 1c94d584518c8a2786be0c9fcfdbca7220cc1a0809d50d3de3bd05a371b076e4. Await owner review. Slice 6, host final-mode apply, Gate B, finalization, and physical cleanup remain unauthorized.
SLICE 5 ACCEPTED — exact candidate 98ed8d14e028622d07a120fbd4af730bd4171e38, tree 2b83d87a5adfab4c3f6e274b3149df54c588631e. Owner verified exact diff, clean synchronized push state, retained log hashes, Docker/Tier0/probe evidence, and independent PASS. Next execute authority is Slice 6 only: first perform the required fresh foreign-worktree/session audit, then remove remaining legacy compatibility resources and reconcile the final source tree as one minimal reviewable vertical slice. No replacement frameworks, generalized integrity machinery, or new defensive scope. Do not apply final mode to host, run Gate B, begin Slice 7, archive/finalize, merge, or physically clean resources.
SLICE 6 IMPLEMENTATION CHECKPOINT — 2026-10-08
Fresh foreign-consumer audit PASS: project-wide-testing clean at 5bace57e63e51bbfc034fc2e665863b74649a218 with 40 saved sessions/zero active-resident-working; phase3a clean at 2b63479e49dcbadbf4e10e9845bc7e9d58bcdb1d with 6 saved sessions/zero active-resident-working. Final source now removes legacy APPEND policy/append-only manager, project forwarding skill/link, standalone reviewer profile, and append-only probes; final manager requires owned bridge state, current managed owner/EPISODE paths reject retired prompt shape, historical replay filters remain. Focused Docker 55 PASS SHA256 1477fa70fa7606946f3b8aa1b55bbae080eb660f460cfb9325189133494b1672; complete Tier0 442 PASS/177 skipped SHA256 512c7547b7838f788418fe754999a70201078b02477c30ddda3cf08c9408702c; complete Docker Tier1 70 PASS/549 deselected SHA256 1fde48071ac052747a07ba0fc8dbf8113f52b2365c99bde3c5fb676412d4206c; pinned 0.9.8 probe PASS SHA256 f55a48281bd3d4a75b116704974aa7ebc4397650fcf27dbb3aded8e5eb04c57b. Initial independent review BLOCKED only stale operator guidance and unfinished evidence placeholders; both are repaired and exact remediation review is next. No host final-mode apply/Gate B/Slice7/finalization/merge/physical cleanup.
SLICE 6 FINAL REVIEW SETTLED — exact staged patch SHA256 0a911c9e30ad8d485c338519716f8e72c57fbf6c422f97357be48942789e4a91. Initial review BLOCK findings (stale direct/fresh-root Gate B guidance and evidence placeholders) were repaired. Exact remediation review PASS report SHA256 b7ec978f1d142b99c54d9e0cc67c42f8ecce01391a907c96773ab567cfea1858; final record-settlement review PASS report SHA256 bd3a02ce21831ba8425e7a5611e608e827cb3d2cbb481b3b00050783093b24b3. Final exact gates: focused Docker 55 PASS/8 deselected SHA256 1477fa70fa7606946f3b8aa1b55bbae080eb660f460cfb9325189133494b1672; Tier0 442 PASS/177 skipped SHA256 ae1e5ad19548d24baa9ed24b3d482560f6d07fe09a02c3065e3fcd00b2112172; complete Docker Tier1 70 PASS/549 deselected SHA256 1fde48071ac052747a07ba0fc8dbf8113f52b2365c99bde3c5fb676412d4206c; pinned Prime Agent 0.9.8 probe PASS SHA256 f55a48281bd3d4a75b116704974aa7ebc4397650fcf27dbb3aded8e5eb04c57b; affected target-help container checks 2 PASS SHA256 be9b9db1398914f62f7341557fd76124f0c9266fa8f2a5ddfcb8e177531221d9. Ready to commit/push the one Slice 6 candidate. No host final-mode apply/Gate B/Slice7/finalization/merge/physical cleanup.
SLICE 6 COMMITTED AND PUSHED — candidate 0e96838d430049980fa9ab2f6f8fc2762f2c127c, tree c8474abac9ba25da740c0beae858223aee4c8b17, parent 98ed8d14e028622d07a120fbd4af730bd4171e38. Exact committed binary diff SHA256 0a911c9e30ad8d485c338519716f8e72c57fbf6c422f97357be48942789e4a91; identical to settlement-reviewed staged patch. Local HEAD/upstream/fetched origin/origin tracking/ls-remote all equal; worktree clean; no dangling symlink. Final gates: focused Docker 55 PASS/8 deselected SHA256 1477fa70fa7606946f3b8aa1b55bbae080eb660f460cfb9325189133494b1672; Tier0 442 PASS/177 skipped SHA256 ae1e5ad19548d24baa9ed24b3d482560f6d07fe09a02c3065e3fcd00b2112172; Docker Tier1 70 PASS/549 deselected SHA256 1fde48071ac052747a07ba0fc8dbf8113f52b2365c99bde3c5fb676412d4206c; pinned 0.9.8 probe PASS SHA256 f55a48281bd3d4a75b116704974aa7ebc4397650fcf27dbb3aded8e5eb04c57b; remediation review PASS SHA256 b7ec978f1d142b99c54d9e0cc67c42f8ecce01391a907c96773ab567cfea1858; settlement review PASS SHA256 bd3a02ce21831ba8425e7a5611e608e827cb3d2cbb481b3b00050783093b24b3. Await owner review. Host final-mode apply, Gate B, Slice7, finalization, merge, and physical cleanup remain unauthorized.
SLICE 6 OWNER-REQUESTED REVISION — candidate 0e96838d430049980fa9ab2f6f8fc2762f2c127c / tree c8474abac9ba25da740c0beae858223aee4c8b17 is the immutable revision baseline, not accepted final. One omission only: the preserved pre-landing operator edit to deleted `.prime/agent/profiles/expert-reviewer.md` required semantic reconciliation before deletion. Migrate its intent into the managed official reviewer guidance: provide repair intent and useful general direction without wasting tokens prescribing exact code changes; retain structured PASS/BLOCK and actionable blocking findings suitable for a strong one-pass repair. Do not restore/add reviewer authority. Update only direct tests/hash expectations/traceability/Slice6 evidence, run proportionate focused checks, commit/push one successor, report owner. No broader Slice6, Slice7, host final mode, GateB, archive/finalization, merge, or cleanup.
SLICE 6 REVIEWER-GUIDANCE OMISSION IMPLEMENTED — immutable baseline 0e96838d430049980fa9ab2f6f8fc2762f2c127c. Managed reviewer now asks for one actionable repair direction with repair intent/useful general guidance and explicitly avoids spending tokens prescribing exact code changes; structured verdict/report and actionable BLOCK remediation remain. Standalone profile remains absent and managed source remains sole authority. Reviewer SHA256 f737bb48bc5179fa2613e1fbb87c24bce0010ec3f69f31907d5bfa02d2b718f3; package SHA256 13f1871531a51ef480be518148856320fcada33667216bf6e49a07e62fe5873b. Focused Docker 40 passed/31 skipped, log SHA256 ff1b711b48935f19ac42134888ecbf3eb57f4edc417399556f1697d56feb655b; pinned Prime Agent 0.9.8 Tier1 apply/check/registration probe PASS, container destroyed, log SHA256 7259b6f8d19bddb32e1ff940bd0458b14e98aa08496d097f7f7b85d69d887730. Only 7 direct source/test/hash-doc/traceability/evidence files changed. Await exact staged-diff review before commit/push. No host apply/GateB/Slice7/archive/finalization/merge/cleanup.
SLICE 6 REVIEWER-GUIDANCE SUCCESSOR REVIEW PASS — exact staged binary diff SHA256 ff2902aa2e1160db39d9b473316da897e5ba00ae5969988d0297f855124b878a from baseline 0e96838d430049980fa9ab2f6f8fc2762f2c127c. Independent read-only review PASS report SHA256 01350ebb9b8d3424adecf49af02500fdf8e779217b1c819f62bd7146ec39e5ad; no findings. Reviewer SHA256 f737bb48bc5179fa2613e1fbb87c24bce0010ec3f69f31907d5bfa02d2b718f3; package SHA256 13f1871531a51ef480be518148856320fcada33667216bf6e49a07e62fe5873b. Focused Docker 40 passed/31 skipped SHA256 ff1b711b48935f19ac42134888ecbf3eb57f4edc417399556f1697d56feb655b; pinned 0.9.8 Tier1 probe PASS/container destroyed SHA256 7259b6f8d19bddb32e1ff940bd0458b14e98aa08496d097f7f7b85d69d887730. Seven direct files only; no unstaged tracked diff; diff check passes. Ready for one commit/push. No host apply/GateB/Slice7/archive/finalization/merge/cleanup.
SLICE 6 REVIEWER-GUIDANCE SUCCESSOR COMMITTED/PUSHED — 64bbee26c363c87ef85446da707900439c869620, tree d9e9ba451cfcc2426ad200d8e05ed7e086f9abe1, parent 0e96838d430049980fa9ab2f6f8fc2762f2c127c. Exact committed diff SHA256 ff2902aa2e1160db39d9b473316da897e5ba00ae5969988d0297f855124b878a, identical to independently reviewed staged patch. Local/upstream/FETCH_HEAD/origin/ls-remote all equal; worktree clean; deleted standalone profile absent; no dangling symlink. Reviewer SHA256 f737bb48bc5179fa2613e1fbb87c24bce0010ec3f69f31907d5bfa02d2b718f3; package SHA256 13f1871531a51ef480be518148856320fcada33667216bf6e49a07e62fe5873b. Focused Docker 40 passed/31 skipped SHA256 ff1b711b48935f19ac42134888ecbf3eb57f4edc417399556f1697d56feb655b; pinned 0.9.8 Tier1 probe PASS/container destroyed SHA256 7259b6f8d19bddb32e1ff940bd0458b14e98aa08496d097f7f7b85d69d887730; independent PASS report SHA256 01350ebb9b8d3424adecf49af02500fdf8e779217b1c819f62bd7146ec39e5ad. Await owner review. No host apply/GateB/Slice7/archive/finalization/merge/cleanup.
REVISED SLICE 6 ACCEPTED / FINAL-CANDIDATE AUTHORITY — accepted 64bbee26c363c87ef85446da707900439c869620, tree d9e9ba451cfcc2426ad200d8e05ed7e086f9abe1. Before freeze, reconcile exactly two preserved pre-landing files from /Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/gate-a-f2e98e2/prelanding-local-edits: goals-and-heartbeats source SHA256 6c9daca98cf818a784334493190f2c4ea17218ffb61e52b52919105178a6aaa1 (only added no-goal-budget/unbounded-token intent versus baseline SHA256 1aa4f6391ceb96800208a0dd24aa20890fc06ef67b6a08f1afdb8b05977a7783); interactions preserved 30,963 bytes/105 records SHA256 d3e5956f184694018426be8993452300401be361bd9ef6762018e39d8ab84a70, with baseline exact 29,530-byte/99-record prefix SHA256 05f185840bda2ae7a8901796da4b19aa5b055183fdcb9b9ba5ee905d5283f8fd and exact six-record/1,433-byte suffix SHA256 3f1935e989dfb08f7635a1ebc53afd2fd42ac5ec368646881350f5e64720a5ac. Preserve interactions append-only/losslessly; if destination advances, retain it and append only exact missing preserved records. Then archive finished active spec/plan into .ralph/plans/archive/official-lean-compatibility-cleanup/ and update archive README before freeze; keep bead open and do not finalize bookkeeping. Perform only approved final preparation/freeze/exact gates/official review and report one immutable candidate. No merge, host final apply, live GateB, restart, finalization, or cleanup.
FINAL CANDIDATE PRE-FREEZE READY — baseline revised S6 64bbee26c363c87ef85446da707900439c869620, merged latest main via 41b94b5bad3a4cc6a205ecac7e0527cce78cad3d (parents 64bbee26c363c87ef85446da707900439c869620 7bbaebf959391bc8488fad4751c245f33f4e7f6c). Bounded tracked patch SHA256 f9a5e7084695b70912b61a4cc50d97909b0c55d26a16fb0903f86945a0e040fd, prospective tree f12e82184e0a63bcb1e970d4fd523c916b7a9bf4. Goals source reconciled 6c9daca98cf818a784334493190f2c4ea17218ffb61e52b52919105178a6aaa1; interactions existing 100 records preserved plus exact six-record suffix, result SHA256 86f65e44d6a12fc0e06c0c7fc3fabb17d0cf01e3bbbf88df7db6ea6d2e219fe7; active spec/plan archived with hashes 305f8b69fc881fa25fdcabdeace4688e13787651270f843799f6f8471d30c012/33437aa648a0fc6b788db053edc216c543e3cdfa9d16944e978e5dbf21e6a325. Paired archive-path official review compatibility focused Docker 48 passed/31 skipped SHA256 bca0160d0630a3e509bf9c279583f0a08eca1c8f6576d7b0cf887ec48c786443; managed reviewer dcd02e81e7e0656a3d7eb89ccfa78bd8b24a8492de012122f82b17b7aec50a05; package 99f33740c1d3a32670790deb91cca9073ce7bb4833109588dbd7565cdafeccdf. Private Generation B revision-2 bundle manifest e1d5958f3833a9856c272691961b158973924783ab1122cbe0b511d51b00892a; exact metadata restore/unknown refusal proof 841c3930d39ca4ea4cd437adbd1bdca3a13a9c3d3cf6773017508c627afa5881; prospective source rollback to bridge tree 44fe596d885728847bf7a8ec0429a2261cd9473c proof 356ea6a676f99b04fcea7281131dfdf4717aa9aaef05f14e28eec64e593a75da; foreign audit f86e05145c1509a29ca0c18367a29756f2a63b9435def6e4271789e6edd2e3b3. No host apply/GateB/restart/finalization/cleanup. Next: immutable commit/push, exact gates, exact official owner review.
FINAL CANDIDATE BLOCKED — immutable candidate 517624238989a4f4f825153c87ba1d24f86a2b3d, tree f12e82184e0a63bcb1e970d4fd523c916b7a9bf4. Exact source rollback PASS (private proof SHA256 1a8b5d6d70638e129fd750b0795c6ce3114a7672f7c5e1f4d656ab015ee0cc53); focused Docker PASS 67 passed/33 skipped log SHA256 7d030acb3c11722e14b7884133b0500070597f7060a81e40a1f7e907b3c10029. Complete Tier 0 BLOCK: 446 passed/177 skipped/1 failed, log SHA256 af91b73e994f8b7d589bf6189b240759f690f4c0f2a08ed494b16f1d7d35dab7. Failure is tests/test_role_kernel.py::test_predecessor_archive_matches_recorded_hashes: it unconditionally reads removed active .ralph/plans/SPECIFICATION.md and EXECUTION_PLAN.md after the owner-authorized normal archive lifecycle, causing FileNotFoundError. Violated invariant: final candidate complete Tier 0 must pass while active root plans remain absent. Impact: candidate cannot advance to Tier1/pinned probe/official review. Repair intent: make the predecessor-archive integrity test preserve its historical hash/distinctness guarantee across completed-plan lifecycle by comparing against the current archived replacement plan set (or otherwise accepting the intentional active-plan absence without weakening predecessor hash checks). Rerun affected focused Docker and all exact gates, freeze a successor, then official review. No tracked mutation, Tier1/probe/review, host apply, GateB, restart, finalization, or cleanup occurred.
OWNER ACCEPTED BOUNDED FINAL-CANDIDATE REVISION — revise blocked immutable 517624238989a4f4f825153c87ba1d24f86a2b3d for one finding only: `tests/test_role_kernel.py::test_predecessor_archive_matches_recorded_hashes` must keep exact predecessor archive hashes and the distinctness guarantee while comparing with the completed replacement plan at `.ralph/plans/archive/official-lean-compatibility-cleanup/`, not absent active-root files. Smallest test-only path repair; no product/doc/plan code or restored active roots. Rerun complete Tier 0; only if green continue already-planned selected Tier 1, pinned 0.9.8 probe, exact rollback verification, and official review. No scope broadening, merge, host final apply, restart, bookkeeping finalization, or cleanup.
TEST-ONLY SUCCESSOR READY — parent 517624238989a4f4f825153c87ba1d24f86a2b3d. Only `tests/test_role_kernel.py::test_predecessor_archive_matches_recorded_hashes` changed: predecessor exact hashes remain 09cce8ae0898da292fb34f843b3e99b3a5144898934c7e13408a29e76ae2802a / cf9a75e45d4ccabb42e3c36feed05ef9678227bc58d9e8514aea99145cabe888; distinctness now compares with completed archived replacement hashes 305f8b69fc881fa25fdcabdeace4688e13787651270f843799f6f8471d30c012 / 33437aa648a0fc6b788db053edc216c543e3cdfa9d16944e978e5dbf21e6a325. Focused 1 passed log SHA256 a71df3ef716cabe43ead70bd8311cda3aeadcb986bea501da0ea9262f31c3925. Complete Tier 0 447 passed/177 skipped SHA256 e33c1b5270f408347667e4689251fcb711e63f66416e46c3203ce54449e12d80. Patch SHA256 5acf5ca1ae533ddb56d1e1544b12f2c0fc59407cf71ddb241fa8a6322c049bf1, prospective tree a09a937a8f4f42cc0ac92102e3769fd0e9e2b392. No other file or product change; active root plans remain absent.
IMMUTABLE TEST-ONLY SUCCESSOR FINAL GATES GREEN — commit 94be2ad3cf8cf52814ecdf4d7bc8243d812f3cea, tree a09a937a8f4f42cc0ac92102e3769fd0e9e2b392, parent blocked candidate 517624238989a4f4f825153c87ba1d24f86a2b3d; exact one-file patch SHA256 5acf5ca1ae533ddb56d1e1544b12f2c0fc59407cf71ddb241fa8a6322c049bf1. Focused repair 1 passed SHA256 a71df3ef716cabe43ead70bd8311cda3aeadcb986bea501da0ea9262f31c3925. Complete Tier 0 447 passed/177 skipped SHA256 e33c1b5270f408347667e4689251fcb711e63f66416e46c3203ce54449e12d80. Selected container Tier 1 70 passed/554 deselected SHA256 b8de95edfbf6f4eba4becdcd2f8aca60d6aa1d38aff4f3bcec27dd4e32fb2043. Pinned Prime Agent 0.9.8 `scripts/test-tier1.sh --probe` PASS SHA256 1020a3966f80b4750f6df324db8a3b53f6a788cbaeac43bcdf27c04ce7bda9dc. Exact rollback through successor, blocked candidate, integration merge mainline 1, revised/original Slice 6, and Slice 5 returns accepted bridge tree 44fe596d885728847bf7a8ec0429a2261cd9473c; private proof SHA256 c18567ffb6d59b6b4d0f63135d43f05b007b430532fced4644e075578616036e. Local/upstream/FETCH/origin/ls-remote refs synchronized; tree clean. Awaiting official bridge-owner EXPERT review only. No product/docs/plan/inventory/evidence bytes changed; no host apply, Gate B, restart, merge, finalization, or cleanup.
OFFICIAL FINAL REVIEW CAPABILITY BLOCKER — trusted bridge owner invoked `prime_claw_official_expert_review.launch(packet)` exactly once for immutable successor 94be2ad3cf8cf52814ecdf4d7bc8243d812f3cea; packet SHA256 b58a38f96ba441e109fed25dd3cc1c08fcb0578b5bfbf95e627fb9f9c27554b3. Definite pre-publication failure: `ValueError: official EXPERT review packet is invalid or does not match the active candidate`. Installed bridge package SHA256 92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff accepts only active-root plan paths; owner-authorized lifecycle correctly archived the plan. Candidate package SHA256 99f33740c1d3a32670790deb91cca9073ce7bb4833109588dbd7565cdafeccdf adds bounded matched direct-archive support but is intentionally not active. All implementation/runtime gates remain green: focused a71df3ef716cabe43ead70bd8311cda3aeadcb986bea501da0ea9262f31c3925; Tier0 e33c1b5270f408347667e4689251fcb711e63f66416e46c3203ce54449e12d80; Tier1 b8de95edfbf6f4eba4becdcd2f8aca60d6aa1d38aff4f3bcec27dd4e32fb2043; pinned probe 1020a3966f80b4750f6df324db8a3b53f6a788cbaeac43bcdf27c04ce7bda9dc; exact rollback c18567ffb6d59b6b4d0f63135d43f05b007b430532fced4644e075578616036e. Impact: no official EXPERT report exists, so candidate cannot be called officially reviewed. Unblock requires explicit owner product/transport disposition resolving the bridge-before-archive-review bootstrap constraint; do not infer authority to host-apply/restart or restore active plans. No retry, child, report, repo mutation, merge, host apply, restart, finalization, or cleanup.

## Migrated bundle authority

Imported from frozen pre-cutover tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Verbatim bytes remain available through the source references below; this task is the durable Backlog authority for the bundle's content and outcome.

## Specification imported from `.ralph/plans/archive/official-lean-compatibility-cleanup/SPECIFICATION.md`

# Specification — Official lean role protocol completion and compatibility cleanup

> **Status:** Sections 1-24 are accepted history. Section 25 remains preserved audit history at `3586dcc0cb02f314e7c50f661d956f794637f17c`; its terminal disposition is superseded by the owner-approved private launch design. Section 26 is accepted through `3efd0cc79717378f9be5f448afe32f6a7c33ed39` / tree `06e08cbcf7a226409749f29c7e6dd815ee66ff4b`. Section 27 is accepted through `ee655a8907882a21f693169fbd0369d2d8c2e122` / tree `60bc9c9985845f54b3ddb1b790f8e10fdda4ad06`. Existing episode `01a10774-0155-7316-a329-50ee5f7d17be` remains the sole implementation episode. Owner accepts repaired lifecycle closure through `6bceeea133f767d72739a8d88df2639ab75bba96` / tree `6421f9acc11a4c5e755e37dfa3060c2821bf5326`; Slice 3 is complete. Generation A candidate `f2f3fcd25dbe3d96f05193261020d26bf79f1213` / tree `8b4fef1936766c7383a577317ac6d2436f4e72e5` is preserved immutable history. Its exact configured Astra/max review returned `BLOCK`, report SHA256 `4ed03385fc1d54cdecdbbacf5ea720d00b70a9af10b99b1466f7592df50d95e1`. The owner accepted the Section 31 replacement `ed42db9f20ce7a58689707b188e35028e31abf55` / tree `7fb098436e13296191ab64ef593c49550c70c162` after an exact configured `PASS` and explicitly authorized Gate A. Before any live mutation, owner read-only preflight found the supported Prime Agent 0.9.8 wrapper writes exact version `0.9.8` to stderr while coordinator verification reads stdout only. Gate A did not begin. Section 32 successor `47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4` / tree `a4667c0047a9ea6f3379790d024c3df44754f00c` is frozen history; its fresh exact Astra/max review returned `BLOCK` because `LocalRunner.run(..., text=True)` normalizes raw CRLF and bare CR to LF before the verifier. Preserve owner report SHA256 `039a66d0ad404d5592913d9476dfef77c6e309dbc16b5dd9a23e3593f6008262` and reviewer production-adapter matrix SHA256 `bf8d9d182c028b77608745237aa286cf416aaf704a35bbd26ea94a0a77a337de`. Owner stop-loss reassessment authorizes exactly one final narrow Section 33 lossless version-capture repair and one final fresh exact review.
>
> **Tracking:** implementation `prime-claw-h6w.30`; incident `prime-claw-gv7.1`; systemic correction epic `prime-claw-gv7`.
>
> **Predecessor:** accepted official lean session-protocol cutover (`d2ee807ee2f0f066dac1a6b0f1d1c661f2fe1fd4`), terminal main checkpoint `62ee095cc9cfc7e88a884edec03024edf87953f0`.
>
> **Implementation authority:** execute only the final bounded production-adapter repair in plan Section 33. Add a version-specific lossless subprocess capture seam without changing general `LocalRunner.run` text behavior. Admit only rc0 plus exact UTF-8 configured-version bytes followed by one LF on exactly one raw stream, with the other raw stream empty; fail all specified byte, ambiguity, timeout, and decode cases. Exercise the actual adapter, preserve the real supported 0.9.8 stderr proof, update only affected documentation/traceability/private evidence, prove the full successor rollback chain, run all gates, freeze/push one clean successor, report it, and stop for the one allowed final fresh exact owner review. Preserve 47d2d49, ed42, f2f3, all reports/diagnostics, primary main, the owner's private overlay, old configs, live/global state, UAT, S5, compatibility, finalization, and cleanup.

## Summary

The accepted official lean cutover removed the repeated provider-visible oversight package and replaced it with a 246-word managed identity block installed through user-global `APPEND_SYSTEM.md`. Deterministic plugin code retained exact identity, lifecycle, handoff, finalization, recovery, and historical-message filtering. Restart and three-context UAT passed, the operator accepted the cutover, and the transition episode was finalized and physically cleaned.

Review of the proposed compatibility cleanup found that simple deletion would overcorrect in three ways:

1. deleting the project `oversee-episode` skill and discovery link would remove progressive Conversation guidance rather than only stopping automatic injection;
2. deleting `.prime/agent/profiles/expert-reviewer.md` would remove the only concrete definition of the official EXPERT without replacing its non-native admission mechanism; and
3. user-global `APPEND_SYSTEM.md` is only a fallback in Prime Agent v0.9.8, so an exact-CWD project `APPEND_SYSTEM.md` can structurally replace the lean kernel.

This specification completes the role protocol and removes compatibility in **the one existing episode**. The episode first installs and proves the replacement architecture while retaining legacy resources, then removes those resources after an explicit interim UAT gate, and ends only when the clean target state passes final UAT. Intermediate deployments and restarts are vertical slices within the same episode; they are not separate episodes.

The target architecture is:

- one small role-neutral kernel in Prime Agent's selected user-global context file;
- one plugin-managed global `prime-claw-oversee-episode` skill for Conversation judgment;
- the existing `execute` skill for EPISODE implementation;
- one plugin-managed global Python-backed `prime-claw-official-expert-review` skill for exact EXPERT admission and review;
- deterministic plugin code for trusted identity, lifecycle, role boundaries, activation/admission, handoff, finalization, and historical filtering; and
- no Prime Claw-managed block in user-global `APPEND_SYSTEM.md` in the final state.

## Accepted baseline

The following baseline is already accepted and must remain true throughout migration:

- Prime Agent is an upstream dependency and is never patched, forked, or used as a Prime Claw implementation surface.
- The old approximately 11.5 KB oversight package is not freshly injected into provider-visible messages.
- Historical `prime-claw-oversee-episode-package` records are filtered before provider dispatch.
- The retired detailed goal/heartbeat overlay is absent.
- Trusted ownership and lifecycle state are enforced by plugin code, not model imitation.
- Product, scope, merge, abandonment, destructive cleanup, and terminal episode disposition remain operator decisions.
- Plugin development and pre-merge validation are Docker-only.
- User-global apply/check runs only from clean synchronized primary `main` with explicit `--user-global`.
- A loaded generation remains active until a coordinated full restart proves otherwise.

Accepted transition evidence, rollback material, review reports, Beads chronology, and terminal cleanup receipts remain immutable historical records.

## Problem statement

### Global APPEND is shadowable

Prime Agent v0.9.8 chooses an exact-CWD project `APPEND_SYSTEM.md` before the user-global file. A project file can therefore remove the global Prime Claw kernel from the assembled base prompt without modifying the installed plugin.

A `before_agent_start` system-prompt hook is the correct system-role composition seam for normal direct, queued, and injected turns, but it is not universal. Direct idle `agent_message` and idle custom-trigger turns can skip that hook. The neutral kernel therefore needs a base-prompt location that survives both project APPEND selection and those skipped paths.

### Global context is merged, not replaced

Prime Agent loads one context file from the active user `agentDir`, then loads context files from filesystem ancestors through the current working directory. The user-global context file remains present when a project provides its own `SYSTEM.md`, `APPEND_SYSTEM.md`, `AGENTS.md`, or `CLAUDE.md`.

Within each directory Prime Agent selects the first readable candidate in this exact order:

1. `AGENTS.md`
2. `AGENTS.MD`
3. `CLAUDE.md`
4. `CLAUDE.MD`

Files in the same directory are not merged. The installer must modify the already-selected global file and must not create a higher-priority filename that shadows existing instructions.

### Role guidance needs progressive disclosure

The existing project-local `oversee-episode` skill contains useful supervision guidance but is 1,547 words and combines judgment, identity details, expert admission, retry mechanics, lifecycle implementation, cleanup procedure, and project-specific ledger rules. Its `.agents/skills/oversee-episode` entry is a symlink to the same `.ralph/skills/oversee-episode` directory; they are not independent policy copies.

The plugin no longer reads or injects this file. Its automatic-injection defect is already gone. The remaining work is to migrate its useful Conversation judgment into a small globally available skill and retire the old project path only after the new route is proven.

### The expert profile is not native

`.prime/agent/profiles/expert-reviewer.md` is a Prime Claw convention. Prime Agent does not discover or instantiate `.prime/agent/profiles/*.md`. The old oversight skill manually validated that file, resolved its exact model, spawned a child, delivered the packet, and preserved evidence.

The reviewer definition and its admission mechanics must migrate into a supported Prime Agent skill before the standalone profile can be removed.

## Goals

1. Make the neutral Prime Claw role kernel present in managed turns even when a project supplies its own APPEND or SYSTEM prompt.
2. Keep all managed policy in the provider system-prompt channel or explicit on-demand skill/tool results; never reintroduce fresh user-shaped oversight messages.
3. Give each role concise progressive guidance without duplicating deterministic plugin mechanics.
4. Make the official EXPERT concrete, exact-model, fail-closed, independently reviewable, and globally available.
5. Preserve safe direct idle messages, resume, compaction, linked worktrees, nested directories, and unrelated repositories.
6. Install and prove the replacement before removing any compatibility resource.
7. Complete replacement, compatibility removal, final UAT, and finalization inside one episode.
8. Preserve user-owned global configuration and all historical evidence.

## Non-goals

- Modifying Prime Agent source or requesting an unsolicited upstream pull request.
- Treating prompt order as a security boundary against an untrusted repository or installed extension.
- Providing capability-enforced read-only RLM children; current public `rlm.spawn` inherits parent tools.
- Replacing `execute` or redesigning EPISODE implementation.
- Reintroducing a monolithic oversight package, mandatory always-visible procedure, fixed heartbeat interval, or autonomous orchestrator.
- Removing historical provider-message filtering merely because current files are gone.
- Solving probable hung-tool detection (`prime-claw-h6w.29`).
- Changing the scope of Project-Wide Testing or any foreign episode.
- Rewriting immutable archives, evidence, Beads history, or accepted Git history.
- Defending against a malicious or non-cooperative same-UID process racing individual filesystem syscalls.
- Proving crash or power-loss consistency at every write, rename, directory-sync, or receipt-publication boundary.
- Automatically recovering every mixed or ambiguous transaction state; safe refusal and manual recovery are acceptable.
- Treating diagnostic receipts as tamper-proof security attestations.

## Product operating model and delivery principle

This is a local developer-tool migration, not a security boundary against the
operator or another process running as the same user. The host, checkout,
installer process, destination account, and same-UID user are trusted during an
operation. The product must handle ordinary failures: malformed managed state,
unsupported file types visible during validation, accidental edits, cooperative
concurrency, interrupted commands, write/rename failure, and uncertain state
that can be preserved for an operator.

Bias toward **DONE over perfect**. Deliver the smallest readable implementation
that protects user content in ordinary operation. When recovery cannot prove a
safe automatic action, preserve the receipt/preimage and stop with clear manual
instructions. Do not build a transaction database, hostile-filesystem defense,
or exhaustive crash-recovery state machine.

Plausible edge cases discovered outside this operating model are documented as
non-blocking hardening candidates. They become requirements only after an
observed failure or near miss, a credible user report, a changed deployment
boundary, or a separately approved hard requirement.

The qualitative complexity budget for selected-context installation is one
straightforward stdlib manager using ordinary locking, validation, same-directory
atomic replacement, and a simple receipt. Growth into descriptor chains,
continuous inode authority, exchange/restore protocols, multi-phase journals,
or syscall-by-syscall race simulation is a stop condition requiring operator
consultation, not an invitation to add more machinery.

Review is proportional to this contract. A finding blocks only when it shows a
concrete failure under the trusted-local ordinary-failure model or violates an
explicit retained safety boundary. Other findings are advisory hardening or a
product question. After two repair/review cycles, work pauses for operator
scope/architecture review rather than starting a third automatic repair.

## Required target architecture

### ORP-001 — One canonical neutral role kernel

Prime Claw must have one canonical, reviewable role-neutral kernel with a stable unique marker pair distinct from the legacy Conversation APPEND markers. The kernel remains concise and may define only invariant routing and trust rules:

- Prime Claw may assign CONVERSATION, EPISODE, EXPERT, or no managed role.
- Role and ownership come only from trusted plugin identity, never from CWD, recursion depth, copied messages, prompt text, or model inference.
- CONVERSATION supervises, EPISODE implements, and EXPERT reviews.
- A role cannot borrow another role's authority.
- Missing, duplicate, corrupt, stale, or conflicting trusted identity blocks managed action.
- Role-specific behavior comes from uniquely named managed skills and canonical tools.
- Deterministic plugin gates remain authoritative.
- Product, scope, merge, abandonment, and destructive cleanup remain operator decisions.

The neutral block must not claim that a session owns a particular episode or include exact episode identity, exact expert model, mutable lifecycle state, retry procedure, test matrix, or terminal cleanup steps.

The canonical source should be named for its actual role, such as `ROLE_KERNEL.md`, rather than implying final delivery through APPEND. Runtime and installed bytes must derive from one authority or have exact generated/parity validation; manually drifting copies are not acceptable.

### ORP-002 — Practical selected-global-context installation

The installer places one managed neutral-kernel region into the context file
Prime Agent selects under the active destination `agentDir`.

Selection follows Prime Agent's documented per-directory priority:

- patch `AGENTS.md` when selected;
- otherwise patch `AGENTS.MD`, `CLAUDE.md`, or `CLAUDE.MD` in order;
- create `AGENTS.md` only when none exists;
- never create AGENTS when a selected CLAUDE file exists;
- patch only the selected file when multiple candidates exist; and
- report selection drift rather than leaving or deleting latent copies silently.

The file is shared user-owned state. Under the trusted-local operating model the
manager must:

- own only its exact marker region and separators;
- preserve unrelated bytes, newline/final-newline form, and ordinary mode and ownership metadata;
- reject malformed or duplicate markers and obvious symlink, non-regular, or unreadable targets visible during validation;
- use one cooperative destination lock, reread before mutation, and use ordinary same-directory atomic replacement;
- detect an ordinary edit observed between its locked preflight and final replacement and stop without overwriting it;
- write a simple receipt with the fixed owned-file inventory plus pre/post hashes and preimages needed for manual or guarded restore;
- restore only when every current owned surface is a known preimage or installed postimage, and refuse ambiguity;
- never delete a pre-existing context file; and
- delete an installer-created file only when the receipt identifies it and its current contents are exactly the known installer-created empty/preimage state.

The receipt is diagnostic recovery material, not a tamper-resistant authority
against the local owner. No acceptance guarantee exists for hostile same-UID
path/ABA/FIFO substitution after ordinary validation, continuous descriptor or
inode authority, malicious receipt replacement, or power loss between individual
filesystem durability operations. These may be recorded as hardening candidates
but cannot block this specification without a new operator-approved requirement.

### ORP-003 — System channel only

The neutral kernel must reach providers only through `Context.systemPrompt`. It must never be added to session messages as `custom`, `user`, assistant, tool-result imitation, or continuation text.

Provider-boundary evidence must show:

- exactly one exact neutral block in the effective system prompt;
- zero neutral-kernel or role-skill bodies in provider-visible user text;
- no kernel-bearing custom message in session JSONL; and
- stable bytes across identical turns.

A provider payload rewrite may be used for observation in tests but not as the production repair mechanism.

### ORP-004 — Per-provider integrity guard

The existing provider-context seam must parse the assembled system prompt before every managed provider call and require exactly one exact current neutral block.

- No marker is a managed-role failure.
- Exactly one correctly ordered exact block passes.
- Unmatched, reversed, nested, duplicate, stale-version, or disagreeing marker content fails closed.
- Any marker-looking occurrence counts, including occurrences in project context.
- Rejection must call `ctx.abort()` and prove zero provider calls; throwing alone is insufficient because Prime Agent extension handler exceptions are fail-open.

The guard protects integrity inside the trusted extension set. It does not claim to detect semantic contradiction in unmarked project prose or a later trusted `before_provider_request` rewrite.

Ordinary unmanaged sessions may continue when the kernel is intentionally unavailable, but no managed role action may do so.

### ORP-005 — Explicit context opt-out

Prime Agent's `--no-context-files` option and SDK context overrides can remove global context. Prime Claw must not silently defeat that explicit choice.

A session without the exact neutral block may perform ordinary unmanaged work. Promotion, active owner supervision, EPISODE execution, EXPERT admission, handoff, finalization, or other managed role action must fail visibly and without provider or lifecycle mutation until the kernel is available.

### ORP-006 — Lean global Conversation skill

Install one uniquely named plugin-managed global Markdown skill:

`prime-claw-oversee-episode`

Its canonical source belongs under `src/prime-agent-plugin/skills/` and its installed authority belongs under the selected destination `agentDir/skills/`. The guarded installer/check owns and verifies the exact managed directory.

The skill should remain approximately 300–600 words and contain only Conversation judgment:

- require exact trusted owner and active episode preconditions;
- inspect the exact reported slice, candidate commit, diff, tests, approved scope, and evidence;
- choose accept, in-scope revise, pause, or consult;
- never implement or directly steer implementation;
- supervise one reviewable vertical slice at a time;
- use only canonical handoff for accepted advance or recorded in-scope revision;
- invoke the official EXPERT skill when project policy or material risk requires it;
- preserve and adjudicate EXPERT PASS/BLOCK evidence without treating it as product or merge authority;
- maintain a bounded goal and an exact wait heartbeat only while observable work is active; and
- preserve operator authority and record accepted findings before revision.

It must exclude identity storage fields, lifecycle state-machine implementation, handoff/finalization internals, historical filtering, exact expert model/thinking, packet delivery/retry mechanics, terminal Git cleanup, fixed timing rules, project-specific ledger IDs, and duplicated kernel prose.

### ORP-007 — Conversation guidance activation

Prime Agent exposes skill metadata progressively but does not guarantee that a model opens a matching Markdown skill. Before a managed Conversation performs a lifecycle-changing action, the runtime must have observable evidence that the exact managed Conversation guidance was activated for the current trusted owner/episode generation.

The plan may realize this through a small plugin activation tool or equivalent supported interface. The contract must:

- derive role and episode from trusted plugin state;
- identify the exact managed skill location, version, and content hash;
- expose guidance only on demand, never in every provider request;
- bind the receipt to the exact session, episode, and generation;
- invalidate it on role, identity, skill, episode, or lifecycle change;
- block handoff/finalization when missing, stale, shadowed, or mismatched; and
- avoid a second policy copy.

Representative model UAT must show the exact managed guidance is read or returned before the first oversight decision. A project skill with the same name or import must not silently shadow the managed authority.

Implementation is intentionally staged inside Slice 2. Accepted candidate 1
established exact neutral-kernel and private-role integrity. The next bounded
candidate installs the sole guide, implements the active-owner issued-to-consumed
disclosure path plus read-only status, and gates active-owner handoff and first
finalization. Prospective future-location activation and the promotion gate remain
required later Slice 2 work; `create_spec_episode` must remain usable until that
matching receipt subject exists. A resumed process without a current private
receipt must activate again rather than reconstructing authority from transcript
content.

### ORP-008 — Existing EPISODE execution role remains

The existing `execute` skill remains the EPISODE implementation procedure. This work may update routing names and documentation but does not broaden or rewrite its implementation policy unless a separately reviewed requirement proves necessary.

Trusted identity and lifecycle code must prevent an EPISODE, EXPERT, generic RLM child, or copied transcript from acquiring Conversation acceptance, handoff, merge, or cleanup authority.

### ORP-009 — Official EXPERT skill

Install one uniquely named plugin-managed global Python-backed skill:

`prime-claw-official-expert-review`

with import name `prime_claw_official_expert_review`. Its managed directory
contains `SKILL.md`, `pyproject.toml`, the Python package, and one canonical
reviewer definition. The skill owns the official reviewer configuration formerly
held by `.prime/agent/profiles/expert-reviewer.md` and uses only supported Prime
Agent interfaces.

The skill must validate a full configured model selector and reasoning level,
resolve one exact model, spawn one fresh reviewer with the startup-race-safe
bootstrap, validate the returned model, and deliver one self-contained immutable
commit packet exactly once. It records reviewer/session identity, selected model,
requested reasoning, commit, packet digest, delivery result, report, and owner
disposition. Unavailable or uncertain admission/delivery blocks the required
review; it never silently chooses a fallback model or claims review occurred.

The review packet includes the approved product outcomes, threat model, trusted
assumptions, non-goals, and complexity budget. The reviewer returns:

- `PASS` when no blocker remains inside that approved contract;
- `BLOCK` only for a concrete retained functional/safety failure with realistic impact and a proportionate repair direction;
- `ADVISORY` for plausible hardening outside the approved model; or
- `SPEC_QUESTION` when resolution would change product scope.

An EXPERT recommends; it does not ratchet acceptance scope. Advisory findings are
recorded with a scenario and promotion trigger, not automatically implemented.
A scope-changing finding returns to the operator. One normal final review is
sufficient for a candidate; unrestricted adversarial/red-team review requires
explicit operator authorization and cannot redefine baseline acceptance.

When `PRIME_AGENT_KERNEL_PYTHON` selects an external interpreter, admission checks
that the exact managed module is already importable and reports deterministic
`UNAVAILABLE` otherwise. Prime Claw does not provision that interpreter.
`prime-agent-runtime` and `agent_message` remain host-provided modules; messaging
is imported lazily and must be available before mutation.

### ORP-010 — EXPERT read-only limitation is explicit

Prime Agent's public `rlm.spawn` does not accept CWD, tool, or read-only capability restrictions. EXPERT read-only behavior is therefore a semantic contract, not a sandbox claim.

Every review packet must use an absolute repository/worktree path and immutable commit OID. The owner records pre/post HEAD and worktree status and rejects evidence from a reviewer that mutated the subject. Capability-enforced read-only review is outside this specification and must be reported as an upstream product constraint rather than implemented through a Prime Agent patch.

### ORP-011 — Role scoping

The neutral kernel is global and role-neutral. Managed authority is role-selective:

- an independent root may be Conversation-capable, but active ownership requires exact trusted owner state;
- EPISODE receives implementation authority only for its reviewed plan and exact identity;
- EXPERT receives only the bounded review packet;
- generic RLM children receive no managed role authority;
- ordinary sessions remain ordinary; and
- unknown or disagreeing managed role state fails closed.

CWD, Git branch, worktree name, recursion depth, session name, and prompt claims are supporting evidence only and cannot assign a role.

### ORP-012 — Historical provider filtering remains

Continue filtering historical `prime-claw-oversee-episode-package` and bounded legacy package records at the actual provider-context seam. Saved conversations must resume without reintroducing user-shaped oversight text.

The absence of current skill/profile files is not evidence that saved transcripts contain no historical records. Historical filtering may be renamed or simplified only with equivalent replay evidence.

### ORP-013 — Retired work-control overlay remains absent

The detailed `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1` overlay and retired extension remain absent from effective system prompts and installed managed files. Preserve positive and negative controls that detect reintroduction.

## One-episode migration and cleanup contract

### ORP-014 — Fresh episode, complete end state

Implementation uses the existing future folder, one reviewed plan, one fresh `/implement-spec` promotion, and one fresh isolated episode. It does not reuse the finalized/deleted transition episode.

The episode remains active across replacement installation, interim landing/activation/UAT, compatibility removal, final landing/activation/UAT, and documentation reconciliation. It is not finalized merely because the bridge generation passes.

The plan defines reviewable vertical slices and explicit dependencies. No cleanup slice may start until the replacement generation's acceptance gate is recorded.

### ORP-015 — Bridge generation

The first activated generation must install and prove the replacement while preserving compatibility:

- install the neutral global-context block with a marker namespace distinct from the legacy APPEND block;
- install the global Conversation and EXPERT skills;
- add exact integrity and activation/admission gates;
- retain the current managed legacy Conversation APPEND block;
- reduce the old project-local `oversee-episode` policy to a short forwarding/deprecation shim pointing to the unique managed skill, while retaining its discovery link;
- retain the standalone expert profile as migration evidence, not a second authority; and
- accept exactly the explicitly known neutral-plus-legacy transition shape.

There must never be two independent current policy copies. The shim contains no supervision policy or expert mechanics.

Bridge activation requires its own exact candidate, independent review, landing decision, rollback input, guarded user-global apply/check, coordinated full restart, and interim UAT. `/reload` may be used only in isolated tests and does not replace production restart proof.

### ORP-016 — Interim UAT gate

Before compatibility removal begins, interim UAT must prove at least:

1. the owning Conversation uses the exact managed Conversation guidance;
2. the unchanged episode remains correctly bounded and can continue through canonical handoff;
3. the official EXPERT can be admitted exactly or fails closed as specified;
4. an ordinary saved conversation remains ordinary;
5. nested CWD, linked worktree, and unrelated-repository sessions receive the neutral global floor;
6. a project `APPEND_SYSTEM.md` and project `SYSTEM.md` do not remove the neutral floor;
7. direct idle and queued agent messages retain the neutral floor;
8. provider requests contain zero fresh user/custom oversight packages; and
9. rollback to the accepted pre-bridge generation is verified.

The operator must explicitly accept this gate. Passing tests or review does not authorize compatibility removal by itself.

### ORP-017 — Compatibility removal generation

Only after accepted interim UAT may the same episode remove transition compatibility:

- remove only Prime Claw's exact managed legacy block from user-global `APPEND_SYSTEM.md`, preserving all unrelated content byte-for-byte;
- stop installing the legacy APPEND block;
- remove or retire the source `APPEND_SYSTEM.md` name so it cannot be mistaken for the final delivery path;
- remove `.ralph/skills/oversee-episode/SKILL.md` only after it is only the forwarding shim;
- remove `.agents/skills/oversee-episode` without leaving a broken symlink;
- remove `.prime/agent/profiles/expert-reviewer.md` only after exact reviewer parity exists in the official EXPERT skill;
- remove tests and current docs whose sole subject is a deleted compatibility resource;
- retain historical provider filtering and non-vacuous regression coverage; and
- remove legacy prompt-shape tolerance only when coordinated drain/restart evidence proves no loaded process requires it.

A live foreign episode worktree that can still exercise a full legacy skill/profile or stale policy is a cleanup blocker unless it reaches an operator-approved safe state. Cleanup does not modify foreign branches to force convergence.

### ORP-018 — Final UAT and episode completion

The removal generation requires its own exact candidate, independent review, landing decision, rollback input, guarded user-global apply/check, coordinated full restart, and final UAT.

Final UAT covers:

1. the owning Conversation;
2. the unchanged cleanup episode fixture;
3. one operator-approved ordinary saved conversation;
4. Conversation guidance activation and canonical handoff;
5. exact EXPERT admission/unavailable behavior;
6. no legacy APPEND block, old project skill/link, or standalone profile;
7. exactly one neutral global-context block;
8. no missing-skill/profile/startup/lifecycle error;
9. zero user-shaped oversight or retired work-control injection; and
10. clean synchronized primary `main` plus verified rollback capability.

The operator explicitly accepts or rejects the completed target state. Only accepted final UAT permits episode finalization. Physical session/worktree/local-branch/remote-branch cleanup remains a separate explicit operator-authorized terminal action.

## Test and evidence requirements

### ORP-019 — Complete proportional isolated gates

Each exact generation candidate passes complete Tier 0, the selected complete
Tier 1 path in Docker, the pinned Prime Agent probe, `git diff --check`, focused
behavioral tests, and one independent read-only exact-candidate review. Bare
host-global candidate probing remains prohibited.

Focused Slice-1 coverage is intentionally practical:

- selected AGENTS/CLAUDE priority and creation behavior;
- ordinary symlink/non-regular/unreadable rejection at validation;
- LF/CRLF, final-newline, unrelated-byte, and ordinary mode preservation;
- malformed/duplicate markers, idempotence, cooperative locking, and an ordinary detected concurrent edit;
- exact fixed receipt inventory, known-state restore, refusal on unknown current content, and safe installer-created-file cleanup;
- a regression proving a malformed/tampered inventory cannot delete an unrelated file;
- bridge retention of the legacy APPEND region; and
- honest documentation and isolated apply/check behavior.

Delete or stop enforcing tests whose sole purpose is hostile same-UID
syscall-by-syscall races, continuous inode authority, exhaustive crash points,
or autonomous recovery of every journal state. Passing those cases is optional
hardening, not acceptance evidence.

Later slices retain focused coverage for system-only provider delivery, role
isolation, context opt-out, managed skill discovery, exact model admission,
custom-kernel availability, historical filtering, and absence of full policy
bodies in ordinary prompts. Extension exceptions remain fail-open controls while
production managed rejection proves zero provider calls.

### ORP-020 — Useful, correlatable evidence

Evidence is diagnostic, not a security attestation protocol. Record enough to
reproduce and review the result: exact commit/tree, relevant dependency version,
selected context path, owned-file pre/post hashes, commands, concise raw-log
locations, test counts, reviewer identity/report, and teardown result.

Do not add cryptographic cross-binding, per-step sidecars, permanent comparator
machinery, or repeated rereads unless a later observed failure or approved
security requirement justifies them. The reviewer record states the actual
returned model and requested reasoning without claiming `RlmSpawnHandle` returned
reasoning when it did not.

### ORP-021 — Two rollback points

Before bridge landing, record the exact accepted baseline and user-global context/APPEND preimages. Bridge rollback restores the accepted lean generation, selected global context bytes, legacy APPEND bytes, project skill/link/profile, and installed plugin generation, followed by coordinated restart and resumed-session verification.

Before removal landing, record the exact accepted bridge generation. Removal rollback restores that bridge generation and both global-file preimages, followed by the same guarded apply/check, restart, and UAT discipline.

Never reconstruct user-global files from chat text. Never reset or rewrite accepted Git history. Use the normal history-preserving revert appropriate to each landed topology.

## Documentation and historical preservation

### ORP-022 — Current documentation

Update current normative docs and indexes to describe:

- the selected global-context neutral floor;
- role-skill progressive disclosure;
- deterministic role and activation gates;
- official EXPERT admission and read-only limitation;
- context opt-out behavior;
- global file ownership/recovery;
- staged activation and rollback; and
- the final absence of Prime Claw's global APPEND block and legacy project resources.

At minimum audit `docs/conversation-driven-episode-oversight.md`, `docs/goal-heartbeat-work-control.md`, `docs/lab-global-plugin.md`, `docs/README.md`, installer documentation, and operator recovery guidance.

### ORP-023 — Immutable history

Do not rewrite archived specifications/plans, `docs/evidence`, historical dogfood reports, review reports, Beads chronology, accepted commits, preactivation rollback bundles, or prior UAT receipts to remove old names. Historical references remain valid when their location and purpose are clearly historical.

When planning replaces the predecessor active plan/spec, preserve those predecessor documents intact in the project archive and update current indexes only.

## Acceptance criteria

The one existing episode is complete only when all of the following are true:

1. `prime-claw-h6w.30`, incident `prime-claw-gv7.1`, and epic `prime-claw-gv7` link the corrected contract, candidates, evidence, activation gates, and final disposition.
2. The selected global context contains one managed neutral block while unrelated user content and ordinary file metadata are preserved.
3. Slice 1 uses a readable practical installer and simple receipt; obsolete F1–F9 adversarial transaction machinery and tests are removed or no longer enforced.
4. Local project AGENTS/CLAUDE, SYSTEM, and APPEND files do not structurally remove the neutral floor.
5. Managed work fails closed when context files are explicitly disabled or trusted role state disagrees.
6. Provider evidence shows the neutral kernel only in system instructions and no fresh user/custom oversight package.
7. `prime-claw-oversee-episode` remains the on-demand Conversation policy and `execute` remains the bounded EPISODE procedure.
8. `prime-claw-official-expert-review` provides exact-model admission plus contract-bounded `PASS`/`BLOCK` and non-blocking `ADVISORY`/`SPEC_QUESTION` outcomes.
9. Slice 1 passes focused practical tests, complete Tier 0, Docker Tier 1/probe, and one normal review under the trusted-local model.
10. The bridge generation passes complete tests/review, separately authorized landing/apply/restart, and accepted interim UAT.
11. Compatibility removal does not begin before criterion 10 is recorded.
12. The final generation has no Prime Claw-managed global APPEND block, old project oversight skill/link, standalone expert profile, duplicate policy copy, or broken symlink.
13. Historical provider filtering, deterministic lifecycle behavior, and retired-overlay regression controls remain.
14. The removal generation passes complete tests/review, separately authorized landing/apply/restart, and accepted final three-context UAT.
15. Both rollback points preserve accepted history and provide practical preimages plus manual stop/recovery when state is ambiguous; exhaustive adversarial crash recovery is not required.
16. No active foreign worktree/session can exercise stale compatibility behavior at final acceptance.
17. Primary `main` is clean and synchronized after every landing and at completion.
18. Plausible excluded hazards are documented with promotion triggers rather than silently ignored or automatically implemented.
19. The episode remains active through the clean target state, is finalized only after explicit final acceptance, and is physically cleaned only after separate operator authority.

## Dependencies and sequencing

- The accepted official lean cutover and its terminal cleanup are complete.
- This future folder and Bead remain the single specification/tracking authority for the full migration and cleanup.
- Project-Wide Testing remains independent. It may continue, but its live worktree/session must satisfy each applicable activation or cleanup safety gate.
- `prime-claw-h6w.29` remains independent and receives no implementation authority from this specification.
- Prime Agent public interfaces are constraints. Unsupported behavior is reported as a product limitation, not converted into an upstream patch plan.

## Open decisions for implementation

The operator resolved the Slice-1 threat model and delivery tradeoff on 2026-10-06:
trusted local host, ordinary failures, DONE over perfect, and advisory backlog for
unobserved adversarial edge cases. The existing episode chooses the smallest
readable implementation consistent with this corrected contract. Any proposal to
restore hostile same-UID guarantees, exhaustive crash recovery, or a third
repair/review cycle is a new product decision and must return to the operator.

### Operator-authorized duplicate-ID repair exception (2026-10-06)

After the required two-cycle stop, the owner independently confirmed the cycle-2
finding and authorized one exact in-contract repair. The repair is limited to the
active-owner Conversation-guide disclosure seam: before consumption, the issued
tool-call ID must occur exactly once across all assistant tool-call items and
exactly once across all tool-result messages regardless of name; the unique call
and result must use the activation tool name and match the bound text/details;
and only that exact validated result record is authorized. Focused regressions
cover same-ID/different-name assistant-call and result aliases while preserving
normal one-time disclosure, later omission, pairing, and abort-before-dispatch.
This is an operator-approved exception to the automatic review stop-loss, not a
threat-model or scope expansion. This pass performs no third independent review
and accepts no additional finding.

### Accepted active-owner guide candidate and prospective-create continuation

The owner accepted Slice 2 candidate
`d31ab61e89247a024948d66e2613d434c89688fd` / tree
`f7ecd504d3f890455b858d53c6099c936fb0bf85`. The next candidate is limited to
prospective future-location guide activation and the pre-mutation
`create_spec_episode` readiness gate. It reuses the existing `/implement-spec`
preparation/admission state as trusted prospective intent and minimally extends
the existing activation subject and in-memory receipt to bind the exact owner
session, selected future location, current role-kernel/guide generation, and
current preparation lifecycle. Consumed readiness is required before any episode
identity, worktree, branch, session, or marker mutation.

The candidate preserves accepted active-owner handoff/finalization behavior and
already-inactive finalize idempotence. Proof covers ordinary no-context failure,
wrong/missing/stale location or preparation, EPISODE/generic-child/active-owner
misuse, valid one-time prospective disclosure/consumption/create, no
provider-visible receipt or replay, and abort before mutation. It uses the
existing activation tool when practical, keeps the guide byte-identical, and
leaves `execute` unchanged. A generalized token framework, durable receipt
store, transaction journal, adversarial race matrix, duplicate policy, cutover
coordination, Slice 3, landing, user-global mutation, restart, UAT, finalization,
and cleanup remain outside this candidate. Remaining provider-route coverage may
remain for one final bounded Slice 2 pass if it is not required here.

### Accepted prospective-create candidate and final Slice 2 coverage reconciliation

The owner accepted prospective create-readiness candidate
`29b8932e3e576d0068194e44a5494af98474d8bf` / tree
`a5a16cacce0fad56f546a565475cefe519761b0a`. The next and final bounded Slice 2
candidate is coverage reconciliation only. Map existing static, Node, native
installed-runtime, and provider-capture proof to the Section 7 route and
acceptance list. Treat routes that converge on the same proven `context` seam as
equivalence classes; do not build a combinatorial matrix.

Add only the smallest representative tests for material uncovered paths, with
priority on queued/injected/direct-idle agent-message continuation, tool loop and
retry, compaction/resume/reload/recovered queue, project SYSTEM/APPEND and
global/project AGENTS/CLAUDE shadows, CLI `--no-context-files`, and SDK override.
Reuse existing assertions for exactly one system kernel, no guide or private
identity in user/custom channels, exactly one intended guide tool result, later
omission, and abort before provider dispatch on managed defects.

Production code remains unchanged unless a representative test exposes a
concrete in-contract defect. Any such defect is recorded and repaired only at
its root seam under owner-delegated triage without broadening architecture. Mark
Slice 2 complete only when the approved acceptance contract is actually covered.
Run proportional focused checks plus complete Tier 0, Docker Tier 1, and the
pinned runtime probe. Freeze one commit. Use at most one independent exact-patch
review only if production code changes; otherwise owner/test evidence is
sufficient. Commit/push, report, and stop. EXPERT admission, Slice 3, landing,
user-global mutation, restart, UAT, finalization, and cleanup remain excluded.

### Slice 2 completion result

Final route reconciliation is recorded in
`docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-coverage-reconciliation.md`. Static, Node, installed-runtime, and provider-capture
proof now cover the Section 7 route and acceptance list through explicit
`context`-seam equivalence classes and the smallest distinct restoration,
loader-override, retry, and receipt representatives. Complete Tier 0, Docker
Tier 1, and pinned Prime Agent 0.9.8 gates passed. The candidate changes tests
and documentation only; production code, managed guide bytes, and canonical
`execute` bytes remain unchanged. Slice 2 is complete. Official EXPERT admission
begins only in a later owner-authorized Slice 3 pass; no operational cutover or
terminal lifecycle action is authorized by this result.

### Accepted Slice 2 and bounded Slice 3 prerequisite

The owner accepted Slice 2 complete at
`e8b047c1493e6718c2f3062f19c77bc0b23ce8e9` / tree
`881b455a121b4cd53dd01005c5f84e31c7c9d555`. Begin Slice 3 with only the
smallest prerequisite capability: the managed official EXPERT Python-backed
skill/package, strict reviewer configuration and rubric parity, installer/check
ownership, and deterministic read-only availability/preflight for the exact
interpreter that will execute it.

This pass adds no spawn, reservation, nonce/expiry state, handle binding, child
role admission, message delivery, report settlement, cleanup tools, or provider
identity. The standalone expert profile remains byte-identical migration
evidence and must have exact configuration/rubric parity with the managed
package. In default managed-kernel mode, source importability is validated with
the exact runtime interpreter without modifying its environment; report sync
pending when the currently loaded runtime does not yet contain the candidate.
When `PRIME_AGENT_KERNEL_PYTHON` is set, require a normal already-installed
exact package/hash import and deterministically return UNAVAILABLE for a
missing, stale, mismatched, or unusable interpreter/package before any
reservation, RLM, message, or lifecycle activity.

Use only supported Prime Agent and public Python interfaces. Do not add host
runtime modules to `pyproject.toml`, invent host requests or source-path
injection, or provision dependencies. Extend the existing practical apply/check
inventory for both managed skill directories with preflight, copy, final check,
and known-state refusal. Do not add a journal/rollback engine or revive rejected
Slice 1 overengineering. The package remains inert and generic children gain no
EXPERT authority.

Run proportional focused package/interpreter/installer tests plus complete Tier
0, Docker Tier 1, and the pinned-runtime probe. Update evidence and plan,
commit/push one candidate, report, and stop. Reservation/admission, Slice 4,
landing, user-global mutation, restart, UAT, finalization, and cleanup remain
excluded.

### Slice 3 prerequisite candidate checkpoint

The first bounded Slice 3 candidate now owns the inert
`prime-claw-official-expert-review` Python-backed skill/package, an exact
byte-identical reviewer definition, deterministic managed/configured interpreter
preflight, and the second managed skill installer inventory. Focused static/Docker, complete Tier 0/Docker Tier 1, and the pinned Prime Agent
0.9.8 probe are green. The bounded prerequisite is complete at this candidate.
Successful description, source validation, `SYNC_PENDING`, or `AVAILABLE` never
grants EXPERT authority.
All admission/reservation/delivery/settlement behavior and operational cutover
remain deferred as specified in plan Section 22. Evidence:
`docs/evidence/official-lean-role-protocol/2026-10-06-slice-3-expert-prerequisite.md`.

### Accepted EXPERT prerequisite and bounded reservation foundation

The owner accepted the inert EXPERT package/preflight prerequisite at
`e319e39949e1eb1c6b6b680d996ffb15ea664264` / tree
`03a88ac106d7fed83f48f0e157366e7d13258c7f`. The next candidate adds only
owner-scoped single-review reservation state and native reserve/bind/read-only
status/cancel mechanics.

Reserve and bind require the exact active owner, consumed Conversation-guide
readiness, and deterministic EXPERT package `AVAILABLE`. `SYNC_PENDING` or
`UNAVAILABLE` stops before reservation mutation. One simple in-memory record per
owner holds a cryptographically random opaque nonce, practical bounded expiry,
exact immutable repository path and commit OID, packet digest, requested full
selector, and requested thinking. It may transition once from reserved to exact
returned child handle/session/model metadata, but caller-supplied spawn metadata
remains pending evidence. This pass does not claim returned-model, reasoning, or
handle verification and does not admit the child as EXPERT. If safe meaningful
binding needs the later child-side seam, implement reserve/status/cancel only
and record the boundary.

Status is read-only. Cancel, expiry, and session shutdown are idempotent and
leave generic children ordinary. The inert package API remains unchanged. This
pass adds no live spawn, agent-message delivery, child provider-role admission,
review execution, report settlement, cleanup workflow, durable database,
journal, cross-process recovery, generalized token framework, hostile
concurrency model, spawn orchestration, message retry, report protocol, or
provider-visible EXPERT authority. Focused and complete/pinned gates, evidence,
one commit/push, report, and stop are required. Slice 4 and operational cutover
remain excluded.

**Reservation-foundation disposition.** The bounded owner-scoped foundation is
implemented and independently reviewed. Each record is exact to the full stable
active oversight generation, so one Conversation's later episode cannot reuse,
read, bind, or cancel an earlier episode's state. The only bind is the public
spawn return tuple recorded as unverified pending evidence with no authority.
Focused and complete Tier 0/Docker Tier 1/pinned-0.9.8 gates are green. Live
spawn, child-side admission/verification, delivery, review, settlement, cleanup,
and operational cutover remain future work.

### Required repository-subject repair

The owner did not accept candidate
`038d1cbaeb5f00614c4b4f40784cdb9119e72862`. Its reservation subject incorrectly
derives repository path and HEAD from owning Conversation `ctx.cwd`. The exact
review subject is the active oversight marker's episode worktree and candidate
commit.

The repaired reserve gate must canonicalize the trusted marker `worktree`, prove
it exists and equals that worktree's own `git rev-parse --show-toplevel`, and
prove its current HEAD equals the requested exact 40- or 64-hex OID before any
reservation mutation. No caller path is accepted. Owner CWD, branch, session
name, and prompt text cannot substitute. Tests must use distinct owner/worktree
topology and cover wrong owner HEAD, wrong worktree HEAD, and noncanonical or
missing marker paths. Every other accepted reservation invariant remains
unchanged. This pass addresses only this blocker and retains all live admission,
delivery, review, settlement, cleanup, and operational exclusions.

**Repository-subject repair result.** The reserve path now comes exclusively
from the exact active marker worktree, which must be canonical, exist, equal its
own Git top-level, and have HEAD equal to the requested exact OID. Distinct
owner-CWD/episode-worktree regression coverage and all required refusal cases
are green across focused, complete, Docker, and pinned-runtime gates. Exact
review and unchanged commit/push receipts are recorded on `prime-claw-h6w.30`;
all other Section 23 behavior and exclusions remain intact.

### Accepted reservation base and next EXPERT vertical

The owner accepts the non-authoritative reservation foundation through commit
`5674219bc914682a7e28c96146a68ab1b3e80f5f` and tree
`930a7956545c6d3c9b8006e6cf59f5fa141f77d6`. The next bounded Slice 3 vertical
may discover and spawn exactly one configured reviewer, bind its public return
tuple, deliver one immutable packet, and admit only the child's first
packet-triggered review call.

This vertical must first prove supported Prime Agent 0.9.8 public trust seams for
sender/target, actual child session/model, and pre-provider admission. Missing
public proof is a product constraint and stop condition, not permission to patch
Prime Agent or infer authority from copied context. Admission requires every
trusted binding—owner generation, nonce, digest, expiry/use, sender/target,
child/session/model, package, and kernel—to agree. It consumes before dispatch,
strips private receipts, and exposes only a neutral system kernel plus one
bounded rubric/packet user turn. Bootstrap, mismatch, replay, stale state, and
copied identity abort without a review provider call. Generic children remain
ordinary.

Use no fallback selector, retry after uncertain delivery, durable store,
generalized token system, or broader race framework. Report settlement, owner
disposition, child deletion, and all cleanup remain later verticals.

## BLOCKED — Prime Agent 0.9.8 receiver trust metadata is not public

Section 25 stopped at its required public-interface audit. Prime Agent 0.9.8
(commit `a1faacd53ac4473a75de1d434afaf50945c2f647`) has the authoritative
facts internally, but no supported receiver-side interface exposes the complete
set needed for admission before provider dispatch:

- public `rlm.spawn` returns `rlm_child_id`, `name`, `session_dir`, and the
  actual selected `model` to the parent;
- public `agent_message.send` returns trusted sender/target endpoints only to
  the sender;
- a receiving extension can read its own `ctx.model` and read-only session
  manager identity; but
- the only receiver-side link to trusted inbound sender/target is the internal
  built-in `agent_message` custom-message `details` shape. That schema is not
  exported as a supported extension or Python contract. The public message text
  contains only a sanitized relationship/name header and body.

Therefore prime-claw cannot prove trusted sender/target and bind them to the
actual child session/model at the pre-provider `context` seam without relying on
an unsupported internal request/message shape. Serializing parent claims into
the packet would remain attestation text, not independent host proof. A custom
Python `host_request` is also unsupported because extensions cannot register a
public host handler and unknown request types fail.

**Unblock condition:** a supported Prime Agent public receiver interface must
provide unforgeable inbound sender and target identity together with enough
current child/session identity to bind public spawn metadata and `ctx.model` at
or before the provider-admission seam (or an equivalent supported admission
callback). Re-audit a released public interface before resuming. Do not patch or
fork Prime Agent for this project and do not consume the current internal
custom-message `details` schema.

The accepted non-authoritative reservation foundation remains unchanged at
`5674219bc914682a7e28c96146a68ab1b3e80f5f` / tree
`930a7956545c6d3c9b8006e6cf59f5fa141f77d6`. No feature reviewer was spawned,
no review packet was delivered, no child was admitted, and no review provider
call was made. Experimental local implementation edits were discarded.
Evidence: `docs/evidence/official-lean-role-protocol/2026-10-07-section-25-public-interface-constraint.md`.

### Product correction: authority comes from private launch state, not inbound messages

Section 25's inbound-sender API audit remains valid history, but it is not a
terminal blocker. The supported design assigns zero authority to inbound message
text or metadata. The owner-side skill privately records the exact launch before
public spawn and finalizes it only from the real returned tuple. The child's
initial spawn context independently binds its public session/model and canonical
parent-session lineage to that finalized private record, atomically claims it
before provider dispatch, and exposes only the neutral kernel plus one canonical
rubric/packet turn.

The private namespace is plugin-owned and untracked, mode-private, nonce-bound,
TTL-limited, and uses only exclusive create plus atomic rename across
`PENDING`, `FINALIZED`, and `CLAIMED/consumed`. It is not a general persistence
framework. Every mismatch, timeout, stale/replay, copied input, or duplicate
claim aborts before a provider call. Current model is rechecked on every admitted
call. Prime Agent stays unmodified and its internal agent-message details are
never read.

## Accepted next vertical: structured EXPERT report and exact owner settlement

Section 27 extends only the accepted private launch protocol. Inbound messages,
headers, sender/target labels, and internal `agent_message` details retain zero
authority.

- The managed Python package exposes the smallest strict report API callable by
  the already-admitted depth-1 child. It derives the current runtime/session
  directory and claimed launch from host-authored state, revalidates exact
  child/parent/candidate/packet lineage, and accepts one bounded canonical report
  with verdict `PASS`, `BLOCK`, `ADVISORY`, or `SPEC_QUESTION`. Every `BLOCK`
  includes actionable remediation.
- The API digests the canonical report and atomically transitions one claimed
  launch to `REPORTED`. An exact duplicate digest may return an idempotent
  receipt. Conflict, malformed/oversized input, wrong identity/lineage,
  unclaimed launch, or replay fails closed.
- Launch records bind the exact pre-review candidate HEAD and clean repository
  status. Report and settlement record and compare post-review HEAD/status.
  Mutated-subject evidence is retained but rejected, preserving the semantic
  read-only limit.
- A depth-0 exact owner-only settlement/read API derives current owner and
  generation itself, finds only the matching reported launch, validates report
  digest plus actual spawn/child/session/model/candidate/package/kernel lineage
  and unchanged repository state, atomically transitions once to `SETTLED`, and
  returns the immutable report and receipt. Model-supplied handle fields carry
  no authority.
- `FINALIZED`, `CLAIMED`, `REPORTED`, and `SETTLED` continue to designate the
  same child as a neutral EXPERT. Any provider call after report or settlement
  explicitly aborts. The canonical reviewer must submit exactly once before its
  final answer.
- Reuse the purpose-built private files and atomic transitions. Do not add
  message-metadata trust, a database, generalized journal, hostile-local-code
  defense, or delivery retry framework.

Run focused Python/Node/native-provider tests, including mutation and replay,
then full Tier 0, Docker Tier 1, and the pinned Prime Agent 0.9.8 probe. Use one
direct owner review only and no new independent review cycle. Commit/push one
candidate, report, and stop.

## Accepted final Slice 3 vertical: lifecycle closure and bounded reconciliation

Section 28 extends only the accepted private EXPERT file protocol. Product and
scope decisions remain conversational; APIs record exact owner decisions and
never invent them. Inbound messages/details remain non-authoritative.

- A depth-0 owner-only disposition operation derives the current owner session,
  active generation, and unique `SETTLED` report. It records one bounded explicit
  disposition plus required rationale and digest without rewriting the EXPERT
  report. Idempotence requires exact equality; conflicting decisions fail closed.
- An async close operation validates `DISPOSITIONED`, uses only public
  `rlm.list_subagents` and `rlm.delete_subagent` against the stored actual child
  ID, proves definite deletion or absence, then creates `CLOSED` while preserving
  report, settlement, disposition, and deletion evidence. Uncertain or failed
  deletion retains recoverable state and never claims cleanup.
- Explicit purge is allowed only for one exact `CLOSED` receipt/digest after the
  caller confirms durable recording. Authority state is never removed before
  definite child absence.
- Add the smallest exact-owner stale cancellation for expired `PENDING`,
  `FINALIZED`, and `CLAIMED`. A no-child pending launch may close directly;
  published-child states must prove deletion/absence before `CANCELLED`.
  Conflicting phase files or ambiguous/mismatched roster state fail closed.
- `REPORTED`, `SETTLED`, `DISPOSITIONED`, `CLOSED`, and `CANCELLED` keep any
  still-addressable child under the neutral EXPERT kernel and abort provider
  calls. Purge is safe only after child absence.
- Keep purpose-built files and public RLM APIs. Do not manually remove Prime
  Agent session artifacts, trust inbound metadata, retry uncertain provider or
  message work, or add a database, general journal, or hostile-local-code
  defense.

Prove success, exact duplicates, conflicting disposition, wrong owner/generation,
ambiguous or mismatched roster, definite delete failure, conflicting phases,
stale pending, stale child deletion, purge-before-close refusal, and no role
fallback. Update status/preflight/docs for complete Slice-3 readiness, expiry,
and cleanup state. Run focused Python/Node/native tests plus full Tier 0, Docker
Tier 1, and the pinned Prime Agent 0.9.8 probe. Use direct owner review only and
no independent review cycle. Commit/push one candidate, report, and stop. Do not
start Slice 4, landing, activation/restart/UAT, finalization, bookkeeping, or
physical project cleanup.

## Owner-blocked Section 28 narrow repair

The rest of lifecycle closure is directionally accepted. Repair only these two
findings against candidate `1fed99101f3dee95bf6863a3c9298d8c05d96718`:

- Python finalization publishes `FINALIZED` before unlinking `PENDING`. The
  extension may treat `PENDING` plus exactly one `FINALIZED` as a normal transient
  overlap only while waiting within the existing admission deadline. It must not
  admit until `PENDING` disappears and exactly one authority phase remains.
  Persistent `PENDING`+`FINALIZED` at the deadline, or any other multiple
  authority phases, must call `ctx.abort()` before provider use. Preserve the
  existing conflicting-phase refusals. Prove both a transient overlap that
  resolves and a persistent overlap that produces zero provider calls in Node
  and native coverage.
- Export the approved Section 28 public API from Python `__all__`: the lifecycle
  functions `record_disposition`, `close`, `cancel_stale`, and `purge`, plus the
  disposition decisions and disposition size limit. Add an exact public-surface
  assertion.

Do not broaden architecture, redesign deletion, launch a new independent review,
or start Slice 4. Run focused and affected full Tier 0, Docker Tier 1, and the
pinned Prime Agent 0.9.8 probe. Commit/push one narrow repair, report for direct
owner review, and stop.

## Owner-accepted Slice 3 and bounded Slice 4 authority

The owner accepts the repaired lifecycle closure through
`6bceeea133f767d72739a8d88df2639ab75bba96` / tree
`6421f9acc11a4c5e755e37dfa3060c2821bf5326`. Slice 3 is complete.

Slice 4 must produce one immutable Generation A bridge candidate without
activating it:

- Fetch `origin/main` before integration. If it advanced, merge that exact tip
  normally into the published episode branch and record parent order; never
  rebase accepted history.
- Implement the smallest external cutover coordinator required by the approved
  plan and recording-fake-test resident client/launcher inventory,
  executable/build mapping, `shutdown --force --json` sequencing,
  zero-stale-process gates, exact landing/apply/check, one-runtime start/status,
  practical checkpoint recovery, and the ordered resume checklist. It remains
  inert unless an operator explicitly invokes it. This pass may not stop or
  restart real processes or mutate `main` or user-global state.
- Reconcile S1-S3 docs, traceability, managed inventories, recovery runbook,
  provider assertions, and operator instructions. Audit the full Generation A
  bridge inventory without deleting any compatibility resource.
- Build the private preactivation/rollback bundle with exact selected
  global-context and APPEND preimages and metadata, installed inventory,
  selected-file decision, current known-good generation, source topology,
  restore tool/hash, and manifest digest. Keep credentials and unrelated private
  data out. Prove apply/restore only against isolated copies.
- Commit a sanitized, non-self-referential readiness/rollback evidence document
  before freeze. Run complete Tier 0, selected Docker Tier 1, pinned probe,
  focused native/coordinator fakes, diff check, and teardown. Then freeze and
  push one immutable commit/tree with no tracked mutation afterward.

The episode reports the exact frozen packet and evidence to the owning
Conversation and stops. The owning Conversation, not the episode, performs the
plan-required primary-main exact configured independent review after checking
legacy skill/profile hashes and pre/post subject state. Gate A, landing,
activation, live runtime shutdown/restart, UAT, compatibility removal,
finalization, and cleanup remain unauthorized.

## Owner-blocked Generation A revision authority

Candidate `f2f3fcd25dbe3d96f05193261020d26bf79f1213` / tree
`8b4fef1936766c7383a577317ac6d2436f4e72e5`, its private freeze receipts, and
its tracked readiness evidence remain immutable historical evidence. The exact
configured Astra/max report SHA256 is
`4ed03385fc1d54cdecdbbacf5ea720d00b70a9af10b99b1466f7592df50d95e1`.
The owner accepts its five blocking findings as ordinary-operation defects.

Repair only these two existing seams:

1. **Coordinator (B1-B3).** Preflight must reconcile actual observations against
   declared roles and supported compiled/interpreter entrypoints. It must require
   client/launcher absence before shutdown while allowing only the approved old
   daemon/worker set, and bind actual status/build/socket/executable facts.
   Failed, malformed, unknown, or mismatched observations stop before mutation;
   do not scan unrelated programs. After exactly one start, perform a short
   bounded read-only readiness observation loop. It never starts or retries
   again and fails truthfully for wrong identity, duplicates, child exit,
   malformed status, or deadline. Replace syntactic `git revert`/placeholder
   acceptance with one concrete resolvable history-preserving recipe validated
   against prelanding HEAD, candidate, integration-merge parents/mainline, and
   the resulting accepted baseline by a scratch-only inverse or equivalent
   bounded topology proof. Reset, rebase, force, and automatic live
   compensation remain forbidden.
2. **Bundle (B4-B5).** Before resolving paths, `lstat` the originally supplied
   selected-context, destination, bundle-root, and every fixed managed parent/
   leaf component; reject visible or dangling symlinks and non-regular inputs
   while preserving real isolated roots, fixed inventory, and supported macOS
   naming. Do not build a descriptor-chain, ABA, or race framework. Restored
   state includes ordinary mode/uid/gid. Restore required metadata even when
   bytes already match, or fail. `alreadyRestored` is true only when bytes and
   required metadata already match. Unknown content remains all-or-refuse.

Tests must include the report's exact cases: declared live TUI, supported Node
entrypoint, wrong same-version build, delayed readiness with one start,
malformed status, wrong/placeholder rollback and wrong mainline, visible and
dangling links, unchanged-byte mode drift, metadata failure, and replay.
Regenerate only the affected private manifest/proof/readiness evidence, rerun
complete focused/Tier 0/Docker Tier 1/pinned gates, freeze and push one new
immutable commit/tree with no tracked post-freeze change, report it to the
owning Conversation, and stop. The owner will admit one fresh exact configured
reviewer because candidate bytes changed.

## Gate A preflight version-stream repair authority

Gate A was explicitly authorized for accepted Generation A replacement
`ed42db9f20ce7a58689707b188e35028e31abf55` / tree
`7fb098436e13296191ab64ef593c49550c70c162` after an exact configured `PASS`.
Before shutdown or any other live mutation, owner read-only preflight proved that
supported Prime Agent 0.9.8 command
`/Users/jlanders/code/prime-agent/.worktrees/cwd-fix-v0.9.8-r1-source/prime-agent.sh --version`
returns 0 with exact `0.9.8` on stderr and empty stdout. Coordinator
`verify_executable` compares stdout only and therefore stops with
`runtime entrypoint version mismatch`.

Preserve the exact private diagnostic at
`/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/gate-a-ed42db9/preflight-version-stream-block.json`,
SHA256 `c0388aa8ede3912106afc3500370494bd37bdbc56880cc9114c91e8ed161be73`,
and preserve ed42/PASS as history.

Repair only executable version verification. For a return-code-zero version
command, accept the exact expected single-line version from stdout or stderr
only when exactly one stream is populated and the other is empty. Reject a
nonzero result, both streams populated, both empty, multiline or extra content,
and any mismatch. Do not add a general output-normalization layer.

Focused coverage must include stdout and stderr success plus ambiguity, empty,
extra-content, multiline, mismatch, and nonzero failures. A real read-only probe
must run the supported Prime Agent 0.9.8 wrapper and prove its actual stderr
contract. Update only affected documentation, traceability, and private bundle/
readiness/config evidence.

The successor rollback topology must contain the complete newest-to-oldest
linear chain `[successor, ed42db9f20ce7a58689707b188e35028e31abf55,
f2f3fcd25dbe3d96f05193261020d26bf79f1213]`, followed by integration merge
`46147ff887569101b7e64a8466cde5887c15cc31` with mainline 2. It must produce
accepted baseline `c24ba6c1e76585193d4f34f0b0b0233846780442` / tree
`a9955483816af04a4c68468a8e2ce3d0d0d00a5d` in isolated proof.

Run required exact-byte gates, freeze and push one clean immutable successor,
report it, and stop for one fresh exact owner review. Gate A authority is not
transported through the changed candidate bytes: do not execute the invalidated
ed42 config/state or perform shutdown, landing, apply, restart, or UAT in this
repair pass.

## Final stop-loss repair authority — lossless version observation

Fresh exact Astra/max review returned `BLOCK` for immutable Section 32 successor
`47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4` / tree
`a4667c0047a9ea6f3379790d024c3df44754f00c`. Preserve owner report SHA256
`039a66d0ad404d5592913d9476dfef77c6e309dbc16b5dd9a23e3593f6008262`
and reviewer real-`LocalRunner` matrix SHA256
`bf8d9d182c028b77608745237aa286cf416aaf704a35bbd26ea94a0a77a337de`.
The accepted finding is that Python text-mode universal-newline conversion turns
raw CRLF and bare CR into LF before `verify_executable`, so the recording-fake
contract was stricter than the production adapter.

Owner stop-loss reassessment authorizes exactly one final narrow repair. Introduce
a version-specific subprocess observation seam that preserves stdout and stderr
bytes losslessly, or an exact equivalent. Keep the existing ten-second timeout.
Do not alter general `LocalRunner.run(..., text=True)` behavior used by Git,
status, process, and bundle operations.

Version admission requires return code zero, exactly one populated raw stream,
and exact equality with the configured version encoded as UTF-8 followed by one
LF byte. The other raw stream must be empty. Reject nonzero, both streams, neither
stream, no LF, CRLF, bare CR, whitespace, extra/blank/multiple lines, mismatch,
timeout, undecodable bytes, and every non-exact byte sequence. Do not strip,
split lines, remove carriage returns, concatenate streams, regex/substring parse,
or add a shared/general normalizer.

Tests must traverse the real production capture adapter for LF stdout and LF
stderr positives and CRLF and bare-CR negatives on both streams. Preserve the
supported Prime Agent 0.9.8 raw-stderr proof. Prove downstream command absence on
failure plus first-call, replay, and timeout behavior. Update only affected docs,
traceability, private bundle/proofs/config, and gate evidence.

The final successor rollback chain is exactly `[successor,
47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4,
ed42db9f20ce7a58689707b188e35028e31abf55,
f2f3fcd25dbe3d96f05193261020d26bf79f1213]`, followed by integration merge
`46147ff887569101b7e64a8466cde5887c15cc31` with mainline 2. Isolated proof must
produce baseline `c24ba6c1e76585193d4f34f0b0b0233846780442` / tree
`a9955483816af04a4c68468a8e2ce3d0d0d00a5d`.

Run all required exact gates, freeze/push one clean immutable successor, report
it, and stop for the one allowed final fresh exact owner review. Do not touch
primary `main`, the owner's private overlay, prior configs, Prime Agent source,
live/global state, Gate A, UAT, S5, compatibility removal, finalization,
bookkeeping close, or physical cleanup.

## Docker validation recovery

The owner Conversation restored Docker Desktop. Independent health returned
server version `29.6.2`, and the exact Docker-focused gate passed 3 tests with an
isolated pinned-0.9.8 selector. No credential, tracked configuration, Gate A, or
live Prime Agent state changed.

## Gate A bridge UAT acceptance and bounded Slice 5 authority

The owner accepted Gate A bridge UAT after post-restart evidence proved the
managed owner guide and identity worked, the exact episode resumed cleanly with
no injected legacy or retired work-control package, and a saved ordinary session
completed only the harmless read-only `VISION.md` task without mutation.
Compatibility cleanup may therefore advance only through the smallest practical
Slice 5 vertical slice.

Slice 5 remains bounded to the plan's isolated legacy-compatibility removal and
known-state restore path. It also removes the operator-rejected managed-directory
unexpected-entry purity gates from apply/check and their direct tests. Do not
replace those gates with cache exceptions, new integrity machinery, or generalized
defenses. Retain expected-file comparisons, managed package hash/import
validation, role generation and lock checks, and ordinary safety checks. Do not
start Slice 6, apply final mode to the host, run Gate B, finalize, or physically
clean up resources in this slice.

## Slice 5 acceptance and bounded Slice 6 authority

The owner accepted exact Slice 5 candidate
`98ed8d14e028622d07a120fbd4af730bd4171e38`, tree
`2b83d87a5adfab4c3f6e274b3149df54c588631e`, after verifying its exact diff,
clean synchronized push state, retained log hashes, complete Docker/Tier 0/probe
evidence, and independent PASS. That candidate and its evidence are the accepted
Slice 6 baseline.

Advance only Slice 6 as already specified: perform the fresh foreign-consumer
audit, remove the remaining legacy compatibility resources, and reconcile the
final source tree as one minimal reviewable vertical slice. Do not add replacement
frameworks, generalized integrity machinery, or new defensive scope. Do not
apply final mode to the host, run Gate B, begin Slice 7 freeze/review work,
archive or finalize the episode, merge, or physically clean up resources.

## Slice 6 owner-requested omission repair

The owner reviewed Slice 6 candidate
`0e96838d430049980fa9ab2f6f8fc2762f2c127c`, tree
`c8474abac9ba25da740c0beae858223aee4c8b17`, and requested one bounded
successor rather than accepting the candidate. The preserved pre-landing
operator edit to the now-deleted
`.prime/agent/profiles/expert-reviewer.md` required semantic reconciliation
before deletion, but that intent was not made explicit in the managed reviewer
source.

Repair only this omission. Migrate the operator edit's intent into the managed
official reviewer guidance. Give implementers repair intent and useful general
direction without prescribing exact code changes or wasting report tokens.
Retain the current structured PASS/BLOCK report contract and require each
blocking finding to remain actionable enough for a strong one-pass repair.
Do not restore the standalone profile or create another reviewer authority.
Update only directly affected tests, hash expectations, traceability, and Slice
6 evidence; run proportionate focused checks; commit and push one clean Slice 6
successor for owner review.

Do not broaden Slice 6, begin Slice 7, apply final mode to the host, run Gate B,
archive or finalize the episode, merge, or physically clean resources.

## Revised Slice 6 acceptance and bounded final-candidate authority

The owner accepted revised Slice 6 candidate
`64bbee26c363c87ef85446da707900439c869620`, tree
`d9e9ba451cfcc2426ad200d8e05ed7e086f9abe1`, after verifying the single
reviewer-guidance repair, managed hashes, focused Docker and pinned-probe
evidence, exact independent PASS, clean synchronized push, and retained scope
boundary. That immutable commit/tree is the final-candidate preparation
baseline.

Before freezing the final candidate, reconcile exactly two preserved pre-landing
local files from
`/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/gate-a-f2e98e2/prelanding-local-edits`:

- `.agents/skills/goals-and-heartbeats/SKILL.md`: source SHA256
  `6c9daca98cf818a784334493190f2c4ea17218ffb61e52b52919105178a6aaa1`.
  The accepted baseline SHA256 is
  `1aa4f6391ceb96800208a0dd24aa20890fc06ef67b6a08f1afdb8b05977a7783`;
  the preserved file differs only by the operator's no-goal-budget/unbounded
  token-authority sentence in the opening operational paragraph. Reconcile that
  intent semantically and exactly where the current canonical wording permits;
  do not restore unrelated policy or create another skill authority.
- `.beads/interactions.jsonl`: preserved source is 30,963 bytes / 105
  newline-terminated records at SHA256
  `d3e5956f184694018426be8993452300401be361bd9ef6762018e39d8ab84a70`.
  At handoff, the tracked file is its exact 29,530-byte / 99-record prefix at
  SHA256 `05f185840bda2ae7a8901796da4b19aa5b055183fdcb9b9ba5ee905d5283f8fd`.
  Append the exact six-record, 1,433-byte suffix (SHA256
  `3f1935e989dfb08f7635a1ebc53afd2fd42ac5ec368646881350f5e64720a5ac`)
  losslessly and in order. Never overwrite, reorder, normalize, or drop any
  current interaction; if the destination advanced, preserve it and append only
  the exact missing preserved records after proving their identity.

Complete the normal Ralph plan lifecycle before freeze: move the finished active
`.ralph/plans/SPECIFICATION.md` and `.ralph/plans/EXECUTION_PLAN.md` into
`.ralph/plans/archive/official-lean-compatibility-cleanup/` and update
`.ralph/plans/archive/README.md`. The active root plan files must be absent from
the final candidate. This archival does not close the bead or finalize episode
bookkeeping; those remain reserved for the operator's later terminal decision.

After those bounded reconciliations, perform only the already-approved final
candidate preparation, immutable freeze, exact gates, and exact official review.
Keep the implementation lean and add no new mechanism. Do not merge, apply final
mode to the host, run the live cutover, restart Prime Agent, finalize bookkeeping,
or physically clean resources. Report one immutable final candidate with
evidence and stop.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `prime-claw-h6w.30`, incident `prime-claw-gv7.1`, and epic `prime-claw-gv7` link the corrected contract, candidates, evidence, activation gates, and final disposition.
- [x] #2 The selected global context contains one managed neutral block while unrelated user content and ordinary file metadata are preserved.
- [x] #3 Slice 1 uses a readable practical installer and simple receipt; obsolete F1–F9 adversarial transaction machinery and tests are removed or no longer enforced.
- [x] #4 Local project AGENTS/CLAUDE, SYSTEM, and APPEND files do not structurally remove the neutral floor.
- [x] #5 Managed work fails closed when context files are explicitly disabled or trusted role state disagrees.
- [x] #6 Provider evidence shows the neutral kernel only in system instructions and no fresh user/custom oversight package.
- [x] #7 `prime-claw-oversee-episode` remains the on-demand Conversation policy and `execute` remains the bounded EPISODE procedure.
- [x] #8 `prime-claw-official-expert-review` provides exact-model admission plus contract-bounded `PASS`/`BLOCK` and non-blocking `ADVISORY`/`SPEC_QUESTION` outcomes.
- [x] #9 Slice 1 passes focused practical tests, complete Tier 0, Docker Tier 1/probe, and one normal review under the trusted-local model.
- [x] #10 The bridge generation passes complete tests/review, separately authorized landing/apply/restart, and accepted interim UAT.
- [x] #11 Compatibility removal does not begin before criterion 10 is recorded.
- [x] #12 The final generation has no Prime Claw-managed global APPEND block, old project oversight skill/link, standalone expert profile, duplicate policy copy, or broken symlink.
- [x] #13 Historical provider filtering, deterministic lifecycle behavior, and retired-overlay regression controls remain.
- [x] #14 The removal generation passes complete tests/review, separately authorized landing/apply/restart, and accepted final three-context UAT.
- [x] #15 Both rollback points preserve accepted history and provide practical preimages plus manual stop/recovery when state is ambiguous; exhaustive adversarial crash recovery is not required.
- [x] #16 No active foreign worktree/session can exercise stale compatibility behavior at final acceptance.
- [x] #17 Primary `main` is clean and synchronized after every landing and at completion.
- [x] #18 Plausible excluded hazards are documented with promotion triggers rather than silently ignored or automatically implemented.
- [x] #19 The episode remains active through the clean target state, is finalized only after explicit final acceptance, and is physically cleaned only after separate operator authority.
- [x] #20 Prior task criterion: A reviewed in-place specification and plan govern one fresh episode through bridge and final cleanup. The selected global context contains one exact neutral kernel with unrelated bytes preserved; provider evidence shows system-channel delivery and zero fresh user/custom package; managed role guidance and exact EXPERT admission work or fail closed under supported kernel modes; interim tests/review/landing/apply/restart/UAT pass before cleanup; final state removes Prime Claw's global APPEND block, old project skill/link, standalone profile, and duplicate policy while retaining historical filtering and evidence; final tests/review/landing/apply/restart/UAT pass; rollback is verified at both gates; finalization and physical cleanup retain separate operator authority.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Imported from `.ralph/plans/archive/official-lean-compatibility-cleanup/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Historical/current status statements are preserved literally; the task status and Final Summary state the migrated outcome.

# Execution Plan — Official lean role protocol completion and compatibility cleanup

> **Status:** Sections 1-24 are accepted history. Section 25 remains audit history
> at `3586dcc0cb02f314e7c50f661d956f794637f17c`; the owner-approved Section 26
> correction supersedes only its terminal disposition. Existing episode
> `01a10774-0155-7316-a329-50ee5f7d17be` remains the sole implementation episode,
> and the Section 26 candidate is implemented and fully validated pending
> commit/push/report.
>
> **Superseded review:** the 2026-10-03 plan PASS and both later Slice-1 BLOCK
> reports remain historical evidence, but their hostile same-UID and exhaustive
> crash-consistency assumptions no longer define acceptance.
>
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md), operator-corrected for
> a trusted-local ordinary-failure model and DONE-over-perfect delivery.
>
> **Selected future folder:**
> `.ralph/plans/future/official-lean-compatibility-cleanup`.
>
> **Tracking:** implementation `prime-claw-h6w.30`; incident
> `prime-claw-gv7.1`; systemic correction epic `prime-claw-gv7`.
>
> **Execution shape:** the existing episode completes seven bounded slices only
> as needed, with two separately authorized activation generations. Scope,
> landing, user-global mutation, restart, UAT, finalization, bookkeeping, and
> cleanup retain their separate authority boundaries.

## 1. Outcome

At completion, Prime Claw has one progressive, fail-closed role protocol:

- one concise role-neutral kernel is installed as a managed region in the exact
  user-global AGENTS/CLAUDE context file Prime Agent selects;
- the kernel reaches providers only through `Context.systemPrompt` and remains
  present when project SYSTEM or APPEND files are selected;
- managed role actions fail before provider or lifecycle mutation when the
  kernel, trusted identity, or role-specific activation evidence is absent or
  inconsistent;
- global `prime-claw-oversee-episode` supplies Conversation judgment on demand;
- existing `execute` remains the bounded EPISODE implementation procedure;
- global Python-backed `prime-claw-official-expert-review` performs exact-model,
  exactly-once EXPERT admission or reports a deterministic unavailable result;
- historical user-shaped oversight packages remain filtered at the provider
  context seam;
- the retired detailed work-control overlay remains absent; and
- the final installed generation has no Prime Claw-managed global APPEND block,
  project-local `oversee-episode` skill/link, or standalone expert profile.

The same episode remains active from first implementation through bridge UAT,
compatibility removal, final UAT, and documentation reconciliation. Passing the
bridge does not complete or finalize the episode.

### 1.1 Operator scope correction and complexity budget

The 2026-10-06 operator decision supersedes incompatible later text in this
plan. The product trusts the host, checkout, installer, destination account, and
same-UID user during a local operation. It handles ordinary malformed state,
accidental edits, cooperative concurrency, interrupted commands, and normal
filesystem failure. It does not promise hostile same-UID race resistance or
power-loss consistency at every syscall boundary.

Bias toward **DONE over perfect**. The selected-context manager should remain a
straightforward stdlib installer using ordinary validation, one cooperative
lock, same-directory atomic replacement, and a simple fixed-inventory receipt.
Ambiguous recovery stops and asks the operator. Descriptor chains, continuous
inode authority, exchange/restore protocols, multi-phase journals, and exhaustive
race/crash harnesses exceed the Slice-1 complexity budget.

Review findings outside this model are recorded as advisory hardening candidates
with promotion triggers. They do not block or silently expand scope. One normal
review is sufficient. A third repair/review cycle is forbidden without fresh
operator scope/architecture consultation.

## 2. Planning readiness and repository audit

### 2.1 Readiness decision

Planning is **ready**.

- The selected folder exists and contains one complete `SPECIFICATION.md`.
- The specification has 23 unique normative requirements (`ORP-001` through
  `ORP-023`), explicit non-goals, staged authority gates, rollback requirements,
  and final acceptance criteria.
- The designated Prime Agent Expert returned PASS on the exact reviewed content
  SHA after correcting the two v0.9.8 API overclaims about returned reasoning and
  custom Python kernels.
- The operator selected this exact folder with `/plan`, chose one episode through
  both generations, and left no unresolved product decision for planning.
- `prime-claw-h6w.30` is open and unblocked. It remains the single durable task
  authority; this plan does not create parallel slice Beads.

### 2.2 Audited baseline

Planning audited synchronized `main` at
`68815dd81e90287b16ade078c7118a7cc8aa0d3f`. Implementation records its own exact
promotion parent because `main` may advance after planning.

Current behavior and files are:

- `src/prime-agent-plugin/APPEND_SYSTEM.md` is the 246-word
  `PRIME_CLAW_CONVERSATION_IDENTITY_V1` block.
- `scripts/apply-prime-agent-plugin.sh` and
  `scripts/check-prime-agent-plugin.sh` install/check that block in the selected
  destination's `APPEND_SYSTEM.md` through
  `scripts/manage-prime-agent-append-system.py`.
- `conversation-oversight.ts` keeps a manually duplicated exact block, validates
  it for managed owner/EPISODE calls, filters historical package records, and
  uses `ctx.abort()` from the `context` hook after caught classification errors.
- Ordinary sessions currently tolerate a missing/shadowed block; managed owner
  and bounded EPISODE paths do not.
- At the audited predecessor baseline, `.ralph/skills/oversee-episode/SKILL.md`
  was the 1,547-word combined legacy procedure and
  `.agents/skills/oversee-episode` linked to that directory.
- `.prime/agent/profiles/expert-reviewer.md` contains the exact model, reasoning,
  and rubric, but Prime Agent does not natively discover profile files.
- Plugin source remains inert under `src/prime-agent-plugin/`. There is no
  project-local `.prime/agent/extensions` copy.
- Bare apply/check fail closed. User-global mutation is allowed only with
  `--user-global` from clean synchronized primary `main`; linked worktrees are
  refused.
- Tier 1 is Docker-authoritative. Native Prime Agent probes must use
  `scripts/run-prime-agent-probe.sh`.

The active predecessor documents must be preserved when promotion replaces them:

| File at the planning baseline | SHA256 |
|---|---|
| `.ralph/plans/SPECIFICATION.md` | `09cce8ae0898da292fb34f843b3e99b3a5144898934c7e13408a29e76ae2802a` |
| `.ralph/plans/EXECUTION_PLAN.md` | `cf9a75e45d4ccabb42e3c36feed05ef9678227bc58d9e8514aea99145cabe888` |

The episode-promotion commit replaces active plan files but leaves
`.ralph/plans/archive/` intact. Slice 1 reconstructs these exact predecessor
bytes from the promotion parent, verifies both hashes, and archives them under
`.ralph/plans/archive/official-lean-session-protocol/` before other product
changes.

### 2.3 Concurrent-work audit

At planning time two foreign worktrees exist:

- `episode/project-wide-testing-strategy`, with an active episode session; and
- `episode/phase3a-brain-hosting-completion`, with an idle saved episode.

They remain independent. This plan never edits, rebases, lands, finalizes, or
cleans either branch/worktree. Each activation must obtain a durable checkpoint
and quiescence acknowledgment from affected owners. Compatibility removal is
blocked while any active foreign worktree/session can still exercise the full
legacy skill/profile or stale loaded policy. A foreign owner may converge its
own branch, reach an operator-approved non-resumable pause, or complete its own
terminal flow; this episode cannot force that outcome.

## 3. Architecture decisions resolved by planning

### 3.1 Canonical kernel and generated runtime bytes

Add `src/prime-agent-plugin/ROLE_KERNEL.md` as the sole authored neutral-kernel
source. Use a distinct marker pair and sentinel:

```text
<!-- prime-claw:role-kernel:start -->
PRIME_CLAW_ROLE_KERNEL_V1
...
<!-- prime-claw:role-kernel:end -->
```

Add a deterministic stdlib generator/checker that produces
`extension-support/role-kernel.generated.ts` with the exact markers, bytes, and
SHA256 used by runtime parsing. The generated file is checked in so a missing
runtime Markdown file cannot prevent extension registration. Apply, check,
Tier 0, and Tier 1 all fail when generated bytes do not exactly match the
canonical Markdown. No person maintains two policy copies.

The legacy APPEND markers remain distinct throughout the bridge. Marker-looking
project context counts during integrity parsing and causes managed work to fail
closed rather than being silently deduplicated.

### 3.2 One practical role-protocol manager

Use `scripts/manage-prime-agent-role-protocol.py` as the small stdlib manager for:

- one managed neutral-kernel region in the selected global context file;
- the two managed global skill directories;
- a private ownership manifest with a fixed managed inventory;
- bridge retention and later exact removal of the legacy APPEND region; and
- simple receipt-based manual or guarded restore.

Selection follows Prime Agent priority: `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`,
`CLAUDE.MD`; create `AGENTS.md` only when none exists. Under one cooperative
`agentDir` lock, validate the selected target, reread it, preserve unrelated
bytes/newline form/ordinary metadata, and perform an ordinary same-directory
atomic replacement. Reject malformed markers and obvious symlink, non-regular,
or unreadable targets visible during validation. Detect an ordinary changed
preimage before final replacement and stop.

The receipt records the fixed owned inventory, pre/post hashes, preimages, and
whether the context file was installer-created. Restore only known pre/post
states. Unknown state causes refusal and manual instructions. Never delete a
pre-existing context file; delete an installer-created file only when it still
matches its known created state.

The receipt is diagnostic recovery material, not a tamper-proof authority
against the local owner. Do not implement multi-phase transaction journals,
continuous descriptor/inode authority, hostile same-UID ABA/FIFO defenses, or
power-loss proofs. Preserve such ideas only as advisory hardening candidates.

`src/prime-agent-plugin/role-protocol.json` still declares `bridge` for
Generation A and `final` for Generation B. Shell apply/check does not accept a
phase override. Bridge retains the legacy APPEND block; final removes only its
exact managed region after accepted interim UAT.

### 3.3 Managed Conversation activation

Install `src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md`
into `$agentDir/skills/prime-claw-oversee-episode/`. Keep it between 300 and 600
words and limited to supervision judgment from `ORP-006`.

Add a native activation tool with a unique Prime Claw name. It reads the exact
trusted installed skill path, verifies source/install hash and collision state,
and returns only the guidance plus a public version/hash as an on-demand tool
result. The hidden receipt binds the exact activation tool call and result
message, session, prospective location or active episode, protocol/lifecycle
generation, installed path, version, and hash. It grants no authority by itself.

Tool results are provider-visible only on the following model iteration. The
`context` hook therefore implements a single-use disclosure protocol:

1. an issued receipt permits only its exact validated guidance tool result on
   exactly the first continuation/provider call;
2. immediately before returning that first provider context, the hook records
   the receipt consumed under the same trusted session/lifecycle state;
3. private receipt entries never reach the provider; and
4. stale, mismatched, copied, replayed, or already-consumed guide bodies are
   removed from later contexts.

A failed first provider attempt does not authorize replay. The owner may request
a fresh activation only after the old receipt is definitely consumed/expired and
current state is revalidated. Provider captures must prove exactly one on-demand
`toolResult` disclosure and zero guide text in system, user, custom, or later
tool-result channels.

- Before a future episode promotion, the receipt binds the root Conversation to
  the exact operator-selected future location.
- For an active owner, it binds the exact session and episode generation.
- Handoff and finalization require a current matching active-owner receipt, but
  UAT uses read-only readiness inspection rather than either mutating tool.
- Role, location, episode, lifecycle, protocol, path, skill hash, tool-call ID,
  result identity, or consumption state mismatch makes the receipt invalid.
- A project skill collision or shadowed path blocks managed activation.

This migration episode is created under the accepted predecessor generation, so
its initial `/implement-spec` cannot require a tool that does not exist yet.
After bridge restart, its first owner UAT interaction must activate the new guide
before any oversight decision. All later promotions use the new pre-promotion
receipt.

During Generation A, replace the old project-local skill body with a short
forwarding/deprecation shim that contains no supervision or EXPERT policy and
retain the existing symlink. The external cutover coordinator stops every old
client/runtime before this shim reaches `main`, then lands and installs the
managed global skill before starting the sole new runtime. No loaded session may
read the shim in the landing/install gap.

### 3.4 Managed role and provider guard

Refactor `conversation-oversight.ts` around the generated neutral-kernel bytes
and explicit trusted managed-role state:

- exact active owner;
- bounded EPISODE;
- reservation-bound official EXPERT;
- generic bootstrap/RLM/inline/daemon child with no managed authority; and
- ordinary unmanaged session.

On every `context` event, continue filtering historical package records. Managed
roles require exactly one exact neutral block and consistent trusted identity.
Missing, malformed, reversed, nested, duplicate, stale, or disagreeing blocks
call `ctx.abort()` and prove zero provider calls. Ordinary sessions may continue
when context files were explicitly disabled, but promotion and every managed
role action remain unavailable. Throws are tested only as a fail-open control;
production rejection never relies on a thrown extension handler.

Do not add a production provider-payload rewrite. `before_agent_start` may add
covered role-specific guidance only if later proof requires it, but it is not the
neutral-floor transport and cannot weaken direct-idle coverage.

Provider assertions are role- and channel-specific:

- standard ordinary, Conversation, and EPISODE calls contain exactly one neutral
  kernel in `Context.systemPrompt`, zero historical package/private
  receipt/EXPERT rubric in user or custom messages, and only the single exact
  Conversation guide `toolResult` on its activation continuation; an explicitly
  context-disabled ordinary negative control may contain zero and has no managed
  authority;
- an admitted EXPERT contains exactly one neutral system kernel and exactly one
  bounded rubric+packet in the one user-role task published from the package's
  canonical private `FINALIZED` launch state after child/session/header lineage
  validation and atomic claim. Inbound `agent_message` content and metadata have
  zero authority; the bounded task appears nowhere else and is never treated as
  an always-on oversight injection; and
- every role contains zero retired work-control overlay and zero legacy
  oversight package.

Tests capture system prompt, provider roles, tool-call/result IDs, canonical
private launch/child/session/header lineage, and call sequence so a broad zero-content assertion
cannot contradict the two required on-demand disclosures.

### 3.5 Official EXPERT package and trusted two-phase admission

Add the exact managed directory
`src/prime-agent-plugin/skills/prime-claw-official-expert-review/` containing:

- `SKILL.md` with the public call and completion contract;
- `pyproject.toml` with no `prime-agent-runtime` or `agent_message` dependency;
- `src/prime_claw_official_expert_review/` with typed async admission helpers;
- one strict machine-readable reviewer configuration; and
- one canonical rubric migrated from the standalone profile.

`rlm.spawn` has no role field, and a name/prompt/depth/model-visible dictionary
cannot create trusted EXPERT identity. Use a supported two-phase, single-use
protocol without inventing a plugin Python `host_request`:

1. A unique owner-only native reservation tool requires a current Conversation
   activation receipt and active episode. It atomically records a mode-0600
   reservation bound to owner session, episode/protocol generation, unique child
   name, exact configured model, requested reasoning, immutable repository/path,
   commit, packet digest, expiry, and opaque nonce.
2. The Python skill receives that reservation record, calls `rlm.find_models`,
   spawns one generic bootstrap child with explicit model/thinking, verifies the
   actual handle model, and reports the exact child handle/session back to the
   owner. The harmless bootstrap remains a generic child with no review authority.
3. The reservation is handle-bound through a native owner tool before delivery.
   The owner then performs exactly one guarded `agent_message.send` containing
   nonce plus validated rubric/packet.
4. On the child's first review turn, the extension validates trusted host
   sender/target metadata, actual target child session/model, packet digest, and
   one unconsumed handle-bound reservation. Under one lock it consumes the nonce
   and binds that exact child/session as EXPERT before the review provider call.
5. Only a complete report from that exact bound child is acceptable. A native
   owner settlement/readiness path validates sender identity, report digest,
   immutable pre/post repository state, and reservation state before evidence is
   preserved and the settled child is deleted.

Define reservation states and terminal handling for reserved, handle-bound,
consumed/bound, settled, expired, definite pre-delivery failure, uncertain
delivery, child crash, replay, and handle/model/session mismatch. Definite
pre-delivery failure may be explicitly released; uncertain delivery is never
resent and remains blocked for owner adjudication/expiry. Expiry or cleanup
removes authority but never fabricates a report. Copied nonce, child name, prompt,
CWD, depth, or packet prose cannot acquire the role.

The Python package uses `import rlm` and lazy-imported `agent_message`. It records
exact requested reasoning and successful spawn admission but never claims
`RlmSpawnHandle` returned reasoning. The extension uses only supported native
tools, session/host metadata, files, and hooks; Prime Agent v0.9.8 does not allow
extensions to register arbitrary Python host-request methods.

Add a deterministic native status/preflight path so a missing Python import can
return `UNAVAILABLE` before reservation, model, message, or lifecycle mutation.
In default managed-kernel mode, apply/check identify the exact managed-kernel
interpreter, validate the installed package source with that interpreter without
editing the kernel venv, and record that Prime Agent skill sync is pending the
coordinated restart; post-restart runtime preflight then proves the discovered
import and exact version/hash. When `PRIME_AGENT_KERNEL_PYTHON` selects an
external interpreter, apply/check and runtime preflight execute that interpreter
directly and require an already importable exact version/hash; they never inject
a source path or install into it. Missing, stale, or mismatched modules are
visibly unavailable and block required review.

Generation A retains `.prime/agent/profiles/expert-reviewer.md` as migration
evidence only. The global skill plus native reservation/binding protocol is the
sole current authority after bridge UAT.

### 3.6 External cutover coordinator

Use `scripts/coordinate-prime-agent-role-cutover.py` as a bounded,
operator-launched helper for the separately authorized Gate A/B sequence. It is
not an autonomous agent, product orchestrator, or transaction engine. It makes no
review, merge, rollback, or acceptance decision.

The helper performs a dry-run/preflight, records simple durable checkpoints, and
executes only the authorized sequence: verify reviewed refs and runtime identity,
confirm affected clients are quiescent, stop the old runtime, run the approved
landing and apply/check steps, start one expected runtime, and print the ordered
owner/episode/ordinary-session resume checklist.

It records observed local/remote refs, apply receipts, runtime identity, and the
last completed checkpoint. On failure or uncertainty it stops. It automatically
restores only a fixed-inventory surface whose current content matches a known
postimage; all other recovery is an operator-guided normal Git/global restore
from preserved preimages. It never retries an uncertain push or restart.

Focused fake tests cover ordinary failure before shutdown, after shutdown,
before/after confirmed landing, during apply, and during runtime start. They do
not attempt exhaustive signal timing, journal corruption, or every possible
partial transaction state. Real Gate runs remain operator-launched; no active
model restarts itself or verifies its own death.

### 3.7 Evidence locations

Use three stores without duplicating authority:

1. **Raw/run-local:** `.test-results/official-lean-role-protocol/<run-id>/`
   for complete test/probe logs. This remains ignored.
2. **Owner-private activation evidence:**
   `~/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/official-lean-role-protocol/<generation>/`
   for mode-0600 global-file preimages, installed inventories, provider captures,
   and restart/UAT receipts. Do not commit user-global file contents.
3. **Durable tracked summaries:**
   `docs/evidence/official-lean-role-protocol/` for sanitized bridge/final
   candidate and activation summaries containing hashes and private-artifact
   references, never credentials or unrelated user instructions.

All tracked summaries are complete and committed before an exact candidate is
frozen. They contain no self-referential final commit/tree or later review result.
After freeze, exact candidate/tree, test/reviewer/admission digests, and
activation results live only in Beads/private receipts until a separately
authorized deterministic bookkeeping commit. No tracked byte changes between
exact review and landing.

`prime-claw-h6w.30` records every slice commit, exact candidate/tree, review
identity/disposition, evidence digest, activation decision, rollback point, and
terminal disposition.

## 4. Dependencies and delivery discipline

### 4.1 Strict sequence

```text
operator-corrected specification + plan
  ↓ existing episode resumes through canonical owner handoff
S1  canonical kernel + selected-context installer + predecessor archive
  ↓
S2  managed-role integrity + Conversation activation + forwarding shim
  ↓
S3  official EXPERT package + kernel-mode preflight
  ↓
S4  Generation A integration, evidence, exact review, rollback bundle
  ↓ operator separately authorizes landing/apply/restart
Gate A  bridge activation + interim UAT + explicit acceptance
  ↓ accepted Gate A only
S5  final legacy-removal and restoration mechanism
  ↓
S6  remove compatibility resources + final runtime/docs reconciliation
  ↓
S7  Generation B integration, evidence, exact official EXPERT review,
    rollback bundle
  ↓ operator separately authorizes landing/apply/restart
Gate B  final activation + final UAT + explicit acceptance
  ↓
archive/bookkeeping → finalize exact episode
  ↓ separately authorized physical cleanup only
```

No slice after S4 begins before Gate A acceptance is recorded. No episode
finalization occurs between generations.

### 4.2 Per-slice rules

Each implementation slice is one small end-to-end capability and must:

1. verify episode identity, branch/worktree, corrected specification/plan, and Bead state;
2. inspect current `origin/main` without modifying foreign work;
3. prefer deletion or topology simplification over another defensive layer;
4. add focused proof for retained behavior, not speculative adversarial matrices;
5. update current docs and Beads with concise evidence;
6. run the gates invalidated by the change, including complete Tier 0 and Docker Tier 1 after plugin-source changes;
7. commit and push one reviewable capability with clean branch equality; and
8. stop for owner review.

Potential out-of-model hazards are logged with a concrete promotion trigger. They
are not implemented automatically. After two repair/review cycles on a slice,
stop for operator consultation. If support machinery grows materially faster
than product behavior or introduces a new transaction/recovery protocol, reopen
the architecture and simplify.

Do not close `prime-claw-h6w.30` per slice. Published accepted commits are never
rewritten. Integrate later `main` only through normal history-preserving Git and
rerun gates invalidated by that integration.

### 4.3 Candidate gates

Each Generation A/B candidate requires:

- complete Tier 0 and selected Docker Tier 1;
- the pinned Prime Agent probe and focused tests for changed retained behavior;
- `git diff --check`, a clean candidate, and local/remote equality;
- concise commit/tree, dependency, log, and teardown evidence;
- one independent normal exact-commit review bounded by the approved threat model; and
- owner acceptance before landing.

A reviewer may `BLOCK` only for a concrete retained functional/safety failure.
Plausible out-of-model edge cases are `ADVISORY`; scope questions return to the
operator. No recursive red-team workers or material-finding-free adversarial
review are required.

Generation A continues to use the accepted primary-main admission path and exact
configured reviewer. Generation B uses the installed official EXPERT package.
Unavailable required admission blocks honestly; no fallback model is selected.
The admission mechanism remains exact, but the review rubric is proportional.

## 5. Requirement traceability

| Requirement | Owning slice/gate | Planned proof |
|---|---|---|
| ORP-001 canonical neutral kernel | S1 | canonical Markdown, generated-byte parity, marker tests |
| ORP-002 guarded selected context | S1, S5 | candidate-priority, byte/metadata/concurrency/selection-drift tests |
| ORP-003 system channel only | S1, S2, S4, S7 | provider captures and session-JSONL assertions |
| ORP-004 per-provider integrity | S2 | malformed matrix, explicit abort, zero-provider-call proof |
| ORP-005 explicit context opt-out | S2 | CLI/SDK no-context ordinary-pass and managed-block tests |
| ORP-006 lean Conversation skill | S2 | word/content exclusions, install/hash/collision tests |
| ORP-007 guidance activation | S2, Gate A, Gate B | on-demand output, receipt invalidation, handoff/finalize gates, model UAT |
| ORP-008 bounded `execute` role | S2, S4, S7 | unchanged skill assertions and negative role-authority tests |
| ORP-009 official EXPERT | S3, Gate A, S7 | exact model/send/admission/report and unavailable matrix |
| ORP-010 semantic read-only | S3, S4, S7 | immutable packet plus pre/post HEAD/status evidence |
| ORP-011 role scoping | S2, S3 | root/owner/episode/expert/generic/ordinary matrix |
| ORP-012 historical filtering | S2, S6, S7 | legacy saved-session replay and non-vacuous fixtures |
| ORP-013 retired overlay absent | every candidate | positive/negative provider assertions and installed inventory |
| ORP-014 one fresh complete episode | promotion, all slices | one durable episode identity retained through both gates |
| ORP-015 bridge generation | S1–S4, Gate A | exact bridge candidate, retained legacy files, shim, activation receipt |
| ORP-016 interim UAT | Gate A | owner/episode/ordinary plus shadow/direct-idle matrix and rollback proof |
| ORP-017 compatibility removal | S5–S7 | exact deletion/absence audit after accepted Gate A |
| ORP-018 final UAT/completion | Gate B | final three-context UAT, operator decision, terminal sequence |
| ORP-019 isolated gates | every slice, S4, S7 | focused logs plus full candidate suites/reviews |
| ORP-020 correlatable evidence | S4, S7, both gates | receipts linking commit/tree/install/provider/reviewer/teardown |
| ORP-021 two rollback points | S4/Gate A, S7/Gate B | isolated restoration plus history-preserving source rollback |
| ORP-022 current documentation | S1–S3, S6 | audited current docs/index/runbooks in same commits |
| ORP-023 immutable history | S1, all slices | exact predecessor archive, no historical rewrites |

## 5.1 Active Slice-1 scope-reduction checkpoint

The first candidate `1eba414c2157740afb45dba4661a95d9a6d63785` and second
candidate `f4b858cbd92cf43c86fac49de60d43e9daa9342b` remain rejected historical
evidence. Their BLOCK reports remain useful, but only concrete ordinary-product
hazards survive this scope correction. F1–F9 hostile same-UID and exhaustive
crash-consistency work is not an active repair contract.

Before this plan correction, the six-file uncommitted F1–F9 draft was preserved
at `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/official-lean-scope-reduction-20261006T041523Z/paused-f1-f9-draft.patch`, SHA-256
`15c8399ac44c642484997716a08e85827bcc72bed1f29587cad9531ffee4ba1b`. Manifest SHA-256: `d58d4c1c8a34d84f89d88ab19741e035a82e158133cce0546b0f1557c2fca2a8`. The current episode
must simplify from its preserved state or the smallest useful historical base; it
must not finish the abandoned state machine.

Corrected Slice 1 completed and was owner-accepted on 2026-10-06 at commit
`57d26e582c583a81de370051b129f74f5b13ee45`, tree
`d1739c3a2ffee4512d6741480b72792e3a8d4098`. It replaced the paused manager with a
straightforward cooperative-lock/atomic-replacement implementation and a
fixed-inventory known-state receipt. Transaction journals, descriptor chains,
inode-generation authority, exchange restoration, exhaustive fault hooks, and
the F1–F9 race matrices are absent. The sole bounded review found one in-model
cooperative-lock ordering defect; its narrow repair and exact waiter regression
were owner-verified and every full gate reran green. Incident `prime-claw-gv7.1`
is closed. Systemic epic `prime-claw-gv7` and advisory H1 remain open for
dogfood. Slice 1 is immutable accepted history.

## 5.2 Active Slice-2 vertical checkpoint

The current execute pass delivers only the first small Slice 2 capability:
managed active-owner and bounded-EPISODE provider calls bind to the generated
neutral role-kernel bytes, malformed or missing managed context aborts before
provider dispatch, explicit no-context ordinary sessions remain usable, and
private bounded identity is no longer copied into provider-visible messages.
Existing lifecycle state and historical-package filtering are reused.

This candidate does not add the managed Conversation skill, activation tool,
receipts, lifecycle readiness gates, or project-skill shim. Those remain the next
Slice 2 capability after owner review. Do not begin Slice 3, land, mutate
user-global state, restart, run UAT, finalize, or clean up.

**Candidate evidence (2026-10-06):** focused native/provider migration 11 passed;
Tier 0 291 passed; Docker Tier 1 60 passed; pinned Prime Agent 0.9.8 installed
runtime probe PASS. Evidence and reproducible commands are in
`docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-managed-role-integrity.md`.
The candidate awaits commit, push, and owner review; later Slice 2 activation
work remains untouched.

## 6. Slice 1 — Simplify and complete the neutral-kernel installer

**Dependency:** operator-approved 2026-10-06 scope correction.

**Capability delivered:** isolated apply/check installs one neutral role kernel in
the selected global context, retains legacy APPEND, preserves ordinary user
content, and provides simple known-state restore without an adversarial
filesystem transaction engine.

### Preserved incident evidence

Before simplification, preserve the paused F1–F9 draft outside the worktree with
its status and hash. Keep `1eba414`, `f4b858c`, both BLOCK reports, and incident
`prime-claw-gv7.1` as history. Do not continue or selectively finish the F1–F9
state machine merely because code already exists.

### Changes

- Start from the smallest useful implementation already in history, retaining the
  canonical kernel, generator parity, selected-file priority, practical marker
  ownership, ordinary atomic replacement, and concrete unrelated-file deletion
  fix.
- Remove multi-phase journal/recovery, continuous inode/descriptor authority,
  atomic-exchange restoration, hostile ABA/FIFO race defenses, and tests whose
  only purpose is the excluded adversarial model.
- Keep one cooperative lock, validation/reread, changed-preimage check, fixed
  receipt inventory, exact known-state restore, and safe refusal with manual
  recovery instructions.
- Ensure malformed receipt inventory can never nominate or delete an unrelated
  file. Retain obvious symlink/non-regular rejection visible during validation.
- Preserve LF/CRLF, final-newline form, unrelated bytes, and ordinary mode and
  ownership metadata where the platform supports it.
- Retain the bridge `role-protocol.json`, legacy APPEND checks, predecessor
  archive, and current user-facing docs.
- Update evidence and Beads to distinguish retained blockers from advisory
  hardening candidates.

### Acceptance

- Authored and generated kernel bytes match.
- Isolated apply produces one neutral block plus retained legacy APPEND and is
  idempotent.
- Ordinary AGENTS/CLAUDE selection, malformed markers, obvious unsafe target
  types, cooperative lock/edit detection, byte/newline preservation, fixed
  inventory, known-state restore, unknown-state refusal, and created-file cleanup
  pass focused tests.
- A malformed/tampered inventory cannot delete an unrelated file.
- The manager and tests are materially simpler than the paused F1–F9 draft and do
  not retain dead adversarial machinery under new names.
- Complete Tier 0, Docker Tier 1/probe, and one normal reduced-contract review pass.
- Candidate is committed once, pushed, clean, and reported for owner acceptance.

### Rollback

Revert Slice-1 files normally on the episode branch. In isolated installs, use a
known-good receipt only when current files match known pre/post states. Otherwise
preserve the destination and receipt and give manual recovery instructions. Never
delete or rewrite a real user-global context automatically from ambiguous state.
Legacy APPEND remains authoritative, so Slice-1 rollback needs no host activation.

## 7. Slice 2 — Managed role integrity and progressive Conversation activation

**Dependency:** accepted S1.

**Capability delivered:** managed roles require the exact neutral floor and an
active owner must consume the trusted lean Conversation guide once on demand
before lifecycle-changing readiness can pass; ordinary sessions and explicit
context opt-out remain safe.

### Changes

- Refactor kernel assertions to use generated bytes and parse every marker-looking
  occurrence in the assembled system prompt.
- Add explicit managed-role classification for root promotion, active owner,
  bounded EPISODE, generic child, and ordinary session. EXPERT stays generic
  until S3 adds trusted reservation binding.
- Keep historical package filtering at the `context` seam; explicitly abort
  managed missing/malformed state and prove zero provider calls.
- Add the global Conversation skill source, installer allowlist/checks, unique
  native activation tool, tool-call/message-bound issued/consumed receipts,
  single-use guide disclosure, invalidation logic, collision detection,
  read-only readiness inspection, and promotion/handoff/finalization gates.
- Reduce `.ralph/skills/oversee-episode/SKILL.md` to a forwarding/deprecation
  shim with no duplicated policy; retain `.agents/skills/oversee-episode`.
- Keep `execute` unchanged except for tested routing references if required.
- Extend provider captures to distinguish system, user, custom, and tool-result
  channels and to correlate guide tool-call/result IDs across provider calls.
- Cover normal direct, queued, injected, direct idle agent message, custom
  trigger, retry, tool loop, compaction continuation, resume, reload, recovered
  queue, project SYSTEM/APPEND shadow, global+project AGENTS/CLAUDE, CLI
  `--no-context-files`, and SDK override paths.
- Update Conversation oversight, handoff, future-bundle, and work-control docs to
  separate neutral invariants, on-demand judgment, and deterministic gates.

### Bounded implementation checkpoint — active-owner disclosure

Accepted candidate 1 is immutable at
`7107d1143330417333bfe6105b18832129d6439f` / tree
`fc382abb394865bfa122abf45987da5e1848a41d`.

This next candidate deliberately implements only one complete receipt subject:
the exact active owner and its current episode generation. It includes the
managed 300–600 word guide source and guarded install/check path, public
name/version/hash metadata, one sequential activation tool, issued-to-consumed
private in-memory receipt, one intended tool-result disclosure, later-context
redaction, project-name collision rejection, read-only status, and pre-mutation
handoff plus first-finalization gates. The project `oversee-episode` body becomes
a policy-free compatibility shim while its discovery symlink remains. The
Slice-1 role-protocol manager and fixed three-file restore receipt are unchanged.

A session start/shutdown or process replacement discards the receipt and requires
fresh activation. Compaction in the same loaded session may retain the consumed
receipt, but transcript text alone never restores it. Identical replay of an
already inactive finalization remains idempotent.

Deferred within Slice 2: prospective-location activation and the promotion gate,
EXPERT admission, broad resume/reload/retry matrices beyond ordinary failure
proof, and any cutover coordinator work. `create_spec_episode` therefore remains
ungated in this candidate rather than being made unusable without a matching
prospective receipt. No user-global apply, restart, UAT, landing, or cleanup is
part of this implementation pass.

### Acceptance

- Exactly one exact neutral system block reaches every managed provider call;
  marker defects abort explicitly with no provider call.
- Ordinary no-context sessions work, while promotion/owner/EPISODE actions fail
  visibly and do not mutate lifecycle state.
- Activation permits its exact guide `toolResult` on the first continuation only,
  records consumption, filters private receipt state, and removes stale/replayed
  guide bodies from every later call.
- Provider-visible system/user/custom text contains no guide, activation receipt,
  neutral-block copy, or historical oversight package; the exact guide appears
  once only in the intended tool-result channel.
- Read-only readiness proves handoff/finalize gates without invoking either live
  transport.
- Role-negative tests prove no EPISODE, generic child, copied transcript, CWD,
  branch, or depth can gain owner authority.
- The old project skill is only a shim and its symlink remains valid.
- Focused Node/native tests, full Tier 0, and Docker Tier 1/probe pass.

### Rollback

Revert the activation/gate/shim commit together. Never leave the shim without the
managed global skill installer or leave a lifecycle gate without its receipt
producer. No user-global mutation occurs in this slice.

## 8. Slice 3 — Official EXPERT admission and kernel-mode fail-close

**Dependency:** accepted S2.

**Capability delivered:** the managed official EXPERT skill and native
single-use reservation protocol bind exactly one real child to the review role,
or deterministically report unavailable before mutation under both managed and
custom kernel modes.

### Changes

- Add the complete Python-backed skill directory, strict reviewer config, and
  migrated rubric.
- Add owner-only reservation, handle-binding, child-side atomic consumption,
  report settlement, read-only readiness, expiry, and cleanup tools/state.
- Implement exact selector normalization/match, explicit model/thinking spawn,
  returned-model verification, harmless generic bootstrap, packet schema/digest,
  and exactly-once guarded parent delivery.
- Bind EXPERT only when trusted host sender/target metadata, actual child
  session/model, packet digest, and one handle-bound unconsumed nonce all agree
  before the first review provider call.
- Document and test the owner-side complete PASS/BLOCK, immutable commit/path,
  pre/post HEAD/status, report preservation, and settled-child deletion contract.
- Add native status/preflight plus apply/check verification of the interpreter
  that will execute the package. Default managed-kernel check validates source
  importability with the exact interpreter without modifying its venv and marks
  sync pending; the first restarted runtime must verify the actual discovered
  import/hash before reservation.
- For `PRIME_AGENT_KERNEL_PYTHON`, require a normal already-installed import and
  test exact present, missing, stale, mismatched, and host-runtime-missing cases
  without source-path injection or provisioning.
- Install both managed skill directories transactionally and reject symlink,
  non-directory, partial generation, name collision, and import collision.
- Retain the standalone profile unchanged and add exact rubric/config parity
  proof showing it is migration evidence rather than a live authority.
- Update current EXPERT documentation with the public API limitation: spawned
  children are semantically read-only, not capability-sandboxed.

### Acceptance

- Exact configured model succeeds only on one exact discovery result; unavailable,
  ambiguous, expired, unsupported-thinking, handle mismatch, uncertain delivery,
  incomplete report, and mutation evidence all block.
- The record contains returned canonical model, requested reasoning, successful
  spawn admission, child/session identity, commit, packet digest, and delivery
  status without claiming returned reasoning.
- A definite delivered/queued receipt causes one send; uncertainty causes no
  retry and no second reservation consumption.
- The generic bootstrap has no EXPERT authority. Copied name/prompt/depth/CWD,
  nonce replay, wrong sender/target, wrong child/model/session, stale expiry, and
  duplicate packet all fail before review provider dispatch.
- The admitted EXPERT provider call contains one neutral system kernel and one
  bounded parent rubric+packet in the intended user-role turn, nowhere else.
- A report from any session other than the bound child is rejected; consumed,
  settled, expired, crash, and cleanup paths are idempotent and fail closed.
- Custom-kernel missing/stale package returns deterministic `UNAVAILABLE` before
  reservation/RLM/message/lifecycle activity.
- `pyproject.toml` contains neither host runtime module as a dependency, and no
  unsupported plugin-defined Python host request is introduced.
- Focused Python/package/native tests, full Tier 0, and Docker Tier 1/probe pass.

### Rollback

Revert the EXPERT package, reservation state/tools, preflight, and installer
allowlist together. Retain the standalone profile and predecessor safety until a
later accepted generation; do not substitute a fallback reviewer.

## 9. Slice 4 — Freeze and review Generation A bridge candidate

**Dependency:** accepted S3.

**Capability delivered:** one exact, reviewable bridge candidate plus an
operator-launched cutover coordinator can install the complete replacement while
retaining every compatibility resource required by old source history.

### Changes and pre-freeze evidence

- Fetch `origin/main` first. If it advanced, merge the exact main tip normally
  into the episode branch and record parent order. Do not rebase
  published/accepted history.
- Implement and recording-fake-test the external coordinator from Section 3.6,
  including resident client/launcher inventory, executable/build mapping,
  `shutdown --force --json`, zero-stale-process gates, exact landing/apply/check,
  single-runtime start/status, practical checkpoint recovery, and ordered resume checklist.
- Reconcile all S1–S3 docs/tests, requirement traceability, managed inventories,
  recovery runbook, provider assertions, and coordinator operator instructions.
- Audit that bridge source contains: neutral context kernel, both global skills,
  exact runtime/activation/reservation/admission gates, legacy APPEND source and
  block, project forwarding shim/link, standalone profile, and historical
  filtering.
- Create the private Generation A preactivation bundle containing exact selected
  global-context and APPEND preimages, mode/uid/gid/newline/final-newline,
  installed plugin/skill inventory, selected-file decision, current known-good
  generation, source topology, restore tool/hash, and manifest digest.
- Prove source rollback plus receipt-driven global restoration against an
  isolated copy. Do not mutate user-global state.
- Commit the sanitized non-self-referential bridge readiness/rollback summary
  under `docs/evidence/official-lean-role-protocol/` after integration and before
  candidate freeze. It may contain run schemas and pre-freeze hashes but no
  future final commit/tree or review result. Rerun all gates and commit every
  tracked reconciliation before freeze.

### Exact freeze and review

- Freeze one immutable candidate commit/tree and run the complete gates in
  Section 4.3. No tracked byte changes after this point.
- The owning Conversation remains in the still-accepted primary-main checkout,
  verifies the unmodified legacy skill/profile hashes from Section 4.3, loads
  that full skill there, admits a fresh reviewer, and sends the immutable
  episode-worktree candidate packet. Record primary source CWD/commit/hashes,
  exact model/session/delivery, and pre/post subject state.
- Preserve exact candidate/tree, test digests, review report/disposition, and
  post-freeze hashes in private receipts and `prime-claw-h6w.30`, not in the
  candidate tree.

### Acceptance

- Complete Tier 0, complete selected Tier 1, tier-1 RPC probe, focused native
  captures, coordinator fakes, diff check, teardown, and independent review all
  PASS at one exact commit/tree.
- The bridge can be applied and restored exactly in isolation.
- No compatibility resource is deleted, no user-global file is changed, and no
  tracked mutation follows exact review.
- Owner accepts the exact candidate before presenting a landing/activation
  decision to the operator.

### Rollback

Candidate rejection stays on the episode branch and returns through canonical
handoff for an in-scope revision. It never mutates main or host-global state.

## 10. Gate A — Separately authorized bridge landing, activation, and interim UAT

### 10.1 Authority and external-coordinator preflight

S4 acceptance does not authorize this gate. Obtain explicit operator authority
for the exact candidate and one invocation of the external cutover coordinator.
That authority includes only the practical known-state handling in Section 10.4
while it remains part of this one operation. A second
coordinator invocation, or any additional `main`/user-global mutation after the
transaction stops, requires separate explicit operator authority. The operator
starts the authorized transaction from a separate terminal before quiescence
with the reviewed inputs and private checkpoint/evidence directory.

The coordinator must:

1. checkpoint this owner, the exact cleanup episode, Project-Wide Testing, Phase
   3a, and every affected active turn/test;
2. inventory every daemon, worker, TUI, client, launcher, wrapper, executable
   realpath/build/version, and daemon socket;
3. require operator-confirmed exit of every resident client/launcher that could
   recover an old daemon, cancel only non-surviving watches, and prove zero stale
   launcher before continuing;
4. require clean synchronized primary `main`, exact remote main, no other
   landing, and accepted candidate topology suitable for fast-forward;
5. verify the private preactivation bundle and isolated restore proof;
6. identify one operator-approved ordinary saved conversation and record its
   session ID/name/CWD and successful baseline turn; and
7. precompute the history-preserving source revert for the actual topology:
   merge-mainline revert for an integration merge, otherwise a verified range
   revert to prelanding main. Never reset.

Any drift, live client, unacknowledged foreign owner, running tool, missing
preimage, wrong executable/build, or ambiguous rollback stops the gate. The
owning model does not land, apply, stop, start, or verify its own runtime.

### 10.2 Coordinator landing, installation, and restart sequence

After authorization and zero stale clients, the external coordinator records
checkpoints and performs this sequence:

1. shut down every old agent/background service with supported
   `prime-agent shutdown --force --json` and prove old daemons, workers, and
   sockets are absent;
2. fast-forward primary `main` to the exact accepted candidate, push, and verify
   local/remote equality and clean status;
3. from that primary checkout only run
   `scripts/apply-prime-agent-plugin.sh --user-global` and then
   `scripts/check-prime-agent-plugin.sh --user-global`;
4. verify selected global context, both skills, legacy APPEND, installed
   extension files, ownership manifest, and hashes, then record an
   **installation/apply receipt** only;
5. prove zero stale launcher again, start exactly one daemon/runtime from the
   recorded executable/build, and verify `prime-agent status --json`; and
6. emit the ordered resume checklist for the exact owner, unchanged episode, and
   designated ordinary session.

A pre-restart Conversation activation receipt is impossible and forbidden. The
new tool is not loaded yet, and no model turn occurs inside the cutover gap.
Duplicate/mismatched runtime or auto-recovered old client triggers rollback.
`/reload`, a second daemon, elapsed time, or copy success is not cutover proof.

### 10.3 Interim UAT

On the sole restarted runtime:

1. resume this exact owning Conversation first;
2. as its first managed interaction, call the new activation tool and consume
   the exact global guide on its one allowed continuation before any oversight
   decision;
3. use only the read-only managed-role readiness tool to prove handoff and
   finalization would be gated correctly; do **not** invoke live handoff or
   finalization during UAT;
4. resume the unchanged cleanup episode second and prove its bounded EPISODE role
   without starting S5;
5. exercise official EXPERT reservation/binding/admission exactly or prove its
   specified fail-closed unavailable result, preserving the complete evidence;
6. resume the designated ordinary saved conversation third and complete a real
   ordinary turn; and
7. execute isolated/nondestructive fixtures for nested CWD, linked worktree,
   unrelated repository, project SYSTEM, project APPEND, direct idle agent
   message, queued message, resume, retry, and compaction.

Provider captures must match the Section 3.4 matrix:

- standard ordinary/Conversation/EPISODE: one neutral system kernel, zero
  historical package/private receipt/EXPERT rubric in user/custom, and one exact
  guide `toolResult` only on the activation continuation; the explicit
  no-context ordinary negative control has zero kernel and no managed authority;
- admitted EXPERT: one neutral system kernel plus exactly one bounded
  rubric+packet in the intended parent-message user-role turn, nowhere else; and
- every role: zero retired work-control overlay and zero legacy oversight
  package.

Verify isolated rollback to the exact accepted pre-bridge generation. Record all
identities, provider counts, hashes, elapsed time, and failures in the private
receipt and Bead. No tracked candidate file changes.

Ask the operator to explicitly accept or reject interim UAT. Only after explicit
acceptance may the owner invoke canonical `handoff_spec_episode` once to begin S5.
That post-acceptance handoff is not part of UAT.

### 10.4 Practical failure recovery

On failure or uncertainty, stop forward progress and preserve source state,
preimages, receipts, compatibility resources, and evidence. Do not infer that a
landing, push, global write, or restart completed.

- Before shutdown, record the failure and leave the accepted generation running.
- After shutdown but before landing, restart only the proven unchanged accepted generation.
- After a proven landing but before global apply, use normal history-preserving Git recovery only with separately confirmed local/remote refs.
- After apply begins, restore only fixed-inventory surfaces whose current contents match a known installed postimage; otherwise stop for manual operator recovery.
- After runtime start or during UAT, follow the same known-state rule, then recover owner, episode, and ordinary sessions in order.

One authorized coordinator invocation does not authorize retrying an uncertain
mutation. Record the observed phase and return to the operator. A detailed
write-ahead transaction journal and automatic compensation of ambiguous states
are explicitly unnecessary.

## 11. Slice 5 — Practical final legacy removal and restore

**Dependency:** satisfied. The owner explicitly accepted Gate A bridge UAT after
owner guide/identity success, clean exact-episode resume without injected legacy
packages, and a mutation-free ordinary-session `VISION.md` read-only task.

**Capability delivered:** final mode can remove only Prime Claw's exact managed
legacy APPEND region and restore a known accepted bridge preimage in isolated
tests, without deleting repository compatibility resources yet.

**Bounded execution authority:** deliver only this smallest practical cleanup
slice and report it as one reviewable vertical slice. Do not begin Slice 6.

### Changes

- Extend the practical manager with exact-marker legacy removal and the same fixed-inventory known-state receipt rules used by Slice 1.
- Remove the operator-rejected managed-directory unexpected-entry purity gates
  from apply/check and remove their direct tests. Do not add cache exceptions,
  replacement integrity machinery, or generalized defenses. Preserve expected-
  file comparisons, managed package hash/import validation, role generation and
  lock checks, and ordinary safety checks.
- Cover unrelated prefix/suffix, LF/CRLF, final-newline form, malformed/duplicate markers, absent/already-removed replay, and unknown-state refusal.
- Preserve ordinary metadata where supported and reject obvious unsafe target types at validation.
- Keep `role-protocol.json` in bridge mode and do not run final mode against the host.
- Update concise manual recovery instructions.

Do not add hostile same-UID race defenses, continuous inode authority, or an
exhaustive restore-state matrix.

### Acceptance

- Isolated final apply removes only the managed legacy region and preserves unrelated content.
- Known-state restoration recreates the accepted bridge preimage; unknown state refuses safely.
- Bridge default behavior remains unchanged.
- Focused practical tests, complete Tier 0, and Docker Tier 1/probe pass.

### Rollback

Revert Slice 5 normally. The active host remains the accepted bridge generation,
so no user-global or restart rollback is required.

### Slice 5 implementation checkpoint

The practical manager now supports an isolated exact final transition from an
owned bridge manifest. It removes only the recorded legacy APPEND block and
Prime Claw-owned separators, preserves unrelated bytes and ordinary metadata,
keeps already-final absence stable, and restores the exact bridge fixed
inventory only from known states. Final removal refuses unowned state, source
or separator drift, malformed/duplicate markers, tampered receipts, and unknown
restore state. The tracked `role-protocol.json` remains `bridge`, and final mode
was not applied to the host.

The operator-rejected managed-directory unexpected-entry scans and only their
direct tests are removed. Expected-file comparisons, EXPERT package hash/import
validation, role generation/lock checks, explicit obsolete-file checks, and
ordinary directory/leaf safety remain. No cache exception or replacement
integrity mechanism was added.

Evidence is recorded in
`docs/evidence/official-lean-role-protocol/2026-10-08-slice-5-practical-legacy-removal.md`.
Focused final-mode Docker coverage passes 11; complete Tier 0 passes 447 with
182 skipped; complete Docker Tier 1 passes 75 with 554 deselected; the pinned
0.9.8 apply/check/command-registration probe passes; and independent exact-diff
review returns PASS. This is the sole Slice 5 vertical slice. Stop here for
owner review; Slice 6, host final-mode apply, Gate B, finalization, and physical
cleanup remain unauthorized.

## 12. Slice 6 — Remove compatibility and reconcile the final source tree

**Dependency:** Slice 5 candidate
`98ed8d14e028622d07a120fbd4af730bd4171e38`, tree
`2b83d87a5adfab4c3f6e274b3149df54c588631e`, is accepted. Before removing
compatibility resources, perform the required fresh foreign-worktree/session
audit and stop if an active stale consumer remains.

**Capability delivered:** the episode branch reaches the complete clean target
state while the installed host remains on the accepted bridge until Gate B.

**Bounded execution authority:** implement only this minimal final-source slice
and report it as one reviewable vertical slice. Do not add replacement frameworks,
generalized integrity machinery, or new defensive scope. Do not begin Slice 7,
apply final mode to the host, run Gate B, archive/finalize, merge, or physically
clean up resources.

### Changes

- Change `role-protocol.json` from `bridge` to `final`; apply/check now require
  neutral context and both global skills while requiring the managed legacy
  APPEND region to be absent.
- Remove `src/prime-agent-plugin/APPEND_SYSTEM.md` and retire the append-specific
  manager only after final manager coverage is non-vacuous.
- Remove the project forwarding skill directory and
  `.agents/skills/oversee-episode` together, with broken-link absence tests.
- Remove `.prime/agent/profiles/expert-reviewer.md` only after exact
  config/rubric parity tests use the official skill authority.
- Remove bridge-only legacy prompt-shape tolerance after the drain audit, while
  retaining historical `prime-claw-oversee-episode-package` and bounded-record
  provider filtering with self-contained fixtures.
- Replace old skill/profile tests with tests against managed global sources,
  installed copies, activation/admission behavior, and final absence.
- Update `docs/conversation-driven-episode-oversight.md`,
  `docs/goal-heartbeat-work-control.md`, `docs/lab-global-plugin.md`,
  `docs/README.md`, handoff/future-bundle docs, installer help, and recovery
  guidance to describe only the final architecture. Historical archives and
  evidence remain untouched.
- Run a repository reference audit that classifies every remaining old name as
  required historical evidence/filtering or a blocker; do not mass-rewrite.

### Acceptance

- Final isolated apply/check installs one neutral context and both global skills,
  removes only managed legacy APPEND, and leaves no project skill/link/profile or
  `APPEND_SYSTEM.md` source.
- No duplicate current policy/rubric copy or broken symlink remains.
- Historical saved-session replay remains filtered and the retired overlay stays
  absent.
- Current docs, tests, help, and installed inventory describe the final state.
- Focused final-absence/replay tests, full Tier 0, and Docker Tier 1/probe pass.

### Rollback

Revert S6 and return to bridge source with all compatibility files intact. The
host is still bridge, so no activation rollback occurs. If the foreign-consumer
audit becomes stale, stop rather than force another branch to converge.

### Slice 6 implementation checkpoint

The fresh foreign-consumer audit passed with both retained foreign worktrees
clean and all matching saved sessions quiescent. The source tree is now final:
the tracked selector is `final`; the legacy APPEND source and append-only
manager, project forwarding skill/link, standalone reviewer profile, and
append-only container probes are absent; the final manager requires exact owned
bridge state and preserves fixed-inventory restore; retired prompt shapes fail
managed owner/EPISODE admission while historical replay filters remain.

Focused final-source Docker passes 55. Complete Tier 0 passes 442 with 177
skipped; complete Docker Tier 1 passes 70 with 549 deselected; and the pinned
Prime Agent 0.9.8 apply/check/registration probe passes. The first independent
review found only stale current operator guidance plus unfinished evidence
placeholders. Both are repaired: current guidance now routes Gate B through the
authorized coordinator and private accepted-bridge recovery material, and the
Slice 6 evidence contains concrete gate results and hashes.

The first candidate was independently reviewed, committed, and pushed as
`0e96838d430049980fa9ab2f6f8fc2762f2c127c`, tree
`c8474abac9ba25da740c0beae858223aee4c8b17`. The owner requested one bounded
revision for a single accepted omission; that candidate remains the immutable
revision baseline.

### Slice 6 owner-requested omission repair

The preserved pre-landing operator edit to the now-deleted
`.prime/agent/profiles/expert-reviewer.md` required semantic reconciliation
before the profile was removed. Repair only that omission:

- migrate the preserved operator intent explicitly into the managed official
  reviewer guidance;
- tell the reviewer to provide repair intent and useful general direction rather
  than spending tokens prescribing exact code changes;
- retain the current structured PASS/BLOCK report contract and the requirement
  that every blocking finding be actionable enough for a strong one-pass repair;
- keep the managed reviewer as the sole reviewer authority; do not restore the
  standalone profile or add another policy copy;
- update only directly affected tests, hash expectations, traceability, and the
  existing Slice 6 evidence; and
- run proportionate focused checks, commit and push one clean successor, report
  it to the owner, and stop.

Implementation result: the managed reviewer now asks for actionable repair intent
and useful general direction without exact code instructions, while the structured
report contract and actionable `BLOCK` requirement remain. The reviewer SHA256 is
`f737bb48bc5179fa2613e1fbb87c24bce0010ec3f69f31907d5bfa02d2b718f3` and the managed package SHA256 is
`13f1871531a51ef480be518148856320fcada33667216bf6e49a07e62fe5873b`. Focused Docker contract tests pass 40 with 31 skipped,
and the pinned Prime Agent 0.9.8 Tier 1 apply/check/registration probe passes with
its container destroyed. The final staged patch receives an independent read-only
review before commit and push.

Do not broaden Slice 6, begin Slice 7, apply final mode to the host, run Gate B,
archive/finalize, merge, or physically clean resources.

## 13. Slice 7 — Freeze and review Generation B final candidate

**Dependency:** accepted revised S6 candidate
`64bbee26c363c87ef85446da707900439c869620`, tree
`d9e9ba451cfcc2426ad200d8e05ed7e086f9abe1`.

**Capability delivered:** one immutable final candidate, operator cutover inputs,
and bridge rollback bundle are ready for separately authorized removal activation.

**Bounded execution authority:** reconcile only the two preserved pre-landing
files below, complete the normal Ralph plan archive, then perform the already
approved final-candidate preparation, freeze, exact gates, and official review.
Do not merge, apply final mode to the host, run live Gate B, restart Prime Agent,
finalize bookkeeping, or physically clean resources.

### Changes and pre-freeze evidence

- Reconcile the preserved
  `.agents/skills/goals-and-heartbeats/SKILL.md` from the exact private source
  path recorded in the specification. Its source SHA256 is
  `6c9daca98cf818a784334493190f2c4ea17218ffb61e52b52919105178a6aaa1`;
  preserve only the operator's no-goal-budget/unbounded token-authority intent
  in the current canonical skill, exactly where compatible, with no duplicate
  skill authority or unrelated policy restoration.
- Reconcile `.beads/interactions.jsonl` append-only and losslessly. At handoff,
  current 29,530-byte/99-record SHA256
  `05f185840bda2ae7a8901796da4b19aa5b055183fdcb9b9ba5ee905d5283f8fd`
  is an exact prefix of preserved 30,963-byte/105-record SHA256
  `d3e5956f184694018426be8993452300401be361bd9ef6762018e39d8ab84a70`.
  Append the exact six-record/1,433-byte suffix at SHA256
  `3f1935e989dfb08f7635a1ebc53afd2fd42ac5ec368646881350f5e64720a5ac`;
  never overwrite, reorder, normalize, or drop a current record, and if the
  destination advances append only exact missing preserved records after
  identity proof.
- Move the finished active `SPECIFICATION.md` and `EXECUTION_PLAN.md` together
  into `.ralph/plans/archive/official-lean-compatibility-cleanup/` and update
  `.ralph/plans/archive/README.md` before freeze. The final candidate must not
  strand active plan files at `.ralph/plans/`. Keep `prime-claw-h6w.30` open;
  plan archival is not episode bookkeeping finalization.
- Fetch and normally integrate exact latest `main` first if necessary; preserve
  reviewed history and record topology.
- Re-audit every ORP requirement, final installed inventory, current docs,
  historical references, provider filters, coordinator behavior, and foreign
  worktree/session state against that integrated tree.
- Create a private Generation B preactivation bundle whose baseline is the exact
  accepted bridge generation, including selected-context, APPEND, ownership
  manifest, managed skill and installed-state preimages; source topology;
  restore-manager hash; and manifest digest.
- Prove final→bridge source rollback plus exact global restoration in isolation.
- Commit a sanitized non-self-referential final readiness/rollback summary after
  integration and before freeze. It may not claim a future commit/tree or review
  result. Rerun all gates and commit every tracked reconciliation before freeze.

### Pre-freeze reconciliation result

- Integrated exact `origin/main` `7bbaebf959391bc8488fad4751c245f33f4e7f6c`
  without rewriting accepted history in merge commit
  `41b94b5bad3a4cc6a205ecac7e0527cce78cad3d`; parents are `64bbee26c363c87ef85446da707900439c869620` then
  `7bbaebf959391bc8488fad4751c245f33f4e7f6c`.
- Preserved main's proportional review guardrails and the accepted concise
  repair-intent guidance in the sole managed reviewer at SHA256
  `dcd02e81e7e0656a3d7eb89ccfa78bd8b24a8492de012122f82b17b7aec50a05`. The retired standalone profile remains absent.
  Focused Docker reconciliation checks passed 63 tests with 31 skipped; log
  SHA256 `67399ea2201871807b699225f6b8c3e5dea02d658569f8cc5831f4b652e73c60`.
- Reconciled `.agents/skills/goals-and-heartbeats/SKILL.md` exactly to approved
  source SHA256 `6c9daca98cf818a784334493190f2c4ea17218ffb61e52b52919105178a6aaa1`; the only baseline delta is the authorized
  no-goal-budget/unbounded-token sentence.
- Preserved the complete 29,896-byte/100-record post-main interactions file and
  appended the exact six-record/1,433-byte suffix SHA256
  `3f1935e989dfb08f7635a1ebc53afd2fd42ac5ec368646881350f5e64720a5ac`.
  The resulting 31,329-byte/106-record file SHA256 is
  `86f65e44d6a12fc0e06c0c7fc3fabb17d0cf01e3bbbf88df7db6ea6d2e219fe7`; no prior byte was changed.
- The finished active specification and plan are archived together before the
  immutable candidate freeze. This records plan lifecycle completion without
  closing `prime-claw-h6w.30` or authorizing later bookkeeping/finalization.

### Exact freeze and official review

- Freeze one immutable candidate commit/tree and execute Section 4.3 completely.
  No tracked byte changes after this point.
- From the bridge-activated owner, reserve and bind one exact reviewer through
  the native protocol, then invoke installed
  `prime-claw-official-expert-review` against the immutable candidate.
- Preserve exact reservation/nonce state, actual child/session/model, requested
  reasoning, spawn admission, packet digest, single delivery, bound EXPERT
  provider capture, complete PASS/BLOCK, pre/post HEAD/status, report settlement,
  and child cleanup.
- Record exact candidate/tree, post-freeze test/review hashes, and disposition in
  private receipts and `prime-claw-h6w.30`, not the candidate tree.

### Acceptance

- All complete gates PASS at one exact commit/tree.
- The official reviewer returns PASS; `UNAVAILABLE`, uncertain delivery,
  incomplete report, wrong child/sender/target, repository mutation, replay, or
  fallback blocks.
- No active foreign worktree/session can exercise stale compatibility behavior.
- Final apply and bridge restoration pass in isolation.
- No tracked mutation follows review, and the owner accepts the exact candidate
  before presenting Gate B authority.

### Rollback

Candidate rejection returns to the same episode through canonical handoff. No
main or host-global mutation occurs.

## 14. Gate B — Separately authorized final landing, activation, and UAT

### 14.1 External-coordinator preflight and operation

Obtain explicit operator authority for the exact S7 candidate and one exact Gate
B coordinator invocation. That authority includes only the practical known-state
handling in Section 14.3 inside this one operation. A second
coordinator invocation, or any additional `main`/user-global mutation after the
transaction stops, requires separate explicit operator authority. The operator
launches the transaction from a separate terminal before quiescence. Repeat the
full Gate A process/executable/build inventory, foreign-owner checkpoint,
zero-stale-client gate, clean-primary-main topology, ordinary-session selection,
preimage, and rollback checks. Require the same cleanup episode identity and
accepted Gate A receipt.

The coordinator then:

1. shuts down every old agent/service and proves all old daemons, workers,
   sockets, clients, TUIs, and launchers are absent;
2. fast-forwards primary `main` to the accepted final candidate and pushes;
3. runs user-global apply/check from clean synchronized primary `main` only;
4. verifies exactly one neutral context block, both managed skills, no managed
   legacy APPEND region, no old project skill/link/profile, and exact installed
   final generation, then records an **installation/apply receipt** only;
5. proves zero stale launcher again, starts exactly one expected daemon/runtime,
   and verifies status/build; and
6. emits the owner→unchanged episode→ordinary resume checklist.

No model runs in the gap and no pre-restart guidance activation receipt is
claimed.

### 14.2 Final UAT

On the sole restarted runtime:

1. resume the exact owner and perform a fresh single-use Conversation guidance
   activation before any oversight decision;
2. use read-only readiness inspection to prove handoff/finalization gates without
   invoking either live mutation;
3. resume the unchanged cleanup episode and verify bounded completion without
   granting Conversation authority;
4. exercise official EXPERT exact reservation/binding/admission or its specified
   fail-closed unavailable behavior;
5. resume the designated ordinary conversation; and
6. run nondestructive project SYSTEM/APPEND, linked/nested/unrelated CWD,
   direct-idle, queued, compaction, resume, and retry fixtures.

Provider captures must match the same role/channel matrix as Gate A: one neutral
system kernel for every managed role and standard ordinary call; the explicit
no-context ordinary negative control has zero kernel and no managed authority;
one exact guide tool result appears only on the owner activation continuation;
one exact bounded EXPERT rubric+packet appears only in the intended
admitted-EXPERT parent-message turn; and private receipts, historical oversight
packages, and retired overlays appear nowhere.

Also prove no missing-skill/profile/startup/lifecycle error, no managed legacy
APPEND or old project skill/link/profile, clean synchronized primary `main`, and
exact bridge rollback readiness.

Record private receipts and Bead evidence without mutating the reviewed candidate
or tracked docs. Ask the operator to accept or reject the completed target state.
Live finalization is forbidden during UAT.

### 14.3 Practical failure recovery

Use the same known-state recovery rule as Gate A. Preserve the accepted bridge,
fixed-inventory preimages, episode, and evidence. Before apply, recover Git only
from confirmed refs using normal history. After apply begins, automatically
restore a surface only when its current bytes match the known final-generation
postimage; otherwise stop for manual operator recovery. Restart and resume only a
proven generation.

Do not retry an uncertain coordinator boundary, finalize, or physically clean.
No exhaustive phase journal or autonomous mixed-state recovery is required.

## 15. Accepted completion, deterministic bookkeeping, and cleanup boundary

Only after explicit final UAT acceptance:

1. record the accepted final commit/tree, installed generation, provider/UAT
   receipts, rollback point, and operator decision in private evidence and
   `prime-claw-h6w.30`;
2. prepare (but do not apply) one deterministic main-only bookkeeping diff that
   adds the final sanitized post-freeze evidence summaries and updates current
   indexes/Bead references without changing installed plugin source or user-global
   bytes. The final candidate already archived the completed specification/plan
   under `.ralph/plans/archive/official-lean-compatibility-cleanup/`; do not
   recreate active root plan files or archive them a second time;
3. present the exact diff, proposed commit, focused checks, and history-preserving
   revert to the operator and obtain distinct explicit authority for that named
   bookkeeping mutation. Final UAT acceptance alone does not authorize it;
4. after authority, commit/push only that deterministic diff, run its checks, and
   verify clean synchronized primary `main`, Dolt/Beads state, archive hashes,
   installed final generation, and exact idle episode identity;
5. retain the logical future-folder `sourceLocation`, durable expectation,
   oversight marker, episode session/worktree/branch, and every identity record
   unchanged until `finalize_spec_episode` succeeds;
6. use read-only readiness one final time, then call `finalize_spec_episode` once
   with `.ralph/plans/future/official-lean-compatibility-cleanup`; verify exact
   expectation/oversight closure while ordinary Conversation capability remains;
   and
7. close `prime-claw-h6w.30` only after finalization and all accepted
   documentation/bookkeeping are durable.

The bookkeeping commit has its own rollback proof and cannot conceal candidate
or UAT drift. Finalization is not physical cleanup. Deleting the saved episode,
worktree, local branch, or remote branch requires a separate explicit operator
decision. Use supported Prime Agent session deletion and normal Git/worktree
operations, preserve a cleanup receipt, and verify absence. No cleanup is
inferred from final UAT or bookkeeping acceptance.

## 16. Plan-wide stop conditions and rollback rules

Stop and return to the owner/operator for real contract failures: specification
drift, missing trusted identity, practical unsafe path or unknown receipt state,
provider-channel leakage, required test failure, unavailable required reviewer,
unconfirmed Git/global mutation, incomplete restart/UAT, or inability to restore
a known accepted generation.

Also stop for a **process** failure when a third repair cycle is proposed, support
machinery grows materially faster than delivered behavior, a new custom
transaction/recovery protocol appears, or an EXPERT finding would expand the
approved threat model. These conditions trigger simplification or a product
decision, not more automatic hardening.

Never resolve a stop by patching Prime Agent, weakening a retained assertion,
choosing a fallback reviewer, force-pushing, resetting accepted history, deleting
foreign resources, or retrying uncertainty. Preserve evidence and ask the
operator when automatic recovery is not clearly safe.

## 17. Explicit non-goals

- No Prime Agent source modification, fork, or unsolicited upstream pull request.
- No capability-sandbox claim for EXPERT children.
- No redesign of episode creation, execute, handoff, or finalization.
- No autonomous orchestrator, monolithic oversight package, or provider-payload repair hook.
- No hostile same-UID filesystem race, ABA/FIFO swap, continuous inode authority, or tamper-proof local receipt guarantee.
- No proof of durability at every syscall/power-loss boundary or automatic recovery of every mixed state.
- No implementation of an advisory edge case until dogfood, a user report, near miss, changed boundary, or approved hard requirement promotes it.
- No Project-Wide Testing, Phase 3a, `prime-claw-h6w.29`, credential, Keychain, browser-store, or premature host-global work.
- No rewrite of archives, accepted commits, Beads chronology, or historical evidence.

## 18. Existing-episode continuation gate

The episode already exists and remains bound to this specification. Do not create
or replace it. Corrected Slice 1 is immutable owner-accepted history at
`57d26e582c583a81de370051b129f74f5b13ee45` / tree
`d1739c3a2ffee4512d6741480b72792e3a8d4098`; incident `prime-claw-gv7.1` is
closed. The systemic epic and advisory H1 remain open without expanding this
implementation contract.

Each canonical owner handoff may authorize one smallest end-to-end Slice 2
candidate. The execute pass audits current deterministic surfaces, implements one
bounded capability, updates tests/docs/Beads, runs proportional gates, commits
and pushes once, reports, and stops. The current candidate is limited to generated
neutral-kernel enforcement and private managed-role context as recorded in
Section 5.2. It must not begin activation receipts or Slice 3, land, mutate
user-global state, restart Prime Agent, run UAT, finalize, or clean up.

## 19. Authorized continuation after Slice 2 stop-loss

The owner independently accepted the cycle-2 duplicate-ID disclosure finding and
authorized one bounded repair pass. Change only `applyGuideDisclosure` and its
filter/validation tests as needed to require one occurrence of the issued ID in
assistant calls and one in all tool results, verify activation names and exact
bound result bytes, and authorize only that validated record. Add the two alias
regressions named in the specification. Rerun invalidated focused checks, complete
Tier 0, Docker Tier 1, and the pinned Prime Agent 0.9.8 probe. Compare the repair
only with the accepted finding; do not run a third independent/adversarial review
or accept another finding. Commit and push one candidate, report it, and stop.
Do not begin prospective-location/create gating, EXPERT admission, later Slice 2
work, Slice 3, landing, global mutation, restart, UAT, finalization, or cleanup.

### 19.1 Implementation result

The authorized duplicate-ID repair is complete. Focused Docker tests passed
17/17, complete Tier 0 passed 287 tests with 172 skipped, Docker Tier 1 passed
65 tests with 394 deselected, and the pinned Prime Agent 0.9.8 probe passed.
Exact commands, log hashes, and the accepted-finding disposition are recorded in
`docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-conversation-guide-activation.md`.
This commit is the single reviewable candidate for the authorized pass. No third
independent review or later-slice work was performed.

## 20. Prospective future-location activation and create readiness gate

The owner accepted `d31ab61e89247a024948d66e2613d434c89688fd` / tree
`f7ecd504d3f890455b858d53c6099c936fb0bf85`. Implement one next Slice 2
candidate only:

1. Audit the existing `/implement-spec` preparation/admission lifecycle and the
   exact pre-mutation boundary in `create_spec_episode`.
2. Extend the existing guide activation subject/receipt minimally so prospective
   readiness binds owner session, exact selected future location, current role
   kernel and guide generation, and current preparation lifecycle.
3. Require the matching consumed readiness before episode identity, worktree,
   branch, session, or oversight-marker mutation.
4. Preserve accepted active-owner handoff/finalization behavior, inactive
   finalize replay, the byte-identical managed guide, and unchanged `execute`.
5. Add focused proof for ordinary no-context failure; wrong, missing, or stale
   location/preparation; EPISODE, generic child, and active-owner misuse; valid
   one-time prospective disclosure/consumption/create; private non-replayable
   receipt state; and abort before any mutation.
6. Update plan/evidence/Bead, run proportional focused checks plus complete Tier
   0, Docker Tier 1, and pinned-runtime probe, then commit/push one candidate,
   report, and stop.

Do not introduce a generalized token framework, durable receipt database,
transaction journal, adversarial race matrix, duplicate policy authority, or
cutover coordinator. If broader provider-route coverage is not required for this
coherent capability, defer it to one final bounded Slice 2 pass. Do not begin
Slice 3, land, mutate user-global state, restart, run UAT, finalize, or clean up.

### 20.1 Implementation result

The prospective subject reuses the existing `/implement-spec` approval map and
adds one private UUID per successful admission. The existing activation receipt
now distinguishes active and prospective subjects; prospective readiness binds
the exact owner session, future location, preparation UUID, role-kernel SHA, and
managed guide generation. `create_spec_episode` verifies the consumed exact
prospective subject before deleting approval state, invoking creation, or
appending oversight. Focused Docker passed 17 tests, installed-runtime creation
fixtures passed 2 tests, complete Tier 0 passed 287 tests with 172 skipped,
Docker Tier 1 passed 65 tests with 394 deselected, and the pinned Prime Agent
0.9.8 probe passed. Exact commands and hashes are in
`docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-prospective-create-readiness.md`.
The managed guide and canonical `execute` skill are byte-identical to the
accepted parent. Remaining provider-route coverage stays deferred to one final
bounded Slice 2 pass.

## 21. Final bounded Slice 2 coverage reconciliation

The owner accepted `29b8932e3e576d0068194e44a5494af98474d8bf` / tree
`a5a16cacce0fad56f546a565475cefe519761b0a`. Complete one coverage-only
candidate:

1. Build a concise route-to-proof map for the Section 7 route and acceptance
   list from existing static, Node, native installed-runtime, and provider
   capture tests.
2. Collapse routes that exercise the same `context` restoration/filtering seam
   into documented equivalence classes rather than a combinatorial matrix.
3. Add only the smallest representative proof for material gaps, prioritizing
   queued/injected/direct-idle agent-message continuation; tool loop and retry;
   compaction/resume/reload/recovered queue; project SYSTEM/APPEND and
   global/project AGENTS/CLAUDE shadows; CLI `--no-context-files`; and SDK
   override.
4. Reuse existing assertions for one exact system kernel, no guide/private
   identity in user/custom channels, one intended guide tool result, later
   omission, and managed abort before provider dispatch.
5. Do not change production code unless a representative test exposes a concrete
   in-contract defect. Record and repair only that seam under delegated triage;
   do not broaden architecture.
6. Update docs/evidence/Bead and mark Slice 2 complete only if the approved
   acceptance contract is covered. Run focused checks, complete Tier 0, Docker
   Tier 1, and pinned-runtime probe. Freeze one commit. Use at most one exact
   independent review only if production code changed; otherwise owner/test
   evidence is sufficient. Commit/push, report, and stop.

Do not begin official EXPERT admission or Slice 3. Do not land, mutate
user-global state, restart, run UAT, finalize, or clean up.

### 21.1 Completion result

The route map and equivalence rationale are recorded in
`docs/evidence/official-lean-role-protocol/2026-10-06-slice-2-coverage-reconciliation.md`. Representative native coverage now identifies direct,
custom, injected heartbeat, direct-idle and queued agent message, queued
follow-up, recovered queue, provider retry, tool loop, compaction, installed
resume/reload/restart, prompt-source shadows, explicit no-context, and SDK
override behavior. Shared provider assertions cover the neutral kernel, guide,
private bounded identity, historical package, retired overlay, and guide receipt
fields/correlation. Focused native passed 5 tests; focused static/Node passed 27
with 25 deselected; complete Tier 0 passed 287 with 174 skipped; Docker Tier 1
passed 67 with 394 deselected; the pinned Prime Agent 0.9.8 probe passed.
Production code, the managed guide, and `execute` are unchanged. Under the
owner-approved test/docs-only rule, no independent patch review was required.
Slice 2 is complete at this candidate. Slice 3, landing, activation/restart, UAT,
finalization, and cleanup remain separately gated.

## 22. Slice 3 first candidate — official EXPERT package and exact preflight only

Accepted base: `e8b047c1493e6718c2f3062f19c77bc0b23ce8e9` / tree
`881b455a121b4cd53dd01005c5f84e31c7c9d555`.

1. Add the managed official EXPERT Python-backed skill/package with strict,
   deterministic reviewer configuration and rubric parity to the unchanged
   standalone expert profile. Preserve that profile as migration evidence.
2. Add read-only availability/preflight for the exact interpreter that would
   execute the package. In default managed-kernel mode, validate source
   importability with that exact runtime interpreter without environment
   mutation and report sync pending where applicable. Under
   `PRIME_AGENT_KERNEL_PYTHON`, accept only a normal already-installed exact
   package/hash import; return deterministic UNAVAILABLE for missing, stale,
   mismatched, or unusable interpreter/package before any other activity.
3. Use only public Prime Agent/Python interfaces. Do not add host runtime modules
   to `pyproject.toml`, source-path injection, host requests, or provisioning.
4. Extend the practical installer/check inventory to own both managed skill
   directories. Preserve preflight-before-copy, exact copy/final check, and
   known-state refusal. Do not introduce a transaction journal, rollback engine,
   or adversarial Slice 1 machinery.
5. Keep the package inert. Do not add spawn, reservation, nonce/expiry, handle
   binding, child admission, delivery, settlement, cleanup tools, provider
   identity, or generic-child EXPERT authority.
6. Run focused package/interpreter/installer coverage, complete Tier 0, Docker
   Tier 1, and pinned-runtime probe. Update evidence/checkpoint, commit/push one
   candidate, report, and stop.

Do not begin later EXPERT admission/reservation mechanics, Slice 4, landing,
user-global mutation, restart, UAT, finalization, or cleanup.

### 22.1 Prerequisite candidate checkpoint

The managed definition-only package, strict standalone-profile byte parity,
exact-interpreter read-only preflight, and complete two-skill installer/check
inventory are implemented. Focused static coverage passed 5 tests and focused
Docker coverage passed 41 with 1 deselected. Evidence and reproducible commands
are in `docs/evidence/official-lean-role-protocol/2026-10-06-slice-3-expert-prerequisite.md`. Complete Tier 0 passed 291 tests with 183 skipped; Docker Tier 1 passed 76
with 398 deselected; and the downloaded/checksum-verified Prime Agent 0.9.8
probe passed with managed `SYNC_PENDING`. This bounded prerequisite is complete
at the candidate and may be committed/reported. Admission, reservation,
transport, role authority, Slice 4, and operational cutover remain excluded.

## 23. Slice 3 second candidate — owner-scoped reservation foundation only

Accepted base: `e319e39949e1eb1c6b6b680d996ffb15ea664264` / tree
`03a88ac106d7fed83f48f0e157366e7d13258c7f`.

1. Add one simple in-memory/session-lifecycle review-reservation record per
   exact active owner. Gate reserve and bind to trusted active-owner state,
   consumed Conversation-guide readiness, and deterministic EXPERT package
   `AVAILABLE`; `SYNC_PENDING` or `UNAVAILABLE` stops before mutation.
2. A reservation contains one cryptographically random opaque nonce, practical
   bounded expiry, exact immutable repository path and commit OID, packet
   digest, requested full selector, and requested thinking level.
3. Add native owner-only reserve, bind, read-only status, and cancel mechanics.
   Status never mutates. Cancel, expiry, and session shutdown are idempotent and
   cannot grant authority.
4. Permit at most one transition from reserved to a record of the exact returned
   child handle/session/model metadata. Treat all caller-supplied spawn metadata
   as pending evidence only. Do not call it verified admission, returned-model
   proof, reasoning proof, or child role authority; those require the later
   trusted child-side seam.
5. If meaningful bind cannot be represented safely without child admission,
   stop at reserve/status/cancel and document that boundary instead of faking
   verification.
6. Keep generic children ordinary. Preserve the inert EXPERT package API and
   use only supported plugin/public interfaces.
7. Run focused state/tool/package tests plus complete Tier 0, Docker Tier 1, and
   pinned-runtime probe. Update evidence/checkpoint, commit/push one candidate,
   report, and stop.

Do not add live reviewer spawn, agent-message delivery, child provider-role
admission, review execution, report settlement, cleanup workflow, durable
database, journal, cross-process recovery, generalized token framework,
hostile-concurrency model, spawn orchestration, message retry, report protocol,
or provider-visible EXPERT authority. Do not begin Slice 4, landing, user-global
mutation/restart, UAT, finalization, or cleanup.

**Section 23 checkpoint — complete at candidate.** The four native mechanics are
implemented with exact active-owner/consumed-guide/fresh-`AVAILABLE` gates, a
15-minute cryptographic-nonce reservation bound to the complete stable oversight
generation and immutable repository/commit/packet/selector/thinking/package
subject, one public-spawn-tuple `bound-pending` transition, read-only status,
and idempotent cancel/expiry/session boundaries. Bind data remains
`caller-supplied-unverified` with `authority: false`. The independent review's
same-session A-to-B lifecycle BLOCK was repaired and re-review passed. Focused
host passed 45 Node plus 17 Python tests; focused Docker passed 43; complete
Tier 0 passed 292, Docker Tier 1 passed 76, and the pinned Prime Agent 0.9.8
probe passed. Evidence is in
`docs/evidence/official-lean-role-protocol/2026-10-07-slice-3-expert-reservation-foundation.md`.
All live spawn/admission/delivery/execution/settlement/cleanup and later phases
remain excluded.

## 24. Section 23 repair — bind review subject to the active episode worktree

Candidate `038d1cbaeb5f00614c4b4f40784cdb9119e72862` / tree
`affdc7c242d6f7ec511a960181d250ba6a1bdea0` is **not accepted**. Repair only the
repository-subject seam:

1. Derive the review target exclusively from the exact active-owner oversight
   marker's `worktree`, never from owning Conversation `ctx.cwd`, caller input,
   branch, session name, or copied prompt.
2. Require the marker worktree real path to exist and equal
   `git -C <worktree> rev-parse --show-toplevel` after canonicalization.
3. Require that worktree's current HEAD to equal the requested exact lowercase
   40- or 64-hex candidate commit OID; store that canonical episode worktree
   path and exact OID.
4. Refuse owner-CWD HEAD, wrong worktree HEAD, missing/noncanonical worktree, or
   any disagreement before reservation mutation.
5. Preserve exact owner-generation, consumed-guide, fresh package `AVAILABLE`,
   nonce/TTL, one `bound-pending` caller-supplied-unverified/`authority:false`
   transition, read-only status, idempotent cancel/expiry/session boundaries,
   and same-session episode A-to-B isolation.
6. Add a topology regression where owner CWD differs from marker worktree and
   prove only marker-worktree HEAD can reserve, including all specified negative
   cases.
7. Re-run invalidated focused tests, complete Tier 0, Docker Tier 1, and pinned
   Prime Agent probe. Freeze and independently exact-review only the repaired
   candidate, commit/push one repair, report, and stop.

Do not accept or investigate another finding in this pass. Add no live spawn,
delivery, child admission, review/report workflow, Slice 4, host activation,
finalization, or cleanup.

**Section 24 implementation checkpoint.** Reserve now receives the exact active
owner marker worktree from `assertExactActiveConversationOwner`, canonicalizes
and requires that path, proves its Git top-level equals the same real path, and
compares that worktree HEAD to the requested exact OID before mutation. The
record stores the canonical marker-worktree path. Owner `ctx.cwd` is no longer a
subject input. A native topology regression uses distinct owner and episode Git
repositories and covers owner-HEAD mismatch, stale worktree HEAD, missing
worktree, symlink/noncanonical worktree, nested/non-root worktree, successful
exact worktree reserve, and no mutation on refusal. Focused/full gates and exact
review remain pending.

**Section 24 validation checkpoint.** The bounded repair is implemented and the
required topology negatives prove refusal before mutation. Focused host passed
46 Node and 17 Python tests; focused Docker passed 43; complete Tier 0 passed
292; complete Docker Tier 1 passed 76; and the pinned Prime Agent 0.9.8 probe
passed. Evidence is
`docs/evidence/official-lean-role-protocol/2026-10-07-section-24-repository-subject-repair.md`.
Freeze this exact tracked patch and require bounded independent `PASS`; after
PASS, commit and push it unchanged and record the exact review/patch/commit
receipts on `prime-claw-h6w.30`. No other finding may be accepted in this pass.

**Section 24 review-repair checkpoint.** The first exact review identified one
in-scope lexical canonicalization gap: `resolve()` erased raw dot/relative or
trailing syntax before comparison. The repair now requires the raw marker path
to be absolute and byte-equal to `realpath`, requires raw trimmed Git top-level
output to equal that canonical string, and adds a dot-segment refusal/no-state
regression. All focused, complete, Docker, and pinned gates were rerun green.
Refreeze and re-review this exact repair before unchanged commit/push.

## 25. Slice 3 next vertical — discover, spawn, deliver, and first-call admit one EXPERT

The owner accepts the complete non-authoritative reservation foundation through
`5674219bc914682a7e28c96146a68ab1b3e80f5f` / tree
`930a7956545c6d3c9b8006e6cf59f5fa141f77d6`. Build only the next coherent
vertical: exact reviewer discovery/spawn, one guarded immutable-packet delivery,
and child-side admission for the first packet-triggered review provider call.

1. Audit only supported public Prime Agent 0.9.8 metadata and interfaces first.
   Prove whether trusted sender/target, actual child session/model, and a
   pre-provider admission seam are available. If any required fact cannot be
   proven without patching Prime Agent or using an unsupported host request,
   record the product constraint and stop; never simulate authority.
2. Reuse the accepted owner-generation-bound reservation and inert official
   package. Resolve exactly one full configured selector, with no fallback.
3. Spawn with explicit model/thinking and a harmless generic bootstrap under the
   startup-race protocol. Verify returned public model metadata without claiming
   returned reasoning. Bind the exact returned `rlm_child_id`, `name`,
   `session_dir`, and `model` tuple as pending evidence.
4. Only after bind, deliver exactly one canonical immutable packet and digest
   through lazy host-provided `agent_message`. A definite `delivered` or
   `queued` result counts as the one send. An uncertain result is not retried.
5. On the child's first packet-triggered call, admit EXPERT only when trusted
   host sender/target metadata, actual child session/model, bound owner
   generation/nonce/packet digest, unexpired one-use reservation, and exact
   package/kernel all agree. Consume once before provider dispatch.
6. Remove private nonce/receipt fields before provider visibility. Supply one
   neutral system kernel and one bounded rubric plus packet in the intended
   user-role turn. Copied name/prompt/depth/CWD, wrong sender/target/child/model/
   session, stale or duplicate nonce/packet, generic bootstrap, and replay must
   abort with zero review provider calls. Generic children remain ordinary.
7. Use a simple loaded-process shared registry only if native tests prove module
   and session sharing. Extend the Python skill with only the smallest typed
   async orchestration helpers and lazy host imports; keep `pyproject.toml` free
   of host-runtime dependencies.
8. Run focused package, Node, native installed-runtime, and provider tests, then
   complete Tier 0, Docker Tier 1, and the pinned Prime Agent 0.9.8 probe.
   Record exact evidence, independently review the bounded candidate, commit and
   push one candidate, report, and stop.

Explicitly defer report return and settlement, owner PASS/BLOCK disposition,
child deletion, cleanup workflow, durable databases/journals, generalized
capability tokens, delivery retries, adversarial race matrices, Slice 4,
landing, user-global mutation/restart, UAT, finalization, and cleanup.

## BLOCKED — Prime Agent 0.9.8 receiver trust metadata is not public

Section 25 stopped at its required public-interface audit. Prime Agent 0.9.8
(commit `a1faacd53ac4473a75de1d434afaf50945c2f647`) has the authoritative
facts internally, but no supported receiver-side interface exposes the complete
set needed for admission before provider dispatch:

- public `rlm.spawn` returns `rlm_child_id`, `name`, `session_dir`, and the
  actual selected `model` to the parent;
- public `agent_message.send` returns trusted sender/target endpoints only to
  the sender;
- a receiving extension can read its own `ctx.model` and read-only session
  manager identity; but
- the only receiver-side link to trusted inbound sender/target is the internal
  built-in `agent_message` custom-message `details` shape. That schema is not
  exported as a supported extension or Python contract. The public message text
  contains only a sanitized relationship/name header and body.

Therefore prime-claw cannot prove trusted sender/target and bind them to the
actual child session/model at the pre-provider `context` seam without relying on
an unsupported internal request/message shape. Serializing parent claims into
the packet would remain attestation text, not independent host proof. A custom
Python `host_request` is also unsupported because extensions cannot register a
public host handler and unknown request types fail.

**Unblock condition:** a supported Prime Agent public receiver interface must
provide unforgeable inbound sender and target identity together with enough
current child/session identity to bind public spawn metadata and `ctx.model` at
or before the provider-admission seam (or an equivalent supported admission
callback). Re-audit a released public interface before resuming. Do not patch or
fork Prime Agent for this project and do not consume the current internal
custom-message `details` schema.

The accepted non-authoritative reservation foundation remains unchanged at
`5674219bc914682a7e28c96146a68ab1b3e80f5f` / tree
`930a7956545c6d3c9b8006e6cf59f5fa141f77d6`. No feature reviewer was spawned,
no review packet was delivered, no child was admitted, and no review provider
call was made. Experimental local implementation edits were discarded.
Evidence: `docs/evidence/official-lean-role-protocol/2026-10-07-section-25-public-interface-constraint.md`.

## 26. Product correction — private launch record and spawn-context admission

The owner accepts Section 25's narrow finding that inbound agent-message
text/header/sender/target is not a supported authority surface, but rejects
terminal blockage. An independent Prime Agent Expert confirmed a supported
redesign that does not use inbound message metadata. Preserve blocker commit
`3586dcc0cb02f314e7c50f661d956f794637f17c` as audit history and implement only
this launch/first-call admission vertical.

1. Ignore inbound message text, headers, sender, and target completely. Retire
   caller-supplied bind authority.
2. Extend the owner-side Python skill to perform exact one-result public model
   discovery, create one private `PENDING` launch record, call public
   `rlm.spawn` with the explicit selector/thinking and a harmless bootstrap
   containing an unpredictable name, then verify/finalize only from the actual
   returned `session_dir`, `name`, and `model`. Revoke on definite failure. Use
   no selector fallback and make no returned-reasoning claim.
3. Store launch state in a purpose-built plugin-owned, untracked private
   namespace with mode-private directories/files, random nonce, fixed TTL, and
   exact owner/project/session/generation/candidate/packet/package/kernel
   binding. Use ordinary exclusive creation plus atomic rename for
   `PENDING -> FINALIZED -> CLAIMED/consumed`. Do not rely on cross-session
   module state (`moduleCache: false`). Do not create a general database,
   journal, power-loss engine, or hostile-extension defense.
4. At the child's initial spawn `context` hook, wait only a short bounded time
   for `FINALIZED`. Validate the public canonical `sessionDir`, `sessionId`,
   `sessionName`, `sessionFile`, current provider/model, canonical
   `header.parentSession` plus parent header ID, nonce/digest/expiry/package/
   kernel, then atomically claim before provider dispatch.
5. Filter the harmless bootstrap and all private fields. Expose exactly one
   canonical rubric-plus-packet user turn and recheck the current model on every
   admitted provider call. Inbound message content has zero authority.
6. Timeout, stale/replay, copied text, duplicate claim, or any wrong
   child/parent/model/session/name/path/package/kernel must call `ctx.abort()`
   explicitly and prove zero provider calls. A wrong trigger may deny service
   but cannot grant role or alter the packet.
7. Run focused package/state/Node/native-provider tests, complete Tier 0,
   Docker Tier 1, and the pinned Prime Agent 0.9.8 probe. Use at most one exact
   independent review cycle and one bounded in-scope repair under stop-loss.
   Record evidence, commit and push one candidate, report, and stop.

Implementation and validation are complete for this vertical. The one exact
review returned BLOCK on the real 0.9.8 `[custom harness digest, user bootstrap]`
first-turn shape. The sole bounded repair changed trigger cardinality to public
user turns, added that real-shaped success/replay coverage, and added an isolated
native provider seam proving one exact call on success and zero calls on timeout
or mismatch. Final evidence is in
`docs/evidence/official-lean-role-protocol/2026-10-07-section-26-private-launch-admission.md`.

Owner review BLOCKS exact pushed candidate
`f15457d82c3c9e3760272e71600eefbaf4809b17` on one regression only. The Python
launch path normalizes `marker["worktree"]` and Git toplevel before comparison,
so dot-segment or symlink marker paths can pass and lose the accepted Section 24
contract at `5674219bc914682a7e28c96146a68ab1b3e80f5f`. Repair only this: require
the raw marker worktree string to be absolute and exactly equal to its strict
real path; require raw `git rev-parse --show-toplevel` output to equal that same
canonical string before normalization; retain exact lowercase 40/64-hex HEAD.
Add focused Python launch regressions for dot-segment and symlink/noncanonical
marker worktrees, retain nested/non-root rejection, and prove failure before
private state creation and spawn. Do not add another independent review cycle,
broaden transaction machinery, reopen sender metadata, or begin settlement,
cleanup, or Slice 4.

The exact repair is implemented. Raw marker spelling must now be absolute and
equal to its strict real path; raw Git toplevel must equal that canonical string
before normalization; lowercase 40/64-hex HEAD validation is retained. The
focused regressions reject dot-segment, symlink, and nested/non-root paths before
model discovery, state creation, or spawn. Final gates pass: 52 Node; 19 focused
Python with 10 deselected; full Tier 0 295 passed/184 skipped; Docker Tier 1 77
passed/402 deselected; pinned Prime Agent 0.9.8 probe OK. Commit/push the narrow
repair, report, and stop.

Continue to defer report return/settlement, owner PASS/BLOCK disposition, child
deletion, cleanup workflow, Slice 4, landing, global apply/restart/UAT, and
finalization. Never patch Prime Agent or read internal agent-message details.

## 27. Slice 3 — structured review report and exact owner settlement

Accepted base: Section 26 commit
`3efd0cc79717378f9be5f448afe32f6a7c33ed39`, tree
`06e08cbcf7a226409749f29c7e6dd815ee66ff4b`. Advance only this coherent
vertical. Inbound messages/details remain non-authoritative.

1. Extend the managed Python package with a strict depth-1 report API. Derive
   the current runtime/session directory and the unique claimed launch from
   host-authored state; revalidate child, canonical parent, candidate, packet,
   model, package, and kernel lineage. Accept one bounded canonical report with
   verdict `PASS`, `BLOCK`, `ADVISORY`, or `SPEC_QUESTION`; every `BLOCK` must
   contain actionable remediation.
2. Canonicalize and digest the report, then atomically transition the matching
   `CLAIMED` file to `REPORTED`. Return an idempotent receipt only for an exact
   duplicate digest. Conflict, malformed/oversized report, wrong child/session/
   parent/candidate, unclaimed launch, or replay fails closed.
3. Capture exact pre-review candidate HEAD and clean status in the launch
   record. At report and settlement, record and compare post-review HEAD/status.
   Preserve evidence of mutation but reject the report/settlement when the
   reviewed subject changed.
4. Add a strict depth-0 owner-only settlement/read API. Derive current owner and
   active generation rather than accepting identity or model-supplied handle
   fields. Locate exactly one matching `REPORTED` launch, validate its digest,
   actual spawn/child/session/model/candidate/package/kernel lineage, and
   unchanged repository state; atomically transition once to `SETTLED` and
   return the immutable structured report and receipt.
5. Keep `FINALIZED`, `CLAIMED`, `REPORTED`, and `SETTLED` child sessions under
   the neutral EXPERT kernel. After report submission or settlement, every
   provider call explicitly aborts instead of falling back to an ordinary role.
   Update the canonical reviewer to submit exactly once before its final answer.
6. Reuse the narrow private file protocol and atomic transitions. Do not trust
   inbound agent-message metadata, add a database/general journal, defend
   against hostile local code, or build delivery retries. Defer owner product
   disposition persistence beyond the receipt if it expands the vertical, plus
   child deletion, state cleanup, Slice 4, landing, global apply/restart/UAT,
   and finalization.
7. Test focused Python/Node/native provider paths, mutation, duplicate digest,
   conflict, replay, wrong lineage, malformed/oversized report, settlement
   exactness, and post-report/post-settlement abort. Run full Tier 0, Docker
   Tier 1, and pinned Prime Agent 0.9.8 probe. Use one direct owner review only;
   no new independent review cycle. Record evidence, commit/push one candidate,
   report, and stop.

Implementation and validation are complete. `launch()` now records exact clean
pre-review repository state; depth-1 `submit()` validates host-derived lineage,
canonicalizes and digests one bounded structured report, records/rejects subject
mutation, and creates `REPORTED`; depth-0 no-argument `settle()` revalidates the
immutable report, actual spawn/session/model/package/kernel lineage, and clean
repository before creating `SETTLED` and returning immutable receipts. Exact
duplicate submission/settled reads are idempotent; conflicts and replays fail
closed. `REPORTED` and `SETTLED` retain the neutral kernel and explicitly abort
provider use.

Final evidence: 43 focused Python passed/8 skipped; 55 Node passed; native
provider coverage passed and reran inside the strict-final full Docker gate;
full Tier 0 311 passed/184 skipped; Docker Tier 1 77 passed/418 deselected;
pinned Prime Agent 0.9.8 probe OK. No independent review
was launched. Evidence is in
`docs/evidence/official-lean-role-protocol/2026-10-07-section-27-report-settlement.md`.
Commit/push one candidate, report for one direct owner review, and stop.

## 28. Slice 3 — final lifecycle closure and bounded stale reconciliation

Accepted base: Section 27 commit
`ee655a8907882a21f693169fbd0369d2d8c2e122`, tree
`60bc9c9985845f54b3ddb1b790f8e10fdda4ad06`. Advance only this final Slice-3
vertical. Keep the purpose-built private-file protocol and public RLM APIs.

1. Add an exact depth-0 owner-only disposition operation. Derive the current
   owner session/file, active episode generation, canonical repository, and one
   unique `SETTLED` report. Accept one bounded explicit disposition plus required
   rationale, canonicalize/digest it, preserve the EXPERT report unchanged, and
   transition to `DISPOSITIONED`. Return an idempotent receipt only for exact
   equality; conflicting disposition or wrong owner/generation fails closed.
   Product/scope authority remains in the Conversation; this API only records
   the supplied decision.
2. Add async close. Revalidate `DISPOSITIONED`, actual spawn/child/session/model/
   candidate/package/kernel/report/settlement/disposition lineage, then call
   public `rlm.list_subagents`. Match only the stored actual child ID. Ambiguous,
   mismatched, or uncertain roster state fails closed. If present, call public
   `rlm.delete_subagent` with the public handle and require a definite deletion
   outcome; re-list when needed to prove absence. Preserve failed/uncertain
   evidence without claiming cleanup. Only definite child absence may transition
   to `CLOSED`, whose immutable receipt retains report, settlement, disposition,
   and deletion evidence.
3. Add explicit purge that accepts only an exact `CLOSED` receipt/digest after
   the caller has durably recorded it. Refuse purge before close, on digest or
   owner/generation mismatch, or without definite child absence. Remove only the
   exact owned private closure files; never delete Prime Agent session artifacts.
4. Add the smallest exact-owner stale cancellation for expired `PENDING`,
   `FINALIZED`, and `CLAIMED`. A pending launch with no published child may
   transition directly to `CANCELLED`. A finalized/claimed published child must
   use the same public roster/delete/definite-absence proof before cancellation.
   Conflicting phase files, non-expired state, wrong owner/generation, ambiguous
   roster, mismatched child, or uncertain deletion fails closed. Do not add a
   generalized recovery transaction engine.
5. Extend the extension state paths and admission gates so `REPORTED`, `SETTLED`,
   `DISPOSITIONED`, `CLOSED`, and `CANCELLED` preserve the neutral EXPERT kernel
   and explicitly abort provider calls whenever a child remains addressable.
   Purged state is allowed only after proven child absence, so it cannot create
   an ordinary-role fallback for a live designated child.
6. Update package capability/status, preflight, reviewer/skill docs, evidence,
   and Slice-3 readiness/expiry/cleanup documentation. Preserve inbound-message
   zero authority and avoid manual artifact deletion, provider/message retries,
   database/general journal machinery, or hostile-local-code defense.
7. Test success, exact duplicate calls, conflicting disposition, wrong owner or
   generation, ambiguous/mismatched roster, definite delete failure, uncertain
   deletion, conflicting/crash phase files, stale no-child pending, stale
   published-child deletion, purge-before-close refusal, exact purge, and no
   role fallback. Run focused Python/Node/native tests, full Tier 0, Docker Tier
   1, and pinned Prime Agent 0.9.8 probe. Use direct owner review only; no new
   independent review cycle. Commit/push one candidate, report, and stop.

Defer Slice 4, landing, user-global apply/restart/UAT, finalization, bookkeeping,
and physical project cleanup.
Implementation is complete on the accepted Section 27 base. The package now
records exact owner `ACCEPT`/`REVISE`/`PAUSE`/`CONSULT` dispositions, closes the
stored actual child only through public roster/delete/re-list proof, retains
bounded failure evidence without claiming cleanup, cancels only exact expired
pre-report states after absence proof, and purges only an exact durably recorded
`CLOSED` result after re-proving public absence. Public deletion is documented as
registry/addressability removal, not physical artifact deletion. The extension
keeps all five terminal phases neutral and aborts every provider call. Focused
evidence: 58 Python passed/50 skipped, 59 Node passed, and 2 native container
passed. Final gates pass: full Tier 0 325 passed/184 skipped; Docker Tier 1 77 passed/
432 deselected; pinned Prime Agent 0.9.8 probe OK with expected package SHA256
`ef3f353d8120ea85393c650d6fa0b5076df1773fee3eecb137a80bd89c0622d0`.
Evidence is in `docs/evidence/official-lean-role-protocol/2026-10-07-section-28-lifecycle-closure.md`.
Commit/push one candidate, report for direct owner review, and stop.

## 29. Owner-review repair — pending/finalized crash overlap and public exports

Base candidate: `1fed99101f3dee95bf6863a3c9298d8c05d96718`, tree
`7c28ffe42d9b7018899cd252460287c91c30604d`. The lifecycle design is otherwise
directionally accepted. Make only this narrow repair:

1. Change the extension admission wait so `PENDING` plus exactly one
   `FINALIZED` is tolerated only as a transient publication overlap within the
   existing deadline. Wait for `PENDING` to disappear before admitting.
2. At or before the deadline, require exactly one authority phase and no
   `PENDING`. Persistent `PENDING`+`FINALIZED`, or any other multiple authority
   phases, must call `ctx.abort()` and dispatch zero provider calls. Preserve all
   current terminal-phase and conflicting-phase refusals.
3. Add Node tests for transient overlap resolution and persistent overlap
   refusal. Extend the Docker-authoritative native provider matrix to prove the
   same success/refusal boundary and zero provider call on persistent overlap.
4. Add Python `__all__` entries for `record_disposition`, `close`,
   `cancel_stale`, `purge`, `DISPOSITION_DECISIONS`, and
   `DISPOSITION_LIMIT_BYTES`, while retaining the existing intended launch,
   submit, settle, description, package, and protocol constants. Assert the
   exact public surface.
5. Update evidence/status minimally. Run focused Python/Node/native tests, full
   Tier 0, Docker Tier 1, and pinned Prime Agent 0.9.8 probe. Do not launch an
   independent review cycle. Commit/push one repair candidate, report for direct
   owner review, and stop.

Do not broaden lifecycle architecture, redesign deletion, start Slice 4, land,
activate/restart/UAT, finalize, perform bookkeeping, or physically clean up
project/session resources.
Section 29 implementation is complete on the blocked Section 28 candidate.
Focused evidence passes: 61 Node, 51 Python/50 skipped, and 2 Docker-native.
The native matrix proves one provider call only after transient overlap resolution
and zero calls for persistent overlap. Package SHA256 is
`92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff`.
Final gates pass: full Tier 0 326 passed/184 skipped; Docker Tier 1 77 passed/
433 deselected; pinned Prime Agent 0.9.8 probe OK with expected package SHA256.
Evidence is in `docs/evidence/official-lean-role-protocol/2026-10-07-section-29-publication-overlap-repair.md`.
Commit/push one repair candidate, report for direct owner review, and stop.

## 30. Current pass — Generation A bridge integration and immutable freeze

**Accepted dependency:** repaired Slice 3 commit
`6bceeea133f767d72739a8d88df2639ab75bba96`, tree
`6421f9acc11a4c5e755e37dfa3060c2821bf5326`.

Execute Section 9 only, with these pass boundaries:

1. Fetch `origin/main`. If its tip advanced, merge that exact tip normally into
   the published episode branch, record first/second parent order, and never
   rebase accepted history.
2. Implement the smallest inert, operator-launched external cutover coordinator
   from Section 3.6. Use recording fakes to cover resident client/launcher
   inventory, executable/build mapping, `shutdown --force --json` order,
   zero-stale-process checks, exact landing/apply/check, single-runtime
   start/status, practical checkpoint recovery, and ordered resume. Do not touch
   real processes, `main`, or user-global state.
3. Reconcile S1-S3 documentation, requirement traceability, managed inventories,
   recovery runbook, provider assertions, and coordinator instructions. Audit
   the complete Generation A bridge inventory while retaining every
   compatibility resource.
4. Create the private preactivation/rollback bundle specified by Section 9:
   exact selected global-context and APPEND preimages with mode/uid/gid/newline
   metadata; installed plugin/skill inventory; selected-file decision; current
   known-good generation; source topology; restore tool/hash; and manifest
   digest. Exclude credentials and unrelated private data. Prove apply and
   restore only against isolated copies.
5. Before freeze, commit the sanitized non-self-referential readiness/rollback
   evidence under `docs/evidence/official-lean-role-protocol/`. It may record
   pre-freeze inputs and hashes but no future candidate identity or review
   result.
6. Run complete Tier 0, selected Docker Tier 1, pinned probe, focused native and
   coordinator-fake tests, diff check, and teardown. Commit all tracked
   reconciliation before freeze. Freeze and push one immutable candidate
   commit/tree. Make no tracked change afterward.
7. Report the exact candidate/tree, parent order, gate/evidence digests, bridge
   inventory, rollback-bundle manifest digest, and review packet to the owning
   Conversation, then stop. Do not launch the independent review here. The owner
   will perform it from the accepted primary-main checkout after verifying
   legacy skill/profile hashes and pre/post subject state.

Do not start Gate A, land, apply user-global state, stop/restart the live runtime,
run UAT, remove compatibility, finalize, or clean up.
### Section 30 pre-freeze checkpoint

Generation A integration is complete before final gates. `origin/main`
`c24ba6c1e76585193d4f34f0b0b0233846780442` was merged normally at
`46147ff887569101b7e64a8466cde5887c15cc31`, with accepted episode history as
first parent and exact main as second parent. The inert coordinator, fixed-surface
private bundle/restore helper, fresh live-receipt wrapper option, recording fakes,
provider assertions, central ORP traceability, current docs/runbook, bridge
inventory regression, sanitized readiness evidence, and isolated candidate ->
known-good -> exact restore proof are present. Focused host 76/54 skipped, Node
76, and Docker-native 3 pass. No live process, primary `main`, or user-global
mutation occurred. Run complete gates, freeze/commit/push one immutable
candidate, report it to the owner, and stop without independent review or Gate A.

## 31. Owner-review repair — Generation A coordinator and bundle seams

**Blocked historical candidate:**
`f2f3fcd25dbe3d96f05193261020d26bf79f1213`, tree
`8b4fef1936766c7383a577317ac6d2436f4e72e5`.

**Accepted report:** exact configured Astra/max `BLOCK`, SHA256
`4ed03385fc1d54cdecdbbacf5ea720d00b70a9af10b99b1466f7592df50d95e1`.
Preserve that candidate, freeze, report, and prior evidence as history.

### 31.1 Coordinator B1 — exact pre-shutdown observation

- Reconcile every observed declared process against its declared role and
  supported entrypoint form, including compiled launcher and interpreter/Node
  entrypoints.
- Require client, TUI, launcher, and wrapper absence before shutdown. Allow only
  the explicitly approved old daemon/worker set until shutdown.
- Bind actual status/build/socket/executable observations, including exact build
  identity rather than version-only equivalence.
- Failed commands, malformed or unknown status/process data, undeclared live
  roles, and any mapping mismatch stop before the first mutation.
- Bound observation to declared/relevant entrypoints; do not substring-scan or
  inspect unrelated programs.

Required cases include a declared live TUI refusal, a supported Node entrypoint
success, and wrong same-version build refusal before shutdown.

### 31.2 Coordinator B2 — one start plus bounded readiness

After exactly one recorded start, use only a short bounded read-only status/
child observation loop. Never invoke start again. Admit readiness only for one
exact expected runtime identity. Stop truthfully for wrong identity, duplicate
runtime, child exit, malformed status, or deadline. Cover delayed readiness that
succeeds after multiple observations with exactly one start, plus every failure
case above.

### 31.3 Coordinator B3 — concrete rollback topology

Replace the syntactic `git revert` prefix check and placeholder recipe with one
fully concrete history-preserving recipe. Validate its exact commit arguments,
integration merge, parent order/mainline, prelanding HEAD, candidate ancestry,
and resulting accepted baseline using a scratch-only inverse application or an
equivalently bounded Git topology proof. Reject placeholders, missing/wrong
commits, wrong mainline, non-resolving results, reset, rebase, force, and
automatic live compensation. No live rollback runs in this pass.

### 31.4 Bundle B4 — original-path no-follow validation

Before any `resolve()`, use `lstat` to reject visible or dangling symlinks and
non-regular selected-context/destination/bundle-root/fixed managed parent or leaf
components at the originally supplied paths. Preserve supported real isolated
roots, fixed managed inventory, and case-insensitive macOS naming behavior. Do
not add descriptor-chain, inode-generation, ABA, or hostile-race machinery.
Cover visible and dangling links for every affected input/output class.

### 31.5 Bundle B5 — metadata-complete restoration

Treat ordinary mode/uid/gid as part of preimage equality. When bytes already
match but metadata differs, restore metadata or fail; never report
`alreadyRestored`. Classify the complete fixed set before mutation, preserve
unknown-content all-or-refuse, and make replay return `alreadyRestored: true`
only when bytes and all required metadata already match. Cover unchanged-byte
mode drift, metadata application failure with truthful state, normal restore,
and replay.

### 31.6 Evidence, gates, and stop boundary

- Add only the exact focused positive/negative/failure/replay tests above.
- Regenerate only affected private bundle manifest, isolated proof, and
  sanitized non-self-referential readiness evidence. Do not rewrite the old
  candidate/report/freeze evidence.
- Run focused coordinator/bundle tests, affected Docker-native checks, complete
  Tier 0, complete selected Docker Tier 1, pinned Prime Agent 0.9.8 probe,
  `git diff --check`, remote equality, and teardown.
- Freeze and push one new immutable candidate commit/tree with no tracked
  mutation afterward. Report exact hashes/evidence to the owning Conversation
  and stop.
- Do not launch the renewed independent review. The owner will re-admit one fresh
  exact configured reviewer because bytes changed.

No Gate A, landing, primary-main or user-global mutation, live runtime shutdown/
restart, UAT, compatibility removal, finalization, bookkeeping close, or cleanup
is authorized.

### Section 31 implementation checkpoint

The five accepted findings are repaired through only the two existing seams.
Coordinator preflight now binds compiled or Node CLI artifacts, exact status
identity, declared roles, and targeted Prime Agent PIDs; all observation defects
stop before operational mutation or scratch proof. One start is followed by a
short attempt/deadline-bounded read-only status/child loop. Rollback input is an
explicit complete linear chain plus the integration merge/mainline and accepted
baseline, proven by generated inverses in a temporary no-local clone.

The bundle helper now checks original supplied paths and every fixed managed
component with `lstat` before resolution, rejects visible/dangling links and
nonregular leaves, and treats bytes plus mode/uid/gid as restored equality.
Metadata-only repair, failure, fixed-set all-or-refuse, and replay are explicit.
No descriptor-chain or race framework was added.

Focused results: 77 coordinator/bundle tests pass; the broader focused host set
passes 137/54 skipped; full Node passes 165; affected Docker-native passes 3.
The replacement private bundle manifest is
`527f88a8897f5f2abe92a5ad9745a17db869c5e3440c351f841908d01aebcce2`
and its isolated bundle-proof SHA256 is
`5eb527a2f2b77edca7033c856794b6f9c53466a9dc0b0545bcbf85c7b3f69983`.
The previous candidate/freeze/report remain untouched. Preliminary complete
Tier 0 passes 404/185 skipped and Docker Tier 1 passes 78/511 deselected. Re-run
all gates on the exact staged evidence bytes, complete prospective rollback
proof plus pinned probe/diff/remote/teardown, then freeze/push/report one
replacement candidate. Do not run renewed review or any Gate A/live/global
action.

## 32. Gate A preflight repair — exact version stream admission

**Accepted historical candidate:**
`ed42db9f20ce7a58689707b188e35028e31abf55`, tree
`7fb098436e13296191ab64ef593c49550c70c162`, exact configured `PASS`.

**Pre-mutation blocker:** supported Prime Agent 0.9.8 wrapper
`/Users/jlanders/code/prime-agent/.worktrees/cwd-fix-v0.9.8-r1-source/prime-agent.sh --version`
returns 0, empty stdout, and exact `0.9.8` on stderr. Current coordinator reads
stdout only and refuses it. Private diagnostic SHA256:
`c0388aa8ede3912106afc3500370494bd37bdbc56880cc9114c91e8ed161be73`.
No shutdown, landing, apply, restart, or other Gate A mutation occurred.

### 32.1 Narrow implementation

1. Change only coordinator executable version verification.
2. Require return code zero.
3. Treat stdout and stderr as raw candidate streams. Exactly one must be
   populated and the other empty.
4. The populated stream must equal the configured version as exactly one line.
   Reject both populated, both empty, extra text, blank-leading/trailing lines,
   multiline content, and mismatch.
5. Keep every other artifact digest, entrypoint, role, status, topology,
   readiness, and mutation gate unchanged. Do not create a reusable/general
   output-normalization layer and do not patch Prime Agent.

### 32.2 Exact tests and real interface proof

Add focused recording cases for:

- exact stdout success with empty stderr;
- exact stderr success with empty stdout;
- both streams populated;
- both streams empty;
- stdout or stderr extra content;
- multiline and blank-line variants;
- version mismatch; and
- nonzero return code even when one stream contains the expected version.

Add one bounded read-only real probe of the supported Prime Agent 0.9.8 wrapper
that asserts return code 0, empty stdout, exact single-line stderr `0.9.8`, and
successful coordinator version admission without invoking status, shutdown,
landing, apply, start, or user-global mutation.

### 32.3 Evidence, topology, gates, and stop

- Preserve ed42, its PASS, and the owner diagnostic unchanged.
- Update only affected documentation/traceability and regenerate affected
  private bundle, readiness, and coordinator-config/proof evidence.
- Prove successor rollback as the exact linear chain
  `[successor, ed42db9f20ce7a58689707b188e35028e31abf55,
  f2f3fcd25dbe3d96f05193261020d26bf79f1213]`, then merge
  `46147ff887569101b7e64a8466cde5887c15cc31` with mainline 2, yielding baseline
  `c24ba6c1e76585193d4f34f0b0b0233846780442` / tree
  `a9955483816af04a4c68468a8e2ce3d0d0d00a5d` in a no-local isolated clone.
- Run focused host/real-wrapper/Docker-native checks, full Node, complete Tier 0,
  selected Docker Tier 1, pinned Prime Agent 0.9.8 probe, diff/remote equality,
  and teardown.
- Freeze/push one clean immutable successor, report it to the owner, and stop.
  The owner must admit one fresh exact configured review because bytes changed.

Do not touch primary `main`, the owner's private local-edit backup, invalidated
ed42 config/state, live processes, user-global state, UAT, S5, compatibility
removal, finalization, bookkeeping close, or physical cleanup.

### Section 32 implementation checkpoint

The exact version seam now captures nonzero status, uses a ten-second bound, and
admits only the configured version followed by one LF on exactly one raw stream.
It rejects both/empty streams, no-LF and CRLF forms, whitespace, extra/blank/
multiple lines, mismatch, and nonzero output before status or operational work.
The real supported 0.9.8 wrapper test calls only `--version` and proves empty
stdout plus exact stderr `0.9.8\n`.

Focused seam coverage passes 100. Preliminary broader focused host passes
160/54 skipped, Node passes 165, and Docker-focused passes 3. Two independent
read-only audits confirmed the bounded code/test surface and private evidence
plan; their tightening findings are incorporated. The new private bundle
manifest is `ff9a321274b8953f0a1b97bddee9e2f4b7f156990f1370c762c93982ca35ad68` and isolated bundle proof is
`4725e44be01966e0127b0c2c298343e6a7feec3cff80f0a26c1a8ecd80d1ba5f`; Section 31 and Gate A diagnostic artifacts remain
unchanged.

Next, stage the exact successor bytes, prove the complete prospective rollback
chain through ed42 then f2f3 and integration merge mainline 2, run complete exact
Tier 0/Docker/pinned/diff/remote/teardown gates, freeze/push one candidate,
create exact successor-bound proof-only config/rollback/freeze receipts, report
the owner, and stop for fresh exact review. Do not run Gate A or any live/global
mutation.

## 33. Final stop-loss repair — lossless version capture adapter

**Blocked immutable successor:**
`47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4` / tree
`a4667c0047a9ea6f3379790d024c3df44754f00c`.

**Preserved exact review evidence:** owner report SHA256
`039a66d0ad404d5592913d9476dfef77c6e309dbc16b5dd9a23e3593f6008262`;
reviewer production-`LocalRunner` matrix SHA256
`bf8d9d182c028b77608745237aa286cf416aaf704a35bbd26ea94a0a77a337de`.

**Accepted root cause:** general `LocalRunner.run` invokes `subprocess.run` with
`text=True`; universal-newline conversion changes raw CRLF and bare CR to LF
before the Section 32 verifier. Recording fakes returned already-decoded strings
and therefore bypassed the production adapter defect.

### 33.1 One version-specific production seam

1. Add a version-only runner operation that invokes the supplied version argv,
   captures stdout/stderr losslessly as bytes (or exact equivalent), and retains
   the existing ten-second bound.
2. Do not change the signature or text semantics of general `LocalRunner.run`.
   Git, status, process, bundle, and all non-version commands remain unchanged.
3. Keep the version decision local to `verify_executable`; do not add a general
   normalizer or parser.
4. Require rc0, exactly one nonempty raw stream, and exact equality to
   `runtime.version.encode("utf-8") + b"\n"`; require the other stream to equal
   `b""`.
5. Reject nonzero, both/empty streams, no-LF, CRLF, bare CR, surrounding or
   internal whitespace, extra/blank/multiple lines, mismatch, timeout,
   undecodable bytes, and all other non-exact byte sequences.
6. Do not strip, `splitlines`, remove CR, concatenate streams, regex/substring
   match, patch Prime Agent, or broaden transaction/process/crash behavior.

### 33.2 Production-adapter coverage

Use the actual `LocalRunner` version-capture adapter with bounded temporary
emitters, not recording fakes alone, to prove:

- exact LF stdout and exact LF stderr are accepted;
- CRLF stdout/stderr and bare-CR stdout/stderr are rejected without conversion;
- both/empty streams, no-LF, whitespace, extra/blank/multiple lines, mismatch,
  nonzero expected output, undecodable/non-UTF-8 bytes, and timeout fail closed;
- no status, Git clone, shutdown, landing, apply, start, or other downstream
  command occurs after a version failure;
- first-call behavior, deterministic replay, and timeout cleanup are bounded; and
- the exact supported 0.9.8 wrapper still produces rc0, empty raw stdout, and
  raw stderr `b"0.9.8\n"`, and is admitted through the production adapter.

### 33.3 Evidence, rollback, gates, and terminal boundary

- Preserve 47d2d49, ed42, f2f3, their review history, the Gate A diagnostic, and
  both accepted review hashes unchanged.
- Update only affected documentation/traceability and regenerate affected
  private successor bundle, real-adapter proof, proof-only coordinator config,
  prospective/exact topology proof, gate receipt, freeze receipt, and owner
  packet. Never reuse an operational old config.
- Prove rollback chain `[successor,
  47d2d49280bd4ef8cd66e4bcc7eddcf7ad7980b4,
  ed42db9f20ce7a58689707b188e35028e31abf55,
  f2f3fcd25dbe3d96f05193261020d26bf79f1213]`, then merge
  `46147ff887569101b7e64a8466cde5887c15cc31` mainline 2, yielding
  `c24ba6c1e76585193d4f34f0b0b0233846780442` / tree
  `a9955483816af04a4c68468a8e2ce3d0d0d00a5d` in a no-local clone.
- Run exact focused production-adapter/real-wrapper/Docker/Node/Tier 0/Tier 1/
  pinned/diff/remote/teardown gates.
- Freeze and push one clean successor, report it, and stop for the one allowed
  final fresh exact owner review.

Do not touch primary `main`, the owner's private overlay, old configs, Prime
Agent source, live processes, user-global state, Gate A, UAT, S5, compatibility
removal, finalization, bookkeeping close, or physical cleanup.

### Section 33 implementation checkpoint — lossless adapter and evidence

The version-only `RawResult` / `LocalRunner.run_version` seam now captures raw
stdout and stderr bytes with the existing ten-second bound; general
`LocalRunner.run(..., text=True)` remains unchanged. `verify_executable` compares
one raw stream directly to `runtime.version.encode("utf-8") + b"\n"` and
requires the other to be empty. The actual production adapter covers LF, CRLF,
bare CR, no LF, ambiguity, whitespace, extra/blank/multiple lines, mismatch,
non-UTF-8, nonzero, downstream absence, first/replay behavior, bounded timeout,
child reaping, and the supported 0.9.8 wrapper's raw stderr contract.

The post-audit focused suite passes 120. Byte-contract audit is `PASS`; evidence
audit's malformed replay and timeout-bound tightenings are incorporated. Current
private evidence is reconstructed only from Section 32 preserved inputs:
source topology `35a2307c7edad520c6c9fb0b47d37eaaf4bd78e0cfe34b9f8bae92fd8bf1c487`,
bundle manifest `f48241bbc2e9019bfc8606d63d526e2fdf72b17cd538d93bede6d54ee4556f93`,
bundle proof `afd6eb29f86093a7efb8e50d7872a3f6639a8affd8ca4ce3229f34e7c51f7232`,
and raw adapter proof
`37fd6704ac622c7b7dfa1e8b516ac6380709023a42695934fe16430a2e18c3c2`.
No user-global state was read and no prohibited action occurred.

Next run preliminary broader exact gates, stage the intended successor, prove the
prospective full rollback chain, run complete exact gates, freeze/push one clean
successor, regenerate successor-bound private receipts, report the owner, and
stop for the one allowed final fresh exact review.

## Docker validation recovery

The owner Conversation explicitly hard-restarted Docker Desktop. Independent
`docker info` returned server version `29.6.2`. The first retry then exposed only
the recovered worktree's absent `.env`; an isolated mode-0600 selector containing
`PRIME_AGENT_PINNED=0.9.8` supplied the already approved test input without
credentials or tracked configuration. The exact Docker-focused gate then passed
3 tests. The external blocker is resolved; continue the bounded freeze workflow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One-time Backlog migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`.

Tracked source paths:
- `.ralph/plans/archive/official-lean-compatibility-cleanup/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/official-lean-compatibility-cleanup/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530` (shared terminal/status evidence)

Every listed source remains tracked in this bounded migration slice. Git history preserves verbatim bytes. This task imports the bundle's specification/requirements into Description and native criteria, execution plan into Implementation Plan, durable history into these notes, and terminal outcome into Final Summary. Existing task ID and `parent_task_id` are preserved. No bundle is placed under `backlog/archive/`.

Related durable Backlog tasks: .

### Shared archive-index outcome

## official-lean-compatibility-cleanup/ — Official lean role protocol final candidate ✅ IMPLEMENTATION COMPLETE (2026-10-08)

Delivered the official lean compatibility cleanup through owner-reviewed slices,
ending at accepted revised Slice 6 commit `64bbee26c363c87ef85446da707900439c869620`. Final-candidate
preparation then integrated `origin/main`
`7bbaebf959391bc8488fad4751c245f33f4e7f6c` without rewriting accepted history
in merge commit `41b94b5bad3a4cc6a205ecac7e0527cce78cad3d`, reconciled the two preserved pre-landing
files, and archived this completed plan set before immutable freeze.

- [Archived specification](official-lean-compatibility-cleanup/SPECIFICATION.md) —
  SHA256 `305f8b69fc881fa25fdcabdeace4688e13787651270f843799f6f8471d30c012`.
- [Archived execution plan](official-lean-compatibility-cleanup/EXECUTION_PLAN.md) —
  SHA256 `33437aa648a0fc6b788db053edc216c543e3cdfa9d16944e978e5dbf21e6a325`.
- Managed reviewer SHA256 after main reconciliation: `dcd02e81e7e0656a3d7eb89ccfa78bd8b24a8492de012122f82b17b7aec50a05`.
- Goals-and-heartbeats reconciliation SHA256: `6c9daca98cf818a784334493190f2c4ea17218ffb61e52b52919105178a6aaa1`.
- Interactions reconciliation: all existing 100 records preserved, exact six
  missing records appended in order; resulting 106-record SHA256
  `86f65e44d6a12fc0e06c0c7fc3fabb17d0cf01e3bbbf88df7db6ea6d2e219fe7`.

The exact frozen candidate, post-freeze gates, official review, and operator
disposition are recorded in private receipts and `PRIMECLAW-10.34`; they do
not mutate this candidate tree. This archive does not authorize merge, host
final-mode apply, live Gate B, restart, episode finalization, or physical
resource cleanup. The bead remains open pending the operator's later terminal
decision.

Bidirectional superseded-history link: `PRIMECLAW-40` preserves the accepted official-lean-session-protocol predecessor; this task remains the replacement/current completed owner.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Superseded without claiming the broad original terminal acceptance contract. Later role-protocol and simplification work replaced or retired the archived episode machinery and obsolete official-review bootstrap path. Any current UAT or bookkeeping gap must be tracked as a narrow task against the current architecture.

## official-lean-compatibility-cleanup/ — Official lean role protocol final candidate ✅ IMPLEMENTATION COMPLETE (2026-10-08)

Delivered the official lean compatibility cleanup through owner-reviewed slices,
ending at accepted revised Slice 6 commit `64bbee26c363c87ef85446da707900439c869620`. Final-candidate
preparation then integrated `origin/main`
`7bbaebf959391bc8488fad4751c245f33f4e7f6c` without rewriting accepted history
in merge commit `41b94b5bad3a4cc6a205ecac7e0527cce78cad3d`, reconciled the two preserved pre-landing
files, and archived this completed plan set before immutable freeze.

- [Archived specification](official-lean-compatibility-cleanup/SPECIFICATION.md) —
  SHA256 `305f8b69fc881fa25fdcabdeace4688e13787651270f843799f6f8471d30c012`.
- [Archived execution plan](official-lean-compatibility-cleanup/EXECUTION_PLAN.md) —
  SHA256 `33437aa648a0fc6b788db053edc216c543e3cdfa9d16944e978e5dbf21e6a325`.
- Managed reviewer SHA256 after main reconciliation: `dcd02e81e7e0656a3d7eb89ccfa78bd8b24a8492de012122f82b17b7aec50a05`.
- Goals-and-heartbeats reconciliation SHA256: `6c9daca98cf818a784334493190f2c4ea17218ffb61e52b52919105178a6aaa1`.
- Interactions reconciliation: all existing 100 records preserved, exact six
  missing records appended in order; resulting 106-record SHA256
  `86f65e44d6a12fc0e06c0c7fc3fabb17d0cf01e3bbbf88df7db6ea6d2e219fe7`.

The exact frozen candidate, post-freeze gates, official review, and operator
disposition are recorded in private receipts and `PRIMECLAW-10.34`; they do
not mutate this candidate tree. This archive does not authorize merge, host
final-mode apply, live Gate B, restart, episode finalization, or physical
resource cleanup. The bead remains open pending the operator's later terminal
decision.
<!-- SECTION:FINAL_SUMMARY:END -->
