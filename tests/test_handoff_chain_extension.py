"""Regression bridge for the Prime Agent handoff-chain extension."""

import json
from pathlib import Path
import shutil
import subprocess
import tempfile


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / ".prime" / "agent" / "extensions" / "handoff-chain.ts"
NODE_SUITE = REPO / "tests" / "handoff_chain_extension.test.mjs"


def test_handoff_chain_node_suite():
    """Run the real TypeScript extension against a mocked ExtensionAPI."""
    node = shutil.which("node")
    assert node, "Node.js is required because prime-agent itself requires Node >=22.8"
    result = subprocess.run(
        [node, "--experimental-strip-types", "--test", str(NODE_SUITE)],
        cwd=REPO,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_prime_agent_rpc_loads_native_handoff_command():
    """Smoke the installed Prime Agent loader without invoking a model."""
    prime_agent = shutil.which("prime-agent")
    assert prime_agent, "prime-agent is a documented developer prerequisite"
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    with tempfile.TemporaryDirectory(prefix="prime-claw-handoff-loader-") as cwd:
        result = subprocess.run(
            [
                prime_agent,
                "--mode", "rpc",
                "--offline",
                "--no-session",
                "--no-skills",
                "--no-prompt-templates",
                "--no-context-files",
                "--no-extensions",
                "--cwd", cwd,
                "-e", str(EXTENSION),
            ],
            cwd=REPO,
            input=request,
            text=True,
            capture_output=True,
            timeout=30,
            check=False,
        )
    assert result.returncode == 0, result.stdout + result.stderr
    response = json.loads(result.stdout.strip().splitlines()[-1])
    assert response["success"] is True
    commands = [
        command for command in response["data"]["commands"]
        if command["name"] == "handoff"
    ]
    assert len(commands) == 1
    assert Path(commands[0]["sourceInfo"]["path"]).resolve() == EXTENSION.resolve()


def test_handoff_skill_has_only_one_slash_command_surface():
    """The native /handoff command must not compete with /skill:handoff."""
    assert not (REPO / ".agents" / "skills" / "handoff").exists()


def test_handoff_skill_reports_compaction_without_owning_execute_admission():
    """The workflow must report immediate compaction state and not route execute."""
    skill = (REPO / ".ralph" / "skills" / "handoff" / "SKILL.md").read_text()
    assert "<operator-compaction-guidance>" in skill
    assert "compaction_result = await compact.run(focus_hint)" in skill
    assert "It is guidance only; it never selects the next phase." in skill
    assert "scheduled: true" in skill
    assert "not confirmation that compaction completed" in skill
    assert "canonical `execute` is already queued independently" in skill
    assert "Do not wait for `session_compact`" in skill
    assert "invoke execute yourself" in skill
