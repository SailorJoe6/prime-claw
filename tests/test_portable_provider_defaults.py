"""Slice 4P portable defaults and independent profile precedence.

All provider, sandbox, policy, and database boundaries are monkeypatched or inspected
as pure strings. No live credentials, network, sandbox, or database are used.
"""
import json
import os
from importlib.machinery import SourceFileLoader

import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(REPO, "bin", "prime-claw")
pc = SourceFileLoader("primeclaw_portable_defaults", BIN).load_module()


class Args:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.force = False


def hermetic_cfg(tmp_path, **over):
    cfg = json.load(open(os.path.join(REPO, "config", "runtime.json")))
    cfg.update({
        "host_settings_json": str(tmp_path / "missing-settings.json"),
        "host_models_json": str(tmp_path / "missing-models.json"),
        "host_auth_json": str(tmp_path / "missing-auth.json"),
        "active_policy_file": str(tmp_path / "runtime-policy.active.yaml"),
    })
    cfg.update(over)
    return cfg


def codex_host_pair(tmp_path, cfg):
    settings = tmp_path / "settings.json"
    models = tmp_path / "models.json"
    settings.write_text(json.dumps({
        "defaultProvider": "openai-codex",
        "defaultModel": "gpt-5.6-sol",
        "defaultThinkingLevel": "high",
    }) + "\n")
    models.write_text('{"providers":{}}\n')
    cfg.update(host_settings_json=str(settings), host_models_json=str(models))
    return cfg


def home_override(cfg):
    cfg.update({
        "embedding_base_url": "http://embedding.test.invalid:7997/v1",
        "_local_override_keys": ["embedding_base_url"],
    })
    return cfg


def test_tracked_defaults_are_portable_and_contain_no_private_endpoint(tmp_path):
    tracked = json.load(open(os.path.join(REPO, "config", "runtime.json")))
    assert tracked["model"] == "anthropic/anthropic.kimi-k3"
    assert tracked["embedding_profile"] == "gateway"
    assert tracked["gateway_embedding_model"] == "openai:text-embedding-3-large"
    assert tracked["gateway_embedding_dimensions"] == 1536
    assert "embedding_base_url" not in tracked
    assert "openai-codex/gpt" not in json.dumps(tracked)


def test_no_config_resolves_kimi_gateway_embedding_and_glm_catalog(tmp_path):
    profiles = pc._resolve_runtime_profiles(hermetic_cfg(tmp_path))
    assert profiles["inference"]["provider"] == "anthropic"
    assert profiles["inference"]["model"] == "anthropic.kimi-k3"
    assert profiles["inference"]["source"] == "tracked-default"
    assert profiles["embedding"]["profile"] == "gateway"
    assert profiles["embedding"]["model"] == "openai:text-embedding-3-large"
    assert profiles["embedding"]["dimensions"] == 1536
    catalog = json.loads(profiles["inference"]["models_text"])
    ids = {m["id"] for m in catalog["providers"]["anthropic"]["models"]}
    assert ids == {"anthropic.kimi-k3", "anthropic.glm-5.2"}
    assert profiles["provider_names"] == ["prime-claw-ai-gateway", "prime-claw-github"]


def test_valid_host_codex_overrides_inference_only(tmp_path):
    cfg = codex_host_pair(tmp_path, hermetic_cfg(tmp_path))
    profiles = pc._resolve_runtime_profiles(cfg)
    assert profiles["inference"]["source"] == "host-settings"
    assert profiles["inference"]["selector"] == "openai-codex/gpt-5.6-sol"
    assert profiles["embedding"]["profile"] == "gateway"
    assert profiles["embedding"]["dimensions"] == 1536
    assert profiles["provider_names"] == [
        "prime-claw-ai-gateway", "prime-claw-github", "prime-claw-codex"]


def test_local_home_embedding_overrides_embedding_only(tmp_path):
    profiles = pc._resolve_runtime_profiles(home_override(hermetic_cfg(tmp_path)))
    assert profiles["inference"]["selector"] == "anthropic/anthropic.kimi-k3"
    assert profiles["embedding"]["profile"] == "home-qwen"
    assert profiles["embedding"]["model_ref"] == "openai:Qwen3-Embedding-8B"
    assert profiles["embedding"]["dimensions"] == 4096
    assert profiles["provider_names"] == ["prime-claw-ai-gateway", "prime-claw-github"]


