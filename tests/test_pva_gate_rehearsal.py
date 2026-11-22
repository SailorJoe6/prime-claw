"""Disposable timing and real native publication refusal; never run on the host."""

def test_pva_gate_rehearsal(tier1_container):
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", "--test-concurrency=1",
        "--test-name-pattern", "^PVA gate ",
        "/workspace/tests/task_provider_migration.test.mjs", timeout=950,
    )
    (tier1_container.share.parent / "pva-gate-rehearsal.tap").write_text(result.stdout + result.stderr)
    assert result.returncode == 0, result.stdout + result.stderr
