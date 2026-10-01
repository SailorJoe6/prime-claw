# Phase 3a Slice 4A — optional home-Qwen embedding override

**Status:** BLOCKED — 4A.1 complete; fresh post-clearance host probe returned HTTP 502; no sandbox probe or restart
**Decision:** D3a-L
**Requirements:** R3a-12, R3a-14
**Evidence:** [`docs/evidence/embedding-preflight-20260916T191526Z.json`](../evidence/embedding-preflight-20260916T191526Z.json)
**Interrupted-build evidence:** [`docs/evidence/embedding-build-interrupted-20260916T234215Z.json`](../evidence/embedding-build-interrupted-20260916T234215Z.json)
**Failed-resume evidence:** [`docs/evidence/embedding-build-service-unavailable-20260918T045000Z.json`](../evidence/embedding-build-service-unavailable-20260918T045000Z.json)

## Requirement revision (2026-09-17)

This Qwen/4096 path is now an explicit operator-local override, not the repository default.
D3a-M/R3a-15 require fresh installs with no preferred config to use Zendesk AI Gateway
`text-embedding-3-large`/1536 embeddings and Kimi K3 inference. This verdict continues to
track Joe's selected local profile and its non-destructive safety contract.

## 4A.1 result — configuration and policy preflight

The runtime now accepts the private embedding base URL only through the ignored operator-local
config overlay or `PRIME_CLAW_EMBEDDING_BASE_URL`. Tracked defaults lock the remaining contract
to `Qwen3-Embedding-8B`, native 4096 dimensions, a 1000-second timeout, literal non-secret
`dummy`, and a candidate database distinct from the legacy database.

`bin/prime-claw embedding-preflight` validates that contract and atomically renders a mode-0600,
Git-ignored candidate policy. Output is sanitized. The candidate policy grants the configured
host/port only to gbrain/Bun and removes those binaries from the corporate AI-gateway route.
The tracked pre-cutover policy is not applied or changed into the candidate, so existing
`converge` behavior remains safe for the canonical 1536 index.

## Acceptance evidence

- Focused offline tests: **14 passed**; full offline suite: **126 passed**.
- Real operator-local preflight: **PASS**; endpoint and host absent from output/evidence.
- Rendered policy: ignored, mode 0600, configured endpoint match, exact two-binary scope.
- Read-only post-preflight database snapshot: 1,059 pages; 3,031 chunks; 3,031 embeddings;
  minimum/maximum vector dimensions both 1536.
- Candidate `gbrain_qwen4096` database count: **0**.
- No network, OpenShell, sandbox, or database call occurs in the preflight implementation.

The two extra pages/chunks above the original Slice 2 count are the existing validation probes;
this objective created no page and performed no write.

## Next

4A.2 must create a separate candidate `GBRAIN_HOME` and Postgres database, export
`GBRAIN_AI_EMBED_TIMEOUT_MS=1000000` (and the query timeout), full-sync with the exact model ID,
gate parity/dimensions/freshness/retrieval/corporate non-use, and only then switch the canonical
config and policy atomically. The legacy database remains untouched for rollback.
## 4A.2a interrupted build — external hardware blocker recovered

The isolated candidate build was started from implementation commit `e92abf4`. The operator
reported that the DGX Spark hosting the embedding model crashed and stopped serving. The build
was stopped rather than waiting on the 1,000-second request timeout. No gbrain process remains.

Preserved candidate state is partial and **not accepted**: 350 `brain` pages, 1,140 chunks,
1,140 embeddings, all currently 4096-dimensional in a `vector(4096)` column, no unsupported
HNSW index, and no source bookmark. The missing bookmark correctly prevents the partial import
from passing the build gate.

The tracked historical policy was restored. A separate read-only fingerprint confirmed the
canonical config, schema, page/chunk/vector/model state, source bookmark, embedding config, and
migration version are unchanged. No canonical cutover occurred and the legacy database remains
intact.

**Recovery update (2026-09-17):** the operator confirms the DGX Spark is alive and ready.
No build has restarted. First rerun the operator-local compatibility/preflight probe for the
exact `Qwen3-Embedding-8B` service; if it passes, resume with
`bin/prime-claw embedding-build`. The isolated candidate database is intentionally preserved
for a safe full-sync resume. Do not drop or mutate the legacy database.

Sanitized machine evidence: [`embedding-build-interrupted-20260916T234215Z.json`](../evidence/embedding-build-interrupted-20260916T234215Z.json).


## 4A.2a resumed build — blocked again by external service

On 2026-09-18 the exact compatibility gate initially passed: an omitted `dimensions` request
returned 4096 values, and explicit 4096/1536 requests returned HTTP 400 as required. Both
sanitized configuration preflights and 35 focused offline tests passed. One isolated build was
resumed from the preserved candidate.

The service then failed during sustained work. The resumed run imported 89 more files before
recording 39 embedding errors and reaching the 12,000-second hard deadline. A fresh host-side
exact-model probe after the safe stop returned HTTP 503. The hard deadline sent SIGTERM, the
command restored the canonical gateway policy, and no gbrain process remained.

The candidate is still partial and unaccepted: 439 pages and 1,459 chunks/embeddings, all current
4096-dimensional rows with zero detected stale/null/mixed vectors, but no source bookmark. The
canonical database/config remain at 1,059 pages, 3,031 1536-dimensional chunks, the original
source bookmark, and `openai:text-embedding-3-large`; no cutover occurred.

The run also exposed a watchdog contract gap: `GBRAIN_SYNC_STALL_ABORT_SECONDS=1200` does not
interrupt upstream gbrain's `--full` `import.files` path. Only the 12,000-second hard deadline
bounded this run. Before another live resume, correct that fail-fast gap and require both host and
in-sandbox exact-model probes to return 200/4096. The external unblock condition is a stable exact
Qwen service. Sanitized evidence is linked above; the private endpoint is absent.


## External service recovery and safe resume gate

The operator traced the external failure to the DGX Spark thermal-control path. Sustained work
correctly crossed the 80°C admission threshold. The first graceful sleep timed out under active
requests; after cooling to about 60°C, containment remained latched as designed, but its retry
passed current healthy state instead of the latched sleep action. After that fix, the slower
resource snapshot retained `thermal_admission_denied` for up to 180 seconds. All immediate probes
inside that window returned `thermal_cooldown`/HTTP 503; a delayed probe returned HTTP 200 with
4096 values.

The external blocker is cleared. Before one live resume, prime-claw is adding its own durable
candidate-DB progress watchdog around upstream `gbrain sync --full`, because the upstream stall
knob does not interrupt `import.files`. Acceptance and cutover remain pending.


## Candidate full-sync watchdog — validated

The operator gave the restart cue after hardening the embedding service. Before any live probe or
resume, prime-claw closed the upstream `import.files` fail-fast gap. Candidate sync now runs in a
`setsid` process group. A candidate-only database watermark tracks page count, chunk count,
non-null embeddings, and `max(embedded_at)` with bounded PostgreSQL calls. A stall sends TERM to
the complete group, checks complete-group liveness, escalates to KILL, and records a parent-visible
sentinel so a leader that exits 0 on TERM still yields exit 124. HUP/INT/TERM also reap the group.

