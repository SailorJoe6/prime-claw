# Prime Claw requirements

**Status:** First consolidated draft for Joe's review, 2026-11-03.
**Authority:** This is the single maintained source of product requirements.
It records intended behavior, not a claim that every requirement is implemented
or deployed. This document authorizes no implementation, migration, merge,
activation, restart, or cleanup.

## 1. Product and scope

Prime Claw helps a thought worker carry a project from conversation to useful,
finished work without repeatedly explaining the project or managing agent
plumbing. Its larger destination is a persistent virtual personal assistant
across many projects, not just a software engineering organization.

The plugin's required scope is the manually driven project lifecycle:
initialize, specify, plan when useful, implement directly or in an isolated
Episode, supervise, review, continue, and finish. Some of these intended
behaviors still need correction. The sandbox builder supplies the isolated
runtime. The full always-on assistant remains future work; it is not a
reason to add orchestration to the plugin now.

Sources: [founding decisions](docs/founding-decisions.md),
[VISION.md](VISION.md), [plugin story map](docs/user-stories/README.md),
[PRIMECLAW-54][T54].

### How to read this document

- **Required** means recorded product intent, not a shipped-feature claim.
- **Requested correction** identifies intended behavior that an open task is
  still changing or proposing. Consolidating it here does not approve that
  task's plan or implementation.
- **Future** means direction outside the current plugin delivery contract.
- The observable outcomes below can be checked with a representative user flow
  and the relevant regression tests. They do not require a new compliance
  framework, evidence database, or exhaustive test matrix.

Later explicit operator decisions supersede older specifications, unchecked or
checked acceptance criteria, plans, and agent-authored recommendations. Existing
code and tests are not evidence that a behavior is wanted. A bugfix does not
create another product requirement merely because it introduced a guard.

Task specifications describe bounded changes to this baseline. Design records
explain choices. User stories illustrate workflows. Test inventories and
receipts record evidence. None is a second, independently maintained product
requirements list. Accepted product changes should update this file; historical
records should remain historical rather than be rewritten to match it.

## 2. Simplicity and authority

### G1. Use the least technology that meets the need

Prefer supported native Prime Agent, Git, Orca, Backlog, Beads, and gbrain
behavior. Put semantic judgment in editable skills and workflows. Add only the
small execution, transport, or exact-resource mechanics the native interfaces
actually need. A new persistent store, state machine, coordinator, approval
receipt, classifier, or replacement API is not a default solution. It needs a
specific unmet requirement and evidence that a simpler approach cannot meet it.

Sources: [PRIMECLAW-22][T22], [33.11][T33_11], [43][T43], [55][T55].

### G2. Editable Markdown and the LLM own workflow decisions

Skills and workflows own admission rules, lifecycle eligibility, readiness,
selected-ticket publication prerequisites, code-base suitability, scope,
semantic compatibility, review, and reconciliation decisions. Code loads the
relevant guidance, supplies factual observations, performs supported native
operations, and reports their results. It must not enforce a second policy by
renaming it a safety, integrity, provenance, preparation, or routing check.
Exact requested resource operations must still act on the right resources.
Native failures must be reported truthfully, not hidden or bypassed.

**Requested correction:** [PRIMECLAW-55][T55], including its latest 2026-11-03
clarification, applies this to the complete Backlog and Beads task-native
lifecycle: specification/planning, initiation, execution, handoff, oversight,
block/resume, merge/abandonment, and finalization/cleanup. Policy text in tool
descriptions or TypeScript prompt guidelines must also move to editable
Markdown. Do not limit the correction to admission or defer equivalent
later-stage code policy. Retained folder-lifecycle redesign is separate.
Sources also: [PRIMECLAW-37][T37], [43][T43].

### G3. Preserve operator authority without adding ceremony

The operator controls product, scope, implementation placement, merge,
abandonment, and consequential deployment or destructive actions. Clear bounded
delegation is valid authority. Planning alone is not implementation approval;
"plan, then implement if ready" may authorize both within scope. Do not ask for
fresh approval merely because a phase ended, or invent tokens and receipts to
prove ordinary conversational authority. Ask one focused question when a
material decision is genuinely unresolved.

Sources: [PRIMECLAW-10.26][T10_26], [33.11][T33_11], [51][T51], [54][T54].

### G4. Review proportionately; finish the work

