"""Tests for bin/prime-claw Slice 5: recover (the operability slice).

Host-safe tier-0 unit tests. Offline: probe_sandbox / sandbox_exec / run / stage_sandbox / cmd_converge /
_sleep are monkeypatched. Covers verb wiring, dry-run, the healthy no-op, each
degradation signature's detection, and each recovery path.
"""
import json, os, subprocess, sys
from importlib.machinery import SourceFileLoader
import pytest


REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(REPO, "bin", "prime-claw")
pc = SourceFileLoader("primeclaw", BIN).load_module()


def cfg(**over):
    c = {"sandbox_name": "prime-claw", "image": "prime-claw-brain:0.1.0",
         "gateway": "openshell", "provider_name": "prime-claw-ai-gateway",
         "model": "anthropic.kimi-k3", "ai_gateway_host": "ai-gateway.zende.sk",
         "policy_file": "policies/runtime.yaml", "brain_repo": "operator/brain",
         "_local_override_keys": ["brain_repo"],
         "_local_config_path": os.path.realpath(os.path.join(
             REPO, ".prime-claw", "runtime.local.json"))}
    c.update(over); return c


class Args:
    def __init__(self, **kw):
        self.dry_run = kw.get("dry_run", False)
        self.signature = kw.get("signature", "")


def test_recover_verb_is_implemented():
    assert pc.VERBS["recover"] is pc.cmd_recover


@pytest.mark.parametrize("signature", ["", "recreate-wipe", "gateway-flip"])
def test_recover_dry_run_no_calls(monkeypatch, capsys, signature):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (_ for _ in ()).throw(AssertionError("no probe")))
    rc = pc.cmd_recover(cfg(), Args(dry_run=True, signature=signature))
    out = capsys.readouterr().out
    assert rc == 1 and "readiness is unverified" in out
    assert "no recovery plan or safety verdict" in out


def test_recover_healthy_is_noop(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", lambda c, s, timeout=30: (0, "ok"))  # install present
    monkeypatch.setattr(pc, "_daemon_socket_present", lambda c: True)
    conv = {"n": 0}
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: conv.__setitem__("n", conv["n"] + 1) or 0)
    rc = pc.cmd_recover(cfg(), Args())
    out = capsys.readouterr().out
    assert rc == 0 and "no degradation detected" in out and conv["n"] == 0


def test_detect_cold_daemon(monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", lambda c, s, timeout=30: (0, "ok"))  # install present
    monkeypatch.setattr(pc, "_daemon_socket_present", lambda c: False)  # but no socket
    assert pc.detect_degradations(cfg(), Args()) == ["cold-daemon"]


def test_detect_recreate_wipe(monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", lambda c, s, timeout=30: (1, ""))  # install gone
    assert pc.detect_degradations(cfg(), Args()) == ["recreate-wipe"]


@pytest.mark.parametrize("signature", ["", "gateway-flip", "vpn-flap", "recreate-wipe", "cold-daemon"])
def test_recover_failed_get_is_not_verified_absence(monkeypatch, capsys, signature):
    # sandbox get failures can also be a CLI error against an existing Error sandbox.
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "not found", None))

    def forbidden(*_args, **_kwargs):
        raise AssertionError("unverified absence must not trigger recovery")

    for name in ("sandbox_exec", "_gateway_sandbox_names", "run", "_sleep",
                 "stage_sandbox", "cmd_converge"):
        monkeypatch.setattr(pc, name, forbidden)
    assert pc.cmd_recover(cfg(), Args(signature=signature)) == 1
    assert "absence are unverified" in capsys.readouterr().err


