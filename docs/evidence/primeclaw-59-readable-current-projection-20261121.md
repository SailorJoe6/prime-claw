# PRIMECLAW-59 — readable current-state authoring/readback dependency

Date: 2026-11-21. Initial limited validation passed; owner review found a
material comment-heading defect. The bounded repair and red/green evidence below
remain a candidate for owner review, not dependency or full-task acceptance.

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

## Comment-heading material repair (2026-11-21)

Owner review did **not** accept the original `1494015` readable dependency.
Its original 27 passing checks above remain true but missed a valid source
comment with a `Final Summary` heading and no source summary. The accepted
source-capture and owned-Web partial dependencies remain unchanged.

### Cause and minimal change

The pinned native reader (`structured-sections.ts:269–272,782–790`) falls back
to a case-insensitive, unanchored legacy section heading when a real task section
is absent. A matching heading in an actual authored comment can therefore become
a spurious task Final Summary. Successful native writes do not certify the task:
the existing full verifier correctly rejects it as `native-readback-fields`.
No silent acceptance, source loss, cutover or uncertain HTTP write was observed.

The repair adds one predicate and its comment to `unsafeMarkdown`. A matching
`Final Summary` title is carried by the existing labeled exact JSON string
representation. The complete source body and heading remain readable and recover
exactly, with source author/time unchanged. An ordinary `Source heading` stays
ordinary prose. No Final Summary is fabricated, no field is dropped, and the
full verifier, native authoring, accepted transport and provider are unchanged.
No forward/replay/worker integration is included.

### Real-native old-code failure

Before changing production code, the same new tests ran against `1494015` /
module SHA-256 `f1e7821565098f638ff0b2822095d7242196c5549d9560f12b514fdd681448c1`.
Source `close_reason` and `finalSummary` keys are genuinely **absent from both**
export/native rows; the fixture's usual closure default cannot mask the defect.
The source body is this readable escaped string:
`"Work completed.\n\n## Final Summary\n\nPreserve this ordinary heading."`

- Command: `python3.14 -m pytest tests/test_task_provider_migration.py -q -m
  container -k beads_backlog_current_node_suite`.
- Expected red result: **1 failed, 10 deselected in 124.01s**.
  Native TAP: **19 passed, 1 failed** of 20 checks (12 top-level + 8 nested).
- The accepted heading case alone failed after one successful actual native
  POST, one successful PUT and complete CLI readback. Diagnostics prove source
  summary absent, expected null, and actual spurious comment suffix/closing markup.
  The author refused with `native-readback-fields`; no resend followed.
- The otherwise identical ordinary-heading control and all 18 prior checks
  passed, including the meaningful 2,610,950-byte metadata/current-state regression.
- Manifest: `.test-results/20261121T034700Z-74799-50285fb4/tier1/manifest.json`.
  Saved result: `beads-backlog-current-node.tap` in that directory. Network absent;
  runtime/source-builder teardown clean. All 15 listed artifact hashes verified.

The regression suite is unchanged between old and fixed runs. Its SHA-256 is
`8bb105fbc4ce8356ba11438f1be5de9a4b8b4529a1340d2dfdd424312e6536b1`.
It tests actual native creation/comment/read, null task summary, exact JSON-string
body recovery, source author/time, full field verification and no resend. The
control also asserts that ordinary prose does not switch to the exact-string form.
A bounded read-only helper found no issue in these tests and the minimal repair
approach. This was inspection, not owner acceptance or a test rerun.

### Fixed-code validation

- Required `scripts/test-tier1.sh --probe`: **PASS** on the fixed source.
  Manifest: `.test-results/20261121T034945Z-86586-cce06d04/tier1/manifest.json`.
  Offline apply/check/RPC probe and clean runtime/source-builder teardown passed.
- Focused `python3.14 -m pytest tests/test_task_provider_migration.py -q -m
  container -k "beads_backlog_current_node_suite or migration_backlog_web_node_suite"`:
  **2 passed, 9 deselected in 132.72s**.
  Manifest: `.test-results/20261121T034945Z-86505-363ae408/tier1/manifest.json`.
- `beads-backlog-current-node.tap`: **20 passed** (12 top-level + 8 nested),
  7.778s. Both new real-native heading cases passed. The affected comment uses
  exactly one recoverable JSON string; the control remains ordinary prose.
  Both complete native CLI reads show **null** task Final Summary.
- `migration-backlog-web-node.tap`: **9 passed**, 8.567s, unchanged shared checks.
  Total fixed-run checks: **29**, including only **two new native scenarios**;
  not 29 migrations or full-task acceptance.
- All **46** manifest-listed artifact hashes matched across red (15), fixed
  (16) and probe (15). Each run independently records network absence and clean
  runtime/source-builder teardown. Image:
  `sha256:8c29c92ba6edbf9fd75574795f06ab8b03e0e9a2f1e2a87b7f39d2205e01483d`.
- Fixed production module SHA-256:
  `4641ca767df102d6b5e46f9201512a11724a149f47a3f11d26bfc335dca0c9f2`.
  Test SHA-256 is identical to the red run above. Neither source nor test bytes
  changed after these runs; only documentation/evidence followed validation.
- Host-safe static bridge: **2 passed, 9 skipped**. `git diff --check` passed.

The meaningful 2,610,950-byte metadata/Unicode/padding/tail-once checks, all prior
current fields/AC/assignee/configured priority/type/relationships/source identity,
exact comments/author/time, strict mutation refusal and no-resend checks passed.
No source capture, transport, forward/replay importer, verifier, provider or
worker behavior was changed. The complete importer/cancellation/recovery/
coexistence/config/progress/406-ticket suites were **not** rerun or accepted.
This repair is a tested candidate for owner review, not owner acceptance or
permission to advance integration. All nine AC remain unchecked.

## Remaining work and limits

Forward/replay still use their old encoded package/chunks/archive verifier.
The new helper is staged, not integrated into migration orchestration. After
owner acceptance and continuation, integrate it and remove those paths without
relocating archives, while retaining the small
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
