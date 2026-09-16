"""Tests for bin/prime-claw Slice 3a: runtime stages + create.

Offline: openshell + docker + sandbox_exec are monkeypatched. Covers stage
idempotency, create ordering, dry-run, and credential isolation (key never
written to disk or echoed).
"""
import json, os, subprocess, sys, base64
from importlib.machinery import SourceFileLoader
import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(REPO, "bin", "prime-claw")
pc = SourceFileLoader("primeclaw", BIN).load_module()


def cfg(tmp_path, **over):
    c = {"sandbox_name": "prime-claw", "image": "prime-claw-brain:0.1.0",
         "provider_name": "prime-claw-ai-gateway", "policy_file": "policies/runtime.yaml",
         "ai_gateway_host": "ai-gateway.zende.sk"}
    c.update(over); return c


class Args:
    def __init__(self, **kw):
        self.dry_run = kw.get("dry_run", False); self.force = kw.get("force", False)


def test_create_verb_is_implemented():
    assert pc.VERBS["create"] is pc.cmd_create


# --- stage: provider -----------------------------------------------------------

def test_provider_reads_key_in_process_only(tmp_path, monkeypatch):
    auth = tmp_path / "auth.json"
    auth.write_text(json.dumps({"anthropic": {"key": "SECRET-KEY"}}))
    monkeypatch.setenv("PRIME_CLAW_HOST_AUTH_JSON", str(auth))
    seen = {}
    def fake_run(cmd, timeout=30):
        joined = " ".join(cmd)
        seen.setdefault("cmds", []).append(joined)
        if cmd[:3] == [pc.OPENSHELL, "provider", "get"]: return (1, "not found")
        return (0, "")
    monkeypatch.setattr(pc, "run", fake_run)
    rc = pc.stage_provider(cfg(tmp_path), Args())
    assert rc == 0
    # Key appears in the provider create argv (necessary to pass it) but the
    # profile temp file is cleaned up and nothing is written under the repo.
    assert any("api_key=SECRET-KEY" in c and "create" in c for c in seen["cmds"])
    assert not os.path.exists(os.path.join(tmp_path, ".prime-claw-secret"))


def test_provider_missing_host_key_errors(tmp_path, monkeypatch):
    monkeypatch.setenv("PRIME_CLAW_HOST_AUTH_JSON", str(tmp_path / "nope.json"))
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: (0, ""))
    with pytest.raises(FileNotFoundError):
        pc.stage_provider(cfg(tmp_path), Args())


def test_provider_dry_run_no_calls(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: (_ for _ in ()).throw(AssertionError("no calls")))
    rc = pc.stage_provider(cfg(tmp_path), Args(dry_run=True))
    assert rc == 0 and "never committed" in capsys.readouterr().out


# --- stage: sandbox -------------------------------------------------------------

def test_sandbox_create_attaches_provider_at_create(tmp_path, monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "absent", None))
    monkeypatch.setattr(pc, "stage_policy", lambda c, a: 0)
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: (0 if "provider" in " ".join(c) else 0, ""))
    seen = {}
    def fake_run(cmd, timeout=30):
        if cmd[:2] == [pc.OPENSHELL, "provider"]: return (0, "")
        if cmd[:2] == [pc.OPENSHELL, "sandbox"]:
            seen["create"] = cmd
        return (0, "")
    monkeypatch.setattr(pc, "run", fake_run)
    rc = pc.stage_sandbox(cfg(tmp_path), Args(), force_fresh=True)
    assert rc == 0
    cmd = seen["create"]
    assert "--from" in cmd and "prime-claw-brain:0.1.0" in cmd
    assert "--provider" in cmd and "prime-claw-ai-gateway" in cmd  # provider at CREATE


def test_sandbox_existing_attaches_providers_without_recreate(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "stage_policy", lambda c, a: 0)
    calls = []
    def fake_run(cmd, timeout=30):
        calls.append(cmd)
        if cmd[1:4] == ["sandbox", "provider", "attach"]:
            return (0, "attached")
        raise AssertionError("unexpected create/delete while converging existing sandbox")
    monkeypatch.setattr(pc, "run", fake_run)
    rc = pc.stage_sandbox(cfg(tmp_path), Args(), force_fresh=False)
    assert rc == 0
    attached = [c[-1] for c in calls]
    assert attached == ["prime-claw-ai-gateway", "prime-claw-github", "prime-claw-codex"]
    assert "no recreate" in capsys.readouterr().out