Executable regressions cover a TERM-ignoring descendant, false-success prevention, timer reset on
durable progress, normal completion, and parent-signal cleanup. The focused suite passed 24 tests;
the canonical suite passed 231. Independent review found no remaining high/medium issue. Evidence:
[`embedding-watchdog-20260918T135055Z.json`](../evidence/embedding-watchdog-20260918T135055Z.json).
No live probe, build, acceptance, or cutover was performed by this validation step.


## Safe-resume preflight — pass

After watchdog commit `5891bfe` was pushed, both the host and in-sandbox exact-model probes returned
HTTP 200 with exactly 4096 values while omitting `dimensions`. The ignored candidate policy was
applied only for the sandbox probe and the canonical gateway policy was restored. The final
read-only gate found zero gbrain processes, canonical state unchanged at 1,059 pages / 3,031
1536-dimensional chunks, and the candidate preserved at 439 pages / 1,459 valid 4096-dimensional
chunks without a bookmark. Evidence:
[`embedding-resume-preflight-20260918T135418Z.json`](../evidence/embedding-resume-preflight-20260918T135418Z.json).


## Thermal recovery cycle — operator-stopped safely

The safe-resume probes passed and one isolated build advanced the candidate to 952 pages / 2,863
valid 4096-dimensional chunks. The operator then reported the DGX engine transition remained in
thermal containment rather than reaching a clean recovery. Prime-claw immediately terminated the
candidate sync group and sent no further inference probes. Buffered output revealed one
`upstream_unavailable` failure and gbrain internal retry waits of approximately 71 and 47 seconds;
the prime-claw durable-progress watchdog did not fire.

The build exited 143. Canonical policy/config/database are restored unchanged, zero gbrain
processes remain, the heartbeat is cancelled, and no cutover occurred. Do not probe or restart
until explicit operator clearance. Evidence:
[`embedding-build-thermal-recovery-paused-20260918T141240Z.json`](../evidence/embedding-build-thermal-recovery-paused-20260918T141240Z.json).


## Operator clearance after thermal recovery

Joe explicitly confirmed the DGX service is ready again. No inference traffic occurred while the
slice was blocked. Resume remains gated on fresh bounded host and in-sandbox exact-model 200/4096
probes, canonical policy restoration, and zero preexisting sync processes. Only one isolated build
may resume from the preserved 952-page / 2,863-chunk candidate.


## Post-clearance resume preflight — HTTP 502

After the operator reported the service ready again, the required single bounded host exact-model
probe returned HTTP 502 with zero values. Prime-claw did not retry, did not apply candidate policy,
did not run the sandbox probe, and did not start another build. Both databases remain preserved
and no cutover occurred. Evidence:
[`embedding-resume-preflight-http502-20260918T152548Z.json`](../evidence/embedding-resume-preflight-http502-20260918T152548Z.json).

## 2026-09-25 Slice 1 source-transport checkpoint — still blocked

The later, validated two-file frontmatter repair is local sandbox brain commit
`5dde0012eadf1df7c3e9c83d228e2d0d31f36695`; the local `origin/main`
tracking ref is older and **not a remote receipt**. A fresh bounded sandbox
`git ls-remote` failed with a connection reset. In-sandbox GitHub and the
normally allowed `example.com` canary all returned curl exit 56 / HTTP 000,
while host GitHub HTTPS returned 200 and `zetup vpn status` reported
`not-connected`. This strongly suggests an authorized egress/VPN fault but
does not by itself prove the sole cause. No push, Qwen probe or build, database
mutation, credential access, or credential-boundary change occurred. See
[`phase3a-slice1-transport-20260925.json`](../evidence/phase3a-slice1-transport-20260925.json).

The clone stage has a fail-closed offline repair under test: a failed fetch
must no longer be hidden by `tail`, and local divergence must stop without an
`ff skipped` success or unsafe retry. This is **not** Slice 1 completion. The
operator restored the authorized VPN connection, but a fresh sandbox Git
probe still reset and the allowed canary still returned curl 56 / HTTP 000.
Gateway control plane reports healthy, policy effective, and the OpenShell
service running. Do not assume reconnection alone repaired the sandbox data
path. The owner/operator must arrange safe host/OpenShell egress repair that
preserves both databases and the credential boundary; no sandbox restart,
provider update, or policy change was attempted. Then recheck sandbox egress
and actual remote HEAD, reconcile the local source commit without force,
revalidate both repaired files, and verify the remote receipt before any
candidate build. Do not infer Git or embedding health
from this older snapshot.

A later owner-approved read-only P0 investigation narrowed allowed-canary failure
to `NET:OPEN ALLOWED` then `NET:FAIL` in about 198 ms, with no recorded
`HTTP:GET`; gateway logs lack a per-request reset reason. An overlapping
socket sample saw one brief outbound TCP/443 connection, but cannot attribute
the reset. Noninteractive host packet capture is unavailable and the sandbox
has no packet/trace tooling. Do not guess at a proxy or VPN fix: obtain an
approved metadata-only packet capture or per-request proxy trace first, with
explicit preservation of the unpublished local brain Git repair if any
instrumentation is destructive. See
[`phase3a-slice1-proxy-diagnostic-20260925.json`](../evidence/phase3a-slice1-proxy-diagnostic-20260925.json).

A 2026-09-27 documentation-first check reconstructed the first proven private
brain Git path (`docs/derisk/3a-slice1.md`) and compared it with the effective
OpenShell Git/canary rules. Those rules are present, but a fresh credential-free
sandbox canary still reset after `NET:OPEN ALLOWED` while the host returned 200.
Git-only placeholder or URL setup cannot explain that shared failure; the
upstream reset source remains unknown. See
[`phase3a-slice1-context-investigation-20260927.json`](../evidence/phase3a-slice1-context-investigation-20260927.json).
No brain-source remote receipt exists; do not begin Qwen work.

On 2026-09-27, a VPN-off sandbox remote read and fetch succeeded, but the
local two-file repair and 16 newer remote commits have one overlapping page.
A nonmutating merge preview reported a content conflict. The repair remains
local; no source push or receipt occurred. See the sanitized
[`phase3a-slice1-brain-git-conflict-20260927.json`](../evidence/phase3a-slice1-brain-git-conflict-20260927.json)
and the execution plan's historical owner-review stop checkpoint. This does not
explain the historical allowed Git/L7 reset.

## 2026-09-28 Slice 1 personal brain source-publication candidate

Joe accepted the reviewed, lossless Page A remote / Page B local resolution.
The original sandbox repair remains available under its durable Git ref.
The published descendant `5c47c067e93eb633da8a8dcb28221e23eea7685b`
changes only Page B from the reviewed remote tip; Page A and all other remote
paths stay intact. Both page frontmatters passed the source validator, the
clone was clean, one non-force push succeeded, and an independent remote
read returned this exact SHA. See
[`phase3a-slice1-source-publication-20260928.json`](../evidence/phase3a-slice1-source-publication-20260928.json).
This later receipt supersedes the earlier *pending publication* status above,
not its transport/conflict evidence. The historical Git/L7 reset cause remains
unknown. At this candidate checkpoint, Slice 1 still required independent
owner acceptance before Qwen or Slice 2; no database, embedding, or
routed-write acceptance was claimed.

## 2026-09-28 owner acceptance of Slice 1 source publication

