"""Phase 2 requirements-inventory integrity gate (replaces the retired
test_phase1_sandbox.py::test_inventory_referenced_files_exist).

Guarantees every `proven_by` reference in config/requirements-inventory.json
points at a REAL file path that exists on disk — the traceability contract that
keeps the R2-* coverage claims honest (R2-X-4).
"""
import json, os
from collections import Counter

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
    for rid in ("R2-A-1", "R2-A-2", "R2-C-2", "R2-C-3", "R2-C-5", "R2-X-1",
                "R-TEST-1", "R-TEST-5", "R-TEST-6", "R-TEST-7", "R-TEST-8", "R-TEST-10", "R-TEST-12", "R-TEST-13"):
        assert rid in ids, f"inventory missing {rid}"


def test_r_test_inventory_is_exactly_once_and_complete():
    inv = json.loads(open(INVENTORY).read())
    counts = Counter(r["id"] for r in inv["requirements"] if r["id"].startswith("R-TEST-"))
    assert counts == Counter({f"R-TEST-{i}": 1 for i in range(1, 14)})
