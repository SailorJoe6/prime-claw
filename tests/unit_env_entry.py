"""Fail-closed entry guard for explicit Slice-5 unit-env body modules."""

import os
from pathlib import Path


def require_unit_env() -> None:
    if os.environ.get("PRIME_CLAW_UNIT_ENV_BODY") != "1":
        raise RuntimeError(
            "unit-env body refused: invoke through tests/test_unit_env_bridges.py"
        )
    workspace = Path(__file__).resolve().parents[1]
    if workspace != Path("/workspace") or not Path("/.dockerenv").is_file():
        raise RuntimeError("unit-env body refused outside the disposable container")
