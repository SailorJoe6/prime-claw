# Execution Plan — Official lean session protocol

> **Status:** Active; exact Slice 1 transition accepted, transition-first landing plan pending owner review
>
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
>
> **Tracking:** `prime-claw-h6w.25`
>
> **Execution shape:** The accepted Slice 1 transition lands first on primary
> `main` with all compatibility resources retained. The existing episode then
> becomes a read-only post-restart UAT fixture. User-global activation runs only
> from synchronized primary `main`; accepted UAT finalizes this transition
> episode. Compatibility removal and final documentation move to a separately
> reviewed future episode and later second merge.

## Accepted Slice 1 checkpoint and current authority

The exact accepted transition candidate is
`615687aff1aa3549e986cc030073ee2539b836fe` (tree
`e23e1841fecadabf2f0d85269aeb4535ee2bb056`). It includes accepted `main`
through `eca48f8b284c990a8e030062ef70192313781b7f`, the independent
watchdog/PATH repair `3bf905976a1a489d93e81619a838b34fc7ed8a31`, and bead closures
`927b3941ebab281c18ceacfc3c922f82e75db9fc`. The canonical gate passed:
Tier 0 `284 passed, 155 skipped`; complete selected Tier 1 `48 passed, 391
deselected`; structured receipt
`.test-results/ol011-integrated-final/exact-candidate-pass.json`, SHA256
`971e66f69108c1b66b0213d8603faa608d2594028b90d92d204b9be152f65588`.

The owner accepted this exact commit after independent final review PASS. The
accepted runtime, installer, managed-system-block, test, compatibility-resource,
and normative-documentation bytes must not change. This plan-only pass may edit
only `.ralph/plans/SPECIFICATION.md` and `.ralph/plans/EXECUTION_PLAN.md`, push
one descendant planning checkpoint, and stop for owner review.

The operator approved the transition-first topology described below for
planning. That is not authority to merge, run host-global apply/check, restart,
perform UAT or rollback, finalize or clean the episode, remove compatibility
resources, or create a future cleanup folder during this pass.

## Outcome

Land the already accepted seven-file transition on primary `main` while every
old-generation compatibility resource remains available. Activate and check it
only from synchronized primary `main`, perform one coordinated full restart,
and prove the exact owner, exact episode, and a pre-identified ordinary saved
conversation on the restarted runtime. Fail closed to the known-good installed
generation from `main` if cutover fails. After accepted UAT, finalize and clean
this transition episode without changing its post-merge branch or worktree.
Defer compatibility removal and final documentation to a separately reviewed
future episode and later second merge.

## Baseline and invariants

Relevant accepted history:

- `00ad366` — lean protocol POC;
- `535f584` — stale package assertions reconciled with the POC;
- `1442abb` — three-tier plugin test container;
- `44d83db` — current recorded known-good eight-file POC rollback source;
- `6322a18e1bb921478a7d9e7c67a8eff4088481a3` — OL-011 provider-channel
  repair; and
- `615687aff1aa3549e986cc030073ee2539b836fe` — accepted integrated seven-file
  transition.

The current installed generation must be checked and hashed again before global
mutation. If it does not match the recorded known-good state, stop and revise
the rollback input rather than assuming `44d83db` is still installed.

The landing must preserve these invariants:

1. No Prime Agent source change, upstream proposal, or concurrent host daemon.
2. The accepted transition implementation and evidence remain byte-identical to
   `615687aff1aa3549e986cc030073ee2539b836fe`.
3. The compatibility skill, discovery link, and reviewer profile survive the
   first merge, global activation, restart, UAT, and any rollback.
4. After the first merge, the existing episode session, branch, and worktree are
   unchanged and serve only as the exact UAT fixture. They receive no further
   implementation commit, planning commit, execute pass, or cleanup work.
5. User-global apply/check runs only from a clean synchronized primary `main`
   checkout and always spells out `--user-global` while the transition
   generation is active.
6. The first landing is a normal no-fast-forward merge with an exact merge
   commit, so a failure can be reverted without rewriting history.
7. Cleanup never begins from merge or install success. It requires the one full
   restart, resumed-session evidence, explicit operator UAT acceptance, and a
   new separately reviewed future specification and episode.
