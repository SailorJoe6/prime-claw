"""Tests for bin/prime-claw Slice 1: CLI skeleton + status.

Offline: probes are mocked via a fake openshell runner. No live sandbox, no
network, no credentials. Covers CLI parsing, config loading, probe shaping,
status aggregation, and the not-implemented verb stubs.
"""
import json, os, subprocess, sys, types
import importlib.util
import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(REPO, "bin", "prime-claw")

from importlib.machinery import SourceFileLoader
pc = SourceFileLoader("primeclaw", BIN).load_module()


# --- helpers ---------------------------------------------------------------

def cfg(**over):
    c = {
        "sandbox_name": "prime-claw",
        "image": "prime-claw-brain:0.1.0",
        "gateway": {"name": "openshell", "endpoint": "https://localhost:17670",
                    "forbidden": ["nemoclaw"]},
        "policy_file": "policies/phase1-sandbox.yaml",
        "provider_name": "prime-claw-ai-gateway",
        "model": "anthropic.kimi-k3",
        "ai_gateway_host": "ai-gateway.zende.sk",
    }
    c.update(over)
    return c


class Args:
    def __init__(self, **kw):
        self.dry_run = kw.get("dry_run", False)
        self.signature = kw.get("signature")
        self.yes = kw.get("yes", False)


# --- CLI parsing -----------------------------------------------------------

def test_parser_requires_verb():
    with pytest.raises(SystemExit):
        pc.build_parser().parse_args([])


def test_parser_verbs_present():
    for v in ("status", "create", "converge", "build", "validate", "recover", "destroy"):
        a = pc.build_parser().parse_args([v])
        assert a.verb == v


def test_parser_recover_signature_and_destroy_yes():
    a = pc.build_parser().parse_args(["recover", "--signature", "vpn-flap"])
    assert a.signature == "vpn-flap"
    a = pc.build_parser().parse_args(["destroy", "--yes"])
    assert a.yes is True


def test_parser_dry_run_global():
    a = pc.build_parser().parse_args(["--dry-run", "create"])
    assert a.dry_run is True


# --- config ----------------------------------------------------------------

def test_load_config_file(tmp_path):
    p = tmp_path / "c.json"
    p.write_text(json.dumps(cfg()))
    loaded = pc.load_config(str(p))
    assert loaded["sandbox_name"] == "prime-claw"
    assert loaded["gateway"]["name"] == "openshell"


# --- gateway probe ----------------------------------------------------------

def _gw(active_name, active_ep="https://localhost:17670"):
    return ([{"name": "nemoclaw", "endpoint": "https://127.0.0.1:8080", "active": False},
             {"name": active_name, "endpoint": active_ep, "active": active_name == "openshell"}])


def test_probe_gateway_ok(monkeypatch):
    monkeypatch.setattr(pc, "openshell_json", lambda a, timeout=30: (_gw("openshell"), ""))
    ok, det = pc.probe_gateway(cfg())
    assert ok is True and "openshell" in det


def test_probe_gateway_forbidden_nemoclaw(monkeypatch):
    bad = [{"name": "nemoclaw", "endpoint": "https://127.0.0.1:8080", "active": True}]
    monkeypatch.setattr(pc, "openshell_json", lambda a, timeout=30: (bad, ""))
    ok, det = pc.probe_gateway(cfg())
    assert ok is False and "FORBIDDEN" in det and "nemoclaw" in det


def test_probe_gateway_wrong_active(monkeypatch):
    data = [{"name": "other", "endpoint": "https://x", "active": True}]
    monkeypatch.setattr(pc, "openshell_json", lambda a, timeout=30: (data, ""))
    ok, det = pc.probe_gateway(cfg())
    assert ok is False and "!= expected" in det


def test_probe_gateway_cli_failure(monkeypatch):
    monkeypatch.setattr(pc, "openshell_json", lambda a, timeout=30: (None, "boom"))
    ok, det = pc.probe_gateway(cfg())
    assert ok is False and "failed" in det


# --- sandbox / provider probes ----------------------------------------------