def test_codex_and_home_overrides_do_not_require_gateway(tmp_path):
    cfg = home_override(codex_host_pair(tmp_path, hermetic_cfg(tmp_path)))
    profiles = pc._resolve_runtime_profiles(cfg)
    assert profiles["inference"]["provider"] == "openai-codex"
    assert profiles["embedding"]["profile"] == "home-qwen"
    assert profiles["provider_names"] == ["prime-claw-github", "prime-claw-codex"]


def test_local_inference_override_beats_host_and_leaves_embedding_default(tmp_path):
    cfg = codex_host_pair(tmp_path, hermetic_cfg(tmp_path))
    cfg.update(model="anthropic/anthropic.glm-5.2", _local_override_keys=["model"])
    profiles = pc._resolve_runtime_profiles(cfg)
    assert profiles["inference"]["source"] == "operator-local"
    assert profiles["inference"]["selector"] == "anthropic/anthropic.glm-5.2"
    assert profiles["embedding"]["profile"] == "gateway"
    assert "prime-claw-codex" not in profiles["provider_names"]


def test_environment_overrides_inference_independently(tmp_path, monkeypatch):
    cfg = codex_host_pair(tmp_path, hermetic_cfg(tmp_path))
    monkeypatch.setenv("PRIME_CLAW_MODEL", "anthropic/anthropic.glm-5.2")
    profiles = pc._resolve_runtime_profiles(cfg)
    assert profiles["inference"]["source"] == "environment"
    assert profiles["inference"]["model"] == "anthropic.glm-5.2"
    assert profiles["embedding"]["dimensions"] == 1536


def test_malformed_or_incomplete_host_pair_falls_back_atomically(tmp_path):
    cfg = hermetic_cfg(tmp_path)
    settings = tmp_path / "settings.json"
    models = tmp_path / "models.json"
    settings.write_text('{not-json')
    models.write_text('{"providers":{}}')
    cfg.update(host_settings_json=str(settings), host_models_json=str(models))
    assert pc._inference_selection(cfg)["source"] == "tracked-default"
    settings.write_text(json.dumps({"defaultProvider": "anthropic", "defaultModel": "missing"}))
    assert pc._inference_selection(cfg)["source"] == "tracked-default"


def test_default_lifecycle_never_runs_codex_stage(tmp_path, monkeypatch):
    cfg = hermetic_cfg(tmp_path)
    order = []
    def rec(label):
        return lambda c, a: order.append(label) or 0
    monkeypatch.setattr(pc, "cmd_build", rec("build"))
    monkeypatch.setattr(pc, "stage_provider", rec("gateway"))
    monkeypatch.setattr(pc, "stage_github_provider", rec("github"))
    monkeypatch.setattr(pc, "stage_codex_provider",
                        lambda *a: (_ for _ in ()).throw(AssertionError("codex must be skipped")))
    monkeypatch.setattr(pc, "stage_sandbox", lambda c, a, force_fresh=False: order.append("sandbox") or 0)
    for name in ("stage_prime_agent", "stage_brain_clone", "stage_brain", "stage_brain_index",
                 "stage_brain_query", "stage_spawn", "stage_policy"):
        monkeypatch.setattr(pc, name, rec(name))
    assert pc.cmd_create(cfg, Args(dry_run=True)) == 0
    assert order[:3] == ["build", "gateway", "github"]
    assert "codex" not in order


def test_effective_policy_matches_required_provider_matrix(tmp_path):
    default_cfg = hermetic_cfg(tmp_path)
    default_text, _ = pc._render_effective_runtime_policy(default_cfg)
    assert "ai-gateway.zende.sk" in default_text
    assert "chatgpt.com" not in default_text
    assert "/usr/bin/node" in default_text
    assert "/usr/local/bin/gbrain" in default_text

    codex_cfg = codex_host_pair(tmp_path, hermetic_cfg(tmp_path))
    codex_text, _ = pc._render_effective_runtime_policy(codex_cfg)
    assert "ai-gateway.zende.sk" in codex_text  # embeddings
    assert "chatgpt.com" in codex_text          # inference

    both = home_override(codex_host_pair(tmp_path, hermetic_cfg(tmp_path)))
    both_text, _ = pc._render_effective_runtime_policy(both)
    assert "host: ai-gateway.zende.sk" not in both_text
    assert "embedding.test.invalid" in both_text
    assert "chatgpt.com" in both_text