8. Archived plans, reviews, reports, and evidence are not rewritten.
9. A failed cutover retains compatibility resources, reverts the exact first
   merge on `main`, restores and checks the known-good installed generation from
   clean synchronized `main`, and repeats the coordinated restart/recovery gate.

## Delivery topology

The approved transition-first topology is:

```text
existing episode branch/worktree
  accepted transition 615687a
  + reviewed plan-only checkpoint
          │
          └── first no-ff merge ──> synchronized primary main
                                     compatibility skill/link/profile retained
                                               │
                            preflight: ordinary saved conversation
                            + installed hashes + exact rollback inputs
                                               │
                            apply/check --user-global from main only
                                               │
                               one coordinated full restart
                                               │
                  resume exact owner + exact episode + ordinary conversation
                              │                              │
                           UAT PASS                       UAT FAIL
                              │                              │
             operator accepts cutover          revert exact merge on main
                              │                 restore known-good generation
             finalize/clean transition         restart and verify recovery
             episode; leave compat intact                 stop
                              │
       operator later selects a future spec folder
                              │
       separately reviewed cleanup episode/branch
                              │
                  later second merge
```

The plan-only checkpoint is a descendant of the accepted implementation commit;
it does not replace or amend that commit. The first merge may include that
reviewed planning checkpoint, but the accepted implementation bytes must match
`615687a`. Once the first merge completes, no work is committed in or executed
from the episode again. The episode remains present only so the restarted
runtime can resume the exact durable session against its exact branch/worktree
identity.

The cleanup episode does not exist yet. Do not infer, name, or create its future
folder. Its eventual second merge is independent of this transition episode and
requires the normal specification, plan, implementation, and owner-review gates.

## Slice 1 — Build the compatibility-safe transition generation (complete and accepted)

### Capability delivered

A pushed plugin generation implements the official lean runtime and installer
contract, passes all automated gates, and remains safe while old sessions are
still loaded because every live compatibility resource remains present.

### Implementation

#### Runtime simplification

Update
`src/prime-agent-plugin/extension-support/conversation-oversight.ts` to:

- remove `OVERSIGHT_PACKAGE_PATH`, `packageBody`, the package frontmatter/scalar
  parser, and every current package-validation call;
- remove imports used only by that parser;
- retain the historical custom-message filter, naming its constant as legacy
  behavior rather than a current package source;
- keep exact marker, expectation, owner, lifecycle, bounded-identity, recovery,
  handoff, and finalization behavior unchanged; and
- continue validating exactly one byte-current managed system block whenever
  promotion or trusted active state requires it.

Do not change the text of `src/prime-agent-plugin/APPEND_SYSTEM.md` unless a test
finds a real specification gap. Its normalized body must remain at or below 250
words and byte-match the TypeScript expected block.

#### Work-control and installer transition

- Remove the inert
  `src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts` entry point
  from source and the managed allowlists.
- Change apply/check from eight managed TypeScript files to seven.
- Treat a globally installed `extensions/goal-heartbeat-work-control.ts` as a
  retired managed file: apply removes it only after destination-type preflight;
  check reports it as stale.
- Remove installer/check dependence on the project oversight skill. The skill is
  still present for old loaded code, but it is no longer a current installer
  prerequisite.
- Preserve unrelated global files, symlink/type rejection, interrupted-install
  detection, managed APPEND_SYSTEM merging, and convergence behavior.

#### Tests

Update tests around the behavior boundary rather than mechanically deleting
coverage:

- `tests/project_conversation_extension.test.mjs`
  - promotion requires the managed block but no skill fixture;
  - active owner context filters a historical package without adding a new one;
  - all exact lifecycle and bounded-identity cases remain.
- `tests/reviewed_plan_extension.test.mjs`
  - episode creation and owner activation require no package file;
  - remove package-frontmatter rejection cases that no longer describe runtime.
- `tests/test_project_conversation_extension.py`,
  `tests/test_conversation_oversight_native.py`, and
  `tests/test_reviewed_plan_native_discovery.py`
  - stop copying the oversight skill into isolated native fixtures;
  - prove promotion, recovery, active turns, resume/reload, real-child precedence,
    and post-compaction behavior without it;
  - continue asserting zero current full-package provider messages.
- Replace the inert-extension tests with a managed-session-protocol contract test
  that checks the APPEND_SYSTEM goal/heartbeat rules, word bound, retired entry
  absence, and continued absence of old autonomous pause/resume tools.
