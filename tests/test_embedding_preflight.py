"""Slice 4A home-Qwen configuration and policy preflight tests.

Offline only. The reserved ``.invalid`` endpoint is synthetic; no home endpoint,
network request, OpenShell call, or database mutation is used.
"""
import json
import os
import stat
from importlib.machinery import SourceFileLoader

import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(REPO, "bin", "prime-claw")
pc = SourceFileLoader("primeclaw_embedding_preflight", BIN).load_module()
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
    }
    c.update(over)
    return c


def test_runtime_config_has_safe_defaults_but_no_private_endpoint():
    tracked = json.load(open(os.path.join(REPO, "config", "runtime.json")))
    assert "embedding_base_url" not in tracked
    assert tracked["embedding_profile"] == "gateway"
    assert tracked["gateway_embedding_model"] == "openai:text-embedding-3-large"
    assert tracked["gateway_embedding_dimensions"] == 1536
    assert tracked["home_embedding_model"] == "Qwen3-Embedding-8B"
    assert tracked["home_embedding_dimensions"] == 4096
    assert tracked["home_embedding_timeout_seconds"] == 1000
    assert tracked["home_embedding_api_key"] == "dummy"
    assert tracked["model"] == "anthropic/anthropic.kimi-k3"
    assert tracked["embedding_database"] != tracked["embedding_legacy_database"]


def test_load_config_overlays_only_declared_operator_local_file(tmp_path, monkeypatch):
    base = tmp_path / "runtime.json"
    local = tmp_path / "runtime.local.json"
    base.write_text(json.dumps({"sandbox_name": "base", "local_config_file": str(local)}))
    local.write_text(json.dumps({"embedding_base_url": FAKE_BASE_URL}))
    loaded = pc.load_config(str(base))
    assert loaded["sandbox_name"] == "base"
    assert loaded["embedding_base_url"] == FAKE_BASE_URL

    hermetic = tmp_path / "hermetic.json"
    hermetic.write_text(json.dumps({"sandbox_name": "hermetic"}))
    assert "embedding_base_url" not in pc.load_config(str(hermetic))


def test_environment_overrides_local_embedding_endpoint(tmp_path, monkeypatch):
    c = cfg(tmp_path)
    override = "https://override.test.invalid:9443/v1"
    monkeypatch.setenv("PRIME_CLAW_EMBEDDING_BASE_URL", override)
    settings = pc._embedding_settings(c)
    assert settings["base_url"] == override
    assert settings["policy_host"] == "override.test.invalid"
    assert settings["policy_port"] == 9443


def test_embedding_contract_is_locked_and_parallel(tmp_path):
    settings = pc._embedding_settings(cfg(tmp_path))
    assert settings["model_ref"] == "openai:Qwen3-Embedding-8B"
    assert settings["dimensions"] == 4096
    assert settings["timeout_seconds"] == 1000
    assert settings["timeout_ms"] == 1_000_000
    assert settings["api_key"] == "dummy"
    assert settings["database"] == "gbrain_qwen4096"
    assert settings["legacy_database"] == "gbrain"

    invalid = [
        {"embedding_model": "text-embedding-3-large"},
        {"embedding_dimensions": 1536},
        {"embedding_timeout_seconds": 60},
        {"embedding_api_key": "secret-looking-value"},
        {"embedding_database": "gbrain"},
        {"embedding_database": "unsafe-name;drop"},
    ]
    for override in invalid:
        with pytest.raises(ValueError):
            pc._embedding_settings(cfg(tmp_path, **override))


def test_embedding_endpoint_rejects_credentials_query_and_fragment(tmp_path):
    bad = [
        "http://user:pass@embedding.test.invalid:7997/v1",
        "http://embedding.test.invalid:7997/v1?token=nope",
        "http://embedding.test.invalid:7997/v1#fragment",
        "ftp://embedding.test.invalid/v1",
    ]
    for value in bad:
        with pytest.raises(ValueError):
            pc._embedding_settings(cfg(tmp_path, embedding_base_url=value))


