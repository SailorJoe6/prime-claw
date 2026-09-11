"""Regression coverage for the Phase 1 sandbox slice (Slice 1).

Static contract tests: the policy, scripts, inventory, and docs layout must
keep the properties the spike proved. Live egress acceptance is the job of
scripts/validate-phase1-sandbox.py (run it directly; it needs the gateway).
"""
from __future__ import annotations

import json
import py_compile
import re
import subprocess
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
POLICY = REPO_ROOT / "policies" / "phase1-sandbox.yaml"
APPLY = REPO_ROOT / "scripts" / "apply-phase1-sandbox.sh"
CHECK = REPO_ROOT / "scripts" / "check-phase1-sandbox.sh"
VALIDATE = REPO_ROOT / "scripts" / "validate-phase1-sandbox.py"
INVENTORY = REPO_ROOT / "config" / "requirements-inventory.json"
DERISK = REPO_ROOT / "docs" / "derisk"

# Things that must never appear in committed artifacts (credential isolation,
# R-X-5). Extend deliberately, never casually.
SECRET_PATTERNS = [
    re.compile(r"sk-ant-", re.IGNORECASE),
    re.compile(r"sk-[a-zA-Z0-9]{20,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"xox[baprs]-"),
]
SCAN_SUFFIXES = {".sh", ".py", ".yaml", ".yml", ".json", ".md"}


@pytest.fixture(scope="module")
def policy() -> dict:
    return yaml.safe_load(POLICY.read_text(encoding="utf-8"))


# --- policy contract (R-U1-5) ------------------------------------------------

def test_policy_schema_version(policy):
    assert policy["version"] == 1


def test_policy_deny_by_default_canary_stays_minimal(policy):
    """The egress canary is the R-U1-5 proof endpoint: exactly one benign
    host, curl only. Later slices add real entries alongside it (Slice 2's
    install channels); the canary itself must not grow."""
    net = policy.get("network_policies", {})
    assert "egress_canary" in net
    canary = net["egress_canary"]
    assert canary["endpoints"] == [{"host": "example.com", "port": 443}]
    paths = [b["path"] for b in canary["binaries"]]
    assert paths == ["/usr/bin/curl"]


def test_policy_every_entry_is_named_and_scoped(policy):
    """Every network entry must be named (reviewable) and binary-scoped —
    no unbound host allow-listing."""
    for key, entry in policy.get("network_policies", {}).items():
        assert entry.get("name"), key
        assert entry["binaries"], key
        for b in entry["binaries"]:
            assert b["path"].startswith("/"), (key, b)
        assert entry["endpoints"], key


def test_policy_filesystem_scope(policy):
    fs = policy["filesystem_policy"]
    assert fs["include_workdir"] is True
    rw = set(fs["read_write"])
    assert {"/sandbox", "/tmp"} <= rw
    assert "/" not in rw  # overly-broad rw root is rejected by OpenShell anyway
    assert not rw.intersection(fs["read_only"])


# --- artifact presence & hygiene (R-X-1, R-X-5) ------------------------------

@pytest.mark.parametrize("script", [APPLY, CHECK, VALIDATE])
def test_scripts_exist_executable_and_parse(script):
    assert script.exists(), script
    assert script.stat().st_mode & 0o111, f"{script} not executable"
    if script.suffix == ".sh":
        subprocess.run(["bash", "-n", str(script)], check=True)
    else:
        py_compile.compile(str(script), doraise=True)


def test_apply_dry_run_is_safe_and_declares_prohibitions():
    cp = subprocess.run(["bash", str(APPLY), "--dry-run"],
                        capture_output=True, text=True)
    assert cp.returncode == 0
    assert "dry_run:" in cp.stdout
    assert "host_credential_access: prohibited" in cp.stdout
    assert "nemoclaw_recipe_use: prohibited" in cp.stdout


def test_no_credential_material_in_committed_artifacts():
    roots = [REPO_ROOT / "scripts", REPO_ROOT / "policies",
             REPO_ROOT / "config", REPO_ROOT / "docs" / "derisk"]
    for root in roots:
        for path in root.rglob("*"):
            if path.is_file() and path.suffix in SCAN_SUFFIXES:
                text = path.read_text(encoding="utf-8", errors="replace")
                for pat in SECRET_PATTERNS:
                    assert not pat.search(text), f"{path}: matched {pat.pattern}"


# --- requirements inventory (R-X-2) ------------------------------------------

@pytest.fixture(scope="module")
def inventory() -> dict:
    return json.loads(INVENTORY.read_text(encoding="utf-8"))


def test_inventory_covers_slice1_requirements(inventory):
    ids = {r["id"] for r in inventory["requirements"]}
    assert {"R-U1-1", "R-U1-2", "R-U1-5"} <= ids


def test_inventory_referenced_files_exist(inventory):
    for req in inventory["requirements"]:
        for group, files in req.get("proven_by", {}).items():
            for f in files:
                assert (REPO_ROOT / f).exists(), f"{req['id']}: missing {f}"


def test_inventory_slice1_entries_marked_proven(inventory):
    for req in inventory["requirements"]:
        if req["id"] in {"R-U1-1", "R-U1-2", "R-U1-5"}:
            assert req["status"] == "proven", req["id"]


# --- evidence layout (R-X-3 scaffolding) --------------------------------------

def test_derisk_layout_exists():
    assert DERISK.is_dir()
    assert (DERISK / "README.md").exists()
    assert (DERISK / "evidence").is_dir()
