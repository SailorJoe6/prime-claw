# Execution Plan — Official lean session protocol

> **Status:** Active; accepted watchdog/PATH unblock integrated, exact canonical gate pending
>
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
>
> **Tracking:** `prime-claw-h6w.25`
>
> **Execution shape:** One isolated implementation episode, three pushed slices,
> and one operator-controlled full runtime restart before cleanup. The episode
> branch remains unmerged through the cutover so `main` continues to provide all
> compatibility files to old loaded sessions.

## Resolved execution blocker and authorized continuation

Exact OL-011 code candidate `6322a18e1bb921478a7d9e7c67a8eff4088481a3` (tree `68125ad163dc9a9bb72e296b05af2b913b9210f6`) is committed
locally. The accepted provider-boundary repair passes its exact system-channel
control and the complete focused native provider/lifecycle set. The complete
selected Tier 1 suite also passes: `48 passed, 383 deselected` in 98.42s, receipt
`.test-results/ol011-final/tier1-diagnostic-after-watchdog.log`, SHA256
`365c8198150db62faaa448b25a3328d2bbd297889223cea74532d27282629830`.

The required canonical `scripts/test-all.sh` gate cannot complete because the
independent Darwin process-group watchdog defect tracked as
`prime-claw-zwg.5.1` failed Tier 0 on three bounded attempts against the exact
candidate. The attempts produced the two previously baseline-reproduced
signatures; OL-011 changes neither `tests/test_embedding_candidate_build.py` nor
`bin/prime-claw`. No attempt reached Tier 1:

1. `.test-results/ol011-final/failed-gate-watchdog.json`: stall-test
   `TimeoutExpired`; raw Tier 0 SHA256
   `9b92f402b592af11bfa0c13b708c2a0648b59f5ffbfc58985ba3ae7a2d5c513f`.
2. `.test-results/ol011-final/failed-gate-watchdog-rerun.json`: progress-reset
   test returned 124; raw Tier 0 SHA256
   `53ab940fea2081e28c293c026f9d73fdc623c7bd9f30482e09fcd9f1c82657c4`.
3. `.test-results/ol011-final/blocked-final-gate.json`: stall-test
   `TimeoutExpired`; raw Tier 0 SHA256
   `dbf3830c7c3443dece2962a52c8876ddc3e59436abfd4208079667546af73916`.

Those failures remain preserved and are not accepted as a successful canonical
gate. After the operator accepted the bounded unblock, this episode integrated
accepted `origin/main` through
`eca48f8b284c990a8e030062ef70192313781b7f`. The resulting history includes the
independent watchdog/PATH repair
`3bf905976a1a489d93e81619a838b34fc7ed8a31` and bead closures
`927b3941ebab281c18ceacfc3c922f82e75db9fc`; `prime-claw-zwg.5.1` is closed.
The merge was conflict-free, preserves every OL-011 implementation/test file,
and retains the exact compatibility skill, symlink, and reviewer-profile bytes.
The resulting commit must now run `scripts/test-all.sh` with correlatable raw
logs, commit/tree/dependency identity, supersession mapping, and teardown proof,
then stop for exact-candidate owner review.

Preserve the OL-011 provider-`systemPrompt` proof, OL-008 isolation, and every
compatibility resource. Do not perform host-global apply/check, Slice 2, restart,
cleanup, merge, or deployment-topology changes.

## Outcome

Promote the dogfooded lean session protocol to the supported default, prove it in
the tier-1 Docker boundary, install and restart into that transition generation,
then remove only the compatibility resources that the restarted generation no
longer uses. Finish with current documentation, a clean global plugin check, a
closed tracking bead, and a reviewable final branch.

## Baseline and invariants

Planning was performed from clean `main` at `44d83db`. Relevant history:

- `00ad366` — lean protocol POC;
- `535f584` — stale package assertions reconciled with the POC;
- `1442abb` — three-tier plugin test container merged; and
- `44d83db` — reviewed migration specification committed.

The active global plugin matches the current eight-file POC generation. The old
`.ralph/skills/oversee-episode/SKILL.md` is live compatibility state: old loaded
conversation hooks reread it on every turn. Its symlink and reviewer profile are
also retained until cutover.

The implementation must preserve these invariants throughout:

