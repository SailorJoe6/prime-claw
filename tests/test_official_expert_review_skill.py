"""Contracts for the private official EXPERT launch package."""
import asyncio
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import tomllib

import pytest

REPO = Path(__file__).resolve().parents[1]
SKILL = REPO / "src/prime-agent-plugin/skills/prime-claw-official-expert-review"
PACKAGE = SKILL / "src/prime_claw_official_expert_review"
PROFILE = REPO / ".prime/agent/profiles/expert-reviewer.md"
EXPECTED_FILES = {"SKILL.md", "pyproject.toml", "src/prime_claw_official_expert_review/__init__.py", "src/prime_claw_official_expert_review/reviewer.md"}


def load_package():
    spec = importlib.util.spec_from_file_location("prime_claw_official_expert_review", PACKAGE / "__init__.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    return module


def test_official_expert_skill_has_one_exact_managed_package_inventory() -> None:
    assert {str(path.relative_to(SKILL)) for path in SKILL.rglob("*") if path.is_file()} == EXPECTED_FILES


def test_managed_reviewer_definition_is_exact_standalone_migration_evidence() -> None:
    assert (PACKAGE / "reviewer.md").read_bytes() == PROFILE.read_bytes()
    digest = hashlib.sha256(PROFILE.read_bytes()).hexdigest()
    assert digest == "d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6"
    assert f'REVIEWER_DEFINITION_SHA256 = "{digest}"' in (PACKAGE / "__init__.py").read_text()


def test_official_expert_package_uses_only_stdlib_plus_public_rlm_import() -> None:
    project = tomllib.loads((SKILL / "pyproject.toml").read_text())["project"]
    assert project["dependencies"] == []
    tree = ast.parse((PACKAGE / "__init__.py").read_text())
    imports = {alias.name.split(".")[0] for node in ast.walk(tree) if isinstance(node, ast.Import) for alias in node.names} | {(node.module or "").split(".")[0] for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)}
    assert imports <= {"__future__", "hashlib", "json", "os", "pathlib", "secrets", "stat", "subprocess", "time", "typing", "rlm"}
    source = (PACKAGE / "__init__.py").read_text()
    assert "agent_message" not in source and "host_request" not in source
    assert "await rlm.find_models" in source and "await rlm.spawn" in source


def owner_fixture(tmp_path: Path, monkeypatch, module):
    agent = tmp_path / "agent"; sessions = agent / "sessions"; artifacts = agent / "session-artifacts"
    sessions.mkdir(parents=True); artifacts.mkdir()
    project = tmp_path / "project"; project.mkdir()
    repository = tmp_path / "episode"; repository.mkdir()
    os.system(f"git -C {repository} init -q && git -C {repository} config user.name Test && git -C {repository} config user.email test@example.invalid")
    (repository / "candidate").write_text("candidate\n")
    os.system(f"git -C {repository} add candidate && git -C {repository} commit -qm candidate")
    commit = os.popen(f"git -C {repository} rev-parse HEAD").read().strip()
    owner = "11111111-1111-7111-8111-111111111111"; artifact = artifacts / owner; artifact.mkdir()
    header = {"type": "session", "version": 3, "id": owner, "timestamp": "2026-10-07T00:00:00Z", "cwd": str(project), "rlmDepth": 0}
    marker = {"markerVersion": 2, "status": "active", "ownerSessionId": owner, "slug": "alpha-plan", "sourceLocation": ".ralph/plans/future/alpha-plan", "episodeId": "22222222-2222-7222-8222-222222222222", "episodeSessionFile": str(repository / "episode.jsonl"), "branch": "episode/alpha-plan", "worktree": str(repository), "sessionName": "alpha-plan-episode", "identityVersion": 2, "admission": "delivered"}
    entry = {"type": "custom", "customType": "prime-claw-conversation-oversight", "data": marker}
    (sessions / f"{owner}.jsonl").write_text(json.dumps(header) + "\n" + json.dumps(entry) + "\n")
    state = tmp_path / "private"
    monkeypatch.setenv("PRIME_AGENT_CODING_AGENT_DIR", str(agent)); monkeypatch.setenv("RLM_SESSION_DIR", str(artifact)); monkeypatch.setenv("RLM_DEPTH", "0"); monkeypatch.setenv("PRIME_CLAW_PRIVATE_STATE_ROOT", str(state)); monkeypatch.chdir(project)
    packet = {"schemaVersion": 1, "kind": module.PACKET_KIND, "repositoryPath": str(repository), "commitOid": commit, "specificationPath": ".ralph/plans/SPECIFICATION.md", "executionPlanPath": ".ralph/plans/EXECUTION_PLAN.md", "evidencePaths": ["docs/evidence/candidate.md"], "focus": "Review this candidate."}
    return state, packet