This owner independently verified live brain remote `5c47c067e93eb633da8a8dcb28221e23eea7685b`
and clean pushed project candidate `7265229207706a954e4c2d4c1489129ff0d9b3ec`, including
the approved one-page-only descendant, preserved original repair, and both
native frontmatter checks. A fresh exact-commit EXPERT returned PASS with no
material findings; its complete report is
[`phase3a-slice1-source-publication-expert-pass-7265229-20260928.md`](../evidence/phase3a-slice1-source-publication-expert-pass-7265229-20260928.md)
(pushed report-only checkpoint `ca5c1ca7f6f56edb0eb50317668bba83ec705c5b`).
**Slice 1 safe brain-source publication is accepted on those exact identities.**
No Qwen/4096d index, database cutover, routed write, historical reset cause,
or terminal EPISODE completion is accepted. Slice 2 remains conditional on
its approved private-service clearance and bounded preflight gates.

## 2026-09-28 Slice 2 exact-model preflight — stopped on source movement

After Joe confirmed the private service ready, one host and then one isolated
sandbox `Qwen3-Embedding-8B` request each returned HTTP 200 with 4096 values.
The temporary candidate policy was restored to the exact canonical gateway
policy, and neither index changed. A read-only full-source dry run counted
1,117 eligible files. The ordinary index path's old second-pass
`--skip-failed`/masked-exit behavior was removed in the project candidate and
exercised by offline failure-gate tests; the candidate script now gates
source/page/path coverage and zero unresolved failures before success.

Before live build, remote brain `main` moved from the accepted Slice 1 receipt
`5c47c067e93eb633da8a8dcb28221e23eea7685b` to
`b695658b8271f4541e47b87f62c5b14c19075528` while the sandbox clone
remained clean on the older SHA. This is an exact source-current stop, not a
Qwen failure or a reason to infer the historical Git/L7 reset cause. No
fetch/merge or candidate build was attempted, no canonical/candidate database
was changed, and no cutover or routed write occurred. See
[`phase3a-slice2-preflight-20260928.json`](../evidence/phase3a-slice2-preflight-20260928.json)
and
[`phase3a-slice2-source-movement-20260928.json`](../evidence/phase3a-slice2-source-movement-20260928.json).
Owner-coordinated lossless source reconciliation and fresh gates are required
before one preserved isolated build.

## 2026-09-28 inspection fetch — unexpected origin tracking advance

One owner-authorized source-history inspection passed fresh exact live remote,
clean checkout, preserved original repair ref, no-sync and unchanged policy/DB
gates. A single Git fetch obtained the exact moved commit in an isolated
`refs/inspection/` ref, but Git also advanced `origin/main` to that commit
under the existing wildcard remote fetch mapping. That violated the
no-tracking-update limit. The checked-out HEAD remained clean at the accepted
Slice 1 commit and local `main`/original repair ref remained intact. The
inspection stopped before ancestry, tree/mode/path and source validation. No
ref restoration, source merge/push, candidate build, cutover or routed write
followed. See the sanitized
[`phase3a-slice2-inspection-fetch-boundary-20260928.json`](../evidence/phase3a-slice2-inspection-fetch-boundary-20260928.json).
Further read-only assessment or ref-state repair requires a separate owner
decision; the historical Git/L7 reset cause is still unknown.

## 2026-09-28 native source validation — blocked safely

The owner approved validation only of the already-fetched b695 source. Fresh
remote, ref, clean-checkout, no-sync, policy and both DB gates passed. A
separate scratch view extracted the exact Git archive without symlinks. All
1,211 extracted file contents matched the archive. Native `gbrain 0.50.0.0
frontmatter validate --json` scanned 1,189 Markdown files and failed with
20 errors on 20 files (18 `MISSING_OPEN`, one `MISSING_CLOSE`, one `YAML_PARSE`).
The raw report is retained only in sandbox scratch; the
[sanitized receipt](../evidence/phase3a-slice2-native-source-validation-b695658b-20260928.json)
records aggregate results and file hashes, not private paths/content. No lint,
repair, source reconciliation, candidate build, cutover or routed write followed.
The active checkout/refs, remote, policy and both databases stayed unchanged.
Further repair/reconciliation needs a separate owner decision.

## 2026-09-29 private-safe frontmatter triage — no build authority

The [sanitized triage receipt](../evidence/phase3a-slice2-frontmatter-triage-b695658b-20260929.json)
records independent native no-fix scans of isolated accepted 5c47 and b695
archives. All 20 b695 errors match accepted by private relative path and error
code and lie on unchanged files. Accepted scan covered 1,117 Markdown files;
b695 covered 1,189. This does not mean the source is valid: both scans exit 1.
The prior no-write dry run only tested the registered accepted checkout, not the
isolated b695 source; full-source index eligibility is unknown and no dry run
was attempted. No raw private paths or content were published. Remote, refs,
clean checkout, policy, both DB snapshots and no-sync gates remained unchanged.
Joe must separately decide any repair/reconciliation before candidate work.

## 2026-09-29 exact-20 repair candidate stopped before edits

The [sanitized ambiguity receipt](../evidence/phase3a-slice2-repair-candidate-ambiguity-b695658b-20260929.json)
records a native no-fix scratch-copy probe: an empty YAML header fails with
`EMPTY_FRONTMATTER`; a first-H1-derived title passes syntax on one copy but
does not prove intended metadata for 18 missing-header pages. One unterminated
header includes a heading, and another invalid YAML header has unclassified
content lines. Changing delimiters or metadata without a deterministic
body/ID-preserving rule risks changing meaning. The exact remote, refs,
clean active checkout, no-sync state, policy and both DB snapshots remained
unchanged. No candidate, brain edit, index or build occurred. Joe must decide
a private-safe metadata/syntax rule or authorize in-sandbox review before
any new candidate attempt; independent EXPERT and owner acceptance still gate
later source publication.

## 2026-09-29 private proof-first review: no safe candidate

The [sanitized private review receipt](../evidence/phase3a-slice2-private-proof-review-b695658b-20260929.json)
shows that none of the 18 pages missing an opening header has an explicit
leading title/ID value. The first H1 is not a universal title convention, and
two pages have multiple H1s. The missing-close page has no metadata before
its heading; the YAML parse failure has three lines whose status as metadata
or body cannot be determined safely. The sandbox returned only aggregate
results. All remote/ref/checkout/no-sync/policy/database gates passed before
and after. No brain file was edited and no candidate was created. Joe must
privately settle the exact value and body-boundary choices or authorize a
separate scope change. Full-source native validation and candidate tests did
not run because a safe candidate does not exist.

## 2026-09-29 work-gbrain match and Joe's frontmatter-only correction

The [sanitized read-only local work-gbrain get-page receipt](../evidence/phase3a-slice2-local-work-gbrain-get-page-20260929.json)
records exact non-fuzzy `get` success for all 20 pages. On 19 pages every sampled
source seven-word window appears in the returned page; the short missing-close
page has 109/114 overlapping windows and a matching H1. All 20 returned pages
have `type` and `title` frontmatter, no explicit `id`. Nineteen saved titles
match the first H1; the remaining YAML_PARSE page's saved title differs from
an explicit malformed-source title line. The local database demonstrates page
presence and supplies candidate header values, not Git-source validity.

Joe clarified that the repair is simply to add gbrain-compliant frontmatter
to the exact 20 Markdown files. The next isolated candidate may prefix the
matched work-gbrain `type`/`title`, preserving every original Markdown byte as
the new file's suffix; paths remain unchanged and no ID is invented. For the
YAML title conflict, the owner-selected candidate tactic uses the matched
gbrain title in the new header and leaves the old source line untouched below
it; a material page-identity change still stops publication. This **changes the prior intent-proof
contract for candidate preparation**, not the requirements for exact-20-only
diff, native full-source zero-error validation, no-write checks, independent
EXPERT/owner acceptance, or later non-force remote publication. No candidate,
brain source edit, index, build, cutover, or routed write exists yet. Stop if
the prefix-only rule fails validation or identity/preservation proof; do not
silently expand into content editing or skipping errors.

