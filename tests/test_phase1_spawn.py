"""tests/test_phase1_spawn.py — Slice 5 (U3) artifact coverage.

Mutation-checked: asserts the apply/check/validate artifacts encode the U3
spawn/reap contract. These run offline (no sandbox); they guard the scripts'
shape so a future regression (e.g. dropped --cwd, dropped daemon kill, lost
sentinel proof) is caught by the suite.
"""
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPLY = os.path.join(REPO, "scripts", "apply-phase1-spawn.sh")
CHECK = os.path.join(REPO, "scripts", "check-phase1-spawn.sh")
VALIDATE = os.path.join(REPO, "scripts", "validate-phase1-spawn.py")
POLICY = os.path.join(REPO, "policies", "phase1-sandbox.yaml")


def read(p):
    with open(p) as f:
        return f.read()


def test_apply_creates_git_project():
    s = read(APPLY)
    assert "git init" in s and "git commit" in s
    assert "episode-target" in s
    assert "--dry-run" in s  # non-interactive dry-run supported


def test_apply_no_credential_access():
    s = read(APPLY)
    assert "host_credential_access: prohibited" in s


def test_check_gates_prime_agent_and_gitproj():
    s = read(CHECK)
    assert "prime-agent" in s and ".git" in s


def test_validator_proves_ru31_ru32_ru33():
    s = read(VALIDATE)
    for req in ("R-U3-1", "R-U3-2", "R-U3-3"):
        assert req in s, req + " not covered by validator"


def test_validator_daemon_spawn_reap():
    s = read(VALIDATE)
    # daemon create with config.cwd, get_state cwd read, kill reap
    assert '"create"' in s and "config: { cwd: proj" in s
    assert '"get_state"' in s
    assert '"kill"' in s
    assert "STILL_LISTED" in s  # reap confirmation


def test_validator_cli_cwd_proof_uses_sentinel():
    s = read(VALIDATE)
    assert ".cwd_sentinel" in s and "--cwd" in s


def test_validator_uses_daemon_client_rpc():
    s = read(VALIDATE)
    assert "DaemonClient" in s and "daemon-client.js" in s


def test_validator_credential_bridge_no_disk_secret():
    s = read(VALIDATE)
    # env bridge via placeholder; no real key written
    assert "ANTHROPIC_API_KEY" in s and "$api_key" in s


def test_validator_ru33_nonblocking_and_documents_race():
    s = read(VALIDATE)
    assert "automatic-preparation" in s or "admission race" in s
    assert ("non-blocking" in s.lower()) or ('"blocking": False' in s)


def test_verdict_doc_referenced():
    s = read(VALIDATE)
    assert "docs/derisk/U3.md" in s
