"""Selected-provider migration regression bridge.

The real native direction suite runs only in the tier-1 container. Static
inventory and least-technology contract checks remain host-safe.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MODULE = REPO / "src" / "prime-agent-plugin" / "extension-support" / "task-provider-migration.ts"
WS_NODE_SUITE = "/workspace/tests/task_provider_migration.test.mjs"


def test_task_provider_migration_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", WS_NODE_SUITE,
        timeout=2400,
    )
    (tier1_container.share.parent / "task-provider-migration-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_migration_entry_admission_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", "--test-name-pattern",
        "migration admission", WS_NODE_SUITE, timeout=900,
    )
    (tier1_container.share.parent / "migration-entry-admission-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_forward_beads_retirement_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", "--test-name-pattern",
        "forward Beads retirement", WS_NODE_SUITE, timeout=600,
    )
    (tier1_container.share.parent / "forward-beads-retirement-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_retiring_beads_source_boundary_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test",
        "--test-name-pattern",
        "canonical source inspection|confirmed embedded|embedded source refuses|repeated embedded|independent Backlog publication",
        WS_NODE_SUITE, timeout=900,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_beads_status_archive_preflight_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test",
        "--test-name-pattern",
        "used unsupported Beads statuses|Beads closed reasons and categories",
        WS_NODE_SUITE, timeout=900,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_task_provider_migration_module_is_inventoried_plugin_source() -> None:
    inventory = json.loads(
        (REPO / "src" / "prime-agent-plugin" / "asset-inventory.json").read_text()
    )
    rows = [row for row in inventory["assets"] if row["id"] == "plugin-extension-support-task-provider-migration-ts"]
    assert len(rows) == 1
    assert rows[0]["source"] == "extension-support/task-provider-migration.ts"
    assert rows[0]["targets"] == [
        {"class": "plugin-root-exact", "destination": "extension-support/task-provider-migration.ts"}
    ]
    assert MODULE.is_file() and not MODULE.is_symlink()


def test_task_provider_migration_stays_pair_specific_and_receipt_only() -> None:
    source = MODULE.read_text()
    for sentinel in (
        "inspectTaskProviderMigration",
        "migrateTaskProvider",
        "migrateBacklogToBeads",
        "migrateBeadsToBacklog",
        "switchActiveTaskProviderOwnership",
        "restoreTaskProviderOwnershipSwitch",
        "destination-native",
        "gitHistoryBase64",
        "history",
        "provenance",
        "source-revision-changed",
        "source store still exists after guarded deletion",
        "confirmedSwitch",
    ):
        assert sentinel in source
    for forbidden in (
        "class AbstractTaskProvider",
        "registerProvider",
        "provider-selection.json",
        "migration-state.json",
        "migration-checkpoint",
        "semanticClassifier",
        "semanticDiffEngine",
        "dualWrite",
        "while (retry",
    ):
        assert forbidden not in source