- Update `tests/test_prime_agent_plugin_install.py` for the seven-file allowlist,
  stale retired entry removal/check, unsafe file/directory/symlink preflight,
  unrelated-file preservation, and repeatable convergence.
- Keep `.ralph/skills/oversee-episode/SKILL.md`, its discovery link,
  `.prime/agent/profiles/expert-reviewer.md`, and their compatibility tests in
  this slice. Adjust only current-documentation assertions that would otherwise
  mislabel them as the supported runtime policy. Their continued presence is a
  regression guard until the cutover gate.

Do not weaken lifecycle assertions or replace full gates with broad exclusions.
If a failure appears unrelated, reproduce it against untouched `44d83db` and
record or link a separate bead before deciding disposition.

#### Documentation

Update current normative surfaces to describe the transition state:

- `AGENTS.md` — make the loaded-generation rule explicit: resources read by the
  installed old generation survive until the coordinated restart proves the new
  generation;
- `docs/conversation-driven-episode-oversight.md` — lean protocol, lifecycle
  mechanics, historical-message filtering, and temporary compatibility files;
- `docs/goal-heartbeat-work-control.md` — APPEND_SYSTEM is the current policy;
  the removed extension is history, not activation guidance;
- `docs/lab-global-plugin.md` — seven-file layout, retired-entry migration,
  candidate apply, full restart requirement, and rollback;
- `docs/README.md` — current descriptions and links.

Audit `VISION.md` and `LONG_RANGE_PLAN.md`. Change them only if a current claim is
false after this slice. Leave archives and evidence untouched.

### Verification

Select exactly one tier-1 Prime Agent source through the worktree's gitignored
`.env` or an operator-approved `TIER1_ENV_FILE`. Do not copy credentials or host
harness state into the worktree or container.

Run from the episode worktree:

```bash
git diff --check
scripts/test-all.sh
```

The required result is tier 0 PASS and the complete tier 1 PASS, including owned
container teardown. Tier 2 is out of scope. Record the `.test-results/` run path,
summary, elapsed time, and any tracked unrelated failure in the bead and plan.

Also run a current-reference audit such as:

```bash
rg -n "oversee-episode|OVERSIGHT_PACKAGE|goal-heartbeat-work-control|PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1|expert-reviewer"   AGENTS.md src scripts tests docs .ralph .agents .prime VISION.md LONG_RANGE_PLAN.md
```

Classify each hit as current runtime, temporary compatibility, current docs/test,
or immutable history. Do not edit history to make the search empty.

### Slice completion

- Update `prime-claw-h6w.25` with changed surfaces, exact test commands/results,
  the pushed commit, and the known-good rollback commit `44d83db`.
- Update this plan's progress section.
- Commit one transition generation and push the episode branch.
- Stop for owner review. Do not apply globally, restart, clean up, or merge in the
  same execute pass.

## Slice 1 rejected-candidate revision boundary

Candidate `9d01cfc8bb40cc427895e9b862344985db81075a` is rejected. The
canonical BLOCK report is
`/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/sub-2f26a16a/official-lean-slice1-review-9d01cfc.md`
(SHA256 `60a9f22060ad6fab4882761afaadbce7ee4cc0358e2a57509cdd99510b18e858`).
Revise Slice 1 only for accepted OL-007 and OL-009 plus operator safety
constraint OL-008:

- **OL-007 — effective provider spies.** Prime Agent conversion drops
  `customType` and exposes unfiltered custom messages to `streamSimple` as
  user-shaped text. Repair every native spy to inspect the actual
  provider-visible representation. Use unique controlled sentinels so ordinary
  quoted user discussion is not a false positive. Include a positive detector
  and fixture-only filter-bypass control that prove an unfiltered oversight
  package and retired work-control overlay are detected, then prove the real
  official hook removes them while keeping one managed block and ordinary user
  content. Cover saved-history resume/reload, first post-compaction turn,
  repeated active/tool/heartbeat continuations, agent messages, queued turns,
  bounded children, corrupt ownership, and missing/duplicated block dispatch
  prevention. Keep no-skill fixtures and all previously passing lifecycle,
  handoff, finalization, installer, and compatibility behavior.