def test_sandbox_force_fresh_deletes_first(tmp_path, monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "stage_policy", lambda c, a: 0)
    calls = []
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: calls.append(" ".join(c)) or (0, ""))
    pc.stage_sandbox(cfg(tmp_path), Args(), force_fresh=True)
    verbs = [c.split()[2] for c in calls if c.startswith(pc.OPENSHELL + " sandbox")]
    assert "delete" in verbs and "create" in verbs and verbs.index("delete") < verbs.index("create")


def test_codex_provider_reads_host_oauth_but_only_openshell_holds_it(tmp_path, monkeypatch):
    auth = tmp_path / "auth.json"
    auth.write_text(json.dumps({"openai-codex": {
        "type": "oauth", "access": "HOST-ACCESS", "refresh": "HOST-REFRESH",
        "accountId": "HOST-ACCOUNT", "expires": 9999999999999,
    }}))
    state = tmp_path / "codex.sha256"
    monkeypatch.setenv("PRIME_CLAW_HOST_AUTH_JSON", str(auth))
    monkeypatch.setenv("PRIME_CLAW_CODEX_CREDENTIAL_STATE", str(state))
    seen = []
    def fake_run(cmd, timeout=30):
        seen.append(cmd)
        if cmd[:3] == [pc.OPENSHELL, "provider", "get"]:
            return (1, "not found")
        return (0, "ok")
    monkeypatch.setattr(pc, "run", fake_run)
    rc = pc.stage_codex_provider(cfg(tmp_path), Args())
    assert rc == 0
    create = next(c for c in seen if c[:3] == [pc.OPENSHELL, "provider", "create"])
    assert "access_token=HOST-ACCESS" in create
    assert "refresh_token=HOST-REFRESH" in create
    assert "account_id=HOST-ACCOUNT" in create
    assert state.exists() and "HOST-" not in state.read_text()  # hash only


def test_prime_agent_mirrors_settings_and_projects_placeholder_only_auth(tmp_path, monkeypatch):
    settings = tmp_path / "settings.json"
    settings_text = json.dumps({
        "defaultProvider": "openai-codex", "defaultModel": "gpt-5.6-sol",
        "defaultThinkingLevel": "high", "enabledModels": ["openai-codex/*"],
    }, indent=2) + "\n"
    settings.write_text(settings_text)
    models = tmp_path / "models.json"
    models.write_text('{"providers":{}}\n')
    monkeypatch.setenv("PRIME_CLAW_HOST_SETTINGS_JSON", str(settings))
    monkeypatch.setenv("PRIME_CLAW_HOST_MODELS_JSON", str(models))
    assert pc._prime_agent_settings_json(cfg(tmp_path)) == settings_text
    assert pc._prime_agent_models_json(cfg(tmp_path)) == models.read_text()
    script = pc._prime_agent_codex_auth_projection_script()
    assert "openshell:resolve:" in script
    assert "access_token" in script and "refresh_token" in script and "account_id" in script
    assert "HOST-ACCESS" not in script and "HOST-REFRESH" not in script
    token = pc._codex_synthetic_access_token()
    assert token.count(".") == 2 and "HOST-" not in token


def test_npm_onload_rewrites_synthetic_codex_headers_to_placeholders_offline():
    preload = os.path.join(REPO, "scripts", "lib", "npm-onload.js")
    js = r"""
globalThis.fetch = async (_input, init) => {
  const h = new Headers(init.headers);
  console.log(h.get('authorization'));
  console.log(h.get('chatgpt-account-id'));
  return {ok:true};
};
require(process.argv[1]);
fetch('https://chatgpt.com/backend-api/codex/responses', {
  headers: {authorization:'Bearer SYNTHETIC.JWT.VALUE', 'chatgpt-account-id':'synthetic'}
});
"""
    env = dict(os.environ, access_token="openshell:resolve:env:v1_access_token",
               account_id="openshell:resolve:env:v1_account_id")
    result = subprocess.run(["node", "-e", js, preload], capture_output=True, text=True, env=env)
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [
        "Bearer openshell:resolve:env:v1_access_token",
        "openshell:resolve:env:v1_account_id",
    ]


# --- stage: prime-agent / brain / spawn idempotency --------------------------------

def _exec_recorder(monkeypatch):
    calls = []
    def fake_exec(c, script, timeout=30):
        calls.append(script)
        # Slice 5 added a daemon-ensure step to stage_prime_agent; report it up.
        if "daemon-catalog-entry" in script or "DAEMON_UP" in script:
            return (0, "DAEMON_UP")
        return (0, "ok")
    return calls, fake_exec


