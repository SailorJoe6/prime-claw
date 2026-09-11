"""Tests for bin/prime-claw Slice 6a: destroy verb.

Offline: probe_sandbox, run, and _docker_image_exists are monkeypatched. No live
sandbox, no network, no credentials. Covers dry-run, non-destructive default,
confirmed teardown, idempotency (absent resources are no-ops), and --image.
"""
import os, json
import pytest
from importlib.machinery import SourceFileLoader

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(REPO, "bin", "prime-claw")
pc = SourceFileLoader("primeclaw_destroy", BIN).load_module()


class Args:
    def __init__(self, **k):
        self.dry_run = False
        self.yes = False
        self.image = False
        for kk, vv in k.items():
            setattr(self, kk, vv)


def cfg(tmp_path, **over):
    c = {
        "sandbox_name": "prime-claw",
        "image": "prime-claw-brain:0.1.0",
        "gateway": {"name": "openshell", "endpoint": "https://localhost:17670",
                    "forbidden": ["nemoclaw"]},
        "policy_file": "policies/runtime.yaml",
        "provider_name": "prime-claw-ai-gateway",
    }
    c.update(over)
    return c


def _patch_present(monkeypatch, sandbox=True, image=False):
    monkeypatch.setattr(pc, "probe_sandbox",
                        lambda c: (True, "Ready", {"phase": "Ready"}) if sandbox else (None, "", None))
    monkeypatch.setattr(pc, "_docker_image_exists", lambda tag: image)


def test_dry_run_is_read_only(tmp_path, monkeypatch, capsys):
    _patch_present(monkeypatch, sandbox=True)
    calls = []
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: calls.append(cmd) or (0, ""))
    rc = pc.cmd_destroy(cfg(tmp_path), Args(dry_run=True, yes=True))
    out = capsys.readouterr().out
    assert rc == 0 and "dry_run: delete sandbox prime-claw" in out
    assert calls == []  # no mutation


def test_default_requires_confirmation_and_mutates_nothing(tmp_path, monkeypatch, capsys):
    _patch_present(monkeypatch, sandbox=True)
    calls = []
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: calls.append(cmd) or (0, ""))
    rc = pc.cmd_destroy(cfg(tmp_path), Args())  # no --yes
    out = capsys.readouterr().out
    assert rc == 0
    assert "DRY" in out and "nothing deleted" in out
    assert calls == []  # confirm-gated: no deletion without --yes


def test_confirmed_destroy_deletes_sandbox(tmp_path, monkeypatch, capsys):
    _patch_present(monkeypatch, sandbox=True)
    calls = []
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: calls.append(cmd) or (0, ""))
    rc = pc.cmd_destroy(cfg(tmp_path), Args(yes=True))
    out = capsys.readouterr().out
    assert rc == 0 and "deleted sandbox prime-claw" in out
    assert any(c[:3] == [pc.OPENSHELL, "sandbox", "delete"] for c in calls)


def test_destroy_is_idempotent_when_sandbox_absent(tmp_path, monkeypatch, capsys):
    _patch_present(monkeypatch, sandbox=False)
    calls = []
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: calls.append(cmd) or (0, ""))
    rc = pc.cmd_destroy(cfg(tmp_path), Args(yes=True))
    out = capsys.readouterr().out
    assert rc == 0 and "already absent" in out
    assert not any("delete" in c for c in calls)


def test_destroy_image_opt_in(tmp_path, monkeypatch, capsys):
    _patch_present(monkeypatch, sandbox=True, image=True)
    calls = []
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: calls.append(cmd) or (0, ""))
    monkeypatch.setattr(pc.os.path, "exists", lambda p: False)  # no build stamp
    rc = pc.cmd_destroy(cfg(tmp_path), Args(yes=True, image=True))
    out = capsys.readouterr().out
    assert rc == 0 and "deleted image prime-claw-brain:0.1.0" in out
    assert any(c[:2] == ["docker", "rmi"] for c in calls)


def test_destroy_without_image_flag_leaves_image(tmp_path, monkeypatch, capsys):
    _patch_present(monkeypatch, sandbox=True, image=True)
    calls = []
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: calls.append(cmd) or (0, ""))
    rc = pc.cmd_destroy(cfg(tmp_path), Args(yes=True, image=False))
    out = capsys.readouterr().out
    assert rc == 0
    assert not any(c[:2] == ["docker", "rmi"] for c in calls)


def test_destroy_failure_returns_nonzero(tmp_path, monkeypatch, capsys):
    _patch_present(monkeypatch, sandbox=True)
    monkeypatch.setattr(pc, "run", lambda cmd, timeout=30: (1, "boom"))
    rc = pc.cmd_destroy(cfg(tmp_path), Args(yes=True))
    assert rc == 1