def test_policy_render_scopes_home_endpoint_to_gbrain_and_bun_only(tmp_path):
    c = cfg(tmp_path)
    settings = pc._embedding_settings(c)
    rendered, destination = pc._render_home_embedding_policy(c, settings)
    assert destination == c["embedding_policy_file"]
    assert "embedding.test.invalid" in rendered
    assert "port: 7997" in rendered

    gateway = rendered.split("  model_ai_gateway:", 1)[1].split(pc.HOME_EMBEDDING_POLICY_MARKER, 1)[0]
    assert "/usr/local/bin/gbrain" not in gateway
    assert "/usr/local/bin/bun" not in gateway

    home = rendered.split(pc.HOME_EMBEDDING_POLICY_MARKER, 1)[1].split("  model_openai_codex:", 1)[0]
    assert "/usr/local/bin/gbrain" in home
    assert "/usr/local/bin/bun" in home
    assert "/usr/bin/curl" not in home
    assert "ai-gateway.zende.sk" not in home


def test_preflight_writes_private_policy_and_redacts_endpoint(tmp_path, capsys):
    c = cfg(tmp_path)
    assert pc.cmd_embedding_preflight(c, Args()) == 0
    destination = tmp_path / "runtime-policy.local.yaml"
    assert destination.exists()
    assert stat.S_IMODE(destination.stat().st_mode) == 0o600
    assert "embedding.test.invalid" in destination.read_text()
    output = capsys.readouterr().out
    assert "PASS" in output and "endpoint=operator-local (redacted)" in output
    assert FAKE_BASE_URL not in output
    assert "embedding.test.invalid" not in output


def test_preflight_dry_run_does_not_write(tmp_path, capsys):
    c = cfg(tmp_path)
    assert pc.cmd_embedding_preflight(c, Args(dry_run=True)) == 0
    assert not (tmp_path / "runtime-policy.local.yaml").exists()
    output = capsys.readouterr().out
    assert "would render" in output
    assert FAKE_BASE_URL not in output


def test_pre_cutover_brain_index_ignores_target_qwen_settings(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(pc, "sandbox_exec", lambda c, script, timeout=30: calls.append(script) or (0, "ok"))
    c = cfg(tmp_path)
    assert pc.stage_brain_index(c, Args()) == 0
    joined = "\n".join(calls)
    assert "postgresql://gbrain:gbrain@localhost:5433/gbrain" in joined
    assert "--embedding-model openai:text-embedding-3-large" in joined
    assert "--embedding-dimensions 1536" in joined
    assert "gbrain_qwen4096" not in joined
    assert "Qwen3-Embedding-8B" not in joined


def test_embedding_preflight_verb_is_wired():
    assert pc.VERBS["embedding-preflight"] is pc.cmd_embedding_preflight
    args = pc.build_parser().parse_args(["--dry-run", "embedding-preflight"])
    assert args.verb == "embedding-preflight" and args.dry_run



def test_preflight_error_redacts_invalid_endpoint(tmp_path, capsys):
    private_bad = "http://user:secret@private-host.test.invalid:7997/v1?token=hidden"
    c = cfg(tmp_path, embedding_base_url=private_bad)
    assert pc.cmd_embedding_preflight(c, Args()) == 1
    captured = capsys.readouterr()
    combined = captured.out + captured.err
    assert private_bad not in combined
    assert "private-host.test.invalid" not in combined
    assert "secret" not in combined


def test_preflight_performs_no_command_network_or_database_calls(tmp_path, monkeypatch):
    c = cfg(tmp_path)
    monkeypatch.setattr(pc, "run", lambda *a, **k: (_ for _ in ()).throw(
        AssertionError("preflight must not run commands")))
    monkeypatch.setattr(pc, "sandbox_exec", lambda *a, **k: (_ for _ in ()).throw(
        AssertionError("preflight must not enter sandbox")))
    before = open(c["policy_file"], "rb").read()
    assert pc.cmd_embedding_preflight(c, Args()) == 0
    assert open(c["policy_file"], "rb").read() == before


def test_operator_local_config_and_rendered_policy_are_gitignored():
    ignored = open(os.path.join(REPO, ".gitignore")).read().splitlines()
    assert ".prime-claw/runtime.local.json" in ignored
    assert ".prime-claw/runtime-policy.local.yaml" in ignored

def test_tracked_policy_preserves_pre_cutover_runtime_but_marks_local_injection():
    policy = open(os.path.join(REPO, "policies", "runtime.yaml")).read()
    assert policy.count(pc.HOME_EMBEDDING_POLICY_MARKER) == 1
    gateway = policy.split("  model_ai_gateway:", 1)[1].split(pc.HOME_EMBEDDING_POLICY_MARKER, 1)[0]
    # Until the actual cutover, ordinary converge still serves the historical
    # index. Only the ignored candidate policy removes these routes.
    assert "/usr/local/bin/gbrain" in gateway
    assert "/usr/local/bin/bun" in gateway