## 2026-09-29 exact-b695 prefix candidate for independent review

The [sanitized candidate receipt](../evidence/phase3a-slice2-b695-frontmatter-prefix-candidate-20260929.json)
identifies a local, unpushed brain Git review ref and exact commit. Only 20
originally invalid Markdown pages changed, each by a metadata-only prefix.
Original bytes remain exact suffixes, path/mode and accepted Slice 1 repair
blobs are preserved. Native validation scanned all 1,189 Markdown pages with
zero frontmatter errors; focused offline no-write tests passed (63 tests).
This does not prove historical title intent for the YAML-parse page, whose
matched brain title differs from its malformed source text. The candidate
is neither published nor accepted. Fresh independent EXPERT and owner review
are required before a separate gated brain publication, index/build, or
cutover. No full maintained-suite pass is claimed.

## 2026-09-29 independent EXPERT BLOCK on exact candidate

The fresh [EXPERT BLOCK report](../evidence/phase3a-slice2-frontmatter-expert-block-d875c81-20260929.md)
(SHA-256 `1d8c70dd29c05274870bbf24d8585effdaa9c1355e3cde9218afd660e1dd4e41`),
[structured evidence](../evidence/phase3a-slice2-frontmatter-expert-block-d875c81-20260929.json)
(SHA-256 `fde0f12c6d978de82a5466c21a474bf29bacb60e2cf603861a9b965f05498768`),
and [focused test log display copy](../evidence/phase3a-slice2-frontmatter-expert-block-focused-tests-d875c81-20260929.txt)
(SHA-256 `05b7849bb765db0c6390151dd3d432795a83f379ee130c63c905ebb85a53bc0a`)
are tracked. The report and structured evidence are byte-exact copies; the
reviewer-owned raw log SHA-256 remains `6b894a3bda2ffdc20335b1c15ccecfdd12b0df06c4d21cdd0b8fa7638f5539a7`.
The display copy only trims four trailing-whitespace lines for repository
`git diff --check`. The reviewer independently confirmed exact-20-only
byte-preserved headers, native zero-error full-source validation, and unpushed
source. These syntax/content checks are not candidate acceptance.

**B1:** The YAML_PARSE page's original malformed header has explicit simple
title **and type** values. Both differ materially from the new header, whose
values resemble parser defaults. A content-matched gbrain page does not prove
metadata intent; the identical copy in another source group adds provenance
ambiguity. Joe must choose the exact two-field precedence: preserve the Git
values in the new header (EXPERT recommendation) or knowingly prefer the
work-gbrain values and accept changed title/type semantics. The old Markdown
bytes remain unchanged under either option. No decision is inferred.

**B2:** The reviewer reran the required focused no-write selection and got
62 passed, one watchdog-stall pytest timeout, and three warnings, despite the
episode's prior 63-pass run. An isolated pytest run timed out; direct function
invocation passed. Root cause is unproven. Bounded read-only diagnosis may
separate platform/harness behavior from code; a code fix or waiver is not
within this frontmatter-only repair grant. Never skip the test, increase its
timeout to hide failure, or rerun until green.

The candidate remains local/unpushed and unaccepted; source-current Slice 2
remains blocked. No brain publication, Qwen retry, index, build, cutover or
routed write. Fresh EXPERT and owner review are required after any material
repair, plus the independent test gate before publication.

## 2026-09-29 Joe chose A for the YAML_PARSE header pair

Joe answered **“a”** to the explicit two-option EXPERT B1 question. The
owner accepts **A**: a new valid prefix for the single YAML_PARSE file must
use the explicit Git **title and type** already in that file's malformed
header, not the conflicting work-gbrain fallback-looking values. The prior
Markdown, including its old malformed header, remains byte-exact as the
suffix. The other 19 frontmatter headers retain the previously reviewed
matched gbrain metadata. This resolves the product-metadata choice only.

The former `1c97c409f005366aca132f5ff68c1a8c23483cc3` candidate remains
unpushed and unaccepted. The owner permits only an isolated local exact-20
revision and bounded read-only B2 watchdog diagnosis within the approved
frontmatter/test-gate scope. The independently observed focused pytest
timeout is still a blocker; no code repair, skip, timeout inflation, source
publication, index/build, cutover or routed write is authorized by A.
New validation, reproducible focused tests, fresh EXPERT PASS, and owner
acceptance must precede any separate non-force publication decision.

## 2026-09-29 A revision blocked by independent B2 reproduction

The [sanitized no-write watchdog receipt](../evidence/phase3a-slice2-a-revision-b2-watchdog-block-20260929.json)
records one isolated pytest run that timed out after the test's unchanged
15-second subprocess bound. A process-tree snapshot confirmed an isolated
worker group and descendants while the test ran. It did not establish
whether the worker signal or captured-pipe cleanup failed. The prior EXPERT
reported the same timeout in its focused selection and isolated run. This
pass stopped without a new source candidate, code/test edits, brain push,
index/build, or cutover. Joe's A metadata decision remains approved for a
later separately gated candidate pass. Do not treat an earlier 63-pass run
as a reproducibly green B2 gate.

## 2026-09-29 owner one-off no-write B2 discriminator

The [sanitized diagnostic receipt](../evidence/phase3a-slice2-b2-shell-wait-discriminator-20260929.json)
SHA-256 `327eed27b7511acae39f41f6c08c7c523be1c34ce4874a716af6ed36309ebd7f` records a synthetic, temporary
pytest probe of the current generated watchdog fragment with the same isolated
worker semantics. It did **not** rerun or pass the required focused test.
`Popen.wait(timeout=15)` timed out while both the outer shell and its distinct
isolated worker group remained alive. A post-exit captured-pipe check could
not run because the shell was still live. This rules out a pipe-only hang
after shell exit for that run, but does **not** prove why the watchdog's
signal/worker teardown failed. Root cause remains UNKNOWN.

Post-run project HEAD/upstream/remote stayed clean at
`0185491e46ae0ef3d53d93a4591e8c7d44596f70`; brain remote/main stayed
`b695658b8271f4541e47b87f62c5b14c19075528`, accepted checkout and
original unaccepted local candidate unchanged. No code/test timeout or
assertion change, source publication, database/policy mutation, index/build,
cutover or routed write occurred. The required B2 gate remains red and
Joe's approved A metadata rule remains pending a *new* source candidate.

## 2026-09-29 Joe authorized narrow B2 safety-gate repair

Joe approved moving Phase 3a forward after the owner explained the required
offline watchdog stall test and asked to broaden the former frontmatter-only
scope for a **bounded root-cause diagnosis and minimal code/test-harness
repair**. The approval does not waive the test, raise its timeout, weaken
assertions, permit retries until green, or authorize a brain source push,
index/build, cutover or routed write. The exact cause remains UNKNOWN:
prior synthetic probes found the outer shell and isolated worker group live
at the unchanged 15-second limit, while a separate primitive-only Bash
negative-PGID TERM signal succeeded. Those results narrow hypotheses but
are not a required-test pass.

