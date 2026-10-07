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
    assert digest == "49e2f48421902721b25751380a2173cd8a44ad1c6c4655e7a9a4a8e583983ce6"
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


def replace_marker_worktree(monkeypatch, worktree: str) -> None:
    sessions = Path(os.environ["PRIME_AGENT_CODING_AGENT_DIR"]) / "sessions"
    session_file = next(sessions.glob("*.jsonl"))
    entries = [json.loads(line) for line in session_file.read_text().splitlines()]
    entries[1]["data"]["worktree"] = worktree
    session_file.write_text("".join(json.dumps(entry) + "\n" for entry in entries))



def claimed_fixture(tmp_path: Path, monkeypatch):
    module = load_package()
    state, packet = owner_fixture(tmp_path, monkeypatch, module)

    async def find_models(query, limit):
        return [SimpleNamespace(selector=module.MODEL_SELECTOR)]

    async def spawn(prompt, **kwargs):
        pending = next(state.glob("*.pending.json"))
        pending_record = json.loads(pending.read_text())
        child_directory = tmp_path / "sub-report"
        child_directory.mkdir()
        return SimpleNamespace(
            rlm_child_id=child_directory.name,
            name=pending_record["childName"],
            session_dir=child_directory,
            model=module.MODEL_SELECTOR,
        )

    monkeypatch.setitem(sys.modules, "rlm", SimpleNamespace(find_models=find_models, spawn=spawn))
    asyncio.run(module.launch(packet))
    finalized = next(state.glob("*.finalized.json"))
    record = json.loads(finalized.read_text())
    child_id = "33333333-3333-7333-8333-333333333333"
    child_file = Path(record["sessionDir"]) / f"{child_id}.jsonl"
    child_header = {
        "type": "session", "version": 3, "id": child_id,
        "timestamp": "2026-10-07T00:00:00Z", "cwd": record["projectPath"],
        "parentSession": record["ownerSessionFile"], "rlmDepth": 1,
    }
    child_file.write_text(json.dumps(child_header) + "\n")
    claimed_record = {
        **record, "phase": "CLAIMED", "claimedAt": int(__import__("time").time() * 1000),
        "childSessionId": child_id, "childSessionFile": str(child_file),
        "childSessionName": record["childName"],
    }
    claimed = state / f"{record['childName']}.claimed.json"
    claimed.write_text(json.dumps(claimed_record, sort_keys=True, separators=(",", ":")) + "\n")
    os.chmod(claimed, 0o600)
    finalized.unlink()
    monkeypatch.setenv("RLM_DEPTH", "1")
    monkeypatch.setenv("RLM_SESSION_DIR", record["sessionDir"])
    owner_artifact = Path(os.environ["PRIME_AGENT_CODING_AGENT_DIR"]) / "session-artifacts" / record["ownerSessionId"]
    return module, state, packet, claimed_record, owner_artifact


def pass_report():
    return {"schemaVersion": 1, "verdict": "PASS", "summary": "The exact candidate passes.", "findings": []}


def owner_runtime(monkeypatch, owner_artifact: Path) -> None:
    monkeypatch.setenv("RLM_DEPTH", "0")
    monkeypatch.setenv("RLM_SESSION_DIR", str(owner_artifact))


@pytest.mark.parametrize("spelling", ["dot-segment", "symlink", "nested"])
def test_launch_rejects_noncanonical_or_nonroot_marker_before_state_and_spawn(
    spelling, tmp_path, monkeypatch
) -> None:
    module = load_package()
    state, packet = owner_fixture(tmp_path, monkeypatch, module)
    repository = Path(packet["repositoryPath"])
    if spelling == "dot-segment":
        worktree = f"{repository.parent}/./{repository.name}"
    elif spelling == "symlink":
        link = tmp_path / "episode-link"
        link.symlink_to(repository, target_is_directory=True)
        worktree = str(link)
    else:
        nested = repository / "nested"
        nested.mkdir()
        worktree = str(nested)
    replace_marker_worktree(monkeypatch, worktree)
    calls = []

    async def find_models(*args, **kwargs):
        calls.append("find")
        return [SimpleNamespace(selector=module.MODEL_SELECTOR)]

    async def spawn(*args, **kwargs):
        calls.append("spawn")
        raise AssertionError("spawn must not run")

    monkeypatch.setitem(sys.modules, "rlm", SimpleNamespace(find_models=find_models, spawn=spawn))
    with pytest.raises(RuntimeError, match="exact active episode worktree root"):
        asyncio.run(module.launch(packet))
    assert calls == []
    assert not state.exists()


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


