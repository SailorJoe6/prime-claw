"""Slice 4R: explicit per-operator brain repository configuration.

All boundaries are monkeypatched. These tests make no provider, sandbox, network,
or database calls.
"""
import json
import os
from importlib.machinery import SourceFileLoader

import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(REPO, "bin", "prime-claw")
pc = SourceFileLoader("primeclaw_brain_repo_config", BIN).load_module()


class Args:
    force = False
    signature = ""

    def __init__(self, dry_run=True):
        self.dry_run = dry_run


def local_cfg(repo="operator/brain"):
    return {
        "sandbox_name": "prime-claw",
        "image": "prime-claw-brain:0.1.0",
        "brain_repo": repo,
        "_local_override_keys": ["brain_repo"],
        "_local_config_path": os.path.realpath(os.path.join(
            REPO, ".prime-claw", "runtime.local.json")),
    }


def test_tracked_runtime_has_no_brain_repository_default():
    tracked = json.load(open(os.path.join(REPO, "config", "runtime.json")))
    assert "brain_repo" not in tracked


def test_ignored_local_config_is_recorded_as_explicit_operator_selection(tmp_path, monkeypatch):
    monkeypatch.delenv("PRIME_CLAW_BRAIN_REPO", raising=False)
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    local = tmp_path / ".prime-claw" / "runtime.local.json"
    local.parent.mkdir()
    local.write_text(json.dumps({"brain_repo": "operator/knowledge"}) + "\n")
    base = tmp_path / "runtime.json"
    base.write_text(json.dumps({
        "sandbox_name": "prime-claw",
        "image": "image",
        "local_config_file": str(local),
    }) + "\n")

    loaded = pc.load_config(str(base))
    selected = pc._brain_repo_selection(loaded)

    assert selected == {
        "repo": "operator/knowledge",
        "source": ".prime-claw/runtime.local.json",
    }
    assert "brain_repo" in loaded["_local_override_keys"]


def test_operator_overlay_cannot_supply_reserved_provenance_keys(tmp_path, monkeypatch):
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    local = tmp_path / ".prime-claw" / "runtime.local.json"
    local.parent.mkdir()
    local.write_text(json.dumps({
        "brain_repo": "operator/knowledge",
        "_local_override_keys": ["brain_repo"],
    }) + "\n")
    base = tmp_path / "runtime.json"
    base.write_text(json.dumps({"local_config_file": str(local)}) + "\n")

    with pytest.raises(ValueError, match="reserved internal keys"):
        pc.load_config(str(base))


def test_environment_selection_wins_over_operator_local_config(monkeypatch):
    monkeypatch.setenv("PRIME_CLAW_BRAIN_REPO", "environment/brain")
    assert pc._brain_repo_selection(local_cfg("local/brain")) == {
        "repo": "environment/brain",
        "source": "PRIME_CLAW_BRAIN_REPO",
    }


def test_value_or_forged_provenance_in_base_config_is_not_operator_selection(
        tmp_path, monkeypatch):
    monkeypatch.delenv("PRIME_CLAW_BRAIN_REPO", raising=False)
    base = tmp_path / "runtime.json"
    base.write_text(json.dumps({
        "brain_repo": "tracked/must-not-win",
        "_local_override_keys": ["brain_repo"],
        "_local_config_path": os.path.realpath(os.path.join(
            REPO, ".prime-claw", "runtime.local.json")),
    }) + "\n")
    loaded = pc.load_config(str(base))
    assert "_local_override_keys" not in loaded
    assert "_local_config_path" not in loaded
    with pytest.raises(ValueError, match="brain_repo is required"):
        pc._brain_repo_selection(loaded)


def test_noncanonical_overlay_cannot_supply_repository_identity(tmp_path, monkeypatch):
    monkeypatch.delenv("PRIME_CLAW_BRAIN_REPO", raising=False)
    overlay = tmp_path / "tracked-overlay.json"
    overlay.write_text(json.dumps({"brain_repo": "tracked/must-not-win"}) + "\n")
    base = tmp_path / "runtime.json"
    base.write_text(json.dumps({"local_config_file": str(overlay)}) + "\n")
    loaded = pc.load_config(str(base))
    assert loaded["brain_repo"] == "tracked/must-not-win"
    with pytest.raises(ValueError, match="brain_repo is required"):
        pc._brain_repo_selection(loaded)


@pytest.mark.parametrize("repo", [
    "", "owner", "/repository", "owner/", "owner/repository/extra",
    "https://github.com/owner/repository", "owner/repository.git",
    "owner/repository with spaces", " owner/repository", "owner-/repository",
])
def test_malformed_repository_selection_is_rejected(repo, monkeypatch):
    monkeypatch.delenv("PRIME_CLAW_BRAIN_REPO", raising=False)
    with pytest.raises(ValueError, match="GitHub owner/repository slug"):
        pc._brain_repo_selection(local_cfg(repo))


