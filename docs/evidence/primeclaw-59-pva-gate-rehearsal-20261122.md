# PRIMECLAW-59: PVA-only disposable migration rehearsal

The two focused Docker cases use frozen product source `f141d1cab8993fa620404c580f163f8a575e3df3`.
This commit adds the fixtures, Python bridge and evidence only. Neither case
uses a live project, private incident data, or a nonlocal fixture remote.

## Fresh path: verification and timing

One offline, embedded Beads source had 12 tasks (11 open, one closed, no source
archive), 43 actual authored comments and two native memories. The 42 generated
comment bodies alone contained 541,422 UTF-8 bytes. The native export was
873,408 bytes, the sum of compact native current views 865,995 bytes, and the
sum of compact Backlog task view envelopes 903,061 bytes. These are different
serializations, not equal-byte comparison targets. The fixture had seven
original Backlog task/draft records, including `BASE-12` at distinct live and
archive paths with modes `0640` and `0750`.

Checks covered inactive parked config, effective custom config (only placement
changed), original paths/bytes/modes/history, ancestry of both the parked-store
split and the genuine published bootstrap, native singleton views, use of
`BASE-13`, one distinct import per source, and exact native projection readback
including status, parent/dependency, comment author/time and UTF-8 content.
The receipt, memory documents/index and USER task were distinct from imports;
no historical chunks or raw source envelopes appeared in task content. A
read-only runner rejected history/provenance queries during migration. At the
synthetic retirement callback, the Beads export still matched; the published
receipt was directly verified at `004248615ad5cc15961760a7402e358d9556928d`
after data revision `dd3dc975158cc0e00484ced40a63cfae2718562a`, and the active Episode
ownership was already switched to the corresponding Backlog task and receipt
revision. The Episode used the same identity and a receipt-backed clone. The
fixture simulates active-runtime continuity and performs synthetic deletion;
it does not prove live runtime continuity or live retirement.

| Observation | Time |
| --- | ---: |
| Fixture setup and independent baseline reads | 22.127 s |
| Read-only switch inspection (separate from confirmation) | 5.486 s |
| First and last native Web writes, from confirmation start | 9.184 s / 19.640 s |
| Parked-layout and data/receipt task ref pushes, from start | 6.495 / 8.105 / 24.103 / 27.811 s |
| Synthetic retirement callback entered, from start | 61.999 s |
| Confirmation settled | 66.568 s |
| Independent checks inside the retirement callback (included above) | 0.200 s |
| Independent post-result checks | 3.338 s |

The confirmation interval includes repeated native source and destination
proof, layout publication, owned Web shutdown, and synthetic retirement;
it is not just write time. The observer counted 12 POST, 53 PUT, 2 GET,
217 Backlog CLI, 862 Git and 194 Beads calls; the CLI counts include the
separate inspection. There were no encoded history chunks driving those
calls. These figures describe this local fixture, not a live-scale estimate
or an upper bound. They do not replace the earlier qualified 2,610,950-byte
single-current-content proof, nor predict 406-ticket, remote transport,
server-backed source or long-history performance. No provider-native progress
milestones were streamed to a real UI: these timestamps came from the harness.
The registered tool ignores `_onUpdate`; operators get the separate inspection
summary and then the returned confirmation result, without built-in phase or
elapsed progress from this tool. The full Node run for both cases took 107.555 s;
pytest took 200.13 s including Docker setup/build/teardown.

## Separate in-flight failure proof

A separate two-task fixture used real native Backlog. Its first task POST
succeeded. On the first comment PUT, native Backlog persisted the comment and
returned HTTP 200. The observer changed only the HTTP status exposed to the
migration caller to 503. This is a controlled response failure at an accepted
write, not daemon shutdown, cancellation, or a naturally occurring HTTP 503.
The caller returned `blocked/pre-cutover-failed` 34.47 ms after the observer
recorded the error boundary, at 2.954 s from confirmation start. The only
observed writes were POST and PUT. There were no later native commands,
retry, additional task/comment/receipt, deletion or retirement. One partial
task and its persisted comment remained and were natively readable. The task
publication ref, Beads configuration and export, active ownership, and Episode
code head stayed unchanged; Beads remained authoritative. The caller kept
transport evidence until synthetic fixture teardown.

The hook and ref-lock experiments (`20261122T174625Z-32197-ab083121` and
`20261122T175109Z-44956-21dee3b2`) both missed the intended Git rejection.
Their synthetic deletion callback refused to delete; neither is a successful
failure proof. The first run's fresh case passed independently (65.548 s
confirmation). The final run repeats that case with the accepted-comment test.

## Remaining PVA blocker: ordinary operator stop

At this source, `initialize_prime_claw` discards the tool `_signal` and
`_onUpdate` ([registration](../../src/prime-agent-plugin/extensions/project-initialization.ts#L192-L222)),
`migrateTaskProvider` has no signal option, and its orchestration does not
pass a signal to the owned Web transport. The transport's internal
AbortSignal support is not a supported migration stop. Source/Git calls are
also synchronous. Static inspection of the pinned Prime Agent agent loop
(`a1faacd53`, `packages/agent/src/agent-loop.ts:48–73,827–879`) shows that turn
abort may return before the underlying tool settles; an abort acknowledgement
or idle UI does not prove no later writes. Operator stop latency is unmeasurable
on this build, not 34.47 ms. There is no live-cutover clearance.

To clear this gap, a gate-only candidate must connect the supported operator
stop to the migration and prove in Docker that the migration itself settles
at a verified in-flight boundary, with no later writes, retries, rollback or
retirement, source authority and partial destination retained. Separately
prove what a real operator sees and qualify any uninterruptible stage; do not
claim generic reset/resume or whole-task readiness. Initialize PVA owns later
live preflight and exact cutover confirmation.

## Reproduce and audit

With the project’s accepted read-only source-mode `TIER1_ENV_FILE`
(Prime Agent `a1faacd53ac4473a75de1d434afaf50945c2f647`, selector SHA-256
`892c87ebc2050d9849e1571bce2bbb4abe766efde87793c650fc1b3e1d7ac2f1`), run:

```sh
python3.14 -m pytest -q -m container tests/test_pva_gate_rehearsal.py
```

Run `20261122T175416Z-52868-3149fc02`: 2 focused Node cases and 1 pytest passed.
The tier-1 snapshot included the two fixture edits, not this later evidence
page. Repository digest `2d5f048248677564c33e81f7c7f922b5d10421720fe401a58fdb5f0df0370866`;
TAP SHA-256 `af9e55f557034b9f19c1c9de3070e2c078afaeaf602b21bb4d19cf8b98c2a5b3`.
All 45 manifest-listed artifacts across the three runs were verified; all ran
offline, both teardown layers were clean, and upstream checkout inventory did
not change. Artifacts and launch records are in
`.test-results/primeclaw59-pva-gate/`. The prior 218 passes / 12 skips remain
older-source evidence; the earlier incomplete `F` is unexplained and #83
remains static-only. This is not production scale, full-project validation,
AC completion, activation, merge, or deployment evidence.
