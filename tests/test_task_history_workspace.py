"""Task-history workspace regression bridge.

The behavioral Node suite is tier 1: it runs INSIDE the session's tier-1
container via the `tier1_container` fixture (auto-marked `container`; see
tests/conftest.py). The inventory and source-contract checks are static repo
checks and stay tier 0.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MODULE = REPO / "src" / "prime-agent-plugin" / "extension-support" / "task-history-workspace.ts"
WS_NODE_SUITE = "/workspace/tests/task_history_workspace.test.mjs"


def test_task_history_workspace_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", WS_NODE_SUITE,
        timeout=420,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_task_history_workspace_module_is_inventoried_plugin_source() -> None:
    inventory = json.loads(
        (REPO / "src" / "prime-agent-plugin" / "asset-inventory.json").read_text()
    )
    rows = [row for row in inventory["assets"] if row["id"] == "plugin-extension-support-task-history-workspace-ts"]
    assert len(rows) == 1
    assert rows[0]["source"] == "extension-support/task-history-workspace.ts"
    assert rows[0]["targets"] == [
        {"class": "plugin-root-exact", "destination": "extension-support/task-history-workspace.ts"}
    ]
    assert MODULE.is_file() and not MODULE.is_symlink()
