"""Docker-authoritative runtime tests for the official EXPERT prerequisite."""

import json
import time


def test_official_expert_exact_interpreter_preflight_matrix(tier1_container) -> None:
    work = f"/tmp/official-expert-preflight-{time.time_ns()}"
    result = tier1_container.run(
        "python3",
        "/workspace/tests/container/expert_runtime_probe.py",
        "/workspace/scripts/check-prime-agent-expert-runtime.py",
        "/workspace/src/prime-agent-plugin/skills/prime-claw-official-expert-review",
        work,
        "/workspace/src/prime-agent-plugin/extension-support/expert-review-reservation.ts",
        workdir=None,
        timeout=180,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout.strip().splitlines()[-1]) == {
        "configured": "AVAILABLE",
        "managed": "SYNC_PENDING",
        "ok": True,
    }