def test_home_selection_fails_closed_before_lifecycle_mutation(tmp_path, monkeypatch, capsys):
    cfg = home_override(hermetic_cfg(tmp_path))
    monkeypatch.setattr(pc, "cmd_build",
                        lambda *a: (_ for _ in ()).throw(AssertionError("must fail before build")))
    assert pc.cmd_create(cfg, Args()) == 1
    assert "has not been cut over" in capsys.readouterr().err
    gate, profiles = pc._lifecycle_profile_gate(cfg, True)
    assert gate == 0 and profiles["embedding"]["profile"] == "home-qwen"


def test_populated_vector_width_mismatch_stops_before_migration(tmp_path, monkeypatch, capsys):
    cfg = hermetic_cfg(tmp_path)
    calls = []
    def fake_exec(c, script, timeout=30):
        calls.append(script)
        if "to_regclass('public.content_chunks')" in script:
            return 9, "rows=1140 column=vector(4096)"
        raise AssertionError("migration/sync must not run after mismatch")
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    assert pc.stage_brain_index(cfg, Args()) == 9
    assert len(calls) == 1
    assert "parallel rebuild/cutover" in capsys.readouterr().err


def test_brain_config_guard_refuses_existing_profile_mismatch(tmp_path, monkeypatch):
    cfg = hermetic_cfg(tmp_path)
    scripts = []
    def fake_exec(c, script, timeout=30):
        scripts.append(script)
        return 0, "ok"
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    assert pc.stage_brain(cfg, Args()) == 0
    import base64
    command = next(s for s in scripts if "base64 -d | python3" in s)
    payload = command.split("echo ", 1)[1].split(" |", 1)[0]
    wire = base64.b64decode(payload).decode()
    assert "openai:text-embedding-3-large" in wire
    assert "want_dims=1536" in wire
    assert "parallel rebuild/cutover" in wire


def test_invalid_host_shapes_and_empty_models_fall_back(tmp_path):
    cfg = hermetic_cfg(tmp_path)
    settings = tmp_path / "settings.json"
    models = tmp_path / "models.json"
    settings.write_text('[]')
    models.write_text('{}')
    cfg.update(host_settings_json=str(settings), host_models_json=str(models))
    assert pc._inference_selection(cfg)["source"] == "tracked-default"
    settings.write_text(json.dumps({
        "defaultProvider": "anthropic", "defaultModel": "anthropic.kimi-k3"}))
    models.write_text(json.dumps({"providers": {
        "anthropic": {"baseUrl": "https://ai-gateway.zende.sk/anthropic", "models": []}}}))
    assert pc._inference_selection(cfg)["source"] == "tracked-default"


def test_legacy_local_home_keys_override_tracked_home_defaults(tmp_path):
    cfg = home_override(hermetic_cfg(tmp_path))
    cfg.update(embedding_model="not-the-locked-model",
               _local_override_keys=["embedding_base_url", "embedding_model"])
    with pytest.raises(ValueError, match="embedding_model must be"):
        pc._embedding_settings(cfg)


def test_unsafe_inference_selector_fails_before_shell_use(tmp_path):
    cfg = hermetic_cfg(tmp_path)
    cfg.update(model="anthropic/good;touch-bad", _local_override_keys=["model"])
    with pytest.raises(ValueError, match="unsupported characters"):
        pc._resolve_runtime_profiles(cfg)