1. No Prime Agent source change or concurrent host daemon.
2. Plugin execution tests run through tier 1, not an unguarded host process.
3. `main` keeps the old skill, symlink, and profile until after accepted cutover.
4. The episode worktree keeps them through the transition commit and restart.
5. Historical archived plans, reviews, reports, and evidence are not rewritten.
6. Cleanup never begins from install success alone; it requires a full restart,
   resumed-session evidence, and explicit operator acceptance.
7. If the cutover fails, restore the `44d83db` plugin generation and retain all
   compatibility resources before trying anything else.

## Delivery topology

Use one episode branch and do not merge the transition commit by itself:

```text
main (old plugin source + compatibility files stay intact)
  \ episode worktree
       transition commit ── test ── review
       deployment-checkpoint commit ── apply candidate globally ── full restart
                                       │                           │
                                       └──── rollback to main ─────┘
       accepted resumed-session UAT
       cleanup commit ── test ── final review ── merge once
```

The transition commit is independently deployable because it is pushed and
applied from the isolated worktree. Keeping the branch unmerged prevents the
canonical checkout from losing compatibility files before the restart. After the
restart, the same saved owner and episode sessions resume on the new global
plugin generation. Cleanup then occurs only in the episode worktree. The final
merge is the first deletion of compatibility files from `main`.

If this topology cannot be followed exactly, stop and revise the plan. Do not
improvise a main-checkout deletion or assume the episode can continue after an
early merge.

## Slice 1 — Build the compatibility-safe transition generation

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

Preserve `.ralph/skills/oversee-episode/SKILL.md`,
`.agents/skills/oversee-episode`, and
`.prime/agent/profiles/expert-reviewer.md`. Do not use host-global apply/check,
launch or restart host Prime Agent, remove compatibility resources, merge, or
begin Slice 2. `prime-claw-blw.5` and `prime-claw-zwg.5.1` remain independent;
add the BLOCK report's distinct watchdog signature to existing tracking without
folding its repair into this revision.

## Slice 2 — Deploy the accepted transition and checkpoint rollback

### Dependency

The owner has accepted the exact pushed Slice 1 commit and all in-scope revision
findings are already incorporated. This slice must not change runtime, installer,
managed-system-block, or test bytes.

**Topology blocker introduced by OL-008:** the accepted isolation guard refuses
user-global activation from this linked episode worktree and permits it only from
the primary `main` checkout. The original unmerged-branch topology expected
Slice 2 to install the candidate before merge so the episode could survive the
restart and later remove compatibility files. Docker validation cannot deliver
that host-installed capability. Do not bypass the guard, merge early, change
terminality, or silently redefine the restart/cleanup sequence. After Slice 1 is
accepted, stop for an owner/operator decision and a reviewed plan revision before
any Slice 2 action.

### Capability delivered

The accepted seven-file transition generation is installed and byte-verified in
the single host environment, exact rollback inputs are durable, and the system
is ready for an operator-controlled full restart without having removed any
compatibility file.

### Execution

1. Confirm the episode worktree is clean and the current plugin, scripts, and
   tests are byte-identical to the accepted Slice 1 commit. A plan-progress edit
   is allowed; any product-code drift returns to owner review.
2. Reconfirm the compatibility skill, discovery link, and reviewer profile are
   present and byte-current.
3. Identify one exact saved ordinary project conversation for restart UAT and
   record its session ID, name, and canonical project CWD. It must complete a
   normal pre-restart turn on the current single daemon. If no suitable saved
   conversation exists, stop and ask the operator to create or approve one
   through the normal session flow on that same daemon; cutover stays blocked.
4. Record:
   - accepted transition commit and branch;
   - `44d83db` as the rollback source generation;
   - current installed managed-file hashes or exact check result;
   - active episode identity and resumable branch/worktree/session details;
   - exact ordinary-session identity and successful pre-restart turn; and
   - the successful Slice 1 tier-0/tier-1 evidence.
5. Re-run `git diff --check` and `scripts/test-all.sh` against the accepted tree.
6. From the episode worktree run the Docker-only candidate gates:

   ```bash
   python3 -m pytest tests/ -q -m container
   scripts/test-tier1.sh --probe
   ```

7. Verify the explicit container installation matches the accepted seven-file
   candidate, the retired goal/heartbeat entry is absent, the managed
   APPEND_SYSTEM block is current, and the old project compatibility resources
   are still present. Do not mutate the host user-global generation from the
   episode worktree.

