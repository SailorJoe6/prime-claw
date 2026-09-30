"""Slice 4A.2a isolated home-Qwen candidate build tests.

Offline only. All OpenShell, sandbox, policy, network, and database boundaries are
monkeypatched. The reserved ``.invalid`` endpoint is synthetic.
"""
import base64
import inspect
import json
import os
import re
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
pc = SourceFileLoader("primeclaw_embedding_candidate", BIN).load_module()
FAKE_BASE_URL = "http://embedding.test.invalid:7997/v1"


class Args:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run


def cfg(tmp_path, **over):
    c = {
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
    c.update(over)
    return c


def test_candidate_contract_uses_separate_gbrain_parent_and_long_outer_timeout(tmp_path):
    tracked = json.load(open(os.path.join(REPO, "config", "runtime.json")))
    settings = pc._embedding_settings(cfg(tmp_path))
    assert tracked["embedding_candidate_home"] == settings["candidate_home"]
    assert settings["candidate_home"] == "/sandbox/.prime-claw/qwen-candidate"
    assert not settings["candidate_home"].endswith("/.gbrain")
    assert settings["sync_stall_abort_seconds"] > settings["timeout_seconds"]
    assert settings["sync_max_runtime_seconds"] > settings["sync_stall_abort_seconds"]
    assert tracked["embedding_build_timeout_seconds"] > settings["sync_max_runtime_seconds"]


def test_candidate_database_cannot_diverge_from_actual_canonical_identity(tmp_path, monkeypatch):
    with pytest.raises(ValueError, match="must equal the resolved canonical"):
        pc._embedding_settings(cfg(tmp_path, postgres_db="actual_canonical"))
    with pytest.raises(ValueError, match="must differ from the resolved canonical"):
        pc._embedding_settings(cfg(tmp_path, postgres_db="gbrain_qwen4096",
                                   embedding_legacy_database="gbrain_qwen4096"))
    monkeypatch.setenv("POSTGRES_DB", "runtime_canonical")
    with pytest.raises(ValueError, match="must equal the resolved canonical"):
        pc._embedding_settings(cfg(tmp_path))


@pytest.mark.parametrize("bad", [
    "/sandbox/.gbrain",
    "/sandbox/.prime-claw/qwen-candidate/.gbrain",
    "/sandbox/.prime-claw/../gbrain",
    "/tmp/qwen-candidate",
])
def test_candidate_home_is_confined_parent_not_final_dot_gbrain(tmp_path, bad):
    with pytest.raises(ValueError):
        pc._embedding_settings(cfg(tmp_path, embedding_candidate_home=bad))


def test_candidate_full_sync_has_durable_progress_watchdog(tmp_path):
    settings = pc._embedding_settings(cfg(tmp_path))
    script = pc._candidate_build_script(cfg(tmp_path), settings)

    # Upstream's GBRAIN_SYNC_STALL_ABORT_SECONDS does not interrupt the
    # `--full` import.files path. prime-claw must independently watch durable
    # candidate DB progress and terminate the one sync process when it stalls.
    assert "setsid gbrain sync --source brain --full --no-pull --no-extract --workers 1 --yes 2>&1 &" in script
    assert "SYNC_PID=$!" in script
    assert "candidate-progress-watchdog" in script
    assert "count(c.embedding)" in script
    assert "max(c.embedded_at)" in script
    assert "LAST_PROGRESS_AT" in script
    assert 'kill -"$1" -- "-$SYNC_PID"' in script
    assert 'kill -0 -- "-$SYNC_PID"' in script
    assert "candidate_sync_group_alive" in script
    assert "signal_candidate_sync TERM" in script
    assert "signal_candidate_sync KILL" in script
    assert 'wait "$SYNC_PID"' in script
    assert "WATCHDOG_PID=$!" in script
    assert "trap handle_candidate_signal HUP INT TERM" in script
    assert "GBRAIN_SYNC_STALL_ABORT_SECONDS=1200" in script
    syntax = subprocess.run(["bash", "-n"], input=script, text=True, capture_output=True)
    assert syntax.returncode == 0, syntax.stderr


def _watchdog_test_env(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    setsid = bin_dir / "setsid"
    setsid.write_text(
        f"#!{sys.executable}\n"
        "import os, sys\n"
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


def test_candidate_progress_watchdog_terminates_before_setsid_group_exists(tmp_path):
    """A slow setsid shim must not make an early stall signal miss the worker."""
    progress_file = tmp_path / "progress"
    progress_file.write_text("steady")
    shim_pid_file = tmp_path / "shim.pid"
    env = _watchdog_test_env(tmp_path)
    setsid = tmp_path / "bin" / "setsid"
    setsid.write_text(
        f"#!{sys.executable}\n"
        "import os, sys, time\n"
        f"with open({str(shim_pid_file)!r}, 'w') as pidfile: pidfile.write(str(os.getpid()))\n"
        "time.sleep(3)\n"
        "os.setsid()\n"
        "os.execvp(sys.argv[1], sys.argv[1:])\n"
    )
    fragment = pc._candidate_progress_watchdog_script(
        "bash -c 'while :; do sleep 1; done'",
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
            timeout=12,
            env=env,
        )
        assert result.returncode == 124
        assert "candidate-progress-watchdog" in result.stderr
        assert _wait_pid_gone(int(shim_pid_file.read_text()))
    finally:
        if shim_pid_file.exists():
            try:
                os.kill(int(shim_pid_file.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass


@pytest.mark.parametrize("command, expected", [('/usr/bin/true', 0), ("bash -c 'exit 7'", 7)])
def test_candidate_progress_watchdog_preserves_fast_worker_status(tmp_path, command, expected):
    state_ref = tmp_path / "state-ref"
    env = _watchdog_test_env(tmp_path)
    env["WATCHDOG_STATE_REF"] = str(state_ref)
    fragment = pc._candidate_progress_watchdog_script(
        command, "printf steady", stall_seconds=2, poll_seconds=1, term_grace_seconds=1,
    )
    mktemp_probe = (
        'mktemp() { local path; path=$(command mktemp "$@") || return; '
        'printf %s "$path" > "$WATCHDOG_STATE_REF"; printf %s "$path"; }\n'
    )
    result = subprocess.run(
        ["bash", "-c", "set -euo pipefail\n" + mktemp_probe + fragment],
        text=True, capture_output=True, timeout=8, env=env,
    )
    assert result.returncode == expected, result.stderr
    assert not os.path.exists(state_ref.read_text())


@pytest.mark.parametrize("worker_status", [0, 7])
@pytest.mark.parametrize("continue_caller", [False, True])
def test_candidate_progress_watchdog_reaps_group_after_missed_probe(tmp_path, worker_status,
                                                                   continue_caller):
    """A real failed group probe cannot discard a later leader exit or child."""
    gate = tmp_path / "failed-probe"
    descendant_pid_file = tmp_path / "descendant.pid"
    leader_pid_file = tmp_path / "leader.pid"
    state_ref = tmp_path / "state-ref"
    continuation = tmp_path / "caller-continued"
    env = _watchdog_test_env(tmp_path)
    env.update(WATCHDOG_PROBE_GATE=str(gate), WATCHDOG_DESC_FILE=str(descendant_pid_file),
               WATCHDOG_STATE_REF=str(state_ref))
    setsid = tmp_path / "bin" / "setsid"
    setsid.write_text(
        f"#!{sys.executable}\n"
        "import os, sys, time\n"
        f"while not os.path.exists({str(gate)!r}): time.sleep(0.005)\n"
        "os.setsid()\n"
        "os.execvp(sys.argv[1], sys.argv[1:])\n"
    )
    descendant = (
        "trap '' HUP INT TERM; "
        f"echo $$ > {shlex.quote(str(descendant_pid_file))}; "
        "while :; do sleep 1; done"
    )
    worker = (
        "bash -c " + shlex.quote(descendant) + " & "
        f"echo $$ > {shlex.quote(str(leader_pid_file))}; "
        f"while [ ! -s {shlex.quote(str(descendant_pid_file))} ]; do sleep 0.01; done; "
        f"exit {worker_status}"
    )
    fragment = pc._candidate_progress_watchdog_script(
        "bash -c " + shlex.quote(worker), "printf steady",
        stall_seconds=3, poll_seconds=1, term_grace_seconds=1,
    )
    if continue_caller:
        fragment += ("printf continued > " + shlex.quote(str(continuation)) + "\nexit 37\n")
    probe = (
        'mktemp() { local path; path=$(command mktemp "$@") || return; '
        'printf %s "$path" > "$WATCHDOG_STATE_REF"; printf %s "$path"; }\n'
        'kill() { local rc=0; builtin kill "$@" || rc=$?; '
        'if [ "${1:-}" = -0 ] && [ "${2:-}" = -- ] '
        '&& [ "${3:-}" = "-$SYNC_PID" ] && [ "$rc" -ne 0 ] '
        '&& [ ! -e "$WATCHDOG_PROBE_GATE" ]; then '
        ': > "$WATCHDOG_PROBE_GATE"; '
        'for _ in $(seq 1 200); do [ -s "$WATCHDOG_DESC_FILE" ] && break; sleep 0.01; done; '
        '[ -s "$WATCHDOG_DESC_FILE" ] || return 99; sleep 0.2; '
        'fi; return "$rc"; }\n'
    )
    proc = subprocess.Popen(
        ["bash", "-c", "set -euo pipefail\n" + probe + fragment],
        text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env,
    )
    try:
        _stdout, stderr = proc.communicate(timeout=9)  # Also proves pipe EOF.
        assert gate.exists() and leader_pid_file.exists() and descendant_pid_file.exists()
        assert proc.returncode == (37 if continue_caller and worker_status == 0
                                   else worker_status), stderr
        assert continuation.exists() == (continue_caller and worker_status == 0)
        leader_pid = int(leader_pid_file.read_text())
        assert leader_pid != os.getpgrp()
        assert _wait_pid_gone(leader_pid)
        assert _wait_pid_gone(int(descendant_pid_file.read_text()))
        try:
            os.killpg(leader_pid, 0)
        except ProcessLookupError:
            pass
        else:
            pytest.fail("isolated sync process group survived watchdog cleanup")
        assert not os.path.exists(state_ref.read_text())
    finally:
        if leader_pid_file.exists():
            leader_pid = int(leader_pid_file.read_text())
            if leader_pid != os.getpgrp():
                try:
                    os.killpg(leader_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        if proc.poll() is None:
            proc.kill()
            proc.communicate(timeout=2)


@pytest.mark.parametrize("launch_failure", [False, True])
def test_candidate_progress_watchdog_unready_launch_returns_125(tmp_path, launch_failure):
    """Neither a failed setsid launch nor a never-ready shim is success."""
    shim_pid_file = tmp_path / "shim.pid"
    state_ref = tmp_path / "state-ref"
    env = _watchdog_test_env(tmp_path)
    env["WATCHDOG_STATE_REF"] = str(state_ref)
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
    fragment = pc._candidate_progress_watchdog_script(
        "/usr/bin/true", "printf steady", stall_seconds=2, poll_seconds=1,
        term_grace_seconds=1,
    )
    probe = (
        'mktemp() { local path; path=$(command mktemp "$@") || return; '
        'printf %s "$path" > "$WATCHDOG_STATE_REF"; printf %s "$path"; }\n'
    )
    try:
        result = subprocess.run(
            ["bash", "-c", "set -euo pipefail\n" + probe + fragment],
            text=True, capture_output=True, timeout=9, env=env,
        )
        assert result.returncode == 125, result.stderr
        if not launch_failure:
            assert _wait_pid_gone(int(shim_pid_file.read_text()))
        assert not os.path.exists(state_ref.read_text())
    finally:
        if shim_pid_file.exists():
            try:
                os.kill(int(shim_pid_file.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass


def test_candidate_progress_watchdog_signal_before_group_ready(tmp_path):
    shim_pid_file = tmp_path / "shim.pid"
    state_ref = tmp_path / "state-ref"
    env = _watchdog_test_env(tmp_path)
    env["WATCHDOG_STATE_REF"] = str(state_ref)
    setsid = tmp_path / "bin" / "setsid"
    setsid.write_text(
        f"#!{sys.executable}\n"
        "import os, signal, time\n"
        f"with open({str(shim_pid_file)!r}, 'w') as out: out.write(str(os.getpid()))\n"
        "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
        "time.sleep(30)\n"
    )
    fragment = pc._candidate_progress_watchdog_script(
        "/usr/bin/true", "printf steady", stall_seconds=30, poll_seconds=1,
        term_grace_seconds=1,
    )
    probe = (
        'mktemp() { local path; path=$(command mktemp "$@") || return; '
        'printf %s "$path" > "$WATCHDOG_STATE_REF"; printf %s "$path"; }\n'
    )
    proc = subprocess.Popen(
        ["bash", "-c", "set -euo pipefail\n" + probe + fragment],
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
        assert not os.path.exists(state_ref.read_text())
    finally:
        if shim_pid_file.exists():
            try:
                os.kill(int(shim_pid_file.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass
        if proc.poll() is None:
            proc.kill()
            proc.communicate(timeout=2)


def test_candidate_progress_watchdog_signal_at_handler_handoff(tmp_path):
    """Signal while a successful readiness probe is returning, before final traps."""
    state_ref = tmp_path / "state-ref"
    leader_pid_file = tmp_path / "leader.pid"
    descendant_pid_file = tmp_path / "descendant.pid"
    handoff_gate = tmp_path / "at-handoff"
    handoff_release = tmp_path / "release-handoff"
    env = _watchdog_test_env(tmp_path)
    env.update(WATCHDOG_STATE_REF=str(state_ref), WATCHDOG_DESC_FILE=str(descendant_pid_file),
               WATCHDOG_HANDOFF_GATE=str(handoff_gate), WATCHDOG_HANDOFF_RELEASE=str(handoff_release))
    descendant = (
        "trap '' HUP INT TERM; "
        f"echo $$ > {shlex.quote(str(descendant_pid_file))}; "
        "while :; do sleep 1; done"
    )
    worker = (
        "bash -c " + shlex.quote(descendant) + " & "
        f"echo $$ > {shlex.quote(str(leader_pid_file))}; "
        "trap 'exit 143' TERM; while :; do sleep 1; done"
    )
    fragment = pc._candidate_progress_watchdog_script(
        "bash -c " + shlex.quote(worker), "printf steady",
        stall_seconds=30, poll_seconds=1, term_grace_seconds=1,
    )
    probe = (
        'mktemp() { local path; path=$(command mktemp "$@") || return; '
        'printf %s "$path" > "$WATCHDOG_STATE_REF"; printf %s "$path"; }\n'
        'kill() { local rc=0; builtin kill "$@" || rc=$?; '
        'if [ "${1:-}" = -0 ] && [ "${2:-}" = -- ] '
        '&& [ "${3:-}" = "-$SYNC_PID" ] && [ "$rc" -eq 0 ] '
        '&& [ "$SYNC_READY" = "ready:$SYNC_PID" ] '
        '&& [ ! -e "$WATCHDOG_HANDOFF_GATE" ]; then '
        ': > "$WATCHDOG_HANDOFF_GATE"; '
        'for _ in $(seq 1 200); do [ -s "$WATCHDOG_DESC_FILE" ] && break; sleep 0.01; done; '
        'for _ in $(seq 1 300); do [ -e "$WATCHDOG_HANDOFF_RELEASE" ] && break; sleep 0.01; done; '
        'fi; return "$rc"; }\n'
    )
    proc = subprocess.Popen(
        ["bash", "-c", "set -euo pipefail\n" + probe + fragment],
        text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env,
    )
    try:
        deadline = time.time() + 3
        while not handoff_gate.exists() and time.time() < deadline:
            time.sleep(0.01)
        assert handoff_gate.exists() and descendant_pid_file.exists()
        proc.terminate()
        handoff_release.write_text("release")
        _stdout, stderr = proc.communicate(timeout=7)
        assert proc.returncode == 143, stderr
        leader_pid = int(leader_pid_file.read_text())
        assert leader_pid != os.getpgrp()
        assert _wait_pid_gone(leader_pid)
        assert _wait_pid_gone(int(descendant_pid_file.read_text()))
        try:
            os.killpg(leader_pid, 0)
        except ProcessLookupError:
            pass
        else:
            pytest.fail("isolated sync process group survived watchdog cleanup")
        assert not os.path.exists(state_ref.read_text())
    finally:
        handoff_release.write_text("release")
        if leader_pid_file.exists():
            leader_pid = int(leader_pid_file.read_text())
            if leader_pid != os.getpgrp():
                try:
                    os.killpg(leader_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        if proc.poll() is None:
            proc.kill()
            proc.communicate(timeout=2)


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
    timers = [
        threading.Timer(0.5, progress_file.write_text, args=("1",)),
        threading.Timer(1.5, progress_file.write_text, args=("2",)),
    ]
    for timer in timers:
        timer.start()
    try:
        result = subprocess.run(
            ["bash", "-c", "set -euo pipefail\n" + fragment],
            text=True,
            capture_output=True,
            timeout=8,
            env=_watchdog_test_env(tmp_path),
        )
    finally:
        for timer in timers:
            timer.cancel()
    assert result.returncode == 0, result.stderr
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


def test_candidate_script_isolated_config_database_model_and_timeouts(tmp_path):
    settings = pc._embedding_settings(cfg(tmp_path))
    script = pc._candidate_build_script(cfg(tmp_path), settings)
    assert "export GBRAIN_HOME=/sandbox/.prime-claw/qwen-candidate" in script
    assert "GBRAIN_AI_EMBED_TIMEOUT_MS=1000000" in script
    assert "GBRAIN_QUERY_EMBED_TIMEOUT_MS=1000000" in script
    assert "GBRAIN_SYNC_MAX_RUNTIME_SECONDS=12000" in script
    assert "GBRAIN_SYNC_STALL_ABORT_SECONDS=1200" in script
    assert "GBRAIN_DATABASE_URL=postgresql://gbrain:gbrain@localhost:5433/gbrain_qwen4096" in script
    assert "DATABASE_URL=postgresql://gbrain:gbrain@localhost:5433/gbrain_qwen4096" in script
    assert "GBRAIN_EMBEDDING_MODEL=openai:Qwen3-Embedding-8B" in script
    assert "GBRAIN_EMBEDDING_DIMENSIONS=4096" in script
    assert "OPENAI_API_KEY=dummy" in script
    assert "export OPENAI_BASE_URL=$(python3 -c" in script
    assert "/sandbox/.prime-claw/qwen-candidate/.gbrain/config.json" in script
    assert "/sandbox/.gbrain/config.json" not in script
    assert "gbrain_qwen4096" in script
    assert "gbrain init --migrate-only --non-interactive" in script
    assert "gbrain init --migrate-only --url" not in script
    assert "--embedding-model" not in script
    assert "--embedding-dimensions" not in script
    assert "gbrain sync --source brain --full --no-pull --no-extract --workers 1 --yes" in script
    assert "--skip-failed" not in script
    assert "sources add brain --path /sandbox/brain" in script
    assert "sources add brain --path /sandbox/brain --force" not in script
    assert "SELECT COALESCE(local_path,'') FROM sources WHERE id='brain'" in script
    assert "vector(4096)" in script
    assert "embedded_at IS NULL" in script
    assert "embedded_text_hash IS DISTINCT FROM md5(c.chunk_text)" in script
    assert "p.embedding_signature IS DISTINCT FROM 'openai:Qwen3-Embedding-8B:4096'" in script
    assert "idx_chunks_embedding" in script
    assert "LAST_COMMIT" in script and '[ "$LAST_COMMIT" = "$BRAIN_HEAD" ]' in script
    assert "--full --no-pull --no-extract --workers 1 --dry-run --yes" in script
    assert "EXPECTED_FILES=" in script and '[ "$P" = "$EXPECTED_FILES" ]' in script
    assert "count(DISTINCT source_path)" in script and '[ "$PATHS" = "$P" ]' in script
    assert 'BRAIN_HEAD_AFTER=' in script and '[ "$BRAIN_HEAD_AFTER" = "$BRAIN_HEAD" ]' in script
    assert 'status --json' in script and 'unacknowledged_failures' in script
    assert '[ "$UNACK" = 0 ]' in script and 'status --porcelain' in script
    assert "DROP DATABASE" not in script.upper()
    assert "ALTER DATABASE" not in script.upper()

    payload = re.search(r"printf %s ([A-Za-z0-9+/=]+) \| base64 -d", script)
    assert payload, "candidate config payload missing"
    candidate = json.loads(base64.b64decode(payload.group(1)))
    assert candidate == {
        "engine": "postgres",
        "database_url": "postgresql://gbrain:gbrain@localhost:5433/gbrain_qwen4096",
        "embedding_model": "openai:Qwen3-Embedding-8B",
        "embedding_dimensions": 4096,
        "provider_base_urls": {"openai": FAKE_BASE_URL},
        "openai_api_key": "dummy",
    }


@pytest.mark.parametrize("fault, reached", [
    ("none", "psql-bookmark"),
    ("dirty", "git-status-post"),
    ("changed_head", "git-head-post"),
    ("unack", "gbrain-status"),
    ("pages", "psql-pages"),
    ("paths", "psql-paths"),
    ("chunks", "psql-chunks"),
    ("bad_vector", "psql-bad-vector"),
    ("schema", "psql-schema"),
    ("index", "psql-index"),
    ("bookmark", "psql-bookmark"),
])
def test_candidate_generated_sync_fast_success_reaches_post_sync_gates(tmp_path, fault, reached):
    """Run the exact generated sync suffix with only synthetic command boundaries."""
    build = pc._candidate_build_script(cfg(tmp_path), pc._embedding_settings(cfg(tmp_path)))
    source_anchor = "SOURCE_STATUS=$(git -C "
    assert build.count(source_anchor) == 1
    sync_suffix = build[build.index(source_anchor):]
    assert "setsid gbrain sync --source brain --full --no-pull --no-extract --workers 1 --yes 2>&1 &" in sync_suffix
    events = tmp_path / "events"
    done = tmp_path / "worker-done"
    gate = tmp_path / "failed-group-probe"
    state_ref = tmp_path / "state-ref"
    env = _watchdog_test_env(tmp_path)
    env.update(FAKE_EVENTS=str(events), FAKE_WORKER_DONE=str(done),
               FAKE_GROUP_GATE=str(gate), FAKE_STATE_REF=str(state_ref),
               FAKE_FAULT=fault, FAKE_DIR=str(tmp_path))
    fake_bin = tmp_path / "bin"
    setsid = fake_bin / "setsid"
    setsid.write_text(
        f"#!{sys.executable}\n"
        "import os, sys, time\n"
        f"while not os.path.exists({str(gate)!r}): time.sleep(0.005)\n"
        "os.setsid()\n"
        "os.execvp(sys.argv[1], sys.argv[1:])\n"
    )
    for name, body in {
        "git": r"""
import os, sys
from pathlib import Path
p = Path(os.environ['FAKE_DIR'])
args = sys.argv[1:]
assert args[0] == '-C' and args[2] in ('status', 'rev-parse'), args
kind = 'status' if args[2] == 'status' else 'head'
marker = p / ('git-' + kind + '-seen')
phase = 'post' if marker.exists() else 'pre'
marker.touch()
with open(os.environ['FAKE_EVENTS'], 'a') as log: log.write('git-' + kind + '-' + phase + '\n')
if kind == 'status':
    if phase == 'post' and os.environ['FAKE_FAULT'] == 'dirty': print(' M synthetic.md')
else:
    print('changed' if phase == 'post' and os.environ['FAKE_FAULT'] == 'changed_head' else 'abc')
""",
        "gbrain": r"""
import os, sys
from pathlib import Path
args = sys.argv[1:]
if args[0] == 'sync':
    if '--dry-run' in args:
        with open(os.environ['FAKE_EVENTS'], 'a') as log: log.write('gbrain-dry-run\n')
        print('Full-sync dry run (strategy=markdown): 2 file(s) would be imported from <synthetic> @ abc.')
    else:
        assert args == ['sync', '--source', 'brain', '--full', '--no-pull', '--no-extract', '--workers', '1', '--yes'], args
        with open(os.environ['FAKE_EVENTS'], 'a') as log: log.write('gbrain-sync-worker\n')
        Path(os.environ['FAKE_WORKER_DONE']).touch()
elif args == ['status', '--json']:
    with open(os.environ['FAKE_EVENTS'], 'a') as log: log.write('gbrain-status\n')
    print('{"sync":{"unacknowledged_failures":' + ('1' if os.environ['FAKE_FAULT'] == 'unack' else '0') + '}}')
else:
    raise SystemExit('unexpected synthetic gbrain command')
""",
        "psql": r"""
import os, sys
q = sys.argv[-1]
if 'concat_ws(' in q: key, value = 'progress', '2|3|3|time'
elif 'vector_dims(' in q: key, value = 'bad-vector', '0'
elif 'format_type(' in q: key, value = 'schema', 'vector(4096)'
elif 'FROM pg_indexes' in q: key, value = 'index', '0'
elif 'COALESCE(last_commit' in q: key, value = 'bookmark', 'abc'
elif 'count(DISTINCT source_path)' in q: key, value = 'paths', '2'
elif 'FROM content_chunks c JOIN pages' in q: key, value = 'chunks', '3'
elif 'FROM pages WHERE' in q: key, value = 'pages', '2'
else: raise SystemExit('unexpected synthetic SQL')
with open(os.environ['FAKE_EVENTS'], 'a') as log: log.write('psql-' + key + '\n')
fault = os.environ['FAKE_FAULT']
if (fault, key) in {('pages', 'pages'), ('paths', 'paths'), ('chunks', 'chunks')}:
    value = '0'
elif fault == 'bad_vector' and key == 'bad-vector': value = '1'
elif fault == 'schema' and key == 'schema': value = 'vector(1536)'
elif fault == 'index' and key == 'index': value = '1'
elif fault == 'bookmark' and key == 'bookmark': value = 'stale'
print(value)
""",
    }.items():
        executable = fake_bin / name
        executable.write_text(f"#!{sys.executable}\n" + body)
        executable.chmod(0o755)
    # Keep the generated suffix byte-for-byte. The real negative group probe
    # starts a held setsid shim; release it, then return that SAME failed probe
    # only after the attested worker exits. Never manufacture a success result.
    instrumentation = (
        'mktemp() { local path; path=$(command mktemp "$@") || return; '
        'printf %s "$path" > "$FAKE_STATE_REF"; printf %s "$path"; }\n'
        'kill() { local rc=0; builtin kill "$@" || rc=$?; '
        'if [ "${1:-}" = -0 ] && [ "${2:-}" = -- ] '
        '&& [ "${3:-}" = "-$SYNC_PID" ] && [ "$rc" -ne 0 ] '
        '&& [ ! -e "$FAKE_GROUP_GATE" ]; then '
        ': > "$FAKE_GROUP_GATE"; '
        'for _ in $(seq 1 300); do '
        'if [ -e "$FAKE_WORKER_DONE" ] && ! builtin kill -0 "$SYNC_PID" 2>/dev/null; '
        'then break; fi; sleep 0.01; done; '
        '[ -e "$FAKE_WORKER_DONE" ] || return 99; '
        '[ "$(cat "$WATCHDOG_STATE")" = "ready:$SYNC_PID" ] || return 98; '
        'printf "attested-fast\n" >> "$FAKE_EVENTS"; sleep 0.1; '
        'fi; return "$rc"; }\n'
    )
    result = subprocess.run(
        ["bash", "-c", "set -euo pipefail\n" + instrumentation + sync_suffix],
        env=env, text=True, capture_output=True, timeout=12,
    )
    observed = events.read_text().splitlines() if events.exists() else []
    assert done.exists() and gate.exists() and "attested-fast" in observed, (result.stderr, observed)
    assert reached in observed, (fault, result.returncode, result.stderr, observed)
    assert (result.returncode == 0) == (fault == "none"), (fault, result.stderr, observed)
    if fault == "none":
        assert "candidate-build head=abc bookmark=abc" in result.stdout
        assert all(name in observed for name in (
            "git-status-post", "git-head-post", "gbrain-status", "psql-pages",
            "psql-paths", "psql-chunks", "psql-bad-vector", "psql-schema",
            "psql-index", "psql-bookmark")), observed
    assert not os.path.exists(state_ref.read_text())


def test_candidate_full_source_gates_reject_missing_or_stale_rows(tmp_path):
    """Exercise the generated source-count/vector/bookmark gates without a DB."""
    script = pc._candidate_build_script(cfg(tmp_path), pc._embedding_settings(cfg(tmp_path)))
    line = next(line for line in script.splitlines() if line.startswith('EXPECTED_FILES='))
    for text, expected_ok in (
            ("Full-sync dry run (strategy=markdown): 1117 file(s) would be imported from <source> @ abc.", True),
            ("Full-sync dry run: 1117 file(s) would be imported", False)):
        result = subprocess.run(["bash", "-euo", "pipefail", "-c",
                                 "DRY_OUTPUT=$1; " + line + '; [ "${EXPECTED_FILES:-0}" -gt 0 ]',
                                 "_", text], capture_output=True, text=True, timeout=5)
        assert (result.returncode == 0) is expected_ok
    gates = "\n".join(line for line in script.splitlines()
                      if line.startswith('[ "${P:-0}"') or line == '[ "$LAST_COMMIT" = "$BRAIN_HEAD" ]'
                      or line == '[ "$UNACK" = 0 ]'
                      or line == '[ "$BRAIN_HEAD_AFTER" = "$BRAIN_HEAD" ]')
    good = dict(os.environ, P="1117", EXPECTED_FILES="1117", PATHS="1117", C="3000",
                BAD="0", COLTYPE="vector(4096)", HNSW="0", UNACK="0",
                BRAIN_HEAD="abc", BRAIN_HEAD_AFTER="abc", LAST_COMMIT="abc")
    for changes, expected_ok in (({}, True), ({"P": "1116"}, False),
                                 ({"PATHS": "1116"}, False), ({"C": "0"}, False),
                                 ({"BAD": "1"}, False), ({"COLTYPE": "vector(1536)"}, False),
                                 ({"HNSW": "1"}, False), ({"UNACK": "1"}, False),
                                 ({"BRAIN_HEAD_AFTER": "moved"}, False),
                                 ({"LAST_COMMIT": "stale"}, False)):
        result = subprocess.run(["bash", "-euo", "pipefail", "-c", gates],
                                env={**good, **changes}, capture_output=True,
                                text=True, timeout=5)
        assert (result.returncode == 0) is expected_ok, changes


def test_candidate_dry_run_has_no_external_calls_or_private_output(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(pc, "run", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no command")))
    monkeypatch.setattr(pc, "sandbox_exec", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no sandbox")))
    monkeypatch.setattr(pc, "_write_private_file", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no write")))
    assert pc.cmd_embedding_build(cfg(tmp_path), Args(dry_run=True)) == 0
    output = capsys.readouterr().out
    assert "canonical config/DB untouched" in output
    assert FAKE_BASE_URL not in output
    assert "embedding.test.invalid" not in output


def test_candidate_build_versions_applies_candidate_policy_and_runs_isolated_script(tmp_path, monkeypatch, capsys):
    sandbox_calls = []
    def fake_sandbox(_cfg, script, timeout=30):
        sandbox_calls.append((script, timeout))
        if script == "gbrain --version":
            return 0, "gbrain 0.50.0.0"
        return 0, "candidate-build pages=1057 chunks=3029 embedded=3029 dimensions=4096|4096"
    policy_calls = []
    monkeypatch.setattr(pc, "sandbox_exec", fake_sandbox)
    fingerprints = []
    monkeypatch.setattr(pc, "_canonical_embedding_fingerprint",
                        lambda *a: fingerprints.append(True) or (0, "same-fingerprint"))
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: policy_calls.append((cmd, timeout)) or (0, "applied"))
    restored = []
    monkeypatch.setattr(pc, "_restore_historical_embedding_policy",
                        lambda *a: restored.append(True) or 0)

    c = cfg(tmp_path)
    assert pc.cmd_embedding_build(c, Args()) == 0
    assert sandbox_calls[0] == ("gbrain --version", 60)
    assert sandbox_calls[1][1] == 14400
    assert "gbrain_qwen4096" in sandbox_calls[1][0]
    assert len(policy_calls) == 1
    assert restored == [True]
    assert fingerprints == [True, True]
    assert policy_calls[0][0][0:3] == [pc.OPENSHELL, "policy", "set"]
    assert policy_calls[0][0][-2:] == [c["embedding_policy_file"], "--wait"]
    assert os.stat(c["embedding_policy_file"]).st_mode & 0o777 == 0o600
    output = capsys.readouterr().out
    assert "canonical config not switched" in output
    assert "policy: " not in output  # monkeypatched restore stays quiet
    assert FAKE_BASE_URL not in output and "embedding.test.invalid" not in output


def test_candidate_build_rejects_old_gbrain_before_policy_or_database(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(pc, "sandbox_exec", lambda *a, **k: (0, "gbrain 0.48.4.9"))
    monkeypatch.setattr(pc, "run", lambda *a, **k: (_ for _ in ()).throw(AssertionError("policy not applied")))
    monkeypatch.setattr(pc, "_write_private_file", lambda *a, **k: (_ for _ in ()).throw(AssertionError("policy not written")))
    assert pc.cmd_embedding_build(cfg(tmp_path), Args()) == 1
    assert "requires upstream gbrain >= 0.48.5.0" in capsys.readouterr().err


def test_candidate_policy_apply_failure_attempts_historical_restore(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(pc, "sandbox_exec", lambda *a, **k: (0, "gbrain 0.50.0.0"))
    fingerprints = []
    monkeypatch.setattr(pc, "_canonical_embedding_fingerprint",
                        lambda *a: fingerprints.append(True) or (0, "same-fingerprint"))
    monkeypatch.setattr(pc, "run", lambda *a, **k: (8, "policy rejected"))
    restored = []
    monkeypatch.setattr(pc, "_restore_historical_embedding_policy",
                        lambda *a: restored.append(True) or 0)
    assert pc.cmd_embedding_build(cfg(tmp_path), Args()) == 8
    assert restored == [True]
    assert fingerprints == [True, True]
    assert "candidate embedding policy apply failed" in capsys.readouterr().err


def test_candidate_build_failure_restores_historical_policy_and_redacts(tmp_path, monkeypatch, capsys):
    calls = iter([(0, "gbrain 0.50.0.0"), (9, "failed at " + FAKE_BASE_URL)])
    monkeypatch.setattr(pc, "sandbox_exec", lambda *a, **k: next(calls))
    fingerprints = []
    monkeypatch.setattr(pc, "_canonical_embedding_fingerprint",
                        lambda *a: fingerprints.append(True) or (0, "same-fingerprint"))
    monkeypatch.setattr(pc, "run", lambda *a, **k: (0, "applied"))
    restored = []
    monkeypatch.setattr(pc, "_restore_historical_embedding_policy",
                        lambda *a: restored.append(True) or 0)
    assert pc.cmd_embedding_build(cfg(tmp_path), Args()) == 9
    assert restored == [True]
    assert fingerprints == [True, True]  # post-fingerprint runs even after sync failure
    output = capsys.readouterr().err
    assert "candidate embedding build failed" in output
    assert FAKE_BASE_URL not in output and "embedding.test.invalid" not in output


def test_candidate_build_success_fails_if_historical_policy_restore_fails(tmp_path, monkeypatch, capsys):
    calls = iter([(0, "gbrain 0.50.0.0"), (0, "candidate complete")])
    monkeypatch.setattr(pc, "sandbox_exec", lambda *a, **k: next(calls))
    monkeypatch.setattr(pc, "_canonical_embedding_fingerprint", lambda *a: (0, "same-fingerprint"))
    monkeypatch.setattr(pc, "run", lambda *a, **k: (0, "candidate policy applied"))
    monkeypatch.setattr(pc, "_restore_historical_embedding_policy", lambda *a: 7)
    assert pc.cmd_embedding_build(cfg(tmp_path), Args()) == 7
    assert "build succeeded but historical policy restore failed" in capsys.readouterr().err


def test_canonical_fingerprint_covers_config_schema_content_bookmark_and_migrations(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(pc, "sandbox_exec",
                        lambda c, script, timeout=30: calls.append((script, timeout)) or (0, "fingerprint\n"))
    code, value = pc._canonical_embedding_fingerprint(cfg(tmp_path), pc._embedding_settings(cfg(tmp_path)))
    assert code == 0 and value == "fingerprint"
    script, timeout = calls[0]
    assert timeout == 60
    assert "sha256sum /sandbox/.gbrain/config.json" in script
    assert "-d gbrain" in script
    assert "format_type" in script
    assert "count(*)::text FROM pages" in script
    assert "count(*)::text FROM content_chunks" in script
    assert "embedding IS NULL" in script
    assert "last_commit" in script and "local_path" in script
    assert "embedding_model" in script and "embedding_dimensions" in script and "'version'" in script
    assert "gbrain_qwen4096" not in script


def test_candidate_build_rejects_canonical_fingerprint_drift(tmp_path, monkeypatch, capsys):
    calls = iter([(0, "gbrain 0.50.0.0"), (0, "candidate complete")])
    monkeypatch.setattr(pc, "sandbox_exec", lambda *a, **k: next(calls))
    fingerprints = iter([(0, "before"), (0, "after")])
    monkeypatch.setattr(pc, "_canonical_embedding_fingerprint", lambda *a: next(fingerprints))
    monkeypatch.setattr(pc, "run", lambda *a, **k: (0, "candidate policy applied"))
    monkeypatch.setattr(pc, "_restore_historical_embedding_policy", lambda *a: 0)
    assert pc.cmd_embedding_build(cfg(tmp_path), Args()) == 1
    assert "canonical embedding state changed" in capsys.readouterr().err


def test_historical_policy_restore_redacts_private_endpoint(tmp_path, monkeypatch, capsys):
    settings = pc._embedding_settings(cfg(tmp_path))
    monkeypatch.setattr(pc, "_write_private_file", lambda *a, **k: None)
    monkeypatch.setattr(pc, "run", lambda *a, **k: (7, "failed " + FAKE_BASE_URL))
    assert pc._restore_historical_embedding_policy(cfg(tmp_path), settings) == 7
    output = capsys.readouterr().err
    assert "historical policy restore failed" in output
    assert FAKE_BASE_URL not in output and "embedding.test.invalid" not in output


def test_sync_timeout_contract_rejects_stall_shorter_than_model_request(tmp_path):
    with pytest.raises(ValueError):
        pc._embedding_settings(cfg(tmp_path, embedding_sync_stall_abort_seconds=1000))
    with pytest.raises(ValueError):
        pc._embedding_settings(cfg(tmp_path, embedding_sync_max_runtime_seconds=1200,
                                   embedding_sync_stall_abort_seconds=1200))


def test_candidate_build_timeout_must_exceed_sync_runtime(tmp_path, monkeypatch):
    monkeypatch.setattr(pc, "sandbox_exec", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no sandbox")))
    assert pc.cmd_embedding_build(cfg(tmp_path, embedding_build_timeout_seconds=1000), Args()) == 1


def test_candidate_build_is_not_wired_into_create_or_converge():
    assert "cmd_embedding_build" not in inspect.getsource(pc.cmd_create)
    assert "cmd_embedding_build" not in inspect.getsource(pc.cmd_converge)


def test_command_timeout_never_echoes_sensitive_argv(monkeypatch):
    def timeout(*_args, **_kwargs):
        raise pc.subprocess.TimeoutExpired(cmd=["openshell"], timeout=9)
    monkeypatch.setattr(pc.subprocess, "run", timeout)
    code, output = pc.run(["openshell", "encoded-private-config"], timeout=9)
    assert code == 124
    assert "encoded-private-config" not in output
    assert output == "timeout after 9s: openshell"


def test_embedding_build_verb_is_wired():
    assert pc.VERBS["embedding-build"] is pc.cmd_embedding_build
    args = pc.build_parser().parse_args(["--dry-run", "embedding-build"])
    assert args.verb == "embedding-build" and args.dry_run
