"""Contract coverage for the managed lean session protocol.

Tier 0 checks the static managed-source contract. Tier 1 repeats the contract
inside the isolated plugin test container through the Node bridge below.
"""

from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
MANAGED_SOURCE = REPO / "src/prime-agent-plugin"
KERNEL = MANAGED_SOURCE / "APPEND_SYSTEM.md"
RETIRED = MANAGED_SOURCE / "extensions/goal-heartbeat-work-control.ts"
OBSOLETE = MANAGED_SOURCE / "extensions/goal-blocker-control.ts"
WS_NODE_SUITE = "/workspace/tests/managed_session_protocol.test.mjs"
EXPECTED_TYPESCRIPT = {
    "extensions/handoff-chain.ts",
    "extensions/reviewed-plan.ts",
    "extension-support/conversation-oversight.ts",
    "extension-support/episode-close.ts",
    "extension-support/handoff-prompts.ts",
    "extension-support/prep-chain.ts",
    "extension-support/reviewed-plan-support.ts",
    "extension-support/role-kernel.generated.ts",
    "extension-support/spec-episode.ts",
}


def test_managed_session_protocol_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", WS_NODE_SUITE,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_lean_append_system_owns_session_and_work_control_semantics() -> None:
    source = " ".join(KERNEL.read_text().split())
    required = (
        "An independent top-level project session is a CONVERSATION",
        "supervises it rather than doing its implementation",
        "one reviewable vertical slice at a time",
        "MUST use the canonical handoff protocol command",
        "maintain a goal so interrupted work resumes",
        "establish a heartbeat for that exact wait and complete the goal",
        "When waiting for the user, complete the goal and create no heartbeat",
        "When all work is complete, retain neither",
    )
    for phrase in required:
        assert phrase in source
    assert len(source.split()) <= 250


def test_managed_plugin_has_nine_files_and_no_retired_work_control_transport() -> None:
    actual = {
        str(path.relative_to(MANAGED_SOURCE))
        for path in MANAGED_SOURCE.rglob("*.ts")
    }
    assert actual == EXPECTED_TYPESCRIPT
    assert not RETIRED.exists()
    assert not OBSOLETE.exists()
    source = "\n".join(
        path.read_text()
        for path in sorted(MANAGED_SOURCE.rglob("*"))
        if path.is_file()
    )
    assert 'name: "pause_thread_goal"' not in source
    assert 'name: "resume_thread_goal"' not in source
    assert 'sendUserMessage("/goal pause"' not in source
    assert 'sendUserMessage("/goal resume"' not in source
    assert "PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1" not in source