def test_launch_rejects_dirty_candidate_before_model_discovery_and_state(tmp_path, monkeypatch) -> None:
    module = load_package()
    state, packet = owner_fixture(tmp_path, monkeypatch, module)
    (Path(packet["repositoryPath"]) / "untracked").write_text("mutation\n")
    calls = []

    async def find_models(*args, **kwargs):
        calls.append("find")
        return []

    monkeypatch.setitem(sys.modules, "rlm", SimpleNamespace(find_models=find_models))
    with pytest.raises(RuntimeError, match="clean candidate worktree"):
        asyncio.run(module.launch(packet))
    assert calls == []
    assert not state.exists()


def test_child_report_and_owner_settlement_are_digest_exact_and_idempotent(tmp_path, monkeypatch) -> None:
    module, state, _packet, record, owner_artifact = claimed_fixture(tmp_path, monkeypatch)
    submitted = module.submit(pass_report())
    assert submitted["report"]["verdict"] == "PASS"
    assert submitted["receipt"]["phase"] == "REPORTED"
    assert submitted["receipt"]["repositoryUnchanged"] is True
    reported = state / f"{record['childName']}.reported.json"
    assert reported.exists() and not list(state.glob("*.claimed.json"))
    assert module.submit(pass_report()) == submitted

    owner_runtime(monkeypatch, owner_artifact)
    settled = module.settle()
    assert settled["report"] == submitted["report"]
    assert settled["reportReceipt"] == submitted["receipt"]
    assert settled["settlementReceipt"]["phase"] == "SETTLED"
    assert not reported.exists()
    assert module.settle() == settled

    monkeypatch.setenv("RLM_DEPTH", "1")
    monkeypatch.setenv("RLM_SESSION_DIR", record["sessionDir"])
    with pytest.raises(RuntimeError, match="cannot be replayed"):
        module.submit(pass_report())


def test_report_validation_requires_bounded_shape_and_actionable_block(tmp_path, monkeypatch) -> None:
    module, state, _packet, record, _owner_artifact = claimed_fixture(tmp_path, monkeypatch)
    block = {
        "schemaVersion": 1, "verdict": "BLOCK", "summary": "A material issue remains.",
        "findings": [{
            "severity": "BLOCK", "summary": "Broken invariant", "evidence": "tests/x.py:1",
            "remediation": "",
        }],
    }
    with pytest.raises(ValueError, match="actionable BLOCK remediation"):
        module.submit(block)
    with pytest.raises(ValueError, match="malformed or oversized"):
        module.submit({"schemaVersion": 1, "verdict": "PASS", "summary": "x" * 4001, "findings": []})
    with pytest.raises(ValueError, match="verdict and findings disagree"):
        module.submit({
            "schemaVersion": 1, "verdict": "PASS", "summary": "not pass",
            "findings": [{"severity": "ADVISORY", "summary": "note", "evidence": "e", "remediation": ""}],
        })
    oversized = {
        "schemaVersion": 1, "verdict": "BLOCK", "summary": "bounded",
        "findings": [{
            "severity": "BLOCK", "summary": "s" * 1000,
            "evidence": "e" * 4000, "remediation": "r" * 4000,
        } for _ in range(2)],
    }
    with pytest.raises(ValueError, match="report is too large"):
        module.submit(oversized)
    assert (state / f"{record['childName']}.claimed.json").exists()

    block["findings"][0]["remediation"] = "Validate the exact binding before publication and add a negative replay test."
    result = module.submit(block)
    assert result["report"]["verdict"] == "BLOCK"
    conflict = {"schemaVersion": 1, "verdict": "PASS", "summary": "conflict", "findings": []}
    with pytest.raises(RuntimeError, match="conflicting"):
        module.submit(conflict)


def test_report_fails_closed_for_wrong_runtime_or_unclaimed_launch(tmp_path, monkeypatch) -> None:
    module, state, _packet, record, _owner_artifact = claimed_fixture(tmp_path, monkeypatch)
    other = tmp_path / "sub-other"
    other.mkdir()
    monkeypatch.setenv("RLM_SESSION_DIR", str(other))
    with pytest.raises(RuntimeError, match="exactly one private review state"):
        module.submit(pass_report())
    assert (state / f"{record['childName']}.claimed.json").exists()
    monkeypatch.setenv("RLM_SESSION_DIR", record["sessionDir"])
    claimed = state / f"{record['childName']}.claimed.json"
    claimed.unlink()
    with pytest.raises(RuntimeError, match="exactly one private review state"):
        module.submit(pass_report())




