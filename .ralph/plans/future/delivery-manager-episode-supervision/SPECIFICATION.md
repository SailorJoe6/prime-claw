# Specification — Delivery Manager episode supervision

> **Status: requires redesign before planning or implementation.** The accepted
> `prime-claw-h6w.32` direction supersedes this draft's generated role-kernel,
> authenticated-role, and private official-EXPERT assumptions. Prime Claw roles
> are skill-based; the plugin may help invoke the right skills at lifecycle
> boundaries but does not authenticate roles. EXPERT review now uses the
> Markdown-only `prime-claw-expert-review` workflow and native Prime Agent RLM
> and messaging. This note prevents the stale draft from reintroducing retired
> machinery; the Delivery Manager design itself remains future work.


> **Status:** FUTURE — awaiting operator review. This document specifies a possible enhancement only. It does not authorize planning or implementation.

## Summary

Introduce a worktree-rooted **DELIVERY MANAGER** when an approved project
CONVERSATION invokes `/implement-spec`. The DELIVERY MANAGER assumes the
implementation-supervision responsibilities that currently change the owning
CONVERSATION's role. It drives one persistent EPISODE through the established
`handoff -> execute` loop, admits bounded EXPERT reviewers when useful, and
reports escalations and terminal readiness to the owning CONVERSATION.

The CONVERSATION remains on the canonical main checkout and retains a stable
role: product intent, specification and plan review, user communication,
product and scope decisions, and terminal merge, abandonment, and cleanup. The
DELIVERY MANAGER, EPISODE, and EXPERT hierarchy remains scoped to one approved
specification, branch, and worktree.

The initial design deliberately preserves the current persistent EPISODE and
its self-authored compaction focus between slices. A rotating fresh-Executor
variant remains an evidence-driven future option, not part of the initial
required behavior.

This enhancement begins only after the separately approved
`official-lean-compatibility-cleanup` episode reaches its accepted final clean
state. It extends that generation's managed role protocol; it does not amend,
replace, or become a dependency of the in-progress cleanup.

## Current system

A top-level project session on the canonical checkout is a CONVERSATION. It may
remain an ordinary discussion or create a reviewed future specification and
plan. When the operator invokes `/implement-spec`, trusted mechanics create an
isolated branch, worktree, and durable EPISODE session.

The owning CONVERSATION then changes responsibilities. It stops acting as only
a product conversation and becomes the active implementation supervisor. It
reviews each EPISODE slice, obtains EXPERT evidence where appropriate, accepts
or revises the slice, and invokes canonical handoff until the approved work is
complete. After terminal readiness, it presents the merge or abandonment
choice to the operator and performs the authorized terminal work.

This design correctly keeps implementation out of the canonical checkout, but
it couples two different roles inside one long-lived CONVERSATION:

1. developing product intent and reviewed specifications; and
2. continuously supervising one implementation lifecycle.

The responsibility change also encourages unrelated agent topology to collect
around the CONVERSATION. The EPISODE must be a depth-0 sibling because it owns a
separate worktree, but EXPERT reviewers and other bounded work do not require
separate root sessions.

## Problem statement

`/implement-spec` is a natural responsibility boundary. Before it, the
CONVERSATION develops and reviews intent. After it, a branch-scoped actor must
manage implementation, review, handoff, evidence, and readiness.

The system should make that boundary explicit without weakening the proven
properties of the current EPISODE loop:

- one persistent implementation context for the approved specification;
- one reviewable slice at a time;
- durable updates before continuation;
- a deliberate handoff focus chosen by the EPISODE;
- self-compaction between slices to remain in the context-window sweet spot;
- retained invocation-level understanding across slices;
- exact owner review and optional independent EXPERT judgment; and
- user authority over scope, merge, abandonment, and destructive cleanup.

## Goals

1. Keep every ordinary CONVERSATION's responsibilities stable before, during,
   and after implementation.
2. Create one durable, worktree-rooted DELIVERY MANAGER per promoted
   specification.
3. Preserve one persistent EPISODE and the existing `handoff -> compact ->
   execute` context-management behavior.
4. Make the EPISODE and every official EXPERT a bounded descendant of the
   DELIVERY MANAGER rather than a separate project root.