def test_gateway_host_override_flows_into_models_provider_and_policy(tmp_path, monkeypatch):
    cfg = hermetic_cfg(tmp_path, ai_gateway_host="gateway.example.test")
    profiles = pc._resolve_runtime_profiles(cfg)
    assert json.loads(profiles["inference"]["models_text"])["providers"]["anthropic"]["baseUrl"] ==         "https://gateway.example.test/anthropic"
    text, _ = pc._render_effective_runtime_policy(cfg, profiles)
    assert "host: gateway.example.test" in text
    assert "host: ai-gateway.zende.sk" not in text
    monkeypatch.setenv("PRIME_CLAW_PROVIDER_NAME", "custom-gateway-provider")
    assert pc._resolve_runtime_profiles(cfg)["provider_names"][0] == "custom-gateway-provider"


def test_gateway_provider_update_failure_does_not_advance_hash(tmp_path, monkeypatch):
    auth = tmp_path / "auth.json"
    auth.write_text(json.dumps({"anthropic": {"key": "TEST-KEY"}}))
    state = tmp_path / ".prime-claw-ai-gateway-key.sha256"
    state.write_text("old")
    cfg = hermetic_cfg(tmp_path, host_auth_json=str(auth))
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    def fake_run(cmd, timeout=30):
        if cmd[1:3] == ["provider", "get"]:
            return 0, "exists"
        if cmd[1:3] == ["provider", "update"]:
            return 11, "failed"
        raise AssertionError(cmd)
    monkeypatch.setattr(pc, "run", fake_run)
    assert pc.stage_provider(cfg, Args()) == 11
    assert state.read_text() == "old"


def test_state_guard_is_null_safe_and_checks_bookmark(tmp_path):
    cfg = hermetic_cfg(tmp_path)
    embedding = pc._gateway_embedding_settings(cfg)
    script = pc._embedding_state_guard_script(
        cfg, embedding, allow_empty=False, require_bookmark=True)
    assert "c.model IS DISTINCT FROM" in script
    assert "openai:text-embedding-3-large" in script
    assert "embedded_text_hash IS DISTINCT FROM md5(c.chunk_text)" in script
    assert "embedding_signature IS DISTINCT FROM" in script
    assert "openai:text-embedding-3-large:1536" in script
    assert "git -C /sandbox/brain rev-parse HEAD" in script
    assert "source bookmark mismatch" in script


def test_validate_home_profile_uses_candidate_gbrain_home_before_put(tmp_path, monkeypatch):
    cfg = home_override(hermetic_cfg(tmp_path))
    calls = []
    def fake_exec(c, script, timeout=30):
        calls.append(script)
        if "embedding-state" in script:
            return 7, "embedding-state vector width mismatch"
        raise AssertionError("validate must stop before mutation when state guard fails")
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    checks, failures = pc._validate_checks(cfg, Args())
    assert failures == ["selected-embedding-state"]
    guard = calls[0]
    assert "/sandbox/.prime-claw/qwen-candidate/.gbrain/config.json" in guard
    assert "gbrain put" not in guard


def test_candidate_policy_uses_selected_inference_routes_only(tmp_path):
    cfg = home_override(hermetic_cfg(tmp_path))
    settings = pc._embedding_settings(cfg)
    text, _ = pc._render_candidate_runtime_policy(cfg, settings)
    assert "embedding.test.invalid" in text
    assert "chatgpt.com" not in text
    assert "host: ai-gateway.zende.sk" in text  # Kimi inference
    gateway = text.split("PRIME_CLAW_GATEWAY_POLICY_BEGIN", 1)[1].split(
        "PRIME_CLAW_GATEWAY_POLICY_END", 1)[0]
    assert "/usr/bin/node" in gateway
    assert "/usr/local/bin/gbrain" not in gateway


def test_restore_policy_ignores_ambient_home_profile_env(tmp_path, monkeypatch):
    cfg = home_override(hermetic_cfg(tmp_path))
    settings = pc._embedding_settings(cfg)
    captured = {}
    monkeypatch.setenv("PRIME_CLAW_EMBEDDING_PROFILE", "home-qwen")
    monkeypatch.setattr(pc, "_write_private_file",
                        lambda path, text: captured.update(path=path, text=text))
    monkeypatch.setattr(pc, "run", lambda *a, **k: (0, "ok"))
    assert pc._restore_historical_embedding_policy(cfg, settings) == 0
    assert "home-qwen-embedding" not in captured["text"]
    assert "host: ai-gateway.zende.sk" in captured["text"]


