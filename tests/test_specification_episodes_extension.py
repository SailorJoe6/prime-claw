"""Acceptance bridge for specification commands and future-incubation automation."""

import json
import re
from pathlib import Path
import shutil
import subprocess
import tempfile


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / ".prime" / "agent" / "extensions" / "specification-episodes.ts"
NODE_SUITE = REPO / "tests" / "specification_episodes_extension.test.mjs"


def test_specification_episodes_node_suite():
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


def test_prime_agent_rpc_loads_native_commands():
    prime_agent = shutil.which("prime-agent")
    assert prime_agent, "prime-agent is a documented developer prerequisite"
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    with tempfile.TemporaryDirectory(prefix="prime-claw-specification-loader-") as cwd:
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
    commands = {
        command["name"]: command for command in response["data"]["commands"]
        if command["name"] in {"design", "spec-it-out"}
    }
    assert set(commands) == {"design", "spec-it-out"}
    assert all(Path(command["sourceInfo"]["path"]).resolve() == EXTENSION.resolve() for command in commands.values())


def test_canonical_skills_define_interview_then_explicit_bridge():
    for name in ("design", "spec-it-out"):
        skill = (REPO / ".ralph" / "skills" / name / "SKILL.md").read_text()
        assert re.search(r"one\s+at\s+a\s+time", skill)
        assert "all material" in skill
        assert "future" in skill
        assert "episode" in skill
        assert "<operator-specification-context>" in skill
        assert "never\nselects a workflow, file, disposition, or host action" in skill
        assert "spec_disposition" in skill
        assert "exactly once" in skill
        assert "Do not run Git" in skill


def test_slice1_requirements_are_traced_without_overclaiming_later_mutations():
    inventory = json.loads((REPO / "config" / "requirements-inventory.json").read_text())
    entries = {item["id"]: item for item in inventory["requirements"]}
    expected = {"R-WE-5", "R-WE-7", "R-WE-8", "R-WE-9", "R-WE-34"}
    assert expected <= entries.keys()
    assert "partially proven" in entries["R-WE-34"]["status"]
    for requirement_id in expected:
        referenced = entries[requirement_id]["proven_by"]
        assert all((REPO / path).exists() for paths in referenced.values() for path in paths)



def test_slice2_future_requirements_are_traced():
    inventory = json.loads((REPO / "config" / "requirements-inventory.json").read_text())
    entries = {item["id"]: item for item in inventory["requirements"]}
    expected = {
        "R-WE-1", "R-WE-2", "R-WE-10", "R-WE-11", "R-WE-12",
        "R-WE-31", "R-WE-32", "R-WE-33", "R-WE-35", "R-WE-36",
        "R-WE-69", "R-WE-70", "R-WE-71", "R-WE-72",
    }
    assert expected <= entries.keys()
    assert entries["R-WE-10"]["status"].startswith("proven")
    for requirement_id in {"R-WE-35", "R-WE-36", "R-WE-69", "R-WE-70", "R-WE-71", "R-WE-72"}:
        assert entries[requirement_id]["status"].startswith("proven")
    for requirement_id in expected:
        referenced = entries[requirement_id]["proven_by"]
        assert all((REPO / path).exists() for paths in referenced.values() for path in paths)

def test_legacy_skill_aliases_remain_until_both_real_dispositions_are_proven():
    # R-WE-6 is intentionally Slice 4. Future mutation is proven in Slice 2,
    # but removing aliases before the episode path exists would strand operators.
    assert (REPO / ".agents" / "skills" / "design").exists()
    assert (REPO / ".agents" / "skills" / "spec-it-out").exists()
