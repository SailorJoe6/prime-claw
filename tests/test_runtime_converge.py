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


def test_sandbox_existing_no_recreate_on_converge(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "stage_policy", lambda c, a: 0)
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: (_ for _ in ()).throw(AssertionError("no create")))
    rc = pc.stage_sandbox(cfg(tmp_path), Args(), force_fresh=False)
    assert rc == 0
    assert "no recreate" in capsys.readouterr().out


def test_sandbox_force_fresh_deletes_first(tmp_path, monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "stage_policy", lambda c, a: 0)
    calls = []
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: calls.append(" ".join(c)) or (0, ""))
    pc.stage_sandbox(cfg(tmp_path), Args(), force_fresh=True)
    verbs = [c.split()[2] for c in calls if c.startswith(pc.OPENSHELL + " sandbox")]
    assert "delete" in verbs and "create" in verbs and verbs.index("delete") < verbs.index("create")


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
    monkeypatch.setattr(pc, "stage_sandbox", lambda c, a, force_fresh=False: order.append("sandbox") or 0)
    monkeypatch.setattr(pc, "stage_prime_agent", rec("prime-agent"))
    monkeypatch.setattr(pc, "stage_brain", rec("brain"))
    monkeypatch.setattr(pc, "stage_spawn", rec("spawn"))
    monkeypatch.setattr(pc, "stage_policy", rec("policy"))
    rc = pc.cmd_create(cfg(tmp_path), Args())
    assert rc == 0
    assert order == ["build", "provider", "sandbox", "prime-agent", "brain", "spawn", "policy"]


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
    monkeypatch.setattr(pc, "stage_sandbox",
        lambda c, a, force_fresh=False: order.append("sandbox") or 0)
    monkeypatch.setattr(pc, "stage_prime_agent", rec("prime-agent"))
    monkeypatch.setattr(pc, "stage_brain", rec("brain"))
    monkeypatch.setattr(pc, "stage_spawn", rec("spawn"))
    monkeypatch.setattr(pc, "stage_policy", rec("policy"))


def test_converge_runs_all_stages_no_recreate(tmp_path, monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    order = []
    _stub_stages(monkeypatch, order)
    rc = pc.cmd_converge(cfg(tmp_path), Args())
    assert rc == 0
    assert order == ["build", "provider", "sandbox", "prime-agent", "brain", "spawn", "policy"]


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
