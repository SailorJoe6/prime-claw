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
OWNERSHIP_MODULE = REPO / "src" / "prime-agent-plugin" / "extension-support" / "episode-ownership.ts"
OWNERSHIP_WRITER = REPO / "src" / "prime-agent-plugin" / "extension-support" / "task-episode-ownership.ts"
EPISODE_MODULE = REPO / "src" / "prime-agent-plugin" / "extension-support" / "spec-episode.ts"
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
        "--dolt-auto-commit=on",
        "--no-adopt",
        "BEADS_DOLT_DATA_REF",
        "--readonly",
        "dual-providers",
        "malformed-evidence",
        "never live authority",
        "issues.jsonl",
    ):
        assert sentinel in source
    resolver_read = source[source.index("function readBeadsIssue("):source.index("/** Canonical lifecycle status", source.index("function readBeadsIssue("))]
    assert '["show", selectedTaskId, "--json", "--long", "--include-comments"]' in resolver_read
    assert "nativeView: issue.nativeView" in source
    # No shadow authority, no provider framework, no semantic machinery.
    for forbidden in (
        "class AbstractTaskProvider",
        "registerProvider",
        "semanticMerge",
        "BEADS_TASK_RELATED_DIFF_COLUMNS",
        "dolt_diff_summary",
    ):
        assert forbidden not in source
    # Discovery must not create or mutate anything: no write APIs.
    for write_api in ("writeFileSync", "mkdirSync", "execFileSync("):
        assert write_api not in source


def test_version_two_ownership_keeps_one_discriminated_provider_native_shape() -> None:
    ownership = OWNERSHIP_MODULE.read_text()
    writer = OWNERSHIP_WRITER.read_text()
    episode = EPISODE_MODULE.read_text()
    for sentinel in (
        'provider: "backlog"',
        'provider: "beads"',
        'providerRevision: string',
        'taskEvidence: Record<string, unknown>',
        'record.provider ?? "backlog"',
        'typeof item.providerRevision === "string"',
        'DOLT_REVISION.test(item.providerRevision)',
        'exactBeadsTaskEvidence(item.taskEvidence, item.taskId)',
    ):
        assert sentinel in ownership
    assert writer.count('provider: "backlog"') == 2
    assert writer.count("reservePublishedBeadsTaskEpisodeOwnership") == 1
    assert 'input.publication.status !== "published"' in writer
    assert 'provider: "beads"' in writer
    assert "reservePublishedBeadsTaskEpisodeOwnership" not in episode
    assert "Legacy ownership transition replay does not yet support Beads ownership" in writer
    assert "isBacklogTaskEpisodeOwnership(record)" in episode
    assert "does not yet admit Beads ownership" in episode
    for forbidden in (
        "version: 3",
        "schemaVersion: 2",
        "ownership-receipt",
        "provider-state",
    ):
        assert forbidden not in ownership