5. Keep live child accumulation bounded and make child settlement the manager's
   responsibility rather than relying on children to clean themselves up.
6. Preserve exact ownership, reviewed-scope, branch, worktree, and terminal
   authority boundaries.
7. Leave merge, abandonment, manager termination, worktree removal, and final
   bookkeeping with an actor outside the resource being destroyed.
8. Preserve room to test fresh per-slice Executors later without making that
   unproven strategy a prerequisite for this enhancement.

## Non-goals

- Automating the universal agent or communication-channel layer.
- Allowing the DELIVERY MANAGER, EPISODE, or EXPERT to approve product scope,
  merge, abandonment, or destructive cleanup.
- Replacing the reviewed `/design` or `/spec-it-out` -> `/plan` ->
  `/implement-spec` gates.
- Replacing the existing persistent EPISODE with rotating Executors in the
  initial behavior.
- Making EXPERT review mandatory for every intermediate slice.
- Treating model-level read-only instructions as a capability sandbox.
- Solving general multi-project scheduling, prioritization, or resource quotas.
- Requiring existing active episodes to migrate in place.
- Changing the scope, sequencing, candidates, activation gates, UAT, finalization,
  or cleanup of the in-progress `official-lean-compatibility-cleanup` episode.
- Reintroducing the legacy global APPEND block, project-local oversight policy,
  standalone EXPERT profile, or user/custom-message policy injection that the
  official cleanup removes.

## Compatibility with the official lean role protocol

This specification depends on the accepted final generation produced by
`.ralph/plans/future/official-lean-compatibility-cleanup/`. That work establishes
one selected-global-context neutral kernel, system-channel integrity checks,
on-demand managed Conversation guidance, one official Python-backed EXPERT
skill, explicit managed-role identity, context-opt-out fail-close behavior,
historical provider-message filtering, and deterministic lifecycle gates.

The Delivery Manager enhancement must reuse those authorities rather than build
parallel ones:

1. **Role kernel:** extend the single canonical `ROLE_KERNEL.md` and its generated
   runtime bytes through a reviewed protocol-version change. Add
   `DELIVERY_MANAGER` as an explicit managed role. Never infer it from a
   worktree, branch, CWD, recursion depth, name, or prompt. The existing final
   kernel remains authoritative until the new generation passes its own
   apply/check/restart/UAT gate.
2. **Global context and integrity:** retain the selected-global-context system
   channel, exact marker parsing, provider abort behavior, explicit context
   opt-out, and zero fresh user/custom policy injection. Do not restore a
   project-local or APPEND-based manager prompt.
3. **Role guidance:** keep `prime-claw-oversee-episode` the sole Conversation
   policy. Add one uniquely named managed Delivery Manager skill for manager
   judgment, activated through the same on-demand, exact-session,
   exact-generation receipt pattern. Do not make the manager impersonate a
   Conversation or duplicate Conversation guidance.
4. **EXPERT authority:** keep `prime-claw-official-expert-review` the sole
   official EXPERT configuration, rubric, and admission implementation. A later
   version may authorize its native reservation path for an exact trusted
   DELIVERY_MANAGER bound to the same delivery. It must not add another profile,
   parser, reviewer skill, or fallback topology.
5. **EPISODE authority:** extend trusted role binding so one exact direct child
   of the manager can receive bounded EPISODE implementation authority. A generic
   bootstrap child remains authority-free until deterministic binding succeeds.
   Depth and shared CWD are supporting evidence only.
6. **Handoff:** add or version a deterministic manager-to-child handoff path
   that preserves the existing EPISODE `handoff -> compact -> execute` behavior.
   Do not weaken or silently reinterpret the Conversation-to-sibling handoff
   contract that lands in the official cleanup generation.
7. **Finalization:** retain the owning CONVERSATION as the only actor that can
   present terminal disposition and invoke final bookkeeping after verified
   merge or abandonment work. The manager never acquires owner finalization or
   physical cleanup authority.
8. **Installation:** extend the official role-protocol manager, manifest,
   installer allowlist, collision checks, receipts, and rollback machinery for
   the additional managed role/skill. Do not restore the predecessor append
   manager or compatibility files.

The existing official-lean migration episode must finish entirely under its
approved three-role protocol. It is evidence and a prerequisite for this future
work, not a live migration target or UAT fixture for the new manager role.

## Roles and terminology

### CONVERSATION

A user-facing top-level session rooted in the project's canonical checkout. It
owns product intent and the relationship with the operator. It may create and
own multiple future specifications, subject to project policy, but each
promoted specification has one exact owning CONVERSATION.

The CONVERSATION does not supervise ordinary implementation slices after the
DELIVERY MANAGER is successfully admitted. It receives only status summaries,
material escalations, and terminal readiness claims unless the operator asks
for more detail. The later managed Conversation guidance must state this
transfer explicitly; until that reviewed protocol generation is active, the
official-lean Conversation supervision contract remains unchanged.

### DELIVERY MANAGER

A durable top-level session rooted in one promoted specification's isolated
worktree. “Delivery Manager” is intentionally narrower than “Project Manager”:
it owns one delivery stream and has no project-wide product authority.

The DELIVERY MANAGER supervises work but does not implement it. It owns the
branch-scoped coordination state, reconciles reports and evidence, controls the
bounded child lifecycle, and drives the persistent EPISODE through accepted
handoffs. Before any lifecycle-changing manager action, it must activate the
exact installed managed Delivery Manager guidance and hold a current receipt
bound to its trusted role, delivery, protocol generation, and skill hash.

### EPISODE

One persistent direct child of the DELIVERY MANAGER that implements the
approved specification one reviewable slice at a time. It begins in the same
worktree as the manager and remains the implementation-context carrier for the
lifetime of the delivery.

The EPISODE may use bounded implementation helpers within the available
recursion depth. Those helpers remain descendants of the DELIVERY MANAGER tree
and receive no manager, owner, product, merge, or cleanup authority.

### EXPERT

A fresh, bounded, read-only direct child of the DELIVERY MANAGER for one exact
question or immutable candidate. EXPERT independence means independent context
and judgment, not a depth-0 root session. It returns a complete PASS or
actionable BLOCK report and has no implementation or terminal authority.

## Required end state

For each promoted specification, the runtime topology is:

```text
Owning CONVERSATION — canonical checkout
  └── DELIVERY MANAGER — depth-0 root, specification worktree
        ├── EPISODE — persistent direct child, same worktree
        │     └── optional bounded implementation helpers
        └── EXPERT — fresh direct child for one bounded review
```

The DELIVERY MANAGER is the only new depth-0 root required by the promoted
specification. EXPERT reviewers must not use a depth-0 session merely for
independence or as a fallback from a raced child admission.

The DELIVERY MANAGER and all descendants carry trusted bounded roles. Merely
copying prompts, names, paths, or conversation history must not grant manager,
episode, expert, owner, or terminal authority.

## `/implement-spec` transition

When the operator invokes `/implement-spec <future-folder>` from an eligible
CONVERSATION:

1. The CONVERSATION activates the exact installed managed Conversation guidance
   and obtains the official protocol's current pre-promotion receipt bound to
   the operator-selected future location.
2. The existing reviewed-bundle readiness policy validates the exact selected
   future folder and activation receipt.
3. Trusted mechanics derive and create the branch and worktree and promote the
   approved artifacts inside that worktree.
4. Trusted mechanics create and publish one durable DELIVERY MANAGER rooted in
   that worktree.
5. Durable identity binds the manager to the exact owner CONVERSATION,
   specification location, branch, worktree, promoted artifact set, and
   protocol generation.
6. The manager activates its exact installed manager guidance, obtains a
   matching receipt, reserves one persistent child identity, and binds that
   exact direct child as the EPISODE before its first implementation provider
   call.
7. The manager starts the customizable execute workflow in that bound EPISODE
   exactly once.
8. Only after manager and EPISODE admission are definite does the CONVERSATION
   report successful promotion to the operator.
9. The CONVERSATION returns to its stable conversational role. It does not
   implement the work or drive ordinary slice handoffs.

A partial, ambiguous, or mismatched manager/EPISODE admission must fail closed
with exact retained recovery evidence. Retrying uncertain delivery must not
create a duplicate manager or EPISODE.

## Slice lifecycle

For each implementation slice:

