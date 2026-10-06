from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess


REPO = Path(__file__).resolve().parents[1]


def _harness(tmp_path: Path) -> tuple[Path, dict[str, str], Path]:
    root = tmp_path / "repo"
    scripts = root / "scripts"
    fakebin = root / "fakebin"
    scripts.mkdir(parents=True)
    fakebin.mkdir()
    target = scripts / "test-all.sh"
    shutil.copy2(REPO / "scripts/test-all.sh", target)
    target.chmod(0o755)
    log = root / "calls.log"
    fake_python = fakebin / "python"
    fake_python.write_text("""#!/bin/sh
printf 'python:%s\\n' "$*" >>"$TEST_ALL_CALL_LOG"
case " $* " in
  *" -m pytest tests/ -q -m container "*)
    [ "${TEST_ALL_FAIL_TIER:-}" = tier1 ] && exit 9
    ;;
esac
exit 0
""")
    fake_python.chmod(0o755)
    docker = fakebin / "docker"
    docker.write_text("""#!/bin/sh
printf 'docker:%s\\n' "$*" >>"$TEST_ALL_CALL_LOG"
exit 0
""")
    docker.chmod(0o755)
    integration = scripts / "test-integration.sh"
    integration.write_text("""#!/bin/sh
printf 'integration:%s\\n' "$*" >>"$TEST_ALL_CALL_LOG"
[ "${TEST_ALL_FAIL_TIER:-}" = tier2 ] && exit 9
exit 0
""")
    integration.chmod(0o755)
    (root / ".env").write_text("PRIME_AGENT_PINNED=0.9.8\n")
    env = {
        **os.environ,
        "PATH": str(fakebin) + os.pathsep + os.environ.get("PATH", ""),
        "TEST_ALL_PYTHON": str(fake_python),
        "TEST_ALL_CALL_LOG": str(log),
    }
    return target, env, log


def test_test_all_runs_tiers_zero_one_two_in_order(tmp_path):
    script, env, log = _harness(tmp_path)
    result = subprocess.run([str(script)], text=True, capture_output=True,
                            env=env, timeout=10)
    assert result.returncode == 0, result.stdout + result.stderr
    calls = log.read_text().splitlines()
    tier0 = calls.index("python:-m pytest tests/ -q")
    tier1 = calls.index("python:-m pytest tests/ -q -m container")
    tier2 = calls.index("integration:")
    assert tier0 < tier1 < tier2
    assert "tier0: PASS" in result.stdout
    assert "tier1: PASS" in result.stdout
    assert "tier2: PASS" in result.stdout


def test_test_all_is_fail_fast_before_tier_two(tmp_path):
    script, env, log = _harness(tmp_path)
    env["TEST_ALL_FAIL_TIER"] = "tier1"
    result = subprocess.run([str(script)], text=True, capture_output=True,
                            env=env, timeout=10)
    assert result.returncode != 0
    assert not any(row.startswith("integration:")
                   for row in log.read_text().splitlines())


def test_lifecycle_enabling_flags_are_non_mutating_usage_errors(tmp_path):
    for flag in ("--with-sandbox", "--with-lifecycle"):
        case = tmp_path / flag.removeprefix("--")
        script, env, log = _harness(case)
        result = subprocess.run([str(script), flag], text=True,
                                capture_output=True, env=env, timeout=10)
        assert result.returncode == 64
        assert "lifecycle execution is disabled" in result.stderr
        assert not log.exists()