def test_failed_get_cli_is_not_evidence_of_absence(monkeypatch, capsys):
    c = cfg(gateway={"name": "openshell"})
    monkeypatch.setattr(pc, "openshell_json", lambda *_a, **_kw: (None, "CLI failed"))
    monkeypatch.setattr(pc, "cmd_converge", lambda *_a: (_ for _ in ()).throw(
        AssertionError("cannot converge")))
    monkeypatch.setattr(pc, "stage_sandbox", lambda *_a, **_kw: (_ for _ in ()).throw(
        AssertionError("cannot recreate")))
    assert pc.cmd_recover(c, Args()) == 1
    assert "absence are unverified" in capsys.readouterr().err


def test_detect_failed_get_does_not_guess_gateway_flip(monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "not found", None))
    monkeypatch.setattr(pc, "_gateway_sandbox_names", lambda c: (_ for _ in ()).throw(
        AssertionError("no gateway inference allowed")))
    with pytest.raises(ValueError, match="Ready"):
        pc.detect_degradations(cfg(), Args())


def test_recover_ready_cold_daemon_converges(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", lambda c, s, timeout=30: (0, "ok"))
    monkeypatch.setattr(pc, "_daemon_socket_present", lambda c: False)
    conv = {"n": 0}
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: conv.__setitem__("n", conv["n"] + 1) or 0)
    assert pc.cmd_recover(cfg(), Args()) == 0
    assert "cold-daemon" in capsys.readouterr().out and conv["n"] == 1


@pytest.mark.parametrize("signature", ["vpn-flap", "gateway-flip"])
def test_force_absence_signature_blocked_even_when_ready(monkeypatch, capsys, signature):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: (_ for _ in ()).throw(AssertionError("converge")))
    monkeypatch.setattr(pc, "stage_sandbox", lambda c, a, **kw: (_ for _ in ()).throw(AssertionError("recreate")))
    monkeypatch.setattr(pc, "run", lambda c, **kw: (_ for _ in ()).throw(AssertionError("gateway restart")))
    assert pc.cmd_recover(cfg(), Args(signature=signature)) == 1
    assert "cannot certify absence" in capsys.readouterr().err


def test_recover_signature_forces_detection(monkeypatch, capsys):
    # --signature forces signature selection, but still checks readiness.
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: 0)
    rc = pc.cmd_recover(cfg(), Args(signature="cold-daemon"))
    out = capsys.readouterr().out
    assert rc == 0 and "cold-daemon" in out


@pytest.mark.parametrize("data", [
    {"phase": "Error"}, {"phase": "Stopped"}, {"phase": "Pending"}, {"phase": "Starting"},
    {"phase": None}, {}, {"phase": "ready"},
])
@pytest.mark.parametrize("signature", ["", "recreate-wipe", "cold-daemon", "gateway-flip", "vpn-flap"])
def test_recover_existing_nonready_fails_closed(monkeypatch, capsys, data, signature):
    calls = {"probe": 0}

    def probe(_):
        calls["probe"] += 1
        return False, "not Ready", data

    def forbidden(*_args, **_kwargs):
        raise AssertionError("non-Ready sandbox must not enter recovery")

    monkeypatch.setattr(pc, "probe_sandbox", probe)
    for name in ("sandbox_exec", "_daemon_socket_present", "_gateway_sandbox_names",
                 "run", "_sleep", "stage_sandbox", "cmd_converge"):
        monkeypatch.setattr(pc, name, forbidden)
    assert pc.cmd_recover(cfg(), Args(signature=signature)) == 1
    assert calls["probe"] == 1
    err = capsys.readouterr().err
    assert "recover blocked" in err and "not Ready" in err
    assert "operator approval" in err


@pytest.mark.parametrize("data", [{"phase": "Error"}, {}, {"phase": "Pending"}])
def test_detect_never_classifies_nonready_as_wipe_or_cold(monkeypatch, data):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (False, "not Ready", data))
    monkeypatch.setattr(pc, "sandbox_exec", lambda *_a, **_kw: (_ for _ in ()).throw(
        AssertionError("sandbox exec should not run")))
    with pytest.raises(ValueError, match="Ready"):
        pc.detect_degradations(cfg(), Args())