A successful container apply does not prove the host loaded generation changed.

### Slice completion

- Record the exact commands, results, hashes, test log, and restart-ready
  checkpoint in `prime-claw-h6w.25` and this plan.
- Commit and push only the durable deployment-checkpoint/progress update.
- Stop for owner review and operator restart coordination. Do not use `/reload`,
  start cleanup, or attempt to restart the harness from the episode.

## Cutover gate — Restart and verify the transition

This is an owner/operator gate between implementation slices, not permission to
start cleanup automatically.

### Admission

The owner reviews and accepts the exact pushed Slice 2 deployment checkpoint.
The global check, installed hashes, rollback source, compatibility resources, and
resumable episode identity must still match that checkpoint. Any drift returns
to Slice 2 rather than being accepted informally.

### Coordinated restart

- Let active turns, child agents, tests, heartbeats, and other background work
  become idle or durably checkpointed.
- Complete active goals that would otherwise imply work is still running.
- The operator performs one full Prime Agent daemon/harness restart. Do not use
  `/reload`, start a second daemon, or delete saved sessions.
- Resume this owning conversation, the exact implementation episode, and the
  exact ordinary saved conversation recorded in Slice 2. The ordinary session
  must run from its recorded canonical project CWD and complete a real turn.

### Required UAT evidence

Collect evidence from the restarted single runtime plus the accepted container
capture:

- the owner conversation resumes with exact episode ownership intact;
- the episode resumes with its bounded role, branch, worktree, and task intact;
- an ordinary conversation completes a real turn without promotion or package
  errors;
- provider-context evidence contains one managed lean block, no newly injected
  `prime-claw-oversee-episode-package`, and no legacy detailed work-control
  overlay;
- exact lifecycle state remains fail-closed and handoff/finalize authority has
  not broadened;
- goal/heartbeat behavior follows the lean managed protocol during a naturally
  occurring work/wait boundary; and
- no session reports a missing oversight skill or requires `/reload` recovery.

Do not launch an extra host Prime Agent process merely to obtain a cleaner probe.
Use the running resumed sessions and the tier-1 provider capture. If evidence is
insufficient, pause rather than violate the single-instance boundary.

Record the restart and UAT evidence on `prime-claw-h6w.25`. The operator must
explicitly accept the cutover before the owner advances the episode to Slice 3.

### Rollback on failure

If any required UAT fails:

1. keep or restore all compatibility files;
2. from clean `main` at `44d83db`, run the normal apply/check scripts to restore
   the eight-file POC generation;
3. perform the same quiesce and full-restart discipline;
4. verify ordinary and owning sessions recover; and
5. record the failure, evidence, and resumable checkpoint.

Do not begin cleanup and do not retry uncertain lifecycle operations blindly.

## Slice 3 — Remove compatibility scaffolding and finish the official default

### Dependency

This slice is blocked until the operator's accepted cutover evidence is recorded
in the bead and delivered to the episode as an approved in-scope continuation.

### Capability delivered

The final branch contains only the supported lean architecture and current
policy. Compatibility files proven unnecessary are removed without affecting the
already-restarted runtime, all gates pass again, and the candidate is ready for
one final merge.

### Implementation

Start with a fresh nonhistorical reference audit. Expected removal candidates:

- `.ralph/skills/oversee-episode/SKILL.md`;
- `.agents/skills/oversee-episode`;
- `.prime/agent/profiles/expert-reviewer.md` when no independent current use is
  found;
- `tests/test_oversee_episode_skill.py` and remaining compatibility-only package
  assertions; and
- transition-only wording or guards in current docs/tests.

Do not remove an item with a real independent current use. Record the use and
retain or replace it with an explicit current contract. Do not alter archived
plans, historical reviews, dogfood reports, or evidence references.

Finalize current docs so they describe the supported lean default rather than an
active migration. Preserve a concise migration/rollback note where operationally
useful. Confirm the plugin layout is seven TypeScript files plus the managed
APPEND_SYSTEM block.

Slice 3 should not change installed plugin bytes. If implementation discovers a
necessary plugin-code or managed-system-block change, stop: that creates a new
runtime generation and requires a revised plan plus another restart gate before
cleanup can be considered safe.

### Verification

Run again from the episode worktree:

```bash
git diff --check
scripts/test-all.sh
scripts/test-tier1.sh --probe
```

Required results:

- tier 0 and complete tier 1 pass;
- no owned container or scratch artifact remains;
- explicit container-root apply/check passes without the old skill or inert
  extension source;
- the container-installed managed TypeScript and APPEND_SYSTEM bytes are
  unchanged from the accepted transition generation; and
- the reference audit contains only intentional current legacy-filter names and
  immutable historical mentions.

If global managed bytes changed, the no-second-restart assumption is false. Stop
and return to the owner before merge.

### Slice completion

- Update normative docs and this plan's progress/evidence.
- Update `prime-claw-h6w.25` with cleanup evidence and leave it open pending the
  operator's terminal decision, post-merge main/global verification, and owner
  closure. Use a follow-up bead for any independently scoped defect.
- Commit one cleanup/finalization change and push the episode branch.
- Stop for owner review. Do not merge from the episode.

## Owner final review and landing

The owner reviews the exact final commit, diff, tests, docs, bead state, global
byte-parity evidence, and cutover record. A fresh independent expert review is
optional under the lean protocol and should be used if the owner judges that the
migration risk or evidence warrants it.

Only the operator decides to merge. After that merge is carried out, do not
resume the episode for more work. The owning conversation completes landing from
clean `main` in this order:

1. `git pull --rebase` and verify the expected final commit is present.
2. From the primary `main` checkout, deliberately activate and check the accepted
   generation with `scripts/apply-prime-agent-plugin.sh --user-global` followed
   by `scripts/check-prime-agent-plugin.sh --user-global`.
3. Verify Slice 3 changed no managed plugin or system-prompt bytes from the
   accepted transition. If it did, stop: another restart gate is required.
4. Add the post-merge check and terminal disposition to `prime-claw-h6w.25`, then
   close that bead.
5. Run `bd sync`, commit and push any resulting tracked change if required, run
   `git push`, and verify `git status` is clean and up to date with the remote.
6. Only then call `finalize_spec_episode` for the exact retained future-folder
   location and perform only the operator-approved session/worktree cleanup.

An abandonment or failed merge follows the operator's explicit disposition and
must not be reported as completed work or close the bead as successful.

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
  These focused receipts do not replace the pending exact-candidate full gate.
- Final exact-candidate OL-009 receipts will be retained under
  `.test-results/ol011-final/` after the replacement commit exists.
  They must include raw tier-0/tier-1 output, exit status, command, elapsed time,
  commit/tree and dependency SHA/selector, supersession map, and before/after
  container/share teardown. The exact post-commit result and push receipt belong
  on `prime-claw-h6w.25`; this pre-commit plan must not predict them.

- Exact transition commit and push receipt remain pending in this pre-commit
  record; the real SHA is recorded on `prime-claw-h6w.25` only after push.

- [ ] Slice 1 transition commit pushed; tier 0 and complete tier 1 pass.
- [ ] Owner accepted the exact transition commit.
- [ ] Exact ordinary saved session identified and proved before restart.
- [ ] Candidate applied globally; seven-file check passed; rollback recorded.
- [ ] Slice 2 deployment-checkpoint commit pushed.
- [ ] Owner accepted the exact Slice 2 commit and installed-generation evidence.
- [ ] Active work quiesced and one coordinated full restart completed.
- [ ] Resumed owner, episode, and exact ordinary-session UAT passed.
- [ ] Operator accepted cutover and authorized cleanup continuation.
- [ ] Slice 3 cleanup commit pushed; repeated gates and global byte parity pass.
- [ ] Owner final review complete.
- [ ] Operator terminal merge decision carried out.
- [ ] Post-merge main/global check passed and `prime-claw-h6w.25` closed.
- [ ] Beads and Git are synchronized; `main` is clean and up to date.
- [ ] Exact episode bookkeeping finalized; approved cleanup completed.

## Explicit non-goals

- Prime Agent source changes or upstream contribution work.
- A new oversight procedure, owner ledger, mandatory expert model, or fixed
  heartbeat interval.
- Changes to episode promotion, handoff, merge, abandonment, or finalization
  authority.
- New orchestrator or channel behavior.
- Tier-1 container redesign or tier-2 sandbox work.
- Historical artifact rewrites.
- Session deletion, concurrent daemons, or `/reload` as migration shortcuts.
