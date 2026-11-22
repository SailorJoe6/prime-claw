"""Real public Prime Agent RPC cancellation against the installed plugin (tier 1 only)."""


def test_public_rpc_abort_stops_actual_provider_migration(tier1_container):
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", "--test-name-pattern",
        "public Prime Agent RPC abort", "/workspace/tests/task_provider_migration.test.mjs",
        env={"PRIME_CLAW_STOP_AGENT": tier1_container.prime_agent},
        timeout=200,
    )
    (tier1_container.share.parent / "operator-migration-stop-node.tap").write_text(
        result.stdout + result.stderr
    )
    assert result.returncode == 0, result.stdout + result.stderr
