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
if [ "${TEST_ALL_RECORD_ADMISSION:-}" = 1 ]; then
  printf 'admission:python:%s:%s:%s\\n' "$*" \
    "${PYTEST_ADDOPTS-unset}" "${PRIME_CLAW_LIFECYCLE_SEQUENCER-unset}" \
    >>"$TEST_ALL_CALL_LOG"
fi
case " $* " in
  *" -m pytest tests/ -q -m container "*)
    [ "${TEST_ALL_FAIL_TIER:-}" = tier1 ] && exit 9
    ;;
  *" -m pytest tests/ -q "*)
    [ "${TEST_ALL_FAIL_TIER:-}" = tier0 ] && exit 9
    ;;
  *" tests/test_lifecycle_destroy.py::test_destroy_only_generated_target "*)
    [ "${TEST_ALL_FAIL_TIER:-}" = lifecycle ] && exit 9
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
if [ "${TEST_ALL_RECORD_ADMISSION:-}" = 1 ]; then
  printf 'admission:integration:%s:%s\\n' \
    "${PYTEST_ADDOPTS-unset}" "${PRIME_CLAW_LIFECYCLE_SEQUENCER-unset}" \
    >>"$TEST_ALL_CALL_LOG"
fi
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


def test_default_sequence_never_runs_lifecycle(tmp_path):
    script, env, log = _harness(tmp_path)
    result = subprocess.run([str(script)], text=True, capture_output=True,
                            env=env, timeout=10)
    assert result.returncode == 0
    assert not any("test_lifecycle_destroy.py" in row
                   for row in log.read_text().splitlines())


def test_with_lifecycle_runs_one_exact_body_after_tier_two(tmp_path):
    script, env, log = _harness(tmp_path)
    result = subprocess.run([str(script), "--with-lifecycle"], text=True,
                            capture_output=True, env=env, timeout=10)
    assert result.returncode == 0, result.stdout + result.stderr
    calls = log.read_text().splitlines()
    tier2 = calls.index("integration:")
    lifecycle = [i for i, row in enumerate(calls)
                 if "tests/test_lifecycle_destroy.py::test_destroy_only_generated_target" in row]
    assert len(lifecycle) == 1
    assert tier2 < lifecycle[0]
    assert "--run-lifecycle" in calls[lifecycle[0]]
    assert "lifecycle: PASS" in result.stdout


def test_inherited_admission_environment_is_cleared_until_exact_lifecycle_child(
        tmp_path):
    script, env, log = _harness(tmp_path)
    env.update({
        "PYTEST_ADDOPTS": "--run-lifecycle",
        "PRIME_CLAW_LIFECYCLE_SEQUENCER": "1",
        "TEST_ALL_RECORD_ADMISSION": "1",
    })
    result = subprocess.run([str(script), "--with-lifecycle"], text=True,
                            capture_output=True, env=env, timeout=10)
    assert result.returncode == 0, result.stdout + result.stderr
    admission = [row for row in log.read_text().splitlines()
                 if row.startswith("admission:")]
    prerequisite = [row for row in admission
                    if "test_lifecycle_destroy.py" not in row]
    lifecycle = [row for row in admission
                 if "test_lifecycle_destroy.py" in row]
    assert prerequisite
    assert all(row.endswith(":unset:unset") for row in prerequisite)
    assert len(lifecycle) == 1
    assert lifecycle[0].endswith(":unset:1")


def test_tier_two_failure_never_starts_lifecycle(tmp_path):
    script, env, log = _harness(tmp_path)
    env["TEST_ALL_FAIL_TIER"] = "tier2"
    result = subprocess.run([str(script), "--with-lifecycle"], text=True,
                            capture_output=True, env=env, timeout=10)
    assert result.returncode != 0
    assert not any("test_lifecycle_destroy.py" in row
                   for row in log.read_text().splitlines())


def test_lifecycle_failure_is_not_retried(tmp_path):
    script, env, log = _harness(tmp_path)
    env["TEST_ALL_FAIL_TIER"] = "lifecycle"
    result = subprocess.run([str(script), "--with-lifecycle"], text=True,
                            capture_output=True, env=env, timeout=10)
    assert result.returncode != 0
    lifecycle = [row for row in log.read_text().splitlines()
                 if "test_lifecycle_destroy.py::test_destroy_only_generated_target" in row]
    assert len(lifecycle) == 1
    assert "lifecycle: FAIL" in result.stderr


def test_unsupported_or_ambiguous_arguments_have_no_side_effects(tmp_path):
    for index, argv in enumerate((
        ("--with-sandbox",), ("--unknown",),
        ("--with-lifecycle", "extra"),
    )):
        case = tmp_path / str(index)
        script, env, log = _harness(case)
        result = subprocess.run([str(script), *argv], text=True,
                                capture_output=True, env=env, timeout=10)
        assert result.returncode == 64
        assert not log.exists()
        assert not (script.parents[1] / ".test-results").exists()
