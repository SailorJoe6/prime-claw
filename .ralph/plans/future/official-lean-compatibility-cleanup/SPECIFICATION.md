# Specification — Official lean role protocol completion and compatibility cleanup

> **Status:** Future specification; awaiting operator review
>
> **Tracking:** `prime-claw-h6w.30`
>
> **Predecessor:** accepted official lean session-protocol cutover (`d2ee807ee2f0f066dac1a6b0f1d1c661f2fe1fd4`), terminal main checkpoint `62ee095cc9cfc7e88a884edec03024edf87953f0`
>
> **Implementation authority:** none. Planning, episode creation, landing, user-global mutation, restart, acceptance, finalization, and physical cleanup remain separately authorized.

## Summary

The accepted official lean cutover removed the repeated provider-visible oversight package and replaced it with a 246-word managed identity block installed through user-global `APPEND_SYSTEM.md`. Deterministic plugin code retained exact identity, lifecycle, handoff, finalization, recovery, and historical-message filtering. Restart and three-context UAT passed, the operator accepted the cutover, and the transition episode was finalized and physically cleaned.

Review of the proposed compatibility cleanup found that simple deletion would overcorrect in three ways:

1. deleting the project `oversee-episode` skill and discovery link would remove progressive Conversation guidance rather than only stopping automatic injection;
2. deleting `.prime/agent/profiles/expert-reviewer.md` would remove the only concrete definition of the official EXPERT without replacing its non-native admission mechanism; and
3. user-global `APPEND_SYSTEM.md` is only a fallback in Prime Agent v0.9.8, so an exact-CWD project `APPEND_SYSTEM.md` can structurally replace the lean kernel.

This specification completes the role protocol and removes compatibility in **one fresh episode**. The episode first installs and proves the replacement architecture while retaining legacy resources, then removes those resources after an explicit interim UAT gate, and ends only when the clean target state passes final UAT. Intermediate deployments and restarts are vertical slices within the same episode; they are not separate episodes.

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

### ORP-002 — Guarded selected-global-context installation

The guarded installer must place exactly one managed neutral-kernel region into the context file Prime Agent actually selects under the active destination `agentDir`.

Selection follows Prime Agent's exact per-directory priority. Required behavior:

- patch `AGENTS.md` when it is selected;
- otherwise patch `AGENTS.MD`, `CLAUDE.md`, or `CLAUDE.MD` in order;
- create `AGENTS.md` only when none of the four candidates exists;
- never create AGENTS when a selected CLAUDE file exists;
- when multiple candidates already exist, patch only the file Prime Agent selects;
- detect later selection drift and block or migrate the exact owned region rather than leaving latent copies.

The file is shared user-owned state. Apply/check/recovery must:

- own only the exact marker region and separators the installer introduced;
- preserve every unrelated byte, newline style, final-newline state, mode, and ownership;
- reject unsafe symlinks, non-regular files, unreadable files, malformed/duplicate/disagreeing markers, selection drift, and concurrent changes;
- lock, reread, validate, and write atomically in the same directory;
- retain exact preimage hashes and rollback metadata;
- never delete a pre-existing file; and
- delete an installer-created empty file only when ownership metadata proves no unrelated content remains.

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

### ORP-008 — Existing EPISODE execution role remains

The existing `execute` skill remains the EPISODE implementation procedure. This work may update routing names and documentation but does not broaden or rewrite its implementation policy unless a separately reviewed requirement proves necessary.

Trusted identity and lifecycle code must prevent an EPISODE, EXPERT, generic RLM child, or copied transcript from acquiring Conversation acceptance, handoff, merge, or cleanup authority.

### ORP-009 — Official EXPERT skill

Install one uniquely named plugin-managed global Python-backed skill:

`prime-claw-official-expert-review`

with the import name `prime_claw_official_expert_review`. Its managed directory contains `SKILL.md`, `pyproject.toml`, the exact Python package, and one canonical reviewer definition. A package manifest is not required; direct guarded installation under the destination `agentDir/skills` is a supported Prime Agent interface.

The skill must own and validate the official reviewer configuration and rubric formerly held by `.prime/agent/profiles/expert-reviewer.md`.

Direct guarded installation makes the skill discoverable but does not guarantee that every active Python interpreter can import it. When `PRIME_AGENT_KERNEL_PYTHON` is unset, Prime Agent manages Python-skill installation in its kernel environment. When that variable selects an external interpreter, Prime Agent does not install discovered Python skills there. Apply/check and EXPERT admission must detect the active kernel mode and verify that the exact managed module imports from the interpreter that will execute it. Prime Claw must not silently provision an external interpreter. A missing, stale, or mismatched module in custom-kernel mode produces deterministic `UNAVAILABLE` before model, message, or lifecycle mutation; a required review gate then blocks.

`prime-agent-runtime` and `agent_message` are host-provided runtime modules, not dependencies to add to this skill's `pyproject.toml`. Import `agent_message` lazily and fail closed when its visible host capability is unavailable.

The skill must:

1. require a full configured model selector and reasoning level;
2. call `rlm.find_models` and require one case-normalized exact selector match;
3. spawn one fresh uniquely named child with a harmless bootstrap and explicit model/thinking;
4. verify the returned handle model exactly matches the requested selector;
5. send the validated rubric plus one self-contained exact-commit packet exactly once through guarded `agent_message.send`;
6. accept only a definite delivered or queued receipt;
7. return a structured admission record containing child/session identity, exact returned canonical model, exact requested reasoning, successful spawn admission, commit, packet digest, and delivery result;
8. require an explicit complete PASS or actionable BLOCK reply; and
9. preserve the report and disposition before deleting the settled child.