- **OL-009 — correlatable gate receipts.** Run complete tier 0 and selected tier
  1 only through the Docker-isolated boundary. Preserve raw stdout, stderr, exit
  status, exact tested tree/hash, dependency SHA and selector, commands, counts,
  elapsed time, superseded-failure disposition, and owned container/share
  teardown in durable run artifacts. Retain failed receipts and identify the
  concrete later receipt that supersedes each one. Do not call separately
  completed gates a successful `scripts/test-all.sh` run.
- **OL-008 — isolation-first AGENTS safety.** The pushed correction
  `672be3bef8dc76412d8085a240e3ebdebedfbeff` (authority tip `ded4a8c`) was
  integrated by merge commit `70c2558a0299b304e3cad97796eaa1c0aef5257e`.
  Docker-only candidate validation, explicit isolated roots, bare-command
  failure, primary-`main`-only `--user-global`, and linked-worktree refusal are
  retained together with the seven-file transition and stronger loaded-
  generation UAT rule. No host-global apply/check or host probe was run.
- **OL-011 — effective system-prompt channel.** Candidate
  `736982955b9a45daffd67e4b3078d02ccd8486fd` (tree
  `156ee7ee7be44810b3728712c7d8d52e77700cda`) is rejected by the canonical
  BLOCK report
  `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/sub-264c127a/official-lean-slice1-review-7369829.md`
  (SHA256 `ffd1bb9b0b68efd1bb8fa4643afde9d599ef9fb08450afdb0aa22d7f3cc7c5bb`).
  Preserve the working post-conversion user-shaped oversight controls. Extend
  the shared helper and all six spies to capture the effective `systemPrompt`
  separately. Through a fixture-only `before_agent_start` seam, append the
  historical-shaped detailed `PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1`
  overlay plus a unique controlled system token and prove that work-control
  alone fails the shared assertion, independently of the oversight bypass.
  The unchanged official seven-file generation must produce one lean block and
  no retired system overlay. Do not add a runtime scrubber: deleting the retired
  injector is the production mechanism. Assert every provider row added by
  saved-session recovery and legacy migration, not only the initial and final
  rows. Preserve all OL-007 lifecycle/replay/dispatch-prevention coverage and
  refresh complete exact-candidate OL-009 Docker receipts and teardown.

That rejected-candidate revision preserved
`.ralph/skills/oversee-episode/SKILL.md`,
`.agents/skills/oversee-episode`, and
`.prime/agent/profiles/expert-reviewer.md`. It did not authorize host-global
apply/check, a host launch or restart, compatibility removal, merge, or the next
landing stage. `prime-claw-blw.5` and `prime-claw-zwg.5.1` remained independent;
the BLOCK report's distinct watchdog signature stayed in existing tracking
rather than being folded into OL-011.

## Landing stage — First merge and main-only activation

### Dependency and authority

The owner must accept the exact pushed plan-only checkpoint before any landing
step. The operator then separately authorizes the first merge and cutover. Plan
approval alone does not authorize either action.

The accepted implementation remains
`615687aff1aa3549e986cc030073ee2539b836fe`. Any product-code, plugin,
installer, managed-system-block, test, compatibility-resource, or normative-doc
drift returns to owner review rather than entering the landing flow.

### Pre-merge admission

From the primary `main` checkout:

1. Fetch and synchronize `main`; require a clean checkout and no other active
   landing operation.
2. Verify `615687a` is an ancestor of the episode tip and that every change after
   it is confined to the two reviewed active planning files.
3. Reconfirm the compatibility skill, discovery link, and reviewer profile are
   present and byte-current on both the episode tip and current `main`.
4. Pre-identify one ordinary saved project conversation. Record its session ID,
   name, canonical project CWD, and a successful normal turn on the current
   single daemon. If no suitable conversation exists, stop for operator input.
5. Record the exact currently installed known-good generation and its hashes or
   successful check receipt. Confirm the rollback input can restore it without
   deleting compatibility resources.
6. Record the pre-merge `main` commit, accepted episode tip, and exact planned
   no-fast-forward merge command. If the merge would include anything outside
   the accepted transition and reviewed plans, stop.

### First merge and activation

1. Create one normal no-fast-forward merge of the accepted episode tip into
   primary `main`; do not squash, rebase, or amend the accepted candidate.
