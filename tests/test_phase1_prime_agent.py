"""Regression coverage for Phase 1 Slice 2 (prime-agent in-sandbox).

Static contract tests: policy install channel, onload patch, apply/check/
validate artifact hygiene. Live acceptance is scripts/validate-phase1-prime-agent.py.
"""
from __future__ import annotations

import py_compile
import subprocess
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
POLICY = REPO_ROOT / "policies" / "phase1-sandbox.yaml"
ONLOAD = REPO_ROOT / "scripts" / "lib" / "npm-onload.js"
APPLY = REPO_ROOT / "scripts" / "apply-phase1-prime-agent.sh"
CHECK = REPO_ROOT / "scripts" / "check-phase1-prime-agent.sh"
VALIDATE = REPO_ROOT / "scripts" / "validate-phase1-prime-agent.py"


@pytest.fixture(scope="module")
def policy() -> dict:
    return yaml.safe_load(POLICY.read_text(encoding="utf-8"))


# --- install-channel policy contract -----------------------------------------

def test_install_channel_bound_to_correct_binaries(policy):
    net = policy["network_policies"]
    # curl fetches install.sh + the release tarball from these hosts:
    rel = net["prime_agent_release"]
    assert {e["host"] for e in rel["endpoints"]} == {
        "app.primeintellect.ai",
        "pub-728493de92a943e2a9b2d17b4719f318.r2.dev",
    }
    assert [b["path"] for b in rel["binaries"]] == ["/usr/bin/curl"]
    # npm (node) fetches runtime deps + bundled component tarballs:
    npm = net["prime_agent_npm_deps"]
    assert {e["host"] for e in npm["endpoints"]} == {
        "registry.npmjs.org",
        "pub-728493de92a943e2a9b2d17b4719f318.r2.dev",
    }
    assert [b["path"] for b in npm["binaries"]] == ["/usr/bin/node"]


def test_kernel_bootstrap_channel(policy):
    net = policy["network_policies"]
    kb = net["kernel_bootstrap"]
    hosts = {e["host"] for e in kb["endpoints"]}
    assert {"astral.sh", "github.com", "pypi.org", "files.pythonhosted.org"} <= hosts
    paths = {b["path"] for b in kb["binaries"]}
    assert "/usr/bin/curl" in paths
    assert any(p.endswith("/uv") for p in paths)


def test_install_channels_do_not_include_credential_hosts(policy):
    """No model-API host may appear in the install/bootstrap channels —
    credential egress is Slice 3's providers, not a policy hole."""
    forbidden = {"api.anthropic.com", "api.openai.com", "bedrock.amazonaws.com"}
    for entry in policy["network_policies"].values():
        hosts = {e["host"] for e in entry["endpoints"]}
        assert not (hosts & forbidden), entry.get("name")


# --- npm onload patch contract ------------------------------------------------

def test_onload_patch_decodes_encoded_slash_case_insensitively():
    src = ONLOAD.read_text(encoding="utf-8")
    assert "/%2f/i" in src or "/%2F/i" in src, "must match %2F case-insensitively"
    assert "replace(/%2f/gi" in src or "replace(/%2F/gi" in src
    assert "globalThis.fetch" in src and "https.request" in src


def test_onload_patch_documents_proxy_reason():
    src = ONLOAD.read_text(encoding="utf-8")
    assert "proxy" in src.lower() and "%2F" in src


# --- artifact hygiene ---------------------------------------------------------

@pytest.mark.parametrize("script", [APPLY, CHECK, VALIDATE])
def test_slice2_scripts_exist_executable_parse(script):
    assert script.exists() and script.stat().st_mode & 0o111
    if script.suffix == ".sh":
        subprocess.run(["bash", "-n", str(script)], check=True)
    else:
        py_compile.compile(str(script), doraise=True)


def test_apply_dry_run_declares_constraints():
    cp = subprocess.run(["bash", str(APPLY), "--dry-run"], capture_output=True, text=True)
    assert cp.returncode == 0
    assert "dry_run:" in cp.stdout
    assert "host_credential_access: prohibited" in cp.stdout
    assert "%2F" in cp.stdout  # documents the proxy workaround


def test_apply_pins_host_instance_version():
    """D11: same instance as the operator host. The default version pin must
    match the host's installed prime-agent."""
    src = APPLY.read_text(encoding="utf-8")
    assert "PRIME_AGENT_VERSION:-0.9.3" in src