`RlmSpawnHandle` does not return admitted reasoning. Successful spawn admission is evidence that Prime Agent validated and accepted the explicit reasoning request; the record must not claim the handle independently returned that value. If independently returned reasoning ever becomes an acceptance requirement, treat it as unavailable through the current public API until proven otherwise.

Lazy-import and preflight `agent_message`. In runtimes where messaging is unavailable, model selection is missing/ambiguous/expired, reasoning is unsupported, handle identity disagrees, delivery is uncertain, or the report is incomplete, record `UNAVAILABLE` or `BLOCKED`. Never inherit the current/default model, lower reasoning, choose a close selector, retry uncertain delivery, or claim EXPERT ran.

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

### ORP-019 — Complete isolated gates

Every exact candidate must pass complete Tier 0, selected complete Tier 1 in Docker, `git diff --check`, focused behavioral tests, and independent read-only exact-candidate review. Bare host-global candidate probing is prohibited.

Focused coverage includes:

- global candidate selection: AGENTS only, CLAUDE only, neither, both, case variants, unreadable/non-regular/symlink, and selection drift;
- byte preservation: LF/CRLF, no final newline, file mode/ownership, atomic write, lock/concurrent edit, rollback, and installer-created empty-file cleanup;
- neutral markers: missing, unmatched, reversed, nested, duplicate, stale, disagreeing, and exact replay;
- global plus project AGENTS/CLAUDE hierarchy;
- project SYSTEM and APPEND shadow cases;
- `--no-context-files` and SDK context override fail-closed behavior;
- normal direct, queued, injected, direct idle agent message, custom trigger, retry, tool loop, post-compaction continuation, resume, reload, and recovered queue;
- root Conversation, active owner, EPISODE, EXPERT, generic child, daemon child, and inline child without role leakage;
- managed skill discovery, collision/shadow defense, activation version/hash, and stale receipt;
- EXPERT exact model, unavailable/expired model, unsupported reasoning, malformed configuration, handle mismatch, exactly-once delivery, uncertain receipt, incomplete report, and mutation detection;
- default managed kernel plus custom `PRIME_AGENT_KERNEL_PYTHON` with exact module present, missing, stale, or mismatched, including deterministic `UNAVAILABLE` before other mutation;
- legacy saved-session provider filtering; and
- no full role-skill body or reviewer rubric in ordinary provider prompts.

Extension exceptions must be shown fail-open in a control, while production rejection uses explicit abort and proves zero provider calls.

### ORP-020 — Correlatable evidence

Receipts must correlate exact commit/tree, main parent/topology, dependency revision, selected global context path, pre/post hashes, installed managed files, commands, raw logs, provider captures, counts, elapsed time, superseded failures, and teardown.

Review evidence records actual reviewer session identity, exact returned canonical model, exact requested reasoning, successful spawn admission, packet digest, report artifact, and disposition. It must not claim that `RlmSpawnHandle` returned reasoning. A profile or skill name alone is not evidence that review ran.

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

The one episode is complete only when all of the following are true:

1. `prime-claw-h6w.30` links the reviewed specification, plan, bridge/removal candidates, evidence, both activation gates, final decision, and terminal disposition.
2. The selected user-global context file contains exactly one exact managed neutral block while every unrelated byte and file attribute is preserved.
3. Local project AGENTS/CLAUDE, SYSTEM, and APPEND files do not structurally remove the neutral floor.
4. Managed work fails closed when context files are explicitly disabled or trusted role state disagrees.
5. Provider evidence shows the neutral kernel only in system instructions and zero fresh user/custom oversight package.
6. `prime-claw-oversee-episode` is the sole current Conversation policy and is activated on demand rather than always injected.
7. `execute` remains the bounded EPISODE procedure.
8. `prime-claw-official-expert-review` is the sole official EXPERT authority and satisfies exact-model, exactly-once, evidence, and unavailable behavior.
9. The bridge generation passes complete tests/review, separately authorized landing/apply/restart, and accepted interim UAT.
10. Compatibility removal does not begin before criterion 9 is recorded.
11. The final generation has no Prime Claw-managed global APPEND block, old project oversight skill/link, standalone expert profile, duplicate policy copy, or broken symlink.
12. Historical provider-message filtering, deterministic lifecycle behavior, and retired-overlay regression controls remain.
13. The removal generation passes complete tests/review, separately authorized landing/apply/restart, and accepted final three-context UAT.
14. Both rollback points are exact, history-preserving, and recovery-tested.
15. No active foreign worktree/session can exercise stale compatibility behavior at final acceptance.
16. Primary `main` is clean and synchronized after every landing and at completion.
17. The episode remains active through the clean target state, is finalized only after explicit final acceptance, and is physically cleaned only after separate operator authority.

## Dependencies and sequencing

- The accepted official lean cutover and its terminal cleanup are complete.
- This future folder and Bead remain the single specification/tracking authority for the full migration and cleanup.
- Project-Wide Testing remains independent. It may continue, but its live worktree/session must satisfy each applicable activation or cleanup safety gate.
- `prime-claw-h6w.29` remains independent and receives no implementation authority from this specification.
- Prime Agent public interfaces are constraints. Unsupported behavior is reported as a product limitation, not converted into an upstream patch plan.

## Open decisions for planning

No product decision remains about splitting episodes: one episode reaches the final clean state. The later execution plan must select exact vertical slices, candidate/landing topologies, activation receipt implementation, canonical kernel source/generation method, evidence paths, UAT fixtures, rollback commands, and terminal sequence without weakening these requirements.
