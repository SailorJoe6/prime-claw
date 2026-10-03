# Project-wide testing Slice 1 — pinned provenance and source fail-close

**Bead:** `prime-claw-5v7.2`
**Branch:** `episode/project-wide-testing-strategy`
**Promoted bundle:** `b71405c`
**Rejected candidates:** `fd1f2b7c4a6b1fba1bc4671b3baac95248aed09e`, `aee5cfe2bf381191024e4d4c2a6bfc52fa0b0cbd`
**Current candidate:** recorded by exact SHA in the final Bead delivery receipt

## Revision authority

The owner rejected `aee5cfe` and authorized one bounded Slice-1 repair scope
containing R1–R6 plus teardown-diagnostic redaction. F1, R2, R4, and R6 were
accepted only for advancement within that repair; the whole replacement
candidate remains unaccepted. The immutable authorities are:

- EXPERT report: `/Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-d5bf5e77/slice1-aee5cfe2-review.md`, SHA-256 `681d4d2300ae35b4ea05be2e3965582af70d95ad06f9838bd2fc74276ab467cb`.
- Owner report: `/Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/owner-review-slice1-aee5cfe2/OWNER_REVIEW.md`, SHA-256 `59b6540186446ae4123d2610a50dde1ad0e0127c5a467b767796d074b77bae5a`.

The earlier candidate manifests, timing summaries, and advisory PASS are
historical only. They are not evidence for the replacement candidate.
`prime-claw-5v7.2` remains `in_progress` until explicit owner acceptance.

## Delivered Slice-1 boundary

Slice 1 supplies a run-owned tier-1 evidence tree, immutable image execution,
offline product actions, exact-ID teardown, and immediate source-mode
fail-close. It does not implement the source builder, integration brain stack,
lifecycle observer, or later test-taxonomy slices.

### Descriptor-bound capture and cleanup

- Repository capture retains no-follow source and destination descriptors.
  Regular leaves are opened nonblocking and then required to be regular, so a
  regular-to-FIFO swap cannot wait for a peer.
- Snapshot rollback clears only descendants reached through the retained owned
  descriptor. A changed destination binding is a preserve-and-refuse outcome;
  the replacement pathname is never recursively deleted.
- Terminal workspace/share cleanup requires the captured device/inode binding
  and removes descendants relative to an opened directory descriptor.
- Evidence inventory retains its root descriptor, traverses directories with
  no-follow opens, and reads/sanitizes/hashes the same opened regular inode.
  Direct inventory and manifest verification enforce the same root policy.
- Repository and declared-input identities remain schema-v2,
  domain-separated, length-framed hashes over captured bytes and modes.

### Bounded command and signal truth

- The controller blocks TERM/INT/HUP across spawn to close the orphan window.
  An owned exec-in-place shim restores the caller's intended mask before the
  target program starts. Ordinary exit, timeout/reap, post-preflight launch
  error, target signal death, and exceptions all converge on one blocked
  terminal restoration boundary: every prior handler is attempted before the
  exact caller mask is restored. Natural unmask redelivers newly pending
  caller-unblocked signals and preserves caller-blocked pending signals.
- Target signal death is a distinct `signaled` outcome. Controller
  interruption, timeout, launch failure, reap failure, and ordinary nonzero
  exit remain separate.
- The shell consumes an exact typed status record from the bounded helper.
  Proven container absence never turns a signaled cleanup client into success.
  Network-list filtering accepts Docker's template terminator plus CLI-added
  trailing newline, while still rejecting internal empty rows and unsafe names;
  this permits the real container to disconnect before every product action.
- Both public producers keep exact-ID inspection and teardown bounded, restore
  prior signal state, and retain failure evidence before controller-signal
  redelivery. The standalone supervisor additionally checks newly pending
  TERM/INT/HUP while they remain blocked after evidence closure; a closure-time
  signal forces `128+signal`, a second failed closure that invalidates green
  evidence, and only then prior-handler/mask restoration. Caller-blocked pending
  signals are preserved rather than adopted.

### Pre-write validation and terminal publication

- Image-inspect output is piped directly into the allow-listing producer; it is
  not written to a named evidence-tree temporary file.
- Installed version and executable observations are parsed in memory. Artifact
  creation requires one full lowercase SHA-256 record before the exclusive
  sanitized JSON write.
- Fixture teardown output is used only for narrow in-memory classification.
  Exceptions, notes, console output, logs, and evidence contain allow-listed
  outcomes and return codes, never arbitrary Docker stdout/stderr.
- Fixture finalization covers CID recovery, exact-ID cleanup, owned-tree
  cleanup, manifest inventory/write/verification, every prior-handler attempt,
  exact caller-mask restoration, and unconditional evidence-capability close in
  one exception-safe boundary. Caller-owned pending signals stay blocked and
  pending. Consumed fixture signals replay once after prior handlers return.
  Primary and secondary failures remain distinct.
- Fixture publication keeps TERM/INT/HUP blocked across inventory, atomic
  publication, post-write verification, and handler restoration. A signal at
  any checkpoint republishes `interrupted` failed evidence; publication failure
  after file creation is invalidated to failed or absent evidence. Shell
  publication applies the same non-green rule. Neither producer may retain a
  green contradiction or print an `OK` line.

### Preserved boundaries

