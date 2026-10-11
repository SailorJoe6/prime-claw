"""Linux-authoritative final role reconciler fixtures."""
import json
import time
import pytest

WS_MANAGER = "/workspace/scripts/manage-prime-agent-role-protocol.py"
WS_KERNEL = "/workspace/src/prime-agent-plugin/ROLE_KERNEL.md"
WS_PROBE = "/workspace/tests/container/role_kernel_reconciler_probe.py"

@pytest.mark.parametrize("scenario", ["priority","preserve","malformed","drift","unsafe","concurrent","old-final","interrupted","rollback","hardlink"])
def test_final_role_reconciler_matrix(tier1_container, scenario) -> None:
    workdir=f"/tmp/role-reconciler-{scenario}-{time.time_ns()}"
    result=tier1_container.run("python3",WS_PROBE,WS_MANAGER,WS_KERNEL,workdir,scenario,workdir=None,timeout=120)
    assert result.returncode==0,result.stdout+result.stderr
    assert json.loads(result.stdout.strip().splitlines()[-1])=={"ok":True,"scenario":scenario}
