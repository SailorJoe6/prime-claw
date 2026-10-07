# Specification — Official lean role protocol completion and compatibility cleanup

> **Status:** Corrected Slice 1 accepted on 2026-10-06 at `57d26e582c583a81de370051b129f74f5b13ee45` / tree `d1739c3a2ffee4512d6741480b72792e3a8d4098`. Existing episode `01a10774-0155-7316-a329-50ee5f7d17be` remains the sole implementation episode and is advancing through bounded Slice 2 candidates.
>
> **Tracking:** implementation `prime-claw-h6w.30`; incident `prime-claw-gv7.1`; systemic correction epic `prime-claw-gv7`.
>
> **Predecessor:** accepted official lean session-protocol cutover (`d2ee807ee2f0f066dac1a6b0f1d1c661f2fe1fd4`), terminal main checkpoint `62ee095cc9cfc7e88a884edec03024edf87953f0`.
>
> **Implementation authority:** the existing episode may complete one smallest end-to-end Slice 2 candidate per canonical owner handoff, commit/push it, report, and stop. Slice 3, landing, user-global mutation, restart, UAT acceptance, finalization, bookkeeping, and physical cleanup remain separately authorized.

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
