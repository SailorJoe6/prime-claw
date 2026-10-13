"""Requirements-inventory integrity and deletion-safety gates.

The inventory keeps current `proven_by` paths on disk and pins retired
`.ralph/plans` proof sources to exact Git objects. That keeps traceability
resolvable after the working-tree plan files are removed (R2-X-4).
"""
import json
import os
import re
import subprocess
from collections import Counter
from pathlib import Path

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INVENTORY = os.path.join(REPO_ROOT, "config", "requirements-inventory.json")
PLAN_REFERENCE_RE = re.compile(
    r"(?P<path>\.ralph/plans/[A-Za-z0-9._/-]+(?:#[A-Za-z0-9._-]+)?)"
    r" @ (?P<commit>[0-9a-f]{40})"
)
PROJECT_TESTING_TASK_PROOFS = {
    "R-T1-3": "PRIMECLAW-20.3 (Slice 4)",
    "R-T1-5": "PRIMECLAW-20.3 (Slice 4); PRIMECLAW-20.6 (Slice 7)",
    "R-TEST-1": "PRIMECLAW-20 (all eight accepted slices)",
    "R-TEST-2": "PRIMECLAW-20.3 (Slice 4)",
    "R-TEST-3": "PRIMECLAW-20.5 (Slice 3)",
    "R-TEST-4": "PRIMECLAW-20.5 (Slice 3)",
    "R-TEST-5": "PRIMECLAW-20.2 (Slice 1); PRIMECLAW-20.5 (Slice 3)",
    "R-TEST-6": "PRIMECLAW-20.2 (Slice 1); PRIMECLAW-20.5 (Slice 3)",
    "R-TEST-7": "PRIMECLAW-20.2 (Slice 1); PRIMECLAW-20.5 (Slice 3)",
    "R-TEST-8": "PRIMECLAW-20.2 (Slice 1); PRIMECLAW-20.1 (Slice 2)",
    "R-TEST-9": "PRIMECLAW-20.7 (Slice 6)",
    "R-TEST-10": (
        "PRIMECLAW-20.2 (Slice 1); PRIMECLAW-20.1 (Slice 2); "
        "PRIMECLAW-20.5 (Slice 3); PRIMECLAW-20.7 (Slice 6); "
        "PRIMECLAW-20.6 (Slice 7)"
    ),
    "R-TEST-11": (
        "PRIMECLAW-20.8 (Slice 5); PRIMECLAW-20.7 (Slice 6); "
        "PRIMECLAW-20.6 (Slice 7)"
    ),
    "R-TEST-12": "PRIMECLAW-20.6 (Slice 7)",
    "R-TEST-13": "PRIMECLAW-20.4 (Slice 8)",
}


