"""Tier-0 statics for the slice-3 tier harness (prime-claw-blw.3).

These tests pin the tier machinery itself: the container-side helpers
compile, the markers are registered, the results dir is gitignored, the
sequencer parses, no tier-1 test code resolves host node/prime-agent
binaries, and every committed node suite has a pytest bridge.
"""

import py_compile
from pathlib import Path
import subprocess


REPO = Path(__file__).resolve().parents[1]


def test_container_helper_scripts_compile():
    helpers = sorted((REPO / "tests" / "container").glob("*.py"))
    assert helpers, "tests/container helpers are missing"
    for helper in helpers:
        py_compile.compile(str(helper), doraise=True)


def test_pytest_registers_container_and_sandbox_markers():
    ini = (REPO / "pytest.ini").read_text()
    assert "container:" in ini
    assert "sandbox:" in ini


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
