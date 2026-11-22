"""One opt-in representative-volume rehearsal, only in offline Tier 1 Docker."""

import os
import shutil
import subprocess

import pytest


@pytest.mark.skipif(os.environ.get("RUN_PVA_SCALE_REHEARSAL") != "1", reason="explicit scale rehearsal only")
def test_pva_gate_scale_rehearsal(tier1_container):
    share = tier1_container.share
    progress = share / "pva-scale-progress.jsonl"
    tap = share.parent / "pva-scale-rehearsal.tap"
    try:
        result = tier1_container.run(
            "node", "--max-old-space-size=3072", "--experimental-strip-types", "--test", "--test-concurrency=1",
            "--test-name-pattern", "^representative volume fresh PVA rehearsal$",
            "/workspace/tests/task_provider_migration.test.mjs", timeout=7200,
            env={"PRIME_CLAW_REPRESENTATIVE_EVIDENCE": str(progress)},
        )
        tap.write_text(result.stdout + result.stderr)
        assert result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired as exc:
        tap.write_bytes((exc.stdout or b"") + (exc.stderr or b""))
        raise
    finally:
        if progress.is_file():
            shutil.copyfile(progress, share.parent / progress.name)
