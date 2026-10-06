"""Tier-0 statics for the slice-3 tier harness (prime-claw-blw.3).

These tests pin the tier machinery itself: the container-side helpers
compile, the markers are registered, the results dir is gitignored, the
sequencer parses, no tier-1 test code resolves host node/prime-agent
binaries, and every committed node suite has a pytest bridge.
"""

import ast
import py_compile
from pathlib import Path
import subprocess
import sys


REPO = Path(__file__).resolve().parents[1]


def test_container_helper_scripts_compile():
    helpers = sorted((REPO / "tests" / "container").glob("*.py"))
    assert helpers, "tests/container helpers are missing"
    for helper in helpers:
        py_compile.compile(str(helper), doraise=True)


def test_pytest_registers_only_supported_and_reserved_environment_markers():
    ini = (REPO / "pytest.ini").read_text()
    assert "container:" in ini
    assert "integration:" in ini
    assert "lifecycle:" in ini
    assert "macos_host:" in ini


def test_mocked_runtime_tests_are_host_safe_tier0():
    runtime_tests = sorted((REPO / "tests").glob("test_runtime_*.py"))
    assert runtime_tests
    for test_file in runtime_tests:
        text = test_file.read_text()
        assert "pytestmark = pytest.mark.sandbox" not in text
        assert "Offline:" in text or "host-safe" in text


def test_results_dir_is_gitignored():
    assert ".test-results/" in (REPO / ".gitignore").read_text()


def test_all_sequencer_is_executable_and_parses():
    sequencer = REPO / "scripts" / "test-all.sh"
    assert sequencer.exists(), "scripts/test-all.sh is missing"
    assert sequencer.stat().st_mode & 0o111, "scripts/test-all.sh is not executable"
    parsed = subprocess.run(["bash", "-n", str(sequencer)], capture_output=True)
    assert parsed.returncode == 0, parsed.stderr.decode()


def test_tier1_test_code_never_resolves_host_binaries():
    """Tier-1 tests run node/prime-agent INSIDE the container; no test file
    may resolve them from the host PATH."""
    offenders = []
    for test_file in sorted((REPO / "tests").glob("test_*.py")):
        if test_file.name == Path(__file__).name:
            continue  # this guard file names the needles it scans for
        text = test_file.read_text()
        for needle in ('shutil.which("prime-agent")', "shutil.which('prime-agent')",
                       'shutil.which("node")', "shutil.which('node')"):
            if needle in text:
                offenders.append(f"{test_file.name}: {needle}")
    assert not offenders, "\n".join(offenders)


def test_every_node_suite_has_a_pytest_bridge():
    """Every committed tests/*.test.mjs suite runs under the tier-1 container
    via a pytest bridge (the slice-3 fate decision for the previously
    unbridged episode_close and project_conversation suites)."""
    for suite in sorted((REPO / "tests").glob("*.test.mjs")):
        needle = f"/workspace/tests/{suite.name}"
        bridges = [
            test_file.name
            for test_file in sorted((REPO / "tests").glob("test_*.py"))
            if needle in test_file.read_text()
        ]
        assert bridges, f"{suite.name} has no pytest bridge"


UNIT_ENV_BODIES = {
    "watchdog": ("unit_env_watchdog_body.py", 8),
    "npm_onload": ("unit_env_npm_onload_body.py", 1),
    "launcher_driver": ("unit_env_tier1_driver_body.py", 34),
    "launcher_launch_error": ("unit_env_tier1_launch_error_body.py", 1),
    "launcher_fixture": ("unit_env_tier1_fixture_body.py", 3),
    "launcher_image": ("unit_env_tier1_image_body.py", 6),
    "cleanup": ("unit_env_cleanup_body.py", 1),
    "probe_wrapper": ("unit_env_probe_wrapper_body.py", 2),
}


def test_environment_dependent_unit_bodies_are_noncollectable_and_bridged():
    """Named Slice-5 bodies cannot be discovered by host pytest."""
    bridge = (REPO / "tests" / "test_unit_env_bridges.py").read_text()
    for filename, expected_tests in UNIT_ENV_BODIES.values():
        body = REPO / "tests" / filename
        assert body.is_file()
        assert not filename.startswith("test_")
        assert filename in bridge
        assert "from unit_env_entry import require_unit_env" in body.read_text()
        assert "require_unit_env()" in body.read_text()
        tree = ast.parse(body.read_text(), filename=str(body))
        test_defs = [node for node in ast.walk(tree)
                     if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
                     and node.name.startswith("test_")]
        assert len(test_defs) == expected_tests, filename


def test_slice5_removed_host_collected_environment_modules():
    for filename in ("test_prime_agent_probe_isolation.py",):
        assert not (REPO / "tests" / filename).exists(), filename


def test_slice5_bridges_use_only_the_tier1_container_execution_boundary():
    bridge = (REPO / "tests" / "test_unit_env_bridges.py").read_text()
    assert bridge.count("def test_") == 6
    assert "tier1_container.run(" in bridge
    assert "subprocess" not in bridge
    assert "docker" not in bridge.lower()
    assert '"PRIME_CLAW_UNIT_ENV_BODY": "1"' in bridge
    assert '"HOME": "/tmp/prime-claw-unit-env-home"' in bridge
    assert "workdir=tier1_container.ws" in bridge
    assert 'docker run -d --init --name "$NAME"' in (
        REPO / "scripts" / "test-tier1.sh").read_text()
    assert '["docker", "run", "-d", "--init"' in (
        REPO / "tests" / "conftest.py").read_text()


def test_unit_env_body_direct_host_entry_fails_closed():
    env = {key: value for key, value in __import__("os").environ.items()
           if key != "PRIME_CLAW_UNIT_ENV_BODY"}
    for filename, _expected_tests in UNIT_ENV_BODIES.values():
        body = REPO / "tests" / filename
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "-q", str(body)],
            cwd=REPO, text=True, capture_output=True, check=False, env=env)
        assert result.returncode != 0, filename
        assert "unit-env body refused" in result.stdout + result.stderr, filename
