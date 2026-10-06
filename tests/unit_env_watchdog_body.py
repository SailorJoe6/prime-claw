"""Unit-env body: real Linux POSIX watchdog process-group behavior."""

from unit_env_entry import require_unit_env
require_unit_env()

import os
import shlex
import signal
import subprocess
import sys
import threading
import time
from importlib.machinery import SourceFileLoader

import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(REPO, "bin", "prime-claw")
pc = SourceFileLoader("primeclaw_unit_env_watchdog", BIN).load_module()
FAKE_BASE_URL = "http://embedding.test.invalid:7997/v1"


def cfg(tmp_path, **over):
    value = {
        "sandbox_name": "prime-claw",
        "policy_file": os.path.join(REPO, "policies", "runtime.yaml"),
        "embedding_policy_file": str(tmp_path / "runtime-policy.local.yaml"),
        "embedding_base_url": FAKE_BASE_URL,
        "embedding_provider": "openai",
        "embedding_model": "Qwen3-Embedding-8B",
        "embedding_dimensions": 4096,
        "embedding_timeout_seconds": 1000,
        "embedding_api_key": "dummy",
        "embedding_database": "gbrain_qwen4096",
        "embedding_legacy_database": "gbrain",
        "embedding_candidate_home": "/sandbox/.prime-claw/qwen-candidate",
        "embedding_build_timeout_seconds": 14400,
        "brain_repo": "operator/brain",
        "_local_override_keys": ["brain_repo"],
        "_local_config_path": os.path.realpath(os.path.join(
            REPO, ".prime-claw", "runtime.local.json")),
    }
    value.update(over)
    return value


def test_candidate_watchdog_shell_is_valid_in_target_linux(tmp_path):
    settings = pc._embedding_settings(cfg(tmp_path))
    script = pc._candidate_build_script(cfg(tmp_path), settings)
    syntax = subprocess.run(
        ["bash", "-n"], input=script, text=True, capture_output=True, check=False)
    assert syntax.returncode == 0, syntax.stderr


def _watchdog_test_env(tmp_path, *, setsid_delay=0):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    setsid = bin_dir / "setsid"
    setsid.write_text(
        f"#!{sys.executable}\n"
        "import os, sys, time\n"
        f"time.sleep({setsid_delay!r})\n"
        "os.setsid()\n"
        "os.execvp(sys.argv[1], sys.argv[1:])\n"
    )
    setsid.chmod(0o755)
    env = os.environ.copy()
    env["PATH"] = str(bin_dir) + os.pathsep + env["PATH"]
    return env


