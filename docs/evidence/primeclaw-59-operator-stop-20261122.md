# PRIMECLAW-59: operator stop before guarded cutover

`switch-confirm` passes Prime Agent's tool signal to the running migration and
its owned Backlog Web transport. It checks for stop at pre-cutover phase
boundaries and sends major phase and elapsed-time notices. If Prime Agent has
already stopped waiting for the tool, a separate extension notification reports
the real outcome after the migration returns. No Prime Agent or dependency
source changed.

## Public abort after an accepted native write

Offline Docker run `20261122T181352Z-5792-0259fd66` used the pinned Prime Agent build
(`a1faacd53ac4473a75de1d434afaf50945c2f647`), its public JSONL RPC, and the installed candidate tool. A local
faux model selected the real `switch-request` and `switch-confirm` tools after
separate inspection and explicit fixture confirmation. The fixture used two
embedded Beads tasks, one actual authored comment, disposable Backlog, and an
isolated local Git remote. A loopback relay let native Backlog complete the
first task's comment PUT and consume its HTTP 200 response, but withheld the
response from the migration. Before stop, the harness independently read the
persisted task and comment and checked that the owned browser group was live.
The only cancellation trigger was a public RPC `abort` message. The fixture did
not stop the daemon, inject an AbortController, or manufacture a provider error.

| Event measured from sending RPC abort | Observed time |
| --- | ---: |
| Host abort acknowledgement | 8.345 ms |
| Owned Backlog browser group observed gone (ESRCH) | 25.529 ms |
| Actual initializer return independently observed | 53.202 ms |

Group exit and actual return were observed at 25 ms polling resolution under a
15 s proof deadline. These single-fixture observations are not latency bounds.
The client disconnected from the deliberately held response. The browser group
was gone and its port could be rebound before RPC teardown. The exact task
`TASK-1` remained readable through native Backlog; its authored
comment and exact source references survived. No later native request or CLI
command followed the one POST and one PUT, and the partial record bytes did
not change. No retry, rollback, deletion or retirement occurred. The exact
Beads export/configuration, ownership absence, code head and publication refs
stayed unchanged. Beads remained authoritative.

The RPC client received a real `notify` event for “Importing and verifying
Backlog tasks” (1.7 s elapsed) and later a separate `pre-cutover-stopped` notice
(1.9 s elapsed). It reported actual owned writer settlement, uncertain effects
of the outstanding request, Beads authority, and a direction to preserve the
partial destination without retry or cleanup. The abort response arrived first;
this run captured no generic tool-result output. Interactive Escape uses the
same tool signal by pinned source inspection; the measured route was RPC, not
an interactive UI exercise.

## Limits and regression

Synchronous source/layout/native CLI/Git groups cannot be interrupted. The
migration processes queued input at the next cancellable checkpoint. Once the
guarded cutover starts, it finishes the existing guarded ownership, source
retirement and publication sequence; ordinary stop does not interrupt it. A
writer exit that cannot be proved is a failure, not `pre-cutover-stopped`.
The earlier 34.47 ms response-failure case is different evidence. Its 12-task
fresh rehearsal is not a PVA-scale estimate. Independent review and a new
representative-volume rehearsal on the reviewed frozen build are still needed
before a separate live preflight and exact cutover confirmation. This candidate
is not generic recovery/resume, full-task acceptance, merge, or deployment.

## Reproduce and audit

Use the accepted read-only source-mode `TIER1_ENV_FILE` (selector SHA-256
`892c87ebc2050d9849e1571bce2bbb4abe766efde87793c650fc1b3e1d7ac2f1`) and Python 3.14:

```sh
python3.14 -m pytest -q -m container tests/test_operator_migration_stop.py
python3.14 -m pytest -q -m container \
  tests/test_project_initialization.py::test_project_initialization_node_suite \
  tests/test_task_provider_migration.py::test_forward_beads_retirement_node_suite
scripts/test-tier1.sh --probe
```

The RPC proof passed one Node case / one pytest in 107.61 s; snapshot
`29f0071952953e4b8c0f55c3d14f5842f9961ca18fde29de02a2b330f27ae8f4`, TAP SHA-256
`6312785c066d9418e9b6963ea82d365da10c6e59a5aae99199e76fb5b7ee0f3e`. The prior focused run
`20261122T181039Z-96738-d5844880` passed 89 initialization tests and one guarded retirement
test (two pytest in 126.26 s), before the RPC fixture was complete. The candidate
product code did not change between the two runs. Both ran offline, proved
runtime and builder teardown, and left the source checkout inventory untouched.
Run logs and manifests are under `.test-results/primeclaw59-operator-stop/`.
