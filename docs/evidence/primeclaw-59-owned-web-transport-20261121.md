# PRIMECLAW-59: owned native Web transport increment

Date: 2026-11-21. This is one sub-increment of the accepted readable-current-state
slice, not full-task acceptance or permission for a live migration.

## Changed behavior and limits

`extension-support/migration-backlog-web.ts` supplies an async, migration-only
native transport. It starts one shipped Backlog browser, captures only its own
loopback bind announcement (including native free-port fallback), and requires
`/api/status` to resolve the exact prepared project and Backlog directory before
exposing task writes. Explicit `BACKLOG_CWD` pins browser and CLI context.
Readiness is a resource identity check, not task lifecycle policy or a same-user
malicious-listener authentication claim.

Task POST/PUT input, HTTP output, browser logs and complete native CLI view use
private transport files (directory 0700, files 0600). No source field is put in
argv. Native envelopes remain unchanged; the future pair-specific projection
still must compare complete current content. Failures expose stage/outcome only,
retain private transport captures, fence writes and stop owned process groups.
A lost response/non-2xx may follow a write: no resend, CLI fallback, rollback or
provider cleanup occurs. Normal close removes ephemeral capture files; failures
retain them. TERM/KILL escalation is scoped to exact owned process groups and
waits for exit; transport cancellation does not prove full importer cancellation.

The forward importer does **not yet call this transport**. Its encoded packages,
chunk comments and archive verifier remain unfinished work. This increment does
not implement full readable migration, recovery/coexistence/config reconciliation,
the responsive migration worker, ordinary importer cancellation/progress, receipt
publication/cutover or 406-ticket performance. All nine task AC stay unchecked.

## Reproduce in isolated Docker

Use the disposable `TIER1_ENV_FILE` procedure and exact read-only Prime Agent
0.9.8 source/tag recorded in the prior source-capture evidence. The supported
source fixture independently builds/packages that upstream dependency; it does
not edit its checkout. `BUILDX_NO_DEFAULT_ATTESTATIONS=1` retains the previously
validated inspectable Buildx IID setup. No candidate host apply/check/probe,
live task-provider store, private incident data, migration, activation or restart
is used.

Commands:

- `scripts/test-tier1.sh --probe`
- `python3.14 -m pytest tests/test_task_provider_migration.py -q -m container -k migration_backlog_web_node_suite`
- `python3.14 -m pytest tests/test_task_provider_migration.py -q -m container -k "migration_backlog_web_transport or retiring_beads_source_boundary or native_populated_backlog_allocation"`
- `python3.14 -m pytest tests/test_task_provider_migration.py tests/test_inventory_integrity.py -q`

The third selector's first alternative did not match the new bridge's name; that
run selects only the two existing regression bridges. The new transport suite
runs separately through the exact second command. No test is counted twice.

## Saved results

- Initial required tier-1 probe passed: `.test-results/20261121T024412Z-17029-e1ee88a0/tier1/manifest.json`.
  This preceded the final ready-state/descriptor-ownership repairs. The subsequent
  native container fixtures apply/check their own final source snapshot as well.
- First transport run passed **8/8 native tests**, 1 pytest bridge passed / 9
  deselected: `.test-results/20261121T024745Z-31609-94f9077e/tier1/migration-backlog-web-node.tap`.
  Manifest reports network absent and both builder/runtime teardown clean.
- Final transport run: **9/9 native tests**, 1 pytest bridge passed / 9 deselected in 169.85 seconds: `.test-results/20261121T025131Z-46695-9f8744c2/tier1/migration-backlog-web-node.tap`. This adds explicit TERM-resistant owned-child SIGKILL escalation, verifies group absence and leaves an unrelated listener alive. Manifest confirms network absent and both builder/runtime teardown clean.
- Existing regressions: **23/23 source-boundary + 3/3 native allocation/lifecycle checks**; 2 pytest bridges passed / 8 deselected in 564.21 seconds. Artifacts: `.test-results/20261121T024635Z-26638-fc2e09be/tier1/retiring-beads-source-boundary-node.tap` and `native-populated-backlog-allocation-node.tap` in that directory. Manifest reports network absent and both builder/runtime teardown clean. These exercise the existing legacy forward path; their runtime is not a Web migration performance measurement.
- Host-safe static checks: **9 passed, 8 skipped** in 7.01 seconds. Container-only tests were correctly skipped by the host-safe invocation; they run separately above.

The native large-value test performs POST and PUT with complete 2,610,950-byte
readable UTF-8 descriptions, compares whole native HTTP and CLI values/envelopes,
AC, references and authored comment, and preserves the unrelated foreign store
byte-for-byte despite ambient foreign `BACKLOG_CWD`. It verifies private files,
normal owned group exit and released port. Native tests also cover occupied-port
fallback without contacting/killing its foreign owner, invalid executable,
pre-abort, HTTP rejection and wrong resolved root/prepared store before writes.
Controlled native-shaped executable tests cover exactly one possibly accepted
write with a lost response, no resend, retained accepted bytes, in-flight abort,
and a hung native status request bounded by the startup deadline. These fault
fixtures do not claim to prove cancellation inside real Backlog Git hooks or
full migration orchestration.

Read-only delegated audit found concrete pre-ready write and descriptor-cleanup
ownership gaps and a startup/status deadline mismatch; they were repaired before
the first 8-test native run. Delegated audits were not independent final candidate
acceptance and did not run host/plugin tests. Failed/uncertain live writes were
not used as fixtures. Later owner review controls acceptance and continuation.

Final distinct native checks: **35 passed** (9 transport + 23 source boundary + 3 allocation/lifecycle). The earlier 8-test transport run is not counted again. No failed runtime test was suppressed; the selector mismatch and added escalation test are recorded above.