2. Verify the resulting merge contains the accepted implementation bytes, the
   reviewed planning checkpoint, and all compatibility resources. Record the
   exact merge commit and first parent used by rollback.
3. Push `main` and verify local/remote equality and a clean working tree.
4. From that synchronized primary `main` checkout only, run:

   ```bash
   scripts/apply-prime-agent-plugin.sh --user-global
   scripts/check-prime-agent-plugin.sh --user-global
   ```

5. Record exact commands, installed hashes, check output, merge identity,
   rollback identity, and the ordinary-session fixture on `prime-claw-h6w.25`.

Do not run those commands from this linked episode worktree. Do not commit or
execute anything else in this episode after the first merge. Apply/check success
means the installed bytes converged; it is not proof that loaded sessions use
the new generation.

## Cutover gate — One restart and three resumed conversations

### Admission

Before restart, the primary-main merge, user-global check, rollback record,
compatibility files, exact episode identity, and ordinary-session identity must
still match the landing receipt. Quiesce active turns, agents, tests, and
heartbeats and durably checkpoint any necessary work. Drift returns to landing
preflight.

### Coordinated restart

- Perform one full Prime Agent daemon/harness restart. Do not use `/reload`,
  start a second daemon, or delete saved sessions.
- Resume the exact owning conversation.
- Resume this exact episode using its unchanged session, branch, and worktree.
  It is a UAT fixture only; no execute phase or code/document change is allowed.
- Resume the pre-identified ordinary saved conversation from its recorded
  canonical project CWD and complete a real turn.

### Required UAT evidence

Collect evidence from the restarted single runtime plus the accepted container
capture:

- the owner resumes with exact episode ownership intact;
- the episode resumes with bounded role, branch, worktree, and task identity
  intact, without performing work;
- the ordinary conversation completes a real turn without promotion, package,
  or missing-skill errors;
- provider context contains one managed lean block, no newly injected
  `prime-claw-oversee-episode-package`, and no retired detailed work-control
  overlay;
- lifecycle state remains fail-closed and handoff/finalize authority has not
  broadened;
- goal/heartbeat behavior follows the lean managed protocol at a naturally
  occurring work/wait boundary; and
- no session requires `/reload` recovery.

Record the restart and exact evidence on `prime-claw-h6w.25`. The operator must
explicitly accept UAT before transition-episode finalization. Insufficient or
ambiguous evidence pauses the cutover; it does not authorize extra probes or a
second host process.

## Fail-closed rollback from primary main

If apply/check, restart, or any required UAT result fails or is uncertain:

1. Stop the cutover and retain the compatibility skill, discovery link, and
   reviewer profile everywhere.
2. From primary `main`, create a normal history-preserving revert of the exact
   first merge (`git revert -m 1 <transition-merge>`). Do not reset or rewrite
   history.
3. Push the revert and verify primary `main` is clean and synchronized. Its
   source must now match the recorded known-good generation; otherwise stop for
   operator review.
4. From that clean synchronized primary checkout, run the known-good
   generation's documented user-global apply/check path and verify the exact
   installed hashes.
5. Perform the same quiesce and one-full-restart discipline, then verify the
   owner and ordinary saved conversation recover. Resume the episode only as
   needed to prove bounded identity; do not execute more work there.
6. Record the failure, revert commit, restored hashes, restart/recovery evidence,
   and next decision on `prime-claw-h6w.25`.

Do not retry an uncertain lifecycle operation blindly, re-merge automatically,
or begin cleanup after rollback.

## Transition episode finalization after accepted UAT

After the operator explicitly accepts the three-conversation UAT:

1. Record the accepted cutover and stable primary-main commit on
   `prime-claw-h6w.25`.
2. Verify the episode branch and worktree still equal the exact first-merge
   source tip and contain no post-merge change.
3. From the owning conversation, carry out only the approved terminal
   bookkeeping and session/worktree cleanup for this exact transition episode.
   `finalize_spec_episode` remains location-only bookkeeping and follows
   verified terminal work; it is not a merge or deletion command.
4. Leave the compatibility skill, discovery link, reviewer profile, related
   compatibility tests, and transition-era documentation on `main`.
5. Complete any minimal main-only plan/archive or bead closure bookkeeping
   required for the finished transition, without performing future cleanup or
   changing installed plugin bytes.