def test_status_rejects_stale_managed_provider_attachment(tmp_path, monkeypatch):
    cfg = hermetic_cfg(tmp_path)
    attached = [
        {"name": "prime-claw-ai-gateway"},
        {"name": "prime-claw-github"},
        {"name": "prime-claw-codex"},
    ]
    monkeypatch.setattr(pc, "openshell_json", lambda *a, **k: (attached, ""))
    ok, detail = pc.probe_provider(cfg)
    assert ok is False
    assert "stale managed attachments: prime-claw-codex" in detail


def test_github_provider_update_failure_does_not_advance_hash(tmp_path, monkeypatch):
    state = tmp_path / ".prime-claw-github-token.sha256"
    state.write_text("old")
    cfg = hermetic_cfg(tmp_path)
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    def fake_run(cmd, timeout=30):
        if cmd[0] == "gh":
            return 0, "TEST-TOKEN\n"
        if cmd[1:3] == ["provider", "get"]:
            return 0, "exists"
        if cmd[1:3] == ["provider", "update"]:
            return 12, "failed"
        raise AssertionError(cmd)
    monkeypatch.setattr(pc, "run", fake_run)
    assert pc.stage_github_provider(cfg, Args()) == 12
    assert state.read_text() == "old"


def test_brain_stage_mismatch_stops_before_config_write(tmp_path, monkeypatch, capsys):
    cfg = hermetic_cfg(tmp_path)
    calls = []
    def fake_exec(c, script, timeout=30):
        calls.append(script)
        if "initdb" in script:
            return 0, "postgres up"
        if "to_regclass('public.content_chunks')" in script:
            return 8, "embedding-state stale-or-mixed chunks=10 bad=2"
        raise AssertionError("config write must not run after state mismatch")
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    assert pc.stage_brain(cfg, Args()) == 8
    assert all("base64 -d | python3" not in call for call in calls)
    assert "parallel rebuild/cutover" in capsys.readouterr().err


def test_home_validate_temporarily_applies_and_restores_candidate_policy(tmp_path, monkeypatch):
    cfg = home_override(hermetic_cfg(tmp_path))
    policy_calls = []
    monkeypatch.setattr(pc, "probe_sandbox",
                        lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "_validate_versions", lambda c: {"test": "1"})
    monkeypatch.setattr(pc, "_validate_checks",
                        lambda c, a: ([('runtime-check', True, True, '')], []))
    monkeypatch.setattr(pc, "_write_private_file", lambda *a, **k: None)
    monkeypatch.setattr(pc, "EVIDENCE_DIR", str(tmp_path / "evidence"))
    def fake_run(cmd, timeout=30):
        if cmd[1:3] == ["policy", "set"]:
            policy_calls.append(cmd)
            return 0, "ok"
        raise AssertionError(cmd)
    monkeypatch.setattr(pc, "run", fake_run)
    assert pc.cmd_validate(cfg, Args()) == 0
    assert len(policy_calls) == 2
    assert policy_calls[0][-2].endswith(cfg["embedding_policy_file"])
    assert policy_calls[1][-2] == cfg["active_policy_file"]


def test_home_validate_restore_failure_is_a_gate_failure(tmp_path, monkeypatch):
    cfg = home_override(hermetic_cfg(tmp_path))
    monkeypatch.setattr(pc, "probe_sandbox",
                        lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "_validate_versions", lambda c: {"test": "1"})
    monkeypatch.setattr(pc, "_validate_checks", lambda c, a: ([], []))
    monkeypatch.setattr(pc, "_write_private_file", lambda *a, **k: None)
    monkeypatch.setattr(pc, "EVIDENCE_DIR", str(tmp_path / "evidence"))
    monkeypatch.setattr(pc, "run", lambda *a, **k: (0, "ok"))
    monkeypatch.setattr(pc, "_restore_historical_embedding_policy", lambda *a: 17)
    assert pc.cmd_validate(cfg, Args()) == 1
    evidence = next((tmp_path / "evidence").glob("validate-*.json"))
    data = json.loads(evidence.read_text())
    assert "candidate-policy-restored" in data["failures"]
