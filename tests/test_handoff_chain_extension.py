"""Regression bridge for the Prime Agent handoff-chain extension.

Tier policy: the node suite bridge and the live RPC probe are tier 1 —
they run INSIDE the session's tier-1 container via the `tier1_container`
fixture (auto-marked `container`; see tests/conftest.py). The two skill
policy checks are static repo checks and stay tier 0.
"""

import json
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
# Tier-0 static reference (host repo path).
EXTENSION = REPO / "src" / "prime-agent-plugin" / "extensions" / "handoff-chain.ts"
# Container paths: the repo is bind-mounted read-only at /workspace in the
# tier-1 container. Tier-1 test code never references host paths or host
# binaries.
WS_EXTENSION = "/workspace/src/prime-agent-plugin/extensions/handoff-chain.ts"
WS_NODE_SUITE = "/workspace/tests/handoff_chain_extension.test.mjs"


def test_handoff_chain_node_suite(tier1_container):
    """Run the real TypeScript extension against a mocked ExtensionAPI."""
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", WS_NODE_SUITE,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_prime_agent_rpc_loads_native_handoff_command_and_conversational_tool(
    tier1_container, ctmp,
):
    """Probe the container's installed offline Prime Agent for both explicit
    entry surfaces."""
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    probe_source = """export default function probe(pi) {
  pi.on("session_start", () => {
    if (pi.getAllTools().some((tool) => tool.name === "ralph_handoff")) {
      pi.registerCommand("probe-ralph-handoff-tool", {
        description: "RPC proof that ralph_handoff is registered",
        handler: async () => {},
      });
    }
  });
}
"""
    probe = ctmp / "tool-probe.ts"
    probe.write_text(probe_source)
    result = tier1_container.run(
        "prime-agent",
        "--mode", "rpc",
        "--offline",
        "--no-session",
        "--no-skills",
        "--no-prompt-templates",
        "--no-context-files",
        "--no-extensions",
        "--cwd", str(ctmp),
        "-e", WS_EXTENSION,
        "-e", str(probe),
        input_text=request,
        timeout=40,
        workdir=None,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    response = json.loads(result.stdout.strip().splitlines()[-1])
    assert response["success"] is True
    commands = response["data"]["commands"]
    handoff = [command for command in commands if command["name"] == "handoff"]
    assert len(handoff) == 1
    assert handoff[0]["sourceInfo"]["path"] == WS_EXTENSION
    assert [command["name"] for command in commands].count(
        "probe-ralph-handoff-tool"
    ) == 1


def test_handoff_skill_has_only_one_slash_command_surface():
    """The native /handoff command must not compete with /skill:handoff."""
    assert not (REPO / ".agents" / "skills" / "handoff").exists()


def test_handoff_skill_reports_compaction_without_owning_execute_admission():
    """The workflow must report immediate compaction state and not route execute."""
    skill = (REPO / ".prime-claw" / "workflows" / "handoff.md").read_text()
    assert "<operator-compaction-guidance>" in skill
    assert "compaction_result = await compact.run(focus_hint)" in skill
    assert "It is guidance only; it never selects the next phase." in skill
    assert "scheduled: true" in skill
    assert "not confirmation that compaction completed" in skill
    assert "canonical `execute` is already queued independently" in skill
    assert "Do not wait for `session_compact`" in skill
    assert "invoke execute yourself" in skill