6. Verify `main`, Git remote state, beads, and the installed transition
   generation are synchronized before reporting the transition complete.

The transition episode never receives a cleanup commit and is not reused for
future implementation.

## Future cleanup stage — Separate review, episode, and second merge

Compatibility-resource removal and final documentation are a separate future
product decision. The operator must first select an exact
`.ralph/plans/future/<slug>` folder; this plan neither names nor creates one.
The normal workflow then applies:

1. create and review the future specification;
2. create and separately review its execution plan;
3. explicitly promote it into a new episode, branch, and worktree;
4. audit current nonhistorical references and remove only resources proven
   compatibility-only;
5. update final normative documentation and run that episode's full required
   gates;
6. obtain owner/operator acceptance; and
7. land the cleanup through a later second merge.

That future episode must retain or replace anything with an independent current
use and preserve all historical artifacts. Any managed plugin or system-prompt
byte change creates a new runtime generation and requires its own cutover plan.

## Progress and evidence

Update this section during execution; do not rely on chat history.

### Slice 1 transition evidence

- Candidate source is the seven-file managed TypeScript set; the retired
  `goal-heartbeat-work-control.ts` source is absent and apply/check migrate any
  stale installed regular copy after complete destination preflight.
- `src/prime-agent-plugin/APPEND_SYSTEM.md` is unchanged from `44d83db`, remains
  byte-equal to the TypeScript expectation, and normalizes to 241 words.
- Independent final review initially BLOCKed unsafe symlinked plugin roots or
  managed parent directories. The repaired apply/check scripts now reject the
  destination root, `extensions`, and `extension-support` unless absent or real
  directories before any mutation; three parameterized no-mutation regressions
  cover the root and both managed parents.
- Final repaired-candidate tier 0: `python3 -m pytest tests/ -q` PASS in 39.21
  seconds (`275 passed, 151 skipped`). Final complete tier 1:
  `python3 -m pytest tests/ -q -m container` PASS in 105.47 seconds
  (`44 passed, 382 deselected`). Tier 2 is intentionally out of scope.
- A post-review combined rerun passed tier 0, then exposed and drove the managed
  root diagnostic repair. The next combined rerun encountered only the known
  unrelated macOS process-group watchdog timeout before tier 1. That flake was
  not hidden or deselected; it is tracked as `prime-claw-zwg.5.1`, and the
  subsequent complete current-tree tier 0 run above passed.
- Tier 1 used a disposable clean source copy of Prime Agent dependency commit
  `a1faacd53ac4473a75de1d434afaf50945c2f647`; the upstream checkout remained
  clean. Final teardown left no `prime-claw-tier1-session` container or owned
  `share-*` directory.
- The compatibility skill and reviewer profile retain SHA256
  `2e20d8fc7794cf97e9bfd21eaa6e68c7d6514439c6e62dfb024723b8de41a32f` and
  `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`;
  `.agents/skills/oversee-episode` remains the same
  `../../.ralph/skills/oversee-episode` symlink.
- The required reference audit classifies remaining hits as: current legacy
  provider-message filtering; retired-entry migration/docs/tests; temporary
  loaded-generation skill/link/profile compatibility; active plan text; or
  immutable archives/evidence. No current runtime or installer package-source
  dependency remains.
- Pinned Prime Agent 0.9.8 installed successfully but its non-interactive
  binary path was not exported by the existing tier-1 driver/fixture. That
  independent framework defect is tracked as `prime-claw-blw.5`; final
  acceptance used supported source mode instead.
- Known-good rollback source generation remains `44d83db`. No global apply,
  restart, compatibility cleanup, merge, or Prime Agent source change occurred.

### Rejected-candidate revision evidence

- OL-007 now uses `tests/provider_context_assertions.py` at the actual
  post-conversion provider seam. Six native spies count unique oversight-package
  and retired-work-control sentinels only in provider-visible `role=user` text.
  A no-hook positive control proves conversion drops `customType`; a post-hook
  fixture bypass proves the shared clean assertion fails for both leak classes;
  the real hook removes both while preserving one managed block and ordinary
  user content. Saved resume/reload, recovery, first post-compaction, repeated
  active/tool/heartbeat, agent-message, queued-turn, bounded-child,
  finalization-replay, corrupt ownership, and missing/token-only/duplicate block
  cases remain covered.