def _walk_strings(value, location="inventory"):
    if isinstance(value, dict):
        for key, child in value.items():
            yield from _walk_strings(child, f"{location}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _walk_strings(child, f"{location}[{index}]")
    elif isinstance(value, str):
        yield location, value


def _assert_task_ids_resolve(task_ids):
    backlog_root = Path(REPO_ROOT, "backlog")
    for task_id in task_ids:
        task_files = list(backlog_root.rglob(f"{task_id.lower()} - *.md"))
        assert len(task_files) == 1, f"{task_id} resolved to {task_files}"
        assert f"id: {task_id}\n" in task_files[0].read_text()


def test_inventory_referenced_files_exist():
    inv = json.loads(open(INVENTORY).read())
    missing = []
    for req in inv["requirements"]:
        for group, files in req.get("proven_by", {}).items():
            for f in files:
                if not os.path.exists(os.path.join(REPO_ROOT, f)):
                    missing.append(f"{req['id']}:{group} -> {f}")
    assert not missing, "proven_by references missing files:\n" + "\n".join(missing)


def test_legacy_plan_proof_references_are_pinned_git_objects():
    inv = json.loads(open(INVENTORY).read())
    expected_commit = inv["legacyPlanProofCommit"]
    assert expected_commit == "4a40a0832d561e380da32099f07d3ea2195e7e65"

    references = []
    malformed = []
    for location, value in _walk_strings(inv):
        if ".ralph/plans" not in value:
            continue
        matches = list(PLAN_REFERENCE_RE.finditer(value))
        if len(matches) != value.count(".ralph/plans"):
            malformed.append(f"{location} -> {value}")
            continue
        references.extend((location, match) for match in matches)

    assert not malformed, (
        "legacy plan proof references must use `path @ 40-hex-commit`:\n"
        + "\n".join(malformed)
    )
    assert len(references) == 47
    expected_paths = {
        ".ralph/plans/archive/official-lean-compatibility-cleanup/EXECUTION_PLAN.md",
        ".ralph/plans/archive/official-lean-compatibility-cleanup/SPECIFICATION.md",
        ".ralph/plans/archive/phase1-derisk-gate/REQUIREMENTS.md",
        ".ralph/plans/archive/phase1-derisk-gate/SPECIFICATION.md",
        ".ralph/plans/archive/phase2-runtime/EXECUTION_PLAN.md",
        ".ralph/plans/archive/plugin-test-container/SPECIFICATION.md",
    }
    actual_paths = {
        match.group("path").split("#", 1)[0]
        for _, match in references
    }
    assert actual_paths == expected_paths

    missing = []
    for location, match in references:
        assert match.group("commit") == expected_commit, location
        path = match.group("path").split("#", 1)[0]
        result = subprocess.run(
            ["git", "-C", REPO_ROOT, "cat-file", "-e", f"{expected_commit}:{path}"],
            capture_output=True,
            text=True,
        )
        if result.returncode:
            missing.append(f"{location} -> {path} @ {expected_commit}")
    assert not missing, "pinned legacy proof objects missing:\n" + "\n".join(missing)


def test_project_wide_testing_proofs_use_durable_backlog_tasks():
    inv = json.loads(open(INVENTORY).read())
    requirements = {row["id"]: row for row in inv["requirements"]}
    actual = {
        requirement_id: requirements[requirement_id]["plan"]
        for requirement_id in PROJECT_TESTING_TASK_PROOFS
    }
    assert actual == PROJECT_TESTING_TASK_PROOFS

    task_ids = {
        task_id
        for value in actual.values()
        for task_id in re.findall(r"PRIMECLAW-[0-9]+(?:\.[0-9]+)?", value)
    }
    _assert_task_ids_resolve(task_ids)


def test_current_proof_surfaces_do_not_depend_on_plan_worktree_paths():
    checks = {
        "DEVELOPERS.md": (
            ".ralph/plans/archive/project-wide-testing-strategy/",
            "Backlog task `PRIMECLAW-20`",
        ),
        "LONG_RANGE_PLAN.md": (
            ".ralph/plans/archive/phase2-runtime/",
            "Backlog task\n`PRIMECLAW-6`",
        ),
        "docker/test.Dockerfile": (
            ".ralph/plans/SPECIFICATION.md",
            "docs/testing-strategy.md",
        ),
        "docs/derisk/README.md": (
            "](../../.ralph/plans/",
            "REQUIREMENTS.md @ 4a40a0832d561e380da32099f07d3ea2195e7e65",
        ),
        "docs/derisk/U1.md": (
            "](../../.ralph/plans/",
            "REQUIREMENTS.md @ 4a40a0832d561e380da32099f07d3ea2195e7e65",
        ),
        "docs/derisk/U2.md": (
            "](../../.ralph/plans/",
            "REQUIREMENTS.md @ 4a40a0832d561e380da32099f07d3ea2195e7e65",
        ),
        "docs/user-stories/traceability.md": (
            "repeated archived version-1 compatibility Episode deliveries in `.ralph/plans/archive/`",
            "`PRIMECLAW-10.15`, `PRIMECLAW-10.24`, and `PRIMECLAW-10.26`",
        ),
    }
    for relative_path, (forbidden, required) in checks.items():
        text = Path(REPO_ROOT, relative_path).read_text()
        assert forbidden not in text, relative_path
        assert required in text, relative_path
    _assert_task_ids_resolve({
        "PRIMECLAW-6", "PRIMECLAW-10.15", "PRIMECLAW-10.24", "PRIMECLAW-10.26",
        "PRIMECLAW-20",
    })


def test_inventory_covers_phase2_requirements():
    inv = json.loads(open(INVENTORY).read())
    ids = {r["id"] for r in inv["requirements"]}
    # the Phase 2 lifecycle gates must all be tracked
    for rid in ("R2-A-1", "R2-A-2", "R2-C-2", "R2-C-3", "R2-C-5", "R2-X-1",
                "R-TEST-1", "R-TEST-5", "R-TEST-6", "R-TEST-7", "R-TEST-8", "R-TEST-10", "R-TEST-12", "R-TEST-13"):
        assert rid in ids, f"inventory missing {rid}"

def test_r_test_inventory_is_exactly_once_and_complete():
    inv = json.loads(open(INVENTORY).read())
    counts = Counter(r["id"] for r in inv["requirements"] if r["id"].startswith("R-TEST-"))
    assert counts == Counter({f"R-TEST-{i}": 1 for i in range(1, 14)})


def test_inventory_covers_exact_official_lean_role_protocol_requirements():
    inv = json.loads(open(INVENTORY).read())
    section = inv["officialLeanRoleProtocol"]
    rows = section["requirements"]
    assert [row["id"] for row in rows] == [f"ORP-{number:03d}" for number in range(1, 24)]
    commit = inv["legacyPlanProofCommit"]
    spec = ".ralph/plans/archive/official-lean-compatibility-cleanup/SPECIFICATION.md"
    plan = ".ralph/plans/archive/official-lean-compatibility-cleanup/EXECUTION_PLAN.md"
    assert section["spec"] == f"{spec} @ {commit}"
    assert section["plan"] == f"{plan} @ {commit}"
    assert section["activeSlice"] == "S7 immutable final candidate freeze and review"
    missing = []
    for row in rows:
        assert row["authority"] == f"{plan}#5-requirement-traceability @ {commit}"
        assert row["status"] in {
            "accepted-through-s3", "accepted-gate-a", "accepted-through-s5",
            "active-s4", "active-s4-review-repair", "active-s6-final-replay-audit",
            "active-s6-final-source", "active-s6-final-gates",
            "active-s6-final-evidence", "active-s6-final-docs",
            "pending-later-gate", "pending-gate-b",
        }
        for path in row["evidence"]:
            if not os.path.isfile(os.path.join(REPO_ROOT, path)):
                missing.append(f"{row['id']} -> {path}")
    assert not missing, "official lean evidence paths missing:\n" + "\n".join(missing)