def _pid_exists(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


def _wait_pid_gone(pid, timeout=2):
    deadline = time.time() + timeout
    while _pid_exists(pid) and time.time() < deadline:
        time.sleep(0.02)
    return not _pid_exists(pid)


def test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero(tmp_path):
    leader_pid_file = tmp_path / "sync.pid"
    descendant_pid_file = tmp_path / "descendant.pid"
    progress_file = tmp_path / "progress"
    progress_file.write_text("steady")
    descendant = (
        "trap '' HUP INT TERM; "
        f"echo $$ > {shlex.quote(str(descendant_pid_file))}; "
        "while :; do sleep 1; done"
    )
    worker = (
        "bash -c " + shlex.quote(descendant) + " & "
        f"echo $$ > {shlex.quote(str(leader_pid_file))}; "
        "trap 'exit 0' TERM; while :; do sleep 1; done"
    )
    fragment = pc._candidate_progress_watchdog_script(
        "bash -c " + shlex.quote(worker),
        "cat " + shlex.quote(str(progress_file)),
        stall_seconds=1,
        poll_seconds=1,
        term_grace_seconds=1,
    )

    try:
        result = subprocess.run(
            ["bash", "-c", "set -euo pipefail\n" + fragment],
            text=True,
            capture_output=True,
            timeout=15,
            env=_watchdog_test_env(tmp_path),
        )

        assert result.returncode == 124
        assert "candidate-progress-watchdog" in result.stderr
        leader_pid = int(leader_pid_file.read_text())
        descendant_pid = int(descendant_pid_file.read_text())
        assert _wait_pid_gone(leader_pid)
        assert _wait_pid_gone(descendant_pid)
    finally:
        if leader_pid_file.exists():
            try:
                os.killpg(int(leader_pid_file.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass


@pytest.mark.parametrize("command, expected", [
    ("/usr/bin/true", 0),
    ("bash -c 'exit 7'", 7),
])
def test_candidate_progress_watchdog_preserves_fast_worker_status(
        tmp_path, command, expected):
    fragment = pc._candidate_progress_watchdog_script(
        command, "printf steady", stall_seconds=2, poll_seconds=1,
        term_grace_seconds=1,
    )
    result = subprocess.run(
        ["bash", "-c", "set -euo pipefail\n" + fragment],
        text=True, capture_output=True, timeout=8,
        env=_watchdog_test_env(tmp_path),
    )
    assert result.returncode == expected, result.stderr


@pytest.mark.parametrize("launch_failure", [False, True])
def test_candidate_progress_watchdog_unready_launch_returns_125(
        tmp_path, launch_failure):
    shim_pid_file = tmp_path / "shim.pid"
    env = _watchdog_test_env(tmp_path)
    setsid = tmp_path / "bin" / "setsid"
    if launch_failure:
        setsid.write_text("#!/bin/sh\nexit 22\n")
    else:
        setsid.write_text(
            f"#!{sys.executable}\n"
            "import os, signal, time\n"
            f"with open({str(shim_pid_file)!r}, 'w') as out: out.write(str(os.getpid()))\n"
            "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
            "time.sleep(30)\n"
        )
    setsid.chmod(0o755)
    fragment = pc._candidate_progress_watchdog_script(
        "/usr/bin/true", "printf steady", stall_seconds=2,
        poll_seconds=1, term_grace_seconds=1,
    )
    try:
        result = subprocess.run(
            ["bash", "-c", "set -euo pipefail\n" + fragment],
            text=True, capture_output=True, timeout=9, env=env,
        )
        assert result.returncode == 125, result.stderr
        assert "candidate-progress-watchdog" in result.stderr
        if not launch_failure:
            assert _wait_pid_gone(int(shim_pid_file.read_text()))
    finally:
        if shim_pid_file.exists():
            try:
                os.kill(int(shim_pid_file.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass


def test_candidate_progress_watchdog_signal_before_group_ready(tmp_path):
    shim_pid_file = tmp_path / "shim.pid"
    env = _watchdog_test_env(tmp_path)
    setsid = tmp_path / "bin" / "setsid"
    setsid.write_text(
        f"#!{sys.executable}\n"
        "import os, signal, time\n"
        f"with open({str(shim_pid_file)!r}, 'w') as out: out.write(str(os.getpid()))\n"
        "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
        "time.sleep(30)\n"
    )
    setsid.chmod(0o755)
    fragment = pc._candidate_progress_watchdog_script(
        "/usr/bin/true", "printf steady", stall_seconds=30,
        poll_seconds=1, term_grace_seconds=1,
    )
    proc = subprocess.Popen(
        ["bash", "-c", "set -euo pipefail\n" + fragment],
        text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env,
    )
    try:
        deadline = time.time() + 3
        while not shim_pid_file.exists() and time.time() < deadline:
            time.sleep(0.01)
        assert shim_pid_file.exists()
        proc.terminate()
        _stdout, stderr = proc.communicate(timeout=7)
        assert proc.returncode == 143, stderr
        assert _wait_pid_gone(int(shim_pid_file.read_text()))
    finally:
        if shim_pid_file.exists():
            try:
                os.kill(int(shim_pid_file.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass
        if proc.poll() is None:
            proc.kill()
            proc.communicate(timeout=2)


def test_candidate_progress_watchdog_waits_for_delayed_setsid_group(tmp_path):
    """The stall clock cannot start before the owned process group exists."""
    leader_pid_file = tmp_path / "sync.pid"
    descendant_pid_file = tmp_path / "descendant.pid"
    progress_file = tmp_path / "progress"
    progress_file.write_text("steady")
    descendant = (
        "trap '' HUP INT TERM; "
        f"echo $$ > {shlex.quote(str(descendant_pid_file))}; "
        "while :; do sleep 1; done"
    )
    worker = (
        "bash -c " + shlex.quote(descendant) + " & "
        f"echo $$ > {shlex.quote(str(leader_pid_file))}; "
        "trap 'exit 0' TERM; while :; do sleep 1; done"
    )
    fragment = pc._candidate_progress_watchdog_script(
        "bash -c " + shlex.quote(worker),
        "cat " + shlex.quote(str(progress_file)),
        stall_seconds=1, poll_seconds=1, term_grace_seconds=1,
    )
    try:
        result = subprocess.run(
            ["bash", "-c", "set -euo pipefail\n" + fragment],
            text=True, capture_output=True, timeout=10,
            env=_watchdog_test_env(tmp_path, setsid_delay=2),
        )
        assert result.returncode == 124, result.stderr
        assert "candidate-progress-watchdog" in result.stderr
        assert leader_pid_file.exists()
        assert descendant_pid_file.exists()
        assert _wait_pid_gone(int(leader_pid_file.read_text()))
        assert _wait_pid_gone(int(descendant_pid_file.read_text()))
    finally:
        if leader_pid_file.exists():
            try:
                os.killpg(int(leader_pid_file.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass


def test_candidate_progress_watchdog_does_not_stall_after_worker_exit(tmp_path):
    """A worker that exits during the poll sleep completed; it did not stall."""
    fragment = pc._candidate_progress_watchdog_script(
        "bash -c 'sleep 0.3'", "printf steady",
        stall_seconds=1, poll_seconds=2, term_grace_seconds=1,
    )
    result = subprocess.run(
        ["bash", "-c", "set -euo pipefail\n" + fragment],
        text=True, capture_output=True, timeout=6,
        env=_watchdog_test_env(tmp_path),
    )
    assert result.returncode == 0, result.stderr


def test_candidate_progress_watchdog_resets_and_signal_cleanup_reaps_group(tmp_path):
    pid_file = tmp_path / "sync.pid"
    progress_file = tmp_path / "progress"
    progress_file.write_text("0")
    worker = f"echo $$ > {shlex.quote(str(pid_file))}; trap 'exit 143' TERM; sleep 3"
    fragment = pc._candidate_progress_watchdog_script(
        "bash -c " + shlex.quote(worker),
        "cat " + shlex.quote(str(progress_file)),
        stall_seconds=2,
        poll_seconds=1,
        term_grace_seconds=1,
    )
    proc = subprocess.Popen(
        ["bash", "-c", "set -euo pipefail\n" + fragment],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=_watchdog_test_env(tmp_path, setsid_delay=1.5),
    )
    deadline = time.time() + 5
    while not pid_file.exists() and time.time() < deadline:
        time.sleep(0.02)
    assert pid_file.exists(), "worker never reached readiness"
    timers = [
        threading.Timer(0.5, progress_file.write_text, args=("1",)),
        threading.Timer(1.5, progress_file.write_text, args=("2",)),
    ]
    for timer in timers:
        timer.start()
    try:
        _stdout, stderr = proc.communicate(timeout=8)
    finally:
        for timer in timers:
            timer.cancel()
        if proc.poll() is None:
            proc.kill()
            proc.communicate(timeout=2)
    assert proc.returncode == 0, stderr
    assert progress_file.read_text() == "2"
    assert not _pid_exists(int(pid_file.read_text()))


    # A signal to the waiting parent must also terminate and reap the isolated
    # sync process group instead of leaving it reparented in the sandbox.
    signal_pid_file = tmp_path / "signal-sync.pid"
    signal_worker = (
        f"echo $$ > {shlex.quote(str(signal_pid_file))}; "
        "trap 'exit 143' TERM; while :; do sleep 1; done"
    )
    signal_fragment = pc._candidate_progress_watchdog_script(
        "bash -c " + shlex.quote(signal_worker),
        "printf steady",
        stall_seconds=30,
        poll_seconds=1,
        term_grace_seconds=1,
    )
    proc = subprocess.Popen(
        ["bash", "-c", "set -euo pipefail\n" + signal_fragment],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=_watchdog_test_env(tmp_path),
    )
    deadline = time.time() + 3
    while not signal_pid_file.exists() and time.time() < deadline:
        time.sleep(0.02)
    assert signal_pid_file.exists()
    proc.terminate()
    _stdout, stderr = proc.communicate(timeout=6)
    assert proc.returncode == 143, stderr
    assert not _pid_exists(int(signal_pid_file.read_text()))
