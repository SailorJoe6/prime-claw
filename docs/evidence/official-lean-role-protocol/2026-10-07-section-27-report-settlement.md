# Section 27 structured review report and exact owner settlement

## Scope

This vertical extends accepted Section 26 commit
`3efd0cc79717378f9be5f448afe32f6a7c33ed39` / tree
`06e08cbcf7a226409749f29c7e6dd815ee66ff4b`. Inbound messages, headers,
sender/target labels, and internal `agent_message` details remain completely
non-authoritative. Prime Agent is unchanged.

## Implemented vertical

- `launch(packet)` now captures an exact clean pre-review repository snapshot:
  canonical candidate HEAD, clean flag, porcelain-status byte count, and SHA256.
  Dirty candidates fail before model discovery, private-state creation, or
  spawn.
- The already-admitted depth-1 child calls `submit(report)` without supplying
  identity or handle fields. The package derives its canonical runtime directory,
  finds one matching private launch, and revalidates claimed child/session,
  canonical parent and active generation, actual spawn/model, candidate, packet,
  package, and neutral-kernel lineage.
- Reports use an exact bounded schema with one `PASS`, `BLOCK`, `ADVISORY`, or
  `SPEC_QUESTION` verdict. Findings have exact severity/summary/evidence/
  remediation fields. Every `BLOCK` requires non-empty actionable remediation.
  Canonical report bytes are capped at 12 KiB and private state at 64 KiB.
- A valid first submission is SHA256-bound and exclusively creates `REPORTED`
  before removing `CLAIMED`. Only the identical canonical digest is idempotent;
  conflicting, malformed, oversized, wrong-runtime, unclaimed, or settled replay
  fails closed. Complete state bytes are fsynced to a private temporary file and
  hard-linked exclusively into the destination name before the prior phase is
  removed, so `REPORTED`/`SETTLED` publication never exposes a partial file.
- Report submission records post-review HEAD and exact status digest/count.
  Repository mutation creates terminal `REPORTED` evidence with
  `reportAccepted: false`, rejects the submission, and cannot settle.
- `settle()` takes no caller identity or model-supplied handle. It derives the
  depth-0 owner and current generation, requires the exact current owner session
  file as well as owner ID/generation/repository, locates one matching `REPORTED` launch,
  revalidates report digest and actual spawn/child/session/model/candidate/
  package/kernel lineage, then rechecks repository HEAD and clean status.
  Success exclusively creates `SETTLED`, removes `REPORTED`, and returns the
  immutable report plus report/settlement receipts. The exact settled read is
  idempotent only after revalidating stored report/receipt digests, timestamps,
  repository evidence, and complete result equality.
- A post-report repository mutation creates one bounded
  `settlement-rejected.json` evidence record while retaining `REPORTED`; retry
  remains fail closed.
- Extension admission keeps `FINALIZED`, `CLAIMED`, `REPORTED`, and `SETTLED`
  children under the exact neutral EXPERT kernel. Real provider-boundary tests
  prove `REPORTED` and `SETTLED` children explicitly abort with zero provider
  calls.
- The canonical reviewer and retained compatibility copy are byte-identical and
  pinned at SHA256 `49e2f48421902721b25751380a2173cd8a44ad1c6c4655e7a9a4a8e583983ce6`. The reviewer must submit exactly once
  before any final answer; the structured report/receipt is authoritative and a
  successful submission is terminal.

## Focused evidence

- Focused Python/report/settlement/static compatibility suite: **43 passed, 8 skipped**. It
  covers clean launch, exact/idempotent submission and settlement, actionable
  BLOCK validation, malformed/oversized and verdict-shape rejection, wrong
  runtime, unclaimed launch, conflict, settled replay, report-time mutation, and
  settlement-time mutation evidence.
  Final focused log SHA256: `5b5e9be638a26f9a5026ba83d1b71c78956e0ab2aa207d48ecadba60037f7548`.
- Focused Node extension suite: **55 passed**. It covers canonical admission and
  existing mismatch/replay behavior plus neutral-kernel and explicit provider
  abort behavior for both `REPORTED` and `SETTLED`. Final focused log SHA256:
  `126c25ce8073fea69a514bca47c3aee6c033eb2e9546ebc06c73abcb13de39ca`.
- Docker-authoritative native runtime suite: **2 passed** in 52.46 seconds. It
  exercises real Prime Agent 0.9.8 provider context, verifies one provider call
  for valid claimed admission, and zero calls for mismatch, timeout, reported,
  and settled states. Log SHA256:
  `82c1e43c67a733137d3b6a577e66c56a07e60ec3f55815c4cdc91d969193bb12`.
  The same native tests reran against the final package bytes inside the final
  full Docker Tier 1 gate below.

## Full gates

- Final full Tier 0: **311 passed, 184 skipped**, 11 warnings in 61.49
  seconds. Log SHA256: `19f5e3f821c70b1cfa24668ba69b46813f614f0d779a00dd757ae7a21244c045`.
- Final full Docker Tier 1: **77 passed, 418 deselected**, 11 warnings in 234.77
  seconds. Log SHA256: `0bf9d6891fb50cf479835efe1603ff64fe0def64bebb46abbd3365755cf56749`.
- Pinned `scripts/test-tier1.sh --probe`: **OK** on Prime Agent **0.9.8**. It
  built the image, installed and checksum-verified the exact release, applied
  and checked the plugin, proved unique RPC command publication, and destroyed
  the container. Managed source preflight reported expected package SHA256
  `68ad970184e108a377743d51047c2be1e9ac73f3c45c4b84dc633589c051af5c`.
  Log SHA256: `3d6c4342abc857da5e969d28114c2497560381dba69630610e2ef97ac46419d7`.

The first full Tier 0 run found one Section 27 compatibility-text regression:
the retained reviewer contract test required its exact lower-case “return” wording for `BLOCK`.
Both canonical copies were updated together, their pinned hash was refreshed,
and the affected rerun passed **33 passed, 8 skipped** before the corrected full
gate above. No behavior or scope expansion was needed.

## Review and deferred boundaries

No independent review cycle was launched. The pushed candidate receives one
direct owning-Conversation review only. Owner product-disposition persistence
beyond the settlement receipt, child deletion, state cleanup, Slice 4, landing,
user-global apply/restart/UAT, finalization, bookkeeping, and physical cleanup
remain deferred.