Next, prove the watchdog teardown fault through one bounded offline
instrumented diagnostic; repair only the evidenced lifecycle seam, retain
full stalled-worker and descendant-cleanup assertions, then rerun the
required focused no-write selection without skips. A fresh independent
EXPERT and owner review are needed on the project repair. Only after B2 is
reproducibly green may the exact-20 Joe-A brain frontmatter candidate be
prepared locally and separately reviewed. The old `1c97c409f005366aca132f5ff68c1a8c23483cc3`
source candidate remains unaccepted and unpushed; remote main remains
`b695658b8271f4541e47b87f62c5b14c19075528`.

## 2026-09-30 B2 diagnostic: root cause still unknown

The [sanitized bounded diagnostic receipt](../evidence/phase3a-slice2-b2-watchdog-diagnostic-inconclusive-20260930.json)
records one independent read-only hypothesis and the test observations.
Corrected private traces of two passing isolated pytest runs show TERM/KILL
signals reaching the isolated worker group and a subsequent absence check.
They do not explain the previously reproduced 15-second timeout; a later
unmodified single pass does not make the required three-module suite
reproducibly green. A probe-only Bash 3.2 instrumentation mistake was
excluded from the B2 inference. No runtime or test-harness code was changed.
A further bounded diagnostic must capture an actual failing worker and
inherited pipe state before any repair. The approved A metadata decision
remains pending behind this gate; no new brain candidate was created.

## 2026-09-30 read-only newer brain source inspection after B2 stop

After the inconclusive B2 episode stopped, the live brain remote moved from
`b695658b8271f4541e47b87f62c5b14c19075528` to direct child
`eb157c713b24bb0ec9315ae27617b16da5cbf71b`. An explicit object-only
fetch used an empty refmap, no `FETCH_HEAD` write, and no tags; checkout,
tracking ref, original unaccepted candidate, project refs, and sandbox clone
remained unchanged/clean. The new remote commit adds 13 paths and modifies 69;
none of the exact 20 error targets or accepted Slice 1 blobs changed. It has
one unrelated new blank EOF line (`git diff --check` exit 2), which the
exact-20 repair must not silently rewrite. Isolated native full-source
validation of exact `eb157` scanned 1,202 Markdown files and still found the
same 20 frontmatter errors (18 MISSING_OPEN, one MISSING_CLOSE, one YAML_PARSE).
The [sanitized owner inspection](../evidence/phase3a-slice2-source-advance-eb157-owner-inspection-20260930.json)
SHA-256 `c893f98cb121857c5c51580e864203bcc8307fa0c67ace9abf090bdc34dbb52a`
reconciles source movement structurally **only**. B2 cause/unchanged focused
test gate remain blocked; there is no new candidate, source publication,
source-current acceptance, index/build, cutover, or routed write. The next
bounded diagnostic must observe an *actually failing* test's process group
and captured pipe endpoints before any watchdog edit. A later local A
candidate must preserve the newer source after fresh exact gates and review.

## 2026-09-30 bounded B2 process/pipe observation

The [sanitized observation](../evidence/phase3a-slice2-b2-required-pytest-pipe-observation-20260930.json)
records one unchanged watchdog pytest monitored externally by `ps` and `lsof`.
It passed in 2.17 seconds. A TERM-ignoring descendant briefly remained in
the isolated group after its worker leader exited, holding inherited stdout
and stderr pipe writers, but group cleanup completed before pytest returned.
That passing timeline does not diagnose the earlier required-test and EXPERT
15-second timeouts. No watchdog or test code changed, and no new source
candidate was created. Further repair needs a causal capture from a failing
run; the required three-module no-write gate remains blocked.

## 2026-09-30 required three-module external observation

The [sanitized one-run receipt](../evidence/phase3a-slice2-b2-full-focused-external-observation-20260930.json)
records one unchanged no-write focused selection under an external `ps`/`lsof`
observer. It passed once: 63 passed, three warnings in 9.86 seconds. The
watchdog worker's brief orphaned descendant and inherited pipe writers
cleared in this passing run. The earlier independent EXPERT test timeout
remains unexplained; one pass is not a reproducibly green required gate. An
accidental unscoped final observer sample was discarded locally and not
published. No code, test, brain source or database was changed. Stop pending
owner direction for any further failure-time diagnosis.

## 2026-09-30 B2 failure capture and bounded readiness repair

The first of Joe's approved six unchanged diagnostic selections reproduced the
original 15-second watchdog `TimeoutExpired`; the campaign stopped without a
second diagnostic run. An [external PID/PGID and pipe receipt](../evidence/phase3a-slice2-b2-setsid-startup-race-20260930.json)
shows the `setsid` Python shim was still in the parent's group when the stall
watcher exited, and formed its own group only afterward. Its direct Bash
parent stayed blocked, with worker and descendant retaining captured pipe
writers, until the original test timeout. The receipt reports the cause without
publishing private raw process samples.

A first direct-PID fallback failed the unchanged safety tests and was discarded.
The bounded runtime repair waits for the isolated group to exist before starting
the no-progress clock; an early signal or launch-readiness failure cleans the
worker and fails closed. A new delayed-`setsid` regression passed along with the
unchanged original watchdog and signal tests (3/3). Two separate original
three-module no-write focused selections passed after the repair (64 tests,
three warnings each, 13.30 and 13.67 seconds), using separate scratch basetemps.
The original 15-second bound, assertions and selection remain intact. These are
local repair checks, not independent EXPERT or owner acceptance. Brain remote,
accepted checkout, policy and both DB snapshots stayed unchanged. No new brain
candidate, source push, Qwen retry, indexing, build, cutover or routed write.

## 2026-09-30 fresh independent B2 watchdog repair review

The fresh read-only EXPERT reviewed pushed commit `e4cfe1b79f293a34ccb3f15e46d1643813e54c9b`, verified the original failure/observer and post-fix green log hashes, and independently passed the unchanged required no-write three-module selection (64/64, three warnings). Its exact report SHA-256 `acf6cb1b0ad473005ac9b191d0f5a7b286d3698dad1501c4661b5e088399774b` returned substantive `BLOCK`: B2-R1 can leave an isolated TERM-ignoring descendant and open captured pipe writers after a failed readiness group sample and worker exit; B2-R2 replaces a fast worker’s true 0/nonzero status with 125. The owner accepted these in-scope repair findings, **not** the repaired code. Report: `docs/evidence/phase3a-slice2-b2-setsid-repair-expert-block-e4cfe1-20260930.md` (sanitized project copy; raw probe artifacts private). B1 and B2 remain blocked. No new brain candidate/source push, Qwen retry/index/build/cutover/routed write, or Slice 2 acceptance.

## 2026-09-30 B2-R1/R2 linked watchdog revision (local-only)

The independent EXPERT [BLOCK on exact commit `e4cfe1b`](../evidence/phase3a-slice2-b2-setsid-repair-expert-block-e4cfe1-20260930.md)
identified two linked seams: a missed group probe followed by leader exit could
leave a TERM-ignoring child and pipe writers alive, and fast isolated workers
could incorrectly return 125 instead of their actual 0/nonzero status. The
owner accepted both findings as part of the already approved minimal watchdog
repair, not as a new candidate or product decision.

