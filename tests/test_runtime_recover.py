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


def _source_and_daemon_exec(*, socket="present", hello="DAEMON_UP"):
    def fake_exec(_cfg, script, timeout=30):
        if "source_identity=" in script:
            return 0, "source_identity=cwd-fix-v0.9.8-r1"
        if "SOCKET_PRESENT" in script:
            return 0, "SOCKET_PRESENT" if socket == "present" else "SOCKET_MISSING"
        if "pc-daemon-identity.mts" in script:
            return (0, hello) if hello == "DAEMON_UP" else (1, hello)
        raise AssertionError("unexpected sandbox exec during recover")
    return fake_exec


def test_recover_healthy_is_noop(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", _source_and_daemon_exec())
    conv = {"n": 0}
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: conv.__setitem__("n", conv["n"] + 1) or 0)
    rc = pc.cmd_recover(cfg(), Args())
    out = capsys.readouterr().out
    assert rc == 0 and "no degradation detected" in out and conv["n"] == 0


def test_detect_cold_daemon(monkeypatch):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", _source_and_daemon_exec(socket="missing"))
    assert pc.detect_degradations(cfg(), Args()) == ["cold-daemon"]


def test_detect_source_identity_mismatch_fails_closed(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", lambda c, s, timeout=30: (1, ""))
    monkeypatch.setattr(pc, "_daemon_socket_present", lambda c: (_ for _ in ()).throw(
        AssertionError("no daemon inference after source mismatch")))
    with pytest.raises(ValueError, match="image-owned source identity"):
        pc.detect_degradations(cfg(), Args())
    assert "converge cannot reinstall the image" in capsys.readouterr().err


@pytest.mark.parametrize("signature", ["", "gateway-flip", "vpn-flap", "recreate-wipe", "cold-daemon"])
def test_recover_failed_get_is_not_verified_absence(monkeypatch, capsys, signature):
    # sandbox get failures can also be a CLI error against an existing Error sandbox.
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "not found", None))

    def forbidden(*_args, **_kwargs):
        raise AssertionError("unverified absence must not trigger recovery")

    for name in ("sandbox_exec", "_recover_source_ready", "run", "_sleep",
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
    monkeypatch.setattr(pc, "_recover_source_ready", lambda c: (_ for _ in ()).throw(
        AssertionError("no source probe or gateway inference allowed")))
    with pytest.raises(ValueError, match="Ready"):
        pc.detect_degradations(cfg(), Args())


def test_recover_ready_cold_daemon_converges(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", _source_and_daemon_exec(socket="missing"))
    conv = {"n": 0}
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: conv.__setitem__("n", conv["n"] + 1) or 0)
    assert pc.cmd_recover(cfg(), Args()) == 0
    assert "cold-daemon" in capsys.readouterr().out and conv["n"] == 1


def test_recover_ready_mismatched_source_never_converges(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", lambda c, s, timeout=30: (1, "source mismatch"))
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: (_ for _ in ()).throw(
        AssertionError("image source cannot be repaired by converge")))
    assert pc.cmd_recover(cfg(), Args()) == 1
    assert "image-owned Prime Agent source identity" in capsys.readouterr().err


def test_recover_stale_socket_or_wrong_hello_fails_closed(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", _source_and_daemon_exec(hello="wrong build"))
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: (_ for _ in ()).throw(
        AssertionError("stale socket must not converge")))
    assert pc.cmd_recover(cfg(), Args()) == 1
    assert "daemon RPC build identity unverified" in capsys.readouterr().err


def test_recover_force_recreate_wipe_is_not_a_source_repair(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", lambda *_a, **_kw: (_ for _ in ()).throw(
        AssertionError("unsupported signature blocked before sandbox exec")))
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: (_ for _ in ()).throw(
        AssertionError("no converge")))
    assert pc.cmd_recover(cfg(), Args(signature="recreate-wipe")) == 1
    assert "cannot reinstall image-owned source" in capsys.readouterr().err


def test_daemon_detection_uses_socket_and_rpc_not_catalog_filename(monkeypatch):
    calls = []
    def exec_record(c, script, timeout=30):
        calls.append(script)
        return _source_and_daemon_exec()(c, script, timeout)
    monkeypatch.setattr(pc, "sandbox_exec", exec_record)
    assert pc._daemon_socket_present(cfg()) is True
    assert len(calls) == 2 and "SOCKET_PRESENT" in calls[0]
    assert "pc-daemon-identity.mts" in calls[1]
    assert "daemon-catalog-entry[.]js" not in "".join(calls)
    assert "hello.runtime?.buildId" in pc._prime_agent_daemon_identity_probe_script()


@pytest.mark.parametrize("signature", ["vpn-flap", "gateway-flip"])
def test_force_absence_signature_blocked_even_when_ready(monkeypatch, capsys, signature):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: (_ for _ in ()).throw(AssertionError("converge")))
    monkeypatch.setattr(pc, "stage_sandbox", lambda c, a, **kw: (_ for _ in ()).throw(AssertionError("recreate")))
    monkeypatch.setattr(pc, "run", lambda c, **kw: (_ for _ in ()).throw(AssertionError("gateway restart")))
    assert pc.cmd_recover(cfg(), Args(signature=signature)) == 1
    assert "cannot certify absence" in capsys.readouterr().err


def test_recover_signature_requires_detected_cold_daemon(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (True, "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", _source_and_daemon_exec(socket="missing"))
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: 0)
    rc = pc.cmd_recover(cfg(), Args(signature="cold-daemon"))
    out = capsys.readouterr().out
    assert rc == 0 and "cold-daemon" in out

    monkeypatch.setattr(pc, "sandbox_exec", _source_and_daemon_exec())
    monkeypatch.setattr(pc, "cmd_converge", lambda c, a: (_ for _ in ()).throw(
        AssertionError("forced healthy daemon cannot converge")))
    assert pc.cmd_recover(cfg(), Args(signature="cold-daemon")) == 1
    assert "cannot certify cold-daemon" in capsys.readouterr().err


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
    for name in ("sandbox_exec", "_daemon_socket_present", "_recover_source_ready",
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
