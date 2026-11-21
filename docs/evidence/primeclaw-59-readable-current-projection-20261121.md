# PRIMECLAW-59 — readable current-state authoring/readback dependency

Date: 2026-11-21. Disposable Docker validation passed for this dependency only.

## Bounded claim

This increment stages one Beads-to-Backlog current-ticket projection for native
Web authoring and complete native CLI readback. It uses the accepted migration-only
owned Web transport. It does not wire the helper into the forward importer or
replay, remove their encoded packages/chunks/archive verifier, add a worker,
change lifecycle/cutover, or prove cancellation/recovery/coexistence/406-ticket
performance. All nine task AC remain unchecked; no live migration is authorized.

The execute slice was split before implementation and recorded in native task
plan/notes at `d8a1bb331bc952adfd43a9ce61e48cf70a65dafa`, separately from code.
The accepted transport remains code `2cd57331b39a6c00bbbd18c5503cfda5a842ba07`.

## Implementation

- One pair-specific projection supplies actual native POST fields and expected
  CLI values. Standard equivalent fields are not repeated in raw source envelopes.
- Meaningful non-equivalent current values stay readable with field labels.
  Exact source formatting survives visibly when native Markdown normalization
  cannot preserve it directly. Deferral-only fields are dropped as already required.
- Actual authored comments retain source author/time in readable current content.
  A small initial source reference is not a substitute for full verification.
- Native configured type/priority choices are inputs, never overwritten settings.
- The authoring helper stops after any error, with no resend, fallback, cleanup,
  publication, or source retirement. The caller retains Web lifetime ownership.

## Native representation details

The pinned native Markdown parser reads each acceptance criterion from one
checkbox line. A multiline source criterion therefore uses a labeled readable
exact JSON string in that native criterion, not a lost multiline continuation.
Normalization-sensitive prose and comments likewise use one exact readable JSON
string. Escaping `<` in those strings prevents source comment delimiters from
being interpreted as native Markdown control markers. Normal prose stays normal
prose and is not repeated in export/native envelopes.

Configured numeric `P1` precedes the legacy high/medium/low mapping when that
choice exists. Unknown current per-field values are not discarded because their
names resemble old history packages. The helper ignores package-level capture
envelopes structurally. Only the accepted active deferral fields are dropped.

The helper preserves the accepted transport's payload-safe typed error, including
stage, uncertain outcome and private artifact location. Other arbitrary errors
are reported without their source/provider payload. Caller-held transport
ownership remains necessary; the helper does not stop an entire importer.

## Validation

- Required `scripts/test-tier1.sh --probe`: PASS. Manifest:
  `.test-results/20261121T032024Z-66175-6b0155e8/tier1/manifest.json`.
  Offline network absence, apply/check/RPC checks, clean runtime teardown and
  clean source-builder teardown verified. This probe used the final module bytes.
- Focused `python3.14 -m pytest tests/test_task_provider_migration.py -q -m
  container -k "beads_backlog_current_node_suite or migration_backlog_web_node_suite"`:
  **2 passed, 9 deselected in 168.38s**. Manifest:
  `.test-results/20261121T032045Z-67726-89ff4c5b/tier1/manifest.json`.
  Network absent; runtime and source-builder teardown clean. All manifest-listed
  artifact hashes were recomputed and matched.
- `beads-backlog-current-node.tap`: **18 checks passed** (10 top-level plus
  8 nested readback-mutation cases), in 11.705s. Four top-level cases use real
  native task creation/readback; the remaining cases cover projection and
  countable failure mechanics. This is not 18 separate migration runs.
- `migration-backlog-web-node.tap`: **9 shared transport checks passed**, in
  11.537s. These are a rerun of existing checks, not new migration acceptance.
- Host-safe `python3.14 -m pytest tests/test_task_provider_migration.py -q`:
  **2 passed, 9 skipped**. `git diff --check` passed.

The native current-content fixture carries **2,610,950 UTF-8 bytes** of meaningful
current metadata, with Unicode, complete text, padding and exact tail. The
production projection writes it once as labeled current data, not a raw source
view/package. Whole-value hash/length and full native CLI readback pass. Tests
also cover current description/plan/notes/AC, explicit assigned and unassigned
values against an active configured default, configured type/priority fallback,
numeric1→configuredP1 (configuration order P3/P1/P2 prevents a first-value false
pass), normal Done placement, close reason/time, parent/dependency relationships,
actual comments/source author/time and delimiter-sensitive exact strings.

Eight changed-field checks retain source references but fail full verification
for changed AC, assignee, current supplement, large-value tail, comment body,
comment author, parent and dependency. A separate real native PUT changes the
persisted AC; its complete CLI readback also fails verification. Controlled
create/comment/read failures prove no next call/resend. Accepted typed transport
errors retain stage/outcome/private artifact path; arbitrary errors stay bounded.
These controlled failures are not ordinary importer cancellation proof.

Tested new production module SHA-256: `f1e7821565098f638ff0b2822095d7242196c5549d9560f12b514fdd681448c1`.
New test suite SHA-256: `5b012b873283b3c53c376f0750d2eb61698d9135f7ca003be65e64fba8c74fae`.
Only documentation/evidence changes followed validation; no tested plugin bytes
were changed. The first implementation/test draft was repaired from read-only
review before native testing; no failing native result was suppressed or a
fixture safeguard bypassed.

## Remaining work and limits

Forward/replay still use their old encoded package/chunks/archive verifier.
The new helper is staged, not integrated into migration orchestration. Integrate
it and remove those paths without relocating archives, while retaining the small
mapping/existing receipt and separate memory treatment. Caller-supplied mapped
status/relationships and configured type/priority inputs remain integration work.
So do responsive-worker/process ownership, ordinary cancellation/progress,
coexistence/config reconciliation, interrupted-import recovery and 406-ticket
measurement. No whole-task AC is checked by this dependency.

No live migration/retry/provider switch, private incident-data access, destructive
live cleanup, merge, global apply/check/activation/restart, Prime Agent source
change, new Episode resource or assignment occurred. Source publication is not
live activation. Stop for owning Conversation review after separate code and
native task publication.
