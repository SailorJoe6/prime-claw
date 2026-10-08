# Slice 2 managed-role integrity candidate

Date: 2026-10-06

## Scope

This is the first bounded Slice 2 capability after accepted Slice 1
`57d26e582c583a81de370051b129f74f5b13ee45`.

It connects the existing trusted owner/EPISODE lifecycle classifier to the
neutral role kernel already generated and installed by Slice 1:

- `conversation-oversight.ts` imports the generated role-kernel marker and exact
  bytes instead of hard-coding the legacy Conversation APPEND block;
- managed promotion, active-owner, and bounded-EPISODE paths require exactly one
  exact neutral block and reject missing, duplicate, stale, reversed, nested, or
  otherwise marker-shaped variants;
- the `context` hook keeps `ctx.abort()` as the provider-dispatch stop;
- ordinary sessions with explicit context opt-out remain ordinary;
- private bounded-EPISODE identity and historical bounded packages are removed
  from provider messages instead of injecting a new identity package; and
- provider captures verify the neutral kernel is absent from user and custom
  channels.

The change reuses current lifecycle state and the current provider seam. It does
not introduce another state machine or policy copy.

## Deliberate boundary

This candidate does not install the managed Conversation skill, activation tool,
single-use disclosure receipt, readiness gates, or project-skill shim. Those
remain the next Slice 2 capability after owner review. EXPERT admission remains
Slice 3. No user-global apply, restart, UAT, finalization, or cleanup is part of
this candidate.

## Focused evidence

Command:

```bash
TIER1_ENV_FILE=<isolated-env> python3 -m pytest   tests/test_project_conversation_extension.py   tests/test_conversation_oversight_native.py   tests/test_reviewed_plan_native_discovery.py   -q -m container -p no:cacheprovider
```

Result: **11 passed, 7 deselected in 46.11s**.

The focused suite covers generated-byte parity at the extension boundary,
marker-shape rejection, active owner and bounded EPISODE aborts, explicit
no-context promotion refusal before mutation/provider dispatch, normal direct
and queued provider paths, tool loops, agent messages, compaction, reload,
resume, generic-child non-authority, lifecycle recovery, historical-package
filtering, and the absence of neutral-kernel copies from provider user/custom
channels.

## Complete evidence

- Tier 0: **291 passed, 167 skipped, 11 warnings in 46.13s**. Log SHA256:
  `836f2a4d1f7575fccaf63171c5462327e272cdb3393486864a06f95ca048df35`.
- Docker Tier 1: **60 passed, 398 deselected, 11 warnings in 117.44s**. Log
  SHA256: `135c730d41f649dbc3608341097dfcfda29a021c6e1320880f8428b95c34a139`.
- Full-gate logs: `.test-results/20261005-223346-16242`.
- Pinned Prime Agent 0.9.8 installed-runtime probe: **PASS**. Preserved log:
  `/Users/jlanders/.prime/agent/session-artifacts/01a10774-0155-7316-a329-50ee5f7d17be/slice2-managed-role-integrity/pinned-0.9.8-probe.log`; SHA256 `5c27c8dfc691e534f69608c8fe4ab434acf65cfd386749532f15eb10ebe3fc59`.

The initial full runs exposed only stale tests that still expected managed
promotion under `--no-context-files` or matched the retired identity-kernel error.
The updated controls now prove the intended distinction: ordinary no-context
sessions pass, while managed promotion without the neutral kernel fails before
provider or lifecycle mutation.