1. The EPISODE chooses one small end-to-end slice within the approved scope.
2. It implements, validates, updates required durable artifacts and Beads,
   creates one reviewable commit, pushes it, and reports exact evidence to the
   DELIVERY MANAGER.
3. The manager reconciles the report against the exact session, branch,
   worktree, commit, diff, tests, documentation, plan, issue state, and push.
4. The manager performs its own bounded review and admits a fresh EXPERT when
   required by project policy or material risk.
5. The manager adjudicates every finding and chooses only one allowed
   disposition:
   - accept and advance;
   - request an in-scope revision;
   - pause;
   - or escalate a product, scope, authority, or ambiguous decision to the
     owning CONVERSATION.
6. On accepted advance or bounded revision, the manager supplies only accepted
   recorded findings and permitted focus to the canonical handoff path.
7. The EPISODE updates durable state, authors the focus hint for what its next
   iteration needs, requests compaction of its own context, and continues to
   execute through the canonical follow-up.
8. The manager never substitutes a fresh EPISODE merely because handoff,
   compaction, or message delivery is slow or uncertain.

The handoff focus remains authored from the EPISODE's implementation
understanding. The manager may supply accepted review facts and bounded
priorities, but it must not replace the EPISODE's responsibility to preserve the
right implementation context through compaction.

## Context responsibilities

The three active contexts have distinct purposes:

- **CONVERSATION context:** product intent, operator decisions, specification
  lineage, and terminal authority.
- **DELIVERY MANAGER context:** exact ownership, slice dispositions, review
  evidence, escalations, lifecycle state, and readiness.
- **EPISODE context:** implementation understanding, invocation-level working
  state, cross-slice technical continuity, and the next compaction focus.

Durable project facts and decisions still belong in their canonical project
stores. Neither manager nor EPISODE context substitutes for required living
artifacts.

## EXPERT lifecycle

For an official review, the DELIVERY MANAGER must use the installed
`prime-claw-official-expert-review` authority and its native reservation,
handle-binding, child-side consumption, settlement, and readiness paths. It
must not reimplement the reviewer protocol in manager prompts or project files.
Through that authority it must:

1. prove the caller is the exact trusted manager for the delivery and holds a
   current manager-guidance receipt;
2. resolve the configured exact model and reasoning level;
3. admit one uniquely named direct child with a harmless generic bootstrap;
4. wait for definite bootstrap readiness or observed idle before delivering the
   real task exactly once;
5. bind the exact child to one immutable question or commit and one validated
   review packet before the first review provider call;
6. accept only a complete report from that exact child;
7. preserve the report, model/reasoning evidence, findings, and manager
   disposition; and
8. settle and delete the child after all delivery and report work is definite.

A bootstrap race, busy child, uncertain delivery, missing report, or cleanup
failure must not be converted into a new depth-0 reviewer session. Ambiguity
blocks or waits; it does not change topology.

EXPERT read-only behavior remains a semantic contract unless a supported
capability boundary becomes available. Exact pre/post repository state must be
recorded so review evidence from a mutating reviewer can be rejected.

## Bounded child accumulation

The DELIVERY MANAGER owns child lifecycle hygiene. The expected live set is:

- exactly one persistent EPISODE while delivery is active;
- at most the currently required fresh EXPERT or bounded helper set; and
- no settled child retained as an active or addressable worker after its result
  is durably preserved and its cleanup is definite.

Child settlement must not depend on the child cleaning itself up. Failed or
uncertain cleanup remains visible in manager state and blocks terminal readiness
when it could leave active work or ambiguous authority. Historical transcripts,
artifacts, and tombstones may remain scoped to the delivery until terminal
resource cleanup; they are not equivalent to live workers.

## Communication and authority

The manager accepts lifecycle direction only from its exact owning
CONVERSATION or trusted deterministic host mechanics. Other project
CONVERSATIONS may request read-only status but cannot advance, revise, pause,
merge, abandon, or clean up the delivery.

The manager communicates with the owning CONVERSATION when:

- a product or scope decision is required;
- the approved artifacts are contradictory or insufficient;
- credentials, permission, or external operator action is required;
- lifecycle or delivery state is uncertain;
- the operator requests status; or
- the complete candidate is ready for terminal disposition.