def test_prime_agent_stage_runs_install_and_kernel(tmp_path, monkeypatch):
    calls, fx = _exec_recorder(monkeypatch)
    monkeypatch.setattr(pc, "sandbox_exec", fx)
    rc = pc.stage_prime_agent(cfg(tmp_path), Args())
    assert rc == 0
    assert any("install.sh" in c for c in calls)          # install leg
    assert any("pc-kernel.mjs" in c for c in calls)        # kernel bootstrap (JS base64-staged)
    assert any("npm-onload.js" in c for c in calls)       # %2F workaround staged


def test_prime_agent_daemon_restarts_to_inherit_current_placeholders(tmp_path, monkeypatch):
    calls, fx = _exec_recorder(monkeypatch)
    monkeypatch.setattr(pc, "sandbox_exec", fx)
    rc = pc.stage_prime_agent(cfg(tmp_path), Args())
    assert rc == 0
    daemon = next(c for c in calls if "daemon-catalog-entry" in c)
    assert "kill $PIDS" in daemon and "nohup prime-agent --mode daemon" in daemon
    assert 'ANTHROPIC_API_KEY="$api_key"' in daemon  # gateway fallback; value is placeholder
    assert "/proc/" not in daemon  # blocked under OpenShell filesystem policy
    assert "zdai_" not in daemon


def test_brain_stage_initdb_and_wiring(tmp_path, monkeypatch):
    calls, fx = _exec_recorder(monkeypatch)
    monkeypatch.setattr(pc, "sandbox_exec", fx)
    rc = pc.stage_brain(cfg(tmp_path), Args())
    assert rc == 0
    assert any("initdb" in c and "unix_socket_directories=/sandbox" in c for c in calls)
    assert any("ai-gateway.zende.sk/v1" in base64.b64decode(c.split("echo ")[1].split(" |")[0]).decode()
               for c in calls if "base64 -d | python3" in c)


def test_spawn_stage_idempotent(tmp_path, monkeypatch):
    calls, fx = _exec_recorder(monkeypatch)
    monkeypatch.setattr(pc, "sandbox_exec", fx)
    rc = pc.stage_spawn(cfg(tmp_path), Args())
    assert rc == 0
    assert any('.git' in c and 'already present' in c for c in calls)


# --- create ordering -------------------------------------------------------------

def test_create_runs_stages_in_order(tmp_path, monkeypatch):
    order = []
    def rec(label):
        def f(c, a): order.append(label); return 0
        return f
    monkeypatch.setattr(pc, "cmd_build", rec("build"))
    monkeypatch.setattr(pc, "stage_provider", rec("provider"))
    monkeypatch.setattr(pc, "stage_github_provider", rec("github-provider"))
    monkeypatch.setattr(pc, "stage_sandbox", lambda c, a, force_fresh=False: order.append("sandbox") or 0)
    monkeypatch.setattr(pc, "stage_prime_agent", rec("prime-agent"))
    monkeypatch.setattr(pc, "stage_brain_clone", rec("brain-clone"))
    monkeypatch.setattr(pc, "stage_brain", rec("brain"))
    monkeypatch.setattr(pc, "stage_brain_index", rec("brain-index"))
    monkeypatch.setattr(pc, "stage_spawn", rec("spawn"))
    monkeypatch.setattr(pc, "stage_policy", rec("policy"))
    rc = pc.cmd_create(cfg(tmp_path), Args())
    assert rc == 0
    assert order == ["build", "provider", "github-provider", "sandbox", "prime-agent", "brain-clone", "brain", "brain-index", "spawn", "policy"]


