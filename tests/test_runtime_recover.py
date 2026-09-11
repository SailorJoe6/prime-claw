"""Tests for bin/prime-claw Slice 5: recover (the operability slice).

Offline: probe_sandbox / sandbox_exec / run / stage_sandbox / cmd_converge /
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
         "policy_file": "policies/phase1-sandbox.yaml"}
    c.update(over); return c


class Args:
    def __init__(self, **kw):
        self.dry_run = kw.get("dry_run", False)
        self.signature = kw.get("signature", "")


def test_recover_verb_is_implemented():
    assert pc.VERBS["recover"] is pc.cmd_recover


def test_recover_dry_run_no_calls(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (_ for _ in ()).throw(AssertionError("no probe")))
    rc = pc.cmd_recover(cfg(), Args(dry_run=True))
    assert rc == 0 and "dry_run" in capsys.readouterr().out


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


def test_detect_vpn_flap_gateway_down(monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "absent", None))  # absent
    monkeypatch.setattr(pc, "_gateway_sandbox_names", lambda c: None)            # gw list failed
    assert pc.detect_degradations(cfg(), Args()) == ["vpn-flap"]


def test_detect_vpn_flap_container_survived(monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "absent", None))
    monkeypatch.setattr(pc, "_gateway_sandbox_names", lambda c: (["prime-claw"], True))  # still on gw
    assert pc.detect_degradations(cfg(), Args()) == ["vpn-flap"]


def test_detect_gateway_flip(monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "absent", None))
    monkeypatch.setattr(pc, "_gateway_sandbox_names", lambda c: (["other"], True))  # not on gw
    assert pc.detect_degradations(cfg(), Args()) == ["gateway-flip"]


def test_recover_cold_daemon_converges(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", lambda c, s, timeout=30: (0, "ok"))
    monkeypatch.setattr(pc, "_daemon_socket_present", lambda c: False)
    conv = {"n": 0}
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: conv.__setitem__("n", conv["n"] + 1) or 0)
    rc = pc.cmd_recover(cfg(), Args())
    out = capsys.readouterr().out
    assert rc == 0 and "cold-daemon" in out and conv["n"] == 1


def test_recover_vpn_flap_restarts_gateway_then_converges(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "absent", None))
    monkeypatch.setattr(pc, "_gateway_sandbox_names", lambda c: (["prime-claw"], True))
    brew = {"n": 0}
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: brew.__setitem__("n", brew["n"] + 1) or (0, ""))
    monkeypatch.setattr(pc, "_sleep", lambda s: None)
    conv = {"n": 0}
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: conv.__setitem__("n", conv["n"] + 1) or 0)
    rc = pc.cmd_recover(cfg(), Args())
    out = capsys.readouterr().out
    assert rc == 0 and brew["n"] == 1 and conv["n"] == 1 and "restarting openshell gateway" in out


def test_recover_vpn_flap_gateway_stays_down_errors(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "absent", None))
    monkeypatch.setattr(pc, "_gateway_sandbox_names", lambda c: (["prime-claw"], False))  # not ready
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: (0, ""))
    monkeypatch.setattr(pc, "_sleep", lambda s: None)
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: 0)
    rc = pc.cmd_recover(cfg(), Args())
    err = capsys.readouterr().err
    assert rc == 1 and "cluster_ready" in err and "GlobalProtect" in err


def test_recover_gateway_flip_recreates(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "absent", None))
    monkeypatch.setattr(pc, "_gateway_sandbox_names", lambda c: (["other"], True))
    sb = {"ff": None}
    monkeypatch.setattr(pc, "stage_sandbox", lambda c, a, force_fresh=False: sb.__setitem__("ff", force_fresh) or 0)
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: 0)
    rc = pc.cmd_recover(cfg(), Args())
    out = capsys.readouterr().out
    assert rc == 0 and sb["ff"] is True and "recreating" in out


def test_recover_signature_forces_detection(monkeypatch, capsys):
    # --signature forces a signature without live detection.
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: 0)
    rc = pc.cmd_recover(cfg(), Args(signature="cold-daemon"))
    out = capsys.readouterr().out
    assert rc == 0 and "cold-daemon" in out