def test_launch_discovers_exact_model_creates_pending_and_finalizes_actual_handle(tmp_path, monkeypatch) -> None:
    module = load_package(); state, packet = owner_fixture(tmp_path, monkeypatch, module); calls = []
    async def find_models(query, limit): calls.append(("find", query, limit)); return [SimpleNamespace(selector=module.MODEL_SELECTOR)]
    async def spawn(prompt, **kwargs):
        calls.append(("spawn", prompt, kwargs)); pending = list(state.glob("*.pending.json")); assert len(pending) == 1
        record = json.loads(pending[0].read_text()); assert record["phase"] == "PENDING" and record["packet"] == packet
        child = tmp_path / record["childName"].replace("expert-review-", "sub-"); child.mkdir()
        return SimpleNamespace(rlm_child_id=child.name, name=record["childName"], session_dir=child, model=module.MODEL_SELECTOR)
    monkeypatch.setitem(sys.modules, "rlm", SimpleNamespace(find_models=find_models, spawn=spawn))
    handle = asyncio.run(module.launch(packet))
    assert handle.model == module.MODEL_SELECTOR
    assert calls[0] == ("find", module.MODEL_SELECTOR, 2)
    assert calls[1][2] == {"name": calls[1][2]["name"], "model": module.MODEL_SELECTOR, "thinking": module.THINKING_LEVEL}
    assert not list(state.glob("*.pending.json")); finalized = list(state.glob("*.finalized.json")); assert len(finalized) == 1
    record = json.loads(finalized[0].read_text()); assert record["phase"] == "FINALIZED" and record["returnedModel"] == module.MODEL_SELECTOR
    assert state.stat().st_mode & 0o777 == 0o700 and finalized[0].stat().st_mode & 0o777 == 0o600


def test_launch_fails_before_spawn_on_ambiguous_discovery_and_revokes_definite_failure(tmp_path, monkeypatch) -> None:
    module = load_package(); state, packet = owner_fixture(tmp_path, monkeypatch, module); spawn_calls = []
    async def ambiguous(query, limit): return [SimpleNamespace(selector=module.MODEL_SELECTOR), SimpleNamespace(selector="other/model")]
    async def spawn(*args, **kwargs): spawn_calls.append(1); raise RuntimeError("definite spawn failure")
    monkeypatch.setitem(sys.modules, "rlm", SimpleNamespace(find_models=ambiguous, spawn=spawn))
    with pytest.raises(RuntimeError, match="exactly one"): asyncio.run(module.launch(packet))
    assert spawn_calls == [] and not state.exists()
    async def exact(query, limit): return [SimpleNamespace(selector=module.MODEL_SELECTOR)]
    monkeypatch.setitem(sys.modules, "rlm", SimpleNamespace(find_models=exact, spawn=spawn))
    with pytest.raises(RuntimeError, match="definite spawn failure"): asyncio.run(module.launch(packet))
    assert spawn_calls == [1] and not list(state.glob("*.pending.json")) and not list(state.glob("*.finalized.json"))