Routine slice traffic stays inside the manager tree.

## Terminal readiness

The DELIVERY MANAGER may claim `READY_FOR_DISPOSITION` only after:

- the complete approved specification and plan are implemented;
- required artifacts and issue state satisfy project policy;
- the exact branch and commit are pushed;
- all required tests and evidence are complete;
- required final EXPERT review has a complete acceptable disposition;
- every finding is adjudicated;
- the persistent EPISODE is idle at a known completed boundary;
- no EXPERT or helper has outstanding work or uncertain delivery;
- the manager has stopped admitting new work; and
- an exact terminal receipt is sent to the owning CONVERSATION.

The receipt includes the specification identity, manager and EPISODE identity,
branch, worktree, exact candidate commit, remote equality, test and review
evidence, artifact and Bead state, unresolved risks, and child-lifecycle state.
It is a readiness claim, never merge or cleanup authority.

## Merge, revision, pause, abandonment, and cleanup

The owning CONVERSATION remains outside the resource tree and handles terminal
disposition.

1. It independently verifies the exact terminal receipt and repository state.
2. It presents the operator with merge, revise, pause, or abandon choices.
3. Only the operator grants terminal authority.

For **revise**, the CONVERSATION records and sends only an approved in-scope
revision to the manager. The manager resumes the same delivery tree.

For **pause**, manager, EPISODE, branch, and worktree remain intact and no new
work begins until authorized continuation.

For **merge**:

1. the manager remains quiescent;
2. the CONVERSATION performs the authorized merge and push;
3. it verifies that the canonical remote contains the exact accepted candidate;
4. it terminates the manager tree, including the EPISODE and descendants;
5. it verifies termination before removing the worktree;
6. it applies the approved branch-retention policy; and
7. it clears exact durable delivery identity only after every terminal action is
   verified.

If merge or push fails, manager identity and resources remain available for
recovery. Cleanup does not continue on an unverified merge.

For **abandonment**, the CONVERSATION first terminates and verifies the manager
tree, then removes only the authorized worktree and branch resources, and
finally clears identity. Ambiguity blocks destructive cleanup.

The DELIVERY MANAGER must never delete its own session, worktree, branch, or
identity.

## Concurrent deliveries

Different specifications may have different DELIVERY MANAGER roots and
worktrees. Each has one exact owner and isolated identity. Concurrent managers
must not share writable worktrees or active-plan state.

Before terminal readiness, a manager must reconcile its candidate with the
current canonical target branch according to project policy and renew invalidated
tests or reviews. One delivery's merge may therefore require another delivery
to rebase and revalidate; it must never silently reuse pre-rebase evidence.

Whether one CONVERSATION may own multiple concurrent deliveries is a project
policy choice. The identity model must support it without allowing one
specification's messages or terminal authority to affect another.

## Evidence-driven rotating-Executor option

A fresh Executor per slice remains a future experiment. It must not replace the
persistent EPISODE until evidence shows that the durable handoff packet is
sufficient to preserve required context without increasing unsafe rediscovery or
rework.

A low-risk evaluation may run a fresh read-only shadow agent after selected
real handoffs. Give it only the state a rotating Executor would receive:
approved specification and plan, living docs, issue state, Git state, accepted
findings, and the handoff focus. Compare its reconstruction with the persistent
EPISODE's post-compaction understanding:

- next slice;
- invariants to preserve;
- rejected approaches;
- incomplete work;
- required tests and evidence; and
- unsafe or out-of-scope actions.

Track missed constraints, revived rejected approaches, next-slice divergence,
missing tests, dependence on unrecorded context, intervention count, tokens,
and latency. Only an explicit later reviewed specification may change the
default from retained EPISODE to rotating Executors.

## Failure and recovery requirements

- Missing, duplicate, corrupt, expired, or disagreeing owner, manager, EPISODE,
  branch, worktree, specification, or protocol identity fails closed.
- A manager must not create a second persistent EPISODE for the same active
  delivery because the first appears idle, unavailable, or slow.
- A raced child bootstrap is recovered within the same child lifecycle; it does
  not authorize `create_session` fallback.