The revised watchdog marks isolation from the worker's own group after `setsid`
and before `exec`, then waits for a matching marker and group. The original
`setsid gbrain sync ... 2>&1 &` launch line remains in the generated build
script. A completed fast worker is reaped **after** bounded group cleanup and
returns its original status. A never-ready shim or failed group launch returns
125; a signal returns 143; a real stall remains 124. The early-exit cleanup
reaches a descendant-only group even if the leader has already exited. It does
not signal the caller's group or a broad process name.

The [sanitized revision receipt](../evidence/phase3a-slice2-b2-r1-r2-revision-20260930.json)
(SHA-256 `888f0017e317b532c0e5f9c520cffc2dd28abb6f29c140bcfdfdff3f57af9f9c`)
records deterministic fast 0/7, missed-probe exit 0/7 with a TERM-ignoring
child, readiness failure, early signal and handler-handoff checks. Captured
output reached EOF; no group, leader, child or watchdog state remained. The
original 15-second test body and the no-write selection were not weakened.
The final unchanged three-module selection passed 72 tests/three warnings
in 24.67 seconds with bytecode/cache disabled and a unique private basetemp.
Two earlier same-selection runs passed 72 tests each before the final group
assertions were added. This is local repair evidence, **not** an independent
EXPERT or owner acceptance; B1/source acceptance is still blocked. No new
brain candidate, source push, Qwen retry, indexing, build, cutover or routed
write took place in this revision generation.

## 2026-09-30 independent B2-R3 fast-success review

A fresh read-only EXPERT reviewed pushed project `82dd37b2ee6513dc27aa2977a8c0c410b09ae22b` and independently passed the unchanged no-write three-module selection (72 tests/three warnings). Its report SHA-256 `34cf742145abac25abefb671ec7863b004e126725c8bccc66ff6e650144afce0` returned substantive `BLOCK` B2-R3: the attested fast-success watchdog branch exits the **entire generated build shell** before the mandatory post-sync source/failure-ledger/parity/vector/schema/bookmark gates. Controlled synthetic generated-sync probes falsely returned 0 with failing gates never reached; ordinary observed-ready success reached and rejected them. The owner accepted this inside the existing watchdog repair scope, **not** the repaired code. Sanitized report: `docs/evidence/phase3a-slice2-b2-r3-fast-success-expert-block-82dd37-20260930.md`; private synthetic artifacts remain private. B1/B2/source-current gates remain blocked. No new brain candidate/source push, Qwen retry/index/build/cutover/routed write or Slice 2 acceptance.

## 2026-09-30 local B2-R3 caller-continuation repair (fresh review pending)

The prior pushed watchdog source at `82dd37b` and doc-only project HEAD
`05f70db` have the same `bin/prime-claw` SHA-256
`610c2d8db2b067937d86356c945e7e4b6634bec63376775b96d415223921bb13`.
With that source, an attested missed-group-probe worker exit 0 returned from
the enclosing shell before its distinct caller sentinel 37; the exact
generated production sync suffix returned 0 without visiting a synthetic
post-sync bookmark gate. These new tests failed before the repair.

The bounded revision reaps the successful worker and owned group/descendants,
clears its startup signal traps, skips a second wait/watcher and **continues**
the enclosing generated build through every original post-sync gate. A fast
nonzero worker still aborts after cleanup. The new no-write generated-sync
matrix checks a positive fast0 route through both source checks, the failure
ledger, page/path/chunk parity, vector/schema/index and bookmark gates. Ten
independent faults (dirty source, changed HEAD, unacknowledged failures,
missing pages/paths/chunks, bad vectors, wrong schema, unexpected index and
stale bookmark) each reach the relevant gate and return nonzero. The original
15-second watchdog test body, bound, assertions, shell fragment and required
three-module selection remain unchanged. Targeted tests passed 15/15; the
three-module offline gate passed 85 tests/three warnings in 46.12 seconds
with unique scratch, disabled bytecode/cache and synthetic-only command
boundaries. R1 group/descendant/pipe cleanup and R2 truthful fast status,
never-ready 125, signal 143 and stall 124 remain covered.

[Sanitized receipt](../evidence/phase3a-slice2-b2-r3-caller-continuation-revision-20260930.json)
SHA-256 `2bbd6922b59dbaaeca153bd2fbaeeb3ff0ffd25cc264a7d264d00801053ed8ee`.
This is a local repair checkpoint, **not** a fresh EXPERT/owner acceptance of
B2, B1 or any brain candidate. No brain source/ref publication, Qwen retry,
index/build, cutover or routed write occurred. Keep the current blocked
source/candidate gate until the exact pushed repair is independently reviewed.

## 2026-09-30 B2-R3 independent PASS and bounded owner decision

A fresh read-only EXPERT independently reviewed exact pushed project commit
`5c1d10bf39e61abc84eb4fca0c11ee11b4c1a5ff` with `openai-codex/gpt-6-astra` / `max` and returned
**PASS** with no material B2-R3 findings. Its private report SHA-256 is
`7e965c8467422f54a8d11ee3b00727e5253115c460d438f33874535d475de9a2`. The unchanged no-write selection passed
85 tests/three warnings in 50.62 seconds; exact-prior-generator controls
returned 12 expected failures/three passes, detecting caller continuation and
all eleven generated-suffix cases. The owner verified the report, exact seven-
path commit, clean pushed branch, preserved receipt and idle EPISODE, then
**accepted only this B2-R3 watchdog runtime/test-harness repair**.
[Sanitized decision](../evidence/phase3a-slice2-b2-r3-owner-accepted-5c1d10-20260930.md)
SHA-256 `6eec1341f85eff261df3843ee901a15670f0947262ebff38c36178da5389c4a7` records the limits.

B1 remains blocked: no new local-only Joe-A exact-20 candidate has been made;
the old `1c97c409f005366aca132f5ff68c1a8c23483cc3` is unaccepted. The brain
checkout is clean but a fresh live remote read failed with exit 128, so the
remote ref, policy and both DB gates must be freshly verified before work.
The installed plugin support file also differs from current `main` while
other processes update that repo; no file was overwritten and a native handoff
is held until the intended loaded generation is reconciled. No brain source
publication, Qwen retry/index/build, cutover, routed write or Slice 2 source-
current acceptance follows from the B2 decision.

## 2026-09-30 new local-only Joe-A exact-20 source-current candidate (review pending)

The owner accepted **only** the independently reviewed B2-R3 watchdog repair
at project `5c1d10bf39e61abc84eb4fca0c11ee11b4c1a5ff` and authorized a
separate source-current **local-only** candidate pass. Before writing, live
brain `main` was rechecked as `eb157c713b24bb0ec9315ae27617b16da5cbf71b`;
the accepted no-sync checkout was clean, the old candidate and original repair
refs were intact, policy exactly matched the baseline, no sync/build was
running, and **both** database aggregate snapshots were unchanged. The 20
previous target paths were byte-identical in the new remote tree; its 82
newer disjoint changes and the two accepted Slice 1 repair blobs were retained.

One **new local ref** `refs/heads/phase3a-slice2-eb157-joe-a-frontmatter-20-candidate`
now points to `83eee06e4322b3264bb812959a2a5482bce13151`, whose exact parent
is live `eb157`. Its diff has exactly 20 modified Markdown paths, no path/mode
changes, no invented ID, and each original file is an exact suffix of the
candidate bytes. The 19 content-matched work-gbrain type/title pairs are
preserved from the historical prefix mapping and rechecked against its
metadata hashes. For the sole YAML_PARSE page, a new valid prefix uses the
**original Git title and type** as Joe selected; its older fallback pair was
not used. Native `gbrain frontmatter validate` found **zero errors across
1,202 Markdown files**. The unchanged offline three-module selection passed
**85 tests, three warnings in 50.79 seconds** with unique scratch and disabled
bytecode/cache. Live ref, accepted checkout, preserved refs, policy, no-sync
state, and both DB aggregate gates were rechecked unchanged after committing.

