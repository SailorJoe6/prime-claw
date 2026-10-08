"""Linux-authoritative role-protocol manager fixtures."""

import json
import time

import pytest


WS_MANAGER = "/workspace/scripts/manage-prime-agent-role-protocol.py"
WS_CONFIG = "/workspace/src/prime-agent-plugin/role-protocol.json"
WS_KERNEL = "/workspace/src/prime-agent-plugin/ROLE_KERNEL.md"
WS_LEGACY = "/workspace/tests/fixtures/role-protocol-legacy-append.md"
WS_PROBE = "/workspace/tests/container/role_protocol_probe.py"


@pytest.mark.parametrize(
    "scenario",
    [
        "priority",
        "preserve",
        "malformed",
        "drift",
        "receipt",
        "receipt-validation",
        "unsafe",
        "concurrent",
        "legacy-adoption",
        "ordinary-failure",
        "final-removal",
    ],
)
def test_role_protocol_manager_matrix(tier1_container, croot, scenario) -> None:
    # Filesystem identity and no-follow behavior must run on the container's
    # native Linux filesystem. Docker Desktop bind mounts can remap inode/uid
    # metadata asynchronously and cannot represent all case-distinct names.
    workdir = f"/tmp/role-protocol-{scenario}-{time.time_ns()}"
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
        timeout=240,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    verdict = json.loads(result.stdout.strip().splitlines()[-1])
    assert verdict == {"ok": True, "scenario": scenario}
