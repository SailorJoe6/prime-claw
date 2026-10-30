"""PRIMECLAW-44 native selected-store/history evidence; no host candidate calls."""


def test_backlog_destination_layout_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", "/workspace/tests/backlog_destination_layout.test.mjs",
        timeout=600,
    )
    # Keep successful native assertions/version/layout diagnostics beside the receipt.
    (tier1_container.share.parent / "backlog-destination-layout-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr
