"""Phase 2 requirements-inventory integrity gate (replaces the retired
test_phase1_sandbox.py::test_inventory_referenced_files_exist).

Guarantees every `proven_by` reference in config/requirements-inventory.json
points at a REAL file path that exists on disk — the traceability contract that
keeps the R2-* coverage claims honest (R2-X-4).
"""
import json, os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INVENTORY = os.path.join(REPO_ROOT, "config", "requirements-inventory.json")


def test_inventory_referenced_files_exist():
    inv = json.loads(open(INVENTORY).read())
    missing = []
    for req in inv["requirements"]:
        for group, files in req.get("proven_by", {}).items():
            for f in files:
                if not os.path.exists(os.path.join(REPO_ROOT, f)):
                    missing.append(f"{req['id']}:{group} -> {f}")
    assert not missing, "proven_by references missing files:\n" + "\n".join(missing)


def test_inventory_covers_phase2_requirements():
    inv = json.loads(open(INVENTORY).read())
    ids = {r["id"] for r in inv["requirements"]}
    # the Phase 2 lifecycle gates must all be tracked
    for rid in ("R2-A-1", "R2-A-2", "R2-C-2", "R2-C-3", "R2-C-5", "R2-X-1"):
        assert rid in ids, f"inventory missing {rid}"

def test_inventory_covers_exact_official_lean_role_protocol_requirements():
    inv = json.loads(open(INVENTORY).read())
    section = inv["officialLeanRoleProtocol"]
    rows = section["requirements"]
    assert [row["id"] for row in rows] == [f"ORP-{number:03d}" for number in range(1, 24)]
    assert section["spec"] == ".ralph/plans/SPECIFICATION.md"
    assert section["plan"] == ".ralph/plans/EXECUTION_PLAN.md"
    assert section["activeSlice"] == "S4 final stop-loss lossless version-capture repair and successor freeze"
    missing = []
    for row in rows:
        assert row["status"] in {"accepted-through-s3", "active-s4", "active-s4-review-repair", "pending-later-gate"}
        for path in row["evidence"]:
            if not os.path.isfile(os.path.join(REPO_ROOT, path)):
                missing.append(f"{row['id']} -> {path}")
    assert not missing, "official lean evidence paths missing:\n" + "\n".join(missing)