- Focused Docker-native acceptance passed `11 passed, 7 deselected in 106.52s`.
  Receipt `.test-results/ol007-focused/native-full-repaired.log`, SHA256
  `099ef6d8523579f7e7f1b912625499e2ef0a5d43eced66531e2190d3bacbbe23`.
  It supersedes, without deleting: initial `/var` alias setup failure
  `native.log` (`ec3b46591d579359410c5e8ffe264d18ff64dde2a12770444e5ab1a7244d6289`); first repaired run `native-rerun.log`
  (`a0af0dcb8e80d79f795b3520fcdfcce5bd9acec35a13e1b690b6a512253ed1e6`, four fixture/race failures); and bounded failed-case rerun
  `failed-tests-rerun.log` (`bdd843a0c6a507f4b72e68752392455037473798a5874e5e6739469c9df7c6f3`, one daemon-socket race). The final
  run includes the no-session isolation repair and every selected native test.
- Pre-integration complete tier 0 passed `275 passed, 152 skipped` in 36.62s at
  `.test-results/ol009-preintegration/tier0.log` (SHA256
  `59938aab5166edbab2bc03b02903afe096b0c5b2746c47636342bc540ae68ce8`).
  This is diagnostic only because OL-008 was integrated afterward; it cannot
  satisfy final candidate acceptance.
- OL-008 upstream repair `672be3bef8dc76412d8085a240e3ebdebedfbeff`
  (authority tip `ded4a8c`) is preserved through merge
  `70c2558a0299b304e3cad97796eaa1c0aef5257e`. Bare apply/check now fail,
  candidate validation is Docker-only, explicit roots are required, and
  `--user-global` is primary-`main` only and refused from linked worktrees.
- Exact candidate `197cb541b140e70a66b286c966df377742be44a0` ran the canonical
  `scripts/test-all.sh`: tier 0 passed (`276 passed, 155 skipped`) in 37s;
  tier 1 failed after 101s (`1 failed, 47 passed, 383 deselected`) because the
  no-skill installer fixture copied apply/check and the APPEND manager but not
  the new OL-008 `prime-agent-plugin-target.sh`. Raw logs are
  `.test-results/20261002-140439-40316/{tier0,tier1}.log`; sequencer receipt is
  `.test-results/ol009-final-replacement/sequencer.log`; metadata and hashes are
  in `failed-candidate-197cb541.json`. Teardown left no owned container or
  `share-*` directory. This candidate is superseded, not accepted.
- The exact failing test was repaired by copying the target selector into its
  isolated fixture. Docker receipt
  `.test-results/ol009-final-replacement/focused-installer-repair.log` passed
  `1 passed in 37.86s` (SHA256
  `709274734acc80f8ebec3161460a182c3fdb38c2053983979227d60a101a1bc4`)
  with no owned container/share remaining. A later complete exact-candidate
  receipt, not this focused proof, must supersede the failed full gate.
- Candidate `736982955b9a45daffd67e4b3078d02ccd8486fd` and its passing but
  incomplete OL-009 gate are superseded by accepted OL-011. The canonical
  BLOCK report and hash are recorded in the revision boundary above and on
  `prime-claw-h6w.25`; no other material candidate finding was accepted.
- The OL-011 repair changes tests/evidence only. The shared provider helper now
  captures provider-visible user text and effective `systemPrompt` separately.
  All six spies inherit and assert the system-channel fields. The oversight
  filter-bypass and historical-shaped `before_agent_start` work-control overlay
  fail independently, ordinary quoted-user identifiers remain preserved, and
  clean source/installed seven-file probes have no retired system overlay. Every
  row emitted by saved-session recovery and legacy migration is asserted. No
  runtime scrubber or managed plugin source change was added.
- The first exact control run failed before provider dispatch because generated
  TypeScript contained an unescaped newline. Preserved receipt
  `.test-results/ol011/system-channel-control.log`, SHA256
  `9fe7c462f6e00eee0949dcf801713b2f9fd5df5051c3ae9d751a2635cde9c516`.
  After correcting the generator escape, the exact control passed `1 passed in
  47.88s`: `system-channel-control-rerun.log`, SHA256
  `dec8f88412d9de50c8e019fb736a415756ee99f0f218f138468654c9e98f2b20`.
