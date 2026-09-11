"""Tests for bin/prime-claw Slice 4: validate (acceptance gate) + version recording.

Offline: probe_sandbox / sandbox_exec / run are monkeypatched. Covers the verb
wiring, dry-run, the absent-sandbox guard, check aggregation, credential
isolation, and evidence recording.
"""
import json, os, subprocess, sys, base64, re
from importlib.machinery import SourceFileLoader
import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(REPO, "bin", "prime-claw")
pc = SourceFileLoader("primeclaw", BIN).load_module()


def cfg(**over):
    c = {"sandbox_name": "prime-claw", "image": "prime-claw-brain:0.1.0",
         "provider_name": "prime-claw-ai-gateway", "model": "anthropic.kimi-k3",
         "ai_gateway_host": "ai-gateway.zende.sk", "policy_file": "policies/runtime.yaml"}
    c.update(over); return c


class Args:
    def __init__(self, **kw):
        self.dry_run = kw.get("dry_run", False)


def test_validate_verb_is_implemented():
    assert pc.VERBS["validate"] is pc.cmd_validate


def test_validate_dry_run_no_calls(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (_ for _ in ()).throw(AssertionError("no probe")))
    rc = pc.cmd_validate(cfg(), Args(dry_run=True))
    assert rc == 0 and "dry_run" in capsys.readouterr().out


def test_validate_errors_when_sandbox_absent(monkeypatch, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: (None, "absent", None))
    rc = pc.cmd_validate(cfg(), Args())
    assert rc == 1 and "create" in capsys.readouterr().err


def _healthy_exec(c, script, timeout=30):
    """A fake sandbox_exec that makes every acceptance check pass. Most-specific
    rules first (the spawn/RPC and version shells also contain generic markers
    like 'prime-agent status' and 'prime-agent --version')."""
    s = script
    # Version-recording probes (routed via /sandbox/.pc-ver.sh).
    if "/sandbox/.pc-ver.sh" in s:
        if "prime-agent" in s: return (0, "0.9.3")
        if "gbrain" in s: return (0, "1.2.3")
        if "pgvector" in s or "pg_extension" in s: return (0, "0.7.0")
        if "psql-version" in s: return (0, "PostgreSQL 16.4")
        return (0, "")
    # Spawn/reap DaemonClient RPC shell.
    if "node /tmp/pc-rpc.mjs" in s:
        return (0, "CREATED=sid1\nCWD=/sandbox/episode-target\nKILL=true\nSTILL=false")
    # Persistent-REPL proof.
    if "REPL_VAL" in s: return (0, "REPL_VAL=42")
    # Credentialed model call.
    if "AGENT_OK" in s: return (0, "AGENT_OK")
    # Egress probes.
    if "example.com" in s: return (0, "PC_HTTP=200\nPC_EXIT=0")
    if "example.org" in s: return (0, "PC_HTTP=000\nPC_EXIT=56\nCONNECT tunnel failed, response 403")
    # Brain checks.
    if "vector_dims" in s: return (0, "1536")
    if "gbrain search" in s: return (0, "1")
    if "gbrain --version" in s: return (0, "1.2.3")
    if "select version()" in s: return (0, "1")           # postgres-16 grep -c
    # Credential-isolation checks.
    if s.startswith("env | grep"): return (0, "")
    if "grep -rIlE" in s: return (0, "")
    # Daemon checks.
    if "ls /tmp/prime-agent-*/daemon.sock" in s: return (0, "/tmp/prime-agent-998/daemon.sock")
    if "prime-agent status" in s: return (0, "A=yes")
    # Spawn target.
    if "rev-parse --short HEAD" in s: return (0, "abc1234")
    return (0, "")


def test_validate_all_green_records_evidence(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", _healthy_exec)
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: (0, "0.0.116"))
    monkeypatch.setattr(pc, "_sleep", lambda s: None)
    monkeypatch.setattr(pc, "EVIDENCE_DIR", str(tmp_path))
    rc = pc.cmd_validate(cfg(), Args())
    out = capsys.readouterr().out
    assert rc == 0 and "validate: PASS" in out
    # every check printed PASS
    assert "[FAIL]" not in out
    # evidence file recorded with versions
    evs = [f for f in os.listdir(tmp_path) if f.startswith("validate-")]
    assert evs
    ev = json.load(open(os.path.join(tmp_path, evs[0])))
    assert ev["result"] == "PASS" and "versions" in ev
    assert ev["versions"]["openshell_cli"] == "0.0.116"
    assert ev["versions"]["image"] == "prime-claw-brain:0.1.0"


def test_validate_flags_a_failing_gate_check(monkeypatch, tmp_path, capsys):
    # Make the model call fail -> validate must return 1 and report the failure.
    def bad_exec(c, script, timeout=30):
        if "AGENT_OK" in script: return (1, "connection refused")  # model call fails
        return _healthy_exec(c, script, timeout)
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", bad_exec)
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: (0, "0.0.116"))
    monkeypatch.setattr(pc, "_sleep", lambda s: None)
    monkeypatch.setattr(pc, "EVIDENCE_DIR", str(tmp_path))
    rc = pc.cmd_validate(cfg(), Args())
    out = capsys.readouterr().out
    assert rc == 1 and "FAIL" in out
    assert "credentialed-model-call" in out
    ev = json.load(open(os.path.join(tmp_path, [f for f in os.listdir(tmp_path) if f.startswith("validate-")][0])))
    assert ev["result"] == "FAIL" and "credentialed-model-call" in ev["failures"]


def test_validate_no_key_leak_checks_run(monkeypatch, tmp_path, capsys):
    # If a real key WERE on sandbox disk, the no-key-on-disk check must FAIL.
    def leaky_exec(c, script, timeout=30):
        if "grep -rIlE" in script: return (0, "/sandbox/secret.txt")  # key found!
        return _healthy_exec(c, script, timeout)
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", leaky_exec)
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: (0, "0.0.116"))
    monkeypatch.setattr(pc, "_sleep", lambda s: None)
    monkeypatch.setattr(pc, "EVIDENCE_DIR", str(tmp_path))
    rc = pc.cmd_validate(cfg(), Args())
    out = capsys.readouterr().out
    assert rc == 1 and "no-key-on-disk" in out


def test_validate_egress_deny_check(monkeypatch, tmp_path, capsys):
    # If undeclared egress SUCCEEDS, the deny-by-default check must FAIL.
    def open_exec(c, script, timeout=30):
        if "example.org" in script: return (0, "PC_HTTP=200\nPC_EXIT=0")  # NOT refused!
        return _healthy_exec(c, script, timeout)
    monkeypatch.setattr(pc, "probe_sandbox", lambda c: ("Ready", "Ready", {"phase": "Ready"}))
    monkeypatch.setattr(pc, "sandbox_exec", open_exec)
    monkeypatch.setattr(pc, "run", lambda c, timeout=30: (0, "0.0.116"))
    monkeypatch.setattr(pc, "_sleep", lambda s: None)
    monkeypatch.setattr(pc, "EVIDENCE_DIR", str(tmp_path))
    rc = pc.cmd_validate(cfg(), Args())
    out = capsys.readouterr().out
    assert rc == 1 and "egress-undeclared-refused" in out