- Reports are evidence, not command dispatch or approval.
- Compaction request admission is not proof that compaction completed.
- A manager or EPISODE crash retains enough exact identity and durable state for
  bounded resume or explicit operator recovery.
- Orphaned manager resources are never silently adopted by an unrelated
  CONVERSATION.
- Recovery actions never infer product, merge, abandonment, or destructive
  cleanup authority.

## Acceptance criteria

This enhancement is acceptable only when a manual end-to-end dogfood proves:

1. A CONVERSATION creates and receives review of a future specification and
   plan without changing its ordinary role.
2. `/implement-spec` creates one isolated branch/worktree and one exact bound
   DELIVERY MANAGER.
3. The manager admits exactly one persistent EPISODE child and starts execute
   exactly once.
4. At least two accepted slices complete through EPISODE report -> manager
   review -> optional direct-child EXPERT -> canonical handoff -> EPISODE
   self-compaction -> execute continuation.
5. The EPISODE demonstrates cross-slice continuity without exceeding the
   intended context-window working range.
6. The manager preserves review evidence and removes settled EXPERT children
   without creating reviewer root sessions.
7. A material product or scope question returns to the owning CONVERSATION and
   does not proceed without the required operator decision.
8. The final manager receipt identifies the exact complete candidate and proves
   no child work remains.
9. The CONVERSATION obtains explicit terminal authority, merges and pushes the
   exact candidate, verifies it, terminates the manager tree, removes the
   worktree safely, applies branch policy, and clears identity in the required
   order.
10. Failure-path dogfood proves uncertain admission, child delivery, merge, and
    cleanup retain recoverable resources and do not create duplicates or infer
    authority.
11. An ordinary sibling CONVERSATION cannot steer or terminate a manager it
    does not own.
12. Existing active delivery resources remain compatible or are explicitly
    completed under the predecessor workflow; no in-place implicit migration
    occurs.
13. The accepted official-lean final generation remains green: selected global
    context integrity, system-only kernel delivery, explicit context opt-out,
    historical filtering, retired-overlay absence, and zero restored legacy
    compatibility resources all pass regression tests.
14. The protocol contains exactly one canonical kernel, one Conversation skill,
    one Delivery Manager skill, one EPISODE execute policy, and one official
    EXPERT authority with exact installer ownership and collision checks.
15. Role-negative tests prove an ordinary root, Conversation, generic child,
    unbound child, stale manager, copied packet, CWD, branch, name, or recursion
    depth cannot acquire DELIVERY_MANAGER, EPISODE, EXPERT, owner, handoff, or
    terminal authority.
16. The official EXPERT reservation protocol accepts the exact trusted manager
    only for its bound delivery and continues to reject fallback reviewers,
    duplicate delivery, incomplete reports, and mutation evidence.
17. The manager-role generation passes isolated candidate tests and review,
    separately authorized landing/apply/restart, and representative
    Conversation/manager/EPISODE/EXPERT/ordinary-session UAT before it becomes
    the default promotion path.

## Dependencies and sequencing

1. `official-lean-compatibility-cleanup` reaches accepted final UAT,
   finalization, separately authorized physical cleanup, and synchronized clean
   `main` with its final managed role protocol active.
2. The exact installed and tracked final-generation kernel, role-protocol
   manager/manifest, Conversation skill, official EXPERT skill, provider guards,
   receipts, tests, and evidence are audited as the baseline for this work.
3. This specification receives operator review, then a separate `/plan` review,
   before any implementation resource is allocated.
4. Implementation uses a new episode created under the accepted official-lean
   generation. It does not reuse, revive, or modify the cleanup episode.
5. The role-protocol extension lands through its own reviewed generation and
   coordinated activation. Source merge, user-global mutation, restart, UAT,
   finalization, and physical cleanup retain separate authority.

## Open review questions

The specification currently makes these provisional choices for operator
review:

1. Use the role name **DELIVERY MANAGER** because it is scoped to one
   specification; “Project Manager” would imply broader authority.
2. Preserve one persistent EPISODE as the initial execution strategy.
3. Allow project policy to decide whether one CONVERSATION may own multiple
   concurrent deliveries.
4. Keep rotating Executors outside initial scope and evaluate them first through
   shadow handoff-sufficiency evidence.