Normal review finds concrete defects in the approved behavior and gives useful
repair direction. Advice and speculative hardening are not new scope or automatic
blockers. Do not assume hostile same-user attacks, demand crash-proof global
transactions, or repeat adversarial reviews without an approved need. Do not
revive the mandatory threat/failure/recovery/complexity paperwork later rejected
in PRIMECLAW-22. Keep a coherent piece of work moving through in-scope repairs
rather than multiplying episodes and approval gates.

Sources: [PRIMECLAW-22][T22], [10.34][T10_34], [33.11][T33_11]. The accessible
[personal-brain record](#brain-sources-and-limitations) also preserves Joe's
"architecture astronaut" rejection.

### G5. Preserve unrelated work and report facts honestly

Do not commit, stash, reset, overwrite, delete, or adopt another conversation's
work to satisfy a workflow. Unrelated changes and compatible history advances
are normal concurrent work, not permission to freeze the whole repository.
Distinguish requested, queued, completed, reviewed, published, and activated.
An uncertain consequential operation requires inspection, not a blind replay,
false success, or fresh duplicate allocation.

Sources: [PRIMECLAW-43][T43], [53][T53], [55][T55], [56][T56].

## 3. Project and implementation lifecycle

### P1. Install into the intended environment only

Install one coherent plugin generation into the explicitly selected environment.
Preserve unrelated global configuration and user instructions. Do not discover
the same plugin at both project and global scopes. Candidate testing must not
silently install or activate it in the live environment.

Sources: [PRIMECLAW-21][T21], [33.6][T33_6]; existing stories US-01–02.

### P2. Initialize and upgrade existing projects without erasing customization

A discoverable initialization skill must make an existing Git project usable
without manual file copying. Install editable project skills and workflows.
Update untouched templates; preserve customized and unknown content; explain
conflicts while allowing independent safe updates. Ordinary startup should be
quiet when nothing changes and must not rewrite an active Episode's snapshot.
Do not dirty a clean code checkout solely by creating local runtime state.

Sources: [PRIMECLAW-10.37.2][T10_37_2], [44][T44], [47][T47]; US-03–07.

### P3. Compare templates without modifying the real asset

Show a normal readable Git text patch using disposable copies. Viewing must not
change asset bytes, staging, or the index, even when the asset is dirty or staged.
Viewing is not acceptance. Keeping an override, resetting content, or recovering
an interrupted old review requires the operator's explicit content decision.
No specialized viewer, visibility handshake, or overwrite-and-restore ritual is
required.

Sources: [PRIMECLAW-44][T44], [10.37.4][T10_37_4]; US-05.

### P4. Keep ordinary use ordinary

A project conversation can discuss and incubate ideas without becoming an
Episode. Multiple conversations may coexist. A conversation may supervise its
own successive Episodes; it is not consumed by one. Load only relevant project
and role guidance. Preserve native skills and Prime Agent built-ins; natural
language entry must not require memorizing custom slash commands or duplicate
workflow implementations.

Sources: [PRIMECLAW-10.26][T10_26], [10.36][T10_36], [51][T51]; US-07.

### P5. Use one native task authority and independent task history

A project selects Backlog or Beads, not two competing live task stores. Keep
specifications, plans, task content, relationships, and lifecycle state in that
provider's supported native fields and history. Backlog uses ordinary Git task
history independent of code branches; Beads uses its native history. Preserve
supported existing layouts and grandfathered histories rather than silently
converting them. Do not add a mirrored tracker or universal normalized task
model. Ambiguous provider selection requires clarification, not a guess.
The managed task lifecycle remains visible as In Design, In Planning,
In Progress, Blocked, Ready for Merge, and Done, using native provider mappings.

Sources: [PRIMECLAW-35][T35], [43][T43], [44][T44]; US-28.

### P6. Save coherent ticket edits promptly and without unrelated commits

Use the selected provider's native authoring and publication workflow. Commit a
coherent ticket update as soon as it is ready and publish promptly when a remote
exists. Do not defer task durability until handoff or session end. Publish the
selected committed ticket before an Episode needs to read it. Preserve unrelated
task/code content, staging, and history; never manufacture a clean checkout by
including someone else's edits.

For independent task history, unrelated parent-code changes or divergence must
not block task-only authoring, status updates, or failure reporting. Publication
prerequisites and conflict handling remain skill/LLM decisions, not a duplicate
code policy.

**Requested corrections:** [PRIMECLAW-53][T53], [55][T55].

### P7. Produce a bounded specification from discovery or existing discussion

Support both guided discovery and synthesis of an already discussed idea.
Create or revise one exact native task with the outcome, scope, required
behavior, material constraints, and observable acceptance. Ask only remaining
material questions. New task-native specifications start In Design. Do not
allocate implementation resources or write boilerplate risk/process sections
just to fill a template. Stop for review when specification authoring was asked
for.

Sources: [PRIMECLAW-10.38][T10_38], [33.11][T33_11], [43][T43]; US-08–09.

### P8. Plan at the level the work needs

When requested, put a concise actionable plan on the exact native task and make
it reviewable as In Planning. Record relevant steps, tests, documentation, and
dependencies, not a required ceremony or phase-history proof. Keep the plan
living as facts change within scope. Planning allocates no Episode and does not
expand the operator's authority. An inadequate or contradictory specification
gets a useful explanation, not partial resource creation.

Sources: [PRIMECLAW-33.11][T33_11], [43][T43], [51][T51]; US-11–12.

### P9. Honor direct versus Episode placement

An explicit "here", "in this checkout", or "on main" request means direct work
without Episode tools, ownership records, or mandatory formal planning. An
explicit Episode request uses isolated Episode readiness and lifecycle.

When unspecified, use judgment: appropriately planned work normally goes to an
Episode; an obvious small unplanned fix normally stays direct; substantial
unplanned work or conflicting evidence gets one focused question. In Design
alone must not prohibit an authorized small direct change. Preserve placement
through a plan-then-implement request. Do not add a size/status classifier or
allow direct work to bypass another owner's active same-task Episode.

**Requested correction:** [PRIMECLAW-54][T54], explicitly approved routing;
implementation is not claimed here.

### P10. Bind the exact work and execution target

Honor the selected task, approved scope, execution setup, and code basis. Do not
silently substitute another task, host, branch, or checkout. Resolve material
ambiguity before mutation. A sole appropriate setup may be used without another
question; explicit placement never silently falls back.

**Requested correction:** the current checked-out branch may be the Episode's
base and default integration target, including a published stacked branch.
Skills should name a non-default branch and ask before stacking. That check-in
is an instruction, not a code-enforced approval protocol. Continuation, review,
merge, and cleanup must use the intended target rather than hardcoded `main`.
This does not change the separate primary-main global-activation policy.

Sources: [PRIMECLAW-48][T48], [51][T51]; US-13–15.

### P11. Create an Episode only when authorized and ready

For managed Episode work, assess actual implementation authority, current native
task/specification and meaningful plan, scope, code basis, placement, and any
real conflict before allocation. Episode selection requires planned work, not
`--ready` alone. The invoking LLM applies the editable policy. Code must not
repeat the decision as hidden admission gates or frozen revision approval.
Unrelated staged, unstaged, or untracked task/code changes and compatible
published task-history descendants must not block initiation.

Sources: [PRIMECLAW-51][T51]; **requested correction:** [55][T55] supersedes
older whole-checkout cleanliness and snapshot-equality requirements.

### P12. Create one isolated Episode and recover in the same resources

An Episode has its own branch/worktree, a durable worktree-rooted session, its
originating Conversation, and one initial execute assignment. One Conversation
may own one active Episode; different Conversations may work concurrently,
without claiming the same task. When Orca is selected, retain a visible writable
Prime Agent tab for the operator. Start with the bounded task context it needs,
not a fork of the entire Conversation transcript or an initial handoff. Use
immutable durable session identity, not a mutable name.

Do preparation that can be done without resources before allocating them. If a
later operation fails, preserve exact facts and let the owner finish the same
operation in the same branch/worktree/session when safe. Account for existing
session and assignment delivery before continuing. Do not require deletion and
recreation, hand-edited ownership JSON, duplicate assignments, or a new recovery
state machine. Real ambiguity or changed/foreign resources require useful
recovery guidance, not guessing.

Sources: [PRIMECLAW-15][T15], [10.37.3][T10_37_3]; **requested correction:**
[56][T56]. Older transcript-fork and non-resumable-uncertainty plans do not govern.

### P13. Keep managed responsibilities distinct

For an owned Episode, the Conversation supervises, the Episode implements, and
an independent Expert reviews read-only. The Episode maintains code and native
task content/plan/evidence within scope. The owner controls lifecycle status
and disposition. Neither an Expert nor a delegated child acquires product or
owner authority. Ordinary direct implementation is not prohibited by these
Episode-specific roles.

Sources: [PRIMECLAW-10.36][T10_36], [43][T43], [54][T54]; US-17–20.

### P14. Deliver useful bounded progress and durable blocker reports

An Episode pass should leave a tested, documented, reviewable slice, with native
task notes/plan and code published as appropriate. Stop for owner review rather
than declaring the work merged. Record an actual blocker, evidence, attempts,
and the needed clearance durably. The owner can block/resume the same task and
Episode after the condition clears; the blocker must not require reconstructing
work elsewhere. Side discussion and reviewer suggestions do not silently expand
scope.

Sources: [PRIMECLAW-10.26][T10_26], [43][T43]; US-10,17–19.

### P15. Continue deliberately without duplicate work or lost context

Handoff updates living task/project records, compacts with a deliberate focus,
and admits one next execute pass into the same intended session. Best-effort
compaction must not strand an otherwise admitted continuation. Compaction by
itself does not start execution. Cancellation remains cancellation; uncertain
delivery is not permission to reconstruct or replay an assignment.

Preserve role, scope, placement, task identity, and operator authority across
compaction and resume. High-utilization owner compaction is configurable and
best effort, not a reason to fail or repeat a successful Episode handoff.

Sources: [PRIMECLAW-10.15][T10_15], [10.25][T10_25], [10.39][T10_39]; US-21–23.

### P16. Supervise through evidence and independent review

Reports are the normal progress path; a bounded watch is a missed-report safety
net, not an autonomous coordinator or endless idle polling. The owner checks the
actual candidate, tests, docs, scope, and current task evidence, then advances,
requests an accepted in-scope repair, pauses, or consults. Compatible task/plan
changes must reach the responsible LLM as current facts rather than trip a
frozen-evidence lock.

Independent review must cover the material candidate, identify concrete violated
behavior and useful repair direction, and state its limits. Honor an explicit
reviewer choice; otherwise choose a suitable available reviewer and report the
actual model. Do not silently substitute an unavailable required reviewer. Review is evidence, not permission
to merge, invent requirements, or prescribe unnecessary exact code changes.

Sources: [PRIMECLAW-10.26][T10_26], [10.34][T10_34], [10.36][T10_36], [43][T43].

### P17. Finish through one operator decision and exact cleanup

After candidate acceptance, publish the visible Ready for Merge state and
present the exact task, reviewed candidate commit, and intended integration
target/base to the operator. Delay changes nothing; accepted Request Changes
returns the same task/Episode to In Progress. Merge and abandonment require
explicit authority; an ordinary conversational decision is sufficient. Perform context-sensitive Git and native task transitions through
the owner, not a second plugin transaction/approval engine. Preserve history
and distinguish successful completion from abandonment; abandoned code must
not enter the integration target.

Before readiness and destructive cleanup, establish that the exact Episode and
its proven children have finished and are idle. After an authorized task-native
terminal outcome is committed, published, and verified, clean up its exact
runtime, worktree, and branches automatically without asking again. Preserve
unrelated work, shared task storage, and other owners. Close ownership only
after the owned resources are gone. On failure inspect current facts and
continue safely; do not add cleanup-progress state or blindly retry commands.

Sources: [PRIMECLAW-10.26][T10_26], [10.40][T10_40], [10.41][T10_41], [43][T43];
US-24. Retained version-1 bookkeeping is distinct; see P18.

### P18. Finish grandfathered legacy work without reviving its machinery

Exactly retained folder-based specifications may finish or explicitly migrate.
Preserve their accepted frozen specification, living plan, ownership, and same
active resources. Do not enroll new legacy work, rebaseline specifications,
silently change authority, or remove resources the loaded generation still
needs. Legacy-to-task conversion must preserve content/provenance and the same
Episode. Version-1 bookkeeping closure does not itself authorize archival or
physical deletion. Old transcript forks, authenticated roles, approval receipts,
and multi-phase finalizers are not requirements to reconstruct.

Sources: [PRIMECLAW-10.34][T10_34], [10.36][T10_36], [10.38][T10_38], [43][T43].

### P19. Keep long-running work moving without prompt spam

Use one bounded active-work goal while working, a monitor while waiting on
machine/agent work, and neither while waiting only on the user or after terminal
completion. Restore concise work-control and applicable role guidance after
context transitions. Use native control facilities; reminders are advisory,
not another scheduler or policy enforcement engine. Report material changes,
not unchanged ticks. Install `goals-and-heartbeats` globally for Prime Agent only,
at `~/.prime/agent/skills/goals-and-heartbeats/`. Do not install another copy in
project-local skill directories or the shared cross-agent `~/.agents/skills/`.

Sources: [PRIMECLAW-10.28][T10_28], [26][T26], [30][T30], [33.5][T33_5]; US-25–26.

## 4. Provider migration

### M1. Make provider changes explicit and complete

Support the separately confirmed one-way Beads-to-Backlog maintenance operation
through the initialization skill. Inspect first, explain the exact source and
counts, quiesce the affected task mutation, and obtain confirmation before the
switch and source deletion. Read retiring Beads as it is; do not require a server
conversion, remote, custom unused statuses, source publication, or normalization
just to retire it. Preserve a valid existing Backlog destination, its IDs,
configuration, content, history, archives, and publication identity. Normalize
only the native default `backlog/` layout into `.backlog/` with its native root
configuration link; leave existing hidden and explicitly configured custom
stores in place. Existing destination data is not itself a migration conflict.

Sources: [PRIMECLAW-44][T44], [46][T46]. Older bidirectional migration plans in
[43][T43] are superseded.

### M2. Preserve meaning and history, not invented destination behavior

Preserve all issue content, relationships, comments, history, and provenance,
including large native histories without fixed per-command capture ceilings or
silent truncation. Report capture/resource failures as transport failures with
bounded private-data-safe diagnostics, not malformed-source accusations.
Preserve active Episode identity and resources. Use supported native destination
authoring and LLM judgment for non-equivalent
fields; do not omit them or build a general mapping framework.

Legacy open work becomes In Design; ordinary closed work becomes completed Done,
not automatically archived. Recognize true deleted/archive evidence separately.
Native Beads memories become readable Backlog documents, an origin index, and
exactly one USER task to curate them; no memories means no empty curation work.
Do not curate or delete memories automatically.

**Requested correction:** deferred work becomes ordinary In Design. Drop active
deferral-only fields, but preserve ordinary prose and historical raw evidence;
do not add a snooze, freeze, scheduling, or special annotation feature.

Sources: [PRIMECLAW-44][T44], [49][T49], [50][T50], [52][T52].

### M3. Verify the destination before retiring the source

Keep the source intact and authoritative until complete destination publication,
readback, preserved mappings/history, and active-owner continuity are verified.
Then leave one active authority, not a mirror or dual-write arrangement. Use the
existing destination-native migration evidence, not another coordinator/store.
Failure must state which authority and resources actually remain. Do not retry
uncertain switches as a new destination or use a live migration as a test fixture.

Sources: [PRIMECLAW-43][T43], [44][T44], [49][T49], [50][T50].

## 5. Runtime and development boundaries

### S1. Isolate the runtime and keep credentials outside it

The assistant runtime lives in an operator-controlled OpenShell sandbox with
deny-by-default egress and no broad host home/socket/network/PID/IPC exposure.
Use L7 credential injection/placeholders. Real credentials must not enter
sandbox disk, logs, tracked files, or test fixtures. Do not obtain secrets from
Keychain or browser credential stores. Missing login/approval is an operator
action, not a reason to bypass this boundary.

Sources: [founding decisions](docs/founding-decisions.md),
[PRIMECLAW-4][T4], [6][T6], [7.2][T7_2].

### S2. Preserve runtime state and recover proportionately

Provide understandable status, build, bring-up, in-place repair, validation,
and explicitly authorized teardown. Preserve brain data, native history,
sessions, and practical fallback during recovery or migration. Investigate the
actual fault before broad mutation. Do not silently recreate, initialize empty
storage over existing data, reindex, change providers, or clean up preserved
state to make an unrelated check pass. A narrowly accepted recovery does not
authorize every subsequent live operation.

Sources: [PRIMECLAW-6][T6], [7.6][T7_6], [29][T29]. Do not reinstate the
independent-backup/plan-only gates Joe rejected in the recorded 7.6 recovery.

### S3. Respect operator configuration and knowledge boundaries

Require the operator's brain repository/configuration; ship no personal or
public starter brain as a fallback. Keep private endpoints and secrets local.
Respect selected inference and embedding settings independently; never silently
substitute an embedding vector space or mix stale/incompatible vectors.
Project knowledge, shared docs, behavioral guidance, task state, and reports
have distinct owners. Do not bake Joe's personal entity taxonomy into the tool
or ingest generated reports wholesale as facts.

Sources: [PRIMECLAW-7.1][T7_1], [7.2][T7_2], [7.5][T7_5],
[information architecture](docs/information-architecture.md).

### S4. Develop and test the plugin without changing the running system

Keep plugin source inert in this builder. Run plugin candidates and probes in
isolated Docker environments, not the live user-global installation. Isolate
settings, sessions, credentials, data, and external control-plane effects.
Ordinary tests must not contact production OpenShell/providers/remotes. Clean
up exact test-owned resources and report evidence limits honestly. Match tests
to observable outcomes and known failures; do not invent a testing framework,
CI project, exhaustive matrix, or static prose gate for every human judgment.

Prime Agent is an upstream dependency, not an implementation target. Use its
supported public interfaces. An interface limitation is a product constraint,
not authorization to patch/fork it or propose an unsolicited upstream PR.

Sources: [PRIMECLAW-12][T12], [19][T19], [20][T20], [20.9][T20_9],
[21][T21], [33.7][T33_7], [AGENTS.md](AGENTS.md); US-27.

### S5. Separate source publication from live activation

Tests, a merge, copied assets, elapsed time, `/reload`, or a fresh probe do not
prove which code an existing process runs. A live runtime refresh requires
separate authority, an accepted source generation, the intended environment,
coordinated quiescence/full restart, and relevant resumed-session user acceptance.
Keep old-generation resources available until replacement is proven. Use the
supported compatible Prime Agent line; changing its API/major runtime is separate
compatibility work, not an automatic dependency bump.

Sources: [PRIMECLAW-10.34][T10_34], [27][T27], [28.1][T28_1],
[31][T31], [44][T44]; US-01,27.

## 6. Future assistant requirements, not current-plugin scope

These preserve the founding direction without turning it into today's backlog
of orchestration machinery.

- **F1. Persistent project hierarchy.** A universal assistant knows multiple
  projects; each project has long-lived conversations; conversations can enter
  and finish focused Episodes. The universal tier delegates implementation.
- **F2. Three context horizons.** Keep iteration context small with deliberate
  compaction; keep episode working state in its REPL; preserve product-lifetime
  requirements, decisions, and knowledge durably. Do not persist every transient
  observation in every store.
- **F3. A working brain controller.** The sandboxed assistant must eventually
  operate gbrain, retrieve current project-scoped knowledge with citations, and
  route an approved durable fact to its correct store, then publish it. External
  MCP participation is supported but does not substitute for controller proof.
  The generic store-routing policy must not impose an operator's entity schema.
- **F4. Channels and browsing without credential leakage.** Support the project/
  conversation hierarchy through replaceable channels, initially Telegram and
  Slack mappings, and browsing through a credential-safe bridge. Do not force
  the hierarchy to depend on one channel implementation.
- **F5. Automate only proven manual behavior.** Scheduling and a universal
  orchestrator come after manual lifecycle proof. Runtime capability placement
  must distinguish shipped, operator-selected, and project-local skills without
  copying host secrets. A general skill-pack system, replacement harness, new
  memory store, or general remote-execution framework is not implicitly approved.

Sources: [VISION.md](VISION.md), [LONG_RANGE_PLAN.md](LONG_RANGE_PLAN.md),
[founding decisions](docs/founding-decisions.md), [PRIMECLAW-7][T7], [8][T8],
[2][T2]. The personal-brain Hermes topology discussion remains an unapproved
hypothesis, not a requirement to replace Prime Agent.

## 7. Source reconciliation and known gaps

### Superseded directions not to carry forward

| Older record or assumption | Controlling direction used here |
|---|---|
| Every implementation request must allocate an Episode | Explicit placement and judgment-based direct work, P9; PRIMECLAW-54. |
| Code must enforce readiness, cleanliness, lifecycle eligibility, or a frozen task revision | Editable skills and LLM decisions, G2/P11; latest PRIMECLAW-55. |
| A partly allocated Episode can only be deleted and recreated | Same-resource owner-guided continuation, P12; PRIMECLAW-56. |
| Primary ownership always means branch literally named `main` | Intended current branch/integration target, P10; PRIMECLAW-48. |
| Every review concern needs mandatory threat/recovery/complexity formalism | Proportional contract review, G4; final PRIMECLAW-22 correction. |
| Authenticated role profiles, private Expert protocols, transcript forks, or approval receipts are enduring product needs | Skill-based roles, native review, bounded fresh Episode context; P12–18. |
| Template review must overwrite the real file and prove a viewer opened | Non-mutating text comparison, P3; PRIMECLAW-44. |
| Migration must support both directions, normalize Beads first, or preserve active deferral | One-way read-as-is migration; M1–2; PRIMECLAW-44/46/52. |
| The home Qwen rebuild is still a required Phase 3a gate | PRIMECLAW-7.5 records Joe's 2026-10-08 withdrawal and gateway/1536 choice. Older home-profile docs are dated history, not a reinstated requirement. |
| Done metadata, checked criteria, old PASS reports, or candidate tests prove live completion | Preserve the exact evidence limits; implementation, deployment and current-runtime proof are distinct. |

Task links cite the independent task-history snapshot
`68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2`, not the code branch. They are
source citations, not frozen approval revisions or lifecycle gates.

### Brain sources and limitations

The personal brain's accessible record
`originals/one-hermes-many-openshell-trust-domains` preserves Joe's instruction:
"You're going off the deep end in architecture astronaut mode, with all this
broker stuff you're suggesting. Dial back your creativity a bit."
It also explicitly labels the Hermes topology as undecided.

The connection refused access to the isolated `prime-claw` source. Searches of
the accessible default source did not supply a current project requirements
record. That is a real coverage gap, not proof that the project brain contains
nothing else. The founding decisions and task corpus supply the available
project intent. Do not invent missing brain decisions or claim this first draft
has been reconciled against the inaccessible source.

### What this consolidation does not decide

It does not declare open tasks complete, approve their plans, choose a new
architecture, reopen completed epics, or authorize a live action. In particular,
requested corrections in PRIMECLAW-48/52/53/54/55/56 are not all shipped merely
because their intended outcomes are collected here. Operational incident status
and dated test counts belong in tasks/evidence, not in this requirements file.

Existing [user-story traceability](docs/user-stories/traceability.md) and
`config/requirements-inventory.json` remain supporting acceptance/historical
records. Their version-specific guards and mechanisms must not silently become
additional product requirements. This consolidation is based on the 147-file
task corpus, repo intent/design docs, and accessible personal-brain material;
some lengthy appended historical journals were only partially reread. It is
not a claim of an exhaustive transcript audit.

[T2]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-2%20-%20Phase-6-orchestrator-universal-agent-build-LAST.md
[T4]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-4%20-%20Phase-1-de-risk-U1-prime-agent-runs-inside-OpenShell-sandbox.md
[T6]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-6%20-%20Phase-2-sandbox-runtime-foundation-prime-agent-in-OpenShell.md
[T7]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-7%20-%20Phase-3-tracer-bullet-end-to-end-working-claw.md
[T8]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-8%20-%20Phase-5-communication-channels-Telegram-groups-Slack-channels.md
[T12]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-12%20-%20Prevent-native-test-probes-from-mutating-user-global-Prime-Agent-settings.md
[T15]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-15%20-%20Episode-handoff-must-identify-durable-session-by-immutable-ID-not-mutable-name.md
[T19]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-19%20-%20Test-tier-architecture-tier-1-plugin-test-container.md
[T20]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-20%20-%20Project-wide-testing-strategy-specification-planning-only.md
[T20_9]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-20.9%20-%20Incident-source-host-tests-may-have-contacted-OpenShell-and-GitHub-provider-stages.md
[T21]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-21%20-%20Guard-user-global-plugin-install-and-enforce-Docker-only-development-tests.md
[T22]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-22%20-%20Eliminate-specification-review-overengineering-ratchets-across-Prime-Claw.md
[T26]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-26%20-%20Move-goal-continuation-policy-into-plugin-source.md
[T27]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-27%20-%20Assess-and-plan-Prime-Agent-v0.10-Rust-migration.md
[T28_1]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-28.1%20-%20Document-fork-source-only-Prime-Agent-installation.md
[T29]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-29%20-%20Incident-active-prime-claw-v2-sandbox-exited-255.md
[T30]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-30%20-%20Make-goals-and-heartbeats-mandatory-across-session-preparation-and-compaction.md
[T31]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-31%20-%20Activate-Prime-Claw-plugin-in-preserved-v2-sandbox.md
[T33_5]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-33.5%20-%20Simplify-the-goal-continuation-reminder-state-machine.md
[T33_6]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-33.6%20-%20Make-one-manifest-authoritative-for-plugin-delivery.md
[T33_7]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-33.7%20-%20Right-size-focused-plugin-tests-around-user-story-outcomes.md
[T33_11]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-33.11%20-%20Remove-invented-planning-and-readiness-formalism.md
[T35]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-35%20-%20Replace-Beads-with-a-vendored-Backlog.md-fork-as-is.md
[T37]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-37%20-%20Historical-Reviewed-future-plans-and-worktree-isolated-specification-episodes.md
[T43]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-43%20-%20Support-selectable-task-providers-with-grandfathered-legacy-execution.md
[T44]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-44%20-%20Make-initialization-skill-led-and-support-existing-Backlog-destinations.md
[T46]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-46%20-%20Allow-legacy-Beads-export-without-unused-Prime-Claw-lifecycle-statuses.md
[T47]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-47%20-%20Fresh-.prime-claw-creation-dirties-clean-repositories-and-blocks-automations.md
[T48]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-48%20-%20Allow-task-Episodes-from-published-non-main-bases-for-stacked-PRs.md
[T49]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-49%20-%20Handle-native-Beads-memory-records-in-migration-export-inspection.md
[T50]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-50%20-%20Beads-migration-inspection-truncates-1-MiB-native-history-and-misreports-ENOBUFS-as-source-evidence-failure.md
[T51]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-51%20-%20Add-agent-callable-implement_task-entry-point-for-approved-tasks.md
[T52]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-52%20-%20Drop-Beads-deferral-state-during-Backlog-migration.md
[T53]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-53%20-%20Remove-code-cleanliness-gates-from-independent-Backlog-authoring-guidance.md
[T54]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-54%20-%20Enable-operator-choice-and-judgment-based-implementation-placement.md
[T55]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-55%20-%20Allow-Episode-initiation-during-unrelated-ticket-edits-and-task-history-advances.md
[T56]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-56%20-%20Prevent-premature-Episode-allocation-and-resume-failed-creation-in-existing-resources.md
[T7_1]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-7.1%20-%20Portable-AI-gateway-defaults-with-local-provider-overrides.md
[T7_2]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-7.2%20-%20Require-explicit-per-operator-brain-repository-configuration.md
[T7_5]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-7.5%20-%20Complete-default-gateway-brain-source-current-indexing-and-retrieval.md
[T7_6]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-7.6%20-%20Phase-3a-preserve-and-migrate-sandbox-state-to-durable-volumes-in-prime-claw-v2.md
[T10_15]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-10.15%20-%20POC-conversation-owned-episode-for-resilient-conversational-handoff.md
[T10_25]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-10.25%20-%20Add-owner-driven-remote-episode-handoff-admission.md
[T10_26]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-10.26%20-%20Implement-conversation-driven-episode-oversight-plugin.md
[T10_28]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-10.28%20-%20Implement-plugin-global-goal-and-heartbeat-work-control.md
[T10_34]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-10.34%20-%20Complete-official-lean-role-protocol-and-remove-compatibility.md
[T10_36]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-10.36%20-%20Simplify-role-kernel-and-EXPERT-review-to-native-Prime-Agent-primitives.md
[T10_37_2]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-10.37.2%20-%20Implement-project-assets-initialization-and-template-reconciliation.md
[T10_37_3]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/completed/primeclaw-10.37.3%20-%20Implement-simplified-Conversation-and-Episode-lifecycle-with-Orca-integration.md
[T10_37_4]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-10.37.4%20-%20Preserve-customized-project-templates-during-read-only-diff-review-and-simplify-hash-state.md
[T10_38]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-10.38%20-%20Replace-.ralph-plans-with-task-native-Backlog-Ralph-lifecycle.md
[T10_39]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-10.39%20-%20Compact-Conversation-context-after-episode-handoff-when-utilization-exceeds-threshold.md
[T10_40]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-10.40%20-%20Remove-untraceable-Episode-cleanup-machinery.md
[T10_41]: https://github.com/SailorJoe6/prime-claw/blob/68bb7f1f21e9ac2badcae6b3ae0c811a3c2b86b2/tasks/primeclaw-10.41%20-%20Handle-Orca-nonzero-after-successful-Episode-worktree-removal.md
