"""Offline tests for the explicit, read-only prime-claw connect path."""
import json
import os
import subprocess
from importlib.machinery import SourceFileLoader
from pathlib import Path
from types import SimpleNamespace

import pytest


BIN = Path(__file__).resolve().parents[1] / "bin" / "prime-claw"
pc = SourceFileLoader("primeclaw_connect", str(BIN)).load_module()


def config(**overrides):
    cfg = {"gateway": {"name": "explicit-gw", "forbidden": ["old-gw"]},
           "workspace": "explicit-ws", "sandbox_name": "explicit-sb"}
    cfg.update(overrides)
    return cfg


def test_parser_connect_and_global_dry_run():
    normal = pc.build_parser().parse_args(["connect"])
    dry = pc.build_parser().parse_args(["--dry-run", "connect"])
    assert normal.verb == "connect" and normal.dry_run is False
    assert dry.verb == "connect" and dry.dry_run is True


def test_overlay_precedence_and_exact_ready_get_with_fake_openshell(tmp_path, monkeypatch, capsys):
    (tmp_path / ".prime-claw").mkdir()
    tracked = tmp_path / "runtime.json"
    tracked.write_text(json.dumps({**config(), "local_config_file": ".prime-claw/runtime.local.json"}))
    (tmp_path / ".prime-claw" / "runtime.local.json").write_text(json.dumps({
        "gateway": {"name": "local-gw"}, "workspace": "local-ws", "sandbox_name": "local-sb"}))
    log = tmp_path / "openshell-argv.json"
    fake = tmp_path / "openshell"
    fake.write_text("#!/usr/bin/env python3\nimport json, sys\n"
                    f"open({str(log)!r}, 'w').write(json.dumps(sys.argv[1:]))\n"
                    "print(json.dumps({'name': 'local-sb', 'phase': 'Ready'}))\n")
    fake.chmod(0o755)
    monkeypatch.setattr(pc, "REPO_ROOT", str(tmp_path))
    monkeypatch.setattr(pc, "DEFAULT_CONFIG", str(tracked))
    monkeypatch.setattr(pc, "OPENSHELL", str(fake))
    monkeypatch.delenv("PRIME_CLAW_LOCAL_CONFIG", raising=False)
    monkeypatch.delenv("PRIME_CLAW_CONFIG", raising=False)
    assert pc.main(["--dry-run", "connect"]) == 0
    assert json.loads(log.read_text()) == ["-g", "local-gw", "--workspace", "local-ws",
                                           "sandbox", "get", "local-sb", "--output", "json"]
    assert "local-sb" in capsys.readouterr().out


def test_connect_inherits_stdio_and_preserves_exact_exit(monkeypatch):
    calls = []
    def fake_json(args, timeout=30):
        calls.append(("get", args))
        return {"name": "explicit-sb", "phase": "Ready"}, ""
    def fake_run(cmd, **kwargs):
        calls.append(("connect", cmd, kwargs))
        return SimpleNamespace(returncode=17)
    monkeypatch.setattr(pc, "openshell_json", fake_json)
    monkeypatch.setattr(pc.subprocess, "run", fake_run)
    monkeypatch.setattr(pc, "OPENSHELL", "/fake/openshell")
    monkeypatch.setattr(pc.sys, "stdin", SimpleNamespace(isatty=lambda: True))
    monkeypatch.setattr(pc.sys, "stdout", SimpleNamespace(isatty=lambda: True))
    assert pc.cmd_connect(config(), SimpleNamespace(dry_run=False)) == 17
    assert calls == [
        ("get", ["-g", "explicit-gw", "--workspace", "explicit-ws",
                 "sandbox", "get", "explicit-sb"]),
        ("connect", ["/fake/openshell", "sandbox", "exec", "-g", "explicit-gw",
                     "--workspace", "explicit-ws", "-n", "explicit-sb",
                     "--tty", "--", "/bin/bash", "-l"],
         {"check": False})]


@pytest.mark.parametrize("broken", [
    {"gateway": {}}, {"gateway": {"name": "old-gw", "forbidden": ["old-gw"]}},
    {"gateway": {"name": "-bad"}}, {"workspace": "bad value"},
    {"workspace": ""}, {"sandbox_name": ""}, {"sandbox_name": "../other"},
    {"sandbox_name": None},
])
def test_invalid_target_fails_before_any_command(monkeypatch, broken):
    monkeypatch.setattr(pc, "openshell_json", lambda *a, **kw: pytest.fail("unexpected probe"))
    assert pc.cmd_connect(config(**broken), SimpleNamespace(dry_run=False)) == 1


@pytest.mark.parametrize("record,error", [
    (None, "not found"), ({"phase": "Pending"}, ""), ({"phase": "Failed"}, ""),
    ({"phase": "Ready", "name": "other"}, ""), ({"phase": "Ready"}, ""), ([], ""),
])
def test_missing_unready_or_wrong_identity_never_connects(monkeypatch, record, error):
    monkeypatch.setattr(pc, "openshell_json", lambda *a, **kw: (record, error))
    monkeypatch.setattr(pc.subprocess, "run", lambda *a, **kw: pytest.fail("unexpected connect"))
    assert pc.cmd_connect(config(), SimpleNamespace(dry_run=False)) == 1


def test_dry_run_does_not_connect_even_without_tty(monkeypatch, capsys):
    monkeypatch.setattr(pc, "openshell_json", lambda *a, **kw:
                        ({"phase": "Ready", "name": "explicit-sb"}, ""))
    monkeypatch.setattr(pc.subprocess, "run", lambda *a, **kw: pytest.fail("unexpected connect"))
    monkeypatch.setattr(pc.sys, "stdin", SimpleNamespace(isatty=lambda: False))
    assert pc.cmd_connect(config(), SimpleNamespace(dry_run=True)) == 0
    assert ("dry_run: would run: openshell sandbox exec -g explicit-gw "
            "--workspace explicit-ws -n explicit-sb --tty -- /bin/bash -l"
            in capsys.readouterr().out)


def test_interactive_requires_tty(monkeypatch):
    monkeypatch.setattr(pc, "openshell_json", lambda *a, **kw: ({"phase": "Ready", "name": "explicit-sb"}, ""))
    monkeypatch.setattr(pc.subprocess, "run", lambda *a, **kw: pytest.fail("unexpected connect"))
    monkeypatch.setattr(pc.sys, "stdin", SimpleNamespace(isatty=lambda: False))
    assert pc.cmd_connect(config(), SimpleNamespace(dry_run=False)) == 1


def test_missing_executable_at_probe(monkeypatch, capsys):
    monkeypatch.setattr(pc, "OPENSHELL", "/missing/openshell")
    assert pc.cmd_connect(config(), SimpleNamespace(dry_run=False)) == 1
    assert "command not found" in capsys.readouterr().err


def test_missing_executable_at_attach(monkeypatch, capsys):
    monkeypatch.setattr(pc, "openshell_json", lambda *a, **kw: ({"phase": "Ready", "name": "explicit-sb"}, ""))
    monkeypatch.setattr(pc.sys, "stdin", SimpleNamespace(isatty=lambda: True))
    monkeypatch.setattr(pc.sys, "stdout", SimpleNamespace(isatty=lambda: True))
    monkeypatch.setattr(pc.subprocess, "run", lambda *a, **kw: (_ for _ in ()).throw(FileNotFoundError()))
    assert pc.cmd_connect(config(), SimpleNamespace(dry_run=False)) == 127
    assert "executable not found" in capsys.readouterr().err