- Complete focused native provider/lifecycle validation passed `11 passed, 7
  deselected in 79.52s`: `.test-results/ol011/native-provider-lifecycle.log`,
  SHA256 `f32b53abaeafa10f19f7f69b8536b0ec68ae2c3de7cf3b356c3d2b0a4d5178ed`.
  Both passing runs and the failed predecessor left no owned container/share.
  Focused tier 0 also passed `9 passed, 12 deselected in 0.54s` at
  `.test-results/ol011/focused-tier0.log` (SHA256
  `345d5ef972159ac813ab8b9834124a8775a50bcfba9f257a50d5d460fb00c382`).
  These focused receipts did not replace the later complete exact-candidate
  gate recorded below.
- Failed and focused OL-011 receipts remain under `.test-results/ol011/` and
  `.test-results/ol011-final/`. The accepted integrated-candidate receipt under
  `.test-results/ol011-integrated-final/` records raw tier-0/tier-1 output, exit
  status, command, elapsed time, commit/tree and dependency identity,
  supersession mapping, and before/after container/share teardown. The exact
  pushed candidate and receipt hashes are also durable on `prime-claw-h6w.25`.

- Exact accepted candidate `615687aff1aa3549e986cc030073ee2539b836fe`
  (tree `e23e1841fecadabf2f0d85269aeb4535ee2bb056`) is pushed and synchronized.
  Canonical `scripts/test-all.sh` passed Tier 0 (`284 passed, 155 skipped`) and
  complete selected Tier 1 (`48 passed, 391 deselected`). Structured receipt
  `.test-results/ol011-integrated-final/exact-candidate-pass.json`, SHA256
  `971e66f69108c1b66b0213d8603faa608d2594028b90d92d204b9be152f65588`.
- Owner acceptance and independent final review PASS are recorded on
  `prime-claw-h6w.25`. Review report
  `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/sub-283381d7/official-lean-slice1-final-review-615687a.md`,
  SHA256
  `9fe07a62f2d8c5fcb8b1bd9a2fb45903cd2ec54ab8d09c02b05872bea9ef78db`.
- This planning-only revision changes only the active specification and plan.
  Its pushed commit identity and owner disposition belong on
  `prime-claw-h6w.25` after the commit exists.

- [x] Slice 1 transition commit pushed; Tier 0 and complete Tier 1 pass.
- [x] Owner accepted the exact transition commit.
- [ ] Plan-only transition topology checkpoint pushed and owner accepted.
- [ ] Operator authorized the first transition merge and cutover.
- [ ] Exact ordinary saved conversation identified and proved before restart.
- [ ] Known-good installed generation, merge parent, and rollback inputs recorded.
- [ ] First no-fast-forward merge landed on synchronized primary `main` with
      compatibility resources retained.
- [ ] Main-only `--user-global` apply/check passed and exact hashes were recorded.
- [ ] Active work quiesced and one coordinated full restart completed.
- [ ] Resumed owner, unchanged episode fixture, and exact ordinary conversation
      UAT passed.
- [ ] Operator accepted cutover.
- [ ] Exact transition-episode bookkeeping and approved cleanup completed without
      a post-merge episode change.
- [ ] `prime-claw-h6w.25`, beads, Git, primary `main`, and the installed
      transition generation reached their reviewed terminal state.

Deferred outside this transition episode: compatibility-resource removal and
final documentation cleanup. Those items receive no checkbox here because they
require an operator-selected future folder, separate specification and plan
reviews, a new episode/branch, and a later second merge.

## Explicit non-goals

- Prime Agent source changes or upstream contribution work.
- Any amendment or product-byte change to accepted candidate `615687a`.
- Merge, host-global apply/check, restart, UAT, rollback, finalization, or
  cleanup during this plan-only pass.
- Compatibility-resource removal or final documentation cleanup in this
  transition episode.
- Naming or creating a future cleanup folder before operator selection.
- Reusing this episode for implementation after the first merge.
- A new oversight procedure, owner ledger, mandatory expert model, or fixed
  heartbeat interval.
- Changes to episode promotion, handoff, merge, abandonment, or finalization
  authority.
- New orchestrator or channel behavior.
- Tier-1 container redesign or tier-2 sandbox work.
- Historical artifact rewrites.
- Session deletion, concurrent daemons, or `/reload` as migration shortcuts.
