"""Linux-authoritative role-protocol manager fixtures."""

import json
import time

import pytest


WS_MANAGER = "/workspace/scripts/manage-prime-agent-role-protocol.py"
WS_CONFIG = "/workspace/src/prime-agent-plugin/role-protocol.json"
WS_KERNEL = "/workspace/src/prime-agent-plugin/ROLE_KERNEL.md"
WS_LEGACY = "/workspace/src/prime-agent-plugin/APPEND_SYSTEM.md"
WS_PROBE = "/workspace/tests/container/role_protocol_probe.py"


@pytest.mark.parametrize(
    "scenario",
    ["priority", "preserve", "malformed", "drift", "receipt", "unsafe", "concurrent"],
)
def test_role_protocol_manager_matrix(tier1_container, croot, scenario) -> None:
    workdir = f"{croot}/role-protocol-{scenario}-{time.time_ns()}"
    result = tier1_container.run(
        "python3",
        WS_PROBE,
        WS_MANAGER,
        WS_CONFIG,
        WS_KERNEL,
        WS_LEGACY,
        workdir,
        scenario,
        workdir=None,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    verdict = json.loads(result.stdout.strip().splitlines()[-1])
    assert verdict == {"ok": True, "scenario": scenario}
