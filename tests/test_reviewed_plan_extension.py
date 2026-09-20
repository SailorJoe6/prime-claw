"""Regression bridge for the native reviewed-plan command."""

import json
from pathlib import Path
import shutil
import subprocess
import tempfile


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / ".prime" / "agent" / "extensions" / "reviewed-plan.ts"
NODE_SUITE = REPO / "tests" / "reviewed_plan_extension.test.mjs"


def test_reviewed_plan_node_suite() -> None:
    """Run the TypeScript extension against a mocked ExtensionAPI."""
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


def test_prime_agent_rpc_loads_exactly_one_native_plan_command() -> None:
    """Ask the installed offline Prime Agent loader for registered commands."""
    prime_agent = shutil.which("prime-agent")
    assert prime_agent, "prime-agent is a documented developer prerequisite"
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    with tempfile.TemporaryDirectory(prefix="prime-claw-plan-loader-") as cwd:
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
        if command["name"] == "plan"
    ]
    assert len(commands) == 1
    assert Path(commands[0]["sourceInfo"]["path"]).resolve() == EXTENSION.resolve()


def test_plan_skill_has_only_one_slash_command_surface() -> None:
    """The native /plan command must not compete with /skill:plan."""
    assert not (REPO / ".agents" / "skills" / "plan").exists()


def test_plan_skill_keeps_output_in_selected_folder_and_stops_for_review() -> None:
    """Project policy consumes native input without crossing approval gates."""
    skill = (REPO / ".ralph" / "skills" / "plan" / "SKILL.md").read_text()
    assert "<operator-plan-location>" not in skill
    required = (
        "operator plan location",
        "Do not guess, substitute, or select a different",
        "future folder",
        "Save `EXECUTION_PLAN.md` in the selected",
        "Keep all other planning",
        "artifacts in that same folder",
        "link every planning artifact created or updated",
        "explicitly ask the operator to review the plan",
        "stop without implementing",
        "Planning does not authorize implementation",
    )
    for fragment in required:
        assert fragment in skill
