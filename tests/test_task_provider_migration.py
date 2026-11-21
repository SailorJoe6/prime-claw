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


def test_selected_existing_configuration_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", "--test-name-pattern",
        "selected-existing", WS_NODE_SUITE, timeout=1200,
    )
    (tier1_container.share.parent / "selected-existing-configuration-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_current_native_migration_integration_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", "--test-name-pattern",
        "current native|complete-receipt same-destination replay", WS_NODE_SUITE,
        timeout=600,
    )
    (tier1_container.share.parent / "current-native-migration-integration-node.tap").write_text(
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
        "read-only inspection captures complete current Beads|Beads source digest|current Beads source digest|"
        "canonical source inspection|confirmed embedded|embedded source refuses|repeated embedded|"
        "independent Backlog publication|typed Beads export|native Beads memory capture|native Beads memory outputs|"
        "active Beads Episode deletion refusal|complete-receipt same-destination replay|current native migration and replay|current native importer stops|default migration capture",
        WS_NODE_SUITE, timeout=900,
    )
    (tier1_container.share.parent / "retiring-beads-source-boundary-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_beads_status_archive_preflight_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test",
        "--test-name-pattern",
        "native Beads deferred|used unsupported Beads statuses|Beads closed reasons and categories",
        WS_NODE_SUITE, timeout=900,
    )
    (tier1_container.share.parent / "beads-status-archive-preflight-node.tap").write_text(
        result.stdout + result.stderr
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


def test_native_populated_backlog_allocation_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", "--test-name-pattern",
        "native populated Backlog allocation|native populated Backlog lifecycle", WS_NODE_SUITE, timeout=300,
    )
    (tier1_container.share.parent / "native-populated-backlog-allocation-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_populated_backlog_migration_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", "--test-name-pattern",
        "confirmed populated Backlog|native archived-target source graph|native populated Backlog allocation|native populated Backlog lifecycle|migration admission refuses contested Backlog IDs",
        WS_NODE_SUITE, timeout=2400,
    )
    (tier1_container.share.parent / "populated-backlog-migration-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_migration_backlog_web_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test",
        "/workspace/tests/migration_backlog_web.test.mjs", timeout=600,
    )
    (tier1_container.share.parent / "migration-backlog-web-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_beads_backlog_current_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test",
        "/workspace/tests/beads_backlog_current.test.mjs", timeout=600,
    )
    (tier1_container.share.parent / "beads-backlog-current-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr
