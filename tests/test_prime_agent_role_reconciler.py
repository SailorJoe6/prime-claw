from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import subprocess
import sys

import pytest


ROOT = Path(__file__).parents[1]
MANAGER = ROOT / "scripts/manage-prime-agent-role-protocol.py"
KERNEL = ROOT / "src/prime-agent-plugin/ROLE_KERNEL.md"


def load_manager():
    spec = importlib.util.spec_from_file_location("role_manager", MANAGER)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_inspect_accepts_one_link_visible_through_case_variant(monkeypatch, tmp_path: Path) -> None:
    manager = load_manager()
    context = tmp_path / "context"
    context.mkdir()
    physical = tmp_path / "physical"
    physical.write_bytes(b"operator context\n")
    loaded = (physical.read_bytes(), physical.stat())
    found = {name: None for name in manager.CONTEXT_CANDIDATES}
    found["AGENTS.md"] = loaded
    found["AGENTS.MD"] = loaded
    monkeypatch.setattr(manager, "candidates", lambda _root: ("AGENTS.md", found))

    inspected = manager.inspect(context, KERNEL.read_bytes())

    assert inspected["selected"] == "AGENTS.md"
    assert inspected["contextData"] == b"operator context\n"


def test_apply_accepts_case_variant_on_case_insensitive_filesystem(tmp_path: Path) -> None:
    root = tmp_path / "agent"
    root.mkdir()
    context = root / "AGENTS.md"
    context.write_text("operator context\n")
    variant = root / "AGENTS.MD"
    if not variant.exists() or not os.path.samefile(context, variant):
        pytest.skip("filesystem is case-sensitive")
    assert context.stat().st_nlink == 1

    applied = subprocess.run(
        [sys.executable, str(MANAGER), "apply", str(KERNEL), str(root)],
        capture_output=True,
        text=True,
    )
    checked = subprocess.run(
        [sys.executable, str(MANAGER), "check", str(KERNEL), str(root)],
        capture_output=True,
        text=True,
    )

    assert applied.returncode == 0, applied.stderr
    assert checked.returncode == 0, checked.stderr


def test_apply_still_rejects_distinct_hard_linked_candidates(tmp_path: Path) -> None:
    root = tmp_path / "agent"
    root.mkdir()
    selected = root / "AGENTS.md"
    selected.write_text("operator context\n")
    linked = root / "CLAUDE.md"
    os.link(selected, linked)
    before = selected.read_bytes()

    applied = subprocess.run(
        [sys.executable, str(MANAGER), "apply", str(KERNEL), str(root)],
        capture_output=True,
        text=True,
    )

    assert applied.returncode != 0
    assert "hard-linked global context aliases are unsupported" in applied.stderr
    assert selected.read_bytes() == before
    assert linked.read_bytes() == before
    assert not (root / ".prime-claw/role-protocol-state.json").exists()