@pytest.mark.parametrize("command", [
    lambda cfg: pc.cmd_create(cfg, Args()),
    lambda cfg: pc.cmd_converge(cfg, Args()),
    lambda cfg: pc.cmd_validate(cfg, Args()),
    lambda cfg: pc.cmd_recover(cfg, Args()),
    lambda cfg: pc.cmd_embedding_build(cfg, Args()),
    lambda cfg: pc.cmd_status(cfg, Args()),
])
@pytest.mark.parametrize("repo", [None, "owner/repository.git"])
def test_missing_or_malformed_repo_fails_before_any_boundary(
        command, repo, monkeypatch, capsys):
    monkeypatch.delenv("PRIME_CLAW_BRAIN_REPO", raising=False)

    def unexpected(*args, **kwargs):
        raise AssertionError("external or profile boundary called before brain_repo gate")

    for name in (
        "run", "sandbox_exec", "probe_gateway", "probe_sandbox",
        "detect_degradations", "_resolve_runtime_profiles", "_embedding_settings",
    ):
        monkeypatch.setattr(pc, name, unexpected)

    config = {"sandbox_name": "prime-claw", "image": "image"}
    if repo is not None:
        config.update(
            brain_repo=repo,
            _local_override_keys=["brain_repo"],
            _local_config_path=os.path.realpath(os.path.join(
                REPO, ".prime-claw", "runtime.local.json")),
        )
    assert command(config) == 1
    captured = capsys.readouterr()
    message = captured.err + captured.out
    assert "brain_repo" in message
    assert "PRIME_CLAW_BRAIN_REPO" in message
    assert ".prime-claw/runtime.local.json" in message



@pytest.mark.parametrize(("key", "value", "message"), [
    ("brain_branch", "main; touch /tmp/pwn", "brain_branch"),
    ("brain_branch", "feature/../escape", "brain_branch"),
    ("sb_brain_dir", "/sandbox/brain; touch /tmp/pwn", "sb_brain_dir"),
    ("sb_brain_dir", "/", "sb_brain_dir"),
    ("sb_brain_dir", "/sandbox/../etc", "sb_brain_dir"),
    ("github_host", "github.com; touch /tmp/pwn", "github_host"),
    ("github_host", "https://github.com", "github_host"),
    ("github_host", "github.com:443", "github_host"),
    ("brain_clone_attempts", "not-an-int", "brain_clone_attempts"),
    ("brain_clone_attempts", 0, "brain_clone_attempts"),
    ("brain_clone_attempts", 21, "brain_clone_attempts"),
    ("brain_clone_attempts", 1.5, "brain_clone_attempts"),
    ("brain_clone_attempts", 20.9, "brain_clone_attempts"),
    ("brain_clone_attempts", float("inf"), "brain_clone_attempts"),
    ("brain_clone_attempts", "1.5", "brain_clone_attempts"),
    ("brain_clone_retry_delay", "nan", "brain_clone_retry_delay"),
    ("brain_clone_retry_delay", -1, "brain_clone_retry_delay"),
    ("brain_clone_retry_delay", 301, "brain_clone_retry_delay"),
])
def test_unsafe_clone_settings_fail_before_any_boundary(
        key, value, message, monkeypatch, capsys):
    monkeypatch.delenv("PRIME_CLAW_BRAIN_REPO", raising=False)
    config = local_cfg()
    config[key] = value

    def unexpected(*args, **kwargs):
        raise AssertionError("boundary called before repository settings gate")

    monkeypatch.setattr(pc, "_resolve_runtime_profiles", unexpected)
    monkeypatch.setattr(pc, "sandbox_exec", unexpected)

    assert pc.cmd_create(config, Args()) == 1
    assert message in capsys.readouterr().err
    assert pc.stage_brain_clone(config, Args(dry_run=False)) == 1


def test_safe_clone_settings_are_shell_quoted_and_reach_clone(monkeypatch):
    monkeypatch.delenv("PRIME_CLAW_BRAIN_REPO", raising=False)
    config = local_cfg("operator/knowledge")
    config.update(
        brain_branch="feature/safe-name",
        sb_brain_dir="/data/operator-brain",
        github_host="github.example.com",
    )
    seen = {}
    monkeypatch.setattr(
        pc, "sandbox_exec",
        lambda cfg, script, timeout=30: (seen.setdefault("script", script), 0, "ok")[1:],
    )

    assert pc.stage_brain_clone(config, Args(dry_run=False)) == 0
    script = seen["script"]
    assert "github.example.com/operator/knowledge.git" in script
    assert "feature/safe-name" in script
    assert "rm -rf -- /data/operator-brain" in script

def test_direct_clone_fails_before_sandbox_call(monkeypatch, capsys):
    monkeypatch.delenv("PRIME_CLAW_BRAIN_REPO", raising=False)
    monkeypatch.setattr(
        pc, "sandbox_exec",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("no sandbox call")),
    )

    assert pc.stage_brain_clone({"sandbox_name": "prime-claw"}, Args()) == 1
    assert "brain_repo" in capsys.readouterr().err


def test_explicit_local_repository_reaches_clone_without_personal_fallback(monkeypatch):
    monkeypatch.delenv("PRIME_CLAW_BRAIN_REPO", raising=False)
    seen = {}
    monkeypatch.setattr(
        pc, "sandbox_exec",
        lambda cfg, script, timeout=30: (seen.setdefault("script", script), 0, "ok")[1:],
    )

    assert pc.stage_brain_clone(local_cfg("operator/knowledge"), Args(dry_run=False)) == 0
    assert "github.com/operator/knowledge.git" in seen["script"]


def test_explicit_environment_repository_reaches_clone(monkeypatch):
    monkeypatch.setenv("PRIME_CLAW_BRAIN_REPO", "environment/knowledge")
    seen = {}
    monkeypatch.setattr(
        pc, "sandbox_exec",
        lambda cfg, script, timeout=30: (seen.setdefault("script", script), 0, "ok")[1:],
    )

    assert pc.stage_brain_clone({"sandbox_name": "prime-claw"}, Args(dry_run=False)) == 0
    assert "github.com/environment/knowledge.git" in seen["script"]