def test_probe_sandbox_ready(monkeypatch):
    data = {"phase": "Ready", "current_policy_version": 3, "name": "prime-claw"}
    monkeypatch.setattr(pc, "openshell_json", lambda a, timeout=30: (data, ""))
    ok, det, raw = pc.probe_sandbox(cfg())
    assert ok is True and "Ready" in det and raw["phase"] == "Ready"


def test_probe_sandbox_absent(monkeypatch):
    monkeypatch.setattr(pc, "openshell_json", lambda a, timeout=30: (None, "not found"))
    ok, det, raw = pc.probe_sandbox(cfg())
    assert ok is None and raw is None


def test_probe_provider_attached(monkeypatch):
    data = [{"name": "prime-claw-ai-gateway", "type": "zd-ai-gateway"}]
    monkeypatch.setattr(pc, "openshell_json", lambda a, timeout=30: (data, ""))
    ok, det = pc.probe_provider(cfg())
    assert ok is True and "attached" in det


def test_probe_provider_missing(monkeypatch):
    monkeypatch.setattr(pc, "openshell_json", lambda a, timeout=30: ([{"name": "other"}], ""))
    ok, det = pc.probe_provider(cfg())
    assert ok is False and "NOT attached" in det


# --- in-sandbox probes -------------------------------------------------------

def test_probe_in_sandbox_absent_shortcircuits(tmp_path):
    out = pc.probe_in_sandbox(cfg(), sandbox_present=False)
    assert all(ok is None for _, ok, _ in out)
    assert any("absent" in det for _, _, det in out)


def test_probe_in_sandbox_healthy(monkeypatch, tmp_path):
    def fake_exec(c, script, timeout=30):
        if "pgrep" in script: return 0, "up\n"
        if "command -v gbrain" in script: return 0, "present\n"
        if "daemon.sock" in script: return 0, "live\n"
        return 0, ""
    monkeypatch.setattr(pc, "sandbox_exec", fake_exec)
    out = dict((n, ok) for n, ok, _ in pc.probe_in_sandbox(cfg(), True))
    assert out["postgres"] is True
    assert out["gbrain"] is True
    assert out["prime-agent daemon"] is True
    assert out["model (gateway)"] is None  # deferred to validate


# --- status aggregation -------------------------------------------------------

def _healthy(monkeypatch):
    monkeypatch.setattr(pc, "probe_gateway", lambda c: (True, "openshell"))
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "probe_provider", lambda c: (True, "attached"))
    monkeypatch.setattr(pc, "probe_in_sandbox",
        lambda c, p: [("postgres", True, "up"), ("gbrain", True, "present"),
                      ("prime-agent daemon", True, "live"), ("model (gateway)", None, "validate")])


def test_status_healthy_exit0(monkeypatch, tmp_path, capsys):
    _healthy(monkeypatch)
    rc = pc.cmd_status(cfg(), Args())
    assert rc == 0
    assert "all checked components healthy" in capsys.readouterr().out


def test_status_bad_component_exit1(monkeypatch, tmp_path, capsys):
    _healthy(monkeypatch)
    monkeypatch.setattr(pc, "probe_gateway", lambda c: (False, "FORBIDDEN nemoclaw"))
    rc = pc.cmd_status(cfg(), Args())
    assert rc == 1
    out = capsys.readouterr().out
    assert "BAD" in out and "recover" in out


# --- not-implemented stubs -----------------------------------------------------

def test_stub_verbs_return2_and_dry_run(tmp_path, capsys):
    # Verbs not yet implemented as of Slice 2. `build` and `status` ARE live
    # (Slice 2 / Slice 1); the rest remain explicit stubs until their slice.
    for v in ("converge", "validate", "recover", "destroy"):
        rc = pc.VERBS[v](cfg(), Args(dry_run=True))
        assert rc == 2, v
    err = capsys.readouterr().err
    assert "not yet implemented" in err
    assert pc.VERBS["build"] is pc.cmd_build  # implemented in Slice 2
    assert pc.VERBS["create"] is pc.cmd_create  # implemented in Slice 3a