B1 host-Docker isolation, B3 framed/captured hashes, B8 owner-only acceptance,
and the scratch-only R-TEST-7 writable mount remain intact. Source mode still
fails before checkout or Docker access. Installation occurs online, every
product action occurs after verified network absence, execution uses immutable
iid/cid identities, and the plugin root remains
`/root/.prime/agent`. No plugin/product/upstream/credential/global/live action
or later-slice implementation is included.

## Retained negative and replay coverage

Tier-0 tests cover:

- real-directory, symlink, root, ancestor, leaf, mode, and FIFO swaps;
- stable executable/missing/link inputs and fresh-destination replay;
- child signal-mask restoration, TERM grace, KILL escalation, detached output
  holders, the post-spawn signal race, and typed target signal death;
- full standalone build/image/run/install/network/disconnect/apply/check/probe
  timeout and failure contracts through the actual shell producer;
- invalid iid/cid refusal, failed launch after CID publication, exact version
  mismatch, unknown teardown, smoke failure, and fresh-run non-adoption;
- a deterministic public-standalone post-preflight build exec fault that remains
  typed `launch_error`, never reaches the fake Docker build, removes only its
  owned workspace/share, publishes failed evidence with clean absent teardown,
  emits no success/`OK` line, and permits a fresh successful replay;
- private image metadata and malformed artifact refusal before named durable
  output;
- fixture target-signal truth, non-UTF8/arbitrary teardown redaction, cleanup
  interruption, and signal injection during terminal publication; and
- shell signal injection during manifest publication, requiring failed evidence
  and no green `OK` result.

The table-driven standalone matrix uses one shared immutable mini-repository
and isolated per-case result/state roots. This preserves actual shell
sequencing while avoiding redundant full-repository setup. Native process
cases remain for behavior that depends on real signals, groups, masks, waits,
or exec.

## Exact-input validation and performance records

The final delivery receipt on `prime-claw-5v7.2` is the authoritative index for
commands, raw record paths, exact candidate SHA/tree, sample exit statuses,
three deliberate warm Tier-0 samples, comparable Tier-1 preparation/body/
teardown samples, medians, gate arithmetic, standalone run IDs, aggregate
results, and independent review. Raw records remain gitignored beneath the
final run-owned `.test-results/<run-id>/performance/` tree; failed samples are
retained rather than retried or discarded.

The executive sponsor waived the legacy Slice-1 runtime budget after confirming
that production isolation—not maintaining the pre-repair suite duration—is the
governing outcome. The retained isolated command
`python3 -m pytest tests/ -q --durations=20` passed **328 tests**, skipped **147**,
and passed **90 subtests** in **123.87s**. Its raw output remains at
`.test-results/final-candidate-preflight/tier0-diagnostic.log`; the result was
not retried, hidden, or relabeled. This duration is a transparent observation,
not a candidate gate. Additional advisory assertion expansion was also declined
unless it directly proves the production-isolation boundary.

Final acceptance still requires the existing host, standalone Docker smoke and
probe, container, aggregate, syntax/compile, inventory, and diff checks plus a
fresh whole-candidate review focused on the approved isolation and safety
contract. Their exact commands, run IDs, results, and candidate/remote identity
are recorded in the final Bead receipt. No result from either rejected candidate
is relabeled as final-candidate proof.


## Fresh replacement-candidate isolation validation

The first live smoke attempt is retained as a failed gate rather than hidden or
retried: run `20261003T201648Z-41904-1d9a87ef` returned 65 before network
absence because Docker emitted a template-terminated network name plus its own
final newline. The sanitizer rejected the resulting trailing empty row. The
minimal fix removes only trailing empty rows; internal empty rows, unsafe names,
and invalid encodings still fail closed. Focused policy/consumer coverage passed
**9 tests + 2 subtests**. Corrected live smoke run
`20261003T202135Z-58769-2f9aacf2` passed with network verified absent and exact-ID
teardown clean.

Fresh sequential validation of the repaired input then passed without retries:

- pinned standalone probe run `20261003T202232Z-62292-6f0607ae`: PASS in 36.09s;
- container run `20261003T202308Z-64621-b88887e2`: **40 passed, 438 deselected** in 125.33s;
- aggregate `.test-results/20261003-132513-71483`: Tier 0 **331 passed, 147 skipped, 92 subtests** in 126.25s; Tier 1 **40 passed, 438 deselected** in 113.57s; overall PASS in 241.60s;
- both final container manifests record repository content identity
  `9ddd8fc01e61326309a45653c2faad90301b90fb6cf1cb4d07f5781d55982457`,
  verified network absence, and clean exact-ID teardown.

Raw command summaries and logs are retained under
`.test-results/20261003T201638Z-final-s1/`,
`.test-results/20261003T202133Z-network-fix/`, and
`.test-results/20261003T202231Z-final-resume/`. The final Bead receipt records
the exact pushed commit/tree and remote equality after review. Candidate
publication remains distinct from owner acceptance.

## Rollback and remaining work

Rollback may remove additive Slice-1 provenance or launcher mechanics only
while source mode remains fail-closed. Never restore the prior host
build/cleanup/pack path. Slice 2 (`prime-claw-5v7.1`) remains unstarted and must
add the read-only source snapshot/disposable builder before source selection
can execute.
