# PRIMECLAW-59: incomplete representative-volume rehearsal

**Outcome: no completed migration or usable maintenance-window estimate.** The
single authorized run, `20261122T183325Z-58413-f5098cc6`, used synthetic embedded
Beads, a disposable local Git remote, and the frozen reviewed Prime Claw
product `ceaf02004fbd571603e3c51a0e245957607726e6`. The fixture made no product-source edits. The
saved network evidence says the Docker runtime had no network. No live store,
inventory, or incident artifact was accessed. No rehearsal was restarted.

## What was measured

| Measurement | Observation |
| --- | ---: |
| Fixture setup, including seeding and independent source capture | 1,663.019 s |
| Separate read-only inspection | 392.514 s (`ready`) |
| Confirmation-to-terminal result | Not recorded |
| Independent destination readback after result | Not recorded |

Native inspection found 406 tickets: 57 open/unclosed, 349 closed, no
archived source tickets. Underlying states were 55 `open`, one `in_progress`,
one `blocked`, and 349 `closed`. The fixture captured 3,800 actual authored
comments. Comments per ticket (number of tickets): 0 (46), 1 (100), 5 (180),
20 (60), 80 (20). Native export: 29,493,492 bytes. Serialized native current
readbacks: 29,672,653 bytes. Comment bodies occupied 20,581,716 bytes; current
descriptions/plans/notes occupied 7,655,666 bytes, including substantial UTF-8
text. Two synthetic memory entries were seeded; destination memory readback
was not observed. These are fixture characteristics, not live estimates.

| Confirmation-relative time | Saved event |
| --- | --- |
| 0.007 s | Checking source and migration prerequisites |
| 399.508 s | Preparing the destination |
| 403.127 s | Importing and verifying Backlog tasks |
| 403.195 s | One local owned browser found at startup with exact `BACKLOG_CWD` |
| 403.301 s | First Web write attempt |
| 1,441.387 s | Web write attempt 2,000 |
| 2,024.052 s | Web write attempt 2,500 |
| 4,256.961 s | Web write attempt 4,000 |
| 4,656.532 s (77m 36.532s) | Web write attempt 4,200; last recorded event |

The first three events are the production progress callback's phase text
measured in the fixture, not a fresh public RPC or interactive UI test. There
was a 399.5 s gap before the next phase notice; the last saved event was
4,253.405 s (70m 53.405s) after the import phase notice with no further saved
operator phase notice. The fixture logged every 100th Web write attempt after
the first. These are request starts, not accepted or durable writes. They
count task, comment and relationship requests without distinguishing them;
the last count is not a count of persisted comments or tasks. No backend cost or cause of the observed pace
was isolated.

## Exact evidence boundary

The host output ends with pytest's literal `F`, without a failure summary.
The recorded host shell and pytest PIDs were absent when checked. No wrapper
exit file, Node TAP, terminal migration result, Tier 1 runtime teardown
record, or final artifact manifest was available. The test's `finally` copy
of the progress file matched the original bytes. The source-build manifest
separately records successful build and clean builder absence, with unchanged
upstream inventory (`b10e91aaf8b350ed74187e9f94fb89a61607813ac60f7397b00df088ba72a829`). Builder teardown does not prove runtime teardown.
The missing terminal diagnostics prevent classifying this as an application
failure, timeout, memory kill, operator stop, or clean exit. The configured
fixture ceilings (7,100 s Node test and 7,200 s container command) are not an
observed timeout or a maintenance recommendation.

There is no evidence of the later publication or guarded-cutover callbacks.
This does not prove that those effects were absent. The run does not establish
full native content/relationship/status/memory readback, no history chunks,
exact parked/same-ID preservation, receipt publication, ownership cutover,
source retirement, or runtime cleanup. The fixture's retirement callback
checks guarded ordering and deletes only synthetic source files; even a
complete run of this fixture would not be a live route or default-deletion
latency proof. Earlier accepted operator stop, controlled response failure,
and 12-ticket pilot evidence remains separate and unchanged.

## Audit and reproduction inputs

- Exact saved [progress events](primeclaw-59-representative-rehearsal-20261122.jsonl), SHA-256 `04f5f4619260efd4bf8836d95014005d91aa227446e8a89a5fd37a1eb57a5074`.
- Local evidence root: `.test-results/primeclaw59-pva-scale/`. `launch.json`
  records the run arguments; `single-run.log` SHA-256 `0bc2c23169e79d73000c086b4c459863ff1be06373785d7aff5e5a8dd3ebafe5`.
- `source-build.json` SHA-256 `4d54b897e55145fd1d5dea19f4f5a7ce4839cd00d72fd2df485e1d6286d7bd06`;
  `source-manifest.json` SHA-256 `3db4eb51b53f088df889349bdc913ec77652eef2ecf7ec5b8729bb47a86c8a45`
  identifies the Prime Agent source checkout, not final Prime Claw runtime
  provenance. The current two fixture files match both launch-record hashes;
  no claim is made about a missing final runtime manifest.
- Read-only source selector SHA-256 `892c87ebc2050d9849e1571bce2bbb4abe766efde87793c650fc1b3e1d7ac2f1`;
  Python 3.14. Both fixture syntax and exact pytest collection were checked
  before the run. Recorded fixture hashes:
  `432864b75bc53735708c9b485926154ef4b47d4f5f1038547eb496edfbb4794a` (`tests/task_provider_migration.test.mjs`),
  `8228997c09f585933265a8fbc7ca12203a2f972162820571dde6a43ffc99b36b` (`tests/test_pva_gate_scale_rehearsal.py`).

Recorded command shape (reproduction record only; not authority to rerun):

```sh
RUN_PVA_SCALE_REHEARSAL=1 TIER1_ENV_FILE=<verified-source-selector> \
  python3.14 -m pytest -s -q -m container tests/test_pva_gate_scale_rehearsal.py
```

The owner can assess the available evidence or authorize a separate bounded
diagnosis of the terminal-output and runtime-teardown gap. Do not retry an
uncertain migration or claim a live window from it. Any later live preflight
and exact confirmation belong separately to Initialize PVA.