[Sanitized receipt](../evidence/phase3a-slice2-joe-a-eb157-local-candidate-20260930.json)
SHA-256 `88f5192f348c8c3f8c2bbea9bfb1f2fe33507859cf77644a20f59cf35fbde8d4`;
private native report SHA-256 `7ada1dd65ccf6033ebd25832429b1959d52d974e951ebaef13e9f004cb9fc9ab`;
focused test log SHA-256 `b62c8cf47706f4c0827b17a43eb10962162d6341829b0189ef9a7aaac221eba3`.
The old candidate `1c97c409f005366aca132f5ff68c1a8c23483cc3` remains
preserved and unaccepted. This **new local candidate is not accepted**;
independent exact-commit EXPERT review and separate owner decision are next.
Source/parent Beads remain BLOCKED. No brain publication, Qwen retry/index/build,
cutover, routed write, or plugin overwrite occurred.

## 2026-09-30 — fresh exact-candidate EXPERT BLOCK F1 (proof-only revision)

A fresh independent `openai-codex/gpt-6-astra`/`max` EXPERT reviewed local-only exact brain commit `83eee06e4322b3264bb812959a2a5482bce13151` against pushed project evidence `aa124b8dc429800ff9f5e2b87fd0eaa0725a0ca7` and returned **BLOCK F1 only**: the binding second, non-Git scratch full-source validation was not performed. The isolated Git native result independently reproduced 1,202/zero and the unchanged offline tests passed 85/three warnings; all other candidate, newer-source, accepted-blob, ref, policy, both DB and Beads checks passed. The exact EPISODE confirmed the scratch result is absent. Complete private EXPERT report SHA-256 `3560beec3b46403fa0dcfcaeb00378f35a68dc880da453c87ec38812c6d6a154`; [sanitized owner disposition](../evidence/phase3a-slice2-joe-a-expert-block-83eee-20260930.md) SHA-256 `2e57ef0eab35cdf99d297a1d1b1a44271ac06d4a39e923a92aae861073e0c937`. The owner accepted **F1 as in-scope proof-only REVISE**, not the candidate. Safely validate a distinct exact-commit scratch view with byte/path/mode identity and fresh state gates, then require fresh EXPERT PASS and separate owner decision. Source/parent/routed-write remain BLOCKED; no brain publication, Qwen/index/build, cutover or routed write.

## 2026-09-30 F1: distinct non-Git scratch proof for exact local-only candidate

The owner accepted the independent F1 **BLOCK** only as a proof-only revision.
No change was made to candidate `83eee06e4322b3264bb812959a2a5482bce13151`
or its local ref. Fresh before-and-after checks passed: live brain `main` remains
its parent `eb157c713b24bb0ec9315ae27617b16da5cbf71b`; accepted checkout
is clean and no-sync; preserved refs, exact base policy and **both** database
aggregates match their prior snapshots; no active sync/build was observed.

From the immutable exact candidate tree, `git archive --format=tar` produced
an explicitly extracted **non-Git scratch source view**, separate from the
previous isolated Git worktree. Before native validation, all 1,224 tracked
paths were checked for complete path, Git mode, and blob byte identity (Git
blob SHA-1); special/unsafe paths and `.git` metadata were excluded. Each of
the 20 original Markdown files remains an exact suffix; both accepted Slice 1
blobs are byte-equal; all 82 disjoint newer remote paths have the expected
bytes or absence. A post-validation independent walk rechecked all 1,224
files, modes, blob IDs and the same SHA-256 identity manifest
`a6b30f27d09f60475c733082e6f33afc099e0bceb4737f05d4a868943a2c8556`.
The full Git tree has 1,206 Markdown files; the native frontmatter validator
scanned its applicable 1,202 Markdown files.

Native no-fix `gbrain frontmatter validate <non-Git scratch view> --json`
exited **0 with 1,202 Markdown files, zero files with errors and zero errors**.
Private report SHA-256 `d107df5ec1f064754538ff6b126a295cef457e18edec1ea1d70c8774458f703b`.
The [sanitized F1 proof receipt](../evidence/phase3a-slice2-joe-a-f1-nongit-scratch-83eee-20260930.json)
SHA-256 `2e7748a25e166ab37b83847895f0d74dca61f8f5b2de11f2bd578078c93f2404`
records the exact private artifact paths and provenance without private page
content. No additional test run was needed for proof-only F1; the unchanged
focused selection remains 85 passing tests/three warnings (log SHA-256
`b62c8cf47706f4c0827b17a43eb10962162d6341829b0189ef9a7aaac221eba3`).

This evidence is **not acceptance** of the candidate or B1/source-current.
Fresh independent exact-commit EXPERT review and a separate owner decision
remain required. Source, parent, and ordered Qwen Beads stay BLOCKED. No
brain push/publication, Qwen retry/index/build/cutover, routed write or
plugin overwrite occurred.

## 2026-09-30 — Joe-A exact local candidate accepted, not published

Fresh independent `openai-codex/gpt-6-astra`/`max` EXPERT **PASS** on exact pushed project proof `703f1827ddeb91763542209a0d4c3d94491adeb8` and unchanged local-only brain candidate `83eee06e4322b3264bb812959a2a5482bce13151` independently reproduced the distinct scratch and isolated Git native 1,202/zero no-fix scans, both before/after manifests, complete source preservation, unchanged 85 passing focused tests and live ref/policy/both DB/Beads gates. Complete private EXPERT report SHA-256 `837a3895d222dd60790aee93fa9835a5ad94867e59ab19a4b498fd9988fef065`. After separate owner reconciliation, the owner accepts **only the exact local candidate**; [sanitized decision](../evidence/phase3a-slice2-joe-a-local-candidate-owner-accepted-83eee-20260930.md) SHA-256 `9c841e1bf304eb8a38a56b2b4a33d7db6eaa14bb680c2908d1315bf117b8f917`. The brain ref is not pushed. Source/parent/routed-write stay BLOCKED; a separately gated non-force publication decision is next, not automatic source-current/index/build/cutover/routed-write acceptance.

## 2026-09-30 — conditional non-force Joe-A source publication decision

The exact accepted local-only brain candidate `83eee06e4322b3264bb812959a2a5482bce13151` remains a direct child of live remote `main` `eb157c713b24bb0ec9315ae27617b16da5cbf71b`. After the separate owner acceptance, a fresh read-only project/brain ref and clean-checkout check passed. The owner separately [authorized](../evidence/phase3a-slice2-joe-a-nonforce-publication-owner-authorization-20260930.md) SHA-256 `c52aa86c570d5ced5b2e0ad330cd101bc66ed5b5c7d92f29b599fc127753cff8` at most one ordinary **non-force** fast-forward of that exact commit, strictly contingent on fresh pre/post remote, exact diff, refs, no-sync/no-build, effective policy and both DB gates. **No brain source push has happened at this decision checkpoint.** Any remote movement, gate mismatch or ambiguous transport stops without force/rebase/blind retry. Source, parent and routed-write remain BLOCKED; no Qwen/index/build, cutover or routed write is authorized.

