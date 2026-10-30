"""Disposable native source-read proof for PRIMECLAW-44; no host bd calls."""


def test_beads_retiring_source_capture_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--test", "/workspace/tests/beads_retiring_source_capture.test.mjs",
        timeout=360,
    )
    assert result.returncode == 0, result.stdout + result.stderr
