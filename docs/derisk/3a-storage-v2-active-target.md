# Phase 3a: primary runtime target bound to restored v2

Date: 2026-10-10. Joe accepted the [v2 restored-state candidate](3a-storage-v2-copy-build.md) and directly approved **only** making that Ready sandbox the actual configured runtime target now. This receipt is a target-setting verification, not source-current, indexing, routed-write, model-call, Qwen cutover, merge, or cleanup acceptance.

## Applied in the primary checkout

Primary checkout: `/Users/jlanders/code/prime-claw` on `main` at `e20535352db3700c71cf7ec977ba9e2112d38bba`. Its supported `bin/prime-claw` config loader reads tracked `config/runtime.json`, then the ignored operator-local `.prime-claw/runtime.local.json`. No `PRIME_CLAW_*` process overrides were set. The tracked config retains `sandbox_name=prime-claw` and was not modified. The existing ignored file, mode `0600`, initially contained two unrelated operator-local keys and no sandbox override. An atomic, mode-preserving replacement added **only** `"sandbox_name": "prime-claw-v2"`; the prior two overlay values and every other effective runtime key were confirmed equal before/after, without printing or copying their values. This operator-local change is effective in the **primary** checkout, not only the Episode worktree, and is intentionally not committed or shared via Git. A fresh checkout would need its own authorized binding.

Native `load_config(None)` executed from the primary checkout resolved `sandbox_name=prime-claw-v2`, confirmed all non-target effective keys unchanged, and still selected gateway `openai:text-embedding-3-large` / 1536. The canonical `gbrain` behavior was not switched to the preserved unused Qwen candidate. Neither tracked runtime config nor the primary tracked tree changed; the ignored overlay remains at mode `0600`.

## Read-only runtime confirmation

From that same primary checkout, `./bin/prime-claw status` now reports:

- `sandbox=prime-claw-v2` and sandbox **Ready**, rather than the former `prime-claw` **Error**.
- Brain-repository, gateway, PostgreSQL, gbrain CLI, and Prime Agent daemon probes **OK**; expected image and model-call reachability are unproven (`???`). No model call was made.
- **Exit 1**, because its provider probe passes unsupported `--output` to the installed `openshell sandbox provider list` (separately tracked issue `prime-claw-zwg.3`). A direct supported provider-list call returned 0 and found all three required attachment **names** (`prime-claw-ai-gateway`, `prime-claw-github`, `prime-claw-codex`). The CLI's aggregate status is **not green**. Do not mask or "fix" this separate compatibility bug in this target-only pass, and do not infer credentialed model reachability from attachment names.

Independent OpenShell `sandbox get -g openshell ... -o json` confirms `prime-claw-v2` ID `f38cb82b-140d-4cc0-b1b0-a4a6871c82aa`, phase **Ready**. Docker inspect identifies its running container `576a0158e98f7770e4a55e46edcd8cc6a740b152a40ffea398b00e725b3be6a4`; both Docker's sandbox-id and sandbox-name labels match that exact OpenShell object. Docker configured volume mounts and actual mounts agree:

| Destination | Named volume | Volume subpath | Actual writable |
|---|---|---|---|
| `/sandbox/pgdata` | `pc-v2-20261010-state` | `pgdata` | Yes |
| `/sandbox/brain` | `pc-v2-20261010-state` | `brain` | Yes |
| `/sandbox/home-root` | `pc-v2-20261010-state` | `home-root` | Yes |

The old v1 OpenShell object remains `c9066cee-a64f-4fae-95cd-2a9245b2dc66` in **Error**. Its exact Docker container `5aab359a43b0cafc94a7552e419736238578a786c9ddb6ee790fbadfa44a1316` is stopped (exit 143). The full Docker changed-path/kind multiset still equals the prior 59,981-entry inventory. No v1 lifecycle action, direct Docker start, or writable-layer edit was made. V2, helpers, disposable step-1 resources, and v1's original writable layer remain intact. The old `.uv` and `.venv` copies stay retained but inactive under v2 `home-root`; image environments were not overwritten.

## Reproducibility and review boundary

Safe commands for a fresh read-only verification **from the primary checkout** (do not display the private local overlay):

```sh
cd /Users/jlanders/code/prime-claw
./bin/prime-claw status
openshell sandbox get -g openshell prime-claw-v2 -o json  # select id + phase, do not publish raw policy
openshell sandbox provider list -g openshell prime-claw-v2
# Match Docker labels, running state, HostConfig.Mounts VolumeOptions.Subpath
# and Mounts.RW without printing unrelated config or credential material.
```

Primary host-safe offline test: `python3 -m pytest -q tests/test_runtime_status.py` — **18 passed**, one existing `load_module()` deprecation warning. The native effective-config assertion, direct status and OpenShell/Docker mount checks above are the actual binding proof; offline unit tests do not replace them. No broad `validate` (which writes probe facts), source sync/index, routed write or model call was run.

**STOP for Joe's review.** The only completed migration action here is the primary runtime-target setting. The provider-status CLI incompatibility remains open; the legacy incident `prime-claw-5v7.10` remains OPEN, while source/index `.5`, parent and routed-write `.4` remain BLOCKED. Do not merge, delete v1, clean helpers, replace inactive environments or infer acceptance of a downstream gate.