@pytest.mark.parametrize("mutation,pattern", [
    ("model", "model lineage"),
    ("generation", "generation changed"),
    ("child", "child session header"),
    ("candidate", "snapshot is invalid"),
    ("packet", "packet digest"),
])
def test_report_revalidates_claimed_host_lineage(mutation, pattern, tmp_path, monkeypatch) -> None:
    module, state, _packet, record, _owner_artifact = claimed_fixture(tmp_path, monkeypatch)
    claimed = state / f"{record['childName']}.claimed.json"
    value = json.loads(claimed.read_text())
    if mutation == "model":
        value["returnedModel"] = "openai-codex/wrong"
    elif mutation == "generation":
        value["ownerGeneration"] = "0" * 64
    elif mutation == "child":
        value["childSessionId"] = "44444444-4444-7444-8444-444444444444"
    elif mutation == "candidate":
        value["candidateCommitOid"] = "d" * 40
    else:
        value["packet"]["focus"] = "tampered packet"
    claimed.write_text(json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")
    os.chmod(claimed, 0o600)
    with pytest.raises(RuntimeError, match=pattern):
        module.submit(pass_report())
    assert claimed.exists()
    assert not list(state.glob("*.reported.json"))


@pytest.mark.parametrize("mutation,pattern", [
    ("digest", "digest, receipt, or repository evidence"),
    ("receipt", "digest, receipt, or repository evidence"),
    ("model", "model lineage"),
])
def test_settlement_revalidates_immutable_report_and_spawn_lineage(mutation, pattern, tmp_path, monkeypatch) -> None:
    module, state, _packet, record, owner_artifact = claimed_fixture(tmp_path, monkeypatch)
    module.submit(pass_report())
    reported = state / f"{record['childName']}.reported.json"
    value = json.loads(reported.read_text())
    if mutation == "digest":
        value["reportDigest"] = "0" * 64
    elif mutation == "receipt":
        value["reportReceipt"]["reportedAt"] += 1
    else:
        value["returnedModel"] = "openai-codex/wrong"
    reported.write_text(json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")
    os.chmod(reported, 0o600)
    owner_runtime(monkeypatch, owner_artifact)
    with pytest.raises(RuntimeError, match=pattern):
        module.settle()
    assert reported.exists()
    assert not list(state.glob("*.settled.json"))




def test_settlement_requires_exact_current_owner_session_file(tmp_path, monkeypatch) -> None:
    module, state, _packet, record, owner_artifact = claimed_fixture(tmp_path, monkeypatch)
    module.submit(pass_report())
    reported = state / f"{record['childName']}.reported.json"
    value = json.loads(reported.read_text())
    copied_owner = tmp_path / "copied-owner.jsonl"
    copied_owner.write_bytes(Path(value["ownerSessionFile"]).read_bytes())
    value["ownerSessionFile"] = str(copied_owner)
    reported.write_text(json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")
    os.chmod(reported, 0o600)
    owner_runtime(monkeypatch, owner_artifact)
    with pytest.raises(RuntimeError, match="exactly one matching reported or settled review"):
        module.settle()
    assert reported.exists()


def test_idempotent_settled_read_revalidates_immutable_result(tmp_path, monkeypatch) -> None:
    module, state, _packet, record, owner_artifact = claimed_fixture(tmp_path, monkeypatch)
    module.submit(pass_report())
    owner_runtime(monkeypatch, owner_artifact)
    module.settle()
    settled = state / f"{record['childName']}.settled.json"
    value = json.loads(settled.read_text())
    value["settlementResult"]["settlementReceipt"]["settledAt"] += 1
    settled.write_text(json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")
    os.chmod(settled, 0o600)
    with pytest.raises(RuntimeError, match="settled official EXPERT report or receipt"):
        module.settle()


def test_report_records_and_rejects_post_review_repository_mutation(tmp_path, monkeypatch) -> None:
    module, state, packet, record, owner_artifact = claimed_fixture(tmp_path, monkeypatch)
    (Path(packet["repositoryPath"]) / "candidate").write_text("reviewer mutation\n")
    with pytest.raises(RuntimeError, match="recorded a mutated candidate"):
        module.submit(pass_report())
    reported_path = state / f"{record['childName']}.reported.json"
    reported = json.loads(reported_path.read_text())
    assert reported["reportAccepted"] is False
    assert reported["postReviewRepository"]["clean"] is False
    assert reported["postReviewRepository"]["statusBytes"] > 0
    owner_runtime(monkeypatch, owner_artifact)
    with pytest.raises(RuntimeError, match="rejected a mutated candidate"):
        module.settle()


def test_settlement_preserves_mutation_evidence_and_cannot_retry(tmp_path, monkeypatch) -> None:
    module, state, packet, record, owner_artifact = claimed_fixture(tmp_path, monkeypatch)
    module.submit(pass_report())
    (Path(packet["repositoryPath"]) / "candidate").write_text("post-report mutation\n")
    owner_runtime(monkeypatch, owner_artifact)
    with pytest.raises(RuntimeError, match="settlement recorded a mutated candidate"):
        module.settle()
    rejection = state / f"{record['childName']}.settlement-rejected.json"
    evidence = json.loads(rejection.read_text())
    assert evidence["phase"] == "SETTLEMENT_REJECTED"
    assert evidence["settlementRepository"]["clean"] is False
    assert (state / f"{record['childName']}.reported.json").exists()
    with pytest.raises(RuntimeError, match="already rejected"):
        module.settle()
