"""Tests for Slice 3 credential artifacts (structure + safety invariants).

These do NOT touch live credentials or the gateway; they assert the scripts
enforce the R-X-5 no-secrets rule and the R-X-7 configurability contract, and
that the validator checks all four R-U1-6 sub-conditions.
"""
import os, re, subprocess
import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPLY = os.path.join(REPO, "scripts", "apply-phase1-providers.sh")
VALIDATE = os.path.join(REPO, "scripts", "validate-phase1-credentials.py")
POLICY = os.path.join(REPO, "policies", "phase1-sandbox.yaml")


def read(p):
    return open(p).read()


def test_apply_script_exists_and_executable():
    assert os.path.isfile(APPLY)
    assert os.access(APPLY, os.X_OK)


def test_apply_script_bash_syntax():
    r = subprocess.run(["bash", "-n", APPLY], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


def test_apply_script_is_configurable_not_hardcoded():
    """R-X-7/D14: gateway host/port/provider are env-overridable, not hardcoded."""
    s = read(APPLY)
    assert "PRIME_CLAW_AI_GATEWAY_HOST" in s
    assert "PRIME_CLAW_AI_GATEWAY_PROVIDER" in s
    assert "PRIME_CLAW_HOST_AUTH_JSON" in s
    # the key must come from host config at apply time, not a literal in the file
    assert "GATEWAY_KEY=" in s and "auth.json" in s


def test_apply_script_never_echoes_key():
    """R-X-5: the gateway key is unset after use and never printed."""
    s = read(APPLY)
    assert "unset GATEWAY_KEY" in s
    # no echo/printf of the key variable's value
    assert not re.search(r'(echo|printf)[^\n]*\$\{?GATEWAY_KEY', s)


def test_apply_script_dry_run_makes_no_mutation():
    r = subprocess.run(["bash", APPLY, "--dry-run"], capture_output=True, text=True)
    assert r.returncode == 0
    assert "dry_run" in r.stdout


def test_validator_covers_all_four_subconditions():
    """R-U1-6 a/b/c/d must each have a check."""
    s = read(VALIDATE)
    for tag in ["(a)", "(b)", "(c)", "(d)"]:
        assert tag in s, f"missing subcondition {tag}"
    assert "prime-agent -p" in s  # (b) uses the real agent, not just curl


def test_policy_uses_gateway_endpoint_not_native_hosts():
    """D12: credentialed egress targets the AI Gateway, not provider-native hosts."""
    s = read(POLICY)
    assert "ai-gateway.zende.sk" in s
    assert "api.anthropic.com" not in s
    assert "api.openai.com" not in s


def test_policy_gateway_endpoint_is_inspected_rest():
    """Credential injection requires an inspected `protocol: rest` endpoint."""
    s = read(POLICY)
    i = s.find("model_ai_gateway")
    assert i >= 0
    block = s[i:i+600]
    assert "protocol: rest" in block
    assert "read-write" in block