## 2026-09-30 Joe-A candidate: one conditional ordinary non-force publication

After separate independent EXPERT PASS, local-candidate acceptance and owner
publication approval, the EPISODE freshly reverified brain `main` at the exact
direct parent `eb157c713b24bb0ec9315ae27617b16da5cbf71b` and candidate
`83eee06e4322b3264bb812959a2a5482bce13151` at its preserved local ref.
The fresh tree check found exactly 20 frontmatter-only Markdown changes. Every
original Markdown byte remained an exact suffix; both accepted Slice 1 blobs
and all 82 disjoint newer paths stayed equal. All 1,224 candidate archive
files matched Git blob IDs. The accepted checkout remained clean and no-sync,
the preserved refs/policy and **both** database aggregates matched, and no
active sync/embed/index/build was observed.

Exactly **one ordinary non-force** push of the accepted candidate ref to brain
`main` exited 0. An independent remote lookup then returned the exact accepted
candidate. A postflight repeated the checkout, refs, unchanged candidate tree,
policy, both database aggregates, and no-active-build checks. Git advanced
only the local `origin/main` tracking ref as an ordinary consequence of that
push; the accepted checkout and preserved source refs did not move. The
[sanitized publication receipt](../evidence/phase3a-slice2-joe-a-nonforce-publication-83eee-20260930.json)
SHA-256 `13d67211d22a12a6aacc7afcd6f7ddac32a5ecb48159438ab0ba5114a62768f0` identifies the private
fresh-tree report by hash without including private page content.

**Source publication is not source-current acceptance.** This publication
did not invoke Qwen retry/index/build/cutover, routed write, merge, plugin
overwrite or cleanup. Source `.5`, parent, and ordered routed-write `.4`
Beads remain BLOCKED. The owner must review exact post-publication evidence
separately before any next Slice 2 decision.

## 2026-10-01 owner accepts Joe-A source publication only

The fresh independent `openai-codex/gpt-6-astra`/`max` EXPERT **PASS** on exact pushed project `97a678693db887040fd00d273b671c13e7602144` and published brain main `83eee06e4322b3264bb812959a2a5482bce13151` has complete owner-private report SHA-256 `85babad6ea4f61827ff4a6f3507fe2758646af5c6def05be1f403caad1de4b11`. It independently classified all 44 publication-window tool calls and found only one ordinary non-force push exit 0, with no retry/fetch/rebase/checkout/source edit. Original Markdown suffixes on all 20 paths, two accepted Slice 1 blobs, 82 newer disjoint paths, all 1,224 candidate blobs, clean checkout, effective policy, both database aggregates and no active source build remained safe. Historical raw pre/post policy stdout was not durably retained; exact executed whole-policy comparisons plus matching historical/current canonical hashes supplied the bounded proof, not a claim that raw snapshots exist.

The owner separately [accepts **source publication only**](../evidence/phase3a-slice2-joe-a-publication-owner-accepted-83eee-20261001.md) SHA-256 `72d4b0da8bcd050ab30d3028cf183dd540f27045a720865a0f5befa7fbb918b5` after fresh live project/brain verification. The active registered checkout is still accepted Slice 1 HEAD `5c47c067e93eb633da8a8dcb28221e23eea7685b`; prior no-write dry-run eligibility was for that older checkout. **Slice 2 source-current/index eligibility is NOT accepted.** A separate read-only exact published-source readiness assessment may now proceed under fresh live remote/ref/clean checkout/no-sync/policy/BOTH DB gates. No active source checkout/ref/registration change, unproven no-write dry-run, Qwen retry, index/build/cutover, routed write, merge, plugin overwrite or cleanup is authorized. Source `.5`, parent and `.4` Beads remain BLOCKED.

## 2026-10-01 published-source readiness: read-only assessment

After separate acceptance of the exact Joe-A source publication, a fresh
read-only assessment verified brain `main` and local tracking at
`83eee06e4322b3264bb812959a2a5482bce13151`. The active registered
checkout is still the clean older accepted HEAD
`5c47c067e93eb633da8a8dcb28221e23eea7685b`. The local main,
inspection, original repair, old candidate, and accepted candidate refs are
preserved. Direct read-only registration queries found both canonical and
isolated Qwen source paths still pointing at the older checkout. No active
sync/embed/index/build was seen; the effective base policy and **both**
database aggregates matched their accepted snapshots.

The canonical bookmark remains `5a477eaa5b311b9b45324591dd308e83ddcd1ded`
(1,059 pages, 3,031 1536d chunks, zero null embeddings); the isolated
4096d Qwen database still has no bookmark (1,057 pages, 3,029 chunks,
zero null embeddings). The installed `gbrain 0.50.0.0` binary advertises
`sync --dry-run` as no-write, but an independent no-write proof for the
published-tree eligibility probe is missing. The older registered-checkout
dry-run and published-candidate no-fix frontmatter validation do not establish
published-tree eligible-file/page/path parity or an index bookmark. **No
published-tree dry-run was executed.** The [sanitized readiness receipt]
(../evidence/phase3a-slice2-published-source-current-readiness-83eee-20261001.json)
SHA-256 `1912356b45543f1941e7817473367828373ece708d7fe62bc6a34f679fa581ae` records the checks and scope.

A separate owner decision is needed before any lossless registered-source
reconciliation. Fresh exact-live-ref, clean checkout/refs, policy and both DB
gates must precede later action. A same-version hermetic no-write proof with
pre/post source/ref/config/index/database/provider checks must precede any
published-tree eligibility probe; the probe would still require separate
authorization and exact full-source file/page/path parity. This assessment
changed no source, ref, registration, index, or database, and it did not run
Qwen, cut over, route a write, merge, or clean up. Source `.5`, parent, and
routed-write `.4` remain BLOCKED.

## 2026-10-01 owner pauses source-current execution after read-only review

The owner independently reconciled the exact read-only readiness receipt SHA-256 `1912356b45543f1941e7817473367828373ece708d7fe62bc6a34f679fa581ae` at clean pushed project `6089e417921b03f7e97366efa67baac173c1cb68`: live brain `main` and tracking remain at published `83eee06e4322b3264bb812959a2a5482bce13151`, but the clean registered checkout and both source registrations still use older accepted `5c47c067e93eb633da8a8dcb28221e23eea7685b`. Effective base policy matched its prior canonical hash; no source build ran; owner read-only database queries matched the receipt for both stores. The canonical bookmark is not the published commit, Qwen bookmark is absent, and no published-tree dry-run or eligible-file/page/path parity proof exists. No ref, source registration, policy, index, database or provider was changed.

The [separate owner PAUSE decision](../evidence/phase3a-slice2-source-current-owner-paused-83eee-20261001.md) SHA-256 `bd7692ca0a25164ed5a15d2486bd717e512b4fe0d0fd3a23323f97a463c43311` accepts **only this read-only finding**, not source-current/index/build eligibility. Future lossless registered-source reconciliation preserving the accepted checkout/refs and independent same-version hermetic dry-run no-write proof each require a separate owner decision and fresh exact remote/ref/clean checkout/no-active-build/policy/BOTH DB gates. No checkout/ref/registration change or unproven probe, Qwen retry/index/build/cutover, routed write, merge, plugin overwrite or cleanup is authorized. Source `.5`, parent, `.4` and blocked plan/spec remain BLOCKED; retain the exact EPISODE idle.
