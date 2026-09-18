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