def test_create_stops_on_first_stage_failure(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(pc, "cmd_build", lambda c, a: 0)
    monkeypatch.setattr(pc, "stage_provider", lambda c, a: 7)  # fail here
    rc = pc.cmd_create(cfg(tmp_path), Args())
    assert rc == 7
    assert "stage 'provider'" in capsys.readouterr().err


def test_create_dry_run_no_side_effects(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(pc, "cmd_build", lambda c, a: 0)
    monkeypatch.setattr(pc, "stage_provider", lambda c, a: 0)
    monkeypatch.setattr(pc, "stage_sandbox", lambda c, a, force_fresh=False: 0)
    monkeypatch.setattr(pc, "stage_prime_agent", lambda c, a: 0)
    monkeypatch.setattr(pc, "stage_brain", lambda c, a: 0)
    monkeypatch.setattr(pc, "stage_spawn", lambda c, a: 0)
    monkeypatch.setattr(pc, "stage_policy", lambda c, a: 0)
    rc = pc.cmd_create(cfg(tmp_path), Args(dry_run=True))
    assert rc == 0 and "dry_run" in capsys.readouterr().out


# --------------------------------------------------------------------------
# Slice 3b — converge
# --------------------------------------------------------------------------

def test_converge_verb_is_implemented():
    assert pc.VERBS["converge"] is pc.cmd_converge


def _stub_stages(monkeypatch, order):
    def rec(label):
        def f(c, a): order.append(label); return 0
        return f
    monkeypatch.setattr(pc, "cmd_build", rec("build"))
    monkeypatch.setattr(pc, "stage_provider", rec("provider"))
    monkeypatch.setattr(pc, "stage_github_provider", rec("github-provider"))
    monkeypatch.setattr(pc, "stage_sandbox",
        lambda c, a, force_fresh=False: order.append("sandbox") or 0)
    monkeypatch.setattr(pc, "stage_prime_agent", rec("prime-agent"))
    monkeypatch.setattr(pc, "stage_brain_clone", rec("brain-clone"))
    monkeypatch.setattr(pc, "stage_brain", rec("brain"))
    monkeypatch.setattr(pc, "stage_brain_index", rec("brain-index"))
    monkeypatch.setattr(pc, "stage_spawn", rec("spawn"))
    monkeypatch.setattr(pc, "stage_policy", rec("policy"))


def test_converge_runs_all_stages_no_recreate(tmp_path, monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    order = []
    _stub_stages(monkeypatch, order)
    rc = pc.cmd_converge(cfg(tmp_path), Args())
    assert rc == 0
    assert order == ["build", "provider", "github-provider", "sandbox", "prime-agent", "brain-clone", "brain", "brain-index", "spawn", "policy"]


def test_converge_errors_when_sandbox_absent(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "absent", None))
    rc = pc.cmd_converge(cfg(tmp_path), Args())
    assert rc == 1
    assert "use 'prime-claw create'" in capsys.readouterr().err


def test_converge_dry_run_skips_presence_check(tmp_path, monkeypatch, capsys):
    # Dry-run must not require the sandbox to exist and must not probe it.
    monkeypatch.setattr(pc, "probe_sandbox",
        lambda c: (_ for _ in ()).throw(AssertionError("must not probe on dry-run")))
    order = []
    _stub_stages(monkeypatch, order)
    rc = pc.cmd_converge(cfg(tmp_path), Args(dry_run=True))
    assert rc == 0 and "no recreate" in capsys.readouterr().out


def test_converge_stops_on_stage_failure(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "cmd_build", lambda c, a: 0)
    monkeypatch.setattr(pc, "stage_provider", lambda c, a: 0)
    monkeypatch.setattr(pc, "stage_sandbox", lambda c, a, force_fresh=False: 9)  # fail
    rc = pc.cmd_converge(cfg(tmp_path), Args())
    assert rc == 9
    assert "stage 'sandbox'" in capsys.readouterr().err


# --- Slice 2: brain-index stage (R3a-2, R3a-12) ---------------------------------

def test_brain_config_lives_at_sandbox_home_not_repo(tmp_path, monkeypatch):
    """gbrain resolves config from $HOME/.gbrain ONLY (no cwd walk-up — that was the
    zbrain fork delta). stage_brain must write /sandbox/.gbrain/config.json, never
    inside the cloned repo, and must wire the placeholder api_key from the sandbox env."""
    calls, fx = _exec_recorder(monkeypatch)
    monkeypatch.setattr(pc, "sandbox_exec", fx)
    rc = pc.stage_brain(cfg(tmp_path), Args())
    assert rc == 0
    wire = [c for c in calls if "base64 -d | python3" in c]
    assert wire, "no config-wiring step found"
    decoded = base64.b64decode(wire[0].split("echo ")[1].split(" |")[0]).decode()
    assert "/sandbox/.gbrain/config.json" in decoded
    assert "/sandbox/brain/.gbrain" not in decoded
    assert "provider_base_urls" in decoded and "ai-gateway.zende.sk/v1" in decoded
    assert "openai_api_key" in decoded and "api_key" in decoded  # placeholder from env


def test_brain_index_stage_sequence(tmp_path, monkeypatch):
    """stage_brain_index: migrate schema -> sources add (idempotent) -> sync (import+embed)
    -> skip-failed -> pages>0 gate. pipefail so gbrain failures aren't masked by tail."""
    calls, fx = _exec_recorder(monkeypatch)
    monkeypatch.setattr(pc, "sandbox_exec", fx)
    rc = pc.stage_brain_index(cfg(tmp_path), Args())
    assert rc == 0
    joined = "\n".join(calls)
    assert "gbrain init --migrate-only" in joined
    assert "postgresql://gbrain:gbrain@localhost:5433/gbrain" in joined
    assert "--embedding-model openai:text-embedding-3-large" in joined
    assert "--embedding-dimensions 1536" in joined
    assert "sources add brain --path /sandbox/brain --force" in joined
    assert "gbrain sync --source brain" in joined
    assert "--skip-failed" in joined
    assert "set -o pipefail" in joined
    assert "SELECT count(*) FROM pages" in joined  # pages>0 gate


def test_brain_index_stage_dry_run(tmp_path, capsys):
    rc = pc.stage_brain_index(cfg(tmp_path), Args(dry_run=True))
    assert rc == 0
    out = capsys.readouterr().out
    assert "dry_run" in out and "sources add brain" in out and "sync --source brain" in out


def test_brain_index_sync_failure_propagates(tmp_path, monkeypatch, capsys):
    """A failing sync (e.g. DB unreachable) must fail the stage, not be masked by tail."""
    def fail_exec(c, script, timeout=30):
        if "gbrain sync" in script:
            return (1, "GBRAIN_DB_ACCESS no_url")
        return (0, "ok")
    monkeypatch.setattr(pc, "sandbox_exec", fail_exec)
    rc = pc.stage_brain_index(cfg(tmp_path), Args())
    assert rc == 1
    assert "brain-index stage (sync)" in capsys.readouterr().err


def test_brain_index_sources_add_idempotent(tmp_path, monkeypatch):
    """`sources add` failing with 'already exists' must NOT fail the stage."""
    def fx(c, script, timeout=30):
        if "sources add" in script:
            return (1, 'source "brain" already exists')
        return (0, "ok")
    monkeypatch.setattr(pc, "sandbox_exec", fx)
    rc = pc.stage_brain_index(cfg(tmp_path), Args())
    assert rc == 0


def test_create_and_converge_include_brain_index(tmp_path, monkeypatch):
    order = []
    def rec(label):
        def f(c, a): order.append(label); return 0
        return f
    for name in ("cmd_build", "stage_provider", "stage_github_provider", "stage_codex_provider", "stage_prime_agent",
                 "stage_brain_clone", "stage_brain", "stage_brain_index", "stage_brain_query",
                 "stage_spawn", "stage_policy"):
        monkeypatch.setattr(pc, name, rec(name))
    monkeypatch.setattr(pc, "stage_sandbox", lambda c, a, force_fresh=False: order.append("sandbox") or 0)
    rc = pc.cmd_create(cfg(tmp_path), Args())
    assert rc == 0
    assert order == ["cmd_build", "stage_provider", "stage_github_provider", "stage_codex_provider", "sandbox",
                     "stage_prime_agent", "stage_brain_clone", "stage_brain",
                     "stage_brain_index", "stage_brain_query", "stage_spawn", "stage_policy"]


# --- Slice 3: citation-ready brain-query capability (R3a-3) --------------------

def test_brain_query_stage_installs_helper_and_agents_guidance(tmp_path, monkeypatch):
    calls, fx = _exec_recorder(monkeypatch)
    monkeypatch.setattr(pc, "sandbox_exec", fx)
    rc = pc.stage_brain_query(cfg(tmp_path), Args())
    assert rc == 0
    assert len(calls) == 1
    script = calls[0]
    assert "/sandbox/.prime-claw/bin/brain-query" in script
    assert "/sandbox/AGENTS.md" in script
    assert "chmod 0755" in script
    # The staged helper and guidance are base64 payloads; the source artifacts
    # carry the exact search/get construction and citation contract.
    helper = open(os.path.join(REPO, "scripts", "runtime", "brain_query.py")).read()
    assert '"search", query, "--source-id", "brain"' in helper
    assert 'run_gbrain(["get", slug, "--source-id", "brain"])' in helper
    assert "CITE_AS: [Brain: {slug}]" in helper


def test_brain_query_stage_dry_run(tmp_path, capsys):
    rc = pc.stage_brain_query(cfg(tmp_path), Args(dry_run=True))
    assert rc == 0
    out = capsys.readouterr().out
    assert "dry_run" in out and "brain-query" in out and "/sandbox/AGENTS.md" in out
