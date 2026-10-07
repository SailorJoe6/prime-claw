"""Static contracts for the inert official EXPERT prerequisite package."""

import ast
import hashlib
from pathlib import Path
import tomllib


REPO = Path(__file__).resolve().parents[1]
SKILL = REPO / "src/prime-agent-plugin/skills/prime-claw-official-expert-review"
PACKAGE = SKILL / "src/prime_claw_official_expert_review"
PROFILE = REPO / ".prime/agent/profiles/expert-reviewer.md"
EXPECTED_FILES = {
    "SKILL.md",
    "pyproject.toml",
    "src/prime_claw_official_expert_review/__init__.py",
    "src/prime_claw_official_expert_review/reviewer.md",
}


def test_official_expert_skill_has_one_exact_managed_package_inventory() -> None:
    actual = {
        str(path.relative_to(SKILL))
        for path in SKILL.rglob("*")
        if path.is_file()
    }
    assert actual == EXPECTED_FILES


def test_managed_reviewer_definition_is_exact_standalone_migration_evidence() -> None:
    managed = PACKAGE / "reviewer.md"
    assert managed.read_bytes() == PROFILE.read_bytes()
    digest = hashlib.sha256(PROFILE.read_bytes()).hexdigest()
    assert digest == "d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6"
    source = (PACKAGE / "__init__.py").read_text()
    assert f'REVIEWER_DEFINITION_SHA256 = "{digest}"' in source


def test_official_expert_package_has_no_host_dependency_or_side_effect_import() -> None:
    project = tomllib.loads((SKILL / "pyproject.toml").read_text())["project"]
    assert project["name"] == "prime-claw-official-expert-review"
    assert project["dependencies"] == []
    tree = ast.parse((PACKAGE / "__init__.py").read_text())
    imports = {
        alias.name.split(".")[0]
        for node in ast.walk(tree)
        if isinstance(node, ast.Import)
        for alias in node.names
    } | {
        (node.module or "").split(".")[0]
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom)
    }
    assert imports <= {"__future__", "hashlib", "json", "pathlib", "typing"}
    runtime_source = (PACKAGE / "__init__.py").read_text()
    for forbidden in ("host_request", "rlm", "agent_message"):
        assert forbidden not in runtime_source



def test_official_expert_skill_explicitly_defers_authority_and_admission() -> None:
    text = " ".join((SKILL / "SKILL.md").read_text().split())
    for phrase in (
        "It is inert",
        "authority: false",
        "SYNC_PENDING",
        "PRIME_AGENT_KERNEL_PYTHON",
        "normal already-installed",
        "Generic RLM children remain generic",
        "Reviewer discovery, spawn, reservation, nonce/expiry state, handle binding",
    ):
        assert phrase in text
