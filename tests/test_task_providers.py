"""Task-provider discovery and capability-gate regression bridge.

The behavioral Node suite is tier 1: it runs INSIDE the session's tier-1
container via the `tier1_container` fixture (auto-marked `container`; see
tests/conftest.py). The inventory and source-contract checks are static repo
checks and stay tier 0.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MODULE = REPO / "src" / "prime-agent-plugin" / "extension-support" / "task-providers.ts"
WS_NODE_SUITE = "/workspace/tests/task_providers.test.mjs"


def test_task_providers_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", WS_NODE_SUITE,
        timeout=180,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_task_providers_module_is_inventoried_plugin_source() -> None:
    inventory = json.loads(
        (REPO / "src" / "prime-agent-plugin" / "asset-inventory.json").read_text()
    )
    rows = [row for row in inventory["assets"] if row["id"] == "plugin-extension-support-task-providers-ts"]
    assert len(rows) == 1
    assert rows[0]["source"] == "extension-support/task-providers.ts"
    assert rows[0]["targets"] == [
        {"class": "plugin-root-exact", "destination": "extension-support/task-providers.ts"}
    ]
    assert MODULE.is_file() and not MODULE.is_symlink()


def test_task_providers_module_keeps_the_narrow_deterministic_boundary() -> None:
    source = MODULE.read_text()
    # Exact canonical lifecycle and the provider-native evidence contract.
    for status in ("In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"):
        assert f'"{status}"' in source
    for sentinel in (
        "detectTaskProvider",
        "checkBacklogCapabilities",
        "checkBeadsCapabilities",
        "checkSelectedProviderCapabilities",
        "prepareBeadsWorkspaceTransport",
        "mutateAndPublishBeadsTaskStatus",
        "BeadsSameTaskReconciliationEvidence",
        "reconciliation-required",
        "dolt_diff_summary",
        "--no-adopt",
        "BEADS_DOLT_DATA_REF",
        "--readonly",
        "dual-providers",
        "malformed-evidence",
        "never live authority",
        "issues.jsonl",
    ):
        assert sentinel in source
    # No shadow authority, no provider framework, no semantic machinery.
    for forbidden in (
        "class AbstractTaskProvider",
        "registerProvider",
        "semanticMerge",
    ):
        assert forbidden not in source
    # Discovery must not create or mutate anything: no write APIs.
    for write_api in ("writeFileSync", "mkdirSync", "execFileSync("):
        assert write_api not in source
